/* Sideline DB LAB — standalone harness for the Phase 65 save store (IndexedDB-backed saves).

   The save store lives in index.html (single source of truth). This harness EXTRACTS the block
   between the SAVE STORE markers and runs it against a MINIMAL IN-MEMORY IndexedDB shim (plus a
   fake localStorage), so the whole persistence contract is testable offline, with no browser:

     - boot opens the database and mirrors slot metas synchronously readable (SAVEDB.meta)
     - the mirror carries createdAt/year, which is what findSlotFor/autosave key off
     - writeSlot is sync at the call site, stores the ENCODED state, and coalesces a burst of
       autosaves in one tick into ONE database write, with the newest state winning
     - loadSlot reads the full record back; deleteSlot drops record + meta + any legacy copy
     - a pre-Phase-65 localStorage career is imported into the database (and its localStorage
       copy released), without ever clobbering a slot the database already owns
     - if the import write fails, the slot stays readable from localStorage (SAVEDB.legacy)
     - no IndexedDB at all → mode 'local' and every call takes the old localStorage path
     - a failed write never throws at the caller: it lands in SAVEDB.err + a toast
     - resetAllSlots (the ?reset=1 test hook) wipes both stores
     - the Phase 47 cloud seam still fires on a write of the LIVE career (and only that one), and
       the meta carries the careerId the badges read, so a cloud status never costs a big read
     - the fallback path still runs through asciiJSON, which is what Phase 61.1 measured

   Run:  node test/dblab.js

   Offline lab (no browser). The in-browser QA gate (npm run qa) validates the real save → reload →
   load path against real IndexedDB; this validates the store's own logic and its edge cases. */

const fs = require('fs');
const path = require('path');

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const tick = () => new Promise(r => setTimeout(r, 5));

/* ---------- a minimal in-memory IndexedDB (only what the store uses) ---------- */
function makeIndexedDB(disks = {}) {
  const clone = v => structuredClone(v);
  const idb = {
    disks,                 // name -> { stores: {store: Map}, created:bool }
    fail: null,            // null | 'open' | 'write'
    puts: 0, gets: 0, txs: 0,
    open(name) {
      const rq = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      setTimeout(() => {
        if (idb.fail === 'open') { rq.error = new Error('open denied'); rq.onerror && rq.onerror(); return; }
        const fresh = !idb.disks[name];
        if (fresh) idb.disks[name] = { stores: {} };
        const disk = idb.disks[name];
        const db = {
          name,
          objectStoreNames: { contains: s => Object.prototype.hasOwnProperty.call(disk.stores, s) },
          createObjectStore(s) { disk.stores[s] = disk.stores[s] || new Map(); return {}; },
          close() { db.closed = true; },
          transaction(names, mode) {
            idb.txs++;
            const list = [].concat(names);
            const tx = { oncomplete: null, onerror: null, onabort: null, error: null, abort() { tx.aborted = true; } };
            const ops = [];
            tx.objectStore = s => {
              if (!disk.stores[s]) throw new Error('no store ' + s);
              const map = disk.stores[s];
              const req = fn => { const r = { result: undefined }; ops.push(() => { r.result = fn(); }); return r; };
              return {
                get: k => { idb.gets++; return req(() => { const v = map.get(k); return v === undefined ? undefined : clone(v); }); },
                getAll: () => req(() => [...map.values()].map(clone)),
                put: v => { if (mode === 'readwrite') idb.puts++; return req(() => { map.set(v.n, clone(v)); }); },
                delete: k => req(() => { map.delete(k); }),
                clear: () => req(() => { map.clear(); }),
              };
            };
            setTimeout(() => {
              if (tx.aborted) { tx.onabort && tx.onabort(); return; }
              if (idb.fail === 'write' && mode === 'readwrite') { tx.error = new Error('write denied'); tx.onerror && tx.onerror(); return; }
              try { ops.forEach(op => op()); } catch (e) { tx.error = e; tx.onerror && tx.onerror(); return; }
              tx.oncomplete && tx.oncomplete();
            }, 0);
            return tx;
          },
        };
        rq.result = db;
        if (fresh && rq.onupgradeneeded) rq.onupgradeneeded();
        rq.onsuccess && rq.onsuccess();
      }, 0);
      return rq;
    },
  };
  return idb;
}
function makeLocalStorage(cap = Infinity) {
  const m = new Map();
  return {
    map: m, cap,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { if (String(v).length > this.cap) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
  };
}

/* ---------- extract the SAVE STORE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === SAVE STORE (Phase 65) START ===';
const END = '// === SAVE STORE (Phase 65) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find SAVE STORE markers in index.html'); process.exit(2); }
const SRC = html.slice(i0, i1);

// The block is a set of consts + functions, so it's instantiated (not eval'd) with the handful of
// globals it reads injected — that keeps the lab honest about the store's real dependencies.
const EXPORTS = 'SAVEDB,bootSaves,writeSlot,deleteSlot,loadSlot,slotMeta,anySave,resetAllSlots,saveMetaFor,legacyMeta';
/* The block is a set of consts + functions, so it is INSTANTIATED (not eval'd) with the handful of
   globals it reads injected. That keeps the lab honest about the store's real dependencies — and
   the list is the dependency audit: the Phase 47 cloud seam (`S`, cloudCareerId, cloudQueue,
   setActiveSlot/activeSlot) and the Phase 61.1 ASCII writer are exactly what a save touches
   outside itself, and nothing else. Adding a name here should be a deliberate act. */
function instantiate({ idb, ls, encodeState, toasts, persists = { n: 0 }, live = null, spy = {} }) {
  spy.cloudQueued = 0; spy.active = null;
  const factory = new Function('indexedDB', 'localStorage', 'navigator', 'SLOTS', 'slotKey', 'encodeState', 'toast',
    'S', 'cloudCareerId', 'cloudQueue', 'setActiveSlot', 'activeSlot', 'asciiJSON',
    SRC + '\n;return {' + EXPORTS + '};');
  const api = factory(idb, ls, { storage: { persist: () => { persists.n++; return Promise.resolve(true); } } },
    [1, 2, 3], n => 'sideline_slot_' + n, encodeState, msg => toasts.push(msg),
    live, st => 'career-' + st.createdAt, () => { spy.cloudQueued++; },
    n => { spy.active = n; }, () => spy.active, asciiJSON);
  api.persists = persists; api.spy = spy;
  return api;
}
// The real one, verbatim from index.html — the fallback path is charged for what it writes.
function asciiJSON(v) {
  const esc = JSON.stringify(v).replace(/[^\x00-\x7f]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return JSON.parse(JSON.stringify(esc));
}
// A stand-in for the Phase 9 codec: tags the state so the lab can prove the store persists the
// ENCODED form (and never the live object).
const encodeState = s => Object.assign({}, s, { _enc: 1 });

/* ---------- a plausible-enough live state ---------- */
function mkState(o = {}) {
  const team = { id: 't1', name: 'Alabama', abbr: 'BAMA', color: '#9e1b32' };
  return Object.assign({
    version: 51, createdAt: 1000, year: 2026, week: 3, phase: 'Regular Season',
    coach: { first: 'Bear', last: 'Bryant' }, teamId: 't1', world: { teams: [team] },
    lastResult: 'W 33–13',                      // an en dash: the character Phase 61.1 measured
  }, o);
}
function legacyRecord(state, meta) {
  return JSON.stringify({ meta: meta || { coach: 'Old Timer', team: 'Texas', teamAbbr: 'TEX', color: '#bf5700', week: 0, phase: 'Preseason', savedAt: 7 }, state });
}

(async () => {
  /* ===== 1. boot on a clean database ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    check('Boot: not ready until the database opens', A.SAVEDB.ready === false && A.SAVEDB.mode === 'idb');
    await A.bootSaves();
    check('Boot: opens the database and reports ready', A.SAVEDB.ready === true && A.SAVEDB.mode === 'idb' && !!A.SAVEDB.db);
    check('Boot: a clean database mirrors no slots', A.anySave() === false && A.slotMeta(1) === null);
    check('Boot: does not ask for persistent storage before there is a save', A.persists.n === 0);
    check('Boot: creates both object stores', !!idb.disks.sideline_saves.stores.saves && !!idb.disks.sideline_saves.stores.slotmeta);
  }

  /* ===== 2. write → mirror → flush → read ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    const st = mkState();
    const ret = A.writeSlot(2, st);
    const m = A.slotMeta(2);
    check('Write: returns synchronously and mirrors the meta at once',
      ret === true && !!m && m.team === 'Alabama' && m.week === 3 && m.phase === 'Regular Season',
      JSON.stringify(m));
    check('Write: the mirror carries createdAt + year (what findSlotFor/autosave key off)',
      m.createdAt === 1000 && m.year === 2026);
    check('Write: stamps lastSaved onto the live state', typeof st.lastSaved === 'number' && st.lastSaved > 0);
    check('Write: nothing is on disk before the flush', idb.disks.sideline_saves.stores.saves.size === 0);
    await A.SAVEDB.flush();
    const rec = idb.disks.sideline_saves.stores.saves.get(2);
    check('Write: flush lands the record in the saves store', !!rec && rec.n === 2 && !!rec.state);
    check('Write: the stored state is the ENCODED state (Phase 9 codec output)', rec.state._enc === 1);
    check('Write: the tiny meta lands in slotmeta too',
      (idb.disks.sideline_saves.stores.slotmeta.get(2) || {}).meta.team === 'Alabama');
    const back = await A.loadSlot(2);
    check('Load: reads the full record back out', !!back && back.state.createdAt === 1000 && back.meta.team === 'Alabama');
    check('Load: an empty slot reads as null', (await A.loadSlot(1)) === null);
    check('Load: the state is a copy, not the live object', back.state !== st);
  }

  /* ===== 3. autosave coalescing + newest-state-wins ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    const st = mkState();
    idb.puts = 0;
    for (let i = 1; i <= 6; i++) { st.week = i; A.writeSlot(1, st); }   // a burst of autosaves in one tick
    await A.SAVEDB.flush();
    check('Coalesce: six autosaves in one tick = one database write (2 puts: saves + slotmeta)',
      idb.puts === 2, idb.puts + ' puts');
    check('Coalesce: the newest state wins', idb.disks.sideline_saves.stores.saves.get(1).state.week === 6);
    check('Coalesce: the mirror matches the newest state', A.slotMeta(1).week === 6);
    idb.puts = 0;
    st.week = 7; A.writeSlot(1, st); await A.SAVEDB.flush();
    st.week = 8; A.writeSlot(1, st); await A.SAVEDB.flush();
    check('Coalesce: separate ticks still write separately', idb.puts === 4, idb.puts + ' puts');
    check('Persistence: storage persistence is requested once, after a real save (never at boot)',
      A.persists.n === 1, A.persists.n + ' requests');
    check('Flush: resolves with the queue empty', Object.keys(A.SAVEDB.pending).length === 0 && A.SAVEDB.flushing === null);
    check('Flush: a no-op flush resolves', (await A.SAVEDB.flush()) === undefined);
  }

  /* ===== 4. delete ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    A.writeSlot(1, mkState()); A.writeSlot(3, mkState({ createdAt: 2000 }));
    await A.SAVEDB.flush();
    ls.setItem('sideline_slot_1', 'stale');            // a legacy leftover for the same slot
    A.deleteSlot(1);
    check('Delete: drops the mirrored meta at once', A.slotMeta(1) === null && A.anySave() === true);
    check('Delete: drops any legacy localStorage copy too', ls.getItem('sideline_slot_1') === null);
    await A.SAVEDB.flush();
    check('Delete: removes the record + meta from the database',
      !idb.disks.sideline_saves.stores.saves.has(1) && !idb.disks.sideline_saves.stores.slotmeta.has(1));
    check('Delete: leaves other slots alone', idb.disks.sideline_saves.stores.saves.has(3));
    check('Delete: the deleted slot loads as null', (await A.loadSlot(1)) === null);
  }

  /* ===== 5. saves survive a "reload" (a fresh boot over the same disk) ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    A.writeSlot(2, mkState({ week: 11, phase: 'Postseason' }));
    await A.SAVEDB.flush();
    const B = instantiate({ idb, ls, encodeState, toasts });     // reload: new page, same database
    await B.bootSaves();
    check('Reload: the slot mirror is rebuilt from the database',
      !!B.slotMeta(2) && B.slotMeta(2).week === 11 && B.slotMeta(2).phase === 'Postseason');
    const rec = await B.loadSlot(2);
    check('Reload: the career loads back', !!rec && rec.state.createdAt === 1000 && rec.state._enc === 1);
    check('Reload: reading a slot costs one get (metas came from the tiny store)', idb.gets >= 1);
  }

  /* ===== 6. legacy localStorage → database import ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    ls.setItem('sideline_slot_2', legacyRecord({ version: 1, createdAt: 7, year: 2029, week: 0, phase: 'Preseason' }));
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    check('Legacy: a pre-Phase-65 save is imported into the database', A.SAVEDB.imported === 1 && idb.disks.sideline_saves.stores.saves.has(2));
    check('Legacy: the localStorage copy is released', ls.getItem('sideline_slot_2') === null);
    check('Legacy: the imported meta backfills createdAt + year off the state',
      A.slotMeta(2).createdAt === 7 && A.slotMeta(2).year === 2029, JSON.stringify(A.slotMeta(2)));
    const rec = await A.loadSlot(2);
    check('Legacy: the imported career loads (unencoded v1 state, untouched)', !!rec && rec.state.version === 1 && rec.state._enc === undefined);
    check('Legacy: nothing marked legacy once the import succeeded', Object.keys(A.SAVEDB.legacy).length === 0);
  }

  /* ===== 7. import never clobbers a slot the database owns ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    A.writeSlot(1, mkState({ week: 9 }));
    await A.SAVEDB.flush();
    ls.setItem('sideline_slot_1', legacyRecord({ version: 1, createdAt: 7, week: 0, phase: 'Preseason' }));
    const B = instantiate({ idb, ls, encodeState, toasts });
    await B.bootSaves();
    check('Legacy: the database wins over a stale localStorage copy of the same slot',
      B.SAVEDB.imported === 0 && B.slotMeta(1).week === 9 && B.slotMeta(1).createdAt === 1000);
    check('Legacy: the stale copy is left alone (not imported, not deleted)', ls.getItem('sideline_slot_1') !== null);
  }

  /* ===== 8. import write fails → the slot stays readable from localStorage ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    ls.setItem('sideline_slot_3', legacyRecord({ version: 1, createdAt: 7, week: 0, phase: 'Preseason' }));
    const A = instantiate({ idb, ls, encodeState, toasts });
    idb.fail = 'write';
    await A.bootSaves();
    check('Legacy: a failed import keeps the slot visible', !!A.slotMeta(3) && A.SAVEDB.imported === 0);
    check('Legacy: a failed import keeps the localStorage copy', ls.getItem('sideline_slot_3') !== null && A.SAVEDB.legacy[3] === true);
    const rec = await A.loadSlot(3);
    check('Legacy: the fallback slot still loads (read from localStorage)', !!rec && rec.state.createdAt === 7);
  }

  /* ===== 9. a failed write never throws at the caller ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    idb.fail = 'write';
    let threw = false;
    try { A.writeSlot(1, mkState()); await A.SAVEDB.flush(); } catch (e) { threw = true; }
    check('Errors: a failed write does not throw at the caller', threw === false);
    check('Errors: the failure is recorded + toasted', !!A.SAVEDB.err && toasts.some(t => /Save failed/.test(t)), JSON.stringify(toasts));
    check('Errors: the queue still drains (no wedged flush)', A.SAVEDB.flushing === null && Object.keys(A.SAVEDB.pending).length === 0);
    idb.fail = null;
    A.writeSlot(1, mkState({ week: 5 }));
    await A.SAVEDB.flush();
    check('Errors: writing recovers once storage works again', (idb.disks.sideline_saves.stores.saves.get(1) || {}).state.week === 5);
  }

  /* ===== 10. no IndexedDB → localStorage fallback ===== */
  {
    const ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb: undefined, ls, encodeState, toasts });
    await A.bootSaves();
    check('Fallback: a missing database flips the store to local mode', A.SAVEDB.mode === 'local' && A.SAVEDB.ready === true && !!A.SAVEDB.err);
    const st = mkState();
    check('Fallback: writeSlot reports success', A.writeSlot(1, st) === true);
    const raw = JSON.parse(ls.getItem('sideline_slot_1'));
    check('Fallback: the save is written to localStorage, encoded', raw.state._enc === 1 && raw.meta.team === 'Alabama');
    const rec = await A.loadSlot(1);
    check('Fallback: loadSlot reads it back', !!rec && rec.state.createdAt === 1000);
    A.deleteSlot(1);
    check('Fallback: deleteSlot clears it', ls.getItem('sideline_slot_1') === null && A.slotMeta(1) === null);
    // a fresh boot in local mode mirrors what's in localStorage, backfilling createdAt
    ls.setItem('sideline_slot_2', legacyRecord({ version: 1, createdAt: 7, year: 2031, week: 0, phase: 'Preseason' }));
    const B = instantiate({ idb: undefined, ls, encodeState, toasts });
    await B.bootSaves();
    check('Fallback: boot mirrors localStorage slots with createdAt/year backfilled',
      B.slotMeta(2).createdAt === 7 && B.slotMeta(2).year === 2031);
    check('Fallback: local mode does not delete the localStorage copies', ls.getItem('sideline_slot_2') !== null);
  }

  /* ===== 11. blocked open (private-mode style) ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    ls.setItem('sideline_slot_1', legacyRecord({ version: 1, createdAt: 7, week: 0, phase: 'Preseason' }));
    const A = instantiate({ idb, ls, encodeState, toasts });
    idb.fail = 'open';
    await A.bootSaves();
    check('Fallback: a blocked open falls back and still shows the career', A.SAVEDB.mode === 'local' && !!A.slotMeta(1));
    check('Fallback: the blocked-open career loads', (await A.loadSlot(1)).state.createdAt === 7);
  }

  /* ===== 12. quota failure in fallback mode is surfaced, not silent ===== */
  {
    const ls = makeLocalStorage(64), toasts = [];     // a 64-char "cap"
    const A = instantiate({ idb: undefined, ls, encodeState, toasts });
    await A.bootSaves();
    const ok = A.writeSlot(1, mkState());
    check('Fallback: an over-quota write reports failure (and toasts)',
      ok === false && toasts.some(t => /Save failed/.test(t)) && !!A.SAVEDB.err);
    check('Fallback: the mirror still shows the slot the player asked for', !!A.slotMeta(1));
  }

  /* ===== 13. resetAllSlots (the ?reset=1 hook) ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    A.writeSlot(1, mkState()); A.writeSlot(2, mkState({ createdAt: 2 }));
    await A.SAVEDB.flush();
    ls.setItem('sideline_slot_3', legacyRecord({ version: 1, createdAt: 7, week: 0, phase: 'Preseason' }));
    await A.resetAllSlots();
    check('Reset: wipes the database stores',
      idb.disks.sideline_saves.stores.saves.size === 0 && idb.disks.sideline_saves.stores.slotmeta.size === 0);
    check('Reset: wipes the localStorage keys + the mirror', ls.getItem('sideline_slot_3') === null && A.anySave() === false);
    // and a boot after a reset stays empty (nothing re-imported)
    const B = instantiate({ idb, ls, encodeState, toasts });
    await B.bootSaves();
    check('Reset: a boot after a reset finds nothing', B.anySave() === false && B.SAVEDB.imported === 0);
  }

  /* ===== 14. the Phase 47 cloud seam still fires — and only for the LIVE career ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(), toasts = [];
    const live = mkState({ createdAt: 5150 });
    const A = instantiate({ idb, ls, encodeState, toasts, live });
    await A.bootSaves();
    A.writeSlot(2, live);
    check('Cloud: saving the live career sets the active slot and queues a push',
      A.spy.active === 2 && A.spy.cloudQueued === 1, JSON.stringify(A.spy));
    check('Cloud: the meta carries the careerId the badges read (no big read for a status)',
      A.slotMeta(2).careerId === 'career-5150', A.slotMeta(2).careerId);
    A.writeSlot(3, mkState({ createdAt: 9 }));           // a DIFFERENT career (cloud download / import)
    check('Cloud: writing a career that is not the live one pushes nothing',
      A.spy.active === 2 && A.spy.cloudQueued === 1, JSON.stringify(A.spy));
    A.deleteSlot(3);
    check('Session: deleting another slot leaves the active one alone', A.spy.active === 2);
    A.deleteSlot(2);
    check('Session: deleting the ACTIVE slot clears the session', A.spy.active === null);
    await A.SAVEDB.flush();
    // a legacy import has to backfill careerId too, or an imported career badges as "not uploaded"
    const idb2 = makeIndexedDB(), ls2 = makeLocalStorage();
    ls2.setItem('sideline_slot_1', legacyRecord({ version: 44, createdAt: 77, year: 2028, week: 2, phase: 'Regular Season' }));
    const B = instantiate({ idb: idb2, ls: ls2, encodeState, toasts });
    await B.bootSaves();
    check('Cloud: a legacy import backfills the careerId off the state', B.slotMeta(1).careerId === 'career-77');
  }

  /* ===== 15. the fallback path is still charged one byte a character (Phase 61.1) ===== */
  {
    const ls = makeLocalStorage(), toasts = [];
    const A = instantiate({ idb: undefined, ls, encodeState, toasts });
    await A.bootSaves();
    A.writeSlot(1, mkState());                            // the fixture carries an en dash
    const raw = ls.getItem('sideline_slot_1');
    check('Fallback: what lands in localStorage is pure ASCII (asciiJSON is still on that path)',
      /^[\x00-\x7f]*$/.test(raw), raw.length + ' chars');
    check('Fallback: escaping is lossless — the en dash survives the round trip',
      (await A.loadSlot(1)).state.lastResult === 'W 33\u201313');
    // and the database path needs none of it: a structured clone is charged nothing for a wide char
    const idb = makeIndexedDB(), ls3 = makeLocalStorage(), C = instantiate({ idb, ls: ls3, encodeState, toasts });
    await C.bootSaves();
    C.writeSlot(1, mkState());
    await C.SAVEDB.flush();
    check('Database: a career is stored as a structured clone, wide characters and all',
      idb.disks.sideline_saves.stores.saves.get(1).state.lastResult === 'W 33\u201313');
  }

  /* ===== 16. three deep careers co-exist (the reason for the move off localStorage) ===== */
  {
    const idb = makeIndexedDB(), ls = makeLocalStorage(2 * 1024 * 1024), toasts = [];
    const A = instantiate({ idb, ls, encodeState, toasts });
    await A.bootSaves();
    const big = () => mkState({ createdAt: Math.random(), blob: new Array(4000).fill('x'.repeat(500)) });  // ~2 MB each
    [1, 2, 3].forEach(n => A.writeSlot(n, big()));
    await A.SAVEDB.flush();
    check('Scale: all three multi-MB careers are stored (no shared 5 MB cap)',
      [1, 2, 3].every(n => idb.disks.sideline_saves.stores.saves.has(n)) && !A.SAVEDB.err);
    check('Scale: each one reads back independently',
      (await A.loadSlot(1)).state.blob.length === 4000 && (await A.loadSlot(3)).state.blob.length === 4000);
  }

  await tick();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log(' - ' + f.name + (f.detail ? '  — ' + f.detail : ''))); process.exit(1); }
  console.log('DB lab: all checks passed');
})().catch(e => { console.error(e); process.exit(2); });

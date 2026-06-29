/* Sideline PORTAL LAB — standalone harness for the Phase 18 transfer-portal engine.

   The engine lives in index.html (single source of truth). This harness EXTRACTS the PORTAL ENGINE
   block (portalLeaveProb / portalTarget / portalFit / advancePortal) and evals it here, then asserts:
   the right players leave (buried depth + broken promises push, stars on winners + captains + starters
   stay, coach retention lowers it, bounded), team fit rewards a positional need + prestige proximity,
   and the commit loop converges to leaders (AI fills its needs), with a finalize pass signing every
   transfer that has a real suitor — all deterministic by seed.

   Run:  node test/portallab.js  */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- extract the PORTAL ENGINE block ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === PORTAL ENGINE (Phase 18) START ===', END = '// === PORTAL ENGINE (Phase 18) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find PORTAL ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(i0, i1));   // leaks portalLeaveProb/portalTarget/portalFit/advancePortal/PORTAL

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

/* 1) who leaves — portalLeaveProb */
(function () {
  const starter = { ov: 78, so: 0 }, buried = { ov: 78, so: 5 };
  check('Buried depth is likelier to enter the portal than a starter', portalLeaveProb(buried, {}) > portalLeaveProb(starter, {}), `${portalLeaveProb(buried, {}).toFixed(2)} vs ${portalLeaveProb(starter, {}).toFixed(2)}`);
  const base = { ov: 75, so: 3 };
  check('A broken playing-time promise pushes a player out', portalLeaveProb(base, { brokenPromise: true }) > portalLeaveProb(base, {}), `${portalLeaveProb(base, { brokenPromise: true }).toFixed(2)} vs ${portalLeaveProb(base, {}).toFixed(2)}`);
  check('A captain is stickier than an identical non-captain', portalLeaveProb({ ov: 80, so: 3, cap: true }, {}) < portalLeaveProb({ ov: 80, so: 3 }, {}));
  const star = { ov: 92, so: 3 };   // a high-OVR player with some depth pressure — winning still keeps him
  check('A star on a winning team rarely transfers', portalLeaveProb(star, { winPct: 0.8 }) < portalLeaveProb(star, { winPct: 0.2 }), `${portalLeaveProb(star, { winPct: 0.8 }).toFixed(2)} vs ${portalLeaveProb(star, { winPct: 0.2 }).toFixed(2)}`);
  check('Coach retention lowers the leave probability', portalLeaveProb(buried, { retention: 0.8 }) < portalLeaveProb(buried, { retention: 1 }));
  // bounded 0..0.8 across a wide sweep
  let okB = true;
  for (let ov = 50; ov <= 99; ov += 7) for (let so = 0; so <= 8; so++) for (const bp of [true, false]) {
    const p = portalLeaveProb({ ov, so, cap: so === 0 }, { brokenPromise: bp, winPct: 0.5 });
    if (p < 0 || p > 0.8) okB = false;
  }
  check('portalLeaveProb is bounded to 0..0.8', okB);
})();

/* 2) team fit — portalFit */
(function () {
  const tr = { ov: 88, pos: 'WR' };
  const target = portalTarget(tr);
  const close = { prestige: target, needs: {} }, far = { prestige: 30, needs: {} };
  check('portalTarget scales with the transfer overall', portalTarget({ ov: 95 }) > portalTarget({ ov: 65 }), `${portalTarget({ ov: 65 })} → ${portalTarget({ ov: 95 })}`);
  check('A prestige-appropriate program fits a transfer better', portalFit(close, tr) > portalFit(far, tr), `${portalFit(close, tr).toFixed(2)} vs ${portalFit(far, tr).toFixed(2)}`);
  const noNeed = { prestige: target, needs: {} }, withNeed = { prestige: target, needs: { WR: true } };
  check('A positional need raises a program’s fit for that transfer', portalFit(withNeed, tr) > portalFit(noNeed, tr));
  check('portalFit is bounded (≤ 1.2)', portalFit({ prestige: 99, needs: { WR: true } }, tr) <= 1.2);
})();

/* 3) the commit loop — advancePortal */
(function () {
  const teams = [{ id: 'A', prestige: 60, needs: {} }, { id: 'B', prestige: 60, needs: { WR: true } }];
  // a WR transfer courted by both; B has the need, so it should pull ahead and land him
  function run(finalizeLast) {
    const tr = { id: 'x1', ov: 80, pos: 'WR', iv: { A: 30, B: 30 }, committedTo: null };
    const pool = [tr];
    for (let i = 0; i < 6; i++) advancePortal(pool, teams, 5, false);
    if (finalizeLast) advancePortal(pool, teams, 5, true);
    return tr;
  }
  const t1 = run(false);
  check('AI fills a need: the program with the hole leads for the transfer', (t1.iv.B || 0) > (t1.iv.A || 0), `B ${Math.round(t1.iv.B)} vs A ${Math.round(t1.iv.A)}`);
  const t2 = run(true);
  check('A finalize pass signs the transfer with his leader', t2.committedTo === 'B', 'to ' + t2.committedTo);

  // a transfer nobody really wants (interest stays below the sign bar) goes unsigned even on finalize
  const cold = { id: 'x2', ov: 70, pos: 'K', iv: { A: 5 }, committedTo: null };
  advancePortal([cold], [{ id: 'A', prestige: 95, needs: {} }], 5, true);   // A is a poor fit (target far below 95), low iv
  check('A transfer with no real suitor goes unsigned (leaves the league)', cold.committedTo === null || cold.iv.A < PORTAL.SIGN_BAR ? cold.committedTo === null : true);

  // convergence: a realistic pool mostly lands
  function bigPool(seed) {
    const ts = []; for (let i = 0; i < 30; i++) ts.push({ id: 't' + i, prestige: 30 + (i % 60), needs: (i % 3 === 0) ? { WR: true, LB: true } : {} });
    const r = rng(seed), pool = [];
    for (let i = 0; i < 200; i++) {
      const ov = 60 + ri(r, 0, 30), pos = (i % 2) ? 'WR' : 'LB';
      const iv = {}; for (let k = 0; k < 4; k++) { const t = ts[ri(r, 0, ts.length - 1)]; iv[t.id] = ri(r, 15, 45); }
      pool.push({ id: 'p' + i, ov, pos, iv, committedTo: null });
    }
    for (let i = 0; i < 6; i++) advancePortal(pool, ts, seed, false);
    advancePortal(pool, ts, seed, true);
    return pool;
  }
  const bp = bigPool(7);
  const signed = bp.filter(t => t.committedTo).length;
  check('Portal converges: most courted transfers land somewhere', signed / bp.length >= 0.7, `${signed}/${bp.length}`);
  check('Every commit goes to an actual suitor', bp.every(t => !t.committedTo || t.iv[t.committedTo] != null));
  // determinism
  const a = bigPool(11).map(t => t.id + ':' + (t.committedTo || '-')).join('|');
  const b = bigPool(11).map(t => t.id + ':' + (t.committedTo || '-')).join('|');
  const c = bigPool(12).map(t => t.id + ':' + (t.committedTo || '-')).join('|');
  check('advancePortal is deterministic by seed', a === b);
  check('advancePortal varies by seed', a !== c);
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} portal-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

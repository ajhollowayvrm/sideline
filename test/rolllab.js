/* Sideline ROLLOVER LAB — standalone harness for the Phase 5 season-rollover engine.

   The rollover engine lives in index.html (single source of truth). This harness EXTRACTS the
   engine block (between the ROLLOVER ENGINE markers) and evals it here with the same tiny helpers
   + data arrays, then rolls synthetic rosters over many seasons and asserts the output is sane:
   rosters hold at ~84, classes progress + seniors graduate, returning players develop toward
   (never past) their ceiling, signees become freshmen, last season's stats don't carry over,
   league strength stays stable across years, and the whole thing is deterministic by seed.

   Run:  node test/rolllab.js

   Offline lab (no browser). The in-browser QA gate (npm run qa) validates the integrated rollover
   flow end-to-end; this validates the model itself across many seasons. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- data arrays the engine reads (POS must match for target depth) ---------- */
const FN = ['Jaylen', 'Marcus', 'Cole', 'Tyler', 'Devon', 'Isaiah', 'Cam', 'Brock', 'Khalil', 'Trey'];
const LN = ['Carter', 'Williams', 'Hayes', 'Brooks', 'Robinson', 'Bennett', 'Foster', 'Reed', 'Walker', 'Diaz'];
const STATES = ['AL', 'CA', 'FL', 'GA', 'LA', 'OH', 'TX', 'MI', 'PA', 'NC'];
const POS = [["QB", "off", 4, 1.4], ["RB", "off", 5, 1], ["WR", "off", 11, 1.2], ["TE", "off", 5, .8],
["OT", "off", 7, 1], ["OG", "off", 6, .9], ["C", "off", 3, .8],
["DE", "def", 6, 1.1], ["DT", "def", 6, 1], ["LB", "def", 10, 1.1], ["CB", "def", 9, 1.1], ["S", "def", 8, 1],
["K", "st", 2, .4], ["P", "st", 2, .3]];
const CLASSES = ["FR", "RS-FR", "SO", "RS-SO", "JR", "RS-JR", "SR", "RS-SR"];
const TARGET = POS.reduce((t, p) => t + p[2], 0);   // 84
// expected class ladder for assertions (the engine owns its own copy; `const` doesn't leak from eval)
const NEXT = { "FR": "SO", "RS-FR": "RS-SO", "SO": "JR", "RS-SO": "RS-JR", "JR": "SR", "RS-JR": "RS-SR", "SR": null, "RS-SR": null };

/* ---------- extract the ROLLOVER ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === ROLLOVER ENGINE (Phase 5) START ===';
const END = '// === ROLLOVER ENGINE (Phase 5) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find ROLLOVER ENGINE markers in index.html'); process.exit(2); }
// genFreshman/recruitToFreshman now stamp per-player traits via the TRAIT ENGINE block — pull it in first.
const T0 = html.indexOf('// === TRAIT ENGINE (Phase 10) START ==='), T1 = html.indexOf('// === TRAIT ENGINE (Phase 10) END ===');
if (T0 < 0 || T1 < 0) { console.error('Could not find TRAIT ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(T0, T1));   // leaks genTraits/motorMult/comp* into scope
// Phase 51: development, freshman generation and recruit enrollment all move the six-attribute
// profile now (`ov` is read back off it), so the ATTRIBUTE ENGINE must be in scope first.
const A0 = html.indexOf('// === ATTRIBUTE ENGINE (Phase 52) START ==='), A1 = html.indexOf('// === ATTRIBUTE ENGINE (Phase 52) END ===');
if (A0 < 0 || A1 < 0) { console.error('Could not find ATTRIBUTE ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(A0, A1));   // leaks genAttrs/shiftAttrs/centerAttrs/ovrBase/ovrIn
eval(html.slice(i0, i1));   // leaks NEXT_CLASS/developPlayer/genFreshman/recruitToFreshman/rolloverRoster

/* ---------- faithful-enough roster + ratings (mirror index.html genPlayer/genRoster/teamRatings) ---------- */
function genPlayer(r, prestige, posCode) {
  const cls = pick(r, CLASSES);
  const ageBase = { "FR": 18, "RS-FR": 19, "SO": 19, "RS-SO": 20, "JR": 20, "RS-JR": 21, "SR": 21, "RS-SR": 22 }[cls];
  const seniorPush = cls.includes("SR") ? 6 : cls.includes("JR") ? 3 : cls.includes("SO") ? 1 : -1;
  const ov = clamp(Math.round(prestige * 0.55 + ri(r, -9, 9) + seniorPush + 30), 48, 99);
  const pot = clamp(ov + ri(r, -3, 16), ov, 99);
  return {
    id: 'p' + Math.floor(r() * 1e9).toString(36), fn: pick(r, FN), ln: pick(r, LN), pos: posCode,
    yr: cls, age: ageBase + ri(r, 0, 1), st: pick(r, STATES), stars: ov >= 90 ? 5 : ov >= 82 ? 4 : ov >= 72 ? 3 : ov >= 62 ? 2 : 1,
    ov, pot, cap: false, spd: clamp(ov + ri(r, -12, 12), 40, 99), str: clamp(ov + ri(r, -12, 12), 40, 99), awr: clamp(ov + ri(r, -14, 10), 40, 99)
  };
}
function genRoster(r, prestige) {
  const out = [];
  POS.forEach(([code, , n]) => { for (let i = 0; i < n; i++) out.push(genPlayer(r, prestige, code)); });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => {
    arr.sort((a, b) => b.ov - a.ov);
    arr.forEach((p, i) => { if (i >= 2) { const pen = Math.min(2 + (i - 2) * 2.6, 26); p.ov = clamp(Math.round(p.ov - pen), 44, 99); p.pot = clamp(Math.round(p.pot - pen * 0.4), p.ov, 99); } p.so = i; });
  });
  return out;
}
const sideOf = code => POS.find(p => p[0] === code)[1];
function teamOVR(roster) {
  const top = (side) => { const a = roster.filter(p => sideOf(p.pos) === side).sort((x, y) => y.ov - x.ov).slice(0, 11); return a.length ? a.reduce((t, p) => t + p.ov, 0) / a.length : 60; };
  const off = top('off'), def = top('def');
  return Math.round((off + def) / 2);
}
// synthetic blue-chip signees for a team (count + quality scale with prestige), mirrors recruit shape
function genSignees(r, prestige, teamId, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const stars = prestige >= 82 ? (i === 0 ? 5 : 4) : prestige >= 65 ? 4 : 3;
    const ov = clamp((stars === 5 ? 92 : stars === 4 ? 85 : 77) + ri(r, -4, 5), 60, 99);
    out.push({ fn: pick(r, FN), ln: pick(r, LN), pos: pick(r, POS.map(p => p[0])), st: pick(r, STATES), stars, ov, pot: clamp(ov + ri(r, 3, 13), ov, 99), spd: ov, str: ov, awr: ov, committedTo: teamId, promise: null });
  }
  return out;
}

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

/* 1) one rollover: roster holds ~84, seniors graduate, classes advance, freshmen arrive */
(function () {
  const r = rng(2026);
  const roster = genRoster(r, 78);
  const seniorsBefore = roster.filter(p => p.yr === 'SR' || p.yr === 'RS-SR').length;
  const frBefore = roster.filter(p => p.yr === 'FR');
  const signees = genSignees(r, 78, 't0', 12);
  // tag returning players so we can verify class progression after the rollover
  roster.forEach(p => { p._wasYr = p.yr; });
  const res = rolloverRoster(roster, signees, 78, r, { rate: 1 });
  check('Roster holds at ~84 after a rollover', res.roster.length >= 80 && res.roster.length <= 92, res.roster.length + ' players');
  check('Seniors graduated off the roster', res.graduated.length === seniorsBefore && res.graduated.every(p => p.yr === 'SR' || p.yr === 'RS-SR'), res.graduated.length + ' grads');
  check('Signees became true freshmen', res.freshmen.length === signees.length && res.freshmen.every(p => p.yr === 'FR' && p.fromRecruit), res.freshmen.length + ' freshmen');
  check('Every position refilled to at least its target depth', POS.every(([c, , n]) => res.roster.filter(p => p.pos === c).length >= n));
  // class progression: each returning player advanced exactly one class step
  const returners = res.roster.filter(p => p._wasYr);
  check('Returning players advanced exactly one class', returners.every(p => NEXT[p._wasYr] === p.yr), returners.length + ' returners');
  check('Last-season freshmen are now sophomores', frBefore.length === 0 || returners.filter(p => p._wasYr === 'FR').every(p => p.yr === 'SO'));
})();

/* 2) development: returning players move toward pot, never past it; ov rises on average */
(function () {
  const r = rng(7);
  const roster = genRoster(r, 70);
  const before = new Map(roster.map(p => [p.id, p.ov]));
  const gaps = roster.map(p => p.pot - p.ov);
  const res = rolloverRoster(roster, [], 70, r, { rate: 1 });
  const returning = res.roster.filter(p => before.has(p.id));
  check('Returning players never exceed their ceiling (ov ≤ pot)', returning.every(p => p.ov <= p.pot));
  const gained = returning.filter(p => p.ov > before.get(p.id)).length;
  check('Most returning players with upside developed', gained > returning.length * 0.4, gained + '/' + returning.length + ' rose');
  check('Returners with no gap did not change ov', returning.filter(p => p.pot - before.get(p.id) <= 0).every(p => p.ov === before.get(p.id)));
  void gaps;
})();

/* 3) no stat carryover: p.gs is wiped at rollover */
(function () {
  const r = rng(3);
  const roster = genRoster(r, 60);
  roster.forEach(p => { p.gs = { gp: 10, pYds: 2000 }; });
  const res = rolloverRoster(roster, [], 60, r, { rate: 1 });
  check('Rollover wipes last season stats (no p.gs carries over)', res.roster.every(p => !p.gs));
})();

/* 4) promises carry from signee to freshman */
(function () {
  const r = rng(11);
  const signees = genSignees(r, 80, 't0', 4);
  signees[0].promise = { type: 'playingTime' };
  const res = rolloverRoster(genRoster(r, 80), signees, 80, r, { rate: 1 });
  const promised = res.freshmen.filter(p => p.promise && p.promise.type === 'playingTime');
  check('A signee promise carries onto the freshman', promised.length === 1, promised.length + ' promised');
})();

/* 5) recruitToFreshman: enters raw (below recruit ov) with recruit pot as the ceiling */
(function () {
  const r = rng(5);
  const rec = { fn: 'A', ln: 'B', pos: 'QB', st: 'TX', stars: 5, ov: 92, pot: 99, spd: 88, str: 80, awr: 85, promise: null };
  let below = 0, ceil = 0;
  for (let i = 0; i < 50; i++) { const f = recruitToFreshman(rec, r); if (f.ov < rec.ov) below++; if (f.pot >= f.ov && f.pot <= 99) ceil++; }
  check('Elite recruits enter raw (ov discounted below recruit ov)', below >= 45, below + '/50 below');
  check('Freshman ceiling is valid (ov ≤ pot ≤ 99)', ceil === 50);
  /* Phase 58: the player who arrives has to be the one you scouted. The recruit sheet now sells a
     NAMED SHAPE — "Prototypical Gunslinger" — so if the archetype or its purity were regenerated at
     enrolment the whole read would be a lie told at signing time. `recruitToFreshman` already
     carried both; nothing asserted it, and nothing displayed it either until this phase. */
  const shaped = { fn: 'C', ln: 'D', pos: 'WR', st: 'FL', stars: 4, ov: 88, pot: 95,
    arch: 'Deep Threat', pur: 1.31, promise: null };
  const fr = recruitToFreshman(shaped, rng(11));
  check('Phase 58: the archetype you scouted survives onto the roster',
    fr.arch === shaped.arch && fr.pur === shaped.pur, `${shaped.arch} (${shaped.pur}) → ${fr.arch} (${fr.pur})`);
  // and a recruit generated WITHOUT one still gets classified rather than arriving shapeless
  const bare = { fn: 'E', ln: 'F', pos: 'CB', st: 'GA', stars: 3, ov: 78, pot: 88, promise: null };
  check('Phase 58: a shapeless signee is classified on arrival, not left blank',
    !!recruitToFreshman(bare, rng(12)).arch, recruitToFreshman(bare, rng(12)).arch);
})();

/* 6) determinism: same seed → identical rolled roster */
(function () {
  const sig = (seed) => { const r = rng(seed); const res = rolloverRoster(genRoster(rng(99), 75), genSignees(r, 75, 't0', 8), 75, r, { rate: 1 }); return res.roster.map(p => p.pos + p.yr + p.ov).join('|'); };
  check('Rollover deterministic: same seed → identical roster', sig(42) === sig(42));
  check('Rollover varies by seed', sig(42) !== sig(43));
})();

/* 7) multi-season stability: league strength holds across 5 rollovers (no death spiral) */
(function () {
  const r = rng(2026);
  const teams = [];
  for (let i = 0; i < 20; i++) { const prestige = clamp(Math.round(35 + ri(r, -8, 8) + (i < 4 ? 45 : i < 10 ? 25 : 0)), 25, 95); teams.push({ id: 't' + i, prestige, roster: genRoster(r, prestige) }); }
  const ovrAt = () => avg(teams.map(t => teamOVR(t.roster)));
  const start = ovrAt();
  for (let yr = 0; yr < 5; yr++) {
    teams.forEach(t => {
      const n = clamp(Math.round(t.prestige / 8) + ri(r, -2, 2), 2, 22);
      const sg = genSignees(r, t.prestige, t.id, n);
      t.roster = rolloverRoster(t.roster, sg, t.prestige, r, { rate: 1 }).roster;
    });
  }
  const end = ovrAt();
  check('Rosters stay ~84 across 5 seasons', teams.every(t => t.roster.length >= 78 && t.roster.length <= 96), 'sizes ' + Math.min(...teams.map(t => t.roster.length)) + '–' + Math.max(...teams.map(t => t.roster.length)));
  check('League strength stays stable across 5 seasons (±6 OVR)', Math.abs(end - start) <= 6, `start ${start.toFixed(1)} → end ${end.toFixed(1)}`);
  check('Better programs still outrate weaker ones after 5 seasons', teamOVR(teams[0].roster) > teamOVR(teams[19].roster), `${teamOVR(teams[0].roster)} vs ${teamOVR(teams[19].roster)}`);
})();

/* 8) per-player rateFor (Phase 7): a side-specific rate develops only the side it's given to */
(function () {
  const r = rng(2027);
  const roster = genRoster(r, 72);
  const before = new Map(roster.map(p => [p.id, p.ov]));
  // offense develops at full rate, defense frozen at 0
  const res = rolloverRoster(roster, [], 72, r, { rateFor: p => sideOf(p.pos) === 'off' ? 1.2 : 0 });
  const ret = res.roster.filter(p => before.has(p.id));
  const offGrew = ret.filter(p => sideOf(p.pos) === 'off' && p.ov > before.get(p.id)).length;
  const defGrew = ret.filter(p => sideOf(p.pos) === 'def' && p.ov > before.get(p.id)).length;
  check('rateFor honored: offense develops when defense rate is 0', offGrew > 0 && defGrew === 0, `off ${offGrew} grew, def ${defGrew} grew`);
  check('rateFor records growth on the player (p.dev)', ret.some(p => p.dev > 0) && ret.filter(p => sideOf(p.pos) === 'def').every(p => !p.dev));
})();

/* 9) career accumulation (Phase 11): p.career sums milestone keys across seasons; gs still wiped */
(function () {
  const r = rng(2030);
  let roster = genRoster(r, 75);
  const tracked = roster.find(p => p.yr === 'SO');   // a returner we can follow across two seasons
  const id = tracked.id;
  // season 1 box, then roll
  roster.forEach(p => { p.gs = { gp: 12, pYds: 0, rYds: 800, rTD: 9, tkl: 0 }; });
  roster = rolloverRoster(roster, [], 75, r, { rate: 1 }).roster;
  const after1 = roster.find(p => p.id === id);
  check('Career accrues after one season (rYds summed from gs)', after1 && after1.career && after1.career.rYds === 800, after1 ? JSON.stringify(after1.career) : 'gone');
  check('Continuing player has no gs after rollover (still wiped)', after1 && !after1.gs);
  check('peakOv recorded and ≥ current ov', after1 && after1.peakOv >= after1.ov);
  // season 2 box, then roll again — career must add, not replace
  roster.forEach(p => { p.gs = { gp: 13, rYds: 1000, rTD: 11 }; });
  roster = rolloverRoster(roster, [], 75, r, { rate: 1 }).roster;
  const after2 = roster.find(p => p.id === id);
  check('Career accumulates across seasons (rYds 800+1000=1800)', after2 && after2.career.rYds === 1800, after2 ? after2.career.rYds + '' : 'gone');
  check('Career TD totals accumulate (9+11=20)', after2 && after2.career.rTD === 20, after2 ? after2.career.rTD + '' : 'gone');
})();

/* 10) graduates carry a full career incl. their final season */
(function () {
  const r = rng(2031);
  const roster = genRoster(r, 80);
  roster.forEach(p => { p.gs = { gp: 12, reYds: 1200, reTD: 10 }; p.career = { reYds: 3000, reTD: 25 }; });
  const res = rolloverRoster(roster, [], 80, r, { rate: 1 });
  const grad = res.graduated[0];
  check('Graduate career includes final season (reYds 3000+1200)', grad && grad.career.reYds === 4200, grad ? grad.career.reYds + '' : 'none');
  check('Graduate still carries its final-season box (gs) for snapshots', grad && grad.gs && grad.gs.reYds === 1200);
})();

/* 11) Phase 39 — redshirting. redshirtClass eligibility, and the rollover redshirt branch:
   a designated eligible player who sat advances onto the RS track (preserving a year); the
   4-game rule denies it if he played >4; a player already on the RS track can't redshirt again. */
(function () {
  // eligibility helper: FR/SO/JR/SR redshirt INTO the RS version; RS-* (or used) are ineligible
  check('redshirtClass: FR → RS-FR', redshirtClass({ yr: 'FR' }) === 'RS-FR');
  check('redshirtClass: JR → RS-JR', redshirtClass({ yr: 'JR' }) === 'RS-JR');
  check('redshirtClass: an RS-track player is ineligible', redshirtClass({ yr: 'RS-FR' }) === null);
  check('redshirtClass: a used redshirt is ineligible', redshirtClass({ yr: 'SO', rs: 'used' }) === null);

  // a designated FR who sat (no gs) takes the redshirt → RS-FR + rs:'used', and is reported
  const r = rng(3939);
  const fr = { id: 'rs1', fn: 'Red', ln: 'Shirt', pos: 'WR', yr: 'FR', age: 18, st: 'TX', stars: 4, ov: 70, pot: 90, cap: false, spd: 70, str: 70, awr: 70, so: 3, rs: 'on' };
  const res = rolloverRoster([fr], [], 80, r, { rate: 1 });
  const after = res.roster.find(p => p.id === 'rs1');
  check('Redshirt: a sat FR becomes RS-FR (preserves a year)', after && after.yr === 'RS-FR', after ? after.yr : 'gone');
  check('Redshirt: marked rs:"used" (can\'t redshirt twice)', after && after.rs === 'used');
  check('Redshirt: surfaced in summary.redshirted', res.redshirted && res.redshirted.length === 1 && res.redshirted[0].id === 'rs1');
  check('Redshirt: he still develops the year (ov ≥ start)', after && after.ov >= 70);

  // the 4-game rule: a designated player who already played >4 games does NOT redshirt (→ SO), rs cleared
  const r2 = rng(3940);
  const played = { id: 'rs2', fn: 'Too', ln: 'Many', pos: 'RB', yr: 'FR', age: 18, st: 'GA', stars: 3, ov: 68, pot: 80, cap: false, spd: 68, str: 68, awr: 68, so: 2, rs: 'on', gs: { gp: 9, rYds: 600 } };
  const res2 = rolloverRoster([played], [], 75, r2, { rate: 1 });
  const a2 = res2.roster.find(p => p.id === 'rs2');
  check('Redshirt: a designee who played >4 games is denied (→ SO)', a2 && a2.yr === 'SO', a2 ? a2.yr : 'gone');
  check('Redshirt: a wasted designation is cleared (no rs flag)', a2 && a2.rs == null);
  check('Redshirt: a denied redshirt is NOT reported', res2.redshirted.length === 0);

  // eligibility extension: a redshirt buys one extra season on the roster (5 transitions to graduate vs 4)
  const survives = (redshirtYr1) => {
    let r3 = rng(7000), p = { id: 'x', pos: 'TE', yr: 'FR', age: 18, st: 'OH', stars: 3, ov: 70, pot: 70, cap: false, spd: 70, str: 70, awr: 70, so: 1 };
    if (redshirtYr1) p.rs = 'on';
    let seasons = 0;
    for (let i = 0; i < 8; i++) { const rr = rolloverRoster([p], [], 70, r3, { rate: 1 }); p = rr.roster.find(x => x.id === 'x'); if (!p) break; seasons++; }   // backfill fills the roster — track by id
    return seasons;
  };
  check('Redshirt: a redshirted player lasts one extra season (5 vs 4)', survives(true) === survives(false) + 1, survives(true) + ' vs ' + survives(false));

  // AI envelope: rolling a roster with NO redshirt designations is unaffected (redshirted empty)
  const r4 = rng(3941);
  const plain = rolloverRoster(genRoster(rng(55), 75), [], 75, r4, { rate: 1 });
  check('Redshirt: a roster with no designations reports none', plain.redshirted.length === 0);
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} rollover-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

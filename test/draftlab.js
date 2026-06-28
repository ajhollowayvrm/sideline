/* Sideline DRAFT LAB — standalone harness for the Phase 13 NFL-draft engine.

   The draft engine lives in index.html (single source of truth). This harness EXTRACTS the engine block
   (between the DRAFT ENGINE markers) — plus the LEGACY block it reuses (honorWeight + careerScore) — and
   evals them here, then drives a synthetic graduate class and asserts: draft grade is dominated by peak
   OVR and rises with honors/career; the draft fills a 96-pick board ordered best-first with correct round
   assignment and a draftability floor; the factory reputation a pick confers scales with how early it was
   taken and decays over time; and the factory recruiting pull is positive for a matching recruit, negative
   for a rebel, zero off a non-factory — all bounded and deterministic by seed.

   Run:  node test/draftlab.js  */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const POS = [["QB", "off", 4, 1.4], ["RB", "off", 5, 1], ["WR", "off", 11, 1.2], ["TE", "off", 5, .8],
["OT", "off", 7, 1], ["OG", "off", 6, .9], ["C", "off", 3, .8],
["DE", "def", 6, 1.1], ["DT", "def", 6, 1], ["LB", "def", 10, 1.1], ["CB", "def", 9, 1.1], ["S", "def", 8, 1],
["K", "st", 2, .4], ["P", "st", 2, .3]];

/* ---------- extract LEGACY (honorWeight/careerScore) + DRAFT blocks ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function block(start, end, label) {
  const i0 = html.indexOf(start), i1 = html.indexOf(end);
  if (i0 < 0 || i1 < 0) { console.error('Could not find ' + label + ' markers in index.html'); process.exit(2); }
  return html.slice(i0, i1);
}
eval(block('// === LEGACY ENGINE (Phase 11) START ===', '// === LEGACY ENGINE (Phase 11) END ===', 'LEGACY ENGINE'));
eval(block('// === DRAFT ENGINE (Phase 13) START ===', '// === DRAFT ENGINE (Phase 13) END ===', 'DRAFT ENGINE'));

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

const honors = (...a) => a.map(x => ({ year: 2026, award: x }));

/* 1) draftProjection: peak OVR dominates; honors + career raise it; bounded */
(function () {
  const low = draftProjection({ peakOv: 72, honors: [], career: {} });
  const hi = draftProjection({ peakOv: 96, honors: [], career: {} });
  check('Draft grade rises sharply with peak OVR', hi > low + 20, `${low} → ${hi}`);
  const plain = draftProjection({ peakOv: 88, honors: [], career: {} });
  const decorated = draftProjection({ peakOv: 88, honors: honors('Heisman (National POY)', 'All-American'), career: { rYds: 4000, rTD: 40 } });
  check('Honors + career nudge the grade up', decorated > plain, `${plain} → ${decorated}`);
  check('Draft grade is bounded 0..100', draftProjection({ peakOv: 40 }) >= 0 && draftProjection({ peakOv: 99, honors: honors('Heisman (National POY)'), career: { pYds: 14000, pTD: 130 } }) <= 100);
  check('A low-peak walk-on grades below the draftable bar', draftProjection({ peakOv: 70 }) < 40, draftProjection({ peakOv: 70 }) + '');
})();

/* build a realistic graduate class: many teams, varied peak/talent */
function classOf(seed) {
  const r = rng(seed), grads = [];
  for (let t = 0; t < 134; t++) for (let i = 0; i < 21; i++) {
    const peak = clamp(Math.round(62 + r() * 38), 50, 99);
    grads.push({ id: 'g' + t + '_' + i, name: 'P' + t + '' + i, pos: POS[Math.floor(r() * POS.length)][0], teamId: 'tm' + t, abbr: 'T' + t, color: '#fff', peakOv: peak, honors: peak > 92 ? honors('All-American') : [], career: {} });
  }
  return grads;
}

/* 2) runDraft: 96-pick board, ordered best-first, correct rounds, draftability floor, determinism */
(function () {
  const grads = classOf(7);
  const picks = runDraft(grads, 2026);
  check('Draft fills up to a 96-pick board (3 × 32)', picks.length === 96, picks.length + ' picks');
  check('Picks are numbered 1..N with correct round buckets', picks.every((p, i) => p.pick === i + 1 && p.round === Math.floor(i / 32) + 1));
  check('Round 1 is picks 1–32, round 3 is 65–96', picks[0].round === 1 && picks[31].round === 1 && picks[32].round === 2 && picks[95].round === 3);
  const grades = picks.map(p => p.grade);
  check('Round-1 picks out-grade round-3 picks on average', grades.slice(0, 32).reduce((a, b) => a + b) / 32 > grades.slice(64, 96).reduce((a, b) => a + b) / 32);
  check('Every drafted player clears the draftability bar', picks.every(p => p.grade >= 40));
  check('Draft is deterministic by seed', JSON.stringify(runDraft(grads, 2026)) === JSON.stringify(runDraft(grads, 2026)));
  check('Draft varies by seed (jittered order)', JSON.stringify(runDraft(grads, 2026)) !== JSON.stringify(runDraft(grads, 99)));
  // a thin class drafts fewer than the cap
  const thin = classOf(1).filter(g => g.peakOv >= 95).slice(0, 20);
  check('A thin class drafts fewer than the cap (no padding)', runDraft(thin, 1).length <= 20);
})();

/* 3) factory reputation: earlier picks confer more; decay shrinks it */
(function () {
  const r1 = pickFactoryValue({ round: 1, grade: 90 }), r3 = pickFactoryValue({ round: 3, grade: 75 });
  check('A round-1 pick builds more factory rep than a round-3 pick', r1 > r3, `${r1.toFixed(1)} vs ${r3.toFixed(1)}`);
  check('Factory pick value is bounded (≤ 32)', pickFactoryValue({ round: 1, grade: 100 }) <= 32);
  check('Factory reputation decays toward zero over years', factoryDecay(100) < 100 && factoryDecay(factoryDecay(100)) < factoryDecay(100));
})();

/* 4) factory pull: positive for a matching recruit, negative for a rebel, zero off a non-factory */
(function () {
  const wrU = { factory: { WR: 80, QB: 10 } };
  const none = { factory: {} };
  check('A WR-U pulls a WR recruit (positive fit term)', factoryPull(wrU, { pos: 'WR' }) > 0);
  check('Factory pull is capped small (≤ 0.15)', factoryPull({ factory: { WR: 1000 } }, { pos: 'WR' }) <= 0.15);
  check('No pull at a position the school isn’t a factory for', factoryPull(wrU, { pos: 'CB' }) === 0 && factoryPull(none, { pos: 'WR' }) === 0);
  check('A rebel recruit is REPELLED by a factory (negative pull)', factoryPull(wrU, { pos: 'WR', rebel: true }) < 0);
  check('Bigger factory → stronger pull (and stronger repulsion for a rebel)',
    factoryPull({ factory: { WR: 80 } }, { pos: 'WR' }) > factoryPull({ factory: { WR: 20 } }, { pos: 'WR' }) &&
    factoryPull({ factory: { WR: 80 } }, { pos: 'WR', rebel: true }) < factoryPull({ factory: { WR: 20 } }, { pos: 'WR', rebel: true }));
})();

/* 5) end-to-end: a school that drafts WRs repeatedly builds WR reputation and out-pulls a non-factory */
(function () {
  // simulate 4 drafts where team 'wru' always lands the top WRs
  let wru = { factory: {} };
  for (let y = 0; y < 4; y++) {
    // decay then add two round-1-quality WR picks
    for (const k in wru.factory) wru.factory[k] = factoryDecay(wru.factory[k]);
    [{ round: 1, grade: 92 }, { round: 1, grade: 88 }].forEach(pk => wru.factory.WR = (wru.factory.WR || 0) + pickFactoryValue(pk));
  }
  check('Repeated WR picks build a real WR factory reputation', factoryRep(wru, 'WR') > 30, factoryRep(wru, 'WR').toFixed(1));
  check('The WR-U out-recruits a blank program for a WR', factoryPull(wru, { pos: 'WR' }) > factoryPull({ factory: {} }, { pos: 'WR' }));
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} draft-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

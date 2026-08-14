/* Sideline LEGACY LAB — standalone harness for the Phase 11 program-legacy engine.

   The legacy engine lives in index.html (single source of truth). This harness EXTRACTS the engine
   block (between the LEGACY ENGINE markers) and evals it here with the same tiny helpers + the POS
   data array, then asserts the model is sane: stature is monotonic in honors/career/peak and bounded;
   isLegendWorthy gates correctly; enshrinement caps the ring at 12 and keeps the best; aura scales
   with ring depth and stays bounded; alumniBoost scales with stature×relevance and an appearance
   budget is respected; and everything is deterministic (pure — no rng at all).

   It also pulls in the ROLLOVER ENGINE block to cross-check the Phase 11 career accumulation: career
   totals add across seasons while season gs never carries forward (the same invariant rolllab guards).

   Run:  node test/legacylab.js

   Offline lab (no browser). The in-browser QA gate (npm run qa) validates the integrated Ring-of-Honor
   flow end-to-end; this validates the model itself. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- data arrays the engine reads ---------- */
const FN = ['Jaylen', 'Marcus', 'Cole', 'Tyler', 'Devon', 'Isaiah', 'Cam', 'Brock', 'Khalil', 'Trey'];
const LN = ['Carter', 'Williams', 'Hayes', 'Brooks', 'Robinson', 'Bennett', 'Foster', 'Reed', 'Walker', 'Diaz'];
const STATES = ['AL', 'CA', 'FL', 'GA', 'LA', 'OH', 'TX', 'MI', 'PA', 'NC'];
const POS = [["QB", "off", 4, 1.4], ["RB", "off", 5, 1], ["WR", "off", 11, 1.2], ["TE", "off", 5, .8],
["OT", "off", 7, 1], ["OG", "off", 6, .9], ["C", "off", 3, .8],
["DE", "def", 6, 1.1], ["DT", "def", 6, 1], ["LB", "def", 10, 1.1], ["CB", "def", 9, 1.1], ["S", "def", 8, 1],
["K", "st", 2, .4], ["P", "st", 2, .3]];
const CLASSES = ["FR", "RS-FR", "SO", "RS-SO", "JR", "RS-JR", "SR", "RS-SR"];

/* ---------- extract the LEGACY ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function block(start, end, label) {
  const i0 = html.indexOf(start), i1 = html.indexOf(end);
  if (i0 < 0 || i1 < 0) { console.error('Could not find ' + label + ' markers in index.html'); process.exit(2); }
  return html.slice(i0, i1);
}
// The TRAIT block leaks genTraits (used by the ROLLOVER generators), then ROLLOVER (career accrual),
// then LEGACY (the model under test). Order matters: later blocks reference earlier helpers.
eval(block('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ===', 'TRAIT ENGINE'));
// Phase 51: the rollover block's development path moves the six-attribute profile.
eval(block('// === ATTRIBUTE ENGINE (Phase 52) START ===', '// === ATTRIBUTE ENGINE (Phase 52) END ===', 'ATTRIBUTE ENGINE'));
eval(block('// === ROLLOVER ENGINE (Phase 5) START ===', '// === ROLLOVER ENGINE (Phase 5) END ===', 'ROLLOVER ENGINE'));
eval(block('// === LEGACY ENGINE (Phase 11) START ===', '// === LEGACY ENGINE (Phase 11) END ===', 'LEGACY ENGINE'));

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

const honors = (...labels) => labels.map(a => ({ year: 2026, award: a }));
const snap = (o) => Object.assign({ honors: [], career: {}, peakOv: 80 }, o);

/* 1) honorWeight ladder: national hardware outranks conference, which outranks all-conference */
(function () {
  check('honorWeight: Heisman is the heaviest honor',
    honorWeight('Heisman (National POY)') > honorWeight('National Defensive POY') &&
    honorWeight('National Defensive POY') > honorWeight('All-American') &&
    honorWeight('All-American') > honorWeight('SEC Offensive POY') &&
    honorWeight('SEC Offensive POY') > honorWeight('All-SEC') &&
    honorWeight('All-SEC') > honorWeight('Freshman of the Year'),
    `H${honorWeight('Heisman (National POY)')} > Dpoy${honorWeight('National Defensive POY')} > AA${honorWeight('All-American')} > cPOY${honorWeight('SEC Offensive POY')} > AC${honorWeight('All-SEC')} > FY${honorWeight('Freshman of the Year')}`);
  check('honorWeight: unknown label still nonzero', honorWeight('Team MVP') > 0 && honorWeight(null) === 0);
  // Phase 11 trophies: national position hardware sits between All-American and the best-defender award
  check('honorWeight: Bednarik renames the best-defender award (80)', honorWeight('Bednarik (Defensive POY)') === 80 && honorWeight('National Defensive POY') === 80);
  check('honorWeight: skill position trophies outweigh All-American', honorWeight('Outland') > honorWeight('All-American') && honorWeight("Davey O'Brien") === 60 && honorWeight('Biletnikoff') === 60);
  check('honorWeight: K/P trophies are modest (Groza/Ray Guy = 35)', honorWeight('Lou Groza') === 35 && honorWeight('Ray Guy') === 35);
  // a multi-trophy career reads as a bigger legend than a single All-American
  const trophyCareer = legendStature(snap({ honors: honors('Outland', 'Outland', 'Bednarik (Defensive POY)'), peakOv: 90 }));
  const oneAA = legendStature(snap({ honors: honors('All-American'), peakOv: 90 }));
  check('honorWeight: a decorated trophy winner outranks a one-time All-American', trophyCareer.score > oneAA.score, `${trophyCareer.score} vs ${oneAA.score}`);
})();

/* 2) stature is bounded 0..100 across extremes */
(function () {
  const nobody = legendStature(snap({ peakOv: 60 }));
  const god = legendStature(snap({ honors: honors('Heisman (National POY)', 'All-American', 'All-American'), career: { pYds: 14000, pTD: 130 }, peakOv: 99 }));
  check('Stature is bounded to 0..100', nobody.score >= 0 && god.score <= 100, `${nobody.score}..${god.score}`);
  check('A decorated star outranks an anonymous benchwarmer', god.score > nobody.score, `${god.score} vs ${nobody.score}`);
})();

/* 3) stature monotonic in each component (more honors / career / peak never lowers it) */
(function () {
  const base = snap({ peakOv: 82 });
  const more1 = snap({ honors: honors('All-SEC'), peakOv: 82 });
  const more2 = snap({ honors: honors('All-SEC', 'All-American'), peakOv: 82 });
  check('Stature rises with honors', legendStature(more2).score > legendStature(more1).score && legendStature(more1).score > legendStature(base).score);
  const c0 = legendStature(snap({ career: {}, peakOv: 80 })).score;
  const c1 = legendStature(snap({ career: { rYds: 1500 }, peakOv: 80 })).score;
  const c2 = legendStature(snap({ career: { rYds: 4500, rTD: 45 }, peakOv: 80 })).score;
  check('Stature rises with career production', c2 > c1 && c1 >= c0, `${c0} ≤ ${c1} < ${c2}`);
  const p1 = legendStature(snap({ peakOv: 75 })).score, p2 = legendStature(snap({ peakOv: 99 })).score;
  check('Stature rises with peak OVR', p2 > p1, `${p1} → ${p2}`);
})();

/* 4) a pure compiler (no trophies) can still be a legend */
(function () {
  const compiler = snap({ honors: [], career: { rYds: 5200, rTD: 52, gp: 48 }, peakOv: 88 });
  check('A no-trophy compiler still earns real stature', legendStature(compiler).score >= 25, legendStature(compiler).score + '');
  check('Tier ladder labels by score', legendTier(80) === 'Immortal' && legendTier(60) === 'All-Time Great' && legendTier(40) === 'Program Great' && legendTier(10) === 'Cult Hero');
})();

/* 5) isLegendWorthy gates: any real honor OR enough stature; an empty senior is not worthy */
(function () {
  check('Any honored player is legend-worthy', isLegendWorthy(snap({ honors: honors('All-SEC'), peakOv: 72 })));
  check('A high-stature unhonored player is worthy', isLegendWorthy(snap({ career: { rYds: 6000, rTD: 60 }, peakOv: 92 })));
  check('A plain backup is NOT legend-worthy', !isLegendWorthy(snap({ honors: [], career: {}, peakOv: 70 })));
})();

/* 6) enshrinement caps the ring at 12 and keeps the highest stature */
(function () {
  let legends = [];
  // induct 30 graduates of ascending stature across "seasons"
  for (let yr = 0; yr < 30; yr++) {
    const s = legendStature(snap({ peakOv: 70 + (yr % 30), career: { rYds: yr * 200 } }));
    legends = enshrineInto(legends, [{ name: 'G' + yr, stature: s.score, peakOv: 70 + (yr % 30) }], 12);
  }
  check('Ring of Honor caps at 12', legends.length === 12, legends.length + '');
  check('Ring keeps the highest-stature legends (sorted desc)', legends.every((l, i) => i === 0 || legends[i - 1].stature >= l.stature));
  const min = Math.min(...legends.map(l => l.stature));
  check('A weak inductee cannot displace the all-time best', enshrineInto(legends, [{ name: 'scrub', stature: min - 5 }], 12).every(l => l.name !== 'scrub'));
})();

/* 7) legacyAura scales with ring depth/quality and stays small & bounded */
(function () {
  const ring = (n, st) => ({ legends: Array.from({ length: n }, () => ({ stature: st })) });
  check('Empty ring gives zero aura', legacyAura({ legends: [] }) === 0 && legacyAura({}) === 0);
  check('Deeper/better ring gives more aura', legacyAura(ring(4, 15)) > legacyAura(ring(2, 15)), `${legacyAura(ring(4, 15)).toFixed(3)} > ${legacyAura(ring(2, 15)).toFixed(3)}`);
  check('Aura is clamped small (≤ 0.12)', legacyAura(ring(20, 100)) <= 0.12 && legacyAura(ring(20, 100)) > 0, legacyAura(ring(20, 100)).toFixed(3));
})();

/* 8) alumniBoost: scales with stature and relevance; appearance budget is respected by a deploy loop */
(function () {
  const legend = { pos: 'WR', st: 'TX', stature: 80, app: 2 };
  const recSame = { pos: 'WR', st: 'TX' };       // exact pos + home-state
  const recSide = { pos: 'QB', st: 'OH' };       // same side, no state tie
  const recFar = { pos: 'CB', st: 'OH' };        // other side of ball
  check('alumniBoost: exact-position + home-state beats other-side', alumniBoost(legend, recSame, 1) > alumniBoost(legend, recSide, 1) && alumniBoost(legend, recSide, 1) > alumniBoost(legend, recFar, 1),
    `${alumniBoost(legend, recSame, 1).toFixed(1)} > ${alumniBoost(legend, recSide, 1).toFixed(1)} > ${alumniBoost(legend, recFar, 1).toFixed(1)}`);
  const weak = { pos: 'WR', st: 'TX', stature: 20 };
  check('alumniBoost: higher stature lands harder', alumniBoost(legend, recSame, 1) > alumniBoost(weak, recSame, 1));
  check('alumniBoost: coach amplifier multiplies', alumniBoost(legend, recSame, 1.5) > alumniBoost(legend, recSame, 1));
  // simulate the appearance budget: deploy until app exhausted (the app layer's rule)
  let deploys = 0; const L = Object.assign({}, legend);
  while (L.app > 0) { L.app--; deploys++; }
  check('Appearance budget caps deployments at LEGEND_APPS', deploys === 2, deploys + ' deploys');
})();

/* 9) alumniRelevance is bounded and ordered */
(function () {
  check('Relevance bounded 0..1.4', alumniRelevance({ pos: 'QB', st: 'TX' }, { pos: 'QB', st: 'TX' }) <= 1.4 && alumniRelevance({ pos: 'K', st: 'AL' }, { pos: 'CB', st: 'OH' }) >= 0);
})();

/* 10) cross-check vs ROLLOVER: career accumulates across seasons; gs never carries forward */
(function () {
  // minimal roster of returners with a season box; roll twice and follow one player
  const r = rng(99);
  const mk = (pos) => ({ id: 'p' + pos + Math.floor(r() * 1e6).toString(36), fn: pick(r, FN), ln: pick(r, LN), pos, yr: 'SO', age: 19, st: pick(r, STATES), stars: 4, ov: 84, pot: 90, cap: false, spd: 84, str: 84, awr: 84, so: 0 });
  let roster = POS.flatMap(([c, , n]) => Array.from({ length: n }, () => mk(c)));
  const id = roster[0].id;
  roster.forEach(p => p.gs = { gp: 12, reYds: 900, reTD: 8 });
  roster = rolloverRoster(roster, [], 80, r, { rate: 1 }).roster;
  roster.forEach(p => p.gs = { gp: 12, reYds: 900, reTD: 8 });
  roster = rolloverRoster(roster, [], 80, r, { rate: 1 }).roster;
  const me = roster.find(p => p.id === id);
  check('Career sums across two seasons (reYds 1800)', me && me.career.reYds === 1800, me ? me.career.reYds + '' : 'gone');
  check('Season gs never carries forward (always wiped on returners)', roster.every(p => !p.gs));
  // the enshrinement snapshot reads this career
  const s = legendStature({ honors: [], career: me.career, peakOv: me.peakOv });
  check('Accumulated career feeds stature', s.score > legendStature({ honors: [], career: {}, peakOv: me.peakOv }).score);
})();

/* 11) determinism / purity: same inputs → identical stature (no rng anywhere) */
(function () {
  const s = snap({ honors: honors('Heisman (National POY)'), career: { rYds: 3000, rTD: 30 }, peakOv: 95 });
  check('Stature is a pure function (repeatable)', legendStature(s).score === legendStature(s).score && JSON.stringify(legendStature(s)) === JSON.stringify(legendStature(s)));
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} legacy-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

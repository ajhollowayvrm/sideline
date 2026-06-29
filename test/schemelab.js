/* Sideline SCHEME LAB — standalone harness for the Phase 21 scheme engine.

   The scheme engine lives in index.html (single source of truth). This harness EXTRACTS the block
   between the SCHEME ENGINE markers and evals it here, then asserts the pure properties that keep
   the feature MEAN-NEUTRAL (so simlab's scoring envelope + the determinism gate are undisturbed):
   the matchup table is doubly balanced, fit/delta average to zero over random worlds, the swing is
   small enough that raw OVR still decides games ("the best players just win"), and it's deterministic.

   Run:  node test/schemelab.js  */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// POS (side lookup) — mirrors index.html's POS table (only code + side matter here).
const POS = [["QB", "off"], ["RB", "off"], ["WR", "off"], ["TE", "off"], ["OT", "off"], ["OG", "off"], ["C", "off"],
  ["DE", "def"], ["DT", "def"], ["LB", "def"], ["CB", "def"], ["S", "def"], ["K", "st"], ["P", "st"]];

/* ---------- extract the SCHEME ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === SCHEME ENGINE (Phase 21) START ===';
const END = '// === SCHEME ENGINE (Phase 21) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find SCHEME ENGINE markers in index.html'); process.exit(2); }
// Direct eval leaks `function` declarations into this scope but NOT block-scoped `const`s, so the
// block appends an explicit export of the constants we assert on.
// Functions (schemeEdge, schemeFit, …) leak into this scope on their own; only the block-scoped
// consts need an explicit export.
const exp = eval(html.slice(i0, i1) + '\n;({OFF_SCHEMES,DEF_SCHEMES,SCHEME_EDGE,SCHEME_FIT_W});');
const { OFF_SCHEMES, DEF_SCHEMES, SCHEME_EDGE, SCHEME_FIT_W } = exp;

/* ---------- test harness ---------- */
let passed = 0, failed = 0;
const approx = (a, b, eps) => Math.abs(a - b) <= eps;
function ok(name, cond, extra) { if (cond) { passed++; } else { failed++; console.error('  FAIL: ' + name + (extra != null ? '  [' + extra + ']' : '')); } }

/* ---------- a synthetic roster (a side of 11 with given preferred-scheme indices) ---------- */
let _pid = 0;
function mkPlayer(pos, scmIdx, ov, so) { return { id: 'p' + (_pid++), pos, scm: scmIdx, ov: ov == null ? 75 : ov, so: so == null ? 0 : so }; }
// roster whose offensive top-11 all prefer offIdx and defensive top-11 all prefer defIdx
function mkRoster(offIdx, defIdx, ov) {
  const out = [];
  ['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OT', 'OT', 'OG', 'OG', 'C'].forEach((p, i) => out.push(mkPlayer(p, offIdx, ov, i < 2 ? i : 1)));
  ['DE', 'DE', 'DT', 'DT', 'LB', 'LB', 'LB', 'CB', 'CB', 'S', 'S'].forEach((p, i) => out.push(mkPlayer(p, defIdx, ov, i < 2 ? i : 1)));
  return out;
}
function mkTeam(id, offS, defS, offIdx, defIdx, ov) {
  return { id, offScheme: offS, defScheme: defS, roster: mkRoster(offIdx, defIdx, ov),
    ratings: { off: ov == null ? 75 : ov, def: ov == null ? 75 : ov } };
}

console.log('SCHEME LAB');

/* ---- 1. scheme catalogs ---- */
ok('5 offensive schemes', OFF_SCHEMES.length === 5, OFF_SCHEMES.length);
ok('5 defensive schemes', DEF_SCHEMES.length === 5, DEF_SCHEMES.length);

/* ---- 2. matchup table shape + double balance ---- */
ok('edge table is 5x5', SCHEME_EDGE.length === 5 && SCHEME_EDGE.every(row => row.length === 5));
let rowsOk = true, colsOk = true, grand = 0;
for (let i = 0; i < 5; i++) {
  let rs = 0; for (let j = 0; j < 5; j++) { rs += SCHEME_EDGE[i][j]; grand += SCHEME_EDGE[i][j]; }
  if (rs !== 0) rowsOk = false;
}
for (let j = 0; j < 5; j++) { let cs = 0; for (let i = 0; i < 5; i++) cs += SCHEME_EDGE[i][j]; if (cs !== 0) colsOk = false; }
ok('every row of the edge table sums to 0', rowsOk);
ok('every column of the edge table sums to 0', colsOk);
ok('grand total of the edge table is 0', grand === 0, grand);

/* ---- 3. schemeEdge lookup + defaults ---- */
ok('schemeEdge reads the table', schemeEdge('Air Raid', '4-3') === SCHEME_EDGE[0][0]);
ok('unknown off scheme defaults to Pro Style (neutral row)', schemeEdge('???', 'Bear') === SCHEME_EDGE[2][3]);
ok('unknown def scheme defaults to 4-3', schemeEdge('Smashmouth', '???') === SCHEME_EDGE[3][0]);

/* ---- 4. footbally sanity (the matchups read like the chalk) ---- */
ok('Air Raid beats Bear (blitz exposed by spread)', schemeEdge('Air Raid', 'Bear') > 0);
ok('Air Raid struggles vs Tampa-2 (deep ball taken away)', schemeEdge('Air Raid', 'Tampa-2') < 0);
ok('Smashmouth runs on Nickel (light box)', schemeEdge('Smashmouth', 'Nickel/Cover-3') > 0);
ok('Smashmouth stalls vs Bear (loaded front)', schemeEdge('Smashmouth', 'Bear') < 0);
ok('Spread-Option gashes the 3-4', schemeEdge('Spread-Option', '3-4') > 0);

/* ---- 5. player fit values + mean-neutrality ---- */
ok('fit is +1 in the player\'s scheme', schemeFit({ scm: 2 }, 2) === 1);
ok('fit is -0.25 out of scheme', schemeFit({ scm: 2 }, 0) === -0.25);
{ // E[fit] over many random players ≈ 0 (uniform scheme draw)
  let s = 0, N = 20000; const r = rng(101);
  for (let i = 0; i < N; i++) { const idx = ri(r, 0, 4); s += schemeFit({ id: 'x' + i }, idx); }
  ok('E[schemeFit] ≈ 0 over random players (mean-neutral)', approx(s / N, 0, 0.02), (s / N).toFixed(4));
}
ok('playerSchemeIdx is in 0..4', (() => { for (let i = 0; i < 500; i++) { const v = playerSchemeIdx({ id: 'q' + i }); if (v < 0 || v > 4) return false; } return true; })());

/* ---- 6. rosterSchemeFit bounds + neutrality ---- */
ok('all-matching offense roster fit == 1', approx(rosterSchemeFit(mkRoster(0, 0), 'off', 0), 1, 1e-9));
ok('all-mismatching offense roster fit == -0.25', approx(rosterSchemeFit(mkRoster(1, 1), 'off', 0), -0.25, 1e-9));
{ // a roster of random preferences averages ≈ 0 fit
  let s = 0, N = 4000; const r = rng(202);
  for (let i = 0; i < N; i++) { const ros = []; for (let k = 0; k < 11; k++) ros.push(mkPlayer('WR', ri(r, 0, 4), 75, k < 2 ? k : 1)); s += rosterSchemeFit(ros, 'off', ri(r, 0, 4)); }
  ok('random-roster fit averages ≈ 0', approx(s / N, 0, 0.03), (s / N).toFixed(4));
}
ok('rosterSchemeFit always within [-0.25, 1]', (() => { const r = rng(303); for (let i = 0; i < 2000; i++) { const ros = []; for (let k = 0; k < 11; k++) ros.push(mkPlayer('WR', ri(r, 0, 4), 75, 1)); const f = rosterSchemeFit(ros, 'off', ri(r, 0, 4)); if (f < -0.2500001 || f > 1.0000001) return false; } return true; })());

/* ---- 7. schemeDelta: mean-zero across random matchups + bounded ---- */
{
  let so = 0, sd = 0, N = 6000; const r = rng(404); let maxAbs = 0;
  for (let i = 0; i < N; i++) {
    const A = mkTeam('A' + i, OFF_SCHEMES[ri(r, 0, 4)], DEF_SCHEMES[ri(r, 0, 4)], ri(r, 0, 4), ri(r, 0, 4));
    const B = mkTeam('B' + i, OFF_SCHEMES[ri(r, 0, 4)], DEF_SCHEMES[ri(r, 0, 4)], ri(r, 0, 4), ri(r, 0, 4));
    const d = schemeDelta(A, B);
    so += d.off; sd += d.def; maxAbs = Math.max(maxAbs, Math.abs(d.off), Math.abs(d.def));
  }
  ok('E[schemeDelta.off] ≈ 0 across random matchups', approx(so / N, 0, 0.08), (so / N).toFixed(4));
  ok('E[schemeDelta.def] ≈ 0 across random matchups', approx(sd / N, 0, 0.08), (sd / N).toFixed(4));
  ok('scheme swing stays small (≤ ~4 rating pts)', maxAbs <= 4.0, maxAbs.toFixed(3));
}

/* ---- 8. the best players still win: scheme can't out-weigh a real OVR gap ---- */
{
  // worst-case scheme tilt for the underdog: max favorable edge + full fit, both directions
  const maxOffSwing = 3 + SCHEME_FIT_W; // |edge| max is 3, |fit boost| max is SCHEME_FIT_W
  const maxTotalSwing = maxOffSwing + SCHEME_FIT_W; // off boost + opponent def boost against you
  ok('max total scheme swing < a 15-pt OVR gap (OVR dominates)', maxTotalSwing < 15, maxTotalSwing.toFixed(2));
}

/* ---- 9. defaults + determinism ---- */
ok('defaultOffScheme is a real off scheme', OFF_SCHEMES.includes(defaultOffScheme('alabama')));
ok('defaultDefScheme is a real def scheme', DEF_SCHEMES.includes(defaultDefScheme('alabama')));
ok('defaults are deterministic by id', defaultOffScheme('oregon') === defaultOffScheme('oregon') && defaultDefScheme('oregon') === defaultDefScheme('oregon'));
ok('playerSchemeIdx is deterministic by id', playerSchemeIdx({ id: 'zzz' }) === playerSchemeIdx({ id: 'zzz' }));
{
  const A = mkTeam('det', 'Air Raid', '4-3', 0, 0), B = mkTeam('det2', 'Smashmouth', 'Bear', 3, 3);
  const d1 = schemeDelta(A, B), d2 = schemeDelta(A, B);
  ok('schemeDelta is deterministic', d1.off === d2.off && d1.def === d2.def);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

/* Step 7 — the blowout upset. Is the real residual distribution normal, or fat-tailed?
   Does tightening the sim's variance kill the Purdue-over-Ohio-State game, or is the sim
   currently producing them at the wrong rate anyway?
   Compares the residual SHAPE (skew, kurtosis, empirical tails vs the normal prediction)
   and counts blowout upsets per season, real vs sim. */
const IDX = require(__dirname + '/index.json');
const GM = require(__dirname + '/games.json');
const FBS = new Set(['1', '4', '5', '8', '9', '12', '15', '17', '18', '37', '151']);
const games = IDX.filter(g => GM[g.id] && FBS.has(String(g.hc)) && FBS.has(String(g.ac)));
const YEARS = [...new Set(games.map(g => g.year))].sort();

/* retrodictive strength rating, same construction as everywhere else */
const HFA = 2.4, rating = {};
for (const year of YEARS) {
  const gs = games.filter(g => g.year === year);
  const teams = [...new Set(gs.flatMap(g => [g.hid, g.aid]))];
  const R = {}; teams.forEach(t => R[t] = 0);
  const cap = x => Math.max(-28, Math.min(28, x));
  for (let it = 0; it < 60; it++) {
    const s = {}, c = {}; teams.forEach(t => { s[t] = 0; c[t] = 0; });
    for (const g of gs) { const hfa = g.neutral ? 0 : HFA, m = cap(g.hs - g.as);
      s[g.hid] += (m - hfa) + R[g.aid]; c[g.hid]++; s[g.aid] += (-m + hfa) + R[g.hid]; c[g.aid]++; }
    teams.forEach(t => { if (c[t]) R[t] = s[t] / c[t]; });
    const mu = teams.reduce((a, t) => a + R[t], 0) / teams.length;
    teams.forEach(t => R[t] -= mu);
  }
  teams.forEach(t => rating[year + '|' + t] = R[t]);
}
const rt = (y, id) => rating[y + '|' + id] || 0;

// favourite-perspective residual: how much the FAVOURITE beat/missed its expected margin.
// negative = the favourite underperformed; a big negative = a blowout upset.
function favResiduals(list) {
  const out = [];
  for (const g of list) {
    const exp = rt(g.year, g.hid) - rt(g.year, g.aid) + (g.neutral ? 0 : HFA);
    const favHome = exp > 0, spread = Math.abs(exp);
    const favMargin = favHome ? (g.hs - g.as) : (g.as - g.hs);
    out.push({ resid: favMargin - spread, spread, favMargin, g });
  }
  return out;
}
const REAL = favResiduals(games);

/* ---------- shape ---------- */
const stats = a => {
  const n = a.length, m = a.reduce((s, x) => s + x, 0) / n;
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / n, sd = Math.sqrt(v);
  const sk = a.reduce((s, x) => s + ((x - m) / sd) ** 3, 0) / n;
  const ku = a.reduce((s, x) => s + ((x - m) / sd) ** 4, 0) / n - 3;   // excess kurtosis
  return { n, m, sd, sk, ku };
};
// normal CDF
const erf = x => { const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y; };
const ncdf = (x, m, sd) => 0.5 * (1 + erf((x - m) / (sd * Math.SQRT2)));

function shapeReport(label, arr) {
  const s = stats(arr);
  console.log(`\n  ${label}`);
  console.log(`    n=${s.n}   mean ${s.m.toFixed(2)}   SD ${s.sd.toFixed(2)}   skew ${s.sk.toFixed(3)}   excess kurtosis ${s.ku.toFixed(3)}`);
  console.log(`    ${'THRESHOLD'.padEnd(28)} ${'ACTUAL'.padStart(8)} ${'IF NORMAL'.padStart(10)} ${'RATIO'.padStart(7)}`);
  for (const t of [-14, -21, -28, -35, -42]) {
    const act = arr.filter(x => x <= t).length / s.n * 100;
    const nor = ncdf(t, s.m, s.sd) * 100;
    console.log(`    favourite misses by ${String(-t).padStart(2)}+ pts     ${(act.toFixed(2) + '%').padStart(8)} ${(nor.toFixed(2) + '%').padStart(10)} ${(nor ? (act / nor).toFixed(2) : '—').padStart(7)}`);
  }
  for (const t of [28, 35, 42]) {
    const act = arr.filter(x => x >= t).length / s.n * 100;
    const nor = (1 - ncdf(t, s.m, s.sd)) * 100;
    console.log(`    favourite exceeds by ${String(t).padStart(2)}+ pts    ${(act.toFixed(2) + '%').padStart(8)} ${(nor.toFixed(2) + '%').padStart(10)} ${(nor ? (act / nor).toFixed(2) : '—').padStart(7)}`);
  }
  return s;
}
console.log('='.repeat(96));
console.log('A) SHAPE OF THE MISS — favourite-perspective residual (negative = favourite underperformed)');
console.log('='.repeat(96));
console.log('  If real CFB has FAT TAILS, "actual" beats "if normal" at the extremes and the fix is not');
console.log('  simply narrowing the sim — it is narrowing the middle while keeping the tail.');
const rs = shapeReport('REAL FBS', REAL.map(r => r.resid));

/* ---------- blowout-upset taxonomy, per season ---------- */
console.log('');
console.log('='.repeat(96));
console.log('B) HOW OFTEN IS THERE A PURDUE GAME?  — league-wide counts per season');
console.log('='.repeat(96));
const DEFS = [
  ['favourite by 7+ loses outright', r => r.spread >= 7 && r.favMargin < 0],
  ['favourite by 7+ loses by 14+', r => r.spread >= 7 && r.favMargin <= -14],
  ['favourite by 14+ loses outright', r => r.spread >= 14 && r.favMargin < 0],
  ['favourite by 14+ loses by 14+', r => r.spread >= 14 && r.favMargin <= -14],
  ['favourite by 14+ loses by 21+', r => r.spread >= 14 && r.favMargin <= -21],
  ['favourite by 21+ loses outright', r => r.spread >= 21 && r.favMargin < 0],
  ['favourite by 21+ loses by 14+', r => r.spread >= 21 && r.favMargin <= -14],
];
const seasons = YEARS.length;
console.log(`  ${'DEFINITION'.padEnd(36)} ${'TOTAL'.padStart(6)} ${'PER SEASON'.padStart(11)} ${'% OF ALL GAMES'.padStart(15)}`);
for (const [lab, f] of DEFS) {
  const n = REAL.filter(f).length;
  console.log(`  ${lab.padEnd(36)} ${String(n).padStart(6)} ${(n / seasons).toFixed(1).padStart(11)} ${((n / REAL.length * 100).toFixed(2) + '%').padStart(15)}`);
}
console.log('\n  The biggest upsets in the sample (by how far the favourite missed):');
REAL.slice().sort((a, b) => a.resid - b.resid).slice(0, 12).forEach(r => {
  const g = r.g, favHome = (rt(g.year, g.hid) - rt(g.year, g.aid) + (g.neutral ? 0 : HFA)) > 0;
  const fav = favHome ? g.h : g.a, dog = favHome ? g.a : g.h;
  const fs = favHome ? g.hs : g.as, ds = favHome ? g.as : g.hs;
  console.log(`    ${g.year} wk${String(g.week).padStart(2)}  ${dog.padStart(5)} ${String(ds).padStart(2)}, ${fav.padEnd(5)} ${String(fs).padStart(2)}   `
    + `(${fav} favoured by ${r.spread.toFixed(1)}, missed by ${(-r.resid).toFixed(1)})`);
});

/* ---------- upset curve by spread, real vs sim ---------- */
console.log('');
console.log('='.repeat(96));
console.log('C) THE UPSET CURVE — P(favourite loses) and P(favourite is blown out), by spread');
console.log('='.repeat(96));
let SIM = null;
try { SIM = require(__dirname + '/simupsets.json'); } catch (e) {}
const BK = [[0, 3], [3, 7], [7, 10.5], [10.5, 14], [14, 17.5], [17.5, 24], [24, 31], [31, 99]];
console.log(`  ${'SPREAD'.padEnd(12)} ${'n'.padStart(6)} | ${'FAV LOSES  real/sim'.padStart(24)} | ${'LOSES BY 10+  real/sim'.padStart(26)} | ${'LOSES BY 17+  real/sim'.padStart(26)}`);
console.log('  ' + '-'.repeat(92));
for (const [lo, hi] of BK) {
  const l = REAL.filter(r => r.spread >= lo && r.spread < hi);
  if (l.length < 20) continue;
  const s = SIM && SIM.buckets.find(b => b.lo === lo);
  const p = (a, b) => (a / b * 100);
  const cell = (rv, sv) => `${rv.toFixed(1)}%${s ? ' / ' + sv.toFixed(1) + '%' : ''}`;
  console.log(`  ${(lo + '–' + (hi === 99 ? '+' : hi)).padEnd(12)} ${String(l.length).padStart(6)} | `
    + cell(p(l.filter(r => r.favMargin < 0).length, l.length), s ? s.lose : 0).padStart(24) + ' | '
    + cell(p(l.filter(r => r.favMargin <= -10).length, l.length), s ? s.lose10 : 0).padStart(26) + ' | '
    + cell(p(l.filter(r => r.favMargin <= -17).length, l.length), s ? s.lose17 : 0).padStart(26));
}
if (SIM) {
  console.log('');
  shapeReport('SIDELINE simEngine', SIM.resid);
  console.log(`\n  Real SD ${rs.sd.toFixed(2)}  vs  sim SD ${stats(SIM.resid).sd.toFixed(2)}`);
  console.log('  Per-season blowout-upset counts (scaled to a 790-game FBS season):');
  console.log(`  ${'DEFINITION'.padEnd(36)} ${'REAL/SEASON'.padStart(12)} ${'SIM/SEASON'.padStart(12)}`);
  const simR = SIM.rows;
  DEFS.forEach(([lab, f], i) => {
    const real = REAL.filter(f).length / seasons;
    const sim = simR[i] / SIM.n * 790;
    console.log(`  ${lab.padEnd(36)} ${real.toFixed(1).padStart(12)} ${sim.toFixed(1).padStart(12)}`);
  });
} else {
  console.log('\n  (run 4-simprofile.js to generate simupsets.json for the sim comparison)');
}
console.log('');

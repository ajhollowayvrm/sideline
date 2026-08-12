/* Step 6 — is the poll a strength signal or a human artifact?
   Tests three claims against the same 3,944-game sample:
     A. rankings are noisy — how often does rank disagree with measured strength, and who wins then
     B. they work themselves out — rank accuracy + poll churn, week by week
     C. teams rise up for big games — residual vs a retrodictive rating, split by opponent status */
const IDX = require(__dirname + '/index.json');
const GM = require(__dirname + '/games.json');
const FBS = new Set(['1', '4', '5', '8', '9', '12', '15', '17', '18', '37', '151']);
const games = IDX.filter(g => GM[g.id] && FBS.has(String(g.hc)) && FBS.has(String(g.ac)));

/* retrodictive strength rating (full season, opponent-adjusted) — "how good the team actually was" */
const HFA = 2.4, rating = {};
const YEARS = [...new Set(games.map(g => g.year))].sort();
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
games.forEach(g => { g.exp = rt(g.year, g.hid) - rt(g.year, g.aid) + (g.neutral ? 0 : HFA); });

const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
const mean = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0;
const f1 = n => n.toFixed(1), f2 = n => n.toFixed(2);

console.log(`\nsample: ${games.length} FBS-vs-FBS games, ${YEARS.join('-')}\n`);

/* ============ A. rank vs measured strength ============ */
console.log('='.repeat(104));
console.log('A) IS THE POLL A STRENGTH SIGNAL?  — rank order vs measured-strength order, same games');
console.log('='.repeat(104));
function accuracy(list, label) {
  // only games where the two methods can both express a preference
  let rankRight = 0, ratingRight = 0, disagree = 0, disagreeRankRight = 0, n = 0;
  for (const g of list) {
    const hR = g.hr || 999, aR = g.ar || 999;
    if (hR === aR) continue;                       // both unranked → poll has no opinion
    const rankPicksHome = hR < aR;
    const ratingPicksHome = g.exp > 0;
    const homeWon = g.hs > g.as;
    if (g.hs === g.as) continue;
    n++;
    if (rankPicksHome === homeWon) rankRight++;
    if (ratingPicksHome === homeWon) ratingRight++;
    if (rankPicksHome !== ratingPicksHome) { disagree++; if (rankPicksHome === homeWon) disagreeRankRight++; }
  }
  console.log(`  ${label.padEnd(26)} n=${String(n).padStart(4)}   poll picks winner ${pct(rankRight, n).padStart(6)}   `
    + `strength picks winner ${pct(ratingRight, n).padStart(6)}   they disagree on ${pct(disagree, n).padStart(6)} of games`
    + (disagree ? `, poll right ${pct(disagreeRankRight, disagree)} of those` : ''));
}
accuracy(games, 'all games w/ a ranked side');
accuracy(games.filter(g => g.hr && g.ar), 'ranked vs ranked');
accuracy(games.filter(g => g.hr && g.ar && g.hr <= 10 && g.ar <= 10), 'Top-10 vs Top-10');
accuracy(games.filter(g => g.hr && g.ar && Math.abs(g.hr - g.ar) <= 5), 'ranked, within 5 spots');
accuracy(games.filter(g => (!!g.hr) !== (!!g.ar)), 'ranked vs unranked');

// how often is the ranked team actually the weaker team?
let wrongWay = 0, rr = 0;
for (const g of games) {
  if ((!!g.hr) === (!!g.ar)) continue;
  const rankedIsHome = !!g.hr; rr++;
  const rankedRating = rankedIsHome ? rt(g.year, g.hid) : rt(g.year, g.aid);
  const otherRating = rankedIsHome ? rt(g.year, g.aid) : rt(g.year, g.hid);
  if (rankedRating < otherRating) wrongWay++;
}
console.log(`\n  In ranked-vs-unranked games, the RANKED team was measurably the weaker team ${pct(wrongWay, rr)} of the time (${wrongWay}/${rr}).`);

/* ============ B. does it work itself out? ============ */
console.log('');
console.log('='.repeat(104));
console.log('B) DOES IT WORK ITSELF OUT?  — poll accuracy and poll churn, week by week');
console.log('='.repeat(104));
console.log(`  ${'WEEK'.padEnd(8)} ${'GAMES'.padStart(6)} ${'POLL PICKS WINNER'.padStart(18)} ${'STRENGTH PICKS WINNER'.padStart(22)} ${'GAP'.padStart(7)}`);
for (let w = 1; w <= 15; w++) {
  const list = games.filter(g => !g.post && g.week === w && (g.hr || g.ar) && (g.hr || 999) !== (g.ar || 999) && g.hs !== g.as);
  if (list.length < 40) continue;
  let rk = 0, rg = 0;
  for (const g of list) {
    const homeWon = g.hs > g.as;
    if (((g.hr || 999) < (g.ar || 999)) === homeWon) rk++;
    if ((g.exp > 0) === homeWon) rg++;
  }
  const gap = (rg - rk) / list.length * 100;
  console.log(`  ${('wk ' + w).padEnd(8)} ${String(list.length).padStart(6)} ${pct(rk, list.length).padStart(18)} ${pct(rg, list.length).padStart(22)} ${(gap > 0 ? '+' : '') + gap.toFixed(1)}`.padEnd(70));
}
// poll churn: how much does a team's rank move week to week, and how well does week-N rank
// line up with end-of-season measured strength?
const rankByWeek = {};   // year|team -> {week: rank}
for (const g of games) {
  if (g.post) continue;
  for (const [id, r] of [[g.hid, g.hr], [g.aid, g.ar]]) {
    const k = g.year + '|' + id; (rankByWeek[k] = rankByWeek[k] || {})[g.week] = r || 0;
  }
}
console.log(`\n  ${'WEEK'.padEnd(8)} ${'RANKED TEAMS'.padStart(13)} ${'CORR(rank, measured strength)'.padStart(30)} ${'AVG |RANK MOVE| vs NEXT WK'.padStart(28)}`);
for (let w = 2; w <= 15; w++) {
  const pairs = [], moves = [];
  for (const k in rankByWeek) {
    const [y, id] = k.split('|'); const rk = rankByWeek[k][w];
    if (rk) { pairs.push([rk, rt(+y, id)]);
      const nx = rankByWeek[k][w + 1]; if (nx) moves.push(Math.abs(nx - rk)); }
  }
  if (pairs.length < 30) continue;
  // Pearson corr between rank (1 = best) and rating (high = best) → expect NEGATIVE; report magnitude
  const n = pairs.length, mx = mean(pairs, p => p[0]), my = mean(pairs, p => p[1]);
  let sxy = 0, sxx = 0, syy = 0;
  pairs.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
  const r = sxy / Math.sqrt(sxx * syy);
  console.log(`  ${('wk ' + w).padEnd(8)} ${String(n).padStart(13)} ${(-r).toFixed(3).padStart(30)} ${(moves.length ? f1(mean(moves, x => x)) : '—').padStart(28)}`);
}

/* ============ C. do teams rise up? ============ */
console.log('');
console.log('='.repeat(104));
console.log('C) DO TEAMS RISE UP FOR BIG GAMES?  — actual margin minus what the season-long rating expected');
console.log('='.repeat(104));
console.log('  (positive = the team beat its own measured strength in that situation; rating is fit on ALL');
console.log('   games, so a real context effect shows up as a SPLIT between subgroups, not an absolute level)\n');
const sides = [];
for (const g of games) {
  const x = GM[g.id];
  for (const side of ['h', 'a']) {
    const my = side === 'h' ? g.hs : g.as, op = side === 'h' ? g.as : g.hs;
    const myRank = side === 'h' ? g.hr : g.ar, opRank = side === 'h' ? g.ar : g.hr;
    const expM = side === 'h' ? g.exp : -g.exp;
    sides.push({ g, resid: (my - op) - expM, myRank, opRank, home: side === 'h',
      me: x[side], won: my > op });
  }
}
function bucket(label, f) {
  const s = sides.filter(f); if (s.length < 60) return;
  console.log(`  ${label.padEnd(42)} n=${String(s.length).padStart(5)}   resid ${(mean(s, r => r.resid) >= 0 ? '+' : '') + f2(mean(s, r => r.resid))} pts`
    + `   win ${pct(s.filter(r => r.won).length, s.length).padStart(6)}`);
}
console.log('  — by whether the OPPONENT is ranked —');
bucket('unranked team vs a ranked opponent', r => !r.myRank && r.opRank);
bucket('unranked team vs an unranked opponent', r => !r.myRank && !r.opRank);
bucket('ranked team vs an unranked opponent', r => r.myRank && !r.opRank);
bucket('ranked team vs a ranked opponent', r => r.myRank && r.opRank);
console.log('\n  — how big is the opponent? (unranked teams only) —');
bucket('unranked vs No. 1-5', r => !r.myRank && r.opRank && r.opRank <= 5);
bucket('unranked vs No. 6-15', r => !r.myRank && r.opRank >= 6 && r.opRank <= 15);
bucket('unranked vs No. 16-25', r => !r.myRank && r.opRank >= 16 && r.opRank <= 25);
bucket('unranked vs unranked', r => !r.myRank && !r.opRank);
console.log('\n  — the favourite side: does a ranked team play DOWN to a cupcake? —');
bucket('No. 1-5 vs unranked', r => r.myRank && r.myRank <= 5 && !r.opRank);
bucket('No. 6-15 vs unranked', r => r.myRank >= 6 && r.myRank <= 15 && !r.opRank);
bucket('No. 16-25 vs unranked', r => r.myRank >= 16 && r.myRank <= 25 && !r.opRank);
console.log('\n  — home/road split on the upset spot —');
bucket('unranked AT HOME vs a ranked opponent', r => !r.myRank && r.opRank && r.home);
bucket('unranked ON THE ROAD vs a ranked opp', r => !r.myRank && r.opRank && !r.home);
console.log('\n  — late season vs early (does the effect fade as the poll corrects?) —');
bucket('unranked vs ranked, weeks 1-5', r => !r.myRank && r.opRank && !r.g.post && r.g.week <= 5);
bucket('unranked vs ranked, weeks 6-10', r => !r.myRank && r.opRank && !r.g.post && r.g.week >= 6 && r.g.week <= 10);
bucket('unranked vs ranked, weeks 11+', r => !r.myRank && r.opRank && !r.g.post && r.g.week >= 11);

/* ============ D. how much home field is actually worth, by context ============ */
// The rating already credits every home team a flat 2.4. A non-zero residual for HOME teams in a
// subgroup means home field is worth MORE (or less) than 2.4 in that situation.
console.log('');
console.log('='.repeat(104));
console.log('D) WHAT IS HOME FIELD ACTUALLY WORTH?  — home-team residual on top of the flat 2.4 in the model');
console.log('='.repeat(104));
function hfa(label, f) {
  const s = sides.filter(r => r.home && !r.g.neutral && f(r)); if (s.length < 60) return;
  const extra = mean(s, r => r.resid);
  console.log(`  ${label.padEnd(42)} n=${String(s.length).padStart(5)}   home field ≈ ${f1(2.4 + extra).padStart(5)} pts  (${(extra >= 0 ? '+' : '') + f2(extra)} vs the flat model)`);
}
hfa('every home game', () => true);
hfa('home team is unranked, opponent ranked', r => !r.myRank && r.opRank);
hfa('home team ranked, opponent unranked', r => r.myRank && !r.opRank);
hfa('both ranked', r => r.myRank && r.opRank);
hfa('neither ranked', r => !r.myRank && !r.opRank);
hfa('home team unranked vs a Top-10 opponent', r => !r.myRank && r.opRank && r.opRank <= 10);

/* ============ E. how much of a game is NOT explained by team strength ============ */
// SD of (actual margin - expected margin). This is the "any given Saturday" number, and it is the
// direct calibration target for simEngine's per-game `form` term.
console.log('');
console.log('='.repeat(104));
console.log('E) THE "ANY GIVEN SATURDAY" NUMBER — spread of actual margin around what strength predicts');
console.log('='.repeat(104));
const resid = games.map(g => (g.hs - g.as) - g.exp);
const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
console.log(`  real FBS:  SD of (actual margin − expected margin) = ${f1(sd(resid))} points   (n=${resid.length})`);
console.log(`             |residual| > 14 pts in ${pct(resid.filter(x => Math.abs(x) > 14).length, resid.length)} of games`);
console.log(`             |residual| > 21 pts in ${pct(resid.filter(x => Math.abs(x) > 21).length, resid.length)} of games`);
try {
  const SIM = require(__dirname + '/simresid.json');
  console.log(`  Sideline:  SD of (actual margin − expected margin) = ${f1(SIM.sd)} points   (n=${SIM.n})`);
  console.log(`             |residual| > 14 pts in ${SIM.p14.toFixed(1)}% of games`);
  console.log(`             |residual| > 21 pts in ${SIM.p21.toFixed(1)}% of games`);
  console.log(`\n  → the sim's game-to-game noise is ${SIM.sd < sd(resid) ? 'TIGHTER' : 'WIDER'} than reality by ${f1(Math.abs(SIM.sd - sd(resid)))} pts of SD.`);
} catch (e) { console.log('  (run 4-simprofile.js first for the Sideline comparison)'); }
console.log('');

/* Step 5 — side-by-side: real FBS averages vs Sideline's simEngine, on identical metrics. */
const RE = require(__dirname + '/profiles.json');
const SI = require(__dirname + '/simprofile.json');
const f = (n, d = 1) => (n === undefined || n === null || !isFinite(n)) ? '—' : n.toFixed(d);

function row(label, real, sim, dec = 1, unit = '') {
  const dl = (sim - real);
  const pctOff = real ? (dl / real * 100) : 0;
  const flag = Math.abs(pctOff) < 6 ? '  ok ' : Math.abs(pctOff) < 15 ? '  ~  ' : ' MISS';
  const arrow = dl > 0 ? '+' : '';
  return `  ${label.padEnd(30)} ${f(real, dec).padStart(8)} ${f(sim, dec).padStart(8)}   ${(arrow + f(dl, dec)).padStart(8)} ${(arrow + f(pctOff, 0) + '%').padStart(7)} ${flag} ${unit}`;
}
console.log('');
console.log('='.repeat(96));
console.log('  SIDELINE simEngine  vs  REAL FBS  — per team per game');
console.log(`  real = ${RE.all.games} FBS-vs-FBS games (2021-2025)   sim = 2,010 games (synthetic 134-team league)`);
console.log('='.repeat(96));
console.log(`  ${'METRIC'.padEnd(30)} ${'REAL'.padStart(8)} ${'SIM'.padStart(8)}   ${'DELTA'.padStart(8)} ${'OFF'.padStart(7)}`);
console.log('  ' + '-'.repeat(92));
const A = RE.all, B = SI.all;
console.log('  SCORING');
console.log(row('points', A.pts, B.pts));
console.log(row('total points/game', A.total, B.total));
console.log(row('avg margin', A.margin, B.margin));
console.log(row('home win %', A.homeWin, B.homeWin));
console.log(row('overtime %', A.otPct, B.otPct));
console.log('  VOLUME');
console.log(row('total yards', A.yds, B.yds, 0));
console.log(row('plays', A.plays, B.plays));
console.log(row('yards / play', A.ypp, B.ypp, 2));
console.log(row('first downs', A.fd, B.fd));
console.log(row('drives', A.drives, B.drives));
console.log(row('points / drive', A.ppd, B.ppd, 2));
console.log('  PASSING');
console.log(row('pass attempts', A.att, B.att));
console.log(row('completions', A.cmp, B.cmp));
console.log(row('completion %', A.cmpPct, B.cmpPct));
console.log(row('passing yards', A.pyds, B.pyds, 0));
console.log(row('yards / attempt', A.ypa, B.ypa, 2));
console.log('  RUSHING');
console.log(row('rush attempts', A.ratt, B.ratt));
console.log(row('rushing yards', A.ryds, B.ryds, 0));
console.log(row('yards / carry', A.ypc, B.ypc, 2));
console.log('  DOWNS');
console.log(row('3rd-down conv %', A.d3, B.d3));
console.log(row('4th-down attempts', A.d4a, B.d4a, 2));
console.log(row('4th-down conv %', A.d4, B.d4));
console.log('  DISRUPTION');
console.log(row('turnovers', A.to, B.to, 2));
console.log(row('  interceptions', A.int, B.int, 2));
console.log(row('  fumbles lost', A.fl, B.fl, 2));
console.log(row('sacks (by defense)', A.sk, B.sk, 2));
console.log(row('penalties', A.pen, B.pen));
console.log(row('penalty yards', A.peny, B.peny, 0));
console.log('  SPECIAL TEAMS');
console.log(row('punts', A.punts, B.punts, 2));
console.log(row('FG attempts', A.fga, B.fga, 2));
console.log(row('FG %', A.fgPct, B.fgPct));
console.log('  DRIVE OUTCOMES (% of drives)');
console.log(row('  touchdown', A.dTD, B.dTD));
console.log(row('  field goal', A.dFG, B.dFG));
console.log(row('  punt', A.dPUNT, B.dPUNT));
console.log(row('  turnover', A.dTO, B.dTO));
console.log(row('  downs', A.dDOWNS, B.dDOWNS));
console.log(row('  missed FG', A.dMISS, B.dMISS));
console.log(row('  END OF HALF/GAME', A.dEND, B.dEND));
console.log('  LATE-GAME DRAMA');
console.log(row('|margin| entering Q4', RE.drama.m4, SI.drama.m4));
console.log(row('Q4 lead flips %', RE.drama.flipPct, SI.drama.flipPct));
console.log(row('10+ pt Q4 comebacks %', RE.drama.bigPct, SI.drama.bigPct));

/* mismatch curve */
console.log('');
console.log('='.repeat(96));
/* ---- schedule-standardized aggregates ----------------------------------------------------------
   The synthetic slate pairs each team with the 15 that follow it in a prestige-BANDED list, and the
   wrap puts the weakest teams onto the strongest. It therefore contains far more mismatches than real
   FBS scheduling does: 28.9% of sim games sit at a 17.5+ point spread against a real 18.0%, and only
   32.2% are inside a touchdown against a real 41.5%.

   Average margin is a function of that composition as much as of the sim's behaviour, so comparing
   the raw averages is not apples-to-apples however well the engine behaves. These lines re-weight the
   sim's per-bucket figures by the REAL bucket shares, which is the honest comparison and the one the
   calibration target in attributes-2.md §11 should be read against. The per-bucket table below is
   already controlled this way, which is why it looked so much better than the headline margin did. */
{
  const rg = RE.gaps || [], sg = SI.gaps || [];
  const rTot = rg.reduce((t, b) => t + b.games, 0), sTot = sg.reduce((t, b) => t + b.games, 0);
  if (rTot && sTot && rg.length === sg.length) {
    let mAdj = 0, pAdj = 0, mRaw = 0, pRaw = 0;
    rg.forEach((rb, i) => { const sb = sg[i], w = rb.games / rTot;
      mAdj += w * sb.margin; pAdj += w * sb.pts;
      mRaw += (sb.games / sTot) * sb.margin; pRaw += (sb.games / sTot) * sb.pts; });
    const rM = rg.reduce((t, b) => t + (b.games / rTot) * b.margin, 0);
    const rP = rg.reduce((t, b) => t + (b.games / rTot) * b.pts, 0);
    console.log('');
    console.log('  SCHEDULE-STANDARDIZED (sim re-weighted to the real spread-bucket mix)');
    console.log('  --------------------------------------------------------------------------------------------');
    console.log(`  avg margin        real ${rM.toFixed(1).padStart(5)}   sim raw ${mRaw.toFixed(1).padStart(5)}   sim standardized ${mAdj.toFixed(1).padStart(5)}   (${(mAdj - rM >= 0 ? '+' : '') + (mAdj - rM).toFixed(1)})`);
    console.log(`  points / team     real ${rP.toFixed(1).padStart(5)}   sim raw ${pRaw.toFixed(1).padStart(5)}   sim standardized ${pAdj.toFixed(1).padStart(5)}   (${(pAdj - rP >= 0 ? '+' : '') + (pAdj - rP).toFixed(1)})`);
    console.log(`  the sim slate carries ${(100 * sg.filter((b, i) => i >= 5).reduce((t, b) => t + b.games, 0) / sTot).toFixed(1)}% of games at a 17.5+ spread against a real ${(100 * rg.filter((b, i) => i >= 5).reduce((t, b) => t + b.games, 0) / rTot).toFixed(1)}%`);
  }
}
console.log('');
console.log('  MISMATCH RESPONSE — favorite vs underdog, by |expected margin| bucket');
console.log('='.repeat(96));
console.log(`  ${'BUCKET'.padEnd(15)} ${'FAV%W r/s'.padStart(13)} ${'FAV PTS r/s'.padStart(14)} ${'DOG PTS r/s'.padStart(14)} ${'DOG RUSH r/s'.padStart(14)} ${'DOG PASS r/s'.padStart(14)}`);
console.log('  ' + '-'.repeat(92));
const simByLabel = {}; SI.gaps.forEach(g => simByLabel[g.label] = g);
RE.gaps.forEach(r => {
  const s = simByLabel[r.label]; if (!s) return;
  const p = (a, b, d = 1) => `${f(a, d)}/${f(b, d)}`.padStart(14);
  console.log(`  ${r.label.padEnd(15)} ${`${f(r.favWin, 0)}/${f(s.favWin, 0)}`.padStart(13)} ${p(r.favPts, s.favPts)} ${p(r.dogPts, s.dogPts)} ${p(r.dogRatt, s.dogRatt)} ${p(r.dogAtt, s.dogAtt)}`);
});
console.log('');
console.log(`  ${'BUCKET'.padEnd(15)} ${'Q4 |M| r/s'.padStart(13)} ${'FLIP% r/s'.padStart(13)} ${'CMBK% r/s'.padStart(13)} ${'OT% r/s'.padStart(13)}`);
console.log('  ' + '-'.repeat(92));
const sd = {}; SI.gapDrama.forEach(g => sd[g.label] = g);
const REDRAMA = require(__dirname + '/gapdrama.json');
REDRAMA.forEach(r => { const s = sd[r.label]; if (!s) return;
  const sg = simByLabel[r.label] || {};
  console.log(`  ${r.label.padEnd(15)} ${`${f(r.m4)}/${f(s.m4)}`.padStart(13)} ${`${f(r.flipPct)}/${f(s.flipPct)}`.padStart(13)} ${`${f(r.bigPct)}/${f(s.bigPct)}`.padStart(13)} ${`${f(r.otPct)}/${f(sg.otPct)}`.padStart(13)}`);
});
console.log('');

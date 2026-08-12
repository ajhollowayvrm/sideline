/* Step 3 — aggregate the harvested box scores into national averages, then split by
   matchup tier (AP rank permutations) and by mismatch size (retrodictive rating gap). */
const fs = require('fs');
const IDX = require(__dirname + '/index.json');
const GM = require(__dirname + '/games.json');

// FBS-only: drop FBS-vs-FCS "buy games" (they'd pollute every mismatch bucket with
// non-comparable opponents and inflate home-win%). Conference ids verified by team list.
const FBS = new Set(['1', '4', '5', '8', '9', '12', '15', '17', '18', '37', '151']);
const games = IDX.filter(g => GM[g.id] && FBS.has(String(g.hc)) && FBS.has(String(g.ac)))
  .map(g => ({ ...g, x: GM[g.id] }));
// ESPN player-level DEFENSIVE stats (the only source of sacks) are only populated from 2024 on.
const SACK_YEARS = new Set([2024, 2025]);
console.log(`\nSAMPLE: ${games.length} FBS-vs-FBS games (${[...new Set(games.map(g => g.year))].sort().join(', ')})`);
console.log(`        sack figures computed from the ${games.filter(g => SACK_YEARS.has(g.year)).length}-game 2024-25 subset (ESPN has no player defense before that)\n`);

/* ---------- retrodictive team rating (expected-margin scale), per season ---------- */
const HFA = 2.4;
const rating = {};                                     // key `${year}|${teamId}` -> points
for (const year of [...new Set(games.map(g => g.year))]) {
  const gs = games.filter(g => g.year === year);
  const teams = [...new Set(gs.flatMap(g => [g.hid, g.aid]))];
  const R = {}; teams.forEach(t => R[t] = 0);
  const cap = (x) => Math.max(-28, Math.min(28, x));
  for (let it = 0; it < 60; it++) {
    const sum = {}, cnt = {};
    teams.forEach(t => { sum[t] = 0; cnt[t] = 0; });
    for (const g of gs) {
      const hfa = g.neutral ? 0 : HFA;
      const m = cap(g.hs - g.as);
      sum[g.hid] += (m - hfa) + R[g.aid]; cnt[g.hid]++;
      sum[g.aid] += (-m + hfa) + R[g.hid]; cnt[g.aid]++;
    }
    teams.forEach(t => { if (cnt[t]) R[t] = sum[t] / cnt[t]; });
    const mean = teams.reduce((a, t) => a + R[t], 0) / teams.length;
    teams.forEach(t => R[t] -= mean);
  }
  teams.forEach(t => rating[year + '|' + t] = R[t]);
}
const rt = (g, side) => rating[g.year + '|' + (side === 'h' ? g.hid : g.aid)] || 0;
games.forEach(g => {
  g.exp = rt(g, 'h') - rt(g, 'a') + (g.neutral ? 0 : HFA);   // expected home margin
  g.gap = Math.abs(g.exp);
});

/* ---------- per-team-game record ---------- */
// side = the team's own stats; opp = the other team's; `fav` = was this team the favorite
function rows(list) {
  const out = [];
  for (const g of list) {
    for (const side of ['h', 'a']) {
      const me = g.x[side], op = g.x[side === 'h' ? 'a' : 'h'];
      if (!me || !op) continue;
      const myPts = side === 'h' ? g.hs : g.as, opPts = side === 'h' ? g.as : g.hs;
      const myExp = side === 'h' ? g.exp : -g.exp;
      const d = me.drv || { n: 0, plays: 0, yds: 0, sec: 0, res: {} };
      const res = d.res || {};
      const R = k => (res[k] || 0);
      out.push({
        g, side, me, op,
        pts: myPts, margin: myPts - opPts, won: myPts > opPts ? 1 : 0,
        fav: myExp > 0 ? 1 : 0, exp: myExp,
        plays: me.att + me.ratt,                 // scrimmage plays (att incl. sacks in NCAA rushing? see note)
        yds: me.yds, ypp: 0,
        att: me.att, cmp: me.cmp, pyds: me.pyds,
        ratt: me.ratt, ryds: me.ryds,
        fd: me.fd, d3a: me.d3a, d3c: me.d3c, d4a: me.d4a, d4c: me.d4c,
        to: me.to, int: me.int, fl: me.fl,
        sk: me.sk,                                // sacks BY this team's defense
        pen: me.pen, peny: me.peny, top: me.top / 60,
        punts: me.punts, puntAvg: me.punts ? me.puntYds / me.punts : 0,
        fga: me.fga, fgm: me.fgm, xpa: me.xpa, xpm: me.xpm,
        kr: me.kr, krY: me.krYds, pr: me.pr, prY: me.prYds,
        stTD: (me.krTD || 0) + (me.prTD || 0), intTD: me.intTD || 0,
        dn: d.n, dplays: d.plays, dyds: d.yds, dsec: d.sec,
        dTD: R('TD'), dFG: R('FG'), dPUNT: R('PUNT'), dDOWNS: R('DOWNS'),
        dTO: R('INT') + R('FUMBLE') + R('INT TD') + R('FUMBLE RETURN TD') + R('FUMBLE, SAFETY'),
        dEND: R('END OF HALF') + R('END OF GAME') + R('END OF 4TH QUARTER'),
        dMISS: R('MISSED FG') + R('BLOCKED FG') + R('BLOCKED FG TD'),
      });
    }
  }
  out.forEach(r => r.ypp = r.plays ? r.yds / r.plays : 0);
  return out;
}

const mean = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0;
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const f1 = n => n.toFixed(1), f2 = n => n.toFixed(2), f0 = n => Math.round(n);

function profile(list, label) {
  const R = rows(list);
  if (!R.length) return null;
  const n = R.length, G = list.length;
  const dn = sum(R, r => r.dn) || 1;
  const p = {
    label, games: G, teamGames: n,
    pts: mean(R, r => r.pts),
    yds: mean(R, r => r.yds),
    plays: mean(R, r => r.plays),
    ypp: sum(R, r => r.yds) / (sum(R, r => r.plays) || 1),
    att: mean(R, r => r.att), cmp: mean(R, r => r.cmp),
    cmpPct: sum(R, r => r.cmp) / (sum(R, r => r.att) || 1) * 100,
    pyds: mean(R, r => r.pyds),
    ypa: sum(R, r => r.pyds) / (sum(R, r => r.att) || 1),
    ratt: mean(R, r => r.ratt), ryds: mean(R, r => r.ryds),
    ypc: sum(R, r => r.ryds) / (sum(R, r => r.ratt) || 1),
    fd: mean(R, r => r.fd),
    d3: sum(R, r => r.d3c) / (sum(R, r => r.d3a) || 1) * 100,
    d4a: mean(R, r => r.d4a), d4: sum(R, r => r.d4c) / (sum(R, r => r.d4a) || 1) * 100,
    to: mean(R, r => r.to), int: mean(R, r => r.int), fl: mean(R, r => r.fl),
    sk: mean(R.filter(r => SACK_YEARS.has(r.g.year)), r => r.sk),
    pen: mean(R, r => r.pen), peny: mean(R, r => r.peny),
    top: mean(R, r => r.top),
    punts: mean(R, r => r.punts),
    puntAvg: sum(R, r => r.puntAvg * r.punts) / (sum(R, r => r.punts) || 1),
    fga: mean(R, r => r.fga), fgPct: sum(R, r => r.fgm) / (sum(R, r => r.fga) || 1) * 100,
    // drive-level
    drives: mean(R, r => r.dn),
    ppd: sum(R, r => r.pts) / dn,
    pldr: sum(R, r => r.dplays) / dn, ydr: sum(R, r => r.dyds) / dn,
    secdr: sum(R, r => r.dsec) / dn,
    dTD: sum(R, r => r.dTD) / dn * 100, dFG: sum(R, r => r.dFG) / dn * 100,
    dPUNT: sum(R, r => r.dPUNT) / dn * 100, dDOWNS: sum(R, r => r.dDOWNS) / dn * 100,
    dTO: sum(R, r => r.dTO) / dn * 100, dEND: sum(R, r => r.dEND) / dn * 100,
    dMISS: sum(R, r => r.dMISS) / dn * 100,
    stTD: mean(R, r => r.stTD), intTD: mean(R, r => r.intTD),
    // game-level
    margin: mean(list, g => Math.abs(g.hs - g.as)),
    total: mean(list, g => g.hs + g.as),
    otPct: mean(list, g => g.x.ot ? 100 : 0),
    twoPt: mean(list, g => g.x.two), safety: mean(list, g => g.x.safety),
    homeWin: mean(list.filter(g => !g.neutral), g => g.hs > g.as ? 100 : 0),
  };
  // favorite/underdog splits
  const fav = R.filter(r => r.fav), dog = R.filter(r => !r.fav);
  p.favPts = mean(fav, r => r.pts); p.dogPts = mean(dog, r => r.pts);
  p.favWin = mean(fav, r => r.won * 100);
  p.favYds = mean(fav, r => r.yds); p.dogYds = mean(dog, r => r.yds);
  p.favTO = mean(fav, r => r.to); p.dogTO = mean(dog, r => r.to);
  p.favRatt = mean(fav, r => r.ratt); p.dogRatt = mean(dog, r => r.ratt);
  p.favAtt = mean(fav, r => r.att); p.dogAtt = mean(dog, r => r.att);
  p.favD4a = mean(fav, r => r.d4a); p.dogD4a = mean(dog, r => r.d4a);
  return p;
}

/* ---------- Q4 comeback / lead-flip (needs quarter linescores) ---------- */
function drama(list) {
  let flips = 0, big = 0, n = 0, m4 = 0;
  for (const g of list) {
    const q = g.x.qtr || {}; const hq = q[g.hid], aq = q[g.aid];
    if (!hq || !aq || hq.length < 4 || aq.length < 4) continue;
    const h3 = hq.slice(0, 3).reduce((a, b) => a + b, 0), a3 = aq.slice(0, 3).reduce((a, b) => a + b, 0);
    const m0 = h3 - a3, m1 = g.hs - g.as; n++; m4 += Math.abs(m0);
    if (m0 !== 0 && m1 !== 0 && Math.sign(m0) !== Math.sign(m1)) { flips++; if (Math.abs(m0) >= 10) big++; }
  }
  return { n, flipPct: flips / n * 100, bigPct: big / n * 100, m4: m4 / n };
}

/* ---------- report ---------- */
function line(p) {
  return `${String(p.label).padEnd(22)} ${String(p.games).padStart(5)} `
    + `${f1(p.pts).padStart(5)} ${f0(p.yds).toString().padStart(4)} ${f1(p.plays).padStart(5)} ${f2(p.ypp).padStart(5)} `
    + `${f1(p.att).padStart(5)}/${f1(p.cmp).padStart(4)} ${f0(p.pyds).toString().padStart(4)} ${f1(p.ratt).padStart(5)} ${f0(p.ryds).toString().padStart(4)} `
    + `${f1(p.fd).padStart(5)} ${f1(p.d3).padStart(5)} ${f2(p.d4a).padStart(5)} ${f2(p.to).padStart(5)} ${f2(p.sk).padStart(5)} `
    + `${f1(p.pen).padStart(5)} ${f1(p.punts).padStart(5)} ${f2(p.fga).padStart(5)} ${f1(p.drives).padStart(5)} ${f2(p.ppd).padStart(5)}`;
}
const HEAD = `${'BUCKET'.padEnd(22)} ${'GMS'.padStart(5)} ${'PTS'.padStart(5)} ${'YDS'.padStart(4)} ${'PLYS'.padStart(5)} ${'Y/P'.padStart(5)} `
  + `${'PA/PC'.padStart(10)} ${'PYD'.padStart(4)} ${'RATT'.padStart(5)} ${'RYD'.padStart(4)} `
  + `${'1stD'.padStart(5)} ${'3D%'.padStart(5)} ${'4DA'.padStart(5)} ${'TO'.padStart(5)} ${'SK'.padStart(5)} `
  + `${'PEN'.padStart(5)} ${'PNT'.padStart(5)} ${'FGA'.padStart(5)} ${'DRV'.padStart(5)} ${'P/DR'.padStart(5)}`;

const ALL = profile(games, 'ALL FBS');
console.log('='.repeat(140));
console.log('1) NATIONAL AVERAGES — per team per game');
console.log('='.repeat(140));
console.log(HEAD); console.log('-'.repeat(140));
console.log(line(ALL));
const dALL = drama(games);
console.log(`
  completion %  ${f1(ALL.cmpPct)}      yards/att ${f2(ALL.ypa)}      yards/carry ${f2(ALL.ypc)}      3rd-down ${f1(ALL.d3)}%      4th-down ${f1(ALL.d4)}% on ${f2(ALL.d4a)} att
  turnovers     ${f2(ALL.to)}  (${f2(ALL.int)} INT, ${f2(ALL.fl)} FUM lost)     sacks ${f2(ALL.sk)}     penalties ${f1(ALL.pen)}-${f0(ALL.peny)}     TOP ${f1(ALL.top)} min
  punts         ${f2(ALL.punts)} @ ${f1(ALL.puntAvg)} avg      FG ${f2(ALL.fga)} att @ ${f1(ALL.fgPct)}%      ST return TD ${f2(ALL.stTD)}      INT return TD ${f2(ALL.intTD)}
  drives        ${f1(ALL.drives)}/team   ${f2(ALL.pldr)} plays, ${f1(ALL.ydr)} yds, ${f0(ALL.secdr)}s each   ${f2(ALL.ppd)} pts/drive
  drive result  TD ${f1(ALL.dTD)}%  FG ${f1(ALL.dFG)}%  PUNT ${f1(ALL.dPUNT)}%  DOWNS ${f1(ALL.dDOWNS)}%  TURNOVER ${f1(ALL.dTO)}%  MISSED-FG ${f1(ALL.dMISS)}%  END-OF-HALF ${f1(ALL.dEND)}%
  game          ${f1(ALL.total)} total pts   ${f1(ALL.margin)} avg margin   ${f1(ALL.homeWin)}% home win   ${f1(ALL.otPct)}% OT   ${f2(ALL.twoPt)} 2-pt   ${f2(ALL.safety)} safety
  Q4 drama      avg |margin| entering Q4 ${f1(dALL.m4)}   lead flips in Q4 ${f1(dALL.flipPct)}%   10+pt Q4 comebacks ${f1(dALL.bigPct)}%
`);

/* ---------- 2) rank-tier permutations ---------- */
const tierOf = r => r === 0 ? 'UR' : r === 1 ? 'No.1' : r <= 5 ? 'T2-5' : r <= 10 ? 'T6-10' : 'T11-25';
const TORDER = ['No.1', 'T2-5', 'T6-10', 'T11-25', 'UR'];
console.log('='.repeat(140));
console.log('2) BY AP/CFP RANK MATCHUP (rank as of kickoff)');
console.log('='.repeat(140));
console.log(HEAD); console.log('-'.repeat(140));
const buckets = [];
for (let i = 0; i < TORDER.length; i++) for (let j = i; j < TORDER.length; j++) {
  const A = TORDER[i], B = TORDER[j];
  const list = games.filter(g => { const t1 = tierOf(g.hr), t2 = tierOf(g.ar); return (t1 === A && t2 === B) || (t1 === B && t2 === A); });
  if (list.length < 12) continue;
  buckets.push([`${A} vs ${B}`, list]);
}
buckets.forEach(([lab, list]) => console.log(line(profile(list, lab))));
// coarse
console.log('-'.repeat(140));
[['ranked vs ranked', g => g.hr && g.ar],
['ranked vs unranked', g => (!!g.hr) !== (!!g.ar)],
['unranked vs unranked', g => !g.hr && !g.ar],
['Top-10 vs Top-10', g => g.hr && g.ar && g.hr <= 10 && g.ar <= 10],
['Top-5 vs unranked', g => (g.hr && g.hr <= 5 && !g.ar) || (g.ar && g.ar <= 5 && !g.hr)],
].forEach(([lab, f]) => { const l = games.filter(f); if (l.length >= 12) console.log(line(profile(l, lab))); });

/* ---------- 2b) rank matchups, split into the BETTER-ranked side vs the other side ---------- */
// (rank 0 = unranked, treated as worse than any ranked team)
function sideSplit(list, label) {
  const hi = [], lo = [];
  for (const g of list) {
    const hRank = g.hr || 999, aRank = g.ar || 999;
    if (hRank === aRank) continue;
    const hiSide = hRank < aRank ? 'h' : 'a', loSide = hiSide === 'h' ? 'a' : 'h';
    hi.push(...rows([g]).filter(r => r.side === hiSide));
    lo.push(...rows([g]).filter(r => r.side === loSide));
  }
  if (!hi.length) return null;
  const st = R => ({
    pts: mean(R, r => r.pts), yds: mean(R, r => r.yds), plays: mean(R, r => r.plays),
    ratt: mean(R, r => r.ratt), att: mean(R, r => r.att),
    ypp: sum(R, r => r.yds) / (sum(R, r => r.plays) || 1),
    to: mean(R, r => r.to), d3: sum(R, r => r.d3c) / (sum(R, r => r.d3a) || 1) * 100,
    d4a: mean(R, r => r.d4a), win: mean(R, r => r.won * 100),
    ppd: sum(R, r => r.pts) / (sum(R, r => r.dn) || 1),
  });
  return { label, n: list.length, hi: st(hi), lo: st(lo) };
}
console.log('');
console.log('='.repeat(140));
console.log('2b) THE SAME MATCHUPS, SPLIT — higher-ranked team (HI) vs lower-ranked/unranked team (LO)');
console.log('='.repeat(140));
console.log(`  ${'MATCHUP'.padEnd(22)} ${'GMS'.padStart(5)} ${'HI W%'.padStart(6)} | ${'PTS hi/lo'.padStart(13)} ${'YDS hi/lo'.padStart(13)} ${'Y/P hi/lo'.padStart(13)} ${'RUSH hi/lo'.padStart(13)} ${'PASS hi/lo'.padStart(13)} ${'TO hi/lo'.padStart(12)} ${'3D% hi/lo'.padStart(13)} ${'4DA hi/lo'.padStart(12)}`);
console.log('-'.repeat(140));
const splitList = [
  ['No.1 vs UR', g => (g.hr === 1 && !g.ar) || (g.ar === 1 && !g.hr)],
  ['No.1 vs ranked', g => (g.hr === 1 && g.ar) || (g.ar === 1 && g.hr)],
  ['Top-5 vs UR', g => ((g.hr && g.hr <= 5 && !g.ar) || (g.ar && g.ar <= 5 && !g.hr))],
  ['Top-5 vs T6-25', g => (g.hr && g.ar) && ((g.hr <= 5 && g.ar > 5) || (g.ar <= 5 && g.hr > 5))],
  ['Top-10 vs Top-10', g => g.hr && g.ar && g.hr <= 10 && g.ar <= 10],
  ['T6-10 vs UR', g => (g.hr >= 6 && g.hr <= 10 && !g.ar) || (g.ar >= 6 && g.ar <= 10 && !g.hr)],
  ['T11-25 vs UR', g => (g.hr >= 11 && g.hr <= 25 && !g.ar) || (g.ar >= 11 && g.ar <= 25 && !g.hr)],
  ['ranked vs ranked', g => g.hr && g.ar],
  ['ranked vs unranked', g => (!!g.hr) !== (!!g.ar)],
  ['unranked vs unranked', g => !g.hr && !g.ar],
];
for (const [lab, fn] of splitList) {
  const list = games.filter(fn); if (list.length < 12) continue;
  const s = sideSplit(list, lab); if (!s) continue;
  const p = (a, b, d = 1) => `${a.toFixed(d)}/${b.toFixed(d)}`.padStart(13);
  console.log(`  ${lab.padEnd(22)} ${String(s.n).padStart(5)} ${f1(s.hi.win).padStart(6)} | `
    + `${p(s.hi.pts, s.lo.pts)} ${p(s.hi.yds, s.lo.yds, 0)} ${p(s.hi.ypp, s.lo.ypp, 2)} `
    + `${p(s.hi.ratt, s.lo.ratt)} ${p(s.hi.att, s.lo.att)} ${`${s.hi.to.toFixed(2)}/${s.lo.to.toFixed(2)}`.padStart(12)} `
    + `${p(s.hi.d3, s.lo.d3)} ${`${s.hi.d4a.toFixed(2)}/${s.lo.d4a.toFixed(2)}`.padStart(12)}`);
}

/* ---------- 3) mismatch buckets (retrodictive rating gap = expected margin) ---------- */
console.log('');
console.log('='.repeat(140));
console.log('3) BY MISMATCH SIZE — |expected margin| from a retrodictive season rating (≈ the point spread)');
console.log('='.repeat(140));
console.log(HEAD); console.log('-'.repeat(140));
const GAPS = [[0, 3], [3, 7], [7, 10.5], [10.5, 14], [14, 17.5], [17.5, 24], [24, 31], [31, 99]];
const gapRows = [];
for (const [lo, hi] of GAPS) {
  const list = games.filter(g => g.gap >= lo && g.gap < hi);
  if (list.length < 20) continue;
  const p = profile(list, `spread ${lo}–${hi === 99 ? '+' : hi}`);
  gapRows.push(p); console.log(line(p));
}
console.log('\n  FAVORITE vs UNDERDOG split inside each mismatch bucket:');
console.log(`  ${'BUCKET'.padEnd(16)} ${'FAV%W'.padStart(6)} ${'FAV PTS'.padStart(8)} ${'DOG PTS'.padStart(8)} ${'FAV YDS'.padStart(8)} ${'DOG YDS'.padStart(8)} ${'FAV TO'.padStart(7)} ${'DOG TO'.padStart(7)} ${'FAV RUN'.padStart(8)} ${'DOG RUN'.padStart(8)} ${'FAV PASS'.padStart(9)} ${'DOG PASS'.padStart(9)} ${'DOG 4DA'.padStart(8)}`);
gapRows.forEach(p => console.log(`  ${p.label.padEnd(16)} ${f1(p.favWin).padStart(6)} ${f1(p.favPts).padStart(8)} ${f1(p.dogPts).padStart(8)} ${f0(p.favYds).toString().padStart(8)} ${f0(p.dogYds).toString().padStart(8)} ${f2(p.favTO).padStart(7)} ${f2(p.dogTO).padStart(7)} ${f1(p.favRatt).padStart(8)} ${f1(p.dogRatt).padStart(8)} ${f1(p.favAtt).padStart(9)} ${f1(p.dogAtt).padStart(9)} ${f2(p.dogD4a).padStart(8)}`));

/* ---------- 4) drama + drive mix by bucket ---------- */
console.log('');
console.log('='.repeat(140));
console.log('4) DRIVE OUTCOME MIX + LATE-GAME DRAMA by mismatch');
console.log('='.repeat(140));
console.log(`  ${'BUCKET'.padEnd(16)} ${'TD%'.padStart(6)} ${'FG%'.padStart(6)} ${'PUNT%'.padStart(6)} ${'DOWN%'.padStart(6)} ${'TO%'.padStart(6)} ${'MISS%'.padStart(6)} ${'ENDHF%'.padStart(7)} | ${'|M|Q4'.padStart(6)} ${'FLIP%'.padStart(6)} ${'CMBK%'.padStart(6)} ${'OT%'.padStart(5)}`);
for (const [lo, hi] of GAPS) {
  const list = games.filter(g => g.gap >= lo && g.gap < hi);
  if (list.length < 20) continue;
  const p = profile(list, ''), d = drama(list);
  console.log(`  ${`spread ${lo}–${hi === 99 ? '+' : hi}`.padEnd(16)} ${f1(p.dTD).padStart(6)} ${f1(p.dFG).padStart(6)} ${f1(p.dPUNT).padStart(6)} ${f1(p.dDOWNS).padStart(6)} ${f1(p.dTO).padStart(6)} ${f1(p.dMISS).padStart(6)} ${f1(p.dEND).padStart(7)} | ${f1(d.m4).padStart(6)} ${f1(d.flipPct).padStart(6)} ${f1(d.bigPct).padStart(6)} ${f1(p.otPct).padStart(5)}`);
}
const dRR = drama(games.filter(g => g.hr && g.ar));
const dRU = drama(games.filter(g => (!!g.hr) !== (!!g.ar)));
console.log(`\n  ranked vs ranked      |M|Q4 ${f1(dRR.m4)}  flips ${f1(dRR.flipPct)}%  10+ comebacks ${f1(dRR.bigPct)}%   (n=${dRR.n})`);
console.log(`  ranked vs unranked    |M|Q4 ${f1(dRU.m4)}  flips ${f1(dRU.flipPct)}%  10+ comebacks ${f1(dRU.bigPct)}%   (n=${dRU.n})`);

const gapDrama = [];
for (const [lo, hi] of GAPS) {
  const list = games.filter(g => g.gap >= lo && g.gap < hi);
  if (list.length < 20) continue;
  const p = profile(list, ''), d = drama(list);
  gapDrama.push({ label: `spread ${lo}–${hi === 99 ? '+' : hi}`, ...d, otPct: p.otPct });
}
fs.writeFileSync(__dirname + '/gapdrama.json', JSON.stringify(gapDrama, null, 1));
fs.writeFileSync(__dirname + '/profiles.json', JSON.stringify({ all: ALL, drama: dALL, gaps: gapRows }, null, 1));
console.log('\nwrote profiles.json');

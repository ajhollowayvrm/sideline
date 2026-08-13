/* Step 9 — possession-model tuning harness.
   Runs simEngine over a fixed 2,010-game slate and scores it against the real targets in
   docs/reference/cfb-averages.md. Accepts source substitutions so candidate constants can be
   swept WITHOUT editing index.html; once a set wins, it gets written into the engine for real.

   usage:  node tools/cfb-data/9-tune.js            # score the engine as it currently ships
           node tools/cfb-data/9-tune.js sweep      # sweep the candidate parameter sets below   */
const fs = require('fs'), path = require('path');
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); return html.slice(i, j); };
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
eval(grab('// === SCHEME ENGINE (Phase 21) START ===', '// === SCHEME ENGINE (Phase 21) END ==='));
const BASE = grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ===');

/* ---------- targets (real FBS, from docs/reference/cfb-averages.md) ---------- */
const T = {
  pts: 26.9, yds: 383, plays: 67.5, ypp: 5.67,
  att: 31.2, cmpPct: 61.1, pyds: 227, ypa: 7.29,
  ratt: 34.2, ryds: 168, ypc: 4.92,        // DESIGNED runs (real 36.3/155/4.27 includes sacks at ~6.5 yd each)
  fd: 20.2, d3: 39.2, d4a: 1.94,
  to: 1.38, int: 0.82, fl: 0.56, sk: 2.06,
  punts: 4.32, fga: 1.58,
  drives: 11.8, pldr: 5.75, ppd: 2.28,
  dTD: 26.3, dFG: 9.9, dPUNT: 35.3, dDOWNS: 7.2, dTO: 10.7, dEND: 6.5,
  sd: 13.26, kurt: 0.32, blow: 5.8, midUps: 9.5,
  start: 29.8,   // avg drive start — MEASURED
  ydPerPt: 14.2, // 383 yds / 26.9 pts
  rzTrips: 4.68, rzTD: 67.5, rzScore: 85.2,  // red zone — MEASURED (tools/cfb-data/11-plays.js)
};

/* ---------- synthetic world (identical to test/simlab.js) ---------- */
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3], ["DE", "def", 6], ["DT", "def", 6],
["LB", "def", 10], ["CB", "def", 9], ["S", "def", 8], ["K", "st", 2], ["P", "st", 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
const world = (() => {
  const r = rng(0x5eed), teams = [];
  for (let i = 0; i < 134; i++) {
    const prestige = clamp(Math.round(35 + ri(r, -15, 15) + (i < 16 ? 25 : i < 40 ? 12 : 0)), 20, 98);
    const out = [];
    POS.forEach(([code, , n]) => { for (let k = 0; k < n; k++)
      out.push({ id: 'p' + Math.floor(r() * 1e9).toString(36), pos: code, ov: clamp(Math.round(prestige * 0.55 + ri(r, -9, 9) + 30), 48, 99), so: 0 }); });
    const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
    Object.values(byPos).forEach(arr => { arr.sort((a, b) => b.ov - a.ov);
      arr.forEach((p, i2) => { if (i2 >= 2) p.ov = clamp(Math.round(p.ov - Math.min(2 + (i2 - 2) * 2.6, 26)), 44, 99); p.so = i2; }); });
    const grp = s => out.filter(p => sideOf[p.pos] === s);
    const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
    teams.push({ id: 't' + i, abbr: 'T' + i, prestige, roster: out, ratings: { off: avgTop(grp('off'), 11), def: avgTop(grp('def'), 11) } });
  }
  return teams;
})();
const slate = [];
for (let i = 0; i < world.length; i++) for (let d = 1; d <= 15; d++)
  slate.push({ id: 'g' + i + '_' + d, home: world[i], away: world[(i + d) % world.length] });

/* ---------- run one variant, score it ---------- */
function build(src) {
  return new Function('rng', 'ri', 'clamp', 'pick', 'compVal', 'compDraw', 'compClutch', 'schemeTendency',
    src + '\nreturn simEngine;')(rng, ri, clamp, pick, compVal, compDraw, compClutch, schemeTendency);
}
function score(src, label, verbose) {
  const simEngine = build(src);
  const A = { pts: 0, pAtt: 0, pCmp: 0, pYds: 0, rAtt: 0, rYds: 0, skYds: 0, sk: 0, fd: 0,
    d3a: 0, d3c: 0, d4a: 0, d4c: 0, int: 0, fum: 0, punts: 0, fga: 0, fgm: 0, drives: 0,
    dTD: 0, dFG: 0, dPUNT: 0, dDOWNS: 0, dTO: 0, dMISS: 0, dEND: 0, pen: 0, startSum: 0, startN: 0, rz: 0, rzTD: 0, rzFG: 0, d3b: {} };
  const rows = [];
  let curDrive = null;
  for (const g of slate) {
    const res = simEngine(g.home, g.away, (hashStr(g.id) ^ 0x5ca1ab1e) >>> 0, { log: true });
    A.pts += res.hs + res.as;
    for (const t of [g.home, g.away]) { const ids = new Set(t.roster.map(p => p.id));
      for (const pid in res.box) { if (!ids.has(pid)) continue; const b = res.box[pid];
        A.pAtt += b.pAtt || 0; A.pCmp += b.pCmp || 0; A.pYds += b.pYds || 0;
        A.rAtt += b.rAtt || 0; A.rYds += b.rYds || 0; A.sk += b.sk || 0;
        A.fga += b.fga || 0; A.fgm += b.fgm || 0; A.int += b.pInt || 0; } }
    A.pen += (res.pen[g.home.id] ? res.pen[g.home.id].n : 0) + (res.pen[g.away.id] ? res.pen[g.away.id].n : 0);
    for (const e of res.log) {
      if (e.kind === 'drive') {
        if (curDrive) { if (curDrive.rz) { A.rz++; if (curDrive.td) A.rzTD++; else if (curDrive.fg) A.rzFG++; } }
        A.drives++;
        const m0 = e.text.match(/ball at (?:(own|opp) ([0-9]+)|(midfield))/);
        const st = m0 ? (m0[3] ? 50 : (m0[1] === 'own' ? +m0[2] : 100 - +m0[2])) : 25;
        if (m0) { A.startSum += st; A.startN++; }
        curDrive = { los: st, rz: st >= 80, td: false, fg: false };
        continue; }
      if (e.kind === 'final' || !e.team) continue;
      if (curDrive) {
        const mg = e.text.match(/(?:run|pass to [^0-9]*|sacked by [^0-9]*for) (-?[0-9]+)/);
        if (mg) { curDrive.los += parseInt(mg[1], 10); if (curDrive.los >= 80) curDrive.rz = true; }
        if (/TOUCHDOWN/.test(e.text)) { curDrive.rz = true; curDrive.td = true; }
        if (/field goal is GOOD/.test(e.text)) curDrive.fg = true;
      }
      const isPen = /^🚩/.test(e.text), dn = parseInt(String(e.dd || '').charAt(0), 10);
      const scored = e.kind === 'score' && /TOUCHDOWN/.test(e.text);
      const conv = /1ST DOWN/.test(e.text) || scored;
      if (!isPen && dn === 3) { A.d3a++; if (conv) A.d3c++;
        const dv = e.tg;
        if (dv != null) {
          const bk = dv <= 1 ? '1' : dv <= 3 ? '2-3' : dv <= 6 ? '4-6' : dv <= 10 ? '7-10' : '11+';
          const a = A.d3b[bk] = A.d3b[bk] || [0, 0]; a[0]++; if (conv) a[1]++; } }
      if (!isPen && dn === 4 && !/^Punt/.test(e.text) && !/field goal/.test(e.text)) { A.d4a++; if (conv) A.d4c++; }
      if (conv) A.fd++;
      if (/^Punt/.test(e.text)) { A.punts++; A.dPUNT++; }
      else if (/field goal is GOOD/.test(e.text)) A.dFG++;
      else if (/field goal MISSED/.test(e.text)) A.dMISS++;
      else if (scored) A.dTD++;
      else if (/Turnover on downs/.test(e.text)) A.dDOWNS++;
      else if (/INTERCEPTED/.test(e.text)) A.dTO++;
      else if (/FUMBLES|STRIP-SACKED/.test(e.text)) { A.dTO++; A.fum++; }
      else if (/END OF (HALF|GAME)/i.test(e.text)) A.dEND++;
      const m = e.text.match(/sacked by .* for (-\d+)/); if (m) A.skYds += -parseInt(m[1], 10);
    }
    if (curDrive && curDrive.rz) { A.rz++; if (curDrive.td) A.rzTD++; else if (curDrive.fg) A.rzFG++; }
    curDrive = null;
    rows.push({ hid: g.home.id, aid: g.away.id, hs: res.hs, as: res.as });
  }
  const G = slate.length, TG = G * 2;
  // retrodictive rating on these results → residual shape + upset rate
  const HFA = 2.4, R = {}; world.forEach(t => R[t.id] = 0);
  const cap = x => Math.max(-28, Math.min(28, x));
  for (let it = 0; it < 60; it++) {
    const s = {}, c = {}; world.forEach(t => { s[t.id] = 0; c[t.id] = 0; });
    for (const g of rows) { const m = cap(g.hs - g.as);
      s[g.hid] += (m - HFA) + R[g.aid]; c[g.hid]++; s[g.aid] += (-m + HFA) + R[g.hid]; c[g.aid]++; }
    world.forEach(t => { if (c[t.id]) R[t.id] = s[t.id] / c[t.id]; });
    const mu = world.reduce((a, t) => a + R[t.id], 0) / world.length;
    world.forEach(t => R[t.id] -= mu);
  }
  const fav = rows.map(g => { const e = R[g.hid] - R[g.aid] + HFA, sp = Math.abs(e);
    const fm = e > 0 ? g.hs - g.as : g.as - g.hs; return { resid: fm - sp, spread: sp, fm }; });
  const rs = fav.map(x => x.resid), mu = rs.reduce((a, b) => a + b, 0) / rs.length;
  const sd = Math.sqrt(rs.reduce((s, x) => s + (x - mu) ** 2, 0) / rs.length);
  const kurt = rs.reduce((s, x) => s + ((x - mu) / sd) ** 4, 0) / rs.length - 3;
  const blow = fav.filter(x => x.spread >= 7 && x.fm <= -14).length / G * 790;
  const mid = fav.filter(x => x.spread >= 10.5 && x.spread < 14);
  const midUps = mid.length ? mid.filter(x => x.fm < 0).length / mid.length * 100 : 0;
  const dn = A.drives || 1;
  const M = {
    pts: A.pts / TG, plays: (A.pAtt + A.rAtt + A.sk) / TG,
    yds: (A.pYds + A.rYds - A.skYds) / TG,
    ypp: (A.pYds + A.rYds - A.skYds) / (A.pAtt + A.rAtt + A.sk),
    att: A.pAtt / TG, cmpPct: A.pCmp / A.pAtt * 100, pyds: A.pYds / TG, ypa: A.pYds / A.pAtt,
    ratt: A.rAtt / TG, ryds: A.rYds / TG, ypc: A.rYds / A.rAtt,
    fd: A.fd / TG, d3: A.d3c / (A.d3a || 1) * 100, d4a: A.d4a / TG,
    to: (A.int + A.fum) / TG, int: A.int / TG, fl: A.fum / TG, sk: A.sk / TG,
    punts: A.punts / TG, fga: A.fga / TG,
    drives: A.drives / TG, pldr: (A.pAtt + A.rAtt + A.sk) / dn, ppd: A.pts / dn,
    dTD: A.dTD / dn * 100, dFG: A.dFG / dn * 100, dPUNT: A.dPUNT / dn * 100,
    dDOWNS: A.dDOWNS / dn * 100, dTO: A.dTO / dn * 100, dEND: A.dEND / dn * 100,
    sd, kurt, blow, midUps,
    start: A.startSum / (A.startN || 1),
    rzTrips: A.rz / TG, rzTD: A.rzTD / (A.rz || 1) * 100, rzScore: (A.rzTD + A.rzFG) / (A.rz || 1) * 100,
    ydPerPt: (A.pYds + A.rYds - A.skYds) / (A.pts || 1),
  };
  if (verbose) {
    const REAL3 = { '1': [11.4, 76.6], '2-3': [16.5, 57.0], '4-6': [24.6, 43.4], '7-10': [29.5, 31.7], '11+': [18.1, 16.9] };
    const t3 = Object.values(A.d3b).reduce((s2, x) => s2 + x[0], 0) || 1;
    console.log('\n    3rd-DOWN MIX        real freq / sim freq      real conv / sim conv');
    for (const bk of ['1', '2-3', '4-6', '7-10', '11+']) {
      const a = A.d3b[bk] || [0, 0], R = REAL3[bk];
      console.log('      ' + bk.padEnd(6) + (R[0].toFixed(1) + '%').padStart(8) + ' / ' + ((a[0] / t3 * 100).toFixed(1) + '%').padStart(7)
        + '        ' + (R[1].toFixed(1) + '%').padStart(8) + ' / ' + ((a[1] / (a[0] || 1) * 100).toFixed(1) + '%').padStart(7));
    }
    console.log(`\n  ${label}`);
    const K = [['pts', 1], ['yds', 0], ['plays', 1], ['ypp', 2], ['att', 1], ['cmpPct', 1], ['pyds', 0], ['ypa', 2],
      ['ratt', 1], ['ryds', 0], ['ypc', 2], ['fd', 1], ['d3', 1], ['d4a', 2], ['to', 2], ['int', 2], ['fl', 2],
      ['sk', 2], ['punts', 2], ['fga', 2], ['drives', 2], ['pldr', 2], ['ppd', 2],
      ['dTD', 1], ['dFG', 1], ['dPUNT', 1], ['dDOWNS', 1], ['dTO', 1], ['dEND', 1],
      ['sd', 2], ['kurt', 2], ['blow', 1], ['midUps', 1], ['start', 1], ['ydPerPt', 1], ['rzTrips', 2], ['rzTD', 1], ['rzScore', 1]];
    console.log(`    ${'METRIC'.padEnd(10)} ${'TARGET'.padStart(8)} ${'SIM'.padStart(8)} ${'OFF'.padStart(8)}`);
    for (const [k, d] of K) {
      if (T[k] === undefined) continue;
      const off = T[k] ? (M[k] - T[k]) / Math.abs(T[k]) * 100 : 0;
      const flag = Math.abs(off) < 6 ? '' : Math.abs(off) < 15 ? ' ~' : ' <<';
      console.log(`    ${k.padEnd(10)} ${T[k].toFixed(d).padStart(8)} ${M[k].toFixed(d).padStart(8)} ${((off > 0 ? '+' : '') + off.toFixed(0) + '%').padStart(8)}${flag}`);
    }
  }
  // one-line scorecard: mean |%off| across the headline metrics
  const HEAD = ['pts', 'plays', 'ypc', 'ratt', 'att', 'd3', 'd4a', 'to', 'drives', 'pldr', 'sd', 'blow'];
  const err = HEAD.reduce((s, k) => s + Math.abs((M[k] - T[k]) / Math.abs(T[k])), 0) / HEAD.length * 100;
  console.log(`  ${label.padEnd(30)} err ${err.toFixed(1).padStart(5)}%  |  pts ${M.pts.toFixed(1)} drv ${M.drives.toFixed(1)} pl/dr ${M.pldr.toFixed(2)} ypc ${M.ypc.toFixed(2)} run/pass ${(M.ratt / (M.ratt + M.att) * 100).toFixed(0)}/${(M.att / (M.ratt + M.att) * 100).toFixed(0)} 3D ${M.d3.toFixed(1)}% 4DA ${M.d4a.toFixed(2)} TO ${M.to.toFixed(2)} SD ${M.sd.toFixed(1)} blow ${M.blow.toFixed(1)}`);
  return { M, err };
}

const arg = process.argv[2];
console.log('\nTARGETS: pts 26.9  drv 11.8  pl/dr 5.75  ypc 4.92  run/pass 52/48  3D 39.2%  4DA 1.94  TO 1.38  SD 13.3  blow 5.8\n');
score(BASE, 'SHIPPING (Phase 46)', arg === 'detail');
module.exports = { BASE, score, T, build, slate, world };

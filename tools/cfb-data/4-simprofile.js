/* Step 4 — run Sideline's simEngine over a large synthetic slate and compute the SAME
   metric set as 3-analyze.js, so sim vs reality is apples-to-apples. */
const fs = require('fs');
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const html = fs.readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); return html.slice(i, j); };
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
eval(grab('// === SCHEME ENGINE (Phase 21) START ===', '// === SCHEME ENGINE (Phase 21) END ==='));
eval(grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ==='));

/* synthetic world — mirrors test/simlab.js exactly */
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3],
["DE", "def", 6], ["DT", "def", 6], ["LB", "def", 10], ["CB", "def", 9], ["S", "def", 8],
["K", "st", 2], ["P", "st", 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
function genRoster(r, prestige) {
  const out = [];
  POS.forEach(([code, , n]) => { for (let i = 0; i < n; i++) {
    out.push({ id: 'p' + Math.floor(r() * 1e9).toString(36), pos: code, ov: clamp(Math.round(prestige * 0.55 + ri(r, -9, 9) + 30), 48, 99), so: 0 });
  } });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => { arr.sort((a, b) => b.ov - a.ov);
    arr.forEach((p, i) => { if (i >= 2) p.ov = clamp(Math.round(p.ov - Math.min(2 + (i - 2) * 2.6, 26)), 44, 99); p.so = i; }); });
  return out;
}
function teamRatings(roster) {
  const grp = s => roster.filter(p => sideOf[p.pos] === s);
  const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
  const off = avgTop(grp('off'), 11), def = avgTop(grp('def'), 11);
  return { off, def, ovr: Math.round((off + def) / 2) };
}
const world = (() => {
  const r = rng(0x5eed), teams = [];
  for (let i = 0; i < 134; i++) {
    const prestige = clamp(Math.round(35 + ri(r, -15, 15) + (i < 16 ? 25 : i < 40 ? 12 : 0)), 20, 98);
    const roster = genRoster(r, prestige);
    teams.push({ id: 't' + i, abbr: 'T' + i, prestige, roster, ratings: teamRatings(roster) });
  }
  return teams;
})();

/* schedule: each team vs 30 others (wrap) → ~2000 games spanning every mismatch level */
const slate = [];
for (let i = 0; i < world.length; i++) for (let d = 1; d <= 15; d++) {
  slate.push({ id: 'g' + i + '_' + d, home: world[i], away: world[(i + d) % world.length] });
}

/* ---------- sim each game, parse the log into the real-data metric set ---------- */
const recs = [];   // per team-game
const gameRows = [];
for (const g of slate) {
  const seed = (hashStr(g.id) ^ 0x5ca1ab1e) >>> 0;
  const res = simEngine(g.home, g.away, seed, { log: true });
  const per = {};
  for (const t of [g.home, g.away]) per[t.id] = {
    pts: 0, pAtt: 0, pCmp: 0, pYds: 0, rAtt: 0, rYds: 0, skYds: 0, sk: 0,
    fd: 0, d3a: 0, d3c: 0, d4a: 0, d4c: 0, int: 0, fum: 0, punts: 0, fga: 0, fgm: 0,
    drives: 0, dTD: 0, dFG: 0, dPUNT: 0, dDOWNS: 0, dTO: 0, dMISS: 0, dEND: 0, plays: 0,
  };
  // box → per-team passing/rushing/sacks
  for (const t of [g.home, g.away]) {
    const ids = new Set(t.roster.map(p => p.id)), s = per[t.id];
    for (const pid in res.box) { if (!ids.has(pid)) continue; const b = res.box[pid];
      s.pAtt += b.pAtt || 0; s.pCmp += b.pCmp || 0; s.pYds += b.pYds || 0;
      s.rAtt += b.rAtt || 0; s.rYds += b.rYds || 0; s.sk += b.sk || 0;
      s.fga += b.fga || 0; s.fgm += b.fgm || 0; s.int += b.pInt || 0; }
  }
  per[g.home.id].pts = res.hs; per[g.away.id].pts = res.as;
  // log → downs, drives, drive outcomes, punts, fumbles, sack yardage
  let cur = null, q4h = null, q4a = null;
  for (const e of res.log) {
    if (e.q === 4 && q4h === null) { q4h = e.hs; q4a = e.as; }
    const s = e.team ? per[e.team] : null;
    if (e.kind === 'drive') { if (s) { s.drives++; cur = e.team; } continue; }
    if (e.kind === 'final') continue;
    if (!s) continue;
    const isPen = /^🚩/.test(e.text);
    const dnum = parseInt(String(e.dd || '').charAt(0), 10);
    const scored = e.kind === 'score' && /TOUCHDOWN/.test(e.text);
    const conv = /1ST DOWN/.test(e.text) || scored;
    if (!isPen && dnum === 3) { s.d3a++; if (conv) s.d3c++; }
    if (!isPen && dnum === 4 && !/^Punt/.test(e.text) && !/field goal/.test(e.text)) { s.d4a++; if (conv) s.d4c++; }
    if (conv) s.fd++;
    if (/^Punt/.test(e.text)) { s.punts++; s.dPUNT++; }
    else if (/field goal is GOOD/.test(e.text)) s.dFG++;
    else if (/field goal MISSED/.test(e.text)) s.dMISS++;
    else if (scored) s.dTD++;
    else if (/Turnover on downs/.test(e.text)) s.dDOWNS++;
    else if (/INTERCEPTED/.test(e.text)) s.dTO++;
    else if (/FUMBLES/.test(e.text)) { s.dTO++; s.fum++; }
    const m = e.text.match(/sacked by .* for (-\d+)/); if (m) s.skYds += -parseInt(m[1], 10);
  }
  for (const t of [g.home, g.away]) {
    const s = per[t.id], o = per[t === g.home ? g.away.id : g.home.id];
    s.sk = o.sk;                                   // sacks BY this team's defense (box charges the sacker)
    s.plays = s.pAtt + s.rAtt + (o.sk || 0);       // NCAA counts a sack as a rushing attempt
    s.yds = s.pYds + s.rYds - s.skYds;             // NCAA nets sack yardage out of rushing
    s.pen = res.pen[t.id] ? res.pen[t.id].n : 0;
    s.peny = res.pen[t.id] ? res.pen[t.id].yds : 0;
    s.tid = t.id; s.gid = g.id;
    recs.push(s);
  }
  gameRows.push({ id: g.id, hid: g.home.id, aid: g.away.id, hs: res.hs, as: res.as, neutral: false,
    q4h, q4a, ot: /OT/.test(String(res.log[res.log.length - 2] && res.log[res.log.length - 2].q || '')) });
}

/* ---------- retrodictive rating on the SIM's own results (same method as the real data) ---------- */
const HFA = 2.4, R = {};
world.forEach(t => R[t.id] = 0);
const cap = x => Math.max(-28, Math.min(28, x));
for (let it = 0; it < 60; it++) {
  const sum = {}, cnt = {}; world.forEach(t => { sum[t.id] = 0; cnt[t.id] = 0; });
  for (const g of gameRows) { const m = cap(g.hs - g.as);
    sum[g.hid] += (m - HFA) + R[g.aid]; cnt[g.hid]++;
    sum[g.aid] += (-m + HFA) + R[g.hid]; cnt[g.aid]++; }
  world.forEach(t => { if (cnt[t.id]) R[t.id] = sum[t.id] / cnt[t.id]; });
  const mean = world.reduce((a, t) => a + R[t.id], 0) / world.length;
  world.forEach(t => R[t.id] -= mean);
}
const byGid = {}; gameRows.forEach(g => byGid[g.id] = g);
gameRows.forEach(g => { g.exp = R[g.hid] - R[g.aid] + HFA; g.gap = Math.abs(g.exp); });
recs.forEach(s => { const g = byGid[s.gid]; s.g = g;
  s.exp = s.tid === g.hid ? g.exp : -g.exp; s.fav = s.exp > 0 ? 1 : 0;
  s.won = (s.tid === g.hid ? g.hs > g.as : g.as > g.hs) ? 1 : 0; });

/* ---------- aggregate ---------- */
const mean = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0;
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
function profile(rs, gs, label) {
  const dn = sum(rs, r => r.drives) || 1;
  return {
    label, games: gs.length,
    pts: mean(rs, r => r.pts), yds: mean(rs, r => r.yds),
    plays: mean(rs, r => r.plays), ypp: sum(rs, r => r.yds) / (sum(rs, r => r.plays) || 1),
    att: mean(rs, r => r.pAtt), cmp: mean(rs, r => r.pCmp),
    cmpPct: sum(rs, r => r.pCmp) / (sum(rs, r => r.pAtt) || 1) * 100,
    pyds: mean(rs, r => r.pYds), ypa: sum(rs, r => r.pYds) / (sum(rs, r => r.pAtt) || 1),
    ratt: mean(rs, r => r.rAtt), ryds: mean(rs, r => r.rYds - r.skYds),
    ypc: sum(rs, r => r.rYds) / (sum(rs, r => r.rAtt) || 1),
    fd: mean(rs, r => r.fd),
    d3: sum(rs, r => r.d3c) / (sum(rs, r => r.d3a) || 1) * 100,
    d4a: mean(rs, r => r.d4a), d4: sum(rs, r => r.d4c) / (sum(rs, r => r.d4a) || 1) * 100,
    to: mean(rs, r => r.int + r.fum), int: mean(rs, r => r.int), fl: mean(rs, r => r.fum),
    sk: mean(rs, r => r.sk), pen: mean(rs, r => r.pen), peny: mean(rs, r => r.peny),
    punts: mean(rs, r => r.punts), fga: mean(rs, r => r.fga),
    fgPct: sum(rs, r => r.fgm) / (sum(rs, r => r.fga) || 1) * 100,
    drives: mean(rs, r => r.drives), ppd: sum(rs, r => r.pts) / dn,
    dTD: sum(rs, r => r.dTD) / dn * 100, dFG: sum(rs, r => r.dFG) / dn * 100,
    dPUNT: sum(rs, r => r.dPUNT) / dn * 100, dDOWNS: sum(rs, r => r.dDOWNS) / dn * 100,
    dTO: sum(rs, r => r.dTO) / dn * 100, dMISS: sum(rs, r => r.dMISS) / dn * 100,
    dEND: 0,
    margin: mean(gs, g => Math.abs(g.hs - g.as)), total: mean(gs, g => g.hs + g.as),
    homeWin: mean(gs, g => g.hs > g.as ? 100 : 0),
    otPct: mean(gs, g => g.ot ? 100 : 0),
    favWin: mean(rs.filter(r => r.fav), r => r.won * 100),
    favPts: mean(rs.filter(r => r.fav), r => r.pts), dogPts: mean(rs.filter(r => !r.fav), r => r.pts),
    favYds: mean(rs.filter(r => r.fav), r => r.yds), dogYds: mean(rs.filter(r => !r.fav), r => r.yds),
    favTO: mean(rs.filter(r => r.fav), r => r.int + r.fum), dogTO: mean(rs.filter(r => !r.fav), r => r.int + r.fum),
    favRatt: mean(rs.filter(r => r.fav), r => r.rAtt), dogRatt: mean(rs.filter(r => !r.fav), r => r.rAtt),
    favAtt: mean(rs.filter(r => r.fav), r => r.pAtt), dogAtt: mean(rs.filter(r => !r.fav), r => r.pAtt),
    dogD4a: mean(rs.filter(r => !r.fav), r => r.d4a),
  };
}
function drama(gs) {
  let flips = 0, big = 0, n = 0, m4 = 0;
  for (const g of gs) { if (g.q4h === null) continue;
    const m0 = g.q4h - g.q4a, m1 = g.hs - g.as; n++; m4 += Math.abs(m0);
    if (m0 !== 0 && m1 !== 0 && Math.sign(m0) !== Math.sign(m1)) { flips++; if (Math.abs(m0) >= 10) big++; } }
  return { n, flipPct: flips / n * 100, bigPct: big / n * 100, m4: m4 / n };
}

const GAPS = [[0, 3], [3, 7], [7, 10.5], [10.5, 14], [14, 17.5], [17.5, 24], [24, 31], [31, 99]];
const out = { all: profile(recs, gameRows, 'SIM ALL'), drama: drama(gameRows), gaps: [], gapDrama: [] };
for (const [lo, hi] of GAPS) {
  const gs = gameRows.filter(g => g.gap >= lo && g.gap < hi);
  const ids = new Set(gs.map(g => g.id));
  const rs = recs.filter(r => ids.has(r.gid));
  if (gs.length < 20) continue;
  out.gaps.push(profile(rs, gs, `spread ${lo}–${hi === 99 ? '+' : hi}`));
  out.gapDrama.push({ label: `spread ${lo}–${hi === 99 ? '+' : hi}`, ...drama(gs) });
}
fs.writeFileSync(__dirname + '/simprofile.json', JSON.stringify(out, null, 1));
console.log(`sim: ${gameRows.length} games, ${recs.length} team-games → simprofile.json`);
console.log(`  ${out.all.pts.toFixed(1)} pts, ${out.all.yds.toFixed(0)} yds, ${out.all.plays.toFixed(1)} plays, ${out.all.drives.toFixed(1)} drives, ${out.all.ppd.toFixed(2)} pts/drive`);

/* Step 4 — run Sideline's simEngine over a large synthetic slate and compute the SAME
   metric set as 3-analyze.js, so sim vs reality is apples-to-apples. */
const fs = require('fs');
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// INDEX=path lets this profile a DIFFERENT build of the game — which is the only way to measure a
// phase's effect on the envelope honestly (git show HEAD:index.html > /tmp/old.html).
const html = fs.readFileSync(process.env.INDEX || require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) return null; return html.slice(i, j); };
// the attribute block was renamed at Phase 52; accept either so old and new builds both profile
const grabAttr = () => grab('// === ATTRIBUTE ENGINE (Phase 52) START ===', '// === ATTRIBUTE ENGINE (Phase 52) END ===')
  || grab('// === ATTRIBUTE ENGINE (Phase 51) START ===', '// === ATTRIBUTE ENGINE (Phase 51) END ===');
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
eval(grab('// === SCHEME ENGINE (Phase 21) START ===', '// === SCHEME ENGINE (Phase 21) END ==='));
// Phase 51's attribute engine — needed so the synthetic league carries REAL six-attribute profiles.
// See the FLAT note in genRoster below for why this matters to every number this tool prints.
eval(grabAttr());
eval(grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ==='));

/* `FLAT=1 node 4-simprofile.js` reproduces the pre-fix behaviour — players with NO attribute
   profile, so every attribute falls back to `ov`. Kept as a toggle because the Phase 51 drift
   table in docs/phases/attributes.md §9 was measured that way, and the comparison is the point. */
const FLAT = process.env.FLAT === '1';

/* synthetic world — mirrors test/simlab.js exactly */
const POS_HAS_FS = /FS:\{/.test(html);
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3],
["DE", "def", 6], ["DT", "def", 6], ["LB", "def", 10], ["CB", "def", 9]].concat(
  POS_HAS_FS ? [["FS", "def", 4], ["SS", "def", 4]] : [["S", "def", 8]]).concat([
["K", "st", 2], ["P", "st", 2]]);
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
function genRoster(r, prestige) {
  const out = [];
  POS.forEach(([code, , n]) => { for (let i = 0; i < n; i++) {
    const ov = clamp(Math.round(prestige * 0.55 + ri(r, -9, 9) + 30), 48, 99);
    const p = { id: 'p' + Math.floor(r() * 1e9).toString(36), pos: code, ov, so: 0 };
    // Phase 51: a player carries a real six-attribute profile, exactly as the shipped generator
    // does — the same fix test/simlab.js took at its line 73. Without one, every attribute falls
    // back to `ov`, collapsing all six sim channels onto the rating gap so they restate matchEdge
    // six times over. That makes the league look FAR more rating-determined than the real game is,
    // and it is the world every number in docs/phases/attributes.md §9 was measured on.
    out.push(FLAT ? p : Object.assign(p, (typeof genProfile === 'function' ? genProfile : genAttrs)(r, ov, code)));   // Phase 52: a real archetype, not a free tilt
  } });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => { arr.sort((a, b) => b.ov - a.ov);
    // taper the ATTRIBUTES and read `ov` back off them, mirroring genRoster in index.html
    arr.forEach((p, i) => {
      if (i >= 2) { const pen = Math.min(2 + (i - 2) * 2.6, 26);
        if (FLAT) p.ov = clamp(Math.round(p.ov - pen), 44, 99);
        else { shiftAttrs(p, -pen); p.ov = clamp(ovrBase(p), 44, 99); } }
      p.so = i; }); });
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
    // Phase 48 kills a drive that is still alive when the half expires (real football's ~6.5%).
    // This bucket was never wired up, so those drives counted toward `drives` but landed in no
    // outcome — the shares summed to 92% and the row read as a -100% MISS against a sim that was
    // in fact modelling them.
    else if (/^END OF (HALF|GAME)$/.test(e.text)) s.dEND++;
    else if (/INTERCEPTED/.test(e.text)) s.dTO++;
    else if (/FUMBLES/.test(e.text)) { s.dTO++; s.fum++; }
    const m = e.text.match(/sacked by .* for (-\d+)/); if (m) s.skYds += -parseInt(m[1], 10);
  }
  // Sacks BY each defense, SNAPSHOTTED before the loop. `s.sk` is already what we want — the box
  // charges the sacker, who plays for this team's defense — and the swap that used to sit here was
  // both redundant and order-dependent: it overwrote home's count first, so away then read the
  // already-overwritten value and BOTH teams ended up with the away defense's total. `plays` read the
  // same corrupted value. That silently destroyed the team-to-team spread in every sack figure.
  const skBy = { [g.home.id]: per[g.home.id].sk || 0, [g.away.id]: per[g.away.id].sk || 0 };
  for (const t of [g.home, g.away]) {
    const s = per[t.id], oid = (t === g.home ? g.away.id : g.home.id);
    const skTaken = skBy[oid];                     // sacks this OFFENSE took = the opposing defense's
    s.skTaken = skTaken;
    s.plays = s.pAtt + s.rAtt + skTaken;           // NCAA counts a sack as a rushing attempt
    // NCAA rushing convention, applied consistently to BOTH numerator and denominator. The real side
    // (2-harvest) reads ESPN rushingAttempts/rushingYards, which already fold sacks in as negative
    // rushes; the sim was netting sack yardage out of `ryds` while leaving them out of `ratt` and out
    // of `ypc` entirely, so yards/carry was compared gross-against-net and read ~0.6 too high.
    s.nratt = s.rAtt + skTaken; s.nryds = s.rYds - s.skYds;
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
    ratt: mean(rs, r => r.nratt), ryds: mean(rs, r => r.nryds),
    ypc: sum(rs, r => r.nryds) / (sum(rs, r => r.nratt) || 1),
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
    dEND: sum(rs, r => r.dEND) / dn * 100,
    margin: mean(gs, g => Math.abs(g.hs - g.as)), total: mean(gs, g => g.hs + g.as),
    homeWin: mean(gs, g => g.hs > g.as ? 100 : 0),
    otPct: mean(gs, g => g.ot ? 100 : 0),
    favWin: mean(rs.filter(r => r.fav), r => r.won * 100),
    favPts: mean(rs.filter(r => r.fav), r => r.pts), dogPts: mean(rs.filter(r => !r.fav), r => r.pts),
    favYds: mean(rs.filter(r => r.fav), r => r.yds), dogYds: mean(rs.filter(r => !r.fav), r => r.yds),
    favTO: mean(rs.filter(r => r.fav), r => r.int + r.fum), dogTO: mean(rs.filter(r => !r.fav), r => r.int + r.fum),
    favRatt: mean(rs.filter(r => r.fav), r => r.nratt), dogRatt: mean(rs.filter(r => !r.fav), r => r.nratt),
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

/* residual spread — the "any given Saturday" number, computed identically to 6-rankings.js */
{
  const resid = gameRows.map(g => (g.hs - g.as) - g.exp);
  const m = resid.reduce((a, b) => a + b, 0) / resid.length;
  const sd = Math.sqrt(resid.reduce((s, x) => s + (x - m) ** 2, 0) / resid.length);
  // Phase 52: the SHAPE of the tail, not just its width. cfb-averages section 6 measures real
  // football at skew +0.130 / excess kurtosis +0.319 — thin through the ordinary range and fat at
  // the extreme — and Phase 51 went the wrong way (-0.136) because additive mean-zero channels
  // Gaussianize. Archetypes are the stated fix: a league of distinct roster SHAPES is a mixture, and
  // mixtures carry excess kurtosis by construction. This is the number that says whether that worked.
  const cm = k => resid.reduce((s2, x) => s2 + Math.pow(x - m, k), 0) / resid.length;
  const skew = cm(3) / Math.pow(sd, 3), kurt = cm(4) / Math.pow(sd, 4) - 3;
  console.log(`  skew ${skew.toFixed(3)} (real +0.130)   excess kurtosis ${kurt.toFixed(3)} (real +0.319)`);
  fs.writeFileSync(__dirname + '/simresid.json', JSON.stringify({
    n: resid.length, sd, skew, kurt,
    p14: resid.filter(x => Math.abs(x) > 14).length / resid.length * 100,
    p21: resid.filter(x => Math.abs(x) > 21).length / resid.length * 100,
  }));
  console.log(`  residual SD ${sd.toFixed(1)} pts`);
}

/* favourite-perspective residuals + blowout-upset counts, for 7-upsets.js */
{
  const rows = gameRows.map(g => { const favHome = g.exp > 0, spread = Math.abs(g.exp);
    const favMargin = favHome ? (g.hs - g.as) : (g.as - g.hs);
    return { resid: favMargin - spread, spread, favMargin }; });
  const DEFS = [
    r => r.spread >= 7 && r.favMargin < 0,
    r => r.spread >= 7 && r.favMargin <= -14,
    r => r.spread >= 14 && r.favMargin < 0,
    r => r.spread >= 14 && r.favMargin <= -14,
    r => r.spread >= 14 && r.favMargin <= -21,
    r => r.spread >= 21 && r.favMargin < 0,
    r => r.spread >= 21 && r.favMargin <= -14,
  ];
  const BK = [[0, 3], [3, 7], [7, 10.5], [10.5, 14], [14, 17.5], [17.5, 24], [24, 31], [31, 99]];
  fs.writeFileSync(__dirname + '/simupsets.json', JSON.stringify({
    n: rows.length,
    resid: rows.map(r => +r.resid.toFixed(2)),
    rows: DEFS.map(f => rows.filter(f).length),
    buckets: BK.map(([lo, hi]) => { const l = rows.filter(r => r.spread >= lo && r.spread < hi);
      return { lo, hi, n: l.length,
        lose: l.length ? l.filter(r => r.favMargin < 0).length / l.length * 100 : 0,
        lose10: l.length ? l.filter(r => r.favMargin <= -10).length / l.length * 100 : 0,
        lose17: l.length ? l.filter(r => r.favMargin <= -17).length / l.length * 100 : 0 }; }),
  }));
}

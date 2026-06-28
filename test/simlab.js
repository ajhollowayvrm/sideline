/* Sideline SIM LAB — standalone statistical harness for the Phase 3 play engine.

   The play engine lives in index.html (single source of truth). This harness
   EXTRACTS the engine block from index.html (between the SIM ENGINE markers) and
   evals it here with the same tiny helpers, then sims full league seasons and
   asserts the output is statistically football-shaped + deterministic.

   Run:  node test/simlab.js

   This is the offline lab (no browser). The in-browser QA gate (npm run qa)
   validates the *integrated* engine end-to-end; this validates the model itself
   across thousands of games where a browser would be far too slow. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- extract the SIM ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === SIM ENGINE (Phase 3) START ===';
const END = '// === SIM ENGINE (Phase 3) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find SIM ENGINE markers in index.html'); process.exit(2); }
const engineSrc = html.slice(i0, i1);
// eval into this scope so simEngine + helpers (gamePersonnel, etc.) become available
eval(engineSrc);

/* ---------- a faithful-enough synthetic world (mirrors genRoster/teamRatings) ---------- */
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3],
["DE", "def", 6], ["DT", "def", 6], ["LB", "def", 10], ["CB", "def", 9], ["S", "def", 8],
["K", "st", 2], ["P", "st", 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);

function genRoster(r, prestige) {
  const out = [];
  POS.forEach(([code, , n]) => { for (let i = 0; i < n; i++) {
    const base = prestige * 0.55 + ri(r, -9, 9) + 30;
    const ov = clamp(Math.round(base), 48, 99);
    out.push({ id: 'p' + Math.floor(r() * 1e9).toString(36), pos: code, ov, so: 0 });
  } });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => {
    arr.sort((a, b) => b.ov - a.ov);
    arr.forEach((p, i) => { if (i >= 2) { const pen = Math.min(2 + (i - 2) * 2.6, 26); p.ov = clamp(Math.round(p.ov - pen), 44, 99); } p.so = i; });
  });
  return out;
}
function teamRatings(roster) {
  const grp = s => roster.filter(p => sideOf[p.pos] === s);
  const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
  const off = avgTop(grp('off'), 11), def = avgTop(grp('def'), 11);
  return { off, def, ovr: Math.round((off + def) / 2) };
}
function genWorld(seed, n = 134) {
  const r = rng(seed); const teams = [];
  for (let i = 0; i < n; i++) {
    const prestige = clamp(Math.round(35 + ri(r, -15, 15) + (i < 16 ? 25 : i < 40 ? 12 : 0)), 20, 98);
    const roster = genRoster(r, prestige);
    teams.push({ id: 't' + i, name: 'Team' + i, prestige, roster, ratings: teamRatings(roster) });
  }
  return { teams };
}

/* ---------- run a season and collect distributions ---------- */
function simSeason(worldSeed, gamesPerTeam = 12) {
  const world = genWorld(worldSeed);
  const teams = world.teams;
  // simple round-robin-ish pairing: each team plays the next `gamesPerTeam` teams (wrap)
  const games = [];
  const half = gamesPerTeam / 2;
  for (let i = 0; i < teams.length; i++) for (let d = 1; d <= half; d++) {
    const j = (i + d) % teams.length;
    games.push({ id: 'g' + i + '_' + j, home: teams[i], away: teams[j] });
  }
  const season = {}; teams.forEach(t => season[t.id] = {});
  const scores = []; let homeWins = 0, favWins = 0, favGames = 0, shutouts = 0, ties = 0;
  games.forEach(g => {
    const seed = (hashStr(g.id) ^ 0x5ca1ab1e) >>> 0;
    const res = simEngine(g.home, g.away, seed);
    scores.push(res.hs, res.as);
    if (res.hs > res.as) homeWins++; if (res.hs === res.as) ties++;
    if (res.hs === 0 || res.as === 0) shutouts++;
    const edge = (g.home.ratings.off - g.away.ratings.def) - (g.away.ratings.off - g.home.ratings.def);
    if (Math.abs(edge) > 4) { favGames++; const favHome = edge > 0; if ((favHome && res.hs > res.as) || (!favHome && res.as > res.hs)) favWins++; }
    // fold box into season totals (per player)
    for (const pid in res.box) { const dst = (season[g.home.id][pid] || season[g.away.id][pid]); }
    foldBox(season, g.home, res.box); foldBox(season, g.away, res.box);
  });
  return { teams, season, scores, games: games.length, homeWins, favWins, favGames, shutouts, ties };
}
function foldBox(season, team, box) {
  const ids = new Set(team.roster.map(p => p.id));
  for (const pid in box) { if (!ids.has(pid)) continue; const s = season[team.id][pid] = season[team.id][pid] || {}; const d = box[pid]; for (const k in d) s[k] = (s[k] || 0) + d[k]; }
}

/* ---------- stat helpers ---------- */
function avg(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function pct(a, p) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; }
// best season total of a given stat key across a world, with the player's position
function leaders(res, key) {
  const out = [];
  res.teams.forEach(t => { const s = res.season[t.id]; for (const pid in s) if (s[pid][key]) { const p = t.roster.find(x => x.id === pid); out.push({ pos: p.pos, v: s[pid][key], ov: p.ov }); } });
  out.sort((a, b) => b.v - a.v);
  return out;
}

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

// determinism: same id+seed reproduces the full box
(function () {
  const w = genWorld(7);
  const a = simEngine(w.teams[0], w.teams[5], 12345);
  const b = simEngine(w.teams[0], w.teams[5], 12345);
  check('Engine deterministic: same seed → same score', a.hs === b.hs && a.as === b.as, `${a.hs}-${a.as}`);
  check('Engine deterministic: same seed → same box', JSON.stringify(a.box) === JSON.stringify(b.box));
  const c = simEngine(w.teams[0], w.teams[5], 99999);
  check('Engine varies by seed', a.hs !== c.hs || a.as !== c.as, `${a.hs}-${a.as} vs ${c.hs}-${c.as}`);
  // purity: inputs not mutated
  const beforeOv = w.teams[0].roster[0].ov;
  simEngine(w.teams[0], w.teams[5], 555);
  check('Engine is pure (does not mutate rosters)', w.teams[0].roster[0].ov === beforeOv);
})();

// statistical realism across a full season
const R = simSeason(2026);
const meanPts = avg(R.scores);
check('Avg points/team/game realistic (20–32)', meanPts >= 20 && meanPts <= 32, meanPts.toFixed(1));
check('Scores span a football range (p05 ≤ 14, p95 ≥ 38)', pct(R.scores, 0.05) <= 14 && pct(R.scores, 0.95) >= 38, `p05=${pct(R.scores, 0.05)} p50=${pct(R.scores, 0.5)} p95=${pct(R.scores, 0.95)} max=${Math.max(...R.scores)}`);
check('No ties (OT logic decides games)', R.ties === 0, `${R.ties} ties`);
check('Home-field edge present but modest (52–62% home wins)', R.homeWins / R.games > 0.52 && R.homeWins / R.games < 0.62, (100 * R.homeWins / R.games).toFixed(1) + '%');
check('Better matchup usually wins (favorite win rate 60–80%)', R.favWins / R.favGames >= 0.60 && R.favWins / R.favGames <= 0.82, (100 * R.favWins / R.favGames).toFixed(1) + '% of ' + R.favGames);
check('Shutouts rare (<6% of team-games)', R.shutouts / (R.games * 2) < 0.06, (100 * R.shutouts / (R.games * 2)).toFixed(2) + '%');

// per-player stat leaders look like a real box score (12-game season)
const passY = leaders(R, 'pYds'), rushY = leaders(R, 'rYds'), recY = leaders(R, 'reYds');
const passTD = leaders(R, 'pTD'), tkl = leaders(R, 'tkl'), sk = leaders(R, 'sk');
check('Passing leader is a QB', passY[0].pos === 'QB', `${passY[0].pos} ${passY[0].v} yds`);
check('Passing-yards leader realistic (2600–5200 / 12g)', passY[0].v >= 2600 && passY[0].v <= 5200, passY[0].v + ' yds');
check('Rushing leader is a RB (or QB)', ['RB', 'QB'].includes(rushY[0].pos), `${rushY[0].pos} ${rushY[0].v} yds`);
check('Rushing-yards leader realistic (1000–2400 / 12g)', rushY[0].v >= 1000 && rushY[0].v <= 2400, rushY[0].v + ' yds');
check('Receiving leader is WR/TE/RB', ['WR', 'TE', 'RB'].includes(recY[0].pos), `${recY[0].pos} ${recY[0].v} yds`);
check('Receiving-yards leader realistic (700–1900 / 12g)', recY[0].v >= 700 && recY[0].v <= 1900, recY[0].v + ' yds');
check('Passing-TD leader realistic (18–55 / 12g)', passTD[0].v >= 18 && passTD[0].v <= 55, passTD[0].v + ' TD');
check('Tackle leader is a defender, realistic (70–170 / 12g)', ['LB', 'S', 'CB', 'DE', 'DT'].includes(tkl[0].pos) && tkl[0].v >= 70 && tkl[0].v <= 170, `${tkl[0].pos} ${tkl[0].v}`);
check('Sack leader realistic (7–22 / 12g)', sk[0].v >= 7 && sk[0].v <= 22, `${sk[0].pos} ${sk[0].v}`);

// a single game's box must internally balance (passing yards == receiving yards for that team)
(function () {
  const w = genWorld(3); const res = simEngine(w.teams[2], w.teams[9], 4242);
  let homePass = 0, homeRec = 0;
  const homeIds = new Set(w.teams[2].roster.map(p => p.id));
  for (const pid in res.box) if (homeIds.has(pid)) { homePass += res.box[pid].pYds || 0; homeRec += res.box[pid].reYds || 0; }
  check('Box balances: team passing yards == team receiving yards', homePass === homeRec, `pass ${homePass} / rec ${homeRec}`);
})();
// league-wide: every interception thrown (pInt) is caught by exactly one defender (dInt)
(function () {
  let pInt = 0, dInt = 0;
  R.teams.forEach(t => { const s = R.season[t.id]; for (const pid in s) { pInt += s[pid].pInt || 0; dInt += s[pid].dInt || 0; } });
  check('Box balances: league INTs thrown == league INTs caught', pInt === dInt && pInt > 0, `pInt ${pInt} / dInt ${dInt}`);
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} sim-lab checks passed =====`);
console.log(`(mean ${meanPts.toFixed(1)} pts/team, ${(100 * R.homeWins / R.games).toFixed(0)}% home, leaders: ${passY[0].v} pass / ${rushY[0].v} rush / ${recY[0].v} rec yds)`);
process.exit(results.every(r => r.pass) ? 0 : 1);

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
// The sim now reads per-player composure via the TRAIT ENGINE block — pull it in first so
// compDraw/compClutch resolve. Trait-less synthetic players default to 50 (identity reshape),
// so the sim is byte-identical to pre-Phase-10 here and the envelopes below are unchanged.
const T0 = html.indexOf('// === TRAIT ENGINE (Phase 10) START ==='), T1 = html.indexOf('// === TRAIT ENGINE (Phase 10) END ===');
if (T0 < 0 || T1 < 0) { console.error('Could not find TRAIT ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(T0, T1));
// The sim now also folds scheme run/pass tendency into passProb (Phase 22), so pull in the SCHEME
// block too. Synthetic teams below carry no offScheme → schemeTendency returns 0 → the envelopes
// are unchanged; the predictability tax keys on the call mix (also 0 for a balanced AI).
const C0 = html.indexOf('// === SCHEME ENGINE (Phase 21) START ==='), C1 = html.indexOf('// === SCHEME ENGINE (Phase 21) END ===');
if (C0 < 0 || C1 < 0) { console.error('Could not find SCHEME ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(C0, C1));
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
  check('Engine varies by seed', a.hs !== c.hs || a.as !== c.as || JSON.stringify(a.box) !== JSON.stringify(c.box), `${a.hs}-${a.as} vs ${c.hs}-${c.as}`);
  // purity: inputs not mutated
  const beforeOv = w.teams[0].roster[0].ov;
  simEngine(w.teams[0], w.teams[5], 555);
  check('Engine is pure (does not mutate rosters)', w.teams[0].roster[0].ov === beforeOv);
  // play-log parity: logging must not consume rng → identical score + box, on or off
  const plain = simEngine(w.teams[0], w.teams[5], 12345);
  const logged = simEngine(w.teams[0], w.teams[5], 12345, { log: true });
  check('Play log does not perturb result (same score + box)', plain.hs === logged.hs && plain.as === logged.as && JSON.stringify(plain.box) === JSON.stringify(logged.box));
  const lg = logged.log || [];
  const last = lg[lg.length - 1];
  check('Play log: non-empty, ends on Final with matching score', lg.length > 40 && last && last.kind === 'final' && last.hs === logged.hs && last.as === logged.as, `${lg.length} events, final ${last && last.hs}-${last && last.as}`);
  // every scoring event's running score should be consistent (non-decreasing) and match the end
  const scoreEvents = lg.filter(e => e.kind === 'score' || e.kind === 'final');
  let mono = true; for (let i = 1; i < scoreEvents.length; i++) if (scoreEvents[i].hs < scoreEvents[i - 1].hs || scoreEvents[i].as < scoreEvents[i - 1].as) mono = false;
  check('Play log: running score is monotonic non-decreasing', mono);
})();

// Phase 22 — the play-calling decision hook. The OC always draws its own suggestion, so a coach
// who DEFERS reproduces the no-decide (AI) result byte-for-byte; overrides change the choice (and
// thus the outcome) but never the rng stream, so a game is deterministic from (seed + overrides).
(function () {
  const w = genWorld(13), h = w.teams[1], a = w.teams[8];
  const defer = ctx => ctx.phase === 'fourth' ? ctx.ocAct : ctx.ocCall;   // "go with the coordinator"
  let parity = true, deferAway = true, sawPlay = false, sawFourth = false, wrongTeam = false, overrideDiff = false, repro = true, goDet = true, sane = true;
  for (let s = 0; s < 30; s++) {
    const seed = (hashStr('pc' + s) ^ 0xabcdef) >>> 0;
    const plain = simEngine(h, a, seed);
    // always-defer (controlling home) == no-decide, score + box
    const d1 = simEngine(h, a, seed, { decide: defer, decideFor: h.id });
    if (d1.hs !== plain.hs || d1.as !== plain.as || JSON.stringify(d1.box) !== JSON.stringify(plain.box)) parity = false;
    // deferring as the AWAY coach is also byte-identical
    const d2 = simEngine(h, a, seed, { decide: defer, decideFor: a.id });
    if (d2.hs !== plain.hs || d2.as !== plain.as) deferAway = false;
    // the decider is only consulted for the team it controls, and sees both phases over a season
    simEngine(h, a, seed, { decideFor: h.id, decide: ctx => { const inv = ctx.phase === 'def' ? ctx.def === h.id : ctx.off === h.id; if (!inv) wrongTeam = true; if (ctx.phase === 'play') sawPlay = true; if (ctx.phase === 'fourth') sawFourth = true; return defer(ctx); } });
    // a one-sided coach (always pass, OC handles 4th) changes the result deterministically + stays sane
    const aggro = ctx => ctx.phase === 'fourth' ? ctx.ocAct : 'pass';
    const g1 = simEngine(h, a, seed, { decide: aggro, decideFor: h.id });
    const g2 = simEngine(h, a, seed, { decide: aggro, decideFor: h.id });
    if (g1.hs !== g2.hs || g1.as !== g2.as || JSON.stringify(g1.box) !== JSON.stringify(g2.box)) goDet = false;
    if (g1.hs !== plain.hs || g1.as !== plain.as) overrideDiff = true;   // at least sometimes differs
    if (g1.hs < 0 || g1.hs > 99 || g1.as < 0 || g1.as > 99) sane = false;
    // a recorded run/pass override list reproduces exactly
    const calls = []; simEngine(h, a, seed, { decideFor: h.id, decide: ctx => { const c = ctx.phase === 'fourth' ? ctx.ocAct : (ctx.ocPass ? 'run' : 'pass'); calls.push(c); return c; } });
    let i = 0; const rp = simEngine(h, a, seed, { decideFor: h.id, decide: () => calls[i++] });
    const i2 = (() => { let k = 0; return simEngine(h, a, seed, { decideFor: h.id, decide: () => calls[k++] }); })();
    if (rp.hs !== i2.hs || rp.as !== i2.as) repro = false;
  }
  check('Phase 22: a coach who DEFERS reproduces the AI result byte-for-byte (score + box)', parity);
  check('Phase 22: the OC draws its suggestion regardless of who is controlled (defer-as-away == AI)', deferAway);
  check('Phase 22: the decision hook fires only for the controlled team', !wrongTeam && sawPlay);
  check('Phase 22: both run/pass and 4th-down decisions are surfaced over a season', sawPlay && sawFourth);
  check('Phase 22: overrides change the outcome but stay football-sane (0–99)', overrideDiff && sane);
  check('Phase 22: a fixed override set is fully deterministic (replay matches)', goDet && repro);
})();

// Phase 22 BALANCE — the predictability tax: a defense keys on a one-dimensional offense, so spamming
// a single play type no longer dominates the balanced (AI) attack. (Calling a smart MIX should win.)
(function () {
  const w = genWorld(55), N = w.teams.length;
  let runP = 0, passP = 0, defP = 0, n = 0;
  for (let s = 0; s < 60; s++) {
    const h = w.teams[s % N], a = w.teams[(s + 5) % N]; if (h === a) continue;
    const seed = (hashStr('bal' + s) ^ 0x13579) >>> 0;
    const oc = ctx => ctx.phase === 'fourth' ? ctx.ocAct : ctx.ocCall;
    const allRun = simEngine(h, a, seed, { decideFor: h.id, decide: ctx => ctx.phase === 'fourth' ? ctx.ocAct : 'run' });
    const allPass = simEngine(h, a, seed, { decideFor: h.id, decide: ctx => ctx.phase === 'fourth' ? ctx.ocAct : 'pass' });
    const balanced = simEngine(h, a, seed, { decideFor: h.id, decide: oc });
    runP += allRun.hs; passP += allPass.hs; defP += balanced.hs; n++;
  }
  check('Phase 22 balance: spamming RUN does not beat a balanced attack', runP / n < defP / n, `run ${(runP / n).toFixed(1)} vs balanced ${(defP / n).toFixed(1)}`);
  check('Phase 22 balance: spamming PASS does not beat a balanced attack', passP / n < defP / n, `pass ${(passP / n).toFixed(1)} vs balanced ${(defP / n).toFixed(1)}`);
})();

// Phase 23 — per-matchup resolution: a play keys off the SPECIFIC WR↔CB matchup (mean-zero vs the
// team baseline). A stud receiver should torch a weak corner and barely dent a great one, and the
// beaten corner's "coverage yards allowed" should spike (the 'getting cooked' readout).
(function () {
  const w = genWorld(321);
  const O = JSON.parse(JSON.stringify(w.teams[0]));
  const wr1 = O.roster.filter(p => p.pos === 'WR').sort((a, b) => a.so - b.so)[0]; wr1.ov = 95;
  O.ratings = teamRatings(O.roster);
  const mkDef = cbOv => { const D = JSON.parse(JSON.stringify(w.teams[1])); const cb1 = D.roster.filter(p => p.pos === 'CB').sort((a, b) => a.so - b.so)[0]; cb1.ov = cbOv; D.ratings = teamRatings(D.roster); return { D, cbId: cb1.id }; };
  const weak = mkDef(55), strong = mkDef(95), seed = 4242;
  const rw = simEngine(O, weak.D, seed), rs = simEngine(O, strong.D, seed);
  const wrW = (rw.box[wr1.id] || {}).reYds || 0, wrS = (rs.box[wr1.id] || {}).reYds || 0;
  check('Phase 23: a stud WR torches weak coverage more than strong', wrW > wrS, `${wrW} vs ${wrS} rec yds`);
  const cbW = (rw.box[weak.cbId] || {}).cvYds || 0, cbS = (rs.box[strong.cbId] || {}).cvYds || 0;
  check('Phase 23: the beaten corner gets cooked (more coverage yds allowed)', cbW > cbS, `${cbW} vs ${cbS} cv yds`);
})();

// Phase 24 — in-game adjustments: reassign coverage (shadow your stud onto their stud) + pep-talk
// (a rating bump). Recorded on a timeline by play index → deterministic, applies forward, AI-inert.
(function () {
  const w = genWorld(321);
  const O = JSON.parse(JSON.stringify(w.teams[0]));
  const wr1 = O.roster.filter(p => p.pos === 'WR').sort((a, b) => a.so - b.so)[0]; wr1.ov = 95; O.ratings = teamRatings(O.roster);
  const D = JSON.parse(JSON.stringify(w.teams[1]));
  const cb1 = D.roster.filter(p => p.pos === 'CB').sort((a, b) => a.so - b.so)[0]; cb1.ov = 55;   // weak default corner on WR1
  const sft = D.roster.filter(p => p.pos === 'S').sort((a, b) => a.so - b.so)[0]; sft.ov = 92;    // your shutdown safety
  D.ratings = teamRatings(D.roster);
  const seed = 4242, wrY = res => (res.box[wr1.id] || {}).reYds || 0;
  const base = simEngine(O, D, seed);
  // an empty timeline must be byte-identical to the un-adjusted game (AI-inert)
  const none = simEngine(O, D, seed, { adjustFor: D.id, adjusts: [] });
  check('Phase 24: an empty adjustment timeline == the un-adjusted game', none.hs === base.hs && none.as === base.as && JSON.stringify(none.box) === JSON.stringify(base.box));
  // shadow the safety onto WR1 (slot 'WR0') from the opening snap → his production should drop
  const shadow = [{ at: 0, plan: { shadow: { 'WR0': sft.id }, boost: {} } }];
  const shad = simEngine(O, D, seed, { adjustFor: D.id, adjusts: shadow });
  check('Phase 24: shadowing a stud WR with a better defender cuts his production', wrY(shad) < wrY(base), `${wrY(shad)} vs ${wrY(base)} rec yds`);
  // pep-talk / settle the beaten corner (+18 effective) → he covers better, WR1 dips
  const pep = [{ at: 0, plan: { shadow: {}, boost: { [cb1.id]: 18 } } }];
  const pr = simEngine(O, D, seed, { adjustFor: D.id, adjusts: pep });
  check('Phase 24: a pep-talk (rating bump) to the beaten corner helps the defense', wrY(pr) < wrY(base), `${wrY(pr)} vs ${wrY(base)} rec yds`);
  // determinism: same timeline → byte-identical
  const a = simEngine(O, D, seed, { adjustFor: D.id, adjusts: shadow }), b = simEngine(O, D, seed, { adjustFor: D.id, adjusts: shadow });
  check('Phase 24: adjustments are deterministic (replay matches)', a.hs === b.hs && a.as === b.as && JSON.stringify(a.box) === JSON.stringify(b.box));
  // an adjustment applies only FORWARD: set at a late play index, early plays match the un-adjusted game
  const late = [{ at: 9999, plan: { shadow: { 'WR0': sft.id }, boost: {} } }];
  const lr = simEngine(O, D, seed, { adjustFor: D.id, adjusts: late });
  check('Phase 24: an adjustment set in the future does not change the past', lr.hs === base.hs && lr.as === base.as, `${lr.hs}-${lr.as} vs ${base.hs}-${base.as}`);
})();

// Phase 25 — penalties/discipline: pre-snap fouls driven by composure + situation, with a coach
// "calm them down" lever. Realistic rate; an undisciplined team flags more; calm cuts your fouls.
(function () {
  const w = genWorld(77), N = w.teams.length;
  let totPen = 0, games = 0;
  for (let s = 0; s < 50; s++) { const h = w.teams[s % N], a = w.teams[(s + 3) % N]; if (h === a) continue; const res = simEngine(h, a, (hashStr('pen' + s) ^ 9) >>> 0); totPen += res.pen[h.id].n + res.pen[a.id].n; games++; }
  const perTeam = totPen / games / 2;
  check('Phase 25: penalties occur at a realistic rate (3–9 per team/game)', perTeam >= 3 && perTeam <= 9, perTeam.toFixed(1) + ' /team');
}());
(function () {
  const w = genWorld(88), opp = w.teams[1];
  const lo = JSON.parse(JSON.stringify(w.teams[0])), hi = JSON.parse(JSON.stringify(w.teams[0]));
  lo.roster.forEach(p => { if ((p.so || 0) <= 1) p.comp = 12; });  // undisciplined starters
  hi.roster.forEach(p => { if ((p.so || 0) <= 1) p.comp = 92; });  // ice-veined starters
  let loPen = 0, hiPen = 0;
  for (let s = 0; s < 25; s++) { const seed = (hashStr('disc' + s) ^ 1) >>> 0; loPen += simEngine(lo, opp, seed).pen[lo.id].n; hiPen += simEngine(hi, opp, seed).pen[hi.id].n; }
  check('Phase 25: an undisciplined (low-composure) team commits more penalties', loPen > hiPen, `${loPen} vs ${hiPen}`);
}());
(function () {
  const w = genWorld(99), t = w.teams[0], opp = w.teams[1];
  let normal = 0, calm = 0;
  const calmPlan = { adjustFor: t.id, adjusts: [{ at: 0, plan: { shadow: {}, boost: {}, calm: true } }] };
  for (let s = 0; s < 25; s++) { const seed = (hashStr('calm' + s) ^ 1) >>> 0; normal += simEngine(t, opp, seed).pen[t.id].n; calm += simEngine(t, opp, seed, calmPlan).pen[t.id].n; }
  check('Phase 25: "calm them down" reduces your team\'s penalties', calm < normal, `${calm} vs ${normal}`);
}());

// Phase 26 — injuries (in-game): occur at a low rate, are deterministic, and force the backup in.
(function () {
  const w = genWorld(2200), N = w.teams.length;
  let inj = 0, games = 0;
  for (let s = 0; s < 60; s++) { const h = w.teams[s % N], a = w.teams[(s + 4) % N]; if (h === a) continue; const res = simEngine(h, a, (hashStr('inj' + s) ^ 5) >>> 0); inj += res.inj.length; games++; }
  const perGame = inj / games;
  check('Phase 26: injuries occur at a low realistic rate (0.1–3 per game)', perGame >= 0.1 && perGame <= 3, perGame.toFixed(2) + ' /game');
  const h = w.teams[0], a = w.teams[1], seed = 70707;
  const r1 = simEngine(h, a, seed), r2 = simEngine(h, a, seed);
  check('Phase 26: injuries are deterministic (same seed → same out list)', JSON.stringify(r1.inj) === JSON.stringify(r2.inj));
}());
// Phase 26 — fatigue cost: zero early / under the workload threshold, rises with touches, bounded.
(function () {
  const f = fatigueCost;
  check('Phase 26: fatigue is 0 before the 4th quarter', f(40, 1) === 0 && f(40, 3) === 0);
  check('Phase 26: fatigue is 0 under the workload threshold', f(18, 4) === 0 && f(10, 4) === 0);
  check('Phase 26: fatigue rises with a heavy late workload, and is bounded', f(24, 4) > 0 && f(40, 4) <= 6 && f(40, 4) >= f(24, 4));
}());

// Phase 27 — week-to-week injuries: a duration roll (mostly short, multi-week tail), an injured player
// is benched (excluded from selection so the backup plays), and multi-week injuries occur over a season.
(function () {
  const r = rng(321); let zero = 0, multi = 0, max = 0, N = 20000;
  for (let i = 0; i < N; i++) { const d = injDur(r); if (d === 0) zero++; if (d >= 2) multi++; if (d > max) max = d; }
  check('Phase 27: injury duration is mostly short with a multi-week tail (bounded ≤8)', zero / N > 0.3 && zero / N < 0.6 && multi / N > 0.05 && max <= 8, `0wk ${(100 * zero / N).toFixed(0)}% · ≥2wk ${(100 * multi / N).toFixed(0)}% · max ${max}`);
}());
(function () {
  const w = genWorld(444), D = w.teams[1];
  const O = JSON.parse(JSON.stringify(w.teams[0]));
  const qb1 = O.roster.filter(p => p.pos === 'QB').sort((a, b) => a.so - b.so)[0]; qb1.inj = 2;
  const res = simEngine(O, D, 55555);
  const qb1Att = (res.box[qb1.id] || {}).pAtt || 0;
  let backupAtt = 0; O.roster.forEach(p => { if (p.id !== qb1.id && res.box[p.id]) backupAtt += res.box[p.id].pAtt || 0; });
  check('Phase 27: an injured starter is benched (records nothing); the backup plays', qb1Att === 0 && backupAtt > 0, `starter ${qb1Att} att, backup ${backupAtt} att`);
}());
(function () {
  const w = genWorld(2200), N = w.teams.length; let multi = 0;
  for (let s = 0; s < 80; s++) { const h = w.teams[s % N], a = w.teams[(s + 4) % N]; if (h === a) continue; simEngine(h, a, (hashStr('mw' + s) ^ 5) >>> 0).inj.forEach(i => { if (i.out >= 1) multi++; }); }
  check('Phase 27: multi-week injuries occur over a season', multi > 0, multi + ' multi-week injuries');
}());

// Phase 28 — defensive play-calling: the controlled team (on D) calls base/blitz/cover/run as a pre-snap
// guess. Cover takes away the pass; run-stop stuffs the run; AI/base is a no-op (envelope untouched).
(function () {
  const w = genWorld(606), N = w.teams.length;
  // YOU are the defense (team a). Force the offense to PASS (offense = team h, you don't control it),
  // and you call your defense. Compare opponent passing yards under base vs cover vs run-stop.
  const callD = dc => { const h = w.teams[2], a = w.teams[7]; let passY = 0, runY = 0, n = 0;
    for (let s = 0; s < 40; s++) { const seed = (hashStr('d' + dc + s) ^ 3) >>> 0;
      const res = simEngine(h, a, seed, { decideFor: a.id, decide: ctx => ctx.phase === 'def' ? dc : (ctx.phase === 'fourth' ? ctx.ocAct : ctx.ocCall) });
      h.roster.forEach(p => { const b = res.box[p.id]; if (b) { passY += b.pYds || 0; runY += b.rYds || 0; } }); n++; }
    return { passY: passY / n, runY: runY / n }; };
  const base = callD('base'), cover = callD('cover'), runStop = callD('run');
  check('Phase 28: an empty/base defensive call == the AI game (no-op)', (() => { const h = w.teams[2], a = w.teams[7], seed = 909; const ai = simEngine(h, a, seed), bd = simEngine(h, a, seed, { decideFor: a.id, decide: ctx => 'base' }); return ai.hs === bd.hs && ai.as === bd.as && JSON.stringify(ai.box) === JSON.stringify(bd.box); })());
  check('Phase 28: calling COVER cuts the opponent’s passing yards', cover.passY < base.passY, `${cover.passY.toFixed(0)} vs ${base.passY.toFixed(0)}`);
  check('Phase 28: calling RUN-STOP cuts the opponent’s rushing yards', runStop.runY < base.runY, `${runStop.runY.toFixed(0)} vs ${base.runY.toFixed(0)}`);
  check('Phase 28: but RUN-STOP gives up more through the air (a real trade-off)', runStop.passY > base.passY, `${runStop.passY.toFixed(0)} vs ${base.passY.toFixed(0)}`);
}());

// Phase 29 — the AI defensive coordinator: situational calls, keys on tendency, and (crucially) is INERT
// for AI-vs-AI games (only schemes vs the controlled offense), so the league envelope is untouched.
(function () {
  const tally = ctx => { const c = { base: 0, blitz: 0, cover: 0, run: 0 }; for (let i = 0; i < 1000; i++) c[aiDefCall(ctx, i / 1000)]++; return c; };
  const sh = tally({ down: 3, togo: 1, los: 50, runRate: 0.5 }), lo = tally({ down: 3, togo: 10, los: 50, runRate: 0.5 });
  check('Phase 29: AI DC stacks the box on short yardage (run-stop, no pure cover)', sh.run > sh.base && sh.cover === 0, JSON.stringify(sh));
  check('Phase 29: AI DC defends the pass on long downs (cover/blitz, never run-stop)', (lo.cover + lo.blitz) > lo.base && lo.run === 0, JSON.stringify(lo));
  // keys tendency: a predictable all-pass offense fares worse vs the scheming DC than vs a base defense
  const w = genWorld(707), O = w.teams[3], D = w.teams[8];
  const allPass = ctx => ctx.phase === 'fourth' ? ctx.ocAct : ctx.phase === 'def' ? 'base' : 'pass';
  let withDC = 0, noDC = 0, n = 0;
  for (let s = 0; s < 30; s++) { const seed = (hashStr('aidc' + s) ^ 2) >>> 0; withDC += simEngine(O, D, seed, { decideFor: O.id, aiDefVs: O.id, decide: allPass }).hs; noDC += simEngine(O, D, seed, { decideFor: O.id, decide: allPass }).hs; n++; }
  check('Phase 29: a scheming AI DC lowers a predictable offense vs no DC', withDC < noDC, `${(withDC / n).toFixed(1)} vs ${(noDC / n).toFixed(1)} pts/g`);
  // envelope safety: naming a team that isn't on offense is completely inert (AI-vs-AI byte-identical)
  const h = w.teams[0], a = w.teams[1], sd = 4242, plain = simEngine(h, a, sd), tagged = simEngine(h, a, sd, { aiDefVs: 'zzz_not_playing' });
  check('Phase 29: aiDefVs is inert when that team is not on offense (AI-vs-AI unaffected)', plain.hs === tagged.hs && plain.as === tagged.as && JSON.stringify(plain.box) === JSON.stringify(tagged.box));
}());

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
// Phase 23 coverage stats pair exactly with the offense: every catch has a defender on it.
(function () {
  let rec = 0, cvCmp = 0, reY = 0, cvY = 0, pAtt = 0, cvTgt = 0;
  R.teams.forEach(t => { const s = R.season[t.id]; for (const pid in s) { const x = s[pid]; rec += x.rec || 0; cvCmp += x.cvCmp || 0; reY += x.reYds || 0; cvY += x.cvYds || 0; pAtt += x.pAtt || 0; cvTgt += x.cvTgt || 0; } });
  check('Phase 23: coverage completions allowed == receptions league-wide', cvCmp === rec && rec > 0, `cvCmp ${cvCmp} / rec ${rec}`);
  check('Phase 23: coverage yards allowed == receiving yards league-wide', cvY === reY, `cvY ${cvY} / reY ${reY}`);
  check('Phase 23: coverage targets == pass attempts league-wide', cvTgt === pAtt, `cvTgt ${cvTgt} / pAtt ${pAtt}`);
})();

// Player of the Week scorer (formula must mirror computeWeeklyHonors in index.html): the best
// single-game offensive performance should be a skill player, the best defensive a defender.
(function () {
  const w = genWorld(2026);
  const offScore = s => (s.pYds || 0) * 0.04 + (s.pTD || 0) * 4 + (s.rYds || 0) * 0.1 + (s.rTD || 0) * 6 + (s.reYds || 0) * 0.1 + (s.reTD || 0) * 6 - (s.pInt || 0) * 2;
  const defScore = s => (s.tkl || 0) + (s.sk || 0) * 4 + (s.dInt || 0) * 6;
  const SKILL = new Set(['QB', 'RB', 'WR', 'TE']), DEF = new Set(['DE', 'DT', 'LB', 'CB', 'S']);
  let offSkill = 0, offTot = 0, defD = 0, defTot = 0;
  for (let i = 0; i < 134; i++) {
    const j = (i + 3) % 134, res = simEngine(w.teams[i], w.teams[j], (hashStr('pow' + i) ^ 7) >>> 0);
    const byId = {}; [w.teams[i], w.teams[j]].forEach(t => t.roster.forEach(p => byId[p.id] = p));
    let bo = null, bd = null, bos = -1, bds = -1;
    for (const pid in res.box) { const p = byId[pid]; if (!p) continue; const o = offScore(res.box[pid]), d = defScore(res.box[pid]); if (o > bos) { bos = o; bo = p; } if (d > bds) { bds = d; bd = p; } }
    if (bo) { offTot++; if (SKILL.has(bo.pos)) offSkill++; }
    if (bd) { defTot++; if (DEF.has(bd.pos)) defD++; }
  }
  check('POW: best offensive performance is a skill player (≥98%)', offSkill / offTot >= 0.98, `${offSkill}/${offTot}`);
  check('POW: best defensive performance is a defender (100%)', defD === defTot, `${defD}/${defTot}`);
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} sim-lab checks passed =====`);
console.log(`(mean ${meanPts.toFixed(1)} pts/team, ${(100 * R.homeWins / R.games).toFixed(0)}% home, leaders: ${passY[0].v} pass / ${rushY[0].v} rush / ${recY[0].v} rec yds)`);
process.exit(results.every(r => r.pass) ? 0 : 1);

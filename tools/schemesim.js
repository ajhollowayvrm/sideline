/* Sideline SCHEME SIM — build teams with real offensive and defensive IDENTITIES, install schemes
   on them, and play actual games.

   The question this answers: with Phase 51 shipped, what does a SCHEME actually DO to a game? The
   shipped sim has exactly three scheme levers and they live in three different places, which makes
   the net effect impossible to reason about from the source:

     1. the rock-paper-scissors MATCHUP edge (SCHEME_EDGE, ±3 rating pts) — applied OUTSIDE
        simEngine, by simSides in the app layer. This harness mirrors that application exactly.
     2. ROSTER RE-RATING — `p.ov = ovrIn(p, scheme)` (index.html:626). Installing a scheme re-weights
        every player's attributes, so the same roster is worth a different number of rating points in
        a different system. This is where Phase 51 moved roster fit to, after retiring the old
        team-level fit term from schemeDelta (it was being counted twice).
     3. PLAY MIX — schemeTendency shifts passProb inside simEngine. Air Raid airs it out, Smashmouth
        grinds. Mean-zero across the catalog, so it moves selection and not the scoring envelope.

   Lever 2 is the interesting one and the only one that depends on WHO IS ON THE ROSTER, so the
   teams here are built as attribute SHAPES: ten identities (5 offensive, 5 defensive) whose tilts
   mirror what SCHEME_ATTR_W says each system actually selects for. Every team is re-centred to the
   SAME `ovrBase` — identical scheme-agnostic talent, different shape — so nothing below can be
   explained by one side simply having better players.

   Note on what is NOT in here: a player's PREFERRED scheme (`p.scm`/playerSchemeIdx) no longer
   reaches the sim at all. Phase 51 made it preference rather than aptitude — a fogged chip on the
   roster screen. So it is deliberately left at its id-derived default; setting it would change
   nothing and pretending otherwise would make this harness lie.

   Run:  node tools/schemesim.js            (default sizing, ~2-3 min, ~60k games)
         GAMES=200 node tools/schemesim.js  (games per matrix cell)
         ONLY=C node tools/schemesim.js     (run one experiment: A, B, C or D)  */

const fs = require('fs');
const path = require('path');

/* ---------- helpers that index.html's blocks close over (must match it exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* roster shape — mirrors test/simlab.js and tools/cfb-data/4-simprofile.js */
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3],
["DE", "def", 6], ["DT", "def", 6], ["LB", "def", 10], ["CB", "def", 9], ["S", "def", 8],
["K", "st", 2], ["P", "st", 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);

/* ---------- extract the engine blocks from index.html (single source of truth) ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const grab = (a, b) => {
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < 0) { console.error('Could not find markers: ' + a); process.exit(2); }
  return html.slice(i, j);
};
// Direct sloppy-mode eval leaks `function` declarations into this scope but NOT block-scoped
// `const`s, so each block appends an explicit export of the constants asserted on below.
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
const SCH = eval(grab('// === SCHEME ENGINE (Phase 21) START ===', '// === SCHEME ENGINE (Phase 21) END ===')
  + '\n;({OFF_SCHEMES,DEF_SCHEMES,SCHEME_EDGE,SCHEME_TENDENCY});');
const ATT = eval(grab('// === ATTRIBUTE ENGINE (Phase 51) START ===', '// === ATTRIBUTE ENGINE (Phase 51) END ===')
  + '\n;({ATTRS,POS_ATTR_W,SCHEME_ATTR_W});');
eval(grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ==='));
const { OFF_SCHEMES, DEF_SCHEMES, SCHEME_EDGE } = SCH;
const { ATTRS } = ATT;

const GAMES = parseInt(process.env.GAMES || '0', 10);
const ONLY = (process.env.ONLY || '').toUpperCase();
const run = k => !ONLY || ONLY.indexOf(k) >= 0;

/* ================================================================================
   TEAM IDENTITIES — attribute shapes, not talent levels
   ================================================================================
   Each identity is a per-position tilt in raw attribute points. They are deliberately pointed the
   same way as SCHEME_ATTR_W's deviations, because the whole claim under test is "installing a
   scheme re-rates the roster that runs it" — that is only meaningful if a roster can be built to
   suit a system in the first place. Tilts are applied BEFORE re-centring, so they cost what they
   buy: an Air Raid tackle trades raw power for the awareness to pass-set. */
const OFF_ID = {
  'Air Raid': { QB: { awr: 6, bal: 4, str: -6 }, WR: { spd: 4, agi: 8, bal: 6, str: -8 },
    OT: { awr: 8, str: -8 }, OG: { awr: 8, str: -8 }, C: { awr: 8, str: -8 },
    RB: { bal: 5, agi: 4, str: -6 }, TE: { bal: 6, agi: 4, str: -8 } },
  'Smashmouth': { OT: { str: 10, agi: -6, awr: -5 }, OG: { str: 10, agi: -6, awr: -5 }, C: { str: 10, agi: -6, awr: -5 },
    RB: { str: 10, bal: 4, spd: -8, agi: -6 }, TE: { str: 10, bal: -6, spd: -5 },
    WR: { str: 8, bal: 4, spd: -7, agi: -5 }, QB: { str: 4, awr: 2, spd: -4 } },
  'Spread-Option': { QB: { spd: 12, agi: 8, awr: -12, bal: -6 },
    OT: { agi: 10, str: -10 }, OG: { agi: 10, str: -10 }, C: { agi: 10, str: -10 },
    RB: { spd: 8, agi: 5, str: -9 }, WR: { spd: 6, str: -6 }, TE: { agi: 6, str: -6 } },
  'West Coast': { QB: { awr: 8, bal: 4, str: -8 }, WR: { agi: 10, bal: 6, spd: -12 },
    TE: { bal: 6, awr: 4, str: -8 }, RB: { agi: 6, bal: 4, spd: -8 } },
  'Pro Style': {},   // the control — no tilt at all
};
const DEF_ID = {
  'Bear': { DT: { str: 10, awr: -8 }, DE: { spd: 8, str: 2, awr: -8 },
    CB: { agi: 10, spd: 6, awr: -10, bal: -6 }, LB: { str: 6, spd: 2, awr: -7 } },
  'Tampa-2': { LB: { spd: 10, agi: 6, str: -12 }, CB: { awr: 10, bal: 4, spd: -7, agi: -6 },
    S: { awr: 8, bal: 3, spd: -9 } },
  'Nickel/Cover-3': { CB: { awr: 10, bal: 6, spd: -8, agi: -8 }, S: { awr: 8, bal: 4, str: -10 },
    LB: { awr: 6, spd: 2, str: -7 } },
  '3-4': { DT: { str: 10, agi: -8 }, LB: { awr: 8, str: 3, spd: -9 }, DE: { str: 8, awr: 2, spd: -8 } },
  '4-3': {},         // the control
};

/* ---------- one player: target ability, identity shape, exact re-centring ---------- */
/* Player ids are deterministic from (tag, pos, index) rather than a counter, so two rosters built
   with the same tag and seed are PAIRED — identical base draws, identical ids, differing only by the
   identity tilt. That is what lets experiment D subtract a control cleanly. Two rosters sharing a tag
   must never meet in a game (the box score is keyed by player id); nothing here lets them. */
function mkPlayer(r, pos, idx, tag, target, tilt) {
  const p = { id: tag + '-' + pos + idx, pos, so: 0 };
  // a small natural spread on top of the identity, so a team is not eleven clones
  Object.assign(p, genAttrs(r, target, pos, 7));
  const t = (tilt || {})[pos];
  if (t) for (const k in t) p[k] = clamp(Math.round(p[k] + t[k]), 40, 99);
  // Re-centre onto the target. Iterated because clamping at 40/99 eats part of the correction —
  // the same defect Phase 52's prototype found in its own generator (attributes-2.md §7).
  for (let i = 0; i < 6 && Math.abs(ovrBase(p) - target) > 0; i++) centerAttrs(p, target, pos);
  p.ov = ovrBase(p);
  return p;
}
/* A full roster at ONE ability level, so every team in this harness is exactly as good as every
   other and only the SHAPE differs. Depth taper mirrors genRoster in index.html: starters (so 0-1)
   untouched, so top-11 ratings sit exactly on the target. */
function mkRoster(r, target, offTilt, defTilt, tag) {
  const out = [];
  POS.forEach(([code, side, n]) => { for (let i = 0; i < n; i++) out.push(mkPlayer(r, code, i, tag, target, side === 'off' ? offTilt : side === 'def' ? defTilt : null)); });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => {
    arr.sort((a, b) => b.ov - a.ov);
    arr.forEach((p, i) => {
      if (i >= 2) { shiftAttrs(p, -Math.min(2 + (i - 2) * 2.6, 26)); p.ov = clamp(ovrBase(p), 44, 99); }
      p.so = i;
    });
  });
  return out;
}
function teamRatings(roster) {
  const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
  const off = avgTop(roster.filter(p => sideOf[p.pos] === 'off'), 11);
  const def = avgTop(roster.filter(p => sideOf[p.pos] === 'def'), 11);
  return { off, def, ovr: Math.round((off + def) / 2) };
}
/* Install schemes exactly as the game does (index.html:626): every player's OVERALL is re-read
   through the system he plays in, then team ratings are recomputed off those. This IS lever 2. */
function install(team, offScheme, defScheme) {
  team.offScheme = offScheme; team.defScheme = defScheme;
  team.roster.forEach(p => { const s = sideOf[p.pos]; p.ov = ovrIn(p, s === 'off' ? offScheme : s === 'def' ? defScheme : null); });
  team.ratings = teamRatings(team.roster);
  return team;
}
function mkTeam(id, name, seed, target, offIdName, defIdName, offScheme, defScheme, tag) {
  const r = rng(seed >>> 0);
  const t = { id, name, roster: mkRoster(r, target, OFF_ID[offIdName], DEF_ID[defIdName], tag || id), offId: offIdName, defId: defIdName };
  return install(t, offScheme, defScheme);
}

/* ---------- play a game, applying the scheme RPS edge the way simSides does ---------- */
function playGame(home, away, seed, wantLog) {
  // simSides: hOff gets the edge for HOME's offense vs AWAY's defense, and vice versa. The defensive
  // half of schemeDelta is 0 since Phase 51 retired the roster-fit term from it.
  const withR = (t, o) => Object.assign({}, t, { ratings: { off: clamp(t.ratings.off + o, 40, 99), def: t.ratings.def, ovr: t.ratings.ovr } });
  const H = withR(home, schemeEdge(home.offScheme, away.defScheme));
  const A = withR(away, schemeEdge(away.offScheme, home.defScheme));
  const res = simEngine(H, A, seed >>> 0, wantLog ? { log: true } : {});
  return res;
}
function tally(res, t) {
  const ids = new Set(t.roster.map(p => p.id));
  const s = { pAtt: 0, pCmp: 0, pYds: 0, rAtt: 0, rYds: 0, sk: 0, int: 0, fga: 0, fgm: 0 };
  for (const pid in res.box) {
    if (!ids.has(pid)) continue; const b = res.box[pid];
    s.pAtt += b.pAtt || 0; s.pCmp += b.pCmp || 0; s.pYds += b.pYds || 0;
    s.rAtt += b.rAtt || 0; s.rYds += b.rYds || 0; s.sk += b.sk || 0; s.int += b.pInt || 0;
    s.fga += b.fga || 0; s.fgm += b.fgm || 0;
  }
  return s;
}
/* Play a home-and-home so home-field cancels exactly, and return both teams' lines. */
function series(a, b, seed) {
  const out = [];
  const g1 = playGame(a, b, seed), g2 = playGame(b, a, (seed ^ 0x9e3779b9) >>> 0);
  out.push({ a: Object.assign({ pts: g1.hs }, tally(g1, a)), b: Object.assign({ pts: g1.as }, tally(g1, b)) });
  out.push({ a: Object.assign({ pts: g2.as }, tally(g2, a)), b: Object.assign({ pts: g2.hs }, tally(g2, b)) });
  return out;
}
const mean = a => a.reduce((t, x) => t + x, 0) / (a.length || 1);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) * (x - m)))); };
const f1 = x => (x >= 0 ? '+' : '') + x.toFixed(1);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

console.log('SIDELINE SCHEME SIM — teams built as shapes, played against each other\n');
console.log('  7 offensive schemes x 5 defensive schemes; ' + OFF_SCHEMES.length + ' offenses, ' + DEF_SCHEMES.length + ' defenses');
console.log('  every roster re-centred to the SAME ovrBase, so shape is the only difference\n');

/* ================================================================================
   A. What is the RPS matchup table worth, in points?
   ================================================================================
   Identical NEUTRAL rosters on both sides (Pro Style / 4-3 shapes, no tilt), same seeds across
   every cell. With rosters and seeds held fixed, the ONLY thing varying between cells is the
   scheme pair — so the measured difference is the matchup edge plus the play-mix shift, with the
   roster-quality noise paired away. */
if (run('A')) {
  const N = GAMES || 400;
  const base = mkTeam('nA', 'Neutral A', 0xA11CE, 78, 'Pro Style', '4-3', 'Pro Style', '4-3');
  const foe = mkTeam('nB', 'Neutral B', 0xB0B, 78, 'Pro Style', '4-3', 'Pro Style', '4-3');
  console.log('== A. THE MATCHUP TABLE, MEASURED ==');
  console.log('   identical neutral rosters (' + base.ratings.off + ' off / ' + foe.ratings.def + ' def), common seeds; cells = points scored by the OFFENSE');
  const grid = {}, oppGrid = {}, all = [];
  for (const os of OFF_SCHEMES) for (const ds of DEF_SCHEMES) {
    install(base, os, '4-3'); install(foe, 'Pro Style', ds);
    const pts = [], opp = [];
    for (let i = 0; i < N; i++) {
      // home-and-home on paired seeds → home field cancels, and every cell sees the same stream
      const g1 = playGame(base, foe, (0x5ca1 + i * 7919) >>> 0), g2 = playGame(foe, base, (0x5ca1 + i * 7919) >>> 0);
      pts.push(g1.hs, g2.as);
      // The OPPONENT's points matter as much: a run-heavy offense that burns clock lowers ITS OWN
      // scoring and the other side's equally, which is ball control and margin-neutral. One that
      // lowers only its own is a scoring penalty for picking that scheme. These look identical
      // from one side of the ball, and the whole reading of the row effect turns on which it is.
      opp.push(g1.as, g2.hs);
    }
    grid[os + '|' + ds] = mean(pts); oppGrid[os + '|' + ds] = mean(opp); all.push(...pts);
  }
  const gm = mean(all);
  console.log('   parity-matchup baseline: ' + gm.toFixed(2) + ' pts/team  (NOT the league average — two');
  console.log('   identical 78-rated rosters never mismatch, and the profiler\'s 22.6 includes blowouts)\n');
  // SCHEME_EDGE is DOUBLY balanced — every row and column sums to zero — so it is pure INTERACTION
  // and contains no row or column effect at all. Comparing raw cells against it therefore compares
  // two different things: the raw row mean is dominated by schemeTendency (lever 3), which changes
  // how much an offense scores against EVERY defense. Decompose first, then compare like with like.
  const rowEff = {}, colEff = {};
  OFF_SCHEMES.forEach(os => rowEff[os] = mean(DEF_SCHEMES.map(ds => grid[os + '|' + ds])) - gm);
  DEF_SCHEMES.forEach(ds => colEff[ds] = mean(OFF_SCHEMES.map(os => grid[os + '|' + ds])) - gm);
  console.log('   ' + pad('offense', 15) + DEF_SCHEMES.map(d => lpad(d.slice(0, 6), 8)).join('') + '     row  | table says');
  const meas = [], tab = [];
  for (const os of OFF_SCHEMES) {
    const row = DEF_SCHEMES.map(ds => grid[os + '|' + ds] - gm - rowEff[os] - colEff[ds]);
    row.forEach((v, i) => { meas.push(v); tab.push(SCHEME_EDGE[offSchemeIdx(os)][defSchemeIdx(DEF_SCHEMES[i])]); });
    console.log('   ' + pad(os, 15) + row.map(v => lpad(f1(v), 8)).join('') + lpad(f1(rowEff[os]), 8) + '  | ' +
      SCHEME_EDGE[offSchemeIdx(os)].map(v => lpad((v >= 0 ? '+' : '') + v, 3)).join(''));
  }
  console.log('   ' + pad('(column)', 15) + DEF_SCHEMES.map(d => lpad(f1(colEff[d]), 8)).join(''));
  // ball control vs scoring penalty — the row effect on the opponent's points, and on the margin
  const oppGm = mean(OFF_SCHEMES.flatMap(os => DEF_SCHEMES.map(ds => oppGrid[os + '|' + ds])));
  console.log('\n   ' + pad('offense', 15) + lpad('scores', 9) + lpad('opp scores', 12) + lpad('margin', 9) + '   what the row effect IS');
  for (const os of OFF_SCHEMES) {
    const o = mean(DEF_SCHEMES.map(ds => oppGrid[os + '|' + ds])) - oppGm, m = rowEff[os] - o;
    const kind = Math.abs(m) < 0.4 ? 'ball control (margin-neutral)' : m > 0 ? 'a real EDGE' : 'a real PENALTY';
    console.log('   ' + pad(os, 15) + lpad(f1(rowEff[os]), 9) + lpad(f1(o), 12) + lpad(f1(m), 9) + '   ' + kind);
  }
  console.log('\n   cells = INTERACTION only (cell - row - column + grand), which is what SCHEME_EDGE is.');
  console.log('   row/column = how much a scheme moves scoring against EVERY opponent — mostly lever 3,');
  console.log('   the play-mix tendency, which the matchup table says nothing about.\n');
  const cor = (() => { const mx = mean(meas), my = mean(tab); let n = 0, dx = 0, dy = 0; for (let i = 0; i < meas.length; i++) { n += (meas[i] - mx) * (tab[i] - my); dx += (meas[i] - mx) ** 2; dy += (tab[i] - my) ** 2; } return n / Math.sqrt(dx * dy); })();
  const slope = (() => { const my = mean(tab), mm = mean(meas); let n = 0, d = 0; for (let i = 0; i < meas.length; i++) { n += (tab[i] - my) * (meas[i] - mm); d += (tab[i] - my) ** 2; } return n / d; })();
  console.log('   correlation, interaction vs table : ' + cor.toFixed(3));
  console.log('   1 rating pt of matchup edge buys  : ' + slope.toFixed(2) + ' pts on the scoreboard');
  console.log('   spread, best to worst MATCHUP     : ' + (Math.max(...meas) - Math.min(...meas)).toFixed(1) + ' pts');
  console.log('   spread, best to worst OFFENSE row : ' + (Math.max(...Object.values(rowEff)) - Math.min(...Object.values(rowEff))).toFixed(1) + ' pts');
  console.log('   spread, best to worst DEFENSE col : ' + (Math.max(...Object.values(colEff)) - Math.min(...Object.values(colEff))).toFixed(1) + ' pts');
  console.log('   ' + (2 * N * OFF_SCHEMES.length * DEF_SCHEMES.length) + ' games\n');
}

/* ================================================================================
   B. Does installing a scheme really re-rate the roster? (lever 2)
   ================================================================================
   Each identity roster is installed in all 7 offensive schemes and re-rated. A roster built for a
   system should be worth more rating points in it — and the row is a like-for-like comparison of
   the SAME players, since ovrBase never moves. */
if (run('B')) {
  console.log('== B. THE SAME ROSTER, IN EVERY SYSTEM ==');
  console.log('   top-11 offensive rating after ovrIn re-rating; every roster is ovrBase 78\n');
  console.log('   ' + pad('roster built for', 16) + OFF_SCHEMES.map(s => lpad(s.slice(0, 7), 9)).join(''));
  const rows = [];
  for (const idName of Object.keys(OFF_ID)) {
    const t = mkTeam('b' + idName, idName, 0xB1A5, 78, idName, '4-3', 'Pro Style', '4-3', 'PAIR');
    const vals = OFF_SCHEMES.map(s => { install(t, s, '4-3'); return t.ratings.off; });
    const best = Math.max(...vals), home = vals[OFF_SCHEMES.indexOf(idName)];
    rows.push({ idName, vals, best, home });
    console.log('   ' + pad(idName, 16) + vals.map((v, i) => lpad((OFF_SCHEMES[i] === idName ? '*' : ' ') + v, 9)).join(''));
  }
  console.log('   (* = the system the roster was built for)');
  const rightHome = rows.filter(r => r.home === r.best).length;
  console.log('\n   rosters whose own system rates them highest: ' + rightHome + ' of ' + rows.length);
  console.log('   spread between best and worst fit: ' + rows.map(r => (Math.max(...r.vals) - Math.min(...r.vals))).map(v => v + '').join(', ') + ' rating pts');

  console.log('\n   defensive side, same test:\n');
  console.log('   ' + pad('roster built for', 16) + DEF_SCHEMES.map(s => lpad(s.slice(0, 7), 9)).join(''));
  const drows = [];
  for (const idName of Object.keys(DEF_ID)) {
    const t = mkTeam('d' + idName, idName, 0xB1A5, 78, 'Pro Style', idName, 'Pro Style', '4-3', 'PAIR');
    const vals = DEF_SCHEMES.map(s => { install(t, 'Pro Style', s); return t.ratings.def; });
    drows.push({ idName, vals, best: Math.max(...vals), home: vals[DEF_SCHEMES.indexOf(idName)] });
    console.log('   ' + pad(idName, 16) + vals.map((v, i) => lpad((DEF_SCHEMES[i] === idName ? '*' : ' ') + v, 9)).join(''));
  }
  console.log('   rosters whose own system rates them highest: ' + drows.filter(r => r.home === r.best).length + ' of ' + drows.length + '\n');
}

/* ================================================================================
   C. The showcase — five fully-built programs, round-robin
   ================================================================================
   What the question actually asks for: real teams with an offensive identity AND a defensive one,
   each running the system it was built for, playing everybody home-and-home. Equal talent, so the
   standings are entirely scheme and shape. */
const PROGRAMS = [
  { id: 'AIR', name: 'Air Raid U', off: 'Air Raid', def: 'Nickel/Cover-3' },
  { id: 'SMA', name: 'Smashmouth St', off: 'Smashmouth', def: '3-4' },
  { id: 'OPT', name: 'Option Tech', off: 'Spread-Option', def: 'Bear' },
  { id: 'WCO', name: 'West Coast A&M', off: 'West Coast', def: 'Tampa-2' },
  { id: 'PRO', name: 'Pro State', off: 'Pro Style', def: '4-3' },
];
if (run('C')) {
  const N = GAMES || 300;
  console.log('== C. FIVE PROGRAMS, EQUAL TALENT, ROUND-ROBIN ==');
  const teams = PROGRAMS.map(p => mkTeam(p.id, p.name, hashStr(p.id), 78, p.off, p.def, p.off, p.def));
  console.log('   ' + pad('program', 17) + pad('offense', 15) + pad('defense', 16) + 'off  def');
  teams.forEach(t => console.log('   ' + pad(t.name, 17) + pad(t.offScheme, 15) + pad(t.defScheme, 16) + lpad(t.ratings.off, 3) + lpad(t.ratings.def, 5)));

  const rec = {}, box = {};
  teams.forEach(t => { rec[t.id] = { w: 0, l: 0, pf: [], pa: [] }; box[t.id] = { pAtt: 0, rAtt: 0, pYds: 0, rYds: 0, pCmp: 0, int: 0, sk: 0 }; });
  const h2h = {};
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
    const A = teams[i], B = teams[j]; let aw = 0, bw = 0, ap = 0, bp = 0;
    for (let k = 0; k < N; k++) {
      for (const gm of series(A, B, (hashStr(A.id + B.id) ^ (k * 2654435761)) >>> 0)) {
        rec[A.id].pf.push(gm.a.pts); rec[A.id].pa.push(gm.b.pts);
        rec[B.id].pf.push(gm.b.pts); rec[B.id].pa.push(gm.a.pts);
        ap += gm.a.pts; bp += gm.b.pts;
        if (gm.a.pts > gm.b.pts) { rec[A.id].w++; rec[B.id].l++; aw++; } else if (gm.b.pts > gm.a.pts) { rec[B.id].w++; rec[A.id].l++; bw++; }
        for (const k2 of ['pAtt', 'rAtt', 'pYds', 'rYds', 'pCmp', 'int', 'sk']) { box[A.id][k2] += gm.a[k2]; box[B.id][k2] += gm.b[k2]; }
      }
    }
    h2h[A.id + '-' + B.id] = { aw, bw, ap: ap / (2 * N), bp: bp / (2 * N) };
  }
  console.log('\n   STANDINGS (' + (2 * N) + ' games vs each opponent, home-and-home)\n');
  console.log('   ' + pad('program', 17) + lpad('W', 5) + lpad('L', 5) + lpad('win%', 7) + lpad('PF', 7) + lpad('PA', 7) + lpad('marg', 7));
  const order = [...teams].sort((a, b) => (rec[b.id].w / (rec[b.id].w + rec[b.id].l)) - (rec[a.id].w / (rec[a.id].w + rec[a.id].l)));
  order.forEach(t => { const R = rec[t.id];
    console.log('   ' + pad(t.name, 17) + lpad(R.w, 5) + lpad(R.l, 5) + lpad((100 * R.w / (R.w + R.l)).toFixed(1), 7) +
      lpad(mean(R.pf).toFixed(1), 7) + lpad(mean(R.pa).toFixed(1), 7) + lpad(f1(mean(R.pf) - mean(R.pa)), 7)); });

  console.log('\n   HOW THEY PLAY (per game)\n');
  console.log('   ' + pad('program', 17) + lpad('pass%', 7) + lpad('att', 6) + lpad('cmp%', 7) + lpad('Y/A', 6) + lpad('car', 6) + lpad('Y/C', 6) + lpad('int', 6));
  order.forEach(t => { const b = box[t.id], g = rec[t.id].pf.length;
    console.log('   ' + pad(t.name, 17) + lpad((100 * b.pAtt / (b.pAtt + b.rAtt)).toFixed(1), 7) + lpad((b.pAtt / g).toFixed(1), 6) +
      lpad((100 * b.pCmp / b.pAtt).toFixed(1), 7) + lpad((b.pYds / b.pAtt).toFixed(2), 6) + lpad((b.rAtt / g).toFixed(1), 6) +
      lpad((b.rYds / b.rAtt).toFixed(2), 6) + lpad((b.int / g).toFixed(2), 6)); });

  console.log('\n   HEAD TO HEAD (win% for the row team, and the average score)\n');
  console.log('   ' + pad('', 17) + PROGRAMS.map(p => lpad(p.id, 13)).join(''));
  for (const A of teams) {
    let line = '   ' + pad(A.name, 17);
    for (const B of teams) {
      if (A === B) { line += lpad('—', 13); continue; }
      const k = h2h[A.id + '-' + B.id], flip = !k;
      const kk = k || h2h[B.id + '-' + A.id];
      const w = flip ? kk.bw : kk.aw, l = flip ? kk.aw : kk.bw;
      const ps = flip ? kk.bp : kk.ap, pa = flip ? kk.ap : kk.bp;
      line += lpad((100 * w / (w + l)).toFixed(0) + '% ' + ps.toFixed(0) + '-' + pa.toFixed(0), 13);
    }
    console.log(line);
  }
  console.log('');
}

/* ================================================================================
   D. The wrong system — what does a scheme mismatch cost?
   ================================================================================
   The most direct test of lever 2 being real: take a roster built for one thing and make it run
   everything else, against a fixed neutral opponent. If installing a scheme genuinely re-rates a
   roster, running the wrong one should cost real points, not just a cosmetic rating. */
if (run('D')) {
  const N = GAMES || 300;
  console.log('== D. RUNNING THE WRONG SYSTEM ==');
  console.log('   each roster vs the SAME neutral opponent (Pro Style / 4-3), all 7 offenses installed.');
  console.log('   Points are shown NET of what a shapeless neutral roster scores in that same scheme, so');
  console.log('   the play-mix tendency (which moves scoring on its own) is controlled away and what is');
  console.log('   left is what the ROSTER SHAPE is worth. Same seeds throughout.\n');
  const foe = mkTeam('nZ', 'Neutral', 0xC0FFEE, 78, 'Pro Style', '4-3', 'Pro Style', '4-3');
  const seeds = []; for (let i = 0; i < N; i++) seeds.push((0xBEEF + i * 7919) >>> 0);
  const ptsFor = t => { const p = []; for (const s of seeds) { p.push(playGame(t, foe, s).hs, playGame(foe, t, s).as); } return mean(p); };
  // the control: a no-identity roster run through all seven, which isolates schemeTendency
  const ctl = mkTeam('wCTL', 'control', 0xC7A1, 78, 'Pro Style', '4-3', 'Pro Style', '4-3', 'PAIR');
  const CTL = {}; for (const s of OFF_SCHEMES) { install(ctl, s, '4-3'); CTL[s] = ptsFor(ctl); }
  console.log('   ' + pad('shapeless control', 18) + OFF_SCHEMES.map(s => lpad(s.slice(0, 7), 9)).join(''));
  console.log('   ' + pad('  pts (tendency)', 18) + OFF_SCHEMES.map(s => lpad(CTL[s].toFixed(1), 9)).join('') + '\n');
  console.log('   ' + pad('roster built for', 18) + OFF_SCHEMES.map(s => lpad(s.slice(0, 7), 9)).join('') + lpad('own-vs-worst', 14));
  for (const idName of Object.keys(OFF_ID)) {
    // same seed AND tag as the control → identical base draws, so the only difference is the tilt
    const t = mkTeam('w' + idName, idName, 0xC7A1, 78, idName, '4-3', idName, '4-3', 'PAIR');
    const net = OFF_SCHEMES.map(s => { install(t, s, '4-3'); return ptsFor(t) - CTL[s]; });
    const own = net[OFF_SCHEMES.indexOf(idName)], worst = Math.min(...net);
    console.log('   ' + pad(idName, 18) + net.map((v, i) => lpad((OFF_SCHEMES[i] === idName ? '*' : ' ') + f1(v), 9)).join('') + lpad(f1(own - worst) + ' pts', 14));
  }
  console.log('   (* = the system the roster was built for; cells are pts vs the shapeless control)\n');
}

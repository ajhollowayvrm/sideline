/* Sideline SCHEME SIM — build teams with real offensive and defensive IDENTITIES, install schemes
   on them, and play actual games.

   The question this answers: what does a SCHEME actually DO to a game? The sim has exactly three
   scheme levers and they live in three different places, which makes the net effect impossible to
   reason about from the source:

     1. the rock-paper-scissors MATCHUP edge (SCHEME_EDGE, +-3 rating pts) — applied OUTSIDE
        simEngine, by simSides in the app layer. This harness mirrors that application exactly.
     2. ROSTER RE-RATING — `p.ov = ovrIn(p, scheme)`. Installing a scheme re-weights every player's
        attributes, so the same roster is worth a different number of rating points in a different
        system. Phase 51 moved roster fit here after retiring the old team-level fit term.
     3. PLAY MIX — schemeTendency shifts passProb inside simEngine. Air Raid airs it out, Smashmouth
        grinds.

   PHASE 52 REWRITE. Two things changed and both matter to the measurement.

   The rosters are now RANDOMIZED, which the first version of this harness got wrong. It built every
   team at a flat ov 78 with a hand-authored attribute tilt at every position — eleven variations on
   one player, which is neither a football team nor what the game generates. Teams here are now drawn
   the way the game draws them: ability varies by player and by depth, archetype and purity are random
   draws, and a roster is a MIX of shapes rather than a single one.

   An identity is therefore expressed as what a program RECRUITS — a bias in the archetype draw (an
   Air Raid takes Pocket Passers, Deep Threats and Pass Protectors) — rather than as a synthetic tilt.
   That tests the shipped generator instead of a stand-in for it.

   Parity comes from PAIRED ABILITY DRAWS rather than from flattening. Every roster draws its ability
   numbers from a dedicated rng stream seeded identically across conditions, while shape comes from a
   SEPARATE stream. Two teams differing only in identity therefore get literally the same ability
   levels in the same order, and since archetypes are weighted-mean-zero by construction, `ovrBase`
   comes out identical too. Nothing below can be explained by one side having better players — and
   that is asserted in the parity gate that runs first, not assumed.

   Run:  node tools/schemesim.js            (default sizing, ~3 min, ~60k games)
         GAMES=200 node tools/schemesim.js  (games per matrix cell)
         ONLY=C node tools/schemesim.js     (run one experiment: A, B, C, D or E)  */

const fs = require('fs');
const path = require('path');

/* ---------- helpers that index.html's blocks close over (must match it exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* roster shape — mirrors tools/cfb-data/4-simprofile.js, with the Phase 52 FS/SS split */
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3],
["DE", "def", 6], ["DT", "def", 6], ["LB", "def", 10], ["CB", "def", 9], ["FS", "def", 4], ["SS", "def", 4],
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
// `const`s, so each block appends an explicit export of the constants used below.
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
const SCH = eval(grab('// === SCHEME ENGINE (Phase 21) START ===', '// === SCHEME ENGINE (Phase 21) END ===')
  + '\n;({OFF_SCHEMES,DEF_SCHEMES,SCHEME_EDGE,SCHEME_TENDENCY});');
const ATT = eval(grab('// === ATTRIBUTE ENGINE (Phase 52) START ===', '// === ATTRIBUTE ENGINE (Phase 52) END ===')
  + '\n;({ATTRS,POS_ATTR_W,SCHEME_ATTR_W,PLAYER_ARCH});');
eval(grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ==='));
const { OFF_SCHEMES, DEF_SCHEMES, SCHEME_EDGE } = SCH;
const { PLAYER_ARCH } = ATT;

const GAMES = parseInt(process.env.GAMES || '0', 10);
const ONLY = (process.env.ONLY || '').toUpperCase();
const run = k => !ONLY || ONLY.indexOf(k) >= 0;

/* ================================================================================
   TEAM IDENTITIES — what a program RECRUITS
   ================================================================================
   Per position, the archetypes this system wants. A player at that position is drawn from this
   shortlist most of the time and from the league's natural mix otherwise, so a roster keeps variety
   and the occasional misfit — a real team rather than a template. */
const PREF = 0.75;
const OFF_ID = {
  'Air Raid': {
    QB: ['Pocket Passer', 'Field General'], WR: ['Deep Threat', 'Slot Technician', 'Possession'],
    OT: ['Pass Protector', 'Technician'], OG: ['Anchor', 'Technician'], C: ['Field General'],
    TE: ['Receiving F'], RB: ['Receiving Back', 'Scat Back']
  },
  'Smashmouth': {
    QB: ['Game Manager', 'Field General'], RB: ['Power Back', 'Workhorse'], TE: ['Blocking Y'],
    OT: ['Mauler'], OG: ['Mauler'], C: ['Mauler', 'Anchor'], WR: ['Contested X', 'Blocking WR']
  },
  'Spread-Option': {
    QB: ['Dual-Threat', 'Scrambler'], RB: ['Home-Run Hitter', 'One-Cut Runner'],
    OT: ['Zone Athlete'], OG: ['Puller'], C: ['Zone Snapper'], WR: ['Gadget', 'Deep Threat'], TE: ['Move H-Back']
  },
  'West Coast': {
    QB: ['Field General', 'Pocket Passer'], WR: ['Possession', 'Slot Technician'],
    TE: ['Receiving F', 'Complete TE'], RB: ['Receiving Back'], OT: ['Technician', 'Pass Protector'],
    OG: ['Technician'], C: ['Field General']
  },
  'Pro Style': {},      // the control — the league's natural archetype mix, no recruiting bias
};
const DEF_ID = {
  'Bear': {
    DE: ['Speed Rusher', 'Bull Rusher'], DT: ['Interior Freak', '3-Tech'], CB: ['Press Corner', 'Burner'],
    LB: ['Blitzer', 'Thumper'], SS: ['Box Enforcer'], FS: ['Nickel Hybrid']
  },
  'Tampa-2': {
    LB: ['Sideline-to-Sideline', 'Coverage LB'], CB: ['Zone Corner'],
    FS: ['Center Fielder'], SS: ['Deep Half', 'Coverage SS'], DE: ['Speed Rusher']
  },
  'Nickel/Cover-3': {
    CB: ['Zone Corner', 'Slot Corner'], FS: ['Center Fielder', 'Ball Hawk'],
    SS: ['Coverage SS', 'Deep Half'], LB: ['Coverage LB', 'Field General']
  },
  '3-4': {
    DT: ['Nose Tackle'], DE: ['Run Stopper', 'Bull Rusher'], LB: ['Field General', 'Thumper'],
    SS: ['Box Enforcer'], FS: ['Robber']
  },
  '4-3': {},            // the control
};
// A misspelled archetype would fall through to the natural draw and quietly turn an identity into
// the control — exactly the kind of null result that reads as a finding.
(function checkPrefs() {
  let bad = 0;
  for (const [set, name] of [[OFF_ID, 'OFF_ID'], [DEF_ID, 'DEF_ID']])
    for (const id in set) for (const pos in set[id]) for (const n of set[id][pos])
      if (!(PLAYER_ARCH[pos] || []).some(a => a.n === n)) { console.error(`  unknown archetype ${name}.${id}.${pos}: "${n}"`); bad++; }
  if (bad) process.exit(2);
})();

/* ---------- a randomized roster, with ability paired across conditions ---------- */
// Two independent streams. `ra` draws ABILITY and is seeded identically for every condition, so two
// rosters differing only in identity get the same ability numbers in the same order. `rs` draws SHAPE
// (archetype, purity, within-profile noise) and is free to diverge. Without the split, an identity
// that happened to consume a different number of draws would shift every later ability draw and the
// comparison would silently become a talent comparison.
// `sideTilt` ({off:+n, def:-n}) moves one side of the ball up and the other down. The ABILITY stream
// is still drawn first and identically, then shifted — so a lopsided team and a balanced one are
// built from literally the same draws and differ only by the shift. That is what makes "same total
// talent, distributed differently" a fact about the rosters rather than a hope about the averages.
function mkRoster(abilitySeed, shapeSeed, pref, sideTilt) {
  const ra = rng(abilitySeed >>> 0), rs = rng(shapeSeed >>> 0);
  const out = [];
  POS.forEach(([code, side, n]) => {
    for (let i = 0; i < n; i++) {
      const ov = clamp(Math.round(62 * 0.55 + ri(ra, -9, 9) + ri(ra, -1, 6) + 30 + (((sideTilt || {})[side]) || 0)), 44, 99);
      const want = (pref || {})[code];
      const a = (want && rs() < PREF) ? archByName(code, want[Math.floor(rs() * want.length)]) : pickArch(rs, code);
      const pur = clamp(0.35 + (rs() + rs() + rs()) / 3 * 1.5, 0.3, 1.7);
      const p = Object.assign({ id: 'x', pos: code, so: 0 }, genAttrs(rs, ov, code, 15, a, pur));
      if (a) { p.arch = a.n; p.pur = pur; }
      p.ov = ovrBase(p);
      out.push(p);
    }
  });
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
  return { off: avgTop(roster.filter(p => sideOf[p.pos] === 'off'), 11), def: avgTop(roster.filter(p => sideOf[p.pos] === 'def'), 11), ovr: 0 };
}
/* Install schemes exactly as the game does: every player's OVERALL is re-read through the system he
   plays in, then team ratings are recomputed off those. This IS lever 2. */
function install(team, offScheme, defScheme) {
  team.offScheme = offScheme; team.defScheme = defScheme;
  team.roster.forEach(p => { const s = sideOf[p.pos]; p.ov = ovrIn(p, s === 'off' ? offScheme : s === 'def' ? defScheme : null); });
  team.ratings = teamRatings(team.roster);
  return team;
}
let _tag = 0;
function mkTeam(id, name, abilitySeed, shapeSeed, offIdName, defIdName, offScheme, defScheme, sideTilt) {
  const pref = Object.assign({}, OFF_ID[offIdName] || {}, DEF_ID[defIdName] || {});
  const roster = mkRoster(abilitySeed, shapeSeed, pref, sideTilt);
  const tag = 't' + (_tag++) + '-';
  roster.forEach((p, i) => p.id = tag + p.pos + i);      // unique per team; the box score is id-keyed
  return install({ id, name, roster, offId: offIdName, defId: defIdName }, offScheme, defScheme);
}
// scheme-agnostic talent, which must be identical across conditions for any of this to mean anything
function baseRating(team, side) {
  const a = team.roster.filter(p => sideOf[p.pos] === side).map(p => ovrBase(p)).sort((x, y) => y - x).slice(0, 11);
  return a.reduce((t, x) => t + x, 0) / a.length;
}

/* ---------- play a game, applying the scheme RPS edge the way simSides does ---------- */
function playGame(home, away, seed, wantLog) {
  const withR = (t, o) => Object.assign({}, t, { ratings: { off: clamp(t.ratings.off + o, 40, 99), def: t.ratings.def, ovr: t.ratings.ovr } });
  const H = withR(home, schemeEdge(home.offScheme, away.defScheme));
  const A = withR(away, schemeEdge(away.offScheme, home.defScheme));
  return simEngine(H, A, seed >>> 0, wantLog ? { log: true } : {});
}
function tally(res, t) {
  const ids = new Set(t.roster.map(p => p.id));
  const s = { pAtt: 0, pCmp: 0, pYds: 0, rAtt: 0, rYds: 0, sk: 0, int: 0 };
  for (const pid in res.box) {
    if (!ids.has(pid)) continue; const b = res.box[pid];
    s.pAtt += b.pAtt || 0; s.pCmp += b.pCmp || 0; s.pYds += b.pYds || 0;
    s.rAtt += b.rAtt || 0; s.rYds += b.rYds || 0; s.sk += b.sk || 0; s.int += b.pInt || 0;
  }
  return s;
}
function series(a, b, seed) {
  const g1 = playGame(a, b, seed), g2 = playGame(b, a, (seed ^ 0x9e3779b9) >>> 0);
  return [{ a: Object.assign({ pts: g1.hs }, tally(g1, a)), b: Object.assign({ pts: g1.as }, tally(g1, b)) },
  { a: Object.assign({ pts: g2.as }, tally(g2, a)), b: Object.assign({ pts: g2.hs }, tally(g2, b)) }];
}
const mean = a => a.reduce((t, x) => t + x, 0) / (a.length || 1);
const f1 = x => (x >= 0 ? '+' : '') + x.toFixed(1);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

console.log('SIDELINE SCHEME SIM — randomized rosters, real archetypes, 25 attributes\n');

/* ================================================================================
   PARITY GATE — the experiment is void without this
   ================================================================================ */
{
  const ctl = mkTeam('p0', 'control', 0x50FA5, 0x1234, 'Pro Style', '4-3', 'Pro Style', '4-3');
  let worst = 0;
  const rows = [];
  for (const idName of Object.keys(OFF_ID)) {
    const t = mkTeam('p' + idName, idName, 0x50FA5, 0x1234, idName, '4-3', 'Pro Style', '4-3');
    const d = baseRating(t, 'off') - baseRating(ctl, 'off');
    worst = Math.max(worst, Math.abs(d)); rows.push(idName + ' ' + f1(d));
  }
  for (const idName of Object.keys(DEF_ID)) {
    const t = mkTeam('q' + idName, idName, 0x50FA5, 0x1234, 'Pro Style', idName, 'Pro Style', '4-3');
    const d = baseRating(t, 'def') - baseRating(ctl, 'def');
    worst = Math.max(worst, Math.abs(d));
  }
  console.log('  parity: worst ovrBase gap between any identity and the control = ' + worst.toFixed(2) + ' rating pts');
  console.log('  (archetypes are weighted-mean-zero, so recruiting a shape must not buy ability)');
  if (worst > 0.75) { console.error('  PARITY FAILED — identities differ in TALENT, every number below is void'); process.exit(2); }
  const census = {};
  ctl.roster.filter(p => p.pos === 'WR').forEach(p => census[p.arch] = (census[p.arch] || 0) + 1);
  console.log('  a control roster\'s WRs: ' + Object.entries(census).map(([k, v]) => k + ' x' + v).join(', '));
  const air = mkTeam('pair', 'air', 0x50FA5, 0x1234, 'Air Raid', '4-3', 'Air Raid', '4-3');
  const c2 = {}; air.roster.filter(p => p.pos === 'WR').forEach(p => c2[p.arch] = (c2[p.arch] || 0) + 1);
  console.log('  an Air Raid roster\'s WRs: ' + Object.entries(c2).map(([k, v]) => k + ' x' + v).join(', ') + '\n');
}

/* ================================================================================
   A. What is the RPS matchup table worth, in points?
   ================================================================================
   One randomized roster per side, held FIXED across every cell, with common seeds. The only thing
   varying between cells is the scheme pair, so the measured difference is the matchup edge plus the
   play-mix shift, with roster noise paired away. */
if (run('A')) {
  const N = GAMES || 400;
  const base = mkTeam('nA', 'Neutral A', 0xA11CE, 0x5151, 'Pro Style', '4-3', 'Pro Style', '4-3');
  const foe = mkTeam('nB', 'Neutral B', 0xB0BCA7, 0x6262, 'Pro Style', '4-3', 'Pro Style', '4-3');
  console.log('== A. THE MATCHUP TABLE, MEASURED ==');
  console.log('   two randomized neutral rosters (' + base.ratings.off + ' off / ' + foe.ratings.def + ' def), common seeds; cells = points scored by the OFFENSE');
  const grid = {}, oppGrid = {}, all = [];
  for (const os of OFF_SCHEMES) for (const ds of DEF_SCHEMES) {
    install(base, os, '4-3'); install(foe, 'Pro Style', ds);
    const pts = [], opp = [];
    for (let i = 0; i < N; i++) {
      const s = (0x5ca1 + i * 7919) >>> 0;
      const g1 = playGame(base, foe, s), g2 = playGame(foe, base, s);
      pts.push(g1.hs, g2.as);
      // The OPPONENT's points matter as much: a run-heavy offense that burns clock lowers its own
      // scoring and the other side's equally, which is ball control and margin-neutral. One that
      // lowers only its own is a scoring penalty for picking that scheme. These look identical from
      // one side of the ball, and the reading of the row effect turns entirely on which it is.
      opp.push(g1.as, g2.hs);
    }
    grid[os + '|' + ds] = mean(pts); oppGrid[os + '|' + ds] = mean(opp); all.push(...pts);
  }
  const gm = mean(all);
  console.log('   parity-matchup baseline: ' + gm.toFixed(2) + ' pts/team\n');
  // SCHEME_EDGE is DOUBLY balanced — every row and column sums to zero — so it is pure INTERACTION
  // and contains no row or column effect at all. Comparing raw cells against it compares two
  // different things: the raw row mean is dominated by schemeTendency, which changes how much an
  // offense scores against EVERY defense. Decompose first, then compare like with like.
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
  const oppGm = mean(OFF_SCHEMES.map(os => mean(DEF_SCHEMES.map(ds => oppGrid[os + '|' + ds]))));
  console.log('\n   ' + pad('offense', 15) + lpad('scores', 9) + lpad('opp scores', 12) + lpad('margin', 9) + '   what the row effect IS');
  for (const os of OFF_SCHEMES) {
    const o = mean(DEF_SCHEMES.map(ds => oppGrid[os + '|' + ds])) - oppGm, m = rowEff[os] - o;
    console.log('   ' + pad(os, 15) + lpad(f1(rowEff[os]), 9) + lpad(f1(o), 12) + lpad(f1(m), 9) + '   ' +
      (Math.abs(m) < 0.4 ? 'ball control (margin-neutral)' : m > 0 ? 'a real EDGE' : 'a real PENALTY'));
  }
  console.log('\n   cells = INTERACTION only (cell - row - column + grand), which is what SCHEME_EDGE is.');
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
   Each identity roster installed in all seven offensive schemes and re-rated. A roster recruited for
   a system should be worth more rating points in it — and this is a like-for-like comparison of the
   SAME players, since ovrBase never moves. Averaged over several independent random rosters, because
   with real rosters one draw is a sample, not a measurement. */
if (run('B')) {
  const R = 12;
  console.log('== B. THE SAME ROSTER, IN EVERY SYSTEM ==');
  console.log('   top-11 offensive rating after ovrIn re-rating, averaged over ' + R + ' independent random rosters\n');
  console.log('   ' + pad('roster recruited for', 20) + OFF_SCHEMES.map(s => lpad(s.slice(0, 7), 9)).join(''));
  let right = 0, tot = 0;
  for (const idName of Object.keys(OFF_ID)) {
    const acc = OFF_SCHEMES.map(() => []);
    for (let k = 0; k < R; k++) {
      const t = mkTeam('b' + idName + k, idName, (0xB1A5 + k * 7919) >>> 0, (0x2C0DE + k * 104729) >>> 0, idName, '4-3', 'Pro Style', '4-3');
      OFF_SCHEMES.forEach((s, i) => { install(t, s, '4-3'); acc[i].push(t.ratings.off); });
    }
    const vals = acc.map(mean), best = Math.max(...vals), home = vals[OFF_SCHEMES.indexOf(idName)];
    tot++; if (home >= best - 0.001) right++;
    console.log('   ' + pad(idName, 20) + vals.map((v, i) => lpad((OFF_SCHEMES[i] === idName ? '*' : ' ') + v.toFixed(1), 9)).join('') +
      '   spread ' + (best - Math.min(...vals)).toFixed(1));
  }
  console.log('   (* = the system the roster was recruited for)');
  console.log('\n   defensive side, same test:\n');
  console.log('   ' + pad('roster recruited for', 20) + DEF_SCHEMES.map(s => lpad(s.slice(0, 7), 9)).join(''));
  for (const idName of Object.keys(DEF_ID)) {
    const acc = DEF_SCHEMES.map(() => []);
    for (let k = 0; k < R; k++) {
      const t = mkTeam('d' + idName + k, idName, (0xB1A5 + k * 7919) >>> 0, (0x2C0DE + k * 104729) >>> 0, 'Pro Style', idName, 'Pro Style', '4-3');
      DEF_SCHEMES.forEach((s, i) => { install(t, 'Pro Style', s); acc[i].push(t.ratings.def); });
    }
    const vals = acc.map(mean), best = Math.max(...vals), home = vals[DEF_SCHEMES.indexOf(idName)];
    tot++; if (home >= best - 0.001) right++;
    console.log('   ' + pad(idName, 20) + vals.map((v, i) => lpad((DEF_SCHEMES[i] === idName ? '*' : ' ') + v.toFixed(1), 9)).join('') +
      '   spread ' + (best - Math.min(...vals)).toFixed(1));
  }
  console.log('\n   rosters whose own system rates them highest: ' + right + ' of ' + tot + '\n');
}

/* ================================================================================
   C. The showcase — five fully-built programs, round-robin
   ================================================================================ */
const PROGRAMS = [
  { id: 'AIR', name: 'Air Raid U', off: 'Air Raid', def: 'Nickel/Cover-3' },
  { id: 'SMA', name: 'Smashmouth St', off: 'Smashmouth', def: '3-4' },
  { id: 'OPT', name: 'Option Tech', off: 'Spread-Option', def: 'Bear' },
  { id: 'WCO', name: 'West Coast A&M', off: 'West Coast', def: 'Tampa-2' },
  { id: 'PRO', name: 'Pro State', off: 'Pro Style', def: '4-3' },
];
if (run('C')) {
  const N = GAMES || 60, ROST = 5;   // several independent roster draws per program
  console.log('== C. FIVE PROGRAMS, EQUAL TALENT, ROUND-ROBIN ==');
  console.log('   ' + ROST + ' independent random rosters per program, ' + (2 * N) + ' games per roster pairing\n');
  const rec = {}, box = {}, h2h = {};
  PROGRAMS.forEach(p => { rec[p.id] = { w: 0, l: 0, pf: [], pa: [] }; box[p.id] = { pAtt: 0, rAtt: 0, pYds: 0, rYds: 0, pCmp: 0, int: 0 }; });
  const ratings = {}; PROGRAMS.forEach(p => ratings[p.id] = { off: [], def: [] });
  for (let k = 0; k < ROST; k++) {
    // every program gets the SAME ability draw this round; only recruiting shape and scheme differ
    const teams = PROGRAMS.map(p => mkTeam(p.id + k, p.name, (0xC0FFEE + k * 7919) >>> 0, (hashStr(p.id) ^ (k * 2654435761)) >>> 0, p.off, p.def, p.off, p.def));
    teams.forEach((t, i) => { ratings[PROGRAMS[i].id].off.push(t.ratings.off); ratings[PROGRAMS[i].id].def.push(t.ratings.def); });
    for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
      const A = teams[i], B = teams[j], ka = PROGRAMS[i].id, kb = PROGRAMS[j].id;
      const key = ka + '-' + kb; h2h[key] = h2h[key] || { aw: 0, bw: 0, ap: [], bp: [] };
      for (let g = 0; g < N; g++) {
        for (const gm of series(A, B, (hashStr(ka + kb) ^ (g * 2654435761) ^ (k * 40503)) >>> 0)) {
          rec[ka].pf.push(gm.a.pts); rec[ka].pa.push(gm.b.pts);
          rec[kb].pf.push(gm.b.pts); rec[kb].pa.push(gm.a.pts);
          h2h[key].ap.push(gm.a.pts); h2h[key].bp.push(gm.b.pts);
          if (gm.a.pts > gm.b.pts) { rec[ka].w++; rec[kb].l++; h2h[key].aw++; }
          else if (gm.b.pts > gm.a.pts) { rec[kb].w++; rec[ka].l++; h2h[key].bw++; }
          for (const k2 of ['pAtt', 'rAtt', 'pYds', 'rYds', 'pCmp', 'int']) { box[ka][k2] += gm.a[k2]; box[kb][k2] += gm.b[k2]; }
        }
      }
    }
  }
  console.log('   ' + pad('program', 17) + pad('offense', 15) + pad('defense', 16) + ' off  def');
  PROGRAMS.forEach(p => console.log('   ' + pad(p.name, 17) + pad(p.off, 15) + pad(p.def, 16) +
    lpad(mean(ratings[p.id].off).toFixed(1), 4) + lpad(mean(ratings[p.id].def).toFixed(1), 5)));
  console.log('\n   STANDINGS\n');
  console.log('   ' + pad('program', 17) + lpad('W', 6) + lpad('L', 6) + lpad('win%', 7) + lpad('PF', 7) + lpad('PA', 7) + lpad('marg', 7));
  const order = [...PROGRAMS].sort((a, b) => (rec[b.id].w / (rec[b.id].w + rec[b.id].l)) - (rec[a.id].w / (rec[a.id].w + rec[a.id].l)));
  order.forEach(p => {
    const R = rec[p.id];
    console.log('   ' + pad(p.name, 17) + lpad(R.w, 6) + lpad(R.l, 6) + lpad((100 * R.w / (R.w + R.l)).toFixed(1), 7) +
      lpad(mean(R.pf).toFixed(1), 7) + lpad(mean(R.pa).toFixed(1), 7) + lpad(f1(mean(R.pf) - mean(R.pa)), 7));
  });
  console.log('\n   HOW THEY PLAY (per game)\n');
  console.log('   ' + pad('program', 17) + lpad('pass%', 7) + lpad('att', 6) + lpad('cmp%', 7) + lpad('Y/A', 6) + lpad('car', 6) + lpad('Y/C', 6) + lpad('int', 6));
  order.forEach(p => {
    const b = box[p.id], g = rec[p.id].pf.length;
    console.log('   ' + pad(p.name, 17) + lpad((100 * b.pAtt / (b.pAtt + b.rAtt)).toFixed(1), 7) + lpad((b.pAtt / g).toFixed(1), 6) +
      lpad((100 * b.pCmp / b.pAtt).toFixed(1), 7) + lpad((b.pYds / b.pAtt).toFixed(2), 6) + lpad((b.rAtt / g).toFixed(1), 6) +
      lpad((b.rYds / b.rAtt).toFixed(2), 6) + lpad((b.int / g).toFixed(2), 6));
  });
  console.log('\n   HEAD TO HEAD (win% for the row team, and the average score)\n');
  console.log('   ' + pad('', 17) + PROGRAMS.map(p => lpad(p.id, 13)).join(''));
  for (const A of PROGRAMS) {
    let line = '   ' + pad(A.name, 17);
    for (const B of PROGRAMS) {
      if (A === B) { line += lpad('-', 13); continue; }
      const fwd = h2h[A.id + '-' + B.id], k = fwd || h2h[B.id + '-' + A.id];
      const w = fwd ? k.aw : k.bw, l = fwd ? k.bw : k.aw;
      const ps = mean(fwd ? k.ap : k.bp), pa = mean(fwd ? k.bp : k.ap);
      line += lpad((100 * w / (w + l)).toFixed(0) + '% ' + ps.toFixed(0) + '-' + pa.toFixed(0), 13);
    }
    console.log(line);
  }
  console.log('');
}

/* ================================================================================
   D. The wrong system — what does a scheme mismatch cost?
   ================================================================================
   Each identity roster against the SAME neutral opponent, with all seven offenses installed. Points
   are shown NET of what the CONTROL roster (same ability draw, no recruiting bias) scores in that
   same scheme, so the play-mix tendency is controlled away and what is left is what recruiting a
   SHAPE is worth. Averaged over several independent roster draws. */
if (run('D')) {
  const N = GAMES || 120, R = 5;
  console.log('== D. RUNNING THE WRONG SYSTEM ==');
  console.log('   pts vs a shapeless control roster with the same ability draw, ' + R + ' roster draws x ' + (2 * N) + ' games\n');
  const foe = mkTeam('nZ', 'Neutral', 0xDEC0DE, 0x7777, 'Pro Style', '4-3', 'Pro Style', '4-3');
  const seeds = []; for (let i = 0; i < N; i++) seeds.push((0xBEEF + i * 7919) >>> 0);
  const ptsFor = t => { const p = []; for (const s of seeds) { p.push(playGame(t, foe, s).hs, playGame(foe, t, s).as); } return mean(p); };
  const CTL = OFF_SCHEMES.map(() => []);
  for (let k = 0; k < R; k++) {
    const c = mkTeam('wCTL' + k, 'control', (0xC7A1 + k * 7919) >>> 0, (0x9E37 + k * 104729) >>> 0, 'Pro Style', '4-3', 'Pro Style', '4-3');
    OFF_SCHEMES.forEach((s, i) => { install(c, s, '4-3'); CTL[i].push(ptsFor(c)); });
  }
  const ctl = CTL.map(mean);
  console.log('   ' + pad('shapeless control', 20) + OFF_SCHEMES.map(s => lpad(s.slice(0, 7), 9)).join(''));
  console.log('   ' + pad('  pts (tendency)', 20) + ctl.map(v => lpad(v.toFixed(1), 9)).join('') + '\n');
  console.log('   ' + pad('roster recruited for', 20) + OFF_SCHEMES.map(s => lpad(s.slice(0, 7), 9)).join('') + lpad('own-vs-worst', 14));
  for (const idName of Object.keys(OFF_ID)) {
    const acc = OFF_SCHEMES.map(() => []);
    for (let k = 0; k < R; k++) {
      // SAME ability seed as the control, so the pair differs only in what it recruited
      const t = mkTeam('w' + idName + k, idName, (0xC7A1 + k * 7919) >>> 0, (0x9E37 + k * 104729) >>> 0, idName, '4-3', idName, '4-3');
      OFF_SCHEMES.forEach((s, i) => { install(t, s, '4-3'); acc[i].push(ptsFor(t)); });
    }
    const net = acc.map((a, i) => mean(a) - ctl[i]);
    const own = net[OFF_SCHEMES.indexOf(idName)], worst = Math.min(...net);
    console.log('   ' + pad(idName, 20) + net.map((v, i) => lpad((OFF_SCHEMES[i] === idName ? '*' : ' ') + f1(v), 9)).join('') + lpad(f1(own - worst) + ' pts', 14));
  }
  console.log('   (* = the system the roster was recruited for)\n');
}

/* ================================================================================
   E. All offense against all defense
   ================================================================================
   Two teams at the SAME total talent, distributed to opposite extremes: one pours everything into
   the offense and fields a bad defense, the other the reverse. Both run neutral schemes (Pro Style /
   4-3), so nothing here is about play-calling — it is purely about how the sim values one side of
   the ball against the other.

   The head-to-head is the fun question, but the honest one is each of them against a BALANCED team.
   That matchup is symmetric by construction: an offense-heavy team hands its opponent exactly as
   large an advantage on defense as it takes on offense. Anything other than a coin flip there is the
   sim expressing a preference — telling you whether it is better to score or to stop people. */
if (run('E')) {
  const N = GAMES || 400, ROST = 6, TILT = 12;
  console.log('== E. ALL OFFENSE vs ALL DEFENSE ==');
  console.log('   same ability draws, shifted +' + TILT + ' on one side of the ball and -' + TILT + ' on the other;');
  console.log('   neutral schemes both sides, so none of this is play-calling\n');

  const build = (k, tilt, id) => mkTeam(id + k, id, (0x0FFDEF + k * 7919) >>> 0, (0x5A9E1 + k * 104729) >>> 0,
    'Pro Style', '4-3', 'Pro Style', '4-3', tilt);

  const rec = { O: { w: 0, l: 0, t: 0, pf: [], pa: [] }, D: { w: 0, l: 0, t: 0, pf: [], pa: [] } };
  const bx = { O: { pAtt: 0, pCmp: 0, pYds: 0, rAtt: 0, rYds: 0, int: 0, sk: 0 }, D: { pAtt: 0, pCmp: 0, pYds: 0, rAtt: 0, rYds: 0, int: 0, sk: 0 } };
  const ratings = { O: { off: [], def: [] }, D: { off: [], def: [] } };
  const samples = [];
  for (let k = 0; k < ROST; k++) {
    const O = build(k, { off: TILT, def: -TILT }, 'Offense U');
    const D = build(k, { off: -TILT, def: TILT }, 'Defense Tech');
    ratings.O.off.push(O.ratings.off); ratings.O.def.push(O.ratings.def);
    ratings.D.off.push(D.ratings.off); ratings.D.def.push(D.ratings.def);
    for (let g = 0; g < N; g++) {
      for (const gm of series(O, D, (0xBA771E ^ (g * 2654435761) ^ (k * 40503)) >>> 0)) {
        rec.O.pf.push(gm.a.pts); rec.O.pa.push(gm.b.pts);
        rec.D.pf.push(gm.b.pts); rec.D.pa.push(gm.a.pts);
        if (gm.a.pts > gm.b.pts) { rec.O.w++; rec.D.l++; } else if (gm.b.pts > gm.a.pts) { rec.D.w++; rec.O.l++; } else { rec.O.t++; rec.D.t++; }
        for (const kk of ['pAtt', 'pCmp', 'pYds', 'rAtt', 'rYds', 'int', 'sk']) { bx.O[kk] += gm.a[kk]; bx.D[kk] += gm.b[kk]; }
        if (samples.length < 12) samples.push(gm.a.pts + '-' + gm.b.pts);
      }
    }
  }
  console.log('   ' + pad('team', 16) + lpad('off', 6) + lpad('def', 6) + '   built as');
  console.log('   ' + pad('Offense U', 16) + lpad(mean(ratings.O.off).toFixed(1), 6) + lpad(mean(ratings.O.def).toFixed(1), 6) + '   everything on the ball, nothing on defense');
  console.log('   ' + pad('Defense Tech', 16) + lpad(mean(ratings.D.off).toFixed(1), 6) + lpad(mean(ratings.D.def).toFixed(1), 6) + '   the reverse');
  const gp = rec.O.w + rec.O.l + rec.O.t;
  console.log('\n   HEAD TO HEAD (' + gp + ' games)\n');
  console.log('   ' + pad('team', 16) + lpad('W', 6) + lpad('L', 6) + lpad('win%', 8) + lpad('PF', 7) + lpad('PA', 7));
  for (const pair of [['O', 'Offense U'], ['D', 'Defense Tech']])
    console.log('   ' + pad(pair[1], 16) + lpad(rec[pair[0]].w, 6) + lpad(rec[pair[0]].l, 6) + lpad((100 * rec[pair[0]].w / gp).toFixed(1), 8) +
      lpad(mean(rec[pair[0]].pf).toFixed(1), 7) + lpad(mean(rec[pair[0]].pa).toFixed(1), 7));
  console.log('\n   a dozen actual results (Offense U first): ' + samples.join('  '));
  console.log('\n   ' + pad('team', 16) + lpad('att', 6) + lpad('cmp%', 7) + lpad('Y/A', 6) + lpad('car', 6) + lpad('Y/C', 6) + lpad('int', 6) + lpad('sacked', 8));
  for (const pair of [['O', 'Offense U'], ['D', 'Defense Tech']]) {
    const b = bx[pair[0]], g = rec[pair[0]].pf.length;
    console.log('   ' + pad(pair[1], 16) + lpad((b.pAtt / g).toFixed(1), 6) + lpad((100 * b.pCmp / b.pAtt).toFixed(1), 7) +
      lpad((b.pYds / b.pAtt).toFixed(2), 6) + lpad((b.rAtt / g).toFixed(1), 6) + lpad((b.rYds / b.rAtt).toFixed(2), 6) +
      lpad((b.int / g).toFixed(2), 6) + lpad((bx[pair[0] === 'O' ? 'D' : 'O'].sk / g).toFixed(2), 8));
  }

  console.log('\n   HOW IT SCALES (same test at each level of lopsidedness)\n');
  console.log('   ' + lpad('tilt', 7) + lpad('O off/def', 12) + lpad('D off/def', 12) + lpad('O win%', 9) + lpad('score', 12));
  for (const T of [4, 8, 12, 16, 20]) {
    let w = 0, l = 0; const pf = [], pa = [];
    let ro = null, rd = null;
    for (let k = 0; k < ROST; k++) {
      const O = build(k, { off: T, def: -T }, 'O'), D = build(k, { off: -T, def: T }, 'D');
      if (!ro) { ro = O.ratings; rd = D.ratings; }
      for (let g = 0; g < Math.round(N / 2); g++)
        for (const gm of series(O, D, (0x5CA1E ^ (g * 2654435761) ^ (k * 40503)) >>> 0)) {
          pf.push(gm.a.pts); pa.push(gm.b.pts);
          if (gm.a.pts > gm.b.pts) w++; else if (gm.b.pts > gm.a.pts) l++;
        }
    }
    console.log('   ' + lpad('+/-' + T, 7) + lpad(ro.off + '/' + ro.def, 12) + lpad(rd.off + '/' + rd.def, 12) +
      lpad((100 * w / (w + l)).toFixed(1), 9) + lpad(mean(pf).toFixed(1) + '-' + mean(pa).toFixed(1), 12));
  }

  console.log('\n   AGAINST A BALANCED TEAM OF THE SAME TALENT\n');
  console.log('   ' + pad('challenger', 16) + lpad('W', 6) + lpad('L', 6) + lpad('win%', 8) + lpad('PF', 7) + lpad('PA', 7) + lpad('total', 8));
  for (const pair of [['Offense U', { off: TILT, def: -TILT }], ['Defense Tech', { off: -TILT, def: TILT }]]) {
    let w = 0, l = 0; const pf = [], pa = [];
    for (let k = 0; k < ROST; k++) {
      const X = build(k, pair[1], pair[0]), B = build(k, null, 'Balanced');
      for (let g = 0; g < N; g++)
        for (const gm of series(X, B, (0xBA1A2CE ^ (g * 2654435761) ^ (k * 40503)) >>> 0)) {
          pf.push(gm.a.pts); pa.push(gm.b.pts);
          if (gm.a.pts > gm.b.pts) w++; else if (gm.b.pts > gm.a.pts) l++;
        }
    }
    console.log('   ' + pad(pair[0], 16) + lpad(w, 6) + lpad(l, 6) + lpad((100 * w / (w + l)).toFixed(1), 8) +
      lpad(mean(pf).toFixed(1), 7) + lpad(mean(pa).toFixed(1), 7) + lpad((mean(pf) + mean(pa)).toFixed(1), 8));
  }
  console.log('');
}

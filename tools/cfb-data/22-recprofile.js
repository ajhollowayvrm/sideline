/* Step 22 — profile what SIDELINE's recruiting model actually produces.

   Phase 56. The sim engine has been fitted against measured football since Phase 48; recruiting
   never has. Before changing anything we measure the CURRENT model on the same metric set that
   21-recanalyze.js computes from real 247/CFBD classes, so sim vs reality is apples-to-apples
   (the 4-simprofile.js / 3-analyze.js relationship, one layer up).

   The headline question this answers: recruiting's job is to DISTRIBUTE a national talent supply
   across 134 programs. The supply looks right (380 blue-chips of 3,400 = 11.2%, close to real).
   The distribution has never been looked at.

   Run:  node tools/cfb-data/22-recprofile.js
         WORLDS=8 node tools/cfb-data/22-recprofile.js        # more independent leagues
         INDEX=/tmp/old.html node tools/cfb-data/22-recprofile.js   # profile a DIFFERENT build

   INDEX=path is how a phase's effect on the envelope gets measured honestly:
     git show HEAD:index.html > /tmp/old.html   (same trick 4-simprofile.js uses)

   Why this tool builds its own world instead of reusing test/reclab.js: reclab hand-copies the
   data arrays it needs, and those copies have DRIFTED from the game. Its `STATES` holds 15 of the
   real 50 (so in-state density runs 3.3x the shipped game) and its `POS` still carries the
   pre-Phase-52 `S`, which no longer exists — `posAttrW('S')` falls back to the LINEBACKER row and
   `pickArch(r,'S')` returns null, so ~9.5% of every pool reclab validates is generated through a
   degraded path. That is the same instrument defect Phase 53 fixed in simlab. This tool therefore
   EXTRACTS the real arrays from index.html rather than copying them, so it cannot drift. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const html = fs.readFileSync(process.env.INDEX || path.join(__dirname, '..', '..', 'index.html'), 'utf8');

/* ---------- extract a top-level `const NAME=<literal>;` from index.html ----------
   A sloppy-mode eval leaks function declarations but NOT block-scoped consts (the trap noted in
   CLAUDE.md), so the engine blocks can be eval'd straight in while the data arrays cannot. We slice
   each literal out by brace-matching and eval it as an expression instead. This is what keeps the
   tool honest: it reads the game's own POS/STATES/TEAMS, never a copy that can rot. */
function grabConst(name) {
  const decl = 'const ' + name + '=';
  const i = html.indexOf('\n' + decl);
  if (i < 0) throw new Error('could not find `' + decl + '` in index.html');
  let j = i + 1 + decl.length, depth = 0, str = null;
  for (; j < html.length; j++) {
    const c = html[j];
    if (str) { if (c === '\\') j++; else if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (c === ';' && depth === 0) break;
  }
  return eval('(' + html.slice(i + 1 + decl.length, j) + ')');
}

/* the data arrays the recruit engine reads — pulled live, not copied */
const POS = grabConst('POS');
const STATES = grabConst('STATES');
const FN = grabConst('FN');
const LN = grabConst('LN');
const PREFS = grabConst('PREFS');
const TEAMS = grabConst('TEAMS');
const TEAM_STATE = grabConst('TEAM_STATE');
const CONF_BASE = grabConst('CONF_BASE');
const BUMP = grabConst('BUMP');

/* ---------- extract the engine blocks, in dependency order (as reclab does) ---------- */
const grab = (a, b) => {
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < 0) throw new Error('could not find markers: ' + a);
  return html.slice(i, j);
};
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
// accept either marker so an older build still profiles (the block was renamed at Phase 52)
eval((() => {
  try { return grab('// === ATTRIBUTE ENGINE (Phase 52) START ===', '// === ATTRIBUTE ENGINE (Phase 52) END ==='); }
  catch (e) { return grab('// === ATTRIBUTE ENGINE (Phase 51) START ===', '// === ATTRIBUTE ENGINE (Phase 51) END ==='); }
})());
eval(grab('// === RECRUIT ENGINE (Phase 4) START ===', '// === RECRUIT ENGINE (Phase 4) END ==='));

/* ---------- a real-geography world ----------
   Mirrors genWorld's prestige/facility formulas and uses the REAL conferences and home states, so
   geography is the shipped geography. It skips roster/staff generation (recruiting reads none of
   it), which means prestige is drawn on its own rng stream rather than one interleaved with
   genRoster — the per-team values differ from a real save, the DISTRIBUTION does not. */
function buildWorld(seed) {
  const r = rng(seed);
  return TEAMS.map(([name, nick, abbr, conf, div]) => {
    const prestige = clamp(Math.round((CONF_BASE[conf] || 45) + (BUMP[name] || 0) + ri(r, -7, 7)), 20, 98);
    return {
      id: abbr.toLowerCase().replace(/[^a-z0-9]/g, ''), abbr, name, conf,
      prestige, needs: {},
      homeState: TEAM_STATE[abbr] || pick(r, STATES),
      fac: {
        nil: clamp(Math.round(prestige / 10) + ri(r, -2, 1), 1, 10),
        academics: clamp(ri(r, 3, 9), 1, 10),
        scouting: clamp(Math.round(prestige / 11) + ri(r, -1, 1), 1, 10),
      },
    };
  });
}

/* one full recruiting cycle over a fixed world — 15 weeks, finalize on the last (matches reclab;
   the shipped game finalizes at National Signing Day instead, which changes WHEN not WHO) */
const WEEKS = 15;
function runCycle(world, seed) {
  const pool = genRecruits(seed, world);
  for (let w = 1; w <= WEEKS; w++) advanceRecruiting(pool, world, w, WEEKS, seed, w === WEEKS);
  return pool;
}

/* ---------- statistics ---------- */
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => (a.length ? sum(a) / a.length : 0);
function pearson(xs, ys) {
  const n = xs.length; if (n < 2) return 0;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : 0;
}
/* Gini over a non-negative distribution — 0 = every program gets the same, 1 = one takes all. */
function gini(v) {
  const a = [...v].sort((x, y) => x - y), n = a.length, t = sum(a);
  if (!n || !t) return 0;
  let acc = 0; for (let i = 0; i < n; i++) acc += (i + 1) * a[i];
  return (2 * acc) / (n * t) - (n + 1) / n;
}

/* ---------- run ---------- */
const WORLDS = +(process.env.WORLDS || 4);     // independent leagues
const CLASSES_PER_WORLD = 5;                   // consecutive classes, fixed prestige -> persistence
const out = [];
const say = s => { out.push(s); console.log(s); };

const starMix = { 5: 0, 4: 0, 3: 0, 2: 0 };
const bcrAll = [];            // per program-class blue-chip ratio (classes >= MIN_CLASS only)
const bcr4 = [];              // per program rolling 4-class blue-chip ratio
const classSizes = [];
const inStateShares = [];
const landPrestige = {};      // stars -> [landing prestige]
const top10Share = [], top25Share = [], giniAll = [];
/* A ratio over a 2-man class is noise, not a blue-chip ratio: it reads 100% off one signee and
   dominates any unweighted mean. Real BCR is quoted over full classes, so require a real class. */
const MIN_CLASS = 10;
const PRESTIGE_BANDS = [[0, 10], [10, 25], [25, 50], [50, 90], [90, 134]];
const BAND_LABEL = ['1-10', '11-25', '26-50', '51-90', '91-134'];
const bandBC = PRESTIGE_BANDS.map(() => 0), bandSigned = PRESTIGE_BANDS.map(() => 0);
const bandPrestige = PRESTIGE_BANDS.map(() => 0), bandTeams = PRESTIGE_BANDS.map(() => 0);
let pooledBC = 0, pooledSigned = 0;
let namedSample = [];         // one representative class, by program name
const persistR = [];
const stateSupply = {}, stateDemand = {};
let signed = 0, poolTotal = 0, haveSuitor = 0, signedOfSuitor = 0;

for (let wI = 0; wI < WORLDS; wI++) {
  const wseed = 20260814 + wI * 7919;
  const world = buildWorld(wseed);
  const byId = {}; world.forEach(t => byId[t.id] = t);
  world.forEach(t => stateDemand[t.homeState] = (stateDemand[t.homeState] || 0) + 1);

  const scoreByClass = [];    // [class][teamId] = classScore
  const bcByTeam = {};        // teamId -> [blue-chips per class]
  const sizeByTeam = {};

  for (let c = 0; c < CLASSES_PER_WORLD; c++) {
    const pool = runCycle(world, wseed ^ (0x51ed + c * 104729));
    poolTotal += pool.length;

    const cls = {};   // teamId -> recruits
    for (const rec of pool) {
      starMix[rec.stars] = (starMix[rec.stars] || 0) + 1;
      stateSupply[rec.st] = (stateSupply[rec.st] || 0) + 1;
      if (Object.keys(rec.iv).length) haveSuitor++;
      if (rec.signed) { signed++; if (Object.keys(rec.iv).length) signedOfSuitor++; }
      if (rec.committedTo) (cls[rec.committedTo] = cls[rec.committedTo] || []).push(rec);
    }

    const sc = {};
    for (const t of world) {
      const list = cls[t.id] || [];
      sc[t.id] = classScore(t, pool);
      const bc = list.filter(x => x.stars >= 4).length;
      (bcByTeam[t.id] = bcByTeam[t.id] || []).push(bc);
      (sizeByTeam[t.id] = sizeByTeam[t.id] || []).push(list.length);
      classSizes.push(list.length);
      if (list.length >= MIN_CLASS) {
        bcrAll.push(bc / list.length);
        inStateShares.push(list.filter(x => x.st === t.homeState).length / list.length);
      }
    }
    scoreByClass.push(sc);

    // concentration of blue-chips this class
    const byPrestige = [...world].sort((a, b) => b.prestige - a.prestige);
    const bcOf = t => (cls[t.id] || []).filter(x => x.stars >= 4).length;
    const bcCount = world.map(bcOf);
    const totalBC = sum(bcCount);
    if (totalBC) {
      top10Share.push(sum(byPrestige.slice(0, 10).map(bcOf)) / totalBC);
      top25Share.push(sum(byPrestige.slice(0, 25).map(bcOf)) / totalBC);
      giniAll.push(gini(bcCount));
      // NON-cumulative bands, so a top-heavy and a hollow-top distribution look different. The
      // cumulative pair above cannot tell them apart, which is how the inversion stayed invisible.
      PRESTIGE_BANDS.forEach(([lo, hi], k) => {
        bandBC[k] += sum(byPrestige.slice(lo, hi).map(bcOf));
        bandSigned[k] += sum(byPrestige.slice(lo, hi).map(t => (cls[t.id] || []).length));
        bandPrestige[k] += sum(byPrestige.slice(lo, hi).map(t => t.prestige));
        bandTeams[k] += (hi - lo);
      });
    }
    // where each star tier actually lands — the 4* market is the substance of a blue-chip class
    for (const rec of pool) {
      if (!rec.committedTo || !byId[rec.committedTo]) continue;
      (landPrestige[rec.stars] = landPrestige[rec.stars] || []).push(byId[rec.committedTo].prestige);
    }
    if (totalBC) { pooledBC += totalBC; pooledSigned += sum(world.map(t => (cls[t.id] || []).length)); }
    if (wI === 0 && c === 0) namedSample = byPrestige.slice(0, 10).map(t => ({
      abbr: t.abbr, p: t.prestige, n: (cls[t.id] || []).length, bc: bcOf(t),
    }));
  }

  // rolling 4-class blue-chip ratio per program
  for (const t of world) {
    const bcs = bcByTeam[t.id], szs = sizeByTeam[t.id];
    for (let i = 0; i + 4 <= bcs.length; i++) {
      const n = sum(szs.slice(i, i + 4));
      // a 4-year window has to hold a real roster's worth of signees to quote a ratio over
      if (n >= MIN_CLASS * 4) bcr4.push(sum(bcs.slice(i, i + 4)) / n);
    }
  }
  // class-score persistence between consecutive classes
  for (let i = 0; i + 1 < scoreByClass.length; i++) {
    const ids = world.map(t => t.id);
    persistR.push(pearson(ids.map(id => scoreByClass[i][id]), ids.map(id => scoreByClass[i + 1][id])));
  }
}

/* ---------- saturation: is the interest race decided before anyone acts? ----------
   Run one clean cycle with nobody acting and watch a good-fit program's seeded 4-star relationships.
   This is the mechanism behind the band table above: `recruitFit` decides who is on the board AND,
   through passive growth, who wins — so the weekly loop is operating on a settled number. */
let satTracked = 0, satWeek7 = 0, satPinned = 0;
(function () {
  const world = buildWorld(20260814);
  const pool = genRecruits(20260814 ^ 0x51ed, world);
  const him = world.find(t => t.prestige >= 66 && t.prestige <= 74) || world[30];
  const track = pool.filter(r => r.iv[him.id] != null && r.stars === 4).slice(0, 60);
  satTracked = track.length;
  for (let w = 1; w <= WEEKS; w++) {
    advanceRecruiting(pool, world, w, WEEKS, 20260814 ^ 0x51ed, w === WEEKS);
    if (w === 7) satWeek7 = track.filter(r => (r.iv[him.id] || 0) >= 68).length;
  }
  satPinned = track.filter(r => (r.iv[him.id] || 0) >= 99.9).length;
})();

/* ---------- report ---------- */
const pct = x => (100 * x).toFixed(1) + '%';
const nClasses = WORLDS * CLASSES_PER_WORLD;

say('SIDELINE recruiting — what the model produces');
say('='.repeat(64));
say(`worlds ${WORLDS} x ${CLASSES_PER_WORLD} classes = ${nClasses} national classes (${poolTotal.toLocaleString()} prospects)`);
say('');

say('SUPPLY — national star mix');
const totalStars = sum(Object.values(starMix));
[5, 4, 3, 2].forEach(s => say(`  ${s}*  ${String(Math.round(starMix[s] / nClasses)).padStart(5)}  ${pct(starMix[s] / totalStars)}`));
say(`  blue-chip (4-5*)          ${pct((starMix[5] + starMix[4]) / totalStars)}`);
say('');

const sorted = [...classSizes].sort((a, b) => a - b);
const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
say('CONVERGENCE');
say(`  signed / pool                 ${pct(signed / poolTotal)}`);
say(`  signed / has-a-suitor         ${pct(signedOfSuitor / haveSuitor)}`);
say(`  class size  mean ${mean(classSizes).toFixed(1)}   p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}   (cap 25)`);
say(`  programs signing < ${MIN_CLASS}         ${pct(classSizes.filter(n => n < MIN_CLASS).length / classSizes.length)}`);
say('');

say('DISTRIBUTION — the question this phase exists to answer');
say(`  blue-chip share of all signees  ${pct(pooledBC / pooledSigned)}   (pooled, the honest one)`);
say(`  blue-chip ratio, per class      mean ${pct(mean(bcrAll))}  (classes >= ${MIN_CLASS})`);
say(`  blue-chip ratio, rolling 4yr    mean ${pct(mean(bcr4))}   max ${pct(Math.max(...bcr4))}`);
const over50 = bcr4.filter(x => x >= 0.5).length;
say(`  program-windows at BCR >= 50%   ${over50} of ${bcr4.length}  (${pct(over50 / bcr4.length)})`);
say(`  Gini of blue-chips per team     ${mean(giniAll).toFixed(3)}`);
say('');
say('  WHERE the blue-chips go, by prestige band (non-cumulative):');
say('  band        teams  mean prestige   class size   share of blue-chips   BCR');
PRESTIGE_BANDS.forEach(([lo, hi], k) => {
  const teams = hi - lo;
  say(`  ${BAND_LABEL[k].padEnd(10)}${String(teams).padStart(6)}` +
    `${(bandPrestige[k] / bandTeams[k]).toFixed(1).padStart(15)}` +
    `${(bandSigned[k] / bandTeams[k]).toFixed(1).padStart(13)}` +
    `${pct(bandBC[k] / pooledBC).padStart(22)}` +
    `${pct(bandSigned[k] ? bandBC[k] / bandSigned[k] : 0).padStart(8)}`);
});
say('');
say('  ^ class size is the column to read first. Recruiting pull is a BAND-PASS filter centred on');
say('    the recruit\'s tier (recruitFit targets prestige 88/70/50/32 by star, and the suitor draw at');
say('    genRecruits has no over-tier floor at all) — so a program ABOVE a tier is penalised exactly');
say('    like one below it. The best programs in the country make almost nobody\'s board.');
say('  mean landing prestige by star tier:');
[5, 4, 3, 2].forEach(s => { if (landPrestige[s]) say(`    ${s}*   ${mean(landPrestige[s]).toFixed(1)}`); });
say('');
// name names — an aggregate hides which programs this actually happens to, and the whole point is
// that it happens to the ones nobody thinks to check
say('  THE TEN MOST PRESTIGIOUS PROGRAMS, one representative class:');
say('  team     prestige   signed   blue-chips');
namedSample.forEach(r => say(`  ${r.abbr.padEnd(9)}${String(r.p).padStart(8)}${String(r.n).padStart(9)}${String(r.bc).padStart(13)}`));
say('');

say('PERSISTENCE — does a program stay good at recruiting?');
say(`  class-score r, class N -> N+1  ${mean(persistR).toFixed(3)}`);
say('');

say('SATURATION — is the interest race actually a race?');
say(`  seeded 4* relationships tracked   ${satTracked}`);
say(`  past the commit bar (68) by wk 7  ${pct(satWeek7 / satTracked)}  on passive growth alone`);
say(`  pinned at the 100 ceiling by NSD  ${pct(satPinned / satTracked)}`);
say('  ^ passive growth is (1.0 + fit*3.2) * (0.6 + r()*0.9) per week. For a good-fit program that');
say('    is ~4.4/week from a seeded base near 46, against a commit threshold of 68 -- so the');
say('    relationship clears on its own by mid-season and pins at the ceiling before Signing Day.');
say('    Everything Phases 33-38 layered on (AI brain, NIL, league ripple, visits, pitch angles,');
say('    double-downs, diminishing returns) is moving a number that is already at its maximum.');
say('');

say('GEOGRAPHY');
say(`  in-state share of a class      ${pct(mean(inStateShares))}`);
const supplyPct = {}; const totSupply = sum(Object.values(stateSupply));
Object.keys(stateSupply).forEach(s => supplyPct[s] = stateSupply[s] / totSupply);
const demandRows = Object.entries(stateDemand).map(([s, n]) => ({
  st: s, programs: n / WORLDS, supply: supplyPct[s] || 0,
})).sort((a, b) => b.programs - a.programs).slice(0, 10);
say('  state          programs   recruit supply   supply per program');
for (const d of demandRows) {
  say(`  ${d.st.padEnd(6)}${String(d.programs).padStart(10)}${pct(d.supply).padStart(15)}` +
    `${(d.supply * 3400 / d.programs).toFixed(1).padStart(20)}`);
}
say('');
say('  (supply per program = in-state prospects available per FBS program in that state)');

const report = out.join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'simrec-report.txt'), report);
fs.writeFileSync(path.join(__dirname, 'simrec-profile.json'), JSON.stringify({
  worlds: WORLDS, classes: nClasses,
  starMix, signRate: signed / poolTotal, signRateOfSuitor: signedOfSuitor / haveSuitor,
  classSizeMean: mean(classSizes),
  smallClassShare: classSizes.filter(n => n < MIN_CLASS).length / classSizes.length,
  bcrPooled: pooledBC / pooledSigned,
  bcrMean: mean(bcrAll), bcr4Mean: mean(bcr4), bcr4Max: Math.max(...bcr4),
  bcr4Over50: over50 / bcr4.length,
  top10Share: mean(top10Share), top25Share: mean(top25Share), giniBlueChip: mean(giniAll),
  bands: PRESTIGE_BANDS.map(([lo, hi], k) => ({
    band: BAND_LABEL[k], teams: hi - lo, meanPrestige: bandPrestige[k] / bandTeams[k],
    classSize: bandSigned[k] / bandTeams[k],
    blueChipShare: bandBC[k] / pooledBC, bcr: bandSigned[k] ? bandBC[k] / bandSigned[k] : 0,
  })),
  landingPrestige: Object.fromEntries([5, 4, 3, 2].filter(s => landPrestige[s]).map(s => [s, mean(landPrestige[s])])),
  persistence: mean(persistR), inStateShare: mean(inStateShares),
  stateSupply: supplyPct, stateDemand,
}, null, 2));
console.log('\nwrote simrec-report.txt + simrec-profile.json');

/* Step 25 — fit the Phase 57b talent-economy constants against the measured distribution.

   The constants interact (a steeper PULL_W concentrates blue-chips, which starves the mid-tier,
   which changes how many programs fill a class, which changes the sign rate), so they are fitted by
   alternating coordinate passes rather than one grid — the same shape as 15-penfit.js.

   Objective, from docs/reference/cfb-recruiting.md §2-3. Each term is scaled by what a meaningful
   error looks like FOR THAT METRIC, so no single one dominates by unit accident:

     top-10 band's share of blue-chips   40.3%     <- the headline; the band-pass defect lived here
     top-10 band's class BCR             69.6%
     blue-chip share of all signees      15.3%     <- catches blue-chips going unsigned
     ranked-board FBS sign rate          67.4%
     programs signing under 10            3.3%     <- catches a band that cannot fill
     class-size spread across bands       3.6      <- real is FLAT: 23.5 at the top, 19.9 at the bottom
     Gini of blue-chips per team         0.772
     4-year windows at BCR >= 50%        11.8%

   Run:  node tools/cfb-data/25-recfit.js
         PASSES=3 WORLDS=2 node tools/cfb-data/25-recfit.js       */

const fs = require('fs');
const path = require('path');

const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const html = fs.readFileSync(process.env.INDEX || path.join(__dirname, '..', '..', 'index.html'), 'utf8');
function grabConst(name) {
  const decl = 'const ' + name + '=';
  const i = html.indexOf('\n' + decl);
  if (i < 0) throw new Error('missing ' + decl);
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
const POS = grabConst('POS'), STATES = grabConst('STATES'), FN = grabConst('FN'), LN = grabConst('LN');
const PREFS = grabConst('PREFS'), TEAMS = grabConst('TEAMS'), TEAM_STATE = grabConst('TEAM_STATE');
const CONF_BASE = grabConst('CONF_BASE'), BUMP = grabConst('BUMP');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) throw new Error('missing ' + a); return html.slice(i, j); };
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
eval(grab('// === ATTRIBUTE ENGINE (Phase 52) START ===', '// === ATTRIBUTE ENGINE (Phase 52) END ==='));
// 15-penfit.js:26's trick — `const REC` does not survive a sloppy eval, so return it as an
// expression. Same object the fence's functions closed over, so mutating it retunes them in place.
const REC = eval(grab('// === RECRUIT ENGINE (Phase 4) START ===', '// === RECRUIT ENGINE (Phase 4) END ===') + '\n;REC');

function buildWorld(seed) {
  const r = rng(seed);
  return TEAMS.map(([name, nick, abbr, conf]) => {
    const prestige = clamp(Math.round((CONF_BASE[conf] || 45) + (BUMP[name] || 0) + ri(r, -7, 7)), 20, 98);
    return {
      id: abbr.toLowerCase().replace(/[^a-z0-9]/g, ''), abbr, prestige, needs: {},
      homeState: TEAM_STATE[abbr] || pick(r, STATES),
      fac: { nil: clamp(Math.round(prestige / 10) + ri(r, -2, 1), 1, 10), academics: clamp(ri(r, 3, 9), 1, 10), scouting: clamp(Math.round(prestige / 11) + ri(r, -1, 1), 1, 10) },
    };
  });
}

const TARGET = {
  bcTop10: 40.3, bcrTop10: 69.6, bcShare: 15.3, signRate: 67.4,
  smallClass: 3.3, sizeSpread: 3.6, gini: 0.772, over50: 11.8,
};
/* what a "one unit of wrong" looks like for each metric — keeps the objective commensurate */
const SCALE = { bcTop10: 8, bcrTop10: 10, bcShare: 3, signRate: 5, smallClass: 3, sizeSpread: 4, gini: 0.06, over50: 4 };

const WORLDS = +(process.env.WORLDS || 2);
const CLASSES = 4;
const MIN_CLASS = 10;
const BANDS = [[0, 10], [10, 25], [25, 50], [50, 90], [90, 134]];
const sum = a => a.reduce((x, y) => x + y, 0);
function gini(v) {
  const a = [...v].sort((x, y) => x - y), n = a.length, t = sum(a);
  if (!n || !t) return 0;
  let acc = 0; for (let i = 0; i < n; i++) acc += (i + 1) * a[i];
  return (2 * acc) / (n * t) - (n + 1) / n;
}

function measure() {
  let pool_ = 0, signed_ = 0, bcSigned = 0, allSigned = 0, small = 0, teamClasses = 0;
  const bandBC = BANDS.map(() => 0), bandN = BANDS.map(() => 0), bandT = BANDS.map(() => 0);
  const ginis = [], bcr4 = [];
  for (let w = 0; w < WORLDS; w++) {
    const wseed = 20260814 + w * 7919;
    const world = buildWorld(wseed);
    const hist = {};
    for (let c = 0; c < CLASSES; c++) {
      const seed = wseed ^ (0x51ed + c * 104729);
      const pool = genRecruits(seed, world);
      for (let k = 1; k <= 15; k++) advanceRecruiting(pool, world, k, 15, seed, k === 15);
      pool_ += pool.length; signed_ += pool.filter(r => r.signed).length;
      const cls = {}; pool.forEach(r => { if (r.committedTo) (cls[r.committedTo] = cls[r.committedTo] || []).push(r); });
      const byP = [...world].sort((a, b) => b.prestige - a.prestige);
      const bcOf = t => (cls[t.id] || []).filter(x => x.stars >= 4).length;
      BANDS.forEach(([lo, hi], k) => {
        bandBC[k] += sum(byP.slice(lo, hi).map(bcOf));
        bandN[k] += sum(byP.slice(lo, hi).map(t => (cls[t.id] || []).length));
        bandT[k] += (hi - lo);
      });
      world.forEach(t => {
        const n = (cls[t.id] || []).length;
        teamClasses++; if (n < MIN_CLASS) small++;
        allSigned += n; bcSigned += bcOf(t);
        (hist[t.id] = hist[t.id] || []).push({ bc: bcOf(t), n });
      });
      ginis.push(gini(world.map(bcOf)));
    }
    for (const id in hist) {
      const h = hist[id];
      const n = sum(h.map(x => x.n));
      if (n >= MIN_CLASS * 4) bcr4.push(sum(h.map(x => x.bc)) / n);
    }
  }
  const sizes = BANDS.map((b, k) => bandN[k] / bandT[k]);
  return {
    bcTop10: 100 * bandBC[0] / Math.max(1, sum(bandBC)),
    bcrTop10: 100 * bandBC[0] / Math.max(1, bandN[0]),
    bcShare: 100 * bcSigned / Math.max(1, allSigned),
    signRate: 100 * signed_ / pool_,
    smallClass: 100 * small / teamClasses,
    sizeSpread: Math.max(...sizes) - Math.min(...sizes),
    gini: sum(ginis) / ginis.length,
    over50: 100 * bcr4.filter(x => x >= 0.5).length / Math.max(1, bcr4.length),
  };
}
function cost(m) { return Object.keys(TARGET).reduce((s, k) => s + Math.pow((m[k] - TARGET[k]) / SCALE[k], 2), 0); }

/* the knobs, and the values to try for each */
const KNOBS = [
  ['PULL_W', [8, 11, 14, 17, 21, 26]],
  ['SUIT_NOISE', [0.35, 0.55, 0.8, 1.1, 1.5]],
  ['OVER_FLOOR', [0.15, 0.3, 0.45, 0.6, 0.8]],
  ['OVER_W', [30, 45, 60, 85, 120]],
  ['CEIL_BASE', [30, 38, 45, 52, 60]],
  ['PASSIVE_RATE', [0.10, 0.14, 0.18, 0.24, 0.32]],
  ['TGT_MEAN', [18.5, 20.0, 21.5, 23.0]],
  ['TGT_SD', [2.5, 4.0, 5.5]],
  ['AI_VALUE', [0.06, 0.10, 0.15, 0.22, 0.32]],
];
const PASSES = +(process.env.PASSES || 2);

let best = measure(), bestCost = cost(best);
const show = m => Object.keys(TARGET).map(k => `${k} ${m[k].toFixed(k === 'gini' ? 3 : 1)}`).join('  ');
console.log('start   cost ' + bestCost.toFixed(2));
console.log('        ' + show(best) + '\n');

for (let p = 0; p < PASSES; p++) {
  for (const [name, values] of KNOBS) {
    const start = REC[name];
    let localBest = start, localCost = bestCost;
    for (const v of values) {
      if (v === start) continue;
      REC[name] = v;
      const m = measure(), c = cost(m);
      if (c < localCost) { localCost = c; localBest = v; best = m; }
    }
    REC[name] = localBest;
    if (localCost < bestCost) {
      bestCost = localCost;
      console.log(`pass ${p + 1}  ${name.padEnd(13)} ${String(start).padStart(6)} -> ${String(localBest).padStart(6)}   cost ${bestCost.toFixed(2)}`);
    }
  }
}

const final = measure();
console.log('\nFITTED CONSTANTS');
KNOBS.forEach(([n]) => console.log(`  ${n.padEnd(14)} ${REC[n]}`));
console.log('\n  metric            target     fitted');
Object.keys(TARGET).forEach(k => {
  const d = k === 'gini' ? 3 : 1;
  console.log(`  ${k.padEnd(16)} ${TARGET[k].toFixed(d).padStart(7)}  ${final[k].toFixed(d).padStart(9)}`);
});
console.log(`\n  cost ${cost(final).toFixed(2)}`);
fs.writeFileSync(path.join(__dirname, 'recfit-result.txt'),
  'Phase 57b fitted constants\n' + KNOBS.map(([n]) => `  ${n} = ${REC[n]}`).join('\n') +
  '\n\n  metric            target     fitted\n' +
  Object.keys(TARGET).map(k => { const d = k === 'gini' ? 3 : 1; return `  ${k.padEnd(16)} ${TARGET[k].toFixed(d).padStart(7)}  ${final[k].toFixed(d).padStart(9)}`; }).join('\n') +
  `\n\n  cost ${cost(final).toFixed(2)}\n`);

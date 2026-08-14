/* Step 24 — fit REC.GEO_SUIT / REC.GEO_FIT against the measured in-state share.

   Phase 57a. Replacing the uniform `pick(r,STATES)` draw with the real state weights
   (cfb-recruiting.md §5) exposed a compensating error: the home-state pull, hand-set at 0.3 in the
   suitor draw and 0.10 in `recruitFit`, had been tuned against a world where Texas produced 2% of
   the country's talent. With real weights the same constants over-shoot to a 45.4% in-state class
   against a measured 36.8%. Two errors that had been cancelling; fixing the mechanism exposed the
   parameter, which is the usual order.

   Sweeps the pair over a grid, running full cycles on the real-geography world, and prints the
   combination closest to target. Costs a few minutes.

   Run:  node tools/cfb-data/24-geofit.js
         TARGET=36.8 GRID=fine node tools/cfb-data/24-geofit.js */

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
/* `const REC` inside the fence does not survive a sloppy eval into this scope (the trap CLAUDE.md
   records). 15-penfit.js:26's trick gets it out: append the identifier so the eval RETURNS it. It is
   the same object the fence's functions closed over, so mutating it here retunes them in place. */
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

const TARGET = +(process.env.TARGET || 36.8);
const MIN_CLASS = 10;
const WORLDS = +(process.env.WORLDS || 3);

/* in-state share of a class, averaged over real-geography worlds, at a given (suit, fit) pair */
function measure(suit, fitW) {
  REC.GEO_SUIT = suit; REC.GEO_FIT = fitW;
  const shares = [];
  for (let w = 0; w < WORLDS; w++) {
    const seed = 20260814 + w * 7919;
    const world = buildWorld(seed);
    const pool = genRecruits(seed, world);
    for (let k = 1; k <= 15; k++) advanceRecruiting(pool, world, k, 15, seed, k === 15);
    const cls = {}; pool.forEach(r => { if (r.committedTo) (cls[r.committedTo] = cls[r.committedTo] || []).push(r); });
    for (const t of world) {
      const list = cls[t.id] || [];
      if (list.length >= MIN_CLASS) shares.push(list.filter(p => p.st === t.homeState).length / list.length);
    }
  }
  return 100 * shares.reduce((a, b) => a + b, 0) / shares.length;
}

const suits = process.env.GRID === 'fine'
  ? [0.05, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20]
  : [0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
const fits = process.env.GRID === 'fine'
  ? [0.02, 0.04, 0.05, 0.06, 0.08, 0.10]
  : [0.00, 0.03, 0.06, 0.10];

console.log(`fitting REC.GEO_SUIT / REC.GEO_FIT against a measured ${TARGET}% in-state class`);
console.log(`(${WORLDS} real-geography worlds per cell)\n`);
console.log('  GEO_SUIT  GEO_FIT   in-state %   off target');
const results = [];
for (const s of suits) for (const f of fits) {
  const got = measure(s, f);
  results.push({ s, f, got, off: Math.abs(got - TARGET) });
  console.log(`  ${s.toFixed(2).padStart(8)}  ${f.toFixed(2).padStart(7)}   ${got.toFixed(1).padStart(10)}   ${(got - TARGET > 0 ? '+' : '') + (got - TARGET).toFixed(1)}`);
}
results.sort((a, b) => a.off - b.off);
const best = results[0];
console.log(`\nBEST: GEO_SUIT ${best.s.toFixed(2)}  GEO_FIT ${best.f.toFixed(2)}  ->  ${best.got.toFixed(1)}% in-state (target ${TARGET}%)`);
console.log('runners-up: ' + results.slice(1, 4).map(r => `${r.s}/${r.f} → ${r.got.toFixed(1)}%`).join('   '));
fs.writeFileSync(path.join(__dirname, 'geofit-result.txt'),
  `target ${TARGET}% in-state\nbest GEO_SUIT ${best.s} GEO_FIT ${best.f} -> ${best.got.toFixed(1)}%\n\n` +
  results.map(r => `  ${r.s.toFixed(2)}  ${r.f.toFixed(2)}  ${r.got.toFixed(1)}%`).join('\n') + '\n');

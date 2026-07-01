/* Sideline REALIGN LAB — standalone harness for the Phase 43 conference-realignment engine.

   The realign engine lives in index.html (single source of truth). This harness EXTRACTS the engine
   block (between the REALIGN ENGINE markers) and evals it here with the same rng/hashStr, then validates
   the pure model offline: waves fire on a seeded cadence (~CHANCE of years, deterministic); a wave poaches
   the strongest available RISERS from weaker leagues UP into the power conferences; moves are bounded,
   never drop a source conference below its floor, never push a poacher past its cap; a settled/capped world
   produces no moves; and the whole thing is deterministic by (seed, year). The in-browser QA gate validates
   the integrated rollover (team.conf actually changes; the recap + media surface it).

   Run:  node test/realignlab.js */

const fs = require('fs');
const path = require('path');

/* helpers the engine reads (must match index.html) */
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === REALIGN ENGINE (Phase 43) START ===';
const END = '// === REALIGN ENGINE (Phase 43) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find REALIGN ENGINE markers in index.html'); process.exit(2); }
// Functions leak out of sloppy eval; the REALIGN const does not — return it via a trailing expression.
const { REALIGN } = eval(html.slice(i0, i1) + '\n;({REALIGN})');

const results = [];
function check(name, cond, detail = '') { results.push({ pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

/* a synthetic world: 4 strong "power" conferences + 3 weaker leagues, with high-prestige RISERS stranded
   in the weak leagues (the teams a wave should pull up). */
function makeWorld() {
  const teams = [];
  const add = (conf, arr) => arr.forEach((p, i) => teams.push({ id: conf.replace(/\s/g, '') + i, conf, prestige: p }));
  add('SEC', [90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79]);      // avg ~84.5 — power
  add('Big Ten', [88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77]);  // avg ~82.5 — power
  add('ACC', [78, 77, 76, 74, 72, 71, 70, 69, 68, 67, 66, 65]);      // avg ~71   — power
  add('Big 12', [76, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64]);   // avg ~69.6 — power
  add('American', [83, 81, 79, 54, 53, 52, 51, 50, 50, 49, 49, 48]); // avg ~57 (weak) but 3 stranded 79-83 RISERS
  add('Sun Belt', [68, 66, 64, 62, 60, 58, 56, 54, 52, 50]);         // avg ~59 — top 68 < bar, no risers
  add('MAC', [60, 58, 56, 54, 52, 50, 48, 46, 44, 42]);
  return teams;
}
/* find a realignment year + a non-realignment year for a seed */
function findYears(seed) {
  let on = null, off = null;
  for (let y = 2026; y < 2126 && (on === null || off === null); y++) { if (isRealignYear(seed, y)) { if (on === null) on = y; } else if (off === null) off = y; }
  return { on, off };
}

const SEED = 20260630;
const { on, off } = findYears(SEED);

// 1) cadence — waves fire on some years, not others, at ~CHANCE frequency, deterministically
check('There exist both realignment years and quiet years', on !== null && off !== null, `on=${on}, off=${off}`);
let hits = 0; for (let y = 2026; y < 2226; y++) if (isRealignYear(SEED, y)) hits++;
check('Realignment fires at roughly the configured rate', hits / 200 > REALIGN.CHANCE - 0.12 && hits / 200 < REALIGN.CHANCE + 0.12, `${(hits / 200).toFixed(2)} vs ${REALIGN.CHANCE}`);
check('isRealignYear is deterministic', isRealignYear(SEED, on) === isRealignYear(SEED, on) && isRealignYear(SEED, off) === false);

// 2) a quiet year yields no moves
check('No moves on a non-realignment year', realignMoves(makeWorld(), SEED, off).length === 0);

// 3) a wave poaches risers UP into the power tier
const moves = realignMoves(makeWorld(), SEED, on);
const world = makeWorld();
const confOf = {}, prestigeOf = {}; world.forEach(t => { confOf[t.id] = t.conf; prestigeOf[t.id] = t.prestige; });
const powerNames = ['SEC', 'Big Ten', 'ACC', 'Big 12'];
check('A wave produces moves', moves.length > 0, moves.map(m => m.from + '→' + m.to).join(', '));
check('Moves are bounded by MAX_MOVES', moves.length <= REALIGN.MAX_MOVES, moves.length + ' moves');
check('Every move lands in a power conference', moves.every(m => powerNames.includes(m.to)));
check('Every move comes FROM a weaker (non-power) league', moves.every(m => !powerNames.includes(m.from)));
check('Every poached team clears the prestige bar', moves.every(m => prestigeOf[m.id] >= REALIGN.POACH_BAR));
check('The American risers (80+) are the ones getting pulled up', moves.some(m => m.from === 'American'));
check('No team is moved twice in a wave', new Set(moves.map(m => m.id)).size === moves.length);

// 4) constraints: source floor + poacher cap respected after applying the wave
const size = {}; world.forEach(t => size[t.conf] = (size[t.conf] || 0) + 1);
moves.forEach(m => { size[m.from]--; size[m.to]++; });
check('No source conference is left below the floor', Object.keys(size).every(c => c === 'Independent' || size[c] >= REALIGN.MIN_CONF), JSON.stringify(size));
check('No power conference exceeds the cap', powerNames.every(c => size[c] <= REALIGN.POWER_CAP));

// 5) determinism
check('realignMoves is deterministic by (seed, year)', JSON.stringify(realignMoves(makeWorld(), SEED, on)) === JSON.stringify(realignMoves(makeWorld(), SEED, on)));

// 6) a settled world (all risers already in power confs) produces no moves even on a wave year
const settled = makeWorld().map(t => (t.prestige >= REALIGN.POACH_BAR && !powerNames.includes(t.conf)) ? Object.assign({}, t, { prestige: 55 }) : t);
check('A settled league (no eligible risers) produces no moves', realignMoves(settled, SEED, on).length === 0);

// 7) Independent can be raided but is never a destination
const withInd = makeWorld().concat([{ id: 'IndND', conf: 'Independent', prestige: 95 }]);
const indMoves = realignMoves(withInd, SEED, on);
check('Independent is never a destination', indMoves.every(m => m.to !== 'Independent'));

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} realign-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

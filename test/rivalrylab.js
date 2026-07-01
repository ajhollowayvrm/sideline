/* Sideline RIVALRY LAB — standalone harness for the Phase 40 rivalry engine.

   The rivalry engine lives in index.html (single source of truth). This harness EXTRACTS the engine
   block (between the RIVALRY ENGINE markers) and evals it here with the same tiny helpers, then
   validates the pure model offline: intensity gain rises with close games / ranked clashes / big
   stages / upsets and is bounded; the "born" bar behaves (one game can't birth a rivalry, a couple of
   instant classics or many routine meetings can); tier labels ladder; the preset table is well-formed;
   emergent names/trophies are deterministic + non-empty. The in-browser QA gate validates the
   integrated flow (trophies change hands, a rivalry is born, the amplification hooks).

   Run:  node test/rivalrylab.js */

const fs = require('fs');
const path = require('path');

/* ---------- helpers the engine reads (must match index.html) ---------- */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function hashStr(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

/* ---------- extract the RIVALRY ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === RIVALRY ENGINE (Phase 40) START ===';
const END = '// === RIVALRY ENGINE (Phase 40) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find RIVALRY ENGINE markers in index.html'); process.exit(2); }
// Function declarations leak out of (sloppy) eval into module scope, so rivalryKey/rivalryGain/
// bornRivalry/intensityTier are usable directly. `const` bindings do NOT leak, so return the consts
// we assert against via a trailing expression that's still inside the engine's scope.
const { RIVALRIES, RIVALRY_BORN, RIVALRY_TIERS } = eval(html.slice(i0, i1) + '\n;({RIVALRIES,RIVALRY_BORN,RIVALRY_TIERS})');

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

// 1) pair key is canonical + symmetric
check('rivalryKey is symmetric', rivalryKey('a', 'b') === rivalryKey('b', 'a'));
check('rivalryKey is canonical (sorted)', rivalryKey('zzz', 'aaa') === 'aaa|zzz');

// 2) rivalryGain — direction: close > blowout, ranked adds, big stage adds, upset adds; bounded
const blowoutReg = rivalryGain({ marginAbs: 35, stage: 'reg' });
const closeReg = rivalryGain({ marginAbs: 3, stage: 'reg' });
const rankedReg = rivalryGain({ marginAbs: 10, stage: 'reg', bothRanked: true });
const plainReg = rivalryGain({ marginAbs: 10, stage: 'reg' });
const closePlayoff = rivalryGain({ marginAbs: 3, stage: 'playoff', bothRanked: true, upset: true });
check('Gain: a nailbiter heats more than a blowout', closeReg > blowoutReg, `${closeReg} vs ${blowoutReg}`);
check('Gain: a ranked clash adds heat', rankedReg > plainReg, `${rankedReg} vs ${plainReg}`);
check('Gain: a bigger stage adds heat', rivalryGain({ marginAbs: 10, stage: 'playoff' }) > rivalryGain({ marginAbs: 10, stage: 'reg' }));
check('Gain: bowl < champ < playoff (stage ladder)',
  rivalryGain({ stage: 'bowl' }) < rivalryGain({ stage: 'champ' }) && rivalryGain({ stage: 'champ' }) < rivalryGain({ stage: 'playoff' }));
check('Gain: an upset adds heat', rivalryGain({ marginAbs: 10, stage: 'reg', upset: true }) > plainReg);
check('Gain: a close ranked playoff meeting is near the top', closePlayoff >= 20, `${closePlayoff}`);
check('Gain: always bounded [2,22]', [{}, { marginAbs: 0, stage: 'playoff', bothRanked: true, upset: true, late: true }, { marginAbs: 99, stage: 'reg' }]
  .every(c => { const g = rivalryGain(c); return g >= 2 && g <= 22; }));

// 3) the "born" bar — one routine game can't birth a rivalry; a couple of big ones (or many routine) can
const routine = () => rivalryGain({ marginAbs: 24, stage: 'reg' });
const classic = rivalryGain({ marginAbs: 3, stage: 'reg', bothRanked: true });   // a close ranked reg-season nailbiter
check('Born bar > a single routine game (needs sustained/big heat)', routine() < RIVALRY_BORN, `routine ${routine()} < bar ${RIVALRY_BORN}`);
check('Born bar needs sustained heat (a couple of classics is not enough)', classic * 2 < RIVALRY_BORN, `${classic}×2=${classic * 2} < ${RIVALRY_BORN}`);
check('Born bar clears after ~4 ranked classics (playing a lot in big moments)', classic * 4 >= RIVALRY_BORN, `${classic}×4=${classic * 4} ≥ ${RIVALRY_BORN}`);
let acc = 0, games = 0; while (acc < RIVALRY_BORN && games < 40) { acc += routine(); games++; }
check('A pile of routine meetings eventually crosses the bar', games >= 4 && games <= 20, `${games} routine games to born`);

// 4) tiers ladder up with intensity, in order
check('intensityTier ladders Simmering→…→Blood Feud',
  intensityTier(20) === RIVALRY_TIERS[0] && intensityTier(50) === RIVALRY_TIERS[1] &&
  intensityTier(70) === RIVALRY_TIERS[2] && intensityTier(90) === RIVALRY_TIERS[3]);
check('intensityTier is monotonic', [10, 45, 66, 88].map(intensityTier).every((t, i, a) => i === 0 || RIVALRY_TIERS.indexOf(t) >= RIVALRY_TIERS.indexOf(a[i - 1])));

// 5) preset table is well-formed (two distinct abbrs, a name; trophy optional)
check('Preset table non-empty', RIVALRIES.length >= 20, RIVALRIES.length + ' rivalries');
check('Every preset has two distinct abbrs + a name', RIVALRIES.every(r => r[0] && r[1] && r[0] !== r[1] && r[2] && r[2].length));
check('No duplicate preset pairs', new Set(RIVALRIES.map(r => rivalryKey(r[0], r[1]))).size === RIVALRIES.length);
check('Iron Bowl + Egg Bowl are in the table', RIVALRIES.some(r => r[2] === 'Iron Bowl') && RIVALRIES.some(r => r[3] === 'Golden Egg'));

// 6) emergent name/trophy — deterministic, non-empty, and varies by pair
const b1 = bornRivalry('MEM', 'TUL', 12345), b1b = bornRivalry('TUL', 'MEM', 12345), b2 = bornRivalry('BSU', 'FRES', 12345);
check('bornRivalry is deterministic + order-independent', JSON.stringify(b1) === JSON.stringify(b1b), JSON.stringify(b1));
check('bornRivalry yields a non-empty name + trophy', b1.name && b1.name.length > 0 && b1.trophy && b1.trophy.length > 0);
check('bornRivalry varies by pair', b1.trophy !== b2.trophy || b1.name !== b2.name);
check('bornRivalry name references both teams', b1.name.includes('MEM') && b1.name.includes('TUL'));

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} rivalry-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

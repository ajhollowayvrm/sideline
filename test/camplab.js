/* Sideline CAMP LAB — standalone harness for the Phase 32 offseason training-camp engine.

   The camp engine lives in index.html (single source of truth). This harness EXTRACTS the CAMP
   ENGINE block (between the markers) — plus the one SIM-block helper it leans on (injDur) — and
   evals it here with the same tiny helpers, then asserts the model is sane: the intensity dial
   trades development against injury + burnout risk, harder camps hurt more, light camp is risk-free,
   injuries are bounded + reference real players, and the whole thing is deterministic by seed.

   Run:  node test/camplab.js

   Offline lab (no browser). The in-browser QA gate (npm run qa) validates the integrated camp flow
   (dev boost via devRateFor, camp injuries onto the rolled-over roster, the morale seed at kickoff);
   this validates the pure model itself. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- extract the engine bits from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// injDur (defined in the SIM block) is the severity roll campInjuries reuses — pull just that line in.
const injMatch = html.match(/function injDur\(r\)\{[^\n]*\}/);
if (!injMatch) { console.error('Could not find injDur in index.html'); process.exit(2); }
eval(injMatch[0]);   // leaks injDur
const START = '// === CAMP ENGINE (Phase 32) START ===';
const END = '// === CAMP ENGINE (Phase 32) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find CAMP ENGINE markers in index.html'); process.exit(2); }
// const declarations don't leak from a direct eval (only functions do), so re-export within the same
// eval scope onto globalThis — keeps index.html the single source of truth for the table + the math.
eval(html.slice(i0, i1) + '\nObject.assign(globalThis,{CAMP_PLANS,campPlan,campDevMult,campMoraleSeed,campInjuries});');

/* ---------- a faithful-enough roster (id/pos/fn/ln are all campInjuries reads) ---------- */
const POSC = ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'];
function genRoster(r, n) {
  const out = [];
  for (let i = 0; i < (n || 84); i++) out.push({ id: 'p' + i.toString(36) + '_' + Math.floor(r() * 1e6).toString(36), pos: POSC[i % POSC.length], fn: 'First', ln: 'Last' + i });
  return out;
}

/* ---------- harness ---------- */
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? '  — ' + extra : '')); } }

console.log('\nSideline CAMP LAB\n');

/* --- plan table shape & ordering --- */
const light = campPlan('light'), normal = campPlan('normal'), grue = campPlan('grueling');
check('three intensity plans exist', CAMP_PLANS.length === 3 && light && normal && grue);
check('development scales with intensity (grueling > normal > light)',
  grue.devMult > normal.devMult && normal.devMult > light.devMult, `${light.devMult}/${normal.devMult}/${grue.devMult}`);
check('all plans develop at least as fast as no camp (devMult >= 1)',
  CAMP_PLANS.every(p => p.devMult >= 1));
check('campDevMult returns the plan multiplier', campDevMult('grueling') === grue.devMult);
check('unknown plan key falls back to Standard (normal)', campPlan('bogus') === normal && campDevMult('bogus') === normal.devMult);

/* --- injury risk monotonic, light is risk-free --- */
check('light camp carries no injury risk (injRate 0)', light.injRate === 0);
check('injury risk rises with intensity (light <= normal < grueling)',
  light.injRate <= normal.injRate && normal.injRate < grue.injRate, `${light.injRate}/${normal.injRate}/${grue.injRate}`);

/* --- morale seed: fresh / neutral / worn --- */
check('light camp opens the room fresh (moraleSeed > 0)', campMoraleSeed('light') > 0);
check('standard camp is morale-neutral (0)', campMoraleSeed('normal') === 0);
check('grueling camp opens the room worn down (moraleSeed < 0)', campMoraleSeed('grueling') < 0);

/* --- campInjuries: light is always injury-free --- */
let lightInj = 0;
for (let s = 0; s < 200; s++) lightInj += campInjuries(genRoster(rng(s + 1), 84), 'light', rng((s + 1) * 7 + 3)).length;
check('a light camp never produces an injury (over 200 rosters)', lightInj === 0, `${lightInj} injuries`);

/* --- campInjuries: grueling hurts more than standard, on average --- */
let nTot = 0, gTot = 0, N = 600;
for (let s = 0; s < N; s++) {
  const ros = genRoster(rng(s + 100), 84);
  nTot += campInjuries(ros, 'normal', rng(s * 13 + 5)).length;
  gTot += campInjuries(ros, 'grueling', rng(s * 13 + 5)).length;
}
check('a grueling camp injures more players than a standard one (avg)', gTot > nTot, `normal ${(nTot / N).toFixed(2)}/team, grueling ${(gTot / N).toFixed(2)}/team`);
check('grueling camp injuries stay realistic (~1–6/team avg)', gTot / N > 0.5 && gTot / N < 6, `${(gTot / N).toFixed(2)}/team`);

/* --- injuries are bounded, positive, and reference real roster players --- */
let bad = 0, idMiss = 0, samples = 0;
for (let s = 0; s < 300; s++) {
  const ros = genRoster(rng(s + 1), 84), ids = new Set(ros.map(p => p.id));
  campInjuries(ros, 'grueling', rng(s * 9 + 2)).forEach(it => {
    samples++;
    if (!(it.weeks >= 1 && it.weeks <= 8)) bad++;
    if (!ids.has(it.id)) idMiss++;
  });
}
check('camp injuries have a positive, bounded duration (1–8 weeks)', samples > 0 && bad === 0, `${bad}/${samples} out of range`);
check('every camp injury references a real roster player', idMiss === 0, `${idMiss} dangling ids`);
check('camp injuries carry name + pos for the recap', (() => {
  const it = (() => { for (let s = 0; s < 100; s++) { const c = campInjuries(genRoster(rng(s + 1), 84), 'grueling', rng(s * 5 + 1)); if (c.length) return c[0]; } return null; })();
  return it && typeof it.name === 'string' && it.pos && it.weeks > 0;
})());

/* --- determinism: same roster + same seed → identical result --- */
const ros1 = genRoster(rng(42), 84);
const a = campInjuries(ros1, 'grueling', rng(777));
const b = campInjuries(ros1, 'grueling', rng(777));
check('campInjuries is deterministic by seed', JSON.stringify(a) === JSON.stringify(b));

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);

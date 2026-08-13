/* Sideline TRAIT LAB — standalone harness for the Phase 10 player-personality engine.

   The trait engine lives in index.html (single source of truth). This harness EXTRACTS the
   engine block (between the TRAIT ENGINE markers) and evals it here with the same tiny helpers,
   then asserts the two traits behave as designed:
     - genTraits is centered (~50), bell-shaped (tails rare), and deterministic by seed;
     - motor (mot) maps to a bounded, monotonic development multiplier, and — fed through the
       REAL developPlayer (extracted too) — a high-motor cohort out-develops a low-motor one
       without ever exceeding the ceiling;
     - composure (comp) reshapes per-play yardage draws MEAN-PRESERVINGLY: lower comp widens the
       spread (boom/bust), higher comp tightens it, and at comp==50 the reshape is the identity
       (so the pre-Phase-10 sim is byte-identical and the simlab envelopes are untouched);
     - clutch is small, signed, and bounded.

   Run:  node test/traitlab.js

   Offline lab (no browser). The in-browser QA gate (npm run qa) validates the integrated trait
   surfacing/fog end-to-end; this validates the model itself. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const FN = ['Jaylen', 'Marcus', 'Cole', 'Tyler', 'Devon', 'Isaiah', 'Cam', 'Brock', 'Khalil', 'Trey'];
const LN = ['Carter', 'Williams', 'Hayes', 'Brooks', 'Robinson', 'Bennett', 'Foster', 'Reed', 'Walker', 'Diaz'];
const STATES = ['AL', 'CA', 'FL', 'GA', 'LA', 'OH', 'TX', 'MI', 'PA', 'NC'];

/* ---------- extract the TRAIT + ROLLOVER engine blocks from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function block(start, end, label) {
  const i0 = html.indexOf(start), i1 = html.indexOf(end);
  if (i0 < 0 || i1 < 0) { console.error('Could not find ' + label + ' markers in index.html'); process.exit(2); }
  return html.slice(i0, i1);
}
eval(block('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ===', 'TRAIT ENGINE'));
// Phase 51: development now grows the six-attribute profile and reads `ov` back off it.
eval(block('// === ATTRIBUTE ENGINE (Phase 51) START ===', '// === ATTRIBUTE ENGINE (Phase 51) END ===', 'ATTRIBUTE ENGINE'));
// developPlayer (+ DEV_YOUTH/NEXT_CLASS) — the real growth model the motor multiplier feeds.
eval(block('// === ROLLOVER ENGINE (Phase 5) START ===', '// === ROLLOVER ENGINE (Phase 5) END ===', 'ROLLOVER ENGINE'));

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const vari = a => { const m = avg(a); return avg(a.map(x => (x - m) * (x - m))); };

/* 1) genTraits: centered (~50), bell-shaped (tails rare), in [0,100] */
(function () {
  const r = rng(2026), mot = [], comp = [];
  for (let i = 0; i < 20000; i++) { const t = genTraits(r); mot.push(t.mot); comp.push(t.comp); }
  const inRange = mot.concat(comp).every(v => v >= 0 && v <= 100);
  const mMean = avg(mot), cMean = avg(comp);
  const tails = mot.filter(v => v <= 15 || v >= 85).length / mot.length;   // bell ⇒ extremes rare
  const mids = mot.filter(v => v >= 35 && v <= 65).length / mot.length;    // ⇒ middle common
  check('genTraits stays within 0..100', inRange);
  check('genTraits is centered near 50', Math.abs(mMean - 50) < 1.5 && Math.abs(cMean - 50) < 1.5, `mot ${mMean.toFixed(1)}, comp ${cMean.toFixed(1)}`);
  check('genTraits is bell-shaped (tails rare, middle common)', tails < 0.13 && mids > 0.45, `tails ${(tails * 100).toFixed(1)}%, mids ${(mids * 100).toFixed(1)}%`);
})();

/* 2) genTraits is deterministic by seed */
(function () {
  const a = rng(777), b = rng(777);
  let same = true;
  for (let i = 0; i < 500; i++) { const x = genTraits(a), y = genTraits(b); if (x.mot !== y.mot || x.comp !== y.comp) same = false; }
  check('genTraits is deterministic by seed', same);
})();

/* 3) motorMult: bounded, monotonic, average at 50 */
(function () {
  const lo = motorMult({ mot: 0 }), mid = motorMult({ mot: 50 }), hi = motorMult({ mot: 100 });
  const def = motorMult({});   // absent ⇒ average
  const bounded = lo >= 0.85 && hi <= 1.15 && lo < mid && mid < hi;
  let mono = true; for (let m = 0; m < 100; m += 5) if (motorMult({ mot: m }) > motorMult({ mot: m + 5 })) mono = false;
  check('motorMult is bounded to 0.85..1.15', bounded, `${lo.toFixed(3)}..${hi.toFixed(3)}`);
  check('motorMult is monotonic in motor', mono);
  check('motorMult is ~1.0 at average / absent', Math.abs(mid - 1) < 1e-9 && Math.abs(def - 1) < 1e-9);
})();

/* 4) motor → development: a high-motor cohort out-develops a low-motor one, never past pot.
      Fed through the REAL developPlayer with rate = base × motorMult (how devRateFor uses it). */
(function () {
  const r = rng(4242);
  const mk = (m) => ({ yr: 'SO', ov: 70, pot: 88, spd: 70, str: 70, awr: 70, mot: m, comp: 50 });
  let gHi = 0, gLo = 0, everPast = false;
  for (let i = 0; i < 4000; i++) {
    const hi = mk(92), lo = mk(12);
    gHi += developPlayer(hi, r, 1.0 * motorMult(hi));
    gLo += developPlayer(lo, r, 1.0 * motorMult(lo));
    if (hi.ov > hi.pot || lo.ov > lo.pot) everPast = true;
  }
  check('High-motor cohort develops more than low-motor', gHi > gLo * 1.05, `hi ${(gHi / 4000).toFixed(2)} vs lo ${(gLo / 4000).toFixed(2)} ovr/yr`);
  check('Development never exceeds the ceiling (pot)', !everPast);
})();

/* 5) compReshape is mean-PRESERVING across composure (so the sim's scoring mean is untouched) */
(function () {
  const r = rng(99);
  const draws = n => { const a = []; for (let i = 0; i < n; i++) a.push(r()); return a; };
  const sample = draws(200000);
  const meanFor = comp => avg(sample.map(x => compReshape(x, compExp({ comp }))));
  const m0 = meanFor(0), m50 = meanFor(50), m100 = meanFor(100);
  const preserved = [m0, m50, m100].every(m => Math.abs(m - 0.5) < 0.01);
  check('compReshape preserves the mean (~0.5) at every composure', preserved, `${m0.toFixed(3)}/${m50.toFixed(3)}/${m100.toFixed(3)}`);
})();

/* 6) composure widens/narrows spread; comp==50 is the identity (byte-identical sim) */
(function () {
  const r = rng(31337);
  const sample = []; for (let i = 0; i < 200000; i++) sample.push(r());
  const vFor = comp => vari(sample.map(x => compReshape(x, compExp({ comp }))));
  const vLo = vFor(5), vMid = vFor(50), vHi = vFor(95);
  // identity at comp 50: reshape(x,1) === x exactly, for every draw
  const identity = sample.every(x => Math.abs(compReshape(x, compExp({ comp: 50 })) - x) < 1e-12);
  check('comp==50 reshape is the exact identity (pre-Phase-10 sim unchanged)', identity);
  check('Lower composure widens spread, higher narrows it', vLo > vMid && vMid > vHi, `var ${vLo.toFixed(3)} > ${vMid.toFixed(3)} > ${vHi.toFixed(3)}`);
})();

/* 7) composure changes a representative yardage draw's SPREAD but not its MEAN */
(function () {
  const r = rng(2024);
  // mirror the sim's run-gain magnitude term: base 2.7 + draw*4.1 + occasional breakaway
  const gain = (p, rr) => Math.max(-4, Math.round((2.7 + compDraw(rr, p) * 4.1) + (rr() < 0.11 ? compDraw(rr, p) * 30 : 0)));
  const run = comp => { const a = []; const pr = rng(2024); for (let i = 0; i < 120000; i++) a.push(gain({ comp }, pr)); return a; };
  const steady = run(95), streaky = run(5), avgP = run(50);
  const meanClose = Math.abs(avg(steady) - avg(streaky)) < 0.6 && Math.abs(avg(avgP) - avg(streaky)) < 0.6;
  const spreadWider = vari(streaky) > vari(steady) * 1.15;
  // boom/bust signature: streaky mass flees to BOTH ends — more explosive (≥25) AND more stuffed (≤1)
  const expl = a => a.filter(y => y >= 25).length, stuff = a => a.filter(y => y <= 3).length;
  const boomBust = expl(streaky) > expl(steady) && stuff(streaky) > stuff(steady);
  check('Composure leaves per-play yardage MEAN ~unchanged', meanClose, `means ${avg(streaky).toFixed(2)}/${avg(avgP).toFixed(2)}/${avg(steady).toFixed(2)}`);
  check('Streaky players are wider + more boom/bust (explosive & stuffed)', spreadWider && boomBust, `expl ${expl(streaky)}/${expl(steady)}, stuff ${stuff(streaky)}/${stuff(steady)}`);
})();

/* 8) clutch is small, signed, and bounded */
(function () {
  const lo = compClutch({ comp: 0 }), mid = compClutch({ comp: 50 }), hi = compClutch({ comp: 100 });
  check('Clutch is signed by composure and ~zero at average', lo < 0 && hi > 0 && Math.abs(mid) < 1e-9);
  check('Clutch stays small (|nudge| < 2 rating pts)', Math.abs(lo) < 2 && Math.abs(hi) < 2, `${lo.toFixed(2)}..${hi.toFixed(2)}`);
})();

/* 9) ego (Phase 20): centered, bell-shaped, deterministic, + a bounded/monotonic susceptibility */
(function () {
  const r = rng(5050), ego = [];
  for (let i = 0; i < 20000; i++) ego.push(genTraits(r).ego);
  check('genTraits ego is centered + bell-shaped', Math.abs(avg(ego) - 50) < 1.5 && ego.filter(v => v <= 15 || v >= 85).length / ego.length < 0.13, `mean ${avg(ego).toFixed(1)}`);
  const a = rng(9), b = rng(9); let same = true;
  for (let i = 0; i < 400; i++) if (genTraits(a).ego !== genTraits(b).ego) same = false;
  check('genTraits ego is deterministic by seed', same);
  const lo = egoWeight(0), mid = egoWeight(50), hi = egoWeight(100);
  let mono = true; for (let e = 0; e < 100; e += 5) if (egoWeight(e) > egoWeight(e + 5)) mono = false;
  check('egoWeight is bounded (0.2..1.5) + monotonic in ego', lo >= 0.2 && hi <= 1.5 && lo < mid && mid < hi && mono, `${lo.toFixed(2)}..${hi.toFixed(2)}`);
})();

/* 10) morale movers (Phase 20): ego-scaled, bounded, mean-neutral at the average (envelope-preserving) */
(function () {
  check('moraleUpdate scales an event harder for a high-ego player', moraleUpdate(50, 8, 95) - 50 > moraleUpdate(50, 8, 5) - 50 && moraleUpdate(50, 8, 5) > 50, `+${(moraleUpdate(50, 8, 95) - 50).toFixed(1)} vs +${(moraleUpdate(50, 8, 5) - 50).toFixed(1)}`);
  check('moraleUpdate is bounded 0..100', moraleUpdate(98, 40, 99) <= 100 && moraleUpdate(3, -40, 99) >= 0);
  check('moraleUpdate is signed (a negative event drops morale)', moraleUpdate(50, -6, 80) < 50);
  check('moraleDecay eases toward 50 (never past it)', moraleDecay(90) < 90 && moraleDecay(90) > 50 && moraleDecay(10) > 10 && moraleDecay(10) < 50);
  check('moraleDecay is the identity at 50', Math.abs(moraleDecay(50) - 50) < 1e-9);
  check('moraleDevMult is 1.0 at neutral + bounded 0.9..1.1 + monotonic', Math.abs(moraleDevMult(50) - 1) < 1e-9 && moraleDevMult(0) >= 0.9 && moraleDevMult(100) <= 1.1 && moraleDevMult(90) > moraleDevMult(10));
  const neutral = [{ morale: 50, so: 0 }, { morale: 50, so: 1 }], hot = [{ morale: 90, so: 0 }, { morale: 85, so: 1 }], cold = [{ morale: 10, so: 0 }, { morale: 15, so: 1 }];
  check('moraleGameSkew is zero on a neutral room', Math.abs(moraleGameSkew(neutral)) < 1e-9);
  check('moraleGameSkew is signed + bounded (±2)', moraleGameSkew(hot) > 0 && moraleGameSkew(cold) < 0 && Math.abs(moraleGameSkew(hot)) <= 2 && Math.abs(moraleGameSkew(cold)) <= 2);
  check('moraleGameSkew ignores absent morale (all-default room = 0)', Math.abs(moraleGameSkew([{ so: 0 }, { so: 1 }, { so: 0 }])) < 1e-9);
  check('moralePortalPush is 0 at neutral/high morale', moralePortalPush(50) === 0 && moralePortalPush(80) === 0);
  check('moralePortalPush rises as morale sinks (bounded ≤0.2)', moralePortalPush(10) > moralePortalPush(40) && moralePortalPush(0) <= 0.2 && moralePortalPush(0) > 0);
})();

/* ---------- summary ---------- */
const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);

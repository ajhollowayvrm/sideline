/* Sideline SIDE LAB — standalone harness for the Phase 64 sideline-moment engine.

   The engine lives in index.html (single source of truth). This harness EXTRACTS the block between the
   SIDELINE ENGINE markers and validates the pure model offline: the moment/response registry is
   well-formed, the pacing gate (sidelineFires) actually paces, every response is bounded, and — the
   design's whole point — NO RESPONSE DOMINATES: each one is the best answer for some temperament and a
   bad one for another, so a coach who doesn't know his player's makeup is genuinely guessing.

   The in-browser QA gate validates the integrated feature (a moment fires mid-game, the response banks
   onto g.adjusts and replays on commit); simlab validates the engine side (log tags + plan.sit).

   Run:  node test/sidelab.js */

const fs = require('fs');
const path = require('path');

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === SIDELINE ENGINE (Phase 64) START ===';
const END = '// === SIDELINE ENGINE (Phase 64) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find SIDELINE ENGINE markers in index.html'); process.exit(2); }
// Function declarations leak out of a sloppy eval; `const` bindings do not — hand the consts back out
// through a trailing expression evaluated inside the block's own scope (same trick as recordlab).
const { SIDELINE_KINDS, SIDELINE_OPTS, SIDELINE_MAX, SIDELINE_GAP, SIDELINE_HITS, SIDELINE_GOODS, SIDELINE_FRESH, SIDELINE_SIT } =
  eval(html.slice(i0, i1) + '\n;({SIDELINE_KINDS,SIDELINE_OPTS,SIDELINE_MAX,SIDELINE_GAP,SIDELINE_HITS,SIDELINE_GOODS,SIDELINE_FRESH,SIDELINE_SIT})');

const results = [];
function check(name, cond, detail = '') { results.push({ pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

const KINDS = Object.keys(SIDELINE_KINDS);
const OPTS = Object.keys(SIDELINE_OPTS);
const T = (comp, ego, mot) => ({ comp, ego, mot });
const EXTREMES = [0, 25, 50, 75, 100];
const GRID = [];
EXTREMES.forEach(c => EXTREMES.forEach(e => EXTREMES.forEach(m => GRID.push(T(c, e, m)))));
const RVS = [0, 0.25, 0.5, 0.75, 0.999];

/* ---------- 1) the registry ---------- */
check('A meaningful set of moments (turnovers, coverage, kicking, celebration, discipline)', KINDS.length >= 6, KINDS.join(', '));
check('Every moment has a tone, a title, a headline and options',
  KINDS.every(k => { const K = SIDELINE_KINDS[k]; return ['bad', 'good', 'team'].includes(K.tone) && K.title && typeof K.head === 'function' && Array.isArray(K.opts) && K.opts.length >= 2; }));
check('Every moment offers a real choice (≥3 responses)', KINDS.every(k => SIDELINE_KINDS[k].opts.length >= 3));
check('Every offered response exists in the response registry', KINDS.every(k => SIDELINE_KINDS[k].opts.every(o => SIDELINE_OPTS[o])));
check('Every response has a label + a hint the coach can act on', OPTS.every(o => SIDELINE_OPTS[o].label && SIDELINE_OPTS[o].hint));
check('Every registered response is actually reachable from some moment',
  OPTS.every(o => KINDS.some(k => SIDELINE_KINDS[k].opts.includes(o))), OPTS.join(', '));
check('Every headline renders a non-empty line', KINDS.every(k => typeof SIDELINE_KINDS[k].head('Test Player') === 'string' && SIDELINE_KINDS[k].head('Test Player').length > 10));
check('Bad moments always leave a do-nothing option (never a forced reaction)',
  KINDS.filter(k => SIDELINE_KINDS[k].tone === 'bad').every(k => SIDELINE_KINDS[k].opts.includes('quiet')));
check('You cannot chew out the kicker after a miss', !SIDELINE_KINDS.miss.opts.includes('chew'));

/* ---------- 2) pacing ---------- */
const free = { count: 0, gap: 99, hits: 0, goods: 0 };
check('A fresh moment fires', SIDELINE_KINDS.int && sidelineFires('int', free));
check('An unknown moment never fires', !sidelineFires('nonsense', free));
check('The per-game cap stops further moments', !sidelineFires('int', { ...free, count: SIDELINE_MAX }));
check('Moments are spaced out (the gap rule)', !sidelineFires('int', { ...free, gap: SIDELINE_GAP - 1 }) && sidelineFires('int', { ...free, gap: SIDELINE_GAP }));
check('The same player can only be pulled aside so often', !sidelineFires('int', { ...free, hits: SIDELINE_HITS }));
check('Celebrations are rarer than corrections', !sidelineFires('hype', { ...free, goods: SIDELINE_GOODS }) && sidelineFires('int', { ...free, goods: SIDELINE_GOODS }));
check('An absent gap reads as "long ago" (the first moment of a game fires)', sidelineFires('int', { count: 0, hits: 0, goods: 0 }));
check('Pacing constants are sane (cap, gap, freshness, sit length)',
  SIDELINE_MAX >= 3 && SIDELINE_MAX <= 10 && SIDELINE_GAP >= 4 && SIDELINE_FRESH >= 1 && SIDELINE_FRESH <= 5 && SIDELINE_SIT >= 2 && SIDELINE_SIT <= 5,
  `max ${SIDELINE_MAX}, gap ${SIDELINE_GAP}, fresh ${SIDELINE_FRESH}, sit ${SIDELINE_SIT} drives`);

/* ---------- 3) responses are bounded + deterministic ---------- */
let maxAbs = 0, allFinite = true;
OPTS.forEach(o => GRID.forEach(tr => RVS.forEach(rv => {
  const v = sidelineResponse(o, tr, rv);
  if (!isFinite(v)) allFinite = false;
  maxAbs = Math.max(maxAbs, Math.abs(v));
})));
check('Every response is finite and bounded (|resp| ≤ 2.5)', allFinite && maxAbs <= 2.5, `max |resp| = ${maxAbs.toFixed(2)}`);
check('An unknown response is a no-op', sidelineResponse('shrug', T(50, 50, 50), 0.5) === 0);
check('Missing traits read as league-average (absent == 50)',
  Math.abs(sidelineResponse('chew', {}, 0.5) - sidelineResponse('chew', T(50, 50, 50), 0.5)) < 1e-9);
check('Out-of-range traits + rolls are clamped, never NaN',
  isFinite(sidelineResponse('chew', T(-40, 400, 999), 7)) && isFinite(sidelineResponse('ride', T(200, -5, 0), -3)));
check('The same words on the same day give the same result (deterministic)',
  JSON.stringify(sidelineResolve('int', 'chew', T(70, 30, 60), 0.3, 'A')) === JSON.stringify(sidelineResolve('int', 'chew', T(70, 30, 60), 0.3, 'A')));
check('The roll matters — the same words land differently on different days',
  RVS.some(rv => sidelineResponse('ride', T(50, 50, 50), rv) !== sidelineResponse('ride', T(50, 50, 50), 0.5)));
check('Saying nothing to an average player is near-neutral', Math.abs(sidelineResponse('quiet', T(50, 50, 50), 0.5)) < 0.05);

/* ---------- 4) the temperament reads (the actual football) ---------- */
const R = (o, tr) => sidelineResponse(o, tr, 0.5);   // neutral roll — isolate the temperament
check('A challenge lands on a poised, egoless player', R('chew', T(90, 10, 50)) > 0.8, R('chew', T(90, 10, 50)).toFixed(2));
check('The same challenge blows up on a rattled diva', R('chew', T(10, 90, 50)) < -0.8, R('chew', T(10, 90, 50)).toFixed(2));
check('Getting in his face has the widest spread of any response',
  OPTS.every(o => o === 'chew' || (Math.max(...GRID.map(t => R(o, t))) - Math.min(...GRID.map(t => R(o, t)))) <= (Math.max(...GRID.map(t => R('chew', t))) - Math.min(...GRID.map(t => R('chew', t))))),
  `chew spread ${(Math.max(...GRID.map(t => R('chew', t))) - Math.min(...GRID.map(t => R('chew', t)))).toFixed(2)}`);
check('Support does most good for a rattled kid', R('back', T(10, 50, 50)) > R('back', T(90, 50, 50)));
check('Support is never a disaster (it is the safe play)', GRID.every(t => RVS.every(rv => sidelineResponse('back', t, rv) > -0.5)));
check('Coaching him up rewards a motor, monotonically', R('teach', T(50, 50, 0)) < R('teach', T(50, 50, 50)) && R('teach', T(50, 50, 50)) < R('teach', T(50, 50, 100)));
check('Sitting him resets a rattled, humble kid', R('sit', T(15, 20, 50)) > 0.5, R('sit', T(15, 20, 50)).toFixed(2));
check('Sitting him insults a diva', R('sit', T(50, 95, 50)) < 0, R('sit', T(50, 95, 50)).toFixed(2));
check('Riding the wave feeds a confident player most', R('ride', T(50, 95, 50)) > R('ride', T(50, 5, 50)));
check('Keeping him level is small and safe next to riding the wave',
  Math.abs(R('level', T(50, 50, 50))) < Math.abs(R('ride', T(50, 95, 50))) && GRID.every(t => R('level', t) > -0.2));
check('An emotional room responds to a fire-up; a stoic one shrugs', R('fire', T(10, 50, 50)) > R('fire', T(90, 50, 50)));

// NO DOMINANT OPTION: over the temperament grid, each of the four bad-moment responses is the single
// best answer for somebody — the coach is reading a man, not memorising a rule.
const BADOPTS = ['chew', 'back', 'teach', 'sit', 'quiet'];
const bestCount = {}; BADOPTS.forEach(o => bestCount[o] = 0);
GRID.forEach(t => { let bo = null, bv = -99; BADOPTS.forEach(o => { const v = R(o, t); if (v > bv) { bv = v; bo = o; } }); bestCount[bo]++; });
check('No response dominates — the challenge, support, coaching AND a benching each win somewhere',
  ['chew', 'back', 'teach', 'sit'].every(o => bestCount[o] > 0), JSON.stringify(bestCount));
check('No single response is right for most temperaments',
  Math.max(...BADOPTS.map(o => bestCount[o])) / GRID.length < 0.65, `best-share ${(Math.max(...BADOPTS.map(o => bestCount[o])) / GRID.length * 100).toFixed(0)}%`);

/* ---------- 5) resolve — the plan deltas + the aftermath ---------- */
let boostOk = true, moodOk = true, teamOk = true;
KINDS.forEach(k => SIDELINE_KINDS[k].opts.forEach(o => GRID.forEach(tr => RVS.forEach(rv => {
  const r = sidelineResolve(k, o, tr, rv, 'Test Player');
  if (r.boost < -5 || r.boost > 6 || !Number.isInteger(r.boost)) boostOk = false;
  if (r.mood < -10 || r.mood > 10 || !Number.isInteger(r.mood)) moodOk = false;
  if (r.team < -5 || r.team > 5 || !Number.isInteger(r.team)) teamOk = false;
}))));
check('The in-game swing is a bounded whole number (−5…+6 OVR)', boostOk);
check('The morale aftermath is bounded (−10…+10)', moodOk);
check('The team-wide aftermath is bounded (−5…+5)', teamOk);
const worstSwing = Math.max(...KINDS.flatMap(k => SIDELINE_KINDS[k].opts.flatMap(o => GRID.flatMap(tr => RVS.map(rv => Math.abs(sidelineResolve(k, o, tr, rv, 'A').boost))))));
check('A sideline swing stays a nudge, never a talent gap (≤ 6 OVR)', worstSwing <= 6, `worst ${worstSwing} OVR`);

const sit = sidelineResolve('int', 'sit', T(20, 20, 50), 0.5, 'A');
check('A benching sits him for a series and softens the swing', sit.sit === SIDELINE_SIT && sit.boost <= 4 && sit.boost >= -3, `sit ${sit.sit} drives, boost ${sit.boost}`);
check('Only a benching sets `sit`', KINDS.every(k => SIDELINE_KINDS[k].opts.every(o => o === 'sit' || sidelineResolve(k, o, T(50, 50, 50), 0.5, 'A').sit === 0)));
const calm = sidelineResolve('pen', 'calm', T(50, 50, 50), 0.5, null);
check('Settling them down pulls the discipline lever and nothing else', calm.calm === true && calm.boost === 0 && calm.sit === 0);
check('Only "settle them down" pulls the discipline lever', KINDS.every(k => SIDELINE_KINDS[k].opts.every(o => o === 'calm' || !sidelineResolve(k, o, T(50, 50, 50), 0.5, 'A').calm)));
const fire = sidelineResolve('pen', 'fire', T(20, 50, 50), 0.5, null);
check('Lighting a fire moves the room, not one player', fire.team !== 0 && fire.mood === 0 && fire.boost === 0, `team ${fire.team}`);
check('Saying nothing never changes the football (mood only)',
  GRID.every(t => { const r = sidelineResolve('int', 'quiet', t, 0.5, 'A'); return r.boost === 0 && r.sit === 0 && !r.calm; }));
check('A good response helps and a bad one hurts (boost tracks the read)',
  sidelineResolve('int', 'chew', T(90, 10, 50), 0.5, 'A').boost > 0 && sidelineResolve('int', 'chew', T(10, 90, 50), 0.5, 'A').boost < 0);
check('Morale moves the same direction as the on-field swing',
  GRID.every(t => { const r = sidelineResolve('int', 'chew', t, 0.5, 'A'); return (r.boost > 0 ? r.mood >= 0 : r.boost < 0 ? r.mood <= 0 : true); }));

/* ---------- 6) the words ---------- */
let notesOk = true, tones = {};
KINDS.forEach(k => SIDELINE_KINDS[k].opts.forEach(o => GRID.forEach(tr => {
  const r = sidelineResolve(k, o, tr, 0.5, 'Test Player');
  if (!r.note || r.note.length < 12) notesOk = false;
  tones[r.tone] = (tones[r.tone] || 0) + 1;
})));
check('Every outcome comes with something the coach actually hears', notesOk);
check('Outcomes read across the full range (good / flat / bad)', tones.good > 0 && tones.flat > 0 && tones.bad > 0, JSON.stringify(tones));
check('The player is named in his own moment', sidelineResolve('int', 'chew', T(90, 10, 50), 0.5, 'Marcus Webb').note.includes('Marcus Webb'));
check('A nameless (team) moment still reads cleanly', sidelineResolve('pen', 'fire', T(50, 50, 50), 0.5, null).note.length > 12);
// the note has to agree with the outcome, or the feedback loop teaches the wrong lesson
check('A great reaction never reads as a bad one (and vice versa)',
  GRID.every(t => RVS.every(rv => { const r = sidelineResolve('int', 'chew', t, rv, 'A');
    return !(r.resp >= 0.85 && /badly|shuts down|doesn’t like/.test(r.note)) && !(r.resp <= -0.85 && /takes it to heart|buckles/.test(r.note)); })));

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} sideline-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

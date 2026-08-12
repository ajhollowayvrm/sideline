/* Sideline CLOUD LAB — standalone harness for the Phase 47 cloud-sync engine.

   The sync engine lives in index.html (single source of truth). This harness EXTRACTS the
   engine block (between the CLOUD ENGINE markers) and evals it here, then validates the pure
   model offline: career codes mint inside the Crockford alphabet with real entropy and
   normalize back from anything a human types (lowercase, spaces, the SIDE- prefix, I/L/O/U
   lookalikes); a career's cloud id is derived from the save itself, is stable, and matches
   the id shape the Lambda accepts; progress ordering ranks two saves the way a season runs;
   and cloudResolve — the whole "what happens next" decision — is walked case by case,
   including the two that matter most: a device that is behind PULLS, a device that is behind
   AND has local changes CONFLICTS (never silently overwrites).

   The in-browser QA gate covers the integrated path (gzip round-trip, mocked endpoint,
   push → pull → conflict) against the real app.

   Run:  node test/cloudlab.js */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === CLOUD ENGINE (Phase 47) START ===';
const END = '// === CLOUD ENGINE (Phase 47) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find CLOUD ENGINE markers in index.html'); process.exit(2); }
// Function declarations leak out of sloppy eval; `const` bindings do not, so hand the
// alphabet/length back via a trailing expression that is still inside the engine's scope.
const { CLOUD_ALPHA, CLOUD_CODE_LEN } = eval(html.slice(i0, i1) + '\n;({CLOUD_ALPHA,CLOUD_CODE_LEN})');

const results = [];
function check(name, cond, detail = '') { results.push({ pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

// A seeded rng so the lab is deterministic (mulberry32, same as the game's).
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- 1) the alphabet
check('Alphabet is 32 chars of Crockford base32', CLOUD_ALPHA.length === 32 && CLOUD_ALPHA === '0123456789ABCDEFGHJKMNPQRSTVWXYZ');
check('Ambiguous letters I/L/O/U are excluded', ['I', 'L', 'O', 'U'].every(c => CLOUD_ALPHA.indexOf(c) < 0));
check('Code length gives ≥ 56 bits of key', CLOUD_CODE_LEN * 5 >= 56, `${CLOUD_CODE_LEN} chars = ${CLOUD_CODE_LEN * 5} bits`);

// ---------------------------------------------------------------- 2) minting
const r = rng(20260812);
const codes = Array.from({ length: 4000 }, () => cloudMintCode(r));
check('Every minted code is the right length', codes.every(c => c.length === CLOUD_CODE_LEN));
check('Every minted char is in the alphabet', codes.every(c => c.split('').every(ch => CLOUD_ALPHA.indexOf(ch) >= 0)));
check('Every minted code validates', codes.every(c => cloudValidCode(c) === c));
check('No collisions across 4,000 mints', new Set(codes).size === codes.length);
// entropy sanity: all 32 symbols show up, none dominates
const freq = {}; codes.join('').split('').forEach(c => freq[c] = (freq[c] || 0) + 1);
const counts = CLOUD_ALPHA.split('').map(c => freq[c] || 0);
const expect = codes.length * CLOUD_CODE_LEN / 32;
check('All 32 symbols appear', counts.every(n => n > 0));
check('Symbol distribution is flat (±25% of expected)', counts.every(n => n > expect * 0.75 && n < expect * 1.25),
  `expected ~${Math.round(expect)}, range ${Math.min(...counts)}–${Math.max(...counts)}`);
// a degenerate rng must not push past the end of the alphabet
check('rand()===1 does not fall off the alphabet', cloudMintCode(() => 1).split('').every(c => CLOUD_ALPHA.indexOf(c) >= 0));

// ---------------------------------------------------------------- 3) normalizing what a human types
const CODE = '7K2M9QX4B8TR';
const typed = {
  'exact': '7K2M9QX4B8TR',
  'formatted': 'SIDE-7K2M-9QX4-B8TR',
  'lowercase': 'side-7k2m-9qx4-b8tr',
  'spaces': ' 7K2M 9QX4 B8TR ',
  'no prefix, dashes': '7K2M-9QX4-B8TR',
};
Object.entries(typed).forEach(([how, raw]) =>
  check(`Normalizes a code typed ${how}`, cloudValidCode(raw) === CODE, JSON.stringify(raw)));
check('Lookalike O → 0', cloudValidCode('OK2M9QX4B8TR') === '0K2M9QX4B8TR');
check('Lookalikes I and L → 1', cloudValidCode('IK2M9QX4B8TR') === '1K2M9QX4B8TR' && cloudValidCode('LK2M9QX4B8TR') === '1K2M9QX4B8TR');
check('Lookalike U → V', cloudValidCode('UK2M9QX4B8TR') === 'VK2M9QX4B8TR');
check('Too short is rejected', cloudValidCode('7K2M9QX4') === null);
check('Too long is rejected', cloudValidCode('7K2M9QX4B8TRXX') === null);
check('Empty / null are rejected', cloudValidCode('') === null && cloudValidCode(null) === null && cloudValidCode(undefined) === null);
check('Formatting round-trips', cloudFormatCode(CODE) === 'SIDE-7K2M-9QX4-B8TR' && cloudValidCode(cloudFormatCode(CODE)) === CODE);
// The SIDE prefix is only stripped when it is actually a prefix — a code whose own first four
// chars happen to be SIDE (S,I→1,D,E are all real symbols) must survive.
check('A 12-char code is never mistaken for a prefix', cloudValidCode('SDE79QX4B8TR') === 'SDE79QX4B8TR');

// ---------------------------------------------------------------- 4) career identity
const mkState = (createdAt, seed) => ({ createdAt, seed, year: 2026, week: 3, phase: 'Regular Season' });
const idA = cloudCareerId(mkState(1754960000000, 12345));
const idB = cloudCareerId(mkState(1754960000000, 12345));
const idC = cloudCareerId(mkState(1754960000001, 12345));
const idD = cloudCareerId(mkState(1754960000000, 12346));
check('Career id is derived, not random (same save → same id)', idA === idB, idA);
check('A different createdAt is a different career', idA !== idC);
check('A different seed is a different career', idA !== idD);
check('Career id matches the id shape the API accepts', /^[a-z0-9-]{1,64}$/.test(idA), idA);
check('Career id survives a missing/empty state', /^[a-z0-9-]{1,64}$/.test(cloudCareerId({})) && /^[a-z0-9-]{1,64}$/.test(cloudCareerId(null)));

// ---------------------------------------------------------------- 5) progress ordering
const P = (year, phase, week) => cloudProgress({ year, phase, week });
check('Later week beats earlier week', P(2026, 'Regular Season', 8) > P(2026, 'Regular Season', 5));
check('Postseason beats the regular season', P(2026, 'Postseason', 0) > P(2026, 'Regular Season', 15));
check('Offseason beats the postseason', P(2026, 'Offseason', 0) > P(2026, 'Postseason', 3));
check('Next year beats any of this year', P(2027, 'Preseason', 0) > P(2026, 'Offseason', 0));
check('A season runs in order end to end',
  [P(2026, 'Preseason', 0), P(2026, 'Regular Season', 1), P(2026, 'Regular Season', 15),
   P(2026, 'Conference Championships', 0), P(2026, 'Postseason', 2), P(2026, 'Offseason', 0), P(2027, 'Preseason', 0)]
    .every((v, i, a) => i === 0 || v > a[i - 1]));
check('An unknown phase still ranks (no NaN)', Number.isFinite(P(2026, 'Bowl Week', 4)) && cloudProgress(null) === -1);

// ---------------------------------------------------------------- 6) the sync decision
const L = savedAt => ({ savedAt });
const C = (rev, savedAt) => ({ rev, updatedAt: savedAt, meta: { savedAt } });
const act = (mark, local, cloud) => cloudResolve(mark, local, cloud).action;

check('Nothing anywhere → none', act(null, null, null) === 'none');
check('Local only → push (first backup)', act(null, L(100), null) === 'push');
check('Cloud only → pull (started on another device)', act(null, null, C(3, 100)) === 'pull');
check('Synced and untouched → in sync', act({ rev: 3, savedAt: 100 }, L(100), C(3, 100)) === 'insync');
check('Synced then played → push', act({ rev: 3, savedAt: 100 }, L(140), C(3, 100)) === 'push');
check('Behind and untouched → pull', act({ rev: 3, savedAt: 100 }, L(100), C(5, 200)) === 'pull');
check('Behind AND changed locally → conflict (never silently overwrite)', act({ rev: 3, savedAt: 100 }, L(140), C(5, 200)) === 'conflict');
check('Ahead of the cloud (cloud reset) → push', act({ rev: 7, savedAt: 300 }, L(300), C(2, 90)) === 'push');
// no watermark but both copies exist: this device has never synced this career → ask, don't guess
check('Never-synced device with a local + cloud copy → conflict', act(null, L(140), C(4, 200)) === 'conflict');
check('Every decision carries a human reason', ['none', 'push', 'pull', 'insync', 'conflict'].every(a => {
  const cases = { none: [null, null, null], push: [null, L(1), null], pull: [null, null, C(1, 1)],
    insync: [{ rev: 1, savedAt: 1 }, L(1), C(1, 1)], conflict: [{ rev: 1, savedAt: 1 }, L(2), C(2, 2)] };
  const res = cloudResolve(...cases[a]);
  return res.action === a && typeof res.why === 'string' && res.why.length > 3;
}));

// A push→pull round trip between two devices converges (walk the state machine).
let cloudHead = null;                       // the server
let A = { mark: null, savedAt: 10 };        // desktop, has a career
let B = { mark: null, savedAt: 0 };         // phone, empty
const step = (dev, local) => cloudResolve(dev.mark, local, cloudHead);
check('Desktop first push uploads', step(A, L(A.savedAt)).action === 'push');
cloudHead = C(1, A.savedAt); A.mark = { rev: 1, savedAt: A.savedAt };
check('…then desktop is in sync', step(A, L(A.savedAt)).action === 'insync');
check('Phone sees a cloud-only career', step(B, null).action === 'pull');
B.mark = { rev: 1, savedAt: 50 }; B.savedAt = 50;                   // phone downloads
check('…phone is in sync after downloading', step(B, L(B.savedAt)).action === 'insync');
B.savedAt = 70; cloudHead = C(2, 70); B.mark = { rev: 2, savedAt: 70 };  // phone plays + pushes
check('Desktop now sees the phone is ahead → pull', step(A, L(A.savedAt)).action === 'pull');
A.savedAt = 90;                                                     // desktop plays without pulling
check('…but a desktop that also played gets a conflict', step(A, L(A.savedAt)).action === 'conflict');

const passed = results.filter(x => x.pass).length;
console.log(`\n===== ${passed}/${results.length} checks passed =====`);
process.exit(results.every(x => x.pass) ? 0 : 1);

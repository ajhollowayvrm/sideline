/* Sideline IDENTITY LAB — standalone harness for the Phase 45 player-identity engine.

   The engine lives in index.html (single source of truth). This harness EXTRACTS the TRAIT block (for
   motVal/compVal/egoVal + TRAIT_DEF) and the IDENTITY block (between the markers) and evals them here,
   then validates the pure model offline: jersey numbers land in a position-plausible band + are
   deterministic; nicknames are deterministic, gated (a freshman shows none), and an earned résumé
   nickname supersedes the flavor one; knownFor / backstory always return a sensible non-empty line and
   reflect honors/career when present. Everything is DERIVED (no storage), so this is the whole contract.

   Run:  node test/identitylab.js */

const fs = require('fs');
const path = require('path');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function block(tag) {
  const i0 = html.indexOf(`// === ${tag} START ===`), i1 = html.indexOf(`// === ${tag} END ===`);
  if (i0 < 0 || i1 < 0) { console.error('Could not find markers for ' + tag); process.exit(2); }
  return html.slice(i0, i1);
}
eval(block('TRAIT ENGINE (Phase 10)'));      // motVal / compVal / egoVal / TRAIT_DEF
// Function declarations leak out of sloppy eval; `const` objects don't — capture NICK_FLAVOR to assert on.
const { NICK_FLAVOR } = eval(block('IDENTITY ENGINE (Phase 45)') + '\n;({NICK_FLAVOR})');

const results = [];
function check(name, cond, detail = '') { results.push({ pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

const P = (o) => Object.assign({ id: 'p1', pos: 'RB', yr: 'SO', st: 'TX', stars: 3, ov: 78 }, o);

/* 1) jersey numbers */
(function () {
  const bands = { QB: [1, 18], TE: [80, 89], DT: [90, 99], CB: [1, 39] };
  let inBand = true;
  Object.entries(bands).forEach(([pos, [lo, hi]]) => { for (let i = 0; i < 40; i++) { const n = jerseyNo(P({ id: 'j' + pos + i, pos })); if (n < lo || n > hi) inBand = false; } });
  check('Jersey numbers land in the position band', inBand);
  check('Jersey number is deterministic by id', jerseyNo(P({ id: 'x', pos: 'QB' })) === jerseyNo(P({ id: 'x', pos: 'QB' })));
  check('Different ids get a spread of numbers', new Set([...Array(20)].map((_, i) => jerseyNo(P({ id: 'q' + i, pos: 'WR' })))).size >= 6);
})();

/* 2) nickname gate + determinism */
(function () {
  const frosh = P({ id: 'f1', yr: 'FR', career: {}, gs: { gp: 1 } });
  check('A freshman with no résumé shows no nickname yet', nickname(frosh) === '');
  const vet = P({ id: 'v1', yr: 'JR' });
  check('An established player gets a nickname', nickname(vet).length > 0);
  check('Nickname is deterministic by id', nickname(vet) === nickname(P({ id: 'v1', yr: 'JR' })));
  check('Established via real snaps (not just class)', nickname(P({ id: 's1', yr: 'SO', career: { gp: 20 } })).length > 0);
})();

/* 3) earned nickname supersedes flavor */
(function () {
  const heis = P({ id: 'h1', yr: 'SR', honors: [{ year: 2029, award: 'Heisman' }] });
  check('A Heisman winner earns "The Franchise"', nickEarned(heis) === 'The Franchise' && nickname(heis) === 'The Franchise');
  const passer = P({ id: 'g1', pos: 'QB', yr: 'SR', career: { pYds: 9000, gp: 30 } });
  check('An 8000-yard passer earns "The General"', nickEarned(passer) === 'The General');
  const rusher = P({ id: 'r1', pos: 'RB', yr: 'SR', career: { gp: 5 }, gs: { rYds: 3600, gp: 12 } });
  check('Career-to-date folds in the live season', nickEarned(rusher) === 'The Workhorse');
  check('No milestone → no earned nickname (flavor stands)', nickEarned(P({ id: 'z', yr: 'JR' })) === null);
})();

/* 4) trait bias in the flavor pool */
(function () {
  check('A high-motor player draws from the motor pool', NICK_FLAVOR.motor.includes(nickFlavor(P({ id: 'm', mot: 90, comp: 50, ego: 50 }))));
  check('A high-composure player draws from the cool pool', NICK_FLAVOR.cool.includes(nickFlavor(P({ id: 'c', mot: 50, comp: 90, ego: 50 }))));
  check('A low-composure player draws from the boom pool', NICK_FLAVOR.boom.includes(nickFlavor(P({ id: 'b', mot: 50, comp: 20, ego: 50 }))));
  // linemen get grit, never speed flavor ("The Blur" on a tackle is absurd)
  check('A lineman never draws a speed nickname', !NICK_FLAVOR.boom.includes(nickFlavor(P({ id: 'ot', pos: 'OT', mot: 50, comp: 20, ego: 50 }))));
  check('A lineman never reads as a "playmaker"', !/playmaker/.test(knownFor(P({ pos: 'OG', comp: 20 }))) && !/playmaker/.test(knownFor(P({ pos: 'DT', comp: 20 }))));
})();

/* 5) knownFor + backstory */
(function () {
  check('knownFor leads with honors', /Heisman/.test(knownFor(P({ honors: [{ year: 1, award: 'Heisman' }] }))));
  check('knownFor surfaces a career milestone', /passer/.test(knownFor(P({ pos: 'QB', career: { pYds: 7000 } }))));
  check('knownFor falls back to a trait/rating (never empty)', knownFor(P({ id: 'k', mot: 90 })).length > 0 && knownFor(P({})).length > 0);
  check('knownFor is deterministic', knownFor(P({ id: 'k2', comp: 20 })) === knownFor(P({ id: 'k2', comp: 20 })));
  check('backstory reflects recruiting stars + home state', /Five-star out of TX/.test(backstory(P({ stars: 5, st: 'TX' }))));
  check('backstory always returns a line', backstory(P({})).length > 0 && backstory(P({ stars: 2, st: 'OH', mot: 90 })).length > 0);
})();

/* 6) fan-favorite / emergent status (45d) */
(function () {
  check('A low-star starter playing well is an Overachiever', fanFavorite(P({ so: 0, stars: 2, ov: 82 })) === 'Overachiever');
  check('A local starter is a Hometown Hero', fanFavorite(P({ so: 1, stars: 4, ov: 84, st: 'TX' }), 'TX') === 'Hometown Hero');
  check('A buried scrub is not a fan favorite', fanFavorite(P({ so: 5, stars: 2, ov: 70 })) === null);
  check('A blue-chip meeting expectations is not (yet) a folk hero', fanFavorite(P({ so: 0, stars: 5, ov: 84 })) === null);
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} identity-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

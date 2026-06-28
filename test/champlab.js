/* Sideline CHAMPIONSHIP LAB — standalone harness for the Phase 15 conference-championship engine.

   The engine lives in index.html (single source of truth). This harness EXTRACTS the CHAMPIONSHIP
   block (confChampGames) and the POSTSEASON block (the reworked seedPlayoff) and evals them here,
   then asserts: title-game pairings pick the right two teams per conference (top-2, or division
   winners for a divisioned conference; higher score hosts; independents get none), and the playoff
   seeding honours conference-champion auto-bids — the four best champions take the top-4 byes, all
   five champion auto-bids make the 12-team field (the 5th even when ranked low), the rest fill
   at-large by rank, and it's deterministic + falls back to top-12 with no champions.

   Run:  node test/champlab.js  */

const fs = require('fs');
const path = require('path');

/* ---------- extract the engine blocks from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function block(start, end) {
  const i0 = html.indexOf(start), i1 = html.indexOf(end);
  if (i0 < 0 || i1 < 0) { console.error('Could not find markers: ' + start); process.exit(2); }
  return html.slice(i0, i1);
}
eval(block('// === POSTSEASON ENGINE (Phase 12) START ===', '// === POSTSEASON ENGINE (Phase 12) END ==='));
eval(block('// === CHAMPIONSHIP ENGINE (Phase 15) START ===', '// === CHAMPIONSHIP ENGINE (Phase 15) END ==='));

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

/* ---------- confChampGames ---------- */
(function () {
  // Two no-division conferences + one divisioned + an independent. scoreOf from a fixed map.
  const teams = [
    { id: 'A1', conf: 'Alpha', div: '' }, { id: 'A2', conf: 'Alpha', div: '' },
    { id: 'A3', conf: 'Alpha', div: '' }, { id: 'A4', conf: 'Alpha', div: '' },
    { id: 'B1', conf: 'Beta', div: 'East' }, { id: 'B2', conf: 'Beta', div: 'East' },
    { id: 'B3', conf: 'Beta', div: 'West' }, { id: 'B4', conf: 'Beta', div: 'West' },
    { id: 'I1', conf: 'Independent', div: '' }, { id: 'I2', conf: 'Independent', div: '' },
    { id: 'S1', conf: 'Solo', div: '' },
  ];
  const score = { A1: 90, A2: 80, A3: 70, A4: 60, B1: 50, B2: 88, B3: 84, B4: 40, I1: 99, I2: 95, S1: 77 };
  const scoreOf = t => score[t.id];
  const games = confChampGames(teams, scoreOf);
  const byConf = {}; games.forEach(g => byConf[g.conf] = g);

  check('No-division conf pits its top two by score', byConf.Alpha && byConf.Alpha.home === 'A1' && byConf.Alpha.away === 'A2');
  check('Higher score hosts the title game', byConf.Alpha.home === 'A1');
  // Beta: East winner B2 (88) vs West winner B3 (84); higher (B2) hosts. NOT B1 (lower East seed).
  check('Divisioned conf pits its division winners', byConf.Beta && byConf.Beta.home === 'B2' && byConf.Beta.away === 'B3');
  check('Division winner beats a higher-overall non-winner', byConf.Beta.away === 'B3' && byConf.Beta.home !== 'B1');
  check('Independents play no title game', !byConf.Independent);
  check('A one-team conference plays no title game', !byConf.Solo);
  check('One game per qualifying conference', games.length === 2);
  // determinism / order-independence
  const shuffled = [...teams].reverse();
  check('confChampGames is order-independent', JSON.stringify(confChampGames(shuffled, scoreOf).map(g => g.conf + g.home + g.away).sort()) === JSON.stringify(games.map(g => g.conf + g.home + g.away).sort()));
})();

/* ---------- seedPlayoff with conference-champion auto-bids ---------- */
(function () {
  // 40 ranked teams t0 (best) … t39. Champions are a deliberate mix incl. a low-ranked one.
  const ranked = Array.from({ length: 40 }, (_, i) => 't' + i);
  const champs = ['t2', 't0', 't5', 't9', 't30'];   // unsorted on purpose; t30 is a low-ranked champ
  const seeds = seedPlayoff(ranked, champs);
  const top4 = seeds.slice(0, 4);

  check('Seeds the full 12-team field', seeds.length === 12 && new Set(seeds).size === 12);
  // top-4 byes = the four highest-RANKED champions: t0,t2,t5,t9 (ordered by rank)
  check('Top-4 byes are the four best conference champions', JSON.stringify(top4) === JSON.stringify(['t0', 't2', 't5', 't9']));
  check('All five champion auto-bids make the field', champs.every(c => seeds.includes(c)));
  check('A low-ranked champion still gets in (auto-bid)', seeds.includes('t30'));
  check('The 5th (low) champion slots to the last seed', seeds[11] === 't30');
  // the at-large pool fills by overall rank: best non-champ, non-bye teams are t1,t3,t4,t6,t7,t8 …
  check('At-large places fill by overall rank', seeds.includes('t1') && seeds.includes('t3') && seeds.includes('t4'));
  check('A non-champ never displaces a champion bye', !top4.includes('t1'));
  check('seedPlayoff is deterministic', JSON.stringify(seedPlayoff(ranked, champs)) === JSON.stringify(seeds));

  // back-compat: no champions → plain top-12 by rank (old behaviour, keeps postlab meaningful)
  check('No champions → falls back to top-12 by rank', JSON.stringify(seedPlayoff(ranked, [])) === JSON.stringify(ranked.slice(0, 12)));
  check('Too few champions → falls back to top-12', JSON.stringify(seedPlayoff(ranked, ['t0', 't1'])) === JSON.stringify(ranked.slice(0, 12)));

  // a champion ranked just inside the bubble: 5 champs all in top 12 → byes are the 4 best champs, 5th seeded by rank
  const champsHigh = ['t0', 't1', 't2', 't3', 't8'];
  const sp2 = seedPlayoff(ranked, champsHigh);
  check('Four best champs bye even when a non-champ outranks the 5th', JSON.stringify(sp2.slice(0, 4)) === JSON.stringify(['t0', 't1', 't2', 't3']) && sp2.includes('t8'));
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} championship-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

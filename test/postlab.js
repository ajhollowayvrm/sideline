/* Sideline POSTSEASON LAB — standalone harness for the Phase 12 postseason engine.

   The postseason engine lives in index.html (single source of truth). This harness EXTRACTS the engine
   block (between the POSTSEASON ENGINE markers) and evals it here, then drives a full 12-team bracket +
   a bowl slate and asserts: 12 seeds, top-4 byes, the bracket reduces to exactly one champion over four
   rounds, a chalk bracket crowns the #1 seed, bowls pair eligible teams without reuse and respect the
   slate cap, the payoff ladder is monotonic (champion > … > none), and everything is deterministic.

   Run:  node test/postlab.js  */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- extract the POSTSEASON ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === POSTSEASON ENGINE (Phase 12) START ===';
const END = '// === POSTSEASON ENGINE (Phase 12) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find POSTSEASON ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(i0, i1));   // leaks seedPlayoff/playoffRoundMatchups/genBowls/postseasonPayoff/…

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

// Simulate a whole playoff: `winnerOf(home,away)` decides each game. Returns {champion, roundCounts, finishes}.
function runBracket(seeds, winnerOf) {
  const finishes = {};                 // teamId → deepest finish label
  seeds.forEach((id, i) => finishes[id] = i < 4 ? 'firstround' /*placeholder, byes set below*/ : 'firstround');
  // mark all 12 as at least first-round participants
  seeds.forEach(id => finishes[id] = 'firstround');
  const counts = [];
  let winners = [];
  for (let round = 0; round < 4; round++) {
    const games = playoffRoundMatchups(round, seeds, winners);
    counts.push(games.length);
    const w = games.map(([h, a]) => {
      const win = winnerOf(h, a), lose = win === h ? a : h;
      // stamp the loser's finish by the round they lost in
      finishes[lose] = ['firstround', 'quarterfinal', 'semifinal', 'runnerup'][round];
      return win;
    });
    winners = w;
  }
  const champion = winners[0];
  finishes[champion] = 'champion';
  return { champion, counts, finishes };
}

const seeds = Array.from({ length: 12 }, (_, i) => 'S' + (i + 1));   // S1 = #1 seed … S12 = #12

/* 1) seeding: exactly 12 from the ranked field */
(function () {
  const ranked = Array.from({ length: 80 }, (_, i) => 't' + i);
  const sp = seedPlayoff(ranked);
  check('Playoff seeds the top 12 teams', sp.length === 12 && sp[0] === 't0' && sp[11] === 't11');
})();

/* 2) round shape: 4 → 4 → 2 → 1; top-4 seeds bye the first round */
(function () {
  const r0 = playoffRoundMatchups(0, seeds, []);
  const r0teams = r0.flat();
  check('First round is 4 games (seeds 5–12 only)', r0.length === 4 && !r0teams.includes('S1') && !r0teams.includes('S4') && r0teams.includes('S5') && r0teams.includes('S12'));
  check('Higher seed hosts in the first round', r0.every(([h, a]) => +h.slice(1) < +a.slice(1)));
})();

/* 3) full bracket reduces to exactly one champion over four rounds */
(function () {
  const chalk = (h, a) => (+h.slice(1) < +a.slice(1) ? h : a);   // higher seed always wins
  const res = runBracket(seeds, chalk);
  check('Bracket is 4/4/2/1 games per round', JSON.stringify(res.counts) === JSON.stringify([4, 4, 2, 1]), res.counts.join('/'));
  check('A chalk bracket crowns the #1 seed', res.champion === 'S1', 'champ ' + res.champion);
  check('Every seed gets a finish label', Object.keys(res.finishes).length === 12 && Object.values(res.finishes).every(Boolean));
  check('Exactly one champion and one runner-up', Object.values(res.finishes).filter(f => f === 'champion').length === 1 && Object.values(res.finishes).filter(f => f === 'runnerup').length === 1);
})();

/* 4) upsets still resolve to a single champion (no structural break) */
(function () {
  const r = rng(42);
  const coin = (h, a) => (r() < 0.5 ? h : a);
  let champs = new Set();
  for (let i = 0; i < 50; i++) { const res = runBracket(seeds, coin); champs.add(res.champion); check.last = res; }
  check('Random brackets always produce a valid single champion', [...champs].every(c => seeds.includes(c)) && champs.size > 1, champs.size + ' distinct champions over 50 runs');
})();

/* 5) bowls: pair eligible teams, no reuse, capped to the slate */
(function () {
  const eligible = Array.from({ length: 60 }, (_, i) => 'b' + i);   // 60 bowl-eligible non-playoff teams
  const bowls = genBowls(eligible, 2026);
  const used = bowls.flatMap(b => [b.home, b.away]);
  check('Bowls pair teams (2 per game)', bowls.every(b => b.home && b.away && b.home !== b.away));
  check('No team appears in two bowls', new Set(used).size === used.length);
  check('Bowl slate is capped (≤ MAX_BOWLS)', bowls.length <= 18, bowls.length + ' bowls');
  check('Every bowl carries a name', bowls.every(b => typeof b.name === 'string' && b.name.length));
  check('Bowls are deterministic by seed', JSON.stringify(genBowls(eligible, 2026)) === JSON.stringify(genBowls(eligible, 2026)));
  const odd = genBowls(['x', 'y', 'z'], 1);
  check('Odd eligible count drops the unpaired team', odd.length === 1);
})();

/* 6) payoff ladder is monotonic across every dimension */
(function () {
  const order = ['none', 'bowlloss', 'bowlwin', 'firstround', 'quarterfinal', 'semifinal', 'runnerup', 'champion'];
  const p = order.map(postseasonPayoff);
  const mono = key => p.every((v, i) => i === 0 || v[key] >= p[i - 1][key]);
  const strictTop = key => postseasonPayoff('champion')[key] > postseasonPayoff('firstround')[key];
  check('Prestige payoff rises with a deeper finish', mono('prestige') && strictTop('prestige'));
  check('Recruiting boost rises with a deeper finish', mono('recruitBoost') && strictTop('recruitBoost'));
  check('Revenue payoff rises with a deeper finish', mono('revenue') && strictTop('revenue'));
  check('Champion recruit boost stays small (≤ 0.12)', postseasonPayoff('champion').recruitBoost <= 0.12);
  check('Missing the postseason pays nothing', postseasonPayoff('none').revenue === 0 && postseasonPayoff('none').recruitBoost === 0);
  check('Unknown finish falls back to none', postseasonPayoff('garbage').revenue === 0);
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} postseason-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

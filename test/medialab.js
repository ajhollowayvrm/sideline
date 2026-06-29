/* Sideline MEDIA LAB — standalone harness for the Phase 19 media engine.

   The engine lives in index.html (single source of truth). This harness EXTRACTS the MEDIA ENGINE
   block (computePoll / gameStoryTag / mkStory) and evals it here, then asserts: the AP poll has
   inertia (a fallen #1 slides a few spots, not ten), preseason == score order, movement arrows are
   right, entrants climb in gradually; story classification fires the right tag; and the headline/body
   templates are non-empty + deterministic.

   Run:  node test/medialab.js  */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- extract the MEDIA ENGINE block ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === MEDIA ENGINE (Phase 19) START ===', END = '// === MEDIA ENGINE (Phase 19) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find MEDIA ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(i0, i1));   // leaks computePoll / gameStoryTag / mkStory / POLL_MAX_MOVE / …

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

const ranked = n => Array.from({ length: n }, (_, i) => ({ id: 't' + i, score: 100 - i }));   // t0 best
const rankOf = (poll, id) => { const e = poll.top.find(x => x.teamId === id); return e ? e.rank : null; };

/* 1) preseason poll == score order */
(function () {
  const r = ranked(40);
  const poll = computePoll(null, r, 0);
  check('Poll is a Top 25', poll.top.length === 25 && poll.top[0].rank === 1 && poll.top[24].rank === 25);
  check('Preseason poll follows score order', poll.top[0].teamId === 't0' && poll.top[4].teamId === 't4');
  check('Preseason entries have no previous rank', poll.top.every(e => e.prev === null));
  check('Others receiving votes is a short tail', poll.others.length >= 1 && poll.others.length <= 5 && poll.others[0] === 't25');
})();

/* 2) inertia: a former #1 that craters in score slides only a few spots */
(function () {
  const wk1 = computePoll(null, ranked(40), 1);
  // t0 collapses to score-rank ~9 (swap it well down the order); everyone else essentially holds
  const r2 = ranked(40).filter(e => e.id !== 't0');
  r2.splice(8, 0, { id: 't0', score: 91.5 });            // now ~9th by score
  const wk2 = computePoll(wk1, r2, 2);
  const MAXMOVE = 4;   // POLL_MAX_MOVE in the engine (a const, so not leaked by eval); +slack for re-sort displacement
  const nr = rankOf(wk2, 't0');
  check('A fallen #1 actually drops', nr > 1, '#' + nr);
  check('Inertia: the fall is capped (a few spots, not all the way to ~9)', nr <= 1 + MAXMOVE + 2 && nr < 9, '#' + nr);
  check('Its arrow shows the previous rank (#1)', wk2.top.find(e => e.teamId === 't0').prev === 1);
})();

/* 3) entrants climb in gradually, not instantly to their score rank */
(function () {
  const wk1 = computePoll(null, ranked(40), 1);          // t30 is unranked (score rank 31)
  const r2 = ranked(40).filter(e => e.id !== 't30');
  r2.splice(17, 0, { id: 't30', score: 82.5 });          // t30 surges to ~18th by score
  const wk2 = computePoll(wk1, r2, 2);
  const nr = rankOf(wk2, 't30');
  check('A surging unranked team climbs gradually (not straight to its score rank)', nr === null || nr > 18 - 1, 'rank ' + nr);
})();

/* 4) determinism */
(function () {
  const a = JSON.stringify(computePoll(null, ranked(40), 1));
  const b = JSON.stringify(computePoll(null, ranked(40), 1));
  check('computePoll is deterministic', a === b);
})();

/* 5) story classification */
(function () {
  check('Upset: a ranked favorite loses to a weaker unranked team', gameStoryTag({ rank: null, ovr: 74 }, { rank: 3, ovr: 84 }, 6) === 'upset');
  check('Ranked clash: two ranked teams', gameStoryTag({ rank: 5, ovr: 86 }, { rank: 12, ovr: 83 }, 10) === 'ranked');
  check('Blowout: unranked, big margin', gameStoryTag({ rank: null, ovr: 80 }, { rank: null, ovr: 70 }, 31) === 'blowout');
  check('Not every game is news (close, unranked, small margin → null)', gameStoryTag({ rank: null, ovr: 78 }, { rank: null, ovr: 77 }, 7) === null);
  check('Beating a ranked team by a hair with similar talent is not an "upset"', gameStoryTag({ rank: null, ovr: 83 }, { rank: 8, ovr: 84 }, 3) !== 'upset');
})();

/* 6) templates are non-empty + deterministic */
(function () {
  const d = { w: 'VAN', wLong: 'Vanderbilt', wRank: null, l: 'UGA', lLong: 'Georgia', lRank: 3, ws: 24, ls: 21, margin: 3 };
  const s1 = mkStory('upset', d, rng(7)), s2 = mkStory('upset', d, rng(7));
  check('mkStory produces a non-empty headline + body', s1.headline.length > 0 && s1.body.length > 0);
  check('mkStory is deterministic for a fixed rng', JSON.stringify(s1) === JSON.stringify(s2));
  const tags = ['upset', 'ranked', 'blowout', 'pow', 'riser', 'commit', 'flip'];
  const data = { w: 'A', wLong: 'Alpha', l: 'B', lLong: 'Beta', wRank: 5, lRank: 9, ws: 30, ls: 10, margin: 20, name: 'J. Doe', pos: 'QB', abbr: 'A', line: '300 yds', delta: 5, rank: 7, stars: 5 };
  check('Every story tag renders a headline', tags.every(tg => mkStory(tg, data, rng(1)).headline.length > 0), tags.join(','));
})();

/* 7) approval rating (Phase 19b) */
(function () {
  check('Win expectation rises with prestige + is bounded', winExpectation(90) > winExpectation(40) && winExpectation(10) >= 0.15 && winExpectation(99) <= 0.85, `${winExpectation(40).toFixed(2)} → ${winExpectation(90).toFixed(2)}`);
  // per-game
  const win = { won: true, myOvr: 80, oppOvr: 80 }, loss = { won: false, myOvr: 80, oppOvr: 80 };
  check('A win helps approval, a loss hurts it', gameApprovalDelta(win) > 0 && gameApprovalDelta(loss) < 0);
  check('Beating a better team helps more than beating a worse one', gameApprovalDelta({ won: true, myOvr: 75, oppOvr: 85 }) > gameApprovalDelta({ won: true, myOvr: 85, oppOvr: 70 }));
  check('Losing to a much weaker team is the worst result', gameApprovalDelta({ won: false, myOvr: 85, oppOvr: 70 }) < gameApprovalDelta({ won: false, myOvr: 75, oppOvr: 85 }));
  check('Per-game approval swing is bounded (±5)', [win, loss, { won: false, myOvr: 90, oppOvr: 60 }].every(c => Math.abs(gameApprovalDelta(c)) <= 5));
  // season
  const over = seasonApprovalDelta({ w: 11, l: 2, prestige: 50 }), under = seasonApprovalDelta({ w: 4, l: 9, prestige: 50 });
  check('Over-performing prestige lifts approval, under-performing tanks it', over > 0 && under < 0, `${over.toFixed(1)} vs ${under.toFixed(1)}`);
  check('Titles add to the season swing', seasonApprovalDelta({ w: 13, l: 1, prestige: 50, natTitle: true }) > seasonApprovalDelta({ w: 13, l: 1, prestige: 50 }));
  check('Season swing is bounded (±25)', Math.abs(seasonApprovalDelta({ w: 14, l: 0, prestige: 20, natTitle: true })) <= 25);
  check('approvalUpdate is bounded + mean-reverts toward 50', approvalUpdate(90, 0) < 90 && approvalUpdate(10, 0) > 10 && approvalUpdate(99, 25) <= 99 && approvalUpdate(3, -25) >= 3);
})();

/* 8) the hot seat + firing (Phase 19b) */
(function () {
  check('Hot-seat tier is monotonic in approval', hotSeatTier(80, 50, 3).tier === 'safe' && hotSeatTier(33, 50, 3).tier === 'warm' && hotSeatTier(15, 50, 3).tier === 'hot');
  check('A blue-blood runs hotter for the same approval', hotSeatTier(30, 90, 3).tier === 'hot' && hotSeatTier(30, 30, 3).tier !== 'hot', `90→${hotSeatTier(30, 90, 3).tier}, 30→${hotSeatTier(30, 30, 3).tier}`);
  check('Year one is a honeymoon (never hot)', hotSeatTier(20, 90, 0).tier !== 'hot');
  check('Not fired after a single mediocre year', firingDecision([45], 50, 1) === false);
  check('A total meltdown ends a tenure even early', firingDecision([10], 50, 1) === true);
  check('Two straight years on the hot seat → fired', firingDecision([20, 20], 50, 2) === true);
  check('A recovery year saves the job', firingDecision([20, 45], 50, 2) === false);
  check('A blue-blood is fired for sustained mediocrity a mid-major survives', firingDecision([26, 26], 90, 2) === true && firingDecision([26, 26], 30, 2) === false);
})();

/* 9) press conferences (Phase 19b) */
(function () {
  const p = pressPrompt({ loss: true }, 123);
  check('pressPrompt returns a question + ≥2 keyed choices', p.q.length > 0 && p.choices.length >= 2 && p.choices.every(c => c.key && c.label));
  check('pressPrompt is deterministic by seed', JSON.stringify(pressPrompt({ loss: true }, 123)) === JSON.stringify(pressPrompt({ loss: true }, 123)));
  check('Every offered choice maps to an effect', [pressPrompt({ win: true }, 1), pressPrompt({ marquee: true }, 2), pressPrompt({}, 3)].every(pr => pr.choices.every(c => pressEffect(c.key))));
  check('Press effects are signed sensibly', pressEffect('deflect').approval < 0 && pressEffect('hype').buzz > 0 && pressEffect('accountability').dev > 0);
  check('Press effects stay small + bounded', ['rally', 'accountability', 'deflect', 'humble', 'hype', 'respect', 'confident', 'bulletin', 'pitch', 'culture'].every(k => { const e = pressEffect(k); return Math.abs(e.approval) <= 3 && e.buzz <= 0.05 && Math.abs(e.dev) <= 0.02; }));
  check('An unknown choice is a no-op', pressEffect('???').approval === 0 && pressEffect('???').buzz === 0);
})();

/* 10) coaching-search openings (Phase 19c) */
(function () {
  const teams = []; for (let i = 0; i < 60; i++) teams.push({ id: 't' + i, prestige: 20 + i });   // 20..79
  const pres = id => teams.find(t => t.id === id).prestige;
  const ids = coachOpenings(teams, 75, 9, 4);
  check('coachOpenings returns the requested number of jobs', ids.length === 4 && new Set(ids).size === 4);
  check('Openings skew below your last job (a step down is the likely landing)', ids.reduce((s, id) => s + pres(id), 0) / ids.length < 75, 'avg ' + (ids.reduce((s, id) => s + pres(id), 0) / ids.length).toFixed(0));
  check('coachOpenings only offers jobs from the candidate pool', ids.every(id => teams.some(t => t.id === id)));
  check('coachOpenings is deterministic by seed', JSON.stringify(coachOpenings(teams, 75, 9, 4)) === JSON.stringify(ids));
  check('coachOpenings varies by seed', JSON.stringify(coachOpenings(teams, 75, 3, 4)) !== JSON.stringify(ids));
  check('A short candidate list returns at most what exists', coachOpenings(teams.slice(0, 2), 75, 9, 4).length <= 2);
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} media-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

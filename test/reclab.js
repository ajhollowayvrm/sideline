/* Sideline RECRUIT LAB — standalone harness for the Phase 4 recruiting engine.

   The recruiting engine lives in index.html (single source of truth). This harness
   EXTRACTS the engine block (between the RECRUIT ENGINE markers) and evals it here with
   the same tiny helpers + data arrays, then runs full recruiting cycles and asserts the
   output is realistic, convergent, prestige-sensitive, responsive to player effort, and
   deterministic.

   Run:  node test/reclab.js

   Offline lab (no browser). The in-browser QA gate (npm run qa) validates the integrated
   recruiting UI end-to-end; this validates the model itself across many cycles. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- extract the RECRUIT ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/* ---------- data arrays the engine reads — PULLED LIVE, never copied ----------
   These used to be hand-copied subsets, and they rotted. `STATES` held 15 of the real 50, so
   in-state density ran 3.3x the shipped game and the geography check was far easier to pass than
   reality. `POS` still carried the pre-Phase-52 `S`, which no longer exists: `posAttrW('S')` falls
   back to the LINEBACKER row and `pickArch(r,'S')` returns null, so ~9.5% of every pool this lab
   validated was generated through a degraded path — the same instrument defect Phase 53 fixed in
   simlab. A sloppy eval leaks function declarations but NOT block-scoped consts, so the engine
   blocks eval straight in while the data arrays have to be sliced out and eval'd as expressions. */
function grabConst(name) {
  const decl = 'const ' + name + '=';
  const i = html.indexOf('\n' + decl);
  if (i < 0) { console.error('Could not find `' + decl + '` in index.html'); process.exit(2); }
  let j = i + 1 + decl.length, depth = 0, str = null;
  for (; j < html.length; j++) {
    const c = html[j];
    if (str) { if (c === '\\') j++; else if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (c === ';' && depth === 0) break;
  }
  return eval('(' + html.slice(i + 1 + decl.length, j) + ')');
}
const FN = grabConst('FN');
const LN = grabConst('LN');
const STATES = grabConst('STATES');
const POS = grabConst('POS');
const PREFS = grabConst('PREFS');
const START = '// === RECRUIT ENGINE (Phase 4) START ===';
const END = '// === RECRUIT ENGINE (Phase 4) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find RECRUIT ENGINE markers in index.html'); process.exit(2); }
// genRecruits now stamps per-player traits via the TRAIT ENGINE block — pull it in first.
const T0 = html.indexOf('// === TRAIT ENGINE (Phase 10) START ==='), T1 = html.indexOf('// === TRAIT ENGINE (Phase 10) END ===');
if (T0 < 0 || T1 < 0) { console.error('Could not find TRAIT ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(T0, T1));
// Phase 51: a prospect's ability now lives in his six-attribute profile (genAttrs), with `ov` read
// back off it — so the ATTRIBUTE ENGINE has to be in scope before genRecruits runs.
const A0 = html.indexOf('// === ATTRIBUTE ENGINE (Phase 52) START ==='), A1 = html.indexOf('// === ATTRIBUTE ENGINE (Phase 52) END ===');
if (A0 < 0 || A1 < 0) { console.error('Could not find ATTRIBUTE ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(A0, A1));
// eval into this scope so genRecruits/advanceRecruiting/coachMods/… leak out (sloppy eval)
eval(html.slice(i0, i1));

/* ---------- a faithful-enough synthetic world (mirrors genWorld prestige spread) ---------- */
function genWorld(seed, n = 134) {
  const r = rng(seed); const teams = [];
  for (let i = 0; i < n; i++) {
    // mirror the real spread: a handful of blue-bloods reach the high 80s/90s, a long tail down to ~25
    const bump = i < 8 ? 50 : i < 24 ? 30 : i < 50 ? 14 : 0;
    const prestige = clamp(Math.round(35 + ri(r, -10, 10) + bump), 20, 98);
    teams.push({ id: 't' + i, prestige, needs: {} });
  }
  return teams;
}

/* ---------- run a full recruiting cycle (15 weeks), optionally with a scripted player ---------- */
function runCycle(seed, opts = {}) {
  const teams = opts.teams || genWorld(seed);
  const pool = genRecruits(seed, teams);
  const WEEKS = 15;
  for (let w = 1; w <= WEEKS; w++) {
    if (opts.preWeek) opts.preWeek(pool, teams, w);   // scripted player effort
    advanceRecruiting(pool, teams, w, WEEKS, seed, w === WEEKS);
  }
  return { teams, pool };
}

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

/* 1) generation: pool size + top-heavy star distribution */
(function () {
  const { pool } = runCycle(2026);
  const five = pool.filter(r => r.stars === 5).length;
  const four = pool.filter(r => r.stars === 4).length;
  const three = pool.filter(r => r.stars === 3).length;
  const two = pool.filter(r => r.stars === 2).length;
  // Phase 57a: the bar is the MEASURED ranked board — 3,692 prospects carrying a star rating per
  // cycle (cfb-recruiting.md §1). The old 3,200-3,600 was a hand-set band around a hand-set 3,400.
  check('Pool is the measured national ranked board (~3,692)', pool.length >= 3500 && pool.length <= 3900, pool.length + ' prospects');
  check('Star mix is top-heavy (5★ < 4★ < 3★, with a deep 2★ tail)', five < four && four < three && two > four, `${five}/${four}/${three}/${two}`);
  check('A handful of 5★, the vast majority are 3★ or below', five >= 18 && five <= 50 && (three + two) > pool.length * 0.7, `${five} 5★, ${three + two} 3★/2★`);
  // every prospect has at least one suitor, fewer suitors are not absurd
  const sui = pool.map(r => Object.keys(r.iv).length);
  check('Every prospect has 2–6 suitors', Math.min(...sui) >= 2 && Math.max(...sui) <= 6, `${Math.min(...sui)}–${Math.max(...sui)}`);
  check('Prospect ratings are recruit-shaped (ov 58–99, pot ≥ ov)', pool.every(r => r.ov >= 58 && r.ov <= 99 && r.pot >= r.ov));
})();

/* 2) convergence: every program builds a real class, and the tail goes elsewhere
   ------------------------------------------------------------------------------------------------
   Phase 56 re-pointed this section. It used to assert POOL CONSUMPTION (`signed/haveSuitor ≥ .88`,
   `signed/pool ≥ .85`), which docs/reference/cfb-recruiting.md §2 shows is not a health metric at
   all: the real ranked board is ~4,158 against ~2,650 FBS signatures, so **36% of it signs FCS,
   JUCO, preferred-walk-on or nowhere** and full consumption would be WRONG. It is a supply-versus-
   capacity accounting identity, which is exactly why the number moved every time contestedness
   moved (92% P33 → 91% P36 → ~80% P37) and why the bar was quietly lowered 88 → 85 at Phase 51 for
   a shift nothing behavioural had caused. Note also that every generated prospect gets suitors, so
   the two "different" denominators were always the same number.
   What real recruiting is tight about is PER-TEAM FILL: class size 20.2 mean, p10 13, and only 3.3%
   of programs sign under 10. Those are the numbers asserted now. */
(function () {
  const { pool } = runCycle(2026);
  const signed = pool.filter(r => r.committedTo && r.signed);
  const consumed = signed.length / pool.length;
  // a BAND, not a floor — too high means the board is undersized against FBS capacity (real: 63.7%)
  check('Board consumption sits in the measured band (a third goes elsewhere)',
    consumed >= 0.55 && consumed <= 0.92, `${(100 * consumed).toFixed(1)}% of the pool signed`);
  check('All commits go to an actual suitor', pool.every(r => !r.committedTo || r.iv[r.committedTo] != null));
  const counts = {}; pool.forEach(r => { if (r.committedTo) counts[r.committedTo] = (counts[r.committedTo] || 0) + 1; });
  check('No team signs more than the class cap (25)', Math.max(...Object.values(counts)) <= 25, 'max class ' + Math.max(...Object.values(counts)));
  const sizes = genWorld(2026).map(t => counts[t.id] || 0);
  const filled = sizes.filter(n => n >= 18).length;
  check('Most programs land a substantial class (≥100 of 134 fill ≥18)', filled >= 100, `${filled}/134 teams filled ≥18`);
  // the real check the old one was standing in for: essentially nobody whiffs on a class entirely
  const tiny = sizes.filter(n => n < 10).length;
  check('Almost no program signs under 10 (real: 3.3%)', tiny / sizes.length <= 0.10, `${tiny}/134 signed <10`);
  const sorted = [...sizes].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(0.10 * sorted.length)];
  check('The bottom decile still signs a real class (real p10: 13)', p10 >= 10, `p10 = ${p10}`);
})();

/* 3) prestige sensitivity: better programs sign better classes, top prospects go to powers */
(function () {
  const { teams, pool } = runCycle(2026);
  const byPrestige = [...teams].sort((a, b) => b.prestige - a.prestige);
  const top = byPrestige.slice(0, 20), bot = byPrestige.slice(-20);
  const topAvg = avg(top.map(t => classScore(t, pool))), botAvg = avg(bot.map(t => classScore(t, pool)));
  check('Better programs sign better classes (top-20 prestige ≫ bottom-20)', topAvg > botAvg * 1.4, `top ${topAvg.toFixed(0)} vs bot ${botAvg.toFixed(0)}`);
  const tById = {}; teams.forEach(t => tById[t.id] = t);
  const fiveLanded = pool.filter(r => r.stars === 5 && r.committedTo).map(r => tById[r.committedTo].prestige);
  check('5★ prospects land at high-prestige programs (avg ≥ 80)', avg(fiveLanded) >= 80, `avg landing prestige ${avg(fiveLanded).toFixed(0)}`);
})();

/* 4) player effort matters: actively pushing a target lands more than idling */
(function () {
  // pick a mid-prestige team; chase 4★ targets it isn't the natural leader for.
  function chase(push) {
    const teams = genWorld(7);
    const me = teams.find(t => t.prestige >= 68 && t.prestige <= 74) || teams[40];
    const pool = genRecruits(7, teams);
    // targets: 4★ where `me` is not already a suitor (we'll "offer" by adding modest interest)
    const targets = pool.filter(r => r.stars === 4 && r.iv[me.id] == null).slice(0, 20);
    targets.forEach(r => { r.iv[me.id] = 22; });   // offer baseline
    const WEEKS = 15;
    for (let w = 1; w <= WEEKS; w++) {
      if (push) targets.forEach(r => { if (!r.committedTo) r.iv[me.id] = clamp((r.iv[me.id] || 0) + 13, 0, 100); });
      advanceRecruiting(pool, teams, w, WEEKS, 7, w === WEEKS);
    }
    return targets.filter(r => r.committedTo === me.id).length;
  }
  const pushed = chase(true), idle = chase(false);
  check('Player effort matters: pushing lands more than idling', pushed > idle, `pushed ${pushed} vs idle ${idle} of 20`);
  check('Pushing a fitting target lands a real share', pushed >= 6, `${pushed}/20 landed`);
})();

/* 4b) THE PASSIVE COACH — the scenario this lab never had (Phase 56)
   ------------------------------------------------------------------------------------------------
   Phase 44's playtest found a hands-off coach signing ZERO while AI programs signed 19-25, and
   reclab was green through all of it. It could not see the bug: §4 above compares a scripted pusher
   against an idler on the SAME 20 hand-seeded targets, which measures the value of effort — not
   what happens to a program nobody recruits for. The cliff exists because `advanceRecruiting` skips
   `playerTeamId` in the concentrated-effort pass by design (the player is supposed to act), so a
   passive player team gets passive growth only, on the handful of prospects it already sits on.
   That is a real and deliberate engine property. What it MEANS is that the app layer owes the
   player team a recruiter — either his own intents or the Phase 44 `autoRecruitWeek` autopilot. So
   this asserts the property directly, and pins its SIZE: if a future phase ever quietly narrows the
   gap to zero the autopilot has become load-bearing in a way nobody decided, and if it widens the
   cliff is back. (`autoRecruitWeek` itself is app-layer and cannot be tested here; lifting it into
   the fence so the full three-way ladder is gate-visible is Phase 57 work.) */
(function () {
  const SEED = 4411;
  function cycle(playerTeamId) {
    const teams = genWorld(SEED);
    const pool = genRecruits(SEED, teams);
    const WEEKS = 15;
    for (let w = 1; w <= WEEKS; w++) advanceRecruiting(pool, teams, w, WEEKS, SEED, w === WEEKS, undefined, undefined, playerTeamId);
    return { teams, pool };
  }
  const classOf = (pool, id) => pool.filter(r => r.committedTo === id);
  const teams0 = genWorld(SEED);
  // a solid mid-major-to-power program: high enough to have a real board, not a blue-blood outlier
  const me = teams0.find(t => t.prestige >= 66 && t.prestige <= 74) || teams0[30];

  const recruited = classOf(cycle(undefined).pool, me.id);       // the AI brain works his board
  const passive = classOf(cycle(me.id).pool, me.id);             // nobody works his board
  const bc = c => c.filter(r => r.stars >= 4).length;

  // What this actually measured, once written: NOTHING CHANGES. A prestige-71 program seeded as a
  // suitor on 119 of 3,400 signs the same 25 players, 25 of them blue-chips, whether the AI brain
  // works its board or nobody does. So the Phase 44 cliff is NOT an engine property — it is created
  // in the app layer (the board model plus `decayNeglect` eating the player's seeded interest), and
  // reclab structurally cannot see it while `advanceRecruiting` is all it drives. Worth pinning:
  // if this ever starts differing, the engine's contract with the app changed.
  check('Passive coach: the engine resolves a full class for him regardless',
    passive.length >= 18 && recruited.length >= 18,
    `passive ${passive.length}, AI-recruited ${recruited.length} — the Phase 44 cliff is app-layer`);
  check('Passive coach: the AI concentrated-effort pass changes his class barely at all',
    Math.abs(bc(passive) - bc(recruited)) <= 2,
    `blue-chips ${bc(passive)} vs ${bc(recruited)}`);

  /* And the reason for that, measured — the finding this scenario actually turned up.
     `advanceRecruiting`'s passive growth is `iv += (1.0 + fit*3.2) * (0.6 + r()*0.9)` every week.
     For a program whose `recruitFit` is good, that is ~4.4/week against a COMMIT_THRESH of 68 from a
     seeded base near 46 — so the relationship clears the bar on its own by week 7 and pins at the
     100 ceiling by week 13. Every mechanic Phases 33-38 layered on (the AI brain, NIL, the league
     ripple, official visits, pitch angles, double-downs, diminishing returns) is therefore moving a
     number that is already saturated, which is why an aggressive push cannot reliably poach and why
     a hands-off program is indistinguishable from an engaged one here.
     This asserts the CURRENT shape so Phase 57 has a number to move; see
     docs/reference/cfb-recruiting.md. It is a characterization check, not a target. */
  const t2 = genWorld(SEED), p2 = genRecruits(SEED, t2);
  const him = t2.find(t => t.prestige >= 66 && t.prestige <= 74) || t2[30];
  const track = p2.filter(r => r.iv[him.id] != null && r.stars === 4).slice(0, 60);
  let clearedByWeek7 = 0;
  for (let w = 1; w <= 15; w++) {
    advanceRecruiting(p2, t2, w, 15, SEED, w === 15);
    if (w === 7) clearedByWeek7 = track.filter(r => (r.iv[him.id] || 0) >= 68).length;
  }
  const pinned = track.filter(r => (r.iv[him.id] || 0) >= 99.9).length;
  check('CHARACTERIZATION: interest saturates on passive growth alone (Phase 57 target)',
    clearedByWeek7 >= track.length * 0.5 && pinned >= track.length * 0.5,
    `${clearedByWeek7}/${track.length} past the commit bar by week 7, ${pinned}/${track.length} pinned at 100 by Signing Day`);
})();

/* 5) determinism: same seed → identical cycle outcome */
(function () {
  const a = runCycle(99).pool.map(r => r.id + ':' + (r.committedTo || '-')).join('|');
  const b = runCycle(99).pool.map(r => r.id + ':' + (r.committedTo || '-')).join('|');
  const c = runCycle(123).pool.map(r => r.id + ':' + (r.committedTo || '-')).join('|');
  check('Cycle deterministic: same seed → same commitments', a === b);
  check('Cycle varies by seed', a !== c);
})();

/* 6) coach mods wire archetype/history sensibly */
(function () {
  const rec = coachMods({ archetype: 'Recruiter', history: 'Lifer' });
  const mgr = coachMods({ archetype: 'Manager', history: 'Coordinator' });
  const ana = coachMods({ archetype: 'Motivator', history: 'Analyst' });
  const hsl = coachMods({ archetype: 'Motivator', history: 'High School Legend' });
  const nfl = coachMods({ archetype: 'Manager', history: 'NFL Transplant' });
  check('Recruiter gets more points + board slots than Manager', rec.points > mgr.points && rec.slots > mgr.slots, `rec ${rec.points}/${rec.slots} vs mgr ${mgr.points}/${mgr.slots}`);
  check('Analyst scouts faster (scout mult > 1)', ana.scout > 1, ana.scout.toFixed(2));
  check('High School Legend gets a home-state bonus (> 1)', hsl.homeBonus > 1, hsl.homeBonus.toFixed(2));
  check('NFL Transplant trades board slots for prestige', nfl.prestige > 0 && nfl.slots < 0, `prestige +${nfl.prestige}, slots ${nfl.slots}`);
})();

/* 7) AI geography (Phase 8): an in-state program lands more of its in-state prospects than the
   same program with no home state (geography off). */
(function () {
  const seed = 55;
  function txLanded(geo) {
    const teams = genWorld(seed);
    const me = teams[40]; me.prestige = 72; if (geo) me.homeState = 'TX';
    const pool = genRecruits(seed, teams);
    for (let w = 1; w <= 15; w++) advanceRecruiting(pool, teams, w, 15, seed, w === 15);
    return pool.filter(r => r.committedTo === me.id && r.st === 'TX').length;
  }
  const withGeo = txLanded(true), without = txLanded(false);
  check('AI geography: in-state program lands more in-state recruits', withGeo > without, `geo ${withGeo} vs none ${without}`);
})();

/* 8) decommits (Phase 16): a VERBAL commit can flip to a rival who pulls clearly ahead; signed
   commits never flip, and a finalize pass never flips (firm verbals are locked at signing). */
(function () {
  // N recruits all verbally committed to A; B (a better fit) is given a big interest lead.
  function scenario(opts) {
    const A = { id: 'A', prestige: 60 }, B = { id: 'B', prestige: 85 };
    const pool = [];
    for (let i = 0; i < 200; i++) pool.push({
      id: 'x' + i, pos: 'WR', st: 'TX', stars: 4,
      iv: { A: opts.aIv, B: opts.bIv }, committedTo: 'A', signed: !!opts.signed
    });
    advanceRecruiting(pool, [A, B], opts.week || 5, 15, opts.seed == null ? 5 : opts.seed, !!opts.finalize);
    return pool;
  }
  // B far ahead → a real share of verbals flip to B
  const flipped = scenario({ aIv: 40, bIv: 96 });
  const toB = flipped.filter(r => r.committedTo === 'B');
  check('Decommit: a verbal flips to a rival that pulls clearly ahead', toB.length > 0, `${toB.length}/200 flipped to B`);
  check('Decommit: flips are tagged (_flipped from→to) for the UI', toB.every(r => r._flipped && r._flipped.from === 'A' && r._flipped.to === 'B'));
  check('Decommit: not everyone flips (it is probabilistic, not automatic)', toB.length < 200, `${toB.length} flipped`);
  // B only barely ahead (gap below DECOMMIT_GAP after growth) → no flips
  const steady = scenario({ aIv: 72, bIv: 55 });
  check('Decommit: a small rival gap does NOT flip a verbal', steady.every(r => r.committedTo === 'A' && !r._flipped));
  // signed commits are locked — never flip even with a huge rival lead
  const signed = scenario({ aIv: 40, bIv: 96, signed: true });
  check('Decommit: a SIGNED commit never flips', signed.every(r => r.committedTo === 'A' && !r._flipped));
  // a finalize (Signing Day) pass locks verbals — no flips, and they sign with their school
  const fin = scenario({ aIv: 40, bIv: 96, finalize: true });
  check('Decommit: a finalize pass never flips (verbals lock + sign)', fin.every(r => r.committedTo === 'A' && r.signed && !r._flipped));
  // determinism: same seed → same flips
  const d1 = scenario({ aIv: 40, bIv: 96, seed: 11 }).filter(r => r.committedTo === 'B').map(r => r.id).join(',');
  const d2 = scenario({ aIv: 40, bIv: 96, seed: 11 }).filter(r => r.committedTo === 'B').map(r => r.id).join(',');
  check('Decommit: flips are deterministic by seed', d1 === d2 && d1.length > 0);
})();

/* 9) scouting facility (Phase 33): the AI recruiting brain spends a budget scaled by fac.scouting, so
   a program with a strong scouting facility out-recruits an otherwise-identical program with a weak one. */
(function () {
  // Controlled head-to-head: two rivals with IDENTICAL prestige/fit but different scouting facilities
  // contest the same recruits. The better-scouting program spends more concentrated weekly actions, so
  // it should land more of the shared board — the budget is the only difference.
  const A = { id: 'A', prestige: 60, fac: { scouting: 1 } };
  const B = { id: 'B', prestige: 60, fac: { scouting: 10 } };
  const pool = [];
  for (let i = 0; i < 24; i++) pool.push({
    id: 's' + i, pos: 'WR', st: 'TX', stars: 3, iv: { A: 30, B: 30 },
    committedTo: null, signed: false
  });
  for (let w = 1; w <= 15; w++) advanceRecruiting(pool, [A, B], w, 15, 71, w === 15);
  const toA = pool.filter(r => r.committedTo === 'A').length, toB = pool.filter(r => r.committedTo === 'B').length;
  check('Scouting facility matters: better scouting out-recruits an equal-prestige rival', toB > toA, `fac10 ${toB} vs fac1 ${toA} of 24`);
  // budget scales monotonically with the facility level
  const a = (function () { const t = { id: 'x', fac: { scouting: 2 } }; return Math.round(eval('aiBudget')(t)); })();
  const b = (function () { const t = { id: 'x', fac: { scouting: 9 } }; return Math.round(eval('aiBudget')(t)); })();
  check('AI weekly budget grows with the scouting facility', b > a, `fac2 ${a} vs fac9 ${b} pts`);
})();

/* 10) AI scout action (Phase 33): the AI brain spends some budget SCOUTING its targets, raising the shared
   `rec.scout` read — so heavily-recruited prospects become well-evaluated over a cycle (no player involved),
   while the scouting payoff (recScoutMult) is pure upside (×1 unscouted → ×1.3 fully scouted). */
(function () {
  const seed = 88;
  const teams = genWorld(seed);
  const pool = genRecruits(seed, teams);
  // recruits start fully unscouted
  check('Recruits start unscouted (scout 0)', pool.every(r => r.scout === 0));
  for (let w = 1; w <= 15; w++) advanceRecruiting(pool, teams, w, 15, seed, w === 15);
  const avgScout = g => g.reduce((a, r) => a + r.scout, 0) / g.length;
  const five = pool.filter(r => r.stars === 5), tail = pool.filter(r => r.stars === 2);
  // the AI scouts at all (some recruits get raised off zero), concentrated on the most-recruited blue-chips
  // (the field watches the 5★) far more than the deep 2★ tail (where the player keeps its scouting edge)
  check('AI scout action: the AI evaluates recruits (raises scout off zero)', pool.some(r => r.scout > 0));
  check('AI scout action: scouting concentrates on the most-recruited blue-chips', avgScout(five) > avgScout(tail) * 2 && avgScout(five) >= 20, `5★ avg ${avgScout(five).toFixed(0)} vs 2★ avg ${avgScout(tail).toFixed(0)}`);
  check('AI scout action: scouting is bounded (0–100)', pool.every(r => r.scout >= 0 && r.scout <= 100));
  // the scouting payoff is pure upside + monotonic
  const m0 = recScoutMult({ scout: 0 }), m50 = recScoutMult({ scout: 50 }), m100 = recScoutMult({ scout: 100 });
  check('Scouting payoff: ×1 unscouted, grows to ×1.3, monotonic', Math.abs(m0 - 1) < 1e-9 && m100 > m50 && m50 > m0 && m100 <= 1.3001, `${m0.toFixed(2)}/${m50.toFixed(2)}/${m100.toFixed(2)}`);
  // determinism: same seed → same scouting picture
  const a = pool.map(r => r.scout).join(',');
  const teams2 = genWorld(seed), pool2 = genRecruits(seed, teams2);
  for (let w = 1; w <= 15; w++) advanceRecruiting(pool2, teams2, w, 15, seed, w === 15);
  check('AI scout action: deterministic by seed', a === pool2.map(r => r.scout).join(','));
})();

/* 11) recruit reaction (Phase 34 legibility): the pure read of a board recruit's week returns a sensible
   {text, tone} — urgent/decisive events outrank your action's result; tones are correct; never throws. */
(function () {
  const base = { action: null, angle: null, angleLabel: '', prefMatch: null, myDelta: 0, rivalAbbr: 'RIV', rivalDelta: 0, rivalLeads: false, rankNow: 2, rankPrev: 2, nSuitors: 4, committedMine: false, flippedToMe: false, flippedAway: false };
  const R = o => recruitReaction(Object.assign({}, base, o));
  check('Reaction: a commit to you reads as good', R({ committedMine: true }).tone === 'good');
  check('Reaction: a decommit (flip away) reads as bad', R({ flippedAway: true }).tone === 'bad');
  check('Reaction: a flip TO you reads as good', R({ flippedToMe: true }).tone === 'good');
  check('Reaction: a rival surging ahead reads as cooling (warn)', R({ rivalDelta: 16, rivalLeads: true, myDelta: 2 }).tone === 'warn');
  const pitchHit = R({ action: 'pitch', angle: 'nil', angleLabel: 'NIL Money', prefMatch: 0, myDelta: 12 });
  check('Reaction: a pref-matched pitch that landed reads as good', pitchHit.tone === 'good' && /NIL Money/.test(pitchHit.text), pitchHit.text);
  check('Reaction: an off-priority pitch reads as neutral', R({ action: 'pitch', angle: 'nil', angleLabel: 'NIL Money', prefMatch: 2, myDelta: 4 }).tone === 'neutral');
  check('Reaction: a quiet, untouched week reads as neutral', R({}).tone === 'neutral');
  // the decisive events outrank an action you also took the same week (e.g. you pitched but he flipped away)
  check('Reaction: a decommit outranks your action that week', R({ action: 'pitch', prefMatch: 0, myDelta: 8, flippedAway: true }).tone === 'bad');
  // every reaction returns a non-empty string + a known tone, never throws
  const tones = ['good', 'bad', 'warn', 'neutral'];
  const all = [R({ committedMine: true }), R({ flippedAway: true }), R({ action: 'visit', myDelta: 20 }), R({ action: 'scout' }), R({ rankNow: 1, rankPrev: 3 }), R({ myDelta: 9 }), R({})];
  check('Reaction: always returns text + a known tone', all.every(x => x.text && tones.includes(x.tone)));
})();

/* 12) Phase 35 — commitment windows + ripple/falloff helpers. */
(function () {
  // windows: over a cycle, blue-chips ANNOUNCE a decision (decideWeek) before committing, and those windows
  // resolve into commitments by Signing Day; the tail (≤3★) never uses a window.
  const seed = 31, teams = genWorld(seed), pool = genRecruits(seed, teams);
  let everAnnounced = 0, tailAnnounced = 0;
  for (let w = 1; w <= 15; w++) {
    advanceRecruiting(pool, teams, w, 15, seed, w === 15);
    pool.forEach(r => { if (r.decideWeek != null) { everAnnounced++; if (r.stars < 4) tailAnnounced++; } });
  }
  check('Commitment windows: blue-chips announce a decision before committing', everAnnounced > 0, everAnnounced + ' announce-weeks observed');
  check('Commitment windows: the 2★/3★ tail never uses a window', tailAnnounced === 0);
  check('Commitment windows: all windows resolve by Signing Day (none left pending)', pool.every(r => r.decideWeek == null || r.committedTo));
  const signed = pool.filter(r => r.signed).length;
  // A convergence sanity check, not a precision target: the point is that windows don't strand a
  // chunk of the class unsigned. It sat at 88.0% against a >=88% bar, which made it a knife edge —
  // Phase 51 shifted the generated board once (genRecruits no longer spends three pool draws on
  // inline attributes) and it landed at 87.6%, tripping a threshold nothing behavioural had moved.
  // Phase 56 re-pointed this off pool consumption for the reasons in §2 above; this is the second
  // site (it read `signed/pool` where the other read `signed/haveSuitor`, which was always the same
  // number since every generated prospect gets suitors). Same measured band. Real ranked-board FBS
  // sign rate is 67.4%; Phase 57a's supply resize moved the sim 90% -> 80%, and the rest is owed to
  // class TARGETS in 57b — `CLASS_CAP` is still acting as a target rather than a ceiling, so the
  // mid and low tiers all fill to exactly 25 against a real mean class of 20.2.
  check('Commitment windows: board consumption stays in the measured band', signed / pool.length >= 0.55 && signed / pool.length <= 0.92, (100 * signed / pool.length).toFixed(1) + '%');
  // gameRecruitVibe: a ranked win is the biggest boost; a blowout loss is negative; bounded
  const rankedWin = gameRecruitVibe(35, 10, 30, 5), badLoss = gameRecruitVibe(3, 45, 12, 40), closeWin = gameRecruitVibe(24, 21, 40, 50);
  check('Season ripple: a ranked statement win > a close win > a blowout loss', rankedWin > closeWin && closeWin > badLoss, `${rankedWin}/${closeWin}/${badLoss}`);
  check('Season ripple: a blowout loss is negative', badLoss < 0);
  check('Season ripple: bounded to [-6, 9]', [gameRecruitVibe(99, 0, 1, 1), gameRecruitVibe(0, 99, 1, 99), gameRecruitVibe(28, 24, null, null)].every(v => v >= -6 && v <= 9));
  check('Season ripple: no game → no vibe', gameRecruitVibe(null, null) === 0);
  // repeatFalloff: monotonic decreasing, first use full, bounded
  check('Diminishing returns: first use is full, repeats pay less, floored', repeatFalloff(0) === 1 && repeatFalloff(1) < 1 && repeatFalloff(2) < repeatFalloff(1) && repeatFalloff(20) >= 0.4, `${repeatFalloff(0)}/${repeatFalloff(1).toFixed(2)}/${repeatFalloff(2).toFixed(2)}`);
})();

/* 13) Phase 36 — finalists + AI visits + momentum. */
(function () {
  // finalists: a maturing, well-recruited recruit narrows to a shortlist; cut suitors freeze and can't win.
  const teams = []; for (let i = 0; i < 6; i++) teams.push({ id: 'T' + i, prestige: 55 + i * 6 });
  const rec = { id: 'z', pos: 'WR', st: 'TX', stars: 4, iv: { T0: 78, T1: 70, T2: 64, T3: 58, T4: 50, T5: 44 }, committedTo: null, signed: false, scout: 60 };
  const pool = [rec];
  for (let w = 10; w <= 12; w++) advanceRecruiting(pool, teams, w, 15, 5, false, undefined, undefined, null);
  check('Finalists: a maturing recruit narrows to a top-N shortlist', Array.isArray(rec.finalists) && rec.finalists.length >= 3 && rec.finalists.length < 6, JSON.stringify(rec.finalists));
  const cut = Object.keys(rec.iv).filter(t => rec.finalists.indexOf(t) < 0);
  check('Finalists: some suitors get cut', cut.length > 0, cut.join(','));
  check('Finalists: cut suitors freeze (out of the running)', cut.every(t => rec.iv[t] <= 52), JSON.stringify(cut.map(t => t + ':' + Math.round(rec.iv[t]))));
  // over a full cycle every committed recruit either had no shortlist or was won by a finalist
  const cyc = (function () { const tms = genWorld(36), pl = genRecruits(36, tms); for (let w = 1; w <= 15; w++) advanceRecruiting(pl, tms, w, 15, 36, w === 15); return pl; })();
  const withFinal = cyc.filter(r => r.finalists);
  check('Finalists: a meaningful share of contested recruits get a shortlist', withFinal.length > 50, withFinal.length + ' had finalists');
  // AI visit: a well-scouted top target occasionally gets a big concentrated push (beyond any normal week)
  (function () {
    const tms = [{ id: 'A', prestige: 80, fac: { scouting: 8 } }]; let maxJump = 0;
    for (let trial = 0; trial < 60; trial++) {
      const rr = { id: 'v' + trial, pos: 'WR', st: 'TX', stars: 5, iv: { A: 50 }, committedTo: null, signed: false, scout: 85 };
      const b = rr.iv.A; advanceRecruiting([rr], tms, 8, 15, trial, false, undefined, undefined, null); maxJump = Math.max(maxJump, rr.iv.A - b);
    }
    check('AI visit: a well-scouted top target sometimes gets a big concentrated push', maxJump > 22, 'max weekly gain ' + maxJump.toFixed(0));
  })();
  // momentum: a hot program out-budgets a cold one; a rec-less (lab) team is unaffected
  const bHot = aiBudget({ fac: { scouting: 5 }, rec: { w: 11, l: 1 } }), bCold = aiBudget({ fac: { scouting: 5 }, rec: { w: 1, l: 11 } }), bNeutral = aiBudget({ fac: { scouting: 5 } });
  check('Momentum: a hot team recruits with a bigger budget than a cold one', bHot > bCold, `hot ${bHot.toFixed(1)} vs cold ${bCold.toFixed(1)}`);
  check('Momentum: a rec-less team is unaffected (neutral, between hot and cold)', bNeutral > bCold && bNeutral < bHot, bNeutral.toFixed(1));
})();

/* 14) Phase 37 — NIL bid curve (pure). Money buys interest, more for a recruit who values NIL, bounded. */
(function () {
  check('NIL: a bigger bid buys more interest (monotonic in $)', nilGain(1, 1) < nilGain(3, 1) && nilGain(3, 1) < nilGain(6, 1), `${nilGain(1, 1).toFixed(1)}/${nilGain(3, 1).toFixed(1)}/${nilGain(6, 1).toFixed(1)}`);
  check('NIL: the same bid lands harder on a recruit who values NIL', nilGain(2, 1.5) > nilGain(2, 0.45), `${nilGain(2, 1.5).toFixed(1)} vs ${nilGain(2, 0.45).toFixed(1)}`);
  check('NIL: the money curve saturates (a huge bid is capped)', nilGain(20, 1) === nilGain(8, 1));
})();

const passed = results.filter(r => r.pass).length;
const summary = runCycle(2026);
const signedPct = (100 * summary.pool.filter(r => r.signed).length / summary.pool.length).toFixed(0);
console.log(`\n===== ${passed}/${results.length} recruit-lab checks passed =====`);
console.log(`(${summary.pool.length} prospects, ${signedPct}% signed by Signing Day)`);
process.exit(results.every(r => r.pass) ? 0 : 1);

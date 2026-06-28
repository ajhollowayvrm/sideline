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

/* ---------- data arrays the engine reads (subset is fine for distribution) ---------- */
const FN = ['Jaylen', 'Marcus', 'Cole', 'Tyler', 'Devon', 'Isaiah', 'Cam', 'Brock', 'Khalil', 'Trey'];
const LN = ['Carter', 'Williams', 'Hayes', 'Brooks', 'Robinson', 'Bennett', 'Foster', 'Reed', 'Walker', 'Diaz'];
const STATES = ['AL', 'CA', 'FL', 'GA', 'LA', 'OH', 'TX', 'MI', 'PA', 'NC', 'SC', 'TN', 'VA', 'NJ', 'AZ'];
const POS = [["QB", "off", 4, 1.4], ["RB", "off", 5, 1], ["WR", "off", 11, 1.2], ["TE", "off", 5, .8],
["OT", "off", 7, 1], ["OG", "off", 6, .9], ["C", "off", 3, .8],
["DE", "def", 6, 1.1], ["DT", "def", 6, 1], ["LB", "def", 10, 1.1], ["CB", "def", 9, 1.1], ["S", "def", 8, 1],
["K", "st", 2, .4], ["P", "st", 2, .3]];

/* ---------- extract the RECRUIT ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === RECRUIT ENGINE (Phase 4) START ===';
const END = '// === RECRUIT ENGINE (Phase 4) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find RECRUIT ENGINE markers in index.html'); process.exit(2); }
// genRecruits now stamps per-player traits via the TRAIT ENGINE block — pull it in first.
const T0 = html.indexOf('// === TRAIT ENGINE (Phase 10) START ==='), T1 = html.indexOf('// === TRAIT ENGINE (Phase 10) END ===');
if (T0 < 0 || T1 < 0) { console.error('Could not find TRAIT ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(T0, T1));
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
  check('Pool ~300 prospects', pool.length >= 280 && pool.length <= 320, pool.length + ' prospects');
  check('Star mix is top-heavy (5★ < 4★ < 3★)', five < four && four < three, `${five}/${four}/${three}`);
  check('A handful of 5★, most are 3★', five >= 4 && five <= 14 && three > pool.length * 0.6, `${five} 5★, ${three} 3★`);
  // every prospect has at least one suitor, fewer suitors are not absurd
  const sui = pool.map(r => Object.keys(r.iv).length);
  check('Every prospect has 2–6 suitors', Math.min(...sui) >= 2 && Math.max(...sui) <= 6, `${Math.min(...sui)}–${Math.max(...sui)}`);
  check('Prospect ratings are recruit-shaped (ov 60–99, pot ≥ ov)', pool.every(r => r.ov >= 60 && r.ov <= 99 && r.pot >= r.ov));
})();

/* 2) convergence: nearly everyone signs by Signing Day */
(function () {
  const { pool } = runCycle(2026);
  const haveSuitor = pool.filter(r => Object.keys(r.iv).length > 0);
  const signed = pool.filter(r => r.committedTo && r.signed);
  check('Cycle converges: ≥95% of prospects sign by Signing Day', signed.length / haveSuitor.length >= 0.95, `${signed.length}/${haveSuitor.length}`);
  check('All commits go to an actual suitor', pool.every(r => !r.committedTo || r.iv[r.committedTo] != null));
  // no class exceeds the cap
  const counts = {}; pool.forEach(r => { if (r.committedTo) counts[r.committedTo] = (counts[r.committedTo] || 0) + 1; });
  check('No team signs more than the class cap (25)', Math.max(...Object.values(counts)) <= 25, 'max class ' + Math.max(...Object.values(counts)));
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

const passed = results.filter(r => r.pass).length;
const summary = runCycle(2026);
const signedPct = (100 * summary.pool.filter(r => r.signed).length / summary.pool.length).toFixed(0);
console.log(`\n===== ${passed}/${results.length} recruit-lab checks passed =====`);
console.log(`(${summary.pool.length} prospects, ${signedPct}% signed by Signing Day)`);
process.exit(results.every(r => r.pass) ? 0 : 1);

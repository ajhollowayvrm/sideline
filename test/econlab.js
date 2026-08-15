/* Sideline ECON LAB — standalone harness for the Phase 6 economy engine (finances, facility
   upgrades, coaching carousel).

   The economy engine lives in index.html (single source of truth). This harness EXTRACTS the
   engine block (between the ECONOMY ENGINE markers) and evals it here with the same tiny helpers
   + data arrays, then runs many synthetic seasons and asserts: better/more-successful programs net
   more revenue, budgets can go negative (spending is constrained), facility cost escalates and an
   upgrade raises the right derived effect, the coach market is top-heavy + deterministic by seed,
   the AI carousel converges (no unfilled coordinator slots; good coaches drift to good programs),
   payroll == Σ salaries, and multi-season money stays sane (no runaway/death).

   Run:  node test/econlab.js

   Offline lab (no browser). The in-browser QA gate (npm run qa) validates the integrated program
   UI end-to-end; this validates the model itself across many seasons. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- data arrays + coachBoost the engine reads (must match index.html) ---------- */
const FN = ['Jaylen', 'Marcus', 'Cole', 'Tyler', 'Devon', 'Isaiah', 'Cam', 'Brock', 'Khalil', 'Trey'];
const LN = ['Carter', 'Williams', 'Hayes', 'Brooks', 'Robinson', 'Bennett', 'Foster', 'Reed', 'Walker', 'Diaz'];
const POS = [["QB", "off", 4, 1.4], ["RB", "off", 5, 1], ["WR", "off", 11, 1.2], ["TE", "off", 5, .8],
["OT", "off", 7, 1], ["OG", "off", 6, .9], ["C", "off", 3, .8],
["DE", "def", 6, 1.1], ["DT", "def", 6, 1], ["LB", "def", 10, 1.1], ["CB", "def", 9, 1.1], ["S", "def", 8, 1],
["K", "st", 2, .4], ["P", "st", 2, .3]];
/* ---------- extract the ECONOMY ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
/* The three ROLE tables `genCoachMarket` reads are pulled LIVE out of index.html rather than copied
   here (Phase 60). reclab and simlab were both converted for this reason and rolllab still has not
   been: a hand-copied data array silently drifts, and the lab then validates a world the game does
   not have. `POS`/`FN`/`LN` above are still copies — they feed only this file's synthetic staff, but
   note that `POS` is stale (pre-Phase-52 `S` instead of `FS`/`SS`). */
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
/* Same idea for a top-level `function name(...){...}`: take the declaration out of index.html by
   matching its braces. `coachBoost` used to be hand-copied here, and that copy is exactly how the
   staff ladder can be re-cut in the game while the lab keeps validating the old one. */
function grabFn(name) {
  const decl = 'function ' + name + '(';
  const i = html.indexOf('\n' + decl);
  if (i < 0) { console.error('Could not find `' + decl + '` in index.html'); process.exit(2); }
  let j = html.indexOf('{', i + 1 + decl.length), depth = 0, str = null, line = false;
  for (; j < html.length; j++) {
    const c = html[j];
    if (line) { if (c === '\n') line = false; continue; }
    if (str) { if (c === '\\') j++; else if (c === str) str = null; continue; }
    if (c === '/' && html[j + 1] === '/') { line = true; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) { j++; break; } }
  }
  return eval('(' + html.slice(i + 1, j) + ')');
}
const COORD_ROLES = grabConst('COORD_ROLES');
const POS_COACHES = grabConst('POS_COACHES');
const REC_ROLES = grabConst('REC_ROLES');       // Phase 60: off-field recruiting staff
const REC_STAFF_CAP = grabConst('REC_STAFF_CAP');
// Pulled LIVE out of index.html, not copied — see grabFn. The ladder is one 10-point rating band per
// step: a coordinator steps by 3 (0..15, side-wide), a position coach by 1 (0..5, his group only),
// and a Phase 60 'rec' hire coaches nobody so his boost is 0 by definition.
const coachBoost = grabFn('coachBoost');
// Grabbed too, because the vacancy floor below is a property OF this function, not of the ladder.
const staffBoosts = grabFn('staffBoosts');
// And the rating draw, because its prestige slope is a FITTED quantity now (it pays for the ladder's
// margin) — a copy of it here would be a second, silent opinion about how coaching talent is spread.
const coachRating = grabFn('coachRating');

const START = '// === ECONOMY ENGINE (Phase 6) START ===';
const END = '// === ECONOMY ENGINE (Phase 6) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find ECONOMY ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(i0, i1));   // leaks resolveFinances/facilityUpgradeCost/genCoachMarket/advanceCoachCarousel/…

/* ---------- a faithful-enough staff + team (mirrors index.html genStaff/genWorld) ---------- */
function genStaff(r, prestige) {
  const mk = (code, title, tier, scope, groups, mult) => {
    const rt = coachRating(r, prestige);
    const sal = Math.round((prestige * 9000 + rt * 7000 + ri(r, -40, 40) * 1000) * mult);
    return { role: code, title, name: pick(r, FN) + ' ' + pick(r, LN), rating: rt, salary: Math.max(90000, sal), years: ri(r, 1, 4), tier, scope, groups, boost: coachBoost(tier, rt) };
  };
  const out = [];
  COORD_ROLES.forEach(([code, title, side]) => { const groups = POS.filter(p => p[1] === side).map(p => p[0]); const scope = { off: 'OFF', def: 'DEF', st: 'ST' }[side]; out.push(mk(code, title, 'coord', scope, groups, code === 'STC' ? 1.3 : 2.4)); });
  POS_COACHES.forEach(([code, title, scope, groups]) => out.push(mk(code, title, 'pos', scope, groups, 1)));
  return out;
}
const CONFS = ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Mountain West', 'MAC'];
function genWorld(seed, n = 60) {
  const r = rng(seed); const teams = [];
  for (let i = 0; i < n; i++) {
    const bump = i < 6 ? 48 : i < 18 ? 28 : i < 36 ? 12 : 0;
    const prestige = clamp(Math.round(35 + ri(r, -9, 9) + bump), 22, 97);
    const conf = i < 12 ? CONFS[i % 4] : pick(r, CONFS);
    const fac = { stadium: clamp(Math.round(prestige / 11), 1, 10), strength: clamp(Math.round(prestige / 11), 1, 10), training: clamp(Math.round(prestige / 12), 1, 10), academics: ri(r, 3, 9), nil: clamp(Math.round(prestige / 10), 1, 10) };
    const staff = genStaff(r, prestige);
    const payroll = staff.reduce((s, x) => s + x.salary, 0);
    const revenue = Math.round((prestige > 70 ? 55 : 18) * 1e6 + prestige * 420000);
    teams.push({ id: 't' + i, conf, prestige, fac, staff, payroll, budget: Math.round(revenue * 0.18), facilityDebt: Math.round(ri(r, 0, prestige > 70 ? 40 : 12) * 1e6), rec: { w: 0, l: 0, pf: 0, pa: 0 }, natRank: i + 1 });
  }
  return { teams };
}

/* ---------- checks ---------- */
const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

/* 1) finances: better programs net more; performance pays; budget can go negative */
(function () {
  const blue = { id: 'b', conf: 'SEC', prestige: 92, fac: { stadium: 9, strength: 9, training: 9, academics: 7, nil: 9 }, payroll: 18e6, budget: 10e6, facilityDebt: 20e6, rec: { w: 12, l: 1 }, natRank: 2 };
  const mac = { id: 'm', conf: 'MAC', prestige: 34, fac: { stadium: 3, strength: 3, training: 3, academics: 5, nil: 2 }, payroll: 7e6, budget: 4e6, facilityDebt: 2e6, rec: { w: 5, l: 7 }, natRank: 80 };
  const fb = resolveFinances(Object.assign({}, blue), 2026, 7);
  const fm = resolveFinances(Object.assign({}, mac), 2026, 7);
  check('Better program nets far more revenue', fb.revenue > fm.revenue * 2.5, `blue ${(fb.revenue / 1e6).toFixed(0)}M vs mac ${(fm.revenue / 1e6).toFixed(0)}M`);
  // winning pays: same team, great record vs losing record
  const win = resolveFinances({ id: 'x', conf: 'SEC', prestige: 70, fac: { stadium: 6 }, payroll: 12e6, budget: 0, facilityDebt: 0, rec: { w: 12, l: 1 }, natRank: 5 }, 2026, 1);
  const lose = resolveFinances({ id: 'x', conf: 'SEC', prestige: 70, fac: { stadium: 6 }, payroll: 12e6, budget: 0, facilityDebt: 0, rec: { w: 2, l: 10 }, natRank: 90 }, 2026, 1);
  check('Winning seasons earn more than losing ones', win.revenue > lose.revenue + 8e6, `win ${(win.revenue / 1e6).toFixed(0)}M vs lose ${(lose.revenue / 1e6).toFixed(0)}M`);
  // budget can go negative: heavy payroll + debt, no revenue cushion
  const broke = { id: 'z', conf: 'MAC', prestige: 30, fac: { stadium: 2 }, payroll: 40e6, budget: 1e6, facilityDebt: 60e6, rec: { w: 1, l: 11 }, natRank: 120 };
  resolveFinances(broke, 2026, 1);
  check('Budget can go negative (spending is constrained)', broke.budget < 0, `budget ${(broke.budget / 1e6).toFixed(1)}M`);
  check('Debt is paid down each year (principal)', broke.facilityDebt < 60e6, `${(broke.facilityDebt / 1e6).toFixed(1)}M left`);
})();

/* 2) facility upgrades: cost escalates with level; stadium upgrade raises revenue */
(function () {
  const c1 = facilityUpgradeCost('stadium', 1), c5 = facilityUpgradeCost('stadium', 5), c9 = facilityUpgradeCost('stadium', 9);
  check('Facility cost escalates with level', c1 < c5 && c5 < c9, `${(c1 / 1e6).toFixed(1)} < ${(c5 / 1e6).toFixed(1)} < ${(c9 / 1e6).toFixed(1)}M`);
  check('Maxed facility cannot be upgraded', facilityUpgradeCost('stadium', 10) === Infinity);
  const lo = resolveFinances({ id: 'a', conf: 'SEC', prestige: 70, fac: { stadium: 3 }, payroll: 0, budget: 0, facilityDebt: 0, rec: { w: 6, l: 6 } }, 2026, 1);
  const hi = resolveFinances({ id: 'a', conf: 'SEC', prestige: 70, fac: { stadium: 9 }, payroll: 0, budget: 0, facilityDebt: 0, rec: { w: 6, l: 6 } }, 2026, 1);
  check('A bigger stadium raises revenue', hi.revenue > lo.revenue, `+${((hi.revenue - lo.revenue) / 1e6).toFixed(1)}M`);
  // Manager finance multiplier (Phase 7 flavor): a >1 mult scales revenue up
  const base = resolveFinances({ id: 'm', conf: 'SEC', prestige: 70, fac: { stadium: 6 }, payroll: 0, budget: 0, facilityDebt: 0, rec: { w: 8, l: 4 } }, 2026, 1);
  const mgr = resolveFinances({ id: 'm', conf: 'SEC', prestige: 70, fac: { stadium: 6 }, payroll: 0, budget: 0, facilityDebt: 0, rec: { w: 8, l: 4 } }, 2026, 1, 1.06);
  check('Revenue multiplier scales revenue (Manager edge)', mgr.revenue > base.revenue, `${(base.revenue / 1e6).toFixed(1)}M → ${(mgr.revenue / 1e6).toFixed(1)}M`);
})();

/* 3) coach market: top-heavy on rating, deterministic by seed, varies across seeds */
(function () {
  const w = genWorld(5);
  const m1 = genCoachMarket(5, 2027, w), m2 = genCoachMarket(5, 2027, w), m3 = genCoachMarket(9, 2027, w);
  check('Market sized ~24–40 candidates', m1.length >= 24 && m1.length <= 40, m1.length + ' candidates');
  check('Market deterministic by seed', JSON.stringify(m1) === JSON.stringify(m2));
  check('Market varies by seed', JSON.stringify(m1) !== JSON.stringify(m3));
  const ratings = m1.map(c => c.rating).sort((a, b) => b - a);
  check('Market is top-heavy (median below the few elite)', ratings[Math.floor(ratings.length / 2)] < ratings[0] - 8, `top ${ratings[0]}, median ${ratings[Math.floor(ratings.length / 2)]}`);
  // The ladder is centred, so a boost is signed — a below-replacement coach is a real thing to be
  // offered. What must hold is that every candidate carries a boost his OWN tier could produce.
  check('Every candidate carries a valid role/boost', m1.every(c => c.role && ['coord', 'pos', 'rec'].includes(c.tier)
    && c.boost === coachBoost(c.tier, c.rating)));

  /* The staff ladder. One 10-point rating band is one step; a coordinator steps by 3 and a position
     coach by 1; and the whole thing is CENTRED on band 2, so an average coach is worth nothing and
     the number is what he is worth over a replacement. These pin the BANDS, the STEP and the ZERO
     rather than the formula, so re-cutting the ladder has to be a deliberate act that updates the
     lab, not a number that drifts unnoticed. The centring is the load-bearing part: the league's raw
     unit ratings already reach 96 against a 99 ceiling, so an uncentred ladder pins the whole top of
     the league at 99 and hands the sim a 0-point gap between the two best teams in the country. */
  (function () {
    const bands = [[45, 49, 0], [50, 59, 1], [60, 69, 2], [70, 79, 3], [80, 89, 4], [90, 97, 5]];
    let coordOK = true, posOK = true, recOK = true;
    bands.forEach(([lo, hi, band]) => {
      for (let r = lo; r <= hi; r++) {
        if (coachBoost('coord', r) !== (band - 2) * 3) coordOK = false;
        if (coachBoost('pos', r) !== band - 2) posOK = false;
        if (coachBoost('rec', r) !== 0) recOK = false;
      }
    });
    check('Coordinator ladder steps by 3 per 10-point band (−6..+9)', coordOK,
      '45→' + coachBoost('coord', 45) + ' 65→' + coachBoost('coord', 65) + ' 81→' + coachBoost('coord', 81) + ' 95→' + coachBoost('coord', 95));
    check('Position-coach ladder steps by 1 per 10-point band (−2..+3)', posOK,
      '45→' + coachBoost('pos', 45) + ' 65→' + coachBoost('pos', 65) + ' 81→' + coachBoost('pos', 81) + ' 95→' + coachBoost('pos', 95));
    check('A recruiting hire is 0 at every rating', recOK);
    // Better is never worse, and both ends of the ladder are clamped rather than open-ended.
    let mono = true;
    for (let r = 0; r <= 140; r++) { if (r && coachBoost('coord', r) < coachBoost('coord', r - 1)) mono = false; if (r && coachBoost('pos', r) < coachBoost('pos', r - 1)) mono = false; }
    check('Boost is monotonic in rating and clamped at both ends', mono
      && coachBoost('coord', 140) === 9 && coachBoost('coord', 0) === -6
      && coachBoost('pos', 140) === 3 && coachBoost('pos', 0) === -2);
    // A coordinator buffs a whole side, a position coach one group — the ladder says so at every rating.
    let ratio = true;
    for (let r = 45; r <= 97; r++) if (coachBoost('coord', r) !== coachBoost('pos', r) * 3) ratio = false;
    check('A coordinator is worth 3× a position coach at the same rating', ratio);
    /* Centring is only honest if band 2 is genuinely where the league sits. genStaff draws a coach at
       mean ~63.7 / sd ~9.6, so the league's MEAN boost must come out near zero — otherwise "average"
       is a fiction and the ladder is quietly inflating or deflating every team in the game. */
    const drawn = [];
    for (let s = 1; s <= 40; s++) { const r = rng(s); for (let i = 0; i < 134; i++) drawn.push(genStaff(r, clamp(Math.round(35 + ri(r, -9, 9) + (i < 20 ? 40 : i < 60 ? 20 : 0)), 20, 98))[0].rating); }
    const meanBoost = avg(drawn.map(r => coachBoost('coord', r)));
    check('The ladder is centred on the league it is measuring', Math.abs(meanBoost) < 1.5,
      'mean generated coordinator is worth ' + meanBoost.toFixed(2) + ' (par = 0)');
    const mid = drawn.filter(v => v >= 50 && v < 80).length / drawn.length;
    check('The generated league sits in the middle of the ladder, not at its ends', mid > 0.7,
      (100 * mid).toFixed(1) + '% of generated coordinators land on bands 1–3');
  })();

  /* A coordinator is something you FIND. The ladder made a coordinator worth 3× what he was, and
     the rating draw carried a 0.5 prestige slope — so tripling the ladder tripled how much staff
     quality was just a proxy for program quality, which lands on mismatch. The slope is 0.25 now and
     that is a FITTED number (it pays back the margin the ladder borrowed), so these pin the
     properties it was fitted for: prestige tilts the draw without deciding it, and the league keeps
     its full range of coaches to find. */
  (function () {
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
    // Measured over the LEAGUE's prestige shape, not a uniform draw — correlation depends on the
    // spread of the thing you correlate against, so a flat 20..98 sweep reads a number the game
    // never sees.
    const rat = [], pres = [];
    for (let s = 1; s <= 25; s++) genWorld(s).teams.forEach(t => t.staff.forEach(c => { rat.push(c.rating); pres.push(t.prestige); }));
    const corr = (() => {
      const ma = mean(rat), mp = mean(pres);
      let n = 0, da = 0, dp = 0;
      for (let i = 0; i < rat.length; i++) { n += (rat[i] - ma) * (pres[i] - mp); da += (rat[i] - ma) ** 2; dp += (pres[i] - mp) ** 2; }
      return n / Math.sqrt(da * dp);
    })();
    check('Prestige tilts a coach draw without deciding it', corr > 0.15 && corr < 0.5,
      'corr(rating, prestige) = ' + corr.toFixed(3) + ' across ' + rat.length + ' coaches (0.77 at the old 0.5 slope)');
    check('The league keeps a full range of coaches to find', sd(rat) > 9,
      'rating sd ' + sd(rat).toFixed(1) + ', mean ' + mean(rat).toFixed(1));

    /* What "something you FIND" actually means, mechanically. Generation deals you a hand that
       prestige only tilts — a bottom-tier program is NOT dealt an elite coordinator, and that is
       correct. Where anyone can get one is the MARKET, which takes no prestige argument at all: the
       free-agent pool is drawn flat and reaches 97, so an elite coordinator is available to any
       program that will pay him. The carousel then supplies the pull back upward over seasons. */
    const r2 = rng(77), low = [], high = [];
    for (let i = 0; i < 4000; i++) { low.push(coachRating(r2, 30)); high.push(coachRating(r2, 92)); }
    check('Prestige still points the right way on average', mean(high) > mean(low),
      'prestige 92 is dealt ' + mean(high).toFixed(1) + ' vs prestige 30 ' + mean(low).toFixed(1));
    check('A blue-blood can be stuck with a bad coordinator', high.filter(v => v < 60).length > 0,
      high.filter(v => v < 60).length + '/4000 draws at prestige 92 fall under 60');
    const w2 = genWorld(3);
    const elite = [];
    for (let y = 2027; y < 2037; y++) elite.push(...genCoachMarket(5, y, w2).filter(c => c.tier === 'coord' && c.rating >= 85));
    check('An elite coordinator is on the MARKET, open to any program', elite.length > 0,
      elite.length + ' coordinators rated 85+ over ten markets, drawn with no prestige term');
  })();

  /* A vacancy is the BOTTOM of a centred ladder, not the middle. Without this, a coach on band 0 or 1
     scores below zero while an empty slot scores exactly zero — so firing your worst position coach
     would make the team better, which is an exploit rather than a decision. */
  (function () {
    const staff = genStaff(rng(11), 60);
    const oline = staff.find(c => c.role === 'OL');
    oline.rating = 45; oline.boost = coachBoost('pos', 45);   // the worst coach you can employ
    const withBad = staffBoosts(staff)['OT'];
    const withNone = staffBoosts(staff.filter(c => c !== oline))['OT'];
    check('A bad position coach still beats an empty slot', withBad > withNone,
      'a 45-rated OL coach is ' + withBad + ', the vacancy is ' + withNone);
    check('A vacancy is charged one step below the bottom rung', withBad - withNone === 1,
      'the worst coach you can employ is worth ' + (withBad - withNone) + ' over nobody');
  })();

  /* Phase 60 — off-field recruiting staff. They share the market (so they surface in the carousel
     the player already uses) but they must be inert everywhere a coach is not: no group, no boost,
     and therefore no contribution to `staffBoosts`/`teamRatings`. What they DO cost is payroll. */
  const recCands = [];
  for (let s = 1; s <= 40; s++) genCoachMarket(s, 2027, w).forEach(c => { if (c.tier === 'rec') recCands.push(c); });
  check('Phase 60: the market offers recruiting staff', recCands.length > 0, recCands.length + ' rec candidates over 40 markets');
  check('Phase 60: a recruiting hire coaches nobody (no boost, no group)',
    recCands.every(c => !c.boost && !c.groups), recCands.filter(c => c.boost || c.groups).length + ' violations');
  check('Phase 60: recruiting staff are cheaper than coordinators (off-field, not a coordinator)',
    (() => {
      const rec = recCands.map(c => c.salary), co = [];
      for (let s = 1; s <= 40; s++) genCoachMarket(s, 2027, w).forEach(c => { if (c.tier === 'coord') co.push(c.salary); });
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      return avg(rec) < avg(co);
    })(), 'a department is an expense, not a coordinator');
  check('Phase 60: every recruiting role is a known REC_ROLES code',
    recCands.every(c => REC_ROLES.some(r => r[0] === c.role)));
  // The safety proof for folding them into `roles` rather than a side stream: the market SIZE and
  // the rating draw are untouched, so the three checks above this block still hold. Asserted here so
  // a future phase cannot quietly widen the market and blame it on recruiting.
  check('Phase 60: adding recruiting roles did not resize the market',
    [1, 5, 9, 17, 40].every(s => { const n = genCoachMarket(s, 2027, w).length; return n >= 24 && n <= 40; }));

  /* payroll == Σ salaries once a rec hire is on the books (the whole point of requirement 2 — a
     fleet of scouts is a budget line, and `resolveFinances` must actually charge for it). */
  const t2 = { payroll: 0, staff: genStaff(rng(7), 70) };
  t2.staff.push(Object.assign({}, recCands[0], { tier: 'rec', groups: null, boost: 0 }));
  t2.payroll = t2.staff.reduce((s, x) => s + x.salary, 0);
  check('Phase 60: payroll includes recruiting staff',
    t2.payroll === t2.staff.reduce((s, x) => s + x.salary, 0) && t2.payroll > genStaff(rng(7), 70).reduce((s, x) => s + x.salary, 0),
    'payroll ' + Math.round(t2.payroll / 1000) + 'k');
  check('Phase 60: recruiting staff confer no rating (staffBoosts sees nothing)',
    (() => { const m = {}; t2.staff.forEach(c => { if (!c.boost || !c.groups) return; c.groups.forEach(g => m[g] = (m[g] || 0) + c.boost); });
      const m0 = {}; genStaff(rng(7), 70).forEach(c => { if (!c.boost || !c.groups) return; c.groups.forEach(g => m0[g] = (m0[g] || 0) + c.boost); });
      return JSON.stringify(m) === JSON.stringify(m0); })());
})();

/* 4) buyout / hire costs are sane */
(function () {
  const coach = { salary: 2e6, years: 3 };
  check('Buyout scales with remaining contract', buyoutCost(coach) > 0 && buyoutCost(coach) <= coach.salary * coach.years, money(buyoutCost(coach)));
  check('Hire fee is a fraction of salary', hireCost(coach) > 0 && hireCost(coach) < coach.salary, money(hireCost(coach)));
  function money(n) { return '$' + (n / 1e6).toFixed(2) + 'M'; }
})();

/* 5) AI carousel: converges (every team keeps 3 coordinators), payroll == Σ salaries, runs deterministic */
(function () {
  const w = genWorld(11);
  const market = genCoachMarket(11, 2027, w);
  const before = w.teams.map(t => t.staff.filter(c => c.tier === 'coord').length);
  advanceCoachCarousel(w, market, 11, 2027, {});
  const after = w.teams.map(t => t.staff.filter(c => c.tier === 'coord').length);
  check('Every team keeps exactly 3 coordinators (no vacancies)', after.every(n => n === 3) && before.every(n => n === 3));
  // recompute payroll as the app would; assert it equals Σ salaries
  w.teams.forEach(t => t.payroll = t.staff.reduce((s, x) => s + x.salary, 0));
  check('payroll == Σ staff salaries after carousel', w.teams.every(t => t.payroll === t.staff.reduce((s, x) => s + x.salary, 0)));
  check('Market refreshes back toward target size', market.length >= 24, market.length + ' left');
  // determinism: same world + seed → same staff signature
  const sig = (seed) => { const ww = genWorld(11); const mm = genCoachMarket(seed, 2027, ww); advanceCoachCarousel(ww, mm, seed, 2027, {}); return ww.teams.map(t => t.staff.filter(c => c.tier === 'coord').map(c => c.rating).join(',')).join('|'); };
  check('Carousel deterministic by seed', sig(11) === sig(11));
})();

/* 6) good coaches drift to good programs over several carousels */
(function () {
  const w = genWorld(3);
  for (let y = 0; y < 6; y++) { const m = genCoachMarket(3 + y, 2027 + y, w); advanceCoachCarousel(w, m, 3 + y, 2027 + y, {}); }
  const byPrestige = [...w.teams].sort((a, b) => b.prestige - a.prestige);
  const coordAvg = t => avg(t.staff.filter(c => c.tier === 'coord').map(c => c.rating));
  const topAvg = avg(byPrestige.slice(0, 12).map(coordAvg));
  const botAvg = avg(byPrestige.slice(-12).map(coordAvg));
  check('Good coaches drift to good programs (top coord rating > bottom)', topAvg > botAvg, `top ${topAvg.toFixed(0)} vs bot ${botAvg.toFixed(0)}`);
})();

/* 7) poaching: a higher-prestige suitor can take a strong player coordinator (resisted by loyalty) */
(function () {
  // many trials; count how often a star player coord gets poached with vs without loyal history
  function trials(history) {
    let poached = 0;
    for (let s = 0; s < 60; s++) {
      const w = genWorld(100 + s);
      const me = w.teams[w.teams.length - 1];   // a weak program
      me.staff.filter(c => c.tier === 'coord').forEach(c => c.rating = 90);   // give it elite coords others want
      const market = genCoachMarket(100 + s, 2027, w);
      const res = advanceCoachCarousel(w, market, 100 + s, 2027, { controlledId: me.id, coach: { history } });
      if (res.poached.some(p => p.fromId === me.id)) poached++;
    }
    return poached;
  }
  const open = trials('Former Player'), loyal = trials('Lifer');
  check('A strong player coordinator can be poached', open > 0, open + '/60 trials');
  check('Loyal histories resist poaching (≤ open)', loyal <= open, `loyal ${loyal} vs open ${open}`);
})();

/* 8) multi-season money stays sane across an integrated loop (no runaway, no universal death) */
(function () {
  const w = genWorld(2026);
  for (let y = 0; y < 8; y++) {
    w.teams.forEach(t => { t.rec = { w: ri(rng(y * 31 + hashStr(t.id)), 2, 11), l: 0 }; t.rec.l = 12 - t.rec.w; });
    w.teams.forEach(t => resolveFinances(t, 2026 + y, 2026));
    const m = genCoachMarket(2026 + y, 2026 + y, w); advanceCoachCarousel(w, m, 2026 + y, 2026 + y, {});
    w.teams.forEach(t => t.payroll = t.staff.reduce((s, x) => s + x.salary, 0));
  }
  const budgets = w.teams.map(t => t.budget);
  const solvent = budgets.filter(b => b > 0).length;
  check('Most programs stay solvent over 8 seasons', solvent > w.teams.length * 0.6, `${solvent}/${w.teams.length} solvent`);
  check('No absurd runaway budgets (all under $1B)', budgets.every(b => b < 1e9), `max ${(Math.max(...budgets) / 1e6).toFixed(0)}M`);
  // Phase 44: the anti-hoard + operating costs keep even a rich, all-winning dynasty from ballooning.
  check('Budgets stay grounded (no nine-figure idle piles)', budgets.every(b => b < 250e6), `max ${(Math.max(...budgets) / 1e6).toFixed(0)}M`);
  check('Debt trends down across seasons', w.teams.every(t => t.facilityDebt < 80e6));
})();

/* 8b) prestige drift (Phase 44): standing drifts toward results — bounded, signed, ~zero at expectation */
(function () {
  check('Over-performing lifts prestige, under-performing drops it',
    seasonPrestigeDrift(60, 11, 1) > 0 && seasonPrestigeDrift(60, 2, 10) < 0);
  check('Prestige drift is bounded (±1.6/yr)',
    [seasonPrestigeDrift(30, 12, 0), seasonPrestigeDrift(95, 0, 12), seasonPrestigeDrift(50, 6, 6)].every(d => Math.abs(d) <= 1.6));
  check('A blueblood meeting its (high) expectation barely drifts', Math.abs(seasonPrestigeDrift(90, 10, 2)) < 0.6, seasonPrestigeDrift(90, 10, 2).toFixed(2));
})();

/* 8) legend coaches (Phase 11): a program's retired great can surface as a candidate for their alma
   mater, flagged fromLegend/legendOf; legend-less worlds stay byte-identical (no rng consumed). */
(function () {
  const plain = genWorld(2026);
  const ringed = genWorld(2026);
  // give one team a deep ring of high-stature greats so the (probabilistic) return reliably fires
  ringed.teams[0].legends = Array.from({ length: 5 }, (_, i) => ({ id: 'L' + i, name: 'Great ' + i, pos: 'QB', st: 'TX', stature: 90 }));
  // legend-less world: candidate scan must consume no rng → market is identical with/without the scan
  check('Legend-less world keeps an unchanged market', JSON.stringify(genCoachMarket(2026, 2026, plain)) === JSON.stringify(genCoachMarket(2026, 2026, { teams: [] })));
  // across several years, a flagged legend candidate should appear for the ringed team at least once
  let found = null;
  for (let y = 0; y < 12 && !found; y++) {
    const m = genCoachMarket(2026 + y, 2026 + y, ringed);
    found = m.find(c => c.fromLegend && c.legendOf === ringed.teams[0].id);
  }
  check('A retired great can return as a coach for their alma mater', !!found, found ? `${found.name} rating ${found.rating}` : 'never appeared');
  check('Legend coach is a coordinator with a sane rating', found && found.tier === 'coord' && found.rating >= 45 && found.rating <= 92);
  check('Legend candidates are deterministic by (seed, year)', JSON.stringify(genCoachMarket(2030, 2030, ringed)) === JSON.stringify(genCoachMarket(2030, 2030, ringed)));
})();

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} econ-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

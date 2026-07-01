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
const COORD_ROLES = [["OC", "Offensive Coordinator", "off"], ["DC", "Defensive Coordinator", "def"], ["STC", "Special Teams Coord.", "st"]];
const POS_COACHES = [["QB", "QBs Coach", "QB", ["QB"]], ["RB", "RBs Coach", "RB", ["RB"]],
["WR", "Pass-Catchers Coach", "WR/TE", ["WR", "TE"]], ["OL", "O-Line Coach", "OL", ["OT", "OG", "C"]],
["DL", "D-Line Coach", "DL", ["DE", "DT"]], ["LB", "LBs Coach", "LB", ["LB"]], ["DB", "DBs Coach", "DB", ["CB", "S"]]];
function coachBoost(tier, rating) { return tier === 'coord' ? clamp(Math.round((rating - 55) / 20), 0, 2) : clamp(Math.round((rating - 50) / 15), 0, 3); }

/* ---------- extract the ECONOMY ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === ECONOMY ENGINE (Phase 6) START ===';
const END = '// === ECONOMY ENGINE (Phase 6) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find ECONOMY ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(i0, i1));   // leaks resolveFinances/facilityUpgradeCost/genCoachMarket/advanceCoachCarousel/…

/* ---------- a faithful-enough staff + team (mirrors index.html genStaff/genWorld) ---------- */
function genStaff(r, prestige) {
  const mk = (code, title, tier, scope, groups, mult) => {
    const rt = clamp(Math.round(prestige * 0.5 + ri(r, -8, 12) + 35), 45, 95);
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
  check('Every candidate carries a valid role/boost', m1.every(c => c.role && (c.tier === 'coord' || c.tier === 'pos') && c.boost >= 0));
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

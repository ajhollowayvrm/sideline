/* Step 26 — does concentrated recruiting compound across seasons?

   Phase 57b's cross-gate risk, and no existing gate can see it. Concentrating talent widens the
   roster-quality spread, which widens the point spread — and docs/phases/calibration.md §7 already
   reports the sim's standardized average margin at 19.2 against a real 16.2. `4-simprofile.js`
   cannot see this because it builds its own prestige-scaled synthetic world rather than one that
   came out of recruiting, and `rolllab` asserts rollover STABILITY, not spread.

   So: run N seasons of genRecruits -> advanceRecruiting -> rolloverRoster over a real-geography
   league, and watch the league's team-OVR spread season by season.

   The question is COMPOUNDING, not level. A stable spread is fine at any width — the sim's margin is
   calibrated against whatever spread it has. A spread that climbs every season is the failure mode:
   it means the best programs are converting a recruiting edge into a talent edge into a bigger
   recruiting edge, with nothing pushing back, and the league runs away.

   Run:  node tools/cfb-data/26-dynasty.js
         SEASONS=12 node tools/cfb-data/26-dynasty.js
         INDEX=/tmp/old.html node tools/cfb-data/26-dynasty.js    # the BEFORE column

   What it cannot say: this measures TALENT spread, not margin. Team OVR and the /talent composite
   are different scales and are not compared directly here — the real-world column is the composite's
   own top-decile / bottom-decile RATIO, which is scale-free, and even that is only indicative. */

const fs = require('fs');
const path = require('path');

const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const html = fs.readFileSync(process.env.INDEX || path.join(__dirname, '..', '..', 'index.html'), 'utf8');
function grabConst(name) {
  const decl = 'const ' + name + '=';
  const i = html.indexOf('\n' + decl);
  if (i < 0) throw new Error('missing ' + decl);
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
const POS = grabConst('POS'), STATES = grabConst('STATES'), FN = grabConst('FN'), LN = grabConst('LN');
const PREFS = grabConst('PREFS'), TEAMS = grabConst('TEAMS'), TEAM_STATE = grabConst('TEAM_STATE');
const CONF_BASE = grabConst('CONF_BASE'), BUMP = grabConst('BUMP'), CLASSES = grabConst('CLASSES');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) throw new Error('missing ' + a); return html.slice(i, j); };
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
eval(grab('// === ATTRIBUTE ENGINE (Phase 52) START ===', '// === ATTRIBUTE ENGINE (Phase 52) END ==='));
eval(grab('// === RECRUIT ENGINE (Phase 4) START ===', '// === RECRUIT ENGINE (Phase 4) END ==='));
eval(grab('// === ROLLOVER ENGINE (Phase 5) START ===', '// === ROLLOVER ENGINE (Phase 5) END ==='));

const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
/* a starting roster, mirroring genRoster's shape closely enough for a talent-spread reading */
function genRoster0(r, prestige) {
  const out = [];
  POS.forEach(([code, , n]) => {
    for (let i = 0; i < n; i++) {
      const ov = clamp(Math.round(prestige * 0.55 + ri(r, -9, 9) + 30), 48, 99);
      const p = Object.assign({
        id: 'p' + Math.floor(r() * 1e9).toString(36), fn: pick(r, FN), ln: pick(r, LN),
        pos: code, ov, pot: clamp(ov + ri(r, 2, 12), ov, 99), so: 0,
        yr: pick(r, ['FR', 'SO', 'JR', 'SR']), age: ri(r, 18, 22), st: pick(r, STATES), stars: 3,
      }, genProfile(r, ov, code));
      out.push(p);
    }
  });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => {
    arr.sort((a, b) => b.ov - a.ov);
    arr.forEach((p, i) => { if (i >= 2) { shiftAttrs(p, -Math.min(2 + (i - 2) * 2.6, 26)); p.ov = clamp(ovrBase(p), 44, 99); } p.so = i; });
  });
  return out;
}
function buildWorld(seed) {
  const r = rng(seed);
  return TEAMS.map(([name, nick, abbr, conf]) => {
    const prestige = clamp(Math.round((CONF_BASE[conf] || 45) + (BUMP[name] || 0) + ri(r, -7, 7)), 20, 98);
    return {
      id: abbr.toLowerCase().replace(/[^a-z0-9]/g, ''), abbr, prestige, needs: {},
      homeState: TEAM_STATE[abbr] || pick(r, STATES),
      fac: { nil: clamp(Math.round(prestige / 10) + ri(r, -2, 1), 1, 10), academics: clamp(ri(r, 3, 9), 1, 10), scouting: clamp(Math.round(prestige / 11) + ri(r, -1, 1), 1, 10), strength: clamp(Math.round(prestige / 11), 1, 10), training: clamp(Math.round(prestige / 12), 1, 10) },
      roster: genRoster0(r, prestige),
    };
  });
}
/* team talent = mean OVR of the top 22 (the two-deep that actually plays), like teamRatings */
const teamTalent = t => {
  const s = [...t.roster].sort((a, b) => b.ov - a.ov).slice(0, 22);
  return s.reduce((x, p) => x + p.ov, 0) / s.length;
};
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => sum(a) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) * (x - m)))); };

const SEASONS = +(process.env.SEASONS || 10);
const SEED = 20260814;
const world = buildWorld(SEED);
const out = [];
const say = s => { out.push(s); console.log(s); };

say('Dynasty check — does concentrated recruiting compound?');
say('='.repeat(70));
say(`${SEASONS} seasons over a real-geography 134-team league, seed ${SEED}`);
say('');
say('season   talent sd   top10 mean   bot10 mean   gap   top10 BC/class');
const rows = [];
for (let s = 0; s <= SEASONS; s++) {
  if (s > 0) {
    const seed = SEED ^ (0x51ed + s * 104729);
    const pool = genRecruits(seed, world);
    for (let k = 1; k <= 15; k++) advanceRecruiting(pool, world, k, 15, seed, k === 15);
    const signees = {};
    pool.forEach(r => { if (r.committedTo) (signees[r.committedTo] = signees[r.committedTo] || []).push(r); });
    world.forEach(t => {
      const rr = rng((hashStr('roll' + t.id + s)) >>> 0);
      t.roster = rolloverRoster(t.roster, signees[t.id] || [], t.prestige, rr, { rate: 1 }).roster;
      t._bc = (signees[t.id] || []).filter(x => x.stars >= 4).length;
    });
  }
  const byT = [...world].sort((a, b) => teamTalent(b) - teamTalent(a));
  const vals = world.map(teamTalent);
  const top = mean(byT.slice(0, 10).map(teamTalent)), bot = mean(byT.slice(-10).map(teamTalent));
  const bc = s > 0 ? mean([...world].sort((a, b) => b.prestige - a.prestige).slice(0, 10).map(t => t._bc || 0)) : 0;
  rows.push({ s, sd: sd(vals), top, bot, gap: top - bot, bc });
  say(`${String(s).padStart(6)}   ${sd(vals).toFixed(2).padStart(9)}   ${top.toFixed(1).padStart(10)}   ${bot.toFixed(1).padStart(10)}   ${(top - bot).toFixed(1).padStart(5)}   ${s > 0 ? bc.toFixed(1).padStart(14) : '—'.padStart(14)}`);
}
say('');
const early = rows.slice(1, 4), late = rows.slice(-3);
const drift = mean(late.map(r => r.gap)) - mean(early.map(r => r.gap));
say(`top10-bot10 talent gap:  seasons 1-3 mean ${mean(early.map(r => r.gap)).toFixed(1)}   ` +
  `last 3 mean ${mean(late.map(r => r.gap)).toFixed(1)}   drift ${(drift > 0 ? '+' : '') + drift.toFixed(1)}`);
say(`league talent sd:        seasons 1-3 mean ${mean(early.map(r => r.sd)).toFixed(2)}   ` +
  `last 3 mean ${mean(late.map(r => r.sd)).toFixed(2)}`);
say('');
say(drift > 3 ? 'RUNAWAY: the gap is still widening late — recruiting is compounding without pushback.'
  : drift < -3 ? 'COLLAPSING: the gap is closing late — talent is regressing to the mean too hard.'
    : 'STABLE: the gap settles rather than compounding. This is the pass condition.');

/* the real-world reference, from the harvest, as a scale-free ratio */
try {
  const cache = require(path.join(__dirname, 'rec-cache.json'));
  const ratios = [];
  for (const y of Object.keys(cache)) {
    const fbs = new Set((cache[y].fbs || []).map(t => t.school));
    const tv = (cache[y].talent || []).filter(t => fbs.has(t.team)).map(t => t.talent).sort((a, b) => b - a);
    if (tv.length > 40) ratios.push(mean(tv.slice(0, 10)) / mean(tv.slice(-10)));
  }
  if (ratios.length) {
    say('');
    say(`real /talent composite, top-10 mean / bottom-10 mean:  ${mean(ratios).toFixed(2)}x`);
    const simRatio = mean(late.map(r => r.top / r.bot));
    say(`sim team-OVR (top 22), same ratio:                     ${simRatio.toFixed(2)}x`);
    say('  (indicative only — a recruit-rating SUM and a mean OVR are different scales, so read the');
    say('   drift line above as the gate and this as context.)');
  }
} catch (e) { /* no cache, skip */ }

fs.writeFileSync(path.join(__dirname, 'dynasty-report.txt'), out.join('\n') + '\n');
console.log('\nwrote dynasty-report.txt');

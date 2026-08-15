/* Step 27 — is the top band's shortfall a PULL problem or a PRESTIGE-DISTRIBUTION problem?

   Phase 58/59 residual. `23-reccompare.js` says the sim's top-10 band takes 31.6% of blue-chips
   against a real 40.3%, while total concentration (Gini 0.774 vs 0.772) is right to three decimals —
   the sim spreads them across ranks 11-25 instead. The obvious reading is "reality has a convex
   national-brand effect at the very top that team quality does not explain", and inventing a brand
   term is how the Phase 25 penalty model happened. So test the cheaper hypothesis first:

     the sim's PROGRAM-QUALITY distribution may simply be too compressed at the top.

   If real program quality is more top-heavy than `CONF_BASE + BUMP` produces, then the pull curve is
   innocent and the fix is a measured one — the prestige spread — rather than a new mechanism.

   Compares the two distributions in a scale-free way (rank -> share of the league's total quality
   above the floor), plus the per-team blue-chip ratio between bands, which is the quantity that
   actually differs.

   Run:  node tools/cfb-data/27-toplean.js                                                        */

const fs = require('fs');
const path = require('path');
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
function grabConst(name) {
  const decl = 'const ' + name + '=';
  const i = html.indexOf('\n' + decl);
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
const TEAMS = grabConst('TEAMS'), CONF_BASE = grabConst('CONF_BASE'), BUMP = grabConst('BUMP'), STATES = grabConst('STATES');

/* the sim's prestige ladder, exactly as genWorld builds it */
const r = rng(20260814);
const simPrestige = TEAMS.map(([name, , , conf]) =>
  clamp(Math.round((CONF_BASE[conf] || 45) + (BUMP[name] || 0) + ri(r, -7, 7)), 20, 98)).sort((a, b) => b - a);

/* the real ladder: the /talent composite, averaged per rank slot over the sample */
const cache = require(path.join(__dirname, 'rec-cache.json'));
const years = Object.keys(cache);
const slots = [];
for (const y of years) {
  const fbs = new Set((cache[y].fbs || []).map(t => t.school));
  const tv = (cache[y].talent || []).filter(t => fbs.has(t.team)).map(t => t.talent).sort((a, b) => b - a);
  tv.forEach((v, i) => { (slots[i] = slots[i] || []).push(v); });
}
const realTalent = slots.map(a => a.reduce((x, y) => x + y, 0) / a.length).slice(0, 134);

const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => sum(a) / a.length;
const BANDS = [[0, 10], [10, 25], [25, 50], [50, 90], [90, 134]];
const LBL = ['1-10', '11-25', '26-50', '51-90', '91-134'];

/* Scale-free comparison. Both ladders sit on arbitrary units with arbitrary floors, so compare each
   band's mean AS A MULTIPLE OF THE LEAGUE'S BOTTOM BAND — that is unit-free and floor-anchored, and
   it is the shape that decides how far ahead the top really is. */
const norm = ladder => {
  const floor = mean(ladder.slice(90, 134));
  return BANDS.map(([lo, hi]) => mean(ladder.slice(lo, hi)) / floor);
};
const simN = norm(simPrestige), realN = norm(realTalent);

const out = [];
const say = s => { out.push(s); console.log(s); };
say('Is the top band under-concentrated because of PULL, or because of the PRESTIGE LADDER?');
say('='.repeat(78));
say(`real = /talent composite, ${years.length} seasons   sim = CONF_BASE + BUMP as genWorld builds it`);
say('');
say('band       real mean   sim mean   |  as a multiple of the bottom band');
say('                                  |   real     sim     ratio');
BANDS.forEach(([lo, hi], k) => {
  say('  ' + LBL[k].padEnd(9) + mean(realTalent.slice(lo, hi)).toFixed(0).padStart(9) +
    mean(simPrestige.slice(lo, hi)).toFixed(1).padStart(11) + '   |' +
    realN[k].toFixed(2).padStart(7) + simN[k].toFixed(2).padStart(8) +
    (realN[k] / simN[k]).toFixed(2).padStart(9));
});
say('');
say(`top-10 vs 11-25, as a multiple:   real ${(realN[0] / realN[1]).toFixed(3)}   sim ${(simN[0] / simN[1]).toFixed(3)}`);
say(`top-10 vs 26-50,  as a multiple:  real ${(realN[0] / realN[2]).toFixed(3)}   sim ${(simN[0] / simN[2]).toFixed(3)}`);
say('');

/* the quantity that actually differs: blue-chips landed PER TEAM, top band vs the next */
const RE = require(path.join(__dirname, 'recruit-profile.json'));
const SI = require(path.join(__dirname, 'simrec-profile.json'));
const perTeam = P => P.bands.map(b => (b.blueChipShare * 100) / b.teams);
const rp = perTeam(RE), sp = perTeam(SI);
say('blue-chips landed per team (share of the national total, per program):');
say('  band        real    sim');
BANDS.forEach((b, k) => say('  ' + LBL[k].padEnd(11) + rp[k].toFixed(2).padStart(6) + sp[k].toFixed(2).padStart(7)));
say('');
say(`top-10 : 11-25 per-team ratio    real ${(rp[0] / rp[1]).toFixed(2)}x   sim ${(sp[0] / sp[1]).toFixed(2)}x`);
say('');
const verdict = (realN[0] / realN[1]) / (simN[0] / simN[1]);
say(verdict > 1.15
  ? 'LADDER: the real top ten sit further ahead of ranks 11-25 than the sim\'s prestige spread allows.\n' +
    '  The pull curve is not obviously at fault — fix the distribution, which is measured, before\n' +
    '  inventing a brand term, which is not.'
  : verdict < 0.87
    ? 'LADDER (inverted): the sim already separates its top ten MORE than reality does, so the\n' +
      '  shortfall is not the ladder and the pull curve genuinely under-rewards being at the top.'
    : 'PULL: the two ladders agree on how far ahead the top ten are, so the shortfall is in how much\n' +
      '  that lead is worth — a shape problem in pedigreeFit, not a distribution problem.');

fs.writeFileSync(path.join(__dirname, 'toplean-report.txt'), out.join('\n') + '\n');
console.log('\nwrote toplean-report.txt');

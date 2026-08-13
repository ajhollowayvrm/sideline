/* Step 14 — where SIDELINE's penalties actually sit, measured the same way 13-penalties.js
   measures the real thing. Extracts the fenced engines out of index.html, runs a full synthetic
   slate with `penInto`, and reports the same metric set: per team-game count/yards, the shape of
   the distribution, the offense/defense split, and — the one that matters for tuning — how much
   team-to-team SPREAD the composure term actually produces.

   Rosters here carry real genTraits() composure, so `disc` varies exactly as it does in a live
   career. Output: simpen-report.txt. */
const fs = require('fs'), path = require('path');
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); return html.slice(i, j); };
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
eval(grab('// === SCHEME ENGINE (Phase 21) START ===', '// === SCHEME ENGINE (Phase 21) END ==='));
// eval returns its last expression, so this hands back the same PN the engine closes over
const PN = eval(grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ===') + '\n;PN');
const CAT = {}; PN.fouls.forEach(f => CAT[f[0]] = f);

const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3],
["DE", "def", 6], ["DT", "def", 6], ["LB", "def", 10], ["CB", "def", 9], ["S", "def", 8],
["K", "st", 2], ["P", "st", 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
function genRoster(r, prestige) {
  const out = [];
  POS.forEach(([code, , n]) => { for (let i = 0; i < n; i++) {
    const tr = genTraits(r);   // real temperament draw → composure varies as it does in a career
    out.push({ id: 'p' + Math.floor(r() * 1e9).toString(36), pos: code, ov: clamp(Math.round(prestige * 0.55 + ri(r, -9, 9) + 30), 48, 99), so: 0, mot: tr.mot, comp: tr.comp, ego: tr.ego });
  } });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => { arr.sort((a, b) => b.ov - a.ov);
    arr.forEach((p, i) => { if (i >= 2) p.ov = clamp(Math.round(p.ov - Math.min(2 + (i - 2) * 2.6, 26)), 44, 99); p.so = i; }); });
  return out;
}
function teamRatings(roster) {
  const grp = s => roster.filter(p => sideOf[p.pos] === s);
  const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
  const off = avgTop(grp('off'), 11), def = avgTop(grp('def'), 11);
  return { off, def, ovr: Math.round((off + def) / 2) };
}
const world = (() => {
  const r = rng(0x5eed), teams = [];
  for (let i = 0; i < 134; i++) {
    const prestige = clamp(Math.round(35 + ri(r, -15, 15) + (i < 16 ? 25 : i < 40 ? 12 : 0)), 20, 98);
    const roster = genRoster(r, prestige);
    const starters = roster.filter(p => (p.so || 0) <= 1);
    teams.push({ id: 't' + i, abbr: 'T' + i, prestige, roster, ratings: teamRatings(roster),
      disc: starters.reduce((a, p) => a + compVal(p), 0) / starters.length });
  }
  return teams;
})();

const slate = [];
for (let i = 0; i < world.length; i++) for (let d = 1; d <= 15; d++)
  slate.push({ id: 'g' + i + '_' + d, home: world[i], away: world[(i + d) % world.length] });

const rows = [];                       // one per team-game
const byTeam = {}; world.forEach(t => byTeam[t.id] = { n: 0, pen: 0, yds: 0, disc: t.disc });
let fsN = 0, osN = 0, snaps = 0, plays = 0, offN = 0, preN = 0;
const types = {};
for (const g of slate) {
  const seed = (hashStr(g.id) ^ 0x5ca1ab1e) >>> 0;
  const pen = {};
  const res = simEngine(g.home, g.away, seed, { penInto: pen, log: true });
  for (const t of [g.home, g.away]) {
    const p = pen[t.id] || { n: 0, yds: 0 };
    rows.push({ tid: t.id, home: t === g.home, pen: p.n, yds: p.yds, disc: t.disc });
    const b = byTeam[t.id]; b.n++; b.pen += p.n; b.yds += p.yds;
  }
  for (const l of res.log || []) {
    if (l.kind === 'play' || l.kind === 'score') plays++;
    if (/False start/i.test(l.text)) fsN++; else if (/Offside/i.test(l.text)) osN++;
  }
  for (const t of [g.home, g.away]) for (const k in ((pen[t.id] || {}).t || {})) {
    types[k] = (types[k] || 0) + pen[t.id].t[k];
    const F = CAT[k]; if (F[2] === 'off') offN += pen[t.id].t[k]; if (F[3] === 'pre') preN += pen[t.id].t[k];
  }
}

const mean = (a, k) => a.reduce((s, x) => s + (typeof k === 'function' ? k(x) : x[k]), 0) / a.length;
const sd = (a, k) => { const m = mean(a, k), g = x => (typeof k === 'function' ? k(x) : x[k]);
  return Math.sqrt(a.reduce((s, x) => s + (g(x) - m) ** 2, 0) / a.length); };
const f = (x, d = 2) => (x == null || !isFinite(x) ? '—' : x.toFixed(d));
const out = [], say = s => { out.push(s); console.log(s); };
const seasons = Object.values(byTeam).map(b => ({ ppg: b.pen / b.n, ypg: b.yds / b.n, disc: b.disc }));
const ppgs = seasons.map(s => s.ppg).sort((a, b) => a - b);
const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];

say('='.repeat(100));
say(`SIDELINE simEngine — penalties, ${slate.length} games / ${rows.length} team-games`);
say('='.repeat(100));
say(`\n  per team-game   ${f(mean(rows, 'pen'))} penalties (sd ${f(sd(rows, 'pen'))}) for ${f(mean(rows, 'yds'), 1)} yards`);
say(`  yards/penalty   ${f(mean(rows, 'yds') / mean(rows, 'pen'))}`);
const hist = {}; rows.forEach(r => hist[r.pen] = (hist[r.pen] || 0) + 1);
say('  distribution    ' + Object.keys(hist).map(Number).sort((a, b) => a - b).filter(k => k <= 16)
  .map(k => `${k}:${f(hist[k] / rows.length * 100, 1)}%`).join('  '));
{ const tot = Object.values(types).reduce((a, x) => a + x, 0);
  say(`  charged to the offense ${f(offN / tot * 100, 1)}% · to the defense ${f((tot - offN) / tot * 100, 1)}%   (real 65.1% / 34.9% once ST is folded in)`);
  say(`  pre-snap ${f(preN / tot * 100, 1)}% · live-ball ${f((tot - preN) / tot * 100, 1)}%   (real 49.1% / 50.9%)`);
  say('  most common flags:');
  Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, n]) =>
    say(`    ${CAT[k][1].padEnd(32)} ${f(n / slate.length / 2, 2).padStart(5)}/team-game  ${f(n / tot * 100, 1).padStart(5)}%`)); }
say(`  per scrimmage snap ${f(mean(rows, 'pen') / (plays / rows.length) * 100, 2)}%  (${f(plays / rows.length, 1)} logged plays/team-game)`);
const H = rows.filter(r => r.home), A = rows.filter(r => !r.home);
say(`  home ${f(mean(H, 'pen'))} · road ${f(mean(A, 'pen'))}  → road premium ${f((mean(A, 'pen') / mean(H, 'pen') - 1) * 100, 1)}%`);
say(`\n  TEAM-SEASON SPREAD (134 teams × ${byTeam['t0'].n} games)`);
say(`    mean ${f(mean(seasons, 'ppg'))} · sd ${f(sd(seasons, 'ppg'))}`);
say(`    p05 ${f(q(ppgs, .05))}  p25 ${f(q(ppgs, .25))}  median ${f(q(ppgs, .5))}  p75 ${f(q(ppgs, .75))}  p95 ${f(q(ppgs, .95))}`);
say(`    range ${f(ppgs[0])}–${f(ppgs[ppgs.length - 1])}`);
const ds = seasons.map(s => s.disc).sort((a, b) => a - b);
// noise-correct the season spread the same way 13-penalties.js does, so sim and reality compare directly
const gpg = byTeam['t0'].n, withinSd = sd(rows, 'pen');
const trueSd = Math.sqrt(Math.max(0, sd(seasons, 'ppg') ** 2 - withinSd ** 2 / gpg));
say(`    game-to-game sd within a team: ${f(withinSd)}   TRUE team-level sd: ${f(trueSd)}   (real: 2.54 / 0.95)`);
const bySorted = [...seasons].sort((a, b) => a.ppg - b.ppg), qn = Math.floor(seasons.length / 5);
say(`    least-disciplined quintile ${f(mean(bySorted.slice(-qn), 'ppg'))} vs most ${f(mean(bySorted.slice(0, qn), 'ppg'))} → observed gap ${f(mean(bySorted.slice(-qn), 'ppg') - mean(bySorted.slice(0, qn), 'ppg'))}`);
say(`\n  team composure (starter mean) spread: ${f(ds[0], 1)}–${f(ds[ds.length - 1], 1)}, sd ${f(sd(seasons, 'disc'), 2)}`);
const lo = seasons.filter(s => s.disc <= q(ds, .2)), hi = seasons.filter(s => s.disc >= q(ds, .8));
say(`    least composed quintile → ${f(mean(lo, 'ppg'))} pen/game`);
say(`    most composed quintile  → ${f(mean(hi, 'ppg'))} pen/game`);
say(`    composure effect: ${f(mean(lo, 'ppg') - mean(hi, 'ppg'))} penalties/game between the tails`);
fs.writeFileSync(__dirname + '/simpen-report.txt', out.join('\n'));
console.log('\nwrote simpen-report.txt');

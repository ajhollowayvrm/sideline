/* Step 19 — what the offence does on fourth down, bucketed by distance.

   The aggregate "4th-down conversion 38% vs a real 52.4%" hides the thing that matters: real
   attempts are concentrated on 4th-and-1 (~45% of them) and the sim's are not (~25%), so the sim
   converts less by attempting worse downs rather than by executing badly. This prints the mix. */
const fs = require('fs'), path = require('path');
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const html = fs.readFileSync(process.env.INDEX || path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); return html.slice(i, j); };
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
eval(grab('// === SCHEME ENGINE (Phase 21) START ===', '// === SCHEME ENGINE (Phase 21) END ==='));
eval(grab('// === ATTRIBUTE ENGINE (Phase 52) START ===', '// === ATTRIBUTE ENGINE (Phase 52) END ==='));
eval(grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ==='));
const POS = [['QB', 'off', 4], ['RB', 'off', 5], ['WR', 'off', 11], ['TE', 'off', 5], ['OT', 'off', 7], ['OG', 'off', 6], ['C', 'off', 3],
['DE', 'def', 6], ['DT', 'def', 6], ['LB', 'def', 10], ['CB', 'def', 9], ['FS', 'def', 4], ['SS', 'def', 4], ['K', 'st', 2], ['P', 'st', 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
function genRoster(r, pres) {
  const out = []; POS.forEach(([code, , n]) => { for (let i = 0; i < n; i++) {
    const ov = clamp(Math.round(pres * 0.55 + ri(r, -9, 9) + 30), 48, 99);
    out.push(Object.assign({ id: 'p' + Math.floor(r() * 1e9).toString(36), pos: code, ov, so: 0 }, genProfile(r, ov, code))); } });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(a => { a.sort((x, y) => y.ov - x.ov); a.forEach((p, i) => { if (i >= 2) { shiftAttrs(p, -Math.min(2 + (i - 2) * 2.6, 26)); p.ov = clamp(ovrBase(p), 44, 99); } p.so = i; }); });
  return out;
}
function teamRatings(roster) { const grp = s => roster.filter(p => sideOf[p.pos] === s);
  const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
  return { off: avgTop(grp('off'), 11), def: avgTop(grp('def'), 11), ovr: 0 }; }
const N = +(process.env.TEAMS || 40), G = +(process.env.OPP || 12);
const teams = []; for (let i = 0; i < N; i++) { const r = rng(0x5eed + i); const roster = genRoster(r, clamp(35 + ri(r, -15, 15) + (i < N / 5 ? 25 : 0), 20, 98)); teams.push({ id: 't' + i, abbr: 'T' + i, roster, ratings: teamRatings(roster) }); }
// real reference: attempt share and conversion by distance, from modern FBS play-by-play
// Goal-to-go is its own bucket. The play-by-play `dd` reads "4 & goal" at ANY distance inside the
// ten, so folding it into 4th-and-1 mixed genuine inches with 4th-and-goal from the 9 — and made the
// short-yardage field-goal rate look like a decision bug when it was a bucketing one.
const BK = [[1, '4th-and-1', 45, 72], [3, '4th-and-2-3', 25, 55], [6, '4th-and-4-6', 15, 45], [10, '4th-and-7-10', 8, 32], [99, '4th-and-11+', 7, 25], [-1, '4th-and-goal', 0, 0]];
const att = {}, cv = {}, punt = {}, fg = {}, all = {}; BK.forEach(([, n]) => { att[n] = cv[n] = punt[n] = fg[n] = all[n] = 0; });
const bk = t => BK.find(([d]) => d > 0 && t <= d)[1];
// real 3rd-down conversion by distance (modern FBS play-by-play), for reference
const BK3 = [[1, '3rd-and-1', 68], [3, '3rd-and-2-3', 55], [6, '3rd-and-4-6', 44], [10, '3rd-and-7-10', 31], [99, '3rd-and-11+', 20]];
const bk3 = t => BK3.find(([d]) => t <= d)[1];
const d3all = {}, d3cv = {};
let games = 0;
for (let i = 0; i < N; i++) for (let d = 1; d <= G; d++) {
  const res = simEngine(teams[i], teams[(i + d) % N], (hashStr('d4_' + i + '_' + d) ^ 9) >>> 0, { log: true }); games++;
  for (const e of res.log) {
    // skip the "Turnover on downs" line — it repeats the failed play's 4th-down `dd` (see 4-simprofile)
    // third down too — the single biggest lever on how often a drive reaches the red zone, because
    // it COMPOUNDS: a drive needs about three of them, so a 1.5pp per-down deficit is a ~12% deficit
    // in drives long enough to get there. (0.392/0.377)^3 = 1.12, which is exactly the trip gap.
    const m3 = String(e.dd || '').match(/^3 & (\d+|goal)$/);
    if (m3 && !/^🚩/.test(e.text)) {
      const b3 = m3[1] === 'goal' ? '3rd-and-goal' : bk3(+m3[1]);
      d3all[b3] = (d3all[b3] || 0) + 1;
      if (/1ST DOWN/.test(e.text) || /TOUCHDOWN/.test(e.text)) d3cv[b3] = (d3cv[b3] || 0) + 1;
    }
    const m = String(e.dd || '').match(/^4 & (\d+|goal)$/);
    if (!m || /^🚩/.test(e.text) || /Turnover on downs/.test(e.text)) continue;
    const b = m[1] === 'goal' ? '4th-and-goal' : bk(+m[1]); all[b]++;
    if (/^Punt/.test(e.text)) punt[b]++;
    else if (/field goal/.test(e.text)) fg[b]++;
    else { att[b]++; if (/1ST DOWN/.test(e.text) || /TOUCHDOWN/.test(e.text)) cv[b]++; }
  }
}
const tg = games * 2;
console.log(`sim fourth downs over ${tg} team-games`);
console.log('bucket'.padEnd(14) + 'faced/g   go%  punt%    fg%   conv%   | share of att (real)   conv (real)');
let A = 0, C = 0;
BK.forEach(([, n, rShare, rConv]) => { const t = all[n] || 1; A += att[n]; C += cv[n]; });
BK.forEach(([, n, rShare, rConv]) => { const t = all[n] || 1;
  console.log(n.padEnd(14) + String((all[n] / tg).toFixed(2)).padStart(7) + String((100 * att[n] / t).toFixed(0)).padStart(6)
    + String((100 * punt[n] / t).toFixed(0)).padStart(7) + String((100 * fg[n] / t).toFixed(0)).padStart(7)
    + String((100 * cv[n] / (att[n] || 1)).toFixed(0)).padStart(8) + '   |'
    + String((100 * att[n] / A).toFixed(0) + '% (' + rShare + '%)').padStart(14)
    + String((100 * cv[n] / (att[n] || 1)).toFixed(0) + '% (' + rConv + '%)').padStart(14)); });
console.log(`\nTOTAL go attempts/team-game ${(A / tg).toFixed(2)} (real 1.94)   conversion ${(100 * C / A).toFixed(1)}% (real 52.4%)`);

console.log('');
console.log('THIRD DOWN — the compounding lever on red-zone trips');
console.log('bucket'.padEnd(16) + 'faced/g    conv%   (real)');
{
  let T3 = 0, C3 = 0;
  BK3.forEach(([, n, rConv]) => { const a = d3all[n] || 0, c = d3cv[n] || 0; T3 += a; C3 += c;
    console.log(n.padEnd(16) + String((a / tg).toFixed(2)).padStart(7) + String((100 * c / (a || 1)).toFixed(0)).padStart(9) + String('(' + rConv + '%)').padStart(9)); });
  const ag = d3all['3rd-and-goal'] || 0, cg = d3cv['3rd-and-goal'] || 0; T3 += ag; C3 += cg;
  console.log('3rd-and-goal'.padEnd(16) + String((ag / tg).toFixed(2)).padStart(7) + String((100 * cg / (ag || 1)).toFixed(0)).padStart(9));
  console.log('TOTAL 3rd downs/team-game ' + (T3 / tg).toFixed(2) + '   conversion ' + (100 * C3 / T3).toFixed(1) + '% (real 39.2%)');
}

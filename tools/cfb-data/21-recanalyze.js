/* Step 21 — turn the CFBD harvest into the measured recruiting reference.

   Phase 56. Computes the SAME metric set as 22-recprofile.js computes from the game, so
   23-reccompare.js can put them side by side. docs/reference/cfb-recruiting.md is transcribed
   from the report this writes.

   Run:  node tools/cfb-data/21-recanalyze.js            (after 20-recruits.js)

   Two conventions carried from cfb-penalties.md:
   - state the sample and the coverage caveat before any number;
   - where a rate is derived from a partial join, print the join rate and call the result a floor.

   The program-quality ordering is the TALENT COMPOSITE (/talent), not class rank. That is the
   honest analogue of SIDELINE's `prestige`: how good the roster is, independent of the class being
   signed. Banding by class rank would make "good programs sign good classes" true by construction. */

const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, 'rec-cache.json');
if (!fs.existsSync(CACHE)) { console.error('rec-cache.json missing — run 20-recruits.js first'); process.exit(2); }
const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
const YEARS = Object.keys(cache).map(Number).sort((a, b) => a - b);

const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => (a.length ? sum(a) / a.length : 0);
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const qtl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
function pearson(xs, ys) {
  const n = xs.length; if (n < 2) return 0;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : 0;
}
function gini(v) {
  const a = [...v].sort((x, y) => x - y), n = a.length, t = sum(a);
  if (!n || !t) return 0;
  let acc = 0; for (let i = 0; i < n; i++) acc += (i + 1) * a[i];
  return (2 * acc) / (n * t) - (n + 1) / n;
}
/* great-circle miles — hometown to campus */
function miles(a, b, c, d) {
  const R = 3958.8, rad = x => x * Math.PI / 180;
  const dp = rad(c - a), dl = rad(d - b);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const out = [];
const say = s => { out.push(s); console.log(s); };
const pct = x => (100 * x).toFixed(1) + '%';

/* ---------- per-year assembly ---------- */
const MIN_CLASS = 10;                       // same bar the sim profiler uses, for comparability
const PRESTIGE_BANDS = [[0, 10], [10, 25], [25, 50], [50, 90], [90, 134]];
const BAND_LABEL = ['1-10', '11-25', '26-50', '51-90', '91-134'];
const bandBC = PRESTIGE_BANDS.map(() => 0), bandSigned = PRESTIGE_BANDS.map(() => 0), bandTeams = PRESTIGE_BANDS.map(() => 0);

let ranked = 0, unranked = 0, toFBS = 0, toOther = 0, uncommitted = 0;
const starMix = {};
const classSizes = [], bcrAll = [], inStateShares = [], distances = [];
const bcrByTeamYear = {};                   // team -> {year: {bc, n}}
const pointsByYear = {};                    // year -> {team: points}
const stateSupply = {};
let pooledBC = 0, pooledSigned = 0;
let namedSample = [];
let latlongHave = 0, latlongWant = 0, talentJoin = 0, talentWant = 0;

for (const y of YEARS) {
  const Y = cache[y];
  if (!Y.players || !Y.players.length) continue;
  const fbs = Y.fbs || [];
  const campus = {};                        // school -> {state, lat, lon}
  fbs.forEach(t => { if (t.location) campus[t.school] = { state: t.location.state, lat: t.location.latitude, lon: t.location.longitude }; });
  const isFBS = s => Object.prototype.hasOwnProperty.call(campus, s);

  /* program-quality ordering for this class: the talent composite of the season it signs INTO */
  const talent = {};
  (Y.talent || []).forEach(t => { if (isFBS(t.team)) talent[t.team] = t.talent; });
  const ranking = Object.keys(campus).sort((a, b) => (talent[b] || 0) - (talent[a] || 0));
  talentWant += Object.keys(campus).length;
  talentJoin += Object.keys(talent).length;

  const cls = {};
  for (const p of Y.players) {
    if (p.recruitType && p.recruitType !== 'HighSchool') continue;
    if (p.stars) { ranked++; starMix[p.stars] = (starMix[p.stars] || 0) + 1; } else unranked++;
    if (p.stateProvince) stateSupply[p.stateProvince] = (stateSupply[p.stateProvince] || 0) + 1;
    if (!p.committedTo) { uncommitted++; continue; }
    if (!isFBS(p.committedTo)) { toOther++; continue; }
    toFBS++;
    (cls[p.committedTo] = cls[p.committedTo] || []).push(p);
  }

  const bcOf = s => (cls[s] || []).filter(p => p.stars >= 4).length;
  for (const school of Object.keys(campus)) {
    const list = cls[school] || [];
    classSizes.push(list.length);
    const bc = bcOf(school);
    (bcrByTeamYear[school] = bcrByTeamYear[school] || {})[y] = { bc, n: list.length };
    if (list.length >= MIN_CLASS) {
      bcrAll.push(bc / list.length);
      const c = campus[school];
      inStateShares.push(list.filter(p => p.stateProvince === c.state).length / list.length);
      for (const p of list) {
        latlongWant++;
        if (p.hometownInfo && p.hometownInfo.latitude != null && c.lat != null) {
          latlongHave++;
          distances.push(miles(p.hometownInfo.latitude, p.hometownInfo.longitude, c.lat, c.lon));
        }
      }
    }
    pooledSigned += list.length; pooledBC += bc;
  }

  PRESTIGE_BANDS.forEach(([lo, hi], k) => {
    const band = ranking.slice(lo, hi);
    bandBC[k] += sum(band.map(bcOf));
    bandSigned[k] += sum(band.map(s => (cls[s] || []).length));
    bandTeams[k] += band.length;
  });

  pointsByYear[y] = {};
  (Y.teams || []).forEach(t => { if (isFBS(t.team)) pointsByYear[y][t.team] = t.points; });

  if (y === 2023) namedSample = ranking.slice(0, 10).map(s => ({ school: s, talent: Math.round(talent[s] || 0), n: (cls[s] || []).length, bc: bcOf(s) }));
}

/* rolling 4-class blue-chip ratio */
const bcr4 = [];
for (const school of Object.keys(bcrByTeamYear)) {
  const ys = Object.keys(bcrByTeamYear[school]).map(Number).sort((a, b) => a - b);
  for (let i = 0; i + 4 <= ys.length; i++) {
    const w = ys.slice(i, i + 4).map(y => bcrByTeamYear[school][y]);
    const n = sum(w.map(x => x.n));
    if (n >= MIN_CLASS * 4) bcr4.push(sum(w.map(x => x.bc)) / n);
  }
}
/* class-points persistence, consecutive years */
const persistR = [];
for (let i = 0; i + 1 < YEARS.length; i++) {
  const a = pointsByYear[YEARS[i]] || {}, b = pointsByYear[YEARS[i + 1]] || {};
  const both = Object.keys(a).filter(t => b[t] != null);
  if (both.length > 20) persistR.push(pearson(both.map(t => a[t]), both.map(t => b[t])));
}
/* gini of blue-chips per team, per year */
const giniAll = [];
for (const y of YEARS) {
  const v = Object.keys(bcrByTeamYear).map(s => (bcrByTeamYear[s][y] || {}).bc || 0);
  if (sum(v)) giniAll.push(gini(v));
}

/* ---------- report ---------- */
say('Real college football recruiting — measured');
say('='.repeat(66));
say(`source: CollegeFootballData /recruiting/players + /recruiting/teams + /teams/fbs + /talent`);
say(`sample: ${YEARS[0]}-${YEARS[YEARS.length - 1]}, ${YEARS.length} signing classes, ` +
  `${(ranked + unranked).toLocaleString()} high-school prospects on the ranked board`);
say('');
say('COVERAGE CAVEATS — read before using any number below');
say(`  prospects carrying a star rating   ${pct(ranked / (ranked + unranked))}  (the rest are on the board unrated)`);
say(`  hometown lat/long present          ${pct(latlongHave / latlongWant)}  (distance stats are over these)`);
say(`  FBS programs joined to /talent     ${pct(talentJoin / talentWant)}  (band table is over these)`);
say('  NOT available in the free tier: commit DATES, offer lists, official visits, NIL money.');
say('  Nothing here can validate the commitment-window (P35) or visit-calendar (P38) mechanics.');
say('');

say('1. SUPPLY — the board per cycle');
const totalRanked = sum(Object.values(starMix));
[5, 4, 3, 2].forEach(s => say(`  ${s}*  ${String(Math.round((starMix[s] || 0) / YEARS.length)).padStart(5)}  ${pct((starMix[s] || 0) / totalRanked)}`));
say(`  blue-chip (4-5*)          ${pct(((starMix[5] || 0) + (starMix[4] || 0)) / totalRanked)}`);
say(`  ranked board per class    ${Math.round((ranked + unranked) / YEARS.length).toLocaleString()}`);
say('');

say('2. CONVERGENCE — where the board actually goes');
const tot = toFBS + toOther + uncommitted;
say(`  signs FBS                 ${pct(toFBS / tot)}   (${Math.round(toFBS / YEARS.length).toLocaleString()} per class)`);
say(`  signs FCS / non-FBS       ${pct(toOther / tot)}`);
say(`  no listed commitment      ${pct(uncommitted / tot)}`);
say(`  class size  mean ${mean(classSizes).toFixed(1)}   p10 ${qtl(classSizes, 0.1)}  median ${median(classSizes)}  p90 ${qtl(classSizes, 0.9)}`);
say(`  programs signing < ${MIN_CLASS}         ${pct(classSizes.filter(n => n < MIN_CLASS).length / classSizes.length)}`);
say('  ^ the ranked board deliberately EXCEEDS FBS capacity. A pool-consumption rate is therefore');
say('    not a health metric: 100% consumption would be wrong. Per-team fill is the real check.');
say('');

say('3. DISTRIBUTION — who gets the players');
say(`  blue-chip share of all FBS signees  ${pct(pooledBC / pooledSigned)}`);
say(`  blue-chip ratio, per class          mean ${pct(mean(bcrAll))}  (classes >= ${MIN_CLASS})`);
say(`  blue-chip ratio, rolling 4yr        mean ${pct(mean(bcr4))}   max ${pct(Math.max(...bcr4))}`);
const over50 = bcr4.filter(x => x >= 0.5).length;
say(`  program-windows at BCR >= 50%       ${over50} of ${bcr4.length}  (${pct(over50 / bcr4.length)})`);
say(`  Gini of blue-chips per team         ${mean(giniAll).toFixed(3)}`);
say('');
say('  WHERE the blue-chips go, by TALENT-COMPOSITE band (non-cumulative):');
say('  band        teams  class size   share of blue-chips   BCR');
PRESTIGE_BANDS.forEach(([lo, hi], k) => {
  say(`  ${BAND_LABEL[k].padEnd(10)}${String(hi - lo).padStart(6)}` +
    `${(bandSigned[k] / bandTeams[k]).toFixed(1).padStart(12)}` +
    `${pct(bandBC[k] / pooledBC).padStart(22)}` +
    `${pct(bandSigned[k] ? bandBC[k] / bandSigned[k] : 0).padStart(8)}`);
});
say('');
say('  THE TEN MOST TALENTED PROGRAMS, 2023 class:');
say('  team                talent   signed   blue-chips');
namedSample.forEach(r => say(`  ${r.school.padEnd(20)}${String(r.talent).padStart(6)}${String(r.n).padStart(9)}${String(r.bc).padStart(13)}`));
say('');

say('4. PERSISTENCE — does a program stay good at recruiting?');
say(`  class-points r, class N -> N+1      ${mean(persistR).toFixed(3)}`);
say('');

say('5. GEOGRAPHY');
say(`  in-state share of a class           ${pct(mean(inStateShares))}`);
say(`  signing distance   median ${Math.round(median(distances))} mi   p90 ${Math.round(qtl(distances, 0.9))} mi`);
say(`  within 250 mi                       ${pct(distances.filter(d => d <= 250).length / distances.length)}`);
say(`  within 500 mi                       ${pct(distances.filter(d => d <= 500).length / distances.length)}`);
say('');
const totSupply = sum(Object.values(stateSupply));
const topStates = Object.entries(stateSupply).sort((a, b) => b[1] - a[1]).slice(0, 12);
say('  talent production by state (share of the ranked board):');
say('  state    share      SIDELINE draws uniformly at 2.0%');
topStates.forEach(([s, n]) => say(`  ${s.padEnd(9)}${pct(n / totSupply).padStart(6)}       ${(n / totSupply / 0.02).toFixed(1)}x`));
say('');

fs.writeFileSync(path.join(__dirname, 'recruit-report.txt'), out.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'recruit-profile.json'), JSON.stringify({
  years: YEARS, classes: YEARS.length,
  starMix, rankedPerClass: (ranked + unranked) / YEARS.length,
  fbsSignRate: toFBS / tot, otherRate: toOther / tot, uncommittedRate: uncommitted / tot,
  classSizeMean: mean(classSizes), classSizeMedian: median(classSizes),
  smallClassShare: classSizes.filter(n => n < MIN_CLASS).length / classSizes.length,
  bcrPooled: pooledBC / pooledSigned, bcrMean: mean(bcrAll),
  bcr4Mean: mean(bcr4), bcr4Max: Math.max(...bcr4), bcr4Over50: over50 / bcr4.length,
  giniBlueChip: mean(giniAll),
  bands: PRESTIGE_BANDS.map(([lo, hi], k) => ({
    band: BAND_LABEL[k], teams: hi - lo, classSize: bandSigned[k] / bandTeams[k],
    blueChipShare: bandBC[k] / pooledBC, bcr: bandSigned[k] ? bandBC[k] / bandSigned[k] : 0,
  })),
  persistence: mean(persistR),
  inStateShare: mean(inStateShares),
  distanceMedian: median(distances),
  within250: distances.filter(d => d <= 250).length / distances.length,
  stateSupply: Object.fromEntries(Object.entries(stateSupply).map(([s, n]) => [s, n / totSupply])),
}, null, 2));
console.log('wrote recruit-report.txt + recruit-profile.json');

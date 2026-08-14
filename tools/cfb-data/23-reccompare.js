/* Step 23 — side-by-side: real recruiting vs SIDELINE's, on identical metrics.
   Same shape as 5-compare.js. Run 21-recanalyze.js and 22-recprofile.js first. */
const RE = require(__dirname + '/recruit-profile.json');
const SI = require(__dirname + '/simrec-profile.json');
const f = (n, d = 1) => (n === undefined || n === null || !isFinite(n)) ? '—' : n.toFixed(d);

function row(label, real, sim, dec = 1, unit = '') {
  const dl = (sim - real);
  const pctOff = real ? (dl / real * 100) : 0;
  const flag = Math.abs(pctOff) < 6 ? '  ok ' : Math.abs(pctOff) < 15 ? '  ~  ' : ' MISS';
  const arrow = dl > 0 ? '+' : '';
  return `  ${label.padEnd(32)} ${f(real, dec).padStart(8)} ${f(sim, dec).padStart(8)}   ${(arrow + f(dl, dec)).padStart(8)} ${(arrow + f(pctOff, 0) + '%').padStart(7)} ${flag} ${unit}`;
}
const pctOf = (o, k) => 100 * (o[k] || 0);

console.log('');
console.log('='.repeat(98));
console.log('  SIDELINE recruiting  vs  REAL college football recruiting');
console.log(`  real = ${RE.classes} signing classes ${RE.years[0]}-${RE.years[RE.years.length - 1]}   ` +
  `sim = ${SI.classes} national classes (${SI.worlds} independent leagues)`);
console.log('='.repeat(98));
console.log(`  ${'METRIC'.padEnd(32)} ${'REAL'.padStart(8)} ${'SIM'.padStart(8)}   ${'DELTA'.padStart(8)} ${'OFF'.padStart(7)}`);
console.log('  ' + '-'.repeat(94));

console.log('  SUPPLY  (the board per cycle)');
const rTot = [5, 4, 3, 2].reduce((s, k) => s + (RE.starMix[k] || 0), 0);
const sTot = [5, 4, 3, 2].reduce((s, k) => s + (SI.starMix[k] || 0), 0);
console.log(row('ranked board size', RE.rankedPerClass, SI.starMix ? sTot / SI.classes : 0, 0));
[5, 4, 3, 2].forEach(k => console.log(row(`  ${k}-star share %`, 100 * RE.starMix[k] / rTot, 100 * SI.starMix[k] / sTot)));
console.log(row('blue-chip share of board %',
  100 * ((RE.starMix[5] || 0) + (RE.starMix[4] || 0)) / rTot,
  100 * ((SI.starMix[5] || 0) + (SI.starMix[4] || 0)) / sTot));

console.log('  CONVERGENCE');
console.log(row('signs FBS %', pctOf(RE, 'fbsSignRate'), pctOf(SI, 'signRate')));
console.log(row('class size, mean', RE.classSizeMean, SI.classSizeMean));
console.log(row('programs signing < 10 %', pctOf(RE, 'smallClassShare'), pctOf(SI, 'smallClassShare')));

console.log('  DISTRIBUTION');
console.log(row('blue-chip share of signees %', pctOf(RE, 'bcrPooled'), pctOf(SI, 'bcrPooled')));
console.log(row('BCR per class, mean %', pctOf(RE, 'bcrMean'), pctOf(SI, 'bcrMean')));
console.log(row('BCR rolling 4yr, mean %', pctOf(RE, 'bcr4Mean'), pctOf(SI, 'bcr4Mean')));
console.log(row('BCR rolling 4yr, max %', pctOf(RE, 'bcr4Max'), pctOf(SI, 'bcr4Max')));
console.log(row('windows at BCR >= 50% ', pctOf(RE, 'bcr4Over50'), pctOf(SI, 'bcr4Over50')));
console.log(row('Gini of blue-chips', RE.giniBlueChip, SI.giniBlueChip, 3));

console.log('  WHERE THE BLUE-CHIPS GO  (by program-quality band — the phase in one table)');
console.log(`  ${'band'.padEnd(12)} ${'REAL size'.padStart(9)} ${'SIM size'.padStart(9)}  ${'REAL BC%'.padStart(9)} ${'SIM BC%'.padStart(8)}  ${'REAL BCR'.padStart(9)} ${'SIM BCR'.padStart(8)}`);
RE.bands.forEach((b, i) => {
  const s = SI.bands[i] || {};
  console.log(`  ${b.band.padEnd(12)} ${f(b.classSize).padStart(9)} ${f(s.classSize).padStart(9)}  ` +
    `${f(100 * b.blueChipShare).padStart(9)} ${f(100 * s.blueChipShare).padStart(8)}  ` +
    `${f(100 * b.bcr).padStart(9)} ${f(100 * s.bcr).padStart(8)}`);
});

console.log('  PERSISTENCE');
console.log(row('class score r, N -> N+1', RE.persistence, SI.persistence, 3));

console.log('  GEOGRAPHY');
console.log(row('in-state share of a class %', pctOf(RE, 'inStateShare'), pctOf(SI, 'inStateShare')));
const topStates = Object.entries(RE.stateSupply).sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log('  talent production, top states (share of the board):');
topStates.forEach(([st, share]) => console.log(row(`  ${st}`, 100 * share, 100 * (SI.stateSupply[st] || 0), 1, '%')));
console.log('');

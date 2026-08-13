/* Step 12 — turn the measured play distributions into engine constants.

   The three-tier gain draw was a hand-built approximation of a shape we now have measured directly.
   This emits a compact QUANTILE TABLE (empirical inverse CDF) for rush and completion yardage, plus
   per-(down, distance) mean offsets. The engine then samples the real distribution by interpolation
   instead of approximating it — the mean, median, stuff rate and explosive rate all come out right
   by construction rather than by fitting four numbers against each other.

   Run after 11-plays.js.  Prints a PM-ready block. */
const fs = require('fs');
const M = require(__dirname + '/play-profile.json');

// A tail-dense percentile grid. An even 5% grid puts the last step between the 95th percentile and
// the maximum, and linear interpolation across that gap badly over-weights the extreme (it produced
// a table mean of 5.90 against a real 5.09). Football yardage is heavily right-skewed, so the tail
// needs the resolution and the top point is the 99.8th percentile, not the single longest run.
const GRID = [0, 1, 2, 4, 6, 8, 11, 14, 18, 22, 26, 30, 35, 40, 45, 50, 55, 60, 65, 70, 74, 78,
  82, 85, 88, 91, 93, 95, 96.5, 98, 99, 99.5, 99.8];
function pctile(keys, cum, total, pct) {
  const target = total * pct / 100;
  for (let i = 0; i < keys.length; i++) if (cum[i] >= target) return keys[i];
  return keys[keys.length - 1];
}
function quantiles(h) {
  const keys = Object.keys(h).map(Number).sort((a, b) => a - b);
  const total = keys.reduce((a, k) => a + h[k], 0);
  const cum = []; let acc = 0;
  keys.forEach((k, i) => { acc += h[k]; cum[i] = acc; });
  const out = GRID.map(p => pctile(keys, cum, total, p));
  for (let i = 1; i < out.length; i++) if (out[i] < out[i - 1]) out[i] = out[i - 1];
  return out;
}
// Mean of the table as the ENGINE will sample it: u ~ U(0,1) mapped through the same grid, so this
// is the real expected gain the engine will produce — not a naive average of the knots.
function tableMean(q) {
  let s = 0, w = 0;
  for (let i = 0; i < q.length - 1; i++) {
    const span = (GRID[i + 1] - GRID[i]) / 100;          // share of draws landing in this segment
    s += span * (q[i] + q[i + 1]) / 2; w += span;
  }
  s += (1 - w) * q[q.length - 1];                        // the sliver above the top knot
  return s;
}
function histMean(h) { let n = 0, s = 0; for (const k in h) { n += h[k]; s += (+k) * h[k]; } return s / n; }

const BK = ['1', '2-3', '4-6', '7-10', '11+'];
// Per-DISTANCE tables. A single table plus a mean offset cannot work: real short yardage has a
// LOWER mean (3.40 vs 5.38) but a protected floor — 76.3% of carries on 3rd-and-1 gain the yard,
// against 82% overall — because it is stuff-or-get-just-enough, not a shifted version of a normal
// carry. Shifting the whole distribution down destroyed exactly the case it needed to preserve.
const runQ = {}, cmpQ = {};
for (const bk of BK) { runQ[bk] = quantiles(M.runGD[bk]); cmpQ[bk] = quantiles(M.cmpGD[bk]); }
const sackQ = quantiles(M.sackG), penQ = quantiles(M.penG);
console.log('per-distance tables (real mean -> table mean, and P(gain>=1)):');
for (const bk of BK) {
  const h = M.runGD[bk], n = Object.values(h).reduce((a, x) => a + x, 0);
  const ge1 = Object.keys(h).filter(k => +k >= 1).reduce((a, k) => a + h[k], 0) / n * 100;
  console.log('  rush ' + bk.padEnd(6) + histMean(h).toFixed(2) + ' -> ' + tableMean(runQ[bk]).toFixed(2) + '   P(>=1) ' + ge1.toFixed(1) + '%');
}



// per-(down, distance-bucket) mean offsets, relative to that play type's overall mean
const BUCKETS = ['1', '2-3', '4-6', '7-10', '11+'];
function ddOffsets(byDD, overall) {
  const out = {};
  for (let dn = 1; dn <= 4; dn++) for (const b of BUCKETS) {
    const a = byDD[dn + '|' + b]; if (!a || a[0] < 200) continue;
    out[dn + '|' + b] = +((a[1] / a[0]) - overall).toFixed(2);
  }
  return out;
}
const runDD = ddOffsets(M.runByDD, histMean(M.runG));
const cmpDD = ddOffsets(M.cmpByDD, histMean(M.cmpG));

console.log('\nrush mean offset by down|distance (yards vs the overall mean):');
for (let dn = 1; dn <= 4; dn++) { let row = '  down ' + dn + '  ';
  for (const b of BUCKETS) { const v = runDD[dn + '|' + b]; row += `${b}:${v === undefined ? '—' : (v > 0 ? '+' : '') + v}`.padEnd(12); }
  console.log(row); }
console.log('completion mean offset by down|distance:');
for (let dn = 1; dn <= 4; dn++) { let row = '  down ' + dn + '  ';
  for (const b of BUCKETS) { const v = cmpDD[dn + '|' + b]; row += `${b}:${v === undefined ? '—' : (v > 0 ? '+' : '') + v}`.padEnd(12); }
  console.log(row); }

// compact the offsets: the engine only needs a lookup keyed the same way
const fmt = o => '{' + Object.entries(o).map(([k, v]) => `'${k}':${v}`).join(',') + '}';
console.log('\n--- PM-ready ---\n');
const qfmt = o => '{' + BK.map(bk => `'${bk}':[${o[bk].join(',')}]`).join(', ') + '}';
console.log(`  runQ:${qfmt(runQ)},`);
console.log(`  recQ:${qfmt(cmpQ)},`);
console.log(`  runDD:${fmt(runDD)},`);
console.log(`  recDD:${fmt(cmpDD)},`);
console.log(`  sackQ:[${sackQ.join(",")}],`);
console.log(`  penQ:[${penQ.join(",")}],`);
console.log(`  GRID:[${GRID.join(",")}],`);

fs.writeFileSync(__dirname + '/quantiles.json', JSON.stringify({ GRID, runQ, cmpQ, sackQ, penQ, runDD, cmpDD,
  runMean: histMean(M.runG), cmpMean: histMean(M.cmpG) }, null, 1));
console.log('\nwrote quantiles.json');

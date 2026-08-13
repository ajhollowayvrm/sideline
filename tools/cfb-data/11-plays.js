/* Step 11 — the real PLAY-LEVEL distributions.
   Everything left on the Phase 48 gap list is a drive-shape question (how far do failed drives get,
   how often do you actually reach the 20, how often do you score once there, what does a real gain
   distribution look like), and those were being compared against literature figures that turned out
   to be internally inconsistent. This harvests ESPN's per-play data — which carries down, distance
   and `yardsToEndzone` (orientation-free field position) — and builds the real distributions.

   Output: play-profile.json.  Resumable via its own cache (play-cache.json). */
const fs = require('fs'), path = require('path');
const IDX = require(__dirname + '/index.json');
const FBS = new Set(['1', '4', '5', '8', '9', '12', '15', '17', '18', '37', '151']);
const GAMES = IDX.filter(g => FBS.has(String(g.hc)) && FBS.has(String(g.ac)));
const CACHE = __dirname + '/play-cache.json';
const OUT = __dirname + '/play-profile.json';
const CONC = 8;

let done = {};
if (fs.existsSync(CACHE)) { try { done = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { done = {}; } }

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) return await r.json(); if (r.status === 404) return null; } catch (e) {}
    await new Promise(s => setTimeout(s, 400 * (i + 1)));
  }
  return null;
}

const RUN = new Set(['Rush', 'Rushing Touchdown']);
const CMP = new Set(['Pass Reception', 'Passing Touchdown']);
const INC = new Set(['Pass Incompletion']);
const SACK = new Set(['Sack']);

// one game -> compact per-game tallies (histograms merge additively across games)
function extract(d) {
  const drives = (d.drives && d.drives.previous) || [];
  if (!drives.length) return null;
  const o = {
    runG: {}, cmpG: {}, sackG: {}, penG: {},        // gain histograms (yards -> count)
    d3: {}, d4: {},                                  // distance bucket -> [attempts, conversions]
    runByDD: {}, cmpByDD: {},                        // "down|distBucket" -> [n, sumGain]
    runGD: {}, cmpGD: {}, mixD: {},                            // distBucket -> gain histogram (the real SHAPE per situation)
    drives: 0, rzTrips: 0, rzTD: 0, rzFG: 0,
    startSum: 0, startN: 0,
    byResult: {},                                    // result -> [n, sumYards, sumPlays]
    scoreDrives: 0,
  };
  const bump = (h, k) => { h[k] = (h[k] || 0) + 1; };
  const dbucket = dist => dist <= 1 ? '1' : dist <= 3 ? '2-3' : dist <= 6 ? '4-6' : dist <= 10 ? '7-10' : '11+';
  for (const dr of drives) {
    const plays = dr.plays || []; if (!plays.length) continue;
    o.drives++;
    const res = String(dr.result || 'OTHER').toUpperCase();
    const yds = +dr.yards || 0, np = +dr.offensivePlays || 0;
    const R = o.byResult[res] = o.byResult[res] || [0, 0, 0];
    R[0]++; R[1] += yds; R[2] += np;
    let maxLos = -1, startLos = null;
    for (const p of plays) {
      const st = p.start || {}, en = p.end || {};
      if (st.yardsToEndzone == null) continue;
      const sLos = 100 - st.yardsToEndzone;
      const eLos = en.yardsToEndzone == null ? sLos : 100 - en.yardsToEndzone;
      const type = (p.type && p.type.text) || '';
      // On any play where possession changes (a failed 4th down, a turnover), ESPN reports `end`
      // from the NEW offence's perspective, so end-minus-start is garbage (seen: -90, +36). Fall
      // back to parsing the yardage out of the play text, which stays offence-relative.
      const same = !!(st.team && en.team && st.team.id === en.team.id);
      const txt = p.text || '';
      let textGain = null;
      let m2 = txt.match(/for a loss of (\d+)/i); if (m2) textGain = -(+m2[1]);
      else if (/for no gain/i.test(txt)) textGain = 0;
      else { m2 = txt.match(/for (-?\d+) y(?:ar)?ds?/i); if (m2) textGain = +m2[1]; }
      if (INC.has(type)) textGain = 0;
      const isScrim = RUN.has(type) || CMP.has(type) || INC.has(type) || SACK.has(type);
      if (isScrim || type === 'Penalty') {
        if (startLos == null) startLos = sLos;
        if (same && eLos > maxLos) maxLos = eLos;
        if (sLos > maxLos) maxLos = sLos;
      }
      if (!isScrim) { if (p.isPenalty || type === 'Penalty') { const g = Math.round(eLos - sLos);
          if (g >= -25 && g <= 25) bump(o.penG, g); } continue; }
      const gain = same ? Math.round(eLos - sLos) : (textGain == null ? null : textGain);
      if (gain == null || gain < -30 || gain > 100) continue;
      const dn = st.down, dist = st.distance;
      const dbk = (dn >= 1 && dn <= 4) ? dbucket(dist) : null;
      // run/pass mix by situation — measured, so the engine stops guessing passProb
      if (dbk) { const mk = dn + "|" + dbk; const mx = o.mixD[mk] = o.mixD[mk] || [0, 0];
        if (RUN.has(type)) mx[0]++; else mx[1]++; }
      if (RUN.has(type)) { bump(o.runG, gain);
        if (dbk) bump(o.runGD[dbk] = o.runGD[dbk] || {}, gain);
        if (dn >= 1 && dn <= 4) { const k = dn + '|' + dbucket(dist); const a = o.runByDD[k] = o.runByDD[k] || [0, 0]; a[0]++; a[1] += gain; } }
      else if (CMP.has(type)) { bump(o.cmpG, gain);
        if (dbk) bump(o.cmpGD[dbk] = o.cmpGD[dbk] || {}, gain);
        if (dn >= 1 && dn <= 4) { const k = dn + '|' + dbucket(dist); const a = o.cmpByDD[k] = o.cmpByDD[k] || [0, 0]; a[0]++; a[1] += gain; } }
      else if (SACK.has(type)) bump(o.sackG, gain);
      // down conversion: did this snap produce a new set of downs (or a score)?
      if (dn === 3 || dn === 4) {

        const tgt = dn === 3 ? o.d3 : o.d4, k = dbucket(dist);
        const a = tgt[k] = tgt[k] || [0, 0]; a[0]++;
        // a conversion means the offence KEPT the ball and got the distance
        if (same && (gain >= dist || eLos >= 100)) a[1]++;
      }
    }
    if (startLos != null) { o.startSum += startLos; o.startN++; }
    if (maxLos >= 80 || res === 'TD') { o.rzTrips++; if (res === 'TD') o.rzTD++; else if (res === 'FG') o.rzFG++; }
    if (res === 'TD' || res === 'FG') o.scoreDrives++;
  }
  return o;
}

(async () => {
  const todo = GAMES.filter(g => !done[g.id]);
  console.log(`${GAMES.length} FBS-vs-FBS games, ${GAMES.length - todo.length} cached, ${todo.length} to fetch`);
  let i = 0, ok = 0, fail = 0; const t0 = Date.now();
  async function worker() {
    while (i < todo.length) {
      const g = todo[i++];
      const d = await get(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${g.id}`);
      const e = d ? extract(d) : null;
      if (e) { done[g.id] = e; ok++; } else fail++;
      if ((ok + fail) % 300 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`  ${ok + fail}/${todo.length}  ok=${ok} fail=${fail}  ${el.toFixed(0)}s  eta ${((el / (ok + fail)) * (todo.length - ok - fail)).toFixed(0)}s`);
        fs.writeFileSync(CACHE, JSON.stringify(done));
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(CACHE, JSON.stringify(done));
  console.log(`harvested ${ok} games (${fail} failed) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  /* ---------- merge ---------- */
  const M = { runG: {}, cmpG: {}, sackG: {}, penG: {}, d3: {}, d4: {}, runByDD: {}, cmpByDD: {}, runGD: {}, cmpGD: {}, mixD: {},
    drives: 0, rzTrips: 0, rzTD: 0, rzFG: 0, startSum: 0, startN: 0, byResult: {}, games: 0 };
  for (const id in done) { const o = done[id]; M.games++;
    for (const k of ['runG', 'cmpG', 'sackG', 'penG']) for (const g in o[k]) M[k][g] = (M[k][g] || 0) + o[k][g];
    for (const k of ['d3', 'd4']) for (const b in o[k]) { const a = M[k][b] = M[k][b] || [0, 0]; a[0] += o[k][b][0]; a[1] += o[k][b][1]; }
    for (const k of ['runByDD', 'cmpByDD']) for (const b in o[k]) { const a = M[k][b] = M[k][b] || [0, 0]; a[0] += o[k][b][0]; a[1] += o[k][b][1]; }
    for (const bk in o.mixD) { const a = M.mixD[bk] = M.mixD[bk] || [0, 0]; a[0] += o.mixD[bk][0]; a[1] += o.mixD[bk][1]; }
    for (const k of ['runGD', 'cmpGD']) for (const bk in o[k]) { const h = M[k][bk] = M[k][bk] || {}; for (const g in o[k][bk]) h[g] = (h[g] || 0) + o[k][bk][g]; }
    for (const b in o.byResult) { const a = M.byResult[b] = M.byResult[b] || [0, 0, 0];
      a[0] += o.byResult[b][0]; a[1] += o.byResult[b][1]; a[2] += o.byResult[b][2]; }
    M.drives += o.drives; M.rzTrips += o.rzTrips; M.rzTD += o.rzTD; M.rzFG += o.rzFG;
    M.startSum += o.startSum; M.startN += o.startN;
  }
  fs.writeFileSync(OUT, JSON.stringify(M));

  /* ---------- report ---------- */
  const stats = h => { let n = 0, s = 0; const keys = Object.keys(h).map(Number).sort((a, b) => a - b);
    keys.forEach(k => { n += h[k]; s += k * h[k]; });
    const mean = s / n; let acc = 0, med = 0, p10 = 0, p90 = 0;
    for (const k of keys) { const before = acc; acc += h[k];
      if (before < n * 0.10 && acc >= n * 0.10) p10 = k;
      if (before < n * 0.50 && acc >= n * 0.50) med = k;
      if (before < n * 0.90 && acc >= n * 0.90) p90 = k; }
    const share = (lo, hi) => keys.filter(k => k >= lo && k <= hi).reduce((a, k) => a + h[k], 0) / n * 100;
    return { n, mean, med, p10, p90, loss: share(-99, -1), zero: share(0, 0), stuff: share(-99, 0),
      s1_3: share(1, 3), s4_9: share(4, 9), s10_19: share(10, 19), s20p: share(20, 999) };
  };
  const pr = (label, h) => { const s = stats(h);
    console.log(`  ${label.padEnd(12)} n=${String(s.n).padStart(7)}  mean ${s.mean.toFixed(2).padStart(6)}  median ${String(s.med).padStart(3)}  p10 ${String(s.p10).padStart(4)}  p90 ${String(s.p90).padStart(3)}  |  <=0 ${s.stuff.toFixed(1).padStart(5)}%  1-3 ${s.s1_3.toFixed(1).padStart(5)}%  4-9 ${s.s4_9.toFixed(1).padStart(5)}%  10-19 ${s.s10_19.toFixed(1).padStart(5)}%  20+ ${s.s20p.toFixed(1).padStart(5)}%`); };
  console.log('\n' + '='.repeat(132));
  console.log(`REAL PLAY-LEVEL DISTRIBUTIONS — ${M.games} FBS-vs-FBS games`);
  console.log('='.repeat(132));
  pr('rush', M.runG); pr('completion', M.cmpG); pr('sack', M.sackG); pr('penalty', M.penG);
  console.log('\n  3rd down by distance:');
  for (const b of ['1', '2-3', '4-6', '7-10', '11+']) if (M.d3[b]) console.log(`    ${b.padEnd(5)} ${String(M.d3[b][0]).padStart(6)} att  ${(M.d3[b][1] / M.d3[b][0] * 100).toFixed(1)}% converted`);
  console.log('  4th down by distance:');
  for (const b of ['1', '2-3', '4-6', '7-10', '11+']) if (M.d4[b]) console.log(`    ${b.padEnd(5)} ${String(M.d4[b][0]).padStart(6)} att  ${(M.d4[b][1] / M.d4[b][0] * 100).toFixed(1)}% converted`);
  console.log('\n  rush yards by down & distance (mean):');
  for (const dn of [1, 2, 3]) { let row = `    ${dn}st/nd/rd  `.slice(0, 12);
    for (const b of ['1', '2-3', '4-6', '7-10', '11+']) { const a = M.runByDD[dn + '|' + b];
      row += `${b}:${a ? (a[1] / a[0]).toFixed(2) : '—'}`.padEnd(12); } console.log(row); }
  console.log('\n  drive shape:');
  console.log(`    avg start        own ${(M.startSum / M.startN).toFixed(1)}`);
  console.log(`    red-zone trips   ${(M.rzTrips / M.games / 2).toFixed(2)} per team-game  (${(M.rzTrips / M.drives * 100).toFixed(1)}% of drives)`);
  console.log(`    TD given a trip  ${(M.rzTD / M.rzTrips * 100).toFixed(1)}%      FG given a trip ${(M.rzFG / M.rzTrips * 100).toFixed(1)}%`);
  console.log('\n  yards + plays by drive result:');
  const tot = Object.values(M.byResult).reduce((a, x) => a + x[0], 0);
  Object.entries(M.byResult).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10).forEach(([k, v]) =>
    console.log(`    ${k.padEnd(22)} ${(v[0] / tot * 100).toFixed(1).padStart(5)}% of drives   ${(v[1] / v[0]).toFixed(1).padStart(5)} yds   ${(v[2] / v[0]).toFixed(2).padStart(5)} plays`));
  const nonScore = Object.entries(M.byResult).filter(([k]) => k !== 'TD' && k !== 'FG');
  const nsN = nonScore.reduce((a, x) => a + x[1][0], 0), nsY = nonScore.reduce((a, x) => a + x[1][1], 0);
  console.log(`\n    NON-SCORING drives: ${(nsN / tot * 100).toFixed(1)}% of drives, ${(nsY / nsN).toFixed(1)} yards each`);
})();

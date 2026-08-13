/* Step 16 — what actually happens in BIG MOMENTS.

   Two questions, because they pull in opposite directions for design:

   (a) IS CLUTCH A TRAIT? Answered off the cached game index alone — a team's record in one-score
       games, year over year, against its record in blowouts. If close-game success repeated, a
       persistent clutch rating would be justified. (Spoiler: it does not.)

   (b) DOES THE SITUATION CHANGE THE FOOTBALL? Answered off the play-by-play — completion rate,
       yards, sacks, turnovers, 3rd-down conversion and field-goal accuracy in late-and-close
       situations vs everywhere else, split by whether the offense is ahead or behind. Whatever
       moves here is a real, mean-level effect a sim is allowed to model.

   Output: clutch-profile.json + clutch-report.txt.  Resumable via clutch-cache.json. */
const fs = require('fs');
const IDX = require(__dirname + '/index.json');
const FBS = new Set(['1', '4', '5', '8', '9', '12', '15', '17', '18', '37', '151']);
const CACHE = __dirname + '/clutch-cache.json';
const OUT = __dirname + '/clutch-profile.json';
const REPORT = __dirname + '/clutch-report.txt';
const CONC = 8;
const SKIP_FETCH = process.argv.includes('--no-fetch');

const out = [], say = s => { out.push(s); console.log(s); };
const pct = (a, b) => b ? (a / b * 100) : 0;
const f = (x, d = 2) => (x == null || !isFinite(x) ? '—' : x.toFixed(d));
const corr = a => { if (a.length < 3) return NaN;
  const mx = a.reduce((s, p) => s + p[0], 0) / a.length, my = a.reduce((s, p) => s + p[1], 0) / a.length;
  let sxy = 0, sx = 0, sy = 0; for (const [x, y] of a) { sxy += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2; }
  return sxy / Math.sqrt(sx * sy); };

const GAMES = IDX.filter(g => FBS.has(String(g.hc)) && FBS.has(String(g.ac)) && g.hs != null);

/* ============================================================ *
 * (a) IS CLUTCH A TRAIT?  — no network needed
 * ============================================================ */
const ts = {};
for (const g of GAMES) { const m = g.hs - g.as;
  for (const [tid, diff] of [[g.hid, m], [g.aid, -m]]) {
    const k = tid + '|' + g.year, t = ts[k] = ts[k] || { n: 0, w: 0, cn: 0, cw: 0, bn: 0, bw: 0 };
    t.n++; if (diff > 0) t.w++;
    if (Math.abs(m) <= 8) { t.cn++; if (diff > 0) t.cw++; } else { t.bn++; if (diff > 0) t.bw++; }
  } }
const seasons = Object.values(ts).filter(t => t.n >= 8);
const pAll = [], pClose = [], pBlow = [];
for (const k in ts) { const [tid, yr] = k.split('|'), a = ts[k], b = ts[tid + '|' + (+yr + 1)]; if (!b) continue;
  if (a.n >= 8 && b.n >= 8) pAll.push([a.w / a.n, b.w / b.n]);
  if (a.cn >= 4 && b.cn >= 4) pClose.push([a.cw / a.cn, b.cw / b.cn]);
  if (a.bn >= 4 && b.bn >= 4) pBlow.push([a.bw / a.bn, b.bw / b.bn]); }
const within = seasons.filter(t => t.cn >= 4 && t.bn >= 4).map(t => [t.bw / t.bn, t.cw / t.cn]);

say('='.repeat(104));
say(`BIG MOMENTS, MEASURED — ${GAMES.length} FBS-vs-FBS games, 2021–2025`);
say('='.repeat(104));
say('\n1. IS "CLUTCH" A REPEATABLE TEAM TRAIT?');
say(`   ${f(pct(seasons.reduce((s, t) => s + t.cn, 0), seasons.reduce((s, t) => s + t.n, 0)), 1)}% of all games are decided by 8 or fewer.`);
say('\n   year-over-year repeatability (season N → N+1):');
say(`     overall win%           r = ${f(corr(pAll), 3)}   (n=${pAll.length})`);
say(`     blowout win%  (>8)     r = ${f(corr(pBlow), 3)}   (n=${pBlow.length})`);
say(`     ONE-SCORE win% (≤8)    r = ${f(corr(pClose), 3)}   (n=${pClose.length})`);
say(`\n   within one season, blowout win% vs one-score win%:  r = ${f(corr(within), 3)}  (n=${within.length})`);
say('   → being good repeats. Winning close games does not. There is no "clutch team" in the data;');
say('     a model that lets a rating decide one-score games is modelling something that is not there.');

/* ============================================================ *
 * (b) DOES THE SITUATION CHANGE THE FOOTBALL? — play-by-play
 * ============================================================ */
const RUN = new Set(['Rush', 'Rushing Touchdown']);
const CMP = new Set(['Pass Reception', 'Passing Touchdown']);
const INC = new Set(['Pass Incompletion']);
const SACK = new Set(['Sack']);
const INT = new Set(['Interception Return', 'Interception Return Touchdown', 'Pass Interception Return']);
const FUM = new Set(['Fumble Recovery (Opponent)', 'Fumble Return Touchdown']);

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) return await r.json(); if (r.status === 404) return null; } catch (e) {}
    await new Promise(s => setTimeout(s, 400 * (i + 1)));
  }
  return null;
}

// bucket key: clutch state × whether the offense is ahead/behind
// `dd` holds the same tallies split by down|distance, so the clutch-vs-normal comparison can be
// STANDARDIZED to a common situation mix. Raw clutch splits are badly confounded: a trailing team
// throws on 3rd-and-long far more often, and the sim already models down/distance itself, so
// applying a raw delta on top would double-count the mix.
const blank = () => ({ pa: 0, pc: 0, py: 0, sk: 0, int: 0, ra: 0, ry: 0, fum: 0, d3a: 0, d3c: 0, fga: 0, fgm: 0, fgd: {}, dd: {}, plays: 0 });
const dbucket = d => d <= 1 ? '1' : d <= 3 ? '2-3' : d <= 6 ? '4-6' : d <= 10 ? '7-10' : '11+';
function extractClutch(d) {
  const drives = (d.drives && d.drives.previous) || [];
  if (!drives.length) return null;
  const comp = (d.header && d.header.competitions && d.header.competitions[0]) || {};
  const homeId = ((comp.competitors || []).find(c => c.homeAway === 'home') || {}).id;
  if (!homeId) return null;
  const B = { norm: blank(), clutch: blank(), crunch: blank(), lead: blank(), trail: blank() };
  for (const dr of drives) for (const p of dr.plays || []) {
    const st = p.start || {}; if (!st.team) continue;
    const per = (p.period && p.period.number) || 0; if (!per) continue;
    const cs = String((p.clock && p.clock.displayValue) || '').split(':');
    const secsInPer = cs.length === 2 ? (+cs[0] * 60 + +cs[1]) : 0;
    const left = per >= 5 ? 0 : Math.max(0, (4 - per) * 900 + secsInPer);   // seconds left in regulation
    const offIsHome = String(st.team.id) === String(homeId);
    const hs = +p.homeScore || 0, as = +p.awayScore || 0;
    const diff = offIsHome ? hs - as : as - hs;                              // offense's margin (post-play)
    const type = (p.type && p.type.text) || '';
    const txt = p.text || '';
    const isFG = /Field Goal/i.test(type);
    const isScrim = RUN.has(type) || CMP.has(type) || INC.has(type) || SACK.has(type) || INT.has(type) || FUM.has(type);
    if (!isScrim && !isFG) continue;
    const close = Math.abs(diff) <= 8;
    const tgt = [B.norm];
    if (per >= 4 && close) { tgt.length = 0; tgt.push(B.clutch); if (left <= 300 || per >= 5) tgt.push(B.crunch);
      tgt.push(diff >= 0 ? B.lead : B.trail); }
    for (const b of tgt) {
      b.plays++;
      if (isFG) { const m = txt.match(/(\d+)\s*Y(?:d|ard)/i); const dist = m ? +m[1] : null;
        b.fga++; const good = /Good/i.test(type) || /is GOOD/i.test(txt); if (good) b.fgm++;
        if (dist) { const k = dist <= 29 ? '<30' : dist <= 39 ? '30s' : dist <= 49 ? '40s' : '50+';
          const a = b.fgd[k] = b.fgd[k] || [0, 0]; a[0]++; if (good) a[1]++; }
        continue; }
      let gain = null; const m2 = txt.match(/for a loss of (\d+)/i);
      if (m2) gain = -(+m2[1]); else if (/for no gain/i.test(txt)) gain = 0;
      else { const m3 = txt.match(/for (-?\d+) y(?:ar)?ds?/i); if (m3) gain = +m3[1]; }
      if (st.down === 3) { b.d3a++; if (gain != null && st.distance != null && gain >= st.distance) b.d3c++; }
      // [pa, pc, py, ra, ry] in this exact down|distance cell
      const cell = (st.down >= 1 && st.down <= 4 && st.distance != null)
        ? (b.dd[st.down + '|' + dbucket(st.distance)] = b.dd[st.down + '|' + dbucket(st.distance)] || [0, 0, 0, 0, 0]) : null;
      if (RUN.has(type)) { b.ra++; if (gain != null) b.ry += gain; if (cell) { cell[3]++; if (gain != null) cell[4] += gain; } }
      else if (CMP.has(type)) { b.pa++; b.pc++; if (gain != null) b.py += gain; if (cell) { cell[0]++; cell[1]++; if (gain != null) cell[2] += gain; } }
      else if (INC.has(type)) { b.pa++; if (cell) cell[0]++; }
      else if (SACK.has(type)) b.sk++;
      else if (INT.has(type)) { b.pa++; b.int++; if (cell) cell[0]++; }
      else if (FUM.has(type)) b.fum++;
    }
  }
  return B;
}

(async () => {
  let done = {};
  if (fs.existsSync(CACHE)) { try { done = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { done = {}; } }
  const todo = SKIP_FETCH ? [] : GAMES.filter(g => !done[g.id]);
  if (todo.length) {
    console.log(`\n[pbp] ${GAMES.length} games, ${GAMES.length - todo.length} cached, ${todo.length} to fetch`);
    let i = 0, ok = 0, fail = 0; const t0 = Date.now();
    async function worker() {
      while (i < todo.length) { const g = todo[i++];
        const d = await get(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${g.id}`);
        const e = d ? extractClutch(d) : null;
        if (e) { done[g.id] = e; ok++; } else fail++;
        if ((ok + fail) % 400 === 0) { const el = (Date.now() - t0) / 1000;
          console.log(`  ${ok + fail}/${todo.length}  ok=${ok} fail=${fail}  ${el.toFixed(0)}s  eta ${((el / (ok + fail)) * (todo.length - ok - fail)).toFixed(0)}s`);
          fs.writeFileSync(CACHE, JSON.stringify(done)); } }
    }
    await Promise.all(Array.from({ length: CONC }, worker));
    fs.writeFileSync(CACHE, JSON.stringify(done));
    console.log(`[pbp] harvested ${ok} games (${fail} failed) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  const ids = Object.keys(done);
  if (!ids.length) { fs.writeFileSync(REPORT, out.join('\n')); return; }

  const M = { norm: blank(), clutch: blank(), crunch: blank(), lead: blank(), trail: blank() }, G = ids.length;
  for (const id of ids) for (const k in M) { const s = done[id][k]; if (!s) continue;
    for (const f2 in M[k]) {
      if (f2 === 'fgd') { for (const b in (s.fgd || {})) { const a = M[k].fgd[b] = M[k].fgd[b] || [0, 0]; a[0] += s.fgd[b][0]; a[1] += s.fgd[b][1]; } }
      else if (f2 === 'dd') { for (const b in (s.dd || {})) { const a = M[k].dd[b] = M[k].dd[b] || [0, 0, 0, 0, 0];
        for (let z = 0; z < 5; z++) a[z] += s.dd[b][z]; } }
      else M[k][f2] += s[f2] || 0; } }

  const line = (lbl, b) => {
    const dropbacks = b.pa + b.sk;
    say(`   ${lbl.padEnd(22)} ${String(b.plays).padStart(7)}  ${f(pct(b.pc, b.pa), 1).padStart(6)}%  ${f(b.py / b.pa).padStart(6)}  ${f(pct(b.sk, dropbacks), 2).padStart(6)}%  ${f(pct(b.int, b.pa), 2).padStart(6)}%  ${f(b.ry / b.ra).padStart(6)}  ${f(pct(b.fum, b.ra), 2).padStart(6)}%  ${f(pct(b.d3c, b.d3a), 1).padStart(6)}%  ${f(pct(b.fgm, b.fga), 1).padStart(6)}%`);
  };
  say('\n2. DOES THE SITUATION CHANGE THE FOOTBALL?');
  say(`   ${G} games of play-by-play. "clutch" = Q4+ within one score; "crunch" = that, last 5 min or OT.`);
  say(`\n   ${'bucket'.padEnd(22)} ${'plays'.padStart(7)}  ${'cmp%'.padStart(7)} ${'Y/A'.padStart(6)} ${'sack%'.padStart(7)} ${'int%'.padStart(7)} ${'Y/C'.padStart(6)} ${'fum%'.padStart(7)} ${'3rd%'.padStart(7)} ${'FG%'.padStart(7)}`);
  line('everywhere else', M.norm); line('clutch (Q4, ≤8)', M.clutch); line('crunch (last 5)', M.crunch);
  line('  …offense ahead', M.lead); line('  …offense behind', M.trail);

  const d = (a, b, k) => f(k(a) - k(b), 2);
  say('\n   clutch minus normal:');
  say(`     completion %   ${d(M.clutch, M.norm, b => pct(b.pc, b.pa))}`);
  say(`     yards/attempt  ${d(M.clutch, M.norm, b => b.py / b.pa)}`);
  say(`     sack rate      ${d(M.clutch, M.norm, b => pct(b.sk, b.pa + b.sk))}`);
  say(`     INT rate       ${d(M.clutch, M.norm, b => pct(b.int, b.pa))}`);
  say(`     yards/carry    ${d(M.clutch, M.norm, b => b.ry / b.ra)}`);
  say(`     3rd-down conv  ${d(M.clutch, M.norm, b => pct(b.d3c, b.d3a))}`);
  say(`     field goal %   ${d(M.clutch, M.norm, b => pct(b.fgm, b.fga))}`);
  // STANDARDIZED comparison: re-weight each clutch bucket's per-cell rates by the NORMAL bucket's
  // down/distance mix, so what's left is the effect of the moment rather than of the situation.
  const std = b => {
    let paW = 0, pcW = 0, pyW = 0, raW = 0, ryW = 0, wP = 0, wR = 0;
    for (const k in M.norm.dd) { const n = M.norm.dd[k], c = b.dd[k]; if (!c) continue;
      if (n[0] >= 200 && c[0] >= 25) { wP += n[0]; pcW += n[0] * (c[1] / c[0]); pyW += n[0] * (c[2] / c[0]); paW += n[0]; }
      if (n[3] >= 200 && c[3] >= 25) { wR += n[3]; ryW += n[3] * (c[4] / c[3]); raW += n[3]; } }
    return { cmp: pcW / wP * 100, ya: pyW / wP, yc: ryW / wR, covP: wP, covR: wR };
  };
  const sN = std(M.norm), sC = std(M.clutch), sX = std(M.crunch);
  say('\n   STANDARDIZED to the normal down/distance mix — the confound removed:');
  say(`     ${'bucket'.padEnd(22)} ${'cmp%'.padStart(8)} ${'Y/A'.padStart(8)} ${'Y/C'.padStart(8)}`);
  say(`     ${'everywhere else'.padEnd(22)} ${f(sN.cmp, 1).padStart(8)} ${f(sN.ya).padStart(8)} ${f(sN.yc).padStart(8)}`);
  say(`     ${'clutch (Q4, ≤8)'.padEnd(22)} ${f(sC.cmp, 1).padStart(8)} ${f(sC.ya).padStart(8)} ${f(sC.yc).padStart(8)}`);
  say(`     ${'crunch (last 5)'.padEnd(22)} ${f(sX.cmp, 1).padStart(8)} ${f(sX.ya).padStart(8)} ${f(sX.yc).padStart(8)}`);
  say(`     clutch − normal:       ${f(sC.cmp - sN.cmp, 2).padStart(8)} ${f(sC.ya - sN.ya, 2).padStart(8)} ${f(sC.yc - sN.yc, 2).padStart(8)}`);
  say(`     crunch − normal:       ${f(sX.cmp - sN.cmp, 2).padStart(8)} ${f(sX.ya - sN.ya, 2).padStart(8)} ${f(sX.yc - sN.yc, 2).padStart(8)}`);
  say(`     (raw, unstandardized:  ${f(pct(M.clutch.pc, M.clutch.pa) - pct(M.norm.pc, M.norm.pa), 2).padStart(8)} ${f(M.clutch.py / M.clutch.pa - M.norm.py / M.norm.pa, 2).padStart(8)} ${f(M.clutch.ry / M.clutch.ra - M.norm.ry / M.norm.ra, 2).padStart(8)} )`);
  say('\n   field goals by distance (make %):');
  say(`     ${'bucket'.padEnd(22)} ${'<30'.padStart(12)} ${'30s'.padStart(12)} ${'40s'.padStart(12)} ${'50+'.padStart(12)}`);
  for (const [lbl, b] of [['everywhere else', M.norm], ['clutch (Q4, ≤8)', M.clutch], ['crunch (last 5)', M.crunch]]) {
    let row = `     ${lbl.padEnd(22)}`;
    for (const k of ['<30', '30s', '40s', '50+']) { const a = b.fgd[k];
      row += (a && a[0] >= 20 ? `${f(pct(a[1], a[0]), 1)}% (${a[0]})` : '—').padStart(13); }
    say(row);
  }
  fs.writeFileSync(OUT, JSON.stringify({ trait: { all: corr(pAll), close: corr(pClose), blow: corr(pBlow), within: corr(within) }, buckets: M, games: G }, null, 1));
  fs.writeFileSync(REPORT, out.join('\n'));
  console.log(`\nwrote ${OUT} + ${REPORT}`);
})();

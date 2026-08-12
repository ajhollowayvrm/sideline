/* Step 2 — pull each indexed game's ESPN summary and extract compact per-team metrics.
   Caches to games.json (resumable: re-running only fetches what's missing). */
const fs = require('fs');
const IDX = require(__dirname + '/index.json');
const OUT = __dirname + '/games.json';
const CONC = 8;

let done = {};
if (fs.existsSync(OUT)) { try { done = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { done = {}; } }

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch (e) { /* retry */ }
    await new Promise(s => setTimeout(s, 400 * (i + 1)));
  }
  return null;
}

const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const pair = v => { const m = String(v).match(/(-?\d+)\s*[-/]\s*(-?\d+)/); return m ? [num(m[1]), num(m[2])] : [0, 0]; };
const mmss = v => { const m = String(v).match(/(\d+):(\d+)/); return m ? num(m[1]) * 60 + num(m[2]) : 0; };

function extract(d, g) {
  const bs = d.boxscore; if (!bs || !bs.teams || bs.teams.length !== 2) return null;
  const sides = {};
  for (const t of bs.teams) {
    const S = {}; (t.statistics || []).forEach(s => S[s.name] = s.displayValue);
    const [td3, ta3] = pair(S.thirdDownEff), [td4, ta4] = pair(S.fourthDownEff);
    const [pn, py] = pair(S.totalPenaltiesYards), [cmp, att] = pair(S.completionAttempts);
    sides[t.team.id] = {
      fd: num(S.firstDowns), yds: num(S.totalYards),
      pyds: num(S.netPassingYards), cmp, att,
      ryds: num(S.rushingYards), ratt: num(S.rushingAttempts),
      d3c: td3, d3a: ta3, d4c: td4, d4a: ta4,
      pen: pn, peny: py,
      to: num(S.turnovers), fl: num(S.fumblesLost), int: num(S.interceptions),
      top: mmss(S.possessionTime),
    };
  }
  // player-category totals (sacks, punting, returns, kicking)
  for (const t of (bs.players || [])) {
    const s = sides[t.team.id]; if (!s) continue;
    const cat = {}; (t.statistics || []).forEach(c => cat[c.name] = { labels: c.labels || [], totals: c.totals || [] });
    const gv = (c, label) => { const k = cat[c]; if (!k) return 0; const i = k.labels.indexOf(label); return i < 0 ? 0 : num(k.totals[i]); };
    const gs = (c, label) => { const k = cat[c]; if (!k) return ''; const i = k.labels.indexOf(label); return i < 0 ? '' : String(k.totals[i] || ''); };
    s.sk = gv('defensive', 'SACKS');
    s.punts = gv('punting', 'NO'); s.puntYds = gv('punting', 'YDS'); s.puntIn20 = gv('punting', 'In 20'); s.puntTB = gv('punting', 'TB');
    const [fgm, fga] = pair(gs('kicking', 'FG')); s.fgm = fgm; s.fga = fga;
    const [xpm, xpa] = pair(gs('kicking', 'XP')); s.xpm = xpm; s.xpa = xpa;
    s.kr = gv('kickReturns', 'NO'); s.krYds = gv('kickReturns', 'YDS'); s.krTD = gv('kickReturns', 'TD');
    s.pr = gv('puntReturns', 'NO'); s.prYds = gv('puntReturns', 'YDS'); s.prTD = gv('puntReturns', 'TD');
    s.intTD = gv('interceptions', 'TD');
  }
  // drive outcomes per team
  const drv = {};
  for (const dr of ((d.drives && d.drives.previous) || [])) {
    const tid = dr.team && dr.team.id; if (!tid || !sides[tid]) continue;
    const o = drv[tid] = drv[tid] || { n: 0, plays: 0, yds: 0, sec: 0, res: {} };
    o.n++; o.plays += num(dr.offensivePlays); o.yds += num(dr.yards);
    o.sec += mmss(dr.timeElapsed && dr.timeElapsed.displayValue);
    const key = String(dr.result || 'OTHER').toUpperCase();
    o.res[key] = (o.res[key] || 0) + 1;
  }
  for (const tid in sides) if (drv[tid]) sides[tid].drv = drv[tid];
  // scoring plays → 2pt conversions, safeties, defensive/ST TDs
  let two = 0, safety = 0, defTD = 0, stTD = 0;
  for (const sp of (d.scoringPlays || [])) {
    const txt = String(sp.text || '').toLowerCase();
    const ab = (sp.type && sp.type.abbreviation) || '';
    if (/two-point|two point/.test(txt)) two++;
    if (ab === 'SF' || /safety/.test(txt)) safety++;
    if (/interception return|fumble return|blocked .* return|pick.?six/.test(txt)) defTD++;
    if (/kickoff return|punt return/.test(txt)) stTD++;
  }
  // OT: any competitor with >4 linescore periods
  const comps = (d.header && d.header.competitions && d.header.competitions[0] && d.header.competitions[0].competitors) || [];
  const ot = comps.some(c => (c.linescores || []).length > 4);
  const qtr = {};
  comps.forEach(c => { qtr[c.id] = (c.linescores || []).map(l => num(l.displayValue !== undefined ? l.displayValue : l.value)); });
  return { h: sides[g.hid] || null, a: sides[g.aid] || null, two, safety, defTD, stTD, ot, qtr };
}

(async () => {
  const todo = IDX.filter(g => !done[g.id]);
  console.log(`${IDX.length} indexed, ${IDX.length - todo.length} cached, ${todo.length} to fetch`);
  let i = 0, ok = 0, fail = 0, t0 = Date.now();
  async function worker() {
    while (i < todo.length) {
      const g = todo[i++];
      const d = await get(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${g.id}`);
      if (d) { const e = extract(d, g); if (e && e.h && e.a) { done[g.id] = e; ok++; } else fail++; }
      else fail++;
      if ((ok + fail) % 200 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`  ${ok + fail}/${todo.length}  ok=${ok} fail=${fail}  ${el.toFixed(0)}s  eta ${((el / (ok + fail)) * (todo.length - ok - fail)).toFixed(0)}s`);
        fs.writeFileSync(OUT, JSON.stringify(done));
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(OUT, JSON.stringify(done));
  console.log(`\nharvested ${ok} games (${fail} failed) in ${((Date.now() - t0) / 1000).toFixed(0)}s → games.json`);
})();

/* Step 10 — fit the possession-model constants.
   The parameters are coupled (raising run efficiency lengthens drives, which lowers the drive
   count, which changes points AND variance), so one-at-a-time tuning converges badly. This does
   coordinate descent with random restarts over the PM block, scoring against the real targets.

   Writes the winning block to tools/cfb-data/fit-result.txt. Does NOT edit index.html. */
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
const ENGINE = grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ===');
const PM_BLOCK = grab('// PM-START', '// PM-END');
const FORM_LINE = "const form={[home.id]:(r()+r()+r()-1.5)*8, [away.id]:(r()+r()+r()-1.5)*8};";
if (ENGINE.indexOf(PM_BLOCK) < 0 || ENGINE.indexOf(FORM_LINE) < 0) { console.error('markers missing'); process.exit(2); }

/* ---------- parameters being fitted ---------- */
//            name        lo     hi    step
const SPEC = [
  ['runP1',   0.28,  0.52, 0.02],   // share of carries in the "stuff" tier
  ['runHi1',  1.0,   4.0,  0.25],   // top of the stuff tier
  ['runHi2',  7.0,   11.0, 0.25],   // top of the normal tier
  ['runHi3',  26,    44,   1.0],    // top of the explosive tier
  ['recP1',   0.24,  0.44, 0.02],
  ['recHi1',  4.0,   8.0,  0.25],
  ['recHi2', 12.0,  18.0,  0.25],
  ['recHi3',  40,    62,   1.0],
  ['passBase',0.28,  0.44, 0.01],
  ['cmpBase', 0.57,  0.68, 0.005],
  ['driveForm',0,    7.0,  0.25],
  ['secScale',0.86,  1.10, 0.02],   // scales every per-snap clock charge
  ['formMult',0,     8.0,  0.5],    // the per-game hot/cold term
  ['rzComp', -0.12,  0.0,  0.01],
  ['rzTop',   0.15,  0.75, 0.05],
  ['fgMax',   46,    56,   1.0],
];
const START = { runP1:0.40, runHi1:2.5, runHi2:8.5, runHi3:34, recP1:0.35, recHi1:6, recHi2:15,
  recHi3:50, passBase:0.35, cmpBase:0.615, driveForm:5, secScale:1.0, formMult:8, rzComp:-0.05,
  rzTop:0.32, fgMax:52 };

function pmText(v) {
  const sr = Math.round(32 * v.secScale), sp = Math.round(30 * v.secScale);
  const sq = Math.round(13 * v.secScale), sk = Math.round(32 * v.secScale);
  return `const PM={
  runTier:[${v.runP1.toFixed(2)},-3,${v.runHi1}, 0.89,${v.runHi1},${v.runHi2}, ${v.runHi2},${v.runHi3}],
  recTier:[${v.recP1.toFixed(2)},-2,${v.recHi1}, 0.80,${v.recHi1},${v.recHi2}, ${v.recHi2},${v.recHi3}],
  passBase:${v.passBase.toFixed(3)},
  cmpBase:${v.cmpBase.toFixed(4)},
  fgMax:${Math.round(v.fgMax)},
  intRate:0.068,
  fumRate:0.0125, sackFumP:0.075,
  rzLos:80, rzComp:${v.rzComp.toFixed(3)}, rzTop:${v.rzTop.toFixed(2)},
  driveForm:${v.driveForm.toFixed(2)},
  secRun:${sr}, secPass:${sp}, secQuick:${sq}, secIncomp:6, secSack:${sk},
};`;
}
function srcFor(v) {
  let s = ENGINE.replace(PM_BLOCK, '// PM-START\n' + pmText(v) + '\n');
  s = s.replace(FORM_LINE, FORM_LINE.split('*8').join('*' + v.formMult));
  return s;
}

/* ---------- world + slate (subsampled for search speed) ---------- */
const POS = [["QB","off",4],["RB","off",5],["WR","off",11],["TE","off",5],["OT","off",7],["OG","off",6],
["C","off",3],["DE","def",6],["DT","def",6],["LB","def",10],["CB","def",9],["S","def",8],["K","st",2],["P","st",2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
const world = (() => { const r = rng(0x5eed), teams = [];
  for (let i = 0; i < 134; i++) {
    const prestige = clamp(Math.round(35 + ri(r,-15,15) + (i<16?25:i<40?12:0)), 20, 98);
    const out = [];
    POS.forEach(([code,,n]) => { for (let k=0;k<n;k++) out.push({ id:'p'+Math.floor(r()*1e9).toString(36), pos:code, ov:clamp(Math.round(prestige*0.55+ri(r,-9,9)+30),48,99), so:0 }); });
    const byPos = {}; out.forEach(p => (byPos[p.pos]=byPos[p.pos]||[]).push(p));
    Object.values(byPos).forEach(arr => { arr.sort((a,b)=>b.ov-a.ov);
      arr.forEach((p,i2)=>{ if(i2>=2) p.ov=clamp(Math.round(p.ov-Math.min(2+(i2-2)*2.6,26)),44,99); p.so=i2; }); });
    const grp = s => out.filter(p => sideOf[p.pos]===s);
    const avgTop = (a,k) => { const s=[...a].sort((x,y)=>y.ov-x.ov).slice(0,k); return Math.round(s.reduce((t,p)=>t+p.ov,0)/s.length); };
    teams.push({ id:'t'+i, abbr:'T'+i, prestige, roster:out, ratings:{off:avgTop(grp('off'),11), def:avgTop(grp('def'),11)} });
  } return teams; })();
const FULL = [];
for (let i = 0; i < world.length; i++) for (let d = 1; d <= 15; d++)
  FULL.push({ id:'g'+i+'_'+d, home:world[i], away:world[(i+d)%world.length] });
// Search slate: a subset of TEAMS, not of games. Subsampling games leaves each team ~10 results
// to fit the retrodictive rating on, which then explains its own small sample almost perfectly —
// residual SD and the upset rate collapse, the variance metrics go invisible to the fitter, and it
// happily spends the slack elsewhere. Keeping whole teams preserves 30 games/team, so the rating is
// as well-constrained as on the full slate and SD/blow/midUps mean the same thing in both.
// stratified, not the first N — the world generator front-loads the elite tier (teams 0-15 get
// +25 prestige, 16-39 get +12), so a head slice is 27% elite against the full world's 12% and would
// hand the fitter a different mismatch distribution than the one it is being scored against.
const SUB = world.filter((_, i) => i % 2 === 0);
const SEARCH = [];
for (let i = 0; i < SUB.length; i++) for (let d = 1; d <= 15; d++)
  SEARCH.push({ id: 's' + i + '_' + d, home: SUB[i], away: SUB[(i + d) % SUB.length] });

const T = { pts:26.9, plays:67.5, ypp:5.67, att:31.2, cmpPct:61.1, ypa:7.29, ratt:34.2, ypc:4.92,
  fd:20.2, d3:39.2, d4a:1.94, punts:4.32, fga:1.58, drives:11.8, pldr:5.75, ppd:2.28,
  dTD:26.3, dPUNT:35.3, dDOWNS:7.2, dEND:6.5, sd:13.26, blow:5.8, midUps:9.5, rzTD:61, ydPerPt:14.2 };
// weights — points, drive structure and the upset rate are what this phase exists to fix
const W = { pts:3, plays:1, ypp:1, att:1, cmpPct:1, ypa:1, ratt:1, ypc:2, fd:1, d3:2, d4a:1,
  punts:1.5, fga:1, drives:2, pldr:2, ppd:2, dTD:2, dPUNT:1.5, dDOWNS:1, dEND:1,
  sd:3, blow:2, midUps:2, rzTD:2, ydPerPt:2 };

function evaluate(v, slate) {
  let simEngine;
  try { simEngine = new Function('rng','ri','clamp','pick','compVal','compDraw','compClutch','schemeTendency',
    srcFor(v) + '\nreturn simEngine;')(rng,ri,clamp,pick,compVal,compDraw,compClutch,schemeTendency); }
  catch (e) { return { err: 1e9 }; }
  const A = { pts:0,pAtt:0,pCmp:0,pYds:0,rAtt:0,rYds:0,skYds:0,sk:0,fd:0,d3a:0,d3c:0,d4a:0,int:0,fum:0,
    punts:0,fga:0,fgm:0,drives:0,dTD:0,dFG:0,dPUNT:0,dDOWNS:0,dTO:0,dMISS:0,dEND:0,rz:0,rzTD:0 };
  const rows = [];
  for (const g of slate) {
    let res; try { res = simEngine(g.home, g.away, (hashStr(g.id)^0x5ca1ab1e)>>>0, { log:true }); }
    catch (e) { return { err: 1e9 }; }
    A.pts += res.hs + res.as;
    for (const t of [g.home, g.away]) { const ids = new Set(t.roster.map(p=>p.id));
      for (const pid in res.box) { if(!ids.has(pid)) continue; const b = res.box[pid];
        A.pAtt+=b.pAtt||0; A.pCmp+=b.pCmp||0; A.pYds+=b.pYds||0; A.rAtt+=b.rAtt||0; A.rYds+=b.rYds||0;
        A.sk+=b.sk||0; A.fga+=b.fga||0; A.fgm+=b.fgm||0; A.int+=b.pInt||0; } }
    let cd = null;
    for (const e of res.log) {
      if (e.kind === 'drive') { if (cd && cd.rz) { A.rz++; if (cd.td) A.rzTD++; }
        A.drives++; const m0 = e.text.match(/ball at (?:(own|opp) ([0-9]+)|(midfield))/);
        const st = m0 ? (m0[3] ? 50 : (m0[1]==='own' ? +m0[2] : 100-+m0[2])) : 25;
        cd = { los:st, rz:st>=80, td:false }; continue; }
      if (e.kind === 'final' || !e.team) continue;
      if (cd) { const mg = e.text.match(/(?:run|pass to [^0-9]*|sacked by [^0-9]*for) (-?[0-9]+)/);
        if (mg) { cd.los += parseInt(mg[1],10); if (cd.los>=80) cd.rz = true; }
        if (/TOUCHDOWN/.test(e.text)) { cd.rz = true; cd.td = true; } }
      const isPen = /^🚩/.test(e.text), dn = parseInt(String(e.dd||'').charAt(0),10);
      const scored = e.kind==='score' && /TOUCHDOWN/.test(e.text);
      const conv = /1ST DOWN/.test(e.text) || scored;
      if (!isPen && dn===3) { A.d3a++; if (conv) A.d3c++; }
      if (!isPen && dn===4 && !/^Punt/.test(e.text) && !/field goal/.test(e.text)) A.d4a++;
      if (conv) A.fd++;
      if (/^Punt/.test(e.text)) { A.punts++; A.dPUNT++; }
      else if (/field goal is GOOD/.test(e.text)) A.dFG++;
      else if (/field goal MISSED/.test(e.text)) A.dMISS++;
      else if (scored) A.dTD++;
      else if (/Turnover on downs/.test(e.text)) A.dDOWNS++;
      else if (/INTERCEPTED/.test(e.text)) A.dTO++;
      else if (/FUMBLES|STRIP-SACKED/.test(e.text)) { A.dTO++; A.fum++; }
      else if (/END OF (HALF|GAME)/i.test(e.text)) A.dEND++;
      const m = e.text.match(/sacked by .* for (-\d+)/); if (m) A.skYds += -parseInt(m[1],10);
    }
    if (cd && cd.rz) { A.rz++; if (cd.td) A.rzTD++; }
    rows.push({ hid:g.home.id, aid:g.away.id, hs:res.hs, as:res.as });
  }
  const G = slate.length, TG = G*2, dn = A.drives||1;
  const teams = [...new Set(rows.flatMap(g => [g.hid, g.aid]))];
  const HFA = 2.4, R = {}; teams.forEach(t=>R[t]=0);
  const cap = x => Math.max(-28, Math.min(28, x));
  for (let it=0; it<40; it++) { const s={},c={}; teams.forEach(t=>{s[t]=0;c[t]=0;});
    for (const g of rows) { const m = cap(g.hs-g.as);
      s[g.hid]+=(m-HFA)+R[g.aid]; c[g.hid]++; s[g.aid]+=(-m+HFA)+R[g.hid]; c[g.aid]++; }
    teams.forEach(t=>{ if(c[t]) R[t]=s[t]/c[t]; });
    const mu = teams.reduce((a,t)=>a+R[t],0)/teams.length; teams.forEach(t=>R[t]-=mu); }
  const fav = rows.map(g => { const e = R[g.hid]-R[g.aid]+HFA, sp = Math.abs(e);
    const fm = e>0 ? g.hs-g.as : g.as-g.hs; return { resid:fm-sp, spread:sp, fm }; });
  const rs = fav.map(x=>x.resid), mu = rs.reduce((a,b)=>a+b,0)/rs.length;
  const sd = Math.sqrt(rs.reduce((s,x)=>s+(x-mu)**2,0)/rs.length);
  const mid = fav.filter(x=>x.spread>=10.5 && x.spread<14);
  const M = {
    pts:A.pts/TG, plays:(A.pAtt+A.rAtt+A.sk)/TG, ypp:(A.pYds+A.rYds-A.skYds)/(A.pAtt+A.rAtt+A.sk),
    att:A.pAtt/TG, cmpPct:A.pCmp/A.pAtt*100, ypa:A.pYds/A.pAtt, ratt:A.rAtt/TG, ypc:A.rYds/A.rAtt,
    fd:A.fd/TG, d3:A.d3c/(A.d3a||1)*100, d4a:A.d4a/TG, punts:A.punts/TG, fga:A.fga/TG,
    drives:A.drives/TG, pldr:(A.pAtt+A.rAtt+A.sk)/dn, ppd:A.pts/dn,
    dTD:A.dTD/dn*100, dPUNT:A.dPUNT/dn*100, dDOWNS:A.dDOWNS/dn*100, dEND:A.dEND/dn*100,
    sd, blow:fav.filter(x=>x.spread>=7&&x.fm<=-14).length/G*790,
    midUps:mid.length?mid.filter(x=>x.fm<0).length/mid.length*100:0,
    rzTD:A.rzTD/(A.rz||1)*100, ydPerPt:(A.pYds+A.rYds-A.skYds)/(A.pts/TG*TG/TG)/TG*TG/(A.pts/TG),
  };
  M.ydPerPt = (A.pYds+A.rYds-A.skYds)/(A.pts||1);
  let err = 0, wsum = 0;
  for (const k in T) { const w = W[k]||1; err += w*Math.abs((M[k]-T[k])/Math.abs(T[k])); wsum += w; }
  return { err: err/wsum*100, M };
}

/* ---------- multi-start coordinate descent ----------
   One start gets stuck (notably it never lowers `form`, which is the dominant variance term but
   only pays off once the other parameters move with it). Restarts from randomised points, keeps
   the best. Descent uses a full step-doubling line search per coordinate. */
const t0 = Date.now();
const R = rng(0xC0FFEE);
let evals = 0;
function descend(v0, passes) {
  let b = { ...v0 }, bE = evaluate(b, SEARCH).err; evals++;
  for (let pass = 0; pass < passes; pass++) {
    let improved = false;
    for (const [name, lo, hi, step] of SPEC) {
      for (const dir of [1, -1]) {
        let mult = 1;
        while (mult <= 8) {
          const cand = { ...b }; cand[name] = clamp(b[name] + dir*step*mult, lo, hi);
          if (cand[name] === b[name]) break;
          const e = evaluate(cand, SEARCH).err; evals++;
          if (e < bE - 0.005) { bE = e; b = cand; improved = true; mult *= 2; }
          else break;
        }
      }
    }
    if (!improved) break;
  }
  return { v: b, e: bE };
}
let best = null, bestE = 1e9;
const STARTS = [START,
  { ...START, formMult:0, driveForm:5 },        // variance from drive rhythm, none from game form
  { ...START, formMult:2, driveForm:3 },
  { ...START, formMult:4, driveForm:0 },
];
for (let i = 0; i < 10; i++) {
  let s;
  if (i < STARTS.length) s = { ...STARTS[i] };
  else { s = {}; for (const [n, lo, hi] of SPEC) s[n] = lo + R()*(hi-lo); }
  const got = descend(s, 5);
  if (got.e < bestE) { bestE = got.e; best = got.v; }
  console.log(`  start ${i+1}/10 → ${got.e.toFixed(2)}%   best ${bestE.toFixed(2)}%   (${evals} evals, ${((Date.now()-t0)/1000).toFixed(0)}s)`);
}
console.log(`\nsearch done: err ${bestE.toFixed(2)}% after ${evals} evals in ${((Date.now()-t0)/1000).toFixed(0)}s`);
const full = evaluate(best, FULL);
console.log(`full-slate err ${full.err.toFixed(2)}%`);
console.log(`  ${'METRIC'.padEnd(10)} ${'TARGET'.padStart(8)} ${'FIT'.padStart(8)}`);
for (const k in T) console.log(`  ${k.padEnd(10)} ${T[k].toFixed(2).padStart(8)} ${full.M[k].toFixed(2).padStart(8)}`);
const out = pmText(best) + '\n\n// form multiplier: ' + best.formMult + '\n// params: ' + JSON.stringify(best, null, 1);
fs.writeFileSync(__dirname + '/fit-result.txt', out);
console.log('\n' + out);

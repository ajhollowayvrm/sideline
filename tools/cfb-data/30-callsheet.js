/* Phase 63 — the call-sheet balance probe.

   NOT a gate. The gates assert that a composed call REACHES a play and that an uncomposed one is
   byte-identical to what it always was; neither can say whether the four rungs of an axis are
   priced against each other, and an axis with a dominant rung is a menu, not a decision.

   What it does: takes simlab's synthetic world (so it needs no browser and no real data), lets the
   OC pick run or pass exactly as it normally would, and supplies ONLY the axis — every pass gets
   the same depth, every run the same gap. Anything that measures a depth by throwing it on every
   snap is measuring the Phase 22 predictability tax instead (all-run football averages 1.67 yards a
   carry here), which is how the first cut of this phase concluded the run gap was worth 3x what it
   is. Then it does the same from the other side of the ball: our defence holds one depth all game
   and we count what it gives up.

   It also prints the two IMPLIED depth mixes, which are the weights DEPTH_VS is double-centred
   against — re-measure them before re-centring the table, because they are a property of the play
   caller and the down-and-distance ladder, not constants.

   Run:  node tools/cfb-data/30-callsheet.js  [seeds]      (default 30 seeds x 12 matchups)  */
/* Sideline SIM LAB — standalone statistical harness for the Phase 3 play engine.

   The play engine lives in index.html (single source of truth). This harness
   EXTRACTS the engine block from index.html (between the SIM ENGINE markers) and
   evals it here with the same tiny helpers, then sims full league seasons and
   asserts the output is statistically football-shaped + deterministic.

   Run:  node test/simlab.js

   This is the offline lab (no browser). The in-browser QA gate (npm run qa)
   validates the *integrated* engine end-to-end; this validates the model itself
   across thousands of games where a browser would be far too slow. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- extract the SIM ENGINE block from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const START = '// === SIM ENGINE (Phase 3) START ===';
const END = '// === SIM ENGINE (Phase 3) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find SIM ENGINE markers in index.html'); process.exit(2); }
// The sim now reads per-player composure via the TRAIT ENGINE block — pull it in first so
// compDraw/compClutch resolve. Trait-less synthetic players default to 50 (identity reshape),
// so the sim is byte-identical to pre-Phase-10 here and the envelopes below are unchanged.
const T0 = html.indexOf('// === TRAIT ENGINE (Phase 10) START ==='), T1 = html.indexOf('// === TRAIT ENGINE (Phase 10) END ===');
if (T0 < 0 || T1 < 0) { console.error('Could not find TRAIT ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(T0, T1));
// The sim now also folds scheme run/pass tendency into passProb (Phase 22), so pull in the SCHEME
// block too. Synthetic teams below carry no offScheme → schemeTendency returns 0 → the envelopes
// are unchanged; the predictability tax keys on the call mix (also 0 for a balanced AI).
const C0 = html.indexOf('// === SCHEME ENGINE (Phase 21) START ==='), C1 = html.indexOf('// === SCHEME ENGINE (Phase 21) END ===');
if (C0 < 0 || C1 < 0) { console.error('Could not find SCHEME ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(C0, C1));
// Phase 51: `ov` is a derived readout of six attributes, and the sim reads the attributes directly
// through its own self-contained accessor. The engine block does not depend on this one at runtime,
// but the checks below build synthetic players with real profiles, so pull it in for genAttrs/ovrIn.
const A0 = html.indexOf('// === ATTRIBUTE ENGINE (Phase 52) START ==='), A1 = html.indexOf('// === ATTRIBUTE ENGINE (Phase 52) END ===');
if (A0 < 0 || A1 < 0) { console.error('Could not find ATTRIBUTE ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(A0, A1) + '\nglobalThis.ATTRS = ATTRS; globalThis.POS_ATTR_W = POS_ATTR_W; globalThis.SCHEME_ATTR_W = SCHEME_ATTR_W;');
const engineSrc = html.slice(i0, i1);
// eval into this scope so simEngine + helpers (gamePersonnel, etc.) become available
// `var` leaks out of a sloppy-mode eval where `const` does not, so re-export PM — the Phase 48
// shape checks read the SHIPPED tier constants instead of keeping a copy that could drift.
// Phase 51: AT/SIM_ATTRS and the channel helpers are `const` inside the block, so re-export them the
// same way PM/PN are — the checks below assert on the shipped constants rather than a drifting copy.
eval(engineSrc + '\nvar PM_TIERS = PM; globalThis.PN = PN; globalThis.AT = AT; globalThis.SIM_ATTRS = SIM_ATTRS;'
  + ' globalThis.tilt = tilt; globalThis.tailAdd = tailAdd; globalThis.floorAdd = floorAdd; globalThis.simAv = av;');

/* ---------- a faithful-enough synthetic world (mirrors genRoster/teamRatings) ---------- */
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3],
["DE", "def", 6], ["DT", "def", 6], ["LB", "def", 10], ["CB", "def", 9],
// Phase 52 split S into FS/SS in the game and in 4-simprofile, but never here. A world built with
// `S` gives every safety a LINEBACKER's attribute row (posAttrW falls back to LB for an unknown
// code) and leaves the FS/SS entries of the coverage and tackle pools empty — so the primary sim
// gate was validating a league whose safeties are invisible to coverage and to tackling.
["FS", "def", 4], ["SS", "def", 4],
["K", "st", 2], ["P", "st", 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
// Synthetic players had NO NAMES, so anything name-shaped was invisible here: the play-by-play fell
// back to the position code and read "TOUCHDOWN — RB!". Deliberately small pools — surnames collide
// often, which is what exercises the same-play disambiguation in the engine's `nm`.
const TFN = ['Marcus', 'Trey', 'Deion', 'Jalen', 'Cade', 'Rashad', 'Kyler', 'Bo', 'Nate', 'Omar', 'Silas', 'Reggie'];
const TLN = ['Thomas', 'Bell', 'Whitfield', 'Okafor', 'Reyes', 'Sanders', 'Vaughn', 'Pierce', 'Grant', 'Doyle', 'Brown', 'Kelly'];

function genRoster(r, prestige) {
  const out = [];
  POS.forEach(([code, , n]) => { for (let i = 0; i < n; i++) {
    const base = prestige * 0.55 + ri(r, -9, 9) + 30;
    const ov = clamp(Math.round(base), 48, 99);
    // Phase 51: a synthetic player carries a real six-attribute profile, exactly as the shipped
    // generator does. Without one every attribute falls back to `ov`, which collapses all six
    // channels onto the rating gap and makes them restate matchEdge six times over — the sim would
    // look far more rating-determined here than it is in the real game.
    out.push(Object.assign({ id: 'p' + Math.floor(r() * 1e9).toString(36), pos: code, ov, so: 0,
      fn: TFN[Math.floor(r() * TFN.length)], ln: TLN[Math.floor(r() * TLN.length)] }, genAttrs(r, ov, code)));
  } });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => {
    arr.sort((a, b) => b.ov - a.ov);
    // taper the ATTRIBUTES and read `ov` back off them, mirroring genRoster in index.html
    arr.forEach((p, i) => { if (i >= 2) { const pen = Math.min(2 + (i - 2) * 2.6, 26); shiftAttrs(p, -pen); p.ov = clamp(ovrBase(p), 44, 99); } p.so = i; });
  });
  return out;
}
function teamRatings(roster) {
  const grp = s => roster.filter(p => sideOf[p.pos] === s);
  const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
  const off = avgTop(grp('off'), 11), def = avgTop(grp('def'), 11);
  return { off, def, ovr: Math.round((off + def) / 2) };
}
function genWorld(seed, n = 134) {
  const r = rng(seed); const teams = [];
  for (let i = 0; i < n; i++) {
    const prestige = clamp(Math.round(35 + ri(r, -15, 15) + (i < 16 ? 25 : i < 40 ? 12 : 0)), 20, 98);
    const roster = genRoster(r, prestige);
    teams.push({ id: 't' + i, name: 'Team' + i, prestige, roster, ratings: teamRatings(roster) });
  }
  return { teams };
}

/* ---------- run a season and collect distributions ---------- */

// ---- the harness: simlab's synthetic world, driven with a fixed call axis ----
const W=genWorld(7,24);
function measure(call,n){
  let pts=0,g=0,att=0,cmp=0,yds=0,sk=0,ra=0,ry=0;
  for(let i=0;i<W.teams.length;i+=2){
    const h=W.teams[i],a=W.teams[i+1];
    for(let k=0;k<n;k++){
      const seed=(hashStr('p'+i+'_'+k))>>>0;
      const r=simEngine(h,a,seed,{decideFor:h.id,aiDefVs:h.id,aiOffVs:h.id,
        decide:ctx=>ctx.phase==='def'?'base':ctx.phase==='fourth'?ctx.ocAct:call(ctx)});
      pts+=r.hs;g++;
      h.roster.forEach(p=>{const b=r.box[p.id];if(!b)return;att+=b.pAtt||0;cmp+=b.pCmp||0;yds+=b.pYds||0;ra+=b.rAtt||0;ry+=b.rYds||0;});
      a.roster.forEach(p=>{const b=r.box[p.id];if(!b)return;sk+=b.sk||0;});
    }
  }
  return {pts:+(pts/g).toFixed(2),att:+(att/g).toFixed(1),cmpPct:+(100*cmp/Math.max(1,att)).toFixed(1),
    ypa:+(yds/Math.max(1,att)).toFixed(2),yds:+(yds/g).toFixed(0),sk:+(sk/g).toFixed(2),
    ra:+(ra/g).toFixed(1),ypc:+(ry/Math.max(1,ra)).toFixed(2)};
}

const N = +(process.argv[2] || 30);
const mk = (g, p) => ctx => ctx.ocCall === 'run' ? 'run::' + (g || '-') + '----' : 'pass::' + (p || '-') + '----';
const rows = {
  'OC bare': measure(ctx => ctx.ocCall, N),
  'gap inside': measure(mk('i', ''), N), 'gap off-tackle': measure(mk('t', ''), N), 'gap outside': measure(mk('o', ''), N),
  'depth quick': measure(mk('', 'q'), N), 'depth short': measure(mk('', 's'), N),
  'depth inter': measure(mk('', 'm'), N), 'depth deep': measure(mk('', 'd'), N),
};
console.log('OFFENSE — the OC calls run/pass, we supply the axis  (' + N + ' seeds x ' + (W.teams.length / 2) + ' matchups)');
console.log('  ' + 'call'.padEnd(16), 'pts   att  cmp%  Y/A  pyds  sk   ra   Y/C');
for (const k in rows) { const v = rows[k];
  console.log('  ' + k.padEnd(16), String(v.pts).padStart(5), String(v.att).padStart(5), String(v.cmpPct).padStart(5),
    String(v.ypa).padStart(5), String(v.yds).padStart(5), String(v.sk).padStart(4), String(v.ra).padStart(5), String(v.ypc).padStart(5)); }

function defMeasure(dep, n) {
  let pts = 0, g = 0;
  for (let i = 0; i < W.teams.length; i += 2) {
    const h = W.teams[i], a = W.teams[i + 1];
    for (let k = 0; k < n; k++) { const seed = (hashStr('q' + i + '_' + k)) >>> 0;
      pts += simEngine(h, a, seed, { decideFor: h.id, aiOffVs: h.id,
        decide: ctx => ctx.phase === 'def' ? ('base::' + dep + '--') : ctx.phase === 'fourth' ? ctx.ocAct : ctx.ocCall }).as;
      g++; } }
  return +(pts / g).toFixed(2);
}
console.log('\nDEFENSE — points allowed holding one depth all game (lower = better)');
[['-', 'balanced'], ['p', 'press'], ['u', 'underneath'], ['t', 'two-deep']]
  .forEach(([d, l]) => console.log('  ' + l.padEnd(12), defMeasure(d, N)));

// The weights DEPTH_VS is centred against. Re-measure these before re-centring it.
const oc = { q: 0, s: 0, m: 0, d: 0 }, dc = { p: 0, u: 0, t: 0 }, dcR2 = rng(12345);
for (let i = 0; i < W.teams.length; i += 2) { const h = W.teams[i], a = W.teams[i + 1];
  for (let k = 0; k < Math.min(N, 25); k++) { const seed = (hashStr('m' + i + '_' + k)) >>> 0;
    simEngine(h, a, seed, { decideFor: h.id, aiDefVs: h.id, aiOffVs: h.id, decide: ctx => {
      if (ctx.phase === 'play' && ctx.ocPass) { oc[impliedPassDepth(ctx.togo, '')]++;
        dc[impliedDefDepth(aiDefCall({ down: ctx.down, togo: ctx.togo, los: ctx.los, runRate: 0.5 }, dcR2()))]++; }
      return ctx.phase === 'fourth' ? ctx.ocAct : ctx.ocCall; } }); } }
const norm = o => { const t = Object.values(o).reduce((a, b) => a + b, 0); const r = {};
  for (const k in o) r[k] = +(o[k] / t).toFixed(3); return r; };
console.log('\nimplied depth mixes (the DEPTH_VS centring weights)');
console.log('  offense:', JSON.stringify(norm(oc)));
console.log('  defense:', JSON.stringify(norm(dc)));

/* Phase 52 PROTOTYPE — the 25-attribute, 15-position model, validated standalone before it goes
   near index.html. Throwaway harness per the project's dev discipline: prove the generator produces
   football-shaped, correctly-centred players first; wire it in second.

   Run: node tools/attrproto.js            */

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));

/* ---------------------------------------------------------------- vocabulary */
const ATTRS = ['spd','acc','agi','str','dur','adp','awr','iq','thp','tha','tor',
               'elu','btk','car','cth','rte','rbk','pbk','prs','rst','mcv','zcv','tkl','kpw','kac'];
const ATTR_LABEL = {
  spd:'Speed', acc:'Acceleration', agi:'Agility', str:'Strength', dur:'Durability', adp:'Adaptability',
  awr:'Awareness', iq:'Football IQ', thp:'Throw Power', tha:'Throw Accuracy', tor:'Throw on Run',
  elu:'Elusiveness', btk:'Break Tackle', car:'Carrying', cth:'Catching', rte:'Route Running',
  rbk:'Run Block', pbk:'Pass Block', prs:'Pass Rush', rst:'Run Stop',
  mcv:'Man Coverage', zcv:'Zone Coverage', tkl:'Tackling', kpw:'Kick Power', kac:'Kick Accuracy' };

/* What each position IS, as a weighting over the attributes it carries. Rows sum to 1.
   `adp` is CARRIED but weighted 0 — adaptability is about playing somewhere else, so it must not
   make a player better at his own spot. Presence of a key = the attribute is stored for that pos. */
const POS_ATTR_W = {
  // reading a defense is the job; accuracy over arm
  QB:{tha:.20, iq:.16, awr:.12, thp:.12, tor:.08, agi:.06, elu:.06, spd:.05, acc:.04, str:.04, car:.03, btk:.02, dur:.02, adp:0},
  // vision + make him miss + finish; blocks and catches a little
  RB:{elu:.16, spd:.14, acc:.12, agi:.12, btk:.12, str:.08, awr:.08, car:.06, cth:.05, pbk:.03, rte:.02, rbk:.01, dur:.01, adp:0},
  // hands and routes first, then the athleticism that creates separation
  WR:{cth:.22, rte:.20, spd:.16, acc:.10, agi:.10, awr:.08, elu:.05, str:.04, btk:.02, car:.02, dur:.01, adp:0},
  // "basically WR + OL"
  TE:{cth:.18, rbk:.14, rte:.12, str:.12, pbk:.10, awr:.08, spd:.06, agi:.06, acc:.05, btk:.04, elu:.02, car:.02, dur:.01, adp:0},
  // "a tackle needs more agility and pass-block technique because they go against speed rushers"
  OT:{pbk:.30, str:.22, rbk:.18, agi:.12, awr:.10, acc:.04, spd:.02, dur:.02, adp:0},
  // "a guard needs more pure strength because they face tackles and bull rushers"
  OG:{str:.32, rbk:.26, pbk:.22, awr:.10, agi:.05, acc:.02, spd:.01, dur:.02, adp:0},
  // the center makes the line calls
  C :{str:.24, rbk:.20, pbk:.20, iq:.14, awr:.10, agi:.06, acc:.02, spd:.01, dur:.03, adp:0},
  DE:{prs:.26, str:.20, rst:.16, acc:.10, agi:.08, awr:.08, spd:.06, tkl:.04, dur:.02, adp:0},
  DT:{str:.32, rst:.24, prs:.18, awr:.08, acc:.06, agi:.05, tkl:.04, spd:.01, dur:.02, adp:0},
  LB:{tkl:.16, awr:.14, iq:.12, rst:.12, zcv:.10, mcv:.08, str:.08, spd:.06, agi:.05, acc:.04, prs:.03, cth:.01, dur:.01, adp:0},
  // "awareness is great; speed is big for deep routes"
  CB:{mcv:.22, spd:.18, awr:.14, zcv:.12, agi:.10, acc:.08, cth:.08, tkl:.04, str:.02, dur:.02, adp:0},
  // "a free safety needs speed and awareness as they zone cover a lot of space"
  FS:{zcv:.20, awr:.16, spd:.14, iq:.12, mcv:.10, cth:.08, acc:.07, agi:.06, tkl:.05, str:.01, dur:.01, adp:0},
  // "strong safeties are more about tackling and occasionally coverage"
  SS:{tkl:.20, str:.14, mcv:.13, awr:.13, zcv:.11, iq:.08, acc:.06, agi:.06, spd:.05, cth:.03, dur:.01, adp:0},
  K :{kac:.52, kpw:.34, awr:.08, str:.04, dur:.02, adp:0},
  P :{kpw:.46, kac:.40, awr:.08, str:.04, dur:.02, adp:0},
};
const POSITIONS = Object.keys(POS_ATTR_W);
const posAttrW = pos => POS_ATTR_W[pos] || POS_ATTR_W.LB;
const posAttrs = pos => Object.keys(posAttrW(pos));

/* Technique correlates with its athletic/mental basis — "technique and natural athleticism go hand
   in hand". Also load-bearing for the fat tail: correlated attributes make bad units COHERENTLY bad,
   which is what compounds into a blowout. Independent draws would average that away. */
const TECH_BASIS = {
  rbk:['str','awr'], pbk:['str','agi','awr'], prs:['str','acc','agi'], rst:['str','awr'],
  mcv:['agi','acc','spd'], zcv:['awr','iq','agi'], tkl:['str','awr'],
  cth:['awr'], rte:['agi','acc'], elu:['agi','acc'], btk:['str'], car:['awr'],
  tha:['awr','iq'], thp:['str'], tor:['agi','tha'], kac:['awr'], kpw:['str'],
};
const TECH_W = 0.55;   // share of a technique stat driven by its basis

/* ---------------------------------------------------------------- archetypes
   A named SHAPE in attribute space. Authored as raw preferences and then auto-balanced to weighted
   mean zero under the position's own row (see balanceArch), so picking an archetype changes WHAT a
   player is and never HOW GOOD he is — the same construction as SCHEME_ATTR_W. Hand-balancing 48
   vectors would be unmaintainable and would silently rot the moment a weight is tuned.

   `freq` is relative draw weight: pocket passers are common, true dual-threats are not.

   These are the legible face of the floor/tail rule (§9a). A Pocket Passer has a high floor and no
   tail; a Gunslinger is boom-or-bust. Same Overall, different distribution — which is what makes the
   league a MIXTURE and buys the measured excess kurtosis honestly. */
const ARCHETYPES = {
  QB: [
    { n:'Pocket Passer',  f:32, w:{tha:9, thp:4, iq:4, str:3, elu:2, spd:-9, acc:-8, agi:-6, tor:-3} },
    { n:'Gunslinger',     f:22, w:{thp:10, tor:6, elu:3, agi:3, spd:2, tha:-5, awr:-6, iq:-5} },
    { n:'Dual-Threat',    f:20, w:{spd:11, acc:9, agi:7, elu:5, tor:4, tha:-6, thp:-3, iq:-5} },
    { n:'Field General',  f:26, w:{iq:10, awr:9, tha:5, car:3, thp:-6, spd:-6, acc:-5, elu:-4} },
  ],
  RB: [
    { n:'Power Back',     f:26, w:{str:9, btk:10, rbk:4, pbk:4, spd:-6, acc:-4, agi:-6, elu:-7} },
    { n:'Scat Back',      f:24, w:{elu:10, agi:9, acc:6, str:-8, btk:-8, pbk:-4} },
    { n:'Home-Run Hitter',f:20, w:{spd:12, acc:8, elu:4, str:-5, awr:-5, pbk:-5, car:-4} },
    { n:'Receiving Back', f:30, w:{cth:10, rte:9, pbk:5, awr:4, btk:-6, str:-6} },
  ],
  WR: [
    { n:'Deep Threat',    f:24, w:{spd:11, acc:9, rte:3, str:-6, cth:-4, btk:-6} },
    { n:'Possession',     f:28, w:{cth:9, rte:8, awr:5, spd:-7, acc:-6, elu:-4} },
    { n:'Slot Technician',f:26, w:{rte:10, agi:9, acc:5, awr:4, str:-8, btk:-7} },
    { n:'Contested X',    f:22, w:{str:11, cth:5, btk:6, agi:-7, acc:-6, elu:-6, spd:-7} },
  ],
  TE: [
    { n:'Blocking Y',     f:32, w:{rbk:10, pbk:9, str:5, cth:-7, rte:-8, spd:-5, elu:-4} },
    { n:'Receiving F',    f:34, w:{cth:10, rte:9, spd:5, rbk:-9, pbk:-7, str:-5} },
    { n:'Move H-Back',    f:34, w:{agi:6, acc:6, cth:4, rbk:3, elu:3, str:-6, btk:-4} },
  ],
  OT: [
    { n:'Pass Protector', f:34, w:{pbk:9, agi:7, awr:4, str:-6, rbk:-7} },
    { n:'Mauler',         f:33, w:{str:9, rbk:9, agi:-7, pbk:-5, acc:-5} },
    { n:'Zone Athlete',   f:33, w:{agi:8, acc:8, spd:5, rbk:4, str:-8, pbk:-3} },
  ],
  OG: [
    { n:'Mauler',         f:38, w:{str:8, rbk:9, agi:-8, acc:-7} },
    { n:'Puller',         f:30, w:{agi:9, acc:9, spd:5, str:-6, rbk:-3} },
    { n:'Anchor',         f:32, w:{pbk:9, str:4, awr:5, spd:-5, agi:-6} },
  ],
  C: [
    { n:'Field General',  f:36, w:{iq:9, awr:7, pbk:4, str:-6, agi:-3} },
    { n:'Mauler',         f:32, w:{str:8, rbk:9, iq:-6, agi:-6} },
    { n:'Zone Snapper',   f:32, w:{agi:8, acc:6, iq:3, str:-7, rbk:-4} },
  ],
  DE: [
    { n:'Speed Rusher',   f:34, w:{prs:9, acc:9, agi:6, spd:5, str:-8, rst:-7} },
    { n:'Bull Rusher',    f:33, w:{str:10, prs:5, rst:5, acc:-7, agi:-6, spd:-5} },
    { n:'Run Stopper',    f:33, w:{rst:10, str:5, tkl:6, prs:-8, acc:-5} },
  ],
  DT: [
    { n:'Nose Tackle',    f:34, w:{str:8, rst:9, prs:-7, acc:-6, agi:-6, spd:-4} },
    { n:'3-Tech',         f:33, w:{prs:10, acc:8, agi:6, str:-6, rst:-6} },
    { n:'Two-Gap Anchor', f:33, w:{str:5, rst:5, awr:6, tkl:4, acc:-4, agi:-4} },
  ],
  LB: [
    { n:'Thumper',        f:26, w:{tkl:9, str:8, rst:6, zcv:-7, mcv:-7, spd:-4, acc:-4} },
    { n:'Coverage LB',    f:26, w:{zcv:9, mcv:9, cth:5, spd:5, acc:4, str:-7, rst:-6, tkl:-5} },
    { n:'Blitzer',        f:22, w:{prs:11, acc:7, str:4, zcv:-7, mcv:-7, cth:-4} },
    { n:'Field General',  f:26, w:{iq:10, awr:9, rst:4, spd:-5, prs:-6, acc:-4} },
  ],
  CB: [
    { n:'Press Corner',   f:32, w:{mcv:9, str:7, agi:5, zcv:-8, awr:-5} },
    { n:'Zone Corner',    f:34, w:{zcv:9, awr:8, cth:5, mcv:-7, str:-5, spd:-3} },
    { n:'Burner',         f:34, w:{spd:10, acc:8, mcv:4, tkl:-6, str:-6, awr:-6} },
  ],
  FS: [
    { n:'Center Fielder', f:36, w:{zcv:9, spd:8, awr:5, tkl:-7, str:-6, mcv:-5} },
    { n:'Ball Hawk',      f:32, w:{cth:10, zcv:5, awr:5, iq:4, tkl:-7, str:-6} },
    { n:'Nickel Hybrid',  f:32, w:{mcv:10, agi:6, acc:6, zcv:-6, str:-5, tkl:-4} },
  ],
  SS: [
    { n:'Box Enforcer',   f:36, w:{tkl:9, str:9, zcv:-7, spd:-5, cth:-6} },
    { n:'Hybrid LB/S',    f:32, w:{tkl:6, mcv:5, str:5, iq:5, spd:-5, zcv:-6} },
    { n:'Coverage SS',    f:32, w:{mcv:9, zcv:6, cth:6, str:-7, tkl:-7} },
  ],
  K: [
    { n:'Big Leg',        f:50, w:{kpw:9, kac:-6} },
    { n:'Precision',      f:50, w:{kac:7, kpw:-9} },
  ],
  P: [
    { n:'Boomer',         f:50, w:{kpw:8, kac:-8} },
    { n:'Coffin Corner',  f:50, w:{kac:9, kpw:-7} },
  ],
};
/* Subtract each vector's WEIGHTED mean so an archetype is mean-zero under its own position row:
   choosing one changes what a player is, never how good he is. Asserted below. */
function balanceArch() {
  for (const pos in ARCHETYPES) {
    const w = posAttrW(pos), keys = Object.keys(w);
    const sw = keys.reduce((s, k) => s + w[k], 0) || 1;
    for (const a of ARCHETYPES[pos]) {
      for (const k of Object.keys(a.w)) if (w[k] == null) throw new Error(`${pos}/${a.n}: ${k} is not carried by ${pos}`);
      let m = 0; for (const k of keys) m += w[k] * (a.w[k] || 0);
      m /= sw;
      a.off = {}; for (const k of keys) a.off[k] = (a.w[k] || 0) - m;
    }
  }
}
balanceArch();
function pickArch(r, pos) {
  const list = ARCHETYPES[pos]; if (!list) return null;
  const tot = list.reduce((s, a) => s + a.f, 0);
  let x = r() * tot;
  for (const a of list) { x -= a.f; if (x <= 0) return a; }
  return list[list.length - 1];
}
/* Classify an EXISTING profile to its nearest archetype — needed for imported rosters, the v48
   migration, and for a player whose development has drifted him away from where he started. */
function classifyArch(p) {
  const list = ARCHETYPES[p.pos]; if (!list) return null;
  const w = posAttrW(p.pos), keys = Object.keys(w);
  const sw = keys.reduce((s, k) => s + w[k], 0) || 1;
  let mean = 0; for (const k of keys) mean += w[k] * attrVal(p, k); mean /= sw;
  let best = null, bestD = Infinity;
  for (const a of list) {
    let d = 0; for (const k of keys) { const dev = attrVal(p, k) - mean; d += w[k] * (dev - a.off[k]) ** 2; }
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

const ATTR_DEF = 60;
const attrVal = (p, k) => { const v = p && p[k]; return v != null ? v : ((p && p.ov) != null ? p.ov : ATTR_DEF); };
function ovrWith(p, w) { let t = 0, s = 0; for (const k in w) { t += w[k] * attrVal(p, k); s += w[k]; } return clamp(Math.round(t / (s || 1)), 40, 99); }
const ovrBase = p => ovrWith(p, posAttrW(p && p.pos));

/* An attribute a position does not select for should sit LOW and vary LITTLE. A 90-overall center is
   not a 90-speed athlete — he is a 90 at being a center, and nobody ever timed him. Derived from the
   row itself (relative weight vs an even split) rather than a second hand-maintained table, so it
   stays correct automatically as the weights are tuned.
   Asymmetric on purpose: being irrelevant to the position drags an attribute down hard, being
   central lifts it only slightly, because the centring pass already sets the player's LEVEL. */
const ANCHOR = 15;
function anchorOff(w, keys, k) {
  const rel = w[k] * keys.length;                    // 1.0 = exactly an even share of the row
  return clamp(ANCHOR * (rel - 1), -24, 6);
}
/* The ONE generator. Produces a profile whose WEIGHTED mean is exactly ov0, so a player is as good
   as he was asked to be and the spread only decides WHAT KIND of good.
   Order matters: anchor → draw the tilt → blend technique toward its basis → THEN re-centre, so
   neither the anchoring nor the correlation can smuggle ability in. */
function genAttrs(r, ov0, pos, spread, arch) {
  const w = posAttrW(pos), keys = Object.keys(w), sp = spread == null ? 15 : spread;
  const t = {};
  // The archetype supplies the SHAPE; the individual draw supplies the variation around it. Shrink
  // the free draw when an archetype is in play, or the noise would wash the archetype out and every
  // Gunslinger would look like every Pocket Passer.
  const ind = arch ? 0.55 : 1;
  for (const k of keys) {
    const rel = clamp(w[k] * keys.length, 0, 2);
    // an attribute the position barely uses also barely VARIES — nobody develops it either way
    const s = sp * (0.35 + 0.65 * Math.min(rel, 1.4) / 1.4) * ind;
    t[k] = anchorOff(w, keys, k) + (arch ? arch.off[k] : 0) + (r() + r() - 1) * s;
  }
  for (const k of keys) {                                          // technique follows athleticism
    const basis = TECH_BASIS[k]; if (!basis) continue;
    const have = basis.filter(b => t[b] != null); if (!have.length) continue;
    const bm = have.reduce((s, b) => s + t[b], 0) / have.length;
    const off = anchorOff(w, keys, k);
    // blend the DEVIATIONS from each side's anchor, so correlation moves shape and not level
    const bOff = have.reduce((s, b) => s + anchorOff(w, keys, b), 0) / have.length;
    t[k] = off + TECH_W * (bm - bOff) + (1 - TECH_W) * (t[k] - off);
  }
  // Centre so the WEIGHTED mean is exactly ov0. Iterated, because clamping at 40/99 eats part of the
  // correction — the residual is redistributed onto the attributes that still have room.
  const out = {};
  for (const k of keys) out[k] = ov0 + t[k];
  const sw = keys.reduce((s, k) => s + w[k], 0) || 1;
  for (let pass = 0; pass < 6; pass++) {
    let m = 0; for (const k of keys) m += w[k] * clamp(out[k], 40, 99);
    const err = ov0 - m / sw;
    if (Math.abs(err) < 1e-6) break;
    let room = 0; for (const k of keys) { const v = clamp(out[k], 40, 99); if ((err > 0 && v < 99) || (err < 0 && v > 40)) room += w[k]; }
    if (!room) break;
    for (const k of keys) { const v = clamp(out[k], 40, 99); if ((err > 0 && v < 99) || (err < 0 && v > 40)) out[k] = v + err * sw / room; }
  }
  for (const k of keys) out[k] = clamp(Math.round(out[k]), 40, 99);
  // adp is weighted 0, so it never enters the centring — draw it independently
  out.adp = clamp(Math.round(50 + (r() + r() - 1) * 22), 20, 99);
  return out;
}

/* ---------------------------------------------------------------- checks */
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('\n=== Phase 52 attribute prototype ===\n');

// 1. rows sum to 1
console.log('1. POS_ATTR_W rows sum to 1');
for (const pos of POSITIONS) {
  const s = Object.values(POS_ATTR_W[pos]).reduce((a, b) => a + b, 0);
  ok(near(s, 1, 1e-9), `${pos} sums to ${s.toFixed(4)}, not 1`);
}
ok(POSITIONS.length === 15, `expected 15 positions, got ${POSITIONS.length}`);

// 2. every key is a known attribute; adp carried everywhere at weight 0
console.log('2. vocabulary is closed, adp carried at weight 0');
for (const pos of POSITIONS) {
  for (const k of Object.keys(POS_ATTR_W[pos])) ok(ATTRS.indexOf(k) >= 0, `${pos} has unknown attr ${k}`);
  ok(POS_ATTR_W[pos].adp === 0, `${pos} adp weight is ${POS_ATTR_W[pos].adp}, must be 0`);
}
const used = new Set(); POSITIONS.forEach(p => Object.keys(POS_ATTR_W[p]).forEach(k => used.add(k)));
ATTRS.forEach(k => ok(used.has(k), `attribute ${k} is carried by NO position`));

// 3. ovrBase returns exactly what was asked for — the load-bearing guarantee
console.log('3. ovrBase(genAttrs(ov)) === ov  (the mean-zero-tilt guarantee)');
{
  const r = rng(0xA77);
  let worst = 0, n = 0;
  for (const pos of POSITIONS) for (let i = 0; i < 400; i++) {
    const ov = ri(r, 48, 95);
    const p = Object.assign({ pos }, genAttrs(r, ov, pos));
    worst = Math.max(worst, Math.abs(ovrBase(p) - ov)); n++;
  }
  ok(worst <= 1, `ovrBase drifted from the requested ov by up to ${worst} (rounding tolerance is 1)`);
  console.log(`   ${n} players, max |ovrBase − requested| = ${worst}`);
}

// 4. technique correlates with its basis
console.log('4. technique correlates with athleticism');
{
  const r = rng(0xB33), xs = [], ys = [];
  for (let i = 0; i < 4000; i++) {
    const p = Object.assign({ pos: 'OG' }, genAttrs(r, ri(r, 50, 95), 'OG'));
    xs.push(p.str); ys.push(p.rbk);
  }
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const corr = sxy / Math.sqrt(sxx * syy);
  ok(corr > 0.55, `OG str↔rbk correlation is ${corr.toFixed(3)}, expected > 0.55`);
  console.log(`   OG strength ↔ run block  r = ${corr.toFixed(3)}`);
}

// 5. FS and SS are genuinely different positions
console.log('5. FS and SS re-rate the same player differently');
{
  const rangy  = { spd:88, acc:84, agi:82, str:62, awr:86, iq:84, zcv:88, mcv:74, cth:80, tkl:66, dur:70 };
  const thumper= { spd:74, acc:76, agi:74, str:86, awr:80, iq:72, zcv:70, mcv:80, cth:66, tkl:90, dur:78 };
  const at = (p, pos) => ovrWith(Object.assign({ pos }, p), posAttrW(pos));
  const rFS = at(rangy,'FS'), rSS = at(rangy,'SS'), tFS = at(thumper,'FS'), tSS = at(thumper,'SS');
  console.log(`   center-fielder : FS ${rFS}  SS ${rSS}   (${rFS - rSS >= 0 ? '+' : ''}${rFS - rSS} as FS)`);
  console.log(`   box safety     : FS ${tFS}  SS ${tSS}   (${tSS - tFS >= 0 ? '+' : ''}${tSS - tFS} as SS)`);
  ok(rFS > rSS, `the rangy safety should rate higher at FS (${rFS} vs ${rSS})`);
  ok(tSS > tFS, `the thumper should rate higher at SS (${tSS} vs ${tFS})`);
}

// 6. awareness/IQ builds vs explosive builds — equal OVR, different shape
console.log('6. a smart build and an explosive build can share an Overall');
{
  const r = rng(0xC0FFEE);
  const mk = (pos, ov, tiltKeys, amt) => {
    const p = Object.assign({ pos }, genAttrs(r, ov, pos));
    tiltKeys.forEach(k => { if (p[k] != null) p[k] = clamp(p[k] + amt, 40, 99); });
    return p;
  };
  const smart = mk('WR', 80, ['awr'], 12), fast = mk('WR', 80, ['spd','acc'], 12);
  console.log(`   smart WR  ov ${ovrBase(smart)}  awr ${smart.awr} spd ${smart.spd} acc ${smart.acc}`);
  console.log(`   fast  WR  ov ${ovrBase(fast)}  awr ${fast.awr} spd ${fast.spd} acc ${fast.acc}`);
  ok(smart.awr > fast.awr && fast.spd > smart.spd, 'the two builds did not separate as intended');
}

// 7. archetypes are mean-zero: picking one changes WHAT you are, never HOW GOOD
console.log('7. archetypes are weighted-mean-zero under their own position row');
{
  let worst = 0, n = 0;
  for (const pos of POSITIONS) {
    const w = posAttrW(pos), keys = Object.keys(w);
    const sw = keys.reduce((s, k) => s + w[k], 0);
    ok((ARCHETYPES[pos] || []).length >= 2, `${pos} has fewer than 2 archetypes`);
    for (const a of ARCHETYPES[pos] || []) {
      let m = 0; for (const k of keys) m += w[k] * a.off[k];
      worst = Math.max(worst, Math.abs(m / sw)); n++;
      ok(Math.abs(m / sw) < 1e-9, `${pos}/${a.n} is not mean-zero (${(m / sw).toFixed(4)})`);
    }
  }
  console.log(`   ${n} archetypes across ${POSITIONS.length} positions, max |weighted mean| = ${worst.toExponential(1)}`);
}

// 8. an archetype survives generation, and round-trips through the classifier
console.log('8. generation honours the archetype, and the classifier recovers it');
{
  const r = rng(0xD00D);
  let hit = 0, tot = 0, worstOv = 0;
  for (const pos of POSITIONS) for (const a of ARCHETYPES[pos]) for (let i = 0; i < 300; i++) {
    const ov = ri(r, 50, 95);
    const p = Object.assign({ pos }, genAttrs(r, ov, pos, 15, a));
    worstOv = Math.max(worstOv, Math.abs(ovrBase(p) - ov));
    if (classifyArch(p) === a) hit++; tot++;
  }
  ok(worstOv === 0, `ovrBase drifted by ${worstOv} when generating from an archetype`);
  const pct = hit / tot * 100;
  ok(pct > 70, `classifier only recovered the source archetype ${pct.toFixed(1)}% of the time`);
  console.log(`   ${tot} players, ovrBase drift ${worstOv}, classifier recovers ${pct.toFixed(1)}%`);
}

// 9. the directive's two quarterbacks
console.log('9. Gunslinger vs Pocket Passer separate as described');
{
  const r = rng(0x1234);
  const A = ARCHETYPES.QB, gun = A.find(a => a.n === 'Gunslinger'), poc = A.find(a => a.n === 'Pocket Passer');
  const avg = (a, k) => { let s = 0; for (let i = 0; i < 600; i++) s += genAttrs(r, 80, 'QB', 15, a)[k]; return s / 600; };
  const g = { thp: avg(gun,'thp'), tha: avg(gun,'tha'), spd: avg(gun,'spd'), agi: avg(gun,'agi'), elu: avg(gun,'elu'), awr: avg(gun,'awr') };
  const p = { thp: avg(poc,'thp'), tha: avg(poc,'tha'), spd: avg(poc,'spd'), agi: avg(poc,'agi'), elu: avg(poc,'elu'), awr: avg(poc,'awr') };
  const row = (l, o) => `   ${l.padEnd(15)} thp ${o.thp.toFixed(0)}  tha ${o.tha.toFixed(0)}  spd ${o.spd.toFixed(0)}  agi ${o.agi.toFixed(0)}  elu ${o.elu.toFixed(0)}  awr ${o.awr.toFixed(0)}`;
  console.log(row('Gunslinger', g)); console.log(row('Pocket Passer', p));
  ok(g.thp > p.thp, 'Gunslinger should out-throw the Pocket Passer on arm strength');
  ok(p.tha > g.tha, 'Pocket Passer should be the more accurate');
  ok(g.spd > p.spd && g.agi > p.agi, 'Gunslinger should be the more mobile');
  ok(p.awr > g.awr, 'Pocket Passer should read it better (the Gunslinger pays for his arm)');
}

// 10. archetype CENTRES — the eyeball test. Averaged over many draws at a fixed Overall, so this
//     shows the archetype's true signature rather than one noisy player.
console.log('\n10. archetype centres — every player below is an identical 80 Overall\n');
{
  const r = rng(2026), N = 500;
  for (const pos of POSITIONS) {
    const keys = posAttrs(pos).filter(k => k !== 'adp').sort((x, y) => posAttrW(pos)[y] - posAttrW(pos)[x]);
    console.log(`   ${pos}`);
    for (const a of ARCHETYPES[pos]) {
      const acc = {}; keys.forEach(k => acc[k] = 0);
      for (let i = 0; i < N; i++) { const p = genAttrs(r, 80, pos, 15, a); keys.forEach(k => acc[k] += p[k]); }
      const shown = keys.map(k => `${k} ${String(Math.round(acc[k] / N)).padStart(2)}`).join(' ');
      console.log(`     ${a.n.padEnd(15)} ${String(a.f).padStart(2)}% | ${shown}`);
    }
  }
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);

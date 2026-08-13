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
function genAttrs(r, ov0, pos, spread) {
  const w = posAttrW(pos), keys = Object.keys(w), sp = spread == null ? 15 : spread;
  const t = {};
  for (const k of keys) {
    const rel = clamp(w[k] * keys.length, 0, 2);
    // an attribute the position barely uses also barely VARIES — nobody develops it either way
    const s = sp * (0.35 + 0.65 * Math.min(rel, 1.4) / 1.4);
    t[k] = anchorOff(w, keys, k) + (r() + r() - 1) * s;
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

// 7. sample sheets — the eyeball test
console.log('\n7. sample generated players (prestige-78 program)\n');
{
  const r = rng(2026);
  for (const pos of POSITIONS) {
    const ov = clamp(Math.round(78 * 0.55 + ri(r, -9, 9) + 30), 48, 99);
    const p = Object.assign({ pos }, genAttrs(r, ov, pos));
    const shown = posAttrs(pos).filter(k => k !== 'adp')
      .sort((a, b) => posAttrW(pos)[b] - posAttrW(pos)[a])
      .map(k => `${k} ${String(p[k]).padStart(2)}`).join('  ');
    console.log(`   ${pos.padEnd(3)} ov ${String(ovrBase(p)).padStart(2)}  adp ${String(p.adp).padStart(2)} | ${shown}`);
  }
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);

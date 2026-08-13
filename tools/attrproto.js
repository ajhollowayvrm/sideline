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

/* GENETIC vs COACHABLE. The five below are what a player showed up with; everything else in the
   vocabulary is technique or recognition and can be taught. The distinction drives two things: how a
   profile fills in as a player approaches elite (see genAttrs), and — once this ships — development,
   where a 22-year-old should get smarter and more technically sound rather than faster. */
const PHYSICAL = { spd:1, acc:1, agi:1, str:1, dur:1 };
const PHYS_ABSORB = 0.18;   // how much of an upward correction a physical attribute will take
const ELITE_DIV = 2.6;      // how hard an archetype shape amplifies with ability on low-weight attrs

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
    { n:'Pocket Passer',  f:22, x:'Joe Burrow',          w:{tha:10, thp:7, iq:3, str:3, elu:2, spd:-10, acc:-9, agi:-7, tor:-4} },
    { n:'Field General',  f:18, x:'Alex Smith',          w:{iq:12, awr:11, car:4, tha:2, thp:-10, spd:-6, acc:-5, elu:-4, tor:-4} },
    { n:'Gunslinger',     f:15, x:'Brett Favre',         w:{thp:10, tor:6, elu:3, agi:3, spd:2, tha:-5, awr:-6, iq:-5} },
    // NOT a lesser Field General: he protects the ball rather than elevating the offence, so `car`
    // is his one elite trait and `iq` sits BELOW average. Without that he was a Field General copy.
    { n:'Game Manager',   f:13, x:'AJ McCarron',         w:{car:13, awr:3, tha:2, thp:-9, iq:-5, spd:-5, acc:-4, elu:-4, agi:-3, tor:-3} },
    { n:'Dual-Threat',    f:13, x:'Lamar Jackson',       w:{spd:11, acc:9, agi:7, elu:5, tor:4, tha:-6, thp:-3, iq:-5} },
    { n:'Scrambler',      f:12, x:'Johnny Manziel',      w:{tor:8, elu:9, agi:6, acc:3, iq:-6, awr:-5, thp:-2, str:-3} },
    { n:'Cannon',         f:7,  x:'Josh Allen (Wyoming)',w:{thp:14, tor:5, tha:-8, awr:-6, iq:-6, car:-4} },
  ],
  RB: [
    { n:'Receiving Back', f:20, x:'Christian McCaffrey', w:{cth:10, rte:9, pbk:5, awr:4, btk:-6, str:-6} },
    { n:'Power Back',     f:20, x:'Derrick Henry',       w:{str:9, btk:10, rbk:4, pbk:4, spd:-6, acc:-4, agi:-6, elu:-7} },
    { n:'Scat Back',      f:17, x:'Darren Sproles',      w:{elu:10, agi:9, acc:6, str:-8, btk:-8, pbk:-4} },
    { n:'One-Cut Runner', f:15, x:'Terrell Davis',       w:{awr:10, acc:9, agi:5, elu:-7, btk:-5, cth:-4} },
    { n:'Home-Run Hitter',f:14, x:'Chris Johnson',       w:{spd:12, acc:8, elu:4, str:-5, awr:-5, pbk:-5, car:-4} },
    { n:'Workhorse',      f:14, x:'Emmitt Smith',        w:{dur:10, car:9, str:5, awr:4, elu:-6, spd:-5, acc:-4} },
  ],
  WR: [
    { n:'Possession',     f:20, x:'Hunter Renfrow',      w:{cth:9, rte:8, awr:5, spd:-7, acc:-6, elu:-4} },
    { n:'Slot Technician',f:18, x:'Wes Welker',          w:{rte:10, agi:9, acc:5, awr:4, str:-8, btk:-7} },
    { n:'Deep Threat',    f:17, x:'Henry Ruggs III',     w:{spd:11, acc:9, rte:3, str:-6, cth:-4, btk:-6} },
    { n:'Contested X',    f:15, x:'Mike Evans',          w:{str:11, cth:5, btk:6, agi:-7, acc:-6, elu:-6, spd:-7} },
    { n:'YAC Weapon',     f:14, x:'Deebo Samuel',        w:{elu:10, btk:9, acc:5, rte:-6, cth:-5, awr:-4} },
    { n:'Gadget',         f:9,  x:'Cordarrelle Patterson', w:{elu:10, btk:5, acc:6, spd:6, cth:-9, rte:-10} },
    { n:'Blocking WR',    f:7,  x:'Hines Ward',          w:{str:10, awr:6, cth:-7, rte:-6, elu:-4, acc:-3} },
  ],
  TE: [
    { n:'Receiving F',    f:24, x:'Kyle Pitts',          w:{cth:10, rte:9, spd:5, rbk:-9, pbk:-7, str:-5} },
    { n:'Move H-Back',    f:22, x:'Evan Engram',         w:{agi:6, acc:6, cth:4, rbk:3, elu:3, str:-6, btk:-4} },
    { n:'Blocking Y',     f:22, x:'Marcedes Lewis',      w:{rbk:10, pbk:9, str:5, cth:-7, rte:-8, spd:-5, elu:-4} },
    { n:'Seam Stretcher', f:16, x:'Vernon Davis',        w:{spd:11, cth:5, rte:5, rbk:-10, pbk:-6, str:-6} },
    { n:'Complete TE',    f:16, x:'George Kittle',       w:{cth:2, rbk:2, pbk:2, rte:1, str:1, spd:-2, elu:-3, btk:-2} },
  ],
  OT: [
    { n:'Pass Protector', f:26, x:'Jonathan Ogden',      w:{pbk:9, agi:7, awr:4, str:-6, rbk:-7} },
    { n:'Mauler',         f:24, x:'Orlando Pace',        w:{str:9, rbk:9, agi:-7, pbk:-5, acc:-5} },
    { n:'Zone Athlete',   f:22, x:'Rashawn Slater',      w:{agi:8, acc:8, spd:5, rbk:4, str:-8, pbk:-3} },
    { n:'Technician',     f:16, x:'Joe Thomas',          w:{awr:10, pbk:5, str:-6, agi:-5, acc:-4} },
    { n:'Raw Project',    f:12, x:'Lane Johnson',        w:{agi:8, acc:8, str:6, awr:-11, pbk:-6, rbk:-5} },
  ],
  OG: [
    { n:'Mauler',         f:28, x:'Larry Allen',         w:{str:8, rbk:9, agi:-8, acc:-7} },
    { n:'Anchor',         f:22, x:'Zack Martin',         w:{pbk:9, str:4, awr:5, spd:-5, agi:-6} },
    { n:'Puller',         f:20, x:'Steve Hutchinson',    w:{agi:9, acc:9, spd:5, str:-6, rbk:-3} },
    { n:'Technician',     f:18, x:'Marshal Yanda',       w:{awr:10, pbk:5, str:-6, agi:-5, acc:-4} },
    { n:'Raw Project',    f:12, x:'Kelechi Osemele',     w:{str:9, agi:6, awr:-11, rbk:-5, pbk:-5} },
  ],
  C: [
    { n:'Field General',  f:30, x:'Jason Kelce',         w:{iq:9, awr:7, pbk:4, str:-6, agi:-3} },
    { n:'Mauler',         f:26, x:'Frank Ragnow',        w:{str:8, rbk:9, iq:-6, agi:-6} },
    { n:'Zone Snapper',   f:24, x:'Alex Mack',           w:{agi:8, acc:6, iq:3, str:-7, rbk:-4} },
    { n:'Anchor',         f:20, x:'Creed Humphrey',      w:{str:10, pbk:5, agi:-7, acc:-6} },
  ],
  DE: [
    { n:'Speed Rusher',   f:25, x:'Von Miller',          w:{prs:9, acc:9, agi:6, spd:5, str:-8, rst:-7} },
    { n:'Bull Rusher',    f:23, x:'J.J. Watt',           w:{str:10, prs:5, rst:5, acc:-7, agi:-6, spd:-5} },
    { n:'Run Stopper',    f:22, x:'Calais Campbell',     w:{rst:10, str:5, tkl:6, prs:-8, acc:-5} },
    { n:'Edge Bender',    f:17, x:'Dwight Freeney',      w:{agi:10, acc:9, prs:5, str:-10, rst:-7} },
    { n:'Hand Fighter',   f:13, x:'Cameron Jordan',      w:{awr:11, prs:5, rst:4, acc:-6, agi:-5, str:-5} },
  ],
  DT: [
    { n:'Nose Tackle',    f:25, x:'Vince Wilfork',       w:{str:8, rst:9, prs:-7, acc:-6, agi:-6, spd:-4} },
    { n:'3-Tech',         f:23, x:'Warren Sapp',         w:{prs:10, acc:8, agi:6, str:-6, rst:-6} },
    { n:'Two-Gap Anchor', f:22, x:'Haloti Ngata',        w:{str:5, rst:5, awr:6, tkl:4, acc:-4, agi:-4} },
    { n:'Interior Freak', f:16, x:'Ndamukong Suh',       w:{str:10, acc:9, prs:5, awr:-10, rst:-4} },
    { n:'Technician',     f:14, x:'Grady Jarrett',       w:{awr:11, rst:5, str:-6, acc:-5, agi:-4} },
  ],
  LB: [
    { n:'Thumper',        f:22, x:'Patrick Willis',      w:{tkl:9, str:8, rst:6, zcv:-7, mcv:-7, spd:-4, acc:-4} },
    { n:'Coverage LB',    f:22, x:'Luke Kuechly',        w:{zcv:9, mcv:9, cth:5, spd:5, acc:4, str:-7, rst:-6, tkl:-5} },
    { n:'Field General',  f:22, x:'Bobby Wagner',        w:{iq:10, awr:9, rst:4, spd:-5, prs:-6, acc:-4} },
    { n:'Blitzer',        f:18, x:'Micah Parsons',       w:{prs:11, acc:7, str:4, zcv:-7, mcv:-7, cth:-4} },
    { n:'Sideline-to-Sideline', f:16, x:'Roquan Smith',  w:{spd:11, acc:9, agi:6, str:-8, rst:-6, tkl:-3} },
  ],
  CB: [
    { n:'Zone Corner',    f:24, x:'Richard Sherman',     w:{zcv:9, awr:8, cth:5, mcv:-7, str:-5, spd:-3} },
    { n:'Burner',         f:22, x:'Deion Sanders',       w:{spd:10, acc:8, mcv:4, tkl:-6, str:-6, awr:-6} },
    { n:'Press Corner',   f:22, x:'Jalen Ramsey',        w:{mcv:9, str:7, agi:5, zcv:-8, awr:-5} },
    { n:'Slot Corner',    f:18, x:'Chris Harris Jr.',    w:{agi:10, tkl:6, zcv:5, awr:4, spd:-7, str:-6} },
    { n:'Ball Hawk',      f:14, x:'Trevon Diggs',        w:{cth:11, zcv:5, awr:5, mcv:-6, tkl:-6, str:-4} },
  ],
  FS: [
    { n:'Center Fielder', f:30, x:'Earl Thomas',         w:{zcv:9, spd:8, awr:5, tkl:-7, str:-6, mcv:-5} },
    { n:'Ball Hawk',      f:26, x:'Ed Reed',             w:{cth:10, zcv:5, awr:5, iq:4, tkl:-7, str:-6} },
    { n:'Nickel Hybrid',  f:24, x:'Minkah Fitzpatrick',  w:{mcv:10, agi:6, acc:6, zcv:-6, str:-5, tkl:-4} },
    { n:'Robber',         f:20, x:'Harrison Smith',      w:{awr:10, iq:9, mcv:4, tkl:4, spd:-8, zcv:-6} },
  ],
  SS: [
    { n:'Box Enforcer',   f:30, x:'Kam Chancellor',      w:{tkl:9, str:9, zcv:-7, spd:-5, cth:-6} },
    { n:'Hybrid LB/S',    f:26, x:'Derwin James',        w:{tkl:6, mcv:5, str:5, iq:5, spd:-5, zcv:-6} },
    { n:'Coverage SS',    f:24, x:'Justin Simmons',      w:{mcv:9, zcv:6, cth:6, str:-7, tkl:-7} },
    { n:'Deep Half',      f:20, x:'Jessie Bates III',    w:{zcv:10, spd:6, awr:5, tkl:-8, str:-6, mcv:-5} },
  ],
  K: [
    { n:'Big Leg',        f:50, x:'Sebastian Janikowski',w:{kpw:9, kac:-6} },
    { n:'Precision',      f:50, x:'Adam Vinatieri',      w:{kac:7, kpw:-9} },
  ],
  P: [
    { n:'Boomer',         f:50, x:'Ray Guy',             w:{kpw:8, kac:-8} },
    { n:'Coffin Corner',  f:50, x:'Johnny Hekker',       w:{kac:9, kpw:-7} },
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
   migration, and for a player whose development has drifted him away from where he started.

   Uses COSINE similarity between the player's deviation vector and the archetype's offset vector,
   not weighted Euclidean distance. Weighted distance was measured badly wrong: because it scales
   each term by POS_ATTR_W, the defining attributes drown out exactly the low-weight ones that
   separate neighbours — an LB Blitzer is a Blitzer because of `prs`, which carries weight .03. The
   result was archetypes classifying to literally 0% (Run Stopper, Blitzer, YAC Weapon, Gadget) while
   central ones swallowed the field (Complete TE took 63% against an intended 16%).

   Cosine is direction-only, so it asks "is this the SHAPE of a Blitzer?" rather than "is this player
   near the Blitzer point?", and it is scale-invariant — which matters now that purity (below) makes
   shape magnitude a per-player property. */
function classifyArch(p) {
  const list = ARCHETYPES[p.pos]; if (!list) return null;
  const w = posAttrW(p.pos), keys = Object.keys(w);
  const sw = keys.reduce((s, k) => s + w[k], 0) || 1;
  let mean = 0; for (const k of keys) mean += w[k] * attrVal(p, k); mean /= sw;
  // Subtract the POSITIONAL BASELINE first. Every quarterback carries the same anchor shape (low
  // str/car/btk, high tha/iq) whatever his archetype, and that shared component dominates a raw
  // cosine — measured, it dragged recovery of a strongly-expressed archetype down to 54.8%. What
  // identifies an archetype is the residual AFTER the position's own shape is removed.
  const elite = clamp((mean - 72) / 27, 0, 1);
  const amp = {};
  for (const k of keys) { const rel = clamp(w[k] * keys.length, 0, 2); amp[k] = 1 + elite * ELITE_DIV * Math.max(0, 1 - rel); }
  const dev = {}; let dn = 0;
  for (const k of keys) { dev[k] = attrVal(p, k) - mean - anchorOff(w, keys, k) * amp[k]; dn += dev[k] * dev[k]; }
  dn = Math.sqrt(dn) || 1;
  let best = null, bestS = -Infinity;
  for (const a of list) {
    let dot = 0, an = 0;
    for (const k of keys) { const e = a.off[k] * amp[k]; dot += dev[k] * e; an += e * e; }
    const s = dot / (dn * (Math.sqrt(an) || 1));
    if (s > bestS) { bestS = s; best = a; }
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
function genAttrs(r, ov0, pos, spread, arch, purity) {
  const w = posAttrW(pos), keys = Object.keys(w), sp = spread == null ? 15 : spread;
  const t = {};
  // PURITY — how strongly this player embodies his archetype. Without it the only within-archetype
  // variation is independent per-attribute noise, so every Pocket Passer is the SAME SHAPE at a
  // different level and the archetype list is 71 fixed templates scaled up and down.
  //
  // Purity makes the variation run ALONG the archetype axis instead: a 0.5 Pocket Passer is a
  // quarterback who merely leans that way and can move a bit, a 1.5 is an immobile savant. It also
  // explains tweeners honestly — a low-purity player genuinely sits between two archetypes rather
  // than being a mis-generated one — and it feeds the mixture argument in §9a, since high-purity
  // extremes are what give a roster a distinctive outcome variance.
  const pur = purity != null ? purity : (arch ? clamp(0.35 + (r() + r() + r()) / 3 * 1.5, 0.3, 1.7) : 0);
  // The independent draw shrinks, because purity now carries most of the within-archetype spread.
  const ind = arch ? 0.42 : 1;
  // ELITE DIVERGENCE. An elite player cannot carry a hole in something his position is BUILT on —
  // a 97 quarterback is never an inaccurate one, because `tha` is 20% of the row and the weighted
  // mean would not survive it. But he can be genuinely, famously slow, because `spd` is 5% and the
  // mean barely notices. That is exactly why Brady's forty time was irrelevant to his rating and his
  // accuracy was not.
  //
  // So the archetype's shape AMPLIFIES with ability, and only where the row can afford it: strongly
  // on low-weight attributes, not at all on the defining ones. Without this the offsets are absolute
  // (~±10) while the level scales, so every attribute tracks Overall and elite players converge into
  // the same complete player — measured spread collapsing 26.9 -> 12.2 from ov 75 to 97.
  const elite = clamp((ov0 - 72) / 27, 0, 1);
  for (const k of keys) {
    const rel = clamp(w[k] * keys.length, 0, 2);
    // an attribute the position barely uses also barely VARIES — nobody develops it either way
    const s = sp * (0.35 + 0.65 * Math.min(rel, 1.4) / 1.4) * ind;
    const amp = 1 + elite * ELITE_DIV * Math.max(0, 1 - rel);
    t[k] = (anchorOff(w, keys, k) + (arch ? arch.off[k] * pur : 0)) * amp + (r() + r() - 1) * s;
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
  //
  // ...but NOT evenly. As a player approaches elite his best attributes hit the 99 ceiling and the
  // residual has to land somewhere; left alone it lands on whatever has room, which is always the
  // physical attributes. That turned a 97-overall Pocket Passer into a 88-speed athlete — measured
  // spread collapsing 26.9 -> 12.2 between ov 75 and 97. Half of that is real (the weighted row must
  // average to his Overall, so nobody reaches 97 carrying a genuine hole) and half is an artifact of
  // the ceiling.
  //
  // Elite players converge on what is LEARNABLE — accuracy, technique, recognition. They do not
  // converge on what is GENETIC. Brady never got fast. So physical attributes resist absorbing the
  // residual, and the holes fill in on the coachable side first. This is the generation-time twin of
  // the directive behind Phase 51's one-on-one clause: "a lack of speed can be overcome, but in
  // certain one-on-one situations it can't be."
  const out = {};
  for (const k of keys) out[k] = ov0 + t[k];
  const sw = keys.reduce((s, k) => s + w[k], 0) || 1;
  for (let pass = 0; pass < 8; pass++) {
    let m = 0; for (const k of keys) m += w[k] * clamp(out[k], 40, 99);
    const err = ov0 - m / sw;
    if (Math.abs(err) < 1e-6) break;
    // share of the correction this attribute is willing to take. Physical attributes take only
    // PHYS_ABSORB of a LIFT (they stay where the archetype put them); everything absorbs a drop
    // normally, since being worse is not a genetic question.
    const share = k => (err > 0 && PHYSICAL[k]) ? PHYS_ABSORB : 1;
    let room = 0;
    for (const k of keys) { const v = clamp(out[k], 40, 99); if ((err > 0 && v < 99) || (err < 0 && v > 40)) room += w[k] * share(k); }
    if (!room) break;
    for (const k of keys) { const v = clamp(out[k], 40, 99); if ((err > 0 && v < 99) || (err < 0 && v > 40)) out[k] = v + err * sw * share(k) / room; }
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
  let worstOv = 0;
  // Recovery is measured BY PURITY, because purity is what "how much of this archetype is he?"
  // means. A 0.4-purity Pocket Passer is a genuine tweener and SHOULD often classify elsewhere;
  // demanding otherwise would just be demanding that purity do nothing.
  const band = pur => {
    let hit = 0, tot = 0;
    for (const pos of POSITIONS) for (const a of ARCHETYPES[pos]) for (let i = 0; i < 200; i++) {
      const ov = ri(r, 50, 95);
      const p = Object.assign({ pos }, genAttrs(r, ov, pos, 15, a, pur));
      worstOv = Math.max(worstOv, Math.abs(ovrBase(p) - ov));
      if (classifyArch(p) === a) hit++; tot++;
    }
    return hit / tot * 100;
  };
  const pure = band(1.4), mid = band(1.0), vague = band(0.4);
  ok(worstOv === 0, `ovrBase drifted by ${worstOv} when generating from an archetype`);
  console.log(`   recovery by purity — 1.4: ${pure.toFixed(1)}%   1.0: ${mid.toFixed(1)}%   0.4: ${vague.toFixed(1)}%`);
  ok(pure > 75, `a STRONGLY expressed archetype only classified back ${pure.toFixed(1)}% of the time`);
  ok(pure > vague + 15, `purity barely changed recognisability (${pure.toFixed(1)}% vs ${vague.toFixed(1)}%) — it is not doing its job`);
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

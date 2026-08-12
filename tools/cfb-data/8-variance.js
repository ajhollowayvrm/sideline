/* Step 8 — decompose the sim's game-to-game variance.
   `form` (the per-game hot/cold term) is one source; per-play randomness is the other.
   Sweeps the form multiplier (8 = shipping) and reports the resulting residual SD + tail shape,
   so the tuning target from 7-upsets.js (real: SD 13.26, excess kurtosis +0.32) is reachable
   with a known knob rather than a guess. */
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
const FORM_LINE = "const form={[home.id]:(r()+r()+r()-1.5)*8, [away.id]:(r()+r()+r()-1.5)*8};";
if (ENGINE.indexOf(FORM_LINE) < 0) { console.error('form line not found — engine changed, update this script'); process.exit(2); }

/* synthetic world (identical to simlab / 4-simprofile) */
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3], ["DE", "def", 6], ["DT", "def", 6],
["LB", "def", 10], ["CB", "def", 9], ["S", "def", 8], ["K", "st", 2], ["P", "st", 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
function buildWorld() {
  const r = rng(0x5eed), teams = [];
  for (let i = 0; i < 134; i++) {
    const prestige = clamp(Math.round(35 + ri(r, -15, 15) + (i < 16 ? 25 : i < 40 ? 12 : 0)), 20, 98);
    const out = [];
    POS.forEach(([code, , n]) => { for (let k = 0; k < n; k++)
      out.push({ id: 'p' + Math.floor(r() * 1e9).toString(36), pos: code, ov: clamp(Math.round(prestige * 0.55 + ri(r, -9, 9) + 30), 48, 99), so: 0 }); });
    const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
    Object.values(byPos).forEach(arr => { arr.sort((a, b) => b.ov - a.ov);
      arr.forEach((p, i2) => { if (i2 >= 2) p.ov = clamp(Math.round(p.ov - Math.min(2 + (i2 - 2) * 2.6, 26)), 44, 99); p.so = i2; }); });
    const grp = s => out.filter(p => sideOf[p.pos] === s);
    const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
    teams.push({ id: 't' + i, abbr: 'T' + i, prestige, roster: out, ratings: { off: avgTop(grp('off'), 11), def: avgTop(grp('def'), 11) } });
  }
  return teams;
}
const world = buildWorld();
const slate = [];
for (let i = 0; i < world.length; i++) for (let d = 1; d <= 15; d++)
  slate.push({ id: 'g' + i + '_' + d, home: world[i], away: world[(i + d) % world.length] });

const stats = a => {
  const n = a.length, m = a.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / n);
  const ku = a.reduce((s, x) => s + ((x - m) / sd) ** 4, 0) / n - 3;
  return { m, sd, ku };
};
function runWith(src, label) {
  // build in a fresh scope so each variant gets its own simEngine
  const simEngine = new Function('rng', 'ri', 'clamp', 'pick', 'compVal', 'compDraw', 'compClutch', 'schemeTendency',
    src + '\nreturn simEngine;')(rng, ri, clamp, pick, compVal, compDraw, compClutch, schemeTendency);
  const rows = [];
  for (const g of slate) {
    const res = simEngine(g.home, g.away, (hashStr(g.id) ^ 0x5ca1ab1e) >>> 0);
    rows.push({ hid: g.home.id, aid: g.away.id, hs: res.hs, as: res.as });
  }
  // retrodictive rating on these results
  const HFA = 2.4, R = {}; world.forEach(t => R[t.id] = 0);
  const cap = x => Math.max(-28, Math.min(28, x));
  for (let it = 0; it < 60; it++) {
    const s = {}, c = {}; world.forEach(t => { s[t.id] = 0; c[t.id] = 0; });
    for (const g of rows) { const m = cap(g.hs - g.as);
      s[g.hid] += (m - HFA) + R[g.aid]; c[g.hid]++; s[g.aid] += (-m + HFA) + R[g.hid]; c[g.aid]++; }
    world.forEach(t => { if (c[t.id]) R[t.id] = s[t.id] / c[t.id]; });
    const mu = world.reduce((a, t) => a + R[t.id], 0) / world.length;
    world.forEach(t => R[t.id] -= mu);
  }
  const fav = rows.map(g => { const exp = R[g.hid] - R[g.aid] + HFA, sp = Math.abs(exp);
    const fm = exp > 0 ? (g.hs - g.as) : (g.as - g.hs); return { resid: fm - sp, spread: sp, fm }; });
  const st = stats(fav.map(r => r.resid));
  const pts = rows.reduce((a, g) => a + g.hs + g.as, 0) / rows.length / 2;
  const blow = fav.filter(r => r.spread >= 7 && r.fm <= -14).length / rows.length * 790;
  const mid = fav.filter(r => r.spread >= 10.5 && r.spread < 14);
  const midUps = mid.length ? mid.filter(r => r.fm < 0).length / mid.length * 100 : 0;
  console.log(`  ${label.padEnd(24)} SD ${st.sd.toFixed(2).padStart(6)}   kurt ${st.ku.toFixed(2).padStart(6)}   `
    + `pts/tm ${pts.toFixed(1).padStart(5)}   blowout-upsets/season ${blow.toFixed(1).padStart(5)}   fav loses @10.5-14 ${midUps.toFixed(1).padStart(5)}%`);
  return st;
}

console.log('\n' + '='.repeat(104));
console.log('WHERE THE SIM\'S VARIANCE COMES FROM — sweeping the per-game `form` term');
console.log('='.repeat(104));
console.log('  TARGET (real FBS):       SD  13.26   kurt  +0.32   pts/tm  26.9   blowout-upsets/season   5.8   fav loses @10.5-14   9.5%\n');
for (const mult of [0, 2, 4, 6, 8, 10]) {
  const src = ENGINE.replace(FORM_LINE, FORM_LINE.split('*8').join('*' + mult));
  runWith(src, mult === 8 ? `form ×${mult}  (SHIPPING)` : `form ×${mult}`);
}

/* mixture: mostly calm, occasionally a "nothing went right" game — reproduces fat tails
   while NARROWING the core, which is the shape the real data actually has. */
console.log('\n  A MIXTURE instead of one Gaussian — calm core + a rare blow-up game:');
console.log('  (p = chance a team has a wild day; the draw uses the same 3 uniforms, so no new rng)\n');
for (const [p, wild, calm] of [[0.05, 22, 4], [0.07, 20, 4], [0.10, 18, 3.5], [0.12, 16, 3.5]]) {
  const line = `const _fw=t=>{const a=r(),b=r(),c=r();return (a+b+c-1.5)*(c<${p}?${wild}:${calm});};`
    + `const form={[home.id]:_fw(), [away.id]:_fw()};`;
  const src = ENGINE.replace(FORM_LINE, line);
  runWith(src, `mix p=${p} wild=${wild} calm=${calm}`);
}
console.log('');

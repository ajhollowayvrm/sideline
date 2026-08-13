/* Step 15 — fit the Phase 49 penalty model (the PN block) to the measured targets in
   docs/reference/cfb-penalties.md.

   Three things get fitted, in order, because they're nearly independent:
     1. PN.base.*   — the four per-snap family rates, scaled to hit the measured per-game split.
                      Iterated, because penalties replay downs and therefore create more snaps.
     2. PN.compK    — how hard composure presses, chosen so the TRUE team-level sd (noise-corrected
                      the same way the real data was) lands on the measured 0.95.
     3. PN.ydsScale — closes the remaining gap to 52.4 penalty yards per team-game.

   Run with --apply to write the fitted constants back into index.html's PN block.
   Output: penfit-result.txt */
const fs = require('fs'), path = require('path');
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const HTML = path.join(__dirname, '..', '..', 'index.html');
const html = fs.readFileSync(HTML, 'utf8');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); return html.slice(i, j); };
eval(grab('// === TRAIT ENGINE (Phase 10) START ===', '// === TRAIT ENGINE (Phase 10) END ==='));
eval(grab('// === SCHEME ENGINE (Phase 21) START ===', '// === SCHEME ENGINE (Phase 21) END ==='));
// eval returns the value of its last expression, so this hands back the very same PN object that
// simEngine closes over — fitting means mutating it in place and re-running.
const PN = eval(grab('// === SIM ENGINE (Phase 3) START ===', '// === SIM ENGINE (Phase 3) END ===') + '\n;PN');

/* ---- measured targets (docs/reference/cfb-penalties.md) ---- */
const TARGET = {
  total: 5.98, yards: 52.4, trueSd: 0.95,
  fam: { offPre: 2.30, offLive: 1.60, defPre: 0.64, defLive: 1.45 },
  offShare: 65.1, preShare: 49.1, firstDown: 28.8, fsTop1: 44.7,
};
const FAMOF = {}; PN.fouls.forEach(f => FAMOF[f[0]] = f[2] + (f[3] === 'pre' ? 'Pre' : 'Live'));
const A1 = {}; PN.fouls.forEach(f => A1[f[0]] = !!f[5]);

/* ---- synthetic league, real traits (mirrors 14-simpens.js / test/simlab.js) ---- */
const POS = [["QB", "off", 4], ["RB", "off", 5], ["WR", "off", 11], ["TE", "off", 5],
["OT", "off", 7], ["OG", "off", 6], ["C", "off", 3],
["DE", "def", 6], ["DT", "def", 6], ["LB", "def", 10], ["CB", "def", 9], ["S", "def", 8],
["K", "st", 2], ["P", "st", 2]];
const sideOf = {}; POS.forEach(([c, s]) => sideOf[c] = s);
let UID = 0;
function genRoster(r, prestige) {
  const out = [];
  POS.forEach(([code, , n]) => { for (let i = 0; i < n; i++) { const tr = genTraits(r);
    // a UNIQUE surname per player: the engine's nm() falls back to the position code when a player
    // has no name, which would collapse every tackle into one "offender" and make the concentration
    // measurement meaningless
    out.push({ id: 'p' + Math.floor(r() * 1e9).toString(36), fn: 'A', ln: 'p' + (++UID), pos: code, ov: clamp(Math.round(prestige * 0.55 + ri(r, -9, 9) + 30), 48, 99), so: 0, mot: tr.mot, comp: tr.comp, ego: tr.ego }); } });
  const byPos = {}; out.forEach(p => (byPos[p.pos] = byPos[p.pos] || []).push(p));
  Object.values(byPos).forEach(arr => { arr.sort((a, b) => b.ov - a.ov);
    arr.forEach((p, i) => { if (i >= 2) p.ov = clamp(Math.round(p.ov - Math.min(2 + (i - 2) * 2.6, 26)), 44, 99); p.so = i; }); });
  return out;
}
function teamRatings(roster) {
  const grp = s => roster.filter(p => sideOf[p.pos] === s);
  const avgTop = (arr, k) => { const s = [...arr].sort((a, b) => b.ov - a.ov).slice(0, k); return Math.round(s.reduce((t, p) => t + p.ov, 0) / s.length); };
  const off = avgTop(grp('off'), 11), def = avgTop(grp('def'), 11);
  return { off, def, ovr: Math.round((off + def) / 2) };
}
const world = (() => { const r = rng(0x5eed), teams = [];
  for (let i = 0; i < 134; i++) { const prestige = clamp(Math.round(35 + ri(r, -15, 15) + (i < 16 ? 25 : i < 40 ? 12 : 0)), 20, 98);
    const roster = genRoster(r, prestige);
    teams.push({ id: 't' + i, abbr: 'T' + i, prestige, roster, ratings: teamRatings(roster) }); }
  return teams; })();
const slate = [];
for (let i = 0; i < world.length; i++) for (let d = 1; d <= 15; d++)
  slate.push({ id: 'g' + i + '_' + d, home: world[i], away: world[(i + d) % world.length] });

const mean = (a, k) => a.reduce((s, x) => s + (typeof k === 'function' ? k(x) : x[k]), 0) / a.length;
const sd = (a, k) => { const m = mean(a, k), g = x => (typeof k === 'function' ? k(x) : x[k]);
  return Math.sqrt(a.reduce((s, x) => s + (g(x) - m) ** 2, 0) / a.length); };
const f = (x, d = 2) => (x == null || !isFinite(x) ? '—' : x.toFixed(d));

/* ---- one full pass over the slate ---- */
function measure() {
  const rows = [], byTeam = {}; world.forEach(t => byTeam[t.id] = { n: 0, pen: 0, g: 0 });
  const fam = { offPre: 0, offLive: 0, defPre: 0, defLive: 0 };
  let flags = 0, offFlags = 0, preFlags = 0, fdFlags = 0, plays = 0, cbTD = 0, logFlags = 0;
  const fsBy = {};   // teamId -> {player: false starts} over a 12-game window (a real season)
  for (const g of slate) {
    const seed = (hashStr(g.id) ^ 0x5ca1ab1e) >>> 0;
    const pen = {}, box = {};
    const res = simEngine(g.home, g.away, seed, { penInto: pen, boxInto: box, log: true });
    for (const t of [g.home, g.away]) {
      const p = pen[t.id] || { n: 0, yds: 0, t: {} };
      rows.push({ pen: p.n, yds: p.yds });
      const b = byTeam[t.id]; b.n++; b.pen += p.n;
      for (const k in (p.t || {})) { const c = p.t[k]; flags += c; fam[FAMOF[k]] += c;
        if (FAMOF[k].startsWith('off')) offFlags += c;
        if (FAMOF[k].endsWith('Pre')) preFlags += c; }
    }
    for (const l of res.log || []) {
      if (l.kind === 'play' || l.kind === 'score') plays++;
      if (/COMES BACK/.test(l.text)) cbTD++;
      if (l.text.indexOf('🚩') !== 0) continue;
      logFlags++;
      if (/1ST DOWN/.test(l.text)) fdFlags++;      // every flag that actually produced a first down,
                                                   // incl. offside on 3rd-and-4 — not just the automatics
      // false-start concentration, over each team's FIRST 12 games only, so it compares like-for-like
      // with a real 12-game season rather than benefiting from a 30-game sample
      if (/False start/.test(l.text) && byTeam[l.team] && byTeam[l.team].g < 12) {
        const m = l.text.match(/— ([^(]+)\(/);
        if (m) ((fsBy[l.team] = fsBy[l.team] || {}))[m[1].trim()] = (fsBy[l.team][m[1].trim()] || 0) + 1;
      }
    }
    byTeam[g.home.id].g++; byTeam[g.away.id].g++;
  }
  const N = rows.length, gpg = byTeam[world[0].id].n;
  const seasons = Object.values(byTeam).map(b => b.pen / b.n);
  const withinSd = sd(rows, 'pen'), seasonSd = sd(seasons, x => x);
  const trueSd = Math.sqrt(Math.max(0, seasonSd ** 2 - withinSd ** 2 / gpg));
  const conc = Object.values(fsBy).map(m => { const c = Object.values(m).sort((a, b) => b - a), tot = c.reduce((a, x) => a + x, 0);
    return tot >= 8 ? c[0] / tot : null; }).filter(x => x != null);
  return {
    total: mean(rows, 'pen'), yards: mean(rows, 'yds'), sdGame: withinSd, trueSd,
    fam: { offPre: fam.offPre / N, offLive: fam.offLive / N, defPre: fam.defPre / N, defLive: fam.defLive / N },
    offShare: offFlags / flags * 100, preShare: preFlags / flags * 100, fdShare: fdFlags / logFlags * 100,
    fsTop1: conc.length ? mean(conc, x => x) * 100 : 0, cbTD: cbTD / slate.length,
    plays: plays / N, seasons: seasons.sort((a, b) => a - b),
  };
}

const out = [], say = s => { out.push(s); console.log(s); };

/* ---- 1+2. base rates and compK interact (exp() is convex, so steepening composure lifts the mean),
       so alternate them for a couple of rounds instead of fitting each once. ---- */
let lo = 12, hi = 70;
for (let round = 1; round <= 2; round++) {
  say(`round ${round} — PN.base (family rates) …`);
  for (let it = 0; it < 3; it++) {
    const m = measure(); let worst = 0;
    for (const k in TARGET.fam) { const ratio = TARGET.fam[k] / Math.max(0.01, m.fam[k]);
      worst = Math.max(worst, Math.abs(1 - ratio)); PN.base[k] *= ratio; }
    say(`  pass ${it + 1}: total ${f(m.total)} (target ${TARGET.total})  ` +
      Object.keys(TARGET.fam).map(k => `${k} ${f(m.fam[k])}`).join(' ') + `   worst ${f(worst * 100, 1)}%`);
    if (worst < 0.01) break;
  }
  say(`round ${round} — PN.compK (team-to-team spread) …`);
  for (let it = 0; it < 5; it++) {
    PN.compK = (lo + hi) / 2;
    const m = measure();
    say(`  compK ${f(PN.compK, 1)} → true team sd ${f(m.trueSd)} (target ${TARGET.trueSd})`);
    if (m.trueSd > TARGET.trueSd) lo = PN.compK; else hi = PN.compK;   // smaller compK = steeper = wider
  }
  PN.compK = Math.round((lo + hi) / 2 * 10) / 10;
  lo = PN.compK * 0.85; hi = PN.compK * 1.15;
}

/* ---- 3. gamma: how concentrated the blame is. Orthogonal to the rate (poolProp doesn't see it),
       so it fits on its own against the measured "worst offender commits 44.7% of false starts". ---- */
say('\nfitting PN.gamma (culprit concentration) …');
let glo = 0.4, ghi = 3.0;
for (let it = 0; it < 5; it++) {
  PN.gamma = Math.round((glo + ghi) / 2 * 100) / 100;
  const m = measure();
  say(`  gamma ${f(PN.gamma)} → worst false-start offender ${f(m.fsTop1, 1)}% (target ${TARGET.fsTop1})`);
  if (m.fsTop1 > TARGET.fsTop1) ghi = PN.gamma; else glo = PN.gamma;
}
PN.gamma = Math.round((glo + ghi) / 2 * 100) / 100;

/* ---- 4. yards. Half-the-distance clamping and rounding make this mildly non-linear, so iterate. ---- */
say('\nfitting PN.ydsScale …');
for (let it = 0; it < 3; it++) {
  const m = measure();
  say(`  ${f(m.yards, 1)} yds/team-game (target ${TARGET.yards}) at scale ${PN.ydsScale}`);
  if (Math.abs(m.yards - TARGET.yards) < 0.25) break;
  PN.ydsScale = Math.round(PN.ydsScale * (TARGET.yards / m.yards) * 1000) / 1000;
}

/* ---- 5. one last rate pass, since the rounds above leave a couple of percent on the table ---- */
{ const m = measure();
  for (const k in TARGET.fam) PN.base[k] *= TARGET.fam[k] / Math.max(0.01, m.fam[k]); }
for (const k in PN.base) PN.base[k] = Math.round(PN.base[k] * 1e5) / 1e5;
const fin = measure();
say('\n' + '='.repeat(96));
say('FITTED PN — sim vs measured reality');
say('='.repeat(96));
const row = (lbl, got, want, u) => say(`  ${lbl.padEnd(34)} ${f(got).padStart(7)}   target ${f(want).padStart(7)}${u || ''}`);
row('penalties / team-game', fin.total, TARGET.total);
row('penalty yards / team-game', fin.yards, TARGET.yards);
row('yards per penalty', fin.yards / fin.total, TARGET.yards / TARGET.total);
row('game-to-game sd', fin.sdGame, 2.54);
row('TRUE team-level sd', fin.trueSd, TARGET.trueSd);
row('offense share %', fin.offShare, TARGET.offShare);
row('pre-snap share %', fin.preShare, TARGET.preShare);
row('auto-first-down share %', fin.fdShare, TARGET.firstDown);
row('worst false-start offender %', fin.fsTop1, TARGET.fsTop1);
for (const k in TARGET.fam) row('  ' + k + ' / team-game', fin.fam[k], TARGET.fam[k]);
say(`  called-back touchdowns             ${f(fin.cbTD, 3)} per game`);
const q = p => fin.seasons[Math.min(fin.seasons.length - 1, Math.floor(fin.seasons.length * p))];
say(`\n  team-season spread: p05 ${f(q(.05))}  median ${f(q(.5))}  p95 ${f(q(.95))}   (real 4.08 / 5.92 / 7.92)`);
say('\nPN constants:');
say(`  base:{offPre:${PN.base.offPre}, offLive:${PN.base.offLive}, defPre:${PN.base.defPre}, defLive:${PN.base.defLive}},`);
say(`  compK:${PN.compK},  ydsScale:${PN.ydsScale},  gamma:${PN.gamma},`);
fs.writeFileSync(__dirname + '/penfit-result.txt', out.join('\n'));

if (process.argv.includes('--apply')) {
  let src = fs.readFileSync(HTML, 'utf8');
  const before = src;
  src = src.replace(/base:\{offPre:[\d.]+, offLive:[\d.]+, defPre:[\d.]+, defLive:[\d.]+\},/,
    `base:{offPre:${PN.base.offPre}, offLive:${PN.base.offLive}, defPre:${PN.base.defPre}, defLive:${PN.base.defLive}},`);
  src = src.replace(/compK:[\d.]+,\s{2,}\/\//, `compK:${PN.compK},               //`);
  src = src.replace(/ydsScale:[\d.]+,\s{2,}\/\//, `ydsScale:${PN.ydsScale},         //`);
  src = src.replace(/gamma:[\d.]+,\s{2,}\/\//, `gamma:${PN.gamma},              //`);
  if (src === before) console.log('\n!! --apply matched nothing; PN block format changed?');
  else { fs.writeFileSync(HTML, src); console.log('\napplied fitted constants to index.html'); }
}

/* Step 18 — sweep sim constants and print the envelope each setting produces.

   Patches named constants inside a COPY of index.html (never the real one), runs 4-simprofile
   against that copy via its INDEX hook, and prints one row per setting. A point costs ~8s, so a
   six-way sweep is a minute — which is the difference between measuring a lever and guessing at it.

   Usage:
     node tools/cfb-data/18-sweep.js '[{"label":"base","set":{}},
                                       {"label":"volK .11","set":{"volK":0.110}}]'

   Any `name: number` in index.html is patchable by name (AT, PM, PN, PC all work). An unknown name
   is a hard error rather than a silently ignored row — a sweep that quietly measures nothing is
   worse than no sweep.
*/
const fs = require('fs'), cp = require('child_process'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const base = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const combos = JSON.parse(process.argv[2] || '[{"label":"base","set":{}}]');
const tmp = path.join(require('os').tmpdir(), 'sideline-sweep');
fs.mkdirSync(tmp, { recursive: true });

const pad = (s, n) => String(s).padStart(n);
/* WORLDS passes straight through to 4-simprofile. At the default of 1 league the kurtosis column has
   a standard error of +-0.11 and MUST NOT be read as a signal — the header says so rather than
   trusting the reader to remember. Use WORLDS=8 for any sweep whose point is the tail. */
const WORLDS = +(process.env.WORLDS || 1);
const seKurt = (Math.sqrt(24 / (2010 * WORLDS))).toFixed(3);
console.log(`  (WORLDS=${WORLDS} -> ${2010 * WORLDS} games; kurtosis SE +-${seKurt}${WORLDS < 4 ? '  <-- TOO NOISY TO READ' : ''})`);
console.log('label'.padEnd(30) + '  pts  margin  home%    Y/C     Y/A   cmp%   sack    INT    FUM    kurt    skew     SD');
for (const c of combos) {
  let h = base;
  for (const k in c.set) {
    const re = new RegExp('(\\b' + k + ':)\\s*[-0-9.]+');
    if (!re.test(h)) { console.error('!! no such constant: ' + k); process.exit(1); }
    h = h.replace(re, '$1' + c.set[k]);
  }
  const f = path.join(tmp, 'sw_' + c.label.replace(/[^a-z0-9]/gi, '_') + '.html');
  fs.writeFileSync(f, h);
  const env = Object.assign({}, process.env, { INDEX: f, WORLDS: String(WORLDS) });
  const prof = cp.execSync('node ' + JSON.stringify(path.join(__dirname, '4-simprofile.js')), { env, cwd: ROOT }).toString();
  const out = cp.execSync('node ' + JSON.stringify(path.join(__dirname, '5-compare.js')), { cwd: ROOT }).toString();
  const g = (re, s) => { const m = s.match(re); return m ? m[1] : '?'; };
  console.log(c.label.padEnd(30),
    pad(g(/^  points\s+[\d.]+\s+([\d.]+)/m, out), 5),
    pad(g(/^  avg margin\s+[\d.]+\s+([\d.]+)/m, out), 6),
    pad(g(/^  home win %\s+[\d.]+\s+([\d.]+)/m, out), 6),
    pad(g(/^  yards \/ carry\s+[\d.]+\s+([\d.]+)/m, out), 6),
    pad(g(/^  yards \/ attempt\s+[\d.]+\s+([\d.]+)/m, out), 6),
    pad(g(/^  completion %\s+[\d.]+\s+([\d.]+)/m, out), 6),
    pad(g(/^  sacks \(by defense\)\s+[\d.]+\s+([\d.]+)/m, out), 6),
    pad(g(/^    interceptions\s+[\d.]+\s+([\d.]+)/m, out), 6),
    pad(g(/^    fumbles lost\s+[\d.]+\s+([\d.]+)/m, out), 6),
    pad(g(/excess kurtosis (-?[\d.]+)/, prof), 7),
    pad(g(/skew (-?[\d.]+)/, prof), 7),
    pad(g(/residual SD ([\d.]+)/, prof), 6));
}

/* Step 20 — harvest real recruiting classes from the CollegeFootballData API.

   Phase 56. The sim engine has been fitted against measured football since Phase 48 and recruiting
   never has; this is the harvest half of building `docs/reference/cfb-recruiting.md`, the fourth
   reference sheet. 21-recanalyze.js turns the cache this writes into the measured numbers, and
   22-recprofile.js computes the same metric set from the game so the two can be compared.

   Auth: CFBD needs a free key (collegefootballdata.com/key). It is read from the environment and
   NEVER written to disk by this tool:

     CFBD_API_KEY=... node tools/cfb-data/20-recruits.js --probe
     CFBD_API_KEY=... node tools/cfb-data/20-recruits.js 2015 2025

   `--probe` fetches ONE year of each endpoint and prints the first record's real field names.
   Always run it before writing an analyser. Phase 54 spent a whole section on instruments that
   inverted their own diagnosis; assuming a field name is the cheapest possible version of that
   mistake, and CFBD's raw JSON is camelCase while most published examples are the R wrapper's
   snake_case, so the two do not agree.

   Resumable: re-running only fetches years missing from rec-cache.json (the 2-harvest.js pattern).
   The cache is gitignored; the committed artifacts are recruit-report.txt and the reference sheet.
   Call count is printed on exit — the free tier is 3,000/month and a decade here costs ~44. */

const fs = require('fs');
const path = require('path');

const KEY = process.env.CFBD_API_KEY;
const BASE = process.env.CFBD_BASE || 'https://api.collegefootballdata.com';
const OUT = path.join(__dirname, 'rec-cache.json');

if (!KEY) {
  console.error('CFBD_API_KEY is not set.\n' +
    '  Get a free key at https://collegefootballdata.com/key, then:\n' +
    '  CFBD_API_KEY=... node tools/cfb-data/20-recruits.js --probe');
  process.exit(2);
}

const args = process.argv.slice(2);
const PROBE = args.includes('--probe');
const years = args.filter(a => /^\d{4}$/.test(a)).map(Number);
const [Y0, Y1] = years.length === 2 ? years : years.length === 1 ? [years[0], years[0]] : [2015, 2025];

let calls = 0;
async function get(pathAndQuery, tries = 4) {
  const url = BASE + pathAndQuery;
  for (let i = 0; i < tries; i++) {
    calls++;
    try {
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + KEY, Accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status === 401 || r.status === 403) {
        console.error(`\nAuth failed (${r.status}) on ${pathAndQuery} — check CFBD_API_KEY.`);
        process.exit(3);
      }
      if (r.status === 429) { await new Promise(s => setTimeout(s, 4000 * (i + 1))); continue; }
      if (r.status === 404) return null;
      console.error(`  ${r.status} on ${pathAndQuery}`);
    } catch (e) { /* retry */ }
    await new Promise(s => setTimeout(s, 700 * (i + 1)));
  }
  return null;
}

/* the four endpoints the reference sheet needs, and what each one is for */
const ENDPOINTS = {
  players: y => `/recruiting/players?year=${y}`,   // the ranked board: stars, composite, hometown, commit
  teams: y => `/recruiting/teams?year=${y}`,       // class rank + points -> re-derive classScore
  fbs: y => `/teams/fbs?year=${y}`,                // campus state + lat/long, and who is actually FBS
  talent: y => `/talent?year=${y}`,                // team talent composite: the STOCK 4 classes build
};

(async () => {
  if (PROBE) {
    console.log(`probing ${BASE} …\n`);
    for (const [name, mk] of Object.entries(ENDPOINTS)) {
      const d = await get(mk(2023));
      if (!Array.isArray(d) || !d.length) { console.log(`${name}: no array returned (${d ? typeof d : 'null'})\n`); continue; }
      console.log(`${name}  —  ${d.length} records`);
      console.log('  keys: ' + Object.keys(d[0]).join(', '));
      console.log('  first: ' + JSON.stringify(d[0], null, 2).split('\n').join('\n  '));
      console.log('');
    }
    console.log(`(${calls} calls used)`);
    return;
  }

  let cache = {};
  if (fs.existsSync(OUT)) { try { cache = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { cache = {}; } }

  for (let y = Y0; y <= Y1; y++) {
    cache[y] = cache[y] || {};
    for (const [name, mk] of Object.entries(ENDPOINTS)) {
      if (cache[y][name] && cache[y][name].length) continue;   // resumable
      const d = await get(mk(y));
      cache[y][name] = Array.isArray(d) ? d : [];
      console.log(`${y} ${name.padEnd(8)} ${String(cache[y][name].length).padStart(5)} records`);
      fs.writeFileSync(OUT, JSON.stringify(cache));            // checkpoint every call
    }
  }

  const tot = Object.keys(cache).reduce((s, y) => s + (cache[y].players || []).length, 0);
  console.log(`\nwrote rec-cache.json — ${Y0}-${Y1}, ${tot.toLocaleString()} ranked prospects (${calls} calls used)`);
})();

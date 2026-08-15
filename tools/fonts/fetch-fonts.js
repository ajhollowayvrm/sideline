#!/usr/bin/env node
/* Refresh assets/fonts/ from Google Fonts. Rarely run — the woff2 files are VENDORED (committed)
   on purpose, because the gstatic URLs carry a version segment (`/inter/v20/`, `/sairacondensed/v12/`)
   that rotates without warning. Committing the bytes is what makes a build reproducible offline and
   keeps CI from depending on a third-party CDN.

   Latin subset only: the game's data is ASCII, and anything outside the subset (▲, ⭐, 🏆) falls back
   to the system face per-glyph, which is what you want for those anyway.

   Note Inter resolves to ONE variable file covering 400–700, so this pulls 5 files, not 8.

     node tools/fonts/fetch-fonts.js       # then: node tools/fonts/inline-fonts.js
*/
const fs = require('fs'), path = require('path');

const OUT = path.join(__dirname, '..', '..', 'assets', 'fonts');
const CSS = 'https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700;800'
          + '&family=Inter:wght@400;500;600;700&display=swap';
// A modern desktop UA is what makes the API answer in woff2 rather than legacy formats.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
         + 'Chrome/126.0.0.0 Safari/537.36';

const slug = (fam, wt, variable) =>
  fam.toLowerCase().replace(/\s+/g, '-') + '-' + (variable ? 'var' : wt) + '.woff2';

(async () => {
  const css = await (await fetch(CSS, { headers: { 'User-Agent': UA } })).text();

  // The reply is ~40 @font-face blocks: one per (family, weight, subset). Each is preceded by a
  // /* subset */ comment, which is the only place the subset name appears — so split on it.
  const faces = [];
  for (const b of css.split('/*').slice(1)) {
    if (b.slice(0, b.indexOf('*/')).trim() !== 'latin') continue;
    faces.push({
      fam: /font-family:\s*'([^']+)'/.exec(b)[1],
      wt:  /font-weight:\s*(\d+)/.exec(b)[1],
      url: /url\((https:[^)]+)\)/.exec(b)[1],
    });
  }
  if (!faces.length) throw new Error('no latin @font-face blocks in the Google Fonts reply');

  // Collapse weights that resolve to the same URL — that is a variable font being served once.
  const byUrl = new Map();
  for (const f of faces) {
    if (!byUrl.has(f.url)) byUrl.set(f.url, []);
    byUrl.get(f.url).push(f);
  }

  fs.mkdirSync(OUT, { recursive: true });
  for (const [url, group] of byUrl) {
    const name = slug(group[0].fam, group[0].wt, group.length > 1);
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    if (buf.slice(0, 4).toString() !== 'wOF2') throw new Error(name + ' is not a woff2 file');
    fs.writeFileSync(path.join(OUT, name), buf);
    const wts = group.length > 1 ? group.map(f => f.wt).join('/') + ' (variable)' : group[0].wt;
    console.log(`${name.padEnd(28)} ${String(buf.length).padStart(7)} bytes   ${group[0].fam} ${wts}`);
  }
  console.log(`\n${byUrl.size} file(s) → assets/fonts/. Now run: node tools/fonts/inline-fonts.js`);
})();

/* Sideline QA gate — drives the real game in headless Chromium on a mobile viewport,
   asserts behavior across every Phase 1 screen, and captures screenshots.

   Run:  npm run qa        (one-time prereq: npx playwright install chromium)

   Self-contained: starts its own static server for the repo root, so no separate
   server is needed. Exits non-zero if any check fails. Screenshots → test/shots/. */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

function startServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const fp = path.join(ROOT, p);
    fs.readFile(fp, (e, data) => {
      if (e) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(fp)] || 'text/plain' });
      res.end(data);
    });
  });
  return new Promise(r => server.listen(0, () => r({ server, port: server.address().port })));
}

(async () => {
  const { server, port } = await startServer();
  const BASE = `http://localhost:${port}/index.html`;
  const overflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const accent = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase());
  const screen = page => page.locator('#app').getAttribute('data-screen');
  const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n), fullPage: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('console', m => { if (m.type() === 'error') jsErrors.push('console: ' + m.text()); });
  page.on('pageerror', e => jsErrors.push('pageerror: ' + e.message));

  // ---------- ?seed determinism (hook) ----------
  async function worldSig(seed) {
    await page.goto(`${BASE}?seed=${seed}&reset=1`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'New Game' }).click();
    await page.getByPlaceholder('Coach').fill('T');
    await page.getByPlaceholder('Surname').fill('Tester');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); // ensureWorld
    return page.evaluate(() => UI.newgame.world.teams.map(t => t.ratings.ovr).join(','));
  }
  const sigA = await worldSig(42), sigB = await worldSig(42), sigC = await worldSig(99);
  check('?seed=N deterministic (same seed → same world)', sigA === sigB);
  check('?seed=N varies by seed (42 ≠ 99)', sigA !== sigC);

  // ---------- MENU ----------
  await page.goto(`${BASE}?reset=1`, { waitUntil: 'networkidle' });
  await shot(page, '01-menu.png');
  check('Menu: New Game + Load Game visible',
    await page.getByRole('button', { name: 'New Game' }).isVisible() &&
    await page.getByRole('button', { name: 'Load Game' }).isVisible());
  check('Menu: no horizontal overflow', await overflow(page));
  check('Menu: gold default accent (#c9a227)', (await accent(page)) === '#c9a227', await accent(page));

  // ---------- NEW GAME WIZARD (deterministic seed for reproducibility) ----------
  await page.goto(`${BASE}?seed=2026&reset=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.getByPlaceholder('Coach').fill('Nick');
  await page.getByPlaceholder('Surname').fill('Sideline');
  const fontSize = await page.getByPlaceholder('Coach').evaluate(el => getComputedStyle(el).fontSize);
  check('Inputs ≥16px (no iOS zoom)', parseFloat(fontSize) >= 16, fontSize);
  await shot(page, '02-wizard-identity.png');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await shot(page, '03-wizard-style.png');
  check('Wizard: archetype options shown', await page.getByText('Offensive Genius').first().isVisible());
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await shot(page, '04-wizard-rosters.png');
  check('Wizard: import/template buttons shown',
    await page.getByRole('button', { name: /Import custom rosters/ }).isVisible() &&
    await page.getByRole('button', { name: /Download blank roster template/ }).isVisible());
  await page.getByRole('button', { name: /Continue to team select/ }).click();
  await page.getByPlaceholder('Search teams…').fill('Alabama');
  await page.waitForTimeout(150);
  await shot(page, '05-wizard-pickteam.png');
  await page.getByRole('button', { name: /Alabama/ }).first().click();
  await page.getByRole('button', { name: /Slot 1/ }).click();
  await page.waitForTimeout(200);

  // ---------- HOME ----------
  check('New game lands on Home', (await screen(page)) === 'home');
  const teamColor = await page.evaluate(() => controlled().color.toLowerCase());
  check('Accent adopts team color on Home', (await accent(page)) === teamColor, `accent=${await accent(page)} team=${teamColor}`);
  check('Home: no horizontal overflow', await overflow(page));
  await shot(page, '06-home.png');

  // ---------- TEAM: ROSTER ----------
  await page.locator('[data-tid="nav-team"]').click();
  await page.waitForTimeout(150);
  check('Team page: roster tab default', (await page.locator('#app').getAttribute('data-tab')) === 'roster');
  const chipInfo = await page.evaluate(() => {
    const tiers = ['Generational', 'Superstar', 'Star', 'Starter', 'Rotational', 'Depth'];
    const tags = [...document.querySelectorAll('.lrow .tag')].map(t => t.textContent.trim());
    const ceil = tags.filter(t => tiers.some(x => t.includes(x)));
    const bands = ceil.filter(t => t.includes('?'));
    const devs = [...document.querySelectorAll('.lrow .dim')].map(t => t.textContent.trim()).filter(t => ['Raw', 'Developing', 'Polished', 'Maxed'].includes(t));
    return { ceil: ceil.length, bands: bands.length, devs: devs.length };
  });
  check('Roster: ceiling chips render', chipInfo.ceil > 10, `${chipInfo.ceil} chips`);
  check('Roster: fuzzy bands present', chipInfo.bands > 0, `${chipInfo.bands} banded`);
  check('Roster: development stages render', chipInfo.devs > 10, `${chipInfo.devs} stages`);
  check('Roster: no horizontal overflow', await overflow(page));
  await shot(page, '07-roster.png');

  // scholarship-sized rosters: every team is deep, backups taper off, names don't repeat
  const depth = await page.evaluate(() => {
    const sizes = S.world.teams.map(t => t.roster.length);
    const t = controlled();
    const wr = t.roster.filter(p => p.pos === 'WR').sort((a, b) => a.so - b.so).map(p => p.ov);
    let dupes = 0, players = 0;
    S.world.teams.forEach(tm => { const seen = {}; tm.roster.forEach(p => { players++; const k = p.fn + ' ' + p.ln; if (seen[k]) dupes++; seen[k] = 1; }); });
    return { min: Math.min(...sizes), total: sizes.reduce((a, b) => a + b, 0), wrTop: wr[0], wrBottom: wr[wr.length - 1], wrLen: wr.length, dupes, players };
  });
  check('Roster: scholarship-sized for every team (≥80)', depth.min >= 80, `min ${depth.min}, ${depth.total} league-wide`);
  check('Roster: realistic depth taper (starters well above deep backups)', depth.wrLen >= 8 && depth.wrTop - depth.wrBottom >= 8, `WR ${depth.wrTop}→${depth.wrBottom} over ${depth.wrLen}`);
  check('Roster: same-team duplicate names rare (<1%)', depth.dupes / depth.players < 0.01, `${depth.dupes}/${depth.players}`);

  // player sheet — ceiling/dev shown, raw potential hidden (data-id targets a specific player)
  const pid = await page.evaluate(() => controlled().roster[0].id);
  await page.locator(`[data-id="${pid}"]`).click();
  await page.waitForTimeout(120);
  const sheetTxt = await page.locator('[data-tid="sheet"]').innerText();
  check('Player sheet shows Ceiling + Development', /Ceiling/.test(sheetTxt) && /Development/.test(sheetTxt));
  check('Player sheet hides raw "Potential" number', !/Potential/.test(sheetTxt));
  await shot(page, '08-player-sheet.png');

  // edit a clearly-backup player to a max rating → offense rating must rise
  await page.locator('[data-tid="sheet-bg"]').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.waitForTimeout(100);
  const wrId = await page.evaluate(() => { const r = controlled().roster.filter(p => p.pos === 'WR').sort((a, b) => b.so - a.so)[0]; return r.id; });
  const offBefore = await page.evaluate(() => controlled().ratings.off);
  await page.evaluate(id => { const p = controlled().roster.find(x => x.id === id); p.ov = 40; controlled().ratings = teamRatings(controlled().roster, controlled().staff); }, wrId);
  await page.locator(`[data-id="${wrId}"]`).click();
  await page.waitForTimeout(120);
  await page.getByRole('button', { name: 'Edit player' }).click();
  await page.waitForTimeout(120);
  await page.getByLabel('Overall (40-99)').fill('99');
  await page.getByLabel('Potential').fill('99');
  await page.getByRole('button', { name: 'Save player' }).click();
  await page.waitForTimeout(150);
  const offAfter = await page.evaluate(() => controlled().ratings.off);
  check('Edit player updates ratings live', offAfter > offBefore, `off ${offBefore} → ${offAfter}`);

  // ---------- TEAM: COACHES ----------
  await page.locator('[data-tid="tab-coaches"]').click();
  await page.waitForTimeout(150);
  const coachTxt = await page.evaluate(() => document.querySelector('.view').innerText);
  check('Coaches: Coordinators section present', /Coordinators/i.test(coachTxt));
  check('Coaches: Additional Coaches section present', /ADDITIONAL COACHES/i.test(coachTxt));
  const boostBadges = await page.evaluate(() => [...document.querySelectorAll('.lrow .tag')].map(t => t.textContent.trim()).filter(t => /\+\d/.test(t)).length);
  check('Coaches: boost badges render', boostBadges > 0, `${boostBadges} badges`);
  await shot(page, '09-coaches.png');
  // edit the DC's salary (data-id by role) → payroll changes
  const payBefore = await page.evaluate(() => controlled().payroll);
  await page.locator('[data-id="DC"]').click();
  await page.waitForTimeout(120);
  await page.getByLabel('Salary ($/yr)').fill('9999999');
  await page.getByRole('button', { name: 'Update salary' }).click();
  await page.waitForTimeout(150);
  check('Coaches: salary edit updates payroll', (await page.evaluate(() => controlled().payroll)) !== payBefore);

  // ---------- LEAGUE ----------
  await page.locator('[data-tid="nav-browse"]').click();
  await page.waitForTimeout(150);
  const rowsAll = await page.locator('.team-pick').count();
  check('League: many teams listed', rowsAll >= 100, `${rowsAll} rows`);
  await shot(page, '10-league.png');
  await page.getByPlaceholder('Search teams…').fill('Ohio');
  await page.waitForTimeout(150);
  const rowsFiltered = await page.locator('.team-pick').count();
  check('League: search filters list', rowsFiltered > 0 && rowsFiltered < rowsAll, `${rowsAll} → ${rowsFiltered}`);

  // ---------- PHASE 2: SEASON ----------
  await page.locator('[data-tid="nav-home"]').click();
  await page.waitForTimeout(120);
  const pre = await page.evaluate(() => ({ phase: S.phase, sched: !!S.schedule, week: S.week }));
  check('Season: starts in Preseason with no schedule', pre.phase === 'Preseason' && !pre.sched && pre.week === 0, JSON.stringify(pre));

  await page.getByRole('button', { name: /Kick off the season/ }).click();
  await page.waitForTimeout(150);
  const kicked = await page.evaluate(() => {
    const cnt = {}; S.schedule.games.forEach(g => { cnt[g.home] = (cnt[g.home] || 0) + 1; cnt[g.away] = (cnt[g.away] || 0) + 1; });
    const counts = Object.values(cnt);
    const wb = {}; let conf = 0;
    S.schedule.games.forEach(g => [g.home, g.away].forEach(id => { const k = id + '|' + g.week; wb[k] = (wb[k] || 0) + 1; if (wb[k] > 1) conf++; }));
    return { phase: S.phase, week: S.week, games: S.schedule.games.length, teams: Object.keys(cnt).length, min: Math.min(...counts), max: Math.max(...counts), conflicts: conf };
  });
  check('Season: kickoff generates schedule + enters Regular Season', kicked.games > 600 && kicked.phase === 'Regular Season' && kicked.week === 1, JSON.stringify(kicked));
  check('Season: all teams scheduled, ≤1 game per team per week', kicked.teams >= 130 && kicked.conflicts === 0 && kicked.max <= 12, JSON.stringify(kicked));
  check('Season: slate near 12 games/team (no near-empty schedules)', kicked.min >= 8, 'min ' + kicked.min);
  await shot(page, '13-home-inseason.png');

  // game sim determinism: re-simming the same game id + seed reproduces the score
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: /Play Week/ }).click(); await page.waitForTimeout(120); }
  const adv = await page.evaluate(() => {
    let W = 0, L = 0; S.world.teams.forEach(x => { W += x.rec.w; L += x.rec.l; });
    const t = controlled();
    const sched = S.schedule.games.filter(g => (g.home === t.id || g.away === t.id) && g.week <= 3).length;
    return { week: S.week, played: S.schedule.games.filter(g => g.played).length, lastPlayed: S.lastPlayedWeek, W, L, mySched: sched, myRec: t.rec.w + t.rec.l };
  });
  check('Season: advancing weeks plays games + records results', adv.week === 4 && adv.played > 0 && adv.lastPlayed === 3, JSON.stringify(adv));
  check('Season: league W/L balanced (each game one W, one L)', adv.W === adv.L && adv.W > 0, `W${adv.W} L${adv.L}`);
  check('Season: controlled record matches its games played', adv.myRec === adv.mySched, JSON.stringify(adv));
  const detSim = await page.evaluate(() => {
    const g = S.schedule.games.find(x => x.played);
    const clone = { id: g.id, home: g.home, away: g.away, played: false, hs: null, as: null };
    simGame(clone);
    return g.hs === clone.hs && g.as === clone.as;
  });
  check('Season: game sim is deterministic (reproducible from id + seed)', detSim);

  // season view tabs
  await page.locator('[data-tid="nav-season"]').click();
  await page.waitForTimeout(150);
  check('Season view: opens on schedule tab', (await screen(page)) === 'season' && await page.locator('[data-tid="stab-schedule"]').isVisible());
  check('Season view: no horizontal overflow', await overflow(page));
  await shot(page, '14-season-schedule.png');
  await page.locator('[data-tid="stab-standings"]').click();
  await page.waitForTimeout(150);
  check('Season standings: shows conference table with YOU marker', /YOU/.test(await page.evaluate(() => document.querySelector('.view').innerText)));
  await shot(page, '15-season-standings.png');
  await page.locator('[data-tid="stab-top25"]').click();
  await page.waitForTimeout(150);
  check('Season top 25: lists 25 ranked teams', (await page.locator('.lrow').count()) >= 25, (await page.locator('.lrow').count()) + ' rows');
  await shot(page, '16-season-top25.png');
  await page.locator('[data-tid="stab-scores"]').click();
  await page.waitForTimeout(150);
  check('Season scores: shows last week scoreboard', /week 3 scores/i.test(await page.evaluate(() => document.querySelector('.view').innerText)));
  await shot(page, '17-season-scores.png');

  // ---------- SAVE → RELOAD → LOAD ----------
  await page.locator('[data-tid="nav-menu"]').click();
  await page.waitForTimeout(120);
  await page.getByRole('button', { name: 'Save game' }).click();
  await page.waitForTimeout(150);
  await page.goto(BASE, { waitUntil: 'networkidle' }); // clean reload (no ?reset)
  check('After reload, back at Menu', await page.getByRole('button', { name: 'New Game' }).isVisible());
  await page.getByRole('button', { name: 'Load Game' }).click();
  await page.waitForTimeout(150);
  check('Load screen shows saved Alabama career', /Alabama/.test(await page.evaluate(() => document.querySelector('.view').innerText)));
  await shot(page, '11-load.png');
  await page.getByRole('button', { name: 'Load', exact: true }).first().click();
  await page.waitForTimeout(150);
  check('Persistence: save survives reload + loads to Home', (await screen(page)) === 'home');
  const seasonPersist = await page.evaluate(() => ({ sched: !!S.schedule, week: S.week, phase: S.phase, played: S.schedule ? S.schedule.games.filter(g => g.played).length : 0 }));
  check('Persistence: in-season schedule + records survive reload', seasonPersist.sched && seasonPersist.week === 4 && seasonPersist.phase === 'Regular Season' && seasonPersist.played > 0, JSON.stringify(seasonPersist));

  // ---------- MIGRATION (inject a v1 save) ----------
  await page.evaluate(() => {
    const w = genWorld(424242);
    w.teams.forEach(t => t.staff.forEach(c => { delete c.tier; delete c.groups; delete c.scope; delete c.boost; }));
    const team = w.teams[0];
    const state = { version: 1, seed: 424242, createdAt: 7, coach: { first: 'Old', last: 'Timer', homeState: 'TX', archetype: 'Manager', history: 'Lifer' }, teamId: team.id, week: 0, phase: 'Preseason', world: w, task: { type: 'x', label: 'x', note: 'x' } };
    const meta = { coach: 'Old Timer', team: team.name, teamAbbr: team.abbr, color: team.color, week: 0, phase: 'Preseason', savedAt: 7 };
    localStorage.setItem('sideline_slot_2', JSON.stringify({ meta, state }));
  });
  await page.goto(BASE, { waitUntil: 'networkidle' }); // clean reload (no ?reset)
  await page.getByRole('button', { name: 'Load Game' }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Load', exact: true }).nth(1).click();
  await page.waitForTimeout(150);
  const mig = await page.evaluate(() => ({ v: S.version, tier: S.world.teams[0].staff[0].tier, boost: S.world.teams[0].staff[0].boost, rec: S.world.teams[0].rec, sched: S.schedule }));
  check('Migration: v1 save upgrades to current version (v3)', mig.v === 3, 'version=' + mig.v);
  check('Migration: staff backfilled (tier/boost)', mig.tier != null && mig.boost != null, JSON.stringify({ tier: mig.tier, boost: mig.boost }));
  check('Migration: season fields backfilled (records, null schedule)', mig.rec && mig.rec.w === 0 && mig.rec.l === 0 && mig.sched === null, JSON.stringify(mig.rec));

  // ---------- DELETE with confirm ----------
  await page.goto(BASE, { waitUntil: 'networkidle' }); // clean reload (no ?reset)
  await page.getByRole('button', { name: 'Load Game' }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  await page.waitForTimeout(120);
  await page.getByRole('button', { name: /Yes, continue/ }).click();
  await page.waitForTimeout(150);
  const slotsLeft = await page.evaluate(() => [1, 2, 3].map(n => !!localStorage.getItem('sideline_slot_' + n)).filter(Boolean).length);
  check('Delete (with confirm) removes a save', slotsLeft < 3, `${slotsLeft} slots remain`);

  check('No uncaught JS / console errors', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
  await ctx.close();

  // ---------- DESKTOP (centered column) ----------
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dp = await dctx.newPage();
  await dp.goto(BASE, { waitUntil: 'networkidle' });
  await dp.screenshot({ path: path.join(SHOTS, '12-desktop-menu.png') });
  const colW = await dp.evaluate(() => (document.querySelector('#app > *') || document.querySelector('#app')).getBoundingClientRect().width);
  check('Desktop: content column stays narrow (≤600px)', colW <= 600, `~${Math.round(colW)}px`);
  await dctx.close();

  // ---------- reduced-motion smoke ----------
  const rctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  const rErr = [];
  rp.on('pageerror', e => rErr.push(e.message));
  await rp.goto(BASE, { waitUntil: 'networkidle' });
  check('prefers-reduced-motion: loads without error', rErr.length === 0);
  await rctx.close();

  await browser.close();
  server.close();

  const passed = results.filter(r => r.pass).length;
  console.log(`\n===== ${passed}/${results.length} checks passed =====`);
  process.exit(results.every(r => r.pass) ? 0 : 1);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });

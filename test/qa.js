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
  // Phase 10: fogged temperament chips (Motor = work ethic, Poise = composure)
  const traitUI = await page.evaluate(() => {
    const tags = [...document.querySelectorAll('.lrow .tag')].map(t => t.textContent.trim());
    const motor = tags.filter(t => t.startsWith('Motor:')).length, poise = tags.filter(t => t.startsWith('Poise:')).length;
    // model: a player you don't know reads '???'; one you know well reads a band; raw value hidden
    const id = controlled().roster[0].id;
    const unknown = traitRead('mot', id, 90, 10).revealed === false && traitRead('mot', id, 90, 10).text === '???';
    const known = traitRead('mot', id, 90, 95).revealed === true && traitRead('mot', id, 90, 95).text !== '???';
    // fog tightens with tenure: a senior reads more confidently than a freshman
    const fr = rosterTraitConf({ yr: 'FR', id: 'x' }), sr = rosterTraitConf({ yr: 'SR', id: 'y' });
    return { motor, poise, unknown, known, tenureMono: sr > fr };
  });
  check('Phase 10: roster shows Motor + Poise trait chips', traitUI.motor > 10 && traitUI.poise > 10, `${traitUI.motor} motor / ${traitUI.poise} poise`);
  check('Phase 10: traits are fogged — unknown reads ???, known reveals a band', traitUI.unknown && traitUI.known);
  check('Phase 10: trait fog tightens with tenure (SR > FR confidence)', traitUI.tenureMono);
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
  check('Player sheet shows Work ethic + Composure (Phase 10)', /Work ethic/.test(sheetTxt) && /Composure/.test(sheetTxt));
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

  // advancing now opens the watch-then-commit viewer for your game; skip + commit each week.
  // bye weeks advance directly (no viewer). Capture the first watched game to verify its score
  // equals the committed result (the replay is faithful, not a re-roll).
  let sawViewer = false, watchCheck = null;
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /Play Week/ }).click();
    await page.waitForTimeout(120);
    if ((await screen(page)) === 'game') {
      if (!sawViewer) { sawViewer = true; check('Watch: viewer shows a live game board', await page.locator('[data-tid="game-board"]').isVisible()); await shot(page, '19-watch-game.png'); }
      await page.locator('[data-tid="game-skip"]').click();
      await page.waitForTimeout(80);
      const watched = await page.evaluate(() => UI.game ? { id: UI.game.gameId, hs: UI.game.hs, as: UI.game.as } : null);
      await page.locator('[data-tid="game-continue"]').click();
      await page.waitForTimeout(120);
      if (!watchCheck && watched) { const committed = await page.evaluate(id => { const g = S.schedule.games.find(x => x.id === id); return { hs: g.hs, as: g.as, played: g.played }; }, watched.id); watchCheck = { watched, committed }; }
    }
  }
  check('Watch: advancing opens the watch-then-commit viewer', sawViewer);
  check('Watch: watched score == committed result (replay is faithful)', !!watchCheck && watchCheck.watched.hs === watchCheck.committed.hs && watchCheck.watched.as === watchCheck.committed.as && watchCheck.committed.played, JSON.stringify(watchCheck));
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

  // ---------- PHASE 3: play-by-play sim + per-player stats ----------
  const sim = await page.evaluate(() => {
    const played = S.schedule.games.filter(g => g.played);
    const scores = played.flatMap(g => [g.hs, g.as]);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const ties = played.filter(g => g.hs === g.as).length;
    const t = controlled();
    const qb = t.roster.filter(p => p.pos === 'QB').sort((a, b) => a.so - b.so)[0];
    let leadPass = 0, leadPos = '', pInt = 0, dInt = 0;
    S.world.teams.forEach(tm => tm.roster.forEach(p => { if (!p.gs) return; if (p.gs.pYds > leadPass) { leadPass = p.gs.pYds; leadPos = p.pos; } pInt += p.gs.pInt || 0; dInt += p.gs.dInt || 0; }));
    return { mean, ties, max: Math.max(...scores), withStats: t.roster.filter(p => p.gs).length, qbYds: qb && qb.gs ? qb.gs.pYds : 0, qbGp: qb && qb.gs ? qb.gs.gp : 0, leadPass, leadPos, pInt, dInt };
  });
  check('Sim: realistic scoring (mean 15–35, max ≥ 35, no ties)', sim.mean >= 15 && sim.mean <= 35 && sim.max >= 35 && sim.ties === 0, `mean ${sim.mean.toFixed(1)}, max ${sim.max}, ${sim.ties} ties`);
  check('Sim: per-player stats accumulate on the controlled roster', sim.withStats > 10, `${sim.withStats} players with stats`);
  check('Sim: starting QB logs passing yards across games played', sim.qbYds > 0 && sim.qbGp > 0, `QB ${sim.qbYds} yds / ${sim.qbGp} gp`);
  check('Sim: league passing leader is a QB', sim.leadPos === 'QB', `${sim.leadPos} ${sim.leadPass} yds`);
  check('Sim: box reconciles (INTs thrown == INTs caught league-wide)', sim.pInt === sim.dInt, `pInt ${sim.pInt} / dInt ${sim.dInt}`);
  const detBox = await page.evaluate(() => {
    const g = S.schedule.games.find(x => x.played);
    const a = simGame({ id: g.id, home: g.home, away: g.away });
    const b = simGame({ id: g.id, home: g.home, away: g.away });
    return JSON.stringify(a) === JSON.stringify(b) && Object.keys(a).length > 0;
  });
  check('Sim: per-game box score is deterministic (reproducible from id + seed)', detBox);

  // ---------- PHASE 3.5: weekly Player of the Week ----------
  const honors = await page.evaluate(() => {
    const wh = S.weeklyHonors || [], last = wh[wh.length - 1];
    return { weeks: wh.length, hasNatOff: !!(last && last.national.off), hasNatDef: !!(last && last.national.def),
      confs: last ? Object.keys(last.byConf).length : 0,
      offPos: last && last.national.off ? last.national.off.pos : '', defPos: last && last.national.def ? last.national.def.pos : '' };
  });
  check('Honors: weekly POW recorded for each played week', honors.weeks === 3, honors.weeks + ' weeks');
  check('Honors: national Offensive + Defensive POW present', honors.hasNatOff && honors.hasNatDef);
  check('Honors: per-conference POW computed', honors.confs >= 8, honors.confs + ' conferences');
  check('Honors: Off POW is a skill player, Def POW a defender', ['QB', 'RB', 'WR', 'TE'].includes(honors.offPos) && ['DE', 'DT', 'LB', 'CB', 'S'].includes(honors.defPos), `off ${honors.offPos} / def ${honors.defPos}`);

  // player sheet now surfaces in-season stats instead of "— preseason —"
  await page.locator('[data-tid="nav-team"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-tid="tab-roster"]').click(); // (coaches tab was left active earlier)
  await page.waitForTimeout(150);
  const sqb = await page.evaluate(() => { const t = controlled(); const qb = t.roster.filter(p => p.pos === 'QB' && p.gs && p.gs.pAtt).sort((a, b) => a.so - b.so)[0]; return qb ? qb.id : null; });
  check('Sim: a QB with passing stats exists to inspect', !!sqb);
  if (sqb) {
    await page.locator(`[data-id="${sqb}"]`).click();
    await page.waitForTimeout(120);
    const sheetTxt = await page.locator('[data-tid="sheet"]').innerText();
    check('Player sheet shows in-season Passing stats (not "— preseason —")', /Passing/.test(sheetTxt) && !/preseason/.test(sheetTxt));
    await shot(page, '18-player-stats.png');
    await page.locator('[data-tid="sheet-bg"]').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.waitForTimeout(100);
  }
  await page.locator('[data-tid="nav-home"]').click();
  await page.waitForTimeout(120);
  const homeTxt = await page.evaluate(() => document.querySelector('.view').innerText);
  check('Home: Players of the Week card shown', /Players of the Week/i.test(homeTxt));
  check('Home: recruiting card shown', await page.locator('[data-tid="home-recruit"]').isVisible());

  // ---------- PHASE 4: recruiting (in-season actions at week 4) ----------
  await page.locator('[data-tid="home-recruit"]').click();
  await page.waitForTimeout(150);
  check('Recruiting: opens on the Board tab', (await screen(page)) === 'recruit' && await page.locator('[data-tid="rtab-board"]').isVisible());
  check('Recruiting: no horizontal overflow', await overflow(page));
  const recPts0 = await page.evaluate(() => S.recruiting.points);
  check('Recruiting: weekly points granted (refilled in-season)', recPts0 > 0, recPts0 + ' pts');
  await shot(page, '22-recruiting-board.png');
  // prospects big board
  await page.locator('[data-tid="rtab-prospects"]').click();
  await page.waitForTimeout(150);
  const recRows = await page.locator('[data-tid="rec-list"] .lrow').count();
  check('Recruiting: prospects board lists many prospects', recRows > 20, recRows + ' rows');
  await shot(page, '23-recruiting-prospects.png');
  // pick a 4★+ target the player has not yet offered, open its sheet
  const tgt = await page.evaluate(() => { const r = S.recruiting.pool.find(x => !x.committedTo && x.stars >= 4 && x.iv[S.teamId] == null); return r ? { id: r.id } : null; });
  check('Recruiting: an un-offered blue-chip target exists', !!tgt);
  await page.locator(`[data-id="${tgt.id}"]`).first().click();
  await page.waitForTimeout(150);
  check('Recruiting: prospect sheet hides the raw potential number', !/Potential/.test(await page.locator('[data-tid="sheet"]').innerText()));
  await shot(page, '24-recruiting-prospect.png');
  await page.locator('[data-tid="rec-offer"]').click();
  await page.waitForTimeout(150);
  const afterOffer = await page.evaluate(id => { const r = S.recruiting.pool.find(x => x.id === id); return { board: S.recruiting.board.includes(id), iv: r.iv[S.teamId] || 0 }; }, tgt.id);
  check('Recruiting: offer adds to board + sets a starting interest', afterOffer.board && afterOffer.iv > 0, JSON.stringify(afterOffer));
  // scout (spends points, raises confidence)
  const ptsBeforeScout = await page.evaluate(() => S.recruiting.points);
  await page.locator('[data-tid="rec-scout"]').click();
  await page.waitForTimeout(150);
  const afterScout = await page.evaluate(id => ({ scout: S.recruiting.pool.find(x => x.id === id).scout, pts: S.recruiting.points }), tgt.id);
  check('Recruiting: scout raises confidence and spends points', afterScout.scout > 0 && afterScout.pts < ptsBeforeScout, JSON.stringify(afterScout));
  // pitch (spends points, raises interest)
  await page.locator('[data-tid="rec-pitch"]').click();
  await page.waitForTimeout(150);
  check('Recruiting: pitch angle picker opens', await page.locator('[data-tid^="pitch-"]').first().isVisible());
  await page.locator('[data-tid^="pitch-"]').first().click();
  await page.waitForTimeout(150);
  const afterPitch = await page.evaluate(id => ({ iv: S.recruiting.pool.find(x => x.id === id).iv[S.teamId], pts: S.recruiting.points }), tgt.id);
  check('Recruiting: pitch raises interest and spends points', afterPitch.iv > afterOffer.iv && afterPitch.pts < afterScout.pts, JSON.stringify(afterPitch));
  await page.locator('[data-tid="sheet-bg"]').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.waitForTimeout(100);
  // board now shows the offered target
  await page.locator('[data-tid="rtab-board"]').click();
  await page.waitForTimeout(150);
  check('Recruiting: board shows the offered target', await page.locator(`[data-id="${tgt.id}"]`).first().isVisible());
  // class tab renders a rank + grade even before any commit
  await page.locator('[data-tid="rtab-class"]').click();
  await page.waitForTimeout(150);
  check('Recruiting: Class tab shows national rank + grade', /class rank/i.test(await page.evaluate(() => document.querySelector('.view').innerText)));

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

  // Honors tab: national + conference, with a conference selector
  await page.locator('[data-tid="stab-honors"]').click();
  await page.waitForTimeout(150);
  const honorsTxt = await page.evaluate(() => document.querySelector('.view').innerText);
  check('Season Honors tab: national + conference shown', /NATIONAL/.test(honorsTxt) && /week 3/i.test(honorsTxt));
  check('Season Honors tab: conference selector present', await page.locator('[data-tid="honors-conf"]').isVisible());
  check('Season Honors tab: no horizontal overflow', await overflow(page));
  await shot(page, '20-season-honors.png');

  // Greatest games: highlight list on the Scores tab, each replayable (no result change)
  await page.locator('[data-tid="stab-scores"]').click();
  await page.waitForTimeout(150);
  const greatCount = await page.locator('[data-tid="great-game"]').count();
  check('Greatest games: highlight reel rendered', greatCount > 0, greatCount + ' games');
  await shot(page, '21-greatest-games.png');
  if (greatCount > 0) {
    const repId = await page.locator('[data-tid="great-game"]').first().getAttribute('data-id');
    await page.locator('[data-tid="great-game"]').first().click();
    await page.waitForTimeout(150);
    const rep = await page.evaluate(() => UI.game ? { hs: UI.game.hs, as: UI.game.as, replay: !!UI.game.replay } : null);
    check('Greatest games: tapping opens a replay (screen=game, replay mode)', (await screen(page)) === 'game' && rep && rep.replay);
    await page.locator('[data-tid="game-skip"]').click();
    await page.waitForTimeout(80);
    await page.locator('[data-tid="game-continue"]').click();
    await page.waitForTimeout(150);
    const after = await page.evaluate(id => { const g = S.schedule.games.find(x => x.id === id); return { hs: g.hs, as: g.as, week: S.week, view: UI.view }; }, repId);
    check('Greatest games: replay returns to Season, week unchanged', after.view === 'season' && after.week === 4);
    check('Greatest games: replay score == recorded score', rep && rep.hs === after.hs && rep.as === after.as, JSON.stringify({ rep, after }));
  }

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
  const seasonPersist = await page.evaluate(() => ({ sched: !!S.schedule, week: S.week, phase: S.phase, played: S.schedule ? S.schedule.games.filter(g => g.played).length : 0, version: S.version, statPlayers: S.world.teams.reduce((n, t) => n + t.roster.filter(p => p.gs).length, 0), honorWeeks: (S.weeklyHonors || []).length, recruitPool: S.recruiting ? S.recruiting.pool.length : 0, recruitBoard: S.recruiting ? S.recruiting.board.length : 0 }));
  check('Persistence: in-season schedule + records survive reload', seasonPersist.sched && seasonPersist.week === 4 && seasonPersist.phase === 'Regular Season' && seasonPersist.played > 0, JSON.stringify(seasonPersist));
  check('Persistence: per-player stats survive reload', seasonPersist.statPlayers > 50, `${seasonPersist.statPlayers} players with stats`);
  check('Persistence: recruiting pool + board survive reload', seasonPersist.recruitPool > 200 && seasonPersist.recruitBoard >= 1, JSON.stringify({ pool: seasonPersist.recruitPool, board: seasonPersist.recruitBoard }));
  check('Persistence: weekly honors survive reload', seasonPersist.version === 13 && seasonPersist.honorWeeks === 3, `v${seasonPersist.version}, ${seasonPersist.honorWeeks} honor weeks`);

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
  const mig = await page.evaluate(() => ({ v: S.version, year: S.year, tier: S.world.teams[0].staff[0].tier, boost: S.world.teams[0].staff[0].boost, rec: S.world.teams[0].rec, sched: S.schedule, honors: S.weeklyHonors, recruiting: S.recruiting, coachMarket: S.coachMarket, lastFinances: S.world.teams[0].lastFinances, awards: S.awards, series: S.series, seriesOffers: S.seriesOffers, homeState: S.world.teams[0].homeState, legends: S.world.teams[0].legends }));
  check('Migration: v1 save upgrades to current version (v13)', mig.v === 13, 'version=' + mig.v);
  check('Migration: year counter backfilled (v6→v7)', mig.year === 2026, 'year=' + mig.year);
  check('Migration: staff backfilled (tier/boost)', mig.tier != null && mig.boost != null, JSON.stringify({ tier: mig.tier, boost: mig.boost }));
  check('Migration: season fields backfilled (records, null schedule)', mig.rec && mig.rec.w === 0 && mig.rec.l === 0 && mig.sched === null, JSON.stringify(mig.rec));
  check('Migration: weekly honors backfilled (empty array)', Array.isArray(mig.honors) && mig.honors.length === 0, JSON.stringify(mig.honors));
  check('Migration: recruiting backfilled (null until kickoff)', mig.recruiting === null, JSON.stringify(mig.recruiting));
  check('Migration: coach market backfilled (null until offseason, v7→v8)', mig.coachMarket === null, JSON.stringify(mig.coachMarket));
  check('Migration: lastFinances backfilled (null until settled, v7→v8)', mig.lastFinances === null, JSON.stringify(mig.lastFinances));
  check('Migration: awards/series backfilled + homeState (v9→v10)', Array.isArray(mig.awards) && Array.isArray(mig.series) && !!mig.homeState, JSON.stringify({ aw: mig.awards.length, sr: mig.series.length, st: mig.homeState }));
  check('Migration: seriesOffers backfilled (null until offseason, v10→v11)', mig.seriesOffers === null, JSON.stringify(mig.seriesOffers));
  check('Migration: Ring of Honor backfilled (empty array, v12→v13)', Array.isArray(mig.legends) && mig.legends.length === 0, JSON.stringify(mig.legends));

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

  // ---------- PHASE 4: full recruiting cycle (fast-forward a fresh season) ----------
  // Start a clean deterministic game, aggressively recruit one target all season, run to Signing
  // Day via direct engine calls (no viewer), then assert the class closed + landed + UI grades it.
  await page.goto(`${BASE}?seed=2026&reset=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.getByPlaceholder('Coach').fill('Bear');
  await page.getByPlaceholder('Surname').fill('Bryant');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /Continue to team select/ }).click();
  await page.getByPlaceholder('Search teams…').fill('Alabama');
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /Alabama/ }).first().click();
  await page.getByRole('button', { name: /Slot 1/ }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /Kick off the season/ }).click();
  await page.waitForTimeout(150);
  const cycle = await page.evaluate(() => {
    const me = S.teamId;
    const tgt = S.recruiting.pool.find(r => r.stars === 4 && r.iv[me] == null);
    offerRecruit(tgt);
    scoutRecruit(tgt); visitRecruit(tgt); promiseRecruit(tgt, 'playingTime');   // maximal push
    let guard = 0;
    while (S.phase === 'Regular Season' && guard++ < 40) {
      while (S.recruiting.points >= RECRUIT_COSTS.pitch) pitchRecruit(tgt, tgt.prefs[0]);  // pitch their top angle
      advanceWeek();
    }
    const committed = S.recruiting.pool.filter(r => r.committedTo).length;
    const mine = S.recruiting.pool.filter(r => r.committedTo === me).length;
    return { signed: S.recruiting.signed, phase: S.phase, committed, mine, tgtMine: tgt.committedTo === me, rank: myClassRank() };
  });
  check('Recruiting cycle: Signing Day closes the class', cycle.signed && cycle.phase === 'Offseason');
  check('Recruiting cycle: nearly all prospects commit league-wide', cycle.committed > 270, cycle.committed + ' commits');
  check('Recruiting cycle: an aggressively recruited target commits to you', cycle.tgtMine);
  check('Recruiting cycle: the controlled team signs a class', cycle.mine > 0, cycle.mine + ' signees');
  check('Recruiting cycle: class rank is valid (1–134)', cycle.rank >= 1 && cycle.rank <= 134, '#' + cycle.rank);
  // Phase 10: a recruit's temperament is fogged until you scout them past the threshold
  const recFog = await page.evaluate(() => {
    const rec = S.recruiting.pool[0];
    const cold = traitRead('comp', rec.id, compVal(rec), 0);     // unscouted → hidden
    const warm = traitRead('comp', rec.id, compVal(rec), 80);    // scouted → revealed band
    return { hidden: cold.revealed === false && cold.text === '???', shown: warm.revealed === true && warm.text !== '???' };
  });
  check('Phase 10: recruit traits hidden until scouted, then revealed', recFog.hidden && recFog.shown);
  await page.locator('[data-tid="nav-recruit"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-tid="rtab-class"]').click();
  await page.waitForTimeout(150);
  const classTxt = await page.evaluate(() => document.querySelector('.view').innerText);
  check('Recruiting cycle: Class tab shows the signed class + grade', /class rank/i.test(classTxt) && /projected/i.test(classTxt));
  check('Recruiting cycle: Signing Day reflected in summary (CLOSED)', /CLOSED/.test(classTxt) || /Signing Day/i.test(classTxt));
  await shot(page, '25-recruiting-class.png');

  // ---------- PHASE 8: geography + season awards + non-conference series ----------
  // The season just ended (Offseason), so awards have been computed + stamped. Verify the ceremony,
  // the awards tab, AI geography on teams, and book a non-conf series that lands next season.
  const p8 = await page.evaluate(() => {
    const me = controlled();
    const aw = S.awards && S.awards[S.awards.length - 1];
    const honored = S.world.teams.reduce((n, t) => n + t.roster.filter(p => p.honors && p.honors.length).length, 0);
    // book a home-and-home with a willing non-conf opponent, plus a 2-for-1 with a smaller program
    const opp = S.world.teams.find(x => x.conf !== me.conf && !seriesExistsWith(x.id) && seriesWillingness(me, x, 'home-home', 0));
    const res = opp ? proposeSeries(opp.id, 'home-home', 0) : { ok: false };
    const smaller = S.world.teams.find(x => x.conf !== me.conf && !seriesExistsWith(x.id) && seriesWillingness(me, x, '2-for-1', 0));
    const res2 = smaller ? proposeSeries(smaller.id, '2-for-1', 0) : { ok: false };
    const twoForOne = S.series.find(s => s.type === '2-for-1');
    // AI-initiated offers: ensure a wave exists, then accept one
    const offers = ensureSeriesOffers();
    const offerN = offers.length;
    const accepted = offers.length ? acceptSeriesOffer(offers[0].id) : false;
    return { hasAwards: !!aw, heisman: aw && aw.heisman ? aw.heisman.name : null, allAm: aw ? aw.allAmerican.length : 0,
      allConf: aw && aw.allConference && aw.allConference[me.conf] ? aw.allConference[me.conf].length : 0,
      honored, myState: me.homeState,
      seriesOk: res.ok, seriesN: S.series.length, legYears: S.series.flatMap(s => s.legs.map(l => l.year)),
      twoForOneLegs: twoForOne ? twoForOne.legs.length : 0, offerN, accepted };
  });
  check('Phase 8: season awards computed at season end', p8.hasAwards && !!p8.heisman, 'Heisman: ' + p8.heisman);
  check('Phase 8: All-America team selected', p8.allAm > 5, p8.allAm + ' selections');
  check('Phase 8: All-Conference team selected for the player conf', p8.allConf > 5, p8.allConf + ' selections');
  check('Phase 8: award winners stamped with honors (league-wide)', p8.honored > 0, p8.honored + ' honored players');
  check('Phase 8: AI geography — teams carry a home state', !!p8.myState && p8.myState.length === 2, 'mine ' + p8.myState);
  check('Phase 8: a non-conference series can be booked', p8.seriesOk && p8.seriesN > 0, p8.seriesN + ' series, legs ' + p8.legYears.join('/'));
  check('Phase 8: a 2-for-1 books three legs', p8.twoForOneLegs === 3, p8.twoForOneLegs + ' legs');
  check('Phase 8: AI-initiated series offers exist + can be accepted', p8.offerN > 0 && p8.accepted, p8.offerN + ' offers');
  // coach-identity GM effects: Manager finances/facilities/retention, Lifer cheaper staff, academics→risk
  const ident = await page.evaluate(() => {
    const save = { a: S.coach.archetype, h: S.coach.history };
    S.coach.archetype = 'Manager'; const mgrFin = mgrFinanceMult(), mgrFac = facilityDiscount();
    S.coach.archetype = 'Recruiter'; const baseFin = mgrFinanceMult(), baseFac = facilityDiscount();
    S.coach.history = 'Lifer'; const lifer = staffCostMult();
    S.coach.history = 'Former Player'; const nonLifer = staffCostMult();
    S.coach.archetype = save.a; S.coach.history = save.h;
    return { mgrFin, baseFin, mgrFac, baseFac, lifer, nonLifer };
  });
  check('Phase 7+: Manager boosts revenue + discounts facilities', ident.mgrFin > ident.baseFin && ident.mgrFac < ident.baseFac);
  check('Phase 7+: Lifer gets cheaper staff', ident.lifer < ident.nonLifer, `${ident.lifer} vs ${ident.nonLifer}`);
  // Home shows the awards ceremony card; the Season Awards tab renders
  await page.locator('[data-tid="nav-home"]').click();
  await page.waitForTimeout(120);
  check('Phase 8: Home shows the awards ceremony card', await page.locator('[data-tid="awards-card"]').count() > 0);
  await page.locator('[data-tid="nav-season"]').click();
  await page.waitForTimeout(100);
  await page.locator('[data-tid="stab-awards"]').click();
  await page.waitForTimeout(120);
  const awardsTxt = await page.evaluate(() => document.querySelector('.view').innerText);
  check('Phase 8: Season Awards tab renders honors', /Heisman/i.test(awardsTxt) && /All-America/i.test(awardsTxt));
  check('Phase 8: series card lists the booked series', await page.evaluate(() => { UI.seasonTab = 'schedule'; render(); return document.querySelector('[data-tid="series-card"]') ? document.querySelector('[data-tid="series-card"]').innerText.length > 0 : false; }));
  await shot(page, '29-awards.png');

  // ---------- PHASE 5: season rollover (Offseason → next Preseason) ----------
  // The recruiting cycle above left us in the Offseason with a signed class. Roll the season over
  // from the Home "On the Clock" card and assert the class enrolled, seniors graduated, the season
  // fields reset, and the next kickoff rebuilds a fresh schedule + recruiting cycle.
  const roPre = await page.evaluate(() => {
    const me = S.teamId, t = S.world.teams.find(x => x.id === me);
    return {
      year: S.year, phase: S.phase, myClass: S.recruiting.pool.filter(r => r.committedTo === me).length,
      mySeniors: t.roster.filter(p => p.yr === 'SR' || p.yr === 'RS-SR').length,
      myRosterN: t.roster.length, statPlayers: S.world.teams.reduce((n, x) => n + x.roster.filter(p => p.gs).length, 0),
      sizes: S.world.teams.map(x => x.roster.length)
    };
  });
  await page.locator('[data-tid="nav-home"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-tid="adv-clock"]').click();   // "Roll over to <year> →"
  await page.waitForTimeout(180);
  const roPost = await page.evaluate(() => {
    const me = S.teamId, t = S.world.teams.find(x => x.id === me);
    return {
      year: S.year, phase: S.phase, version: S.version, sched: S.schedule, recruiting: S.recruiting,
      honors: S.weeklyHonors.length, week: S.week,
      myFresh: t.roster.filter(p => p.fromRecruit).length, myFR: t.roster.filter(p => p.yr === 'FR').length,
      myRosterN: t.roster.length, sizesOk: S.world.teams.every(x => x.roster.length >= 78 && x.roster.length <= 96),
      statPlayers: S.world.teams.reduce((n, x) => n + x.roster.filter(p => p.gs).length, 0),
      report: S.offseasonReport, noOldSR: t.roster.every(p => p.fromRecruit || p.yr !== undefined),
      marketSize: S.coachMarket ? S.coachMarket.length : 0,
      myDev: t.roster.filter(p => p.dev > 0).length, devNeverPastPot: t.roster.every(p => p.ov <= p.pot),
      honoredAfter: S.world.teams.reduce((n, x) => n + x.roster.filter(p => p.honors && p.honors.length).length, 0),
      seriesKept: (S.series || []).length, awardsKept: (S.awards || []).length,
      careerPlayers: S.world.teams.reduce((n, x) => n + x.roster.filter(p => p.career).length, 0),
      ringTotal: S.world.teams.reduce((n, x) => n + (x.legends ? x.legends.length : 0), 0),
      ringValid: S.world.teams.every(x => !x.legends || x.legends.length <= 12)
    };
  });
  check('Rollover: advances to the next calendar year', roPost.year === roPre.year + 1, `${roPre.year} → ${roPost.year}`);
  check('Rollover: lands in Preseason, week reset to 0', roPost.phase === 'Preseason' && roPost.week === 0);
  check('Rollover: season fields cleared (schedule + recruiting null, honors empty)', roPost.sched === null && roPost.recruiting === null && roPost.honors === 0);
  check('Rollover: save version bumped to 13', roPost.version === 13, 'v' + roPost.version);
  check('Phase 8: player honors survive the rollover', roPost.honoredAfter > 0, roPost.honoredAfter + ' still honored');
  check('Phase 8: series + awards history persist across the rollover', roPost.seriesKept > 0 && roPost.awardsKept > 0, `series ${roPost.seriesKept}, awards ${roPost.awardsKept}`);
  check('Phase 11: career totals accrue across the rollover', roPost.careerPlayers > 50, roPost.careerPlayers + ' players carry a career');
  check('Phase 11: notable graduates enshrined into Rings of Honor (league-wide)', roPost.ringTotal > 0, roPost.ringTotal + ' legends league-wide');
  check('Phase 11: no Ring of Honor exceeds the 12-legend cap', roPost.ringValid);
  check('Rollover: signed class enrolled as freshmen', roPost.myFresh === roPre.myClass && roPost.myFresh > 0, `${roPost.myFresh} enrolled (class ${roPre.myClass})`);
  check('Rollover: roster holds at ~84 league-wide', roPost.sizesOk && roPost.myRosterN >= 78 && roPost.myRosterN <= 96, 'mine ' + roPost.myRosterN);
  check('Rollover: last season stats wiped (no p.gs carryover)', roPost.statPlayers === 0, roPost.statPlayers + ' players still carry stats');
  check('Rollover: offseason recap recorded', roPost.report && roPost.report.year === roPost.year && roPost.report.graduated === roPre.mySeniors, `grads ${roPost.report && roPost.report.graduated} vs ${roPre.mySeniors}`);
  // recap card + year visible on Home; then kick the new season off
  const recapTxt = await page.evaluate(() => document.querySelector('.view').innerText);
  check('Rollover: Home shows the offseason recap card', /offseason recap/i.test(recapTxt) && /freshmen on roster/i.test(recapTxt));
  await shot(page, '26-offseason-rollover.png');

  // ---------- PHASE 7: development depth + coach identity ----------
  // The rollover above developed every returning player toward (never past) their ceiling. Verify
  // growth was recorded + surfaced, side-specific dev wiring, and the in-game coach edge.
  check('Phase 7: returning players developed (growth recorded)', roPost.myDev > 0, roPost.myDev + ' grew');
  check('Phase 7: development never exceeds the ceiling (ov ≤ pot)', roPost.devNeverPastPot);
  await page.locator('[data-tid="nav-team"]').click();
  await page.waitForTimeout(150);
  const growthUI = await page.evaluate(() => [...document.querySelectorAll('.lrow .tag')].some(t => t.textContent.includes('▲')));
  check('Phase 7: roster surfaces growth (▲ chip after rollover)', growthUI);
  const p7 = await page.evaluate(() => {
    const t = controlled(), save = S.coach.archetype;
    S.coach.archetype = 'Manager'; const mQB = devRateFor(t, { pos: 'QB' }), mLB = devRateFor(t, { pos: 'LB' });
    S.coach.archetype = 'Offensive Genius'; const gQB = devRateFor(t, { pos: 'QB' }), gLB = devRateFor(t, { pos: 'LB' });
    const og = coachGameEdges(t); S.coach.archetype = 'Defensive Genius'; const dg = coachGameEdges(t);
    S.coach.archetype = save; const baseEdge = coachGameEdges(t);
    return { mQB, mLB, gQB, gLB, og, dg, baseEdge };
  });
  check('Phase 7: Off Genius speeds offensive dev only', p7.gQB > p7.mQB && Math.abs(p7.gLB - p7.mLB) < 1e-9);
  check('Phase 7: in-game edge is side-specific (OG→offense, DG→defense)', p7.og.off > p7.og.def && p7.dg.def > p7.dg.off);
  check('Phase 7: controlled team carries a coach game edge (Former Player default)', p7.baseEdge.off > 0);

  // ---------- PHASE 6: program management (finances + facilities + coaching carousel) ----------
  // We're in the post-rollover Preseason. Finances settled at rollover (lastFinances present + a
  // refreshed coach market). Drive a facility upgrade, then fire + replace a coordinator, asserting
  // budget/payroll/ratings move and no coordinator slot is left vacant before kickoff.
  check('Phase 6: coach market refreshed at rollover', roPost.marketSize > 0, roPost.marketSize + ' free agents');
  check('Phase 6: finances settled at rollover (lastFinances present)', roPost.report && roPost.report.finances != null);
  await page.evaluate(() => { controlled().budget = 500e6; });   // fund the program so spend mechanics aren't gated by balance
  await page.evaluate(() => { UI.view = 'program'; render(); });
  await page.waitForTimeout(120);
  const facPre = await page.evaluate(() => { const t = controlled(); return { budget: t.budget, strength: t.fac.strength, def: t.ratings.def }; });
  await page.locator('[data-tid="upg-strength"]').click();
  await page.waitForTimeout(150);
  const facPost = await page.evaluate(() => { const t = controlled(); return { budget: t.budget, strength: t.fac.strength, def: t.ratings.def }; });
  check('Phase 6: facility upgrade raises the level', facPost.strength === facPre.strength + 1, `${facPre.strength}→${facPost.strength}`);
  check('Phase 6: facility upgrade spends budget', facPost.budget < facPre.budget, `${(facPre.budget / 1e6).toFixed(0)}M→${(facPost.budget / 1e6).toFixed(0)}M`);
  await shot(page, '27-program-facilities.png');
  // fire the OC, then hire a replacement from the carousel
  await page.evaluate(() => { UI.view = 'team'; UI.tab = 'coaches'; render(); });
  await page.waitForTimeout(120);
  const coachPre = await page.evaluate(() => { const t = controlled(); return { payroll: t.payroll, off: t.ratings.off, staffN: t.staff.length }; });
  await page.locator('.lrow[data-id="OC"]').first().click();   // open the OC coach sheet
  await page.waitForTimeout(120);
  await page.locator('[data-tid="fire-coach"]').click();
  await page.waitForTimeout(120);
  await page.getByRole('button', { name: /Yes, continue/ }).click();
  await page.waitForTimeout(150);
  const fired = await page.evaluate(() => { const t = controlled(); return { hasOC: !!t.staff.find(c => c.role === 'OC' && c.tier === 'coord'), payroll: t.payroll, payrollOk: t.payroll === t.staff.reduce((s, x) => s + x.salary, 0) }; });
  check('Phase 6: firing a coordinator opens a vacancy', !fired.hasOC);
  check('Phase 6: payroll == Σ salaries after firing', fired.payrollOk);
  // hire a replacement via the vacancy row → carousel
  await page.locator('[data-tid="vacancy-OC"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-tid="carousel-sheet"] .lrow').first().click();
  await page.waitForTimeout(150);
  const hired = await page.evaluate(() => { const t = controlled(); return { hasOC: !!t.staff.find(c => c.role === 'OC' && c.tier === 'coord'), payrollOk: t.payroll === t.staff.reduce((s, x) => s + x.salary, 0), off: t.ratings.off }; });
  check('Phase 6: hiring fills the coordinator vacancy', hired.hasOC);
  check('Phase 6: payroll == Σ salaries after hiring', hired.payrollOk);
  await shot(page, '28-coaching-carousel.png');
  // backstop: fill any coordinator slot a rollover poach may have opened, so kickoff isn't gated
  await page.evaluate(() => { const t = controlled(); vacantCoordSlots(t).forEach(([code]) => { ensureCoachMarket(); const c = S.coachMarket.find(x => x.tier === 'coord'); if (c) hireCoach(t, c, code); }); });
  await page.waitForTimeout(100);

  await page.locator('[data-tid="nav-home"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-tid="adv-clock"]').click();   // "Kick off the season →"
  await page.waitForTimeout(180);
  const next = await page.evaluate(() => ({ phase: S.phase, week: S.week, sched: !!S.schedule, pool: S.recruiting ? S.recruiting.pool.length : 0,
    seriesGames: S.schedule ? S.schedule.games.filter(g => g.series).length : 0,
    mySeriesGame: S.schedule ? S.schedule.games.some(g => g.series && (g.home === S.teamId || g.away === S.teamId)) : false }));
  check('Rollover: next season kicks off cleanly (schedule + fresh recruiting cycle)', next.phase === 'Regular Season' && next.week === 1 && next.sched && next.pool > 0, `pool ${next.pool}`);

  // ---------- PHASE 11: alumni visit + legacy aura (integrated) ----------
  // Inject a high-stature legend onto the controlled team (with appearances refreshed at kickoff),
  // then drive the alumni-visit action on a board prospect and confirm interest rises + an
  // appearance is spent, and that a deep ring nudges recruitFit upward.
  const leg = await page.evaluate(() => {
    const t = controlled();
    // craft a legend perfectly relevant to a real uncommitted prospect, with appearances available
    const rec = S.recruiting.pool.find(r => !r.committedTo);
    t.legends = [{ id: 'qaLeg', name: 'QA Legend', pos: rec.pos, st: rec.st, peakOv: 95, from: S.year - 5, to: S.year - 1, honors: [{ year: S.year - 1, award: 'Heisman (National POY)' }], career: { rYds: 6000, rTD: 60 }, stature: 95, tier: 'Immortal', app: LEGEND_APPS }];
    offerRecruit(rec);                                    // put them on the board so we can work them
    S.recruiting.points = 50;                             // ensure points to spend
    const before = Math.round(rec.iv[S.teamId] || 0), appBefore = t.legends[0].app;
    const avail = availableLegends(rec).length;
    const ok = alumniVisit(rec, t.legends[0]);
    const after = Math.round(rec.iv[S.teamId] || 0);
    // aura: recruitFit on an unsaturated scenario (mid prestige vs a 4★) — with vs without the ring
    const probe = { stars: 4, pos: 'WR', st: 'XX', prefs: [] };
    const withRing = Object.assign({}, t, { prestige: 55, homeState: '', legends: t.legends });
    const noRing = Object.assign({}, t, { prestige: 55, homeState: '', legends: [] });
    const fitWith = recruitFit(withRing, probe), fitWithout = recruitFit(noRing, probe);
    return { ok, before, after, appBefore, appAfter: t.legends[0].app, avail, recAlumni: rec.alumni, aura: legacyAura(t), fitWith, fitWithout };
  });
  check('Phase 11: an alumni visit is available when a relevant legend has appearances', leg.avail >= 1, leg.avail + ' available');
  check('Phase 11: alumni visit raises recruit interest', leg.ok && leg.after > leg.before, `${leg.before}→${leg.after}`);
  check('Phase 11: alumni visit spends one appearance', leg.appAfter === leg.appBefore - 1, `${leg.appBefore}→${leg.appAfter}`);
  check('Phase 11: alumni visit is recorded on the recruit (no stacking)', leg.recAlumni === 'qaLeg');
  check('Phase 11: a deep Ring of Honor nudges recruitFit (legacy aura)', leg.fitWith > leg.fitWithout, `${leg.fitWith.toFixed(3)} vs ${leg.fitWithout.toFixed(3)}`);
  // Ring of Honor renders on the Program page
  await page.evaluate(() => { UI.view = 'program'; render(); });
  await page.waitForTimeout(120);
  const ringUI = await page.evaluate(() => { const el = document.querySelector('[data-id="legend-qaLeg"]'); return { shown: !!el, text: el ? el.innerText : '' }; });
  check('Phase 11: Ring of Honor lists legends on the Program page', ringUI.shown && /QA Legend/.test(ringUI.text), ringUI.text.replace(/\n/g, ' ').slice(0, 60));
  check('Phase 8: booked series appears in the next schedule (locked leg)', next.seriesGames > 0 && next.mySeriesGame, `${next.seriesGames} series games`);

  // ---------- PHASE 9: storage codec (columnar rosters, deploy-safe round-trip) ----------
  const codec = await page.evaluate(() => {
    const eq = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; return ka.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k])); };
    const full = JSON.stringify(S).length;
    const enc = encodeState(S); const encLen = JSON.stringify(enc).length;
    const dec = decodeState(JSON.parse(JSON.stringify(enc)));   // simulate a storage round-trip
    let ok = true, np = 0;
    S.world.teams.forEach((t, i) => { const d = dec.world.teams[i]; if (!d || t.roster.length !== d.roster.length) { ok = false; return; } t.roster.forEach((p, j) => { np++; if (!eq(p, d.roster[j])) ok = false; }); });
    const topOk = dec.seed === S.seed && dec.year === S.year && dec.teamId === S.teamId && dec.version === S.version && dec.awards.length === S.awards.length;
    return { full, encLen, ok, np, topOk, encMarker: !!enc._sv, decClean: dec._sv === undefined };
  });
  check('Phase 9: columnar codec round-trips every roster exactly', codec.ok && codec.np > 10000, codec.np + ' players checked');
  check('Phase 9: codec preserves top-level state (seed/year/awards/…)', codec.topOk);
  check('Phase 9: encoded save is meaningfully smaller', codec.encLen < codec.full * 0.78, `${(codec.full / 1024 | 0)}KB → ${(codec.encLen / 1024 | 0)}KB`);
  check('Phase 9: encode tags the blob, decode strips the tag', codec.encMarker && codec.decClean);

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

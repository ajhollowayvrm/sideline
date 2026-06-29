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

  // ---------- PHASE 22: interactive play-calling ----------
  // (a) pure determinism: a coached game commits to EXACTLY the result the driver produced (watch ==
  // commit), and calling your own plays changes the outcome vs the OC autopilot. No real game mutated.
  const pc = await page.evaluate(() => {
    const me = S.teamId, g = S.schedule.games.find(x => !x.played && (x.home === me || x.away === me));
    if (!g) return { skip: true };
    const { home, away } = simSides(g), seed = gameSeed(g);
    const decisions = [];
    // call offense (always pass) AND defense (always cover) — exercises Phase 28 in the watch==commit path
    const driven = simEngine(home, away, seed, { decideFor: me, aiDefVs: me, decide: ctx => { const c = ctx.phase === 'def' ? 'cover' : ctx.phase === 'fourth' ? ctx.ocAct : 'pass'; decisions.push(c); return c; } });
    const clone = { id: g.id, home: g.home, away: g.away, calls: decisions.slice() };
    simGame(clone);                                   // commit-path replay on a CLONE (real game untouched)
    const ai = simEngine(home, away, seed);           // OC/DC autopilot for comparison
    return { skip: false, sameAsDriver: clone.hs === driven.hs && clone.as === driven.as, diffFromAI: driven.hs !== ai.hs || driven.as !== ai.as, played: g.played, hasDef: decisions.includes('cover'), coached: `${driven.hs}-${driven.as}`, ai: `${ai.hs}-${ai.as}` };
  });
  check('Phase 22: a coached game commits to exactly the called result (watch == commit)', pc.skip || pc.sameAsDriver, JSON.stringify(pc));
  check('Phase 22: calling your own plays changes the outcome vs the OC autopilot', pc.skip || pc.diffFromAI, JSON.stringify(pc));
  check('Phase 22: the determinism check did not commit the real game', pc.skip || pc.played === false);
  check('Phase 28: defensive play-calls are part of the deterministic coached game', pc.skip || pc.hasDef);
  // Phase 29: the AI defensive coordinator makes your (predictable) offense work harder than vs a base D
  const aidc = await page.evaluate(() => {
    const me = S.teamId, mine = S.schedule.games.filter(x => x.home === me || x.away === me).slice(0, 6);
    const allPass = ctx => ctx.phase === 'fourth' ? ctx.ocAct : ctx.phase === 'def' ? 'base' : 'pass';
    let dc = 0, bs = 0;
    mine.forEach(g => { const { home, away } = simSides(g), seed = gameSeed(g), my = g.home === me ? 'hs' : 'as';
      dc += simEngine(home, away, seed, { decideFor: me, aiDefVs: me, decide: allPass })[my];
      bs += simEngine(home, away, seed, { decideFor: me, decide: allPass })[my]; });
    return { dc, bs, harder: dc < bs };
  });
  check('Phase 29: an AI defensive coordinator makes your predictable offense work harder', aidc.harder, JSON.stringify(aidc));
  // (b) UI smoke: open the viewer → Coach this game → Full control surfaces the field + a play call →
  // make a call → bail without committing (interactive never mutates the game until "Continue").
  await page.getByRole('button', { name: /Play Week/ }).click();
  await page.waitForTimeout(120);
  if ((await screen(page)) === 'game') {
    check('Phase 22: the viewer offers “Coach this game”', await page.locator('[data-tid="game-coach"]').isVisible());
    await page.locator('[data-tid="game-coach"]').click();
    await page.waitForTimeout(60);
    await page.locator('[data-mode="full"]').click();
    await page.waitForTimeout(60);
    const fld = await page.evaluate(() => ({ interactive: !!(UI.game && UI.game.interactive), pending: !!(UI.game && UI.game.pending), hasField: !!document.querySelector('[data-tid="game-board"]') && !!document.querySelector('svg'), hasCall: !!document.querySelector('[data-tid="game-call"] [data-call]') }));
    check('Phase 22: Coach mode renders the SVG field + a play-call prompt', fld.interactive && fld.pending && fld.hasField && fld.hasCall, JSON.stringify(fld));
    await shot(page, '19b-coach-field.png');
    const before = await page.evaluate(() => UI.game.decisions.length);
    await page.locator('[data-tid="game-call"] [data-call]').first().click();
    await page.waitForTimeout(60);
    const after = await page.evaluate(() => UI.game.decisions.length);
    check('Phase 22: making a call advances the drive (decision recorded)', after > before, `${before}→${after}`);
    // Phase 24: open the in-game adjustments sheet, assign a coverage shadow + a pep-talk, apply
    if (await page.evaluate(() => !!(UI.game && UI.game.pending))) {
      await page.locator('[data-tid="game-adjust"]').click();
      await page.waitForTimeout(60);
      const sheetOK = await page.evaluate(() => !!document.querySelector('[data-tid="adjust-apply"]'));
      check('Phase 24: the in-game adjustments sheet opens', sheetOK);
      await page.evaluate(() => { const G = UI.game, me = S.teamId, opp = teamById(G.home === me ? G.away : G.home), t = controlled();
        const rc = opp.roster.filter(p => p.pos === 'WR').sort((a, b) => a.so - b.so)[0]; const db = t.roster.filter(p => p.pos === 'CB').sort((a, b) => a.so - b.so)[1] || t.roster.filter(p => p.pos === 'CB')[0];
        G.plan.shadow[rc.pos + (rc.so || 0)] = db.id; const any = t.roster.find(p => p.pos === 'S'); if (any) G.plan.boost[any.id] = 4; G.plan.calm = true; });
      await page.locator('[data-tid="adjust-apply"]').click();
      await page.waitForTimeout(70);
      const adj = await page.evaluate(() => ({ n: (UI.game.adjusts || []).length, hasShadow: (UI.game.adjusts || []).some(a => Object.keys(a.plan.shadow || {}).length), hasBoost: (UI.game.adjusts || []).some(a => Object.keys(a.plan.boost || {}).length), hasCalm: (UI.game.adjusts || []).some(a => a.plan.calm) }));
      check('Phase 24: applying an adjustment records it on the timeline (coverage + pep-talk)', adj.n > 0 && adj.hasShadow && adj.hasBoost, JSON.stringify(adj));
      check('Phase 25: "calm them down" is recorded on the adjustment timeline', adj.hasCalm);
    }
    // resolve the rest (Auto) → the live matchup / coverage panel populates from the running box
    await page.locator('[data-mode="auto"]').click();
    await page.waitForTimeout(90);
    const panel = await page.evaluate(() => ({ done: !!(UI.game && UI.game.done), matchups: !!document.querySelector('[data-tid="matchups"]'), boxCov: !!(UI.game && UI.game.box && Object.values(UI.game.box).some(b => b && b.cvYds)), pen: !!(UI.game && UI.game.pen && Object.values(UI.game.pen).some(p => p && p.n > 0)) }));
    check('Phase 23: the coach view shows a live matchup / coverage panel', panel.matchups && panel.boxCov, JSON.stringify(panel));
    check('Phase 25: penalties accrue + surface during a game', panel.pen, JSON.stringify(panel));
    await shot(page, '19c-coach-matchups.png');
    // bail without committing — the upcoming game must stay unplayed
    const bailed = await page.evaluate(() => { const me = S.teamId, wk = S.week; UI.game = null; UI.view = 'home'; render(); const g = S.schedule.games.find(x => (x.home === me || x.away === me) && x.week === wk); return g ? g.played === false : true; });
    check('Phase 22: leaving Coach mode does not commit the game', bailed);
  }

  // ---------- PHASE 27: week-to-week injuries ----------
  const inj = await page.evaluate(() => {
    const t = controlled(), opp = S.world.teams.find(x => x.id !== t.id);
    const qb = t.roster.filter(p => p.pos === 'QB').sort((a, b) => a.so - b.so)[0];
    const stars = [...t.roster].sort((a, b) => b.ov - a.ov).slice(0, 3);   // top-3 by OVR → a clear rating hit
    const outSet = new Set([qb.id, ...stars.map(p => p.id)]);
    const fullOff = t.ratings.off;
    outSet.forEach(id => { const p = t.roster.find(x => x.id === id); p.inj = 3; });   // bench them for 3 weeks
    const droppedOff = availRatings(t).off < fullOff;          // available rating drops (live-p.inj fallback)
    const res = simEngine(t, opp, 13131, { benched: outSet });
    const qbPlayed = !!(res.box[qb.id] && res.box[qb.id].pAtt);
    healWeek(); const afterHeal = qb.inj;                       // a week ticks off
    UI.view = 'home'; render();
    const reportShown = !!document.querySelector('[data-tid="injury-report"]');
    outSet.forEach(id => { const p = t.roster.find(x => x.id === id); if (p) delete p.inj; });   // cleanup
    return { droppedOff, qbPlayed, afterHeal, reportShown };
  });
  check('Phase 27: injured starters lower the team’s available rating', inj.droppedOff);
  check('Phase 27: an injured player is held out of the game (backup plays)', !inj.qbPlayed);
  check('Phase 27: injuries heal a week at a time', inj.afterHeal === 2, 'after heal: ' + inj.afterHeal);
  check('Phase 27: the Home injury report lists who is out', inj.reportShown);

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
    const clone = { id: g.id, home: g.home, away: g.away, out: g.out, played: false, hs: null, as: null };  // carry frozen availability (Phase 27)
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
  check('Persistence: weekly honors survive reload', seasonPersist.version === 28 && seasonPersist.honorWeeks === 3, `v${seasonPersist.version}, ${seasonPersist.honorWeeks} honor weeks`);

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
  const mig = await page.evaluate(() => ({ v: S.version, year: S.year, tier: S.world.teams[0].staff[0].tier, boost: S.world.teams[0].staff[0].boost, rec: S.world.teams[0].rec, sched: S.schedule, honors: S.weeklyHonors, recruiting: S.recruiting, coachMarket: S.coachMarket, lastFinances: S.world.teams[0].lastFinances, awards: S.awards, series: S.series, seriesOffers: S.seriesOffers, homeState: S.world.teams[0].homeState, legends: S.world.teams[0].legends, postseason: ('postseason' in S) ? S.postseason : 'missing', draft: ('draft' in S) ? S.draft : 'missing' }));
  check('Migration: v1 save upgrades to current version (v28)', mig.v === 28, 'version=' + mig.v);
  check('Migration: postseason backfilled (null until regular season ends, v13→v14)', mig.postseason === null, JSON.stringify(mig.postseason));
  check('Migration: draft backfilled (null until first rollover, v14→v15)', mig.draft === null, JSON.stringify(mig.draft));
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
  // ---------- PHASE 19b: approval strip + a week-1 press conference ----------
  const press = await page.evaluate(() => {
    UI.view = 'home'; render();
    const strip = !!document.querySelector('[data-tid="approval-strip"]');
    const pressCard = !!document.querySelector('[data-tid="press-card"]');
    const t = S.world.teams.find(x => x.id === S.teamId);
    const bBefore = t.mediaBuzz || 0, offered = !!currentPress();
    if (offered) answerPress('hype');
    return { strip, pressCard, hasApproval: typeof S.coach.approval === 'number', offered,
      buzzRose: (t.mediaBuzz || 0) > bBefore, pressClosed: S.media.pressWeek === S.week, gone: !currentPress() };
  });
  check('Phase 19b: Home shows the approval / hot-seat strip', press.strip && press.hasApproval);
  check('Phase 19b: a weekly press conference is offered (once per week)', press.pressCard && press.offered);
  check('Phase 19b: a press choice raises recruiting buzz + closes the week’s presser', press.buzzRose && press.pressClosed && press.gone);
  // ---------- PHASE 20: Ego trait + per-player morale (the 'hype' presser just moved the locker room) ----------
  const ego = await page.evaluate(() => {
    const t = S.world.teams.find(x => x.id === S.teamId);
    const hi = t.roster.reduce((b, p) => (!b || (p.ego || 50) > (b.ego || 50)) ? p : b, null);
    const lo = t.roster.reduce((b, p) => (!b || (p.ego || 50) < (b.ego || 50)) ? p : b, null);
    const rec = S.recruiting.pool[0];
    const cold = traitRead('ego', rec.id, egoVal(rec), 0), warm = traitRead('ego', rec.id, egoVal(rec), 80);
    UI.view = 'team'; UI.tab = 'roster'; render();
    const txt = document.querySelector('.view').innerText;
    return {
      hiEgo: hi.ego, loEgo: lo.ego,
      hiMove: (hi.morale != null ? hi.morale : 50) - 50, loMove: (lo.morale != null ? lo.morale : 50) - 50,
      egoFogged: cold.text === '???' && warm.text !== '???', egoChip: /ego:/i.test(txt),
      teamMorale: (() => { const v = t.roster.map(p => p.morale != null ? p.morale : 50); return v.reduce((s, x) => s + x, 0) / v.length; })()
    };
  });
  check('Phase 20: a press choice moves morale more for a high-ego player than a low-ego one', ego.hiMove > ego.loMove, `hi +${ego.hiMove} (ego ${ego.hiEgo}) vs lo +${ego.loMove} (ego ${ego.loEgo})`);
  check('Phase 20: the “hype” presser lifted the locker room overall', ego.teamMorale > 50, `avg ${ego.teamMorale.toFixed(1)}`);
  check('Phase 20: the Ego trait is fogged like the others (hidden until scouted)', ego.egoFogged);
  check('Phase 20: the roster surfaces the Ego trait chip', ego.egoChip);
  const scheme = await page.evaluate(() => {
    const t = S.world.teams.find(x => x.id === S.teamId);
    const installedMatch = t.offScheme === S.coach.offScheme && t.defScheme === S.coach.defScheme;
    const buyOff = schemeBuyIn(t, 'off'), buyDef = schemeBuyIn(t, 'def');
    const opp = S.world.teams.find(x => x.id !== t.id);
    const d1 = schemeDelta(t, opp), d2 = schemeDelta(t, opp);
    const det = d1.off === d2.off && d1.def === d2.def, bounded = Math.abs(d1.off) <= 4 && Math.abs(d1.def) <= 1;
    const p = t.roster.find(x => x.pos === 'QB'), name = playerSchemeName(p);
    const fog = schemeRead(name, 0).text === '???' && schemeRead(name, 90).text === name;
    UI.view = 'team'; UI.tab = 'roster'; render();
    const rosterChip = /scheme:/i.test(document.querySelector('.view').innerText);
    UI.view = 'program'; render();
    const cardEl = document.querySelector('[data-tid="schemes"]');
    const card = !!cardEl && cardEl.innerText.includes(t.offScheme);
    const otherOff = OFF_SCHEMES.find(s => s !== t.offScheme), before = t.offScheme;
    t.offScheme = otherOff; const buyDropped = schemeBuyIn(t, 'off') === 0 && buyOff > 0; t.offScheme = before;
    UI.view = 'home'; render();
    return { installedMatch, buyOff, buyDef, det, bounded, fog, rosterChip, card, buyDropped };
  });
  check('Phase 21: your program runs your preferred schemes (installed at takeover)', scheme.installedMatch);
  check('Phase 21: running your scheme gives a buy-in edge on both sides', scheme.buyOff > 0 && scheme.buyDef > 0, `O+${scheme.buyOff} D+${scheme.buyDef}`);
  check('Phase 21: scheme delta is deterministic + bounded (OVR still dominates)', scheme.det && scheme.bounded);
  check('Phase 21: a player’s preferred scheme is fogged (??? until known)', scheme.fog);
  check('Phase 21: the roster row surfaces a scheme chip', scheme.rosterChip);
  check('Phase 21: the Program page shows the Schemes card', scheme.card);
  check('Phase 21: installing a non-preferred scheme drops the buy-in', scheme.buyDropped);
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
    const signedNow = S.recruiting.pool.filter(r => r.signed).length;
    const mine = S.recruiting.pool.filter(r => r.committedTo === me).length;
    return { signed: S.recruiting.signed, stage: S.recruiting.stage, phase: S.phase, committed, signedNow, mine, tgtMine: tgt.committedTo === me, rank: myClassRank(),
      champPhase: S.phase, champGames: S.champWeek ? S.champWeek.games.length : 0 };
  });
  check('Phase 14: season ends with VERBAL commits, class not yet signed', !cycle.signed && cycle.stage === 'open' && cycle.signedNow === 0 && cycle.champPhase === 'Conference Championships', `stage ${cycle.stage}, signed ${cycle.signedNow}`);
  // ---------- PHASE 15: Championship Week (conf title games → CFP auto-bid seeding) ----------
  check('Phase 15: regular season hands off to Championship Week with title games', cycle.champPhase === 'Conference Championships' && cycle.champGames > 5, `${cycle.champGames} title games`);
  // Advance Championship Week from Home: watch the title game if reached, else set the playoff field.
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => S.phase) !== 'Conference Championships') break;
    await page.locator('[data-tid="nav-home"]').click();
    await page.waitForTimeout(70);
    await page.locator('[data-tid="adv-clock"]').click();
    await page.waitForTimeout(110);
    if (await page.evaluate(() => UI.view === 'game')) {        // the controlled team's title game opened
      await page.locator('[data-tid="game-skip"]').click(); await page.waitForTimeout(70);
      await page.locator('[data-tid="game-continue"]').click(); await page.waitForTimeout(110);
    }
  }
  const champ = await page.evaluate(() => {
    const champTeams = S.world.teams.filter(t => (t.confTitles || []).includes(S.year));
    const seeds = S.postseason ? S.postseason.playoff.seeds : [];
    const ranked = [...S.world.teams].sort((a, b) => rankScore(b) - rankScore(a)).map(t => t.id);
    const champSet = new Set(champTeams.map(t => t.id));
    const byes = seeds.slice(0, 4);
    return {
      phase: S.phase, champWeekCleared: S.champWeek === null,
      crowned: champTeams.length, byesAreChamps: byes.length === 4 && byes.every(id => champSet.has(id)),
      autobid: seeds.some(id => champSet.has(id) && ranked.indexOf(id) >= 12),   // a champ ranked outside top-12 still in
      seeds: seeds.length, bowls: S.postseason ? S.postseason.bowls.length : 0, postStarted: !!S.postseason
    };
  });
  check('Phase 15: Championship Week crowns conference champions (team.confTitles)', champ.crowned > 5 && champ.champWeekCleared, `${champ.crowned} champions`);
  check('Phase 15: the top-4 playoff byes are conference champions', champ.byesAreChamps);
  check('Phase 15: Championship Week resolves into the postseason (12 seeds + bowls)', champ.phase === 'Postseason' && champ.postStarted && champ.seeds === 12 && champ.bowls > 0, `seeds ${champ.seeds}, bowls ${champ.bowls}`);
  check('Recruiting cycle: verbal commitments accrue through the season', cycle.committed > 60, cycle.committed + ' verbal commits');
  check('Recruiting cycle: an aggressively recruited target commits to you', cycle.tgtMine);
  check('Recruiting cycle: the controlled team builds a class', cycle.mine > 0, cycle.mine + ' commits');
  check('Recruiting cycle: class rank is valid (1–134)', cycle.rank >= 1 && cycle.rank <= 134, '#' + cycle.rank);
  // ---------- PHASE 16: decommits (verbal flips) ----------
  const flip = await page.evaluate(() => {
    const A = '_fa', B = '_fb', teams = [{ id: A, prestige: 60 }, { id: B, prestige: 85 }];
    const mk = signed => { const p = []; for (let i = 0; i < 150; i++) p.push({ id: 'fx' + i, pos: 'WR', st: 'TX', stars: 4, iv: { [A]: 40, [B]: 96 }, committedTo: A, signed }); return p; };
    const verbal = mk(false); advanceRecruiting(verbal, teams, 5, 15, 7, false);
    const flipped = verbal.filter(r => r.committedTo === B);
    const lockSigned = mk(true); advanceRecruiting(lockSigned, teams, 5, 15, 7, false);
    const lockFinal = mk(false); advanceRecruiting(lockFinal, teams, 5, 15, 7, true);
    // the relaxed offer: you can open a board target who is verbally committed elsewhere
    const me = S.teamId, R = S.recruiting;
    const tgt = R.pool.find(r => r.committedTo && r.committedTo !== me && !r.signed && !R.board.includes(r.id));
    let offerOpens = null;
    if (tgt && R.board.length < (typeof boardSlots === 'function' ? boardSlots() : 99)) { offerRecruit(tgt); offerOpens = R.board.includes(tgt.id); }
    return {
      flips: flipped.length, tagged: flipped.every(r => r._flipped && r._flipped.from === A && r._flipped.to === B),
      signedLocked: lockSigned.every(r => r.committedTo === A && !r._flipped),
      finalLocked: lockFinal.every(r => r.committedTo === A && r.signed && !r._flipped),
      offerOpens
    };
  });
  check('Phase 16: a verbal commit can be flipped by a surging rival', flip.flips > 0 && flip.tagged, flip.flips + ' flipped');
  check('Phase 16: a SIGNED commit cannot be flipped', flip.signedLocked);
  check('Phase 16: a finalize (Signing Day) pass locks verbals (no flips)', flip.finalLocked);
  check('Phase 16: you can recruit a prospect verbally committed elsewhere (to flip him)', flip.offerOpens === null || flip.offerOpens === true);
  // ---------- PHASE 19a: media suite (AP poll + news feed + Media hub) ----------
  const media = await page.evaluate(() => {
    const M = S.media; if (!M) return { ok: false };
    UI.view = 'media'; UI.mediaTab = 'feed'; render();
    const feedCard = !!document.querySelector('[data-tid="story"]');
    UI.mediaTab = 'poll'; render();
    const pollRows = document.querySelectorAll('.lrow').length;
    UI.mediaTab = 'coverage'; render();
    const coverage = /RECAP|PREVIEW/.test(document.querySelector('.view').innerText);
    UI.view = 'home'; render();
    const homeCard = !!document.querySelector('[data-tid="media-card"]');
    return { ok: true, pollLen: M.poll.top.length, week: M.poll.week, feedLen: M.feed.length,
      moved: M.poll.top.some(e => e.prev && e.prev !== e.rank), tags: [...new Set(M.feed.map(s => s.tag))],
      feedCard, pollRows, coverage, homeCard, capped: M.feed.length <= 60 };
  });
  check('Phase 19a: the AP poll is a populated Top 25 that moved over the season', media.ok && media.pollLen === 25 && media.moved, `wk ${media.week}`);
  check('Phase 19a: the news feed populated with sane tags (capped)', media.feedLen > 0 && media.tags.length > 0 && media.capped, `${media.feedLen} stories: ${media.tags.join(',')}`);
  check('Phase 19a: the Media hub renders feed + poll + coverage', media.feedCard && media.pollRows >= 25 && media.coverage);
  check('Phase 19a: Home shows a headlines teaser', media.homeCard);
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
  check('Recruiting cycle: Class tab shows the class + grade', /class rank/i.test(classTxt) && /spots filled/i.test(classTxt));
  check('Phase 14: in-season class reads as VERBAL commits (signing is in the offseason)', /verbal/i.test(classTxt), 'has "verbal" copy');
  await shot(page, '25-recruiting-class.png');

  // ---------- PHASE 12: postseason (watch-then-commit playoff + bowls) ----------
  // From the Postseason phase, the Home advance button opens the controlled team's bowl/playoff game
  // in the viewer (skip → commit) or sims the round; loop until the bracket resolves to the Offseason.
  const psUI = await page.evaluate(() => {
    const card = (UI.view = 'home', render(), !!document.querySelector('[data-tid="postseason-card"]'));
    UI.view = 'season'; UI.seasonTab = 'bracket'; render();
    const txt = document.querySelector('.view').innerText;
    return { card, bracket: /First Round/i.test(txt) && /Bowls/i.test(txt) };
  });
  check('Phase 12: postseason Home card + bracket view render', psUI.card && psUI.bracket);
  let watchedPost = false;
  for (let i = 0; i < 24; i++) {
    if (await page.evaluate(() => S.phase) !== 'Postseason') break;
    await page.locator('[data-tid="nav-home"]').click();
    await page.waitForTimeout(70);
    await page.locator('[data-tid="adv-clock"]').click();
    await page.waitForTimeout(110);
    if (await page.evaluate(() => UI.view === 'game')) {        // the controlled team's game opened
      watchedPost = true;
      await page.locator('[data-tid="game-skip"]').click(); await page.waitForTimeout(70);
      await page.locator('[data-tid="game-continue"]').click(); await page.waitForTimeout(110);
    }
  }
  const post = await page.evaluate(() => {
    const aw = S.awards[S.awards.length - 1], champ = aw && aw.champion;
    const ct = champ ? S.world.teams.find(t => t.id === champ.teamId) : null;
    return { phase: S.phase, hasChamp: !!champ, champAbbr: champ ? champ.abbr : null,
      champTitled: !!(ct && ct.titles && ct.titles.length), psStillThere: !!S.postseason,
      boosted: S.world.teams.filter(t => t.postseasonBoost > 0).length,
      tenure: S.coach.tenure, histLen: S.coach.approvalHistory.length, approval: S.coach.approval };
  });
  check('Phase 12: postseason resolves to a champion + reaches the Offseason', post.phase === 'Offseason' && post.hasChamp, `champ ${post.champAbbr}, phase ${post.phase}`);
  check('Phase 19b: the season-end approval settle bumps tenure + logs the year', post.tenure === 1 && post.histLen === 1 && typeof post.approval === 'number', `tenure ${post.tenure}, hist ${post.histLen}, approval ${post.approval}`);
  check('Phase 12: champion records a permanent title (team.titles)', post.champTitled);
  check('Phase 12: postseason finishers carry a recruiting boost for next year', post.boosted > 10, post.boosted + ' teams boosted');
  void watchedPost;
  await shot(page, '25b-postseason-bracket.png');

  // ---------- PHASE 14: recruiting calendar — Early Signing Period + National Signing Day ----------
  // Entering the Offseason auto-fired the Early Signing Period (committed verbals signed). Verify the
  // staged class, the recruiting view's national-stage copy, then hold National Signing Day to close it.
  const esp = await page.evaluate(() => {
    const R = S.recruiting;
    UI.view = 'recruit'; UI.recruitTab = 'class'; render();
    const txt = document.querySelector('.view').innerText;
    return {
      stage: R.stage, earlySigned: R.earlySigned, signed: R.signed, points: R.points,
      committedSigned: R.pool.filter(r => r.committedTo && r.signed).length,
      committedUnsigned: R.pool.filter(r => r.committedTo && !r.signed).length,
      copy: /Early Signing Period|National Signing Day|signed/i.test(txt)
    };
  });
  check('Phase 14: Early Signing Period fires on entering the offseason (committed verbals sign)', esp.stage === 'national' && esp.earlySigned > 0 && esp.committedSigned > 0, `stage ${esp.stage}, early ${esp.earlySigned}`);
  check('Phase 14: the class is not yet closed (National Signing Day pending)', esp.signed === false);
  check('Phase 14: a final-push recruiting budget is granted for the window', esp.points > 0, esp.points + ' pts');
  check('Phase 14: recruiting view shows the signing-calendar copy', esp.copy);
  // hold National Signing Day from Home
  await page.locator('[data-tid="nav-home"]').click();
  await page.waitForTimeout(100);
  await page.locator('[data-tid="adv-clock"]').click();   // "Hold National Signing Day →"
  await page.waitForTimeout(140);
  const nsd = await page.evaluate(() => {
    const R = S.recruiting, haveSuitor = R.pool.filter(r => Object.keys(r.iv).length);
    return { stage: R.stage, signed: R.signed, phase: S.phase,
      unsigned: R.pool.filter(r => r.committedTo && !r.signed).length,
      totalSigned: R.pool.filter(r => r.signed).length, haveSuitor: haveSuitor.length,
      classSigned: R.pool.filter(r => r.committedTo === S.teamId).every(r => r.signed),
      myClass: R.pool.filter(r => r.committedTo === S.teamId).length };
  });
  check('Phase 14: National Signing Day closes the class (all commits signed)', nsd.stage === 'closed' && nsd.signed && nsd.unsigned === 0, `stage ${nsd.stage}, unsigned ${nsd.unsigned}`);
  check('Phase 14: the Early Signing Period inked the firm verbal commits', esp.earlySigned > 40, esp.earlySigned + ' signed early');
  check('Phase 14: National Signing Day resolves the contested remainder', nsd.totalSigned - esp.earlySigned > 0, `+${nsd.totalSigned - esp.earlySigned} on Signing Day`);
  check('Phase 14: the vast majority sign by the close of Signing Day (full national pool)', nsd.totalSigned / nsd.haveSuitor >= 0.80, `${nsd.totalSigned}/${nsd.haveSuitor}`);
  check('Phase 14: still in the Offseason — the transfer portal comes next', nsd.phase === 'Offseason');
  check('Phase 14: the controlled team’s class is fully signed', nsd.classSigned && nsd.myClass > 0, nsd.myClass + ' signed');
  await shot(page, '25c-signing-day.png');

  // ---------- PHASE 18: transfer portal (offseason, after National Signing Day) ----------
  const portal = await page.evaluate(() => {
    const P = S.portal; UI.view = 'portal'; render();
    return P ? { open: P.stage === 'open', dep: P.departures.length, pool: P.pool.length, points: P.points,
      card: !!document.querySelector('[data-tid="portal-list"]') } : { open: false };
  });
  check('Phase 18: the transfer portal opens after National Signing Day', portal.open && portal.pool > 0, `${portal.pool} transfers, ${portal.dep} out`);
  check('Phase 18: the portal board renders', portal.card);
  const pursue = await page.evaluate(() => {
    const P = S.portal, me = S.teamId, tr = P.pool.find(t => !t.committedTo);
    if (!tr) return { ok: false };
    const before = tr.iv[me] || 0, pts = P.points; pursueTransfer(tr);
    return { ok: true, rose: (tr.iv[me] || 0) > before, spent: P.points < pts };
  });
  check('Phase 18: pursuing a transfer raises your interest + spends points', !pursue.ok || (pursue.rose && pursue.spent));
  await page.locator('[data-tid="nav-home"]').click(); await page.waitForTimeout(100);
  await page.locator('[data-tid="adv-clock"]').click();   // "Close the transfer portal →"
  await page.waitForTimeout(160);
  const portClosed = await page.evaluate(() => {
    const P = S.portal, me = S.teamId, t = S.world.teams.find(x => x.id === me);
    return { stage: P.stage, phase: S.phase, arrivals: P.arrivals ? P.arrivals.length : 0,
      onRoster: t.roster.filter(p => p.fromTransfer).length,
      committedSomewhere: P.pool.filter(tr => tr.committedTo).length };
  });
  check('Phase 18: closing the portal resolves transfer commitments', portClosed.stage === 'closed' && portClosed.committedSomewhere > 0, `${portClosed.committedSomewhere} transfers signed`);
  check('Phase 18: your portal signings land on your roster', portClosed.arrivals === portClosed.onRoster, `${portClosed.arrivals} in`);
  check('Phase 18: still in the Offseason — rollover comes next', portClosed.phase === 'Offseason');

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
    const tw = aw && aw.trophies ? aw.trophies : {};
    const trophyWon = Object.keys(tw).filter(k => tw[k]).length;
    return { hasAwards: !!aw, heisman: aw && aw.heisman ? aw.heisman.name : null, allAm: aw ? aw.allAmerican.length : 0,
      allConf: aw && aw.allConference && aw.allConference[me.conf] ? aw.allConference[me.conf].length : 0,
      honored, myState: me.homeState, trophyWon, obrienQB: tw.obrien ? tw.obrien.pos : null,
      trophyHonored: S.world.teams.reduce((n, t) => n + t.roster.filter(p => p.honors && p.honors.some(h => /Outland|O'Brien|Doak|Biletnikoff|Mackey|Butkus|Thorpe|Groza|Ray Guy/.test(h.award))).length, 0),
      seriesOk: res.ok, seriesN: S.series.length, legYears: S.series.flatMap(s => s.legs.map(l => l.year)),
      twoForOneLegs: twoForOne ? twoForOne.legs.length : 0, offerN, accepted };
  });
  check('Phase 8: season awards computed at season end', p8.hasAwards && !!p8.heisman, 'Heisman: ' + p8.heisman);
  check('Phase 11: position trophies awarded (Outland, O’Brien, Butkus…)', p8.trophyWon >= 6, p8.trophyWon + ' trophies awarded');
  check('Phase 11: Davey O’Brien goes to a QB', p8.obrienQB === 'QB' || p8.obrienQB === null, 'pos ' + p8.obrienQB);
  check('Phase 11: trophy winners stamped with honors', p8.trophyHonored > 0, p8.trophyHonored + ' trophy honorees');
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
  check('Phase 11: Awards tab shows the Position Trophies section', /Position Trophies/i.test(awardsTxt) && await page.locator('[data-tid="trophies"]').count() > 0);
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
      portalCleared: S.portal === null,
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
      ringValid: S.world.teams.every(x => !x.legends || x.legends.length <= 12),
      draftYear: S.draft ? S.draft.year : null, draftPicks: S.draft ? S.draft.picks.length : 0,
      draftOrdered: S.draft ? S.draft.picks.every((p, i) => p.pick === i + 1) : false,
      factoryTeams: S.world.teams.filter(x => x.factory && Object.keys(x.factory).length).length
    };
  });
  check('Rollover: advances to the next calendar year', roPost.year === roPre.year + 1, `${roPre.year} → ${roPost.year}`);
  check('Rollover: lands in Preseason, week reset to 0', roPost.phase === 'Preseason' && roPost.week === 0);
  check('Rollover: season fields cleared (schedule + recruiting null, honors empty)', roPost.sched === null && roPost.recruiting === null && roPost.honors === 0);
  check('Phase 18: the transfer portal is cleared at rollover', roPost.portalCleared);
  check('Rollover: save version bumped to 28', roPost.version === 28, 'v' + roPost.version);
  check('Phase 8: player honors survive the rollover', roPost.honoredAfter > 0, roPost.honoredAfter + ' still honored');
  check('Phase 8: series + awards history persist across the rollover', roPost.seriesKept > 0 && roPost.awardsKept > 0, `series ${roPost.seriesKept}, awards ${roPost.awardsKept}`);
  check('Phase 11: career totals accrue across the rollover', roPost.careerPlayers > 50, roPost.careerPlayers + ' players carry a career');
  check('Phase 11: notable graduates enshrined into Rings of Honor (league-wide)', roPost.ringTotal > 0, roPost.ringTotal + ' legends league-wide');
  check('Phase 11: no Ring of Honor exceeds the 12-legend cap', roPost.ringValid);
  check('Phase 13: an NFL draft is held at the rollover', roPost.draftYear === roPre.year && roPost.draftPicks > 0 && roPost.draftOrdered, `${roPost.draftPicks} picks, ${roPost.draftYear}`);
  check('Phase 13: draft picks build factory reputations league-wide', roPost.factoryTeams > 0, roPost.factoryTeams + ' teams with a factory');
  check('Rollover: signed class enrolled as freshmen', roPost.myFresh === roPre.myClass && roPost.myFresh > 0, `${roPost.myFresh} enrolled (class ${roPre.myClass})`);
  check('Rollover: roster holds at ~84 league-wide', roPost.sizesOk && roPost.myRosterN >= 78 && roPost.myRosterN <= 96, 'mine ' + roPost.myRosterN);
  check('Rollover: last season stats wiped (no p.gs carryover)', roPost.statPlayers === 0, roPost.statPlayers + ' players still carry stats');
  check('Rollover: offseason recap recorded', roPost.report && roPost.report.year === roPost.year && roPost.report.graduated === roPre.mySeniors, `grads ${roPost.report && roPost.report.graduated} vs ${roPre.mySeniors}`);
  // recap card + year visible on Home; then kick the new season off
  const recapTxt = await page.evaluate(() => document.querySelector('.view').innerText);
  check('Rollover: Home shows the offseason recap card', /offseason recap/i.test(recapTxt) && /freshmen on roster/i.test(recapTxt));
  await shot(page, '26-offseason-rollover.png');

  // ---------- PHASE 13: NFL draft factory pull + rebel + UI ----------
  const draft = await page.evaluate(() => {
    const t = controlled();
    // measure the recruiting pull a WR factory exerts on a WR vs a rebel WR vs an off-position recruit
    const wr = { pos: 'WR', stars: 4, st: 'XX', prefs: [] };
    const rebelWR = { pos: 'WR', stars: 4, st: 'XX', prefs: [], rebel: true };
    const cb = { pos: 'CB', stars: 4, st: 'XX', prefs: [] };
    const probe = r => { const lo = Object.assign({}, t, { prestige: 55, homeState: '', factory: {} }); const hi = Object.assign({}, t, { prestige: 55, homeState: '', factory: { WR: 80 } }); return { lo: recruitFit(lo, r), hi: recruitFit(hi, r) }; };
    const pWR = probe(wr), pRebel = probe(rebelWR), pCB = probe(cb);
    return {
      factoryRaises: pWR.hi > pWR.lo, rebelLowers: pRebel.hi < pRebel.lo, offPosNeutral: Math.abs(pCB.hi - pCB.lo) < 1e-9,
      wrGap: +(pWR.hi - pWR.lo).toFixed(3), rebelGap: +(pRebel.hi - pRebel.lo).toFixed(3)
    };
  });
  check('Phase 13: a position factory raises recruitFit for matching recruits', draft.factoryRaises, 'WR pull ' + draft.wrGap);
  check('Phase 13: a rebel recruit is repelled by a factory (fit drops)', draft.rebelLowers, 'rebel gap ' + draft.rebelGap);
  check('Phase 13: factory pull is position-specific (CB unaffected by a WR-U)', draft.offPosNeutral);
  // draft board + pro-pipeline render
  const draftUI = await page.evaluate(() => {
    UI.view = 'season'; UI.seasonTab = 'draft'; render();
    const board = document.querySelector('.view').innerText, hasBoard = /NFL Draft/i.test(board) && /Round 1/i.test(board);
    UI.view = 'program'; render();
    return { hasBoard, pipeline: !!document.querySelector('[data-tid="pro-pipeline"]') };
  });
  check('Phase 13: Season Draft board renders the class by round', draftUI.hasBoard);
  check('Phase 13: Program page shows the Pro Pipeline (factory) section', draftUI.pipeline);
  await shot(page, '26b-nfl-draft.png');

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
    // Phase 17: the (large) recruit pool round-trips through the columnar codec exactly
    let poolOk = null, poolN = 0;
    if (S.recruiting && S.recruiting.pool) {
      const a = S.recruiting.pool, b = dec.recruiting && dec.recruiting.pool; poolN = a.length;
      poolOk = !!b && a.length === b.length && a.every((r, k) => { const { _flipped, ...rr } = r; return b[k] && eq(rr, b[k]); });
    }
    return { full, encLen, ok, np, topOk, poolOk, poolN, encMarker: !!enc._sv, decClean: dec._sv === undefined };
  });
  check('Phase 9: columnar codec round-trips every roster exactly', codec.ok && codec.np > 10000, codec.np + ' players checked');
  check('Phase 17: columnar codec round-trips the full recruit pool exactly', codec.poolOk !== false && codec.poolN > 3000, codec.poolN + ' recruits checked');
  check('Phase 9: codec preserves top-level state (seed/year/awards/…)', codec.topOk);
  check('Phase 9: encoded save is meaningfully smaller', codec.encLen < codec.full * 0.78, `${(codec.full / 1024 | 0)}KB → ${(codec.encLen / 1024 | 0)}KB`);
  check('Phase 9: encode tags the blob, decode strips the tag', codec.encMarker && codec.decClean);

  // ---------- PHASE 19c: firing → coaching search (take a job) or retire ----------
  // (Runs last — it switches teamId / retires, so it must follow every teamId-dependent check above.)
  const fireSearch = await page.evaluate(() => {
    S.coach.approvalHistory = [18, 18]; S.coach.tenure = 2; S.coach.pendingFire = true;
    triggerCoachingSearch();
    UI.view = 'home'; render();
    return { hasSearch: !!S.coachSearch, jobs: S.coachSearch ? S.coachSearch.openings.length : 0,
      screen: !!document.querySelector('[data-tid="retire"]'), kickoffBlocked: !document.querySelector('[data-tid="adv-clock"]') };
  });
  check('Phase 19c: firing opens a coaching search with job openings', fireSearch.hasSearch && fireSearch.jobs > 0 && fireSearch.screen && fireSearch.kickoffBlocked, fireSearch.jobs + ' openings');
  const took = await page.evaluate(() => {
    const before = S.teamId, careerBefore = S.coach.career.length, job = S.coachSearch.openings[0];
    takeJob(job);
    return { switched: S.teamId === job && S.teamId !== before, careerGrew: S.coach.career.length === careerBefore + 1,
      cleared: S.coachSearch === null, approvalReset: S.coach.approval === 52, tenureReset: S.coach.tenure === 0 };
  });
  check('Phase 19c: taking a job switches programs + extends the career résumé', took.switched && took.careerGrew && took.cleared && took.approvalReset && took.tenureReset);
  const retired = await page.evaluate(() => {
    S.coach.pendingFire = true; triggerCoachingSearch(); retireCoach();
    UI.view = 'home'; render();
    return { phase: S.phase, summary: /Career retrospective/i.test(document.querySelector('.view').innerText),
      menuBtn: !!document.querySelector('[data-tid="to-menu"]'), stops: S.coach.career.length };
  });
  check('Phase 19c: retiring shows the career retrospective with both stops', retired.phase === 'Retired' && retired.summary && retired.menuBtn && retired.stops >= 2, retired.stops + ' stops');

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

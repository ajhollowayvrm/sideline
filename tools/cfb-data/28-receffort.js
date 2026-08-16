'use strict';
/* What a season of recruiting is WORTH to the player — measured, not asserted.

   Why this exists rather than another reclab check: reclab drives `advanceRecruiting` and nothing
   else, and it says so itself — "the Phase 44 cliff is NOT an engine property, it is created in the
   app layer, and reclab structurally cannot see it while advanceRecruiting is all it drives." Its
   worked-vs-unworked scenario toggles the AI BRAIN over a team, not the player's own board, points,
   intents, decay and Signing Day. Those are all app-layer, so the only honest instrument is the real
   page.

   Phase 60 measured the RATIO of worked to ignored (+18% / +128% / +295% by band). Nobody measured
   the ignored FLOOR in absolute terms, and that is the number a player actually feels: a coach who
   did nothing all season still wants to know whether he got a class.

   Two arms over the same seed and the same team:
     ignored — never open the recruiting screen
     worked  — a competent coach: keep the board full of winnable targets, drop the dead ones,
               spend every point, and use the official visits

   Run:  node tools/cfb-data/28-receffort.js [--seeds 3] [--quiet]
   Report → tools/cfb-data/receffort-report.txt   (a tool, not a gate) */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'receffort-report.txt');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SEEDS = [4242, 8123, 20260814, 77003, 4411].slice(0, +opt('seeds', 3));
const BANDS = [['top', 82, 99], ['mid', 48, 60], ['bottom', 30, 42]];

function startServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => {
      if (e) { res.writeHead(404); res.end('no'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(p)] || 'text/plain' }); res.end(d);
    });
  });
  return new Promise(r => server.listen(0, () => r({ server, port: server.address().port })));
}

/* One career, one arm, run inside the page. Returns the class it signed. */
const RUN = `
async (cfg) => {
  /* Saves are irrelevant here and a 3.5MB write per action would blow the origin quota in a few
     runs. Neutralise persistence rather than fighting it. */
  window.writeSlot = () => {}; window.autosave = () => {}; window.setActiveSlot = () => {};
  window.toast = () => {};

  const ng = freshNewGame();
  ng.seed = cfg.seed; ng.coach.first = 'Probe'; ng.coach.last = 'Coach';
  ng.world = genWorld(cfg.seed);
  const inBand = ng.world.teams.filter(t => t.prestige >= cfg.lo && t.prestige <= cfg.hi);
  const team = inBand.sort((a, b) => a.id < b.id ? -1 : 1)[Math.floor(inBand.length / 2)];
  if (!team) return { skipped: 'no team in band' };
  ng.teamId = team.id;
  finishNewGame(ng); closeSheet();
  const me = S.teamId, t0 = controlled();
  startSeason();

  const R = () => S.recruiting;
  const mine = rec => rec.iv[me] || 0;
  const cut = rec => !!(rec.finalists && rec.committedTo !== me && rec.finalists.indexOf(me) < 0);
  const dead = rec => rec.signed || (rec.committedTo && rec.committedTo !== me) || cut(rec);

  while (S.phase === 'Regular Season') {
    if (cfg.arm === 'worked') {
      const r = R();
      /* 1) prune, but ONLY the truly finished. dropRecruit does delete rec.iv[S.teamId] — it
            erases the relationship, not just the board slot — so triaging a verbal-elsewhere throws
            away interest that would still have converted at Signing Day. Drop the signed only. */
      r.board.slice().forEach(id => { const x = recById(id); if (x && (x.signed || cut(x))) dropRecruit(x); });
      /* 2) refill where the push is PIVOTAL — near the lead but not holding it. This is Phase 59's
            own finding applied to the player: aiPriority used to rank highest the recruits it had
            ALREADY won, and spending the budget there moved a class by 0.1%. */
      const lead = x => { let b = 0; for (const k in x.iv) if (k !== me && x.iv[k] > b) b = x.iv[k]; return b; };
      const pivotal = x => -Math.abs(lead(x) - mine(x));           // 0 = dead heat, the best place to spend
      const open = r.pool.filter(x => !dead(x) && !onBoard(x) && mine(x) > 0)
        .sort((a, b) => (pivotal(b) - pivotal(a)) || (b.stars - a.stars));
      for (const x of open) { if (r.board.length >= boardSlots()) break; offerRecruit(x); }
      // 3) official visits — the strongest single action, and season-budgeted
      const wks = (typeof homeWeekends === 'function' ? homeWeekends() : []).filter(w => w.week > S.week);
      for (const id of r.board) {
        const x = recById(id); if (!x || !canBookVisit(x)) continue;
        const w = wks.find(w => weekendInfo(w.week) && weekendInfo(w.week).slotsLeft > 0);
        if (!w) break;
        bookVisit(x, w.week);
      }
      // 4) spend every point where the race is closest, on his own top priority
      const byPull = r.board.map(recById).filter(Boolean).filter(x => !dead(x))
        .sort((a, b) => pivotal(b) - pivotal(a));
      for (const x of byPull) {
        if (r.points <= 0) break;
        if (!setRecIntent(x, 'pitch', { angle: x.prefs[0] })) setRecIntent(x, 'scout', {});
      }
    }
    advanceWeek();
  }

  /* Straight to the signing calendar. The postseason feeds NEXT year's cycle (postseasonBoost), not
     this class, so simulating it would cost minutes and change nothing being measured. */
  if (R() && R().stage === 'open') earlySigningPeriod();
  if (cfg.arm === 'worked' && R()) {                     // the final push the window exists for
    const r = R();
    const lead2 = x => { let b = 0; for (const k in x.iv) if (k !== me && x.iv[k] > b) b = x.iv[k]; return b; };
    const live = r.board.map(recById).filter(Boolean).filter(x => !dead(x))
      .sort((a, b) => Math.abs(lead2(a) - mine(a)) - Math.abs(lead2(b) - mine(b)));
    for (const x of live) { if (r.points <= 0) break; if (!setRecIntent(x, 'pitch', { angle: x.prefs[0] })) break; }
  }
  nationalSigningDay();

  const cls = myClass(), t = controlled();
  const ovs = cls.map(p => p.ov).sort((a, b) => b - a);
  /* WHERE the class came from. Signing Day signs a leader at interest >= 30 with any margin, while
     the in-season bar is COMMIT_THRESH 68 / LEAD_GAP 7. So the question that sets the lever is: how
     much of the class arrives BELOW the bar the rest of the season is played to? */
  const ivs = cls.map(p => Math.round(p.iv ? p.iv[me] || 0 : 0)).sort((a, b) => a - b);
  const q = f => ivs.length ? ivs[Math.min(ivs.length - 1, Math.floor(f * ivs.length))] : 0;
  const touched = cls.filter(p => (p.hits && Object.keys(p.hits).length) || p.visited || p.promise).length;
  return {
    team: t.abbr, prestige: t0.prestige,
    signed: cls.length,
    ivMed: q(0.5), ivP10: q(0.1), ivP90: q(0.9), ivs: ivs,
    belowThresh: cls.filter(p => (p.iv ? p.iv[me] || 0 : 0) < 68).length,   // would not have signed in-season
    touched,                                                               // you actually did something to him
    rank: myClassRank(),
    grade: classGrade(myClassRank()),
    blue: cls.filter(p => p.stars >= 4).length,
    score: Math.round(classScore(t, R().pool)),
    topOv: ovs[0] || 0,
    avgOv: cls.length ? +(ovs.reduce((a, b) => a + b, 0) / cls.length).toFixed(1) : 0,
    wins: t.rec.w + '-' + t.rec.l,
  };
}`;

(async () => {
  const { server, port } = await startServer();
  const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
  const rows = [];
  const quiet = argv.includes('--quiet');

  for (const [band, lo, hi] of BANDS) {
    for (const seed of SEEDS) {
      for (const arm of ['ignored', 'worked']) {
        // A fresh context per run: no localStorage carried between careers.
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(e.message));
        await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof genWorld === 'function');
        const t0 = Date.now();
        let r;
        // A STRING handed to page.evaluate is an expression, not a callable — pass the argument by
        // building the call, or Playwright silently drops it and hands back undefined.
        try { r = await page.evaluate(`(${RUN})(${JSON.stringify({ seed, lo, hi, arm })})`); }
        catch (e) { r = { ERROR: e.message.split('\n')[0] }; }
        if (!r) r = { ERROR: 'evaluate returned nothing' };
        await ctx.close();
        const row = { band, seed, arm, secs: ((Date.now() - t0) / 1000).toFixed(0), ...r, errs: errs.slice(0, 1) };
        rows.push(row);
        if (!quiet) console.log(`  ${band.padEnd(6)} ${String(seed).padEnd(9)} ${arm.padEnd(7)} ` +
          (r.ERROR ? 'ERROR ' + r.ERROR : `${r.team} p${r.prestige} · ${r.wins} · signed ${String(r.signed).padStart(2)} · #${String(r.rank).padStart(3)} ${r.grade} · blue ${String(r.blue).padStart(2)} · score ${r.score} · avgOv ${r.avgOv}`) +
          `  (${row.secs}s)`);
      }
    }
  }
  await browser.close(); server.close();

  /* ---------- the report ---------- */
  const L = [];
  const say = s => { L.push(s); if (!quiet) console.log(s); };
  const ok = rows.filter(r => !r.ERROR);
  const agg = (band, arm) => {
    const s = ok.filter(r => r.band === band && r.arm === arm);
    if (!s.length) return null;
    const m = k => +(s.reduce((a, b) => a + (b[k] || 0), 0) / s.length).toFixed(1);
    return { n: s.length, signed: m('signed'), rank: m('rank'), blue: m('blue'), score: m('score'),
             avgOv: m('avgOv'), ivMed: m('ivMed'), below: m('belowThresh'), touched: m('touched') };
  };
  say('');
  say('=== WHAT A SEASON OF RECRUITING IS WORTH (' + SEEDS.length + ' seeds/band) ===');
  say('');
  say('band    arm      signed   rank   blue   score   avgOv   ivMed   <68   touched');
  for (const [band] of BANDS) {
    for (const arm of ['ignored', 'worked']) {
      const a = agg(band, arm); if (!a) continue;
      say(`${band.padEnd(7)} ${arm.padEnd(8)} ${String(a.signed).padStart(5)} ${String(a.rank).padStart(6)} ` +
          `${String(a.blue).padStart(6)} ${String(a.score).padStart(7)} ${String(a.avgOv).padStart(7)} ` +
          `${String(a.ivMed).padStart(7)} ${String(a.below).padStart(5)} ${String(a.touched).padStart(9)}`);
    }
    const i = agg(band, 'ignored'), w = agg(band, 'worked');
    if (i && w) say(`${''.padEnd(7)} ${'Δ'.padEnd(8)} ${String((w.signed - i.signed).toFixed(1)).padStart(5)} ` +
      `${String((w.rank - i.rank).toFixed(1)).padStart(6)} ${String((w.blue - i.blue).toFixed(1)).padStart(6)} ` +
      `${String((w.score - i.score).toFixed(1)).padStart(7)} ` +
      `  (score ${i.score ? ((w.score - i.score) / i.score * 100).toFixed(0) : '—'}%)`);
    say('');
  }
  /* What a higher Signing Day bar would leave standing. The pass signs a leader at interest >= 30;
     this counts, per arm, how much of the class each candidate bar would still admit. First-order
     (it ignores slots freed for someone else), but the player's bucket only ever shrinks, so it is
     the right shape for choosing the number. */
  const BARS = [30, 40, 45, 50, 55, 60, 68];
  say('SURVIVAL — class size if the Signing Day bar were raised (measured interest, per arm)');
  say('band    arm       ' + BARS.map(b => ('>=' + b).padStart(6)).join(''));
  for (const [band] of BANDS) {
    for (const arm of ['ignored', 'worked']) {
      const s = ok.filter(r => r.band === band && r.arm === arm);
      if (!s.length) continue;
      const cells = BARS.map(b => {
        const avg = s.reduce((a, r) => a + (r.ivs || []).filter(v => v >= b).length, 0) / s.length;
        return avg.toFixed(1).padStart(6);
      }).join('');
      say(`${band.padEnd(7)} ${arm.padEnd(9)}${cells}`);
    }
  }
  say('');
  say('THE FLOOR is the `ignored` row: what a coach who never opened the screen still signs.');
  say('THE LEVER is the gap. If the floor is already a good class, the gap cannot matter much.');
  const errRows = rows.filter(r => r.ERROR || (r.errs && r.errs.length));
  if (errRows.length) { say(''); say('errors: ' + errRows.length); errRows.slice(0, 3).forEach(r => say('  ' + JSON.stringify(r).slice(0, 160))); }
  // The per-signee interest arrays are working data for the survival curve above, not a record —
  // keeping them turned an 85-line report into 1,370. Persist the runs without them.
  const slim = rows.map(({ ivs, ...r }) => r);
  fs.writeFileSync(OUT, L.join('\n') + '\n' + slim.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log('\nreport → ' + path.relative(ROOT, OUT));
})().catch(e => { console.error(e); process.exit(1); });

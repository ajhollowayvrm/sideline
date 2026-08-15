'use strict';
/* The fast loop — the game in real WebKit at iPhone metrics, about 2 seconds a screen.
   NOT a gate. Nothing here fails a build; it prints what it measured and writes pictures.

   Why WebKit and not the Chromium the qa gate uses: the shell is a WKWebView, and Playwright's
   webkit is the same engine family. Layout, safe-area support, font metrics, scroll containers and
   tap behaviour all read true here, so most "does this feel like an app" work can be finished
   without booting a simulator at all. What it CANNOT tell you: real safe-area insets (there is no
   notch, so env(safe-area-inset-*) resolves to 0), momentum scrolling, rubber-band, and the zoom
   lock. Those live in tools/ios/shell.js, against the real device.

   Run:  npm run ios:web                 — every screen
         npm run ios:web -- --scene home — one screen
         npm run ios:web -- --width 430  — a bigger phone

   Screenshots → test/shots/iphone/web/. One-time prereq: npx playwright install webkit */

const { webkit } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const SC = require('./scenarios');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'test', 'shots', 'iphone', 'web');

/* iPhone 15/16/17 Pro logical size, FULL SCREEN — not Playwright's iPhone descriptor, which
   subtracts Safari's chrome. The shell has no chrome, so the taller box is the honest one. */
const DEVICE = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
           + '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

/* Same self-contained static server the qa gate uses, so no separate process is needed. */
function startServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
                  '.css': 'text/css', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (e, data) => {
      if (e) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(p)] || 'text/plain' });
      res.end(data);
    });
  });
  return new Promise(r => server.listen(0, () => r({ server, port: server.address().port })));
}

const run = (page, body) => page.evaluate(`(async () => {${body}\n})()`);

/* The audit lives in scenarios.js, shared with the shell driver, so both engines answer the same
   question the same way. */
const audit = page => run(page, SC.audit());

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const only = arg('scene', null);
  const width = parseInt(arg('width', DEVICE.viewport.width), 10);
  const { server, port } = await startServer();
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...DEVICE, viewport: { ...DEVICE.viewport, width } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://localhost:${port}/index.html?seed=${SC.SEED}&reset=1`);
  await page.waitForSelector('#app');

  const shots = [];
  const shoot = async scene => {
    const a = await audit(page);
    const file = path.join(OUT, scene.name + '.png');
    await page.screenshot({ path: file });
    shots.push(file);
    console.log(`  ${scene.name.padEnd(11)} overflow ${String(a.overflow).padStart(4)}px`
      + `   under-44pt ${String(a.targets).padStart(3)}/${String(a.checked).padEnd(3)}`
      + `   press ${String(a.pressable).padStart(3)}/${String(a.pressTotal).padEnd(3)}`
      + (a.statusBar ? `   STATUS-BAR ${a.statusBar}` : '')
      + (a.envLeak ? `   ENV-LEAK ${a.envLeak}` : '')
      + (a.worst.length ? '   ' + a.worst.join(', ') : '')
      + (a.statusBarWorst.length ? '   under bar: ' + a.statusBarWorst.join(', ') : ''));
  };

  const wanted = s => !only || s.name === only;

  console.log(`\nWebKit @ ${width}x${DEVICE.viewport.height} @${DEVICE.deviceScaleFactor}x\n`);
  await run(page, SC.reset());
  for (const scene of SC.PRE_SCENES.filter(wanted)) {
    await run(page, SC.goto(scene));
    await shoot(scene);
  }

  if (SC.CAREER_SCENES.some(wanted)) {
    const st = await run(page, SC.setup());
    console.log(`  career: ${st.team} ${st.year}, ${st.phase} week ${st.week}\n`);
    for (const scene of SC.CAREER_SCENES.filter(wanted)) {
      await run(page, SC.goto(scene));
      await shoot(scene);
    }
  }

  await browser.close();
  server.close();
  console.log(`\n${shots.length} shots → ${path.relative(ROOT, OUT)}`);
  if (errors.length) console.log(`\nJS errors (${errors.length}):\n  ` + errors.slice(0, 5).join('\n  '));
})().catch(e => { console.error(e); process.exit(1); });

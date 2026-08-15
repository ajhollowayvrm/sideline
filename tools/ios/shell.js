'use strict';
/* The real loop — the native shell, on a booted simulator, driven from here.
   NOT a gate. It needs Xcode, so it can never run in the browser-only pipeline.

   This is the only loop that tests what Phase 61 actually claims: the custom-scheme origin, the
   zoom lock, no rubber-band, the safe-area insets a real device reports, and the two bridges. The
   fast loop in tools/ios/web.js gets you most of the way; this one is the truth.

   How it drives the app: `simctl` can screenshot a simulator but it cannot tap one, so a DEBUG-only
   listener in ios/Sources/Shell.swift runs JavaScript inside the live web view. A simulator process
   shares the host loopback, so a POST from here reaches the app. `#if DEBUG` keeps every byte of it
   out of the Release build CI archives.

     npm run ios:sim                      — build, install, launch, screenshot every screen
     npm run ios:sim -- build             — build, install and launch only
     npm run ios:sim -- shot <name>       — screenshot whatever is on screen now
     npm run ios:sim -- eval '<js>'       — run JavaScript in the app, print what it returns
     npm run ios:sim -- ping              — is the bridge up

     --device "iPhone 17 Pro"   pick a simulator      --keep   skip the build, drive what is running

   Screenshots → test/shots/iphone/sim/ */

const { execFileSync, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const SC = require('./scenarios');

const ROOT = path.join(__dirname, '..', '..');
const IOS = path.join(ROOT, 'ios');
const BUILD = path.join(IOS, 'build', 'sim');
const OUT = path.join(ROOT, 'test', 'shots', 'iphone', 'sim');
const BRIDGE_PORT = 8787;          // must match DevBridge.port in Shell.swift

const argv = process.argv.slice(2);
const cmd = argv.find(a => !a.startsWith('--')) || 'sweep';
const flag = name => argv.includes('--' + name);
const opt = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const sh = (c, o = {}) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...o });
const simctl = (...a) => execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8' }).trim();
const step = m => console.log('  ' + m);

/* ---------- the simulator ---------- */

/* Newest runtime first, so a machine holding several picks the one closest to the SDK. */
function pickDevice(name) {
  const all = JSON.parse(simctl('list', 'devices', 'available', '-j')).devices;
  const runtimes = Object.keys(all).filter(r => r.includes('SimRuntime.iOS')).sort().reverse();
  for (const r of runtimes) {
    const hit = all[r].find(d => d.name === name);
    if (hit) return { udid: hit.udid, name: hit.name, runtime: r.split('SimRuntime.')[1], state: hit.state };
  }
  throw new Error(`no available simulator named "${name}" — run: xcrun simctl list devices`);
}

function boot(dev) {
  if (dev.state !== 'Booted') {
    step(`booting ${dev.name} (${dev.runtime})`);
    try { simctl('boot', dev.udid); } catch (e) { /* already booting */ }
  }
  execFileSync('xcrun', ['simctl', 'bootstatus', dev.udid, '-b'], { stdio: 'ignore' });
}

/* ---------- build ---------- */

/* A plain target build, deliberately, rather than `-scheme` with a `-destination`. Destination
   resolution refuses to list a simulator whose runtime is older than the SDK Xcode ships, which is
   a state a machine falls into every time Xcode updates ahead of the runtimes. The target build
   does not consult it, so the loop keeps working through that gap. */
function build() {
  step('xcodegen generate');
  execFileSync('xcodegen', ['generate'], { cwd: IOS, stdio: 'inherit' });

  step('xcodebuild (Debug, simulator) — DevBridge compiles in Debug only');
  try {
    execFileSync('xcodebuild', [
      '-project', path.join(IOS, 'Sideline.xcodeproj'), '-target', 'Sideline',
      '-sdk', 'iphonesimulator', '-configuration', 'Debug', '-arch', 'arm64',
      `CONFIGURATION_BUILD_DIR=${BUILD}`, 'CODE_SIGNING_ALLOWED=NO', 'build',
    ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    const runtimeGap = /No simulator runtime version from/.test(out);
    console.error('\n' + out.split('\n').filter(l => /error:/.test(l)).slice(0, 6).join('\n'));
    if (runtimeGap) {
      console.error('\nThe installed simulator runtimes are older than the SDK in this Xcode.'
        + '\nFix it once with:  xcodebuild -downloadPlatform iOS');
    }
    process.exit(1);
  }
  return path.join(BUILD, 'Sideline.app');
}

function install(dev, app) {
  const id = sh(`plutil -extract CFBundleIdentifier raw "${path.join(app, 'Info.plist')}"`).trim();
  step(`install ${id}`);
  simctl('install', dev.udid, app);
  try { simctl('terminate', dev.udid, id); } catch (e) { /* was not running */ }
  simctl('launch', dev.udid, id);
  return id;
}

/* ---------- the bridge ---------- */

function post(pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: BRIDGE_PORT, path: pathname, method: 'POST', timeout: 60000,
        headers: { 'content-length': Buffer.byteLength(body || '') } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('bridge timeout')));
    req.end(body || '');
  });
}

async function ping(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = JSON.parse(await post('/ping', ''));
      if (r.ok) return true;
    } catch (e) { await new Promise(r => setTimeout(r, 500)); }
  }
  return false;
}

async function evaluate(js) {
  const r = JSON.parse(await post('/eval', js));
  if (!r.ok) throw new Error('in the app: ' + r.error);
  return r.value;
}

/* The bridge starts in viewDidLoad, so it answers a ping BEFORE the web view has finished loading
   the page. Probe too early and you get the empty document WKWebView holds until the navigation
   commits: no #app, no globals, and `location.origin` reading "null" — three findings that all look
   like shell bugs and are none of them real. Wait for the game itself. */
async function ready(tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (await evaluate('return typeof S !== "undefined" && !!document.querySelector("#app")')) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('the page never finished loading — check the scheme handler in Shell.swift');
}

function shot(dev, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name + '.png');
  execFileSync('xcrun', ['simctl', 'io', dev.udid, 'screenshot', '--type=png', file], { stdio: 'ignore' });
  return file;
}

/* ---------- commands ---------- */

(async () => {
  const dev = pickDevice(opt('device', 'iPhone 17 Pro'));

  if (cmd === 'ping') {
    console.log(await ping(2) ? 'bridge up' : 'bridge down — is a Debug build running?');
    return;
  }

  if (cmd === 'eval') {
    const js = argv.filter(a => !a.startsWith('--') && a !== 'eval').join(' ');
    if (!await ping(2)) throw new Error('bridge down — run `npm run ios:sim -- build` first');
    console.log(JSON.stringify(await evaluate(js), null, 2));
    return;
  }

  if (cmd === 'shot') {
    const name = argv.filter(a => !a.startsWith('--') && a !== 'shot')[0] || 'shot';
    console.log(path.relative(ROOT, shot(dev, name)));
    return;
  }

  boot(dev);
  if (!flag('keep')) install(dev, build());

  if (!await ping()) throw new Error(
    'the app launched but the bridge never answered.\n'
    + '  Check it is a DEBUG build, and that nothing else holds port ' + BRIDGE_PORT + '.');
  step('bridge up');
  await ready();
  step('page loaded');

  if (cmd === 'build') return;

  /* The shell reports what only a device can: the real origin, the real insets, the zoom lock. */
  /* The real insets, measured rather than assumed: a fixed probe sized by env(safe-area-inset-*)
     is the only honest way to read them, and they are 0 in every browser-based loop. */
  const shell = await evaluate(`
    // Two frames first: read the insets too early after a load and env(safe-area-inset-*) still
    // resolves to 0, which reads as "the shell is not edge to edge" and is only a stale layout.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;width:10px';
    document.body.appendChild(probe);
    // Measure each inset as a HEIGHT. A border-width set from env() reads back as 0.
    const inset = side => {
      probe.style.height = 'env(safe-area-inset-' + side + ')';
      return Math.round(probe.getBoundingClientRect().height);
    };
    const safeTop = inset('top'), safeBottom = inset('bottom');
    probe.remove();
    return {
      native: window.__SIDELINE_NATIVE__ === true,
      origin: location.origin,
      secure: window.isSecureContext,
      screen: window.innerWidth + 'x' + window.innerHeight + ' @' + devicePixelRatio + 'x',
      safeTop: safeTop,
      safeBottom: safeBottom,
      zoom: visualViewport ? visualViewport.scale : null,
    };`);
  console.log('\n  origin %s   secure context %s   native bridge %s',
    shell.origin, shell.secure, shell.native);
  console.log('  screen %s   safe area top %spt bottom %spt   zoom %s\n',
    shell.screen, shell.safeTop, shell.safeBottom, shell.zoom);

  const shots = [];
  const take = async scene => {
    await evaluate(SC.goto(scene));
    const a = await evaluate(SC.audit());        // the same audit the WebKit loop runs
    shots.push(shot(dev, scene.name));
    console.log(`  ${scene.name.padEnd(11)} overflow ${String(a.overflow).padStart(4)}px`
      + `   under-44pt ${String(a.targets).padStart(3)}/${String(a.checked).padEnd(3)}`
      + `   press ${String(a.pressable).padStart(3)}/${String(a.pressTotal).padEnd(3)}`
      + (a.statusBar ? `   STATUS-BAR ${a.statusBar}` : '')
      + (a.envLeak ? `   ENV-LEAK ${a.envLeak}` : '')
      + (a.worst.length ? '   ' + a.worst.join(', ') : '')
      + (a.statusBarWorst.length ? '   under bar: ' + a.statusBarWorst.join(', ') : ''));
  };

  await evaluate(SC.reset());
  for (const scene of SC.PRE_SCENES) await take(scene);
  const st = await evaluate(SC.setup());
  console.log(`  career: ${st.team} ${st.year}, ${st.phase} week ${st.week}\n`);
  for (const scene of SC.CAREER_SCENES) await take(scene);

  console.log(`\n${shots.length} shots → ${path.relative(ROOT, OUT)}`);
})().catch(e => { console.error('\n' + e.message); process.exit(1); });

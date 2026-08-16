'use strict';
/* Put the game on the phone. This is how SIDELINE ships — there is no web build to visit, no PWA,
   no CI and no store, so this script is the whole distribution channel.

   Build a signed Release, install it on the paired iPhone, launch it:

     npm run ios:deploy                 build, install, launch
     npm run ios:deploy -- --no-launch  build and install only (leave the phone alone)
     npm run ios:deploy -- --device <UDID>

   RELEASE is deliberate. `DevBridge` in ios/Sources/Shell.swift is fenced `#if DEBUG`, so the build
   that lands on the phone carries no automation listener — which also means nothing can drive it.
   The scripted loops (`npm run ios:sim`) talk to a Debug build on a SIMULATOR. On the device you
   look with your own eyes, or attach Safari's Web Inspector.

   TEAM and UDID come from `ios/device.env`, which is gitignored. Copy `ios/device.env.example`. */

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const IOS = path.join(ROOT, 'ios');
const BUILD = path.join(IOS, 'build', 'dev');
const APP = path.join(BUILD, 'Build', 'Products', 'Release-iphoneos', 'Sideline.app');
const BUNDLE = 'com.ajholloway.sideline';

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const step = m => console.log('  ' + m);

function env() {
  const f = path.join(IOS, 'device.env');
  if (!fs.existsSync(f)) {
    console.error('\nMissing ios/device.env — the team ID and the device UDID live there.\n'
      + '\n  cp ios/device.env.example ios/device.env\n'
      + '\nThen fill both in. Find the UDID with:  xcrun devicectl list devices\n');
    process.exit(1);
  }
  const out = {};
  fs.readFileSync(f, 'utf8').split('\n').forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !l.trim().startsWith('#')) out[m[1]] = m[2];
  });
  for (const k of ['TEAM', 'UDID']) {
    if (!out[k] || /^X+$|^0+-/.test(out[k])) {
      console.error(`\nios/device.env has no real ${k}. Fill it in.\n`); process.exit(1);
    }
  }
  return out;
}

const { TEAM, UDID } = env();
const device = opt('device', UDID);

/* ---------- 1. the project is generated, never committed ---------- */
step('xcodegen generate');
try { execFileSync('xcodegen', ['generate'], { cwd: IOS, stdio: ['ignore', 'ignore', 'inherit'] }); }
catch (e) { console.error('\nxcodegen failed. Install it once:  brew install xcodegen\n'); process.exit(1); }

/* ---------- 2. build a signed Release ---------- */
step('xcodebuild (Release, device) — no DevBridge in this configuration');
try {
  execFileSync('xcodebuild', [
    '-project', path.join(IOS, 'Sideline.xcodeproj'), '-scheme', 'Sideline',
    '-configuration', 'Release', '-destination', 'generic/platform=iOS',
    '-derivedDataPath', BUILD, '-allowProvisioningUpdates',
    'DEVELOPMENT_TEAM=' + TEAM, 'CODE_SIGN_STYLE=Automatic', 'build',
  ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
} catch (e) {
  const out = (e.stdout || '') + (e.stderr || '');
  console.error('\n' + (out.split('\n').filter(l => /error:/.test(l)).slice(0, 8).join('\n') || out.slice(-1500)));
  if (/requires a development team|no profiles/i.test(out)) {
    console.error('\nSigning could not resolve. Check TEAM in ios/device.env, and that this Apple ID'
      + '\nis signed into Xcode → Settings → Accounts.\n');
  }
  process.exit(1);
}
if (!fs.existsSync(APP)) { console.error('\nBuild reported success but ' + APP + ' is missing.\n'); process.exit(1); }

/* ---------- 3. install ---------- */
step('install onto ' + device);
try {
  execFileSync('xcrun', ['devicectl', 'device', 'install', 'app', '--device', device, APP],
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
} catch (e) {
  const out = (e.stdout || '') + (e.stderr || '');
  console.error('\n' + out.slice(-1200));
  if (/not found|no device/i.test(out)) console.error('\nIs the phone paired and awake? `xcrun devicectl list devices`\n');
  process.exit(1);
}
step('installed');

/* ---------- 4. launch ---------- */
if (flag('no-launch')) { console.log('\ninstalled — skipping launch (--no-launch)\n'); process.exit(0); }
try {
  execFileSync('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', device, BUNDLE],
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  console.log('\nlaunched on the phone\n');
} catch (e) {
  const out = (e.stdout || '') + (e.stderr || '');
  /* The one failure that is not a problem: installing works on a locked phone, launching does not. */
  if (/Locked|not, or could not be, unlocked|error 7/i.test(out)) {
    console.log('\nInstalled. The phone is LOCKED, so it could not be launched —'
      + '\nunlock it and tap the icon, or run this again.\n');
    process.exit(0);
  }
  console.error('\n' + out.slice(-1200)); process.exit(1);
}

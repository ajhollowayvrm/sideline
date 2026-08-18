# SIDELINE — College Football Coach Sim

A mobile-first head-coach career sim. One self-contained `index.html` — pure static HTML/CSS/JS,
every save in an in-browser database (IndexedDB). No backend, no accounts.

It ships as a **native iOS app**: a thin WKWebView shell around that same file. There is no web
build to visit, no progressive web app to add to a home screen, and no CI — you build on a Mac and
install straight onto a paired iPhone.

## Play

```sh
npm run ios:deploy
```

Builds a signed Release, installs it on the phone, launches it. Set up `ios/device.env` once (copy
`ios/device.env.example` and fill in your Apple team ID and the device UDID from
`xcrun devicectl list devices`). Unlock the phone before the launch step — installing works while
it is locked, launching does not.

Full detail, including what the shell buys and why it exists: [`ios/README.md`](ios/README.md).

## Develop

The game is one file. Open `index.html` in a browser, or run a static server
(`python3 -m http.server`) and hit it from another device on the same network.

The browser is a **development target, not a shipping one** — but it must keep working, because the
test gate drives the real game in headless Chromium and the shell is deliberately never a dependency
of the page. Everything native is feature-detected, so the same bytes run from `file://`, from a
static server, and from the app's `sideline://` scheme.

See [`CLAUDE.md`](CLAUDE.md) for the full project brief, architecture, and roadmap.

## Test

Twenty-three gates. The big one drives the real game on a mobile viewport and asserts behaviour
across every screen (wizard, roster, coaches, league, season schedule/standings, week sim,
save/load, migration, safe areas, touch targets, colour):

```sh
npm install
npx playwright install chromium   # one-time
npm run qa
```

It starts its own static server, exits non-zero on any failure, and writes screenshots to
`test/shots/`. Each pure engine also has an offline node lab (`npm run simlab`, `reclab`, …) that
extracts the fenced block from `index.html` and validates it across many cycles.

Two non-gate loops render every screen at iPhone metrics — `npm run ios:web` (WebKit, ~30 s, no
Xcode) and `npm run ios:sim` (the real shell on a booted simulator). See the test hooks (`?seed=N`,
`data-id`, `data-tid`) documented in `CLAUDE.md`.

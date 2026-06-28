# SIDELINE — College Football Coach Sim

A mobile-first, single-page head-coach career sim. Pure static HTML/CSS/JS,
deployed via GitHub Pages, all state saved to `localStorage`. No backend, no accounts.

## Play

Open the GitHub Pages URL on your phone or desktop. Saves are keyed to the origin,
so progress persists across visits to the hosted URL.

## Develop

It's a single self-contained file: `index.html`. Open it in a browser, or run a
static server (`python3 -m http.server`) and hit it from your phone on the same network.

See [`CLAUDE.md`](CLAUDE.md) for the full project brief, architecture, and roadmap.

## Test

A headless-browser QA gate drives the real game on a mobile viewport and asserts
behavior across every screen (wizard, roster, coaches, league, season schedule/standings,
week sim, save/load, migration):

```sh
npm install
npx playwright install chromium   # one-time
npm run qa
```

It starts its own static server, exits non-zero on any failure, and writes
screenshots to `test/shots/`. See the test hooks (`?seed=N`, `data-id`, `data-tid`)
documented in `CLAUDE.md`.

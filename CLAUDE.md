# SIDELINE — College Football Coach Sim

A mobile-first, single-page head-coach career sim. Pure static HTML/CSS/JS, deployed
via GitHub Pages, all state saved to `localStorage`. No backend, no accounts.

> This file is the project brief + working memory. It reflects the state at the end of
> **Phase 2**. Update the "Status" lines as phases land.

---

## Run & deploy

Currently a single self-contained file: `index.html`. To work on it:

- **Local:** open `index.html` in a browser, or run any static server in the repo
  (`python3 -m http.server`) and hit it from your phone on the same network.
- **Deploy:** push to a repo, enable GitHub Pages (Settings → Pages → deploy from branch,
  root). The hosted URL is a stable origin, so `localStorage` saves persist across visits.

**Save data note:** saves are keyed to the origin. The file opened locally, the Pages URL,
and a different host are *separate* save stores. This is expected.

If/when this is split into modules (see "Structure decision"), keep the build output as
plain static files so Pages still serves it with zero config.

---

## Roadmap

- **Phase 1 — Shell.** ✅ DONE. Menu, 3 save slots, new-game wizard, all 134 FBS teams
  generated, home page, team page (roster + coaches), league browser.
- **Phase 2 — Season.** ✅ DONE. Deterministic full-league schedule (~12 games/team over
  15 weeks), week-by-week advancement, placeholder score sim (OVR gap + home field + variance),
  W/L + conference records, record-aware live rankings, and a Season view
  (schedule / standings / top 25 / weekly scores).
- **Phase 3 — Play-by-play sim.** ✅ DONE. Deterministic drive/play engine (`simEngine`)
  replaces the final-score-only model, producing the same `{hs, as}` the season layer expects
  **plus** a per-game box score that folds into per-player season stats. No coaching decisions
  yet (AJ's call). See "Phase 3 sim design" below.
- **Phase 4 — Deep recruiting.** Scouting, visits, pitches, promises, commitments.
  *Do a short design note on the recruiting loop before building.*
- **Phase 3.5 — Watchable game + weekly honors.** A play-by-play viewer for the controlled
  team's matchup, and **Player/Coach of the Week** (cheap — the per-game box already exists).
  See "Planned: awards & honors" below.
- **Phase 4 — Deep recruiting.** Scouting, visits, pitches, promises, commitments.
  *Do a short design note on the recruiting loop before building.*
- **Phase 5 — Offseason & program.** Coaching carousel (hire/fire), player development,
  finances depth, facility upgrades, **non-conference series scheduling**, and **season awards**
  (national POY, all-conference/All-American, etc.) — see the design notes below.

---

## Planned: awards & honors (weekly + season)

Now that the sim produces per-game boxes and per-player season totals (`p.gs`), awards are the
natural consumer. Split into two tiers by cadence:

- **Player / Coach of the Week** (in-season, weekly → Phase 3.5). Pick standout performances
  from the week just resolved, weighted by position (passing/rushing/receiving yds+TDs,
  defensive splash plays; coach by upset margin vs the OVR gap). The per-game box is already
  computed in `advanceWeek`; the only new data is "remember the week's honorees". Surface on
  Home + a Season tab. **Low cost, no cross-season storage** if we only keep the current season's
  weekly list.
- **Season awards** (end of season → Phase 5). National POY (Heisman-like), All-Conference /
  All-American teams, conference POY, Freshman of the Year, positional bests, Coach of the Year.
  Driven by season `p.gs` totals (normalized by games) + team success. Belongs with the
  offseason because it needs the **season-end ceremony flow** and an **award history that
  persists across seasons**.

**Save-shape implication (do it with the offseason, not piecemeal):** cross-season honors want a
durable home — e.g. a per-player `p.honors: [{year, award}]` and/or a top-level `S.awards` log.
That's a `version` bump + `migrateState` step, so land it alongside season rollover rather than
adding a half-version now. Weekly POTW for the *current* season can ship in 3.5 without a
shape change (recompute from the schedule, or stash a transient `S.weeklyHonors`).

## Planned: non-conference series scheduling (Phase 5)

Players (and AI schools) book the **non-conference** part of the schedule by agreeing to
series with other programs. Either side can initiate — an AI school offers you, or you offer
one. Conference games stay auto-assigned; only non-conf openings are player-fillable.

**Why Phase 5:** a series is inherently multi-year (a home-and-home is two games across two
seasons), so it depends on **season rollover**, which doesn't exist until the offseason
system lands. Deferring it keeps the data model honest instead of faking single-season
"series." Decided 2026-06-27.

Series types to support:
- **Home-and-home** — two games, alternating hosts, across two seasons.
- **2-for-1** — bigger school hosts twice, smaller once (three games / three seasons).
- **Neutral-site / kickoff** — one-off at a neutral venue (e.g. a season-opening showcase).
- **Guarantee / buy game** — pay a smaller school a payout to visit for one game; ties into
  the finances system (the guarantee is real money out of `budget`).

**Data model (sketch):** a top-level `S.series = [ Series ]`, where a `Series` is a multi-year
agreement: `{ id, type, a: teamId, b: teamId, legs: [ { year, home, away, neutralSite? } ],
guarantee? }`. AI willingness to accept keys off prestige proximity, scheduling philosophy,
and (for buy games) the guarantee offered.

**Contract change this forces on `genSchedule`** (today it auto-fills the *whole* slate):
generation must become two-phase — (1) seed the matchup graph with **locked** edges
(this year's series legs + conference games), then (2) auto-fill each team up to ~12 games
and edge-color locked + filled games into weeks together. Phase 3 work should avoid
assuming the schedule is fully engine-generated. (`startSeason` will pull each series' leg
whose `year` matches the season being generated.)

## Feature spec (source requirements)

### Main menu
- New Game / Load Game.
- Three save slots: load, save, overwrite, delete.

### New Game
- Coach identity: first name, last name, home state, **archetype**, **history**.
- Upload custom rosters (real data) and edit rosters (uploaded or manual).
- Pick a team to take over, or be randomly assigned.
- View every team's ratings and facility levels.

### Home page
- Program status incl. money earned and money owed.
- Next opponent or next task (media day, offseason meeting, team meeting, etc.).
- National ranking (if ranked).
- Conference ranking and division ranking.

### Team page — two tabs
- **Roster:** manage starters & depth, mark a position as needing recruits, promote/demote
  team captains, glance info (name, age, stats this year). Each player shows a **Ceiling**
  (scouted potential tier — Depth…Superstar…Generational) and a **Development** stage
  (Raw/Developing/Polished/Maxed). Both are read-only reads; actual growth is Phase 5.
- **Coaches:** two sections. **Coordinators** (OC/DC/STC) are fixed slots — one per side,
  always filled. **Additional Coaches** are position coaches; each carries a small OVR
  *boost* to its position group that is applied live to `ratings` (see Team object).
  Salary editing works; hire/fire still deferred to Phase 5.

---

## Coach identity design

**Archetype** = *how you coach* (one of):
Recruiter · Offensive Genius · Defensive Genius · Motivator · Manager.

**History** = *where you came from* (one of). Stacks with archetype; each is intended to
carry a starting prestige, a recruiting-network profile, and modifiers:

| History | Intended effect |
|---|---|
| Former Player | High player respect/motivation; pull with athletes. |
| Coordinator | Deeper starting playbook; better game-planning. |
| Lifer | Cheaper, loyal staff; weak early reputation. |
| NFL Transplant | Big early prestige/job security; thin college recruiting network. |
| High School Legend | Strong home-state recruiting ties; raw-talent development. |
| Analyst | Sharper scouting + in-game reads; weaker recruiting relationships. |

> Phase 1 stores the choices but does **not** yet apply mechanical effects. Wire these in
> alongside the systems they touch (recruiting in Phase 4, dev in Phase 5, etc.).

---

## Architecture

Globals (classic script, no bundler yet). Key pieces in `index.html`:

- `rng(seed)` — seeded mulberry32. **World generation is deterministic from a seed.**
- `genWorld(seed)` → `{ teams: [...] }`. Builds every team: prestige, roster, ratings,
  facilities, finances, staff, then assigns `natRank` / `confRank` / `divRank`.
- `recomputeRanks(world)` — re-sorts ranks after edits/imports.
- Save system: `readSlot`/`writeSlot`/`deleteSlot`, keys `sideline_slot_1..3`.
  Each slot stores `{ meta, state }`; `meta` powers the load screen.
- `migrateState(state)` runs on load and upgrades old saves to the current `version`
  (currently **3**). v1→v2 backfills staff tiers/boosts via `normalizeStaff`; v2→v3 adds
  Phase 2 season fields (`schedule`/`lastPlayedWeek`, per-team `rec`). Each step re-derives
  ratings/ranks. **Bump `version` + extend `migrateState` on any save-shape change.**
- **Season engine** (`genSchedule`/`startSeason`/`simGame`/`advanceWeek`): `genSchedule(world,seed)`
  picks ~12 conference-weighted matchups per team then greedy edge-colors them into
  `SEASON_WEEKS` (15). `simGame` is seeded per game id (`rng(hashStr(id)^seed)`) so a result
  is reproducible regardless of advance order. `rankScore(t)` blends OVR with record + point
  margin; `recomputeRanks` sorts by it (preseason it's pure OVR, so Phase 1 behavior is intact).
- `teamRatings(roster, staff)` derives `{off,def,ovr}`; `staffBoosts(staff)` maps each
  position code to the OVR points its coaches confer (applied inside `teamRatings`).
- `S` — live game state. `UI` — current view/tab/wizard state. `render()` swaps `#app`.
- `applyAccent(team)` — sets `--accent` to the controlled team's color (the signature).

### State shape (`S`)
```
{
  version, seed, createdAt, lastSaved,
  coach: { first, last, homeState, archetype, history },
  teamId,                 // id of the controlled team
  week, phase,            // 0/"Preseason" → 1..15/"Regular Season" → "Offseason"
  lastPlayedWeek,         // last week resolved (for the Scores tab)
  task: { type, label, note },   // weekly opponent card during the season
  schedule: { weeks, games: [ Game, ... ] } | null,   // null until kickoff
  world: { teams: [ Team, ... ] }
}

// Game: { id, week, home: teamId, away: teamId, played, hs, as }   // hs/as = home/away score
```

### Team object
```
{
  id, name, nick, abbr, conf, div, color, prestige,
  roster: [Player],
  ratings: { off, def, ovr },          // derived from roster + staff boosts
  fac: { stadium, strength, training, academics, nil },  // 1..10
  revenue, budget, payroll, facilityDebt,
  staff: [ { role, title, name, rating, salary, years,
             tier, scope, groups, boost } ],
  //   tier: "coord" (OC/DC/STC, side-wide) | "pos" (position coach, group)
  //   groups: [posCode,...] the coach buffs;  boost: OVR pts added to each (coord 0-2, pos 0-3)
  //   scope: display label ("OFF"/"DEF"/"ST" for coords, role code for position coaches)
  natRank, confRank, divRank,
  rec: { w, l, cw, cl, pf, pa, streak },  // season record (overall + conference); set at kickoff
  needs: { [posCode]: true }           // positions flagged for recruiting
}
```

### Player object (kept lean for storage)
```
{ id, fn, ln, pos, yr, age, st, stars, ov, pot, cap, spd, str, awr, so }
//   so = depth order within position (0 = starter); cap = captain
//   pot = TRUE ceiling (0..99). The UI never shows it raw — `scoutedCeiling(p)` renders a
//   fuzzy tier/band whose uncertainty shrinks with scouting confidence (age/experience now;
//   real scouting in Phase 4). `devStage(p)` buckets the ov→pot gap (Raw…Maxed).
```

Positions: `QB RB WR TE OT OG C  DE DT LB CB S  K P`.

Rosters are **scholarship-sized**: ~84 players/team (all 134 teams ≈ 11.3k players),
generated fresh from the world seed on every New Game (deterministic per seed; `?seed=N`
is the only way to repeat a world). Each position is generated several deep, then `genRoster`
**tapers everyone past the two-deep** (`so >= 2`) so backups and walk-ons fall off
realistically — starters (`so 0–1`) are untouched, so team ratings (top 11 per side) aren't
inflated by depth. First/last names draw from large pools to keep same-roster duplicate
names rare (<1% league-wide).

---

## Roster import schema (`format: "sideline-roster"`)

Import **overrides** a team when `abbr`/`name` matches a built-in team; otherwise the team
is **added**. Partial files are fine — supply only the teams you have real data for.

```json
{
  "format": "sideline-roster",
  "version": 1,
  "teams": [
    {
      "name": "Example State",
      "nickname": "Mockingbirds",
      "abbr": "EXST",
      "conference": "SEC",
      "division": "",
      "color": "#1b5e20",
      "prestige": 74,
      "facilities": { "stadium": 8, "strength": 7, "training": 7, "academics": 6, "nil": 7 },
      "players": [
        { "first": "John", "last": "Smith", "pos": "QB", "year": "JR", "age": 21,
          "homeState": "TX", "stars": 4, "overall": 88, "potential": 92,
          "spd": 80, "str": 70, "awr": 86, "captain": true }
      ]
    }
  ]
}
```

The "Download blank roster template" button in the wizard emits this exact shape.

---

## Design system

Direction: **sideline terminal** — dark broadcast-booth base, chalk-white text, condensed
scoreboard headers. The signature: the entire UI accent adopts the **controlled team's
color** (crimson for Alabama, green for Oregon…). Spend boldness there; keep the rest quiet.

- Fonts: `Saira Condensed` (display/headers/numbers), `Inter` (body).
- Tokens live in `:root` CSS vars. `--accent` / `--accent-ink` are set at runtime per team;
  default accent is gold `#c9a227` on the menu (no team yet).
- Mobile-first, `max-width: 560px` centered column, bottom tab nav, safe-area insets.
- Quality floor: visible focus, `prefers-reduced-motion` respected, 16px inputs (no iOS zoom).

---

## Conventions & gotchas

- **No build step yet.** Everything is global in one `<script>`. If splitting into modules,
  preserve the deterministic seed → `genWorld` contract; saves store the full world today.
  With scholarship-sized rosters a full-world save is **~2 MB** (vs the ~5 MB/origin
  `localStorage` cap), so the seed + diff optimization gets more attractive as seasons
  accumulate — worth doing before saves carry per-season history.
- After any roster/ratings/staff edit, call `teamRatings(roster, staff)` then
  `recomputeRanks(S.world)` (staff boosts feed into the rating, so pass the team's staff).
- `autosave()` writes to the slot matching `S.createdAt`; explicit "Save game" is in the
  bottom-nav Menu sheet.
- Conference alignment + team colors are best-read as of early 2026 and may have minor
  errors; they're editable via import or the built-in `TEAMS` array.

### Testing hooks (for headless/browser-driven tests)
- **Deterministic world:** `?seed=N` makes New Game use seed `N` (reproducible roster for
  screenshots/assertions). `?reset=1` clears all save slots on load.
- **Stable selectors:** dynamic rows carry `data-id` (player id / coach `role` / team id);
  nav buttons `data-tid="nav-<view>"`, team tabs `data-tid="tab-<roster|coaches>"`;
  `#app` carries `data-screen` (= `UI.view`) and `data-tab`; sheets `data-tid="sheet"`.
- **State access:** it's a classic script, so `S`, `UI`, and `controlled()` are global —
  read them directly from `page.evaluate(() => ...)` instead of scraping the DOM.
- Don't assert on visible text that has `text-transform` (e.g. `.sec` headers render
  uppercased; `innerText` returns the transformed text). Prefer `data-tid`/`data-id`.

### Still stubbed (intentionally inert)
- Offseason is a dead end for now: after week 15 the phase becomes "Offseason" with a
  season-complete card; rollover/recruiting/development land in Phases 4–5.
- Coach hire/fire (→ Phase 5); only salary editing works now.
- History/archetype mechanical effects (wire in with their systems).
- Player development is **read-only grades** only (Ceiling/Development); actual ov→pot
  growth over seasons is Phase 5. Scouting fog is currently a fixed function of age/class;
  real scouting that sharpens it is Phase 4.
- No **watchable** game screen yet: every game (controlled team included) is resolved
  instantly by `simEngine`. A play-by-play viewer for your matchup is the natural Phase 3.5
  follow-on — the engine already runs drive-by-drive, so a play log is a small extension.

---

## Phase 3 sim design (drive/play engine)

The sim is `simEngine(home, away, seed)` in `index.html`, fenced by
`// === SIM ENGINE (Phase 3) START/END ===`. It is **pure and deterministic**: it never
mutates its inputs and re-running with the same seed reproduces both the score and the full
box. That purity is load-bearing — the QA gate re-sims a played game to assert determinism,
and `simGame` re-derives results regardless of advance order.

**Contract with the season layer (unchanged):** `simGame(g)` seeds the engine per game id
(`rng(hashStr(g.id) ^ seed)`, exactly as the old model did), sets `g.hs/g.as/g.played`, and
**returns the per-game box**. `advanceWeek` does `applyResult(g, simGame(g))`; `applyResult`
updates `t.rec` as before **and** folds the box into per-player season stats. Re-simming a
clone (the determinism test) never calls `applyResult`, so stats are never double-counted.

**State machine.** `playDrive(off, def, startLos)` runs one possession on a single axis:
`los` = the offense's own yard line (0→100, scoring end at 100). Possession flips by
mirroring (`opp los = 100 - los`). Per play: choose run/pass (down & distance weighted),
resolve yards from a short base + a long-tail breakaway, check for TD / turnover / sack /
incompletion, credit a defender a tackle, then update down & distance. 4th down kicks a FG
(in range), punts (net ≈ 42, touchback → 20), or occasionally goes for it. Regulation
alternates drives until a ~3600s clock empties; ties go to college-style OT from the opp 25.

**Probability model.** Per-play efficiency keys off `adv = off.off − def.def`, plus a home
field bump (`HFA = 2.3` rating pts) and a per-game **form** roll per team (std ≈ 4 pts) so
underdogs can steal games. Validated in `test/simlab.js` across many seasons: **~24 pts/team**,
score spread ≈ 6–45 (p05–p95), **~54% home** wins, **~77% favorite** win rate, no ties.

**Per-player stats.** The box maps `playerId → { gp, pAtt,pCmp,pYds,pTD,pInt, rAtt,rYds,rTD,
rec,reYds,reTD, tkl,sk,dInt, fga,fgm,xpa,xpm }` (only nonzero keys). Touches are drawn from
depth-weighted pools (`gamePools`) so starters dominate; QB→passing, RB→rushing,
WR/TE/RB→receiving, LB/S/CB/DE/DT→tackles, etc. Season totals live on the Player object as
`p.gs` (game stats), accumulated for **every** team's players, so league stat leaders are
real. Empty stat objects are not stored, so the save-size hit is limited to players who
actually saw the field (~rotation, not all ~84). Box-score realism + balance (team passing
yards == team receiving yards) are asserted in `simlab.js`.

**Save shape.** Per-player stats bumped the save to **version 4**; `migrateState` v3→v4 is a
no-op structurally (absence of `p.gs` reads as "no stats") and just stamps the version.

**Validation:** `npm run simlab` (offline statistical lab — extracts the engine from
index.html between the markers so there's one source of truth, then sims many seasons) +
`npm run qa` (in-browser end-to-end). Both are part of the per-phase QA gate.

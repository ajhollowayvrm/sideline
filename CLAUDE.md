# SIDELINE — College Football Coach Sim

A mobile-first, single-page head-coach career sim. Pure static HTML/CSS/JS, deployed
via GitHub Pages, all state saved to `localStorage`. No backend, no accounts.

> This file is the project brief + working memory. It reflects the state at the end of
> **Phase 9** — all roadmap phases (1–9) are DONE. Update the "Status" lines as phases land.

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
- **Phase 3.5 — Watchable game + weekly honors.** ✅ DONE. Watch-then-commit play-by-play
  viewer for the controlled team's game (Skip + Fast), a **greatest-games replay** list, and
  **Player of the Week** at national + per-conference scopes (save v5). See "Phase 3.5 design".
- **Phase 4 — Deep recruiting.** ✅ DONE. An in-season recruiting cycle: a fogged national
  prospect board, a weekly **recruiting-points** economy, and five actions — **offer, scout,
  pitch (angle), visit, promise** — against AI schools that recruit the same prospects and
  **commit** to whoever leads. Coach **archetype/history** effects finally come online here.
  Class **rankings + a letter grade** are the payoff. Signees bank in `S.recruiting` until the
  Phase 5 rollover turns them into freshmen (save v6). See "Phase 4 recruiting design" below.
- **Phase 5 — Season rollover & basic development.** ✅ DONE. The keystone: an
  Offseason→next-Preseason transition that graduates seniors, ages + **develops** (ov→pot, basic)
  every roster, enrolls each team's recruiting signees as **true freshmen** (blue-chips enter
  raw with the recruit's pot as ceiling; promises carried), backfills positions with generated
  2–3★ depth so rosters hold at ~84, wipes last season's stats, increments a **calendar-year
  counter** (`S.year`), and resets `schedule`/`weeklyHonors`/`recruiting` (re-created at the next
  kickoff). Broken playing-time promises risk a transfer out (save v7). See "Phase 5 rollover
  design" below. *(Originally scoped as the whole offseason; the rest of that work was split out
  into Phases 6–9 below once rollover landed.)*
- **Phase 6 — Program building (staff & money).** ✅ DONE. The GM layer. A **finances loop**
  (`resolveFinances` settles every team at rollover: conference/prestige/stadium revenue +
  performance bonus − payroll − debt service → `budget`, which can go **negative**), **facility
  upgrades** (`applyFacilityUpgrade` spends `budget` or finances onto `facilityDebt` to raise the
  1–10 `fac` levels; `fac.nil`/`academics` now feed `recruitFit`), and a **coaching carousel**
  (`genCoachMarket` free-agent pool, `advanceCoachCarousel` AI churn + poaching of player
  coordinators; hire/fire with `buyoutCost`/`hireCost`; coordinator vacancies gate kickoff). New
  pure `ECONOMY ENGINE` block + `npm run econlab` (24 checks); save **v8** (`S.coachMarket`,
  `team.lastFinances`). See "Phase 6 kickoff — implementation plan" below.
- **Phase 7 — Development & coach identity depth.** ✅ DONE. Growth + identity are now mechanically
  rich. **Side-specific development** (`devRateFor(team,p)`: facilities base × the side's
  coordinator + the player's position coach — every team — × the controlled coach's side-specific
  Off/Def Genius, Motivator, Analyst, HS-Legend signals; `rolloverRoster` takes a per-player
  `rateFor` and records `p.dev` = last offseason's OVR gain). **Growth surfaced** in the roster UI
  (`growthChip` ▲+N). **In-game coach effects** (`coachGameEdges`/`withCoachEdge`/`simSides`: a
  small side-specific rating edge the controlled team plays with — Motivator/Former-Player/
  Coordinator both sides, Off/Def Genius their own — applied OUTSIDE the pure `simEngine`, identical
  in commit + watch paths). **Coach-responsive scouting fog** (`scoutSharpen`: Analyst + a strong
  coordinator room tighten the roster ceiling band). Save **v9** (optional `p.dev`); rolllab grew to
  20 checks (per-player `rateFor`), qa drives the dev/edge/growth surfacing.
- **Phase 8 — Schedule, geography & awards.** ✅ DONE. Season structure + end-of-season payoff.
  **AI geography** (`TEAM_STATE` → `team.homeState`; `recruitFit` + `genRecruits` now weight
  in-state proximity for every program, not just the player). **Season awards** (pure `AWARDS
  ENGINE`: Heisman/National POY, Defensive POY, Freshman of the Year, per-conference POY,
  All-America team, Coach of the Year — computed at `endSeason` from season `p.gs`, stamped onto
  winners' `p.honors`, logged in `S.awards`; **Coach of the Week** now crowned each week too) with a
  Season **Awards** tab + Home ceremony card + `npm run awardlab` (12 checks). **Non-conference
  series** (`S.series` multi-year agreements; `genSchedule` is now two-phase — series legs lock as
  fixed edges, byte-identical when none; **home-and-home / 2-for-1 / neutral / buy** games, and the
  scheduling is **two-sided** — you propose via a sheet *and* AI programs send you offers each
  offseason (`genSeriesOffers` → `S.seriesOffers`, accept/decline; a buy offer pays *you*).
  Award set also includes **All-Conference** first teams per league. Save **v11** (`S.awards`,
  `S.series`, `S.seriesOffers`, `team.homeState`, optional `p.honors`). Coach identity is fully
  wired: **Manager** (revenue +6% via `resolveFinances` mult, −10% facility cost, staff-retention
  poach resistance), **Lifer** (−15% hire/buyout cost + loyal staff), and **academics→lower
  promise-break transfer risk**. See "Planned: season awards" + "Planned: non-conference series".
- **Phase 9 — Tech debt & scale.** ✅ DONE (save optimization). A **storage codec** shrinks saves
  ~40% (a fresh/played save ~2.3 MB → ~1.4 MB, well under the ~5 MB cap). Rosters — 98% of the
  bytes — serialize **columnar** (`encRoster`/`decRoster`: the 15 core player fields become a flat
  tuple instead of repeating field names 11k times; sparse extras like `gs`/`dev`/`honors` ride in a
  side object). `encodeState`/`decodeState` wrap `writeSlot`/load; pure serialization with **no seed/
  `genWorld` dependency**, so it's deploy-safe and correct-by-construction (qa round-trips all 11k
  players exactly). *Deliberately NOT done:* the **seed + diff** variant (couples save validity to
  `genWorld`'s exact code → silent corruption across deploys — too fragile for real player saves; the
  columnar codec gets most of the win safely) and the optional **module/build split** (splitting the
  working single-file app risks Pages' zero-config serving for no functional gain).
- **Deliberate non-goals** (out of scope unless we revisit): no live viewer for *arbitrary* games
  (only the controlled team's game is watchable/replayable, so advancing a week stays fast); and
  the recruit board stays **top-300 only** (the long 2–3★ tail is approximated, never individually
  modeled). These are design choices, not a backlog.

---

## Phase 3.5 design — watchable game + weekly honors

Decided 2026-06-27 with AJ. Two features, both consumers of the Phase 3 sim.

### Watchable game (watch-then-commit + greatest-games replay)

**Engine change (small, shared by both):** add an optional play log to `simEngine` —
`simEngine(home, away, seed, {log:true})`. When requested it pushes structured events
(drive start + field position, each play's call/result/yards, scores, final) into `res.log`
**without consuming rng**, so the score and box are byte-identical whether logging is on or
off. The UI generates the full log instantly, then *animates* stepping through it (no real-time
sim). Determinism means a replay always matches the committed result.

- **Watch-then-commit (advancing your week):** when the controlled team has a game,
  "Play Week →" opens a live game view that plays the log out (drive/score ticker), then on
  finish commits the result and resolves the rest of the league instantly (as today). Must have
  a **Skip → result** button so weeks you don't want to watch stay one tap. Bye weeks skip the
  viewer entirely.
- **Greatest games (replay):** a curated list of standout games you can re-watch any time.
  Selection is computed from the schedule (every game persists `id/home/away/hs/as`, and the
  engine is deterministic from `id`+seed, so *any* game is replayable). Tag-worthy: biggest
  upset (winner OVR ≪ loser OVR), highest combined score, decided in OT / by ≤3, and the
  controlled team's signature wins. Store lean refs (`{gameId, tag}`), not logs. Surface as a
  "Greatest Games" list (Season area).

### Weekly honors — Player of the Week (national + per-conference)

After each week resolves, pick **Offensive & Defensive Player of the Week** at two scopes:
**national** (best in FBS) and **one per conference**. Score a single-game box with a
position-aware function (offense: passYds·0.04 + passTD·4 + rushYds·0.1 + rushTD·6 +
recYds·0.1 + recTD·6 − pInt·2; defense: tkl·1 + sk·4 + dInt·6 — tune in the sim lab). The
per-game boxes already exist in `advanceWeek`; compute honors there (before the box is
discarded) and store the winners.

**Save shape:** add `S.weeklyHonors` — `[ { week, national:{off,def}, byConf:{ [conf]:{off,def} } } ]`,
where each honoree is a lean snapshot `{ pid, teamId, line }` (snapshot the stat line so it
survives later edits/rollover). New persisted field → **bump save to version 5**, `migrateState`
v4→v5 backfills `S.weeklyHonors = []`. Surface on Home (this week's national POW card) and a new
Season **"Honors"** tab (national + per-conference, by week).

**Validation (shipped):** `npm run simlab` (26 checks) asserts log-on/off parity (the log
doesn't perturb the result) and that the POW scorer picks sane positions. `npm run qa`
(78 checks) drives the watch flow (skip → commit gives the watched score), greatest-games
replay (replayed score == recorded score, week unchanged), honors on Home + the Season Honors
tab, v5 migration, and honors surviving reload.

## Phase 4 recruiting design — the in-season recruiting loop

Decided 2026-06-27 with AJ. Recruiting runs **concurrently with the regular season** (weeks
1–15), so it reuses the existing weekly cadence (`advanceWeek`) instead of needing new
plumbing. It is the first system to actually **apply coach archetype/history** effects.

### Why in-season, and where the class goes
Real recruiting culminates on Signing Day in the offseason and the class joins the roster the
*next* year — but **season rollover doesn't exist yet** (it's Phase 5, same blocker as
non-conf series). So Phase 4 is a complete, self-contained *cycle within one season*: you work
a prospect board across the 15 weeks, **Signing Day** fires when the season ends, and the
signed class banks in `S.recruiting.pool` (each signee's `committedTo` = your team id). When
the Phase 5 rollover lands, signees convert to freshman `Player`s (and promises are honored or
broken). Until then the payoff is a **class ranking + grade** — honest, like the series
deferral. No faked single-season roster injection.

### The prospect pool (lean, top-heavy)
`genRecruits(seed, teams)` builds **~300 contested blue-chip prospects** (≈ a top-300 board),
deterministic from the world seed. We deliberately do *not* model all ~3000 national recruits:
storing them would bloat the save, and only the contested ones create gameplay. Each prospect
is lean: `{ id, fn, ln, pos, st (home state), stars, ov, pot, spd,str,awr, scout, prefs, iv,
committedTo, signed, offered, visited, promise }`. `iv` is interest **keyed by suitor team id**
(only a handful of suitors per prospect — 5★ draw ~6 blue-bloods, 3★ draw ~3 incl. mid-majors),
so it stays small. Star mix ≈ a handful of 5★, ~70 4★, the rest 3★.

A team's class is `pool.filter(r => r.committedTo === id)`. **Class score** = Σ landed-prospect
value **+ a prestige baseline** (the ~20 two-/three-star signees every program lands that we
don't simulate). The baseline keeps rankings realistic (blue-bloods who whiff on a few
blue-chips still rank well; small schools aren't all tied at zero) without storing the long
tail. The Class view shows your named blue-chip commits + a "+N projected 2–3★ depth" line.

### Fog (scouting), reusing the Phase 3 pattern
A prospect's true `ov/pot` is hidden behind the same fuzzy-ceiling read as players, but the
uncertainty is driven by **your `rec.scout` confidence** (0→100) instead of age/class. Spending
a **Scout** action sharpens the band; **prefs** (what the recruit values) start hidden and are
revealed once scouted past a threshold. `recScouted(rec)` returns the banded tier; the
**Analyst** history shrinks the band faster / scouts cheaper.

### Weekly economy + the five actions
You get a **weekly points** allotment (`weeklyPoints()` — base + coach mods + prestige), spent
on board prospects. Use-it-or-mostly-lose-it each week to force engagement. Actions:
- **Offer** (free, once) — enter the race: adds you as a suitor with a fit-based starting
  interest (low if you're a poor fit chasing a 5★). Gated by **board slots**.
- **Scout** — +scouting confidence (shrinks the ceiling fog, reveals prefs).
- **Pitch (angle)** — pick an angle (Playing Time / NIL / Winning / Development / Home /
  Academics); interest gain scales with how well the angle matches the recruit's top pref ×
  coach mods. The core skill action.
- **Visit** — big interest boost; **game-day visits** (a home game that week) boost more. Once.
- **Promise** (e.g. immediate playing time) — largest boost, but records an **obligation** on
  the signee for Phase 5 to honor/break. Once.

### AI competition + commitment (`advanceRecruiting`)
Each `advanceWeek`, after the games resolve: every suitor's interest in each uncommitted
prospect grows by a **fit-based weekly increment + jitter** (the player team is treated like any
suitor for *passive* growth — your actions are the lever on top). Then commitments resolve: a
prospect commits to its **leading suitor** when `lead ≥ COMMIT_THRESH`, the lead margin over
2nd `≥ LEAD_GAP`, and a **readiness ramp** roll passes (readiness rises over the season; higher
stars are more patient and commit later). On the **final week** every still-uncommitted
prospect signs with its current leader (or stays unsigned if no real suitor). Seeded per
`(seed, week)` so a cycle is reproducible. Landing = a prospect commits to *you*.

### Coach identity, finally wired (`coachMods(coach)`)
Returns multipliers/bonuses used throughout: **Recruiter** (headline) → more points, more board
slots, stronger interest per action; **Motivator** + **Former Player** → visits/pitches convert
harder (player respect); **Manager** → NIL pitch weight + slight points; **NFL Transplant** →
higher effective recruiting prestige but fewer board slots (thin network); **High School
Legend** → strong **home-state** interest bonus (recruits whose `st` == `coach.homeState`);
**Analyst** → sharper/cheaper scouting, slightly weaker relationship growth. (Offensive/
Defensive Genius lean Phase-5 development; minor here.) AI teams have no coach identity — their
fit is prestige-tier match + per-pair seeded pull (team home states don't exist yet, so AI
geography is abstracted; the player feels geography through `coach.homeState`).

### Save shape
New top-level `S.recruiting = { cycle, points, pool, board:[recruitId], signed:bool }`. Bumps
the save to **version 6**; `migrateState` v5→v6 backfills `S.recruiting = null` (recruiting is
created at kickoff via `initRecruiting`, exactly like the schedule), so old in-progress seasons
keep working and recruiting simply begins next kickoff.

### Validation
The pure engine is fenced (`// === RECRUIT ENGINE (Phase 4) START/END ===`) and extracted by
`test/reclab.js` → **`npm run reclab`** (offline cycle lab): asserts a cycle **converges**
(nearly all prospects sign by Signing Day), **better programs sign better classes**, the star
distribution is top-heavy, **a player who actively pushes a target lands more than one who
idles**, and determinism by seed. `npm run qa` drives the recruiting UI end-to-end (offer →
pitch → advance → interest grows → a commit lands; Class tab grade; v6 migration + persistence).
Three gates now: `npm run simlab` + `npm run reclab` + `npm run qa` — all green each phase.

## Phase 5 rollover design — season rollover (the enabler) ✅ DONE

The keystone of Phase 5. Lets a season end and a new one begin so every other offseason system
has somewhere to live. Two layers, mirroring the recruiting split:

### Pure engine (fenced `// === ROLLOVER ENGINE (Phase 5) START/END ===`)
Depends only on `rng/ri/clamp/pick` + the data arrays (`FN/LN/STATES/POS/CLASSES`) — no DOM, no
`S` — so `test/rolllab.js` extracts + validates it offline (like `reclab`).
- `NEXT_CLASS` — the class ladder (FR→SO… SR/RS-SR→`null` = graduate). `DEV_YOUTH` — per-class
  development weighting (freshmen grow fastest, seniors plateau).
- `developPlayer(p,r,rate)` — grows `ov` toward `pot` over an offseason; `pot` is a true ceiling
  and never moves. `rate` (~0.8–1.2) folds in facilities + coach. Nudges `spd/str/awr`, re-tiers
  `stars`, returns the OVR gained.
- `genFreshman(r,prestige,pos)` — a generated 2–3★ depth freshman (the unmodeled signees every
  program lands); used to **backfill** positions thinned by graduation.
- `recruitToFreshman(rec,r)` — converts a signed recruit to a true freshman: blue-chips enter
  **raw** (ov discounted by pedigree) with the recruit's `pot` as ceiling, so development carries
  them up over a career. Carries `promise` (+ `fromRecruit:true` tag).
- `rolloverRoster(roster,signees,prestige,r,opts)` — the per-team transform: graduate seniors,
  age + develop the returning roster (**clears `p.gs`** so stats never carry over), enroll signee
  freshmen, backfill each position to its `POS` target with `genFreshman`, re-`so` by ov, reset
  captains. Returns `{roster, graduated, freshmen, trackedCount}`. **Does not re-taper returning
  ratings** — the generation depth-taper is a one-time artifact, so a developed backup can climb.

### App layer (`rolloverSeason()`)
Triggered from the Offseason Home card ("Roll over to <year> →"). Builds the per-team signee map
from `S.recruiting.pool`, resolves the controlled team's **promises** *before* rollover wipes
`p.gs` (`resolvePromises`: a broken playing-time promise risks a transfer out; kept/other promises
clear), rolls every team's roster, `S.year++`, resets `rec`/`schedule`/`weeklyHonors`/`recruiting`
to season defaults, re-derives ratings + ranks, lands in **Preseason** (so the existing kickoff
flow rebuilds the schedule + a fresh recruiting cycle), and stores `S.offseasonReport` for the
Home **offseason recap** card. `devRate(team)` sets each team's growth from facilities
(strength+training); the controlled coach's Off/Def Genius adds a small edge.

### Save shape & validation
Adds `S.year` (calendar-year counter, init 2026) → save **version 7**; `migrateState` v6→v7
backfills `year=2026`. Four gates now: `npm run simlab` + `npm run reclab` + **`npm run rolllab`**
(18 checks: roster holds ~84, classes progress + seniors graduate, dev moves ov→pot without
exceeding it, signees→freshmen, no stat carryover, promise carry, determinism, **league strength
stable ±6 OVR over 5 seasons**) + `npm run qa` (drives a full Offseason→rollover→next-kickoff:
year++, class enrolled, fields reset, v7, recap card) — all green.

## Phases 6–9 — plan (post-rollover backlog, read this first)

Phase 5 shipped season rollover + basic development, so a career now spans multiple years. The
remaining offseason/program work (originally one giant Phase 5) is split into cohesive phases by
dependency + theme. Suggested order is 6 → 7 → 8 → 9, but 6 and 7 are largely independent.

### Phase 6 — Program building (staff & money)
The GM layer; do first because money/staff feed everything downstream.
- **Coaching carousel.** Hire/fire coordinators + position coaches (today only salary editing
  works). AI poaches good coordinators; openings to fill; ties to `payroll`/`budget`. Staff
  ratings already drive `staffBoosts`→`teamRatings`, so a hire is felt immediately.
- **Finances depth.** Make `revenue`/`budget`/`payroll`/`facilityDebt` a real loop (income from
  success, spend on staff + facilities, debt service) rather than static display fields.
- **Facility upgrades.** Spend `budget` to raise the 1–10 `fac` levels; tie NIL/facilities into
  recruiting fit (`recruitFit`) and development rate (`devRate`, already facility-keyed).

### Phase 7 — Development & coach identity depth
Make Phase 5's basic `developPlayer` and Phase 4's `coachMods` mechanically rich.
- **Deeper development:** side-specific **Off/Def Genius** dev wiring (per-side rate), **Analyst**
  + coach-rating signals feeding growth, and surfacing growth in the roster UI (not just the
  read-only `devStage`/`scoutedCeiling` grades).
- **Remaining archetype/history in-game effects** (the non-recruiting, non-dev half of coach
  identity).
- **Coach-responsive roster scouting fog** — today a fixed age/class function; make it sharpen
  with scouting/coaching like the Phase 4 recruit fog does.

### Phase 8 — Schedule, geography & awards
Season structure + end-of-season payoff.
- **Non-conference series scheduling** — see "Planned: non-conference series scheduling" below.
  Multi-year (now possible post-rollover); **forces `genSchedule` two-phase** (locked legs first).
- **AI geography** — add a **home state** to each `TEAMS` entry so `recruitFit` can weight
  proximity for AI, not just the player (who feels it via `coach.homeState` + High School Legend).
  Small lift, big realism payoff; unblocks regional recruiting.
- **Season awards** — see "Planned: season awards" below. National POY/Heisman, All-Conference/
  All-American, conf POY, Freshman of the Year, Coach of the Year, + **Coach of the Week**
  (deferred from 3.5). Needs a season-end ceremony + cross-season award history.

### Phase 9 — Tech debt & scale
Do once per-season history makes saves heavy.
- **Seed + diff save optimization** (noted in "Conventions & gotchas") — a full-world save is
  already ~2 MB vs the ~5 MB cap; per-season history (awards/series) pushes it.
- Optional **module/build split** — today everything is global in one `index.html`; keep any
  build output as plain static files so Pages still serves it with zero config.

**Save versioning across these:** expect new fields (per-player `p.honors:[{year,award}]`;
`S.awards`; `S.series`; finances/facility state). Bump `version` + extend `migrateState` per
change. **Gates:** add per-phase checks to a lab (`reclab`/`rolllab` or a new one) + `qa`; keep
all four (`simlab`/`reclab`/`rolllab`/`qa`) green each phase.

**Deliberate non-goals** (out of scope unless revisited): no live viewer for *arbitrary* games
(only the controlled team's game is watchable/replayable, so a week stays fast); recruit board
stays **top-300 only** (the 2–3★ tail is approximated by a prestige baseline + generated filler
freshmen, never individually modeled).

## Phase 6 kickoff — implementation plan (read this first)

**Goal:** turn the static money/staff fields into a living **program-management loop** — win →
earn → spend on **facilities** and **coaches** → better development + ratings + recruiting → win
more. Three subsystems, built and validated in this order (each is useful on its own):
**(A) finances loop → (B) facility upgrades → (C) coaching carousel.** A/B unlock spending; C is
the richest and leans on both. Follow the house discipline: a **pure fenced engine** validated by
a **node lab before any UI**, a **save-version bump + `migrateState` step**, and all gates green.

### What already exists (build on it, don't reinvent)
- Team money fields (static today): `revenue`, `budget`, `payroll`, `facilityDebt`; `fac` levels
  `{stadium,strength,training,academics,nil}` 1–10. Set once in `genWorld`.
- Staff: `genStaff(r,prestige)`, roles `COORD_ROLES` (OC/DC/STC, `tier:'coord'`) + `POS_COACHES`
  (`tier:'pos'`). `coachBoost(tier,rating)` → per-coach OVR boost; `staffBoosts(staff)` →
  `teamRatings(roster,staff)`. So a hire/fire is felt in ratings *immediately*.
- `devRate(team)` (Phase 5) already reads `fac.strength`+`fac.training` → facility upgrades feed
  development for free. `recruitFit(team,rec)` keys off `prestige` only — `fac.nil`/`academics`
  are **not** wired yet (Phase 6 should wire them).
- UI: `renderProgram(app)` (money snapshot + `facBar` levels) and `renderCoaches(v,t)` (coach
  rows; salary-edit sheet recomputes `payroll`). `money()` formats currency. `UI.view==='program'`.
- Rollover (`rolloverSeason()`) is the **annual settle point** — finances + the coach market hook
  in here, exactly like development does.

### (A) Finances loop
Make money resolve once a year inside `rolloverSeason()` (before rosters change), for **every**
team so AI economies move too.
- `resolveFinances(team)` (pure): `revenue` = conference/prestige base + **performance bonus**
  (last season `rec.w`, `natRank`, conf finish) + a **stadium gate** term (`fac.stadium`);
  `expenses` = `payroll` + **debt service** on `facilityDebt` (interest + principal); then
  `budget += revenue − expenses` (cash carries over and can go **negative** → constrains spending).
  Deterministic (optionally light seeded jitter via `rng(seed^hashStr('fin'+year+team.id))`).
- Store a lean `team.lastFinances = {revenue, expenses, net}` for the Program UI / offseason recap.

### (B) Facility upgrades
- `facilityUpgradeCost(key, level)` (pure): escalating cost to go `level → level+1` (e.g.
  `base[key] * (level+1)^1.6`); higher levels much pricier; cap at 10.
- `applyFacilityUpgrade(team, key)` (app): pay from `budget` (or finance → adds `facilityDebt`),
  `fac[key]++`, re-derive anything affected. Effects to wire: `stadium`→revenue (already in A),
  `strength`/`training`→`devRate` (already), `nil`→add a term to `recruitFit`, `academics`→
  `recruitFit` for academics-pref recruits (+ optionally lower promise-break transfer risk).
- UI: in `renderProgram`, each `facBar` gets an **Upgrade (cost)** button (disabled if `budget` <
  cost), with a finance-on-credit option. Allow only in Preseason/Offseason.

### (C) Coaching carousel
- `genCoachMarket(seed, year, world)` (pure): a deterministic **free-agent pool** (~24–40
  candidates across coord + pos roles), top-heavy on rating; each carries `rating`, asking
  `salary` (scales with rating), eligible role/tier. Store as `S.coachMarket` (null until first
  offseason, created at rollover — like `S.recruiting`/`schedule`).
- Player actions (controlled team, Offseason/Preseason): **fire** a coach (`buyoutCost(coach)` ≈
  remaining `salary*years`, out of `budget`; coordinators are fixed slots → firing opens a vacancy
  you must refill before kickoff; position coaches may sit vacant = lose the boost) and **hire**
  from the market (adds `salary` to `payroll`, must fit `budget`). Recompute `payroll` +
  `teamRatings` after any change.
- `advanceCoachCarousel(world, market, seed, year)` (pure-ish): the AI churn at rollover — better
  programs with openings/weak staff poach the best available (or from weaker teams), vacancies
  fill, the market refreshes. Keep AI modest but real; **the player's good coordinators can be
  poached** (tie job-security to prestige; NFL Transplant history could resist). Determinism by
  `(seed, year)`.

### Save shape & validation
- New persisted: `S.coachMarket` (null until rollover), `team.lastFinances`. Bump save to
  **version 8**; `migrateState` v7→v8 backfills `coachMarket:null` + `lastFinances` (null reads as
  "not computed yet", created at the next rollover — same pattern as recruiting/schedule).
- **Pure engine fenced** `// === ECONOMY ENGINE (Phase 6) START/END ===` (depends only on
  `rng/ri/clamp/pick/hashStr` + data arrays + `coachBoost`) holding `resolveFinances`,
  `facilityUpgradeCost`, `genCoachMarket`, `advanceCoachCarousel`, `buyoutCost`/`hireCost`.
- New lab `test/econlab.js` → **`npm run econlab`** (extract the block like reclab/rolllab):
  better/more-successful programs net more revenue; budget can go negative (spending is
  constrained); facility cost escalates and an upgrade raises the right derived effect
  (`devRate`/revenue/`recruitFit`); coach market is top-heavy + deterministic by seed; the AI
  carousel converges (no team left with an unfilled coordinator slot; better coaches drift to
  better programs); `payroll == Σ salaries`; multi-season money stays sane (no runaway/■death).
- `npm run qa`: drive `renderProgram` — upgrade a facility (budget drops, level + derived rating
  rise), fire+hire a coach (payroll + position-group boost + team OVR change), roll a season over
  (finances resolve, `lastFinances` shown, market refreshes), v8 migration + persistence.
- **Five gates now:** `simlab` + `reclab` + `rolllab` + **`econlab`** + `qa` — all green.

### Cohesion check (why these three ship together)
Hiring raises `payroll` (an expense in A); facility upgrades spend `budget` (A) and feed
`devRate`/`recruitFit` (B→Phase 5/Phase 4 systems); winning raises `revenue` (A) which funds B+C.
Each piece is inert without the money loop, so build A first, then B, then C — but land them as
one coherent Phase 6 so the management loop actually closes.

## Planned: season awards (end of season → Phase 8)

National POY (Heisman-like), All-Conference / All-American teams, conference POY, Freshman of
the Year, positional bests, Coach of the Year. Driven by season `p.gs` totals (normalized by
games) + team success. Needs a **season-end ceremony flow** and **award history that persists
across seasons** — a per-player `p.honors:[{year,award}]` and/or top-level `S.awards` log (another
`version` bump). Fire it at season end, just before/with the rollover. (Coach of the Week,
deferred from 3.5, rides along here.)

## Planned: non-conference series scheduling (Phase 8)

Players (and AI schools) book the **non-conference** part of the schedule by agreeing to
series with other programs. Either side can initiate — an AI school offers you, or you offer
one. Conference games stay auto-assigned; only non-conf openings are player-fillable.

**Why it waited (now Phase 8):** a series is inherently multi-year (a home-and-home is two games
across two seasons), so it depends on **season rollover** — which now exists (Phase 5), unblocking
it. Deferring kept the data model honest instead of faking single-season "series." It also pairs
naturally with the **buy-game payout** (real money out of `budget`), so it benefits from the
Phase 6 finances loop landing first. Decided 2026-06-27; re-slotted to Phase 8 on 2026-06-28.

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
  (Raw/Developing/Polished/Maxed). Both are read-only reads; basic ov→pot growth landed in
  Phase 5 (offseason rollover), and surfacing growth in this UI is Phase 7.
- **Coaches:** two sections. **Coordinators** (OC/DC/STC) are fixed slots — one per side,
  always filled. **Additional Coaches** are position coaches; each carries a small OVR
  *boost* to its position group that is applied live to `ratings` (see Team object).
  Salary editing works; hire/fire (the coaching carousel) is deferred to Phase 6.

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
> alongside the systems they touch (recruiting in Phase 4, basic dev in Phase 5, deeper dev +
> remaining in-game effects in Phase 7, staff/carousel in Phase 6).

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
  (currently **8**). v1→v2 backfills staff tiers/boosts via `normalizeStaff`; v2→v3 adds
  Phase 2 season fields (`schedule`/`lastPlayedWeek`, per-team `rec`); v3→v4 is a structural
  no-op (per-player `p.gs` stats); v4→v5 backfills `weeklyHonors`; v5→v6 backfills
  `recruiting:null` (created at kickoff); v6→v7 backfills the `S.year` calendar-year counter
  (Phase 5 rollover); v7→v8 backfills `S.coachMarket=null` (created at the first offseason) +
  per-team `lastFinances=null` (Phase 6 economy); v8→v9 is a structural no-op (per-player `p.dev`
  offseason growth, Phase 7 — absence reads as "no growth yet"); v9→v10 backfills `S.awards=[]` +
  `S.series=[]` + per-team `homeState` (from `TEAM_STATE`), with `p.honors` optional (Phase 8
  geography/awards/series); v10→v11 backfills `S.seriesOffers=null` (AI-initiated series offers,
  created when managing). Each step re-derives ratings/ranks where needed.
  **Bump `version` + extend `migrateState` on any save-shape change.**
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
  year,                   // calendar-year counter, init 2026, ++ each rollover (Phase 5)
  week, phase,            // 0/"Preseason" → 1..15/"Regular Season" → "Offseason" → (rollover) → Preseason
  lastPlayedWeek,         // last week resolved (for the Scores tab)
  task: { type, label, note },   // weekly opponent card during the season
  schedule: { weeks, games: [ Game, ... ] } | null,   // null until kickoff
  weeklyHonors: [ ... ],         // Player-of-the-Week log (Phase 3.5)
  recruiting: { cycle, points, pool:[ Recruit ], board:[ recruitId ], signed } | null,  // null until kickoff (Phase 4)
  offseasonReport: { year, graduated, tracked, freshmen, departed } | undefined,  // last rollover recap (Phase 5)
  world: { teams: [ Team, ... ] }
}

// Recruit: { id, fn, ln, pos, st, stars, ov, pot, spd,str,awr, scout, prefs:[primary,secondary],
//   iv:{ [teamId]: interest }, committedTo: teamId|null, signed, offered, visited, promise }
//   ov/pot are fogged in the UI by `recScouted(rec)` (band shrinks with `scout`). `iv` keys are
//   the prospect's suitors. A team's class = pool.filter(r=>r.committedTo===id).

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
  preserve the deterministic seed → `genWorld` contract. Saves store the full world, but rosters
  (98% of the bytes) now serialize **columnar** via the Phase 9 storage codec (`encodeState`/
  `decodeState` around `writeSlot`/load), cutting a ~2.3 MB save to ~1.4 MB (vs the ~5 MB/origin
  `localStorage` cap). The codec is pure serialization (no seed dependency), so it's deploy-safe;
  the seed+diff variant was deliberately skipped (couples saves to `genWorld`'s exact code).
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

### Phases 6–9 landed — what used to be stubbed now works
Phases 1–9 are all **DONE**. The former dead ends are live: the **coaching carousel** + **finances
loop** + **facility upgrades** (Phase 6), **side-specific development** + **in-game coach effects** +
**coach-responsive scouting fog** (Phase 7), **AI geography** + **season awards/All-America/Coach of
the Year/Week** + **non-conference series** (Phase 8), and the **columnar save codec** (Phase 9). The
full career loop — recruit → season → awards → rollover (graduate/develop/enroll) → finances settle →
carousel → facilities/series — closes across multiple years. **Six green gates:** `npm run` +
`simlab` / `reclab` / `rolllab` / `econlab` / `awardlab` / `qa`.

### Still intentionally inert (deliberate non-goals, not a backlog)
- Recruiting signees **bank in `S.recruiting.pool`** (each `committedTo` = your team id) during
  the season, then the **rollover converts them to freshman `Player`s** (`recruitToFreshman`).
- Non-controlled games are resolved instantly by `simEngine`; only the controlled team's game
  is watchable (watch-then-commit) or replayable (greatest games). There's no live viewer for
  arbitrary other games — by design, so advancing a week stays fast.
- The recruit board stays **top-300 only** (the 2–3★ tail is approximated by a prestige baseline +
  generated filler freshmen at rollover, never individually modeled).
- The **module/build split** and the **seed+diff** save variant were deliberately skipped (see
  Phase 9) — the columnar codec gets most of the size win deploy-safely.

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

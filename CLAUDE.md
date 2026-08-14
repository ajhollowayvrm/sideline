# SIDELINE — College Football Coach Sim

A mobile-first, single-page head-coach career sim. Pure static HTML/CSS/JS, deployed
via GitHub Pages, all state saved to `localStorage`. No backend, no accounts.

> This file is the **working brief** — what you need loaded every session. The full
> phase-by-phase design records (the "why" behind each system) live in **`docs/phases/`**
> and are read on demand, not auto-loaded:
> - `docs/phases/gameday.md` — sim engine + play-calling (Phases 3, 3.5, 21–31)
> - `docs/phases/recruiting.md` — recruiting, signing, portal, visits (Phases 4, 14, 16, 17, 33–38)
> - `docs/phases/offseason.md` — rollover, program, postseason, draft, championships, camp, realignment (Phases 5, 6–9, 12, 13, 15, 18, 32, 39, 43, 44)
> - `docs/phases/identity-media.md` — traits, morale, media, rivalries, records, contract, legends, identity (Phases 10, 11, 19, 20, 40, 41, 42, 45)
> - `docs/phases/cloud.md` — cloud saves: AWS backend, career codes, sync/conflict model (Phase 47)
> - `docs/phases/possession.md` — the possession model: clock, halves, 4th down, gain shape (Phase 48)
> - `docs/phases/penalties.md` — penalties: the roster-driven foul model, catalog, culprits (Phase 49)
> - `docs/phases/clutch.md` — big moments: pressure, clutch-as-variance, what the data forbids (Phase 50)
> - `docs/phases/attributes.md` — the six-attribute ability model, OVR as a scheme-weighted readout (Phase 51)
> - `docs/phases/attributes-2.md` — position-specific attributes, archetypes, purity (Phase 52)
>
> **Measured reality:** `docs/reference/cfb-averages.md` holds real FBS averages computed from 3,944
> games (2021–2025) — national, by rank matchup, and by mismatch size — plus where `simEngine` sits
> against them. It is the tuning target for any sim work; `tools/cfb-data/` reproduces it.
> `docs/reference/cfb-penalties.md` does the same for **penalties** off the same 3,944 games — rate,
> yardage, type mix, when they're thrown, how much team discipline really varies (and how little it
> decides games), plus where the Phase 49 penalty model lands against it.
> `docs/reference/cfb-clutch.md` covers **big moments** — that one-score records don't repeat
> (r=0.078) so there is no such thing as a clutch team, that late-and-close football genuinely
> tightens, and that kickers measurably do not choke.
>
> **All roadmap phases 1–52 are DONE.** When a task touches a system, open its design doc for
> the detailed rationale, constraints, and validation notes.

---

## Run & deploy

Currently a single self-contained file: `index.html`. To work on it:

- **Local:** open `index.html` in a browser, or run any static server in the repo
  (`python3 -m http.server`) and hit it from your phone on the same network.
- **Deploy:** push to a repo, enable GitHub Pages (Settings → Pages → deploy from branch,
  root). The hosted URL is a stable origin, so `localStorage` saves persist across visits.

**Save data note:** saves are keyed to the origin. The file opened locally, the Pages URL,
and a different host are *separate* save stores. This is expected. **Cloud saves (Phase 47)**
are the way across that line *and* across devices — optional, off until you deploy `infra/`
(one `sam deploy`) and paste the endpoint + a career code into Menu → Cloud saves. With no
endpoint the game is exactly what it was: static, offline, `localStorage` only.

If/when this is split into modules, keep the build output as plain static files so Pages
still serves it with zero config.

---

## Roadmap (all DONE — one line each; deep design in `docs/phases/`)

- **Phase 1 — Shell.** Menu, 3 save slots, new-game wizard, all 134 FBS teams generated, home/team/league pages.
- **Phase 2 — Season.** Deterministic full-league schedule (~12 games over 15 weeks), week-by-week advancement, record-aware live rankings, Season view.
- **Phase 3 — Play-by-play sim.** Pure deterministic drive/play engine (`simEngine`) producing `{hs,as}` + a per-game box score. *(See "Sim engine contract" below + `docs/phases/gameday.md`.)*
- **Phase 3.5 — Watchable game + weekly honors.** Watch-then-commit viewer, greatest-games replay, Player of the Week (national + per-conf). Save v5.
- **Phase 4 — Deep recruiting.** In-season prospect board, weekly points economy, five actions (offer/scout/pitch/visit/promise), AI competition + commits, class grade. Save v6. *(Timing later moved to the offseason — Phase 14.)*
- **Phase 5 — Season rollover & basic development.** Offseason→Preseason transition: graduate, age+develop (ov→pot), enroll signees as freshmen, backfill depth, wipe stats, `S.year++`. Save v7.
- **Phase 6 — Program building (staff & money).** Finances loop (`resolveFinances`), facility upgrades, coaching carousel (`genCoachMarket`/`advanceCoachCarousel`). Save v8. `econlab`.
- **Phase 7 — Development & coach identity depth.** Side-specific development (`devRateFor`), growth surfaced (`p.dev` ▲+N), in-game coach edges (outside `simEngine`), coach-responsive scouting fog. Save v9.
- **Phase 8 — Schedule, geography & awards.** AI geography (`TEAM_STATE`→`homeState`), season awards (pure AWARDS engine), non-conference series (`S.series`). Save v11. `awardlab`.
- **Phase 9 — Tech debt & scale.** Columnar storage codec (`encRoster`/`decRoster`, `encodeState`/`decodeState`) shrinks saves ~40%. *(Seed+diff variant + module split deliberately skipped.)*
- **Phase 10 — Player personality (fogged traits).** Two fogged temperament traits — Motor (dev) + Composure (in-game variance) — read through a scouting fog band, meshing with coach identity. Save v12. `traitlab`.
- **Phase 11 — Program legacy & legends.** Graduated greats become permanent program legends (`team.legends`); pure LEGACY engine scores stature; payoffs = legacy aura + alumni-visit action + legend-coaches. Named position trophies. Save v13. `legacylab`.
- **Phase 12 — Postseason (bowls & playoff).** 12-team CFP + named bowls between the season and offseason; controlled team's games watchable; feeds prestige/recruiting/revenue. Save v14. `postlab`.
- **Phase 13 — NFL draft & position factories.** League-wide 3-round draft of graduates; repeated high picks build a positional `factory` reputation (recruiting pull; rebels repelled). Save v15. `draftlab`.
- **Phase 14 — Recruiting calendar.** In-season commit = a verbal; class signs in the offseason (Early Signing Period + National Signing Day). `S.recruiting.stage`. Save v16.
- **Phase 15 — Conference championships.** Championship Week of title games; reworked `seedPlayoff` for real CFP champion auto-bids + byes. Save v17. `champlab`.
- **Phase 16 — Decommits.** A verbal can flip to a surging rival before Signing Day (in-season flip pass; signed players never flip). Save v18.
- **Phase 17 — Full national recruit board (~3,400).** Whole national class individually modeled (columnar-saved, filtered + paginated); scholarship cap at rollover. Save v19.
- **Phase 18 — Transfer portal (two-way).** Offseason portal after NSD: leavers off every roster, you sign incoming transfers, AI churns. Pure PORTAL engine. Save v20. `portallab`.
- **Phase 19 — Full media suite.** AP poll + news feed (19a), coach approval + hot seat + press conferences (19b), fired → job carousel or retire (19c). Save v21/v22/v23. `medialab`.
- **Phase 20 — Personality reactions (Ego + morale).** Third fogged trait Ego + persistent per-player morale (controlled team), mean-neutral, wired into press/results/dev/spotlight/portal. Save v24.
- **Phase 21 — Schemes.** 7 off × 5 def schemes, doubly-balanced matchup table, roster fit + coach buy-in, all folded outside `simEngine` in `simSides`. Save v25. `schemelab`.
- **Phase 22 — Interactive play-calling.** `opts.decide` hook (seed + decision-log = deterministic); SVG field, call the game snap-by-snap; predictability tax + scheme tendency. Save v26.
- **Phase 23 — Per-matchup resolution.** Plays key off the specific WR-vs-CB / RB-vs-front matchup as a mean-zero deviation (`matchEdge`); coverage box stats. No save bump.
- **Phase 24 — In-game adjustments.** Reassign coverage + settle a player, on a deterministic `g.adjusts` timeline (forward-only, replays on commit). Save v27.
- **Phase 25 — Penalties & discipline.** Per-snap pre-snap fouls from team composure + situation; "calm them down" lever (rides in `g.adjusts`). No save bump. *(Superseded by Phase 49 — the rate model and catalog were rewritten; the calm lever survives.)*
- **Phase 26 — Injuries & fatigue (in-game).** Per-snap injury knockout (backup forced in) + heavy-usage fade; in-game only, no roster mutation. No save bump.
- **Phase 27 — Week-to-week injuries.** Injuries persist (`p.inj` weeks out), lower effective rating, heal weekly; each game freezes availability (`g.out`) for faithful replay. Save v28.
- **Phase 28 — Defensive play-calling.** Call Base/Blitz/Cover/Run-stop on defense (RPS vs run/pass); AI defense is always 'base' (envelope-safe). No save bump.
- **Phase 29 — AI defensive coordinator.** `aiDefCall` schemes vs the controlled offense from down/distance + tendency; inert AI-vs-AI. No save bump.
- **Phase 30 — Adaptive AI offensive coordinator.** AI OC reads your defensive-call tendency and biases run/pass to counter it; inert AI-vs-AI. No save bump.
- **Phase 31 — Special packages.** Offensive Heavy (goal-line power) + Spread (empty 4-wide) packages; player-only. No save bump.
- **Phase 32 — Offseason training camp.** Intensity dial (Light/Standard/Grueling) trading dev boost vs injury + morale; controlled-team-only. Pure CAMP engine. Save v29. `camplab`.
- **Phase 33 — Recruiting rework.** Set-an-intent → resolve-at-week-change; new `fac.scouting` drives the budget; AI recruiting brain (discrete weekly actions). Save v30.
- **Phase 34 — Recruiting legibility.** Weekly board report explaining what moved and why per recruit (pure `recruitReaction`). No save bump.
- **Phase 35 — Week-to-week recruiting depth.** Season ripple, commitment windows, weekly scarcity (double-down / visit cap / diminishing returns), decay-on-neglect. Save v31.
- **Phase 36 — AI recruiting depth + finalist lists.** Recruits narrow to a top-4 shortlist (cut suitors freeze); AI visits + season-record momentum. Save v32.
- **Phase 37 — Recruiting polish.** League-wide game ripple, NIL bidding (money action), season official-visit budget. Save v33.
- **Phase 38 — Official-visit weekend scheduler.** Visits are a home-weekend calendar; pure VISIT engine (`weekendQuality` centered ≈1.0). Save v34. `visitlab`.
- **Phase 39 — Redshirting & eligibility.** Sit a young player (`p.rs`) to bank a year → RS class track at rollover; 4-game rule. Save v35.
- **Phase 40 — Rivalries & trophies.** ~40 named rivalries + game trophies that change hands + emergent rivalries; stakes fold into approval/recruiting/visits/media. Save v36. `rivalrylab`.
- **Phase 41 — All-time record book.** Persistent league-wide record ledger (`S.records`) captured as games/seasons resolve. Pure RECORD engine. Save v37. `recordlab`.
- **Phase 42 — AD expectations & contract.** Preseason mandate + a contract (years/salary/buyout); mandate flows through the existing approval/hot-seat; HC salary is a real cost. Save v38. `contractlab`.
- **Phase 43 — Conference realignment.** Seeded realignment waves poach risers up into the power tier; mutates `team.conf`, everything downstream reads it live. Save v39. `realignlab`.
- **Phase 44 — Career-balance & economy pass.** Softened mandate/hot-seat curve, recruiting/portal autopilot floor, economy sink + prestige drift, carousel upward mobility, DC rng substream. Save v40.
- **Phase 45 — Player identity.** Derived jersey #/nickname/known-for/backstory/fan-favorite + captured signature moments (`p.moments`); identity everywhere (45.1). Save v41. `identitylab`.
- **Phase 46 — In-game screen.** Deeper opt-in play-calling over Phases 22–31: named play concepts + SVG play-art (`PLAYBOOK`), live off/def tendency reads (Play Action punishes a run-committed front), 15-min quarters, halftime, both-way field, play past 0:00, FG any down. AI/defer byte-identical. Save v42. *(→ `docs/phases/gameday.md`.)*
- **Phase 47 — Cloud saves.** Opt-in cross-device continuation: a career mirrors to your own AWS stack (Lambda Function URL → DynamoDB slot index + private S3 blob), identified by a 60-bit **career code** (no accounts). `localStorage` stays the fast path; pushes are debounced behind `writeSlot`, and a genuine two-device divergence shows both saves and asks. Save v43 (structural no-op). `cloudlab`. *(→ `docs/phases/cloud.md`, `infra/README.md`.)*

- **Phase 48 — Possession model.** The first sim change fitted to **measured** reality (`docs/reference/cfb-averages.md`, 3,944 real FBS games) rather than feel. Two 30-minute halves with drives that die at the horn; a real 4th-down brain (`fourthCall` — field position, distance, score, clock); three-tier gain draw (`tierGain` — stuff/normal/explosive, replacing near-uniform gains that converted far too much short yardage); red-zone compression; a per-drive rhythm term that makes drive outcomes bimodal; recalibrated ball security + the strip sack; tunable per-snap clock. Constants live in one fenced `PM` block fitted by `tools/cfb-data/10-fit.js`. **This is the first phase to deliberately change AI-game output** — games carry `g.eng` and pre-v44 games refuse replay rather than re-sim to a score that contradicts the record book. Save v44. **48.1** then replaced the hand-built gain shape with per-distance quantile tables and a play-call mix measured from 258k real rushes / 145k completions (`tools/cfb-data/11-plays.js`), fixing three things the hand model had backwards. *(→ `docs/phases/possession.md`.)*

- **Phase 49 — Penalties, roster-driven.** The Phase 25 penalty model measured badly against real
  football (`docs/reference/cfb-penalties.md`, the same 3,944 games) in every dimension, but the one
  that mattered was **spread**: composure was wired in yet produced a true team-level sd of 0.17
  against reality's 0.95, so discipline was a flat tax nothing you did could change. Rewritten on one
  rule — **the league mean is a constant, the spread is the roster**. A team's rate for a family of
  fouls is the depth-weighted mean foul propensity of the group that actually commits it (your line's
  composure drives your offensive flags, your secondary's your defensive ones), and the culprit is
  drawn from that same pool weighted `propensity^2.4`, fitted to the measured fact that one man
  commits 44.7% of his team's false starts. Propensity keys off **composure alone** — never OVR or
  awareness — because measured discipline is flat across team quality. A 22-foul catalog with
  measured shares and yardages; pre-snap fouls replay the down, live-ball fouls resolve after the
  snap (an offensive one wipes the play, TD included, via a per-play stat journal; a defensive one is
  accepted only when it beats what happened). The invented Q4-frustration multiplier is gone. Fitted
  by `tools/cfb-data/15-penfit.js`; lands at 6.01 flags for 51.5 yards with a true team sd of 0.94.
  Imported rosters now get temperaments (`normPlayer`). Save v45, `SIM_MODEL` 4 — pre-v4 games
  decline replay. *(→ `docs/phases/penalties.md`.)*

- **Phase 50 — Big moments.** Deepens Phase 10's near-invisible clutch term (±1.6 rating pts, the QB
  only) into a graded `pressure(half,secs,diff)` 0..1 — nothing before the 4th quarter, quadratic
  through it, saturated inside 5 minutes, 1 in overtime. The measurement
  (`docs/reference/cfb-clutch.md`) drove the design and mostly said *don't*: one-score win% has a
  year-over-year r of **0.078** against 0.482 for blowouts, so a rating must not decide close games.
  Hence clutch is modelled as **variance, not a bonus** — under pressure the Phase 10 composure
  reshape is amplified, which is mean-preserving by construction, so it changes who makes the play
  without creating clutch teams. A small mean nudge rides on top, drawn from the actual matchup (QB +
  receiver vs the corner, back vs the front) and now including the defense. The measured situational
  tightening applies to both teams (completion −3.4pp, rush −0.93 Y/C, INTs ×1.32 at full pressure);
  yards per *completion* are untouched because real ones don't fall, and **kickers are untouched
  because they measurably don't choke**. Nets out at one-score win% 50.1% ±1.0 between realistic
  composure extremes — and turning the phase OFF makes close games *more* rating-determined, not
  less. `p.gs.cl` surfaces as "In the clutch". Save v46, `SIM_MODEL` 5. *(→ `docs/phases/clutch.md`.)*

- **Phase 51 — Attributes become the ability model.** `p.ov` used to *be* the ability model, while
  `spd`/`str`/`awr` sat on every player as the headline display numbers and were **read by no formula
  anywhere**. Inverted: six attributes (speed, agility, strength, awareness, ball skills, durability)
  are the truth, and **Overall is a derived readout of them weighted by the SYSTEM the player is in** —
  `ovrBase` (scheme-agnostic, the cross-team currency for stars/draft/records) vs `ovrIn` (stored on
  `p.ov`, what the roster and sim see). Installing a scheme genuinely re-rates the roster: two corners
  who read 78/79 in the abstract swing to 75/84 in a Bear front and 80/75 in Tampa-2. The rule is the
  house one from Phases 10/21/23/50 — **attributes redistribute ability, they never add it** — enforced
  at two levels (a profile is its owner's ability plus a weighted-mean-zero tilt; every sim channel is a
  deviation from its pool's mean), because there is **no measurement to fit attribute effects against**.
  Each channel targets a part of a play that had no per-matchup term before, so nothing double-counts
  the `matchEdge` that `ov` already carries: speed owns the gain **tail** (never the mean) plus an
  asymmetric one-on-one clause; strength owns the **floor** and pass protection — **the offensive line
  previously affected no run or pass outcome at all**; awareness owns mistakes only and blunts the
  Phase 46 concept bonuses; ball skills the catch point; durability injury and fatigue. Kickers and
  punters finally enter the sim (range = leg, accuracy = technique, not pressure-sensitive because
  kickers measurably don't choke). Penalties stay composure-only by design. Phase 21's roster-fit term
  was **retired from `schemeDelta`** (now double-counted by `ovrIn`); `playerSchemeIdx` survives as
  *preference*, not aptitude. Six inconsistent generation sites collapsed into one honest path — which
  fixed deep backups carrying a speed rating 26 points above their overall, blue-chips arriving rated
  below their own attributes, and imported rosters having no spread at all. Also (directive 2)
  potential now lifts an NFL board grade and a recruit's *services* ranking (`svc`, deliberately
  separate from `stars`, which drives mechanics). Save v47, `SIM_MODEL` 6 — pre-v6 games decline
  replay; the migration is a **real mutation** of ~11.3k players, each keeping the `ov` he had.
  *(→ `docs/phases/attributes.md`, incl. the measured post-phase drift and what the tuning pass owns.)*

- **Phase 52 — Position-specific attributes (steps 2–3a).** Six generic attributes could not express
  what the directive asked for: a tackle who pass-sets against speed rushers and a guard who anchors
  against bull rushers were both "strength". Now **25 attributes, ~12 carried per position**, with
  `POS_ATTR_W` the single source of truth for *both* the weighting and **which attributes a player even
  has**. `S` splits into real **FS/SS** codes. **71 archetypes** across 15 positions — named shapes,
  auto-balanced to weighted mean zero under their own row, so picking one changes *what* a player is
  and never *how good* — plus **purity**, a per-player multiplier that makes variation run ALONG the
  archetype axis rather than orthogonal to it (a 0.4 merely leans pocket-passer; a 1.4 is an immobile
  savant). Technique generates **correlated** with its athletic basis, and physical attributes resist
  an upward correction, so an elite player's holes fill in on the coachable side — Brady never got
  fast. **Every one of the 25 reaches a play**: separation is `rte` vs `mcv`/`zcv`, the pocket `pbk` vs
  `prs`, the pile `btk` vs `tkl` plus `rbk` vs `rst`, ball security `car`, the catch point `cth`, and
  kickers finally have `kpw`/`kac` instead of borrowing str/awr. Two new contest forms carry that:
  `ADX` (per-matchup, cross-attribute — each half is still a deviation from its own pool, so mean-zero
  survives) and `AUX` (unit-vs-unit, cross-attribute — the naive form would carry the league-wide level
  difference between two *different* stats as a constant, so it subtracts the mirror contest and comes
  out mean-zero **within every game**). Attributes move into a packed per-position array `p.at` (codec
  `_sv:2`) rather than 13 mostly-null columns. Save **v48** — a real mutation of every player, each
  keeping the `ov` he had; `SIM_MODEL` 7, so pre-Phase-52 games decline replay. **The envelope holds**:
  22.6→22.8 pts/team, margin 20.9→20.6, Y/C 5.20→5.24, sacks 1.96→1.93 — all within ~1–2% of Phase 51,
  which is the checkpoint the phase doc demands of this step. Excess kurtosis **−0.154 → +0.037**: the
  archetype mixture bought a fatter tail with nothing fitted, ~40% of the way to the measured +0.319.
  Still open: the architectural inversion (compounding contests, calibration to the 8-bucket curve, the
  new gates) — steps 3b–5. *(→ `docs/phases/attributes-2.md`; `tools/schemesim.js` for what a scheme is
  worth now.)*

  **One trap worth remembering.** `tilt()` — "how much of a specialist is he", used for the singletons
  with no pool to deviate from — measured a player against the flat mean of his own attributes. That is
  genuinely mean-zero under six generic attributes and is **not** under anchored position rows, where a
  quarterback's `tha` carries 20% of his row and sits above his own average by construction. Left
  uncorrected it halved the interception rate (0.92 → 0.47) and cut sacks 27% before anything else was
  wrong. `attrTiltBase(pos,k)` is the correction, and it is a **function** rather than a const table
  because the node labs extract engine blocks with a sloppy-mode eval that leaks function declarations
  but not block-scoped consts.

**Deliberate non-goals** (out of scope unless revisited): no live viewer for *arbitrary*
games (only the controlled team's game is watchable/replayable/coachable, so advancing a week
stays fast). This is a design choice, not a backlog. Per-doc "Deliberately out of scope"
notes in `docs/phases/` capture the finer-grained non-goals of each system.

---

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
  (Raw/Developing/Polished/Maxed).
- **Coaches:** two sections. **Coordinators** (OC/DC/STC) are fixed slots — one per side,
  always filled. **Additional Coaches** are position coaches; each carries a small OVR
  *boost* to its position group that is applied live to `ratings` (see Team object).

---

## Coach identity design

**Archetype** = *how you coach* (one of):
Recruiter · Offensive Genius · Defensive Genius · Motivator · Manager.

**History** = *where you came from* (one of). Stacks with archetype; each carries a starting
prestige, a recruiting-network profile, and modifiers:

| History | Effect |
|---|---|
| Former Player | High player respect/motivation; pull with athletes. |
| Coordinator | Deeper starting playbook; better game-planning. |
| Lifer | Cheaper, loyal staff; weak early reputation. |
| NFL Transplant | Big early prestige/job security; thin college recruiting network. |
| High School Legend | Strong home-state recruiting ties; raw-talent development. |
| Analyst | Sharper scouting + in-game reads; weaker recruiting relationships. |

These are wired into the systems they touch (recruiting, development, in-game edges,
staff/carousel) — see the relevant `docs/phases/` records.

---

## Architecture

Globals (classic script, no bundler yet). Key pieces in `index.html`:

- `rng(seed)` — seeded mulberry32. **World generation is deterministic from a seed.**
- `genWorld(seed)` → `{ teams: [...] }`. Builds every team: prestige, roster, ratings,
  facilities, finances, staff, then assigns `natRank` / `confRank` / `divRank`.
- `recomputeRanks(world)` — re-sorts ranks after edits/imports.
- Save system: `readSlot`/`writeSlot`/`deleteSlot`, keys `sideline_slot_1..3`.
  Each slot stores `{ meta, state }`; `meta` powers the load screen.
- **Cloud sync (Phase 47)** hangs off that same seam: `writeSlot` queues a debounced push
  (`cloudQueue` → `cloudFlush`), never blocking the local write. Config lives in its own key
  `sideline_cloud` (`{endpoint, code, auto, device, careers:{careerId:{rev,savedAt}}}`) — a
  career's cloud id is *derived* (`cloudCareerId` = createdAt+seed), so nothing about sync is
  stored inside `state`. The pure decision (`cloudResolve`) is fenced as the CLOUD ENGINE and
  gated by `cloudlab`; the backend is `infra/` (SAM). See `docs/phases/cloud.md`.
- `migrateState(state)` runs on load and upgrades old saves to the current `version`
  (currently **47**). Each step backfills the fields its phase added and re-derives
  ratings/ranks where needed; most recent steps are structural no-ops (sparse per-player
  fields / derived data read as their defaults) — **v47 is the exception**: it genuinely mutates
  every player, deriving a six-attribute profile re-centred onto the `ov` he already had. The full
  v1→v47 migration ladder is
  documented inline in `migrateState` in `index.html`, and each phase's design doc in
  `docs/phases/` records its save-shape change. **Bump `version` + extend `migrateState`
  on any save-shape change.**
- **Season engine** (`genSchedule`/`startSeason`/`simGame`/`advanceWeek`): `genSchedule(world,seed)`
  picks ~12 conference-weighted matchups per team then greedy edge-colors them into
  `SEASON_WEEKS` (15). `simGame` is seeded per game id (`rng(hashStr(id)^seed)`) so a result
  is reproducible regardless of advance order. `rankScore(t)` blends OVR with record + point
  margin; `recomputeRanks` sorts by it.
- `teamRatings(roster, staff)` derives `{off,def,ovr}`; `staffBoosts(staff)` maps each
  position code to the OVR points its coaches confer (applied inside `teamRatings`).
- `S` — live game state. `UI` — current view/tab/wizard state. `render()` swaps `#app`.
- `applyAccent(team)` — sets `--accent` to the controlled team's color (the signature).

### State shape (`S`)
```
{
  version, seed, createdAt, lastSaved,
  coach: { first, last, homeState, archetype, history, offScheme, defScheme, approval, tenure, approvalHistory:[…], career:[…], contract:{years,yearsLeft,salary}, mandate:{tier,kind,wins?,label,...}, extensionOffer, lastMandate, jobOffers },  // off/defScheme = the schemes the coach loves (Phase 21, buy-in target); approval+hot-seat persist across seasons (Phase 19b); career = per-stop résumé (Phase 19c); contract/mandate/extensionOffer = AD expectations & the deal (Phase 42); jobOffers = poach-up offers (Phase 44)
  teamId,                 // id of the controlled team
  year,                   // calendar-year counter, init 2026, ++ each rollover (Phase 5)
  week, phase,            // Preseason → 1..15/"Regular Season" → "Conference Championships" (Phase 15) → "Postseason" (bowls+playoff) → "Offseason" (Signing Day → transfer portal) → (rollover) → Preseason; "Retired" ends the career (Phase 19c)
  coachSearch,            // { firedFrom, firedFromName, openings:[teamId], year } | null — the coaching search shown when fired (Phase 19c)
  champWeek,              // { year, games:[Game kind:'champ'], done, meDone } | null — Championship Week, created after the regular season, nulled into the postseason (Phase 15)
  portal,                 // { year, pool:[Transfer], points, stage:'open'|'closed', departures, arrivals } | null — offseason transfer portal (Phase 18); created after Signing Day, nulled at rollover
  media,                  // { poll:{week, top:[{teamId,rank,prev,pts}], others}, feed:[Story] } | null — AP poll + news feed (Phase 19); created at kickoff, nulled at rollover
  postseason,             // { year, round, playoff:{seeds[12], rounds:[[Game]], champion}, bowls:[Game], meDone } | null (Phase 12)
  draft,                  // { year, picks:[{pick,round,grade,pid,name,pos,teamId,abbr,color}] } | null — last NFL draft class (Phase 13)
  rivalries,              // [ Rivalry ] — established rivalries incl. their trophy holder + series (Phase 40); created at new game, persist across seasons
  rivalryHeat,            // { pairKey: number } — not-yet-born pairs' accumulating heat (Phase 40); crosses RIVALRY_BORN → a new rivalry is christened
  records,                // { game, season, career, team: {recordKey: {value, name, pos?, teamId, abbr, color, year, detail}} } — all-time record book (Phase 41); captured as games/seasons resolve, persists across seasons
  lastRealign,            // { year, moves:[{abbr,name,color,from,to,mine}] } | null — the last conference-realignment wave (Phase 43); team.conf is mutated in place, this is just the recap record
  lastPlayedWeek,         // last week resolved (for the Scores tab)
  task: { type, label, note },   // weekly opponent card during the season
  schedule: { weeks, games: [ Game, ... ] } | null,   // null until kickoff
  weeklyHonors: [ ... ],         // Player-of-the-Week log (Phase 3.5)
  recruiting: { cycle, points, pool:[ Recruit ], board:[ recruitId ], signed, stage, intents, doubles, visitsLeft, visitPlan, report } | null,  // null until kickoff (Phase 4); stage: open→national→closed (Phase 14); intents = {recruitId:[{action,...,cost,label,isDouble?,nilSpend?}]} = this week's QUEUED actions (≤2/recruit; a 'nil' action pays nilSpend $ from budget — Phase 37), resolved at the week change (Phase 33/35); doubles = weekly double-down tokens (Phase 35); visitsLeft = season official-visit budget (Phase 37); visitPlan = {week:[recruitId]} = recruits booked onto home-game weekends (Phase 38); report = {week, reactions:[…], note} = last week's board report, transient (Phase 34/35)
  offseasonReport: { year, graduated, tracked, freshmen, departed } | undefined,  // last rollover recap (Phase 5)
  world: { teams: [ Team, ... ] }
}

// Recruit: { id, fn, ln, pos, st, stars, svc, ov, pot, spd,agi,str,awr,bal,dur, mot,comp, rebel, scout, prefs:[primary,secondary],
//   svc = the recruiting SERVICES' star ranking (Phase 51) — over-rates a big ceiling by a tier and is
//   what the board displays via `recStars()`; `stars` stays the true tier that drives mechanics.
//   iv:{ [teamId]: interest }, committedTo: teamId|null, signed, offered, visited, promise, alumni?, decideWeek?, hits?, finalists?, _flipped? }
//   decideWeek = a blue-chip's announced commitment week — he commits to the leader then (Phase 35 window).
//   hits = {action:count} of the player's repeated actions on him (Phase 35 diminishing returns).
//   finalists = [teamId] shortlist once he matures — only finalists can win/flip him (Phase 36). All sparse.
//   alumni = id of the legend who already made an alumni visit (Phase 11; one per recruit, no stacking).
//   rebel = wants to be THE guy; repelled by a program that's a factory at his position (Phase 13).
//   committedTo set + signed=false = a VERBAL (flippable until Signing Day); _flipped={from,to} is a
//   transient per-week tag set when a verbal decommits to a rival (Phase 16; recomputed each week).
//   ov/pot are fogged in the UI by `recScouted(rec)` (band shrinks with `scout`). `iv` keys are
//   the prospect's suitors. A team's class = pool.filter(r=>r.committedTo===id).

// Transfer (S.portal.pool, Phase 18): a real Player snapshot (keeps yr/age/ov — NOT reset to a freshman)
//   + { fromTeam: teamId, iv:{ [teamId]: interest }, committedTo: teamId|null }. On closePortal the
//   committed transfer is stripped of those portal fields and pushed onto his new team's roster with
//   `fromTransfer:true`. Unsigned transfers leave the modeled league.

// Game: { id, week, home: teamId, away: teamId, played, hs, as, calls?, adjusts?, out?, rivalry?, series? }   // hs/as = home/away score
//   out? = ids that sat (injured) at kickoff, frozen so a past game replays faithfully (Phase 27).
//   calls? = the coach's ordered play calls if he coached it (Phase 22); adjusts? = his in-game
//   adjustment timeline [{at:playNo, plan:{shadow,boost}}] (Phase 24, coverage reassignment + pep-talks).
//   Both replay on commit/replay (simGame/buildGameLog via gameDecideOpts) so watch == commit. Absent = a pure AI game.
//   rivalry? = a locked cross-conf rivalry leg (Phase 40); series? = a booked non-conf series leg (Phase 8).

// Rivalry (S.rivalries, Phase 40): { a, b: teamId, name, trophy, preset:bool, intensity, holder: teamId|null,
//   aw, bw, streakTeam, streak, born: year|null, last:{year,winner,ws,ls} }. holder = who currently holds the
//   trophy (last winner); aw/bw = the series record (a's wins / b's wins); preset false = an emergent rivalry
//   BORN when S.rivalryHeat[pairKey] crossed RIVALRY_BORN. See the RIVALRY ENGINE block.
```

### Team object
```
{
  id, name, nick, abbr, conf, div, color, prestige,
  offScheme, defScheme,                // the schemes the team runs (Phase 21); mutable — installed at takeover / from Program. Folded into simSides (matchup edge + roster fit + coach buy-in), never into the pure simEngine.
  roster: [Player],
  ratings: { off, def, ovr },          // derived from roster + staff boosts
  fac: { stadium, strength, training, academics, nil, scouting },  // 1..10 (scouting drives recruiting points/AI budget — Phase 33)
  revenue, budget, payroll, facilityDebt,
  staff: [ { role, title, name, rating, salary, years,
             tier, scope, groups, boost } ],
  //   tier: "coord" (OC/DC/STC, side-wide) | "pos" (position coach, group)
  //   groups: [posCode,...] the coach buffs;  boost: OVR pts added to each (coord 0-2, pos 0-3)
  //   scope: display label ("OFF"/"DEF"/"ST" for coords, role code for position coaches)
  natRank, confRank, divRank,
  rec: { w, l, cw, cl, pf, pa, streak },  // season record (overall + conference); set at kickoff
  needs: { [posCode]: true },          // positions flagged for recruiting
  legends: [ Legend ],                 // Ring of Honor (Phase 11); enshrined at rollover, capped at 12
  factory: { [posCode]: rep },         // NFL "factory" reputation by position (Phase 13); built from draft picks, decays yearly
  titles: [year],                      // national-championship years (Phase 12)
  confTitles: [year],                  // conference-championship years (Phase 15)
  postseasonBoost, lastPostseason, _pp // postseason recruiting/revenue/prestige payoff carriers (Phase 12)
}
//   Legend: { id, name, pos, st, from, to, peakOv, honors:[{year,award}], career:{…}, stature, tier, app }
//     a lean snapshot of a graduated great (no Player object); app = alumni-visit appearances left
//     this season (reset to LEGEND_APPS at kickoff). Sorted by stature; see the LEGACY ENGINE block.
```

### Player object (kept lean for storage)
```
{ id, fn, ln, pos, yr, age, st, stars, ov, pot, cap, spd, agi, str, awr, bal, dur, so,
  mot?, comp?, ego?, morale?, inj?, rs?, gs?, dev?, honors?, career?, peakOv?, moments? }   // trailing fields are sparse (absent = default)
//   rs = redshirt status (Phase 39; 'on' = redshirting this season → held out of games; 'used' = already
//        redshirted. At rollover a sat 'on' designee advances onto the RS class track, preserving a year.)
//   inj = weeks out injured (Phase 27; absent/0 = healthy; set by the app after a game, healed weekly + at rollover)
//   so = depth order within position (0 = starter); cap = captain
//   spd/agi/str/awr/bal/dur = THE ABILITY MODEL (Phase 51). `ov` is a DERIVED readout of these,
//   weighted by position AND the scheme the player's team runs — `ovrIn` is what's stored on p.ov
//   and what the sim/roster see; `ovrBase` is the scheme-agnostic value used for anything comparing
//   players across programs (stars, draft grade, records, peakOv). Never write to `p.ov` to make a
//   player better — re-centre his profile (`centerAttrs`) and let the readout follow.
//   pot = TRUE ceiling (0..99). The UI never shows it raw — `scoutedCeiling(p)` renders a
//   fuzzy tier/band whose uncertainty shrinks with scouting confidence. `devStage(p)` buckets the ov→pot gap.
//   mot/comp/ego = fogged temperament traits (Phase 10 + Ego, Phase 20); morale = persistent per-player
//   locker-room mood (Phase 20, controlled team only, in-season; absent = neutral 50); gs = season box;
//   dev = last offseason OVR gain; moments = signature single games (Phase 45, controlled team only).
//   career = cumulative milestone totals + peakOv = max OVR ever (Phase 11; summed/updated at rollover
//   right before gs is wiped, for EVERY player on EVERY team — they feed legendStature on graduation).
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
          "spd": 80, "agi": 78, "str": 70, "awr": 86, "bal": 82, "dur": 74, "captain": true }
      ]
    }
  ]
}
```

The "Download blank roster template" button in the wizard emits this exact shape.

All six attributes are **optional**. Supply any subset and the rest are generated deterministically
from the player's identity; supply none and he gets a full generated profile (rather than the old
flat `spd=str=awr=overall`, which left imported leagues with no spread for the sim to read). Whatever
you supply is **re-centred** so its weighted mean equals the `overall` you gave — a file handing us
all-90s attributes on a 75-overall player doesn't collect the difference for free. Omit `overall` and
it defaults to 60, so give it if you want the level to be yours.

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
  (98% of the bytes) serialize **columnar** via the Phase 9 storage codec (`encodeState`/
  `decodeState` around `writeSlot`/load), cutting a ~2.3 MB save to ~1.4 MB (vs the ~5 MB/origin
  `localStorage` cap). The codec is pure serialization (no seed dependency), so it's deploy-safe.
- After any roster/ratings/staff edit, call `teamRatings(roster, staff)` then
  `recomputeRanks(S.world)` (staff boosts feed into the rating, so pass the team's staff).
- `autosave()` writes to the slot matching `S.createdAt`; explicit "Save game" is in the
  bottom-nav Menu sheet.
- Conference alignment + team colors are best-read as of early 2026 and may have minor
  errors; they're editable via import or the built-in `TEAMS` array.
- **Pure engines are fenced** with `// === X ENGINE (Phase N) START/END ===` markers and
  extracted by their node labs (single source of truth). Effects that depend on `S` or the
  controlled team (coach edges, schemes, morale, adjustments) are applied **outside** the pure
  `simEngine`, in `simSides` — this keeps the SIM block byte-identical so determinism + the
  scoring envelope hold. Never fold an S-dependent effect into `simEngine`.

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

### Gates (all must be green each phase)
**Twenty-three green gates** via `npm run <name>`: `simlab` · `reclab` · `rolllab` · `econlab` ·
`awardlab` · `traitlab` · `schemelab` · `legacylab` · `postlab` · `draftlab` · `champlab` ·
`portallab` · `medialab` · `camplab` · `visitlab` · `rivalrylab` · `recordlab` · `contractlab` ·
`realignlab` · `identitylab` · `cloudlab` · `lambdalab` · `qa`. Each pure engine has an offline node lab
that extracts the fenced block from `index.html`; `qa` is the in-browser end-to-end. `lambdalab` is the
odd one out — it runs the cloud backend (`infra/lambda/index.mjs`, the only code that doesn't run in the
browser) against in-memory DynamoDB/S3 stubs. Add per-phase checks to the relevant lab + `qa` on any
change; bump the save `version` + `migrateState` on any save-shape change.

### Still intentionally inert (deliberate non-goals, not a backlog)
- Non-controlled games are resolved instantly by `simEngine`; only the controlled team's game
  is watchable (watch-then-commit), replayable (greatest games), or coachable — by design, so
  advancing a week stays fast.
- The **module/build split** and the **seed+diff** save variant were deliberately skipped
  (see `docs/phases/offseason.md`, Phase 9) — the columnar codec gets most of the size win safely.

---

## Sim engine contract (Phase 3 — load-bearing; full design in `docs/phases/gameday.md`)

The sim is `simEngine(home, away, seed)` in `index.html`, fenced by
`// === SIM ENGINE (Phase 3) START/END ===`. It is **pure and deterministic**: it never
mutates its inputs and re-running with the same seed reproduces both the score and the full
box. That purity is load-bearing — the QA gate re-sims a played game to assert determinism,
`simGame` re-derives results regardless of advance order, and the interactive play-calling
(Phase 22) rests on **seed + decision-log = deterministic**.

**Contract with the season layer:** `simGame(g)` seeds the engine per game id
(`rng(hashStr(g.id) ^ seed)`), sets `g.hs/g.as/g.played`, and **returns the per-game box**.
`advanceWeek` does `applyResult(g, simGame(g))`; `applyResult` updates `t.rec` **and** folds
the box into per-player season stats (`p.gs`). Re-simming a clone (the determinism test) never
calls `applyResult`, so stats are never double-counted.

**Per-player stats.** The box maps `playerId → { gp, pAtt,pCmp,pYds,pTD,pInt, rAtt,rYds,rTD,
rec,reYds,reTD, tkl,sk,dInt, cvTgt,cvCmp,cvYds,cvTD, fga,fgm,xpa,xpm }` (only nonzero keys;
`cv*` = coverage charged to the matched defender, Phase 23). Season totals live on the Player
object as `p.gs`, accumulated for **every** team, so league stat leaders are real. Empty stat
objects aren't stored.

**Validated envelope** (`test/simlab.js`, extracts the engine between the markers): points/team,
score spread, home-win and favorite-win rates, no ties, the Phase 48 possession checks (two halves,
drives dying at the horn, 4th-down decisions, gain-tier shape), and the Phase 49 penalty checks
(rate, yardage, side/pre-snap splits, culprit attribution, and that rating does NOT buy discipline),
and the Phase 50 clutch checks (pressure shape, a mean-preserving amplified reshape, kickers not
choking, and that composure does NOT decide one-score games). The envelope asserts
*ranges*; the numbers it should be centred on are the measured ones in
`docs/reference/cfb-averages.md` — **check a sim change against that file, not just against the
gate**, since totals-and-leaders assertions passed for nine phases while run/pass balance and drive
structure were badly wrong (the errors cancelled in the totals). All S-dependent
in-game effects (coach edges, schemes, morale, matchups, adjustments, penalties, injuries,
play-calling, AI coordinators) are applied in `simSides`/the app layer **outside** this block so
the envelope holds — see `docs/phases/gameday.md` for how each layers on.

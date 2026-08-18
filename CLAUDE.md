# SIDELINE — College Football Coach Sim

A mobile-first, single-page head-coach career sim. Pure static HTML/CSS/JS, all state saved to
`localStorage`. No backend, no accounts. It **ships as a native iOS app** — a WKWebView shell around
the same `index.html`, installed straight onto a paired iPhone with `npm run ios:deploy`. There is no
web deploy, no PWA and no CI; the browser is a development and test target only.

> This file is the **working brief** — what you need loaded every session. The full
> phase-by-phase design records (the "why" behind each system) live in **`docs/phases/`**
> and are read on demand, not auto-loaded:
> - `docs/phases/gameday.md` — sim engine + play-calling + the watch screen + the sideline (Phases 3, 3.5, 21–31, 46, 55, 55.1, 55.2, 63, 64)
> - `docs/phases/recruiting.md` — recruiting, signing, portal, visits, and the measured talent economy (Phases 4, 14, 16, 17, 33–38, 56, 57a, 57b, 58, 59, 60, 62, 63)
> - `docs/phases/offseason.md` — rollover, program, postseason, draft, championships, camp, realignment (Phases 5, 6–9, 12, 13, 15, 18, 32, 39, 43, 44)
> - `docs/phases/identity-media.md` — traits, morale, media, rivalries, records, contract, legends, identity (Phases 10, 11, 19, 20, 40, 41, 42, 45)
> - `docs/phases/cloud.md` — cloud saves: AWS backend, career codes, sync/conflict model (Phase 47)
> - `docs/phases/possession.md` — the possession model: clock, halves, 4th down, gain shape (Phase 48)
> - `docs/phases/penalties.md` — penalties: the roster-driven foul model, catalog, culprits (Phase 49)
> - `docs/phases/clutch.md` — big moments: pressure, clutch-as-variance, what the data forbids (Phase 50)
> - `docs/phases/attributes.md` — the six-attribute ability model, OVR as a scheme-weighted readout (Phase 51)
> - `docs/phases/attributes-2.md` — position-specific attributes, archetypes, purity (Phase 52)
> - `docs/phases/contests.md` — play resolution as sequential contests (Phase 53)
> - `docs/phases/calibration.md` — the scoring aggregate decomposed and fitted (Phase 54)
> - `docs/phases/ios.md` — the native iOS shell, session resume, embedded fonts, and what the first
>   real playthrough found (Phases 61, 61.1, 61.2, 62)
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
> `docs/reference/cfb-recruiting.md` is the fourth sheet and the newest — **45,735 prospects across
> 11 signing classes (2015–2025)** from the CollegeFootballData API: supply, where the blue-chips
> actually go by program tier, class-size flatness, persistence (r=0.882), and geography. It is the
> tuning target for the Phase 57 talent economy, and its "where the model sits" section records the
> band-pass and saturation defects Phase 56 measured. Reproduce with `tools/cfb-data/20–23`
> (needs a free `CFBD_API_KEY`).
>
> **All roadmap phases 1–64 are DONE.** When a task touches a system, open its design doc for
> the detailed rationale, constraints, and validation notes.

---

## Run & deploy

Currently a single self-contained file: `index.html`. To work on it:

- **Local:** open `index.html` in a browser, or run any static server in the repo
  (`python3 -m http.server`) and hit it from your phone on the same network.
- **Ship (the only channel):** `npm run ios:deploy` — builds a signed **Release**, installs it on
  the paired iPhone, launches it. `ios/` is a native WKWebView shell around this same file (XcodeGen
  spec + one Swift file, no npm, no CocoaPods). Team ID + device UDID live in `ios/device.env`,
  which is gitignored; copy `ios/device.env.example`. **Unlock the phone before the launch step** —
  installing works while locked, launching does not. See `ios/README.md`.
  - Release carries **no `DevBridge`** (it is fenced `#if DEBUG`), so nothing can drive the build on
    the phone. Scripted driving is simulator-only. That is the trade and it is deliberate.
  - There is **no GitHub Pages deploy, no PWA and no CI.** The browser still has to work — `qa`
    drives `index.html` in headless Chromium and three of its checks exist to keep the shell from
    ever becoming a dependency of the page — but nobody plays it there.

**Save data note:** saves are keyed to the origin. The file opened locally, a static server, and the
app's `sideline://` scheme are *separate* save stores. This is expected. **Cloud saves (Phase 47)**
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
- **Phase 44 — Career-balance & economy pass.** Softened mandate/hot-seat curve, recruiting/portal autopilot floor, economy sink + prestige drift, carousel upward mobility, DC rng substream. Save v40. *(Both autopilots are gone: Phase 60 replaced the recruiting one with standing orders, Phase 62 gated the portal one on recruiting staff.)*
- **Phase 45 — Player identity.** Derived jersey #/nickname/known-for/backstory/fan-favorite + captured signature moments (`p.moments`); identity everywhere (45.1). Save v41. `identitylab`.
- **Phase 46 — In-game screen.** Deeper opt-in play-calling over Phases 22–31: named play concepts + SVG play-art (`PLAYBOOK`), live off/def tendency reads (Play Action punishes a run-committed front), 15-min quarters, halftime, both-way field, play past 0:00, FG any down. AI/defer byte-identical. Save v42. *(→ `docs/phases/gameday.md`.)*
- **Phase 47 — Cloud saves.** Opt-in cross-device continuation: a career mirrors to your own AWS stack (Lambda Function URL → DynamoDB slot index + private S3 blob), identified by a 60-bit **career code** (no accounts). `localStorage` stays the fast path; pushes are debounced behind `writeSlot`, and a genuine two-device divergence shows both saves and asks. Setup is a **real login form** — endpoint and code in one `<form>` as `autocomplete="username"` / `"current-password"`, connected by a real submit event — so iOS/Safari offers Save Password and autofills both halves on the next device; the career code is the one secret in the game that cannot be recovered, so the keychain has to be able to hold it. Save v43 (structural no-op). `cloudlab`. *(→ `docs/phases/cloud.md`, `infra/README.md`.)*

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

- **Phase 53 — play resolution as sequential contests.** Step 3b of `attributes-2.md`: the
  architectural inversion. A dropback is now protection → **pressure, a real per-snap STATE** → escape
  (sack / scramble / throw on the run) → separation as ONE quantity in rating points → completion
  composed in **log-odds** → yardage drawn from Phase 48.1's measured table *at a percentile the
  contest bought* (`regime`). The run is §7's sequence — push, crease, break — with push and break on
  the FLOOR and speed on the TAIL, per §9a. Turnovers read the pocket (a pressured throw is picked far
  more often) and gain the **fumble after the catch**, a real category the sim did not have. Three §7
  items that had never been wired: awareness in the push, awareness as blitz pickup, and the
  DEFENDER's `awr`/`tkl` against the crease. **`PM.advPass`/`advRun` are retired** — team strength no
  longer adds yards to every snap, it moves the contests, which is the phase in one line. Play-calling
  finally reads the **scoreboard**. Save v48 unchanged (no shape change); `SIM_MODEL` **8**, so
  pre-Phase-53 games decline replay. *(→ `docs/phases/contests.md`.)*

  **What it measured** (16,080 games): the mismatch RESPONSE largely arrived — a 31-point spread now
  answers 48.0 favourite points against a real 50.1, where Phase 52 answered 55.5, and favourite win
  rate tracks `cfb-averages.md` §3 almost bucket for bucket. Turnovers, interceptions, fumbles, sacks
  and rush attempts all land. What did NOT move is the **tail** (excess kurtosis −0.005 → +0.062
  ±0.039 against a target +0.319), and §1's prediction that compounding contests would fix it is
  **measured wrong**. Per-play variance shaping provably cannot: a mixture needs a variance RATIO near
  2 and per-play shaping moves one component ±20%, worth ~0.02 — swept across a 5× range it did
  nothing. Persistent per-game properties do buy tail, but every one available is a unit contest
  correlated with team quality, so it buys margin at the same time. The one lever that is persistent
  AND orthogonal to quality is **game-state feedback**, which is where step 4 should look.

  **It also had to fix its own instruments first.** Excess kurtosis was being read at ±0.11 — one
  sigma, the size of the effects in question — so `WORLDS=n` now pools independent leagues and the SE
  is printed. Y/C was compared gross-against-net; sacks were order-corrupted; the end-of-half drive had
  no bucket. **This revises two claims in `attributes-2.md`**: §12's "the tail moved ~40% of the way"
  is ~1.2 sigma and Phase 52 actually measures −0.005, and §11's "Y/C +22%, the largest remaining
  per-play error" was mostly the gross/net bug (true: +8%). And **simlab's synthetic world still had
  no FS/SS**, so the primary sim gate was validating a league whose safeties carried a linebacker's
  attribute row and appeared in no coverage or tackle pool.

- **Phase 54 — calibration (step 4).** The scoring aggregate, decomposed rather than guessed at:
  real football scores 26.9 a team against 25.1 of offensive TDs and field goals, so **~1.8 points a
  game is NON-OFFENSIVE and the sim scored 0.06 of it** — 43% of the whole shortfall, and a missing
  category rather than a mis-calibration. Pick-sixes, fumble returns and punt returns now exist (`keep`
  stops the drive loop swapping possession, because a scoring defence kicks off). Yardage is **capped
  at the goal line** — the engine credited the raw draw, so a 20-yard run from the opponent's 5 booked
  20 rushing yards. The clock is re-anchored (Phase 53's scramble and step 4's gambles changed how much
  a possession burns). Fourth down is a real decision: a flat 24% "coach loses his nerve" roll fired as
  often on 4th-and-inches as on 4th-and-15, and is distance-aware now. Save v48 and `SIM_MODEL` 8 both
  unchanged. *(→ `docs/phases/calibration.md`.)*

  **Landed**: points 22.8 → **25.5** (real 26.9), plays 67.9 (67.5), total yards 381 (383), yards/play
  5.62 (5.67), Y/C 4.53 (4.27), sacks 2.07 (2.06), turnovers 1.44 (1.38), red-zone TD% 69.8 (67.5),
  drive start 30.1 (29.8). **Did not land**: the margin, and the tail (+0.064 against +0.319).

  **Half the margin MISS is the harness.** The synthetic slate carries 30.4% of games at a 17.5+ spread
  against a real 18.1%, because opponents are drawn by wrapping through a prestige-ordered list and the
  weakest teams get the strongest. `5-compare` now prints aggregates re-weighted to the real bucket mix
  — margin **19.2** standardized against a raw 21.7 — and that is the number `attributes-2.md` §11
  target 2 should be read against. What is left of it is the UNDERDOG, which scores 2–3 points too few
  in every bucket; favourite win rate already tracks the real curve almost exactly.

  **Three more instrument defects, each of which had inverted its own diagnosis.** Fourth-down attempts
  were double-counted ("Turnover on downs" repeats the failed play's `dd`) and goal-to-go was bucketed
  as 4th-and-1, which together reported 38% conversion on 1.94 attempts for a sim actually converting
  60.4% on 1.39 — going for it too rarely and converting too well, the exact opposite. Red zone, drive
  start and per-down/distance gains had never been measured at all; all three turned out already right,
  which is how the residual was localised to the number of red-zone TRIPS. Two hypotheses were measured
  and **rejected**: per-play variance is not what puts the sim in 3rd-and-long (its draws match the
  measured tables to ~1.5%), and the play-caller honours `PM.mix` per cell.

- **Phase 55 — the watch screen as a drive chart.** The watch-then-commit viewer splits 60/40: the
  play-by-play on top, and below it the game drawn as **movement** — a field running left→right with
  time running down, one bar per snap. The bar is the **possessing team's colour**, a **loss is grey**,
  a **flag is dull yellow whichever side threw it**, and every bar runs toward the end zone that team is
  attacking — **which swaps at every quarter break**, visible as the two end-zone columns trading colour
  mid-chart (the tint rides on each ROW, not on the fixed backdrop, so rows carry their quarter with
  them as they scroll). This needed the engine to write down something it never had: a log entry
  carried prose, beats and a `l` that meant three different things, but **the ball's yardage existed
  only inside the prose**. Entries now also carry **`mv` = `{o,a,b,k}`** — the possessing offence, the
  spot before and after in *that* offence's own-yard-line frame (100 = the end zone it attacks), and
  the kind (`d` drive · `p` snap · `f` flag · `k` kick · `s` score). `o` is deliberately the possessing
  offence rather than the entry's `team`, so a defensive flag still draws in the right frame; `l` was
  left exactly as it was, because `tools/cfb-data/4-simprofile.js` reads it for red-zone rate and drive
  start. Additive and rng-free, like `bt` before it → **no save bump, no `SIM_MODEL` bump**, every old
  game still replays. **It also fixed a shipped bug:** `beatBody` builds beats at `opacity:0` and only
  the live tick ever raised them, so *every re-render* — Skip to result, the Fast toggle, and the coach
  screen, which rebuilds its whole feed after each call — was painting the play-by-play invisible and
  leaving a column of bare down-and-distances (visible in the committed `19b-coach-field.png`).
  *(→ `docs/phases/gameday.md`.)*

- **Phase 55.1 — the watch screen, revised.** Five changes on top of 55. **A loss is now the same
  colour as a gain** (the grey read as a third kind of event when it's the same team with the same
  ball; only a flag breaks out of the team's palette). **The field is a regulation field** —
  aspect-locked to **120 × 53⅓ yards** and drawn in an SVG whose viewBox is those yards, so 10-yard end
  zones (the band is exactly `100/12` = 8.3333%, now derived as `CH_EZ`/`CH_SPAN`), a line every five,
  the numbers every ten with the far set upside down, and hash marks **60 feet in from each sideline**,
  which is what makes them college and not NFL. **The field comes first, then the log** — and because
  the field is aspect-locked there is no flex split any more: it takes the height its proportions ask
  for and the log takes the rest (so the chart scrolls after ~3 drives on a phone, accepted up front).
  **The lower pane is tabbed** — Play-by-play / Stats. And **the running story**: broadcast lines under
  the play that earned them ("…is over 100 yards on the ground", "That is three sacks for X!",
  "Alabama just went over 400 yards of total offense", "This drive has been all X — 53 yards of it").
  The last two needed the engine to hand over its own arithmetic, since `buildGameLog` captured no box
  and the engine's box is the FINAL one (showing it mid-game spoils the result). So an entry gains
  **`st`** — its per-player stat delta `[[pid,key,d],…]`, which the viewer folds 0..`idx` for the box
  *as of that play* — and **`sm`**, the story strings. `st` needed a **second** journal (`sj`): Phase
  49's `jr` is nulled the moment a play can no longer be wiped, which is exactly when the extra point
  and clutch credit are written; `sj` runs to the end, is **drained** by whoever reports the play (so a
  pick-six's two entries split offense from return), and is cleared by `undoPlay`. Both rng-free →
  **no save bump, no `SIM_MODEL` bump**. *(→ `docs/phases/gameday.md`.)*

- **Phase 55.2 — the other half of the story.** The running story only had upside, which made the feed
  a highlight reel of one team's good afternoon rather than an account of the game. Six **downside**
  categories now run on the same rules (a number crossed, said once, never editorialised): picks thrown
  (`box.pInt`), fumbles lost, team giveaways, **sacks given up** (the other side's `box.sk`), flags on
  one man (`box.pen` — the line Phase 49 earned, since one man commits 44.7% of a team's false starts),
  and flags on a team. Both halves are **spoken inside the call**, not as an annotation beside it: a
  milestone is the last beat or two of the play's own sequence ("…SACKED for -8 … brought down by
  Whitfield … Missouri has given up six sacks"), same styling, same reveal, with `beatSpan` giving the
  line the time it needs; an entry with no beats (a flag, a punt) puts its text in as beat one. `sm`
  stays a field **separate from `text`** — six tools parse `text` with regexes — and is assembled into
  prose at render time. **Two per play at most**, gathered in the order a broadcast would reach for
  them and with sign playing no part in the ordering; a milestone is *claimed* only when it survives
  the cut (`want()` + `commit()` rather than `once()`), so one trimmed for line length comes back on a
  later play instead of being lost. Fumbles-lost and giveaways are **local
  counters, not box keys** — `applyResult`
  folds the box into `p.gs`, so a new key would become a new per-player season stat and a save-shape
  change, which commentary has no business causing. Flags get their own hook (`flagStory`) because a
  foul is reported by `chargeFoul` and never reaches the play resolution. **Also fixed a latent bug:**
  `scheduleGameTick` captured its entry at *schedule* time and applied it whenever the timer fired —
  unreachable in the shipped app (`skipGame` and the Fast toggle clear the timer first), but it made a
  probe that moved `G.idx` replay a stale entry and open a second Q1 band after Q3. It re-reads at fire
  time now. `simlab` → 161, `qa` → 327. *(→ `docs/phases/gameday.md`.)*

- **Phase 56 — recruiting, measured.** Recruiting was the last major system never fitted to measured
  football: its design record stopped at Phase 38 while the sim was rebuilt three times. Phase 56
  **changes no game code** — it builds the instrument (`tools/cfb-data/20-recruits.js` harvest +
  `21-recanalyze.js` real + `22-recprofile.js` sim + `23-reccompare.js`) and the fourth reference
  sheet. The aggregates all looked fine (blue-chip share 11.2% vs 11.1%, class size 20.7 vs 20.2,
  persistence 0.927 vs 0.882) — the same way the sim's totals looked fine for nine phases. **The band
  table did not.** Real class size is *flat* across program quality (23.5 at the top, 19.9 at the
  bottom) while SIDELINE inverts it: **Georgia signs a one-man class**, Alabama three, Ohio State
  five, while prestige-72 programs sign a full 25 that's essentially all blue-chip. The cause is one
  mechanism — `recruitFit` scores against a *target prestige per star tier* (88/70/50/32) and the
  suitor draw has **no over-tier floor**, so pull is a **band-pass filter** and being above a tier is
  penalised exactly like being below it. Separately, **the race is settled before anyone plays it**:
  with nobody acting, 86.7% of a good-fit program's seeded 4★ relationships clear the commit bar by
  **week 7** and 90% pin at the ceiling — so everything Phases 33–38 layered on moves a saturated
  number. Also measured: the board is 18% too small (3,400 vs 4,158, which is why sign rate reads 82%
  against a real 63.7% — the real board deliberately exceeds FBS capacity), and geography is inverted
  (TX/FL/CA/GA produce 42.4% of the real board vs 8% under the uniform `pick(r,STATES)` draw).
  **Instrument work:** `reclab` now pulls the game's data arrays instead of copying them — its
  `STATES` held 15 of 50 and its `POS` still carried the pre-Phase-52 `S`, so `posAttrW` fell back to
  the *linebacker* row for ~9.5% of every pool it validated (`rolllab`/`legacylab` still have this).
  Convergence was re-pointed off pool consumption, which is a supply-vs-capacity identity and explains
  the 92→91→80 drift and the quiet 88→85 bar drop. And the **Phase 44 recruiting cliff was
  relocated** — it is app-layer, not engine: `advanceRecruiting` resolves a full class for a passive
  player team. `reclab` → 68. *(→ `docs/phases/recruiting.md`, `docs/reference/cfb-recruiting.md`.)*

- **Phase 57a — supply and geography.** The first half of the talent-economy rewrite: the two Phase 56
  defects that are *directly measured* and need no fitting judgment. It goes first because supply is an
  input to fitting everything else. `REC.POOL` 3,400 → **3,692** with the star cutoffs as named
  constants (`N5/N4/N3`) from the measured mix — the old tail split 44.7/44.1, a barbell, where the
  real board is a broad three-star middle (58.9/30.0). **`REC_GEO`** replaces the uniform
  `pick(r,STATES)` draw: 50 weights in parts per 10,000 measured from 40,161 ranked prospects, with
  `pickState(r)` consuming exactly one rng draw so the pool's draw sequence is unchanged (ME/VT measure
  a true zero and are floored at 1). That immediately exposed a **compensating error** — in-state share
  jumped 31.5% → 45.4% against a measured 36.8%, because the home-state pull was hand-tuned against a
  world where Texas produced 2% of the talent; `24-geofit.js` fits it, and `GEO_SUIT 0.3 → 0.20` lands
  exactly on 36.8% (the `recruitFit` bonus was always right, only the suitor-draw weight was over-set).
  Also corrects Phase 56's own headline: the sim's pool is entirely ranked, so the targets are the
  **ranked-only** 3,692 / 67.4%, not 4,158 / 63.7%. Supply, star mix, BCR, persistence and geography
  now all read `ok`. **Still owed to 57b:** sign rate 77.6% vs 67.4%, programs signing <10 at 13.4% vs
  3.3%, and the band table unmoved — the band-pass filter and `CLASS_CAP` acting as a target rather
  than a ceiling. **No save bump** (no field changes; the pool is rebuilt at kickoff), no `SIM_MODEL`
  bump. `qa` → 330, which needed the *third* site of the pool-consumption identity re-pointed.
  *(→ `docs/phases/recruiting.md`.)*

- **Phase 57b — the talent economy.** The half needing fitting judgment, and what the arc exists for.
  Phase 56's two defects are the *same* defect twice — **`recruitFit` alone decided both who was on a
  prospect's board and who won him** — so they had to be fixed together. **One rule: pull is monotonic
  in program quality, and it sets the odds rather than the outcome.** `pedigreeFit` becomes a logistic
  in `prestige − recruitTier(stars)` (strictly below 1, so two blue-bloods never tie and `LEAD_GAP`
  still resolves); `boardAppeal` carries the only surviving above-tier taper and only for board
  *membership*; growth approaches a **ceiling set by fit** instead of climbing without bound; and
  `classTarget` makes `CLASS_CAP` a ceiling, with a small prestige gradient pinned to the measured
  band sizes. **Every comparison row now reads `ok` but one** — Gini 0.774 vs 0.772, BCR 4-year 14.1
  vs 14.1, windows ≥50% 11.7 vs 11.8, class size 18.9 vs 19.0, persistence 0.887 vs 0.882 — and the
  top band signs **22.5** against a real 23.3, where before Phase 57 it signed 4.2.
  **Three things surfaced only by building it.** `aiPriority` had to become a **product** (expected
  value): monotonic pull makes a blue-blood's fit on a two-star ~0.99 against ~0.86 on a five-star, so
  any additive form fills the best classes with the tail. Ceiling-seeking growth had to become
  **one-way** — an attractor pulls *down* too, eroding exactly the effort this phase exists to reward.
  And **a shipped bug**: `initRecruiting` seeded the class off `S.seed`, which never changes, so every
  season generated the byte-identical 3,692 prospects — same #1 recruit, every year; `recruitSeed()`
  folds the year in. `26-dynasty.js` (new, a tool not an npm gate) shows concentration **does not
  compound**: drift +0.1 across a ten-season steady state. Two residuals recorded rather than tuned
  away — the top band is under-concentrated while total Gini is exact (reality has a convex
  national-brand effect at the very top, deliberately not invented from one number), and no program
  signs a tiny class. **No save bump, no `SIM_MODEL` bump.** `reclab` → 75, `qa` → 330.
  *(→ `docs/phases/recruiting.md`, `docs/reference/cfb-recruiting.md`.)*

- **Phase 58 — the read.** Closes the arc, and 57b is what unblocked it: while the interest race
  settled itself by week seven, better information about *who* to chase could not change an outcome.
  **One rule: the services rank a generic player; you rank him for YOUR system.** Mostly *connecting* —
  Phase 52 generated 25 attributes, 71 archetypes and a purity for every prospect, `RECRUIT_PKEYS`
  saved all three and `recruitToFreshman` carried them to campus, and **none of it reached a screen**
  (`archList`/`archByName` were dead code; `p.arch` rendered nowhere, on recruits *or* your own
  roster). Adds `recruitProject` (in-system vs generic vs best-fit, scheme list passed in so the fence
  stays pure), `recAttrRead`/`recAttrSpread` (his attributes as a band that closes with `scout`), and
  `recFogArch` (the name at one threshold, **purity** at a higher one). **The fog is the load-bearing
  part** — `attrRowsHTML` had been printing all 25 attributes at full precision while only his ceiling
  was fogged, so ability was free exact information and scouting bought a band nobody needed; fogging
  it is what turns the archetype and the projection from a readout into a decision. Roster players stay
  exact — you know your own team. UI: an "In your Pro Style — 88–98" card with a fit line, the
  archetype on the row and the roster, and a **"Best in my system" sort** — the first view of the board
  that isn't the one every rival has (it sorts on the same fogged read, so it sharpens as you
  evaluate). **Scale, measured first:** comparing `ovrIn` to `ovrBase` reads a delta of 0.34 and looks
  fatal to the premise, but that's the wrong comparison — `ovrBase` sits near the average across
  systems, and the swing *between* systems for the same player is **2–4 points, reaching 10** at QB/WR/
  OG, with high-purity specialists swinging ~50% more. Also gives recruiting a consequence you feel
  **this year**: `classScore`/`myClassRank`/`classGrade` were display-only across six call sites, so a
  great class only paid off three or four years later against a two-to-three-year hot seat — a large
  part of why Phase 44's autopilot was acceptable. `classApprovalDelta` moves the seat at Signing Day
  with its own media beat, scaled by program (a #25 class is the job at prestige 95, a triumph at 35)
  and pegged at ~one game's worth of results. **No save bump, no `SIM_MODEL` bump.** `reclab` → 87,
  `rolllab` → 42, `medialab` → 55, `qa` → 338. *(→ `docs/phases/recruiting.md`.)*

- **Phase 59 — the top band, and why effort did nothing.** Takes on the residual 57b recorded: the
  top-10 band took **31.6%** of blue-chips against a real 40.3% while Gini was right to three decimals.
  57b blamed *"something convex at the very top that team quality does not explain — national brand"*
  and declined to model it. **`27-toplean.js` refutes that**: as a multiple of the bottom band, top-10
  against 11–25 is real 1.154 / sim 1.191 — the sim is if anything *more* separated. What differed was
  what the lead buys (blue-chips per team, real 1.71× / sim 1.08×), i.e. a **conversion** defect with
  no missing mechanism. The fix was a **fitting** fix: adding `bcPerTeam` to `25-recfit.js`'s objective
  unlocked it (with nothing valuing top-band concentration the fitter had sat at the *widest* pull in
  its grid), giving `PULL_W` 26→21 plus a geography rebalance, cost 17.86→4.94.
  **The real find came out of a broken gate.** 57b's "recruiting effort now changes the class it
  lands" had been a one-seed blue-chip count; rewritten over four worlds on `classScore` and then
  capacity-controlled over ten (57b exempts the player's team from `classTarget`, so the two runs were
  different capacity regimes), it read **938 worked vs 939 ignored — the AI's concentrated-effort pass
  moved a class by 0.1%.** Phase 33's brain and the Phase 44 autopilot that shares its priority had
  been spending their whole budget to no effect; the pre-57b saturation hid it and 57b's assertion
  passed on luck. Cause: `aiPriority`'s `+iv*0.12` traction term dominated the expected-value product,
  so the brain ranked highest the recruits it had **already won**. Now multiplied by how *pivotal* the
  push is (`exp(−(gap/AI_PIVOT)²)` on the margin to the best rival) — effort goes where the race is
  close. Being recruited is worth **+22% class score, +6.4 blue-chips**. Also **deletes**
  `AI_SCOUT_STAR`: scouting follows effort, so with effort aimed correctly the Phase 33 information
  asymmetry falls out at 42-vs-7 with no tier term (two mechanisms for one behaviour is one too many).
  Landed: top band 31.6→**36.3%**, BCR 56.0→**64.8**, per-team ratio 1.08×→**1.70×**; everything else
  held and `26-dynasty` still reads STABLE. **No save bump.** `reclab` 87, `qa` 338.
  *(→ `docs/phases/recruiting.md`.)*

- **Phase 60 — attention is the resource.** Opens a three-phase arc on the recruiting *experience*
  (60 attention/staff · 61 the prospect as a person · 62 who actually makes it), after 56–59 rebuilt
  the engine without ever asking what the player does on a Tuesday. **Entirely app-layer and
  player-only — the fenced RECRUIT ENGINE does not move**, which is the phase's safety proof:
  `reclab` finished on **87 unchanged** and `23-reccompare` came back **byte-identical** to the
  committed baseline. **It measured first, and the loop was broken at both ends**: a full season of
  doing literally nothing signed a blue-blood **25 players and the #1 class in America** (effort
  worth +5.4%) while the bottom of the league signed **zero** — the Phase 44 cliff, re-exposed. One
  cause, not two: `decayNeglect` cooled the recruits on your BOARD, so the ~120 prospects seeded as
  suitors that you never opened a slot for grew for free — **you were rewarded for not tracking a
  recruit**, which reads as a giveaway where the passive ceiling clears `COMMIT_THRESH` and as a
  cliff where it doesn't. Fixed by applying the same rule consistently (`REC_DRIFT_DECAY` on
  untouched relationships — designed, not fitted, and swept to show 2.2 is the knee rather than a
  cliff). **Requirement 2**: `REC_ROLES` join `COORD_ROLES`/`POS_COACHES` as `tier:'rec'` staff who
  are inert everywhere a coach belongs (`staffBoosts` already skips a group-less entry) and real in
  `team.payroll`; they carry weekly points, board slots and standing orders scaled by rating, ride
  the **existing** market without resizing it, and **AI teams get none**, so no fitted quantity
  moves. **Requirement 1**: the Phase 44 global autopilot is deleted for per-recruit **standing
  orders** — a named staffer works a named recruit at his own rating and takes the off-priority
  multiplier that already existed, because he does not know what the kid wants. The first cut
  exempted delegated recruits from decay *and* pushed them, and the probe caught it in one run:
  hands-off-but-staffed signed 25 for #1 while a coach who worked his board signed 14 for #16 — the
  autopilot rebuilt under a new name. Landed: worked > delegated > ignored at every prestige band,
  attention worth +18% / +128% / +295% top to bottom. Save **v49**. `econlab` 33 → **40** (and its
  role tables now live-grab instead of drifting), `qa` 341 → **344**.
  *(→ `docs/phases/recruiting.md`.)*

- **Phase 61 — the iPhone app.** The same `index.html` in a native WKWebView shell, sideloadable
  without a Mac. The ask was *"iOS-first, but we don't need Swift"*, against a PWA that *"feels
  cheap — zooming in randomly, not holding state for longer than like 10 minutes."* Scoping found
  **three complaints with three different causes**, only one of which packaging fixes, and that
  split is the phase. **Zoom** was already half-solved (inputs were 16px, the one mitigation Safari
  respects) and half-unsolvable: iOS Safari has ignored `user-scalable=no` since iOS 10 as an
  accessibility policy, so double-tap and pinch need a shell. **State** was a real bug, not storage
  — boot was a bare `render()` with `UI.view='menu'` and no session resume, so a tab eviction (both
  Safari and a WKWebView jettison a backgrounded tab holding a decoded multi-MB world) dropped the
  player on the main menu beside an intact save; `sideline_active` records the live slot, set
  wherever a career opens and cleared only on a deliberate exit. **"All responsive mobile view"** is
  true and is design work the shell only unlocks. Chose **XcodeGen + one Swift file** over Capacitor
  after counting what the shell must actually do — five capabilities, no push/iCloud/Game Center, so
  no plugin ecosystem to buy and no `node_modules`/CocoaPods in a repo that has kept its runtime
  dependencies at zero for sixty phases; the recorded line for revisiting is "when you write generic
  plumbing instead of a specific feature." Shell decisions in priority order: a custom `sideline://`
  scheme because **saves are keyed to origin** and `file://` is opaque (so `Shell.scheme` is
  effectively a schema version); zoom shut four ways; `bounces=false` with insets left manual so the
  page's own `env(safe-area-inset-*)` keeps working; two bridges — haptics, and a share sheet fixing
  `a.download`, which is **inert** in a WKWebView and had the roster-template button silently doing
  nothing. **Fonts had to be vendored first** — the Google Fonts `<link>` was the only external fetch
  in the file, so five faces are now base64-embedded (117KB woff2 → 158KB), keeping index.html ONE
  self-contained file that renders identically from `file://`, `https://` and `sideline://`. CI
  builds an **unsigned** `.ipa` on a free macOS runner with **no certificates or secrets** —
  compiling needs macOS, signing needs an Apple ID, and SideStore does the second half locally,
  which is what makes the path work from Windows. *(**Superseded**: the Windows/CI/sideload route is
  gone. The workflow is deleted and distribution is `npm run ios:deploy` — a signed Release straight
  onto the paired phone. Everything above about the SHELL still holds; only the delivery changed.)*
  **No save bump** (v49 unchanged), no `SIM_MODEL` bump — the sim was not touched. `qa` 344 → **351**.
  *(→ `docs/phases/ios.md`, `ios/README.md`.)*

  **"Verified end to end" meant the BUILD, not the APP — and the app was broken.** The phase closed
  on `ARCHIVE SUCCEEDED` plus a byte-identical bundled `index.html`, neither of which runs anything.
  The first time the shell was actually driven (Phase 61.1) it rendered the game as **plain text**:
  `BundleSchemeHandler` passed `"text/html; charset=utf-8"` as `URLResponse.mimeType`, which takes
  the bare type with the encoding in `textEncodingName`. WebKit did not recognise it, fell back to
  plain text, and drew the whole file as a `<pre>` of its own source — an app that launches, shows
  something, and is completely dead. Fixed by splitting the two. The lesson is the phase's own: a
  wrapper is not verified by compiling it.

- **Phase 61.2 — the native-feel pass.** The other half of *"feels cheap"*, now that the loop can
  measure it. **The load-bearing find is press feedback**: the app suppressed the iOS tap highlight —
  correctly, it is the wrong shape and colour for these controls — and put **nothing** in its place,
  so across the whole app a tap produced *no response at all* until the screen redrew. A native
  control answers the FINGER, not the result. `:active` now lightens and shrinks every interactive
  element, scoped to `button`/`a`/`[role=button]` rather than to the card and row CLASSES, because
  half the `.lrow` rows are static divs and lighting those up would be a lie about what is tappable.
  Brightness, not opacity: on a palette this dark a dimmed control reads as disabled. **It needs one
  line of JS to exist at all** — iOS applies `:active` only while some touch listener is registered
  up the tree, so an empty `touchstart` listener is what keeps the whole layer from being dead on the
  phone while working perfectly in every desktop browser.
  **Touch targets: 21 under Apple's 44pt minimum → 0**, from four causes (every tab strip at 40pt,
  the header back button at 38, the "flag need" pill at 26, one 42pt button). Where the design wants
  a control shorter than 44, the **hit** box is extended past the paint with a pseudo-element, so the
  layout is pixel-identical and the finger still gets its 44pt. Also: sheets rise instead of
  appearing (in only — `closeSheet` stays synchronous, a dozen call sites carry straight on into
  `render()`), re-tapping the current tab returns to the top of it, and **`bounces` went back to
  true** in the shell (see `ios/README.md`: 61's reasoning holds in Safari and not inside a shell).
  Two non-findings worth recording: scroll position already survives a re-render (measured, 1200 →
  1200), and screen-to-screen transitions were deliberately NOT added — a tab bar does not animate
  between tabs on this platform. `qa` 355 → **359**, and the gate now imports the audit from
  `tools/ios/scenarios.js` so the gate and the two loops cannot drift into separate opinions about
  what a 44pt target is. *(→ `ios/README.md`.)*

- **Phase 62 — the playthrough pass.** The first time anybody *played a career* in the shell rather
  than screenshotting it: three seasons, two offseasons, every step driving the control a finger
  would hit. **26 findings.** The loops were right about the nine screens they measured and blind to
  the ones they could not reach — the game view is not a nav view, so it is in neither scene list,
  and it was the one screen building neither a `.topbar` nor a `headerBar`: `--safe-t` is 62px,
  content started at 18px, and **18 elements painted under the clock, the score among them**. The
  other two instrument defects are recorded and NOT fixed (`docs/phases/ios.md`): a sheet is audited
  two frames into a 260ms rise so it reports `0/0` and **no sheet has ever been measured**, and
  `ios:sim` can serve a **stale cached page** after a reinstall, which silently verified a fix
  against code that was not running. Bugs: `offerRecruit` toasted success on every failure path; a
  recruit who cut you took your points once he committed elsewhere (the guard read `!rec.committedTo`,
  which switched it off at exactly the wrong moment); a signed-elsewhere recruit held a board slot
  with no way off it; `pursueTransfer` charged at 100% interest; Home's "Last Result" could not see a
  bowl, playoff or title game (`teamGames` reads only `S.schedule.games` — `lastResultFor` spans all
  three); "freshmanmen". **The design system had two holes bigger than any of them**: `.good`, `.bad`
  and `.accent` had **no CSS rule at all** — only the chip forms were ever defined, so `class="cond
  good"` on a win computed to the same white as a loss, app-wide — and `--accent` is the raw team
  colour used as TEXT in nine places, where **116 of 134 team colours sit under 4.5:1** on the panel
  (Penn State navy reads 1.01:1). `--accent-tx` lifts it until it clears, hue intact; the app-wide
  sibling of `chartInk()`, which solved this for the drive chart in Phase 55 and was never
  generalised. Layout: `.tabs` **wraps** rather than scrolling (the Season strip carries eight tabs
  against room for five, and a scroll strip with no fade or peek reads as a closed set — Awards, the
  playoff Bracket and the Draft board did not exist to the player); names get their own line in the
  portal and the honors rows, because the ellipsis was landing on the TEAM; `min-height:44px` on
  `input,select`; the recruiting tab strip moved above the report and plan cards, which moved into
  the Board tab they describe. **Balance — recruiting effort was worth nothing, and one constant is
  why.** `28-receffort.js` drives the real page (reclab records that this path is app-layer and it
  *"structurally cannot see it"*): over 5 seeds × 3 bands, a full season of board work, pivotal
  targeting, visits and every point spent moved class score **−2% / −1% / +8%**. In-season a recruit
  commits at `COMMIT_THRESH` 68 / `LEAD_GAP` 7; Signing Day ran at **30/0**, so a mid-tier coach who
  never opened the screen signed 25 with a **median relationship of 40** and 23.6 of 25 below 68.
  `REC.SIGN_BAR_PLAYER` **50**, off a measured survival curve (signee interest is bimodal — seeded
  relationships cluster 35–45, worked ones 65–85, so 45–55 separates them and the answer is flat
  across the window). **Player-only**, so no fitted quantity moves: `23-reccompare` is
  **byte-identical** to its committed baseline and `reclab`'s sign rate holds at 67%. Effort now
  reads **+4% / +48% / +92%**, and the prestige gradient falls out rather than being designed — a
  blue-blood who ignores recruiting still signs 24 for the #4 class, a prestige-35 program signs 11
  and must work for 22. No cliff. The **portal autopilot** gets the Phase 60 treatment
  (`S.portal.autopilot` was set true at every open and nothing ever cleared it): gated on
  `recStaff()` now, which finally gives that hire something concrete to buy — measured 2.8 arrivals
  against 8 losses with no staff, 5.0 with a department (`29-portalstaff.js`). **No save bump**, no
  `SIM_MODEL` bump. `qa` 359 → **377**. *(→ `docs/phases/recruiting.md`, `docs/phases/ios.md`.)*

- **Phase 63 — the call sheet.** Two halves of one piece of feedback: play-calling stops being a
  playbook, and recruiting stops charging for the wrong acts. **In-game**, Phase 46's fourteen
  hand-drawn concepts are gone. They did not scale (every card is an SVG route tree written by hand),
  the diagrams were doing work the engine was not (Inside Zone, Power and Outside Zone all carried
  `token:'run'` — three pictures, one call), and picking a card is not the job. A call is now the four
  things a coordinator decides: **what · how far · who gets it · whom you attack**. Every axis reaches
  a play — depth against the defence's depth is a real matchup table, the run gap reshapes the Phase 53
  floor and tail, and naming an outlet or a defender selects the actual matchup the snap resolves
  (`wpick` is still always drawn and only its RESULT overridden, so the rng stream stays a function of
  seed + calls). The call is one string, `base[:variant[:targets]]`, with every delta keyed off the new
  **third** segment — absent unless a human composed one, which is why an AI game, a "defer", and every
  coached game already banked in a save resolve byte-for-byte to what they did before (**simlab 161/161
  with an identical summary line**; qa asserts it directly). **No save bump, no `SIM_MODEL` bump** —
  and that is also why the AI defence does NOT get a depth of its own, since giving it one would change
  what those banked games replay to; the other side's depth is IMPLIED instead (from the front called,
  and from distance-to-go). **The tuning is the phase's other half.** The hand-written interaction table
  read cleanly and measured at a **23-point** spread — pressing every snap gave up 14.6 a game against
  37.4 for two-deep — because the implied mixes are nowhere near uniform (the offence is in `s` 60% of
  the time and reaches `d` never). Double-centring each row against the measured offensive mix and each
  column against the defensive one leaves pure interaction: **defensive spread 23 → 1.5 points, offensive
  depths within 1.2, gaps within 0.7.** Two traps recorded: measuring an axis by calling it every snap
  measures the Phase 22 predictability tax instead (all-run football averages 1.67 Y/C), and `d` is
  deliberately **no longer** the Phase 46 `deep` variant — as a card it was one option among ten, as a
  rung on an axis it scored 27.6 against 23.7 and the dominant strategy was to stop thinking (the legacy
  variant is untouched on its own branch). Naming a target carries the Phase 22 tax one level down, on
  an UNDAMPED channel — `vD` asks whether a sharp defender is fooled by a fake, which would mean the
  sharpest defender in the league is the least able to notice you have thrown at him nine times running.
  The coach screen gains the watch screen's three views (**Play-by-play · Stats · Matchups**), because a
  play-caller needs BOTH teams' box scores; the Phase 23 one-sided panel becomes the Matchups tab and
  shows each receiver against the defender `coverDef` will actually assign him. **Recruiting**: the
  scholarship offer is **free** (it is a piece of paper — the BOARD is what costs you, and it is still
  the only route to a commitment); `scout` 2 → **1** and `REC.BASE_POINTS` 6 → **14**, so ~18 evaluations
  a week at the bottom against the old ~10 points total, with a **🔍 chip on every row** so eighteen
  scouts is not eighteen trips through a sheet (`REC.SLOTS` deliberately NOT raised — the board was
  measured at 12); the plan card's duplicate per-recruit action list is **deleted** (the board rows
  already carry `⏳ Scout`, and the second copy is the one you cannot act on in context), leaving only
  the totals; and delegation finally says what it does — *a staffer calls him every week for free, but
  he pitches blind, so the interest stops sliding and does not climb*. `REC.BASE_POINTS` is read only by
  the app-layer `weeklyPoints`, never inside the fence, so **`reclab` holds at 87/87 and sign rate at
  67%**. **Recorded and NOT fixed:** the `ignored` arm of `28-receffort` signs **zero** in every band and
  has since the offer gate landed (measured identical on the branch head) — a real cliff of exactly the
  kind Phases 60/62 exist to prevent, left alone because every fix is a design decision about the gate.
  `qa` 380 → **398** (the gate also stops failing on a browser-build-dependent `/favicon.ico` 404 that
  had nothing to do with the page). *(→ `docs/phases/gameday.md`, `docs/phases/recruiting.md`.)*

- **Phase 64 — sideline events.** Every in-game lever up to here was **tactical** — what play, what
  coverage, who covers whom. This is the other half of the job: **managing men**, and the first system
  to put the Phase 10/20 temperament traits in front of you as a live decision rather than a background
  modifier. A player throws a pick, puts it on the ground, gets beat for a score, pushes a kick wide —
  or walks into the end zone — and the game stops before your next call. You get his name, his
  **fogged** makeup, his day so far, and a set of responses: **get in his face · put an arm around him ·
  walk him through it · sit him a series · say nothing**. The design constraint is that *you cannot see
  the man, only the fog*, and `sidelab` asserts it rather than asserting the prose: over the whole
  temperament grid **each of challenge / support / coaching / benching is the single best answer
  somewhere**, and none is right for more than 26% of temperaments — so a later tuning pass cannot
  quietly turn this into a button you always press. **The engine seam is the one Phase 55 already
  built**: `X(mv,sm)` is the bundle of log-only fields an entry carries, and the tag rides there as a
  third member (`sl` = `{sl,pid,cvid,pn}`) — strings and ids, no rng, so simlab's summary line is
  **unchanged to the digit** and an AI game is byte-identical. Two tags earn their design: a **touchdown
  is two different conversations** depending on which sideline you stand on (the scorer, or the corner
  he beat — `pid` and `cvid`, and the app takes whichever is yours), and **flag trouble is the one
  moment about a UNIT** — Phase 49 knows exactly who committed the foul, but a coach watching his third
  flag of the afternoon is not talking to an individual, so it fires on every third team flag with a
  null `pid` and reads the two-deep's average makeup. A response converts into the **existing Phase 24
  plan** (`boost` / `calm` / the new `sit`) and banks onto `g.adjusts`, so **watch == commit** holds
  with no new game-object field. `plan.sit` is safe for a precise reason: it changes WHICH player a
  weighted pick lands on, never HOW MANY rng draws happen (`wpick` draws once either way), and `plan`
  is null for anyone but the controlled team. It is measured in **DRIVES, not plays** — drives
  alternate, so a play-count sit taken out on a pick would expire while its owner was still on the
  bench and cost him nothing. The locker-room half is **queued, not applied live**, landing once in
  `finishGame`, so bailing out of a coached game leaves no trace and a determinism re-sim cannot
  double-count it. Save **v52** (structural no-op — an absent `sit` reads as "nobody sat"), **no
  `SIM_MODEL` bump**. New gate **`sidelab` 54**, `simlab` 161 → **177**, `qa` 398 → **411**.
  *(→ `docs/phases/gameday.md`.)*

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
  (currently **52**). Each step backfills the fields its phase added and re-derives
  ratings/ranks where needed; most recent steps are structural no-ops (sparse per-player
  fields / derived data read as their defaults) — **v47/v48/v50 are the exceptions**: v47/v48
  mutate every player, deriving an attribute profile re-centred onto the `ov` he already had (v48
  also splits `S` into `FS`/`SS` and packs the row into `p.at`), and **v50** re-derives the stored
  `boost` on every coach (and in `coachMarket`) after the staff ladder was re-cut, then re-derives
  ratings and ranks off it. **v51** splits the scholarship offer away from the recruiting board (`recruiting.offers`),
  backfilling it from `board` so an in-flight class survives. **v52** is Phase 64's sideline benching —
  a coached game's `g.adjusts` plan may now carry `sit`, and an absent key reads as "nobody sat".
  The full v1→v52 migration ladder is
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
  recruiting: { cycle, points, pool:[ Recruit ], board:[ recruitId ], offers:[ recruitId ], signed, stage, intents, doubles, visitsLeft, visitPlan, report } | null,  // null until kickoff (Phase 4); stage: open→national→closed (Phase 14); intents = {recruitId:[{action,...,cost,label,isDouble?,nilSpend?}]} = this week's QUEUED actions (≤2/recruit; a 'nil' action pays nilSpend $ from budget — Phase 37), resolved at the week change (Phase 33/35); doubles = weekly double-down tokens (Phase 35); visitsLeft = season official-visit budget (Phase 37); visitPlan = {week:[recruitId]} = recruits booked onto home-game weekends (Phase 38); report = {week, reactions:[…], note} = last week's board report, transient (Phase 34/35); offers = ids you have extended a SCHOLARSHIP to (Phase 62.3) — free-to-join `board` is who you are chasing, `offers` costs points and is the only route to a commitment; orders = {recruitId: staffId} = Phase 60 standing orders, capped by the `tier:'rec'` staff you employ and resolved each week by `applyStandingOrders` (replaced the Phase 44 `autopilot` flag)
  offseasonReport: { year, graduated, tracked, freshmen, departed } | undefined,  // last rollover recap (Phase 5)
  world: { teams: [ Team, ... ] }
}

// Recruit: { id, fn, ln, pos, st, stars, svc, ov, pot, at (the packed position-attribute row), arch, pur,
//   mot,comp,ego, rebel, scout, prefs:[primary,secondary],
//   `at`/`arch`/`pur` are the Phase 52 profile — the six flat `spd/agi/str/awr/bal/dur` columns this
//   line used to list were retired by Phase 51/52 and survive only in `RECRUIT_PKEYS_V1` for decoding
//   pre-v48 saves. See `RECRUIT_PKEYS` for the live persisted set.
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
//   adjustment timeline [{at:playNo, plan:{shadow,boost,calm?,sit?}}] (Phase 24, coverage reassignment +
//   pep-talks; `calm` is the Phase 49 discipline lever, `sit` the Phase 64 sideline benching
//   {playerId: untilDrive} — self-expiring, and measured in DRIVES because drives alternate).
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
  //         | "rec" (Phase 60 off-field recruiting staff — no group, boost 0, so `staffBoosts`,
  //           `devRateFor` and `advanceCoachCarousel` all skip them; they cost payroll and buy
  //           weekly recruiting points / board slots / standing orders. Player teams only.)
  //   groups: [posCode,...] the coach buffs;  boost: OVR pts each gets, SIGNED — the ladder is one
  //     10-point rating band per step (a coordinator steps by 3, a position coach by 1) and is
  //     CENTRED on band 2, so a coordinator runs −6..+9, a position coach −2..+3, and the number is
  //     what the man is worth over a replacement rather than a bonus for employing anybody. The
  //     centring is load-bearing: raw unit ratings already reach 96 against a 99 ceiling, and an
  //     uncentred ladder pinned nine teams a world at exactly 99. An EMPTY slot is charged one step
  //     below the bottom rung by `staffBoosts`, so firing your worst coach is never an upgrade.
  //     The Special Teams Coord. is the honest exception — `teamRatings` averages the top 11 on
  //     offence and the top 11 on defence, so his K/P groups reach no rating at all; the UI prints
  //     what he really moves (K/P development via `devRateFor`) instead of a boost that does nothing.
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
  `decodeState` around `writeSlot`/load). The codec is pure serialization (no seed dependency), so
  it's deploy-safe. **Measured (Phase 61.1), not estimated:** an in-season save is **3.1 MB at
  kickoff and 3.5 MB by week 16** — the old "~1.4 MB" figure predated the Phase 17 national board
  and the Phase 57a pool — against an origin quota of **~4.97 MB**. `world` (2.1 MB) and
  `recruiting` (1.2 MB) are the whole of it, and both are roughly flat year to year.
- **A stored value is charged against its string's BACKING STORE, not its content.** WebKit holds a
  string at one byte a character only while every character fits Latin-1. A career carries ~59 that
  don't — all en dashes, from score lines — and those 59 doubled a 3.4 M-character save to ~6.9 MB,
  so **every in-season autosave failed** and `writeSlot` swallowed it into a toast. `asciiJSON`
  escapes them AND rebuilds the string through `JSON.parse`, because a string returned by
  `.replace()` keeps its source's 16-bit backing even when its content is now pure ASCII. Both steps
  are load-bearing and measured. Four `qa` checks hold the line: an in-season save must be written
  rather than refused, the slot must hold the LIVE week, the value must be pure ASCII, and it must
  stay under 4.2 MB. Anything that grows the save is now on a budget.
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
  The watch viewer: `data-tid="game-board"`, `data-tid="game-tabs"` (`[data-tab=log|stats]`),
  and the coach screen's own strip `data-tid="coach-tabs"` (`[data-tab=log|stats|match]`) over
  `data-tid="game-stats"` / `data-tid="game-matchups"`. The call sheet (Phase 63) carries
  `data-tid="call-go"` (with the composed token on `data-call`) and one tid per option —
  `odepth-*`/`olook-*`/`ooutlet-*`/`oattack-*` on offence, `dfront-*`/`ddepth-*`/`dkey-*` on defence;
  a recruit row's quick-scout chip is `row-scout-<id>`. The sideline (Phase 64) carries
  `data-tid="sideline"` (with `data-kind`), `sideline-opts` (one `data-opt` per response),
  `sideline-result`, `sideline-log` and `sideline-continue`.
  `#g-feed` (the log), `#g-stats` (the box score), `data-tid="drive-chart"` with `#g-chart`
  (the scrolling rows) inside it.
- **State access:** it's a classic script, so `S`, `UI`, and `controlled()` are global —
  read them directly from `page.evaluate(() => ...)` instead of scraping the DOM.
- Don't assert on visible text that has `text-transform` (e.g. `.sec` headers render
  uppercased; `innerText` returns the transformed text). Prefer `data-tid`/`data-id`.

### Gates (all must be green each phase)
**Twenty-four green gates** via `npm run <name>`: `simlab` · `reclab` · `rolllab` · `econlab` ·
`awardlab` · `traitlab` · `schemelab` · `legacylab` · `postlab` · `draftlab` · `champlab` ·
`portallab` · `medialab` · `camplab` · `visitlab` · `rivalrylab` · `recordlab` · `contractlab` ·
`realignlab` · `identitylab` · `cloudlab` · `lambdalab` · `sidelab` · `qa`. Each pure engine has an offline node lab
that extracts the fenced block from `index.html`; `qa` is the in-browser end-to-end. `lambdalab` is the
odd one out — it runs the cloud backend (`infra/lambda/index.mjs`, the only code that doesn't run in the
browser) against in-memory DynamoDB/S3 stubs. Add per-phase checks to the relevant lab + `qa` on any
change; bump the save `version` + `migrateState` on any save-shape change.

**Non-gate build scripts** (Phase 61): `npm run fonts` re-embeds `assets/fonts/*.woff2` into
`index.html`, `npm run ios:icon` regenerates the app icon, `npm run ios:project` runs XcodeGen
(needs macOS), and `npm run ios:deploy` is the **only** way the game ships — a signed Release
installed straight onto the paired iPhone (`tools/ios/deploy.js`; team ID + UDID in the gitignored
`ios/device.env`). There is no CI: the repo has no `.github/` at all. Three `qa` checks police the
properties the shell depends on: **nothing loads off-origin** across the whole run, the five font
faces are embedded, and every native bridge is a **silent no-op in a browser** — the shell is a
wrapper around the game, never a dependency of it. That last one is why the browser build must keep
working even though nobody plays it there: `qa` itself runs in headless Chromium.

**Non-gate feel loops** (Phase 61.1): `npm run ios:web` renders every screen in real WebKit at
iPhone metrics and reports overflow + under-44pt tap targets (~30 s, no Xcode); `npm run ios:sim`
builds the shell, installs it on a booted simulator and drives it there. `simctl` cannot tap a
simulator, so `Shell.swift` carries a **`DevBridge`** — a loopback listener that runs JS inside the
live WKWebView, fenced `#if DEBUG` (CI archives Release), bound to `127.0.0.1`, exposing **no JS
API** so no game code can depend on it. Both loops share `tools/ios/scenarios.js`, so a difference
between their shots is a difference in the *engine*. Neither is a gate — they need Xcode, and
`test/shots/iphone/` is gitignored. The loop paid for itself on its first run: it found the plain-text
render below, and the storage bug in "Conventions & gotchas" that had been silently freezing every
career at its preseason state. `qa` 351 → **355**. *(→ `ios/README.md`.)*

**Three known loop defects (Phase 62, recorded and NOT fixed)** — each makes a loop answer
confidently about something it never looked at, so read a clean line with them in mind:
`goto()` waits two frames and `sheet-rise` is 260ms, so **every sheet audits as `0/0`** and none has
ever been measured (fix: `await document.getAnimations()`); the **game screen is in neither scene
list**, which is why it shipped drawing the score under the status bar; and `ios:sim` can drive a
**stale cached page** after a reinstall (`simctl terminate` + `launch` clears it). Details in
`ios/README.md` and `docs/phases/ios.md`.

**Non-gate balance probes** (Phase 62): `tools/cfb-data/28-receffort.js` measures what a season of
recruiting is worth to the PLAYER — two arms (ignored vs worked) over seeds × prestige bands — and
`29-portalstaff.js` does the same for the portal with and without recruiting staff. Both drive the
real page in Chromium rather than extracting an engine block, because `reclab` records that the
player's recruiting path is app-layer and it *"structurally cannot see it"*. Report →
`tools/cfb-data/receffort-report.txt`. Phase 63 adds **`30-callsheet.js`** — what each rung of a
play-calling axis is worth, on simlab's synthetic world (no browser, no real data). It lets the OC
pick run/pass and supplies only the axis, because measuring a depth by throwing it on every snap
measures the Phase 22 predictability tax instead; it also prints the two implied-depth mixes that
`DEPTH_VS` is double-centred against, which must be re-measured before that table is re-centred.

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
choking, and that composure does NOT decide one-score games), and the Phase 55 `mv`/`st` checks (the
movement each log entry records must reconcile with the yardage the line's own prose quotes, and folding
every per-entry stat delta must reproduce the engine's own box exactly). The envelope asserts
*ranges*; the numbers it should be centred on are the measured ones in
`docs/reference/cfb-averages.md` — **check a sim change against that file, not just against the
gate**, since totals-and-leaders assertions passed for nine phases while run/pass balance and drive
structure were badly wrong (the errors cancelled in the totals). All S-dependent
in-game effects (coach edges, schemes, morale, matchups, adjustments, penalties, injuries,
play-calling, AI coordinators) are applied in `simSides`/the app layer **outside** this block so
the envelope holds — see `docs/phases/gameday.md` for how each layers on.

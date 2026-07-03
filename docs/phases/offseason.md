# SIDELINE — design history: offseason, program & structure

> Extracted from CLAUDE.md. Rollover, program building, postseason, draft, championships, camp, realignment.

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


## Phase 12 design — postseason (bowls & playoff)

Decided 2026-06-28 with AJ. A postseason now sits between the regular season and the offseason, and a
deep run / a bowl bid **generates recruiting** (AJ's framing). Same house discipline: a pure fenced
engine validated by a node lab before UI, a save bump, all gates green.

### Flow & timing
`advanceWeek` past the final week now calls **`finishRegularSeason`** (was `endSeason`): it crowns the
season **awards from regular-season stats** (the Heisman & co. are decided **pre-bowls**, like real life)
+ locks **Signing Day**, then **`startPostseason`**. The postseason runs round-by-round; **`endPostseason`**
crowns the champion + settles payoffs, sets `phase='Offseason'`, and the existing Offseason→rollover flow
takes over. `S.postseason` is created here and nulled at rollover (like the schedule).

### The bracket + bowls (pure `POSTSEASON ENGINE`)
Fenced `// === POSTSEASON ENGINE (Phase 12) START/END ===`, depends only on `rng/clamp/hashStr` + data
(no `S`, no `simEngine` — scores come from `simEngine` in the app layer), so `test/postlab.js` validates
it offline: `seedPlayoff` (top 12 by `rankScore`), `playoffRoundMatchups(round,seeds,winners)` (a 12-team
CFP — seeds 5–12 in the first round, **top-4 bye** into the quarters; 4→4→2→1 games), `genBowls`
(adjacent-by-rank pairing of ≥6-win non-playoff teams, capped to an 18-bowl marquee slate),
`postseasonPayoff(finish)` (the prestige/recruit/revenue ladder). The app builds `S.postseason` game
objects (`mkPostGame`, tagged `kind:'playoff'|'bowl'` so `applyResult` skips the conference tally and the
lookup branches), sims them with the existing `simGame`/`simEngine`, and feeds winners into the next round.

### Watch-then-commit (reuses the regular-season viewer)
The controlled team's bowl/playoff games are **watchable**: the Home advance button opens the same game
viewer (`buildGameLog`/`findAnyGame` now search the postseason too; `finishGame` branches to
`advancePostseason`). `advancePostseason` re-sims every unplayed game in the round (deterministic — the
watched score **is** the committed score), advances the bracket, and on the final → `endPostseason`. Bye
rounds advance directly; once the controlled team is out (`meDone`), one tap (`simRestOfPostseason`) sims
the rest. Other teams' games always auto-resolve, so the postseason stays fast.

### The three recruiting payoffs (the point of the feature)
`endPostseason` tallies each team's deepest finish and applies `postseasonPayoff`: a small **persistent
prestige** bump (a fractional `_pp` accumulator avoids rounding loss), a **`postseasonBoost`** folded into
**next** season's `recruitFit` (the boost is earned after Signing Day, so it pays the *following* class),
and a one-time **revenue** payout read by `resolveFinances` (`team.lastPostseason.revenue`). Champion takes
a permanent **`team.titles`** entry + an `aw.champion` snapshot. Postseason game stats fold into `p.gs`, so
bowl heroics count toward the Phase 11 career/legacy accumulation.

### UI & save
A **Bracket** Season tab (rounds + bowls, played games replayable), a Home postseason card, champion
banners + a `🏆 National Champion` row on the awards cards, a postseason line in the offseason recap. Save
**v14** (`S.postseason`; per-team `postseasonBoost`/`lastPostseason`/`titles`/`_pp`); `migrateState`
v13→v14 backfills `postseason:null`. New gate `npm run postlab` (20 checks); `qa` drives the full
hand-off → watch/resolve → champion → recruiting boost. **Deliberately out of scope:** no conference
championship games (the playoff seeds straight off the final poll), no bowl-tie-in/selection-committee
politics, no separate transfer portal — the postseason is bracket + bowls + payoffs, nothing more.

---

## Phase 13 design — the NFL draft & position factories

Decided 2026-06-28 with AJ. The other end of the player pipeline: graduates don't just vanish into the
Ring of Honor — the best get **drafted**, and a program that keeps sending players to the league at a
position becomes a **factory** there, which **generates recruiting** at that position (AJ's framing). The
twist: a **rebel** recruit is *repelled* by a factory — he wants to make his own name elsewhere. Same
house discipline: a pure fenced engine + node lab before UI, a save bump, all gates green.

### Where the data comes from (build on Phase 11)
Phase 11 already accrues **`p.peakOv`** + **`p.career`** + persists **`p.honors`** at rollover, for every
graduate — exactly the NFL-readiness signals. So the draft is almost free: at rollover, `rolloverSeason`
already builds each team's `graduated` list (it feeds enshrinement); we also snapshot each into a draft
pool (`draftSnap`).

### Pure `DRAFT ENGINE` (fenced, lab before UI)
`// === DRAFT ENGINE (Phase 13) START/END ===`, depends only on `rng/clamp/hashStr` + `honorWeight`/
`careerScore` (from the LEGACY block, for signal consistency) — no `S`, so `test/draftlab.js` evals LEGACY
+ DRAFT and validates offline:
- `draftProjection(snap)` — 0..100 grade dominated by **peak OVR** (`(peakOv−68)/31 × 70`), plus an honors
  term (the LEGACY ladder, ≤ ~20) and a career term (≤ ~10).
- `runDraft(grads, seed)` — grades the pool, applies a small **seeded jitter** (draft surprises, but
  reproducible), takes the top `DRAFT_ROUNDS×DRAFT_PER_ROUND` (3 × 32 = **96**) above `DRAFT_BAR`, and
  returns ordered picks (`{pick, round, grade, pid, name, pos, teamId, abbr, color}`). A thin class drafts
  fewer than the cap (no padding).
- `pickFactoryValue(pick)` / `factoryDecay(rep)` / `factoryRep(team,pos)` — the reputation a pick confers
  (earlier round = more), and the **decay** applied every year so a factory reflects *recent* production.
- `factoryPull(team, rec)` — the recruiting term (≤ **+0.15** fit) a positional factory exerts on a recruit
  at that position; a **rebel** (`rec.rebel`) gets `−0.8×` that (repelled). Returns 0 off a non-factory.

### App wiring
At rollover: collect `draftSnap`s from every team's graduates → `runDraft` → store `S.draft={year,picks}`
→ `applyDraftFactories` (decay all teams' `factory`, then add this year's picks; drop tiny entries). The
draft runs **after** Signing Day, so a factory built this offseason pays the *following* recruiting cycle
(same timing as the postseason boost). `recruitFit` folds `factoryPull(team,rec)` (guarded by
`team.factory`, so the recruit lab is unaffected). `genRecruits` stamps `rec.rebel` (~12%) off a
per-recruit rng keyed on the id, so the prospect board stays **byte-identical** to pre-Phase-13.

### UI & save
A **Draft** board (Season tab, also reachable in the preseason when no schedule exists yet — picks by
round, your picks highlighted), a **Pro Pipeline** section on the Program page (your `POS-U` factory chips
+ a link to the board), a draft-picks line in the offseason recap, and on the recruit sheet a **rebel**
"wants to be THE guy" chip + a note on how your positional reputation plays with that recruit. Save **v15**
(`S.draft`, per-team `factory`); `migrateState` v14→v15 backfills `draft:null`. New gate `npm run draftlab`
(22 checks); `qa` drives a rollover draft + factory pull/rebel + the board render. **Deliberately out of
scope:** no per-pick NFL teams/franchises, no combine/measurables, no underclassmen early declarations, no
draft-and-stash — the draft is a graded board + factory reputation + a recruiting lever, nothing more.

---


## Phase 15 design — conference championships (real CFP format)

Decided 2026-06-28 with AJ (first of the Phases 15–18 batch reversing earlier non-goals). Title games
now sit in a **Championship Week** between the regular season and the playoff, and the 12-team CFP seeds
with **conference-champion auto-bids** like the real format. House discipline: a pure fenced engine +
node lab before UI, a save bump, all gates green.

### Flow & timing
`advanceWeek` past the final regular-season week → `finishRegularSeason` → **`startConfChampionships`**
(was: awards + `startPostseason`). Awards now run **after** Championship Week (in `finishConfChampionships`)
so title-game stats count — decided post-title-games, pre-bowls, like real life. New phase string
`'Conference Championships'`. `S.champWeek = { year, games:[Game kind:'champ'], done, meDone }`, created
here and nulled into the postseason (like `S.postseason` at rollover).

### Pure `CHAMPIONSHIP ENGINE` (fenced, lab before UI)
`confChampGames(teams, scoreOf)` (depends only on a caller-supplied `scoreOf` ordering — no `S`, no rng;
scores come from `simEngine` in the app layer, so `test/champlab.js` validates it offline): for each
conference, the top two by score meet (a **divisioned** conference like the Sun Belt pits its two division
winners); higher score hosts; Independents play no title game. The reworked **`seedPlayoff(rankedIds,
champIds)`** (in the POSTSEASON block) implements the real CFP: the **four highest-ranked conference
champions take the top-4 byes**, a guaranteed **5th** champion auto-bid is slotted by overall rank (down
to seed 12), and the rest fill at-large by `rankScore`. Falls back to top-12 with <4 champions (tiny/custom
world) so `postlab` stays meaningful.

### App layer + watch-then-commit
`mkPostGame` gains a `'champ'` kind (tagged so `applyResult` skips the conference tally, like bowl/playoff).
The controlled team's title game is **watchable** — `openGameViewer`/`buildGameLog`/`findAnyGame` extended
to search `S.champWeek`; `finishGame` branches to `advanceChampWeek` (sims every unplayed title game
deterministically — the watched score is the committed score), then `finishConfChampionships` crowns
champions (`team.confTitles`), pays `CONF_TITLE_PAYOFF` (a small persistent prestige bump via the `_pp`
accumulator + a one-time budget revenue credit), runs `computeAwards`, and seeds the playoff with the
champion ids. UI: a Home **Championship-Week card**, a Program **Trophy Case** (national + conference
titles), and the existing advance button walks Play title game → Set the playoff field → Postseason.

### Save shape & validation
Save **v17** (`S.champWeek`, per-team `confTitles`); `migrateState` v16→v17 backfills `champWeek:null`
+ `confTitles=[]`. New lab `test/champlab.js` → **`npm run champlab`** (19 checks: pairings pick the
right two per conference / division winners; the auto-bid seeding gives the byes to the best champions,
all five champion bids make the field incl. a low-ranked one, the rest fill by rank, determinism +
fallback). `qa` drives the full hand-off (regular season → Championship Week → watch a title game → 12
seeds with champion byes → postseason). **Eleven gates** now (adds `champlab`). **Deliberately out of
scope:** no conference *divisions* re-org (we read the existing `div` field), no selection-committee
politics beyond `rankScore`, no separate championship-week revenue model beyond the flat payoff.

---


## Phase 18 design — transfer portal (full two-way)

Decided 2026-06-28 with AJ (Phases 15–18 batch). The last reversed non-goal: players can now move between
programs in an offseason **transfer portal** — you lose your own, you sign others', and the AI churns.
House discipline: a pure fenced engine + node lab before UI, a save bump, all gates green.

### Timing
The portal opens **after National Signing Day**, before rollover (`nationalSigningDay` → `openPortal`). The
Home advance walks: Hold National Signing Day → **Close the transfer portal** → Roll over. `S.portal` is
created here and nulled at rollover (like the postseason / Championship Week).

### Pure `PORTAL ENGINE` (fenced, lab before UI)
Depends only on `rng/clamp/hashStr` (no DOM, no S), so `test/portallab.js` validates it offline:
- `portalLeaveProb(p, opts)` — a player's odds of entering the portal (0..0.8): **buried** depth (`so≥2`)
  and a **broken playing-time promise** push him out; captains, starters, and **stars on winning teams**
  stay; `opts.retention` (coach identity) lowers it. Bounded.
- `portalTarget(tr)`/`portalFit(team, tr)` — a transfer's tier from his overall, and a program's pull:
  a positional **need** + prestige proximity. (The app passes lightweight team views with a computed
  needs map, so the engine stays pure.)
- `advancePortal(pool, teams, seed, finalize)` — a recruiting-like loop: suitors grow interest, transfers
  commit to their leader; a finalize pass signs every transfer with a real suitor (the rest go unsigned,
  i.e. leave the modeled league). Deterministic.

### App layer
- `openPortal` runs `portalLeaveProb` over **every** roster (skipping graduating seniors), removes the
  leavers into `S.portal.pool` as **Transfers** (a real Player snapshot — keeps yr/age/ov, NOT reset to a
  freshman — plus `iv` suitors), runs one opening AI round, recomputes ratings/ranks.
- `pursueTransfer` spends portal points to become a suitor / raise your interest.
- `closePortal` finalizes, then drops each committed transfer onto his new roster (`fromTransfer:true`);
  `rolloverSeason`'s **scholarship cap** (Phase 17, trims depth beyond each position's target to ~85)
  absorbs any net inflow. **Broken-promise departures now flow through the portal** — `resolvePromises` was
  simplified to just clear obligations (the portal models the exits).
- Retention: a **Motivator** / **Former Player** coach keeps more of his own players (`portalRetentionMult`).

### UI & save
A **Portal** view (`renderPortal`: your departures + the available-transfer board with position/availability
filters + pagination; `pursueTransfer` per row), a Home **portal card**, and **Portal in / Portal out** lines
in the offseason recap. `renderNav`'s whitelist gains `'portal'`. Save **v20** (`S.portal`, per-player
`fromTransfer`); `migrateState` v19→v20 backfills `portal:null`. New gate `npm run portallab` (17 checks);
`qa` (207) drives open → pursue → close → enroll → cleared-at-rollover. **Deliberately out of scope:** no
in-season portal window, no NIL bidding war / tampering mechanic, no scholarship-count micromanagement beyond
the roster cap, no coach-to-portal poaching of *signed* recruits.

---


## Phase 32 design — offseason training camp

Decided 2026-06-29 with AJ — "an offseason training camp thing that can kickstart progression for the year."
AJ's two scoping calls: the camp's downside is **injury + burnout risk** (a harder camp develops more but
breaks bodies + wears the room thin), and it's **free** (a pure strategy choice, no budget gate). Same house
discipline: a pure fenced engine validated by a node lab before any UI, a save bump, all gates green.

### Where it lives in the loop
Development already happens at rollover (`rolloverSeason` → `rolloverRoster` with `rateFor:p=>devRateFor(t,p)`),
and `devRateFor` is the established home for **controlled-team-only** dev multipliers (facilities → coords →
position coach → archetype → motor → press culture → morale). Training camp is one more such multiplier,
chosen by the coach for the upcoming offseason. It's a distinct offseason **step**: the Home advance walks
Hold National Signing Day → Close the transfer portal → **Open training camp** → roll over, so running camp
is a deliberate moment (not a passive setting). `campPending = over && !signing && !portalOpen && !S.camp`.

### Pure `CAMP ENGINE` (fenced, lab before UI)
`// === CAMP ENGINE (Phase 32) START/END ===` — depends only on `rng/clamp` + `injDur` (the shared SIM-block
severity roll), so `test/camplab.js` extracts the block (+ that one `injDur` line) and validates it offline:
- `CAMP_PLANS` — an **intensity dial**: Light (`devMult 1.06`, `injRate 0`, `moraleSeed +8`) · Standard
  (`1.16`, `0.013`, `0`) · Grueling (`1.30`, `0.048`, `−10`). Development scales up, injury risk scales up,
  the Week-1 room goes from fresh → neutral → worn. (No position-group **focus** — deliberately lean, one knob.)
- `campPlan(key)` / `campDevMult(key)` / `campMoraleSeed(key)` — table reads (unknown key → Standard).
- `campInjuries(roster, key, r)` — per-player `injRate` odds of a camp injury, severity from `injDur` (mostly
  day-to-day, a multi-week tail). Deterministic; returns `[{id,pos,name,weeks}]` (weeks>0 only).

### App wiring (three consumption points, all controlled-team-only)
- **Development:** `devRateFor` multiplies in `campDevMult(S.camp.plan)` when `team.id===S.teamId && S.camp`
  (sits next to the press/morale terms, under the same `clamp(rate,0.6,1.6)`).
- **Injuries:** in `rolloverSeason`'s team loop, **after** the offseason heal (`delete p.inj`), the controlled
  team rolls `campInjuries` (a `campR` rng keyed on `('camp'+year)`) and stamps `p.inj` onto the rolled-over
  roster — so camp injuries persist into Week 1 and heal weekly like any in-season injury (Phase 27). Recorded
  on `S.camp.injured` for the recap.
- **Morale:** `startSeason` seeds the controlled room's Week-1 morale to `clamp(50 + campMoraleSeed, 0, 100)`
  (after the usual neutral-room reset), so a grueling camp opens flat (the in-game spotlight / `moraleGameSkew`
  is slightly negative until it decays to neutral over ~3 weeks), a light camp opens hot.
- **Lifecycle:** `S.camp={plan}` is set on the camp screen → consumed at rollover (dev + injuries, stamped
  `applied:true`) → consumed at kickoff (morale) → **nulled**. So the season runs with `S.camp` null and camp
  re-prompts every offseason. Other teams never read `S.camp`, so the league dev envelope is untouched.

### UI
A **Training Camp** screen (`renderCamp`, `UI.view='camp'`, reached from the offseason advance) — three
intensity cards each showing `+N% dev`, injury risk (None/Low/High), and Week-1 mood, with a one-tap
"Run <name> →" (`data-tid="camp-<key>"`) that sets `S.camp` and rolls the season over. A camp line in the
Home **offseason recap** (plan name + 🩹 camp injuries).

### Save & validation
Save **v29** (`S.camp`, null until set in the offseason → `migrateState` v28→v29 is a structural no-op).
New gate `npm run camplab` (17 checks: three plans, dev + injury risk ordered by intensity, light is
risk-free, grueling injures more than Standard, injuries bounded 1–8wk + reference real roster players,
determinism). `qa` → 254 (the camp screen opens before rollover; a grueling camp applies, boosts `devRateFor`,
and opens the room worn down; camp is spent at kickoff). **Fifteen gates** now (adds `camplab`).

### Deliberately out of scope
One intensity knob — no **position-group focus** (a where-to-pour-reps allocation), no **AI camp model** (AI
teams develop off facilities/staff as before — camp is a player perk), no per-player camp assignment, no
multi-stage camp (install vs. conditioning). The first two are the obvious next polish if camp proves fun.

---


## Phase 39 design — redshirting & eligibility

Decided 2026-06-30 with AJ — the clearest mechanical gap in a multi-season roster sim: players just aged
`FR→SO→…→SR` with no eligibility management. The 8-class ladder always *had* an `RS-` track, but nothing ever
moved a player onto it — so the redshirt (CFB's core "preserve a year" lever) didn't exist. Phase 39 wires it
in, reusing the existing ladder + the Phase 27 availability machinery. House discipline: pure helpers in the
fenced ROLLOVER block, validated by `rolllab` before the UI, a save bump, all gates green.

### The model (matches real CFB, reuses the 8-class ladder)
A redshirt **preserves a year of eligibility**: instead of advancing to the next class, the player moves onto
the **RS version of his current level** — `FR→RS-FR` (not `FR→SO`), `SO→RS-SO`, etc. — so he spends **5 seasons
on the roster to play 4** (FR + RS-FR + RS-SO + RS-JR + RS-SR). Only the four non-RS classes can redshirt, and
**only once** (`p.rs:'used'` is the permanent marker; a player already on the RS track is ineligible — the
class itself encodes it). This is exactly the existing ladder; the `RS-` classes finally get *entered*.

### The lever (controlled-team only, like camp/morale)
Sparse per-player `p.rs`: `'on'` = redshirting this season, `'used'` = already spent. Designating a player
**holds him out of every game all season** — the app extends the Phase 27 unavailability set: `benchedFor(g)`
adds `p.rs==='on'` players (frozen into `g.out` like an injury → faithful replay), and the live fallbacks in
`gamePools`/`availRatings` read `p.inj>0||p.rs==='on'`. So a redshirt **drops the team's available rating**
exactly like an injury — that's the tangible tradeoff: forgo his contribution this year to bank an extra year.
You'd redshirt buried depth (≈ no rating cost) or a freshman you're stashing (a real cost = the decision).

### The pure rollover branch (fenced ROLLOVER ENGINE)
`REDSHIRT_TO={"FR":"RS-FR","SO":"RS-SO","JR":"RS-JR","SR":"RS-SR"}` + `redshirtClass(p)` (the RS target, or
null if ineligible/used). In `rolloverRoster`, before the normal advance: a designee (`p.rs==='on'`) who is
eligible **and** genuinely sat (the **4-game rule** — `gp≤4`, denying anyone who already played a real season)
advances to `redshirtClass(p)` instead of `NEXT_CLASS[p.yr]`, is stamped `rs:'used'`, and is pushed onto a new
`summary.redshirted` list; a wasted/stale designation (ineligible, or `gp>4`) is just cleared and he advances
normally. He still ages + **develops** the year. Single advance path (redshirt only chooses a different `nx`),
so the career/dev/peak logic is unchanged.

### Envelope safety
AI teams never set `p.rs`, so `rolloverRoster` is **byte-identical for the league** → `rolllab`'s league-
strength/aging/depth checks are untouched (the controlled-team-only pattern of camp/morale/press). Held-out
redshirts are symmetric with injuries in the availability layer, which was already envelope-validated.

### UI & save
A redshirt control + eligibility note on the **player sheet** (controlled team: "Redshirt this season" →
"Cancel redshirt"; states for *used* / *already played N games — can't redshirt*); a 🔴 **REDSHIRT** roster-row
badge; a 🔴 **Redshirted** line in the offseason recap. Save **v35** (sparse `p.rs`; `migrateState` v34→v35 is
a structural no-op — absent reads as "never redshirted, available"; `p.rs` auto-rides the columnar codec's
sparse side-object, no codec change). `rolllab` → **40** (`redshirtClass` eligibility; a sat FR → RS-FR +
`rs:'used'` + reported; the 4-game rule denies a >4-game designee and clears the flag; a redshirt lasts one
extra season — 5 vs 4; an undesignated roster reports none), `qa` → **276** (a designee is held out and records
nothing in his game; rollover converts him onto the RS track preserving a year; it's reported). **Sixteen
gates** (Phase 39 extends `rolllab` + `qa`; no new lab — it's a rollover-engine change).

### Deliberately out of scope
The 4-game rule is a **correctness gate**, not a "play him in 4 then sit" micro-manager (a designee is fully
held out — the strategic version of "redshirt"); no **medical redshirt** flow, no **AI redshirt** modeling
(invisible flavor — AI aging is unchanged), no eligibility *waivers* / COVID-year extras, no spring-game
position-battle layer. One lever (sit a young player to bank a year), read through the existing ladder.

---


## Phase 43 design — conference realignment

Decided 2026-06-30 with AJ — the last big multi-decade flavor piece. Over a long dynasty the conference map
should shift the way real college football's has: talent consolidates into super-conferences, and a program
that climbs earns an invite up (the dream for a coach building a Group-of-5 school into a power). The design
constraint: it touches scheduling, championships, revenue, and awards — but all of those already read
`team.conf` **live**, so realignment is just a bounded, deterministic mutation of `team.conf` at rollover, and
everything downstream follows for free. House discipline: a pure fenced engine + node lab before UI, a save
bump, all gates green.

### Pure `REALIGN ENGINE` (fenced, lab before UI)
`// === REALIGN ENGINE (Phase 43) START/END ===` (deterministic from `(seed, year)` via `rng`/`hashStr`), so
`test/realignlab.js` validates it offline:
- `isRealignYear(seed, year)` — realignment comes in **waves**, a seeded ~`REALIGN.CHANCE`(30%)/yr cadence
  (not every year — realignment is episodic).
- `realignMoves(teams, seed, year)` — `teams` = `[{id, conf, prestige}]`. Ranks conferences by **average
  member prestige**; the **power tier** is the top `POWER_CONFS`(4) *real* leagues (≥ `MIN_CONF` members, so a
  tiny 2-team conference can't rank as a super-conference; **Independent** is never a poacher or a destination,
  though a strong independent can be poached up). The power conferences **take turns, strongest first**,
  grabbing the top remaining **riser** (prestige ≥ `POACH_BAR`(72)) from a weaker league. **Bounded** so the
  league reaches equilibrium rather than collapsing: `MAX_MOVES`(4)/wave, a `POWER_CAP`(20) on each poacher,
  and a `MIN_CONF`(6) floor that protects a source league from being raided below viability. Returns
  `[{id, from, to}]`. Fully deterministic (candidates ordered by prestige then id — no rng in the move
  selection, only in the wave cadence).

### App layer — one mutation, everything follows
`applyRealignment()` runs in `rolloverSeason` **after the year ticks over** (so it aligns the upcoming
season), builds the lean view, calls `realignMoves`, then for each move sets `team.conf = to` and clears
`team.div` (the new league is flat unless it re-divisions). It records the wave on `S.lastRealign` (for the
recap) and fires a media headline. Because it runs before the kickoff that rebuilds the schedule, and because
**every consumer reads `conf` live**, the knock-on effects are automatic:
- `genSchedule` weights the new conference; a preset rivalry that just became **cross-conference** now
  auto-locks as a fixed leg (`rivalLegsForYear` keys off `A.conf === B.conf`), so rivalries survive realignment.
- `confChampGames` uses the new membership; `recomputeRanks` re-derives conf/div ranks.
- Revenue jumps/drops with `ECON_CONF_BASE[conf]` (a move up is a raise), and awards (All-Conference / conf
  POY) follow the new alignment. A move to a stronger league also means a **tougher schedule** — earned.

The controlled team can be the riser (win at a G5 school → climb prestige → get the call-up), and its move is
highlighted in the recap.

### Save & validation
Save **v39** (`S.lastRealign`; `migrateState` v38→v39 is a **structural no-op** — `team.conf` already exists
and is mutated in place, `S.lastRealign` is absent-safe). Nothing new is columnar. New gate
`npm run realignlab` (16 checks: seeded cadence + frequency + determinism; a wave poaches risers **up** into
the power tier, bounded by `MAX_MOVES`; source-floor + poacher-cap respected; a **settled** league with no
eligible risers produces no moves; Independent is never a destination). `qa` → 296 (a wave applied at a
realignment year moves a rigged riser up + actually changes `team.conf` + records it for the recap).
**Twenty gates** now (adds `realignlab`).

### Deliberately out of scope
No player **choice** in the matter (realignment is done *to* you by the school/AD, like real life — no
"accept the invitation?" prompt); no **relegation** of a weak power-conf program back down (waves only expand
the power tier — the dominant real dynamic); no **new** conferences forming or old ones formally dissolving (a
raided league just shrinks toward its floor); no **re-divisioning** (a team joins flat — `div` is cleared);
no TV-market / geography model beyond prestige (the "riser gets pulled up" heuristic).

---

## Phase 44 design — career-balance & economy pass

Decided 2026-07-01 with AJ, off a multi-season auto-sim playtest ("play a few seasons and see how it
feels"). The playtest surfaced four concrete problems the deep systems papered over: (1) the hot seat was
**brutally unforgiving** — an 8-4 blueblood coach fired in 4 years, every career a downward slide; (2)
**runaway budgets** — cash ballooned to $257M+ with no sink once facilities maxed; (3) a **recruiting
cliff** — deferring the board signed *zero* while AI teams signed 19-25, hollowing the roster; (4) high
**single-season variance** with no margin. Six fixes, each **envelope-safe** (a pure recalibration or an
app-layer/controlled-team-only addition), so the 20 validated gates hold. One save bump (**v40**).

### (1) Mandate + hot-seat curve (CONTRACT engine — pure)
The root cause: `mandateTier` demanded conf/playoff of good programs *every year* (an 86-prestige team was
told to make the playoff), `evaluateMandate` was binary met/missed, and the approval slope was steep — so
a solid-but-not-elite season stacked a season-delta AND a full mandate-miss penalty and bled the seat to a
firing. Fixes: lower the baseline tiers (`p>=90` playoff · `p>=87` conf · `p>=52` bowl · `p>=42` winning ·
else progress — most good programs land at **bowl**, met by ≥6 wins), a **two-year honeymoon** (was one),
monotonic win thresholds (progress ≤ winning, killing the old "6→7 after a bad year" ratchet), **graded
evaluation** (`evaluateMandate` → `{met, grade:'met'|'near'|'miss'}`; a bowl-eligible / within-2-wins miss
is `'near'`), a grade-aware `mandateApprovalDelta` (near = `-max(2, round(w·0.4))`; boolean back-compat
kept for the lab), and a softened `seasonApprovalDelta` slope (×3→×2). `firingDecision` is unchanged (it
already required tenure≥2 for the two-under-bar path + a <12 meltdown), so the medialab firing checks hold.

### (2) Recruiting + portal passive floor (app layer)
The AI concentrated-effort pass **skips the player's team** (so the player must act), and the AI only pushes
recruits it's *already* a suitor on — a hands-off program was a suitor on ~13 of 3,400 and signed 0.
`autoRecruitWeek` (in `resolveRecruitingWeek`, default `S.recruiting.autopilot!==false`) has your **staff**
work the board: each week it auto-offers to top-fit uncommitted recruits to maintain ~22 live pursuits, then
pushes the priorities with a **modest** budget (`aiBudget(me)*0.85`, no coach mods) via the same
`aiActionGain`/`aiPriority` the AI uses — so a hands-off program lands a real, **below-average** class, but an
engaged coach targeting manually still out-recruits it. A matching `autoPortalPursue` (in `closePortal`)
pursues incoming transfers to roughly replace departures, so the portal isn't a one-way exit. Both are
app-layer + controlled-team-only → the fenced RECRUIT/PORTAL engines + `reclab`/`portallab` are untouched. A
plan-card toggle (`autopilotToggle`) turns it off for full manual control.

### (3) Economy sink (`resolveFinances`)
Two additions curb the runaway: an **operating cost** that scales with program size (`prestige·130k +
Σfac·300k`) so revenue doesn't all fall to idle surplus, and a **soft anti-hoard** — cash above `revenue·1.5`
decays (excess × 0.3), so a long dynasty can't pile up nine-figure budgets. Both only tighten the books
(negatives are untouched → the "budget can go negative" econlab check holds), and the `hcSalary=0` default
path is unchanged. Multi-season budgets now settle ~$200M for a mega-program instead of climbing unbounded.

### (4) Prestige drift (`seasonPrestigeDrift`, at rollover)
A program's standing drifts toward its results — `((w) − winExpectation·games)·0.18`, bounded ±1.6/yr, applied
via the fractional `_pp` accumulator before ranks/realignment. **Self-limiting** (climbing raises the win
expectation, so it plateaus) and two-way (a chronic loser slips), so the league map shifts realistically over a
dynasty without destabilizing (`rolllab` tests the pure `rolloverRoster` with fixed prestige → unaffected).

### (5) Carousel upward mobility (`coachPoachOffers`, pure — MEDIA engine)
The mirror of `coachOpenings`: a coach who's **over-performing** (met mandate + approval ≥70) gets **courted by
a better program** (weighted above his current job, a real step up the sweet spot). `settleSeasonApproval` posts
`S.coach.jobOffers`; a Home card lets him **leave for it** (`takeJob` generalized to work off a voluntary offer,
not just a firing) or stay. So the ladder runs upward, not only down through firings.

### (6) Variance (`aiDefCall`)
The AI DC's disguise roll consumed an `r()` from the main play stream, desyncing (re-rolling) every controlled-
team game vs the neutral baseline — balanced on average but high-variance. It now draws from a **dedicated rng
substream** (`dcR`, seeded off the game seed), so scheming vs your offense applies its intended modifier without
churning the rest of the game. AI-vs-AI is still byte-identical (the DC never fires there), so `simlab` holds.

### Save & validation
Save **v40** (`S.coach.jobOffers`; `migrateState` v39→v40 backfills it null — everything else is behavior-only).
`contractlab` → 35 (graded eval, two-year honeymoon, softened penalty), `medialab` → 52 (poach-up offers only
court a hot coach, only by better jobs), `econlab` → 36 (anti-hoard grounds budgets, prestige drift signed +
bounded + ~zero at expectation), `qa` → 298 (the recruiting autopilot builds a class hands-off; a poach-up move
works). **Twenty gates** (Phase 44 extends `contractlab`/`medialab`/`econlab`/`qa`; no new lab — it's a tuning
pass over existing engines). Validated with a 10-season auto-sim: a blueblood keeps the job + climbs to #1
(was fired in 4), a bottom program shows a survivable rebuild that trends up, budgets stay grounded ~$200M, and
portal churn is roughly neutral.

### Deliberately out of scope
No AI use of the recruiting/portal autopilots (AI already recruits via its own brain); no contract *negotiation*
(you accept or ignore offers); the poach-up offer is take-it-or-stay (no counter/leverage); prestige drift is
results-only (no brand/market model). This is a balance pass, not new systems.

---


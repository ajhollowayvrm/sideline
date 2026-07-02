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
- **Phase 10 — Player personality (fogged traits).** ✅ DONE. Pure engine + dev/sim wiring +
  `traitlab` (16 checks) + save **v12** + the **UI fog chips** (roster row + player sheet + recruit
  sheet, sharpening with tenure/scouting) all landed; seven gates green (`qa` 154). Each player has **two fogged
  temperament traits** — **Motor** (work ethic → biases development) and **Composure** (clutch vs.
  streaky → biases in-game variance) — that **mesh with coach identity**. Both are stored sparsely
  (like `p.gs`/`p.dev`), read through a **scouting fog band** (the `scoutedCeiling`/`recScouted`
  pattern), and sharpen with scouting confidence (recruits) or time-in-program + coaching room
  (roster). Pure fenced `TRAIT ENGINE`, a node lab (`traitlab`) before any UI, save **v12**. See
  "Phase 10 design — player personality" below.
- **Phase 11 — Program legacy & legends.** ✅ DONE. Notable players who graduate become permanent
  **program legends** (`team.legends`, league-wide), and history now *matters* mechanically. Graduates
  accumulate **career stat milestones** (`p.career`) + **peak OVR** (`p.peakOv`) at each rollover (in the
  fenced ROLLOVER engine, summed from `p.gs` right before it's wiped); the pure fenced **`LEGACY ENGINE`**
  scores **stature** (`legendStature`: honors ladder + career milestones + peak, each saturating →
  *Cult Hero → Program Great → All-Time Great → Immortal*) and `enshrineLegends` banks the **top 12 by
  stature** per program into `team.legends` at rollover (every team — `stampHonors` now stamps **all**
  conferences so AI legends carry real résumés). The three payoffs: a deep ring confers a small standing
  **`legacyAura`** folded into `recruitFit`; a new recruiting action **alumni visit** (`alumniVisit` +
  `RECRUIT_COSTS.alumni`, each legend carries `app` appearances reset at kickoff) where a relevant alum
  (`alumniBoost` = stature × position/home-state relevance × Former-Player/HS-Legend coach amp) lands a
  big interest boost; and **legend-coaches** (`legendCoachCandidates`) occasionally re-enter the carousel
  for their alma mater (flagged `fromLegend`/`legendOf`, rating off stature). **No seeding** — history is
  earned from played seasons. Also added the real named **position trophies** (Outland, Davey O'Brien,
  Doak Walker, Biletnikoff, John Mackey, Butkus, Jim Thorpe, Lou Groza, Ray Guy; Defensive POY surfaced
  as the Bednarik) — crowned in `computeAwards`, stamped by name, weighted in the stature ladder, and
  shown on the Awards tab. UI: a **Ring of Honor** on the Program page, the alumni picker on the recruit
  sheet, an enshrinement line in the offseason recap, an "Alum" carousel badge. Save **v13**
  (`team.legends`, `p.career`, `p.peakOv`, `rec.alumni`); `npm run legacylab` (31 checks) + `awardlab`
  grew to 25 (trophies). See "Phase 11 design — program legacy & legends" below.
- **Phase 12 — Postseason (bowls & playoff).** ✅ DONE. A postseason now sits between the regular season
  and the offseason. After week 15, `finishRegularSeason` crowns the season awards (the Heisman & co. are
  decided **pre-bowls**) + locks Signing Day, then `startPostseason` builds a **12-team College Football
  Playoff** (top-4 seeds bye into the quarters) + a slate of named **bowls** for the other ≥6-win teams
  (`S.postseason`). The controlled team's bowl/playoff games are **watchable** (the same watch-then-commit
  viewer as the regular season — `advancePostseason` re-sims deterministically, so the watched score is the
  committed score); other games auto-resolve, and once you're out, one tap sims the rest. `endPostseason`
  crowns the champion and settles each team's finish into **three recruiting payoffs**: a small persistent
  **prestige** bump (fractional accumulator), a **`postseasonBoost`** folded into next year's `recruitFit`,
  and a one-time **revenue** payout read by `resolveFinances`. Pure fenced `POSTSEASON ENGINE` (seedPlayoff
  / playoffRoundMatchups / genBowls / postseasonPayoff) + `npm run postlab` (20 checks). UI: a **Bracket**
  Season tab (replayable games), a Home postseason card, champion banners + a `🏆 National Champion` row on
  the awards cards, `team.titles`, and a postseason line in the offseason recap. The Defensive POY had been
  surfaced as the Bednarik in Phase 11. Save **v14** (`S.postseason`, per-team `postseasonBoost`/
  `lastPostseason`/`titles`/`_pp`). See "Phase 12 design — postseason" below.
- **Phase 13 — The NFL Draft & position factories.** ✅ DONE. Every offseason (at rollover) a league-wide
  **NFL draft** picks the best ~96 graduates across **3 rounds** (`runDraft`): `draftProjection` grades each
  on **peak OVR** (the bulk) + **honors** + **career** (reusing the LEGACY ladder), with a small seeded
  jitter for draft surprises. A program that keeps producing high picks at a position becomes a **factory**
  there (`team.factory[pos]`, built from `pickFactoryValue`, **decaying** so it reflects recent production)
  — a standing **recruiting pull** (`factoryPull`, ≤ +0.15 fit) on recruits at that position, folded into
  `recruitFit`. ~12% of recruits are **rebels** (`rec.rebel`, stamped in `genRecruits` off a per-recruit
  rng so the board stays byte-identical) who are **repelled** by factories — they want to be THE guy
  somewhere else. Pure fenced `DRAFT ENGINE` + `npm run draftlab` (22 checks). UI: a **Draft** board (Season
  tab + reachable in the preseason, picks by round, your picks highlighted), a **Pro Pipeline** section on
  the Program page (your `POS-U` factory chips), a draft-picks line in the offseason recap, and a rebel
  chip + factory note on the recruit sheet. Save **v15** (`S.draft`, per-team `factory`). See "Phase 13
  design — the draft & factories" below.
- **Phase 14 — Recruiting calendar (signing in the offseason).** ✅ DONE. Recruiting's culmination moved out
  of the regular season (the Phase 4 compromise) into the **offseason**, in two periods. During the season a
  commitment is now a **verbal** (`committedTo`, not yet `signed`); `S.recruiting.stage` runs `'open'` →
  `'national'` → `'closed'`. Entering the offseason (after the bowls/playoff) auto-fires the **Early Signing
  Period** (the firm verbal commits sign + a final push-points budget is granted); a distinct **National
  Signing Day** advance from Home then resolves the contested holdouts and closes the class, before rollover
  enrolls it. `advanceRecruiting` gained a `finalize` flag so in-season passes are verbal-only (reclab stays
  green; the app just controls *when* the finalize/Signing-Day pass runs). Save **v16** (`S.recruiting.stage`).
  See "Phase 14 design — recruiting calendar" below.
- **Phase 15 — Conference championships (real CFP format).** ✅ DONE. A **Championship Week** now sits
  between the regular season and the playoff. `finishRegularSeason` hands off to `startConfChampionships`
  (pure fenced **`CHAMPIONSHIP ENGINE`** — `confChampGames` picks each conference's title-game pair: the
  top two by `rankScore`, or the two **division winners** for a divisioned conference like the Sun Belt;
  higher seed hosts; independents get none). The controlled team's title game is **watchable** (same
  watch-then-commit viewer, tagged `kind:'champ'`); others auto-resolve. `finishConfChampionships` crowns
  champions (`team.confTitles`), pays a modest prestige + revenue reward (`CONF_TITLE_PAYOFF`), then runs
  the **awards** (now incl. title-game stats — decided post-Championship-Week, pre-bowls, like real life)
  and seeds the playoff. **`seedPlayoff` reworked** for real CFP auto-bids: the **four highest-ranked
  conference champions take the top-4 byes**, a guaranteed **5th** champion auto-bid is slotted by rank
  (down to seed 12), and the rest fill at-large by `rankScore` (falls back to top-12 with <4 champions).
  Save **v17** (`S.champWeek`, per-team `confTitles`); new gate `npm run champlab` (19 checks); a Home
  Championship-Week card + a Program **Trophy Case**. See "Phase 15 design — conference championships" below.
- **Phase 16 — Decommits (verbal flips).** ✅ DONE. A **verbal** commitment (`committedTo` set, `signed`
  false) can now **flip** to a rival before Signing Day. In `advanceRecruiting` (RECRUIT ENGINE): passive
  interest now also grows for verbal commits (rivals keep pushing), then a **flip pass** (in-season only —
  never on a `finalize`/Signing-Day pass) decommits a verbal to the strongest rival that has pulled ahead
  by ≥ `REC.DECOMMIT_GAP`, with a probability that scales with the gap. **Signed players never flip.** The
  player can lose their own verbals (toast ⚠) and **flip** others' (toast 🔁): `offerRecruit` no longer
  blocks a committed-but-unsigned prospect (only signed), the prospects board lists flippable verbals, and
  the recruit sheet shows a "just a verbal — flip him" prompt. Flips are tagged with a transient
  `rec._flipped={from,to}` for the toasts. Save **v18** (behaviour-only, no-op migration); `reclab` grew to
  26 (flip happens / signed-locked / finalize-locked / determinism), `qa` to 199. See "Phase 16 design —
  decommits" below.
- **Phase 17 — Full national recruit board (~3,400).** ✅ DONE. The board is no longer top-300 — `genRecruits`
  now builds the **whole national class** (`REC.POOL=3400` ≈ 134 teams × a ~25-man class): a handful of 5★,
  a few hundred 4★, then a deep 3★/2★ tail (a new 2★ tier, `recruitFit`/suitor `target`s span the prestige
  range, suitor spread widened so every program has a reachable pool). The faked prestige baseline in
  `classScore` is gone — class scores are the real sum of landed value. The pool serializes **columnar**
  (`RECRUIT_PKEYS`/`encPool`/`decPool`, wired into `encodeState`/`decodeState` under the `_sv` envelope) so
  a mid-season save stays ~2.5 MB (well under the ~5 MB cap; decode reads both the old plain pool and the
  new `_cp` form). `rolloverRoster` gained a **scholarship cap** (trims the weakest depth beyond each
  position's target down to ~85) so a full class can't balloon a roster. The board UI got **filters**
  (position / star / **home state** / availability incl. flippable verbals) + **pagination** (Load more).
  ~90% of the national pool signs (the capacity-limited tail backfills as walk-ons at rollover, as before).
  Save **v19**; `reclab` grew to 27 (full pool, star mix, substantial classes, convergence), `qa` to 200
  (columnar pool round-trip). See "Phase 17 design — full national board" below.
- **Phase 18 — Transfer portal (full two-way).** ✅ DONE. An offseason **transfer portal** now sits between
  National Signing Day and rollover. Pure fenced **`PORTAL ENGINE`**: `portalLeaveProb` (a player's odds of
  entering the portal — buried depth + a broken playing-time promise push; captains, starters, and stars on
  winning teams stay; coach retention lowers it), `portalFit` (a program's pull on a transfer — a positional
  **need** + prestige proximity to his overall), and `advancePortal` (a recruiting-like commit loop —
  programs with a hole chase the available transfers, who commit to their leader; a finalize pass signs
  everyone with a real suitor). App layer: `openPortal` (after NSD) pulls leavers off **every** roster into
  `S.portal.pool` (a transfer keeps his real class/age/ov — not reset to a freshman); the player works the
  board (`pursueTransfer` spends portal points to raise interest); `closePortal` finalizes + drops each
  committed transfer onto his new roster; `rolloverSeason`'s **scholarship cap** (Phase 17) trims any
  resulting overflow. Broken-promise departures now flow through the portal (`resolvePromises` just clears
  obligations). UI: a **Portal** view (board + your departures, filters + pagination), a Home portal card,
  and Portal-in/out lines in the offseason recap. Save **v20** (`S.portal`, per-player `fromTransfer`); new
  gate `npm run portallab` (17 checks); `qa` (207) drives open → pursue → close → enroll → cleared at
  rollover. See "Phase 18 design — transfer portal" below.
- **Phase 19 — Full media suite.** ✅ DONE (three sub-phases). A media layer over the data the sim
  already produces, plus real career stakes. **19a (✅ DONE):** a pure fenced **`MEDIA ENGINE`** —
  `computePoll` (an AP-style Top 25 with **inertia**, so teams lag rather than teleport; distinct from the
  committee's `rankScore`), `gameStoryTag` (classify a result: upset / ranked / blowout), and `mkStory`
  (headline+body templates with seeded phrasing). The app's `updateMedia` (in `advanceWeek`) refreshes
  `S.media.poll` + pushes the week's stories into `S.media.feed` (cap 60) from scores, the weekly POW/COW,
  poll risers, and 4★+ commits/flips; one-off `mediaEvent`s fire at conf titles / the Heisman / the national
  championship / the portal. UI: a **Media Center** hub (`UI.view='media'` — News / AP Poll / Your Coverage,
  with written previews+recaps), a Home headlines teaser, and the Season **Top 25** tab now renders the AP
  poll with ▲/▼ movement. Save **v21**; new gate `npm run medialab` (17). **19b (✅ DONE):** a coach
  **approval rating + the hot seat** + interactive **press conferences**. `MEDIA ENGINE` grew:
  `winExpectation`/`gameApprovalDelta`/`seasonApprovalDelta`/`approvalUpdate` (bounded, mean-reverting),
  `hotSeatTier`/`firingDecision` (fire only on *sustained* failure), and `pressPrompt`/`pressEffect` (a
  context-keyed question bank → a small `{approval, buzz, dev}` bag). Approval persists on **`S.coach`**
  (`approval`/`tenure`/`approvalHistory`), moves weekly from results (`updateMedia`) and settles at season
  end (`settleSeasonApproval` in `enterOffseason`); a weekly **optional press card** folds `buzz` into
  `recruitFit` (guarded `team.mediaBuzz`) + a `dev` focus into `devRateFor` (`S.media.pressDev`); an
  approval/hot-seat strip on Home + Program; a "pressure mounts" feed story when the seat heats up. Save
  **v22** (`medialab` → 40). **19c (✅ DONE):** the hot seat pays off — `firingDecision` (in
  `settleSeasonApproval`) flags a sustained slump, and after the league rolls over `triggerCoachingSearch`
  opens a **Coaching Search** (`coachOpenings` — mostly lesser/lateral jobs); `takeJob` switches `S.teamId`,
  banks the stint on **`S.coach.career`**, and resets approval/tenure, or `retireCoach` ends the run with a
  **career retrospective**. Save **v23** (`S.coachSearch`, `phase:'Retired'`; `medialab` → 46). The **AP poll
  stays cosmetic** (the playoff seeds off `rankScore`/conf champions). See "Phase 19 design — media suite" below.
- **Phase 20 — Player personality drives reactions (Ego + morale).** ✅ DONE. The media (and the surrounding
  narrative) now lands **differently on each player** by personality. A **third fogged trait — Ego** joins
  Motor/Composure in the `TRAIT ENGINE` (`genTraits` now returns `{mot,comp,ego}`; `ego` is a core column in
  `SAVE_PKEYS`, appended for back-compat) — media-receptiveness: high feeds on hype + is rattled by criticism,
  low tunes out the noise. A **persistent per-player morale** (`p.morale`, sparse, **controlled team only**)
  is moved by media events scaled by `egoWeight(ego)` and decays toward neutral. All movers are **mean-neutral
  at the average** (`moraleUpdate`/`moraleDecay`/`moraleDevMult`/`moraleGameSkew`/`moralePortalPush`), so an
  untouched roster reproduces the pre-Phase-20 dev/sim/portal envelopes exactly. **Four wirings:** press
  conferences (a `mood` valence per choice moves each player's morale × ego, in `answerPress`), results + decay
  (in `updateMedia`), **development** (`moraleDevMult` folds into `devRateFor`), the **in-game spotlight** (a
  small ± edge in `simSides`/`moraleSpotlight`, scaled by roster morale and whether it's a ranked/marquee game —
  outside the pure `simEngine`), and the **transfer portal** (`moralePortalPush` raises `portalLeaveProb` for
  your soured players). Morale resets to neutral each kickoff; Ego persists for a career. UI: an **Ego** fog chip
  (roster/player/recruit sheets) + an **open morale** mood chip on your roster + a Locker-room read on the
  approval strip. Save **v24** (structural no-op migration); `traitlab` → 30. See "Phase 20 design —
  personality reactions" below.
- **Phase 21 — Schemes (identity, matchups & fit).** ✅ DONE. Every team runs an offensive + defensive
  **scheme**, every player innately **prefers** one on his side (which may *not* be what he's rated for),
  and your **coach** brings a scheme he loves. Pure fenced **`SCHEME ENGINE`** (depends only on
  `hashStr`/`POS`): 7 offensive schemes (Air Raid · Spread · Spread-Option · Pro Style · Smashmouth · West
  Coast · Multiple — *expanded 2026-06-29*: Spread (balanced, pistol run + RPO) split from the run-first
  Spread-Option, plus a true-neutral **Multiple**) × 5 defensive (4-3 · 3-4 · Nickel/Cover-3 · Bear ·
  Tampa-2); `SCHEME_EDGE` is a **doubly-balanced** 7×5 rock-paper-scissors matchup table (every row AND
  column sums to 0; Multiple is the all-zero neutral row); `schemeFit` (+1 in his scheme, −1/(n−1) out,
  side-aware so offense's deeper 7-scheme menu still gives E[fit]=0 — defense stays −0.25) aggregates over
  the top-11 into `rosterSchemeFit`; `schemeDelta(off,def)` returns
  the mean-zero rating delta (matchup edge + roster fit). All three effects — matchup, fit, and a coach
  **buy-in** (`schemeBuyIn`, app layer, when the team runs the coach's own scheme; Off/Def Genius amplifies)
  — fold into effective ratings **OUTSIDE** `simEngine` in `simSides` (like `coachGameEdges`/`moraleSpotlight`),
  so the SIM block + determinism gate stay byte-identical and the validated scoring envelope holds on average;
  the swing is ≤ ~4 rating pts so a real OVR gap still decides games ("the best players just win"). **No
  rng-stream change**: team schemes derive from `hashStr(team.id)` (mutable — the player installs his own at
  takeover and can re-install from Program), a player's preferred scheme from `hashStr(p.id)` (innate, no save
  column). UI: scheme pickers in the new-game wizard, a Program **Schemes card** (your schemes + roster fit +
  buy-in) with an **install** sheet (a multi-season project — recruit/develop players whose instincts fit),
  a **fogged** scheme read on the roster row / player sheet / recruit sheet (??? → "likely X" → the name,
  sharpening with tenure/scouting like the traits), and a weekly **matchup preview** on the Home card. Save
  **v25** (per-team `offScheme`/`defScheme`, `S.coach.offScheme`/`defScheme`; migration backfills team schemes
  from id + adopts them as an existing coach's preference). New gate `npm run schemelab` (35 checks); `qa` → 249.
  See "Phase 21 design — schemes" below. *(Next: the interactive field + play-calling — the resumable
  seed+decision-log engine, the SVG field, defer-to-OC with a live mode toggle — then special packages +
  in-game adjustments, where scheme tendency folds into `passProb`.)*
- **Phase 22 — Interactive play-calling (the field).** ✅ DONE (the call-the-game core). You can now
  **coach your own game** snap by snap. The pure `simEngine` gained an `opts.decide(ctx)` / `opts.decideFor`
  hook at the **run/pass** and **4th-down** decisions: the OC always draws its own suggestion (so the rng
  STREAM is stable no matter what you do), then `decide` may override the *choice*, never the randomness — so
  a game is deterministic from **(seed + your calls)**, and with no `decide` it's **byte-identical** to the
  pre-Phase-22 engine (simlab proves an always-defer coach reproduces the AI score *and box* over 30 seeds).
  The UI is an **opt-in** "🎮 Coach this game" on the watch viewer → an interactive **SVG field** (hand-rolled
  yard lines + hash marks + ball + first-down marker in your accent color; offense attacks →), a play-call
  prompt (Run / Pass / Defer-to-OC, or FG / Punt / Go-for-it on 4th, OC suggestion highlighted), a live
  **mode toggle** (`Key moments` / `Full control` / `Auto`, switchable mid-game) and `Sim the rest →`. The
  driver **re-runs the pure engine from scratch** after each call (sub-ms), feeding back the recorded calls to
  advance to the next decision or the final — no engine state to serialize. The calls bank onto **`g.calls`**
  at commit, so `simGame`/`buildGameLog` reproduce the exact play-called game → **watch == commit** and
  replayable. Non-controlled games + the classic animated watcher are untouched. Two engine refinements
  shipped with it: **scheme run/pass tendency** now folds into the OC's `passProb` (`schemeTendency` — Air
  Raid airs it out, Smashmouth grinds; the five values average ~0 so it shifts play *selection*, not the
  league envelope), and a **predictability tax** (`keyedPen`) — a defense keys on a one-dimensional
  offense, so over-relying on run OR pass gets stuffed (a balanced/AI mix stays under the threshold and pays
  ~nothing → the validated envelope holds; both are rng-free, so determinism/replay are intact). Together
  they make a **smart mix beat spamming one play** (a scaled sim: run-spam fell from 39→11 pts/g and a 95%→27%
  win rate, while a smart mix tops the table). Save **v26** (optional `g.calls`, absent = AI); `simlab` → 34
  (Phase 22 hook + the predictability balance), `qa` → 236, plus an offline play-calling sim (1,000 games:
  defer==AI byte-exact, 6,000 call-replays byte-exact, strategies diverge sanely). See "Phase 22 design —
  interactive play-calling" below.
- **Phase 23 — Per-matchup resolution.** ✅ DONE (the keystone that makes the roster feel alive). A play
  no longer resolves off one team rating — it keys off the **specific matchup**: the targeted receiver is
  covered by a defender assigned **by depth** (their WR1 vs your CB1, deterministic → a persistent
  storyline), and a run meets a **front** defender; each is measured as a **mean-zero deviation** from his
  side's weighted-mean (`matchEdge`, `MATCH_W=0.42`), so a stud-on-scrub mismatch tilts the play while the
  league envelope is preserved by construction (`simlab`: mean 23.7, all leaders in range, INTs balance).
  New **coverage box stats** (`cvTgt`/`cvCmp`/`cvYds`/`cvTD`, plus the INT now credited to the man in
  coverage) ride in `p.gs` (no save bump — sparse/absent-safe), and pair exactly with the offense
  (league-wide `cvCmp==rec`, `cvYds==reYds`, `cvTgt==pAtt`). UI: the play feed names the matchup
  (`pass to WR (vs CB)`), and the **coach view shows a live matchup panel** — your receivers' production +
  your coverage with a 🔥 **"cooked"** flag (built from a `boxInto` the driver captures live, surviving the
  pause). `simlab` → 39, `qa` → 237. Determinism + watch==commit unchanged (the matchup math is
  rng-deterministic). See "Phase 23 design — per-matchup resolution" below.
- **Phase 24 — In-game adjustments.** ✅ DONE (coverage + pep-talk). Mid-game, the coach can now **react**:
  reassign coverage (put your shutdown corner/safety on their WR1) and **settle a rattled player** (a small
  effective-rating bump). Both are recorded on a deterministic **timeline** (`g.adjusts = [{at:playNo, plan}]`)
  read by `planAt(pno)` — an adjustment applies only **going forward** (the watched score never rewrites on
  re-run) and **replays on commit** (`gameDecideOpts` passes `adjusts`/`adjustFor` to `simGame`/`buildGameLog`),
  so watch==commit holds. The engine consults the plan when the controlled team is on **defense** (`coverDef`
  override → a specific defender shadows a receiver **slot**) and folds pep-talk bumps through a boosted
  effective OVR (`bov`) into `matchEdge`; an empty timeline is **byte-identical** to the AI game (validated).
  UI: a **🛡 In-game adjustments** sheet on the coach view (at any pause) — per-opponent-receiver coverage
  pickers + a "settle a player down" toggle, with the live 🔥-cooked panel right there to inform it. Save
  **v27** (optional `g.adjusts`, absent-safe); `simlab` → 44 (shadowing a stud WR cuts him 117→52 yds;
  pep-talk helps; deterministic; forward-only; AI-inert), `qa` → 239. See "Phase 24 design — in-game
  adjustments" below.
- **Phase 25 — Penalties & discipline.** ✅ DONE. Pre-snap fouls (false start / offside) now occur per
  snap, driven by team **composure** (Phase 10) + situation (road noise, late-game frustration), with the
  coach's **"calm them down"** lever (the last piece of AJ's original three-part vision). Pure: `teamComp`
  (avg starter composure) → `penRate(team, calm, q)`; a flag spends 5 yards + replays the down (capped per
  drive so it always terminates; deterministic from rng → determinism + watch==commit intact; mostly
  symmetric → the envelope holds). Per-game tallies surface via `penInto`. The lever rides in the existing
  Phase 24 adjustment plan (`plan.calm`) — so it replays on commit, **no save bump**. UI: 🚩 flag lines in
  the play feed, a penalties row in the live matchup panel, and a **"🚩 Calm them down"** toggle in the
  adjustments sheet. `simlab` → 47 (realistic rate ~7/team; an undisciplined team flags more; calm halves
  them), `qa` → 241. See "Phase 25 design — penalties & discipline" below.
- **Phase 26 — Injuries & fatigue (in-game).** ✅ DONE. Depth now matters *within a game*: a small per-snap
  injury chance (`INJ_RATE`) knocks a player **out for the game** (`injured` set → skipped from selection,
  so the backup is forced in and his matchup shows — a QB injury presses the backup QB via `qbList`), and a
  **heavily-used ball-carrier fades late** (pure `fatigueCost(touches, q)` → a bounded OVR cost folded into
  `bov`/`matchEdge`, rewarding rotation). In-game only — **pure, deterministic (from rng), resets each game,
  no roster mutation, no save bump**; symmetric → the envelope holds. Surfaced via `injInto` (a 🩹 "Out" line
  in the matchup panel + injury events in the feed). `simlab` → 52 (injuries occur ~1/game + deterministic;
  fatigue zero-early / threshold / bounded), `qa` → 241. See "Phase 26 design — injuries & fatigue" below.
  *(Cross-week injury persistence is now Phase 27; a defensive-playcalling/blitz layer + special packages
  remain the open threads.)*
- **Phase 27 — Week-to-week injuries.** ✅ DONE. Injuries now **persist across weeks**: a player hurt in a
  game gets `p.inj` = weeks out (severity rolled by the pure `injDur`), sits out his team's games while
  it's >0, and **lowers his team's effective rating** (`availRatings` recomputes the top-11 over available
  players — losing your star QB for weeks actually drops your offense, next man up via `qbList`), then heals
  a week at a time (`healWeek`, after each advanced week/round) and fully at the offseason rollover. The pure
  engine stays pure — the **app** applies injuries once per real game (`applyInjuries` on `g._inj`, never on
  determinism re-sims) and decrements. Crucially, each game **freezes its availability** at kickoff
  (**`g.out`** = ids that sat) so a *past* game replays faithfully (greatest-games / the determinism check)
  even after rosters change — `gamePools`/`availRatings` use the frozen `benched` set when given, else fall
  back to live `p.inj`. UI: a 🩹 **OUT (Nwk)** badge on the roster row + a Home **Injury Report**. Save
  **v28** (sparse `p.inj`, absent = healthy; `g.out` rides on the schedule). `simlab` → 55 (duration mix +
  bounded; an injured starter is benched, backup plays; multi-week injuries occur), `qa` → 245 (rating
  drop, held out, heals weekly, report renders; replay stays faithful). See "Phase 27 design — week-to-week
  injuries" below. *(Open: defensive play-calling + special packages.)*
- **Phase 28 — Defensive play-calling.** ✅ DONE — the other half of the chess match. When the controlled
  team is on **defense**, the coach calls the front/coverage as a **pre-snap guess** (it doesn't see the
  play): **Base / Blitz / Cover / Run-stop**, rock-paper-scissors with the offense's run/pass. The `decide`
  hook now also fires when `def.id===decideFor` (`phase:'def'`), and the call shifts the play — blitz → more
  sacks but boom plays + gashed by the run; cover → takes the pass, soft vs the run; run-stop → stuffs the
  run, opens the pass; base → neutral. **AI defense is always 'base' (a true no-op)** so the league envelope
  is untouched and only the player's calls swing it (a good read = edge, a bad guess = burned). Defensive
  calls record into the SAME `g.calls` stream as offensive ones (consumed in play order) → they **replay on
  commit** (watch == commit) with **no save bump**. UI: the coach view shows Base/Blitz/Cover/Run-stop (+
  "Defer to DC") whenever you're on defense, gated by the same Key/Full/Auto mode toggle. `simlab` → 59
  (cover cuts opponent passing 254→156, run-stop cuts rushing 185→59 but gives up more through the air; base
  == AI byte-for-byte), `qa` → 246 (defensive calls are part of the deterministic coached game; a cover-heavy
  game held the AI to 19-3 vs the autopilot's 27-21). See "Phase 28 design — defensive play-calling" below.
- **Phase 29 — AI defensive coordinator.** ✅ DONE — now on **offense** you face a scheming DC, not a passive
  base look. The pure `aiDefCall(ctx, rv)` picks base/blitz/cover/run-stop from down & distance + the
  offense's run/pass **tendency so far** (it keys a one-dimensional attack, reading the `usage` counts) with
  a seeded roll for disguise. The engine invokes it (consuming one rng draw) **only when `off.id===aiDefVs`
  and the defense isn't player-controlled** — i.e., only against the controlled team's offense — so **AI-vs-AI
  games are byte-identical** (the `aiDefVs` opt is inert when that team isn't on offense → the league envelope
  + `simlab` are untouched). The app passes `aiDefVs:S.teamId` through `simGame`/`buildGameLog`/the interactive
  driver, so the DC reproduces deterministically (watch == commit) with **no save bump**. Net effect: a
  predictable offense gets shut down (a scaled sim: an all-pass attack falls 10.6→6.3 pts/g vs the DC), while
  a balanced attack is barely keyed (standard downs are ~62% base) — you must mix to beat it. `simlab` → 63
  (situational calls; keys tendency; inert for AI-vs-AI), `qa` → 247 (your predictable offense works harder
  vs the DC). See "Phase 29 design — AI defensive coordinator" below.
- **Phase 30 — Adaptive AI offensive coordinator.** ✅ DONE — the mirror of Phase 29, so calling **defense**
  is a real chess match too. When you're on defense, the AI OC reads **your defensive-call tendency** (a
  `dusage` mix of base/blitz/cover/run-stop) and biases its run/pass to counter it (`aiOffPassAdj`): you
  stack the box (run-stop) a lot → it throws; you blitz/cover a lot → it runs (blitz gets gashed, cover =
  light box). It only fires when **`def.id===aiOffVs`** (you're the defense) and shifts `passProb` (no extra
  rng → deterministic, watch == commit, **no save bump**); `aiOffVs` is **inert** in AI-vs-AI games, so the
  league envelope is untouched. You have to **vary your defensive calls** or get exploited — exactly the
  pressure the predictability tax + AI DC put on your offense. `simlab` → 68 (`aiOffPassAdj` direction +
  sample gate; the OC throws more on a run-stop-happy D — 249→314 pass yd/g; inert for AI-vs-AI), `qa` → 248
  (a predictable all-run-stop defense gives up more vs the adaptive OC). See "Phase 30 design — adaptive AI
  offensive coordinator" below.
- **Phase 31 — Special packages.** ✅ DONE — the last item from AJ's original message ("bring in the DT to
  lead-block on the goal line"). The offensive play-call gains two **personnel packages**: **Heavy**
  (goal-line power — extra blockers; a power run that crushes short yardage / the goal line via the pure
  `heavyRunBonus(togo,los)` but is dead weight on long downs) and **Spread** (empty 4-wide — a pass that
  stresses coverage for +completion/+yards, but with **fewer blockers it's exposed to the blitz** for extra
  sacks). They're a fourth/fifth value on the offensive `decide` (`heavy`/`spread`), **player-only** (the
  OC/AI never auto-selects them, so AI-vs-AI + `simlab` are byte-identical), ride in the same `g.calls`
  stream (replay on commit → watch == commit), and need **no save bump**. UI: Run / Pass / **Heavy** /
  **Spread** buttons on the offensive play-call with a one-line hint. They mesh with the defensive calls
  (heavy is stuffed by run-stop, gashes a light box; spread is shredded by the blitz), and a smart short-
  yardage user of heavy converts more. `simlab` → 72 (`heavyRunBonus` curve; heavy outscores no-package on
  short yardage; spread gains more pass yards but takes more sacks), `qa` → 249 (packages callable + replay
  on commit). See "Phase 31 design — special packages" below. *(This closes the original game-day vision;
  open polish: AI use of packages, defensive nickel/dime personnel, a richer route/play-type palette.)*
- **Phase 32 — Offseason training camp.** ✅ DONE. A once-a-year, **controlled-team-only** lever to
  kickstart the year's development, run as an offseason step **after the transfer portal, before rollover**
  (the advance walks: Hold National Signing Day → Close the portal → **Open training camp** → roll over).
  Pure fenced **`CAMP ENGINE`** (depends only on `rng/clamp` + `injDur`): an **intensity dial** —
  `CAMP_PLANS` Light (×1.06 dev, no risk, a fresh +8 room) · Standard (×1.16, low injury risk, neutral) ·
  Grueling (×1.30 dev, real injury risk, a worn-down −10 room). `campDevMult` folds into `devRateFor` for the
  controlled team (consumed during rollover's development pass); `campInjuries(roster,key,r)` rolls camp
  injuries (severity via the shared `injDur`) onto the **rolled-over** roster as `p.inj` (persist into the
  season + heal weekly, like any injury — applied after the offseason heal); `campMoraleSeed` seeds the
  controlled room's **Week-1 morale** at kickoff (decays toward neutral). `S.camp={plan}` is set on the camp
  screen, consumed at rollover (dev + injuries) and at kickoff (morale), then **cleared** — so it re-prompts
  every offseason and the season runs with `S.camp` null. UI: a **Training Camp** screen (three intensity
  cards showing dev boost / injury risk / Week-1 mood, one tap to run + roll over) + a camp line in the
  offseason recap (incl. 🩹 camp injuries). Save **v29** (`S.camp`, null until set in the offseason →
  structural no-op migration). New gate `npm run camplab` (17 checks: intensity orders dev + risk, light is
  risk-free, grueling hurts more, injuries bounded + reference real players, determinism); `qa` → 254 (the
  camp screen opens before rollover, a grueling camp applies + boosts dev + opens the room worn down, camp is
  spent at kickoff). See "Phase 32 design — training camp" below. *(Open polish: a position-group focus + an
  AI camp model — left out deliberately to keep it lean.)*
- **Phase 33 — Recruiting rework (intent queue + scouting facility + AI brain).** ✅ DONE. Recruiting moved
  from **immediate-apply** actions to a **set-an-intent → resolve-at-the-week-change** model, and the AI
  finally takes **discrete weekly actions** of its own. A new **`fac.scouting`** facility (1–10, upgradable
  like the others) drives the weekly point budget (`weeklyPoints` is now scouting-keyed, not prestige — base
  + `scouting*1.6` + the coach-archetype term, so Recruiter still matters). Each week the player **sets one
  queued action per recruit** (`S.recruiting.intents`, keyed by recruit id — scout/pitch/visit/promise/alumni;
  `setRecIntent` **reserves** points up front and captures the action's full effect at set-time incl. the
  game-day visit bonus + coach mods; a second action on the same recruit **replaces** the first; `clearRecIntent`
  refunds). At the week change `applyPlayerIntents` lands every queued action, **then** the engine's AI brain
  acts, **then** interest is recomputed and commitments resolve — so a recruit's new interest takes the whole
  competitive field into account at once. **AI recruiting brain** (in the fenced `RECRUIT ENGINE`,
  `advanceRecruiting` gained a `playerTeamId` param that skips the human's team): each AI program gets a weekly
  budget from its **scouting facility** (`aiBudget`) and spends it on a few **priority** targets (`aiPriority`
  — fit × traction × need), a concentrated `aiActionGain` push — so a rival pouring resources into a kid shows
  as a visible interest spike, and a strong-scouting program out-recruits an equal-prestige rival. The AI is a
  **no-op on the finalize (Signing Day) pass** and on the player's own team, so convergence/cap/decommit
  behaviour is preserved (cycle still ~92% signed). UI: the recruit-sheet action rail now **sets/replaces a
  queued intent** (selected action highlighted, ✓), a "This week's plan" card (`planCard`) lists every queued
  action + points reserved with clear buttons, the board row shows a ⏳ chip, the Home card shows a queued
  count, and the Program/Team-browser facility lists gained a **Scouting** bar + upgrade. Save **v30**
  (per-team `fac.scouting`, `S.recruiting.intents`; `migrateState` v29→v30 backfills both); `reclab` → 35
  (AI concentrated effort + scout actions, the scouting-budget head-to-head, budget scales with the facility,
  the scouting payoff), `qa` → 257 (intent queues/replaces/resolves, scouting drives the budget, the AI scout
  action evaluates blue-chips). Also a **scouting payoff + AI scout action**: scouting now has a recruiting
  effect for *everyone* — a well-evaluated recruit is recruited harder (`recScoutMult`, ×1.0 unscouted → ×1.3
  fully scouted, pure upside so the scout=0 baseline is unchanged), folded into both the player's queued-action
  gains and the AI's pitches; the **AI brain spends a minority of its budget scouting** under-evaluated targets
  (`REC.AI_SCOUT_*`), raising the **shared** `rec.scout` — so heavily-recruited blue-chips become well-known to
  everyone (the player gets free intel on them) while the deep tail stays foggy (the player's scouting edge).
  See "Phase 33 design — recruiting rework" below. *(Open polish: a "use a special to take two actions on one
  recruit" perk — left out of v1 deliberately.)*
- **Phase 34 — Recruiting legibility (the weekly board report).** ✅ DONE. The Phase 33 loop was mechanically
  solid but week-to-week *flat* — you queued actions and watched raw interest numbers. This pass makes the week
  **readable**: after each in-season resolution, a **board report** explains *what moved and why* per recruit.
  Pure fenced **`recruitReaction(c)`** (in the RECRUIT ENGINE block, no rng/DOM/S — the app computes the diff
  `c`, it returns `{text, tone}` with tone ∈ good/warn/bad/neutral) reads a recruit's week into one line on a
  headline ladder: commits/decommits/flips first, then a **rival pulling ahead** ("⚠️ Cooling — ABC is pushing
  hard"), then your action's result keyed on whether the pitch matched his `prefs` ("🔥 Loved your NIL pitch —
  exactly what he wants" vs "didn't move the needle — not his priority"), then drift (rank up/down, quiet week).
  App: `recruitPreSnaps` snapshots each board recruit (my interest/rank, the full suitor `iv` map, my queued
  intent) **before** resolution; `buildRecruitReport` diffs against the resolved board (my Δ, the biggest rival
  mover + whether he now leads, commit/flip state) into `S.recruiting.report = {week, reactions:[…]}` (transient,
  rebuilt each week, top-10 by urgency). UI: a **"Last week's board report"** card on the recruiting view (above
  the plan card — read it, then set this week's plan; rows are colored by tone + show your interest Δ + open the
  recruit sheet) and a one-line **teaser** on the Home recruiting card. **No save bump** — `report` rides on the
  recreated-at-kickoff `S.recruiting` (absent-safe). `reclab` → 44 (the reaction ladder: commit→good, flip→bad,
  rival-surge→warn, pref-matched pitch→good, off-priority→neutral, decisive events outrank your action, always
  returns text + a known tone), `qa` → 259 (a weekly report is generated with readable reactions over a season;
  the report card renders). See "Phase 34 design — recruiting legibility" below.
- **Phase 35 — Week-to-week recruiting depth (drama + scarcity + upkeep).** ✅ DONE. The remaining "improve
  recruiting week to week" ideas, shipped as one batch on top of the Phase 33/34 loop. **(1) Season ripple** —
  your Saturday result energizes or cools your board: pure `gameRecruitVibe(my,opp,myRank,oppRank)` (a ranked
  statement win is huge, a blowout loss stings, bounded −6..+9) is applied app-side (`applyGameRipple`) to your
  board's interest, **in-state recruits most**, with a one-line note on the weekly report. **(2) Commitment
  windows** — a blue-chip (4★+) who's ready first **announces a decision a week out** (`rec.decideWeek`, set in
  the fenced commit pass instead of committing) and then **commits to whoever leads when the window elapses** —
  so a rival (or you) can still make a final push; the finalize pass commits any pending window. **(3) Weekly
  scarcity** — the intent queue is now an **array of ≤2 actions per recruit**: a weekly **double-down** token
  (`R.doubles`, +1 for a Recruiter) lets you stack a 2nd action on one kid (else a 2nd action replaces the
  first); **official visits are capped** per week (`visitCap`, 1 / 2 for a Recruiter); and **diminishing
  returns** (`repeatFalloff`) tax spamming the *same* pitch on a recruit (`rec.hits`), rewarding variety.
  **(4) Decay-on-neglect** — a board recruit you don't work that week **cools on you** (`decayNeglect`, player-
  only; your own verbals decay too, so neglect risks a flip — pairs with Phase 16 decommits). All four are
  **player-only or envelope-neutral**: the season ripple + decay touch only *your* interest, and the commitment
  windows just delay/announce a commit the engine would make anyway, so `reclab` convergence holds (~90% signed).
  UI: the action rail toggles actions (✓), shows the double-down/visit-cap readout, and flags a recruit's
  decision date; the report surfaces the ripple note + a "🗓️ announced his decision Week N" reaction; the
  board row shows a 🗓️ window chip. Save **v31** (`S.recruiting.intents` arrays + `S.recruiting.doubles`;
  sparse `rec.decideWeek`/`rec.hits` ride in the columnar side-object — `migrateState` v30→v31 converts old
  single intents to arrays + backfills `doubles`). `reclab` → 53 (windows announce/resolve + still converge,
  the tail never windows; `gameRecruitVibe` ordering/bounds; `repeatFalloff` monotonic), `qa` → 262 (double-down
  stacks a 2nd action; the visit cap holds; decay cools a neglected recruit; a window opens over a season). See
  "Phase 35 design — week-to-week recruiting depth" below.
- **Phase 36 — AI recruiting depth + finalist lists.** ✅ DONE. The polish pass that makes the AI match the
  player's Phase 35 depth, plus the headline drama piece. **(1) Finalist lists** — a maturing, well-recruited
  recruit (late enough + a lead suitor ≥ `REC.FINAL_BAR`) **narrows to a top-`REC.FINALISTS`(4) shortlist**
  (`rec.finalists`); from then on **only finalists can grow/flip/win him** (`isFinalist` gates the growth / AI /
  decommit / commit passes), so cut suitors freeze out of the race. The **finalize (Signing Day) pass ignores
  the shortlist** (he signs with his leader regardless — this is what keeps convergence ~91%). **(2) AI visits**
  — the AI brain occasionally makes a big **concentrated push** on its top target (`REC.AI_VISIT_P`, two actions'
  budget for ~2.2× the gain), a visible swing that mirrors the player's official visit. **(3) AI momentum** —
  `aiBudget` gains a season-record term (`team.rec`): a hot program recruits harder, a cold one less, centered/
  bounded and **guarded for rec-less lab teams** so the convergence cycle is unchanged. All three are
  envelope-safe: finalists only narrow a commit the engine would make (and finalize ignores them), the AI
  visit/momentum are budget-flavored concentration, and reclab still converges (91%). App/UI: being **cut**
  blocks offering/working a recruit in the open race (the flip path for a committed-elsewhere verbal is
  untouched); the report calls out "✅ Made his top 4" / "✂️ Cut from his finalists"; the board row shows a 🎯
  Finalist / ✂️ Cut chip and the recruit sheet a finalists card. Save **v32** (sparse `rec.finalists` rides in
  the columnar side-object → no-op migration). `reclab` → 60 (finalists set/respected + cut suitors freeze + a
  meaningful share get a shortlist + still converge; the AI visit produces an outsized push; momentum responds to
  the record + is rec-less-neutral), `qa` → 264 (recruits narrow to a shortlist over a season; a cut recruit
  can't be offered). See "Phase 36 design — AI recruiting depth + finalists" below.
- **Phase 37 — Recruiting polish (AI ripple · NIL bidding · visit calendar).** ✅ DONE. The three loose ends
  from the Phase 36 note. **(1) AI reacts to individual results** — `applyGameRipple` is now LEAGUE-WIDE
  (`applyLeagueRipple`): every team's Saturday result nudges the interest of the recruits it's chasing
  (in-state most), so a rival on a hot streak really does push harder. A **win energizes**; for the **player** a
  loss also **cools his board** (the Phase 35 feel), but the league-wide AI ripple is **positive-only + skips
  marginal (<30) suitor relationships**, so it never compounds negatively across the league and drops the tail
  below the Signing-Day bar. **(2) NIL bidding** — a new **money** action (`nil`, pays from `team.budget`, not
  recruiting points): a tiered bid (`NIL_TIERS` Modest/Strong/Blockbuster) buys interest via the pure
  `nilGain($M, nilWeight)`, biggest on a recruit whose **top priority is NIL** and amplified by your **NIL
  collective** (`fac.nil`); **AI programs bid too** (`applyAINil`, app-layer, budget-scaled), so the player must
  out-bid rivals on NIL-valuing kids. **(3) Official-visit calendar** — a **season-long** official-visit budget
  (`S.recruiting.visitsLeft`, `SEASON_VISITS`=12) on top of the weekly cap, decremented when a visit resolves, so
  visits are a resource you plan across the year. All three are **app-layer** (the fenced engine + `reclab`
  envelope are untouched). UI: a 💰 **NIL offer** button + tier picker on the action rail (shows budget + the est.
  boost), the visit readout shows weekly **and** season-remaining, the report still carries the ripple note. Save
  **v33** (`S.recruiting.visitsLeft` + NIL `nilSpend` on intents; `migrateState` v32→v33 backfills the visit
  budget). `reclab` → 63 (`nilGain` monotonic-in-$ / NIL-pref-weighted / saturating), `qa` → 267 (a NIL bid
  reserves budget + raises interest; the season visit budget spends down; a team's result ripples to its board).
  Tuning note: the league ripple + NIL wars make recruiting **more contested** — the full-pool sign rate settles
  ~80% (the larger tail backfills as walk-ons at rollover, as designed). See "Phase 37 design — recruiting
  polish" below. *(One loose end remained — a true official-visit weekend scheduler — landed in Phase 38.)*
- **Phase 38 — Official-visit weekend scheduler.** ✅ DONE. The last recruiting loose end from Phase 37:
  official visits are now a **calendar tied to home-game weekends**, not an abstract season count + per-week
  intent. A new pure fenced **`VISIT ENGINE`** (`weekendQuality({myRank,oppRank,oppPrestige})` → a multiplier
  **centered ≈ 1.0**, bounded [0.6, 1.7], rising with opponent rank/prestige + my form + a **marquee** both-
  ranked clash; `weekendTier` → Quiet/Solid/Big/Marquee) **replaces** the old flat ×1.5 game-day bonus with a
  mean-~1.0 quality multiplier (so the visit-interest envelope is preserved). App layer: `S.recruiting.visitPlan
  = {week:[recruitId]}` — you **book** recruits onto upcoming home weekends (`bookVisit`/`unbookVisit`, reserving
  a `visitsLeft` season slot, capped at `weekendCap` (2, or 3 for a Recruiter) per weekend); on advancing
  through that week `applyWeekendVisits` (in `resolveRecruitingWeek`) boosts each booked recruit by `20 ×
  weekendQuality × visit-mods`, marks `visited`, and notes it on the board report. The old visit path is gone
  (`'visit'` dropped from `RECRUIT_COSTS`/`buildIntent`/`applyPlayerIntents`/`setRecIntent`; `isGameDayVisit`/
  `queuedVisits` removed; `visitCap`→`weekendCap`). UI: a new recruiting **Visits** tab (a home-weekend calendar
  with tier badges + booked recruits + a per-weekend booking picker), a **"🏟️ Schedule visit"** weekend-picker
  on the recruit sheet, and visit counts on the plan/Home cards. Save **v34** (`S.recruiting.visitPlan`;
  `migrateState` v33→v34 backfills `{}` — recreated at kickoff, so it only patches an in-flight save). New gate
  `npm run visitlab` (20 checks: quality monotonic in opponent/form/marquee, bounded, neutral≈1.0, mean over a
  representative slate≈1.0, tier ladder, determinism); `qa` → 273 (book onto a home weekend, the weekend cap +
  season budget hold, a non-home week can't host, resolving raises interest + marks visited + clears the plan,
  the Visits tab renders, v34 + a `visitPlan` codec round-trip). See "Phase 38 design — visit scheduler" below.
- **Phase 39 — Redshirting & eligibility.** ✅ DONE. The 8-class ladder always had an `RS-` track
  (`FR, RS-FR, … SR, RS-SR`) but nobody ever *entered* it — redshirting makes it mean something. A
  **controlled-team coach lever** (sparse `p.rs`): designate a young, eligible player to redshirt → he's
  **held out of games all season** (reuses the Phase 27 `benchedFor`/`g.out` availability machinery — drops
  from `availRatings` exactly like an injury, frozen for faithful replay) but still **develops**, then at
  rollover advances onto the **RS track at the same level** (`FR→RS-FR` instead of `FR→SO`) — preserving a
  year of eligibility, so he spends **5 seasons on the roster instead of 4** (stamped `rs:'used'`, redshirt
  once). Pure helpers in the fenced ROLLOVER block (`REDSHIRT_TO`, `redshirtClass(p)`); `rolloverRoster`
  gained the redshirt branch + a `summary.redshirted` list, gated by the **4-game rule** (`gp>4` denies the
  redshirt — designating a guy who already played a full season correctly wastes it). **Envelope-safe:** AI
  never sets `rs`, so the league rollover is byte-identical → `rolllab`'s strength/aging checks are untouched
  (same controlled-team-only pattern as camp/morale). UI: a redshirt toggle + eligibility note on the player
  sheet, a 🔴 REDSHIRT roster-row badge, a redshirt line in the offseason recap. Save **v35** (sparse `p.rs`,
  absent = never redshirted/available → no-op migration). `rolllab` → 40 (`redshirtClass` eligibility; a sat
  FR becomes RS-FR + `rs:'used'` + reported; the 4-game rule denies/clears a >4-game designee; a redshirt
  lasts one extra season 5-vs-4; an undesignated roster reports none), `qa` → 276 (a designee is held out of
  the game and records nothing; rollover converts him onto the RS track; it's reported). See "Phase 39 design
  — redshirting" below.
- **Phase 40 — Rivalries & trophies.** ✅ DONE. Real, named rivalries with **game trophies** that change
  hands, plus **emergent rivalries** that form from playing a lot or in big moments. Pure fenced **`RIVALRY
  ENGINE`** (depends only on `clamp`/`hashStr`): a `RIVALRIES` table of ~40 authentic rivalries (Iron Bowl,
  Egg Bowl → Golden Egg, The Game, Red River, Apple Cup, Territorial Cup, …) keyed by real abbr; `rivalryGain`
  (intensity a single meeting adds — close games / ranked clashes / big stages (bowl < champ < playoff) /
  upsets, bounded 2–22); `bornRivalry` (deterministic name + trophy for an emergent one); `intensityTier`
  (Simmering → Heated → Bitter → Blood Feud). App layer: `S.rivalries` (established, with the **trophy holder**
  + series record, persist across seasons) + `S.rivalryHeat` (not-yet-born pairs' accumulating heat);
  `bumpRivalries` records every resolved game (regular week / championship / bowl / playoff) — the winner
  **takes the trophy**, established rivalries heat up, and a **new rivalry is BORN** (christened + given a
  trophy, a media event) when a pair's heat crosses the bar (~4 ranked classics, or many routine meetings);
  `decayRivalries` cools things a touch each offseason. **Cross-conference presets are locked into the
  schedule** (`rivalLegsForYear`, alternating host) so the marquee non-conf rivalries happen yearly.
  **Stakes fold into existing systems** (the rank-based "marquee" hack is now rivalry-aware): approval
  (`gameApprovalDelta` +rivalry — beating a rival means more, losing stings; non-rivalry byte-identical),
  recruiting ripple (`gameRecruitVibe` +rivalry), visit-weekend quality (`weekendQuality` +rivalry marquee),
  and media (a rivalry story per notable game + a "rivalry is born" event). UI: a 🔥 rivalry banner on the
  Home matchup card (name · trophy · series · who holds it), a **Rivalries** card on the Program page
  (trophies held + each rivalry's tier/series/holder), toasts when a trophy changes hands or a rivalry is
  born. Save **v36** (`S.rivalries`/`S.rivalryHeat`; `migrateState` v35→v36 seeds the presets — they ride
  plainly on `S`, no codec change). New gate `npm run rivalrylab` (22 checks: gain direction/stage-ladder/
  bounds, the born bar needs sustained/big heat, tier ladder, preset table well-formed, deterministic
  emergent names); `visitlab` → 22 (rivalry weekend outdraws a neutral one); `qa` → 281 (presets seeded,
  winning takes the trophy, approval amplified, a rivalry is born, the banner + card render). See "Phase 40
  design — rivalries & trophies" below.
- **Phase 41 — The all-time record book.** ✅ DONE. A league-wide **Record Book** that celebrates the deep sim.
  The sim wipes `p.gs` every rollover, so — like the Ring of Honor — records are **captured as they happen**
  into a persistent ledger (`S.records`), not reconstructed. Pure fenced **`RECORD ENGINE`** (no S/DOM): a
  **category registry** `RECORD_DEFS` (28 categories across four buckets — **single-game**, **single-season**,
  **career** for players; **team** for programs) + `emptyRecords()` + `applyRecord(records,bucket,key,value,
  meta)` (the "keep the max" primitive — a strictly-greater positive value sets a new record and returns
  `{broke, prev}`; a tie keeps the original holder). App capture: `captureGameRecords(boxes,stage)` runs once
  per **real advance** (regular week / championship / postseason — alongside `computeWeeklyHonors`/
  `bumpRivalries`, so it's off the determinism-re-sim path) for single-game player + team points/margin
  records; `captureSeasonRecords()` runs at the **top of `rolloverSeason`, before `p.gs` is wiped**, for
  single-season records and **career** records (career-to-date via the ROLLOVER engine's `addCareer`, so a
  climbing 4-year star updates the mark each year). The controlled team breaking an all-time record fires a
  toast + a media note (`notifyRecords`). UI: a **Record Book** view (`UI.view='records'`, in the nav
  whitelist) reached from a button on the Season page — four sections, each row = label · value · holder ·
  team · year · detail, with **your program's records glowing in your accent color**. Save **v37** (`S.records`;
  `migrateState` v36→v37 backfills an **empty** book — records accrue from played games, no seeding; rides
  plainly on `S`, no codec change). New gate `npm run recordlab` (12 checks: registry well-formed + unique
  keys, `applyRecord` keeps the max / ignores lower / a tie holds / non-positive never records / stores value
  + meta); `qa` → 286 (fresh book empty at new game, a monster game sets + reports the single-game record, the
  team points record, rollover-time season + career capture, the view renders). See "Phase 41 design — the
  record book" below.
- **Phase 42 — AD expectations & a contract.** ✅ DONE. Frames the existing hot seat (Phase 19b/c) with explicit,
  legible stakes: each preseason the **AD sets a mandate**, and you coach on a real **contract**. Pure fenced
  **`CONTRACT ENGINE`** (depends only on `clamp`): `seasonMandate(prestige,tenure)` — a prestige-scaled goal
  (progress → winning → bowl → conference → playoff; year one is a **honeymoon**, one tier easier);
  `evaluateMandate(m,ctx)` — met/missed from the season (a playoff goal needs a berth, a bowl goal is met by
  ≥6 wins, higher goals subsume lower); `mandateApprovalDelta` — the approval swing (missing stings more than
  meeting rewards; a tougher goal weighs more), **folded into the existing `settleSeasonApproval`** so the
  mandate drives the seat; `initialContract(prestige)` (years + salary, a blueblood job pays more/longer),
  `buyoutOf(c)`, and `contractExtension(prestige,approval,met,yearsLeft)` (offered only when you're
  overperforming — met + secure + the deal running down / a standout year). App: `S.coach.contract`/`mandate`/
  `extensionOffer`/`lastMandate`; the mandate is set at kickoff (`startSeason`), evaluated at season end
  (`settleSeasonApproval` → approval move + `lastMandate` for the recap), a year ticks off the deal, and a
  strong season posts an **extension offer** (`acceptExtension` adds years + a raise); an **expired contract
  the school declines to renew** is a firing path alongside the Phase 19c slump (`fireReason`). The **head
  coach's salary is now a real program cost** — `resolveFinances` gained an optional `hcSalary` (default 0 →
  `econlab` byte-identical) that the controlled team pays, so a big deal constrains the budget. UI: an **AD &
  Contract** card on Home (the mandate + a live "on track?" read, the contract's years/salary/buyout, and an
  **Accept extension** button when offered) + a mandate met/missed line in the offseason recap. Save **v38**
  (`S.coach.contract`/`mandate`/`extensionOffer`; `migrateState` v37→v38 backfills a prestige-scaled contract
  for the current job). New gate `npm run contractlab` (23 checks: mandate scales with prestige + softens year
  one, evaluate reads a season, approval swing signs/weights, contract scales + buyout tracks the money,
  extension offered only when overperforming); `qa` → 292 (contract at new game, mandate at kickoff, meeting it
  earns + accepts an extension, missing on an expiring deal triggers non-renewal, the card renders). See
  "Phase 42 design — AD expectations & contract" below.
- **Phase 43 — Conference realignment.** ✅ DONE. Over a long dynasty the conference map shifts: strong
  programs get poached up into the super-conferences, and a G5 program that climbs the prestige ladder can earn
  an invite to a power league. Pure fenced **`REALIGN ENGINE`** (deterministic from `(seed, year)` via
  `rng`/`hashStr`): realignment comes in **waves** (`isRealignYear` — a seeded ~30%/yr cadence, not every
  year); `realignMoves(teams,seed,year)` ranks conferences by **average member prestige**, takes the top
  `POWER_CONFS`(4) real leagues (≥ `MIN_CONF` members — a tiny 2-team conf can't rank as "power"; Independent
  is never a poacher/destination) as the **power tier**, and they **take turns (strongest first) poaching the
  best remaining riser** (prestige ≥ `POACH_BAR`) from a weaker league — **bounded** (`MAX_MOVES`/wave, a
  `POWER_CAP` on the poachers, a `MIN_CONF` floor on the sources, so the league reaches equilibrium as
  super-conferences fill rather than collapsing). App: `applyRealignment()` runs at rollover (for the upcoming
  season, after the year ticks over), mutates `team.conf` (clears `div` — the new league is flat) and records
  the wave on `S.lastRealign`; **everything downstream reads `conf` live** — `genSchedule` (conference
  weighting + a now-cross-conf preset rivalry auto-locks via `rivalLegsForYear`), `confChampGames`, revenue
  (`ECON_CONF_BASE`), and awards. So a move to a stronger conference automatically means more money + a tougher
  slate. UI: a 🔀 realignment line in the offseason recap (your move highlighted) + a media headline. Save
  **v39** (`S.lastRealign`; `migrateState` v38→v39 is a structural no-op — `team.conf` already exists and is
  mutated in place, `lastRealign` is absent-safe). New gate `npm run realignlab` (16 checks: seeded cadence +
  frequency, risers poached up into the power tier, bounded, source-floor + poacher-cap respected, a settled
  league produces no moves, Independent never a destination, determinism); `qa` → 296 (a wave moves a rigged
  riser up + changes `team.conf` + records it). See "Phase 43 design — conference realignment" below.
- **Phase 44 — Career-balance & economy pass.** ✅ DONE. A tuning pass off a multi-season playtest that found
  a punishing hot seat, runaway budgets, and a recruiting cliff. **Six fixes, all envelope-safe.** **(1) Mandate/
  hot-seat curve** (CONTRACT engine): baseline mandate tiers lowered (most good programs are asked to *reach a
  bowl*, not win it all; conf/playoff reserved for true bluebloods), a **two-year honeymoon** (was one), win
  thresholds made monotonic (the "6→7 after a bad year" ratchet is gone), and **graded evaluation** —
  `evaluateMandate` now returns `{met, grade:'met'|'near'|'miss'}` where a respectable miss (bowl-eligible / within
  2 wins) is a **light** sting, not a full failure; `mandateApprovalDelta` takes the grade (boolean back-compat),
  and `seasonApprovalDelta`'s slope softened (×3→×2). Net: a good-not-great season no longer spirals a coach out.
  **(2) Recruiting + portal passive floor** (app layer): a **staff autopilot** (`autoRecruitWeek`, default on,
  toggle on the plan card) auto-offers + pushes a class-worth of good-fit pursuits when you don't, so a hands-off
  program lands a real (below-average) class instead of an empty one — deliberately modest (staff budget, no coach
  mods) so an engaged coach still out-recruits it; a matching **portal autopilot** (`autoPortalPursue`) pursues
  incoming transfers to fill your holes. **(3) Economy sink** (`resolveFinances`): operating costs now scale with
  program size + a **soft anti-hoard** (cash far above a season's revenue decays), so budgets stay grounded instead
  of ballooning to nine figures. **(4) Prestige drift** (`seasonPrestigeDrift`, at rollover): a program's standing
  drifts toward its results (a G5 winner climbs, a blueblood that craters slips) — bounded + self-limiting, so the
  ladder runs two ways. **(5) Carousel upward mobility** (`coachPoachOffers`): a strong, mandate-meeting season gets
  you **courted by a better program** — a Home card lets you leave for it (`takeJob` generalized to a voluntary move)
  or stay. **(6) Variance**: the AI DC's disguise roll (`aiDefCall`) now draws from a **dedicated rng substream**,
  so scheming vs the controlled offense no longer desyncs the whole play stream (less rng churn in your games).
  Save **v40** (`S.coach.jobOffers`; `migrateState` v39→v40 backfills it null — everything else is behavior-only).
  Labs: `contractlab` → 35 (graded eval + honeymoon + softened penalty), `medialab` → 52 (poach-up offers),
  `econlab` → 36 (anti-hoard + prestige drift), `qa` → 298 (recruiting autopilot builds a class hands-off; a
  poach-up move works). Validated with a 10-season auto-sim playtest: a blueblood keeps the job + climbs to #1
  (was fired in 4 yrs), a bottom program shows a survivable rebuild, budgets stay ~$200M (was runaway $257M+),
  and portal churn is roughly neutral (was a one-way drain). See "Phase 44 design — career-balance pass" below.
- **Phase 45 — Player identity (nicknames · known-for · legacy · cult status).** ✅ DONE. Makes an individual
  player feel like a *person* remembered for specific things — almost entirely **derived**, so it's near-free
  across 11k players. Pure fenced **`IDENTITY ENGINE`** (depends only on `hashStr`/`clamp` + the TRAIT reads +
  a player's data — no DOM/S, so `test/identitylab.js` validates it offline): **`jerseyNo`** (position-plausible,
  deterministic from the id), **`nickname`** (a flavor pool chosen by dominant trait — trench players get grit
  not speed — with an **earned** overlay that supersedes it once a real résumé milestone hits: Heisman→"The
  Franchise", 8k pass yds→"The General", 30 sacks→"The Closer"; **gated** so a freshman shows none and earns it
  once established), **`knownFor`** (one earned descriptor from honors→career→traits — "2× All-America CB",
  "6,400-yd career passer", "A relentless worker"), **`backstory`** (home state + stars + a trait tag), and
  **`fanFavorite`** (an emergent Overachiever/Hometown-Hero/Homegrown-Star badge for an over-performing
  controlled-team contributor). **Signature moments** (`p.moments`, sparse, controlled-team only): `captureMoments`
  runs once per real advance beside `captureGameRecords`, so a monster single game ("504 pass yds, 7 TD vs KENN
  (2026)") is **remembered** — and `legendSnap` carries it onto the Ring-of-Honor snapshot at graduation.
  `playerRecMeta` gained a `pid` so the player sheet's **`playerLegacy`** section can show career totals +
  **all-time records he holds** + his moments. UI: jersey # + nickname + fan-favorite badge on the roster row;
  an identity header + Career & legacy block on the player sheet; nicknames/known-for + signature moments on the
  Ring of Honor, plus a **retired-numbers** banner for a program's Immortal legends. Save **v41** (sparse
  `p.moments`; `migrateState` v40→v41 is a structural no-op — everything else is derived, nothing to store). New
  gate `npm run identitylab` (26 checks: jersey bands + determinism, the nickname gate + earned overlay + trench
  awareness, knownFor/backstory always sensible, fan-favorite triggers); `qa` → 302 (jersey/nickname/known-for
  render; a monster game is remembered + carries onto the legend). See "Phase 45 design — player identity" below.
- **Deliberate non-goals** (out of scope unless we revisit): no live viewer for *arbitrary* games
  (only the controlled team's game is watchable/replayable/coachable, so advancing a week stays fast). This is
  a design choice, not a backlog.

---

## Phase 10 design — player personality (fogged traits)

Decided 2026-06-28 with AJ. The goal: make an individual player feel like a *person* the coach
reads and develops, **without** fighting college football's "factory" reality (a player is on the
roster ~3–4 years, then gone). Design constraint that drives every decision below: **personality
must pay off at moments that already exist** in the loop, and must be **cheap** (every per-player
field multiplies by ~11k players league-wide). So: two traits, two payoffs, stored sparsely,
revealed through fog.

### The two traits (and only two, to start)
Each `Player` optionally carries:
- **`mot`** (Motor / work ethic) — drives **development**. A high-motor 3★ can out-develop a
  coasting 4★ (the best story college football tells).
- **`comp`** (Composure) — drives **in-game variance**. High = consistent + clutch; low = streaky
  (boom-bust), wobbles late in close games.

Stored as small integers (~0–100, default-absent = "average, unscouted"), serialized **only when
present** — same sparse-extra treatment the columnar codec (`encRoster`) already gives `gs`/`dev`/
`honors`. A roster with no traits scouted yet costs ~zero extra bytes. Generated deterministically
from the world seed in `genRoster` (a third trait is intentionally left out — keep the factory lean;
revisit only if two prove too thin). *(Revisited in **Phase 20**: a third trait, **Ego**, + a persistent
**morale** were added to make the media land per-player — see "Phase 20 design".)*

### Fog — reuse the ceiling pattern exactly (do NOT invent a new fog)
Traits are **never shown raw**; they render as a banded read, mirroring `scoutedCeiling(p)` /
`recScouted(rec)`. The band's width (uncertainty) shrinks with information:
- **Recruits:** sharpened by `rec.scout` confidence — exactly like `recScouted`. This gives Scout
  actions a *second* reason to exist: you're scouting **temperament**, not just `ov/pot`. (Reveal
  the trait band past a `rec.scout` threshold, like prefs unlock at 50.)
- **Roster players:** sharpened by **time in your program** + the coaching room, reusing
  `scoutSharpen()` (Analyst history + a strong coordinator room already tighten fog there). A
  freshly transferred-in player reads foggy; a kid you've coached for two years reads sharp. So
  `Motor: ???` → `Motor: High` is a payoff for retention + coaching, not a free reveal.
- Pure read helpers: `traitBand(value, spread)` → `{text, tier, uncertain}` (shared by both
  player + recruit paths), plus `traitChip(p)` for the roster card (one chip per trait, accent when
  elite + confidently read).

### Hook 1 — Development (`devRateFor`)
Fold a `motorMult(p)` (~0.85–1.15) into the per-player rate `devRateFor(team,p)` already computes
(and already passes into `rolloverRoster` via the `rateFor` callback). **Meshing with coach:** the
controlled coach's **Motivator / Former-Player** signals *amplify* a high-motor player (the player-
respect angle already coded into recruiting `coachMods` and the Phase 7 dev edges) — so coach
identity finally touches development *through personality*, not just scheme. Net effect surfaces for
free in the existing `growthChip` (▲+N) and `p.dev`.

### Hook 2 — In-game variance (keep `simEngine` pure!)
`simEngine` stays **pure + deterministic** — load-bearing for the QA determinism gate. Composure is
read from the **immutable roster** (exactly as ratings already are inside `gamePools`), so logging
parity and re-sim determinism hold. Two layers, ship the first, then the second:
1. **Streaky/consistent (baseline, every-play):** `comp` modulates the **variance** of that
   player's yard draws + breakaway long-tail. A low-comp WR draws more 40-yard catches *and* more
   duds; a high-comp RB clusters near his mean. Same expected value, different spread → does not
   skew the validated team-scoring distribution (assert this in `simlab`).
2. **Clutch (situational spice):** when the engine is already in a **late + close** state (4th
   quarter, one-score margin — clock + score it already tracks), high-`comp` players get a small
   efficiency nudge up, low-`comp` a nudge down. Nearly free because the state already exists.

These edges live **inside** the pure engine (trait is an input like rating), unlike the Phase 7
`coachGameEdges` which are applied *outside* — that's fine and intentional: personality is a roster
property, coach edges are a controlled-team property.

### Save shape & validation
- New per-player `p.mot` / `p.comp`, added as **core columns** in `SAVE_PKEYS` (cheap in the Phase 9
  columnar codec — two extra ints in the flat tuple, no field names; ~5% save growth, far under the
  cap). Bump save to **version 12**; `migrateState` v11→v12 is a **structural no-op** (absence reads
  as `TRAIT_DEF` = 50 = league-average, like the v3→v4 `p.gs` / v8→v9 `p.dev` steps). No backfill —
  AJ confirmed no official games have been played yet, so legacy saves can be wiped; an unmigrated
  trait-less player simply plays/develops at the average until regenerated.
- **Generation:** `genTraits(r)` stamps a gently bell-shaped pair (mean-of-two-rolls, so tails are
  rare) in `genPlayer` / `genFreshman` / `recruitToFreshman`. **Recruits** derive traits from a
  per-recruit rng keyed on `hashStr(rec.id)` (NOT the pool stream) so the prospect board stays
  byte-identical to pre-Phase-10; the trait carries onto the freshman at conversion.
- **Pure engine fenced** `// === TRAIT ENGINE (Phase 10) START/END ===` (depends only on
  `rng/ri/clamp`): `genTraits`, `motVal`/`compVal` (+ `TRAIT_DEF`), `motorMult(p)`, `compExp(p)` /
  `compReshape(x,g)` / `compDraw(r,p)`, `compClutch(p)`. No DOM, no `S`. **Key property:** at
  `comp==50` the reshape is the exact identity, so a trait-less player is byte-identical to the
  pre-Phase-10 sim — `simlab` envelopes + determinism are untouched (the lab extracts the TRAIT
  block alongside SIM; `reclab`/`rolllab` extract it too since their generators call `genTraits`).
- **Hooks wired:** `devRateFor` multiplies in `motorMult(p)`; `simEngine` replaces the run/pass
  magnitude draws with `compDraw(r, ballCarrier)` (mean-preserving spread) and nudges `adv` by
  `compClutch(oP.qb)` only when the drive is **late & close** (`clock<600 && |margin|≤8`, always in OT).
- New lab `test/traitlab.js` → **`npm run traitlab`** (16 checks): `genTraits` centered + bell-shaped
  + deterministic; `motorMult` bounded/monotonic and — fed through the **real** `developPlayer` —
  a high-motor cohort out-develops low-motor without exceeding the ceiling; `compReshape` preserves
  the mean at every composure, identity at 50, widens spread as composure drops (boom/bust: more
  explosive AND more stuffed plays); clutch small/signed/bounded.
- **UI (DONE):** fog reads `TRAIT_TIERS` / `traitTier` / `traitRead(kind,id,value,conf)` (band tightens
  with confidence, `'???'` below ~34) + `rosterTraitConf(p)` (class-tenure proxy × `scoutSharpen`) +
  `traitChips(p)`. Wired into the roster row (Motor/Poise chips), the player sheet (Work ethic /
  Composure rows), and the recruit sheet (driven by `rec.scout`). `qa` (154) drives all three: chips
  render, `'???'`→band reveal, tenure tightens the band, recruit traits gate on scouting.
- **Seven gates:** `simlab` + `reclab` + `rolllab` + `econlab` + `awardlab` + **`traitlab`** + `qa`.

### Deliberately out of scope (so it stays a factory, not The Sims)
No relationships/morale web, no locker-room chemistry graph, no off-field events, no coach–player
*conflict* simulation. Two traits, two mechanical hooks, read through fog. If it isn't touching
development or in-game variance, it's flavor text and we don't store it.

---

## Phase 11 design — program legacy & legends

Decided 2026-06-28 with AJ. The payoff of the multi-season loop: players who graduate don't vanish —
the notable ones become permanent **program legends**, and a program's accumulated history starts to
*matter* mechanically. AJ's scoping calls: **league-wide** (every program builds a Ring of Honor, AI
included), **no seeding** (history is earned only from played seasons — the feature deliberately ramps
up as your own stars graduate; a fresh dynasty has an empty Ring of Honor and that's the point), **all
three breadth options** (alumni-visit action + passive aura + legends-return-as-coaches), and **full
stature** (honors + career stat milestones + peak OVR). Follows house discipline: a pure fenced engine
validated by a node lab before any UI, a save-version bump + `migrateState` step, all gates green.

### What already exists (build on it, don't reinvent)
- **Graduation already produces the raw material:** `rolloverRoster` builds a `graduated` list each
  year (pushes the player copy *before* `delete p.gs`, so a grad still carries last season's box) and
  `rolloverSeason` already has it as `summary.graduated`. Today it's only counted, then dropped.
- **`p.honors:[{year,award}]` already measures accomplishment** and **persists across rollover** —
  stamped by `stampHonors(aw)` at `endSeason` (Heisman / National Def POY / Freshman of the Year /
  All-American nationally; All-Conference + conf-POY for the **controlled team's conference only**).
- **The recruiting action rail** (`offerRecruit`/`scoutRecruit`/`pitchRecruit`/`visitRecruit`/
  `promiseRecruit` + `RECRUIT_COSTS` + `myMods()`) is where the alumni-visit action slots in.
- **`recruitFit(team,rec)`** is the natural home for the passive aura term (it already sums prestige +
  facilities + home-state). **`genCoachMarket`/`advanceCoachCarousel`** is where legend-coaches enter.
- **Coach identity:** **Former Player** history should finally mean *you own the alumni network*
  (amplifies alumni visits); **High School Legend** boosts home-state alumni pull.

### (A) Career stat accumulation — the foundation (build first)
Because there's no seeding, stature's "career milestones" component only has data if we **start
accumulating now**. Add two lean, persisted per-player fields:
- `p.career` — cumulative totals of just the milestone-relevant box keys (`gp, pYds,pTD, rYds,rTD,
  reYds,reTD, tkl,sk,dInt`), summed from `p.gs` **inside `rolloverRoster`, right before `delete p.gs`**,
  for **every** player on **every** team (so AI legends have real numbers). Survives rollover.
- `p.peakOv` — max OVR the player ever reached, updated each rollover after development.
Both absent-read as zero/none (no backfill). This is a change to the fenced ROLLOVER engine, so
`rolllab` keeps it honest (career sums across seasons; season `gs` still never carries forward).

### (B) Stature — the pure score (LEGACY ENGINE)
`legendStature(snap)` (pure, fenced `// === LEGACY ENGINE (Phase 11) START/END ===`, depends only on
data + `clamp`): a 0..~100 score blending three components, each saturating so no single one runs away:
- **Honors weight** — `honorWeight(award)` ladder: Heisman 100, Bednarik (best defender) 80, national
  **position trophies** 60 (Outland/O'Brien/Doak/Biletnikoff/Mackey/Butkus/Thorpe), All-American 55,
  conf POY 45, K/P trophies (Groza/Ray Guy) 35, All-Conference 25, Freshman of the Year 20 (sum across
  `p.honors`, then soft-capped). The trophies are crowned in `computeAwards` (AWARDS engine) and stamped
  by their real names in `stampHonors`, so a two-time Outland winner reads as a bigger legend.
- **Career milestones** — threshold bonuses on `p.career` (e.g. 10k career pass yds, 3k rush, 30+ sacks,
  300+ tackles) so a compiler with no trophies can still be a beloved great.
- **Peak OVR** — a modest term off `p.peakOv` (a 99-rated star reads as a legend even in a down era).
Returns `{score, tier}` where tier is a label ladder (e.g. *Cult Hero → Program Great → All-Time Great
→ Immortal*). `isLegendWorthy(snap)` = has ≥1 real honor **or** stature ≥ a bar (keeps the ledger
notable, not every senior).

### (C) Enshrinement at rollover (league-wide, capped)
`enshrineLegends(team, graduated)` (app layer, in `rolloverSeason`'s team loop): for each graduate that
`isLegendWorthy`, push a **lean snapshot** into `team.legends`:
`{ id, name, pos, st, from, to, peakOv, honors:[...], career:{…}, stature, tier }` (no Player object,
no per-play data). Then keep only the **top ~12 by stature** (all-time best survive; storage bounded —
134 teams × 12 ≈ a few hundred lean snapshots even after decades). `to` = the year graduated, `from`
≈ `to − classYears`. Runs for **every** team. The controlled team's new inductees surface in the
offseason recap ("Class of YEAR enshrined: NAME").
- **Wire `stampHonors` to stamp ALL conferences' All-Conference + conf-POY** (not just the controlled
  one), so AI legends carry real résumés league-wide — small change, honors stay sparse-stored.

### (D) Alumni-visit recruiting action
`alumniVisit(rec, legend)` (app, alongside `visitRecruit`): interest boost = `base × stature01 ×
relevance × coachMod`, where **relevance** = position match (`legend.pos===rec.pos` full, same side
partial) + **home-state tie** (`legend.st===rec.st`), **coachMod** amplifies for **Former Player**
(network) and **High School Legend** on home-state alumni. Legends are a **limited resource**: each
carries `app` appearances remaining for the season (e.g. 2), reset at kickoff; deploying spends one +
`RECRUIT_COSTS.alumni` points. One alumni visit per recruit (no stacking). The picker only offers
legends with appearances left, sorted by relevance to that recruit.

### (E) Passive program aura
`legacyAura(team)` (pure): a small standing value from the **depth+quality** of `team.legends` (sum of
top legends' `stature`, saturating). Folded into `recruitFit` as a `+aura` term (clamped small so it
complements prestige, never replaces it) — a storied program attracts talent on name alone. Optionally
surfaced as a "Legacy" stat on the Program page.

### (F) Legends return as coaches
In `genCoachMarket`/`advanceCoachCarousel`: occasionally a team's own retired great re-enters the
market as a candidate **for their alma mater**, flagged `{ fromLegend:true, legendOf:teamId }`, with a
coach `rating` influenced by stature (a great player is a *plausible* — not guaranteed-good — coach).
Keep it modest and deterministic by `(seed, year)`. Hiring an alum is flavor the UI can highlight.

### (G) UI — Ring of Honor + the action + aura surfacing
- **Ring of Honor** list on the Program/Team page: tier, era (`from–to`), position, honors line,
  stature. Sorted by stature; empty-state explains history accrues as players graduate.
- **Recruit sheet:** an **Alumni visit** button → a picker of available legends showing each one's
  relevance to this recruit + appearances left.
- **Offseason recap / Home:** new-inductee card. Carousel: badge a legend-coach candidate as "Alum".

### Save shape & validation
- New persisted: `team.legends:[Legend]`, per-player `p.career` + `p.peakOv`, per-legend live `app`
  counter (reset at kickoff). Bump save to **version 13**; `migrateState` v12→v13 backfills
  `team.legends=[]` (career/peakOv absent read as zero/none → no backfill; honors already persist).
- **Pure engine fenced** `// === LEGACY ENGINE (Phase 11) START/END ===` (depends only on data arrays +
  `clamp`/`hashStr`): `honorWeight`, `legendStature`, `isLegendWorthy`, `legacyAura`, `alumniBoost`
  (the pure relevance×stature math the app action calls). No DOM, no `S`.
- New lab `test/legacylab.js` → **`npm run legacylab`**: stature monotonic in honors/career/peak and
  bounded; `isLegendWorthy` gates correctly; enshrinement caps at 12 and keeps the best; career sums
  accumulate across seasons (and `gs` still never carries forward — cross-check vs `rolllab`); aura
  scales with ring depth + stays bounded; `alumniBoost` scales with stature×relevance and respects the
  appearance limit; determinism by seed.
- `npm run qa`: across a rollover, career totals accrue + a notable graduate enshrines (Ring of Honor
  shows it); the alumni-visit action raises interest and decrements appearances; aura nudges
  `recruitFit`; a legend can surface in the carousel; v13 migration + columnar round-trip.
- **Eight gates:** `simlab` + `reclab` + `rolllab` + `econlab` + `awardlab` + `traitlab` +
  **`legacylab`** + `qa`.

### Build order (each useful on its own, lab before UI)
**A** career accumulation (+ `stampHonors` all-conf) → **B/C** stature + enshrinement (+ `legacylab`) →
**E** aura + **G** Ring of Honor display → **D** alumni-visit action + picker → **F** legend-coaches.

### Deliberately out of scope
No jersey-number tracking, no per-legend dialogue/storylines, no Hall-of-Fame voting beyond the
stature score, no booster/donor sim. Legends are lean snapshots that drive three mechanics
(visit / aura / coach) and a display — nothing that re-simulates a retired player.

---

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

## Phase 14 design — recruiting calendar (signing in the offseason)

Decided 2026-06-28 with AJ. The Phase 4 recruiting loop deliberately **signed the class at the end of the
regular season** because rollover/offseason didn't exist yet — an honest compromise the design called out.
Now the full offseason structure exists (Phases 5/12), so signing moves where it belongs: the **offseason**,
in **two periods** (Early Signing Period + National Signing Day), like real college football.

### The new calendar
A new `S.recruiting.stage`: **`'open'`** (in-season) → **`'national'`** (offseason, after the Early Signing
Period, Signing Day pending) → **`'closed'`**.
- **Regular season:** you work the board exactly as before, but a commitment is now a **VERBAL**
  (`committedTo` set, `signed` stays false). The class no longer closes at the final week — `finishRegular
  Season` just decides awards + starts the postseason.
- **Offseason entry (`enterOffseason`, after the bowls/playoff):** the **Early Signing Period** fires
  automatically — every recruit who already knows where he's going (the verbal commits) signs (`earlySigning
  Period`). The genuine toss-ups (close two-way races — by definition the ones who *didn't* clear the
  in-season commit gap) hold off. A final offseason recruiting-points budget is granted for the push window.
- **National Signing Day** (a distinct offseason advance from Home): `nationalSigningDay` runs the engine's
  **finalize pass** (`advanceRecruiting(..., finalize=true, bar=30)`) — the contested recruits make their
  final call (sign with their leader, or go unsigned), every commit becomes binding, and the class **closes**.
- **Rollover** then enrolls the signed class (unchanged — it reads `committedTo`).

The split lands ~⅓ early / ~⅔ on Signing Day — so **Signing Day keeps real drama**: the undecided battles
are exactly the ones you can still flip in the push window. (A lift to the in-season commit rate would shift
more to the Early Period; left as-is on purpose because a meaningful Signing Day is better gameplay.)

### Engine change (kept reclab-green)
`advanceRecruiting` gained a `finalize` flag (+ optional `signBar`/`gapBar`): in-season passes are
**verbal-only** (`signed` stays false), and only a finalize pass turns verbals into signatures + force-resolves
the undecided. `reclab` passes `finalize` on its last week, so the engine's validated convergence is unchanged
(still 100% signed by Signing Day). The app simply controls **when** the finalize happens (now National
Signing Day, in the offseason) instead of the regular-season's final week.

### UI & save
The Home advance button gains a `Hold National Signing Day →` step in the offseason; the recruiting view +
class tab read the stage (Recruiting points → **Final push** → CLOSED; Verbals → Signed), with an Early-Signing
recap line and a verbal-vs-signed label on each commit; the on-the-clock card walks Early Signing Period →
National Signing Day → roll over. Save **v16** (`S.recruiting.stage`); `migrateState` v15→v16 derives a stage
for any in-progress class (`signed?'closed':'open'`). No new lab (it's a timing/sequencing change validated by
`qa` end-to-end + the unchanged `reclab`). **Deliberately out of scope (at the time):** no per-recruit
signing-date calendar — two periods, a push window, and the class closes. *(The "no transfer portal" and
"no flips of commits" limits here were later reversed — see Phases 16 & 18.)*

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

## Phase 16 design — decommits (verbal flips)

Decided 2026-06-28 with AJ (Phases 15–18 batch). Recruiting was static once a prospect committed; now a
**verbal** pledge is genuinely contestable until it signs — a rival can flip it, and so can you. House
discipline: the change is contained to the pure RECRUIT ENGINE + validated by `reclab` before any UI.

### Engine (`advanceRecruiting`, RECRUIT ENGINE)
Two changes, both seeded by the existing `(seed, week)` rng so a cycle stays reproducible:
- **Passive interest now grows for verbal commits too** (was: uncommitted only). Signed prospects are
  frozen. So rival programs keep pushing on a kid who's only verballed.
- **A flip pass** (added between growth and the new-commitment pass) runs **in-season only** — never on a
  `finalize` pass, because firm verbals lock at the Early Signing Period. For each verbal (unsigned) commit,
  it finds the strongest *other* suitor (respecting the class cap) and, if that rival leads the committed
  school by ≥ `REC.DECOMMIT_GAP` (18), flips with a probability that scales with the gap (`clamp((lead−gap)
  /40, .04, .5)`). A flip retags `committedTo`, fixes the per-team class counts, and stamps a transient
  `rec._flipped={from,to}`. **Signed players never flip** (that's the transfer portal, Phase 18). Returned
  in the week's commit list so the app can react.

### App layer
`offerRecruit` no longer blocks a committed-but-**unsigned** prospect (only a *signed* one) — you can open
a verbal elsewhere on your board and out-recruit for him. The prospects board lists all unsigned prospects
(verbals elsewhere included, shown with a "→ ABBR" badge), and the recruit sheet shows a "just a verbal —
flip him before Signing Day" prompt + enables the action rail on a flippable verbal (`canAct` =
unsigned-and-not-mine). `resolveRecruitingWeek` toasts the swings: 🎉 new verbals to you, 🔁 flips you stole,
⚠ verbals you lost.

### Save & validation
Save **v18** (behaviour-only; `migrateState` v17→v18 is a no-op — `rec._flipped` is recomputed weekly).
`reclab` grew to 26 (a verbal flips when a rival pulls ahead; a small gap does NOT flip; a signed commit
never flips; a finalize pass never flips; determinism) and confirms the cycle **still converges to 100%
signed**. `qa` (199) drives the integrated engine (flip happens / signed-locked / finalize-locked) + the
relaxed offer. **No new gate** (reclab covers it). **Deliberately out of scope:** no flips of *signed*
players, no negative-recruiting "decommit" action that directly drops a rival's commit (you flip by
out-recruiting), no decommit of your *own* signed class.

---

## Phase 17 design — full national recruit board (~3,400)

Decided 2026-06-28 with AJ (Phases 15–18 batch). The Phase 4 board was deliberately **top-300 only** (the
2–3★ tail faked by a `classScore` prestige baseline + generated filler freshmen at rollover). Phase 17
reverses that: the **entire national class is individually modeled**, so every program signs a real class
from a real board.

### Generation (`genRecruits`, RECRUIT ENGINE)
`REC.POOL=3400` (≈ 134 teams × a ~25-man class). Star mix is top-heavy: ~30 5★, ~350 4★, ~1,520 3★, then a
new **2★ tier** (~1,500) filling the tail. `ovBase`/`target` extend to 2★ (`recruitFit` + the suitor
`target` both span the prestige range: 5★→88, 4★→70, 3★→50, 2★→32). Suitor counts widened (every recruit
draws 4–6 suitors) and the suitor score carries **more noise** (`r()*1.1`) so no tier of programs is wildly
over- or under-subscribed — each program needs a reachable pool to fill its class. The per-recruit id keying
for traits/rebel is unchanged. ~90% of the pool signs by Signing Day; the capacity-limited tail backfills as
walk-ons at rollover (the bottom ~20 programs lean on that, which is realistic).

### Knock-on changes
- `classScore` drops the faked prestige baseline (kept only as a tiny tiebreaker) — class scores are now the
  real sum of landed value.
- `rolloverRoster` gains a **scholarship cap** (`ROSTER_CAP=85`): a full class would otherwise balloon a
  roster, so it trims the weakest **depth beyond each position's target** (lowest ov first, never a captain)
  down toward 85. Every position stays ≥ its target (rolllab's depth check holds). `genFreshman` backfill
  still serves programs that under-sign.
- **Columnar pool codec:** `RECRUIT_PKEYS` + `encPool`/`decPool` mirror the roster codec; `encodeState`/
  `decodeState` encode `recruiting.pool` as `_cp` under the existing `_sv` envelope (the transient
  `_flipped` is dropped). A mid-season save stays ~2.5 MB. Decode reads both the old plain pool and the new
  `_cp` form (back-compat).
- **Board UI:** `recruitProspects` gains home-state + availability filters (incl. "verbals — flippable")
  and **pagination** (Load more, 80/page) so 3,400 rows stay usable; the Class view's old "+N projected
  depth" line becomes a real "X of 25 class spots filled" note.

### Save & validation
Save **v19** (no-op migration — pool recreated at kickoff; codec is back-compatible). `reclab` (27) updated
for the full pool: ~3,400 size, top-heavy mix with a 2★ tail, the cycle converges (≥88% sign), most programs
land a substantial class (≥100 of 134 fill ≥18), class cap respected. `qa` (200) adds a **columnar
recruit-pool round-trip** (all ~3,400 recruits byte-exact). **No new gate** (reclab + qa cover it).
**Deliberately out of scope:** still no sub-2★ / preferred-walk-on individuals (the genFreshman backfill
stands in for the deepest tail), no JUCO/FCS recruiting, no early-enrollee timing.

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

## Phase 19 design — full media suite (news, AP poll, press, approval & the hot seat)

Decided 2026-06-28 with AJ. A media layer over the rich event stream the sim already produces, plus real
career stakes (an approval meter that can get you fired). Confirmed scope: a **news feed**, an **AP Top 25**
(with inertia), **interactive press conferences** (light effects), **program coverage**, a **coach approval
rating + hot seat**, and on firing a **job carousel or retire**. Built as **three sub-phases**, each a pure
fenced engine + lab + save bump + green gates, committed separately. **The AP poll is cosmetic** — the
12-team playoff still seeds off `rankScore`/conf champions, so the Phase 12/15 gates are undisturbed.

### 19a — Media core (✅ DONE)
Pure fenced `// === MEDIA ENGINE (Phase 19) START/END ===` (depends only on `clamp/rng/hashStr`):
- `computePoll(prev, ranked, week)` — an AP Top 25 with **inertia**: a team's effective key eases from its
  previous poll rank toward its `rankScore`-derived score rank, capped at `POLL_MAX_MOVE` (4) per week, so a
  fallen #1 slides a few spots, not ten. Preseason (no prev) = straight score order. Returns
  `{week, top:[{teamId,rank,prev,pts}], others}`.
- `gameStoryTag(w, l, margin)` — classify a result (`upset` / `ranked` / `blowout` / null) from poll ranks +
  OVR + margin. `mkStory(tag, d, r)` — `{headline, body}` templates with seeded phrasing.
- App layer: `S.media={poll, feed}` created at kickoff (`initMedia`), nulled at rollover. `updateMedia` (in
  `advanceWeek`, after honors + recruiting) refreshes the poll and pushes the week's stories into the feed
  (cap `MEDIA_FEED_CAP`=60) from the games, the weekly POW (reusing `S.weeklyHonors`), poll risers, and 4★+
  commits/flips (`resolveRecruitingWeek` now returns the week's commits). One-off `mediaEvent`s fire at conf
  titles / the Heisman / the national title / the portal close. UI: a **Media Center** hub (`renderMedia` —
  News / AP Poll / Your Coverage; `'media'` added to the `renderNav` whitelist), a Home headlines teaser
  (`mediaHomeCard`), and the Season **Top 25** tab renders the AP poll (`apPollRows`, ▲/▼ movement). Save
  **v21**; `medialab` (17 checks: poll inertia / preseason==score / entrants climb gradually / determinism /
  story classification / templates).

### 19b — Approval, the hot seat & press conferences (✅ DONE)
`MEDIA ENGINE` additions: `winExpectation(prestige)`, `gameApprovalDelta`/`seasonApprovalDelta` +
`approvalUpdate` (bounded, mean-reverting toward 50), `hotSeatTier`/`hotSeatBar` (prestige-adjusted, year-1
honeymoon), `firingDecision(history, prestige, tenure)` (fires only on **sustained** failure — a meltdown
year, or two straight years under the bar), and `pressPrompt(ctx, seed)` / `pressEffect(choiceKey)` (a
context-keyed question bank → a small `{approval, buzz, dev}` bag). App: approval persists on **`S.coach`**
(`approval`/`tenure`/`approvalHistory`) — it moves weekly in `updateMedia` and settles at season end
(`settleSeasonApproval`, in `enterOffseason`); a weekly **optional** press card folds `buzz` into
`recruitFit` (guarded `team.mediaBuzz`, reset at kickoff) + a `dev` focus into `devRateFor`
(`S.media.pressDev`); an approval/hot-seat strip (Home + Program) + a "pressure mounts" feed story when the
seat heats up. Save **v22**; `medialab` → 40.

### 19c — Fired → job carousel or retire (✅ DONE)
`coachOpenings(teams, firedPrestige, seed, n)` (pure; weighted toward programs **below** your last job — a
step down is the likely landing, a lateral occasional, well-above almost never; caller excludes your old
job). `firingDecision` (in `settleSeasonApproval`) flags `S.coach.pendingFire`; the consequence is deferred
to the **end of `rolloverSeason`** (so the league advances normally) → `triggerCoachingSearch` builds
`S.coachSearch`. The Home view routes to a **Coaching Search** screen (kickoff blocked): `takeJob(id)` banks
the stint on `S.coach.career`, switches `S.teamId`, resets approval(52)/tenure(0), and starts fresh; or
`retireCoach` sets `phase:'Retired'` → a **career retrospective** (`renderRetired`: programs / seasons /
national + conf titles / stops) reached via the render dispatcher, with a back-to-menu. Save **v23**;
`medialab` → 46.

### Deliberately out of scope
No Sims-style per-player morale web; no real-time/streamed broadcast; no editable transcripts/voice; the AP
poll never feeds the bracket; no booster-donation economy beyond the existing finances loop.

---

## Phase 20 design — personality reactions (Ego + morale)

Decided 2026-06-28 with AJ. Phase 10 capped personality at **two** mean-neutral traits ("a factory, not The
Sims"); Phase 19's media effects landed **team-wide**. Phase 20 makes the narrative land **per player** by
personality — one player feeds on the hype and is rattled by criticism, another tunes it out — by adding a
third trait + a persistent morale, wired into four existing moments. Same discipline: pure fenced engine +
lab before UI, a save bump, all gates green, and **mean-neutral at the average** so an untouched roster is
byte-identical to pre-Phase-20.

### Engine (extends the `TRAIT ENGINE` block — pure)
- **Ego** (`p.ego`): a third gently bell-shaped `genTraits` roll; `egoVal(p)` (absent → 50). A **core column**
  in `SAVE_PKEYS` (appended last → old columnar tuples decode `ego=undefined → 50`); also appended to
  `RECRUIT_PKEYS`. `egoWeight(ego)` → 0.2..1.5 (how hard the narrative hits him).
- **Morale** (`p.morale`, sparse, **controlled team only**, `MORALE_DEF=50`): `moraleUpdate(morale, valence,
  ego)` (signed event × ego, bounded), `moraleDecay` (ease toward 50), `moraleDevMult` (0.9..1.1, 1.0 at 50),
  `moraleGameSkew(roster)` (±2 team edge from avg morale, 0 when neutral), `moralePortalPush(morale)` (extra
  leave prob when bleak, 0 at ≥50). Every mover is identity/zero at the average.

### Wiring (four moments)
1. **Press** — a `mood` valence on each `PRESS_EFFECTS` choice; `answerPress` moves each controlled player's
   morale by `moraleUpdate(p.morale, mood, ego)` (divas swing, monks don't).
2. **Results + decay** — `updateMedia` nudges the roster's morale by the game result (win/loss × upset/blowout)
   then decays the whole room (shedding ~neutral values to stay sparse).
3. **Development** — `devRateFor` folds `moraleDevMult(p.morale)` for the controlled team (next to the Phase
   19b `pressDev` term) — a buzzing room develops its ego players faster. (Applies at rollover dev, using the
   season's end-of-year morale; reset to neutral at the next kickoff.)
4. **In-game spotlight** — `moraleSpotlight(g)` (in `simSides`) adds a small ± edge to the controlled team in a
   ranked/marquee game, scaled by `moraleGameSkew(roster)`; **outside** `simEngine`, like `coachGameEdges`.
5. **Transfer portal** — `openPortal` adds `moralePortalPush(p.morale)` to `portalLeaveProb` for your players.
- Morale resets each kickoff (`startSeason`); Ego persists for a career.

### Save & validation
Save **v24** (structural no-op migration — absent ego/morale read as 50). `traitlab` → 30 (ego centered/
bell/deterministic; `egoWeight` bounded+monotonic; the morale movers ego-scaled, bounded, signed, and
**identity/zero at the average**). `qa` (222) drives a press choice moving a high-ego player's morale far
more than a low-ego one, the Ego fog chip + open morale chip, and the v24 columnar round-trip (ego core +
morale sparse). UI: Ego joins the fogged trait reads (roster/player/recruit); morale shows **openly** as a
mood chip on your roster + a Locker-room line on the approval strip.

### Deliberately out of scope (still a factory)
Morale is **controlled-team only** (no 11k-player league-wide morale sim — AI portal churn keeps the Phase 18
signals); no relationships/chemistry graph, no off-field events, no per-player interviews. Ego is one trait
with the four hooks above; anything not touching press / in-game / dev / portal is flavor and isn't stored.

---

## Phase 21 design — schemes (identity, matchups & fit)

Decided 2026-06-28 with AJ — the first slice of "actually calling a game." AJ's framing: every coach has a
scheme they love, every player has one (which may *not* be what he's good at), schemes beat other schemes
rock-paper-scissors but "sometimes the best players just win." This phase lands the **identity + ratings**
layer; the **interactive play-calling** half (the live field, decision points, special packages, in-game
adjustments) is a later phase that will re-architect the watch flow around a `seed + decision-log` engine.

### The hard constraint that shaped every decision
`simEngine` is **pure + deterministic** and that's load-bearing (the determinism gate, `buildGameLog` watch,
greatest-games replay, `simGame` re-sim). So schemes must **not** change the engine. They're applied as a
mean-zero **rating delta OUTSIDE** `simEngine`, in `simSides`, exactly like the Phase 7 `coachGameEdges` and
the Phase 20 `moraleSpotlight`. The SIM block is byte-identical → `simlab` + determinism untouched. And to
keep every existing seed's world byte-identical, **nothing consumes the rng stream**: schemes derive from id
hashes (the same trick recruit traits use via `hashStr(rec.id)`).

### Pure `SCHEME ENGINE` (fenced, lab before UI)
`// === SCHEME ENGINE (Phase 21) START/END ===` (depends only on `hashStr`/`POS`):
- `OFF_SCHEMES` (Air Raid · Spread · Spread-Option · Pro Style · Smashmouth · West Coast · Multiple),
  `DEF_SCHEMES` (4-3 · 3-4 · Nickel/Cover-3 · Bear · Tampa-2). *Expanded 2026-06-29:* **Spread** (balanced —
  pistol run game + RPO, few weaknesses) is split out from the run-first **Spread-Option** (option/QB-run),
  and **Multiple** is a true-neutral "mix of everything" (all-zero matchup row, balanced tendency, no
  weakness or strength — leans on talent + roster fit).
- `SCHEME_EDGE` — a 7×5 matchup table in rating points, **doubly balanced** (every row and every column
  sums to 0; Multiple is the all-zero row), so over uniformly-random matchups the mean edge is exactly 0
  (the envelope is preserved by construction) while any single matchup still tilts ±. Reads like the chalk
  (Air Raid beats Bear blitz, dies to Tampa-2 zone; Smashmouth runs on light boxes, stalls vs 3-4/Bear;
  Spread-Option gashes read-and-react 3-4, blitz blows up the mesh; …).
- `schemeFit(p, idx)` = +1 in his scheme, −1/(n−1) otherwise (n = the side's scheme count) → **E[fit]=0**
  under a uniform draw (mean-neutral on each side, so offense's 7-scheme menu doesn't tilt the average vs
  defense's 5). `rosterSchemeFit` averages it over a side's top-11. `playerSchemeIdx(p)` derives from
  `hashStr(p.id) % schemeCount(side)` (side from the player's position).
- `schemeDelta(offTeam, defTeam)` → `{off, def}` rating adds (matchup edge + each side's roster fit). The
  total swing is ≤ ~4 rating pts, far under a typical OVR gap → **raw OVR still decides games**.

### App layer + wiring
- `genWorld` stamps each team `offScheme`/`defScheme` from `defaultOffScheme/defDefScheme(id)` (mutable).
- `simSides` folds **both directions** of `schemeDelta` + `schemeBuyIn` (controlled-team-only, S-dependent, so
  it lives in the app layer next to `coachGameEdges`; Off/Def Genius amplifies) into the two edge-adjusted
  team copies the engine plays with. Identical between commit (`simGame`) and watch (`buildGameLog`).
- Taking over a program **installs the coach's schemes** (`finishNewGame`); buy-in is on day one, the roster
  fits only as well as the players' instincts do — a project you recruit/develop into.

### UI
New-game wizard scheme pickers; a Program **Schemes card** (schemes + qualitative roster fit + buy-in state)
with an **install** sheet (each option shows the resulting roster fit + a "your scheme" marker); a **fogged**
scheme read on the roster row / player sheet / recruit sheet (`schemeRead`: ??? → "likely X" → the name,
gated on `rosterTraitConf`/`rec.scout` like the traits); a weekly **matchup preview** chip on the Home card.

### Save & validation
Save **v25** (per-team `offScheme`/`defScheme`, `S.coach.offScheme`/`defScheme`); `migrateState` v24→v25
backfills team schemes from id and adopts them as an existing coach's preference (a player's preferred scheme
is innate-per-id, so **no save column**). New gate `npm run schemelab` (35 checks: table double-balance, fit
& delta mean-zero over random worlds — side-aware, swing small enough that OVR dominates, footbally matchups, determinism).
`qa` → 229 (your program runs your schemes, buy-in active both sides, delta deterministic+bounded, scheme
fogged, roster chip + Program card render, a non-preferred install drops buy-in). **Fourteen gates** now
(adds `schemelab`).

### Deliberately out of scope (this phase)
The **run/pass tendency** shift (scheme → `passProb`) is held for the play-calling phase, since it's an
in-engine change that re-baselines `simlab` — it belongs with the interactive field, where the OC's suggested
play already reflects the scheme. No per-player scheme *overrides* (innate only), no scheme *progression*,
no AI coach scheme identities beyond the id-derived team default.

---

## Phase 22 design — interactive play-calling (the field)

Decided 2026-06-28 with AJ — the headline of "actually calling a game." This phase delivers the
**call-the-game core**: see the field, call the play (or defer to your OC), in your own game, live.
Special packages and in-game adjustments (move-the-CB, pep talks, penalties) are explicitly the
*next* increments on this track.

### The hard problem & the chosen architecture
The whole sim rests on `simEngine` being **pure + deterministic** (the determinism gate, the watch
viewer, greatest-games replay, `simGame` re-sim). Interactivity means your choices change the
outcome — which naively breaks all of that. The resolution: **`seed + decision-log = deterministic`.**
- `simEngine` gains `opts.decide(ctx)` + `opts.decideFor` (the team id it controls — passed in, so the
  engine stays pure, no global `S`). At the run/pass and 4th-down decisions the **OC always draws its
  own suggestion** (`ocPass`/`ocAct`), so the rng STREAM is identical no matter what the coach does;
  `decide` may swap the *choice* only. No `decide` → byte-identical to the old engine (`simlab` proves
  an always-defer coach reproduces the AI score **and box**; the 4th-down restructure preserves the
  exact lazy rng draws). A game is fully reproducible from (seed + the recorded calls).
- **No generator / no serialized engine state.** The UI driver (`runInteractive`) **re-runs the pure
  engine from scratch** after each call (sub-millisecond), feeding back the calls recorded so far via
  `decide`; it pauses by *throwing* at the first undecided prompt-worthy snap (the partial play log is
  written into a caller-owned `opts.logInto` array so it survives the throw), else it resolves to the
  final. Elegant, and it makes watch == commit true by construction.

### Commit-replay (watch == commit)
On "Continue", the coach's full ordered call list banks onto **`g.calls`**. `simGame` and
`buildGameLog` both apply `gameDecideOpts(g)` (replay the calls, OC default fills any gap), so the
committed result and any later replay reproduce the exact play-called game — byte-for-byte. Absent
`g.calls` = a pure AI game (every non-controlled game, and any week you don't coach).

### UI
**Opt-in**, so the classic one-tap animated watcher (and qa's watch flow) is untouched: the viewer
shows a "🎮 Coach this game" button for your own upcoming game. It opens an interactive **SVG field**
(hand-rolled — no framework: yard lines, hash ticks, the ball, a yellow first-down line, end zones in
the two teams' colors, offense attacking →), a down/distance + field-position + (cosmetic) hash +
clock line, a **play-call prompt** (Run / Pass / Defer-to-OC, or FG / Punt / Go-for-it on 4th, with
the OC's suggestion highlighted), a live **mode toggle** (`Key moments` → prompts on 4th down / red
zone / 3rd-&-long / 2-minute; `Full control` → every snap; `Auto` → OC runs it), and `Sim the rest →`.
Leaving Coach mode before "Continue" never commits (the real game is mutated only at commit).

### Balance + scheme tendency (shipped with this phase)
Letting a human force play calls exposed that the pre-existing engine made **runs too efficient/safe**
(designed runs rarely turn it over), so once you *could* spam, "always run" dominated (a scaled sim:
39 pts/g, 95% win). Rather than globally nerf the run (which would punish the balanced AI and move the
validated envelope), the fix is a **predictability tax** (`keyedPen`): the engine tracks each team's
run/pass mix (smoothed toward 50/50) and taxes **over-reliance** on a play type — a balanced/AI attack
stays under the `KEY_THRESH` (0.60) and pays ~nothing (envelope preserved), but spamming run *or* pass
gets stuffed (lower yards, more sacks/incompletions). It's deterministic from the call history (no new
rng draw), so determinism/replay are intact. Result: run-spam → 11 pts/g (27% win), pass-spam → 11
(17%), a **smart mix tops the table** (~29, 64%), and the AI envelope is unchanged. Shipped alongside:
**scheme run/pass tendency** (`schemeTendency`) folded into `passProb` (Air Raid airs it out, Smashmouth
grinds; the five values average ~0 → shifts play *selection*, not the envelope). Both live in the
fenced engines (`schemeTendency` in SCHEME; the tax in SIM), so `simlab` extracts the SCHEME block too.

### Save & validation
Save **v26** (optional `g.calls`; `migrateState` v25→v26 is a no-op — absent reads as AI). `simlab` →
34 (Phase 22: defer == AI byte-for-byte; the hook fires only for the controlled offense; both decisions
surface; overrides change the outcome but stay sane; a fixed call set replays deterministically; **the
predictability tax — spamming run OR pass does not beat a balanced attack**). `qa` → 236 (watch == commit
on a coached game; calling plays changes the outcome vs the OC; the SVG field + prompt render in Full
control; making a call advances the drive; leaving Coach mode does not commit). Plus an offline
play-calling sim harness (1,000 games: parity/replay byte-exact, strategies diverge sanely, full coached
seasons commit-match). **Fourteen gates** (unchanged set — Phase 22 extends `simlab` + `qa`).

### Deliberately out of scope (this increment)
No **special packages** (situational personnel groupings) yet, no **in-game adjustments** (reassign a
CB on a live matchup, pep talk via morale, calm penalties) — those need a per-matchup model + a
penalty/discipline model and are the next increments. Defense is still OC-run (you call your offense's
plays); only the controlled team's game is coachable (advancing a week stays fast).

---

## Phase 23 design — per-matchup resolution

Decided 2026-06-29 with AJ — the first of the "deepen the sim" threads, and the keystone that makes
the roster feel alive: a play resolves off the **specific players involved**, not one team rating.
This is what makes "my CB is getting **cooked**" literally true, and it's the foundation for in-game
adjustments (reassign your CB onto their WR1) and for injuries-mattering (a backup gets exposed).

### The mean-neutral construction (so the envelope holds)
The risk: keying plays off individuals could shift the validated scoring envelope. The fix is to make
the matchup a **mean-zero deviation layer** on top of the existing team `adv`. On a pass, the targeted
receiver (`wpick(oP.recv)`) draws a coverage defender assigned **deterministically by depth**
(`coverDef`: WR1→CB1, WR2→CB2, slot/TE→S, RB→LB — so coverage is a persistent, readable storyline, and
no rng is consumed assigning it). The play's effective adv becomes `adv + matchEdge`, where
`matchEdge = MATCH_W * ((recv.ov − recvWeightedMean) − (cov.ov − covWeightedMean))`. Because each side
is a deviation from its own **weighted** group mean (the same weights `wpick` selects by), the expected
matchEdge over plays is ~0 → the league envelope is preserved by construction, while a stud-on-scrub
mismatch tilts the individual play. Runs work the same way (ball-carrier vs a `front` defender). The
trench/sack stays on the team rating (a follow-up can split OL↔DL). `MATCH_W=0.42` keeps the swing
small enough that raw OVR still dominates ("the best players win") — validated, not asserted.

### Coverage stats (the 'cooked' readout)
On a completion the covering defender is charged `cvTgt`/`cvCmp`/`cvYds` (and `cvTD`); on a pick he's
credited the `dInt` (the man in coverage made the play). These ride in `p.gs` (sparse extras in the
columnar codec → **no save bump**, absent-safe on old saves) and pair **exactly** with the offense —
league-wide `cvCmp==rec`, `cvYds==reYds`, `cvTgt==pAtt` (asserted in `simlab`).

### Determinism & the live panel
The matchup math is pure/rng-deterministic, so determinism + watch==commit (Phase 22) are unchanged.
For the UI, `simEngine` gained an optional `opts.boxInto` (a caller-owned box, mirroring `logInto`) so
the play-calling driver captures the **running** box even across a pause-throw; the coach view renders
a live **matchup panel** — your receivers' production + your coverage with a 🔥 "cooked" flag — and the
play feed names the matchup (`pass to WR (vs CB)`).

### Validation
`simlab` → 39 (a stud WR torches weak coverage and barely dents strong; the beaten corner's coverage
yards spike; the three coverage invariants; envelope + leaders intact). `qa` → 237 (the live matchup
panel renders from the running box). No save change. **Fourteen gates** (Phase 23 extends `simlab` + `qa`).

### Deliberately out of scope (this increment)
The defender assignment is fixed-by-depth — **reassigning** coverage (put your CB1 on their WR1, bracket
a star) is the **in-game adjustments** increment. No OL↔DL trench split yet (sacks/run still use team
adv); no double-teams/safety help, no route concepts. Defense remains OC-run.

---

## Phase 24 design — in-game adjustments

Decided 2026-06-29 with AJ — the direct payoff of Phase 23's matchups, and the "live sideline" half of
the play-calling vision: react to what you see (your CB getting cooked) by **reassigning coverage** and
**settling a rattled player**. Penalties/"talk them down" need a penalty model and are a later increment.

### The determinism problem (and the timeline)
Adjustments are *persistent* settings that affect many future plays — but the Phase 22 driver only pauses
on your **offensive** decisions, and a naive "apply the current plan to the whole game" would rewrite the
*past* on every re-run (the score you watched would change). Solution: a **timeline** —
`g.adjusts = [{at: playNo, plan}]`. The engine keeps a global `playNo` (incremented per play) and
`planAt(pno)` returns the latest plan with `at ≤ pno`, so an adjustment applies **only going forward**.
The driver tags each edit with `ctx.play` (the index at the current pause) and **re-runs** — past plays
(index < at) keep the old plan, so the watched score-so-far is preserved. The same timeline replays on
commit (`gameDecideOpts` → `simGame`/`buildGameLog`), so **watch == commit** holds. All deterministic
(no rng), and an empty timeline is byte-identical to the AI game (so `simlab`'s envelope is untouched).

### The two levers (pure engine)
- **Coverage reassignment** — `plan.shadow[slot] = defenderId` (slot = the opponent receiver's `pos+so`,
  e.g. `WR0` = their WR1). When that receiver is targeted and the controlled team is on **defense**, the
  engine overrides `coverDef` to the assigned man → the matchup (and `cvYds`) shift. Put your shutdown
  safety on their stud and watch his yards fall.
- **Pep-talk / settle** — `plan.boost[playerId] = +N` (a small effective-OVR bump for the rest of the
  game), folded through a boosted-OVR helper (`bov`) into `matchEdge` (works whether he's your WR on
  offense or your CB on defense). It's a deliberate controlled-team coach effect (like `coachGameEdges`),
  small, and inert for everyone else.

### UI
A **🛡 In-game adjustments** sheet on the coach view (available at any pause): per-opponent-receiver
coverage pickers (your DBs, by name + OVR) and a "settle a player down" toggle that surfaces your
most-targeted men — with the live 🔥-cooked matchup panel right above it to inform the call. "Apply"
banks the plan onto the timeline and re-runs.

### Save & validation
Save **v27** (optional `g.adjusts`; `migrateState` v26→v27 is a no-op — absent reads as the AI game).
`simlab` → 44 (shadowing a stud WR with a better defender cuts his production 117→52; a pep-talk to the
beaten corner helps; an empty timeline == the un-adjusted game byte-for-byte; deterministic replay; an
adjustment set "in the future" never changes the past). `qa` → 239 (the sheet opens; applying records a
coverage + pep-talk on the timeline). **Fourteen gates** (Phase 24 extends `simlab` + `qa`).

### Deliberately out of scope (this increment)
No **double-team/bracket** (one defender per slot), no offensive adjustments (hot routes), no defensive
play-calling (blitz/coverage shells), and **penalties/"talk them down"** + **injuries/fatigue** are their
own increments (the former needs a discipline model, the latter an attrition model). Adjustments are made
at your offensive pauses (you set them before your defense's next series); there's no per-defensive-snap
prompt, by design (advancing stays fast).

---

## Phase 25 design — penalties & discipline

Decided 2026-06-29 with AJ — the last piece of the original three-part play-calling vision ("if my team
is getting too antsy with penalties, I need to talk them down").

### Model (pure, in the SIM engine)
Per snap, before the play, a pre-snap foul can fire: `penRate(team, calm, q) = PEN_BASE × composure
factor × situation`, where the composure factor comes from `teamComp` (avg starter `compVal`, Phase 10 —
an undisciplined room flags more), and situation = road team (crowd noise) + 4th quarter (frustration).
One rng draw per snap decides off-foul / def-foul / clean. A flag costs 5 yards and **replays the down**
(false start backs you up; offside can gift a first down). It's **capped per drive** (each flag also
charges a little clock) so the loop always terminates. Deterministic from rng; mostly symmetric (both
teams foul) so the validated scoring envelope holds. Per-game tallies live in a `penInto` object.

### The lever + UI
"Calm them down" reuses the **Phase 24 adjustment plan** (`plan.calm`) — when set, your team's
`penRate` is halved for the rest of the game. Because it's in `g.adjusts`, it **replays on commit**
(watch == commit) with **no save bump**. UI: 🚩 flags appear in the play feed automatically, a penalties
row shows in the live matchup panel, and the adjustments sheet has a **"🚩 Calm them down"** toggle.

### Validation
`simlab` → 47 (penalties at a realistic ~7/team/game; a low-composure team commits more; calm cuts a
team's fouls roughly in half; envelope intact). `qa` → 241 (calm is recorded on the timeline; penalties
accrue + surface). No save bump (per-game + the lever rides in `g.adjusts`).

### Deliberately out of scope
Pre-snap fouls only (no holding/PI/post-play flags yet — those negate gains / spot-foul and are a
follow-up); penalties don't accrue to a season stat (per-game only); no per-player penalty attribution.

---

## Phase 26 design — injuries & fatigue (in-game)

Decided 2026-06-29 with AJ — makes the **bottom of the roster** matter and gives the matchup engine teeth:
a forced-in backup is exposed at his specific matchup (Phase 23), and a workhorse wears down.

### In-game only (the deliberate scope)
`simEngine` is **pure** (never mutates its inputs), and league-wide cross-week injury state would mean
mutating every team's roster + a big save/ratings systemic change. So v1 is **in-game only**: an injury
knocks a player out **for the current game** via an in-engine `injured` Set (resets next game). This is
pure, deterministic (from rng), needs **no save bump**, and still delivers the payoff — the backup plays
*this* game and his lower matchup shows. Cross-week persistence is a noted follow-up.

### Injuries
A small per-snap chance (`INJ_RATE`, ~0.55% on the ball-carrier + a bit less on the defender in the play)
adds the player to `injured`; `wpick` and `coverDef` skip injured players (the next man up gets the
touches / the coverage), and a healthy QB is chosen from `qbList` (a QB injury presses the backup — a big
swing). Injuries surface via `injInto` (a list of {id, team, pos, name}) → a 🩹 "Out" line in the panel +
feed events. Symmetric across teams → envelope-neutral-ish.

### Fatigue
A pure, unit-tested `fatigueCost(touches, q)` — **zero** before the 4th quarter and under an 18-touch
threshold, then a small bounded OVR cost (≤6) that grows with the workload — folded into the effective
OVR (`bov`) used by `matchEdge`. A 30-carry back fades down the stretch; rotating avoids it. Mild by
design so the envelope holds.

### Validation
`simlab` → 52 (injuries occur at ~1/game and are deterministic; `fatigueCost` is zero-early / under
threshold / monotonic + bounded; envelope + leaders intact). `qa` → 241. No save bump (in-game only).
(The "varies by seed" determinism check was strengthened to compare the full box, not just the score —
with more rng draws in play, two seeds can now collide on the final score while differing in the game.)

### Deliberately out of scope
No **cross-week** injury persistence (in-game only), no injury severity/types/return-timeline, no
position-by-position injury rates, fatigue only on ball-carriers (not linemen). These are follow-ups.

---

## Phase 27 design — week-to-week injuries

Decided 2026-06-29 with AJ — the cross-week version of Phase 26: a star going down costs you for *weeks*,
so depth and the "needs" board matter across a season.

### Persistence without breaking the pure engine
`simEngine` stays pure (never mutates inputs). So injuries persist as a sparse per-player `p.inj` (weeks
out) that the engine *reads* (a player with `p.inj>0` sits) but the **app** writes. Flow: a game's
`res.inj` (each {id, pos, name, **out**} where `out` = future weeks missed, rolled by the pure `injDur`)
is applied **once** — in the advance (`applyInjuries(g._inj)`), never on a determinism re-sim — and the
whole league heals a week (`healWeek`) after each advanced week/round (and fully at rollover). Severity
is top-heavy toward day-to-day with a multi-week tail (`injDur`).

### Effective rating + the "next man up"
A depleted team is genuinely weaker: `availRatings(team)` recomputes the top-11 over *available* players,
and `simSides` feeds that into the game (so losing your star QB drops your offense, not just one matchup);
`gamePools` excludes the injured (the backup gets the touches; `qbList` presses the backup QB).

### The replay problem → freeze availability per game (`g.out`)
Because injuries mutate rosters mid-season, naively re-simming a *past* game (greatest-games replay, the
determinism gate) would use *today's* roster and diverge. Fix: each game **freezes** the set of players
who sat at kickoff (**`g.out`**), and `gamePools`/`availRatings` use that frozen `benched` set when given
(else fall back to live `p.inj`). So a played game always replays its real result; a fresh game freezes
from the current injury state (watch == commit, since the watch and commit use the same pre-game state).

### Save & validation
Save **v28** (sparse `p.inj`; `g.out` rides on the schedule, nulled at rollover; migration is a structural
no-op — absent reads healthy). `simlab` → 55 (`injDur` mix + bounded; an injured starter is benched and
the backup plays; multi-week injuries occur over a season). `qa` → 245 (injured starters drop the
available rating; a player is held out; injuries heal a week at a time; the Home injury report renders;
**greatest-games replay stays faithful** thanks to `g.out`; the determinism clone carries `g.out`). UI: a
🩹 OUT (Nwk) roster badge + a Home Injury Report.

### Deliberately out of scope
No injury *types*/severity beyond a duration, no return-to-play ramp (a returning player is at full
strength), no IR/roster-replacement management, no in-UI "rest a banged-up starter" toggle (injuries are
engine-driven). These are follow-ups.

---

## Phase 28 design — defensive play-calling

Decided 2026-06-29 with AJ — the other half of "calling a game": you now coach your **defense** too, a
pre-snap chess match against the offense's run/pass.

### The call (a pre-snap guess)
When the controlled team is on defense, the `decide` hook fires with `phase:'def'` (gated by the same
Key/Full/Auto mode + `shouldPromptCtx`), returning **base / blitz / cover / run-stop**. The call is made
*before* the play is revealed (a read on tendency), and it shifts the play's resolution in
rock-paper-scissors:
- **blitz** → more sacks (`+dSack`) but completions that beat it go big (`+dPassY`), and it's **gashed by
  the run** (`+dRunY`). High variance.
- **cover** (2-high) → fewer completions + shorter (`−dComp`, `−dPassY`); slightly soft vs the run.
- **run-stop** (stack the box) → **stuffs the run** (`−dRunY`) but **opens the pass** (`+dComp`, `+dPassY`).
- **base** → neutral.
A coach who reads "3rd & long → pass → cover/blitz" and "3rd & short → run → run-stop" gains an edge; a
wrong guess gets burned. (`simlab`: cover 254→156 pass yds; run-stop 185→59 rush but 254→393 pass.)

### Envelope-safe by construction
**The AI defense always calls 'base' (a literal no-op)** — no rng, no modifier — so AI-vs-AI games are
byte-identical to pre-Phase-28 and the validated envelope is untouched. Only the *player's* defensive
calls move anything. Defensive calls record into the **same `g.calls` stream** as offensive calls
(`decide` fires once per controlled-team play, offense or defense, in play order), so they **replay on
commit** (watch == commit) and **need no save bump**. The OC/DC default + the replay fallback resolve a
`phase:'def'` decision to `'base'`.

### UI
The coach view, on a defensive snap, swaps the Run/Pass buttons for **Base / Blitz / Cover / Run-stop**
(+ "Defer to DC"); the field shows the opponent driving. Everything else (the matchup panel, in-game
adjustments — coverage reassignment is especially handy here — penalties, mode toggle) is unchanged.

### Validation
`simlab` → 59 (cover/run-stop cut the matching attack and trade off the other; base == AI byte-for-byte;
the hook fires for the controlled team on both sides). `qa` → 246 (defensive calls are part of the
deterministic coached game; watch == commit holds with defense in the call stream). **Fourteen gates**;
no save change.

### Deliberately out of scope
The AI defensive coordinator is **Phase 29** (the AI now calls defense vs your offense). No blitz/nickel
**personnel** packages, no coverage *shells* beyond the four calls, no per-defender assignment within a
call (that's the Phase 24 coverage-reassignment lever).

---

## Phase 29 design — AI defensive coordinator

Decided 2026-06-29 with AJ — completes the two-sided chess: on **offense** you now face a scheming DC,
not a passive base look.

### The brain (pure)
`aiDefCall(ctx, rv)` returns base/blitz/cover/run-stop from down & distance + the offense's run/pass
**tendency so far** (`runRate`, read from the engine's `usage` counts), plus a seeded roll `rv` for
disguise: short yardage / a run-leaning offense → stack the box (run-stop, mix in pressure); long downs /
a pass-leaning offense → cover or blitz; standard downs → mostly base with some disguise. So it punishes a
one-dimensional attack (synergizing with the predictability tax) but can't key a balanced one.

### Envelope-safe scoping (the crucial bit)
The AI DC fires **only when `off.id===aiDefVs` and the defense isn't the player** — i.e., only against the
*controlled* team's offense. `aiDefVs` is passed by the app (`simGame`/`buildGameLog`/the interactive
driver) as `S.teamId`, so it's set for every game but **inert** in AI-vs-AI matchups (neither team is on
offense as `aiDefVs`) → no rng consumed, league results + `simlab` byte-identical. It consumes one `r()`
draw per controlled-offense snap → deterministic, so watch == commit holds; **no save bump** (nothing
stored — the DC re-derives from the seed).

### Validation
`simlab` → 63 (situational distribution — run-stop on short, cover/blitz on long, never the wrong one;
keys tendency — an all-pass offense drops 10.6→6.3 pts/g vs the DC; `aiDefVs` is inert when that team
isn't on offense → AI-vs-AI byte-identical). `qa` → 247 (your predictable offense scores fewer points vs
the DC than vs a base defense, averaged over your slate). **Fourteen gates**; no save change. A normal
defer-to-OC offense (≈50/50) faces a mostly-base DC, so it isn't oppressive — only spam gets punished.

### Deliberately out of scope
The AI DC is uniform (not yet scaled by the opponent's DC rating / prestige); the adaptive AI *offensive*
coordinator is Phase 30; and still no blitz/nickel **personnel** packages.

---

## Phase 30 design — adaptive AI offensive coordinator

Decided 2026-06-29 with AJ — the mirror of Phase 29: now calling **defense** is a chess match, because the
AI OC reads and counters your defensive tendencies (before this, the AI offense used a fixed `passProb`).

### The read (pure)
The engine tracks each team's defensive-call mix in `dusage` ({base, blitz, cover, run-stop}). When the
controlled team is on defense (`def.id===aiOffVs`, opponent on offense), `aiOffPassAdj(dusage[you])` biases
the OC's `passProb`: run-stop-heavy → throw more (run-stop opens the pass); blitz/cover-heavy → run more
(blitz gets gashed, cover = a light box). It reads your tendency **so far** (the current snap's call is
recorded *after* the read), needs a small sample before reacting, and is bounded (±0.18). So a one-note
defense gets punished, while a varied one isn't read — the exact mirror of the predictability tax + AI DC
on offense.

### Envelope-safe + deterministic (same pattern as Phase 29)
`aiOffVs` (passed by the app as `S.teamId` through `simGame`/`buildGameLog`/the driver) fires **only when
the controlled team is on defense**, so it's **inert in AI-vs-AI games** (the league envelope + `simlab`
untouched). It only shifts `passProb` (no extra rng draw) and reads `dusage` (built from the player's
defensive calls, which replay from `g.calls`), so it's fully deterministic → watch == commit, **no save
bump**.

### Validation
`simlab` → 68 (`aiOffPassAdj` direction + the small-sample/balanced gate; the OC throws more on a
run-stop-happy defense, 249→314 pass yd/g; `aiOffVs` inert when that team isn't on defense → AI-vs-AI
byte-identical). `qa` → 248 (a predictable all-run-stop defense gives up more points vs the adaptive OC
than vs a static one). **Fourteen gates**; no save change.

### Deliberately out of scope
The AI OC's read is run/pass only (no screen/PA/deep-shot palette yet), it isn't scaled by the opponent's
OC rating. Special packages are Phase 31.

---

## Phase 31 design — special packages

Decided 2026-06-29 with AJ — the final item from the very first message ("bring in the DT to lead-block on
a goal-line situation"). Situational **offensive personnel** the coach dials up per play.

### The two packages
A package is a single extra token on the offensive `decide` (so it fits the `g.calls` stream and replays
cleanly), resolved as a run or pass with a modifier:
- **Heavy** — a power run with extra blockers (the DT lead-blocking). `heavyRunBonus(togo,los)` is **+4 on
  short yardage / at the goal line**, +2 at medium, **−3 on long** (no pass threat, the defense sits on
  it). The goal-line hammer; useless on 3rd-&-15.
- **Spread** — empty 4-wide. +0.05 completion and +3 yards (extra receivers stress the coverage), but
  **fewer blockers → more sacks**, badly so vs a blitz (+0.08 sack). Air it out, but not into pressure.

They mesh with the Phase 28 defensive calls for a deeper chess match: heavy is blunted by run-stop (stacked
box) and gashes a light box (cover); spread is shredded by the blitz and thrives vs a soft shell.

### Envelope-safe + deterministic
`heavy`/`spread` are **player-only** — the OC/AI default is always `run`/`pass` (`ocCall`), and the Phase
30 AI OC only shifts `passProb` (never selects a package). So AI-vs-AI games + `simlab` are byte-identical
(no package code path is hit without a player call). The calls ride in `g.calls` (replay on commit → watch
== commit), so **no save bump**.

### Validation
`simlab` → 72 (`heavyRunBonus` curve; the heavy package on short yardage outscores no package; spread gains
more passing yards but takes more sacks — the real trade-off). `qa` → 249 (heavy/spread are callable and
reproduce on commit). **Fourteen gates**; no save change. UI: Run / Pass / Heavy / Spread on the offensive
play-call, with a one-line "Heavy = goal-line power · Spread = empty 4-wide (watch the blitz)" hint.

### Deliberately out of scope
Two packages, offense-only (defensive nickel/dime personnel overlap with the cover/run-stop calls already);
the AI doesn't call packages; no broader formation/route palette (screen, PA, deep shot). This closes the
original game-day vision — further play-type depth is a future thread, not a gap.

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

## Phase 33 design — recruiting rework (intent queue + scouting facility + AI brain)

Decided 2026-06-29 with AJ. The Phase 4 loop applied recruiting actions **immediately** (click pitch →
interest jumps now) and the AI only did **flat passive growth** on every suitor. AJ's reframe: each week you
have a points budget from your **scouting facilities**, you **set an intended action** on a recruit (one per
recruit/week, barring a special), and at the **week change** the game calculates **all** the actions toward
that recruit — yours *and* every AI program's — and recomputes his interest, so the resolution sees the whole
competitive picture at once. Two forks settled up front: points are driven by a **new `fac.scouting`
facility** (not prestige), and the AI takes **discrete weekly actions** (a real recruiting brain), not just
passive growth.

### The hard constraints (what could NOT move)
The fenced `RECRUIT ENGINE` is lab-validated (`reclab`) for **convergence** (~92% sign by Signing Day), a
**class cap**, **prestige sensitivity**, **decommits**, and **determinism**. The rework had to preserve all
of that. So the engine change is **additive**: passive growth stays exactly as-is (the convergence machinery
is untouched), and the AI brain layers a *concentrated* push on top. The player's actions stay in the **app**
(reusing the existing tuned pitch/visit/promise/alumni/scout effect math) and are applied to `iv` **before**
the engine runs each week, so the engine only had to learn (a) AI discrete actions and (b) to skip the
human's team.

### The scouting facility (drives the budget — both sides)
- New `fac.scouting` (1–10) — generated in `genWorld` scaled by prestige (like stadium/strength), upgradable
  via the existing `facilityUpgradeCost`/`applyFacilityUpgrade` path (`FAC_BASE.scouting`), shown on the
  Program facility list + the team-browser, in the import schema/template, and backfilled by the v29→v30
  migration (`clamp(round(prestige/11),1,10)`).
- `weeklyPoints()` = `max(4, round(REC.BASE_POINTS + scouting*1.6 + coachMods.points))` — scouting-dominant,
  the prestige term **removed**, the coach-archetype term kept so **Recruiter** still matters. `REC.BASE_POINTS`
  dropped 12→6 so scouting carries the budget.

### The intent queue (player side — app layer)
- `S.recruiting.intents = { [recruitId]: { action, angle?/legendId?, cost, gain?/scoutDelta?, label } }`.
- `setRecIntent(rec, action, opt)` validates (on board, not signed/committed-to-you, once-flags for
  visit/promise/alumni), **reserves** the point cost up front, and **captures the full effect at set-time**
  (so the **game-day visit bonus** + coach mods are locked in even though the game is played before the week
  resolves). A second action on the same recruit **replaces** the first (refund-then-charge). `clearRecIntent`
  refunds. `RECRUIT_COSTS` unchanged (scout 2 / pitch 3 / visit 5 / promise 4 / alumni 4; offer is still a
  free board slot).
- `applyPlayerIntents()` lands every queued intent (bump interest / sharpen scouting / set the once-flag /
  spend a legend appearance), then clears the queue. Called at the in-season week change (`resolveRecruitingWeek`,
  before `advanceRecruiting`) **and** at National Signing Day (before the finalize pass), so a final-push intent
  still counts. The Early Signing Period clears the queue when it grants the push budget.

### The AI recruiting brain (engine — `advanceRecruiting`)
`advanceRecruiting(... , playerTeamId)` — after passive growth, a new **1.5) concentrated-effort** pass (only
when `!finalize`): bucket the pool by suitor (skipping `playerTeamId`), then for each AI team spend an
`aiBudget(team)` (`REC.AI_BASE + scouting*REC.AI_PER`, `REC.AI_COST` per action; fac-less lab teams default to
5) on its highest-`aiPriority` targets (`fit*12 + traction*0.12 + need`), each a deterministic `aiActionGain`
push. It chases the **uncommitted + rivals' flippable verbals** (never its own verbal — passive growth defends
those). The AI is a literal **no-op on the finalize pass and on the player's team**, so the validated envelope
(convergence/cap/decommit) holds; a limited budget spread thinly across a big board keeps it from
over-committing (the decommit "small gap doesn't flip" scenario still holds because each AI team only acts on a
few recruits/week).

### UI
The recruit-sheet action rail now **sets/replaces a queued intent** instead of applying immediately (the
selected action is highlighted with a ✓; pitch/alumni still open their angle/legend picker, which queues). A
**"This week's plan"** card (`planCard`) on the recruiting view lists every queued action + the points reserved,
each with a clear (✕) button; the board row shows a **⏳ <action>** chip; the Home recruiting card shows a
**⏳ N queued** count.

### The scouting payoff + AI scout action
Scouting was the player's fog-clearer only, so the AI had no reason to scout. To make the AI scout action
*mean* something, scouting now has a **recruiting-effectiveness payoff for everyone**: `recScoutMult(rec) =
1 + 0.3 × scout/100` (×1.0 unscouted → ×1.3 fully scouted — **pure upside**, so the scout=0 baseline is
byte-identical to the pre-payoff envelope) multiplies the interest gain of an action — folded into the
player's queued pitch/visit/promise/alumni gains (captured at set-time) **and** the AI's `aiActionGain`. So
both sides have a real **scout-then-pitch tempo** choice (evaluate first → land harder, vs. spam pitches now).
The **AI brain** spends a minority of its weekly budget scouting (`REC.AI_SCOUT_P` of its under-evaluated
targets get a `REC.AI_SCOUT_GAIN` bump toward `REC.AI_SCOUT_TGT`, the rest pitch) — raising the **shared**
`rec.scout`. Because many suitors chase the same blue-chips, **5★/top recruits get well-evaluated** by the
field (the player gets free intel on them, and his fogged read sharpens), while the **deep 2★/3★ tail stays
foggy** (the player keeps his scouting edge there — that's where scouting your own targets pays). Tuned so the
budget stays mostly on pitches (a strong-scouting program still out-recruits a weak one **16→8** head-to-head)
and convergence holds (~90% signed). No new save field — `rec.scout` already exists.

### Save & validation
Save **v30** (per-team `fac.scouting`, `S.recruiting.intents`; `migrateState` v29→v30 backfills the scouting
level from prestige + an empty intent queue). `reclab` → 35 (the AI concentrated effort + scout actions don't
break convergence/cap/decommits; a **better-scouting program out-recruits an equal-prestige rival** 16→8 of 24
head-to-head; the AI weekly budget scales with the facility; the AI scout action concentrates on blue-chips +
is bounded + deterministic; the `recScoutMult` payoff is monotonic upside). `qa` → 257 (scouting drives the
budget; setting Scout queues + reserves; a later action replaces it — one per recruit/week; resolving applies
the queued action and clears the queue; the full season cycle still ends in verbals; the AI scout action
evaluates blue-chips over a season). **Fifteen gates** (Phase 33 extends `reclab` + `qa`).

### Deliberately out of scope (v1)
The **"use a special to take two actions on one recruit"** perk (AJ's parenthetical) is deferred — v1 is a
strict one-intent-per-recruit. The AI's pitch math doesn't model specific pitch *angles* (the player's does),
and there's no per-recruit signing calendar beyond the existing Early/National periods.

---

## Phase 34 design — recruiting legibility (the weekly board report)

Decided 2026-06-30 with AJ — the first of the "improve recruiting week to week" ideas. Phase 33's loop was
mechanically complete (queue intents → resolve with the AI brain → commits/flips) but **informationally
flat**: every week you poked interest numbers and waited. The highest value-per-effort fix is **legibility** —
surface *what moved and why* each week so the player can read a developing story and react, which also makes
the AI brain + scouting work you can already feel. Envelope-safe by construction: it's pure surfacing of data
the resolution already produces (no change to `iv`/commit math, no rng).

### The pure read (`recruitReaction`, in the RECRUIT ENGINE block)
`recruitReaction(c)` — depends only on the diff context `c` the app computes (no rng, no DOM, no `S`), returns
`{text, tone}` with `tone ∈ 'good'|'bad'|'warn'|'neutral'`. A **headline ladder** puts the urgent/decisive
events first so the one line you see is the one that matters: (1) committed to you / flipped to you → good;
(2) decommitted/flipped away → bad; (3) a **rival surging ahead** (`rivalDelta ≥ 10 && rivalLeads && myDelta <
rivalDelta`) → warn ("⚠️ Cooling — ABC is pushing hard"); (4) **your action's result** keyed on `prefMatch`
(pitch on his top priority that moved him → "🔥 Loved your NIL pitch — exactly what he wants"; off-priority →
"didn't move the needle — not his priority"; visit/promise/alumni/scout each get their own line); (5) drift if
you didn't act (climbed to #1 / slipped a spot / trending up / quiet week). `reclab` validates the ladder
(tones correct per scenario, decisive events outrank a same-week action, always returns text + a known tone).

### The app diff (`recruitPreSnaps` + `buildRecruitReport`, in `resolveRecruitingWeek`)
- `recruitPreSnaps()` — **before** resolution, snapshot each board recruit: my interest, my rank, a **copy of
  the full suitor `iv` map**, my committed-to-me flag, and my queued intent (action + angle). Captured before
  `applyPlayerIntents` clears the queue.
- After `advanceRecruiting`, `buildRecruitReport(snaps, week)` diffs each board recruit against the resolved
  state: my interest Δ, rank change, the **biggest rival mover** (max `iv` gain among other suitors + whether
  he now leads), and commit/flip state (`committedMine`/`flippedAway` from the snapshot, `flippedToMe` from the
  transient `rec._flipped`). It calls `recruitReaction`, keeps only **notable** rows (you acted, or a
  commit/flip/rival-surge/big-Δ), sorts by urgency (commits/flips → cooling → good → neutral; then star, then
  |Δ|), and stores the top 10 on `S.recruiting.report = {week, reactions:[{id,name,pos,stars,text,tone,myDelta}]}`.

### UI
A **"Last week's board report"** card (`reportCard`) on the recruiting view, placed **above** the plan card
(read what happened → then set this week's plan): each row is a recruit + a tone-colored reaction line + your
interest Δ (green/red), and opens the recruit sheet. The Home recruiting card gets a one-line **teaser** of the
top reaction. Hidden once the class closes.

### Save & validation
**No save bump** — `S.recruiting.report` is transient (rebuilt every in-season week, absent-safe, and
`S.recruiting` is recreated at kickoff), so there's nothing to migrate. `reclab` → 44 (the reaction ladder +
robustness), `qa` → 259 (a weekly report with readable reactions is generated over a full season; the report
card renders on the recruiting view). **Fifteen gates** (Phase 34 extends `reclab` + `qa`).

### Deliberately out of scope (this pass)
Legibility only — no new *mechanics*. The national blue-chip commit news stays in the Phase 19 media feed (this
report is **your board**, not the country). The other "week to week" ideas — **season results rippling into
weekly recruiting** + **commitment-date windows** (drama), **weekly action scarcity** (capped official visits,
the double-down special, diminishing returns), and **interest decay-on-neglect** — are separate follow-ups, not
part of this pass.

---

## Phase 35 design — week-to-week recruiting depth (drama + scarcity + upkeep)

Decided 2026-06-30 with AJ — "implement all of your week-to-week recruiting ideas." The four remaining items
from the Phase 34 list, built as one batch. The governing constraint (as always): the fenced RECRUIT ENGINE is
`reclab`-validated for convergence/cap/decommits, so anything that could move those is either **player-only**
(the AI/league dynamics are untouched) or **envelope-neutral by construction**.

### (1) Season ripple — your Saturday matters to recruits
Pure `gameRecruitVibe(my,opp,myRank,oppRank)` (in the RECRUIT block): a signed interest nudge from the
controlled team's result — a **ranked statement win** is the biggest boost, a **blowout loss** stings, bounded
to [−6, +9]. The app (`applyGameRipple`, in `resolveRecruitingWeek` after the game is simmed) reads the
controlled team's game that week and applies the vibe to **your board's** interest, scaled by proximity
(**in-state recruits feel it ~2× the out-of-state**). Player-only (only `rec.iv[me]` moves), so the league
envelope is untouched. Surfaced as a one-line **note** on the weekly report ("📈 Your win over ABC energized
your board").

### (2) Commitment windows — a decision date, with one last push
In the fenced commit pass: when a **blue-chip (4★+)** first passes the readiness/threshold/roll to commit
(mid-season), instead of committing he **announces a decision a week out** (`rec.decideWeek = week+1`). When the
window elapses (`week ≥ decideWeek`, checked *before* the threshold gate so a cooled recruit still decides) he
**commits to whoever LEADS then** — so a rival or the player can flip the race during the window. The finalize
(Signing Day) pass commits any pending window immediately. Envelope-neutral: it only **delays/announces** a
commit the engine would have made, consuming no extra rng (the commit roll already happened), and the **2★/3★
tail never windows** — so `reclab` convergence holds (~90%). The report calls it out ("🗓️ Announced his
decision — commits Week N (you lead!)"), and the board row + recruit sheet show the date.

### (3) Weekly scarcity — the choice is now a tradeoff
The intent queue (`S.recruiting.intents[recId]`) became an **array of ≤2 actions**:
- **Double-down** (`R.doubles`, granted weekly, +1 for a **Recruiter**) — a token that lets you stack a **2nd
  action** on one recruit (e.g. scout *and* pitch the same week). Without a token, a 2nd action **replaces** the
  first (the old one-per-recruit rule). `setRecIntent` is now a **toggle** (clicking a queued action removes it,
  refunding points + the token if it was the stacked 2nd).
- **Official-visit cap** (`visitCap`, 1 / 2 for a Recruiter) — you can only host so many visits per week across
  the whole board, so you choose *who* to bring in (NCAA-realistic), independent of points.
- **Diminishing returns** (`repeatFalloff(n)`, pure) — repeating the **same pitch** on a recruit pays less each
  time (tracked on `rec.hits`), so varying your approach beats spamming one angle.

### (4) Decay-on-neglect — relationships need upkeep
`decayNeglect(actedOn)` (app, player-only): a board recruit you **didn't work that week** cools on you a little
(`REC.NEGLECT_DECAY`, roughly cancelling a week's passive growth, so a neglected target stagnates while active
rivals climb). Skips recruits committed elsewhere (not your relationship to keep), but **your own verbals decay
too** — neglect one and a rival can flip him (pairs with the Phase 16 decommit logic). Player-only, so the
engine envelope is untouched.

### Save & validation
Save **v31** — `S.recruiting.intents` values are now arrays + `S.recruiting.doubles`; sparse `rec.decideWeek`
and `rec.hits` ride in the columnar pool's per-recruit side-object (auto-persisted, no codec change).
`migrateState` v30→v31 converts any old single-object intents to arrays + backfills `doubles`. `reclab` → 53
(windows announce + resolve + still converge, tail never windows; `gameRecruitVibe` ordering + bounds;
`repeatFalloff` monotonic/floored), `qa` → 262 (a double-down stacks a 2nd action; the visit cap holds; decay
cools a neglected recruit; a commitment window opens over a season). **Fifteen gates** (Phase 35 extends
`reclab` + `qa`).

### Deliberately out of scope (this batch)
The AI doesn't schedule visits or react to its *own* results (its weekly effort is still the Phase 33 budget +
the Phase 33 scout action). No top-N **finalist list** per recruit, no NIL bidding, no per-recruit official-
visit *calendar* beyond the weekly cap. These are the obvious next polish if the loop proves fun. *(The first
three landed in Phase 36 below.)*

---

## Phase 36 design — AI recruiting depth + finalist lists

Decided 2026-06-30 with AJ — the polish phase from the Phase 35 note: make the AI match the player's new depth
(it should schedule visits + react to its results), and add the headline drama the player's loop was missing —
a recruit **narrowing to a finalist shortlist**. Same constraint: the fenced RECRUIT ENGINE is `reclab`-validated
for convergence, so every change is envelope-safe.

### Finalists (the headline)
`rec.finalists` — a shortlist of his top suitors. The new **pass 0** in `advanceRecruiting`: an uncommitted
recruit who has **matured** (`readiness ≥ REC.FINAL_READY` *and* his lead interest ≥ `REC.FINAL_BAR`, with more
suitors than the cut size) narrows to his **top `REC.FINALISTS`(4)** by interest, set once. A pure
`isFinalist(rec,tid)` then gates **every later pass** — growth, the AI brain, decommits, and commitment — so a
**cut suitor freezes** (no growth) and **cannot win or flip** him. The catch that preserves convergence: the
**finalize (Signing Day) pass ignores the shortlist** (`last || isFinalist`), so a recruit whose finalists all
stagnated still signs with his best available suitor instead of going unsigned — freezing the field mid-season
was dropping ~8% of signings until this. App/UI: being **cut** blocks `offerRecruit`/`setRecIntent` **in the open
race only** (a committed-elsewhere verbal is still chaseable — the Phase 16 flip path, which the engine already
restricts to finalists); the report emits "✅ Made his top 4" / "✂️ Cut from his finalists"; the board row shows a
🎯/✂️ chip and the sheet a finalists card.

### AI visits (matching the player)
In the AI brain loop: with probability `REC.AI_VISIT_P`, a team makes a big **concentrated push** on its **top
target** — two actions' budget for ~**2.2×** a normal pitch's gain (a well-scouted target only). It's a visible
interest spike that mirrors the player's official visit and reads in his report as a rival "pushing hard."
Budget-bounded (it's concentration, not extra interest), so convergence is unchanged.

### AI momentum (reacting to its results)
`aiBudget(team)` gains a **season-record** multiplier from `team.rec` — a hot program (high win%) recruits with a
bigger weekly budget, a cold one with less — **centered at .500, bounded to ±20%**, and **guarded** (`if(team.rec
&& games≥3)`), so the rec-less synthetic teams in `reclab` are unaffected and the validated convergence cycle is
byte-identical. So the AI "reacts to its results" at the season level (a hot team is a hot recruiter), available
in-engine without needing per-game data.

### Save & validation
Save **v32** — `rec.finalists` rides sparsely in the columnar pool side-object (auto-persist, no codec change);
`migrateState` v31→v32 is a structural no-op (absent = no shortlist yet; momentum/visits are derived). `reclab`
→ 60 (finalists narrow to a shortlist + cut suitors freeze + a meaningful share get one + the cycle still
converges ~91%; the AI visit produces an outsized single-week push; `aiBudget` momentum responds to the record
and is neutral for rec-less teams), `qa` → 264 (recruits narrow to a shortlist over a season; a cut recruit
can't be offered/worked). **Fifteen gates** (Phase 36 extends `reclab` + `qa`). Tuning that mattered: freezing
cut suitors dropped convergence 90→82% until the finalize pass was made to **ignore the shortlist**; settled on
`FINALISTS=4` / `FINAL_BAR=58` / `FINAL_READY=0.55` → 91%.

### Deliberately out of scope (this phase)
The AI still doesn't react to *individual* game results the way the player's `applyGameRipple` does (its momentum
is season-record-level, to avoid a per-game league-wide ripple the lab can't validate). No **NIL bidding**, no
**official-visit calendar** beyond the weekly cap, no recruit **re-opening** a closed shortlist. *(The first
three landed in Phase 37 below.)*

---

## Phase 37 design — recruiting polish (AI ripple · NIL bidding · visit calendar)

Decided 2026-06-30 with AJ — the three loose ends noted at the end of Phase 36, closing the recruiting-depth
thread (Phases 33–37). All three are **app-layer**: the fenced RECRUIT ENGINE + `reclab` envelope are untouched
(the only engine addition is the pure `nilGain` helper), so the validated convergence cycle is byte-identical.

### (1) AI reacts to individual game results — league-wide ripple
The player's Phase 35 `applyGameRipple` is generalized to **`applyLeagueRipple(week)`**: it computes every team's
`gameRecruitVibe` for the week and nudges the interest of the recruits each team is chasing (in-state most,
respecting finalists, skipping recruits committed elsewhere). It returns the **player's** note for the weekly
report. The asymmetry that keeps convergence: a **win energizes** every team's board, but a **loss only cools the
PLAYER's** board (his drama) — the **league-wide AI ripple is positive-only** and **skips marginal (<30) suitor
relationships**, so it never compounds negatively across the league and pushes the long tail below the
Signing-Day bar. Kept light (a board nudge, not a deciding factor).

### (2) NIL bidding — a money lever (ties to the finances loop)
A new **`nil`** action that pays from **`team.budget`** (not recruiting points): `NIL_TIERS`
(Modest $0.6M / Strong $1.8M / Blockbuster $4.5M) → interest via the pure **`nilGain(amountM, nilWeight)`**
(a saturating money curve), where `nilWeight` = how much the recruit values NIL (`nilWeightOf`: top priority →
1.5, secondary → 1.0, else 0.45) and the program's **NIL collective** amplifies (`nilFacMult` off `fac.nil`). It
rides in the Phase 35 intent array (reserve on set, refund on clear via `it.nilSpend`; a 2nd action still needs a
double-down). **AI programs bid too** (`applyAINil`, app-layer, in `resolveRecruitingWeek`): the strongest
non-player suitor of a NIL-valuing recruit spends a small, bounded slice of its budget (rich collectives bid
more), so the player must **out-bid rivals** on NIL kids — and it's reclab-safe (lab teams have no budget → it's
a no-op). UI: a 💰 **NIL offer** button + a tier picker showing your budget, collective level, and the est. boost.

### (3) Official-visit calendar — a season visit budget
`S.recruiting.visitsLeft` (`SEASON_VISITS`=12), decremented when a **visit resolves** (`applyPlayerIntents`), on
top of the existing weekly `visitCap` — so official visits are a resource you ration across the whole cycle, not
just per week. The action rail + plan card show **weekly and season** remaining; a visit is blocked when either
is exhausted. Granted fresh at kickoff (recruiting is recreated each cycle), backfilled by migration for in-flight
saves.

### Save & validation
Save **v33** — `S.recruiting.visitsLeft` (migration v32→v33 backfills it) + the NIL `nilSpend` field on intents
(absent-safe). `reclab` → 63 (the pure `nilGain`: monotonic in $, lands harder on a NIL-valuing recruit,
saturates at a huge bid). `qa` → 267 (a NIL bid reserves budget + raises interest; the season-visit budget spends
down; a team's game result ripples to the board it recruits). **Fifteen gates** (Phase 37 extends `reclab` +
`qa`). Tuning note: the league ripple + NIL wars make recruiting **more contested** (more recruits stay in play
to Signing Day), so the full-pool sign rate settles **~80%** — the larger uncommitted tail backfills as walk-ons
at rollover, exactly as the capacity-limited pool always has. The cycle's "aggressive push lands the target" qa
check was re-pointed at a recruit the program **fits** (a 3★ it already recruits) and now accepts "you lead him
into Signing Day," since the supercharged winning rivals can keep a *poached* 4★ contested all the way to NSD.

### Deliberately out of scope
No in-engine NIL **economy** (collective fundraising/management, a per-recruit bidding *war* resolved at NSD) —
NIL here is a money→interest lever, not an auction. The AI's per-game ripple is positive-only by design (the
negative side is a player-only feel). *(The "no official-visit weekend scheduler" limit here was reversed in
Phase 38 below.)*

---

## Phase 38 design — official-visit weekend scheduler

Decided 2026-06-30 with AJ — the deferred Phase 37 loose end. Official visits move from an abstract
**season count** (`visitsLeft`, 12) + a per-week **intent** (with a flat ×1.5 if you happened to host a home
game) to a real **calendar**: home-game weekends are the visit slots, and a marquee weekend is worth planning
around. AJ's three scoping calls: the scheduler **replaces** the per-week visit action; visits are **home-
weekends only** (the stadium-atmosphere hook); a weekend's boost scales with **opponent quality + my form +
rivalry/marquee** (no rivalry data in `TEAMS`, so "marquee" is rank-based — both teams ranked). House
discipline: a pure fenced engine + node lab before UI, a save bump, all gates green.

### Pure `VISIT ENGINE` (fenced, lab before UI)
`// === VISIT ENGINE (Phase 38) START/END ===` (depends only on `clamp` — no rng/DOM/S, so `test/visitlab.js`
extracts + evals it like camplab):
- `weekendQuality({myRank, oppRank, oppPrestige})` → a multiplier **centered ≈ 1.0**, bounded **[0.6, 1.7]**:
  base 1.0 + opponent **stage** (`rankPull(oppRank)` up to +0.45 at #1, fading out past ~25; + an `oppPrestige`
  term ±0.15 around ~60) + my **form** (`rankPull(myRank)` up to +0.2) + a **marquee** bump (+0.25 when both
  teams are top-15). The neutral case (unranked opp, mid prestige, unranked me) is exactly 1.0, and the **mean
  over a representative home slate ≈ 1.0** — so it *replaces* the old flat ×1.5 game-day bonus without moving
  the visit-interest envelope (lab-asserted, not hand-waved).
- `weekendTier(q)` → `VISIT_TIERS` (Quiet · Solid · Big · Marquee) for the UI.
The interest gain itself stays app-side: `20 × weekendQuality × m.visit × recScoutMult × homeStateBonus` — a
marquee weekend (~1.6) ≈ 32 vs a quiet home game (~0.8) ≈ 16, a real spread.

### App layer
- `S.recruiting.visitPlan = {week:[recruitId]}` — recruits booked per home weekend; `visitsLeft` (the season
  budget, still 12) is **reserved at booking** and refunded on unbooking (the points-reservation pattern).
- `homeWeekends()` / `weekendInfo(week)` (live quality/tier/slots) / `weekendCap()` (per-weekend host cap — 2,
  or 3 for a Recruiter; the repurposed `visitCap`) / `bookVisit`/`unbookVisit`/`canBookVisit`.
- `applyWeekendVisits(week)` — in `resolveRecruitingWeek` (the existing week-change resolver): boosts each
  booked recruit by the gain above, sets `visited`, bumps `rec.hits.visit`, clears `visitPlan[week]`, and
  returns a one-line note woven into the weekly board report (the per-recruit interest jump also shows as the
  report's `myDelta`). A booked recruit is added to `actedOn` so the Phase 35 neglect-decay skips him.
- The **old visit path is removed**: `'visit'` dropped from `RECRUIT_COSTS`; the `visit` branch deleted from
  `buildIntent`/`applyPlayerIntents`/`setRecIntent`; `isGameDayVisit`/`queuedVisits` removed.
- **AI is unchanged** — AI "visits" stay the engine's Phase 36 concentrated push (no AI weekend calendar), so
  the fenced engine + `reclab` envelope are untouched.

### UI
A new recruiting **Visits** tab (`recruitVisits`): a header (visits-left + per-weekend cap), then one card per
upcoming home weekend — week + "vs OPP", a colored **tier badge** + the multiplier, booked recruits (removable),
and "+ Book a recruit" → a per-weekend picker (`visitBookSheet`). The recruit sheet's old Visit button becomes
**"🏟️ Schedule visit"** → a weekend-picker (`visitSheet`, each option showing tier + est. boost + slots). Visit
counts surface on the plan card + the Home recruiting card.

### Save & validation
Save **v34** (`S.recruiting.visitPlan`; `migrateState` v33→v34 backfills `{}` — recruiting is recreated at
kickoff, so this only patches an in-flight in-season save). `visitPlan` rides plainly on `S.recruiting` (only
`recruiting.pool` is columnar), so it round-trips with no codec change. New gate **`npm run visitlab`** (20
checks: quality monotonic in opponent/prestige/form, marquee needs both top-15, bounded across a grid,
neutral≈1.0, **mean over a representative slate≈1.0**, tier ladder ordered, `rankPull` saturation, determinism +
no input mutation). `qa` → **273** (book onto a home weekend with the cap held, a season slot reserved, a non-
home week blocked, a weekend has a tier, resolving raises interest + marks visited + clears the plan, an
exhausted budget blocks booking, the Visits tab renders, v34 migration + a `visitPlan` codec round-trip).
**Sixteen gates** now (adds `visitlab`).

### Deliberately out of scope
No **AI weekend calendar** (AI visits stay the Phase 36 concentrated push); no off-season/road/bye visits (home
weekends only); no dated multi-day visit *slots* (a weekend hosts up to `weekendCap` recruits, not timed).

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

## Phase 40 design — rivalries & trophies

Decided 2026-06-30 with AJ — the flagged "marquee is a rank-based hack" gap, plus AJ's ask for **emergent
rivalries you create by playing a team a lot or in big moments**. `TEAMS` holds real FBS schools with real
abbreviations, so rivalries + trophies use **authentic names** keyed by abbr. House discipline: a pure fenced
engine + node lab before UI, a save bump, all gates green; every amplification hook keeps its non-rivalry path
**byte-identical** (widen clamps only when `rivalry` is set) so the validated envelopes hold.

### The data (two stores, both persist across seasons)
- `S.rivalries` — **established** rivalries (preset + born): `{a,b,name,trophy,preset,intensity,holder,aw,bw,
  streakTeam,streak,born,last}`. `holder` = the team that currently holds the trophy (last winner); `aw/bw` =
  the series record; `intensity` drives the tier. Created once at new game (`initRivalries`) + backfilled by
  migration — **NOT recreated at kickoff** (so the trophy holder + series + heat accumulate over a career).
- `S.rivalryHeat` — `{pairKey: number}` for **not-yet-born** pairs, accumulating heat until it crosses the
  bar. Bounded by a yearly decay + prune (`decayRivalries`), so it can't balloon over a long dynasty.

### Pure `RIVALRY ENGINE` (fenced, lab before UI)
`// === RIVALRY ENGINE (Phase 40) START/END ===` (depends only on `clamp`/`hashStr`), so `test/rivalrylab.js`
extracts + validates it offline:
- `RIVALRIES` — ~40 preset `[abbrA, abbrB, name, trophy]` (trophy `''` = bragging rights, still changes
  hands). Resolved against the world at init; a pair whose teams aren't both present is silently skipped
  (safe across roster imports).
- `rivalryKey(a,b)` — canonical unordered pair key.
- `rivalryGain(ctx)` — intensity a single meeting adds, from `{marginAbs, bothRanked, stage, late, upset}`.
  A blowout regular-season game barely moves it (~3); a close ranked playoff meeting is a bonfire (~22).
  Stage ladder `reg < bowl < champ < playoff`. Bounded [2, 22].
- `bornRivalry(abbrA,abbrB,seed)` — a deterministic name (`ABBR–ABBR <title>`) + trophy (`The <noun>`) for a
  newly-christened emergent rivalry.
- `intensityTier(x)` — Simmering → Heated → Bitter → Blood Feud.

### App layer
- `rivalryFor(x,y)` — the established rivalry between two teams (or null); `rivalryView(rv)` — a UI view
  (teams, holder, series leader, tier).
- `bumpRivalries(games, stage)` — called after results resolve in **all four** paths (regular week `'reg'`,
  Championship Week `'champ'`, and the postseason where stage is read per-game from `g.kind` bowl/playoff).
  For each played game: the winner **takes the trophy** (`holder = winner`), an established rivalry updates
  (series/streak/`intensity += gain*0.4`), else the pair's `heat += gain` and — when it crosses
  `RIVALRY_BORN` — a **new rivalry is born** (named, given a trophy, a media event). Returns the controlled
  team's notable events (trophy won/lost, born) for `announceRivalryEvents` (toasts + a feed story).
- `rivalLegsForYear(year)` — **cross-conference** preset rivalries as locked schedule edges (alternating
  host), merged into `genSchedule`'s `locked` alongside the series legs, so marquee non-conf rivalries happen
  every year (in-conf rivals meet through normal conference scheduling). `genSchedule` tags these `g.rivalry`
  (not `g.series`).

### Amplification (the stakes — non-rivalry paths byte-identical)
- **Approval** — `gameApprovalDelta` gains a `rivalry` term (`±2`) and a widened clamp **only when rivalry**
  (`±7` vs the unchanged `±5`), so beating a rival moves the seat more and a non-rivalry result is identical
  (`medialab`'s `±5` bound holds).
- **Recruiting ripple** — `gameRecruitVibe` gains an optional `rivalry` 5th arg (`±` + widened clamp only
  when set); threaded through `applyLeagueRipple`. Existing 4-arg calls (`reclab`) are byte-identical.
- **Visit weekends** — `weekendQuality` gains a `rivalry` marquee term (`+0.28`); a rivalry weekend is always
  a big draw (fixes the pure rank-based marquee). `visitlab`'s neutral/mean cases don't set it → unchanged.
- **Media** — a rivalry game gets its own story (trophy on the line) ahead of the generic upset/ranked tag,
  and a **"A rivalry is born"** `mediaEvent` fires when one is christened.

### UI
A 🔥 **rivalry banner** on the Home matchup card (name · tier · trophy on the line · series · who holds it);
a **Rivalries** card on the Program page (trophies currently held + each rivalry's tier / series / holder,
sorted by intensity, born rivalries flagged with their year); toasts when a trophy changes hands or a rivalry
is born.

### Save & validation
Save **v36** (`S.rivalries`, `S.rivalryHeat`; `migrateState` v35→v36 seeds the presets from the world's abbrs
+ an empty heat map). Both ride plainly on `S` (the columnar codec only special-cases rosters + the recruit
pool), so **no codec change**. New gate `npm run rivalrylab` (22 checks: gain direction / stage ladder /
bounds; the born bar needs sustained or big-moment heat; tier ladder; preset table well-formed + no dup
pairs; deterministic order-independent emergent names). `visitlab` → 22 (rivalry weekend outdraws neutral),
`qa` → 281 (presets seeded incl. the Iron Bowl, winning a rivalry takes the trophy, a rivalry result
amplifies approval, a new rivalry is born from repeated big meetings, the banner + card render). **Seventeen
gates** now (adds `rivalrylab`).

### Deliberately out of scope
No **in-game** rivalry effect (the pure `simEngine` is untouched — the stakes are approval / recruiting /
trophies / media, so the scoring envelope holds; "anything can happen" is left as flavor); no player-facing
rivalry *scheduling* (you can't propose a rivalry game — cross-conf presets are auto-locked, emergent ones
form from whoever you actually play); no rivalry-specific recruiting *battles* beyond the existing ripple; no
manual rename / trophy customization.

---

## Phase 41 design — the all-time record book

Decided 2026-06-30 with AJ — the payoff of a deep, multi-decade sim: a **league-wide record book**. The core
constraint (same as Phase 11 legends): the sim **wipes `p.gs` every rollover**, so historical single-game and
single-season records *cannot be reconstructed* after the fact — they must be **captured as games resolve**
into a persistent ledger. So the record book is a small **incremental-capture** layer, not a query. House
discipline: a pure fenced engine + node lab before UI, a save bump, all gates green.

### Pure `RECORD ENGINE` (fenced, lab before UI)
`// === RECORD ENGINE (Phase 41) START/END ===` — pure + data-only (no S/DOM), so `test/recordlab.js`
validates it offline:
- `RECORD_DEFS` — the **category registry** (the single source of truth for what's tracked): four buckets —
  **game** + **season** + **career** (per-player, each def carries a box/career `stat`) and **team** (program
  points/margin/wins). 28 categories. Each def `{key, label, stat?, unit}`.
- `emptyRecords()` — `{game:{}, season:{}, career:{}, team:{}}`.
- `applyRecord(records, bucket, key, value, meta)` — the **"keep the max"** primitive: a **strictly-greater**
  positive `value` sets a new record (stores `{value, ...meta}`) and returns `{broke:true, prev}`; a lower or
  tying value is ignored (a tie keeps the original holder); a non-positive value never records.

### App capture (once per real game / at rollover)
- `captureGameRecords(boxes, stage)` — single-game player records + team points/margin, from a week's boxes.
  Called in **all three real advance paths** (`advanceWeek` `'reg'`, `advanceChampWeek` `'champ'`,
  `advancePostseason` `'post'`) right beside `computeWeeklyHonors`/`bumpRivalries` — i.e. **once per real
  game**, never on a determinism re-sim or a watch replay (those call `simEngine` directly). Returns the
  controlled team's broken records for `notifyRecords` (a toast + a media note).
- `captureSeasonRecords()` — single-season records (from `p.gs`) + **career** records (career-to-date =
  `addCareer(p.career, p.gs)`, the ROLLOVER engine helper, so a 4-year star's climbing total re-sets the mark
  each year), for **every** roster league-wide. Called at the **top of `rolloverSeason`, before `rolloverRoster`
  wipes `p.gs`**. Team season points/wins captured here too.
- No seeding: `finishNewGame` sets `S.records = emptyRecords()`, and records accrue only from played games —
  a fresh dynasty opens with an empty book that fills as it plays (matches the Ring-of-Honor philosophy).

### UI
A **Record Book** view (`renderRecords`, `UI.view='records'`, added to the nav whitelist) reached from a
button on the Season page (present in every branch, incl. preseason). Four sections (game / season / career /
team); each row shows the label, the value + unit, and the holder (name · pos · team · year · detail). Rows
held by the **controlled program glow in the accent color** (⭐), so "my program in the record book" reads at
a glance without storing a separate per-program book.

### Save & validation
Save **v37** (`S.records`; `migrateState` v36→v37 backfills an empty book). `S.records` rides plainly on `S`
(the columnar codec only special-cases rosters + the recruit pool), so **no codec change**. New gate
`npm run recordlab` (12 checks: registry well-formed + globally-unique keys, all buckets present; `applyRecord`
sets the first value, ignores a lower one, breaks on a higher one + returns `prev`, holds on a tie, never
records a non-positive value, stores value + meta together). `qa` → 286 (fresh book empty at new game; a
612-yard game sets + reports the single-game passing record; the team single-game points record; rollover-time
season + career capture; the Record Book view renders). **Eighteen gates** now (adds `recordlab`).

### Deliberately out of scope
**Global (league-wide) records only** — no separate per-program record book (the controlled program's records
are just highlighted in the shared one); no **record progression history** (only the current holder is kept,
not the lineage); no coaching/streak records beyond team season wins; no single-game *team* yardage records
(points/margin only). The registry is a table, so adding categories later is data, not code.

---

## Phase 42 design — AD expectations & contract

Decided 2026-06-30 with AJ. The hot seat (Phase 19b/c) already fired coaches on *sustained* failure, but the
pressure was implicit — an approval meter, no stated goal. Phase 42 makes the stakes **legible**: the AD hands
you a **season mandate** each preseason and you coach on a **contract** (years / salary / buyout). Meeting or
missing the mandate flows through the *existing* approval machinery (no parallel system), and the contract
adds a real GM number — your salary now costs the program. House discipline: a pure fenced engine + node lab
before UI, a save bump, all gates green.

### Pure `CONTRACT ENGINE` (fenced, lab before UI)
`// === CONTRACT ENGINE (Phase 42) START/END ===` (depends only on `clamp`), so `test/contractlab.js`
validates it offline:
- `seasonMandate(prestige, tenure)` — the AD's goal, prestige-scaled across five tiers (`progress → winning →
  bowl → conf → playoff`). **Year one is a honeymoon** (one tier easier). Returns `{tier, kind, wins?, label}`.
- `evaluateMandate(m, ctx)` — met/missed from `{w,l,bowl,confTitle,playoff,natTitle}`; a playoff goal needs a
  berth, a conf goal is satisfied by a playoff berth, a bowl goal by ≥6 wins, a wins goal by the threshold
  (higher goals subsume lower results). Returns `{met, detail}`.
- `mandateApprovalDelta(met, tier)` — the approval swing (missing stings a bit more than meeting rewards; a
  tougher mandate weighs more). **Folded into `settleSeasonApproval`** on top of the existing
  `seasonApprovalDelta`, so the mandate drives the same hot seat — no new firing system.
- `initialContract(prestige)` — `{years, yearsLeft, salary}` (a blueblood job pays more + runs longer);
  `buyoutOf(c)` (~60% of the money left); `contractExtension(prestige, approval, met, yearsLeft)` — an offer
  only when you're **overperforming** (met the mandate + at least secure, and the deal is running down or you
  had a standout year → a bigger bump).

### App layer
- State on `S.coach`: `contract`, `mandate` (set at **kickoff**, `startSeason`), `extensionOffer`, `lastMandate`
  (for the recap), `fireReason`.
- `settleSeasonApproval` (season end): build the season `ctx` from `t.rec` + `t.lastPostseason.finish` +
  `confTitles`, `evaluateMandate`, fold `mandateApprovalDelta` into approval, tick a year off the deal, post an
  `extensionOffer` when `contractExtension` fires, and flag a firing on the existing slump **or** an **expired,
  un-renewed contract** (`fireReason='expired'`). `acceptExtension()` applies the offer (fresh years + raise).
- `finishNewGame` / `takeJob` hand you a fresh `initialContract` (scaled by the job's prestige).
- **Finances:** `resolveFinances` gained an optional `hcSalary` (default 0) added to expenses; `rolloverSeason`
  passes the controlled coach's contract salary — so your deal is a real cost. Default 0 keeps `econlab`
  byte-identical.

### UI & save
An **AD & Contract** card on Home (below the approval strip): the mandate + a live "on track?" read (for
wins-based goals), the contract's years-left / salary / buyout, and an **Accept extension** button when one's
on the table; a mandate met/missed line in the offseason recap; media events for the extension offer + the
firing. Save **v38** (`S.coach.contract`/`mandate`/`extensionOffer`; `migrateState` v37→v38 backfills a
prestige-scaled contract for the current job — the mandate is set at the next kickoff). New gate
`npm run contractlab` (23 checks); `qa` → 292. **Nineteen gates** now (adds `contractlab`).

### Deliberately out of scope
No contract **negotiation** (you accept or ignore the AD's offer — no haggling salary/years); no **buyout
payment** flow when you leave for another job (the buyout is a displayed number + a firing-cost concept, not a
deducted transaction); mandates are **prestige/tenure-derived**, not per-AD personalities or multi-goal
bundles; the mandate feeds the existing approval meter rather than a separate "job security" track.

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

## Phase 45 design — player identity (nicknames · known-for · legacy · cult status)

Decided 2026-07-01 with AJ ("introduce individualism — nicknames, being remembered for specific things"). The
sim already remembers players *collectively* (Ring of Honor, record book, Heisman) but a player had no personal
handle. The insight that keeps it lean (the "factory, not The Sims" constraint over 11k players): **derive
individuality, don't store it.** A pure `IDENTITY ENGINE` computes a jersey number, nickname, "known for" line,
and backstory from the player's id hash + traits + résumé — deterministic, so it's free and permanent. Built as
four tiers on one shared engine block; only the signature-moment *capture* needs storage (one sparse field).

### Pure `IDENTITY ENGINE` (fenced, lab before UI)
`// === IDENTITY ENGINE (Phase 45) START/END ===` — depends only on `hashStr`/`clamp` + the TRAIT reads
(`motVal`/`compVal`/`egoVal`) + data ON the player (honors/career/gs), so `test/identitylab.js` extracts the
TRAIT + IDENTITY blocks and validates offline:
- `jerseyNo(p)` — a number in a **position-plausible band** (`JERSEY_BANDS`: QB 1–18, TE 80–89, DT 90–99…),
  deterministic from `hashStr(id)`.
- `nickname(p)` — a **flavor** base from the player's *dominant trait* (`NICK_FLAVOR`: motor→"The Motor/Tank",
  cool→"Ice/The General", boom→"Highlight/The Blur", swagger→"Prime/Money"; **trench positions** (OT/OG/C/DT) get
  grit — "Anchor/Mauler/The Wall" — never speed flavor) picked within the pool by id; an **earned** overlay
  (`nickEarned`) supersedes it once a real milestone lands (Heisman→"The Franchise", Bednarik→"The Enforcer",
  8k career pass→"The General", 3.5k rush→"The Workhorse", 25 sacks→"The Closer"…). **Gated** by `isEstablished`
  (real snaps / an honor / an upperclassman) so a freshman shows **no** nickname and *earns* one — an earned
  progression beat, matching the trait-fog ethos.
- `careerToDate(p)` = banked `p.career` + the live `p.gs`, so a monster season earns its identity NOW, not a
  year late.
- `knownFor(p)` — one earned descriptor: honors first (Heisman / All-America POS / conf POY), then a career
  milestone ("6,400-yd career passer"), then a trait/rating fallback ("A relentless worker" / "Ice in his veins"
  / a trench "anchor up front" — never "playmaker" for a lineman), never empty.
- `backstory(p)` — home state + recruiting stars + a trait tag ("Blue-chip from TX — outworks everyone").
- `fanFavorite(p, homeState)` — an emergent status label (Overachiever / Hometown Hero / Homegrown Star) for a
  controlled-team **contributor** (starter/two-deep) beating his recruiting billing or a local kid made good.

### Signature moments (the one thing captured — sparse, controlled team)
The sim wipes `p.gs` each rollover, so a big single game can't be reconstructed later (like records/legends).
`captureMoments(boxes)` runs **once per real advance** (beside `captureGameRecords`, in all three real paths —
never on a determinism re-sim), scanning the controlled team's box lines against `MOMENT_TESTS` (350+ pass yds,
175+ rush, 150+ rec, 3+ sacks, 2+ INT, 15+ tkl…) and stamping a lean string onto `p.moments` (keeps the best
~6), tagged with the opponent + year + stage (title game / bowl). `legendSnap` carries the last few onto the
Ring-of-Honor snapshot, so a legend's card reads like a real résumé. Controlled-team-only → cheap.

### Being remembered (surfacing — mostly free)
`playerRecMeta` gained a **`pid`** so `recordsHeldBy(pid)` can scan the Phase 41 record book by player; the
player sheet's new **`playerLegacy`** section pulls together career totals + all-time records he holds + his
signature moments — "remembered for specific things" is a query over data the sim already keeps.

### UI
Roster row: `#num Name "Nickname"` + a ★ fan-favorite badge. Player sheet: an identity header (known-for +
backstory) + the Career & legacy block. Ring of Honor: nicknames/numbers on legend rows, a known-for line +
signature moments on the legend sheet, and a **retired-numbers** banner for the program's Immortal legends.

### Save & validation
Save **v41** (sparse `p.moments`, auto-carried by the columnar codec's side-object; `migrateState` v40→v41 is a
structural no-op — everything else is derived). New gate `npm run identitylab` (**26** checks: jersey bands +
determinism, nickname gate + earned overlay + trench-awareness, knownFor/backstory always sensible + deterministic,
fan-favorite triggers). `qa` → **302** (jersey #/nickname/known-for render on the row + sheet; a monster game is
remembered + carries onto the legend). **Twenty-one gates** now (adds `identitylab`).

### Deliberately out of scope (stays a factory)
No free-text/editable names, no relationships or off-field storylines, no per-player dialogue — identity is
*derived from what he does*. Retired numbers are honored (a banner) but not reissue-enforced on live rosters
(that would compromise the derived-purity of `jerseyNo`). Moments/fan-favorite are controlled-team only.

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

> **Timing superseded by Phase 14:** the board-work still runs through the season, but a commitment is
> now a **verbal**, and the class **signs in the offseason** (Early Signing Period + National Signing
> Day), not at the regular-season's final week. The "Signing Day fires when the season ends" bits below
> are historical — see "Phase 14 design — recruiting calendar."

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
> **Superseded by Phase 17:** the board is now the **full national class (~3,400)**, columnar-saved — the
> top-300 limit + faked tail below are historical. See "Phase 17 design — full national board."

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
  (currently **41**). v40→v41 (Phase 45) is a structural no-op — `p.moments` (signature single games) is a
  sparse per-player field (absent = none); nickname/number/known-for are all derived, nothing to store.
  v39→v40 (Phase 44) backfills `S.coach.jobOffers=null` (poach-up offers, regenerated
  each offseason) — the rest of the career-balance/economy pass is behavior-only. v1→v2 backfills staff tiers/boosts via `normalizeStaff`; v2→v3 adds
  Phase 2 season fields (`schedule`/`lastPlayedWeek`, per-team `rec`); v3→v4 is a structural
  no-op (per-player `p.gs` stats); v4→v5 backfills `weeklyHonors`; v5→v6 backfills
  `recruiting:null` (created at kickoff); v6→v7 backfills the `S.year` calendar-year counter
  (Phase 5 rollover); v7→v8 backfills `S.coachMarket=null` (created at the first offseason) +
  per-team `lastFinances=null` (Phase 6 economy); v8→v9 is a structural no-op (per-player `p.dev`
  offseason growth, Phase 7 — absence reads as "no growth yet"); v9→v10 backfills `S.awards=[]` +
  `S.series=[]` + per-team `homeState` (from `TEAM_STATE`), with `p.honors` optional (Phase 8
  geography/awards/series); v10→v11 backfills `S.seriesOffers=null` (AI-initiated series offers,
  created when managing); v11→v12 is a structural no-op (per-player traits `p.mot`/`p.comp`, Phase 10
  — absence reads as average); v15→v16 derives `S.recruiting.stage` for an in-progress class (Phase 14 —
  `signed?'closed':'open'`; recruiting is otherwise recreated at kickoff); v14→v15 backfills `S.draft=null`
  (Phase 13 — created at the first rollover;
  per-team `factory` absent reads as no reputation); v13→v14 backfills `S.postseason=null` (Phase 12 —
  created when the regular season ends, like the schedule; per-team `postseasonBoost`/`lastPostseason`/
  `titles`/`_pp` absent read as no-effect); v12→v13 backfills per-team `legends=[]` (Phase 11 Ring of Honor;
  `p.career`/`p.peakOv` absent read as zero/none, honors already persist); v16→v17 backfills
  `S.champWeek=null` (Phase 15 — Championship Week is created after the regular season, like the postseason)
  + per-team `confTitles=[]` (conference-title years); v17→v18 is a structural no-op (Phase 16 decommits —
  a transient `rec._flipped` is recomputed each week, nothing to backfill); v18→v19 is a structural no-op
  (Phase 17 full recruit board — the pool is recreated at kickoff, and the columnar pool codec decodes both
  the old plain pool and the new `_cp` form); v19→v20 backfills `S.portal=null` (Phase 18 — the transfer
  portal is created in the offseason after Signing Day, nulled at rollover; `p.fromTransfer` absent reads as
  no effect); v20→v21 backfills `S.media=null` (Phase 19a — the AP poll + news feed, created at kickoff,
  nulled at rollover); v21→v22 backfills coach `approval`(55)/`tenure`(0)/`approvalHistory`([])/`career`([])
  on `S.coach` (Phase 19b — these persist across seasons; `team.mediaBuzz`/`S.media.pressDev` absent → no
  effect); v22→v23 backfills `S.coachSearch=null` (Phase 19c — the coaching search, created on firing,
  cleared on taking a job / retiring; `phase:'Retired'` is reached via the career retrospective); v23→v24 is a
  structural no-op (Phase 20 — absent `p.ego` reads as average 50 like `mot`/`comp`; `p.morale` absent reads
  as neutral 50); v24→v25 backfills each team's `offScheme`/`defScheme` from its id (Phase 21 schemes) and
  adopts them as an existing coach's `S.coach.offScheme`/`defScheme` preference (a player's preferred scheme is
  innate-per-id → no save column); v25→v26 is a no-op (Phase 22 play-calling — a game's optional `g.calls`,
  the coach's recorded play calls, is absent-safe → absent reads as a pure AI game); v28→v29 is a structural
  no-op (Phase 32 training camp — `S.camp` is set in the offseason + cleared at kickoff, so absent reads as
  "no camp chosen yet"); v29→v30 backfills per-team `fac.scouting` (from prestige) + `S.recruiting.intents={}`
  (Phase 33 recruiting rework — the scouting facility drives the weekly point budget/AI recruiting budget, and
  the intent queue holds the week's set-but-unresolved actions); v30→v31 converts `S.recruiting.intents` values
  from single objects to **arrays** (≤2 actions/recruit via the Phase 35 double-down) + backfills
  `S.recruiting.doubles` (sparse `rec.decideWeek`/`rec.hits` ride in the columnar pool side-object, absent-safe);
  v31→v32 is a structural no-op (Phase 36 — `rec.finalists` rides sparsely in the pool side-object, absent = no
  shortlist yet; AI visits/momentum are derived); v32→v33 backfills `S.recruiting.visitsLeft` (Phase 37 official-
  visit calendar; NIL `nilSpend` rides on intents, AI ripple/NIL are behavior-only); v33→v34 backfills
  `S.recruiting.visitPlan={}` (Phase 38 visit-weekend scheduler — the booked-visit calendar; recreated at
  kickoff, so it only patches an in-flight in-season save); v34→v35 is a structural no-op (Phase 39 redshirting —
  sparse `p.rs`: `'on'`=redshirting this season, `'used'`=already redshirted; absent reads as "never redshirted,
  available"); v35→v36 seeds `S.rivalries` (the world's famous rivalries — abbr-resolved, persist across seasons)
  + `S.rivalryHeat={}` (Phase 40 rivalries & trophies; both ride plainly on `S`, no codec change); v36→v37
  backfills an empty `S.records` (Phase 41 all-time record book — records accrue from played games, no seeding);
  v37→v38 backfills a prestige-scaled `S.coach.contract` (Phase 42 AD expectations & contract — `mandate`/
  `extensionOffer` set at the next kickoff / season end); v38→v39 is a structural no-op (Phase 43 conference
  realignment — `team.conf` already exists + is mutated in place at rollover; `S.lastRealign` is absent-safe).
  Each step re-derives ratings/ranks where needed.
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
  coach: { first, last, homeState, archetype, history, offScheme, defScheme, approval, tenure, approvalHistory:[…], career:[…], contract:{years,yearsLeft,salary}, mandate:{tier,kind,wins?,label,...}, extensionOffer, lastMandate },  // off/defScheme = the schemes the coach loves (Phase 21, buy-in target); approval+hot-seat persist across seasons (Phase 19b); career = per-stop résumé (Phase 19c); contract/mandate/extensionOffer = AD expectations & the deal (Phase 42) — mandate set at kickoff, evaluated at season end
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
  recruiting: { cycle, points, pool:[ Recruit ], board:[ recruitId ], signed, stage, intents, doubles, visitsLeft, visitPlan, report } | null,  // null until kickoff (Phase 4); stage: open→national→closed (Phase 14); intents = {recruitId:[{action,...,cost,label,isDouble?,nilSpend?}]} = this week's QUEUED actions (≤2/recruit; a 'nil' action pays nilSpend $ from budget — Phase 37), resolved at the week change (Phase 33/35); doubles = weekly double-down tokens (Phase 35); visitsLeft = season official-visit budget (Phase 37); visitPlan = {week:[recruitId]} = recruits booked onto home-game weekends (Phase 38 visit scheduler, reserved against visitsLeft); report = {week, reactions:[…], note} = last week's board report, transient/rebuilt each week (Phase 34/35)
  offseasonReport: { year, graduated, tracked, freshmen, departed } | undefined,  // last rollover recap (Phase 5)
  world: { teams: [ Team, ... ] }
}

// Recruit: { id, fn, ln, pos, st, stars, ov, pot, spd,str,awr, mot,comp, rebel, scout, prefs:[primary,secondary],
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
{ id, fn, ln, pos, yr, age, st, stars, ov, pot, cap, spd, str, awr, so,
  mot?, comp?, ego?, morale?, inj?, rs?, gs?, dev?, honors?, career?, peakOv? }   // trailing fields are sparse (absent = default)
//   rs = redshirt status (Phase 39; 'on' = redshirting this season → held out of games; 'used' = already
//        redshirted. At rollover a sat 'on' designee advances onto the RS class track, preserving a year.)
//   inj = weeks out injured (Phase 27; absent/0 = healthy; set by the app after a game, healed weekly + at rollover)
//   so = depth order within position (0 = starter); cap = captain
//   pot = TRUE ceiling (0..99). The UI never shows it raw — `scoutedCeiling(p)` renders a
//   fuzzy tier/band whose uncertainty shrinks with scouting confidence (age/experience now;
//   real scouting in Phase 4). `devStage(p)` buckets the ov→pot gap (Raw…Maxed).
//   mot/comp/ego = fogged temperament traits (Phase 10 + Ego, Phase 20); morale = persistent per-player
//   locker-room mood (Phase 20, controlled team only, in-season; absent = neutral 50); gs = season box;
//   dev = last offseason OVR gain.
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

### Phases 6–20 landed — what used to be stubbed now works
Phases 1–20 are all **DONE**. The former dead ends are live: the **coaching carousel** + **finances
loop** + **facility upgrades** (Phase 6), **side-specific development** + **in-game coach effects** +
**coach-responsive scouting fog** (Phase 7), **AI geography** + **season awards/All-America/Coach of
the Year/Week** + **non-conference series** (Phase 8), the **columnar save codec** (Phase 9), **fogged
player traits** (Phase 10), **program legacy** — Ring of Honor, career accumulation, alumni-visit
recruiting, legacy aura, legend-coaches (Phase 11), the **postseason** — a 12-team playoff + bowls,
watchable, feeding prestige/recruiting/revenue (Phase 12), the **NFL draft + position factories** —
graduates get drafted, repeated high picks build a positional reputation that pulls recruits (and repels
rebels) (Phase 13), the **recruiting calendar** — verbal commits all fall, then the Early Signing
Period + National Signing Day close the class in the offseason (Phase 14), and **conference
championships** — a Championship Week of title games that feed the playoff with real CFP auto-bids +
byes (Phase 15), **decommits** — a verbal pledge can flip to a surging rival before Signing Day
(Phase 16), and the **full national recruit board** — the whole ~3,400-prospect class is individually
modeled (columnar-saved, filtered + paginated), retiring the old top-300 board (Phase 17), and the
**transfer portal** — players leave (buried depth / broken promises), you sign incoming transfers, AI
churns, all in the offseason after Signing Day (Phase 18), and a **full media suite** — an AP poll + news
feed, interactive press conferences, and a coach **approval rating + hot seat** that can get you fired (then
a **job carousel or retirement**) (Phase 19), and **personality-driven reactions** — a third fogged **Ego**
trait + persistent **morale**, so the media lands differently on each player (Phase 20). The full career loop
— recruit (verbal, flippable) → season (work the **media** + **press**, manage the **locker room**) → **conf
championships** → awards → **postseason** → **Early Signing →
National Signing Day → transfer portal** → rollover (graduate/enshrine/**draft**/develop/enroll) → finances
settle → carousel → facilities/series — closes across multiple years, and the **hot seat** means a sustained
slump can end your tenure; your stars leave a permanent mark on the program both on its Ring of Honor and on
its pro-pipeline reputation.
**Twenty-one green gates:** `npm run` + `simlab` / `reclab` / `rolllab` / `econlab` / `awardlab` /
`traitlab` / `schemelab` / `legacylab` / `postlab` / `draftlab` / `champlab` / `portallab` / `medialab` /
`camplab` / `visitlab` / `rivalrylab` / `recordlab` / `contractlab` / `realignlab` / `identitylab` / `qa`.

### Still intentionally inert (deliberate non-goals, not a backlog)
- Recruiting signees **bank in `S.recruiting.pool`** (each `committedTo` = your team id) during
  the season, then the **rollover converts them to freshman `Player`s** (`recruitToFreshman`).
- Non-controlled games are resolved instantly by `simEngine`; only the controlled team's game
  is watchable (watch-then-commit) or replayable (greatest games). There's no live viewer for
  arbitrary other games — by design, so advancing a week stays fast.
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
rec,reYds,reTD, tkl,sk,dInt, cvTgt,cvCmp,cvYds,cvTD, fga,fgm,xpa,xpm }` (only nonzero keys; the
`cv*` coverage-allowed keys are Phase 23 — charged to the defender matched to the target). Touches are drawn from
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

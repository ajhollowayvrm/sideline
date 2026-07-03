# SIDELINE — design history: identity, legacy, media & stakes

> Extracted from CLAUDE.md. Traits, morale, media/press, rivalries, records, contract, legends, identity, awards.

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

### Phase 45.1 — identity everywhere (follow-up polish) ✅ DONE
The identity surfaces beyond the roster/sheet: the **weekly honors** snapshot carries `nick` (stamped in
`computeWeeklyHonors`), so the shared `honorRowHTML` shows nicknames on the Home POW card + the Season Honors
tab, and the **media feed** POW story (`mkStory('pow')`, an optional `d.nick`) reads "X 'Ice' earns Player of
the Week." Season awards get nicknames too via an **app-layer** `stampAwardNicks(aw)` (run after `computeAwards`,
so the fenced AWARDS engine stays pure + `awardlab` untouched) → `awardRow` + the Heisman media event show them.
The **recruit sheet** gets a **fog-safe** "Projects as: Blue-chip QB out of TX" line — stars/position/home state
always, with a temperament tag appended ONLY once the trait is scouted-revealed (reusing the `traitRead().revealed`
gate), so it never leaks the fog you'd pay to clear. `qa` → **304** (POW/media nickname; recruit projection).

### Deliberately out of scope (stays a factory)
No free-text/editable names, no relationships or off-field storylines, no per-player dialogue — identity is
*derived from what he does*. Retired numbers are honored (a banner) but not reissue-enforced on live rosters
(that would compromise the derived-purity of `jerseyNo`). Moments/fan-favorite are controlled-team only.

---


## Planned: season awards (end of season → Phase 8)

National POY (Heisman-like), All-Conference / All-American teams, conference POY, Freshman of
the Year, positional bests, Coach of the Year. Driven by season `p.gs` totals (normalized by
games) + team success. Needs a **season-end ceremony flow** and **award history that persists
across seasons** — a per-player `p.honors:[{year,award}]` and/or top-level `S.awards` log (another
`version` bump). Fire it at season end, just before/with the rollover. (Coach of the Week,
deferred from 3.5, rides along here.)


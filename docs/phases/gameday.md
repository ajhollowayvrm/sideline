# SIDELINE — design history: game day (sim engine, play-calling)

> Extracted from CLAUDE.md. These are the design records for the in-game systems.
> The roadmap index in CLAUDE.md links here per phase.

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


## Phase 46 design — in-game screen (individual play-calling, tendencies, halftime)

Decided 2026-07-02 with AJ — a deepening of the game-day screen on top of the Phase 22–31 play-calling core.
Seven asks: call individual plays with play-art; live offensive/defensive tendencies (a run-committed D → Play
Action); 15-minute quarters; a halftime adjustment period; the mini-field animating both directions; play past
0:00; a field goal on any down. The governing constraint (as always): `simEngine` is pure + deterministic and the
validated envelope only checks AI/defer games, so **every mechanic is opt-in** — plain `run`/`pass`/`heavy`/
`spread`/defer/AI is byte-identical (simlab's parity check proves it), and the new tokens/reads add football-sane
effects on top.

### Engine (all opt-in; AI/defer byte-identical)
- **FG on any down** — `doFG(dd,fgDist)` is factored out of the 4th-down block (the 4th-down rng draws are
  unchanged → an AI game is byte-identical). The offensive play decide accepts an any-down `fg` token: in range →
  `doFG`, out of range → ignored (play on). `fgDist`/`inFgRange` are computed at the top of the play loop and
  exposed in the play ctx.
- **Play-concept variants** — the offensive decide token may carry a variant (`type:variant`, parsed by `split(':')`):
  `pass:pa` (Play Action), `pass:screen`, `pass:deep`, `run:draw`. A tiny `vComp/vYds/vSack/vBoom` bag keys off the
  **defensive call this snap** (`dcall`) — PA punishes a run-committed front (+comp/+yds vs run-stop, −comp/−yds vs
  cover), Screen beats the blitz + fewer sacks, the Deep shot is boom/bust (−comp, bigger explosive, +sacks), the
  Draw beats pressure. **All deltas are 0 when `variant===''`** (plain/defer/AI), so the sim is byte-identical.
- **Tendency reads** — the play ctx exposes `defTend` (a **pre-snap snapshot** of the defense's base/blitz/cover/run
  mix, taken before this snap's call is recorded → no current-call leak; allocated only for the controlled offense),
  and the def ctx exposes `offTend` (the offense's run/pass mix so far). No effect on the sim — pure surfacing.

### Driver + UI (app layer)
- **15-minute quarters** — the engine already ran 900s/quarter; `quarterClock(q,clock)` converts the engine's
  total-game clock to the on-field per-quarter clock for display.
- **Play past 0:00** — `shouldPromptCtx` is now quarter-relative (2-minute drill in Q2/Q4 keyed on `rem≤120`,
  every OT snap) and **no longer gates on `clock>0`**, so key-mode keeps prompting through the final drive's snaps
  at 0:00 (the drive plays out, as the engine already allowed).
- **Halftime** — a pure driver pause (no engine change, no rng): the interactive driver throws at the first
  2nd-half snap (`ctx.q>=3`, unless auto/simRest) and the render shows a halftime screen (score + the in-game
  adjustments sheet + "Start 2nd half"); `resumeHalf` sets `halfShown` and picks the flow back up. Replay-safe
  because halftime touches nothing the sim reads.
- **Both-way field** — `fieldSVG` is fixed-orientation (the controlled team defends the LEFT end zone): YOUR drives
  map `los→X(los)` (attack →, ▸) and the opponent's map `los→X(100-los)` (attack ←, ◂); the ball SMIL-slides
  between snaps (skipped under `prefers-reduced-motion`).
- **Playbook + play-art** — `PLAYBOOK` (offense run/pass/heavy/spread + defense base/blitz/cover/run) with per-concept
  diagram specs; `playDiagram(art)` renders a hand-rolled top-down SVG (OL/skill dots, red-X defenders, accent pass
  routes, green run paths, gray blocks, dashed coverage zones/rush arrows via `defArt`). The play-call buttons open a
  category picker (`openPlaySheet`) of concept cards; tapping one calls its token.

### Save & validation
Save **v42** — the richer call tokens (`pass:pa`, any-down `fg`, …) ride in the existing optional `g.calls` array,
so `migrateState` v41→v42 is a structural no-op. `simlab` → **82** (10 new Phase 46 checks: FG-anytime records
attempts + changes the game + replays deterministically; the ctx exposes fgDist/defTend/offTend; PA out-gains a
plain dropback, Screen completes more with fewer sacks, the Deep shot is higher yards-per-catch + more sacks; mixing
in PA beats a one-dimensional ground game vs the scheming AI DC). The qa in-game section (play-picker flow + field +
adjustments) is updated for the new picker; all other gates unchanged (20/21 green in-repo; the browser qa gate is
otherwise unaffected by this change).

### Deliberately out of scope
Variants are a small opt-in tuning layer, not a full route tree/protection scheme; the diagrams are illustrative
(not literal per-defender assignment art); AI teams don't call variant concepts or packages (kept envelope-safe);
halftime reuses the existing in-game adjustments (no separate "game-plan install" sim). The field animation is a
ball slide, not a full 22-man play animation (only the controlled team's game is coachable — advancing stays fast).

---


## Phase 55 design — the watch screen as a drive chart

Decided 2026-08-14 with AJ. The brief, in his words: the log should take about **60%** of the vertical
space and the rest should be a **graphical representation of the game** — lines for gains, losses and
penalties; the bar in the **primary colour of the team possessing the ball**; **losses grey**,
**penalties a dull yellow**; and the bars running **toward the scoring end zone, which swaps every
quarter**.

This is the watch-then-commit viewer (`renderGame`) and the greatest-games replay, not the coach
screen — the coach screen already has `fieldSVG` and needs the room for the call buttons. The one
piece of it that *did* need fixing everywhere is in "The bug this uncovered" below.

### The engine had never written down what happened to the ball

A log entry carried prose (`text`), the play as beats (`bt`), a down-and-distance string, and `l` —
which was the *post*-play spot on a normal snap, the *pre*-play spot on a touchdown, and the drive's
own field position on a drive header. Yardage existed only inside the prose. Nothing you can draw a
field from.

So the entry gains **`mv`** — the play reduced to what happened to the **ball**:

```
mv = { o, a, b, k }
  o   the offence that had possession
  a   the spot before, b the spot after — both in THAT offence's own-yard-line frame,
      0 = its own goal line, 100 = the end zone it is attacking
  k   'd' drive start · 'p' scrimmage snap · 'f' flag · 'k' kick or punt · 's' score
```

Two decisions worth recording:

- **`o` is the possessing offence, not the entry's `team`.** A defensive flag is logged against the
  team that threw it, but it is still a movement of the *offence's* ball, and the chart has to draw
  it in that frame or a defensive holding call would point the wrong way down the field.
- **`l` was left exactly as it was.** `tools/cfb-data/4-simprofile.js` reads `e.l >= 80` for the
  red-zone rate and `e.l` for drive start; re-defining it to mean one consistent thing would have
  silently moved two measured numbers. `mv` is additive, like `bt` and `l` before it.

`mv` is built from state the engine already held and **consumes no rng**, so the score, the box and
the penalty tallies are byte-identical with logging on or off — simlab re-checks that across 60 seeds.
**No save bump** (the log is rebuilt from the seed, never serialized) and **no `SIM_MODEL` bump**
(the output did not change), so every previously-played game still replays.

### The chart

A field running left→right with **time running down**, so a game reads as the shape it actually had:
a stack of short grey stubs is a team that never moved, one long bar into the colour at the edge is
the drive that decided it. Rows are appended one per event exactly as the feed is, and both scroll
pinned to the newest play.

- Field band 8%–92%; the outer 8% each side is an end zone, tinted with the colour of the team that
  **scores** there this quarter — so a bar always points at its own colour.
- `chartOdd(q)` is the direction rule: **home attacks right in odd quarters** (and in overtime), left
  in even ones. Teams change ends at every quarter break, which is the whole reason the function
  exists. `chartX(spot, right)` maps a spot into the band, mirroring it when the offence attacks left.
- Gain → the possessing team's colour. Loss → grey. Flag → dull yellow, **whichever side threw it**,
  because what the chart draws is what happened to the ball, not who is to blame. Punts and a missed
  field goal are a faint dashed line; a made field goal is dashed from the spot **through** the
  uprights (it has no yardage to draw and faking one as a gain would be a lie); a touchdown is a
  glowing bar into the end zone with a `TD` tag.
- The end-zone tint rides on **each row** rather than on the fixed backdrop. Rows carry their quarter
  with them as they scroll, so the flip is visible as the two columns trading colour mid-chart —
  which is the honest way to show a thing that changes over the axis you're scrolling.
- `chartInk()` lifts a colour toward white only when it is too dark to see on turf. Navy and black
  programmes exist and `#001E62` on `#0b2016` is simply invisible; the blend is capped at 55% so the
  hue — and so the team's identity — survives.

The 60/40 split is one flex column (`.gamev` → `.gsplit`, `flex:6` / `flex:4`) at `100dvh`, not two
guessed `vh` numbers, so it holds on a small phone and on a tablet. qa asserts the ratio, not a
pixel height.

### The bug this uncovered

`beatBody` builds every beat at `opacity:0` and **only `revealBeats` — i.e. only the live tick — ever
raised them**. Any *re-render* rebuilt the feed from the log and left the text invisible: "Skip to
result", the Fast toggle, and every re-render of the coach screen, which re-runs the engine and
rebuilds the whole feed after each call. The committed `19b-coach-field.png` shows it plainly — a
column of bare `3 & 4` / `1 & 10` with no play-by-play beside it, shipped that way since Phase 53.

`showBeats(line)` shows a line whole. History is shown whole on both screens; on the coach screen the
**newest** line is then re-hidden and animated, which restores what Phase 53 actually wanted there.

### Validation
`simlab` → **150** (9 new: every drive/snap/flag/kick/score carries `mv`; spots are on-field integers
owned by a team in the game; only the five `k` codes appear; a drive's `mv` agrees with its `l`; a
flag moves the ball by the yardage it was charged; a touchdown ends at 100; a field goal does not
move; a punt travels downfield in the punting team's frame). The load-bearing one is
**`mv` reconciled against the prose** — for every scrimmage snap that quotes a yardage, `b − a` must
equal it (109/109), which is what stops the chart drawing a game that didn't happen.
`qa` → **323** (6 new: a bar per snap and a header per drive; the split is 60%; a gain runs toward the
end zone its team attacks; the attacking end swaps every quarter and oppositely for the two teams;
gain/loss/penalty colours; and Skip leaves the play-by-play readable — the regression guard on the
bug above). All 23 gates green.

### Deliberately out of scope
The coach screen keeps `fieldSVG` and gains no chart — it needs the vertical space for play calls, and
it already shows the ball live. No win-probability or momentum curve: this chart is a record of where
the ball went, and nothing on it is a model output. No per-play tooltips — the feed beside it *is* the
detail view.

## Phase 55.1 — five revisions to the watch screen

AJ, straight after seeing 55 land. Each one is short; two of them changed the shape of the screen.

**1. A loss is the same colour as a gain.** The grey read as a third category of event when it isn't
one — it's the same team with the same ball. `CHART_LOSS` is gone. Only a flag now breaks out of the
team's palette, because a flag is the one thing on the chart that isn't football being played. Which
way a snap ran is still legible: it's told by where the bar sits against the one above it.

**2. The field is a regulation field.** It was a box of whatever height the flex split left it, with a
line every ten yards — recognisably a chart, not recognisably a football field. It is now
**aspect-locked to 120 × 53⅓ yards**, drawn in an SVG whose viewBox is those yards, so every marking
sits where it really sits: 10-yard end zones (so the end-zone band is exactly `100/12` = 8.3333% of
the width, which `CH_EZ`/`CH_SPAN` now derive rather than the old hand-picked 8%), a line every five,
the numbers every ten with the far sideline's set upside down, and hash marks **60 feet in from each
sideline** — which is what makes them college hashes and not the NFL's much narrower pair. One
deliberate infidelity: the numerals are drawn larger than the regulation 2 yards, because at this
scale a true-size numeral is six pixels tall. AJ pre-accepted the cost — a 2.25:1 box on a phone is
~160px, so the chart scrolls after two or three drives.

**3. The field comes first, then the log.** Which also resolves the tension the aspect lock creates:
the field takes exactly the height its proportions ask for and the log takes everything left over, so
there is no 60/40 flex split any more. qa asserts the *aspect ratio* now, not a pixel ratio.

**4. Tabs: Play-by-play / Stats.** The lower pane is tabbed on `G.tab`.

**5. The running story.** Broadcast lines under the play that earned them — a hundred-yard game, a
third sack, five hundred yards of offense, a drive one man has carried.

### What 4 and 5 needed: the engine had to hand over its own arithmetic

Both wanted numbers *as of the play you're looking at*, and the viewer had neither. `buildGameLog`
never captured a box at all, and the box the engine keeps is the FINAL one — showing it mid-game
spoils the result you're watching.

So an entry gains two more log-only fields beside `mv`:

- **`st`** — that entry's per-player stat delta, `[[playerId, key, delta], …]`. The viewer folds them
  0..`idx` and gets the exact box as of that play. This works because the engine already journals
  every `add()` for Phase 49's undo; what it needed was a *second* journal, because `jr` is nulled the
  moment a play can no longer be wiped — which is exactly when the last stat lines (the extra point,
  the clutch credit) get written. `sj` runs to the end and is **drained** by whoever reports the play,
  so a pick-six's two entries split the offense's snap from the defense's return instead of both
  claiming everything. `undoPlay` clears it, so a play wiped by holding leaves no delta behind.
- **`sm`** — the running story, an array of strings. Pure bookkeeping over the box the engine already
  keeps: a `said` map makes each milestone once-only (without it a back who crosses 100 is announced
  on every carry after it), and `dr` is a per-possession tally so "this drive has been all X" fires
  once per drive and only when he genuinely owns it — 40+ yards **and** two thirds of everything the
  drive gained.

No rng in either, so the score, box and penalty tallies are unchanged — **no save bump, no `SIM_MODEL`
bump**, old games still replay.

### Validation
`simlab` → **157**. The load-bearing one: **folding every `st` delta reproduces the engine's own box
score exactly** (89/89 players) — that is the check that makes the Stats tab trustworthy, and it is
also what catches a wiped play leaving a delta behind, which would drift the running box above the
real one for the rest of the game. Plus: the story fires in 40/40 games, never repeats a milestone,
reaches all four categories, names a real man, carries no markup, and consumes no rng.
`qa` → **327**: the field's aspect ratio and end-zone fraction against a real field, that it carries
18 numerals and 220+ lines, that the field precedes the log, that a loss now matches its gain's
colour, and that the Stats tab's folded box equals the full-game one at the final whistle.

### 55.2 — the other half of the story

The first pass had only upside milestones, which made the feed a highlight reel of one team's good
afternoon rather than an account of the game. Six downside categories now run on exactly the same
rules — a number crossed, said once, never editorialised:

| | source | marks |
|---|---|---|
| interceptions thrown | `box.pInt` | 2, 3, 4 |
| fumbles lost | `fumLost` counter | 2, 3 |
| team giveaways | `tov` counter | 3, 4, 5 |
| sacks given up | the *other* side's `box.sk` | 4, 6, 8 |
| flags on one man | `box.pen` | 3, 4 |
| flags on a team | `pen[tid].n` | 8, 10, 12 |

Three notes on how they land:

- **`sm` entries are now `{t, d}`** — the line, and `d` when it is the downside. The engine decides the
  tone because the engine is what knows whether a number is something you did or something that was
  done to you. The viewer renders the two in different registers, distinguished by a **left rule as
  well as** colour: a crimson programme's accent sits close to the downside red, so hue alone can't be
  load-bearing.
- **Two counters, not two box keys.** Fumbles lost and team giveaways have no key in the box, and
  adding one is not free — `applyResult` folds the box into `p.gs`, so a new key becomes a new
  per-player *season* stat and a save-shape change. A piece of commentary has no business doing that,
  so they're local counters in the engine, incremented at the resolution point (which is *after* every
  penalty branch, so a turnover a defensive flag erased is never counted).
- **Flags get their own hook.** A foul is reported by `chargeFoul` and never reaches the play
  resolution, so `flagStory` runs there. This is the line Phase 49 earned: its whole finding was that
  one man commits 44.7% of his team's false starts, and "that is the third flag on him" is what that
  looks like from the couch.

**A latent bug this turned up.** `scheduleGameTick` captured `const e = G.log[G.idx]` at *schedule*
time and applied it whenever the timer fired. Nothing in the shipped app moves `G.idx` while a timer
is in flight (`skipGame` and the Fast toggle both clear it first), so it was unreachable — but a probe
that set `G.idx` directly made the ticker replay a stale entry and open a **second Q1 quarter band
after Q3**. The tick now re-reads the entry at fire time; `e` is only used to pace the timer.

`simlab` → **160**: every downside category is reachable (a milestone nobody ever crosses is dead code,
not a feature), the tone flag is right in both directions, and the story stays a garnish — asserted on
the **mean** (14.2 lines a game) with a ceiling on the tail, because one loud game is fine and a loud
average is the feature eating the feed. `qa` → **328**: the downside appears in the feed in its own
register, alongside the upside.

### Deliberately out of scope
The Stats tab is a box score, not analytics — no win probability, no EPA, nothing that is a model
output rather than a record of what happened. The running story states numbers and never
grades a performance — there is no "worst game of his career" line, and no editorialising about a
player struggling; a threshold crossed is a fact, an opinion about it is not.

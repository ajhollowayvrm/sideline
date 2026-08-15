# SIDELINE — design history: recruiting & the portal

> Extracted from CLAUDE.md. Design records for recruiting, signing, transfers, visits.

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


## Phase 56 design — measure what recruiting produces

Decided 2026-08-14 with AJ, opening a three-phase recruiting arc. Recruiting was the last major
system never fitted to measured football: this document stopped at Phase 38 while the sim was rebuilt
three times (Phases 48–55.2) against `cfb-averages.md` / `cfb-penalties.md` / `cfb-clutch.md`.
Recruiting's "truth" was a set of self-imposed lab invariants. **Phase 56 changes no game code** — it
builds the instrument, exactly as Phases 48–50 did before touching anything.

### The tools
`20-recruits.js` harvests the CollegeFootballData API (free tier, `CFBD_API_KEY` from env, never
written to disk) — `/recruiting/players`, `/recruiting/teams`, `/teams/fbs`, `/talent`, 2015–2025,
**45,735 prospects for 44 calls**. It has a **`--probe` mode that prints the first record's real field
names**, and that earned its keep immediately: the raw API is camelCase (`stateProvince`,
`hometownInfo.latitude`, `committedTo`) while nearly every published example is the R wrapper's
snake_case. `21-recanalyze.js` measures reality, `22-recprofile.js` measures the game on the identical
metric set (honouring `INDEX=path`, so a later phase can print a real before/after column),
`23-reccompare.js` puts them side by side in `5-compare.js`'s `ok / ~ / MISS` format. Findings are
transcribed into **`docs/reference/cfb-recruiting.md`**, the fourth reference sheet.

`22-recprofile.js` builds its world from the game's **real** `TEAMS`/`TEAM_STATE`/`CONF_BASE`/`BUMP`
and **extracts the data arrays from `index.html` rather than copying them** — see the instrument
defects below for why that is not fussiness.

### What it found
**The aggregates all look fine** — blue-chip share of the board 11.2% against a real 11.1%, class size
20.7 against 20.2, persistence r 0.927 against 0.882, Gini 0.835 against 0.772. That is precisely how
the sim's totals looked right for nine phases while drive structure was badly wrong.

**The band table is not fine.** Non-cumulative, by program quality (talent composite for real,
prestige for the sim):

| band | real size | sim size | real BC% | sim BC% | real BCR | sim BCR |
|---|--:|--:|--:|--:|--:|--:|
| 1–10 | 23.5 | **4.2** | 40.3 | **10.9** | 69.6 | 100.0 |
| 11–25 | 21.5 | 18.0 | 35.4 | **67.0** | 44.5 | 94.5 |
| 26–50 | 19.8 | 14.7 | 19.0 | 21.8 | 15.6 | 22.5 |
| 51–90 | 19.5 | **25.0** | 5.1 | 0.2 | 2.6 | 0.1 |
| 91–134 | 19.9 | **25.0** | 0.2 | 0.0 | 0.1 | 0.0 |

Real class size is **flat** across program quality (23.5 → 19.9); scholarships are a constant and what
varies by two orders of magnitude is what the signatures are worth. SIDELINE inverts it: in a
representative class **Georgia signs one player, Alabama three, Ohio State five, Texas and LSU two**,
while prestige-72 programs sign a full 25 that is essentially all blue-chip.

**The cause is one mechanism.** `recruitFit` scores against a *target prestige per star tier*
(88/70/50/32) and the suitor draw in `genRecruits` scores on `1 − |prestige − target|/50` **with no
over-tier floor** (the floor exists only in `recruitFit`, which governs interest growth, not whether
you make the board). Pull is a **band-pass filter** — above a tier is penalised exactly like below it.
Real pull is *monotonic in program quality*.

**And the race is settled before anyone plays it.** Passive growth is `iv += (1.0+fit*3.2) *
(0.6+r()*0.9)` per week — ~4.4/week from a seeded base near 46 against a `COMMIT_THRESH` of 68. With
**nobody acting at all**, 86.7% of a prestige-71 program's seeded 4★ relationships are past the commit
bar by **week 7** and 90.0% are pinned at the 100 ceiling by Signing Day. So the AI brain, NIL, the
league ripple, visit weekends, pitch angles, double-downs and diminishing returns are all moving a
saturated number. That is the mechanical reason Phase 37 had to weaken its "aggressive push lands the
target" check to merely *leading* him into Signing Day.

Two more measured misses: the board is **18% too small** (3,400 vs 4,158), which is why its sign rate
reads 82% against a real **63.7%** — the real ranked board deliberately exceeds FBS capacity, a third
of it going to FCS/JUCO/PWO. And geography is inverted: **TX/FL/CA/GA produce 42.4%** of the real
board against 8% under the uniform `pick(r, STATES)` draw, so 13 Texas programs fight over ~68
in-state prospects.

### Instrument defects fixed, and one relocated bug
`reclab` hand-copied the data arrays and they had rotted: `STATES` held **15 of the real 50** (in-state
density 3.3× the shipped game) and `POS` still carried the pre-Phase-52 **`S`**, so `posAttrW('S')`
fell back to the **linebacker** row and `pickArch(r,'S')` returned `null` for ~9.5% of every pool it
validated — the same defect Phase 53 fixed in `simlab`. It now pulls them live; all 63 existing checks
stay green. **`rolllab` and `legacylab` still have the stale `S`** — recorded, not fixed here.

Convergence was **re-pointed off pool consumption**, which §2 shows is a supply-versus-capacity
accounting identity rather than a health metric — which is why it drifted 92 → 91 → ~80% as
contestedness moved and why the bar was quietly lowered 88 → 85 at Phase 51 for a shift nothing
behavioural had caused. (Also: every generated prospect gets suitors, so the two "different"
denominators were always the same number.) It is now a band, plus the two things real recruiting is
tight about — almost nobody signs under 10, and the bottom decile still signs a real class.

Writing the **passive-coach** scenario relocated the **Phase 44 recruiting cliff**. It does not
reproduce: `advanceRecruiting` resolves a full 25-man, 25-blue-chip class for a passive player team,
identical to the AI-recruited one. The cliff is created in the **app layer** (the board model plus
`decayNeglect` eating his seeded interest), which is why `reclab` could not see it and still cannot
while the engine is all it drives. Saturation is pinned as a **characterization check** so Phase 57
has a number to move.

### Save & validation
**No save bump, no `SIM_MODEL` bump, no game code touched.** `reclab` 63 → **68**; `rolllab` and
`portallab` re-run green. New artifacts: `docs/reference/cfb-recruiting.md`, plus
`recruit-report.txt` / `simrec-report.txt` / `rec-vs-real.txt` committed and the caches gitignored.

### Deliberately out of scope
No engine change of any kind — the band-pass fix, the geography table, the supply resize and the
saturation fix all belong to Phase 57, where they can be asserted green rather than asserted broken.
The band-table and class-size-inversion checks are therefore **not** in `reclab` yet, on purpose: a
gate that fails is not a gate. `22-recprofile.js` + `23-reccompare.js` hold them meanwhile.

---

## Phase 57a design — supply and geography

Decided 2026-08-14 with AJ, the first half of the talent-economy rewrite. Phase 56 found three
defects; this phase fixes the two that are **directly measured and need no fitting judgment**, and it
goes first for one reason: *supply and geography are inputs to fitting everything else.* Fit the pull
curve against a wrong supply and the constants absorb the supply error where nobody will find it
again.

**One correction to Phase 56's own numbers first.** §2 quoted a 4,158-prospect board and a 63.7% FBS
sign rate. Both mix ranked and unranked prospects, and SIDELINE's pool is **entirely ranked** — every
generated recruit carries 2–5 stars. The numbers to hold it to are the ranked-only ones: **3,692 per
class signing FBS at 67.4%**. The ~466 unranked prospects on a real board sign FBS at only 33.7% and
are the walk-on backfill `rolloverRoster` already provides. `21-recanalyze.js` now reports both and
exports the ranked-only pair as the comparison keys.

### What changed
- **`REC.POOL` 3,400 → 3,692**, and the star cutoffs become named constants `N5/N4/N3` (33 / 410 /
  2,585 cumulative) set from the measured mix. The old tail split 44.7/44.1 — a barbell — where the
  real board is a broad three-star middle over a smaller two-star tail (58.9 / 30.0).
- **`REC_GEO`** — a 50-entry table, parts per 10,000 aligned index-for-index to `STATES`, measured
  from 40,161 ranked prospects. `pickState(r)` replaces `pick(r,STATES)` and consumes **exactly one
  rng draw**, so the pool's draw sequence is unchanged. Maine and Vermont measure a true zero across
  the whole sample and are floored at 1 so no `coach.homeState` is structurally impossible.
- **`REC.GEO_SUIT` 0.3 → 0.20**, fitted. Fixing the state table immediately exposed a compensating
  error: in-state share jumped 31.5% → **45.4%** against a measured 36.8%, because the home-state
  pull had been hand-tuned against a world where Texas produced 2% of the country's talent. New tool
  `24-geofit.js` sweeps the pair; `GEO_SUIT 0.20 / GEO_FIT 0.10` lands **exactly** on 36.8%. Note
  what that says: the `recruitFit` bonus was always right, only the suitor-draw weight was over-set.

### What it landed
Supply is now exact and geography tracks:

| | real | sim before | sim after |
|---|--:|--:|--:|
| ranked board | 3,692 | 3,400 | **3,692** ok |
| 3★ / 2★ share | 58.9 / 30.0% | 44.7 / 44.1% | **58.9 / 30.0%** ok |
| blue-chip share of board | 11.1% | 11.2% | 11.1% ok |
| BCR per class | 14.4% | 13.5% | **14.2%** ok |
| in-state share | 36.8% | 31.5% | **36.1%** ok |
| TX / FL / CA / GA | 12.5 / 11.1 / 10.9 / 7.9% | 2.0 each | **12.0 / 11.1 / 11.8 / 7.7%** ok |
| class-score persistence | 0.882 | 0.927 | 0.925 ok |

**Deliberately still missing, and all owed to 57b:** FBS sign rate 77.6% against 67.4%, programs
signing under 10 at 13.4% against 3.3%, and the band table essentially unmoved (top-10 class size
4.9 against a real 23.5). Those are the band-pass filter and `CLASS_CAP` acting as a target rather
than a ceiling — neither is a supply problem, and neither can be fitted honestly until pull is
monotonic.

### Save & validation
**No save bump and no `migrateState` step** — no field is added or changed, and `S.recruiting` is
rebuilt by `initRecruiting` at every kickoff, so an in-flight class is untouched and the next one is
new. Recruiting has no replay contract, so no `SIM_MODEL` bump either. Generated boards **do** change
for a given seed, which is expected and is the phase.

`reclab` 68/68 (two supply assertions re-pointed at the measured board), `rolllab` 40, `portallab`
17, `traitlab` 30, `legacylab` 31, `draftlab` 22, **`qa` 330/330** — which needed the *third* site of
the pool-consumption identity re-pointed (reclab had two; this one was `Phase 14: the vast majority
sign by the close of Signing Day`). Three sites of the same wrong metric is itself the argument that
it was never measuring recruiting health.

---

## Phase 57b design — the talent economy

Decided 2026-08-14 with AJ. The half of the rewrite that needs fitting judgment, and the one the
whole arc exists for. Phase 56 found two defects; 57a fixed neither, because neither is a supply
problem. They are the *same* defect seen twice — **`recruitFit` alone decided both who was on a
prospect's board and who won him** — which is why they had to be fixed together. Fix the band-pass
alone and blue-bloods reach 4★ boards and then win every one deterministically, because the race is
still settled by week 7; fix saturation alone and the race becomes contestable among the wrong set
of suitors, with Georgia still not on the board.

> **One rule: pull is monotonic in program quality, and it sets the odds rather than the outcome.**

### The engine

**`pedigreeFit(prestige, stars)` is a logistic** in `prestige − recruitTier(stars)`. Monotonic in
prestige is the entire point: a better program must never pull a given recruit *less* than a worse
one does. It stays strictly below 1 by construction, so it keeps discriminating above the tier line
— two blue-bloods on the same recruit must not tie, or nothing clears `LEAD_GAP` and nobody commits.
`recruitTier` is now one definition; it had been inlined identically in `recruitFit` and
`genRecruits`, which is two places to drift.

**`boardAppeal`** carries the only surviving above-tier taper, and only for board *membership*. This
is the honest half of what the old band-pass was groping at: a blue-blood is not *worse* at
recruiting a two-star, it simply has better uses for the scholarship. Mild, floored, and separate
from pull.

**Growth approaches a ceiling set by fit** — `CEIL_BASE + fit×(100−CEIL_BASE)` — instead of climbing
without bound. A program's *passive* ceiling is its fit, so a dominant pairing still wins on its own
and a marginal one is stranded below the commit bar until somebody actually recruits him.

**`classTarget`** makes `CLASS_CAP` a ceiling rather than a target — every mid and low program had
been filling to exactly 25 against a measured mean of 20.2. It carries a small **prestige gradient**,
because §3's class size is nearly but not quite flat: 23.5 at the top of the league against 19.9 at
the bottom. That looks like a rounding detail and is not. It is what sets the top band's blue-chip
*ratio*: sixteen blue-chips in a class of 18 reads 100%, and the same sixteen in a class of 23.5
reads 70%, which is the measured number. Fitting without the gradient, top-10 BCR could not be pulled
off 99% by any combination of the other eight constants, because there was nothing else in the class
to dilute it with — the fitter grinding against that is what surfaced it.

**`aiPriority` became a product** — `fit × appeal × recruitValue`, expected value rather than a
weighted sum. This one is a direct consequence of monotonic pull and was missed on the first pass:
a blue-blood's fit on a *two-star* is ~0.99 against ~0.86 on a five-star (it is further above that
tier line), so **any additive form ranks the two-star higher** and the best programs fill their
classes with the tail. The first fitter run was stopped and discarded rather than allowed to tune
around it.

### Three things that came out of building it

**The one-way growth rule.** `iv += (ceil − iv) × rate` is an attractor, and an attractor pulls
*down* as well as up — so a coach who spent a season pushing a recruit above his program's natural
ceiling had the gain eroded every week, which destroys the exact thing the phase exists to create.
It cost a full re-fit to find, because the constants had already been fitted around it. Growth is
one-way now: **pull decides where you get for free, effort takes you above it, and you keep what you
earned.** Losing ground belongs to `decayNeglect`, which is app-layer and deliberate.

**The player is not subject to a class target.** The target models how many scholarships an AI
program has decided to give. A target the player can neither see nor set, silently blocking the
recruit he has worked all season because the autopilot filled the last slot with someone lesser, is
not a simulation of scholarship management — it is a bug with a rationale. One team of 134, and 25
is inside the real p90 of 27, so the measured distribution is untouched.

**A shipped bug, found sideways.** Checking that the new per-team `classTarget` draw varied year to
year turned up that nothing did: `initRecruiting` seeded the whole national class off `S.seed`, which
never changes for the life of a career, so **every season generated the byte-identical 3,692
prospects** — the same #1 recruit in the country, same name, position and home state, every year you
coached. `recruitSeed()` folds the year in, keeping determinism (seed + year reproduces a cycle
exactly) while making each class new. `S.recruiting.cycle` now tracks the year instead of being
permanently 1.

### Fitting
`25-recfit.js` fits the constants by alternating coordinate passes (the `15-penfit.js` shape),
because they interact: a steeper `PULL_W` concentrates blue-chips, which starves the mid-tier, which
changes how many programs fill a class, which changes the sign rate. The objective is nine measured
targets from §2–3, each scaled by what a meaningful error looks like for that metric so none
dominates by unit accident.

**Geography had to be folded into that same fit**, and 57a's separate `24-geofit.js` pass turned out
to be the wrong shape. `GEO_SUIT` competes with `SUIT_NOISE` for influence over board membership, and
home-state pull trades *directly* against prestige concentration — a recruit who signs with his
in-state school is one the blue-bloods did not get. So every time a distribution constant moved, the
separately-fitted geo constants went stale: in-state share swung **36% → 61% → 26%** across three
passes, each time for a reason that had nothing to do with geography. That is the same
compensating-error pattern 57a hit with the state table, seen three more times before the shape of
the mistake was obvious. `24-geofit.js` survives as the single-metric explainer — it prints the whole
grid, which is the readable way to see the trade — but `25-recfit.js` is the fit.

**What is *not* fitted matters as much as what is.** `TGT_MEAN` and `TGT_PRES` are pinned to an OLS
line through §3's five measured band sizes (20.3 at prestige 55, 0.79 per 10 prestige points) rather
than left as knobs. Left free, the fitter used them as a lever on the top band's blue-chip *ratio* —
a bigger class dilutes it — and drove the gradient to 1.4, nearly twice the measured slope, buying
`bcrTop10` by having the bottom of the league sign classes of 16.7 against a real 19.9. That is a
**measured quantity being spent to buy an unmeasured one**, which is precisely the failure this
methodology exists to prevent, and it is easy to miss because the objective function gets *better*
while the model gets worse. Only constants with no direct measurement are fitted.

### Save & validation
**No save bump, no `migrateState` step, no `SIM_MODEL` bump** — no field is added or changed, and
`S.recruiting` is rebuilt at every kickoff, so an in-flight class is untouched. Generated boards
change for a given seed, which is the phase.

`reclab` → **75** (adds the band-table assertions Phase 56 deliberately deferred, flips the two
saturation checks from characterizations into real assertions, and re-points `≥18 fill` to
fill-against-target). `qa` → **330**. `rolllab` 40, `portallab` 17, `legacylab` 31, `draftlab` 22,
`traitlab` 30.

**`26-dynasty.js`** is new, and it covers the cross-gate risk this phase carries: concentrating
talent widens the roster-quality spread, which widens the point spread, and `calibration.md` §7
already has the sim's standardized margin at 19.2 against a real 16.2. Nothing existing can see it —
`4-simprofile.js` builds its own prestige-scaled world rather than one that came out of recruiting,
and `rolllab` asserts rollover *stability*, not spread. So it runs ten seasons of
`genRecruits → advanceRecruiting → rolloverRoster` over a real-geography league and watches whether
the top-10/bottom-10 talent gap **compounds**. The question is compounding, not level: a stable gap
is fine at any width, since the sim's margin is calibrated against whatever spread it has, but a gap
that climbs every season means the best programs are converting a recruiting edge into a talent edge
into a bigger recruiting edge with nothing pushing back. Like `4-simprofile.js` it is a **tool rather
than an npm gate** — too slow for `reclab` — and any later phase that moves the talent distribution
owes it a run.

### What it landed
Every comparison row reads `ok` but one. Gini **0.774** against a measured 0.772, BCR rolling 4-year
**14.1** against 14.1, windows at BCR ≥ 50% **11.7** against 11.8, class size **18.9** against 19.0,
persistence **0.887** against 0.882, sign rate 68.8 against 67.4, in-state 34.6 against 36.8.

The band table, which is what the arc existed to fix:

| band | real size | sim size | real BC% | sim BC% | real BCR | sim BCR | *(pre-57 sim size)* |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1–10 | 23.3 | 22.5 | 40.3 | 31.6 | 69.6 | 56.0 | **4.2** |
| 11–25 | 21.0 | 21.1 | 35.4 | 43.9 | 44.5 | 55.4 | 18.0 |
| 26–50 | 19.2 | 19.8 | 19.0 | 21.0 | 15.6 | 17.0 | 14.7 |
| 51–90 | 18.5 | 18.6 | 5.1 | 3.2 | 2.6 | 1.7 | 25.0 |
| 91–134 | 17.7 | 17.3 | 0.2 | 0.3 | 0.1 | 0.1 | 25.0 |

**And it does not compound.** `26-dynasty.js` over ten seasons: the top-10/bottom-10 talent gap
settles by season four and holds, drift **+0.1** across the steady-state window, league talent sd
5.53 → 5.54. Worth recording for `calibration.md` §7's margin overshoot that recruiting produces a
*narrower* spread than the prestige-scaled initial roster generation does (gap 30.9 → 20.3 over the
burn-in), so multi-season play should ease that overshoot rather than worsen it.

### Known misses, recorded rather than tuned away
**The top band is under-concentrated while the league as a whole is not.** Gini is right to three
decimals, but the sim spreads blue-chips across ranks 11–25 (43.9% against 35.4%) where reality
concentrates them in the top 10 (31.6% against 40.3%). A single-width logistic in prestige cannot
make the top ten sharply different from ranks 11–25 while keeping total concentration correct;
reality has something convex at the very top that team quality alone does not explain — national
brand, in the ordinary sense. Deliberately **not** modelled, because there is one number's worth of
evidence for it and inventing a mechanism from that is how the Phase 25 penalty model and the Q4
frustration multiplier happened.

**No program signs a tiny class** — 0% against a real 6.3% signing under 10 ranked players. Real weak
programs lean on unranked signees and preferred walk-ons; the sim models no unranked prospects, so
this is the same gap as the absent ~466, seen from the other end.

The deep tail (band 51–90) landing the odd blue-chip is a **geography** effect, so it is measured in
`22-recprofile.js` rather than asserted in `reclab`, whose teams are bare by design and have no
`homeState` for it to fire through.

---

## Phase 58 design — the read

Decided 2026-08-14 with AJ, closing the arc. 56 measured, 57a fixed supply and geography, 57b fixed
the talent economy — and 57b is what unblocked this one. While the interest race settled itself by
week seven, better information about *who* to chase could not change an outcome, so a phase about
information would have been decoration. Now it can.

> **One rule: the services rank a generic player; you rank him for YOUR system.**

This phase is mostly **connecting**, which is why it is last and why it is cheap. Phase 52 generated
25 position attributes, 71 named archetypes and a per-player purity for every prospect; `genRecruits`
calls `genProfile`, `RECRUIT_PKEYS` saves `at`/`arch`/`pur`, and `recruitToFreshman` carries them to
campus. **None of it reached a screen.** `archList`/`archByName` were dead code and `p.arch` rendered
nowhere in the game — not on a recruit, not on your own roster.

### The engine (in the fence, so the lab drives it)
- **`recruitProject(rec, scheme, schemeList)`** → `{base, inScheme, best, bestScheme, fit}`. The
  scheme list is passed *in* rather than read from `OFF_SCHEMES`/`DEF_SCHEMES`, which are app-layer.
- **`recAttrSpread` / `recAttrRead`** — his attributes as a **band that closes with `rec.scout`**.
- **`recFogArch`** — the archetype name at one scouting threshold, its **purity** at a higher one.

**Scale, measured before building the UI on top of it.** The first version compared `ovrIn` against
`ovrBase` and read a mean delta of 0.34, which looked fatal to the whole premise. That was a bad
comparison: `ovrBase` sits near the *average across systems*, so the interesting quantity is the
swing **between** systems for the same player. Measured properly over a full board, that is **2–4
points on average and reaches 10** at QB, WR and OG — and high-purity specialists swing ~50% more
than generalists, which is exactly what Phase 52 built purity for. A three-star who fits can outrank
a four-star who does not, and nothing in the game said so before.

### The fog, and why it is the load-bearing part
`recScouted` banded a prospect's ceiling and `traitRead` banded his temperament, but `attrRowsHTML`
printed **all 25 attributes at full precision**. His current ability was free, exact information; the
attribute block was the strongest thing on the sheet and the cheapest; and scouting bought a ceiling
band nobody needed. Fogging ability is what turns the archetype and the in-system projection from a
readout into a decision — you are paying to find out *what kind of player he is*.

Roster players are unfogged: you know your own team.

### App and UI
The recruit sheet gains an **"In your Pro Style — 88–98"** card with his services ranking beside it,
the archetype once scouted, and a fit line (*"Better fit for Spread (91) — he'd give up 4 in yours"*
or *"Your Pro Style is his best fit"*). The board row carries the archetype chip. **The prospects tab
can sort by "Best in my system"** — the first view of the board that is not the one every rival also
has; it sorts on the same fogged read the sheet shows, so an unscouted board sorts nearly by star and
sharpens into a genuinely different ranking as you evaluate. And **`p.arch` finally renders on the
roster**, with a note when one of your own players would be better in a different system.

### Recruiting gets a consequence you feel this year
`classScore` / `myClassRank` / `classGrade` were **display-only across six call sites**. The entire
payoff for a great class arrived three or four years later as better players — against a hot seat
that runs on a two-to-three-year clock (Phases 19b/42). That is a large part of why an autopilot was
an acceptable answer to recruiting in Phase 44. `classApprovalDelta(rank, prestige)` now moves the
seat **at National Signing Day**, with its own media beat, and expectation scales with the program: a
#25 class is the job at prestige 95 (0) and a triumph at 35 (+5).

**It is pegged at about one game's worth of results.** The first cut used a multiplier of 7, and the
medialab check caught that it made a #1 class worth more than a losing season costs — which would
have had coaches recruiting instead of coaching. A real season swings −18 to +20 over 13 games; a
class spans −4 to +4.

### Save & validation
**No save bump, no `migrateState` step, no `SIM_MODEL` bump.** `at`/`arch`/`pur` are already in
`RECRUIT_PKEYS`, every fog is derived, and `classApprovalDelta` writes to an existing field.

`reclab` → **87** (project shape, the scheme swing, purity's effect on it, fog monotonicity, and that
**a band contains the true value** — which failed first time on `adp`, see below). `rolllab` → **42**
(the archetype you scouted survives onto the roster; a shapeless signee is classified on arrival —
neither was asserted anywhere). `medialab` → **55**. `qa` → **338**. All 23 gates green.

### One bug the gate caught, exactly as intended
The attribute band clamped to `[40, 99]`, copied from `shiftAttrs`. But **`adp` legitimately runs
below 40** — it is weighted 0 everywhere and describes portability rather than quality, which is why
`shiftAttrs` excludes it. So a true value of 33 was rendering as a band of "40–47": a fog that did
not contain the truth, which is not fog, it is a wrong number. It was latent, because
`attrRowsHTML` filters `adp` out of the display — which is precisely the argument for asserting
containment rather than trusting it.

### Deliberately out of scope
A **`sleeperGap`** was drafted and cut. Hand-setting a baseline for "what a 4-star is worth" flagged
37.5% of the board as sleepers, i.e. it measured the constants rather than the prospects; and `svc`
never *under*-rates by construction (Phase 51 defines it as `stars` or `stars+1`), so a
low-ranking/high-ability prospect does not exist to find. The real information edge is the one that
already existed — `ov` and `pot` vary within a tier and are fogged until you scout — and "Best in my
system" is the honest version of the feature. The fog widths are **designed, not measured**: CFBD has
no scouting data, `cfb-recruiting.md` says so explicitly, and the lab asserts only shape (monotonic,
bounded, never leaking at zero), never a magnitude.

---

## Phase 59 design — the top band, and why effort did nothing

Decided 2026-08-14 with AJ, taking on the residual Phase 57b recorded and Phase 58 shipped with: the
top-10 band took **31.6%** of blue-chips against a real 40.3%, while total concentration (Gini 0.774
vs 0.772) was right to three decimals. The sim was spreading them across ranks 11–25 instead.

### First: the recorded explanation was wrong
57b's doc said reality has *"something convex at the very top that team quality alone does not
explain — national brand"*, and deliberately declined to model it on one number's evidence. That was
the right instinct and the wrong conclusion. **`27-toplean.js`** tests it, because the cheaper
hypothesis had never been checked: maybe the sim's *prestige ladder* is too compressed at the top, in
which case the pull curve is innocent and the fix is measured rather than invented.

It is not the ladder. As a multiple of the bottom band, top-10 against 11–25 is **real 1.154, sim
1.191** — the sim's top band is if anything *more* separated. What differs is what the lead buys:
blue-chips per team, top ten against 11–25, **real 1.71×, sim 1.08×**. A near-identical quality gap
was converting into a large recruiting advantage in reality and almost none here. A **conversion**
defect, with no missing mechanism.

### Second: it was a fitting error, not a model error
`bcPerTeam` — blue-chips per team, top band against the next — went into `25-recfit.js`'s objective,
and that alone unlocked it. With no term valuing top-band concentration, the fitter had been sitting
at `PULL_W 26`, the *widest* pull in its grid; given one, it found 21 plus a geography rebalance
(`GEO_SUIT` 0.15→0.22, `GEO_FIT` 0.04→0.02) and cost fell 17.86 → 4.94 with `bcPerTeam` landing 1.70.

**A hypothesis that did not survive, recorded because it was persuasive.** `CEIL_BASE 60` compresses
every fit into a 40-point band, so on a four-star a top-ten program's passive ceiling sat 86.1 against
a rank-15 rival's 81.0 — a gap of 5.1, *under* a `LEAD_GAP` of 7, meaning the blue-blood literally
could not pull far enough ahead to trigger a commit. That is true, and it is not what was wrong:
`CEIL_BASE` and `COMMIT_THRESH` were both made knobs and the fitter left both exactly where they were.

### Third, and the real find: recruiting effort did nothing
The gate that broke on the new constants was Phase 57b's *"recruiting effort now changes the class it
lands"*, and it broke because it had been a one-seed comparison of blue-chip counts — 2 against 3 is
noise, not a measurement. Rewritten over four worlds on `classScore`, it read the AI-worked class as
**9% worse**. That turned out to be a confound in the harness (57b exempts the *player's* team from
`classTarget`, so the two runs were different capacity regimes). Capacity-controlled over ten worlds:

> **class score 938 worked, 939 ignored — the concentrated-effort pass moved a class by 0.1%.**

Phase 33's AI recruiting brain, and the Phase 44 autopilot that shares its priority function, had been
spending their entire weekly budget to no effect. Under the pre-57b saturated model this was invisible
because everything pinned at 100 anyway; de-saturating it should have exposed it, and 57b's assertion
passed on luck instead.

The cause was the traction term. `aiPriority` carried `+ iv*0.12`, which with a fitted `AI_VALUE` of
0.06 **dominated the expected-value product** — so the brain ranked highest the recruits it was
already winning, and spent the budget where it could not change an outcome. Phase 33 called it
"concentrate where you have a chance"; in practice it concentrated where there was nothing left to
win. It is now multiplied by **how pivotal the push is** — `exp(−(gap/AI_PIVOT)²)` on the margin
between this program and the best rival — so effort goes where the race is close, not where it is
already decided in either direction. Being recruited is now worth **+22% class score** and **+6.4
blue-chips** a class.

### And one mechanism deleted
`AI_SCOUT_STAR`, added earlier in this session, weighted the AI's scouting roll by star tier to
restore Phase 33's information asymmetry (the field evaluates the top of the board; the player keeps
his edge in the foggy tail), which had collapsed to 18-vs-14. That was treating the symptom — scouting
follows effort, and effort was going to the wrong places. With the pivotal weighting it falls out on
its own at **42 against 7** with no tier term at all, so the tier term is gone and `AI_SCOUT_P` is
back at its original 0.3. Two mechanisms producing one behaviour is one too many, and the one that
survives is the one that explains it.

### What it landed
Top band **31.6% → 36.3%** of blue-chips (real 40.3) and BCR **56.0 → 64.8** (real 69.6); per-team
ratio **1.08× → 1.70×** against a real 1.71×. Everything else held: sign rate 68.6 (67.4), class size
18.9 (19.0), blue-chip share 15.6 (15.3), BCR 14.0 (14.4), Gini 0.782 (0.772), in-state 37.9 (36.8).
`26-dynasty.js` still reads **STABLE** — talent sd 5.36 → 5.39 across the steady state.

**No save bump, no `SIM_MODEL` bump.** All 23 gates green: `reclab` 87, `qa` 338.

### Still open
The top band remains ~4 points short (36.3 against 40.3) with ranks 11–25 correspondingly long, and
`programs signing < 10` is still 0.0% against 6.3% — the sim has no mechanism for a program leaning on
unranked signees, which is the same gap as the unmodelled ~466 unranked prospects seen from the other
end. Both are recorded rather than tuned away.

---

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


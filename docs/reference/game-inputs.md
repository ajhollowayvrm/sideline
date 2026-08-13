# What Actually Goes Into a Game — and What the Player Can See

An audit, not a phase. Two halves:

1. **The inventory** — every input that reaches a formula inside a football game, in the order
   the sim applies it, with its real magnitude and where it lives in `index.html`.
2. **The recommendation** — which of those the player must be shown or told, ranked by how
   much a decision depends on it.

The organizing finding: **the UI's emphasis and the sim's arithmetic have drifted apart.** Three
numbers on every player sheet feed nothing. Four of the largest terms in the engine are invisible.
The gap is the backlog.

---

## Part 1 — The inventory

Units below are **rating points of `adv`** wherever possible, because that's the sim's common
currency. The conversion at the point of use (`simEngine`, lines ~2142–2207):

| `adv` feeds | coefficient | 1 rating point is worth |
|---|---|---|
| Yards per completion | `×PM.advPass 0.14` | +0.14 yd |
| Yards per carry | `×PM.advRun 0.085` | +0.085 yd |
| Completion probability | `×0.007` | +0.7 pp |
| Sack probability | `×−0.0012` | −0.12 pp |
| Interception probability | `×−0.0008` | −0.08 pp |
| Pass/run mix | `×0.003` | +0.3 pp pass |

So a **+15 `adv`** edge ≈ +2.1 yards per completion and +10.5 pp completion. That is the yardstick
for everything that follows.

---

### Layer 0 — Effective team ratings (fixed before kickoff)

`adv = (off.ratings.off − def.ratings.def) + ±HFA/2 + form[off] − form[def]` — `index.html:2073`

Assembled in `simSides` (`index.html:3864`), **outside** the pure engine.

| # | Input | Where | Magnitude | Player controls it? |
|---|---|---|---|---|
| 1 | **Top-11 average OVR per side** | `teamRatings` `:491` | the whole gap, typically 5–25 pts | Recruiting, portal, development, depth chart |
| 2 | **Staff boosts** | `staffBoosts` `:486` | coordinators +0–2 side-wide; position coaches +0–3 to their group, folded in *before* the top-11 cut | Hiring, salary |
| 3 | **Availability** | `availRatings` `:3850` | ratings recomputed with injured (`p.inj>0`) and redshirts (`p.rs==='on'`) removed | Redshirt calls; nothing about injuries |
| 4 | **Coach archetype/history edge** | `coachGameEdges` `:3803` | Motivator +1.6 both sides · Former Player +0.8 both · Coordinator +1.0 both · Off/Def Genius +1.4 own side. Realistic total **1–3 pts**. Controlled team only | Chosen at career start |
| 5 | **Scheme matchup edge** | `SCHEME_EDGE` `:397` | **−3 … +3**, directional (your offense vs their defense is a separate lookup from theirs vs yours) | Install a scheme |
| 6 | **Roster scheme fit** | `SCHEME_FIT_W 0.9 × rosterSchemeFit` `:439` | **−0.23 … +0.9** — small by design so raw OVR still decides | Install to match the roster, recruit to the scheme |
| 7 | **Coach scheme buy-in** | `schemeBuyIn` `:3818` | +1.2, ×1.5 if the matching Genius archetype → **max +1.8**. Controlled only | Run the scheme the coach loves |
| 8 | **Morale spotlight** | `moraleSpotlight` `:3833` | **±2 × spot**, where spot = 1 in a ranked game, 0.5 if the teams are within 3 OVR, **0 otherwise**. Controlled only | Press conferences, results, playing time |
| 9 | **Home field** | `PM.hfa 3.6` `:1805, :2073` | ±1.8 to each side → **3.6-point swing** | Schedule (non-conf series) |
| 10 | **Per-game form** | `PM.gameForm 0` `:1800` | **Exactly zero.** The "hot/cold night" term was fitted to 0 — play-level variance already meets the real margin SD | — |

> Note on #1: only the **top 11 by effective OVR per side** enter the team rating. Your 12th-best
> defender is worth nothing to `adv` — but he still takes snaps, commits penalties, and gets
> targeted (Layer 1). Depth matters, just not *here*.

---

### Layer 1 — Who is on the field, and how often

`gamePools` — `index.html:1701`. This decides which specific players the game happens to.

**Depth weight is the dominant term:** `dep = 1/(so+1)^1.35`

| Depth (`so`) | Relative share |
|---|---|
| 0 (starter) | 1.00 |
| 1 | 0.39 |
| 2 | 0.22 |
| 3 | 0.15 |

Your WR1 sees ~2.5× the targets of your WR2. **Depth-chart order is one of the largest levers in
the game and it is set on a screen that never says so.**

Positional weights inside each pool (`:1711–1724`):

| Pool | Composition | Used for |
|---|---|---|
| `recv` | WR ×1.15, TE ×0.75, RB ×0.55 | who gets targeted |
| `rush` | RB ×1.0 | who carries |
| `cover` | CB ×1.15, S ×0.75, LB ×0.4 | who's in coverage; also **defensive live-ball penalty rate** |
| `front` | DT ×1.0, DE ×0.9, LB ×0.7 | who meets the run |
| `ol` | OT ×1.0, OG ×0.95, C ×0.8 | **offensive penalty rate**, both families |
| `rush4` | DE ×1.0, DT ×0.7, LB ×0.5 | sacks; **defensive pre-snap penalty rate** |
| `tkl` | LB ×1.0, S ×0.8, CB ×0.7, DE ×0.55, DT ×0.45 | tackle credit; defensive personal fouls |
| `hawk` | CB ×1.0, S ×0.85, LB ×0.4 | **built but never read** — INTs are credited to the covering defender |

Also here: `recvAvg` / `rushAvg` / `covAvg` / `frontAvg`, the depth-weighted group means that make
the next layer mean-zero.

---

### Layer 2 — The individual matchup (the biggest per-play term)

```
matchEdge = 0.42 × ((offOv − offGroupAvg) − (defOv − defGroupAvg))     // :1745
```

Who covers whom is **deterministic by depth** (`coverDef` `:1735`): WR*n* draws CB*n*; TE → S → LB → CB;
RB → LB → S → CB. Their WR1 vs your CB1 is a persistent, readable storyline all game.

Magnitude: a typical WR1-vs-CB1 mismatch runs **3–5 rating points**; a real one (their star against
your injured corner's backup) reaches **8–11**. On any single play this is comparable to, or larger
than, the entire team-quality gap. It is also the term the Phase 24 adjustments exist to attack.

Feeds `padv`, which then does everything `adv` does, plus:
- Pep-talk boosts (`plan.boost`, +4 OVR) enter here through `bov()` → ~**+1.7 `padv`** on that player's plays.
- Fatigue (Layer 6) subtracts here.

---

### Layer 3 — The situation

| Input | Where | Effect |
|---|---|---|
| **Down & distance bucket** (`1 / 2-3 / 4-6 / 7-10 / 11+`) | `distKey` `:1819` | Selects the empirical gain table (`runQ`/`recQ`) **and** the measured pass rate `PM.mix` |
| **Measured pass mix** | `PM.mix` `:1790` | 3rd-and-1 → 17.2% pass; 3rd-and-7-10 → 78.5% |
| **Red zone** | `PM.rzLos 80`, `rzComp −0.060` `:1799` | −6.0 pp completion inside the 20 |
| **Field position** | `fourthCall` `:1957` | Drives the 4th-down brain; also caps penalty yardage (half-the-distance) |
| **Clock per snap** | `secRun 32 / secPass 30 / secQuick 13 / secIncomp 6 / secSack 32` `:1808` | Two 30-minute halves; a drive alive at the horn **dies there** |
| **Pressure** | `pressure(half,secs,diff)` `:1942` | 0 before Q4 · quadratic 15:00→5:00 · saturated ≤5:00 · **1 in OT**. Margin ≤8 → full; 9–16 → ×0.30; >16 → 0 |

**At full pressure** (`PC` `:1922`), applied to *both* teams:

| | Δ |
|---|---|
| Completion probability | **−3.4 pp** |
| Yards per carry | **−0.93** |
| Interception rate | **×1.32** |
| Fumble rate | **×1.15** |
| Yards per completion | **0** (deliberately — real ones don't fall) |
| Field-goal accuracy | **0** (deliberately — kickers measurably don't choke) |
| Composure reshape | **amplified ×2.6** (see Layer 5) |
| Per-matchup mean nudge | `(compClutch(QB) + compClutch(WR) − compClutch(CB)) × 1.5 × pressure` → bounded ~**±2.4** |

---

### Layer 4 — The call

**Pass probability** = `PM.mix[down|dist] + adv×0.003 + schemeTendency(offScheme)`, clamped 0.12–0.92.

| Input | Where | Magnitude |
|---|---|---|
| **Scheme tendency** | `SCHEME_TENDENCY` `:412` | Air Raid **+0.18** … Smashmouth **−0.16** |
| **Predictability tax** (`ky`) | `keyedPen` `:2024` | Kicks in past **60%** smoothed reliance on run or pass. At 85% pass: **−5.4 pp completion, −1.6 yd/catch, +1.2 pp sack**. Runs pay `RUN_KEY 7.5` yd/unit |
| **AI OC counter-read** | `aiOffPassAdj` `:1764` | Reads *your* defensive-call mix after 3 calls, shifts its pass rate **±0.18** |
| **AI DC scheme** | `aiDefCall` `:1755` | Reads *your* run/pass tendency + down/distance; disguise roll from a dedicated substream |

**Your defensive call** (`:2136–2139`) — the largest lever you hold play-to-play:

| Call | Sack | Completion | Pass yds | Run yds |
|---|---|---|---|---|
| Base | — | — | — | — |
| **Blitz** | **+5.0 pp** | −3 pp | **+5** | **+3** |
| **Cover** | −1.2 pp | **−10 pp** | −3 | +1 |
| **Run stop** | — | **+6 pp** | +3 | **−4** |

**Play concept variants** (`:2162–2165`) — opt-in; plain run/pass is byte-identical to no variant:

| Variant | vs Run-stop | vs Base | vs Cover | vs Blitz | Always |
|---|---|---|---|---|---|
| **Play Action** | **+12 pp, +7 yd** | +6 pp, +3 yd | −12 pp, −5 yd | −3 yd | +2 pp sack |
| **Screen** | — | — | — | **+5 pp, +9 yd** | +12 pp, −2 yd, −3 pp sack |
| **Deep Shot** | — | — | — | — | −14 pp, +3 pp sack, **+8 yd mean shift** |
| **Draw** | — | −2 yd | −2 yd | **+6 yd** | — |

**Packages** (`:2155–2156`, `heavyRunBonus :1770`):
- **Heavy** — +4 at ≤2 to go or goal line, +2 at ≤4, **−3 at ≥8**.
- **Spread** — +5 pp completion, +3 yd, but sack **+8 pp against a blitz** (+2 pp otherwise).

**4th down** (`fourthCall :1957` + a **24% chicken-out roll** at `:2117`): field position, distance,
score, clock. The player can override any of it.

---

### Layer 5 — Temperament

Only **composure** (`p.comp`) touches a game. Motor is offseason-only; Ego reaches the field only
indirectly, through morale → spotlight (Layer 0 #8).

| Channel | Where | Effect |
|---|---|---|
| **Yardage variance** | `compExp`/`compDraw` `:348–350` | Reshapes the draw on **every** run and completion. comp 100 → exponent 1.5 (tight around the median); comp 0 → 0.5 (boom/bust). **Mean-preserving** |
| **Clutch amplification** | `PC.varAmp 1.6` `:1934` | At full pressure the exponent multiplier hits 2.6 — both extremes clamp out (0.25 / 1.75). Composure decides *who* wobbles when it matters |
| **Clutch mean nudge** | `compClutch :354` | ±1.6 rating pts × 1.5 × pressure, drawn from the live matchup |
| **Penalty propensity** | `foulProp :1890` | `exp(−(comp−50)/30.2)`, clamped **0.28 … 3.4** |

---

### Layer 6 — Attrition

| Input | Where | Effect |
|---|---|---|
| **Fatigue** | `fatigueCost :1748` | Zero until **Q4 *and* >18 touches**, then −0.4 OVR per extra touch, capped at **−6**. Enters `padv` via `bov()` |
| **In-game injury** | `INJ_RATE 0.0055` `:2040` | Per exposure for the ball-carrier/receiver, ×0.7 for the defender on him. Knocked-out player is skipped from every pool — the backup is forced in, and his matchup shows |
| **Injury duration** | `injDur :1751` | 45% day-to-day · 30% 1 wk · 15% 2 wk · 7% 3–4 wk · 3% 5–8 wk |
| **Frozen availability** | `g.out` / `benchedFor :3859` | Who sat is frozen at kickoff so a replay is faithful |

---

### Layer 7 — Discipline

`PN` — `index.html:1839`. **The league mean is a constant; the spread is your roster.**

```
rate(family) = PN.base[family] × poolProp(group) × road × calm     (capped 0.16/snap)
```

| Family | Base/snap | Rate set by the composure of | Cap |
|---|---|---|---|
| Offensive pre-snap | 0.02403 | **your OL** | 5 flags/drive |
| Offensive live-ball | 0.01989 | **your OL** | " |
| Defensive pre-snap | 0.00688 | **your pass rush** (DE/DT/LB) | " |
| Defensive live-ball | 0.02014 | **your coverage** (CB/S/LB) | " |

- `poolProp` is the depth-weighted mean `foulProp` of that group — an OL room averaging comp 30 runs
  **~4× the flags** of one averaging comp 70.
- **Road multiplier ×1.057**; **calm lever ×0.55**.
- Culprit drawn from the same pool weighted `depth × propensity^2.4` — one man commits ~45% of his
  team's false starts.
- 22-type catalog with measured shares, yardages, and auto-first-down flags.
- **Pre-snap** → replay the down. **Offensive live-ball** → wipes the play, touchdown included (the
  stat journal un-writes it). **Defensive live-ball** → accepted only when it beats what happened.

---

### Layer 8 — Fixed constants (no lever exists)

| Input | Value | Note |
|---|---|---|
| Base completion | `PM.cmpBase 0.6200` | |
| Interception on incompletion | `PM.intRate 0.068` | |
| Fumble on a carry | `PM.fumRate 0.0125` | |
| Strip on a sack | `PM.sackFumP 0.075` | |
| **Field goal** | `clamp(0.965 − (dist−20)×0.013, 0.40, 0.985)` `:2084` | **Distance only — kicker OVR is never read** |
| **Extra point** | flat `0.965` `:2247` | Kicker-independent |
| Punt net | `ri(38,46)`, touchback floor at the 20 | Punter OVR never read |
| Gain distributions | `PM.runQ` / `PM.recQ` / `sackQ` | Empirical inverse-CDF from 258k rushes / 145k completions |
| Game seed | `hashStr(g.id) ^ S.seed` `:3879` | |

---

### Inputs the UI shows but the sim never reads

| Shown | Where shown | Reality |
|---|---|---|
| **Speed / Strength / Awareness** | Every player sheet `:7663`, every recruit sheet `:7263` | **Never referenced by any game formula.** Generated from OVR, bumped at development, displayed — and that's all |
| **Kicker OVR** | Roster row, depth chart | FG% and XP% are kicker-independent |
| **Punter OVR** | Roster row | Punt net is a flat random draw |
| "Hot/cold night" | Code comment `:2028` | `PM.gameForm = 0` — the term is inert |

---

## Part 2 — What the game surfaces today

**Pre-game (Home).** Scheme matchup edge in words (`schemeMatchupHTML :6112`, "big edge ▲ / tough ▼"),
rivalry banner, injury report with weeks out, national/conference rank, team OVR.

**Roster.** OVR, ceiling band, development stage, growth chip, fogged Motor/Poise/Ego chips, morale
mood, fogged scheme preference with ✓/✗ against the installed scheme, a 🚩 flag chip for repeat
offenders (`penFlag :7598`), depth number.

**In-game.** Score, quarter, clock, down & distance, field position, hash, SVG field and play art;
`offTendHint`/`defTendHint` (the opponent's call tendency, with a suggested counter); the live
matchup panel (your receivers' production, your coverage with a 🔥 "cooked" marker, penalty tallies,
injuries); the OC/DC's recommendation on every call.

**Adjustments sheet.** Coverage reassignment by receiver slot, pep talk on players who've been
involved, the calm-them-down lever with your penalty count.

**Post-game.** Box score, season stats, Player of the Week.

That is a genuinely good foundation. The gaps are specific.

---

## Part 3 — Recommendation

Ranked by **how much a decision changes when the player knows it**. A thing is worth surfacing only
if it is (a) large, (b) actionable, and (c) currently invisible or misleading.

### Tier 1 — Large, actionable, invisible today

**1. Depth-chart share.** `1/(so+1)^1.35` is one of the biggest levers in the game and the roster
screen presents depth as a bare "#2". Show the implied share on the depth-chart row — *"WR2 · ~39%
of WR1's targets"* — and a position-group summary. Right now a player reordering the depth chart is
guessing at the magnitude of what he's doing.

**2. Your own tendency, live.** `offTendHint`/`defTendHint` tell you what the *opponent* has been
doing. Nothing tells you what *you* have been doing, yet `keyedPen` taxes you for it: past 60%
reliance you're losing ~5 pp of completion and ~1.6 yd a catch. Add a one-line self-read next to the
call buttons — *"You've thrown 84% — they've keyed on it (−5 pp)"*. This is a real, hidden penalty
for a real, natural behaviour.

**3. Unit discipline.** Penalty rate is set by four *specific* groups' composure (OL, pass rush,
coverage), yet the roster only shows per-player Poise chips that the player must aggregate by eye.
Add a Discipline card — four rows, four groups, a rate multiplier each, and the worst offender named
in each. This converts penalties from weather into a roster problem you can fix in the portal.

**4. The pre-snap matchup.** `matchEdge` is the largest single per-play term and `coverDef` is fully
deterministic — the game *knows* before the snap that your WR1 draws their CB1. Show the headline
matchup on the play-call screen and mark a mismatch. Today the player learns his corner is getting
cooked only after 80 yards, via the 🔥 in the matchup panel.

**5. Big-moment state.** Pressure changes six things at once and the player gets no signal it's on.
A single chip on the scoreboard — *"BIG MOMENT — everything's harder for both teams"* — is enough.
Without it, the Q4 completion drop reads as the sim cheating.

### Tier 2 — Explain once, then trust

These don't need live readouts; they need a help sheet or a tooltip, because they're stable rules
the player can internalize.

**6. The defensive-call table.** Blitz/Cover/Run-stop have effects large enough (Cover is −10 pp
completion) that the player should be told them once, plainly. Same for the four play concepts
against the four defensive calls — the `tip` strings ("Beats the blitz") gesture at it; a small
matrix in a help sheet would land it.

**7. Home field is worth 3.6 points.** Never stated anywhere.

**8. What composure actually does.** The Poise chip is fogged and unexplained. Three sentences:
it reshapes yardage variance (never the mean), it presses ~2.6× harder late in close games, and it
drives penalties. Right now "Ice-Veined" is a word with no mechanical meaning to the player.

**9. Where your coach edge comes from.** Archetype, history, scheme buy-in and morale spotlight sum
to a real number in `simSides`. A single "Your edge this game: +4.2" line on the pre-game card, with
the components on tap, would make career-start choices legible for the first time.

**10. Fatigue.** Show a touch counter on the ball-carrier in Q4 once he passes 18. Small effect
(−6 OVR max), but it's the only thing that makes rotation a decision.

### Tier 3 — Fix the misleading, don't just add

**11. Speed / Strength / Awareness.** These are the most prominent numbers on every player and
recruit sheet, and they change nothing. Two honest options:

- **Wire them in** — e.g. `spd` into the explosive tail of the gain draw, `str` into the OL/front
  pools and short yardage, `awr` into the coverage matchup. This is a real sim change and would need
  refitting against `cfb-averages.md`, so it's a phase, not a patch.
- **Demote them** — move them off the headline into a details fold, and stop showing them on recruit
  cards where they actively distort evaluation.

Recommend **demote now, wire in later if a phase wants it.** Shipping a visible stat that does
nothing is worse than not shipping it, and the recruit sheet is where it does the most damage.

**12. Kicker and punter OVR.** Same problem, smaller. A player who spends a scholarship on a
90-OVR kicker gets exactly nothing. Either make FG% kicker-sensitive (carefully — the measurement in
`cfb-clutch.md` says kickers don't choke, but it says nothing about kickers not *differing*), or
stop ranking specialists by an OVR that the game ignores.

**13. Dead code.** The `hawk` pool (`:1724`) is built every game and never read; the `gameForm`
comment (`:2028`) describes behaviour that was fitted to zero. Neither is a bug — both are lies to
the next reader.

### Deliberately not surfaced

- **Raw trait numbers.** The fog is the design (Phase 10). Bands only.
- **Exact `adv`.** A single number would flatten a deliberately multi-layered model into one stat to
  min-max. Show the *components*; keep the sum coarse.
- **Opponent internals** — their composure, their scheme fit, their depth weights. You scout what
  you can see.
- **The gain quantile tables.** Nothing actionable in them.

### Suggested sequencing

| Step | Contents | Why first |
|---|---|---|
| **A** | Depth share on the roster · Discipline card · demote spd/str/awr | Pure UI. No sim change, no save bump, no gate risk. Kills the two worst misconceptions |
| **B** | Live self-tendency · pre-snap matchup line · big-moment chip | In-game screen only. Reads state that already exists in `ctx`/`G.box` |
| **C** | A "How a game is decided" help sheet — the defensive-call table, the concept matrix, HFA, composure, coach edge | One screen, no engine work, retires most of Tier 2 |
| **D** | *(optional, a real phase)* wire spd/str/awr and kicker rating into the sim, refit against `docs/reference/cfb-averages.md` | Only worth doing if the phase budget exists — it's a measured-reality change, not a UI one |

Steps A–C are all app-layer. None touches the fenced `SIM ENGINE` block, so the simlab envelope,
determinism, and `SIM_MODEL` are untouched and no save version bump is needed.

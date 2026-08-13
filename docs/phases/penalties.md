# Penalties — discipline as a thing you build (Phase 49)

The measured target is `docs/reference/cfb-penalties.md` (3,944 FBS games, 2021–2025). The constants
live in the fenced `PN` block in `index.html`; `tools/cfb-data/15-penfit.js` fits them and
`14-simpens.js` measures where the shipped engine lands.

---

## Why this phase exists

Phase 25 gave the sim penalties. Measuring them against real football (Phase 49's reference sheet)
showed the model was wrong in almost every dimension at once, and — more importantly — wrong in a way
that made them *meaningless*:

| | Real | Phase 25 |
|---|--:|--:|
| Flags / team-game | 5.98 | 7.37 |
| Penalty yards | 52.4 | 36.8 (flat 5 each) |
| Distinct foul types | 25+ | 2 |
| Offense / defense | 61% / 32% | 50% / 50% |
| Offside / team-game | 0.54 | 3.69 |
| **True team-level sd** | **0.95** | **0.17** |

The last row is the phase. Composure *was* wired into the old model — the rate scaled by
`1 + (50 − teamComposure)/120` — but team mean starter composure only spans 42–59 (it's an average
of ~28 bell-shaped draws, so it concentrates hard on 50), and that divisor turned the whole league
into a ±7% band. The least-composed teams threw 7.67 flags a game and the most-composed 7.24. Real
football's gap between those quintiles is **3.37**.

So penalties were a flat tax with noise on top. Nothing you did to your roster changed them, and
nothing about them told you anything about your team.

---

## The design rule

**The league mean is a constant; the spread is the roster.**

A team's rate for a family of fouls is the depth-weighted mean *foul propensity* of the group that
actually commits it — and the culprit is then drawn from that same pool. Your offensive line's
composure drives your offensive flags. Your secondary's drives your defensive ones.

```
foulProp(p)  = clamp(exp(-(comp - 50) / 30.2), 0.28, 3.4)     // 1.0 at league-average composure
poolProp(P)  = depth-weighted mean of foulProp over a gamePools pool
rate(fam)    = PN.base[fam] × poolProp(famPool) × road × calm
culprit      ∝ depthWeight × foulProp^2.4
```

Two consequences that were the point of doing it this way:

**A head case is a specific, fixable problem.** Real false starts concentrate brutally — one player
commits **44.7%** of his team's, the top three **71.4%**. The `gamma` exponent on the culprit draw is
fitted to reproduce that (the sim lands at 45.1%). So a low-composure left tackle isn't a rounding
error spread over 85 players; he's the guy in the play-by-play four times a game, tagged on your
roster screen, and replacing him measurably cleans up your offense.

**Rating deliberately does not enter.** Propensity keys off composure *alone* — not OVR, not
awareness. Measured discipline is flat across team quality (top-10 teams 5.87 flags, unranked 5.99),
and composure is generated independently of overall, so keying off it reproduces that independence
by construction. Letting rating in would quietly make good teams clean teams, which real football is
not. simlab asserts this directly: ±18 OVR and ±18 awareness across a whole roster moves the flag
rate by less than 0.5 per game, while ±35 composure moves it by 12.

---

## What changed

### A real catalog, from the measured mix

22 foul types, each with its measured share of all real flags, its measured average yardage, whether
it's an automatic first down, and which pool gets blamed. The mix isn't asserted — it *falls out* of
the shares, so the sim's most common flags are the sport's most common flags:

| | Sim | Real |
|---|--:|--:|
| False start | 27.2% | 26.3% |
| Holding | 16.6% | ~15.9% |
| Pass interference | 12.2% | 11.8% |
| Offside / encroachment | 9.4% | 9.1% |
| Delay of game | 6.7% | 6.3% |

Yardage is per-type and measured (false start 4.9, holding 7.6, roughing the passer 13.9) rather
than statutory, then clamped by half-the-distance. `PN.ydsScale` closes the residual gap to the
box-score total, because ESPN's `statYardage` under-measures spot fouls and kick-game flags by ~18%.

### Pre-snap and live-ball are different events

~49% of real flags never involve a snap. Those are checked before the down and replay it, as before.
The other half are new: they're drawn *after* the play resolves, and they interact with what happened.

An accepted **offensive** live-ball foul wipes the play outright — including a touchdown (~0.14 per
game come back). This needed a per-play stat journal (`jr`) so `undoPlay()` can un-write the lines
the play just recorded: a 22-yard run brought back by holding must not survive in the box score.
Injuries on a wiped play deliberately stand.

A **defensive** live-ball foul is taken only when it beats what actually happened — it erases a
turnover, hands over a first down the defense had stopped, or out-gains the play. That's the real
accept/decline decision, and declined flags are never charged, which matches the box-score
convention the 5.98 target was measured under.

### What was removed

The **Q4 frustration multiplier** (`×1.15` late) is gone. Real flags track snap volume, not emotion —
Q2 is the busiest quarter for penalties (28.3%), not Q4 (25.4%). It was invention. The road premium
survives but shrank from an invented +10% to the measured **+5.7%**.

### Imported rosters now get temperaments

`normPlayer` never assigned `mot/comp/ego`, so imported players read as exactly 50 everywhere. That
was harmless while composure only reshaped a draw (identity at 50), but `foulProp` is exponential, so
a trait-less roster would have fouled ~20% less than a generated one. Imports now draw traits
deterministically from the player's identity — which they arguably deserved anyway.

---

## Fitting

`15-penfit.js` fits four things over a 2,010-game synthetic slate, alternating the two that interact:

1. **`PN.base.*`** — the four per-snap family rates, iterated because penalties replay downs and
   therefore create more snaps.
2. **`PN.compK`** — bisected against the **noise-corrected** team-level sd, shrunk out exactly the way
   the real data was (game-to-game sd within a team-season is 2.54; only 12.2% of a single team-game's
   variance is the team). Fitting to the *raw* season sd would have over-steepened composure by ~25%.
3. **`PN.gamma`** — orthogonal to the rate (`poolProp` doesn't see it), fitted against the worst
   offender's 44.7% share of his team's false starts.
4. **`PN.ydsScale`** — iterated, since half-the-distance clamping makes it mildly non-linear.

**One trap worth recording.** The concentration fit was initially measuring nonsense: the synthetic
rosters had no surnames, and the engine's `nm()` falls back to the *position code* when a player has
none — so every tackle collapsed into a single "offender" called `OT` and concentration read ~50%
regardless of `gamma`. Giving the fit rosters unique names changed the fitted `gamma` from 0.44 to
2.4. Concentration was also re-measured over each team's first 12 games rather than all 30, so it
compares like-for-like with a real season instead of benefiting from a bigger sample.

---

## Where it landed

Measured by `14-simpens.js` over 2,010 games:

| | Sim | Real |
|---|--:|--:|
| Penalties / team-game | 6.01 | 5.98 |
| Penalty yards | 51.5 | 52.4 |
| Yards per penalty | 8.56 | 8.76 |
| Game-to-game sd | 2.63 | 2.54 |
| **True team-level sd** | **0.94** | **0.95** |
| Team-season p05 / median / p95 | 4.47 / 5.87 / 7.87 | 4.08 / 5.92 / 7.92 |
| Discipline quintile gap | 2.94 | 3.37 |
| Offense share | 65.3% | 65.1% |
| Pre-snap share | 48.9% | 49.1% |
| Worst false-start offender | 45.1% | 44.7% |

Two known misses, both small and both understood:

- **Road premium measures +2.6% against the +5.7% constant.** Within about 2σ of the slate's sampling
  noise, and a second-order term either way (0.16 flags). Not worth over-fitting.
- **Auto-first-down share 26.1% vs 28.8%.** The real figure includes special-teams fouls, which the
  engine doesn't model at all (their ~4% share is folded proportionally into the scrimmage families,
  which is also why the modelled offense/defense split is 65/35 rather than the raw 61/32).

---

## Save & replay

`SIM_MODEL` goes to **4**. Games resolved by the old penalty model carry `g.eng === 3` and now decline
replay rather than re-simming to a different score — the same contract Phase 48 established, for the
same reason: a replay that contradicts the record book is worse than no replay.

Save version **45**, structurally a no-op. The new per-player counters (`p.gs.pen` / `p.gs.penYds`)
are sparse box keys that read as 0 when absent, and the Phase 9 columnar codec carries `p.gs`
generically, so nothing needed a migration beyond the version stamp.

---

## Validation

Ten new checks in `simlab` on top of the Phase 25 three: rate, yardage, yards-per-flag, that every
flag carries a type and is charged to a real player on the field, the offense/defense and
pre-snap/live-ball splits, that a composed roster is meaningfully cleaner, that **rating does not buy
discipline**, that an undo never leaves a negative count in the box, and that the whole thing stays
deterministic through the wipe path. All 23 gates green.

One QA check needed repair rather than adaptation: the Phase 29 AI-defensive-coordinator assertion
compared *points over six games*, which the neighbouring Phase 30 comment already identifies as
matchup noise (simlab's own version of the same check uses n=200 and notes the sign flips below
that). The extra per-snap rng draw reshuffled the stream and it flipped. It now samples 72
game-seed pairs and additionally asserts the DC is engaged through `simSides` — simlab still owns the
directional envelope.

---

## Deliberately out of scope

- **Special-teams fouls.** No kickoff-out-of-bounds, no running into the kicker, no block-in-the-back
  on a return, because the engine has no return game to hang them on. Their share is folded into the
  scrimmage families so the per-game total still lands on 5.98.
- **Offsetting and declined penalties as visible events.** Declines happen (defensive fouls that
  don't beat the play are dropped) but are never surfaced or counted, matching how box scores treat
  them.
- **Ejections.** Targeting is in the catalog for its yardage and automatic first down, but nobody gets
  thrown out — removing a player mid-game is a personnel change the drive loop isn't built for.
- **Penalty-driven momentum.** No morale hook, no crowd-noise model, no "they're rattled" spiral.
  Real penalty differential correlates with point margin at r = 0.047; a system that let flags snowball
  would be modelling something that isn't there.
- **Per-position penalty tendencies beyond composure.** A guard is no likelier to hold than a tackle
  is, beyond the pool's depth weighting. The measured data can't separate them without a name→roster
  join that isn't worth its fragility.

# Phase 54 — calibration (attributes-2.md step 4)

> **Status: the aggregate is in; the split is not.** Points per team 22.8 → **25.5** against a real
> 26.9, with plays, total yards, yards per play, sacks, turnovers, red-zone conversion and drive start
> all landing. The average margin did **not** come in, and §5 is the honest accounting of how much of
> that was ever the engine's to fix. `SIM_MODEL` stays at 8; the save shape is unchanged.

Step 4 of the sequencing in `attributes-2.md` §10 — *"calibrate global constants to the league
aggregate + the §3 split curve"*. Step 5 (the new gates) remains.

---

## 1. The scoring gap was three things, not one

`attributes-2.md` §11 target 1 is *"recover ~4.3 points/team without adding yards"*. Decomposing it
rather than treating "drives don't finish" as a single problem:

```
real  11.8 drives x (26.3% TD x 6.97 + 9.9% FG x 3) = 25.1   vs an actual 26.9
sim   12.1 drives x (23.1% TD x 6.97 + 8.9% FG x 3) = 22.71  vs an actual 22.77
```

**~1.8 points a team-game of real scoring is non-offensive, and the sim scored 0.06 of it.** That is
43% of the whole gap and it was a *missing category*, not a mis-calibration — `cfb-averages.md` §4(e)
has named it since Phase 48. The rest split into a clock that had drifted and a yardage bug.

### a) Non-offensive scoring

The pick-six (9.8% of interceptions, from a real 0.08 INT-return TD against 0.82 INTs), the fumble
return, and the punt taken back. `keep` tells the drive loop not to swap possession: a scoring defence
kicks off, so the ball goes back to the team that just turned it over, which the alternating loop
would otherwise hand to the wrong side.

Non-offensive TDs now run **0.181** a team-game against a real ~0.16. Worth +1.0 points and — being
rare and large — about +0.05 of excess kurtosis.

### b) Yardage past the goal line

The engine credited the raw draw on a scoring play, so a 20-yard run from the opponent's 5 booked 20
rushing yards when only 5 were available. Real box scores cap at the goal line.

|  | before | after | real |
|---|--:|--:|--:|
| yards / carry | 4.85 | **4.53** | 4.27 |
| yards / play | 6.03 | **5.62** | 5.67 |

Found by checking mean gain by down-and-distance against `11-plays.js`'s measured `runByDD`/`cmpByDD`,
which nothing had ever been compared against: goal-to-go plays were gaining 5.61 where real ones gain
1.63.

### c) The clock

`secRun`/`secPass` were fitted when a dropback was one roll. Phase 53 added the scramble, and step 4
added fourth-down gambles and returned turnovers — all of which change how much clock a possession
burns. At the old values the sim ran 64.2 plays against a real 67.5, or 28.0 seconds a snap against a
real 26.7. Re-anchored to 30/28: plays 64.2 → **67.9**, total yards 362 → **381**.

---

## 2. Fourth down was a decision, badly made — and worse measured

The aggregate read "conversion 38.0% against a real 52.4%". Both halves of that were wrong:

- **Attempts were double-counted.** "Turnover on downs" is logged as a second entry carrying the same
  4th-down `dd` as the play that failed, so every failure was booked twice — inflating attempts and
  deflating conversion by the same failures, against a real side that reads ESPN's `fourthDownEff`
  and has no duplicate.
- **Goal-to-go was bucketed as 4th-and-1.** The play-by-play `dd` reads "4 & goal" at any distance
  inside the ten, so 4th-and-goal from the 9 sat with 4th-and-inches — which made the short-yardage
  field-goal rate look like a decision bug when it was a bucketing one.

Corrected, the sim attempted **1.39** against a real 1.94 and converted **60.4%** against 52.4%: it
was going for it too *rarely* and converting too *well* — the opposite of what the tool said. Per
distance it was already close to exact (75/72, 58/55, 47/45, 33/32), so nothing about execution needed
touching at all.

What did need touching was the decision. A flat 24% "the coach loses his nerve" roll fired as often on
4th-and-inches as on 4th-and-15, turning a quarter of all short-yardage gambles into field goals. It
is distance-aware now (7% short, 30% long), 4th-and-1 is a go from your own 30, and 4th-and-3 past
midfield is taken before the chip shot. Attempts **1.39 → 1.71**, per-distance conversion still
tracking.

`19-fourth.js` is new and prints the whole decision table by distance, third down included.

---

## 3. What was already right, and only looked wrong

Measured for the first time, via a new `l` (line of scrimmage) field on the log:

| | sim | real |
|---|--:|--:|
| red-zone TD % | 69.8 | 67.5 |
| red-zone FG % | 16.6 | 17.7 |
| avg drive start (own) | 30.1 | 29.8 |
| red-zone trips | 4.36 | 4.68 |

**The red zone was never the problem.** The sim converts trips correctly and simply makes fewer of
them, and at ~4.7 points of marginal value per trip the 0.3-trip deficit is what is left of the
scoring gap. Note also that a touchdown *is* a red-zone trip — the ball crosses the 20 on the way in,
however far out it started — which is what makes the real 4.68 trips × 67.5% reconcile with the real
3.10 offensive TDs; scoring the trip only when a prior play reached the 20 undercounts every long
touchdown and invents a gap that is not there.

Third down is the same story. Per distance the sim is nearly exact (77 vs 76.6, 57 vs 57.0, 41 vs
43.4, 28 vs 31.7, 15 vs 16.9) and it faces the same *number* of third downs (13.23 vs 13.26). What
differs is the **distance mix**: 0.99 third-and-1 against a real 1.51, and 3.24 third-and-11+ against
2.40. It arrives at third down further back.

That mix is the whole red-zone trip deficit, because third down compounds — a drive needs about three
of them, so (0.392/0.377)³ = 1.12, which turns 34.6% of drives reaching the red zone into 38.8%
against a real 39.7%.

**And it is not per-play variance.** The obvious explanation — boom-or-bust gains leaving you in
3rd-and-long — was measured and is wrong. Against the measured tables the sim's own draws are:

| | sim | measured table |
|---|--:|--:|
| rush on 1st-and-10 | mean 5.34, sd 8.43 | 5.38, 8.31 |
| completions on 1st-and-10 | mean 12.17, sd 12.62 | 12.31, 12.25 |

The channels add ~1.5% of extra spread and nothing else. Whatever puts the sim in 3rd-and-long is
upstream of the gain draw, and is left open.

---

## 4. The play-caller honours the measured mix

Checked per cell against `PM.mix`: 44/44, 52/53, 70/70, 79/79, 62/62. The sim calls what real football
calls in each down-and-distance. Its overall pass share is nonetheless **49.2% against a real ~53%**,
which is therefore purely compositional — it spends more snaps in run-heavy cells. Also open.

Scheme tendency was checked and cleared: `SCHEME_TENDENCY` sums to −0.02 across seven schemes, a mean
of −0.003, so it is not tilting the league.

---

## 5. The margin, and how much of it was ever the engine's

**Roughly half the margin MISS is the harness.** The synthetic slate pairs each team with the 15 that
follow it in a prestige-banded list, and the wrap puts the weakest teams onto the strongest, so it
carries **30.4% of games at a 17.5+ point spread against a real 18.1%** and only 32.2% inside a
touchdown against a real 41.5%. Average margin is a function of that composition as much as of the
engine, so the headline comparison was never apples-to-apples.

`5-compare.js` now prints aggregates re-weighted to the real spread-bucket mix:

```
avg margin     real 16.2   sim raw 21.7   sim standardized 19.2
points / team  real 26.9   sim raw 25.5   sim standardized 25.1
```

This is the number `attributes-2.md` §11 target 2 should be read against — 19.2, not 21.7. The
per-bucket table below was always controlled this way, which is why it has read so much better than
the headline margin for three phases.

### What the curve looks like now

| bucket | FAV%W r/s | FAV PTS r/s | DOG PTS r/s |
|---|---|---|---|
| spread 0–3 | 55 / 57 | 27.4 / 25.5 | 25.9 / 23.2 |
| spread 10.5–14 | 91 / 88 | 34.5 / 33.9 | 19.4 / 16.3 |
| spread 24–31 | 99 / 99 | 42.8 / 44.9 | 10.1 / 9.6 |
| spread 31+ | 100 / 100 | 50.1 / 52.0 | 8.1 / 7.3 |

Favourite win rate tracks almost bucket for bucket, and favourite points are close. **The residual is
the underdog: it scores 2–3 points too few in every bucket.** That, not the favourite running away, is
what is left of the margin.

### The scoreboard lean, retested and held

`PM.lean` is the one lever Phase 53 found that improved tail, skew and margin together. Retested at
step 4's model state it buys **play-mix realism and not scoring**: a big underdog's carries fall 36.8 →
35.2 at lean 0.26 (real 31.8) and its pass attempts rise 19.4 → 20.6 (real 28.5), while its points and
the average margin barely move. Even 0.36 only reaches 33.9 carries — so the underdog's play mix is
mostly that it gets fewer snaps at all, and the margin gap is definitely not this.

Held at **0.16** rather than the 0.26 the measurement implies. Step 4's clock re-anchor cleared the
Phase 49 discipline tension that originally capped it (5.25 vs 5.58 flags, inside tolerance), but 0.26
deterministically trips a qa actionability failure on the program page — no JS exception, element
visible, enabled, stable and un-overlaid — which is unexplained and wants its own investigation.
Recorded rather than worked around, because the measured trade is small either way.

---

## 6. Constants re-anchored

Every one of these was **fitted**, not measured, and the model underneath it changed.

| | from | to | why |
|---|--:|--:|---|
| `PM.hfa` | 3.6 | 6.0 | home field rode on `adv`, and Phase 53 stopped `adv` adding yards to every snap — 3.6 bought a 51.7% home win rate against a real 58.8% |
| `PM.secRun`/`secPass` | 32/30 | 30/28 | §1(c) |
| `PM.intRate` | 0.068 | 0.060 | the pressured throw carries its own multiplier now |
| `AT.pushStr`/`pushAwr` | 0.55/0.45 | 0.85/0.30 | the goal-line cap takes yardage from the floor builds that earn it; simlab's build-vs-build spread had gone to 18pp (str 75 vs awr 93) and is back to 3pp |
| `AT.escPrs` | 0.28 | 0.16 | sack concentration — an elite rusher is both picked first and harder to escape, which compounds past the leader band |

`PM.hfa` is left short of what would reproduce the real home win rate: raising it keeps helping the
win rate and keeps widening an already-too-wide margin (hfa 10 gives 59.0% home and a 21.0 margin
against a real 16.2). The stakes-scaled version `cfb-averages.md` §5 recommends — 2.5 in a nothing
game, 4.8 when both teams are ranked — is the right shape and is not built.

---

## 7. Where it landed

| | real | P53 | step 4 |
|---|--:|--:|--:|
| points / team | 26.9 | 22.8 | **25.5** |
| points / team, standardized | 26.9 | — | 25.1 |
| avg margin | 16.2 | 20.6 | 21.7 |
| avg margin, standardized | 16.2 | — | 19.2 |
| plays | 67.5 | 64.2 | **67.9** |
| total yards | 383 | 389 | **381** |
| yards / play | 5.67 | 6.03 | **5.62** |
| yards / carry | 4.27 | 4.85 | **4.53** |
| completion % | 61.1 | 61.5 | 61.6 |
| sacks | 2.06 | 2.02 | **2.07** |
| turnovers | 1.38 | 1.36 | **1.44** |
| fumbles lost | 0.56 | 0.54 | **0.58** |
| 4th-down attempts | 1.94 | 1.39 | 1.71 |
| red-zone TD % | 67.5 | — | **69.8** |
| excess kurtosis | +0.319 | +0.062 | +0.064 ±0.039 |

## 8. Open

1. **The underdog scores 2–3 points too few in every bucket.** The whole remaining margin gap, and
   not the scoreboard lean (§5).
2. **The tail is untouched** at +0.064. Phase 53 §4 established that compounding contests do not
   deliver it and that game-state feedback is the only orthogonal lever found; one `lean` term is the
   smallest possible version of that, and clock management, timeouts, onside kicks, four-down
   territory and prevent defence are all still unmodelled.
3. **Third-and-long.** The sim faces 3.24 third-and-11+ against a real 2.40 and 0.99 third-and-1
   against 1.51, and it is *not* per-play variance (§3) — the cause is upstream and unidentified.
4. **Pass share 49.2% against ~53%**, compositional rather than a calling error (§4).
5. **Punts 4.98 against 4.32, FG attempts 1.36 against 1.58.**
6. **Penalties 5.2 against 6.0.** Phase 49 fitted 6.01 on a per-snap rate against a play count that
   has now changed twice; re-fit per snap.
7. **`17-simclutch.js` should be re-run** rather than trusting Phase 53's linear extrapolation of
   `PC.cmp`.
8. **The qa actionability failure at `lean` 0.26** (§5).

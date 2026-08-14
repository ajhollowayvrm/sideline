# Phase 53 — play resolution as sequential contests (attributes-2.md step 3b)

> **Status: SHIPPED.** `SIM_MODEL` 8, save version unchanged at 48 (nothing in the save shape moved).
> The pass, the run and turnovers are rebuilt as sequences of contests with a real intermediate state.
> The measured envelope held, the mismatch RESPONSE came in a long way, and **the tail did not move**.
> That last result is the most useful thing in this document, and §4 is why.

This is step 3b of the sequencing in `attributes-2.md` §10 — the architectural inversion §1 asks for.
Steps 4 (calibration to the eight-bucket curve) and 5 (the new gates) remain.

---

## 1. What the model was, and what it is now

Phase 52 resolved a snap by **adding mean-zero deviations to a fitted constant**. One sack roll, one
completion roll, `padv × PM.advPass` yards on every completion, four separate attribute coefficients
added straight into a probability. Two consequences the measurements kept returning to:

- it is Gaussian by construction, and
- team strength pressed **linearly on every snap**, which is what answered a 31-point spread with a
  55-point favourite against a real 50.

### The pass

```
protection  AUX(OL pbk, awr vs rush prs) + QB iq   -> PRESSURE, a real per-snap STATE
  pressured -> escape: elu/agi/str/btk/awr vs the rusher's prs
                 -> sack (measured PM.sackQ), or out of the pocket -> scramble / throw on the run
separation  rte vs mcv|zcv, + agi, spd (depth-weighted), acc   -> ONE quantity, in rating points
completion  logit(measured situation) + sepZ·sep + cpZ·catch + accZ·tha + advCmpZ·padv
            − accPress when pressured (+ tor buys it back)
yardage     the measured quantile table, entered at a percentile the contest bought (`regime`)
interception  f(tha, awr, iq, PRESSURE) vs f(cth, zcv)
```

Everything downstream reads the pressure state. That is where the compounding lives: a beaten line
does not merely give up sacks, it degrades the throw, shortens the read, and costs the route the time
it needed to come open.

Two layering rules, both load-bearing:

- **Measured situational effects stay additive in probability** — the space they were measured in — so
  Phase 49's and Phase 50's fits are not silently re-scaled by a logit round trip. The MATCHUP composes
  in log-odds, so two edges on one play compound instead of averaging.
- **A contest buys a distribution, not a constant.** `regime(u,e)` reshapes the uniform draw that
  indexes Phase 48.1's measured table. Winning does not add yards to every snap; it moves you up the
  table, so an edge shows up as explosive plays rather than as a uniformly longer completion.

### The run

```
push    rbk + str + awr (OL) vs rst + str (front)   -> a UNIT contest, constant all game
crease  agi + acc (RB) vs the DEFENDER's awr + tkl
break   elu vs tkl, btk vs tkl
-> push and break lift the FLOOR (floorAdd); crease selects the REGIME; speed owns the TAIL (tailAdd)
```

which is §9a applied literally. Phase 52 added agility and elusiveness **flat across the whole draw**,
which §9a forbids — neither may raise the floor and the tail alike.

### Three §7 items that were simply missing

Awareness in the push, awareness as **blitz pickup** in the protection contest, and the **defender's**
`awr`/`tkl` (not his agility) against the crease. Their absence is why an awareness build lost simlab's
build-vs-build check 73% to speed's 90%: §9a gives awareness the floor, and the run had no offensive
floor channel for it to reach. With them wired: spd 90 / str 82 / awr 93.

### The scoreboard

Phase 52's play-calling read down, distance and team strength and **never the score**, so a team down
21 in the fourth called the game it would have called tied. Trailing teams now throw and leading teams
run, harder as the clock goes. See §4 — this turned out to matter for more than realism.

---

## 2. What shipped measured

16,080 games (`WORLDS=8`), against the same tool run on the Phase 52 build.

| | real | P52 | P53 |
|---|--:|--:|--:|
| points / team | 26.9 | 22.8 | 22.8 |
| avg margin | 16.2 | 20.6 | **20.0** |
| points / drive | 2.28 | 1.86 | 1.88 |
| completion % | 61.1 | 61.6 | 61.5 |
| yards / attempt | 7.29 | 7.46 | 7.68 |
| yards / carry | 4.27 | 4.61 | 4.85 |
| rush attempts | 36.3 | 34.8 | **36.8** |
| sacks | 2.06 | 1.96 | 1.98 |
| turnovers | 1.38 | 1.34 | **1.36** |
| interceptions | 0.82 | 0.87 | **0.82** |
| fumbles lost | 0.56 | 0.40 | **0.54** |
| skew | +0.130 | −0.019 | −0.008 |
| excess kurtosis | +0.319 | −0.005 | **+0.062 ±0.039** |

**The mismatch response is the result the headline margin hides.** `cfb-averages.md` §3's curve is what
step 4 exists to fit, and most of it arrived early:

| bucket | FAV%W r/s | FAV PTS r/s (P52 → P53) |
|---|---|---|
| spread 0–3 | 55 / 58 | 22.5 → 23.1 (real 27.4) |
| spread 10.5–14 | 91 / 88 | 30.1 → 30.2 (real 34.5) |
| spread 24–31 | 99 / 99 | 45.2 → 41.4 (real 42.8) |
| spread 31+ | 100 / 99 | **55.5 → 48.0** (real 50.1) |

Phase 52 answered a pick'em with 22.5 and a 31-point mismatch with 55.5 — a ratio of 2.47 against
real football's 1.83. Phase 53 runs 23.1 → 48.0, a ratio of 2.08, and the favourite win rate now
tracks the real curve almost bucket for bucket. **What remains is a scoring LEVEL problem, not a
response-SHAPE problem**, and the level is exactly what step 4 owns.

Two fumbles were fixed by finding what wasn't there: interceptions did not read the pressure state,
and there was no fumble after the catch at all — carries and strip sacks only, which is most of why
fumbles lost sat at 0.40.

---

## 3. Constants re-anchored, and why that is not cheating

`cmpBase` 0.6200 → 0.6560, `intRate` 0.068 → 0.060, `PC.cmp` 0.0340 → 0.0730. Each of these is a
**fitted** constant, not a measurement: each was fitted so that a model produced the measured league
figure, and this phase changed the model underneath them. The pressured throw now carries its own
accuracy and interception penalties, so the pre-pressure bases must fall for the league to still land
on 61.1% and 0.82.

`PC.cmp` is the instructive one. Phase 50 fitted it so the sim's Q4-within-one-score bucket reproduced
the real one. Under Phase 53 the realised drop measured **0.60pp against its 3.25pp target**, for two
separate reasons — it was being folded into the pre-logit base, where a fixed probability shift does
not survive the round trip once matchup terms move `z`, and score-aware play-calling offsets it by a
further ~1.1pp because *who throws in the clutch is no longer the same population*. Both fixed;
realised drop is now 3.16pp. `17-simclutch.js` should be re-run properly in step 4 rather than
trusting the linear extrapolation used here.

`PM.advPass` / `PM.advRun` are **retired**, which is the phase in one line.

---

## 4. The tail: what actually happened, and what it costs §1 to be wrong

`attributes-2.md` §1 predicted that compounding contests would fix the tail:

> The fat tail is not a knob to tune back in; it is a consequence of no longer flattening it.

**Measured, it is not.** Excess kurtosis went −0.005 → +0.062 (±0.039) — around one sigma, on a target
of +0.319. The rebuild is worth having for other reasons, but this specific prediction did not hold,
and the phase produced enough measurement to say *why*.

### 4a. Per-play variance cannot fatten a game-level tail

`shapeVol` reads a roster's boom-or-bust construction — §9a's tail attributes minus its floor
attributes — and feeds the `compReshape` exponent, mean-preservingly. It is exactly what §9a proposes,
and swept across a **5× range** it does nothing:

| volK | 0.075 | 0.15 | 0.25 | 0.40 |
|---|--:|--:|--:|--:|
| excess kurtosis | 0.006 | 0.027 | −0.020 | 0.024 |

The arithmetic says why, and it should have been done first. A mixture of normals needs a **variance
ratio near 2** to carry +0.32 of excess kurtosis. Per-play variance shaping moves one component of a
team's game variance by ±20%. That is worth about 0.02. The mechanism is real and far too small, and
no amount of tuning reaches the target through it.

### 4b. Persistent beats per-play — but every persistent lever is also a margin lever

Per-play independent terms Gaussianize a team's total by the central limit theorem; **persistent
per-game properties are what create variance heterogeneity between games.** Measured both ways:
`regMatch` 0.006 → 0.010, a per-play matchup term, cost 0.11 of kurtosis on its own.

The trouble is that every persistent property available — the protection contest, the push contest —
is a **unit contest correlated with team quality**, so it buys tail and margin together. Measured:
`floorPush` 1.30 → 0.65 moved the average margin 22.1 → 20.4 and took the tail with it. Same knob,
both effects, and the margin is already 24% too wide.

### 4c. The one lever that is persistent AND orthogonal to quality

Behaviour that changes with the **score**. Adding it moved kurtosis 0.006 → 0.062, skew −0.026 →
+0.004 and the margin 19.9 → 19.4 *together* — the only lever found that improves all three, because
it varies with the game situation rather than with how good anyone is.

**So the steer for step 4 is: the tail lives in game-state feedback, not in compounding contests.**
One `lean` term on pass rate is the smallest possible version of that. Real football has far more —
clock management, timeout usage, onside kicks, four-down territory when trailing, prevent defence,
garbage time. `cfb-averages.md` §6's proposal to fake the mixture on a per-game `form` term was
rejected as "an invented mixture with no cause"; game-state feedback is the same shape of mechanism
**with** a cause, and it is where the remaining 0.26 should be sought.

`lean` is deliberately held at 0.16 rather than the 0.26 the real 65/35 split implies, because above
that it starts moving constants other phases fitted — at 0.26 the leading team's extra snaps push
Phase 49's flat-discipline check to 0.52 flags against a 0.5 tolerance. Real effect, real cause,
and it belongs in a calibration pass rather than here.

---

## 5. The measurements this phase had to fix first

Four defects in the harness, all of which changed what the phase was aiming at.

**Excess kurtosis was being read at one sigma.** Its standard error is ~√(24/n); at the profiler's
default 2,010 games that is **±0.11** — the same size as the effects being measured. A five-way sweep
of run-family settings produced kurtosis from −0.162 to +0.088 with no setting meaningfully different
from any other, and the pass rebuild appeared to measure +0.250 when the true figure was +0.014.
`WORLDS=n` now pools independent leagues on the same slate (`WORLDS=8` → 16,080 games, SE ±0.039), and
skew and kurtosis print with their standard errors.

This is **not** done by widening the slate: opponents are drawn by wrapping through a
prestige-ORDERED list, so `SLATE=100` has every team playing far more mismatched opponents than
`SLATE=15`. Measured, it moved points 23.0 → 23.5 and residual SD 15.3 → 16.3 — it changes the
matchup distribution rather than adding sample.

> **This revises `attributes-2.md` §12.** Its claim that Phase 52 moved the tail −0.154 → +0.037 and
> "closed ~40% of the gap with no knob touched" rests on a difference of 0.19 against an SE on that
> difference of ~0.15 — about 1.2 sigma. The corrected tool puts Phase 52 at **−0.005 ±0.039**. The
> archetype mixture's effect on the tail is not established.

**Yards per carry was compared gross-against-net.** The real side reads ESPN
rushingAttempts/rushingYards, which fold sacks in as negative rushes; the sim excluded sacks from
attempts, netted sack yardage out of the numerator only, and computed `ypc` gross over sack-free
attempts.

> **This revises `attributes-2.md` §11.** "Y/C from 5.20 to 4.27, the largest remaining per-play
> error" is named as one of three step-4 calibration targets. It was mostly this bug — Phase 52's
> true figure is **4.61 against 4.27**, an 8% error, not 22%. The two targets that survive intact are
> the scoring aggregate and the margin.

**Sacks were order-corrupted.** `s.sk = o.sk` overwrote home's count first, so away then read the
already-overwritten value and both teams ended up with the away defense's total — which also fed
`plays`. It destroyed the team-to-team spread in every sack figure while leaving the league mean
roughly right, so it never looked wrong.

**The end-of-half drive had no bucket.** Phase 48 models it; `dEND` was hardcoded to 0, so the sim's
drive-outcome shares summed to 92% and the row read as a −100% MISS against correct behaviour.

`18-sweep.js` is new: patch named constants in a copy of `index.html`, profile it, print one row per
setting. It refuses an unknown constant name, and it prints the kurtosis SE in its header with a
warning when the sample is too small to read — because that is the mistake this phase actually made.

---

## 6. Gate defects this phase uncovered

**simlab's world had no safeties.** Phase 52 split `S` into FS/SS in the game and in `4-simprofile`,
but never in `test/simlab.js`, which kept generating eight `S`. An unknown position code falls back to
a **linebacker's** row in `posAttrW`, and `S` appears in none of the FS/SS pool entries — so the
primary sim gate had been validating a league whose safeties carry a linebacker's attributes, cover
nobody and tackle nobody. Fixing it exposed three more stale `S` lists that were passing only while a
safety happened not to win, and the fact that the Phase 24 block still made players good by **writing
`ov`** — the thing Phase 51 retired, and which simlab's own line 235 warns about.

**Four checks were measuring noise rather than their effect.** Every one was found by this phase
changing something they were too small to see:

| check | was | true effect |
|---|---|---|
| Phase 46 FG on any down | n=1 (seed 77: 4 vs 5 FGA) | 8.39 vs 3.06 FGA/g |
| Phase 31 heavy package | n=40 on points/game (SD ~15) | **+3.08** pts/g, read as 32.5 vs 32.6 |
| Phase 24 pep-talk | n=1 | 55.1 → 45.9 rec yds/g |
| Phase 29 AI DC | n=200 seeds but ONE matchup | −1.41 pts vs all-pass, +0.25 vs balanced |

The AI DC one is the general lesson: **seeds cannot average out what does not vary between them.**
qa's version had 240 games across six matchups and simlab's had 200 across one, and during this phase
they flipped sign in *opposite* directions. simlab's now spans eight matchups and owns the direction;
qa asserts wiring, which is all six pairings can honestly support.

And it found two live regressions the gates then caught: the Phase 24 pep-talk had nearly stopped
working (a boost only ever reached `matchEdge`, and under Phase 51's model ability IS attributes, so
it now lifts the channels), and Phase 50's clutch effect had collapsed (§3).

---

## 7. What step 4 inherits

1. **The scoring level.** 22.8 vs 26.9, unchanged by this phase. Drives don't finish: punts 41.2% of
   drives against 35.3%, turnover-on-downs 4.5% against 7.2%, 4th-down conversion 38.0% against 52.4%.
   The mismatch response is close to right now, so this is a level problem and the eight-bucket fit
   should mostly follow from fixing it.
2. **The tail, via game-state feedback** — §4c, not more compounding.
3. **The underdog throws far too little.** Dog pass attempts fall 27.8 → 18.7 across the spread
   buckets where real ones fall 32.1 → 28.5, while dog rush attempts stay flat at ~35. A beaten team
   in this sim runs the ball, and real beaten teams do not.
4. **Penalties at 4.9 against 6.0.** Phase 49 fitted 6.01 on a per-snap rate and the sim now runs
   fewer snaps than real football (64.2 vs 67.5); the rate should be re-fitted per snap, not per game.
5. **Re-run `17-simclutch.js`** rather than trusting §3's linear extrapolation of `PC.cmp`.
6. **Phase 49's flat-discipline rule is in tension with drive sustainability** — better teams run more
   snaps and take more per-snap fouls, which real football does not show. §4c's `lean` is capped by it.

# Big moments in real college football, measured

Third companion to `cfb-averages.md` and `cfb-penalties.md`, same sample: **3,944 FBS-vs-FBS games,
2021–2025**, ESPN box-score and play-by-play. Reproduce with `tools/cfb-data/16-clutch.js` (real)
and `17-simclutch.js` (where the sim sits).

This sheet exists because "clutch" is the single most-assumed and least-verified idea in sports
modelling. Two questions had to be answered separately, and they point in opposite directions.

---

## 1. Is clutch a repeatable trait? No.

**38.4% of all FBS games are decided by 8 points or fewer** — this is not a rare edge case, it's more
than a third of the sport. So whatever governs close games governs a lot of seasons.

Year-over-year repeatability, season N → N+1:

| | r |
|---|--:|
| Overall win% | **0.458** |
| Blowout win% (margin > 8) | **0.482** |
| **One-score win% (margin ≤ 8)** | **0.078** |

And within a single season, a team's blowout win% barely predicts its one-score win%: **r = 0.193**.

**Being good repeats. Winning close games does not.** A team that went 6–1 in one-score games tells
you almost nothing about what it will do next year — the correlation is a sixth of the one for
blowouts. This is the same result the analytics literature finds in baseball one-run records and NFL
close-game records, and it is the central constraint on any clutch model:

> **A rating must not be allowed to systematically decide close games.** Doing so models a "clutch
> team" that the data says does not exist.

How much room does r = 0.078 leave? With ~5 close games a season, binomial noise alone has an sd of
~22 points of win%, so r = 0.078 implies a *true* team-level sd of roughly 6 points — and part of
even that is ordinary team quality (the 0.193 above), not clutchness. The honest budget for a
clutch-specific effect is a couple of points of one-score win%, at most.

---

## 2. Does the situation change the football? Yes.

Per-play splits. **"Clutch" = 4th quarter or overtime, within one score. "Crunch" = that, inside 5
minutes.**

| bucket | plays | cmp% | Y/A | sack% | int% | Y/C | fum% | 3rd% | FG% |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| everywhere else | 471,629 | 61.7% | 7.18 | 5.94% | 1.64% | 5.13 | 0.99% | 40.2% | 75.9% |
| clutch | 53,102 | 58.1% | 6.82 | 5.93% | 1.82% | 4.54 | 1.12% | 38.1% | 75.7% |
| crunch | 22,138 | 55.6% | 6.39 | 5.45% | 2.13% | 3.85 | 1.14% | 34.7% | 73.4% |
| …offense ahead | 28,300 | 62.0% | 7.30 | 5.48% | 1.36% | 4.30 | 0.87% | 38.1% | 79.0% |
| …offense behind | 24,802 | 55.6% | 6.49 | 6.22% | 2.13% | 4.98 | 1.58% | 38.1% | 68.4% |

### The confound, and why it doesn't explain it

Trailing teams throw on 3rd-and-long, so the clutch bucket has a different down/distance mix. That
mix has to be removed before any of this can be believed — and a sim that already models down and
distance would double-count it. Re-weighting every clutch cell by the **normal** bucket's
down/distance mix:

| | cmp% | Y/A | Y/C |
|---|--:|--:|--:|
| everywhere else | 61.7 | 7.18 | 5.13 |
| clutch, standardized | 58.4 | 6.84 | 4.57 |
| crunch, standardized | 56.1 | 6.41 | 3.95 |
| **clutch − normal** | **−3.25** | **−0.34** | **−0.56** |
| crunch − normal | −5.55 | −0.77 | −1.18 |
| *(raw, unstandardized)* | *−3.52* | *−0.36* | *−0.59* |

The standardized numbers are within 8% of the raw ones. **The tightening is real** — situation mix
explains almost none of it.

### Yards per completion do not fall

Worth isolating, because it changes what a model should do. Normal: 7.18 Y/A at 61.7% = **11.64
yards per completion**. Clutch: 6.84 at 58.4% = **11.71**. Identical.

**The entire Y/A drop is the completion-rate drop.** Passes are harder to complete late; the ones
that are completed go just as far. Charging a yardage penalty *and* a completion penalty would
double-count the same effect.

### Turnovers rise

Interceptions go from 1.64% of attempts to 1.82% (clutch) and 2.13% (crunch) — a ratio of **1.30**.
Fumbles rise from 0.99% to 1.14%. *(The absolute INT baseline here undercounts — ESPN types some
interceptions outside the set this harvest matches, and `cfb-averages.md` puts the real rate near
2.6%. The **ratio** is what's usable, and a proportional undercount leaves it intact.)*

### Sacks don't move

5.94% → 5.93% in the clutch. Nothing there.

---

## 3. Kickers do not choke

The most-repeated clutch claim in football, and it is not in the data. Raw FG% looks like it
collapses for trailing teams (79.0% ahead vs 68.4% behind) — but trailing teams attempt *longer*
kicks. Controlling for distance:

| bucket | <30 | 30s | 40s | 50+ |
|---|--:|--:|--:|--:|
| everywhere else | 92.1% (2,912) | 81.1% (3,326) | 65.7% (3,266) | 49.1% (1,160) |
| clutch | 91.1% (440) | 81.2% (467) | 63.8% (453) | 51.5% (165) |
| crunch | 91.7% (205) | 76.9% (234) | 62.7% (241) | 53.0% (100) |

Flat at every distance, and 50+ yarders are made *more* often under pressure (small samples, but
certainly not less). **A pressure penalty on field goals would be inventing an effect.** Overall
clutch FG% is 75.7% against 75.9% everywhere else.

---

## 4. Where `simEngine` sits

Phase 50 is fitted to this sheet; design record in `docs/phases/clutch.md`, constants in the fenced
`PC` block. Measured by `17-simclutch.js` over a 2,010-game slate.

**The situation**, standardized the same way:

| | Sim | Real |
|---|--:|--:|
| clutch completion % | **−3.45** | −3.25 |
| clutch Y/A | −0.41 | −0.34 |
| clutch Y/C | **−0.52** | −0.56 |
| INT rate ratio | ~1.27 | 1.30 |

*(Y/A runs slightly heavy because the sim's average completion is longer than real football's —
12.5 yards against 11.6 — a pre-existing gap, not a clutch effect. The engine charges no yardage
penalty at all; this is purely the completion drop propagating.)*

**The constraint** — controlled experiment, identical rosters, composure the only difference,
home/away alternated so home field cancels:

| composure spread | overall win% | points | one-score win% |
|---|--:|--:|--:|
| **42 vs 59** (what the league actually produces) | 53.9% | 21.0 v 19.3 | **50.1% ±1.0** |
| 12 vs 88 (absurd — shows the mechanism) | 72.5% | 26.3 v 16.8 | 55.8% ±1.1 |

At the composure spread real rosters produce, **composure moves one-score win% by 0.1 points**. The
model reproduces the measured "no clutch teams" result rather than contradicting it.

The absurd row is not a target — and note that almost all of it is the **pre-existing Phase 10
consistency edge** (steady players sustain drives), not the clutch terms. Turning Phase 50 off
entirely *raises* that row's one-score win% from 55.8% to 58.9%, because amplified variance in big
moments helps whoever is trailing. The clutch model pushes close games **toward** the coin flip.

---

## Reproducing

```
node tools/cfb-data/16-clutch.js             # real (harvests pbp, resumable)
node tools/cfb-data/16-clutch.js --no-fetch  # re-report from clutch-cache.json
node tools/cfb-data/17-simclutch.js          # where simEngine sits, incl. the controlled experiment
```

Writes `clutch-profile.json`, `clutch-report.txt`, `simclutch-report.txt`. Research tools, not
gates — the shipped assertions live in `test/simlab.js`.

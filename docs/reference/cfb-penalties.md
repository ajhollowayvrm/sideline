# Penalties in real college football, measured — the tuning target for discipline

Companion to `cfb-averages.md`, same sample and same spirit: **3,944 FBS-vs-FBS games, 2021–2025**,
pulled from ESPN's public box-score and play-by-play endpoints. Reproduce with
`tools/cfb-data/13-penalties.js` (real) and `14-simpens.js` (what `simEngine` currently does).

This is a **reference document, not a spec**. It exists so that a penalty phase is fitted to
measured football instead of to feel — the same discipline Phase 48 applied to the possession model.

**Two layers, two sample sizes.** The top line (counts, yards, team spread) comes from the box
score and covers all 7,888 team-games. The *mix* (which flag, when, on whom) comes from the
play-by-play, which logs **9.56 penalties/game against the box score's 11.95 — 80% coverage**. The
missing fifth is mostly kick-game fouls and flags ESPN folds into a play's text without a separate
penalty event. So: **shares are trustworthy, per-game rates derived from them are a floor.** To
convert a share to a per-team-game rate, multiply by 5.98 (assumes the missing fifth is distributed
like the logged four-fifths — roughly true for scrimmage fouls, not for special teams).

---

## 1. The top line — per team, per game

| | | | |
|---|---|---|---|
| **Penalties** | **5.98** (sd 2.81) | **Yards** | **52.4** (sd 26.7) |
| Median | 6 | Yards per penalty | 8.76 |
| p10 / p90 | 3 / 10 | p10 / p90 yards | 20 / 88 |
| Max seen | 18 | Max yards | 216 |
| Per drive | 0.50 | Per own scrimmage play | 8.9% |

**Both teams combined: 12.0 penalties for 105 yards a game.**

Distribution of a single team-game's flag count:

| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13+ |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 0.8% | 2.6% | 5.7% | 9.8% | 12.9% | 15.1% | 14.1% | 12.2% | 9.1% | 6.6% | 4.5% | 2.8% | 1.7% | 2.0% |

A clean game (≤2 flags) happens **9.1%** of the time; a sloppy one (≥10) **11.1%**. The shape is
right-skewed — the floor is near zero, the ceiling is not.

**Stable across the era.** 2021 6.13 · 2022 5.99 · 2023 5.82 · 2024 5.96 · 2025 6.00. No trend
worth modelling.

**Quality doesn't buy discipline.** Top-10 teams 5.87, ranked 11–25 5.95, unranked 5.99. A
three-hundredths-of-a-flag edge for the best teams in the country. **Penalties are not a proxy for
being good** — which means the sim must not let prestige or OVR leak into the flag rate.

**Home vs road** — home 5.81, road 6.15. The road premium is real but small: **+5.7% flags, +2.8%
yards.** (The play-by-play agrees independently: 51.1% of flags go against the road team.)

---

## 2. Team discipline — the spread a composure rating has to span

This is the section that matters for tuning. Over **664 team-seasons** (≥8 games):

| | pen/game |
|---|--:|
| Mean | 5.99 |
| p05 | 4.08 |
| p25 | 5.23 |
| Median | 5.92 |
| p75 | 6.83 |
| p95 | 7.92 |
| **Full range** | **2.42 – 9.83** |

- **Observed season-to-season sd: 1.20.** But a 12-game season is a small sample, so some of that
  is noise. Game-to-game sd *within* a team-season is **2.54**; shrinking that out leaves a
  **true team-level sd of 0.95**.
- **Only 12.2% of the variance in any single team-game is the team.** The other 88% is that night —
  the crew, the script, the situation. A disciplined team still has 10-flag games.
- **Least-disciplined quintile 7.68 vs most-disciplined 4.32 — an observed gap of 3.37 flags/game.**
- **Discipline is a repeatable trait: year-over-year r = 0.464** (528 team-pairs). That is a strong
  correlation for a team stat, and it is the empirical licence for driving penalties off a
  persistent player attribute at all. Scheme, coach and personnel carry over; the flag rate follows.

**The target, stated once:** a team's *expected* rate should span roughly **4 to 8 penalties/game**
across the league (sd ≈ 0.95 around a mean of 6.0), with a **within-team game-to-game sd near 2.5**
sitting on top of it.

---

## 3. Is a penalty a player property?

Player-name extraction succeeds on 59.2% of logged flags, so read these as indicative:

- Across 296 team-seasons with enough named flags: **21.8 different players** are flagged in a
  season. The **most-flagged player accounts for 24.4%** of his team's flags; the **top three for
  41.8%**.
- **False starts alone** (the pure pre-snap foul, 332 team-seasons, ~90% name coverage — the best
  measured slice here): **6.7 different offenders** per season, and **the worst one commits 44.7%
  of his team's false starts**, the top three **71.4%**.

So a team's penalty problem really is a *few specific guys*, concentrated in the pre-snap fouls —
exactly the shape a per-player composure term produces. It is not a uniform tax spread evenly
across the roster.

---

## 4. The mix — which flags actually get thrown

Share of logged penalties, with the offense's share of them and how often each yields a first down.
**Per tm-gm** is the share scaled to the 5.98 box-score average.

| Penalty | Share | Per tm-gm | Avg yds | On offense | → 1st down |
|---|--:|--:|--:|--:|--:|
| **False Start** | **26.3%** | 1.57 | 4.9 | 100% | 0% |
| **Holding (mostly offensive)** | **18.1%** | 1.08 | 7.6 | 88% | 17% |
| **Pass Interference** (side unstated) | **11.8%** | 0.71 | — | 12% | 88% |
| **Offside / Encroachment / NZI** | **9.1%** | 0.54 | 4.4 | 3% | 24% |
| Delay of Game | 6.3% | 0.38 | 4.8 | 90% | 3% |
| Personal Foul / Unnecessary Roughness | 6.1% | 0.36 | 12.9 | 35% | 60% |
| Illegal Formation / Shift / Motion | 3.6% | 0.22 | 3.4 | 98% | 1% |
| Unsportsmanlike Conduct | 3.3% | 0.20 | 12.5 | 49% | 41% |
| Face Mask | 2.5% | 0.15 | 12.8 | 15% | 83% |
| Ineligible Downfield / Illegal Touching | 2.4% | 0.14 | 2.2 | 100% | 1% |
| Roughing the Passer | 2.2% | 0.13 | 13.9 | 1% | 95% |
| Illegal Substitution / 12 Men | 2.0% | 0.12 | 4.4 | 42% | 16% |
| Defensive Pass Interference (explicit) | 1.4% | 0.08 | 11.7 | 1% | 96% |
| Illegal Block / Clip / Blindside | 0.9% | 0.05 | 10.2 | 90% | 5% |
| Defensive Holding (explicit) | 0.8% | 0.05 | 8.0 | 7% | 85% |
| Intentional Grounding | 0.8% | 0.05 | 2.5 | 99% | 0% |
| Targeting | 0.6% | 0.04 | 13.8 | 3% | 95% |
| Roughing / Running into Kicker | 0.4% | 0.02 | — | 1% | 67% |
| Offensive Pass Interference (explicit) | 0.3% | 0.02 | 10.4 | 93% | 3% |
| Horse Collar · Illegal Use of Hands · misc | ~0.5% | 0.03 | — | — | — |
| *Unclassified* | 0.8% | 0.05 | 7.1 | 65% | 25% |

Notes on reading this table:

- **The generic "Pass Interference" bucket is 88% defensive** (12% on offense, 88% yield a first
  down), so DPI is really ~11.8% of all flags — the third-most-common penalty in the sport, not the
  1.4% the explicitly-labelled row suggests (OPI is ~1.7%). Same logic for holding: the generic
  bucket is 88% offensive, so offensive holding is ~16% of flags and defensive holding ~3%.
- **The top four penalties are 65% of everything**: false start, holding, pass interference, offside.
- **Average yardage is not the statutory yardage.** Offensive holding averages 7.6 assessed yards,
  not 10 — half-the-distance spots and declined-into-better-outcomes pull it down. Personal fouls
  average 12.9, not 15. `PM.penQ` in `index.html` already holds the measured penalty-yardage
  quantile table (from `12-quantiles.js`); **it is currently dead data — nothing reads it.**

**Pre-snap vs live-ball: 47.1% / 52.9%.** Just under half of college football's flags are dead-ball
fouls that never involve a snap. Broken out by side:

| | Offense | Defense |
|---|--:|--:|
| Pre-snap | ~37% of flags (**2.21**/tm-gm) | ~10% of flags (**0.61**/tm-gm) |
| Live-ball | ~24% (1.44) | ~22% (1.32) |

**The flagged team had the ball 61.1% of the time, was on defense 32.2%** (6.7% unattributed —
special teams and parse failures). Offenses get flagged roughly twice as often as defenses.

Expressed as the per-snap rates a play loop needs:

- **offense flagged: 5.4% per own snap** (of which pre-snap ≈ 3.3%)
- **defense flagged: 2.9% per opponent snap** (of which pre-snap ≈ 0.9%)

---

## 5. When flags happen

**By quarter** — Q1 22.2% · Q2 28.3% · Q3 23.9% · Q4 25.4%
**By down** — 1st 37.9% · 2nd 27.4% · 3rd 23.9% · 4th 10.8%

Both distributions track **snap volume**, not emotion. Q2 is the busiest quarter for flags because
it has the most snaps (two-minute drill), not because teams are angriest before half; Q4 is *not*
the peak. The 10.8% on 4th down matches 4th-down snap share (punts and field goals included).

**There is no measurable late-game frustration effect.** Any Q4 penalty multiplier is invention.

**28.8% of all penalties produce a first down — 1.37 per team-game.** That is the real cost
channel: not the yardage, the extended drive.

---

## 6. Does it actually cost you the game?

Barely, and this is the most commonly-overstated thing about penalties.

| Penalty differential | Team-games | Win % | Avg margin |
|---|--:|--:|--:|
| 5+ fewer than opponent | 815 | **54.0%** | +1.7 |
| 3–4 fewer | 1,086 | 51.0% | −0.4 |
| 1–2 fewer | 1,606 | 50.3% | +0.1 |
| Even | 874 | 50.0% | 0.0 |
| 1–2 more | 1,606 | 49.7% | −0.1 |
| 3–4 more | 1,086 | 49.0% | +0.4 |
| 5+ more | 815 | **46.0%** | −1.7 |

- Correlation of penalty-yard differential with point margin: **r = 0.047**.
- Correlation of a team's own penalty yards with its own points: **r = 0.098** (slightly *positive* —
  teams that run more plays and hold the ball longer collect more flags).
- Even the extreme bucket — five or more flags than your opponent — costs only **4 points of win
  probability**, and the margin column isn't even monotonic.

**Design consequence:** penalties should be *texture and frustration*, not a results lever. A model
that lets a sloppy team lose games it should win is wrong about real football. The 3.37-flag gap
between the most and least disciplined quintiles is worth roughly **1 point of margin**, and the sim
should keep it that cheap.

---

## 7. Where `simEngine` sits

Measured by `tools/cfb-data/14-simpens.js` over 2,010 synthetic games with real `genTraits()`
composure on every roster. **Phase 49 fitted the sim to this sheet** — the design record is
`docs/phases/penalties.md`, the constants are the fenced `PN` block in `index.html`, and
`15-penfit.js` reproduces the fit.

| | Real | Phase 49 | Phase 25 (before) |
|---|--:|--:|--:|
| Penalties / team-game | 5.98 | **6.01** | 7.37 |
| Penalty yards / team-game | 52.4 | **51.5** | 36.8 |
| Yards per penalty | 8.76 | **8.56** | 5.00 (flat) |
| Game-to-game sd | 2.54 | **2.63** | 2.71 |
| Distinct penalty types | 25+ | **22** | 2 |
| Pre-snap share | 49.1% | **48.9%** | 100% |
| False starts / team-game | 1.57 | **1.64** | 3.68 |
| Offside / team-game | 0.54 | **0.57** | 3.69 |
| Charged to offense / defense | 65% / 35% † | **65% / 35%** | 50% / 50% |
| Road premium | +5.7% | +2.6% | +10.5% |
| **True team-level sd** | **0.95** | **0.94** | 0.17 |
| Team-season p05 / p95 | 4.08 / 7.92 | **4.47 / 7.87** | 6.43 / 8.27 |
| Discipline quintile gap | 3.37 | **2.94** | 1.47 |
| Worst false-start offender | 44.7% | **45.1%** | n/a (no culprit) |

† The engine models no special teams, so the ~7% of flags this sheet can't attribute are folded
proportionally into the scrimmage families — which turns the raw measured 61/32 into 65/35.

The two remaining misses are small and understood: the road premium sits about 2σ of slate noise
below its constant, and the automatic-first-down share (26.1% vs 28.8%) is short by roughly the
special-teams fouls that aren't modelled. Both are second-order and deliberately not over-fitted.

Worth noting for future work: `PM.penQ` — a measured penalty-yardage quantile table produced by
`12-quantiles.js` — is still dead data. Phase 49 uses per-type measured averages instead, which
carry more information (a false start and a roughing call are different events, not two draws from
one pooled distribution).

---

## Reproducing

```
node tools/cfb-data/13-penalties.js            # real penalty averages (harvests pbp, resumable)
node tools/cfb-data/13-penalties.js --no-fetch # re-report from pen-cache.json, no network
node tools/cfb-data/14-simpens.js              # what simEngine currently throws
node tools/cfb-data/15-penfit.js [--apply]     # fit the PN block to the targets above
```

Writes `pen-profile.json`, `penalty-report.txt`, `simpen-report.txt`, `penfit-result.txt`. The play-by-play cache
(`pen-cache.json`) is ~3,900 games and rebuilds in about 80 seconds. Like the rest of
`tools/cfb-data/`, these are research tools, not gates — they are not wired into `npm test`.

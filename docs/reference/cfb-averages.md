# Real college football, measured — the tuning target for `simEngine`

Primary-source averages computed from **3,944 FBS-vs-FBS games, 2021–2025** (every completed
game in those five seasons where both teams were FBS). Pulled from ESPN's public box-score and
drive endpoints, extracted per team-game, and aggregated. Reproduce with `tools/cfb-data/`.

This is a **reference document, not a spec** — nothing here says the sim must hit every number.
It exists so that when a phase touches the sim, "is this football-shaped?" has an answer with a
number attached instead of a vibe.

**Sample discipline.** FBS-vs-FCS "buy games" are excluded — they'd pollute every mismatch bucket
with non-comparable opponents and inflate home-win%. Sacks are the one metric drawn from a subset:
ESPN only populates player-level defensive stats from 2024 on, so sack figures come from the
1,606-game 2024–25 slice. Everything else spans all 3,944.

---

## 1. National averages — per team, per game

| | | | |
|---|---|---|---|
| **Points** | 26.9 | **Total yards** | 383 |
| Total points/game | 53.7 | Plays | 67.5 |
| Avg margin | 16.2 | Yards/play | 5.67 |
| Home win % | 58.8% | First downs | 20.2 |
| Overtime % | 4.7% | Time of possession | 30:00 |

**Passing** — 31.2 att · 19.0 cmp · **61.1%** · 227 yds · **7.29 Y/A**
**Rushing** — 36.3 att · 155 yds · **4.27 Y/C**
**Run/pass split — 54% run / 46% pass by attempt.**

**Downs** — 3rd down **39.2%** · 4th down **1.94 attempts** at **52.4%**
**Disruption** — 1.38 turnovers (0.82 INT, 0.56 fumble lost) · 2.06 sacks · 6.0 penalties for 52 yds
**Special teams** — 4.32 punts @ 42.5 net · 1.58 FG att @ 75.8% · 0.05 return TD · 0.08 INT return TD
**Rare events (per game)** — 0.48 two-point attempts · 0.06 safeties

### Drives — the structural layer

**11.8 drives per team**, each **5.75 plays · 31.9 yards · 150 seconds**, worth **2.28 points**.

| Drive ends in | Share |
|---|---|
| Punt | 35.3% |
| Touchdown | 26.3% |
| Turnover | 10.7% |
| Field goal | 9.9% |
| Downs | 7.2% |
| **End of half/game** | **6.5%** |
| Missed FG | 3.0% |

### Late game

Average margin entering Q4 is **14.2**. The lead changes in Q4 in **12.6%** of games; a team down
10+ entering Q4 wins **2.4%** of the time.

---

## 2. By matchup — the better-ranked side (HI) vs its opponent (LO)

Rank is **as of kickoff** (AP, then CFP once it starts). `x/y` = HI value / LO value.

| Matchup | Games | HI win% | Points | Yards | Y/play | Rush att | Pass att | Turnovers | 3rd down% | 4th-down att |
|---|--:|--:|---|---|---|---|---|---|---|---|
| **No. 1 vs unranked** | 41 | **95.1%** | 37.2 / 13.8 | 460 / 264 | 6.94 / 4.35 | 35.4 / 31.3 | 30.9 / 29.3 | 1.22 / 0.88 | 51.4 / 30.8 | 1.02 / 2.05 |
| No. 1 vs ranked | 27 | 70.4% | 32.8 / 19.4 | 416 / 317 | 6.05 / 5.19 | 36.9 / 29.2 | 31.9 / 31.8 | 0.89 / 1.33 | 43.6 / 32.6 | 1.81 / 1.81 |
| Top-5 vs unranked | 187 | 93.6% | 38.2 / 14.7 | 447 / 286 | 6.72 / 4.54 | 35.9 / 32.8 | 30.7 / 30.3 | 1.06 / 1.43 | 47.2 / 31.6 | 1.36 / 2.06 |
| Top-5 vs No. 6–25 | 81 | 66.7% | 31.7 / 22.0 | 417 / 344 | 6.15 / 5.24 | 36.2 / 32.3 | 31.7 / 33.3 | 1.11 / 1.26 | 43.7 / 34.8 | 1.59 / 2.06 |
| **Top-10 vs Top-10** | 80 | **41.3%** | 26.5 / 25.5 | 387 / 363 | 5.69 / 5.49 | 33.7 / 34.3 | 34.3 / 31.8 | 1.35 / 1.07 | 38.6 / 36.8 | 1.85 / 1.88 |
| No. 6–10 vs unranked | 186 | 80.6% | 36.7 / 19.4 | 458 / 322 | 6.66 / 4.90 | 37.0 / 34.7 | 31.8 / 31.0 | 1.12 / 1.46 | 45.7 / 35.0 | 1.65 / 2.06 |
| No. 11–25 vs unranked | 618 | 76.9% | 34.0 / 21.3 | 433 / 344 | 6.31 / 5.18 | 37.9 / 34.0 | 30.8 / 32.4 | 1.11 / 1.55 | 44.0 / 35.3 | 1.67 / 2.19 |
| **Ranked vs ranked** | 285 | 55.1% | 28.9 / 24.7 | 407 / 369 | 5.92 / 5.54 | 35.6 / 34.3 | 33.2 / 32.3 | 1.31 / 1.38 | 41.7 / 36.9 | 1.79 / 2.09 |
| **Ranked vs unranked** | 991 | 80.7% | 35.3 / 19.7 | 441 / 329 | 6.45 / 5.01 | 37.3 / 33.9 | 30.9 / 31.7 | 1.10 / 1.51 | 44.9 / 34.5 | 1.60 / 2.14 |
| Unranked vs unranked | 2,668 | — | 26.6 (both) | 381 | 5.63 | 36.8 | 30.9 | 1.41 | 39.0 | 1.97 |

Two results worth flagging:

- **Top-10 vs Top-10 goes to the *lower*-ranked team 58.7% of the time.** Between genuine peers the
  ranking carries almost no signal. It isn't a venue artifact — the higher-ranked team is actually
  the *home* team more often than not in these games (24 of 80, vs 17 on the road). Half of them
  (39 of 80) are neutral-site bowl/playoff games, where the higher-ranked team wins just 35.9%.
  See §5 for the full breakdown; note the neutral-site cell is a thin sample and bowl opt-outs
  plausibly cost the more NFL-stocked roster more.
- **A No. 1 seed beating an unranked team is a 37–14 game, not a 50–3 game.** Blowouts in the poll
  sense are far more modest than intuition suggests. Even the largest bucket below tops out around 50.

---

## 3. By mismatch size — the shape of a blowout

Bucketed on |expected margin| from a retrodictive season rating (opponent-adjusted average scoring
margin, capped at ±28, home field 2.4). This is ≈ the point spread, and it maps directly onto the
sim's `adv` (a rating differential), which makes it the most directly usable table here.

| Spread | Games | Fav win% | Fav pts | Dog pts | Fav yds | Dog yds | Fav TO | Dog TO | Fav rush | Dog rush | Fav pass | Dog pass |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 0–3 | 731 | 55.3% | 27.4 | 25.9 | 392 | 383 | 1.41 | 1.48 | 36.8 | 36.2 | 31.8 | 32.1 |
| 3–7 | 906 | 67.7% | 29.8 | 23.6 | 408 | 366 | 1.24 | 1.53 | 38.4 | 35.2 | 30.7 | 32.6 |
| 7–10.5 | 631 | 78.1% | 31.8 | 21.5 | 415 | 352 | 1.12 | 1.62 | 38.5 | 34.3 | 29.6 | 33.0 |
| 10.5–14 | 539 | 90.5% | 34.5 | 19.4 | 426 | 330 | 1.00 | 1.80 | 39.2 | 33.2 | 29.2 | 33.1 |
| 14–17.5 | 425 | 93.6% | 36.8 | 18.0 | 444 | 322 | 1.02 | 1.71 | 38.4 | 33.4 | 29.0 | 32.6 |
| 17.5–24 | 427 | 97.4% | 39.5 | 14.7 | 465 | 292 | 0.98 | 1.69 | 39.9 | 32.6 | 28.1 | 31.7 |
| 24–31 | 210 | 99.0% | 42.8 | 10.1 | 490 | 246 | 0.97 | 1.63 | 39.2 | 31.6 | 29.4 | 29.6 |
| 31+ | 75 | 100% | 50.1 | 8.1 | 523 | 216 | 0.88 | 1.59 | 38.8 | 31.8 | 30.9 | 28.5 |

**The three signatures a sim has to reproduce:**

1. **The league aggregate barely moves; the split does everything.** Points *per team* stay in a
   26.4–29.1 band across every bucket, yards 368–390, plays 65–68.5. A 31-point mismatch is not a
   higher-scoring game — it's the same amount of football distributed 50–8 instead of 27–26.
2. **Both teams play the score, in opposite directions.** Favorites run more as the gap grows
   (36.8 → 39.2 carries) and throw less (31.8 → 28.5); underdogs do the reverse (36.2 → 31.6
   carries). At a 31-point spread the favorite runs it 7 more times than the underdog. In a toss-up
   the two are indistinguishable. **This effect is entirely game-state-driven — nothing about
   roster quality causes it.**
3. **The underdog's turnovers are the mechanism, not the margin.** Favorite turnovers *fall*
   (1.41 → 0.88) while underdog turnovers *rise* (1.48 → 1.80) and stay high. Blowouts are built on
   the trailing team giving it away, then having to press.

### Drive mix + drama, by mismatch

| Spread | TD% | FG% | Punt% | Downs% | TO% | Miss FG% | End-half% | \|M\| into Q4 | Q4 flip% | 10+ comeback% | OT% |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 0–3 | 25.6 | 10.8 | 34.7 | 6.8 | 11.3 | 3.2 | 6.5 | 9.5 | **18.9** | 3.1 | **7.9** |
| 3–7 | 25.7 | 10.5 | 35.2 | 7.2 | 10.7 | 3.3 | 6.3 | 10.5 | 18.0 | 3.8 | 7.3 |
| 7–10.5 | 26.1 | 10.1 | 35.5 | 7.2 | 10.6 | 3.0 | 6.5 | 12.0 | 13.8 | 2.9 | 4.9 |
| 10.5–14 | 26.3 | 10.1 | 35.0 | 7.3 | 10.8 | 2.9 | 6.3 | 14.0 | 10.6 | 1.9 | 3.2 |
| 14–17.5 | 27.2 | 9.1 | 35.3 | 7.4 | 10.5 | 2.6 | 6.7 | 16.6 | 7.8 | 1.2 | 2.1 |
| 17.5–24 | 27.3 | 8.7 | 35.7 | 7.3 | 10.7 | 2.7 | 6.8 | 21.1 | 3.3 | 0.9 | 1.2 |
| 24–31 | 27.0 | 7.6 | 37.3 | 7.5 | 10.2 | 2.4 | 7.0 | 27.5 | 1.4 | 0.5 | 0.0 |
| 31+ | 29.4 | 7.3 | 36.2 | 6.8 | 9.4 | 2.5 | 7.1 | 35.8 | 0.0 | 0.0 | 0.0 |

The **drive-outcome mix is nearly invariant** to the mismatch — punts hold at 35–37%, downs at ~7%,
turnovers at ~10%, end-of-half at ~6.5% no matter how lopsided the game. What changes is *whose*
drives they are. Meanwhile drama collapses monotonically: a toss-up produces a Q4 lead change 18.9%
of the time and overtime 7.9%; past a 24-point spread, neither ever happens.

---

## 4. Where `simEngine` currently sits

Measured the same way, over 2,010 games of a synthetic 134-team league (`tools/cfb-data/4-simprofile.js`).
Sim `spread` buckets use a retrodictive rating computed on the sim's *own* results, so the two sides
of every comparison are built identically.

### What already holds up

| Metric | Real | Sim |
|---|--:|--:|
| Total yards | 383 | 381 |
| Yards/play | 5.67 | 5.85 |
| Passing yards | 227 | 221 |
| Rushing yards | 155 | 160 |
| Points per drive | 2.28 | 2.35 |
| Sacks | 2.06 | 2.29 |
| Punts | 4.32 | 4.61 |
| \|Margin\| entering Q4 | 14.2 | 14.3 |

Yardage, efficiency-per-drive and the pass/run yardage split are genuinely well-calibrated.

### The gaps, by root cause

**a) The run/pass model is inverted.** The sim throws too much and each carry gains far too much;
the two errors cancel in the yardage totals, which is why the existing envelope tests never caught it.

| | Real | Sim | |
|---|--:|--:|---|
| Rush attempts | 36.3 | 27.1 | −25% |
| Pass attempts | 31.2 | 35.9 | +15% |
| **Yards/carry** | **4.27** | **6.45** | **+51%** |
| Yards/attempt | 7.29 | 6.18 | −15% |
| Run share | 54% | 43% | |

Downstream: 3rd-down conversion is 46.8% vs a real 39.2%, because a 6.45-yard average carry makes
3rd-and-medium nearly automatic.

**b) Too few possessions.** Points-per-drive is right, so the missing points are missing *drives*.

| | Real | Sim |
|---|--:|--:|
| Drives/team | 11.8 | 9.9 |
| Plays/drive | 5.75 | 6.6 |
| Seconds/drive | 150 | 182 |
| Points | 26.9 | 23.3 |

**c) There is no clock, and no end of a half.** `0.0%` of sim drives end at the end of a half or
game, against a real **6.5%** — the engine alternates possessions until `clock` expires mid-drive.
Nothing hurries up, nothing kneels, halftime doesn't swap possession.

**d) Fourth down effectively doesn't exist.** Real teams go for it 1.94 times a game; the sim, 0.20
(−90%). Drives ending on downs: 7.2% real vs 0.3% sim. The freed possessions go to punts (46.4% of
sim drives vs 35.3%) and field goals (13.0% vs 9.9%).

**e) Turnovers are half of reality** — 0.67 vs 1.38 (INT 0.38 vs 0.82, fumbles 0.28 vs 0.56), and
they're never returned. No pick-sixes, no fumble-return TDs, no safeties, no two-point conversions,
no onside kicks. Punt distance is a flat `ri(38,46)` — **the punter never touches the sim** despite
being generated on every roster.

**f) Nothing plays the score.** The real fav-runs / dog-throws divergence (a 7-carry gap at a
31-point spread) is absent: the sim's underdogs carry it 27.1 times in a toss-up and 25.1 in a
blowout, and its favorites don't shift at all. `passProb` reads down, distance, `adv` and scheme —
never the scoreboard or the clock.

**g) Late game is too quiet.** Q4 lead flips 9.2% vs 12.6%; 10+ point comebacks 0.6% vs 2.4%;
overtime 2.7% vs 4.7%. Concentrated in close games — in the 0–3 bucket the sim produces a Q4 lead
change 11.3% of the time against a real 18.9%, and overtime 2.6% against 7.9%. This is (c) and (f)
compounding: without a two-minute drill the trailing team never manufactures the extra possession.

**h) Penalties: right count, wrong weight.** 7.1 flags for 35 yards vs a real 6.0 for 52. The engine
only models 5-yard pre-snap fouls; real football averages 8.7 yards a flag because holding, PI and
personal fouls are in the mix.

---

## 5. What the poll actually measures (and what "rising up" really is)

The tables in §2 are indexed on rank, so it's worth being precise about what rank *is*. Run
`tools/cfb-data/6-rankings.js`. Three results, in order of how much they should change the sim.

### The poll is a coarse filter, not an ordering

| Games | Poll picks the winner |
|---|--:|
| Ranked vs unranked | **80.7%** |
| Ranked vs ranked | 55.1% |
| Ranked, within 5 spots of each other | 44.2% |
| Top-10 vs Top-10 | 41.3% |

The poll is good at the coarse call — *is this team good?* — and carries almost nothing on the fine
call — *which of these two good teams is better?* The cleanest version strips out home field
entirely: **on a neutral field, in ranked-vs-ranked games, the higher-ranked team wins 48.2%**
(n=85). A coin flip.

The same set, split by venue, shows what *does* decide those games:

| Ranked vs ranked | n | Higher-ranked team wins |
|---|--:|--:|
| Higher-ranked team at home | 100 | **74.0%** |
| Neutral field | 85 | 48.2% |
| Higher-ranked team on the road | 100 | **42.0%** |

**Where you play swings the result 32 points; where you're ranked swings it ~0.**

Two supporting numbers: when poll order and measured strength disagree (31.6% of ranked-vs-ranked
games), the poll is right **17.8%** of the time; and in ranked-vs-unranked games the ranked team was
measurably the *weaker* team **10.3%** of the time.

> **Caveat on method.** The "measured strength" rating is retrodictive — fit on these same games,
> including the one being predicted. Its 75–84% hit rate is an upper bound, not a fair forecast, and
> it should not be read as "a model beats the poll." The hindsight-free claims are the neutral-site
> coin flip, the venue split, and the disagreement rate.

### It does work itself out

| Week | corr(rank, measured strength) | Avg rank movement to next week |
|--:|--:|--:|
| 2 | 0.430 | 3.4 spots |
| 5 | 0.474 | 2.8 |
| 9 | 0.686 | 2.6 |
| 12 | 0.702 | 1.8 |
| 14 | **0.789** | 1.3 |

Early-season rank is close to pure reputation — a preseason guess carried forward, correlating 0.43
with how good the team actually turns out to be. By late November the poll is a decent instrument
(0.79) and has stopped thrashing (1.3 spots/week vs 3.4). The self-correction is real and gradual.

### "Rising up" is the crowd, not the motivation

The intuition that teams elevate for big games shows up in the data — but the mechanism is the
venue, not the locker room. The rating credits every home team a flat 2.4 points; measuring the
home team's residual on top of that recovers what home field is *actually* worth:

| Context | Home field is worth |
|---|--:|
| Both teams ranked | **4.8 pts** |
| Every home game | 2.9 pts |
| Neither team ranked | 2.5 pts |

**A big game nearly doubles the value of home field.** Meanwhile the "underdog elevates against an
elite opponent" effect does *not* appear — unranked teams underperform their own rating slightly
*more* as the opponent gets better (−1.78 vs No. 16–25, −2.34 vs No. 6–15, −2.98 vs Top-5), though
part of that gradient is the ±28 margin cap in the rating fit compressing genuine blowouts.

**For the sim:** `simEngine` uses a flat `HFA = 2.3` for every game. The data says home field should
scale with the stakes — roughly 2.5 in a nothing game, ~4.8 when both teams are ranked. Sideline
already knows the stakes (`S.media.poll`, rivalry intensity, `postseason`), and HFA is applied in
`playDrive` where it would be a contained change. This is also the honest way to deliver "my team
plays up for big games" without inventing a motivation fudge factor.

### The sim is 23% too random

Same measurement on both sides — SD of (actual margin − expected margin), with each side's expected
margin from a retrodictive rating fit on its own games:

| | Real FBS | Sideline |
|---|--:|--:|
| SD of margin vs expectation | **13.4 pts** | **16.5 pts** |
| \|residual\| > 14 pts | 28.0% | 38.8% |
| \|residual\| > 21 pts | 11.4% | 20.2% |

This is the missing explanation for §4's mismatch table, where the sim's favorite won less often than
reality in *every* bucket (80% vs 91% at a 10.5–14 spread; 73% vs 78% at 7–10.5). It isn't that the
sim's mismatches are too small — the scoring gaps are roughly right — it's that too much noise is
layered on top, so the better team loses more often than it should. Upsets are ~1.8× too common at
the tail.

The per-game `form` term (`(r()+r()+r()-1.5)*8` per team, ≈4 pts SD each) is one contributor but not
the whole story — play-level variance carries a large share, so this needs profiling before tuning
rather than a single-constant fix.

---

## Reproducing

```
node tools/cfb-data/1-index.js 2021 2022 2023 2024 2025   # scoreboard → game index (~20 req/season)
node tools/cfb-data/2-harvest.js                          # box score + drives per game (resumable)
node tools/cfb-data/3-analyze.js                          # real-data tables (sections 1-4 above)
node tools/cfb-data/4-simprofile.js                       # run simEngine, same metric set
node tools/cfb-data/5-compare.js                          # side-by-side
node tools/cfb-data/6-rankings.js                         # poll vs measured strength (section 5)
```

Data source is ESPN's public `site.api.espn.com` CFB endpoints. `2-harvest.js` caches to
`games.json` and only fetches what's missing, so adding a season is cheap. These are research
tools, not gates — they are not wired into `npm test`.

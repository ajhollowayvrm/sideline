# Recruiting in real college football, measured — the tuning target for the talent economy

The fourth reference sheet, same spirit as `cfb-averages.md` / `cfb-penalties.md` / `cfb-clutch.md`:
**11 signing classes, 2015–2025, 45,735 high-school prospects**, from the CollegeFootballData API
(`/recruiting/players`, `/recruiting/teams`, `/teams/fbs`, `/talent`). Reproduce with
`tools/cfb-data/20-recruits.js` (harvest, needs a free `CFBD_API_KEY`), `21-recanalyze.js` (real),
`22-recprofile.js` (what SIDELINE currently does), `23-reccompare.js` (side by side).

This is a **reference document, not a spec**. It exists so a recruiting phase is fitted to measured
football instead of to feel — the discipline Phase 48 applied to possession and Phase 49 to
penalties, finally applied to the system that decides who is on the field in the first place.

**Coverage, before any number below.**

| | |
|---|---|
| Prospects carrying a star rating | **88.8%** (the rest sit on the board unrated) |
| Hometown lat/long present | **98.5%** (distance stats are over these) |
| FBS programs joined to `/talent` | **99.9%** (the band table is over these) |

**What the free tier does not have, and therefore what this document cannot say:** commitment
**dates**, offer lists, official visits, NIL money. Nothing here can validate the commitment-window
mechanic (Phase 35) or the visit-weekend calendar (Phase 38). Those are *designed*, not measured,
and a later phase should not "fix" them against a number nobody has.

**Ranked versus all — read this before comparing any number to the sim.** A real board carries
~3,692 prospects with a star rating plus **~466 unranked**, and the unranked sign FBS at only 33.7%.
SIDELINE's pool is *entirely* ranked: every generated recruit carries 2–5 stars. So the quantities to
hold it to are the **ranked-only** ones throughout, and the two differ by more than they look:

| | all signees | ranked only |
|---|--:|--:|
| Board per class | 4,158 | **3,692** |
| Signs FBS | 63.7% | **67.4%** |
| Class size, mean | 20.2 | **19.0** |
| Class size by band | 23.5 / 21.5 / 19.8 / 19.5 / 19.9 | **23.3 / 21.0 / 19.2 / 18.5 / 17.7** |
| Class-size spread, top to bottom | 3.6 | **5.5** |
| Programs signing < 10 | 3.3% | **6.3%** |

The gap widens as you go down the league — 0.2 at the top, 2.2 at the bottom — because weak programs
lean hardest on unranked signees and preferred walk-ons. Comparing an all-signee class size against
the sim inflates every class target by about a player and moves the implied league sign rate five
points, which is enough to make a fitted constant absorb the error invisibly. `21-recanalyze.js`
reports both and exports the ranked-only set as the comparison keys.

**Program quality is ordered by the `/talent` composite**, not by class rank. That is the honest
analogue of SIDELINE's `prestige` — how good the roster is, independent of the class being signed.
Banding by class rank would make "good programs sign good classes" true by construction.

---

## 1. Supply — the board per cycle

| | per class | share of ranked |
|---|--:|--:|
| 5★ | 34 | 0.9% |
| 4★ | 375 | 10.2% |
| 3★ | 2,174 | 58.9% |
| 2★ | 1,109 | 30.0% |
| **Blue-chip (4–5★)** | **409** | **11.1%** |
| **Ranked board** | **3,692** | |
| Unranked also on the board | 466 | — |

The real board is a **broad three-star middle over a smaller two-star tail**, not a barbell — 58.9
against 30.0. That shape matters more than the blue-chip count, because it is what every program
outside the top 25 actually signs.

## 2. Convergence — where the board actually goes

| | |
|---|--:|
| Signs FBS | **63.7%** (2,647 per class) |
| Signs FCS / non-FBS | 18.1% |
| No listed commitment | 18.3% |
| Class size — mean / median | 20.2 / 20 |
| Class size — p10 / p90 | **13 / 27** |
| Programs signing < 10 | **3.3%** |

**The ranked board deliberately exceeds FBS capacity.** ~4,158 ranked against ~2,650 FBS signatures:
more than a third of the board goes to FCS, JUCO, preferred-walk-on, or nowhere. A
*pool-consumption rate is therefore not a health metric* — 100% consumption would be wrong, and so
would 90%. **Per-team fill is the real check**, and it is remarkably tight: essentially every FBS
program signs a real class every year, and the bottom decile still signs 13.

This retro-explains three phases of drift in `reclab`. `signed/pool ≥ 0.85` and
`signed/haveSuitor ≥ 0.88` are a supply-versus-capacity accounting identity, which is why the number
moved whenever contestedness moved (92% → 91% → ~80%) and why the bar was quietly lowered 88 → 85
when Phase 51 shifted the board. It was never measuring recruiting health. Note also that in the
shipped generator **every prospect gets suitors**, so the two denominators are the same number.

## 3. Distribution — who gets the players

| | |
|---|--:|
| Blue-chip share of all FBS signees | 15.3% |
| Blue-chip ratio, per class (mean) | 14.4% |
| Blue-chip ratio, rolling 4-year (mean) | 14.1% |
| Blue-chip ratio, rolling 4-year (max) | **89.5%** |
| Program-windows at BCR ≥ 50% | **11.8%** (121 of 1,027) |
| Gini of blue-chips per team | 0.772 |

**The band table is the whole phase in six rows.** Bands are non-cumulative, by talent composite:

| band | teams | class size | share of blue-chips | BCR |
|---|--:|--:|--:|--:|
| 1–10 | 10 | **23.5** | **40.3%** | 69.6% |
| 11–25 | 15 | 21.5 | 35.4% | 44.5% |
| 26–50 | 25 | 19.8 | 19.0% | 15.6% |
| 51–90 | 40 | 19.5 | 5.1% | 2.6% |
| 91–134 | 44 | 19.9 | 0.2% | 0.1% |

Class sizes in that table are **all signees**; the ranked-only equivalents a model should be held to
are 23.3 / 21.0 / 19.2 / 18.5 / 17.7 (see the ranked-versus-all table above).

Two facts to carry into any model:

1. **Class size is nearly flat across program quality** — 23.5 at the top against 19.9 at the bottom,
   a 3.6-player spread over the whole league (5.5 counting ranked signees only). Scholarships are a
   constant. *What varies by two orders of magnitude is what those signatures are worth*: BCR runs
   69.6% → 0.1%, and the top ten programs take **40.3%** of every blue-chip in the country. The
   residual gradient is small but load-bearing — it is what sets the top band's blue-chip ratio,
   because the same sixteen blue-chips read 100% in a class of 18 and 70% in a class of 23.5.
2. **The decline is smooth, not a cliff.** 69.6 → 44.5 → 15.6 → 2.6 → 0.1. Rank 60 signs the
   occasional blue-chip; it is rare, not impossible.

The 2023 class at the ten most talented programs, for scale:

| team | talent | signed | blue-chips |
|---|--:|--:|--:|
| Alabama | 1015 | 27 | 25 |
| Georgia | 978 | 26 | 22 |
| Ohio State | 975 | 24 | 19 |
| Texas A&M | 926 | 20 | 13 |
| Clemson | 918 | 26 | 19 |
| Texas | 913 | 26 | 18 |
| LSU | 899 | 28 | 18 |
| USC | 896 | 27 | 13 |
| Oklahoma | 885 | 26 | 16 |
| Oregon | 875 | 33 | 19 |

**On the blue-chip-ratio claim.** The published rule of thumb — no national champion in 16 seasons
below a 50% four-year BCR — is consistent with this sample: 11.8% of program-windows clear 50%,
which is ~15 programs, and they are the ones that win. The rule is *necessary, not sufficient*, and
this document does not test sufficiency.

## 4. Persistence — does a program stay good at recruiting?

**Class-points correlation, class N → N+1: `r = 0.882`.**

Recruiting is the most autocorrelated thing measured anywhere in this project. Set it beside
`cfb-clutch.md`'s one-score win% (`r = 0.078`) and blowout win% (`r = 0.482`): where clutch is noise
and on-field quality is moderately sticky, **recruiting position is nearly permanent**. A program
does not recruit its way out of its tier in one cycle, and a model that lets it is wrong.

## 5. Geography

| | |
|---|--:|
| In-state share of a class | **36.8%** |
| Signing distance — median | **271 mi** |
| Signing distance — p90 | 1,071 mi |
| Within 250 mi | 47.6% |
| Within 500 mi | 68.0% |

Talent production is **enormously** concentrated. Until Phase 57a `genRecruits` drew a prospect's
home state with `pick(r, STATES)` — uniform across all 50 — which handed the four states that really
produce 42% of the country's talent 8% between them, while thirteen Texas programs fought over ~68
in-state prospects a year. `REC_GEO` is this column:

| state | share of board | vs SIDELINE's uniform 2.0% |
|---|--:|--:|
| TX | 12.5% | **6.2×** |
| FL | 11.1% | 5.5× |
| CA | 10.9% | 5.5× |
| GA | 7.9% | 3.9× |
| OH | 3.9% | 2.0× |
| AL | 3.6% | 1.8× |
| NC · WA · LA | ~3.0% | 1.5× |

Texas, Florida, California and Georgia produce **42.4%** of the national board between them.

---

## Where the recruiting model currently sits

From `23-reccompare.js`, after Phases 57a (supply and geography) and 57b (the talent economy).
`ok` < 6% off, `~` < 15%, `MISS` beyond.

| metric | real | sim | |
|---|--:|--:|---|
| ranked board size | 3,692 | 3,692 | ok |
| 5★ / 4★ / 3★ / 2★ share | 0.9 / 10.2 / 58.9 / 30.0% | 0.9 / 10.2 / 58.9 / 30.0% | ok |
| blue-chip share of board | 11.1% | 11.1% | ok |
| signs FBS | 67.4% | 68.8% | ok |
| class size, mean | 19.0 | 18.9 | ok |
| blue-chip share of signees | 15.3% | 15.7% | ok |
| BCR per class | 14.4% | 14.1% | ok |
| BCR rolling 4-year | 14.1% | 14.1% | ok |
| windows at BCR ≥ 50% | 11.8% | 11.7% | ok |
| **Gini of blue-chips** | **0.772** | **0.782** | ok |
| class-score persistence | 0.882 | 0.887 | ok |
| in-state share | 36.8% | 37.9% | ok |
| TX / FL / CA / GA share | 12.5 / 11.1 / 10.9 / 7.9% | 12.0 / 11.1 / 11.8 / 7.7% | ok |
| **programs signing < 10** | **6.3%** | **0.0%** | **MISS** |

The band table, which is what the arc existed to fix (sim after Phase 59):

| band | real size | sim size | real BC% | sim BC% | real BCR | sim BCR |
|---|--:|--:|--:|--:|--:|--:|
| 1–10 | 23.3 | 22.2 | **40.3** | **36.3** | **69.6** | **64.8** |
| 11–25 | 21.0 | 20.9 | 35.4 | 42.2 | 44.5 | 53.2 |
| 26–50 | 19.2 | 19.8 | 19.0 | 18.7 | 15.6 | 15.0 |
| 51–90 | 18.5 | 18.6 | 5.1 | 2.4 | 2.6 | 1.3 |
| 91–134 | 17.7 | 17.3 | 0.2 | 0.4 | 0.1 | 0.2 |

Blue-chips landed **per team**, top ten against ranks 11–25 — the local metric that sees this, where
the league-wide summaries above cannot: **real 1.71×, sim 1.70×** after Phase 59 (it was 1.08×).

For comparison, the same table before Phase 57 — a band-pass filter centred on the recruit's tier,
under which the ten best programs in the country signed **4.2 players** and Georgia signed one:

| band | sim size (pre-57) | sim BC% | sim BCR |
|---|--:|--:|--:|
| 1–10 | **4.2** | 10.9 | 100.0 |
| 11–25 | 18.0 | 67.0 | 94.5 |
| 51–90 | 25.0 | 0.2 | 0.1 |

### The two residuals, named

**The top band is under-concentrated while the league as a whole is not.** Gini is 0.774 against a
measured 0.772 — total concentration is right to three decimals — but the sim spreads blue-chips
across ranks 11–25 (43.9% against 35.4%) where reality concentrates them in the top 10 (31.6%
against 40.3%).

The obvious reading was that reality has something convex at the very top which team quality does not
explain — national brand — and `27-toplean.js` was written to test that before inventing a mechanism
for it. **It does not survive the measurement.** Expressed as a multiple of the bottom band, the two
program-quality ladders agree on how far ahead the top ten sit:

| band | real `/talent` | sim prestige | real ×floor | sim ×floor |
|---|--:|--:|--:|--:|
| 1–10 | 917 | 86.4 | 2.66 | 2.27 |
| 11–25 | 795 | 72.5 | 2.30 | 1.90 |
| 91–134 | 345 | 38.1 | 1.00 | 1.00 |

Top-10 against 11–25: **real 1.154, sim 1.191** — the sim's top band is if anything *more* separated.
What differs is what that lead buys. Blue-chips landed **per team**, top ten against ranks 11–25:
**real 1.71×, sim 1.08×.** So a near-identical quality gap converts into a large recruiting advantage
in reality and almost none in the sim. This is a **conversion** defect, not a distribution one, and
not a missing mechanism — see `docs/phases/recruiting.md` (Phase 59) for the cause and the fix.

The general lesson is worth keeping: league-wide summaries (Gini, band shares) can all read correct
while the quantity that actually distinguishes a blue-blood is wrong, because those summaries are
insensitive to *where* in the ladder the concentration sits. Per-team, band-against-band is the local
metric that sees it.

**No program signs a tiny class.** 6.3% of real programs sign fewer than 10 *ranked* players,
leaning on unranked signees and preferred walk-ons to fill out. The sim has no such mechanism — every
program fills its target — so it reads 0.0%. This is the same gap as the unmodelled ~466 unranked
prospects, seen from the other end.

### Does concentration compound?

`26-dynasty.js`, ten seasons of `genRecruits → advanceRecruiting → rolloverRoster` over a
real-geography league. **It does not.** The top-10/bottom-10 talent gap settles by season four and
holds: drift **+0.1** across the steady-state window, league talent sd 5.53 → 5.54. Worth noting for
the sim's margin calibration that recruiting produces a *narrower* spread than the initial
prestige-scaled roster generation does (gap 30.9 → 20.3 over the burn-in), so multi-season play
should ease `calibration.md` §7's margin overshoot rather than worsen it.

# Possession model — the clock, the drive, and the shape of a gain (Phase 48 / 48.1)

Design record for the first sim change made against **measured** reality rather than a feel for it.
The targets live in `docs/reference/cfb-averages.md` (3,944 real FBS games, 2021–2025);
`tools/cfb-data/9-tune.js` scores the engine against them and `10-fit.js` fits the constants.

---

## Why this phase exists

Profiling `simEngine` on the same metric set as the real data (`tools/cfb-data/4-simprofile.js`)
showed the model was well-calibrated on **yardage** and badly wrong on **structure**:

| | real | shipping (Phase 46) |
|---|--:|--:|
| Total yards | 383 | 381 ✓ |
| Yards/play | 5.67 | 5.85 ✓ |
| Points/drive | 2.28 | 2.35 ✓ |
| **Drives/team** | **11.8** | **9.9** |
| **Plays/drive** | **5.75** | **6.57** |
| **Yards/carry** | **4.92** | **6.45** |
| **Run share** | **52%** | **43%** |
| **4th-down attempts** | **1.94** | **0.20** |
| **Turnovers** | **1.38** | **0.67** |
| **Drives ending at the horn** | **6.5%** | **0.0%** |

The run and pass errors cancelled in the yardage totals, which is exactly why nine phases of
`simlab` envelope checks never caught them — the envelope only asserted totals and leaders.

Points-per-drive being *right* while points were 13% low located the deficit precisely: the missing
points were missing **possessions**, not missing efficiency.

---

## What changed

> **Superseded in 48.1:** the three-tier gain draw, the `shortTight` situational term and
> `PM.rzTop` described below were replaced by per-distance quantile tables measured from real
> play-by-play. They are kept here because the reasoning that produced them is what led to the
> measurement — and because one of them turned out to be backwards. See §48.1.

Every constant is grouped in a single `PM` block (fenced by `// PM-START` / `// PM-END` so the
fitter can swap it) rather than scattered through the play code.

### Two halves
The engine ran one continuous 3600-second clock, so possessions simply alternated until time
expired mid-drive — no half ever ended, and **0%** of drives died at the horn against a real 6.5%.
Now: two 1800-second halves, the team that didn't take the opening kickoff receives to start the
second, and a drive still alive when the half expires ends there. `playDrive` takes the half clock
and a `timed` flag; **OT drives pass `clk0 === 0` and are explicitly exempt**, or every overtime
possession would die on the first snap (there's a simlab regression guard on exactly this).

### A real 4th-down brain
`fourthCall(togo, los, fgDist, inFgRange, diff, secs, q)` — pure, no rng, unit-tested. The old rule
went for it only inside the opponent's 42 on 4th-and-2, which produced 0.20 attempts a game against
a real 1.94 and left 96% of real turnover-on-downs drives unmodelled. The new one reads field
position, distance, score and clock: short yardage past your own 42, 4th-and-goal inside the 3,
no-man's-land between the opponent's 42 and 28, and a trailing-late branch where a punt is
surrender. A single rng draw takes the conservative option 12% of the time so the AI isn't robotic.
`PM.fgMax` caps the longest routine attempt — the old code would try a 57-yarder rather than punt.

### Tiered gains, not uniform-plus-boom
The largest modelling error, and the subtlest. Yardage was `base + compDraw*spread` plus a
breakaway roll — near-uniform through the middle. **A flat distribution with the right mean converts
far more short yardage than real football does**, which is why 3rd-down conversion ran 46.8% against
a real 39.2% and drives wouldn't die.

`tierGain(u, tier, rz, xtop)` draws from three explicit tiers — stuff / normal / explosive — as
`[p1,lo1,hi1, p2,lo2,hi2, lo3,hi3]` over one `compDraw`. Real carries are right-skewed (median ~3,
mean ~4.9) with ~21% gaining nothing, so most of the average lives in the tail. It also replaced two
rng draws with one.

### Red-zone compression
Inside the 20 there is no field left to attack. Without this the model finished **88%** of its
red-zone trips (real: ~61%) while reaching the 20 far too rarely — so points came out low even with
the right yardage, because the offence was all-or-nothing instead of grinding and settling for
threes. `PM.rzComp` trims the completion rate and `PM.rzTop` clips the explosive tier.

### Situational gain shaping — the piece that unlocked it
A single gain distribution cannot hit real football's 39% third-down rate AND its explosive-play
rate. Making it consistent enough to move the chains kills the tail; a fat tail cannot convert
3rd-and-3. Real offences resolve this by shaping the **call** to the down — a high-floor concept
when they need four yards, a shot play on 1st-and-10. So `tierGain` takes a `tight` flag: on a
must-convert short down (`down>=3 && togo<=4`) the stuff tier shrinks to `PM.shortTight` of its
usual share, while the explosive tier is untouched. Third-down conversion went **35.5% → 39.2%**
(target 39.2%). Because it is a deterministic conditional rather than a random one, it buys those
conversions **without spending any variance budget** — which is precisely why points and
game-to-game noise stopped fighting each other.

### Re-scaling how much strength matters
Caught by the gates, and the subtlest consequence of the new gain shape. The tier draw is much
wider than the old near-uniform one, so the old fixed coefficients (`padv*0.06` / `padv*0.035`)
became a far smaller fraction of the per-play noise — and **team strength quietly stopped
mattering**. Home-field win rate fell to 51%, and a stud receiver no longer beat weak coverage
(the Phase 23 matchup checks failed). `PM.advPass` / `PM.advRun` / `PM.hfa` restore the
signal-to-noise: home win 51% → **57%** (real 58.8%) and favourite win rate 73.6% → **83%**
(real 83.7%). It also lifted scoring, because stronger offences convert more.

### Tried and removed: a per-drive rhythm term
**The premise here was wrong** — it rested on a red-zone figure that 48.1 later measured properly.
Real non-scoring drives gain **15.7** yards, not the ~8 derived from the bad figure, and the model's
~16 was fine all along. Recorded because the mechanism was built, fitted and discarded on evidence.
The original (mistaken) reasoning: failed drives travel too far, so drives are all mediocre rather
than bimodal, which is why too few reach the red zone. A mean-zero per-drive yardage shift is the
textbook fix for that (it correlates the snaps inside a possession). It was implemented, fitted,
and **measured as not helping**: at every setting tried it flattened yards-per-carry and cost
points, and paying for it by narrowing the explosive tiers was worse still (err 7.3% → 11.9%). It
is removed rather than left at zero consuming rng draws. The underlying gap is real and unsolved —
see below.

### Ball security + clock
Interception and fumble rates recalibrated, plus the strip sack (a sack that becomes a turnover).
Per-snap clock charges moved into `PM` (`secRun`/`secPass`/`secQuick`/`secIncomp`/`secSack`) so pace
is tunable rather than hard-coded at 36 seconds a snap.

---

## Fitting, and two methodology traps

The parameters are **coupled** — raising run efficiency lengthens drives, which lowers the drive
count, which moves points *and* variance together — so one-at-a-time tuning converged badly.
`10-fit.js` does multi-start coordinate descent over 16 constants against a weighted composite of
25 measured targets. Two traps, both caught by checking the search score against the full slate:

1. **Subsampling games, not teams.** The first search slate took every 3rd *game*, leaving each team
   ~10 results to fit the retrodictive rating on. That rating then explains its own small sample
   almost perfectly, so residual SD and the upset rate collapse — the three variance metrics went
   invisible to the fitter and it spent the slack on yards-per-carry. Search reported 11.07%; the
   full slate said 30.00% on the same parameters. **Subsample whole teams, never games.**
2. **A head slice isn't stratified.** `world.slice(0, 60)` is 27% elite teams against the full
   world's 12%, because the generator front-loads the prestige tiers — a different mismatch
   distribution than the one being scored. Use `world.filter((_, i) => i % 2 === 0)`.

---

## Save & replay

Save **v44**. Games now carry `g.eng` = the sim model that resolved them.

`buildGameLog` re-sims from the seed and returns *its own* score, so a game played on the old engine
would replay with a final score that contradicts the record book. `g.eng` is deliberately **not
backfilled** by the migration: an absent value correctly marks a game as pre-Phase-48, and
`gameReplayable()` refuses the replay instead of showing a wrong one. Greatest-games rows for such
games render dimmed and inert. Scores, stats, standings and records are untouched — only the
play-by-play re-sim of already-played games is unavailable, and only for careers that predate this.

A dual-engine path (keeping v1 alive so old careers replay exactly) was considered and rejected: it
would mean carrying both play models forever to preserve a replay of a game whose result is already
stored.

---

## Validation

`simlab` → **98** checks (16 new): the 4th-down brain's decisions in seven situations, `tierGain`
monotonicity / mean / stuff-rate / red-zone clipping, both halves simulated, drives dying at the
horn, drives-per-team in range, and the OT-not-expired regression guard. The Phase 29 AI-DC check
had its sample raised from 30 games to 200 — under the new model 30 games is pure noise there
(measured +2.7 pts at n=30, −1.4 at n=600; the sign flips).

Two `simlab` bands were **re-baselined against measured reality**, not loosened to fit:
- *Favourite win rate* 60–82% → **74–90%**. Over the comparable population (expected margin 3+,
  n=3213) the real FBS favourite wins **83.7%**; the old band was calibrated to an engine that was
  ~23% too noisy and therefore let favourites lose far more often than they do in life.
- *Phase 29 AI-DC* sample 30 → 200 games (see above).

### Where it landed

Composite error against the 25 measured targets: **41.3% → 8.5%**.

| | real | shipping | now |
|---|--:|--:|--:|
| Points | 26.9 | 23.3 | **24.6** |
| Drives/team | 11.8 | 9.9 | 12.3 |
| Plays/drive | 5.75 | 6.57 | 5.55 |
| Yards/carry | 4.92 | 6.45 | 5.09 |
| Run share | 52% | 43% | 50% |
| 3rd-down conv | 39.2% | 46.8% | **39.2%** |
| 4th-down att | 1.94 | 0.20 | 1.99 |
| Turnovers | 1.38 | 0.67 | 1.35 |
| Drives at the horn | 6.5% | 0.0% | 6.7% |
| Home win % | 58.8% | 55% | 57% |
| Favourite win % | 83.7% | 73.6% | 83% |
| Margin residual SD | 13.26 | 16.31 | 14.94 |
| Blowout upsets/season | 5.8 | 17.3 | 9.0 |

---

## 48.1 — measuring the play instead of approximating it

The first pass fitted hand-built shapes against aggregate targets, and several of those targets came
from published red-zone figures that turned out to be **internally inconsistent** (3.4 trips a game
at 61% touchdowns implies 2.07 TD drives against a measured 3.10). So 48.1 went and measured the
play level directly — ESPN's per-play feed carries down, distance and `yardsToEndzone`, which is
orientation-free field position. `tools/cfb-data/11-plays.js` builds the distributions from
**258k rushes and 145k completions across 3,866 games**; `12-quantiles.js` turns them into constants.

### What the measurement corrected

- **Red zone: 4.68 trips per team-game at 67.5% TD**, not 3.4 at 61%. Both numbers being tuned
  against were wrong.
- **Non-scoring drives gain 15.7 yards**, not the ~8 derived from those bad figures. The earlier
  claim that the model's failed drives travelled too far was simply false — 16 against a real 15.7.
- **Short-yardage runs gain LESS, not more.** A carry on 3rd-and-1 averages 3.40 yards against 5.09
  overall and is stuffed *more* often (23.7% vs 17.6%) — yet still gains the yard 76.3% of the time.
  It is stuff-or-get-just-enough, a stacked box, not an easier version of a normal carry. The
  `shortTight` term from the first pass had this exactly backwards.

### What replaced the hand-built model

- **Per-distance quantile tables** (`PM.runQ` / `PM.recQ` — empirical inverse CDFs over a tail-dense
  percentile grid). A single table plus a mean offset provably cannot work here: shifting the whole
  distribution down 1.31 yards to hit short yardage's *mean* destroys the very case it needs to
  preserve, and 3rd-and-1 conversion came out at 60.8% against a real 76.6%. Sampling the measured
  per-distance shape gets mean, median, stuff rate and conversion right by construction.
- **Measured play-call mix** (`PM.mix` — pass share by down and distance). Real offences throw 17%
  on 3rd-and-1 and 79% on 3rd-and-8; the hand-tuned formula threw 34% at both ends. Scheme tendency
  and team strength now apply as deviations from what real football actually calls.
- **Goal-to-go distance.** The engine set `togo = 10` on every first down, so 1st-and-goal from the 3
  was internally "1st and 10" — which made the measured down/distance tables inapplicable at exactly
  the spot they matter most. Now `togo = min(10, 100 - los)`.
- **Symmetric home field.** `HFA` was added to the home offence only, lifting the league-average
  `adv` by HFA/2 and with it every measured gain table. Split to ±HFA/2 — the home-vs-away
  differential is unchanged, but the league mean stays where the measurement put it.

### Two more data-quality traps

Both caught by sanity-checking results that were impossible rather than merely surprising:

1. **Possession flips corrupt play yardage.** On a failed 4th down or a turnover, ESPN reports `end`
   from the *new* offence's perspective, so end-minus-start yields garbage (observed: −90, +36).
   Those bogus positives were counted as conversions, putting 4th-down conversion at **80% against a
   real ~52%**. Fixed by requiring possession to be retained and falling back to parsing the play
   text; 4th down now weights out to 54.3%.
2. **A display string is not data.** The engine logs "3 & goal", so the lab bucketed every goal-to-go
   snap as 3rd-and-1 and short-yardage conversion looked far worse than it was. The log now carries
   the numeric distance alongside the display string.

### Where 48.1 landed

| | real | Phase 48 | 48.1 |
|---|--:|--:|--:|
| Composite error | 0% | 8.5% | **5.5%** |
| Plays | 67.5 | 68.2 | 67.7 |
| Pass attempts | 31.2 | 32.9 | 31.3 |
| Rush attempts | 34.2 | 33.2 | 34.3 |
| Sacks | 2.06 | 2.07 | 2.06 |
| 4th-down attempts | 1.94 | 1.99 | 1.90 |
| 3rd-down conversion | 39.2% | 39.2% | 38.3% |
| **3rd-and-1 conversion** | **76.6%** | 54.3% | **70.3%** |
| Drives at the horn | 6.5% | 6.7% | 6.5% |
| Blowout upsets/season | 5.8 | 9.0 | **7.1** |

`simlab` → **101** checks. The Phase 48 shape checks were rewritten to assert the measured
*properties* rather than the constants, so they survive a re-harvest: short yardage gains less than
long yardage but still converts three times in four, is stuffed more often, pass share rises with
distance on every down. Two single-seed checks were re-based onto real samples — the Phase 24 shadow
check was measuring chaos at n=1 (the shadow changes a completion threshold, which cascades into a
different game); over 300 seeds the effect is a clean 72.0 → 53.5 receiving yards.

## Known gaps — what this phase did NOT fix

Stated plainly so the next thread starts from the truth rather than from the win.

- **Points are still 2.3 short** (24.6 vs 26.9). Roughly **1.7** of that is non-offensive scoring the
  engine cannot produce at all — return touchdowns, defensive scores, two-point conversions,
  safeties. The other ~0.6 is offensive touchdown rate.
- **Red-zone conversion is 88% against a real ~61%.** Trip count is now about right, but once inside
  the 20 the model scores a touchdown far too readily. Compression helped and did not solve it.
- **Yards drifted 7% high** (409 vs 383) as a side effect of re-scaling strength; yards/play is 5.99
  against 5.67.
- **Turnovers on downs are 4.6% of drives against a real 7.2%** — the 4th-down brain attempts about
  the right number of conversions but converts ~71% where real teams convert 52%, because it still
  goes almost exclusively on short yardage.
- **No fat tail.** Excess kurtosis is 0.00 against a measured +0.32, and blowout upsets run 9.0 a
  season against 5.8. The calm/wild `form` mixture that would install the tail (measured +0.64
  kurtosis in `8-variance.js`) is **not** in: `PM.gameForm` fitted to **0**, because play-level
  variance alone already exceeds the real margin SD, leaving no budget for it. Buying that budget
  needs play-level variance to come down first — see `docs/reference/cfb-averages.md` §6.
- **Real failed drives gain ~8 yards; the model's gain ~21.** Its drives are all mediocre rather
  than bimodal. This is the root cause of both the red-zone and the fat-tail gaps, and the obvious
  fix (a per-drive rhythm term) measured as not helping — see above.

## Deliberately out of scope

Special teams are still inert — the punter never touches the sim (net punt is a flat random draw),
there are no kick or punt returns, no return touchdowns, no safeties, no two-point conversions and
no onside kicks. Turnovers are spotted where the play ended and never advanced, so a pick-six cannot
happen. Nothing plays the score: the real favourite-runs / underdog-throws divergence (a 7-carry gap
at a 31-point spread, entirely game-state-driven) is unmodelled, and there is no hurry-up, no
kneel-down and no two-minute drill. Home field does not yet scale with the stakes, despite the
measured 4.8 points when both teams are ranked against 2.5 when neither is.

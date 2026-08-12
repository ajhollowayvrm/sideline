# Possession model — the clock, the drive, and the shape of a gain (Phase 48)

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

### Drive rhythm
Independent per-play draws make every drive average. Measured against the real data, **real failed
drives gain 12 yards; the model's gained 20** — the sim had too few three-and-outs *and* too few
long marches, so only 24% of drives reached the 20 against a real ~41%. A mean-zero per-drive
yardage shift (`PM.driveForm`) correlates the snaps inside a possession, which is what makes drive
outcomes bimodal the way football actually looks. The game-level variance it adds is paid back by
dropping the per-game `form` term.

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

All 22 non-browser gates green.

---

## Deliberately out of scope

Special teams are still inert — the punter never touches the sim (net punt is a flat random draw),
there are no kick or punt returns, no return touchdowns, no safeties, no two-point conversions and
no onside kicks. Turnovers are spotted where the play ended and never advanced, so a pick-six cannot
happen. Nothing plays the score: the real favourite-runs / underdog-throws divergence (a 7-carry gap
at a 31-point spread, entirely game-state-driven) is unmodelled, and there is no hurry-up, no
kneel-down and no two-minute drill. Home field is still flat at 2.3 rating points despite the
measured 4.8 in games where both teams are ranked. Those are the next threads, not gaps in this one.

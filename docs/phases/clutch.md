# Big moments — clutch as variance, not a bonus (Phase 50)

Measured target: `docs/reference/cfb-clutch.md`. Constants in the fenced `PC` block in `index.html`;
`tools/cfb-data/16-clutch.js` measures reality, `17-simclutch.js` measures the engine.

---

## Why this phase exists

Phase 10 shipped a clutch factor, and it was almost invisible: `compClutch(p)` — ±1.6 rating points,
applied to the starting QB only, on offense only, in the last 10 minutes of a one-score game. One
player, one side, one threshold. Nothing else about a big moment differed from a first-quarter snap.

The obvious move was to make it bigger. The measurement said don't.

---

## What the data forced

**Clutch is not a repeatable trait.** A team's one-score win% has a year-over-year correlation of
**0.078**, against **0.482** for its blowout win%. Being good repeats; winning close games does not.
And this isn't a corner case — **38.4% of all games are decided by 8 or fewer**. Any model where a
rating decides close games would be inventing a "clutch team" that five years of football says
doesn't exist.

**But the situation is real.** Late and within one score, offense measurably tightens: completion
rate −3.25pp, rushing −0.56 Y/C, interceptions ~30% hotter. Crucially this **survives standardizing
to a common down/distance mix** (raw −3.52 vs standardized −3.25), so it isn't just "trailing teams
throw on 3rd-and-long" — which matters, because the sim already models down and distance and would
otherwise double-count it.

So: model the *moment*, not the *hero*.

---

## The design

**Pressure is graded, not binary.** `pressure(half, secs, diff)` returns 0..1 — nothing before the
4th quarter, a quadratic ramp through it so the final minutes dominate, saturating inside 5 minutes,
and 1 throughout overtime. A two-score game late keeps 30% of it. Recomputed every snap, because the
score changes mid-drive.

**Composure's clutch effect is mostly VARIANCE.** Under pressure the Phase 10 reshape is amplified
(`compExp(p, amp)` with `amp = 1 + 1.6 × pressure`): an ice-veined player's outcomes tighten toward
his mean, a streaky one's fly apart. This is **mean-preserving by construction** — `compReshape` is
symmetric about 0.5, and simlab asserts the mean stays at 0.5000 for every composure at every
amplification. That's the whole trick: it changes *who makes the play and how* without creating
clutch teams. `amp = 1` reproduces the pre-Phase-50 draw exactly.

**A small mean nudge rides on top, drawn from the actual matchup.** On a pass,
`(compClutch(qb) + compClutch(rec) − compClutch(cov)) × 1.5 × pressure`; on a run,
`compClutch(rb) − compClutch(fr)`. Mean-zero across the league since composure centres at 50 on both
sides, and it now includes the *defense* — the corner's nerve counts as much as the receiver's. This
is the only channel that can bias a close game, so it is deliberately bounded.

**The situational deltas apply to both teams equally** — completion −3.4pp, rushing −0.93 Y/C,
interceptions ×1.32, fumbles ×1.15, all scaled by pressure. Late-and-close football gets harder for
everyone, which is what makes the ending feel like an ending without favouring anyone.

**Yards per completion are untouched.** Real Y/A falls in the clutch (7.18 → 6.84) but yards *per
completion* don't (11.64 → 11.71) — the entire drop is the completion rate. `PC.ya` is therefore 0,
with a comment explaining that charging both would double-count.

**Kickers are untouched.** Controlling for distance, clutch FG% is flat (<30: 92.1% → 91.1%; 30s:
81.1% → 81.2%). The most repeated clutch claim in football isn't in the data, so the engine models
nothing, and simlab asserts the absence.

---

## Where it landed

**The situation**, standardized to a common down/distance mix:

| | Sim | Real |
|---|--:|--:|
| clutch completion % | −3.45 | −3.25 |
| clutch Y/C | −0.52 | −0.56 |
| clutch Y/A | −0.41 | −0.34 |
| INT ratio | ~1.27 | 1.30 |

**The constraint** — identical rosters, composure the only difference, home/away alternated:

| composure spread | overall win% | one-score win% |
|---|--:|--:|
| 42 vs 59 (realistic) | 53.9% | **50.1% ±1.0** |
| 12 vs 88 (absurd) | 72.5% | 55.8% ±1.1 |

At the spread real rosters produce, composure moves one-score win% by a tenth of a point.

**The result worth recording:** turning Phase 50 off *raises* the absurd row's one-score win% from
55.8% to **58.9%**. The clutch model pushes close games **toward** the coin flip, because amplified
variance helps whoever is trailing. That is the opposite of what "adding a clutch factor" is usually
assumed to do, and it's why the variance framing was the right one — a mean bonus large enough to
feel would have walked straight into the r=0.078 wall.

Almost all of the remaining edge in that row is the **pre-existing Phase 10 consistency advantage**
(steady players sustain drives, and drives need repeated successes), not the clutch terms. Phase 50
did not introduce it and is not responsible for it — but it's worth knowing it's there.

---

## Save & replay

`SIM_MODEL` → **5**; pre-Phase-50 games decline replay rather than re-sim to a different score (the
Phase 48 contract). Save version **46**, structurally a no-op: `p.gs.cl` (plays made under pressure)
is another sparse box key, and the Phase 9 codec carries `p.gs` generically.

Surfaced as **"In the clutch — N plays in big moments"** on the player sheet, credited when a player
converts a first down or scores at pressure ≥ 0.5, or picks a pass off in one.

---

## Validation

Thirteen new simlab checks: the shape of `pressure()` (six), mean-preservation of the amplified
reshape at every composure, `amp=1` identity, the standardized completion drop, that **kickers do
not choke**, that clutch plays are credited to real players, and the two constraint checks — that
composure does **not** decide one-score games and that its overall edge stays modest at a realistic
spread. All 23 gates green.

**A measurement trap worth recording.** The completion-drop check first ran over 90 games and
reported the *wrong sign* (+2.57pp). Only ~5 pass attempts a game land in the clutch bucket, so 90
games gives a standard error of ~2.4pp against a ~2pp effect. It needed 900 games and standardizing
by down/distance before it was measuring anything. The same trap sits in the league-wide
composure-vs-one-score-win% correlation: at n≈122 teams its standard error is ~0.09, so it cannot
distinguish 0.08 from 0.15 and must not be fitted against — which is why the shipped constraint test
is a controlled head-to-head over thousands of games instead.

---

## Deliberately out of scope

- **Kicker pressure.** Measured flat. Not modelled, and asserted absent.
- **Clutch as a visible rating.** Composure already exists and is already fogged; a separate "clutch"
  attribute would imply a repeatability the data denies.
- **Coach/crowd clutch effects.** No home-crowd term in the moment beyond the existing HFA — nothing
  in the measurement isolates one.
- **Momentum.** No streak or "they're rolling" state. Same reasoning as the penalty phase: one-score
  outcomes are near-random year to year, and momentum modelling would manufacture a signal.
- **Pressure on special teams generally.** Only the scrimmage play is affected; punts and kickoffs
  are untouched.

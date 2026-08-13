# Phase 51 — Attributes become the ability model

> Directive: *"Overall should not really affect much. It's more of just a display number to be
> totally honest."* — and then, on how OVR should be derived: *"from ALL a player's attributes PLUS
> the system they're in. A zone scheme corner needs awr a lot more than speed."*

Before this phase `p.ov` **was** the ability model. `spd`/`str`/`awr` were stored on every player,
displayed as the headline numbers on every player and recruit sheet, and **read by no formula
anywhere**. `pot`, `stars`, `cap`, and the kicker's and punter's ratings were likewise inert.

This phase inverts that. Attributes are the truth; **Overall is a derived readout of them, weighted
by the system the player plays in**.

---

## 1. The rule

**Attributes redistribute ability. They never add it.**

This is the house discipline from Phases 10/21/23/50 — mean-preserving reshape, doubly-balanced
scheme table, mean-zero matchup edge — and it is load-bearing here for a specific reason: there is
**no measurement to fit attribute effects against**. All three reference sheets are team-level
box-score harvests of 3,944 real games; not one of them contains a player's speed. Attribute effects
therefore cannot be *fitted*, only made *envelope-neutral*.

Two levels enforce it:

- **Within a player.** A profile is his ability plus a tilt whose *weighted* mean is zero, so
  `ovrBase` returns exactly the ability he was generated with. Being fast costs strength or awareness.
- **Within a matchup.** Every sim channel reads a *deviation* from the depth-weighted mean of the
  pool the player came from — the Phase 23 `matchEdge` construction, one per attribute.

---

## 2. The six

| Attribute | Owns |
|---|---|
| **Speed** | Top end. The **tail** of the gain draw; deep separation; deep coverage |
| **Agility** | Short area: separation underneath, man-coverage mirroring, elusiveness |
| **Strength** | Raw power: interior blocking and inside rush, contested catches, power through contact; leg power for K/P |
| **Awareness** | Football IQ: reads, zone recognition, play-action discipline, sack avoidance; FG accuracy |
| **Ball Skills** | The catch point and the takeaway |
| **Durability** | Injury resistance, fatigue resistance |

Ball Skills was split out of Awareness because a defensive back with elite IQ and poor hands is a
real archetype — he gets in position and drops the pick. Durability is not in the directive; it
exists because `INJ_RATE` and `fatigueCost` were flat for every player in the league.

Kickers and punters need no special attributes: **range is strength, accuracy is awareness**. That
closes gap (e) in `cfb-averages.md` §4 — *"the punter never touches the sim despite being generated
on every roster."*

---

## 3. Overall is derived — and scheme-weighted

```
ovrBase(p)        // position-weighted, scheme-agnostic
ovrIn(p, scheme)  // position × scheme weighted
```

- **`ovrBase`** is the cross-team currency: stars, NFL draft grade, the record book, `peakOv`.
  Nothing that compares players across programs may move when someone installs a new defence.
- **`ovrIn`** is stored on `p.ov`, shown on the roster, consumed by `teamRatings`, and re-derived by
  `reRateRoster` whenever the roster, staff, or **scheme** changes.

`POS_ATTR_W` rows sum to 1; `SCHEME_ATTR_W` deviations sum to 0. Both are asserted.

The effect the directive asked for, measured on two corners generated to be near-identical on paper:

| | Base (scheme-agnostic) | Bear (press/man) | Tampa-2 (zone) | Nickel/Cover-3 (zone) |
|---|--:|--:|--:|--:|
| Zone corner (awr 92, bal 88, spd 70) | 78 | 75 | **80** | **81** |
| Burner (spd 94, agi 92, awr 66) | 79 | **84** | 75 | 75 |

Two players who read 78/79 in the abstract swing 14 points apart depending on the system. Installing
a scheme re-rates the roster and reports the team-OVR delta in the toast.

### Scheme fit was retired from `schemeDelta`

Phase 21 expressed "does this player suit this scheme" as innate `playerSchemeIdx` →
`rosterSchemeFit` → a ±0.9 team rating delta. Scheme-weighted OVR says the same thing, better and
per-player — so keeping both would count it twice, once inside every rating the sim reads and again
as a delta on top. `SCHEME_FIT_W` no longer enters `schemeDelta`; only the rock-paper-scissors
matchup edge survives there, which is about the two schemes meeting each other, not the roster.

`playerSchemeIdx` remains as **preference** — what a player *likes* to run, surfaced as a fogged chip.
That is a different thing from what he is *good at*, and the split is the point.

---

## 4. Where each attribute reaches a play

The design constraint: `ov` is derived from attributes, so the Phase 23 `matchEdge` **already**
carries "who is better" in aggregate. Each channel therefore targets a part of the play that had **no
per-matchup term at all**, so nothing is restated.

| Channel | Insertion point |
|---|---|
| Speed | the high-`u` **tail** of `qGain` (previously untouched by anything); completion, weighted to the deep buckets |
| Agility | completion underneath; the coverage side of the same; mid-range elusiveness |
| Strength | the low-`u` **floor** of `qGain`; **the sack check** — the line against the rush |
| Awareness | `intRate`, sack avoidance, `fumRate`, `sackFumP`; damping the Phase 46 concept bonuses |
| Ball Skills | completion at the catch point; INT conversion; fumble security; strip-sack |
| Durability | scales `INJ_RATE` per player; moves the `fatigueCost` workload threshold |

**Speed's one-on-one clause.** *"A lack of speed can be overcome but in certain one-on-one situations
it can't be."* Isolated deep or in man coverage, a speed **deficit** past `AT.oneOnOne` steepens by
`AT.oneOnOneMul`; a surplus is untouched. This is the only deliberately asymmetric channel, and it is
what makes speed *kill* rather than merely count.

**The offensive line finally does something.** Before this phase no OL player affected any run or
pass outcome — the `ol` pool existed solely to commit penalties, and the sack check had no protection
term. Strength gives the five biggest men on the roster a job.

### Deliberately not wired: penalties

Phase 49 keys foul propensity off **composure alone**, because measured discipline is flat across
team quality (top-10 5.87 flags, unranked 5.99 — `cfb-penalties.md`). Awareness correlates with
quality. Routing it into penalties would recreate "good teams are clean teams", which the measurement
forbids. The `simlab` check *"rating does not buy discipline"* guards this.

---

## 5. Two things the gates caught

**`tilt()` must not read `ov`.** It originally measured an attribute against `p.ov`. But `ov` is a
*derived readout* — anything that moves it independently (legacy data, a scheme change, a test
bumping ratings) leaked straight into the channels. The "rating does not buy discipline" check failed
at **5.17 vs 4.40** flags. `tilt` is now relative to the player's **own attribute mean**, with no
dependence on the readout at all.

**Strength was strictly the best build.** A new build-vs-build check — three rosters at an *identical*
OVR, specialised differently — ran strength at **68%** against awareness at **48%**. Strength reaches
a play through three routes at once (the carrier, his line against the front, the pocket), so equal
coefficients made it *add* ability rather than redistribute it. Rebalanced to **57 / 55 / 53**.

That check is the phase's most important gate: it is the operational definition of the rule.

---

## 6. One honest generation path

Six sites set attributes, each with a *different* relationship to `ov`. This, not the sim, was the
real blocker:

| Site | Was | Consequence |
|---|---|---|
| `genPlayer` | `ov ± 12`, computed **pre-taper** | `genRoster` tapered `ov` alone → deep backups carried a speed rating **up to 26 points above their overall** |
| `genRecruits` | `ov ± 10` | — |
| `genFreshman` | `ov ± 12` | — |
| `recruitToFreshman` | raw recruit attrs vs an `ov` discounted 6–16 by pedigree | blue-chips arrived rated **far below** attributes that still said elite |
| `normPlayer` | `+p.spd \|\| ov` | imported rosters got **zero spread** — the system was inert for real-data leagues |
| `developPlayer` | all three `+= 0.6 × delta` | attributes **drifted below** `ov` over a career |

All six now run through `genAttrs` / `shiftAttrs` / `centerAttrs`. The taper moves attributes and lets
`ov` follow. Imports are **re-centred**, so a file handing us all-90s attributes on a 75-overall
player does not collect the difference for free.

`pot` is a true ceiling, so the derived readout is capped at it — six independently rounded
attributes can otherwise tip a maxed player one point past it (2 in 20,000).

---

## 7. Directive 2 — potential

- **NFL draft grade**: unrealized ceiling (`pot − peakOv`) lifts a board grade up to ~8 points. Pro
  scouts draft traits, not just tape.
- **Scouting ranking**: an exceptional ceiling lifts a recruit a tier on the services' published
  board. This is a **separate `svc` field**, not `stars`. Stars drive real mechanics here — commitment
  windows are a blue-chip behaviour, interest targets key off the tier — and a service ranking that
  moved those would be ability, not a ranking. `recStars()` is the single place the display reads it.

---

## 8. Save shape

**Save v47**, `SIM_MODEL` **6**. Pre-Phase-51 games decline replay rather than re-simming, the same
contract as Phases 48–50.

The migration is **not** a structural no-op like the last three steps — it mutates every player on
every team (~11.3k) plus the recruit and portal pools. Each player **keeps the `ov` he already had**:
the profile is generated deterministically from his id and re-centred onto that value, so nobody's
strength changes, depth charts hold, and the record book still agrees with the roster. What he gains
is a *shape*. Where the old three attributes exist they are kept as the starting shape, so an
imported roster's real speed and strength survive.

`SAVE_PKEYS`/`RECRUIT_PKEYS` are **appended to, never reordered**, so existing saves keep their
column indices.

**Board shift.** `genRecruits` draws profiles from a per-recruit rng keyed on the id, so the profile
adds no draws to the pool stream — but the three inline `ri(r,…)` draws the old attributes consumed
are gone, so a generated board shifts **once** at this phase boundary (as does a generated world via
`genPlayer`). Stable per seed from here on.

---

## 9. Measured drift — the "measure after" half

The phase was built under an explicit *build first, measure after* decision, with the envelope refit
deferred. Measured over 2,010 games (`4-simprofile.js` → `7-upsets.js`):

| | Real | Pre-51 | **Post-51** |
|---|--:|--:|--:|
| Margin residual SD | 13.26 | 14.66 | **14.97** |
| Excess kurtosis | +0.32 | +0.245 | **+0.044** |
| Blowout upsets / season | 5.8 | 7.1 | **7.5** |
| Favourite by 7+ loses outright | 45.8 | 40.9 | **43.6** |

Read honestly:

- **SD widened by 0.31.** Expected — adding mean-zero channels adds variance, and there was no budget
  (`PM.gameForm` has been fitted to 0 since Phase 48 for exactly this reason).
- **The fat tail flattened, +0.245 → +0.044.** This is the real regression, and the mechanism is
  understood: replacing one large matchup term with several smaller, more independent ones is a
  central-limit effect, so outcomes get *more* Gaussian. The measured target is +0.32, and this moves
  away from it.
- **The mid-spread upset rate improved.** Favourite-by-7 losses went 40.9 → 43.6 against a real 45.8.

### Open for the tuning pass

1. Bring SD back toward 13.26 without flattening the tail further.
2. Recover kurtosis. The one-on-one speed clause is the natural lever — it is already the only
   asymmetric, heavy-tailed channel in the model, and widening its bite is the cheapest route to
   "rare but severe" rather than "uniformly noisier".
3. Neither is gated in this phase, by decision.

---

## Deliberately out of scope

- **Refitting the `PM` constants.** Deferred with the numbers above recorded so the pass starts with
  data rather than a re-measurement.
- **A per-attribute scouting fog.** Attributes are shown plainly on your own roster; recruits keep the
  existing single `scout` fog rather than gaining a per-attribute one.
- **Position changes.** `ovrBase` depends on `p.pos`, so moving a player between positions would
  re-rate him — potentially interesting, not modelled.
- **Directives 6+** (motor, composure, ego, morale, depth order, captain, class/age, stars, home
  state) — the next pass through the stat list.

# Phase 52 — Position-specific attributes, and the sim built from the players up

> **Status: SPEC — not built.** This records the design input and the decisions it forces, so
> implementation starts from an agreed model rather than from a conversation.

Two directives, given together, that turn out to be one phase:

> *"I want the player's attributes, multiplied by the correct scheme and good intangibles, affected
> by home field or big game or clutch moment, to BE the building blocks of the formula that reaches
> the harvested means we calculated earlier."*

and a position-by-position attribute breakdown (§2 below).

Phase 51 made Overall a derived readout of six generic attributes. This phase does two things
Phase 51 could not: it gives each position **its own vocabulary**, and it inverts the relationship
between attributes and the measured envelope.

---

## 1. The architectural inversion

Phase 51's house rule — *attributes redistribute ability, they never add it* — is enforced **per
matchup**. Every channel reads through `AD()`, which nets to zero for every individual play. That
guarantees the measured envelope holds, but it also guarantees attributes can never *create* a
mismatch: the constraint fires before talent gets to do anything.

The measured data says the constraint belongs at a different level. `cfb-averages.md` §3,
signature 1:

> **The league aggregate barely moves; the split does everything.** Points *per team* stay in a
> 26.4–29.1 band across every mismatch bucket. A 31-point mismatch is not a higher-scoring game —
> it's the same amount of football distributed 50–8 instead of 27–26.

So "redistribute, never add" is **empirically true of real football** — at the level of the league,
not the level of the snap. Real football conserves the aggregate and lets talent decide the split.

| | Phase 51 | Phase 52 |
|---|---|---|
| Constraint level | Per matchup, by construction (`AD` nets to 0) | Per league, by calibration |
| Talent gap → outcome gap | Capped near what `adv` already carried | The gap **is** the model |
| Where the means come from | Fitted constants (`PM.cmpBase`, …) | Emergent; constants calibrated so the league lands on 26.9 |
| Attributes are | Mean-zero garnish on a fitted formula | The formula |

### Why this should also fix the tail

Phase 51's post-mortem (`attributes.md` §9) diagnosed its own regression without naming the cause:

> replacing one large matchup term with several smaller, more independent ones is a central-limit
> effect, so outcomes get *more* Gaussian

**Additive mean-zero channels are Gaussian by construction.** Excess kurtosis fell to +0.044 against
a measured +0.32. Real football's fat tail is a *compounding* phenomenon: a bad line meets a great
rush → the QB is pressured → throws degrade → drives stall → the defense stays on the field → it
gets worse. Multiplicative and path-dependent.

A bottom-up model produces that structurally. The fat tail is not a knob to tune back in; it is a
consequence of no longer flattening it. This reframes item 2 of the deferred tuning pass.

### Precedent: Phase 49 already works this way

```
rate(family) = PN.base[family] × poolProp(group) × road × calm
```

*"The league mean is a constant, the spread is the roster."* Fitted by `15-penfit.js` against **two**
targets — mean 6.01 flags **and** true team-level SD 0.94 against a measured 0.95. That is this
architecture, already validated on one system. Phase 52 generalizes it to the whole sim.

`cfb-averages.md` §5 independently recommends the same move for home field (2.5 in a nothing game →
4.8 when both teams are ranked), calling it *"the honest way to deliver 'my team plays up for big
games' without inventing a motivation fudge factor."*

### What is fittable, and what is not

**Fittable.** `cfb-averages.md` §3 buckets on expected margin and notes it *"maps directly onto the
sim's `adv`… the most directly usable table here."* An 8-row target curve for the talent-gap →
outcome-gap translation, plus turnover splits, drive mix, and §6's tail shape.

**Not fittable.** No team box score says how much of a completion was throw accuracy versus route
running versus coverage. The **internal split stays football judgment.** What changes is that it
becomes judgment about *proportions within a calibrated total* rather than about magnitudes that
must sum to zero. Better constrained; still not measured. This must be stated in the shipped doc.

---

## 2. The attribute vocabulary — 23

Grouped by what they are, with the directive text that motivated each.

### General (every position)

| Key | Name | Owns |
|---|---|---|
| `spd` | Speed | Top end. The tail of the gain draw; deep routes |
| `acc` | Acceleration | Burst and start/stop. *"Breaking a run after avoiding/breaking a tackle"*; first step off the edge; separation at the break |
| `agi` | Agility | *"How well speed is kept up when changing direction or start/stop"* |
| `str` | Strength | Raw power |
| `dur` | Durability | Injury and fatigue resistance |
| `adp` | **Adaptability** | *"How well a player can change positions."* See §5 — this is a new **mechanic**, not just a rating |

### Mental — split in two

| Key | Name | Owns |
|---|---|---|
| `awr` | Awareness | **In-play recognition and reaction**: not falling for play action, blitz pickup, hot routes, run fits, RB vision (*"picking the right spots to run"*), coverage recognition |
| `iq` | Football IQ | **Pre-snap and scheme mastery**: *"Reading a Defense"*, protection calls, option-route decisions, and how much of a complex scheme a player can actually run |

> **Why split.** The directive assigns awareness a job at nearly every position. That is precisely
> the failure Phase 51 caught with strength — a stat that reaches a play through many routes at once
> becomes strictly the best build (68% vs 48% at equal OVR). Splitting recognition from mastery gives
> each a distinct channel and halves the concentration. `iq` is also the natural hook for
> `SCHEME_ATTR_W`: a complex scheme should *cost* something to run.
>
> Carried at: QB, C, LB, S — the positions that make calls. **Open question — confirm.**

### Quarterback

| Key | Name | Owns |
|---|---|---|
| `thp` | Throw Power | Deep-ball velocity; the pass gain tail; tight-window throws |
| `tha` | Throw Accuracy | Completion mean; interception avoidance |
| `tor` | Throw on the Run | *"Make this a separate attribute."* Gates every throw off-platform or outside the pocket |

### Ball carrier

| Key | Name | Owns |
|---|---|---|
| `elu` | Elusiveness | Making a defender miss (juke/spin). Distinct from `agi`, which is the physical basis |
| `btk` | Break Tackle | Power through contact |
| `car` | Carrying | Ball security. **Not in the directive** — added because fumbles currently have no per-player owner. **Open question — confirm** |

### Receiving

| Key | Name | Owns |
|---|---|---|
| `cth` | Catching | The catch point. Contested catch is `cth + str`. **Also the defensive takeaway** — the directive lists "catch" under LB man coverage, so this replaces Phase 51's `bal` |
| `rte` | Route Running | Route correctness; separation is `rte + agi + spd + acc` |

### Blocking / front

| Key | Name | Owns |
|---|---|---|
| `rbk` | Run Block | The run floor — displacement at the point of attack |
| `pbk` | Pass Block | The pocket — meets `prs` at the sack check |
| `rst` | Run Stop | Block shedding and gap control — meets `rbk` |
| `prs` | Pass Rush | Getting home — meets `pbk` |

> *"Run/Pass Block are technique, and technique and natural athleticism go hand in hand"* — so
> technique stats are **generated correlated with** their physical basis rather than independently.
> See §4.

### Coverage / tackling

| Key | Name | Owns |
|---|---|---|
| `mcv` | Man Coverage | Mirroring a route. `mcv + spd + agi + acc + awr + cth + str` |
| `zcv` | Zone Coverage | Spacing and passing off. `zcv + awr + agi +` a little `spd` |
| `tkl` | Tackling | Bringing him down; limiting YAC |

### Kicking

| Key | Name | Owns |
|---|---|---|
| `kpw` | Kick Power | Range — the distance a FG stays live, and punt net |
| `kac` | Kick Accuracy | Placement — FG% at range, punt directional/coffin-corner |

Phase 51 mapped these onto `str` and `awr`, which was defensible when specialists had no attributes
of their own but leaves a 90-rated kicker indistinguishable from a 70 on anything but those two. They
now get their own pair. Per `cfb-clutch.md`, **neither is pressure-sensitive — kickers measurably do
not choke.**

**Total: 25 attributes across 15 positions.**

---

## 3. The position matrix

`POS_ATTR_W` remains the single source of truth for **both** the weighting and *which attributes a
player even has* — weight 0 means the field is not stored. Rows still sum to 1, so `ovrBase` and
`ovrIn` work unchanged.

| Pos | Attributes carried | n |
|---|---|--:|
| QB | spd acc agi str awr **iq** dur adp · **thp tha tor** · elu btk car | 14 |
| RB | spd acc agi str awr dur adp · elu btk car cth rte · pbk rbk | 14 |
| WR | spd acc agi str awr dur adp · cth rte elu btk car | 12 |
| TE | spd acc agi str awr dur adp · cth rte elu btk car · rbk pbk | 14 |
| OT | spd acc agi str awr dur adp · rbk pbk | 9 |
| OG | spd acc agi str awr dur adp · rbk pbk | 9 |
| C | spd acc agi str awr **iq** dur adp · rbk pbk | 10 |
| DE | spd acc agi str awr dur adp · prs rst tkl | 10 |
| DT | spd acc agi str awr dur adp · prs rst tkl | 10 |
| LB | spd acc agi str awr **iq** dur adp · prs rst tkl · mcv zcv cth | 14 |
| CB | spd acc agi str awr dur adp · mcv zcv cth tkl | 11 |
| **FS** | spd acc agi str awr **iq** dur adp · mcv **zcv** cth tkl | 12 |
| **SS** | spd acc agi str awr **iq** dur adp · **mcv** zcv cth **tkl** | 12 |
| K | str awr dur adp · **kpw kac** | 6 |
| P | str awr dur adp · **kpw kac** | 6 |

Average ≈ 12 against Phase 51's 6.

**FS vs SS carry the same list, weighted very differently** — the directive: *"A free safety needs
speed and awareness as they zone cover a lot of space. Strong safeties are more about tackling and
occasionally coverage."* So FS tilts `spd`/`awr`/`iq`/`zcv`; SS tilts `tkl`/`str`/`mcv`. Same
same-list-different-row pattern as OT vs OG.

### Within-position weighting carries real directive detail

- **OT vs OG.** *"A tackle needs more agility and pass-block technique because they go against speed
  rushers. A guard needs more pure strength because they face tackles and bull rushers."* Same
  attribute list, materially different rows — OT tilts `agi`/`pbk`, OG tilts `str`/`rbk`.
- **TE is WR + OL**, with `awr` weighted into both blocking channels.
- **Free vs strong safety.** *"A free safety needs speed and awareness as they zone cover a lot of
  space. Strong safeties are more about tackling and occasionally coverage."* Two archetypes inside
  one `S` row. **Open question:** split `S` into `FS`/`SS` as real position codes (touches roster
  generation, depth charts, imports, the draft, every lab) or let the archetypes emerge from
  attribute spread within one row? **Recommend: keep one `S` row for this phase**, revisit with the
  position-change mechanic in §5, which makes the distinction playable anyway.

---

## 4. Generation — technique correlates with athleticism

*"Technique and natural athleticism go hand in hand."*

`genAttrs` currently draws an independent triangular tilt per attribute, then subtracts the weighted
mean. With 23 attributes, independent draws would produce incoherent players — a 92-strength guard
with 55 run block. Technique stats are therefore drawn as **their basis plus a smaller independent
component**:

```
rbk = w·basis(str, awr) + (1-w)·independent
pbk = w·basis(str, agi, awr) + (1-w)·independent
```

The mean-zero-tilt guarantee is applied **after** correlation, so `ovrBase` still returns exactly the
ability the player was generated with.

This also matters for the fat tail: correlated attributes make genuinely bad units *coherently* bad,
which is what compounds into blowouts. Independent draws would average that away — the same
central-limit trap as §1.

---

## 5. Adaptability is a mechanic, not a rating

Phase 51 listed position changes as explicitly out of scope: *"`ovrBase` depends on `p.pos`, so
moving a player between positions would re-rate him — potentially interesting, not modelled."*

`adp` is the enabler, and per the directive it is deliberately simple:

> *"Adaptability is basically just a multiplier or a divider on how good someone is away from their
> original position."*

So there is no profile-carry model. Moving a player to a new position re-derives his Overall under
the new `POS_ATTR_W` row — which already penalizes him naturally, since a safety's profile scores
badly against a linebacker's weighting — and `adp` **scales that penalty**:

```
ovrAt(p, newPos) = ovrBase(p, newPos) − posPenalty(p.pos → newPos) × (1 − adpScale(p))
```

`adpScale` runs ~0 for a rigid specialist to ~1 for a true tweener. Attributes the new position needs
that he never carried are seeded from his physical basis at the same discount, so nothing is free.

Position distance matters: S→LB or OG→OT is cheap, WR→DT is not. A small `POS_DIST` table, or simply
the cosine distance between the two `POS_ATTR_W` rows — which is free, already normalized, and stays
correct automatically as the rows are tuned. **Recommend the derived version.**

This is a **new roster-management feature** with real UI (a "change position" action with a projected
Overall preview) and real depth in recruiting — a high-`adp` prospect is worth more than his stars say.

Scope note: this is the one item with no sim dependency at all. It can ship independently, before or
after the rest.

---

## 6. Storage

`SAVE_PKEYS` is a fixed column list; anything outside it lands in a per-player `ext` object, which is
far less efficient. Adding ~17 sparse keys to a 23-column list would mean every one of ~11.3k
players carrying mostly-null columns.

**Proposed:** attributes move to a single packed per-player array `p.at`, ordered by that position's
attribute list (derivable from `p.pos`). Self-describing, dense, no nulls, and it keeps
`SAVE_PKEYS` append-only for everything else. Needs measuring against the ~5 MB/origin
`localStorage` cap — current saves run ~1.4 MB.

---

## 7. Sim channel map — what each attribute reaches

Each play family becomes **one unit contest + one man contest**, then a shape draw. Phase 48.1's
measured quantile tables survive: they become the shape a matchup resolves *into*, selected and
shifted by the contest, rather than a fixed draw.

### Pass

```
protection = pbk(OL pool, +RB/TE help) vs prs(rush pool)      → pressure probability
             ├─ QB escape: elu, str, agi, btk                  → sack avoided, becomes scramble
             └─ scramble:  spd, agi, elu, tor                  → run, or throw on the run at tor
separation = rte + agi + spd + acc (WR) vs mcv|zcv + awr + acc (DB)
             └─ scheme selects mcv or zcv as the coverage read
accuracy   = tha, degraded by pressure; tor substituted off-platform
catchPoint = cth (+ str when contested) vs cth (defender)
completion = base × accuracy × separation × catchPoint
yards      = recQ shape, shifted by separation; tail by spd/thp; YAC by elu/btk/acc vs tkl
INT        = f(tha, awr, iq, pressure) vs f(cth, zcv, awr)
```

### Run

```
push    = rbk + str + awr (OL) vs rst + str (front)            → the floor
crease  = agi + acc (RB) vs awr + tkl (front)
break   = elu vs tkl; btk + str vs str + tkl
burst   = acc                                                   → after the break
tail    = spd vs secondary spd
fumble  = car vs tkl (+ str)
```

### Mental gates (both)

- `awr` — play action, blitz pickup, hot routes, run fits
- `iq` — protection calls, option routes; damps the Phase 46 concept bonuses; **gates how much of a
  complex scheme a team actually executes**

### Multiplicands on top (the directive's second half)

```
× scheme (ovrIn already; SCHEME_ATTR_W picks which attributes the system reads)
× intangibles (comp reshape — Phase 50; mot pursuit/fade; morale)
× HFA scaled by stakes (2.5 → 4.8, cfb-averages §5)
× pressure (Phase 50 clutch)
```

### Gadget

*"Jet sweeps and gadget plays turn the WR into a RB and the stats count as a RB too."* A WR carry
resolves through the **run** channels and books as a rush attempt. Cheap to honor once the run
family reads `elu`/`btk`/`acc`/`car`, which WR carries.

---

## 8. What this does to the gates

The `simlab` **build-vs-build** check is currently the operational definition of Phase 51's rule: it
asserts that no specialization wins at equal OVR. Under Phase 52 that assertion is **wrong by
design** — it encodes the constraint being moved.

It is replaced by a **calibration** check: rosters built at a given talent gap must produce the
outcome gap `cfb-averages.md` §3 measures, within tolerance, across all eight spread buckets. Same
spirit — an operational definition of the rule — but the rule is now "the league reproduces measured
football," not "nothing may win."

Also needed:
- A much wider build matrix. 23 attributes across 14 positions is far more surface for one stat to
  quietly become dominant through multiple routes (the §2 warning about `awr`).
- Tail shape as a gate, not just an observation: SD, skew, excess kurtosis against 13.26 / +0.130 /
  +0.319.
- `SIM_MODEL` bump — pre-v7 games decline replay, same contract as Phases 48–51.
- `cfb-averages.md` §4 refresh: it predates Phase 48 and describes gaps (inverted run/pass, 9.9
  drives, absent 4th down) that are closed. It currently documents a sim that no longer exists.

---

## 9. Decisions (all settled)

1. **Football IQ** — **split** from awareness. See §9a, which turned out to be the most important
   design point in the phase.
2. **Carrying** — **yes**, `car` ships.
3. **FS/SS** — **real position codes.** `S` splits into `FS` and `SS`. Cost is in §9b.
4. **Kicker/punter** — **give them `kpw`/`kac`.** Leg power and placement stop borrowing `str`/`awr`.
5. **Adaptability** — *"basically just a multiplier or a divider on how good someone is away from his
   original position."* Simpler than §5's profile-carry model: `adp` scales the OVR penalty for
   playing out of position, and §5 is amended to that.

### 9a. Awareness and IQ own the FLOOR. Athleticism owns the TAIL.

> *"Those two ARE really important, so a player with lower technique and abilities can have more
> awareness and still contribute but isn't as explosive."*

This maps onto structure the engine already has. `AT` distinguishes two ends of the gain draw:

- `floorAdd(u,d,w)` — bites at **low `u`**, the bottom of the draw, where plays get stuffed.
- `tailAdd(u,d,w)` — bites at **high `u`**, the top, where they break.

So the rule is:

| Owns | Attributes | Effect |
|---|---|---|
| **The floor** | `awr`, `iq` (+ `str`, `rbk`/`rst` at the point of attack) | Fewer stuffs, fewer negative plays, fewer mistakes. **Explicitly no tail contribution** |
| **The tail** | `spd`, `acc`, `elu`, `thp`, `rte` | Explosive plays. **No floor contribution** |

A smart, slow player **rarely loses a play and never breaks one.** A raw, explosive player is
boom-or-bust. Both can carry the same Overall, and they are genuinely different footballers.

**This is also the fix for the tail problem in §1 and §11.** If roster construction determines the
*shape* of a team's outcome distribution and not merely its mean, the league becomes a **mixture of
distributions** — and a mixture has excess kurtosis by construction. Veteran, high-IQ rosters produce
narrow, boring games; young, explosive, low-`awr` rosters produce wild ones.

`cfb-averages.md` §6 arrived at the same shape from the data side and proposed faking it on the
per-game `form` term: *"a mostly-calm draw with a rare blow-up reproduces the right shape — p=0.07,
wild=20, calm=4 measured +0.64 kurtosis vs the real +0.32."* That would be an invented mixture with
no cause. This one is **earned from the roster**, which is the same reasoning Phase 50 used to reject
a clutch *rating* in favour of clutch as variance, and Phase 49 used to make discipline a roster
property rather than a flat tax.

Consequence for the gates: a "tail shape" check is not enough. There must be a check that **two
rosters at equal Overall produce different outcome variance** in the predicted direction — the direct
analogue of Phase 49's team-level SD check (measured 0.94 against a real 0.95).

### 9b. What the FS/SS split costs

`S` is a single-letter code threaded through roster generation, pools, coverage assignment, imports,
the draft, awards, records and every lab. Concretely it touches:

- `POS` / position lists and per-position roster counts (8 `S` → 4 `FS` + 4 `SS`)
- `POS_ATTR_W` — two rows: FS tilts `spd`/`awr`/`iq`/`zcv`; SS tilts `tkl`/`str`/`mcv`
- `gamePools` — `cover` (S ×0.75) and `tkl` (S ×0.8) split into two entries each
- `coverDef` — the TE → S → LB assignment ladder
- `posSide`, the import schema's position validation, the blank template
- **Migration v48** — every existing `S` on 134 rosters is assigned FS or SS, deterministically from
  his own profile (a fast/aware safety becomes FS, a strong/tackling one SS) so depth charts survive
- Position filters and labels across the roster, recruit, draft and award screens

Worth doing — the two are genuinely different positions and the directive describes them as such —
but it is the widest-surface item in the phase and should land on its own commit.

---

## 10. Suggested sequencing

| Step | Contents | Why this order |
|---|---|---|
| **1** | **Fitting harness** — extend `4-simprofile`/`5-compare` into a scored loop against §3's eight-bucket curve and §6's tail | Pure gain regardless of scope. Tells us *today*, with numbers, how much of the curve the current sim reproduces. Nothing else is verifiable without it |
| **2** | Attribute vocabulary + generation + storage + migration (v48) | Prerequisite for any channel work. No sim behaviour change yet — `ov` derived identically, so the envelope must not move. A real test of the migration |
| **3** | Rebuild play resolution bottom-up, **one family at a time** — pass, then run, then turnovers — re-measuring after each | Isolates which family moved which measured number |
| **4** | Calibrate global constants to the league aggregate + the §3 split curve | The payoff step |
| **5** | Replace the build-vs-build gate with the calibration gate; widen the build matrix; add tail gates | Must come last — it is the gate that would otherwise fight steps 3–4 |
| **6** | *(separable)* Adaptability + the position-change UI | No sim dependency |

Step 2 has a useful property: if the migration is right, **the measured envelope should not move at
all**, because `ov` is still derived from a re-centred profile. That makes it a clean checkpoint
before any behaviour changes.

---

## 11. Measured baseline (step 1, done)

`tools/cfb-data/4-simprofile.js` was profiling a league with **no attribute profiles** — see the
correction box in `attributes.md` §9. Fixed; `FLAT=1` reproduces the old behaviour. All figures
below are the corrected measurement over 2,010 games.

### The sim under-scores and over-separates

| | Real | Sim | |
|---|--:|--:|---|
| **Points / team** | **26.9** | **22.6** | **−16%** |
| **Points / drive** | **2.28** | **1.82** | **−20%** |
| **Average margin** | **16.2** | **20.9** | **+29%** |
| Total yards | 383 | 390 | +2% ✓ |
| Plays | 67.5 | 65.8 | −3% ✓ |
| Drives | 11.8 | 12.4 | +5% ✓ |
| Yards / play | 5.67 | 5.92 | +4% ✓ |
| Completion % | 61.1 | 60.6 | −1% ✓ |
| Yards / attempt | 7.29 | 7.46 | +2% ✓ |
| **Yards / carry** | **4.27** | **5.20** | **+22%** |
| **4th-down conv %** | **52.4** | **36.2** | **−31%** |
| **Punts** | **4.32** | **5.28** | **+22%** |
| Turnovers | 1.38 | 1.34 | −3% ✓ |
| Penalties | 6.0 | 5.0 | −16% |
| Overtime % | 4.7 | 2.9 | −39% |

**This is a single coherent failure, and it is exactly signature 1 inverted.** `cfb-averages.md` §3
says real football holds the aggregate at ~26.9 per team and lets talent decide the split. The sim
does the opposite: **too little aggregate (22.6) and too much split (margin 20.9 vs 16.2).**

The volume metrics are all fine — yards, plays, drives, completion %, Y/A are within a few percent.
So the ball moves like real football and then **drives don't finish**: points per drive is 20% light,
punts are 22% high, and 4th-down conversion is 31% low. The scoring shortfall has *moved* since
`cfb-averages.md` §4 was written — that section attributed it to too few drives (9.9 vs 11.8), which
Phase 48 fixed. It is now a per-drive **efficiency** problem, and §4 needs updating to say so.

### The tail is the architecture problem

| | Real | Sim |
|---|--:|--:|
| Residual SD | 13.26 | 14.60 |
| Skew | +0.130 | −0.017 |
| **Excess kurtosis** | **+0.319** | **−0.136** |
| Blowout upsets / season | 5.8 | 6.7 |
| Fav by 7+ loses outright | 45.8 | 46.4 ✓ |
| Fav by 14+ loses outright | 8.0 | 11.4 |

Upset *rates* are close to right at the mid-spread. The **shape** is not: real football is thin
through the ordinary range and ~2.4× fat at the extreme; the sim is thinner than a Gaussian at both
ends. Giving players real attributes made this *worse* (+0.044 → −0.136), which is the measured
confirmation of §1 — additive mean-zero channels Gaussianize, and more of them Gaussianize harder.

### What this makes the calibration target

1. **Recover ~4.3 points/team without adding yards.** The ball already moves correctly; drives must
   finish. Red zone, 4th down, and whatever is converting yardage into punts.
2. **Narrow the average margin from 20.9 to 16.2** while *widening* the extreme tail. Fewer ordinary
   blowouts, more rare catastrophic ones — the §6 shape.
3. **Y/C from 5.20 to 4.27**, the largest remaining per-play error and a plausible contributor to
   (1) via drive length.

Targets (1) and (2) are in direct tension under the current architecture — anything that tightens
margins also flattens the tail. That is the strongest practical argument for the rebuild: compounding
matchups produce a narrow body *and* a fat tail, which additive noise cannot.

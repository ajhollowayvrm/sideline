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
| **Ranked board** | **4,158** | |

The blue-chip *fraction* is the one thing SIDELINE already has right (11.2% against 11.1%). What it
has wrong is the shape of the tail: the sim splits 3★/2★ at 44.7/44.1, reality at **58.9/30.0**. The
real board is a broad three-star middle, not a barbell.

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

Two facts to carry into any model:

1. **Class size is flat across program quality** — 23.5 at the top, 19.9 at the bottom, a 3.6-player
   spread over the whole league. Scholarships are a constant. *What varies by two orders of
   magnitude is what those signatures are worth*: BCR runs 69.6% → 0.1%, and the top ten programs
   take **40.3%** of every blue-chip in the country.
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

Talent production is **enormously** concentrated, and this is where SIDELINE is furthest from
reality — `genRecruits` draws a prospect's home state with `pick(r, STATES)`, uniform across all 50:

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

From `23-reccompare.js`. `ok` < 6% off, `~` < 15%, `MISS` beyond.

| metric | real | sim | |
|---|--:|--:|---|
| blue-chip share of board | 11.1% | 11.2% | ok |
| 5★ / 4★ share | 0.9 / 10.2% | 0.9 / 10.3% | ok |
| **3★ / 2★ share** | **58.9 / 30.0%** | **44.7 / 44.1%** | **MISS** |
| **ranked board size** | **4,158** | **3,400** | **MISS** −18% |
| **signs FBS** | **63.7%** | **81.7%** | **MISS** +28% |
| class size, mean | 20.2 | 20.7 | ok |
| **programs signing < 10** | **3.3%** | **15.1%** | **MISS** |
| blue-chip share of signees | 15.3% | 13.7% | ~ |
| BCR rolling 4yr | 14.1% | 13.0% | ~ |
| Gini of blue-chips | 0.772 | 0.835 | ~ |
| class-score persistence | 0.882 | 0.927 | ok |
| in-state share | 36.8% | 31.5% | ~ |
| **TX / FL / CA share of board** | **12.5 / 11.1 / 10.9%** | **2.0 / 2.1 / 2.0%** | **MISS** |

**The aggregates hide the defect, exactly as they did for nine phases of the sim.** Blue-chip share,
class size, Gini and persistence all look fine. The band table does not:

| band | real size | sim size | real BC% | sim BC% | real BCR | sim BCR |
|---|--:|--:|--:|--:|--:|--:|
| 1–10 | 23.5 | **4.2** | 40.3 | **10.9** | 69.6 | 100.0 |
| 11–25 | 21.5 | 18.0 | 35.4 | **67.0** | 44.5 | 94.5 |
| 26–50 | 19.8 | 14.7 | 19.0 | 21.8 | 15.6 | 22.5 |
| 51–90 | 19.5 | **25.0** | 5.1 | 0.2 | 2.6 | 0.1 |
| 91–134 | 19.9 | **25.0** | 0.2 | 0.0 | 0.1 | 0.0 |

In a representative SIDELINE class: **Georgia signs one player. Alabama signs three, Ohio State
five, Texas and LSU two.** USC and Clemson at prestige ~72 sign a full 25 that is essentially all
blue-chip, and everything below prestige ~55 signs 25 with zero.

**The cause is one mechanism.** `recruitFit` scores a program against a *target prestige per star
tier* — 88 / 70 / 50 / 32 — and the suitor draw in `genRecruits` scores on
`1 − |prestige − target| / 50` **with no over-tier floor** (the floor exists only in `recruitFit`,
which governs interest growth, not whether you make the board at all). Recruiting pull is therefore
a **band-pass filter**: a program *above* a tier is penalised exactly as hard as one below it.
Prestige ~72 is the optimal place in the game to recruit from, and being the best program in the
country is actively worse. Real pull is **monotonic in program quality** — a better program never
recruits a given player worse than a worse program does.

Every `reclab` invariant is green while this happens. `≥100 of 134 fill ≥18` passes because the mid
and low tiers all fill 25; `5★ mean landing prestige ≥ 80` passes at 86.5; and the ~20 programs
signing under 10 are precisely the blue-bloods nobody thought to check.

### The race is over before anyone plays it

The band table says `recruitFit` decides who is *on* a prospect's board. This says it also decides
who *wins* him. `advanceRecruiting`'s passive growth is `iv += (1.0 + fit*3.2) * (0.6 + r()*0.9)`
every week — for a good-fit program, ~4.4/week from a seeded base near 46, against a
`COMMIT_THRESH` of 68. Tracking a prestige-71 program's seeded 4★ relationships through one cycle
with **nobody acting at all**:

| | |
|---|--:|
| Past the commit bar by **week 7**, on passive growth alone | **86.7%** |
| Pinned at the 100 ceiling by Signing Day | **90.0%** |

**Everything Phases 33–38 layered on is moving a number that is already at its maximum** — the AI
concentrated-effort brain, NIL bidding, the league ripple, official-visit weekends, pitch angles,
double-down tokens, diminishing returns. A prestige-71 program seeded as a suitor on 119 of 3,400
signs **the same 25 players, 25 of them blue-chips**, whether the AI brain works its board or
nobody does.

This is the mechanical reason for three things already in the record: why Phase 37 had to weaken its
"aggressive push lands the target" qa check to merely *leading* him into Signing Day; why an
engaged coach is hard to distinguish from a hands-off one; and why the weekly loop reads as upkeep.
Where fit is good the actions are noise on a saturated number, and where fit is bad they cannot
overcome it.

It also relocates the **Phase 44 recruiting cliff**. That was fixed with an autopilot on the
assumption the engine starves a passive player — it does not. `advanceRecruiting` resolves a full
25-man class for a passive player team. The cliff is created in the **app layer** (the board model
plus `decayNeglect` eating the player's seeded interest), which is why `reclab` structurally could
not see it and still cannot while `advanceRecruiting` is all it drives.

**Two further instrument findings, recorded here because they change how the gates should be read.**
Convergence measures **81.7%** on a world built from the game's real `TEAMS`/`TEAM_STATE` arrays
against `reclab`'s **90%** on its own synthetic one — and 81.7% is exactly the "~80%" the Phase 37
design record admits to. And `reclab`, `rolllab` and `legacylab` still generate players at position
**`S`**, which Phase 52 replaced with FS/SS: `posAttrW('S')` silently falls back to the *linebacker*
row and `pickArch(r,'S')` returns `null`, so ~9.5% of every pool they validate is built through a
degraded path. That is the same defect Phase 53 fixed in `simlab`, never swept to the other labs.
`22-recprofile.js` therefore extracts the game's data arrays instead of copying them.

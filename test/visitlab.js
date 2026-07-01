/* Sideline VISIT LAB — standalone harness for the Phase 38 official-visit weekend engine.

   The visit engine lives in index.html (single source of truth). This harness EXTRACTS the VISIT
   ENGINE block (between the markers) and evals it here with the same tiny helpers, then asserts the
   model is sane: a weekend's quality multiplier rises with opponent quality / my form / a marquee
   billing, is bounded, the neutral case is ≈ 1.0, the mean over a representative slate is ≈ 1.0
   (so it replaces the old flat ×1.5 game-day bonus without moving the visit-interest envelope), the
   tier ladder is ordered, and the whole thing is deterministic (pure, no rng).

   Run:  node test/visitlab.js

   Offline lab (no browser). The in-browser QA gate (npm run qa) validates the integrated scheduler
   flow (book onto a home weekend, resolve on advance, caps + season budget); this validates the
   pure model itself. */

const fs = require('fs');
const path = require('path');

/* ---------- tiny helpers (must match index.html exactly) ---------- */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* ---------- extract the engine from index.html ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === VISIT ENGINE (Phase 38) START ===';
const END = '// === VISIT ENGINE (Phase 38) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find VISIT ENGINE markers in index.html'); process.exit(2); }
// const declarations don't leak from a direct eval (only functions do), so re-export within the same
// eval scope onto globalThis — keeps index.html the single source of truth for the table + the math.
eval(html.slice(i0, i1) + '\nObject.assign(globalThis,{VISIT_TIERS,rankPull,weekendQuality,weekendTier});');

/* ---------- assertion harness ---------- */
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } }
const approx = (a, b, eps) => Math.abs(a - b) <= eps;

/* ---------- checks ---------- */

// 1–3. Monotonic in opponent quality (better opponent → bigger stage).
const qTop = weekendQuality({ oppRank: 1, oppPrestige: 90, myRank: null });
const qMid = weekendQuality({ oppRank: 10, oppPrestige: 75, myRank: null });
const qUnranked = weekendQuality({ oppRank: null, oppPrestige: 60, myRank: null });
ok(qTop > qMid, 'a #1 opponent is a bigger weekend than a #10 (' + qTop.toFixed(3) + ' > ' + qMid.toFixed(3) + ')');
ok(qMid > qUnranked, 'a #10 opponent beats an unranked mid-prestige one (' + qMid.toFixed(3) + ' > ' + qUnranked.toFixed(3) + ')');
ok(weekendQuality({ oppRank: 5 }) > weekendQuality({ oppRank: 20 }), 'opponent rank is monotonic (#5 > #20)');

// 4. Monotonic in opponent prestige (a blueblood draws even unranked).
ok(weekendQuality({ oppRank: null, oppPrestige: 92 }) > weekendQuality({ oppRank: null, oppPrestige: 45 }),
  'a high-prestige unranked opponent beats a low-prestige one');

// 5. Monotonic in my form.
ok(weekendQuality({ oppRank: 10, myRank: 3 }) > weekendQuality({ oppRank: 10, myRank: null }),
  'a ranked home team makes the weekend bigger than an unranked one');
ok(weekendQuality({ oppRank: 10, myRank: 3 }) > weekendQuality({ oppRank: 10, myRank: 22 }),
  'my form is monotonic (#3 > #22)');

// 6. Marquee: both ranked beats the same matchup with me unranked.
const marquee = weekendQuality({ oppRank: 6, myRank: 8 });
const oneSided = weekendQuality({ oppRank: 6, myRank: null });
ok(marquee > oneSided, 'a both-ranked marquee tops the same opponent with me unranked (' + marquee.toFixed(3) + ' > ' + oneSided.toFixed(3) + ')');
// the marquee bump only fires when BOTH are top-15
ok(weekendQuality({ oppRank: 6, myRank: 20 }) < marquee, 'marquee needs BOTH teams top-15 (me #20 gets no clash bump)');
// Phase 40: a rivalry weekend is always a bigger draw than the same non-rivalry weekend
ok(weekendQuality({ oppRank: 22, rivalry: true }) > weekendQuality({ oppRank: 22 }), 'a rivalry weekend outdraws the same non-rivalry one');
ok(weekendQuality({ rivalry: true }) > weekendQuality({}), 'even an unranked rivalry weekend beats a neutral one');

// 7–8. Bounded [0.6, 1.7] at the extremes.
const qMax = weekendQuality({ oppRank: 1, oppPrestige: 99, myRank: 1 });
const qMin = weekendQuality({ oppRank: null, oppPrestige: 10, myRank: null });
ok(qMax <= 1.7 + 1e-9 && qMax >= 0.6, 'top-of-the-world weekend is bounded ≤ 1.7 (' + qMax.toFixed(3) + ')');
ok(qMin >= 0.6 - 1e-9 && qMin <= 1.0, 'a cupcake home game floors at ≥ 0.6 (' + qMin.toFixed(3) + ')');
// sweep a wide grid: never escapes the band
let escaped = false;
for (let orank = 0; orank <= 30; orank++) for (let pr = 10; pr <= 99; pr += 11) for (let mr = 0; mr <= 30; mr += 5) {
  const q = weekendQuality({ oppRank: orank || null, oppPrestige: pr, myRank: mr || null });
  if (q < 0.6 - 1e-9 || q > 1.7 + 1e-9) escaped = true;
}
ok(!escaped, 'quality stays within [0.6, 1.7] across a wide input grid');

// 9. Neutral case ≈ 1.0 (unranked opp, mid prestige, unranked me).
ok(approx(weekendQuality({ oppRank: null, oppPrestige: 60, myRank: null }), 1.0, 1e-9),
  'the neutral matchup is exactly 1.0 (envelope baseline)');

// 10. Mean over a representative slate ≈ 1.0 (envelope centering — replaces the flat ×1.5 cleanly).
// A realistic home slate: most opponents unranked (~75%), prestige spread around ~60, me usually unranked.
let sum = 0, n = 0;
for (let i = 0; i < 4000; i++) {
  // deterministic pseudo-spread (no rng dependency): cycle through plausible matchups
  const oppRanked = (i % 4 === 0);                 // ~25% of home games vs a ranked team
  const oppRank = oppRanked ? (1 + (i % 25)) : null;
  const oppPrestige = 45 + (i % 35);               // 45..79, centered ~62
  const meRanked = (i % 3 === 0);                  // ~33% of the time I'm ranked
  const myRank = meRanked ? (1 + (i % 25)) : null;
  sum += weekendQuality({ oppRank, oppPrestige, myRank }); n++;
}
const mean = sum / n;
ok(mean > 0.95 && mean < 1.12, 'mean weekend quality over a representative slate ≈ 1.0 (' + mean.toFixed(3) + ')');

// 11–13. Tier ladder: ordered, labelled, covers the band.
ok(weekendTier(qMin) === 'Quiet', 'a floored weekend reads "Quiet" (got ' + weekendTier(qMin) + ')');
ok(weekendTier(1.0) === 'Solid', 'the neutral ~1.0 weekend reads "Solid" (got ' + weekendTier(1.0) + ')');
ok(weekendTier(qMax) === 'Marquee', 'the top weekend reads "Marquee" (got ' + weekendTier(qMax) + ')');
// monotonic, non-decreasing tier index as q climbs
let lastIdx = -1, tierMono = true;
for (let q = 0.6; q <= 1.7; q += 0.02) { const idx = VISIT_TIERS.indexOf(weekendTier(q)); if (idx < lastIdx) tierMono = false; lastIdx = idx; }
ok(tierMono && lastIdx === 3, 'tier label is non-decreasing in quality and reaches Marquee');

// 14. rankPull saturates correctly (1.0 at #1, 0 unranked, decreasing).
ok(approx(rankPull(1), 1.0, 1e-9) && rankPull(26) === 0 && rankPull(null) === 0 && rankPull(5) > rankPull(15),
  'rankPull: 1.0 at #1, 0 past 25/unranked, monotonic');

// 15–16. Determinism (pure — same inputs reproduce exactly; argument object is not mutated).
const inp = { oppRank: 7, oppPrestige: 70, myRank: 12 };
const a = weekendQuality(inp), b = weekendQuality(inp);
ok(a === b, 'weekendQuality is deterministic for identical inputs');
ok(inp.oppRank === 7 && inp.oppPrestige === 70 && inp.myRank === 12, 'weekendQuality does not mutate its input');

/* ---------- report ---------- */
console.log((fail ? '✗' : '✓') + ' visitlab: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

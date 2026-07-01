/* Sideline CONTRACT LAB — standalone harness for the Phase 42 AD-expectations + contract engine.

   The contract engine lives in index.html (single source of truth). This harness EXTRACTS the engine
   block (between the CONTRACT ENGINE markers) and evals it here, then validates the pure model offline:
   the AD's mandate scales with prestige (and softens in year one); evaluateMandate reads a season the
   right way (a playoff goal needs a playoff berth, a bowl goal is met by ≥6 wins, etc.); the approval
   swing rewards meeting / punishes missing (and missing stings more); the initial contract scales with
   the job; the buyout tracks the money left; and an extension is offered only when overperforming.
   The in-browser QA gate validates the integrated flow (mandate set at kickoff, evaluated at season end,
   extension offer, the Home card).

   Run:  node test/contractlab.js */

const fs = require('fs');
const path = require('path');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === CONTRACT ENGINE (Phase 42) START ===';
const END = '// === CONTRACT ENGINE (Phase 42) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find CONTRACT ENGINE markers in index.html'); process.exit(2); }
// Function declarations leak out of sloppy eval; `const` bindings do not — return the ones we assert on.
const { MANDATE_TIERS } = eval(html.slice(i0, i1) + '\n;({MANDATE_TIERS})');

const results = [];
function check(name, cond, detail = '') { results.push({ pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }
const tierIdx = t => MANDATE_TIERS.indexOf(t);

// 1) mandate scales with prestige, softens in year one
check('Elite programs demand the playoff', seasonMandate(90, 3).tier === 'playoff');
check('Bottom programs just need progress', seasonMandate(35, 3).tier === 'progress');
check('Mandate is monotonic in prestige', [30, 50, 65, 78, 90].map(p => tierIdx(seasonMandate(p, 3).tier)).every((x, i, a) => i === 0 || x >= a[i - 1]));
check('Year one softens the mandate (honeymoon)', tierIdx(seasonMandate(75, 0).tier) < tierIdx(seasonMandate(75, 3).tier));
check('seasonMandate carries a label + kind + (for wins tiers) a threshold',
  (() => { const m = seasonMandate(40, 3); return m.label && m.kind === 'wins' && m.wins >= 3; })());

// 2) evaluateMandate reads a season correctly (higher goals subsume lower results)
const playoffM = seasonMandate(90, 3), bowlM = seasonMandate(60, 3), winsM = { kind: 'wins', wins: 7, tier: 'winning' };
check('Playoff mandate: met only by a playoff berth / title', evaluateMandate(playoffM, { playoff: true, w: 11, l: 2 }).met && !evaluateMandate(playoffM, { bowl: true, w: 9, l: 4 }).met);
check('Bowl mandate: met by a bowl / ≥6 wins, missed at 5–7', evaluateMandate(bowlM, { w: 6, l: 6 }).met && !evaluateMandate(bowlM, { w: 5, l: 7 }).met);
check('Conf mandate: a playoff berth satisfies it too', evaluateMandate({ kind: 'conf', tier: 'conf' }, { playoff: true }).met);
check('Wins mandate: threshold decides', evaluateMandate(winsM, { w: 7, l: 5 }).met && !evaluateMandate(winsM, { w: 6, l: 6 }).met);
check('evaluateMandate returns a detail string with the record', /\d+–\d+/.test(evaluateMandate(winsM, { w: 8, l: 4 }).detail));

// 3) approval swing: met positive, missed negative, missing stings ≥ meeting, tougher tier weighs more
check('Meeting the mandate lifts approval, missing drops it', mandateApprovalDelta(true, 'bowl') > 0 && mandateApprovalDelta(false, 'bowl') < 0);
check('Missing stings at least as much as meeting rewards', Math.abs(mandateApprovalDelta(false, 'bowl')) >= mandateApprovalDelta(true, 'bowl'));
check('A tougher mandate carries more approval weight', mandateApprovalDelta(true, 'playoff') > mandateApprovalDelta(true, 'progress'));
// 3b) graded evaluation (the career-balance pass): a respectable miss is 'near' (a light sting), not a full failure
check('evaluateMandate grades a bowl-eligible miss as "near"', evaluateMandate({ kind: 'conf', tier: 'conf' }, { w: 8, l: 4 }).grade === 'near');
check('evaluateMandate grades a within-2 wins miss as "near"', evaluateMandate({ kind: 'wins', wins: 8, tier: 'winning' }, { w: 6, l: 6 }).grade === 'near');
check('evaluateMandate grades a genuine collapse as "miss"', evaluateMandate({ kind: 'conf', tier: 'conf' }, { w: 3, l: 9 }).grade === 'miss');
check('A "near" miss stings far less than a clean miss', mandateApprovalDelta('near', 'conf') < 0 && mandateApprovalDelta('near', 'conf') > mandateApprovalDelta('miss', 'conf'));
check('A met season (8-4) HOLDS a good program (bowl mandate)', tierIdx(seasonMandate(84, 3).tier) <= tierIdx('bowl') && evaluateMandate(seasonMandate(84, 3), { w: 8, l: 4 }).met);
check('Two-year honeymoon (year 2 still eased)', tierIdx(seasonMandate(75, 1).tier) < tierIdx(seasonMandate(75, 3).tier));

// 4) initial contract scales with the job; buyout tracks the money left
const cLow = initialContract(40), cHi = initialContract(88);
check('A blueblood job pays more + runs longer', cHi.salary > cLow.salary && cHi.years >= cLow.years);
check('A fresh contract starts with all its years', cLow.yearsLeft === cLow.years && cHi.yearsLeft === cHi.years);
check('Buyout scales with salary × years left', buyoutOf({ salary: 4e6, yearsLeft: 3 }) > buyoutOf({ salary: 4e6, yearsLeft: 1 }));
check('Buyout is zero on an expired deal', buyoutOf({ salary: 5e6, yearsLeft: 0 }) === 0);

// 5) extension: offered only when overperforming; not when missed/insecure; a big year gives more
check('No extension when the mandate was missed', contractExtension(70, 80, false, 1) === null);
check('No extension when insecure (low approval)', contractExtension(70, 44, true, 1) === null);
check('An extension is offered when met + secure + running down', !!contractExtension(70, 60, true, 1));
check('No premature extension on a long deal (unless a standout year)', contractExtension(70, 60, true, 4) === null && !!contractExtension(70, 80, true, 4));
check('A standout year extends by more', contractExtension(70, 85, true, 1).addYears > contractExtension(70, 55, true, 1).addYears);
check('contractExtension is deterministic (pure)', JSON.stringify(contractExtension(70, 66, true, 2)) === JSON.stringify(contractExtension(70, 66, true, 2)));

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} contract-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

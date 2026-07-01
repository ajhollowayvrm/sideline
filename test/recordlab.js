/* Sideline RECORD LAB — standalone harness for the Phase 41 record-book engine.

   The record engine lives in index.html (single source of truth). This harness EXTRACTS the engine
   block (between the RECORD ENGINE markers) and evals it here, then validates the pure model offline:
   the category registry is well-formed (unique keys, every def has a stat/label), emptyRecords has all
   buckets, and applyRecord "keeps the max" correctly — a new high sets the record (broke:true), a lower
   value is ignored, a TIE keeps the original holder, and a non-positive value never records. The
   in-browser QA gate validates the integrated capture (game/season/career records fill in over a season).

   Run:  node test/recordlab.js */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === RECORD ENGINE (Phase 41) START ===';
const END = '// === RECORD ENGINE (Phase 41) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find RECORD ENGINE markers in index.html'); process.exit(2); }
// Function declarations (emptyRecords/applyRecord) leak out of sloppy eval; `const` bindings do not, so
// return the registry consts via a trailing expression that's still inside the engine's scope.
const { RECORD_DEFS, RECORD_BUCKETS } = eval(html.slice(i0, i1) + '\n;({RECORD_DEFS,RECORD_BUCKETS})');

const results = [];
function check(name, cond, detail = '') { results.push({ pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

// 1) registry is well-formed
check('Four buckets: game/season/career/team', JSON.stringify(RECORD_BUCKETS) === JSON.stringify(['game', 'season', 'career', 'team']));
const allDefs = RECORD_BUCKETS.flatMap(b => RECORD_DEFS[b]);
check('Every def has a key, label, unit', allDefs.every(d => d.key && d.label && d.unit));
check('Player defs (game/season/career) carry a stat', ['game', 'season', 'career'].every(b => RECORD_DEFS[b].every(d => d.stat)));
check('Record keys are globally unique', new Set(allDefs.map(d => d.key)).size === allDefs.length, allDefs.length + ' defs');
check('A meaningful set of categories', allDefs.length >= 25, allDefs.length + ' records tracked');

// 2) emptyRecords has all buckets, empty
const R = emptyRecords();
check('emptyRecords has all four (empty) buckets', RECORD_BUCKETS.every(b => R[b] && Object.keys(R[b]).length === 0));

// 3) applyRecord keeps the max
let r1 = applyRecord(R, 'game', 'g_pyds', 400, { name: 'A', teamId: 't1' });
check('First value sets the record (broke:true)', r1.broke && R.game.g_pyds.value === 400 && R.game.g_pyds.name === 'A');
let r2 = applyRecord(R, 'game', 'g_pyds', 350, { name: 'B', teamId: 't2' });
check('A lower value is ignored (broke:false, holder unchanged)', !r2.broke && R.game.g_pyds.name === 'A' && R.game.g_pyds.value === 400);
let r3 = applyRecord(R, 'game', 'g_pyds', 520, { name: 'C', teamId: 't3' });
check('A higher value breaks the record + returns the previous holder', r3.broke && R.game.g_pyds.name === 'C' && r3.prev && r3.prev.name === 'A' && r3.prev.value === 400);

// 4) a TIE keeps the original holder (strictly-greater beats)
const R2 = emptyRecords();
applyRecord(R2, 'season', 's_ryds', 1800, { name: 'First', teamId: 'x' });
const tie = applyRecord(R2, 'season', 's_ryds', 1800, { name: 'Second', teamId: 'y' });
check('A tie does NOT overwrite the original holder', !tie.broke && R2.season.s_ryds.name === 'First');

// 5) a non-positive value never records
const R3 = emptyRecords();
const zero = applyRecord(R3, 'game', 'g_sk', 0, { name: 'Z' });
const neg = applyRecord(R3, 'career', 'c_tkl', -5, { name: 'N' });
check('A zero / negative value never sets a record', !zero.broke && !neg.broke && !R3.game.g_sk && !R3.career.c_tkl);

// 6) value + meta are stored together
const R4 = emptyRecords();
applyRecord(R4, 'team', 't_gpts', 77, { name: 'Blowout U', teamId: 'bu', abbr: 'BU', year: 2029, detail: 'vs XYZ' });
const e = R4.team.t_gpts;
check('The stored entry carries value + all meta', e.value === 77 && e.abbr === 'BU' && e.year === 2029 && e.detail === 'vs XYZ');

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} record-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

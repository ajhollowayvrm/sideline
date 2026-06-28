/* Sideline AWARD LAB — standalone harness for the Phase 8 season-awards engine.

   The awards engine lives in index.html (single source of truth). This harness EXTRACTS the engine
   block (between the AWARDS ENGINE markers) and evals it here, then builds synthetic seasons with
   known statistical leaders and asserts the engine crowns them: Heisman = the best offensive season
   (winner-weighted), Defensive POY, Freshman of the Year (a freshman), per-conference POY, an
   All-America team (one per position), and Coach of the Year (record vs prestige). Pure + no rng, so
   results are a deterministic function of the season stats.

   Run:  node test/awardlab.js  */

const fs = require('fs');
const path = require('path');

const POS = [["QB", "off", 4, 1.4], ["RB", "off", 5, 1], ["WR", "off", 11, 1.2], ["TE", "off", 5, .8],
["OT", "off", 7, 1], ["OG", "off", 6, .9], ["C", "off", 3, .8],
["DE", "def", 6, 1.1], ["DT", "def", 6, 1], ["LB", "def", 10, 1.1], ["CB", "def", 9, 1.1], ["S", "def", 8, 1],
["K", "st", 2, .4], ["P", "st", 2, .3]];

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '// === AWARDS ENGINE (Phase 8) START ===';
const END = '// === AWARDS ENGINE (Phase 8) END ===';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 < 0 || i1 < 0) { console.error('Could not find AWARDS ENGINE markers in index.html'); process.exit(2); }
eval(html.slice(i0, i1));   // leaks awardOff/awardDef/computeAwards/…

let pid = 0;
function P(pos, yr, gs) { return { id: 'p' + (pid++), fn: 'F' + pid, ln: 'L' + pid, pos, yr, gs: Object.assign({ gp: 12 }, gs) }; }
function team(id, conf, prestige, rec, roster) { return { id, name: id.toUpperCase(), abbr: id.toUpperCase(), color: '#fff', conf, prestige, rec, roster }; }

const results = [];
function check(name, cond, detail = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }

/* a small league: a powerhouse with the stat leaders, a mid team, plus an overachiever */
const star = P('QB', 'JR', { pYds: 4200, pTD: 45, pInt: 6 });          // clear Heisman favorite (winning team)
const sack = P('DE', 'SO', { tkl: 60, sk: 18, dInt: 2 });             // clear defensive POY
const frosh = P('RB', 'FR', { rYds: 1600, rTD: 20 });                 // freshman phenom
const midWR = P('WR', 'SR', { rec: 90, reYds: 1300, reTD: 12 });
const teams = [
  team('pow', 'SEC', 92, { w: 13, l: 0 }, [star, sack, frosh, P('LB', 'JR', { tkl: 80, sk: 4 }), P('OT', 'SR', {})]),
  team('mid', 'SEC', 70, { w: 7, l: 6 }, [midWR, P('QB', 'SR', { pYds: 2600, pTD: 18, pInt: 12 }), P('CB', 'JR', { tkl: 40, dInt: 7 })]),
  team('aces', 'Big Ten', 40, { w: 11, l: 2 }, [P('QB', 'SO', { pYds: 3000, pTD: 28, pInt: 8 }), P('S', 'SR', { tkl: 70, dInt: 6 })]),
  team('dud', 'Big Ten', 88, { w: 3, l: 9 }, [P('WR', 'JR', { rec: 50, reYds: 700, reTD: 5 })]),
];
const aw = computeAwards(teams, 2027);

check('Heisman goes to the best offensive season', aw.heisman && aw.heisman.pid === star.id, aw.heisman && aw.heisman.name);
check('Heisman snapshot carries a score + line', aw.heisman && aw.heisman.score > 0 && /TD/.test(aw.heisman.line));
check('Defensive POY goes to the top defender', aw.poyDef && aw.poyDef.pid === sack.id, aw.poyDef && aw.poyDef.pos);
check('Freshman of the Year is a freshman', aw.freshman && aw.freshman.pid === frosh.id);
check('Conference POY computed per conference (SEC + Big Ten)', aw.byConf.SEC && aw.byConf['Big Ten'] && aw.byConf.SEC.off && aw.byConf['Big Ten'].def);
check('SEC offensive POY is the powerhouse QB', aw.byConf.SEC.off.pid === star.id);
check('All-America team has one per position that produced', aw.allAmerican.length > 0 && new Set(aw.allAmerican.map(a => a.pos)).size === aw.allAmerican.length);
check('All-America includes the QB and DE leaders', aw.allAmerican.some(a => a.pid === star.id) && aw.allAmerican.some(a => a.pid === sack.id));
check('All-Conference computed per conference (one per position)', aw.allConference.SEC && aw.allConference['Big Ten'] && new Set(aw.allConference.SEC.map(a => a.pos)).size === aw.allConference.SEC.length);
check('SEC All-Conference includes the SEC QB + DE leaders (not the Big Ten ones)', aw.allConference.SEC.some(a => a.pid === star.id) && aw.allConference.SEC.every(a => ['pow', 'mid'].includes(a.teamId)));
// Coach of the Year: 'aces' (11-2 at prestige 40) overachieved most vs expectation
check('Coach of the Year is the biggest overachiever', aw.coy && aw.coy.teamId === 'aces', aw.coy && `${aw.coy.abbr} ${aw.coy.rec}`);
check('CoY beats the underachieving blue-blood (dud 3-9 @88)', aw.coy.teamId !== 'dud');

/* empty season → null awards, no crash */
const none = computeAwards([team('x', 'SEC', 60, { w: 0, l: 0 }, [P('QB', 'FR', { gp: 0 })])], 2027);
check('No production → null awards (no crash)', none.heisman === null && none.poyDef === null && Array.isArray(none.allAmerican));

/* determinism: pure function of stats */
const a2 = computeAwards(teams, 2027);
check('Awards are deterministic (pure of stats)', JSON.stringify(aw) === JSON.stringify(a2));

const passed = results.filter(r => r.pass).length;
console.log(`\n===== ${passed}/${results.length} award-lab checks passed =====`);
process.exit(results.every(r => r.pass) ? 0 : 1);

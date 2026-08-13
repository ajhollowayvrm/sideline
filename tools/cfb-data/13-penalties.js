/* Step 13 — PENALTIES, measured.

   Two layers, because two different questions need two different sources:

   (a) THE TOP LINE — how many flags, for how many yards, and how much do teams differ.
       Comes free from `games.json` (2-harvest.js already stored `pen`/`peny` per team-game),
       so it costs no network and spans every harvested game. This layer answers the tuning
       questions: what is the mean, how wide is the team-to-team spread, is "discipline" a
       repeatable team trait (it must be, if COMPOSURE is going to drive it), and does being
       penalized actually cost you the game.

   (b) THE MIX — which penalties, on which down, in which quarter, offense or defense,
       pre-snap or live-ball. Needs the play-by-play, so this re-fetches ESPN summaries into
       its own resumable cache (pen-cache.json). The sim currently models pre-snap fouls only,
       so the pre-snap share is the number that says how much of real football that covers.

   Output: pen-profile.json + penalty-report.txt.  Resumable via pen-cache.json. */
const fs = require('fs');
const IDX = require(__dirname + '/index.json');
const GAMES = require(__dirname + '/games.json');
const FBS = new Set(['1', '4', '5', '8', '9', '12', '15', '17', '18', '37', '151']);
const CACHE = __dirname + '/pen-cache.json';
const OUT = __dirname + '/pen-profile.json';
const REPORT = __dirname + '/penalty-report.txt';
const CONC = 8;
const SKIP_FETCH = process.argv.includes('--no-fetch');

const out = [];
const say = s => { out.push(s); console.log(s); };
const pct = (a, b) => b ? (a / b * 100) : 0;
const f = (x, d = 2) => (x == null || !isFinite(x) ? '—' : x.toFixed(d));

/* ============================================================ *
 * (a) TOP LINE — from the existing box-score harvest, no network
 * ============================================================ */
const fbsIdx = IDX.filter(g => FBS.has(String(g.hc)) && FBS.has(String(g.ac)) && GAMES[g.id]);
const teamGames = [];   // one row per team-game
for (const g of fbsIdx) {
  const G = GAMES[g.id];
  if (!G || !G.h || !G.a) continue;
  const rows = [
    { tid: g.hid, opp: g.aid, year: g.year, home: 1, pen: G.h.pen, yds: G.h.peny, pf: g.hs, pa: g.as, rk: g.hr, ork: g.ar, oPen: G.a.pen, oYds: G.a.peny, plays: (G.h.ratt || 0) + (G.h.att || 0), drv: G.h.drv && G.h.drv.n },
    { tid: g.aid, opp: g.hid, year: g.year, home: 0, pen: G.a.pen, yds: G.a.peny, pf: g.as, pa: g.hs, rk: g.ar, ork: g.hr, oPen: G.h.pen, oYds: G.h.peny, plays: (G.a.ratt || 0) + (G.a.att || 0), drv: G.a.drv && G.a.drv.n },
  ];
  for (const r of rows) if (r.pen != null && r.yds != null) teamGames.push(r);
}

const mean = (arr, k) => arr.reduce((a, x) => a + (typeof k === 'function' ? k(x) : x[k]), 0) / arr.length;
const sd = (arr, k) => { const m = mean(arr, k); const g = x => (typeof k === 'function' ? k(x) : x[k]);
  return Math.sqrt(arr.reduce((a, x) => a + (g(x) - m) ** 2, 0) / arr.length); };
const quant = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };

const N = teamGames.length;
const mPen = mean(teamGames, 'pen'), mYds = mean(teamGames, 'yds');
const sdPen = sd(teamGames, 'pen'), sdYds = sd(teamGames, 'yds');

say('='.repeat(120));
say(`REAL PENALTY AVERAGES — ${fbsIdx.length} FBS-vs-FBS games, ${N} team-games (${Math.min(...fbsIdx.map(g => g.year))}–${Math.max(...fbsIdx.map(g => g.year))})`);
say('='.repeat(120));
say('\n1. NATIONAL — per team, per game');
say(`   penalties      ${f(mPen)}  (sd ${f(sdPen)})   p10 ${quant(teamGames.map(r => r.pen), .10)}  median ${quant(teamGames.map(r => r.pen), .50)}  p90 ${quant(teamGames.map(r => r.pen), .90)}  max ${Math.max(...teamGames.map(r => r.pen))}`);
say(`   yards          ${f(mYds, 1)}  (sd ${f(sdYds, 1)})   p10 ${quant(teamGames.map(r => r.yds), .10)}  median ${quant(teamGames.map(r => r.yds), .50)}  p90 ${quant(teamGames.map(r => r.yds), .90)}  max ${Math.max(...teamGames.map(r => r.yds))}`);
say(`   yards/penalty  ${f(mYds / mPen)}`);
const perSnap = mPen / mean(teamGames, r => r.plays || 0);
// NB: a team's flags include the ones it commits on DEFENSE, so this is flags per own scrimmage
// play, not an offensive foul rate. The off/def split in section 7 is what splits it.
say(`   per own scrimmage play  ${f(perSnap * 100, 2)}%   (${f(mean(teamGames, r => r.plays || 0), 1)} plays/team-game)`);
say(`   per drive           ${f(mPen / mean(teamGames.filter(r => r.drv), 'drv'))}`);
say(`   both teams combined ${f(mPen * 2, 1)} penalties for ${f(mYds * 2, 0)} yards per game`);

// distribution of a team-game's penalty count
const hist = {}; teamGames.forEach(r => hist[r.pen] = (hist[r.pen] || 0) + 1);
say('\n   team-game distribution:');
let line = '     ';
for (let i = 0; i <= 16; i++) if (hist[i]) line += `${i}:${f(pct(hist[i], N), 1)}%  `;
say(line);
const p0 = pct(teamGames.filter(r => r.pen <= 2).length, N), p10p = pct(teamGames.filter(r => r.pen >= 10).length, N);
say(`     ≤2 flags ${f(p0, 1)}% of team-games · ≥10 flags ${f(p10p, 1)}%`);

// home / away
const H = teamGames.filter(r => r.home), A = teamGames.filter(r => !r.home);
say('\n2. HOME vs ROAD');
say(`   home  ${f(mean(H, 'pen'))} for ${f(mean(H, 'yds'), 1)} yds`);
say(`   road  ${f(mean(A, 'pen'))} for ${f(mean(A, 'yds'), 1)} yds`);
say(`   road penalty premium: ${f((mean(A, 'pen') / mean(H, 'pen') - 1) * 100, 1)}% more flags, ${f((mean(A, 'yds') / mean(H, 'yds') - 1) * 100, 1)}% more yards`);

// by year
say('\n3. BY SEASON');
for (const y of [...new Set(fbsIdx.map(g => g.year))].sort()) {
  const s = teamGames.filter(r => r.year === y);
  say(`   ${y}   ${f(mean(s, 'pen'))} for ${f(mean(s, 'yds'), 1)} yds   (${s.length} team-games)`);
}

/* --- team-season discipline: the spread COMPOSURE has to reproduce --- */
const bySeason = {};
for (const r of teamGames) { const k = r.tid + '|' + r.year; (bySeason[k] = bySeason[k] || { tid: r.tid, year: r.year, n: 0, pen: 0, yds: 0 });
  bySeason[k].n++; bySeason[k].pen += r.pen; bySeason[k].yds += r.yds; }
const seasons = Object.values(bySeason).filter(s => s.n >= 8).map(s => ({ ...s, ppg: s.pen / s.n, ypg: s.yds / s.n }));
const ppgs = seasons.map(s => s.ppg).sort((a, b) => a - b);
say('\n4. TEAM-SEASON DISCIPLINE — the spread a composure rating has to span');
say(`   ${seasons.length} team-seasons (≥8 games)`);
say(`   mean ${f(mean(seasons, 'ppg'))} pen/game · sd ${f(sd(seasons, 'ppg'))}`);
say(`   p05 ${f(ppgs[Math.floor(ppgs.length * .05)])}  p25 ${f(ppgs[Math.floor(ppgs.length * .25)])}  median ${f(ppgs[Math.floor(ppgs.length * .5)])}  p75 ${f(ppgs[Math.floor(ppgs.length * .75)])}  p95 ${f(ppgs[Math.floor(ppgs.length * .95)])}`);
say(`   most disciplined ${f(ppgs[0])} · least ${f(ppgs[ppgs.length - 1])}  →  full range ${f(ppgs[0])}–${f(ppgs[ppgs.length - 1])} pen/game`);
say(`   the middle 90% of team-seasons live in ${f(ppgs[Math.floor(ppgs.length * .05)])}–${f(ppgs[Math.floor(ppgs.length * .95)])}`);

// how much of a team-game's penalty count is TEAM vs noise?
const withinSd = Math.sqrt(teamGames.reduce((a, r) => { const s = bySeason[r.tid + '|' + r.year]; return a + (r.pen - s.pen / s.n) ** 2; }, 0) / N);
const gpg = mean(seasons, 'n');
const betweenVar = Math.max(0, sd(seasons, 'ppg') ** 2 - withinSd ** 2 / gpg);   // shrink out sampling noise
say(`   game-to-game sd WITHIN a team-season: ${f(withinSd)}   true team-level sd: ${f(Math.sqrt(betweenVar))}`);
say(`   → only ${f(pct(betweenVar, betweenVar + withinSd ** 2), 1)}% of the variance in a single team-game is the TEAM; the rest is that night.`);
const bySorted = [...seasons].sort((a, b) => a.ppg - b.ppg), qn = Math.floor(bySorted.length / 5);
say(`   least-disciplined quintile ${f(mean(bySorted.slice(-qn), 'ppg'))} vs most-disciplined ${f(mean(bySorted.slice(0, qn), 'ppg'))} pen/game  → observed gap ${f(mean(bySorted.slice(-qn), 'ppg') - mean(bySorted.slice(0, qn), 'ppg'))}`);

// year-over-year repeatability — is discipline actually a trait?
const pairs = [];
for (const s of seasons) { const nxt = bySeason[s.tid + '|' + (s.year + 1)];
  if (nxt && nxt.n >= 8) pairs.push([s.ppg, nxt.pen / nxt.n]); }
const corr = a => { const mx = a.reduce((s, p) => s + p[0], 0) / a.length, my = a.reduce((s, p) => s + p[1], 0) / a.length;
  let sxy = 0, sx = 0, sy = 0; for (const [x, y] of a) { sxy += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2; }
  return sxy / Math.sqrt(sx * sy); };
say(`   year-over-year repeatability (team's pen/game, season N vs N+1): r = ${f(corr(pairs), 3)}  (${pairs.length} pairs)`);

/* --- does it cost you the game? --- */
say('\n5. DOES IT COST YOU THE GAME?');
const diffBuckets = [[-99, -5, 'you −5 or fewer'], [-4, -3, 'you −4..−3'], [-2, -1, 'you −2..−1'], [0, 0, 'even'], [1, 2, 'you +1..+2'], [3, 4, 'you +3..+4'], [5, 99, 'you +5 or more']];
say('   by penalty differential (your flags − theirs):');
for (const [lo, hi, lbl] of diffBuckets) {
  const s = teamGames.filter(r => { const d = r.pen - r.oPen; return d >= lo && d <= hi; });
  if (!s.length) continue;
  say(`     ${lbl.padEnd(18)} ${String(s.length).padStart(6)} team-games   win ${f(pct(s.filter(r => r.pf > r.pa).length, s.length), 1).padStart(5)}%   margin ${f(mean(s, r => r.pf - r.pa), 1).padStart(6)}`);
}
const pearson = (arr, fx, fy) => { const mx = mean(arr, fx), my = mean(arr, fy); let sxy = 0, sx = 0, sy = 0;
  for (const r of arr) { const dx = fx(r) - mx, dy = fy(r) - my; sxy += dx * dy; sx += dx * dx; sy += dy * dy; }
  return sxy / Math.sqrt(sx * sy); };
say(`   correlation, penalty-yard differential vs point margin: r = ${f(pearson(teamGames, r => r.yds - r.oYds, r => r.pf - r.pa), 3)}`);
say(`   correlation, own penalty yards vs own points:           r = ${f(pearson(teamGames, r => r.yds, r => r.pf), 3)}`);

// good teams vs bad teams
say('\n6. BY QUALITY (AP rank at kickoff)');
const rkRow = (lbl, sel) => { const s = teamGames.filter(sel); if (s.length) say(`   ${lbl.padEnd(22)} ${f(mean(s, 'pen'))} for ${f(mean(s, 'yds'), 1)} yds   (${s.length} team-games)`); };
rkRow('top-10', r => r.rk >= 1 && r.rk <= 10);
rkRow('ranked 11–25', r => r.rk >= 11 && r.rk <= 25);
rkRow('unranked', r => !r.rk);
rkRow('ranked vs unranked', r => r.rk && !r.ork);
rkRow('unranked vs ranked', r => !r.rk && r.ork);

/* ============================================================ *
 * (b) THE MIX — play-by-play harvest
 * ============================================================ */
const TYPES = [
  // [canonical, matcher, presnap, sideHint]  — order matters, first match wins
  ['False Start', /false start/i, 1, 'off'],
  ['Offside / Encroachment / NZI', /offside|off-side|encroach|neutral zone/i, 1, 'def'],
  ['Delay of Game', /delay of game/i, 1, 'off'],
  ['Illegal Substitution / 12 Men', /illegal sub|too many|12 men|substitution infraction/i, 1, 'any'],
  ['Illegal Formation / Shift / Motion', /illegal (formation|shift|motion|procedure)|illegal snap/i, 1, 'off'],
  ['Targeting', /targeting/i, 0, 'def'],
  ['Roughing the Passer', /roughing the passer|rough(ing)? passer/i, 0, 'def'],
  ['Roughing / Running into Kicker', /roughing the (kicker|snapper|holder)|running into the kicker/i, 0, 'def'],
  ['Defensive Pass Interference', /defensive pass interference|pass interference def/i, 0, 'def'],
  ['Offensive Pass Interference', /offensive pass interference|pass interference off/i, 0, 'off'],
  ['Pass Interference (side n/s)', /pass interference/i, 0, 'any'],
  ['Defensive Holding', /defensive holding|holding def/i, 0, 'def'],
  ['Offensive Holding', /holding/i, 0, 'off'],
  ['Illegal Block / Clip / Blindside', /block in the back|illegal block|blindside|chop block|clipping|illegal crackback/i, 0, 'off'],
  ['Face Mask', /face ?mask/i, 0, 'any'],
  ['Horse Collar', /horse ?collar/i, 0, 'def'],
  ['Unsportsmanlike Conduct', /unsportsmanlike|taunting/i, 0, 'any'],
  ['Personal Foul / Unnecessary Roughness', /personal foul|unnecessary roughness|late hit|leaping|hurdling|tripping|fighting/i, 0, 'any'],
  ['Intentional Grounding', /intentional grounding/i, 0, 'off'],
  ['Illegal Use of Hands / Hands to Face', /illegal use of hands|hands to the face/i, 0, 'any'],
  ['Ineligible Downfield / Illegal Touching', /ineligible|illegal touch/i, 0, 'off'],
  ['Illegal Contact', /illegal contact/i, 0, 'def'],
  ['Kick-game foul', /kick(off)? out of bounds|fair catch|invalid fair catch|illegal wedge|kick catch|free kick/i, 0, 'any'],
  ['Sideline / Equipment / Admin', /sideline|equipment|helmet|uniform|illegal participation|illegal return|disconcert/i, 0, 'any'],
];
const typeOf = s => { for (let i = 0; i < TYPES.length; i++) if (TYPES[i][1].test(s)) return i; return -1; };

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) return await r.json(); if (r.status === 404) return null; } catch (e) {}
    await new Promise(s => setTimeout(s, 400 * (i + 1)));
  }
  return null;
}

// one game -> { ev:[[type, side, yds, q, down, dist, firstDown, flaggedIsHome]], seen, boxN }
function extractPens(d) {
  const drives = (d.drives && d.drives.previous) || [];
  if (!drives.length) return null;
  const comp = (d.header && d.header.competitions && d.header.competitions[0]) || {};
  const teams = (comp.competitors || []).map(c => ({
    id: String(c.id), home: c.homeAway === 'home',
    abbr: String((c.team && c.team.abbreviation) || '').toUpperCase(),
    words: [(c.team && c.team.location) || '', (c.team && c.team.displayName) || '', (c.team && c.team.shortDisplayName) || ''].filter(Boolean),
  }));
  if (teams.length !== 2) return null;
  // box-score penalty totals, to measure how much of the truth the play-by-play actually logs
  let boxN = 0;
  for (const t of (d.boxscore && d.boxscore.teams) || [])
    for (const s of t.statistics || []) if (s.name === 'totalPenaltiesYards') boxN += +String(s.displayValue).split('-')[0] || 0;

  const byAbbr = tok => { tok = String(tok).toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!tok) return null;
    let hit = teams.filter(t => t.abbr === tok);
    if (!hit.length) hit = teams.filter(t => t.abbr.startsWith(tok.slice(0, 3)) || tok.startsWith(t.abbr.slice(0, 3)));
    return hit.length === 1 ? hit[0] : null; };
  const byName = s => { const hit = teams.filter(t => t.words.some(w => s.toLowerCase().startsWith(w.toLowerCase()))); return hit.length === 1 ? hit[0] : null; };

  const ev = []; let seen = 0;
  for (const dr of drives) for (const p of dr.plays || []) {
    const tt = (p.type && p.type.text) || '';
    if (!(p.isPenalty || /^penalty$/i.test(tt))) continue;
    seen++;
    const txt = String(p.text || '');
    // two ESPN shapes: "<Team> Penalty, <Type> (Player) to the X" (standalone, usually pre-snap)
    // and "<play text>. PENALTY <ABBR> <Type> on <Player> ..." (a flag on a live snap)
    let who = null, tstr = '';
    const m2 = txt.match(/PENALTY\s+([A-Za-z0-9&.'-]{2,8})\s+(.{3,60}?)(?:\s+on\s+|\s+\(|,\s|\s+enforced|\s+\d+\s+yard|\s+declined|$)/);
    const m1 = txt.match(/^(.{2,40}?)\s+Penalty,\s*(.{3,60}?)(?:\s*\(|\s+to the|\s+enforced|$)/);
    if (m2) { who = byAbbr(m2[1]); tstr = m2[2]; }
    if (!tstr && m1) { who = byName(m1[1]); tstr = m1[2]; }
    if (!tstr) tstr = txt;
    const ti = typeOf(tstr) >= 0 ? typeOf(tstr) : typeOf(txt);
    const posId = (p.start && p.start.team && String(p.start.team.id)) || null;
    // side: 0 = the team WITH the ball was flagged, 1 = the defense was flagged, 2 = unknown
    let side = 2;
    if (who && posId) side = who.id === posId ? 0 : 1;
    else if (ti >= 0 && TYPES[ti][3] === 'off') side = 0;
    else if (ti >= 0 && TYPES[ti][3] === 'def') side = 1;
    const yds = p.statYardage == null ? null : Math.abs(+p.statYardage);
    const fd = /1st down|1ST down|first down/i.test(txt) ? 1 : 0;
    // the flagged player — "(Logan Lee)" in the standalone shape, "on BALDWIN, Brandon" in the live one.
    // Normalized to LAST+first-initial so the two spellings collapse onto one key.
    let nm = '';
    const n2 = txt.match(/PENALTY\s+\S+\s+.{3,60}?\s+on\s+([A-Za-z'.\- ]+,\s*[A-Za-z'.\- ]+|[A-Za-z'.\- ]{3,30})/);
    const n1 = m1 && txt.match(/Penalty,\s*[^(]+\(([^)]{3,40})\)/);
    const raw = (n1 && n1[1]) || (n2 && n2[1]) || '';
    if (raw) { const s = raw.trim().replace(/\s+/g, ' ');
      const parts = s.includes(',') ? s.split(',').map(x => x.trim()) : (() => { const w = s.split(' '); return [w[w.length - 1], w.slice(0, -1).join(' ')]; })();
      nm = (parts[0] || '').toUpperCase().replace(/[^A-Z]/g, '') + '|' + ((parts[1] || '')[0] || '').toUpperCase(); }
    ev.push([ti, side, m1 && yds != null && yds <= 25 ? yds : null, (p.period && p.period.number) || 0,
      (p.start && p.start.down) || 0, (p.start && p.start.distance) == null ? -1 : p.start.distance,
      fd, who ? (who.home ? 1 : 0) : -1, nm]);
  }
  return { ev, seen, boxN, v: 2 };
}

(async () => {
  let done = {};
  if (fs.existsSync(CACHE)) { try { done = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { done = {}; } }
  const pool = fbsIdx;
  const todo = SKIP_FETCH ? [] : pool.filter(g => !done[g.id] || done[g.id].v !== 2);
  if (todo.length) {
    console.log(`\n[pbp] ${pool.length} FBS-vs-FBS games, ${pool.length - todo.length} cached, ${todo.length} to fetch`);
    let i = 0, ok = 0, fail = 0; const t0 = Date.now();
    async function worker() {
      while (i < todo.length) {
        const g = todo[i++];
        const d = await get(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${g.id}`);
        const e = d ? extractPens(d) : null;
        if (e) { done[g.id] = e; ok++; } else fail++;
        if ((ok + fail) % 400 === 0) { const el = (Date.now() - t0) / 1000;
          console.log(`  ${ok + fail}/${todo.length}  ok=${ok} fail=${fail}  ${el.toFixed(0)}s  eta ${((el / (ok + fail)) * (todo.length - ok - fail)).toFixed(0)}s`);
          fs.writeFileSync(CACHE, JSON.stringify(done)); }
      }
    }
    await Promise.all(Array.from({ length: CONC }, worker));
    fs.writeFileSync(CACHE, JSON.stringify(done));
    console.log(`[pbp] harvested ${ok} games (${fail} failed) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }

  const ids = Object.keys(done);
  if (!ids.length) { say('\n(no play-by-play cache — run without --no-fetch to harvest the mix)'); fs.writeFileSync(REPORT, out.join('\n')); return; }

  const M = { games: 0, ev: 0, box: 0, byType: {}, bySide: [0, 0, 0], byQ: {}, byDown: {}, preSnap: 0, live: 0, fd: 0, defFd: 0, homeFlag: 0, awayFlag: 0, ydsByType: {}, sideByType: {}, fdByType: {} };
  for (const id of ids) {
    const o = done[id]; M.games++; M.box += o.boxN || 0;
    for (const e of o.ev) {
      const [ti, side, yds, q, down, dist, fd, hm] = e;
      M.ev++;
      const key = ti >= 0 ? TYPES[ti][0] : 'Unclassified';
      M.byType[key] = (M.byType[key] || 0) + 1;
      (M.sideByType[key] = M.sideByType[key] || [0, 0, 0])[side]++;
      if (fd) M.fdByType[key] = (M.fdByType[key] || 0) + 1;
      if (yds != null) { const a = M.ydsByType[key] = M.ydsByType[key] || [0, 0]; a[0]++; a[1] += yds; }
      M.bySide[side]++;
      if (q) M.byQ[q] = (M.byQ[q] || 0) + 1;
      if (down >= 1 && down <= 4) M.byDown[down] = (M.byDown[down] || 0) + 1;
      if (ti >= 0 && TYPES[ti][2]) M.preSnap++; else M.live++;
      if (fd) { M.fd++; if (side === 1) M.defFd++; }
      if (hm === 1) M.homeFlag++; else if (hm === 0) M.awayFlag++;
    }
  }
  const T = M.ev;
  say('\n' + '='.repeat(120));
  say(`7. THE MIX — which flags actually get thrown (${M.games} games of play-by-play, ${T} penalty plays logged)`);
  say('='.repeat(120));
  say(`   play-by-play logs ${f(M.ev / M.games, 2)} penalties/game vs ${f(M.box / M.games, 2)} in the box score → ${f(pct(M.ev, M.box), 1)}% coverage`);
  say(`   (the gap is declined/offsetting flags and kick-game fouls ESPN folds into the play text)\n`);
  say(`   ${'penalty'.padEnd(40)} ${'share'.padStart(7)}  ${'per tm-gm'.padStart(9)}  ${'avg yds'.padStart(7)}  ${'on OFF'.padStart(7)}  ${'→1st dn'.padStart(7)}`);
  const rank = Object.entries(M.byType).sort((a, b) => b[1] - a[1]);
  for (const [k, n] of rank) {
    const y = M.ydsByType[k], s = M.sideByType[k] || [0, 0, 0], known = s[0] + s[1];
    say(`   ${k.padEnd(40)} ${(f(pct(n, T), 1) + '%').padStart(7)}  ${f(n / M.games / 2, 2).padStart(9)}  ${(y && y[0] > 30 ? f(y[1] / y[0], 1) : '—').padStart(7)}  ${(known > 30 ? f(pct(s[0], known), 0) + '%' : '—').padStart(7)}  ${(f(pct(M.fdByType[k] || 0, n), 0) + '%').padStart(7)}`);
  }
  say(`\n   pre-snap (dead-ball) ${f(pct(M.preSnap, T), 1)}%  ·  live-ball ${f(pct(M.live, T), 1)}%`);
  say(`   flagged team had the ball ${f(pct(M.bySide[0], T), 1)}%  ·  was on defense ${f(pct(M.bySide[1], T), 1)}%  ·  unattributed ${f(pct(M.bySide[2], T), 1)}%`);
  say(`   home team flagged ${f(pct(M.homeFlag, M.homeFlag + M.awayFlag), 1)}%  ·  road team ${f(pct(M.awayFlag, M.homeFlag + M.awayFlag), 1)}%`);
  say(`   penalty produced a first down: ${f(pct(M.fd, T), 1)}% of all flags (${f(M.fd / M.games / 2, 2)} per team-game)`);
  say('\n   by quarter:  ' + [1, 2, 3, 4].map(q => `Q${q} ${f(pct(M.byQ[q] || 0, T), 1)}%`).join('  '));
  const dTot = [1, 2, 3, 4].reduce((a, d) => a + (M.byDown[d] || 0), 0);
  say('   by down:     ' + [1, 2, 3, 4].map(d => `${d} ${f(pct(M.byDown[d] || 0, dTot), 1)}%`).join('  '));

  /* --- 8. is a penalty a PLAYER property? how concentrated are a team's flags --- */
  const idxById = {}; fbsIdx.forEach(g => idxById[g.id] = g);
  const tsPlayers = {};   // "team|year" -> { name -> count }, and the same for false starts only
  const tsFalse = {};
  for (const id of ids) {
    const g = idxById[id]; if (!g) continue;
    for (const e of done[id].ev) {
      const nm = e[8], hm = e[7]; if (!nm || nm.length < 3 || hm < 0) continue;
      const key = (hm === 1 ? g.hid : g.aid) + '|' + g.year;
      ((tsPlayers[key] = tsPlayers[key] || {}))[nm] = (tsPlayers[key][nm] || 0) + 1;
      if (e[0] === 0) ((tsFalse[key] = tsFalse[key] || {}))[nm] = (tsFalse[key][nm] || 0) + 1;
    }
  }
  const conc = (map, minN) => { const rows = [];
    for (const k in map) { const c = Object.values(map[k]).sort((a, b) => b - a), tot = c.reduce((a, x) => a + x, 0);
      if (tot < minN) continue;
      rows.push({ tot, distinct: c.length, top1: c[0] / tot, top3: c.slice(0, 3).reduce((a, x) => a + x, 0) / tot }); }
    return rows; };
  const cAll = conc(tsPlayers, 30), cFS = conc(tsFalse, 8);
  const namedShare = (() => { let n = 0, k = 0; for (const id of ids) for (const e of done[id].ev) { n++; if (e[8] && e[8].length > 2) k++; } return pct(k, n); })();
  say('\n8. IS IT A PLAYER PROPERTY? — how a team-season\'s flags spread across its players');
  say(`   ${f(namedShare, 1)}% of logged penalties name the player who committed them`);
  if (cAll.length) {
    say(`   over ${cAll.length} team-seasons: ${f(mean(cAll, 'distinct'), 1)} different players flagged per season (of ~${f(mean(cAll, 'tot'), 0)} named flags)`);
    say(`   the most-flagged player accounts for ${f(mean(cAll, 'top1') * 100, 1)}% of his team's flags · the top three for ${f(mean(cAll, 'top3') * 100, 1)}%`);
  }
  if (cFS.length) {
    say(`   FALSE STARTS only (${cFS.length} team-seasons, ${f(mean(cFS, 'tot'), 1)} per season): ${f(mean(cFS, 'distinct'), 1)} different offenders`);
    say(`   the worst one commits ${f(mean(cFS, 'top1') * 100, 1)}% of his team's false starts · the top three ${f(mean(cFS, 'top3') * 100, 1)}%`);
  }

  fs.writeFileSync(OUT, JSON.stringify({ topline: { N, mPen, mYds, sdPen, sdYds, perSnap, seasons: seasons.length,
    seasonSd: sd(seasons, 'ppg'), seasonP05: ppgs[Math.floor(ppgs.length * .05)], seasonP95: ppgs[Math.floor(ppgs.length * .95)],
    withinSd, betweenSd: Math.sqrt(betweenVar), yoy: corr(pairs) }, mix: M }, null, 1));
  fs.writeFileSync(REPORT, out.join('\n'));
  console.log(`\nwrote ${OUT} + ${REPORT}`);
})();

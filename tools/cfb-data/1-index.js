/* Step 1 — build a game index (id, teams, ranks, scores) for the requested seasons
   from the ESPN CFB scoreboard. FBS only (groups=80). Cheap: ~20 requests/season. */
const fs = require('fs');
const SEASONS = process.argv.slice(2).map(Number);
const OUT = __dirname + '/index.json';

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) return await r.json();
    } catch (e) { /* retry */ }
    await new Promise(s => setTimeout(s, 500 * (i + 1)));
  }
  return null;
}

(async () => {
  const all = [];
  for (const year of SEASONS) {
    // seasontype 2 = regular season (weeks 1-16), 3 = postseason (bowls, week 1)
    const reqs = [];
    for (let w = 1; w <= 16; w++) reqs.push({ st: 2, w });
    reqs.push({ st: 3, w: 1 });
    for (const { st, w } of reqs) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`
        + `?dates=${year}&seasontype=${st}&week=${w}&groups=80&limit=400`;
      const d = await get(url);
      if (!d || !d.events) continue;
      let n = 0;
      for (const e of d.events) {
        const c = e.competitions && e.competitions[0];
        if (!c || !c.competitors || c.competitors.length !== 2) continue;
        const st_ = c.status && c.status.type;
        if (!st_ || !st_.completed) continue;
        const home = c.competitors.find(x => x.homeAway === 'home');
        const away = c.competitors.find(x => x.homeAway === 'away');
        if (!home || !away) continue;
        // FBS-only: both teams must be in an FBS conference (groups=80 filters by one side)
        const rk = x => { const v = x.curatedRank && x.curatedRank.current; return (!v || v >= 99) ? 0 : v; };
        all.push({
          id: e.id, year, week: w, post: st === 3,
          date: e.date,
          neutral: !!c.neutralSite,
          h: home.team.abbreviation, a: away.team.abbreviation,
          hid: home.team.id, aid: away.team.id,
          hc: (home.team.conferenceId || 0), ac: (away.team.conferenceId || 0),
          hs: +home.score, as: +away.score,
          hr: rk(home), ar: rk(away),
        });
        n++;
      }
      process.stdout.write(`${year} ${st === 3 ? 'bowl' : 'wk' + w}: ${n}  `);
    }
    console.log('');
  }
  // de-dupe by id
  const seen = new Set(), games = [];
  for (const g of all) { if (seen.has(g.id)) continue; seen.add(g.id); games.push(g); }
  fs.writeFileSync(OUT, JSON.stringify(games));
  console.log(`\nindexed ${games.length} completed FBS games across ${SEASONS.join(', ')}`);
  const ranked = games.filter(g => g.hr && g.ar).length;
  const one = games.filter(g => (g.hr === 1 && !g.ar) || (g.ar === 1 && !g.hr)).length;
  console.log(`  ranked-vs-ranked: ${ranked}   #1-vs-unranked: ${one}`);
})();

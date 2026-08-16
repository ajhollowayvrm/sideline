'use strict';
/* What the transfer portal is worth, and what recruiting STAFF are worth in it.

   Phase 44 gave the portal an autopilot that was on by default and that nothing ever turned off:
   `S.portal.autopilot` is set true at every portal open. Measured across three offseasons of a coach
   doing nothing at all, it delivered 12, 18 and 15 transfers rated 63-66 — more roster improvement
   than a signing class, for no decision. Phase 60 had already deleted the equivalent switch on the
   recruiting side and replaced it with staff you hire and direct; this measures the same treatment
   applied to the portal.

   Two arms over the same seed and team: no recruiting staff, and a two-person department.

   Run:  node tools/cfb-data/29-portalstaff.js      (a tool, not a gate) */

const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'content-type':'text/html'});s.end(d);});});
const RUN = `
async (cfg) => {
  window.writeSlot=()=>{};window.autosave=()=>{};window.setActiveSlot=()=>{};window.toast=()=>{};
  const ng=freshNewGame(); ng.seed=cfg.seed; ng.world=genWorld(cfg.seed);
  const band=ng.world.teams.filter(t=>t.prestige>=48&&t.prestige<=60);
  ng.teamId=band.sort((a,b)=>a.id<b.id?-1:1)[Math.floor(band.length/2)].id;
  finishNewGame(ng); closeSheet();
  const me=controlled();
  if(cfg.staff){
    // hire whatever recruiting staff the market offers, the Phase 60 way
    REC_ROLES.slice(0,cfg.staff).forEach(rr=>{
      me.staff.push({role:rr[0],title:rr[1],name:'Staff '+rr[0],rating:75,
        salary:Math.round(75*8500*rr[6]),years:3,tier:'rec',scope:rr[2],groups:null,boost:0});
      me.payroll=(me.payroll||0)+Math.round(75*8500*rr[6]);
    });
  }
  startSeason();
  while(S.phase==='Regular Season') advanceWeek();
  if(S.recruiting&&S.recruiting.stage==='open') earlySigningPeriod();
  nationalSigningDay();
  openPortal();
  const before=controlled().roster.length;
  closePortal();
  const arr=(S.portal&&S.portal.arrivals)||[];
  return { staff: recStaff(controlled()).length, arrivals: arr.length,
           avgOv: arr.length? +(arr.reduce((a,x)=>a+x.ov,0)/arr.length).toFixed(1):0,
           lost:(S.portal.departures||[]).length, roster: controlled().roster.length-before };
}`;
(async()=>{
  await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
  const b=await chromium.launch(); const out=[];
  for(const seed of [4242,8123,20260814,77003,4411]){
    for(const staff of [0,2]){
      const ctx=await b.newContext(); const pg=await ctx.newPage();
      await pg.goto(`http://localhost:${port}/index.html`,{waitUntil:'domcontentloaded'});
      await pg.waitForFunction(()=>typeof genWorld==='function');
      let r; try{ r=await pg.evaluate(`(${RUN})(${JSON.stringify({seed,staff})})`);}catch(e){r={ERROR:e.message.split('\n')[0]};}
      await ctx.close(); out.push({seed,staff,...r});
      console.log(' seed',seed,'staffAsked',staff,JSON.stringify(r));
    }
  }
  await b.close(); srv.close();
  const agg=s=>{const g=out.filter(x=>x.staff===s&&!x.ERROR);
    return g.length?{n:g.length,arrivals:+(g.reduce((a,x)=>a+x.arrivals,0)/g.length).toFixed(1),
      avgOv:+(g.reduce((a,x)=>a+x.avgOv,0)/g.length).toFixed(1),lost:+(g.reduce((a,x)=>a+x.lost,0)/g.length).toFixed(1)}:null;};
  console.log('\nPORTAL — arrivals with no recruiting staff vs a staffed department');
  console.log(' no staff :',JSON.stringify(agg(0)));
  console.log(' staffed  :',JSON.stringify(agg(2)));
})().catch(e=>{console.error(e);process.exit(1)});

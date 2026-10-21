// Read-only audit: built page, deterministic frames, no screenshots or visual inspection.
// Output: /tmp/ride-entry-audit.json. Run from repository root.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { INIT } from './road_views.mjs';
const b=await chromium.launch({args:['--use-angle=metal','--ignore-gpu-blocklist']});
const p=await b.newPage(); const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(INIT);await p.goto(pathToFileURL(process.cwd()+'/index.html').href+'?quality=high',{timeout:180000,waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__scene?.ground,null,{timeout:180000,polling:200});
const r=await p.evaluate(()=>{
 window.__step(3);const S=window.__scene,G=S.ground, bad=[],counts={};
 for(let x=G.SEAM;x<G.SEAM+G.PERIOD;x+=5)for(let z=-200;z<=200;z+=5){const q=G.spawn(x,z,[1,0]);counts[q?'ok':'null']=(counts[q?'ok':'null']||0)+1;if(!q)bad.push([x,z]);}
 const cases=[];for(const [name,x,z] of [['town',-7,16.75],['sea',200,100],['bridge',96,17],['tunnel',148,15],['ice',111,-189],...bad.slice(0,8).map((q,i)=>['bad'+i,...q])]){
 S.view.set({mode:'free',target:[x,1.2,z],yaw:-Math.PI/2,pitch:0.5,dist:34});window.__step(1);let err=null;try{document.getElementById('town-view-toggle').click();}catch(e){err=e.message;}const entered=S.view.get().mode;
 const before=S.ride.get();const t=Date.now();try{document.getElementById('town-view-toggle').click();}catch(e){err=e.message;}cases.push({name,x,z,entered,after:S.view.get(),before,err,exitMs:Date.now()-t});}
 const detail=bad.map(([x,z])=>({x,z,dirs:[[1,0],[-1,0],[0,1],[0,-1]].map(d=>({d,spawn:G.spawn(x,z,d)})),near:G.lines.filter(l=>l.kind!=='stairs').map(l=>({id:l.id,kind:l.kind,q:l.project(x,z,true)})).sort((a,b)=>a.q.d2-b.q.d2).slice(0,3).map(v=>({...v,point:G.lines.find(l=>l.id===v.id).point(v.q.s,0),probe:[0,-.001,-.01,-.1].map(ds=>{const l=G.lines.find(l=>l.id===v.id),p=l.point(v.q.s+ds,-2.5);return{ds,x:p.x,z:p.z,project:l.project(p.x,p.z),sample:G.at(p.x,p.z),own:G.at(p.x,p.z,{line:l.id,layer:l.kind==='bridge'?'deck':'ground'})};})}))}));return {counts,bad,cases,detail};
});r.errors=errors;fs.writeFileSync('/tmp/ride-entry-audit.json',JSON.stringify(r,null,2));console.log(JSON.stringify({counts:r.counts,bad:r.bad.slice(0,15),cases:r.cases.map(q=>({name:q.name,entered:q.entered,after:q.after.mode,err:q.err,exitMs:q.exitMs})),errors}));await b.close();

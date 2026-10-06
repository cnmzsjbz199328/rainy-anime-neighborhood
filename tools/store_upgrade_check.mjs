// S3-specific runtime evidence: paired fixed-clock views, lights, doors, rain shelters and frozen records.
// Usage: node tools/store_upgrade_check.mjs [baseline-ref=6e89b3a]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {launchChromium} from './browser.mjs';
const root=process.cwd(),ref=process.argv[2]||'6e89b3a',out=path.join(root,'docs/buildings/screenshots/B05-P01/comparison');fs.mkdirSync(out,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'store-upgrade-'));
const baseline=path.join(temp,'index.html');fs.writeFileSync(baseline,execFileSync('git',['show',`${ref}:index.html`],{maxBuffer:20*1024*1024}));
const oldLayout=path.join(temp,'layout.cjs');fs.writeFileSync(oldLayout,execFileSync('git',['show',`${ref}:layout.js`]));
const req=createRequire(import.meta.url),before=req(oldLayout),after=req(path.join(root,'layout.js'));
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const prior=before.samples.find(b=>b.plot==='B05-P01'),current=after.buildings.find(b=>b.plot==='B05-P01');
assert(JSON.stringify(before.toWorld(prior,prior.door.x,prior.door.z))===JSON.stringify(after.toWorld(current,0,0)),'Door world coordinates changed');
assert(JSON.stringify(before.buildings)===JSON.stringify(after.buildings.filter(b=>b.plot!=='B05-P01')),'Other building records changed');
assert(JSON.stringify(before.plots.filter(b=>b.id!=='B05-P01'))===JSON.stringify(after.plots.filter(b=>b.id!=='B05-P01')),'Other plots changed');
const browser=await launchChromium(),result={baselineRef:ref,door:after.toWorld(current,0,0),runs:{}};
try{
 for(const [name,file] of [['before',baseline],['after',path.join(root,'index.html')]]){
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.clock.install({time:0});await page.clock.pauseAt(100);await page.goto(pathToFileURL(file).href,{timeout:120000});
  await page.waitForFunction(()=>window.__scene?.view,null,{polling:200,timeout:120000});await page.clock.fastForward(1400);await page.clock.runFor(32);
  const data={views:{}};
  for(const [view,config] of [['default',{yaw:2.5,pitch:.5,dist:34,target:[-7,1.2,20]}],['town',{yaw:2.5,pitch:.82,dist:140,target:[0,0,0]}]]){
   await page.evaluate(v=>window.__scene.view.set(v),config);await page.clock.runFor(32);
   data.views[view]=await page.evaluate(()=>{const {scene,camera,renderer}=window.__scene;let lights=0;scene.traverse(o=>{if(o.isPointLight)lights++;});
    const project=v=>{const p=new THREE.Vector3(...v).project(camera);return[(p.x+1)*640,(1-p.y)*400];};
    // Identical world-space masks, inside both generations' glazing. Include contents, exclude sign/roof.
    const polys=[[[ -14.45,.85,23.17],[-8.2,.85,23.17],[-8.2,2.3,23.17],[-14.45,2.3,23.17]],
      [[-7.86,1,23.6],[-7.86,1,28.15],[-7.86,2.35,28.15],[-7.86,2.35,23.6]]].map(p=>p.map(project));
    renderer.info.autoReset=false;renderer.info.reset();renderer.render(scene,camera);
    return{lights,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,windowPolygons:polys};
   });
   await page.screenshot({path:path.join(out,`${name}-${view}.png`)});
  }
  if(name==='after'){
   data.runtime=await page.evaluate(()=>{const{scene,groups}=window.__scene,body=groups.mart;const names=['martAutomaticDoor0','martAutomaticDoor1'];
    return{legacyDetached:['store','vending','bicycles','storeProps'].every(n=>!groups[n].parent),doors:names.map(n=>body.getObjectByName(n).position.x),roofMeshes:body.children.filter(o=>o.userData.layer==='roof').length,storeLights:(()=>{let n=0;body.traverse(o=>{if(o.isPointLight)n++;});return n;})()};});
   // Absolute page time 12 s: fully open, and 17 s: closed. Scene t starts at its first frame (~.1 s).
   await page.clock.fastForward(12000-1564);await page.clock.runFor(32);
   data.runtime.open=await page.evaluate(()=>['martAutomaticDoor0','martAutomaticDoor1'].map(n=>window.__scene.groups.mart.getObjectByName(n).position.x));
   await page.clock.fastForward(5000);await page.clock.runFor(32);
   data.runtime.closed=await page.evaluate(()=>['martAutomaticDoor0','martAutomaticDoor1'].map(n=>window.__scene.groups.mart.getObjectByName(n).position.x));
   assert(data.runtime.legacyDetached,'Legacy store still attached');assert(data.runtime.roofMeshes>0,'Missing cutaway roof');
   assert(Math.abs(data.runtime.open[0]+.76)<.001&&Math.abs(data.runtime.open[1]-.76)<.001,'Automatic door open displacement');
   assert(Math.abs(data.runtime.closed[0]+.3)<.001&&Math.abs(data.runtime.closed[1]-.3)<.001,'Automatic door closing');
  }
  assert(!errors.length,errors.join('\n'));data.errors=errors;result.runs[name]=data;await page.close();
 }
 assert(result.runs.after.views.default.lights<=result.runs.before.views.default.lights,'Point light count increased');
 assert(result.runs.after.views.default.calls<=result.runs.before.views.default.calls*1.1,'Default calls increased >10%');
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();fs.rmSync(temp,{recursive:true,force:true});}

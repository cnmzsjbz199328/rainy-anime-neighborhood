// Verify the rendered town pavement has one surface, with its original paving underneath.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {launchChromium} from './browser.mjs';
import {INIT} from './road_views.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await launchChromium();
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(INIT);
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 await page.waitForFunction(()=>!!window.__scene,null,{timeout:120000});
 const result=await page.evaluate(()=>{
  const S=window.__scene,T=window.THREE,L=window.LAYOUT,roads=[],paving=[];
  S.scene.updateMatrixWorld(true);
  S.scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;
   if(o.name.startsWith('road:route '))roads.push(o);
   if(o.parent?.name==='base'&&o.material?.map&&o.material?.color?.getHexString()==='87908c')paving.push(o);
  });
  const ray=new T.Raycaster(),leaks=[],missing=[];let tested=0,skippedCorners=0,alleyCrossings=0;
  for(const s of L.surfaces.filter(s=>s.kind==='sidewalk')){
   const [x0,z0,x1,z1]=s.rect;
   for(let x=x0+.2;x<x1-.1;x+=.8)for(let z=z0+.2;z<z1-.1;z+=.8){
    // Alley crossings carry their own unified paving and ramp through the sidewalk.
    // They are not the duplicate TOWN_MAIN/TOWN_BRANCH concrete sheet being removed.
    if(L.alleys.some(a=>{const ends=a.nodes.map(id=>L.roadNodes.find(n=>n.id===id));return x>=Math.min(...ends.map(n=>n.x))&&x<=Math.max(...ends.map(n=>n.x))&&Math.abs(z-ends[0].z)<L.ALLEY.width/2;})){alleyCrossings++;continue;}
    ray.set(new T.Vector3(x,10,z),new T.Vector3(0,-1,0));
    const base=ray.intersectObjects(paving,false).find(h=>Math.abs(h.point.y-L.LEVELS.pavement)<.001);
    // Rounded corners and curb cuts have their own geometry and are checked by U2/layout checks.
    if(!base){skippedCorners++;continue;}
    tested++;
    const hit=ray.intersectObjects(roads,false).find(h=>h.point.y>=L.LEVELS.pavement-.05);
    if(hit)leaks.push({x,z,y:hit.point.y,mesh:hit.object.name});
   }
  }
  if(!paving.length||tested<500)missing.push('insufficient paving coverage');
  return {tested,skippedCorners,alleyCrossings,leaks,missing};
 });
 console.log(JSON.stringify({...result,errors},null,2));
 if(process.argv.includes('--png')){
  const out=path.join(root,'docs/world/w10c/pavement-review');fs.mkdirSync(out,{recursive:true});
  for(const [id,z]of [['X01',15],['X02',-15]]){
   const url=await page.evaluate(z=>{const S=window.__scene;S.weather.lock('rain');S.view.set({target:[0,.15,z],dist:32,yaw:0,pitch:1.52});window.__step(1);S.renderer.render(S.scene,S.camera);return S.renderer.domElement.toDataURL('image/png');},z);
   fs.writeFileSync(path.join(out,id+'-top.png'),Buffer.from(url.split(',')[1],'base64'));
  }
  fs.writeFileSync(path.join(out,'check.json'),JSON.stringify({...result,errors},null,2)+'\n');
 }
 process.exitCode=result.leaks.length||result.missing.length||errors.length?1:0;
}finally{await browser.close();}

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
 const htmlArg=process.argv.indexOf('--html');
 await page.goto(pathToFileURL(htmlArg>=0?path.resolve(process.argv[htmlArg+1]):path.join(root,'index.html')).href);
 await page.waitForFunction(()=>!!window.__scene,null,{timeout:120000});
 const result=await page.evaluate(()=>{
  const S=window.__scene,T=window.THREE,L=window.LAYOUT,roads=[],paving=[],baseMeshes=[];
  const mainNames=new Set(S.roads.data().routes.filter(r=>r.classes.some(c=>c==='TOWN_MAIN'||c==='TOWN_BRANCH')).map(r=>'road:'+r.strip.name));
  S.scene.updateMatrixWorld(true);
  S.scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;
   if(o.name.startsWith('road:route '))roads.push(o);
   if(o.parent?.name==='base')baseMeshes.push(o);
   if(o.parent?.name==='base'&&o.material?.map&&o.material?.color?.getHexString()==='87908c')paving.push(o);
  });
  const ray=new T.Raycaster(),leaks=[],missing=[];let tested=0,skippedCorners=0,alleyCrossings=0;
  for(const s of L.surfaces.filter(s=>s.kind==='sidewalk'||s.kind==='band')){
   const [x0,z0,x1,z1]=s.rect;
   for(let x=x0+.2;x<x1-.1;x+=.8)for(let z=z0+.2;z<z1-.1;z+=.8){
    const alley=L.alleys.some(a=>{const ends=a.nodes.map(id=>L.roadNodes.find(n=>n.id===id));return x>=Math.min(...ends.map(n=>n.x))&&x<=Math.max(...ends.map(n=>n.x))&&Math.abs(z-ends[0].z)<L.ALLEY.width/2;});
    ray.set(new T.Vector3(x,10,z),new T.Vector3(0,-1,0));
    if(alley){alleyCrossings++;const hits=ray.intersectObjects(roads,false);if(!hits.some(h=>!mainNames.has(h.object.name)))missing.push({x,z,kind:'alley crossing'});if(hits.some(h=>mainNames.has(h.object.name)&&h.point.y>.04))leaks.push({x,z,kind:'duplicate over alley crossing'});continue;}
    const base=ray.intersectObjects(paving,false).find(h=>Math.abs(h.point.y-L.LEVELS.pavement)<.001);
    // Rounded corners and curb cuts have their own geometry and are checked by U2/layout checks.
    if(!base){skippedCorners++;continue;}
    tested++;
    const hit=ray.intersectObjects(roads,false).find(h=>h.point.y>=L.LEVELS.pavement-.05);
    if(hit)leaks.push({x,z,y:hit.point.y,mesh:hit.object.name});
   }
  }
  const streetVertexLeaks=[];let streetVertices=0;
  for(const mesh of roads.filter(o=>mainNames.has(o.name))){const g=mesh.geometry,p=g.attributes.position,c=g.attributes.color;
   for(const i of new Set(g.index.array)){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(Math.abs(x)>L.BASE.half+1e-5||Math.abs(z)>L.BASE.half+1e-5)continue;
    streetVertices++;if(y>.03||Math.max(c.getX(i),c.getY(i),c.getZ(i))>.07)streetVertexLeaks.push({mesh:mesh.name,x,y,z});
   }
  }
  let rampTested=0;const rampLeaks=[];
  for(const cut of L.curbCuts){if(cut.kind==='driveway'&&/^A0/.test(cut.id))continue;
   for(const t of [.15,.5,.85]){const along=(cut.s0+cut.s1)/2,across=cut.at+cut.dir*cut.depth*t,x=cut.line==='x'?across:along,z=cut.line==='x'?along:across;
    ray.set(new T.Vector3(x,10,z),new T.Vector3(0,-1,0));rampTested++;
    const expected=L.LEVELS.carriageway+(L.LEVELS.pavement-L.LEVELS.carriageway)*t;
    const hits=ray.intersectObjects(baseMeshes,false),hit=hits.find(h=>Math.abs(h.point.y-expected)<.001);
    if(!hit)rampLeaks.push({x,z,kind:'missing original ramp',expected});
    if(ray.intersectObjects(roads,false).some(h=>mainNames.has(h.object.name)&&h.point.y>expected+.001))rampLeaks.push({x,z,kind:'road overlay above ramp'});
   }
  }
  // Probe the actual road-side wedges outside all eight rounded pavement corners.
  // These are not covered by the straight sidewalk probes or U2's lane rows.
  let cornerTested=0;const cornerLeaks=[],cornerMissing=[];
  for(const is of L.islands){const [x0,z0,x1,z1]=is.rect,R=L.INTERSECTION.curbRadius;
   for(const [name,cx,cz,sx,sz]of [['NW',x0,z0,1,1],['NE',x1,z0,-1,1],['SE',x1,z1,-1,-1],['SW',x0,z1,1,-1]]){
    if(!is.round[name])continue;
    for(let u=.05;u<R;u+=.15)for(let v=.05;v<R;v+=.15){
     const x=cx+sx*u,z=cz+sz*v;
     ray.set(new T.Vector3(x,10,z),new T.Vector3(0,-1,0));
     if(ray.intersectObjects(paving,false).some(h=>h.point.y>.1))continue;
     cornerTested++;
     const hit=ray.intersectObjects(roads,false)[0];
     if(!hit){cornerMissing.push({island:is.id,name,x,z});continue;}
     const colors=hit.object.geometry.attributes.color,face=hit.face;
     const bright=Math.max(...[face.a,face.b,face.c].flatMap(i=>[colors.getX(i),colors.getY(i),colors.getZ(i)]));
     if(hit.point.y>L.LEVELS.carriageway+.005||bright>.07)cornerLeaks.push({island:is.id,name,x,z,y:hit.point.y,bright});
    }
   }
  }
  // All nine town-to-ring links: the original route must cover its lane and
  // have no leftover raised side sheet between the ±48 m edge and CR01.
  const connectorLeaks=[],connectorMissing=[];let connectorTested=0;
  const W=window.WORLD,network=W.roadNetwork;
  for(const rt of S.roads.data().routes.filter(r=>r.connectorCuts?.length)){
   const id=rt.connectorCuts[0].exit,n=network.nodeById[id],p=W.lonLatToTown(n.lon,n.lat),
    edge=rt.def.segs.map(s=>network.edges.find(e=>e.id===s.id)).find(e=>e.class.startsWith('TOWN_')),
    half=network.townClasses[edge.class].carriageway/2,axis=Math.abs(p.x)>Math.abs(p.z)?'x':'z',sign=Math.sign(p[axis]),lateral=axis==='x'?'z':'x',
    mesh=roads.find(o=>o.name==='road:'+rt.strip.name);
   if(!mesh){connectorMissing.push({id,kind:'route mesh'});continue;}
   for(const distance of [.5,1,1.5,2,2.5]){
    for(const offset of [0,-half+.35,half-.35,-half-.35,half+.35,-half-1,half+1,-half-2,half+2]){
     const x=axis==='x'?sign*(L.BASE.half+distance):p.x+offset,
      z=axis==='z'?sign*(L.BASE.half+distance):p.z+offset;
     ray.set(new T.Vector3(x,10,z),new T.Vector3(0,-1,0));
     const hit=ray.intersectObject(mesh,false)[0];connectorTested++;
     if(Math.abs(offset)<half-.1&&!hit)connectorMissing.push({id,x,z,offset,kind:'lane'});
     if(Math.abs(offset)>half+.1&&hit)connectorLeaks.push({id,x,z,offset,y:hit.point.y});
    }
   }
  }
  if(!paving.length||tested<500||cornerTested<400)missing.push('insufficient paving/corner coverage');
  if(connectorTested<300)missing.push('insufficient connector coverage');
  return {tested,skippedCorners,alleyCrossings,leaks,missing,streetVertices,streetVertexLeaks,rampTested,rampLeaks,cornerTested,cornerLeaks,cornerMissing,connectorTested,connectorLeaks,connectorMissing};
 });
 console.log(JSON.stringify({...result,errors},null,2));
 if(process.argv.includes('--png')){
  const out=path.join(root,'docs/world/w10c/pavement-review');fs.mkdirSync(out,{recursive:true});
  for(const [id,target,dist]of [['town-top',[0,.15,0],145],['main-edge',[20,.15,19],24],['branch-edge',[3,.15,0],24],['alley-mouth',[0,.15,32.25],18],['X01-top',[0,.15,15],32],['X02-top',[0,.15,-15],32],['X01-corner',[4.5,.15,20],9],['X02-corner',[-4.5,.15,-10.5],9],['N01-connector',[-51,.15,15],20],['N03-connector',[51,.15,15],20],['N04-connector',[0,.15,-51],20],['N08-connector',[0,.15,51],20],['N09-connector',[-51,.15,-15],20],['N10-connector',[51,.15,-15],20],['N11-connector',[-51,.15,32.25],20],['N12-connector',[51,.15,32.25],20],['N13-connector',[51,.15,-33.5],20]]){
   const url=await page.evaluate(([target,dist])=>{const S=window.__scene;S.weather.lock('rain');S.view.set({target,dist,yaw:0,pitch:1.52});window.__step(1);S.renderer.render(S.scene,S.camera);return S.renderer.domElement.toDataURL('image/png');},[target,dist]);
   fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(url.split(',')[1],'base64'));
  }
  fs.writeFileSync(path.join(out,'check.json'),JSON.stringify({...result,errors},null,2)+'\n');
 }
 process.exitCode=result.leaks.length||result.missing.length||result.streetVertexLeaks.length||result.rampLeaks.length||result.cornerLeaks.length||result.cornerMissing.length||result.connectorLeaks.length||result.connectorMissing.length||errors.length?1:0;
}finally{await browser.close();}

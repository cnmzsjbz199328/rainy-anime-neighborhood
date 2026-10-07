// W8e-a checks: mode/zoom separation, path independence, globe camera clearance.
// Run after build.py; --shots writes the six required local review images.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const results = [], fails = [], out = (ok, name, lines) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 2) => (+x).toFixed(n);
const browser = await launchChromium(), errors = [];
async function open(w = 800, h = 500) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.transition, null, { timeout: 90000 }); await page.evaluate(() => window.__step(3)); return page;
}
const state = page => page.evaluate(() => { const S = window.__scene, c = S.camera; return { bend: S.bend.get(), fog: S.scene.fog.density, fade: S.terrain.fade.rest, pos: c.position.toArray(), up: c.up.toArray(), far: c.far }; });
const shot = page => page.evaluate(() => { const S = window.__scene; S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png'); });
const diff = (page, a, b) => page.evaluate(async ([a, b]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0, mx = 0, sum = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); if (d > 2) n++; if (d > mx) mx = d; sum += Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]); } return { over: n, max: mx, mean: sum / (A.length / 4) / 3, total: A.length / 4 }; }, [a, b]);

const page = await open(), only = args.find(a => /^--c\d$/.test(a)), want = c => !only || only === '--' + c;
// ---- C2: mode, zoom, reversible animation and shared target
if (want('c2')) {
  const r=await page.evaluate(()=>{
    const S=window.__scene,T=S.transition,checks=[];
    const check=(name,ok)=>checks.push([name,ok]);
    check('默认 flat / u=0',T.mode==='flat'&&S.bend.get()===0);
    document.getElementById('map-mode-toggle').click();check('按钮进入球形',T.mode==='sphere');T.step(.5);const buttonU=S.bend.get();document.getElementById('map-mode-toggle').click();T.step(.1);check('再次点击反向',T.mode==='flat'&&S.bend.get()<buttonU);T.step(2);
    for(const mode of ['flat','sphere']){
      T.setMode(mode);T.step(2);
      for(const d of [9,25,150,400]){S.view.set({dist:d});T.step(.1);check(`${mode} d=${d} 不改变弯曲`,S.bend.get()===(mode==='flat'?0:1));}
    }
    S.view.set({target:[T.span-1,1.2,0],yaw:0,dist:25});S.view.pan(-100,0);check('球形经度环绕',S.view.get().target[0]<0);
    const target=S.view.get().target;T.setMode('flat');T.step(.7);const u=S.bend.get();T.setMode('sphere');T.step(.1);check('动画中途反向连续',S.bend.get()>u&&S.bend.get()<1);T.step(2);
    check('切换不丢目标',JSON.stringify(target)===JSON.stringify(S.view.get().target));
    T.auto=false;S.bend.set(.37);S.view.set({dist:9});T.step(2);check('手工测试钩子',S.bend.get()===.37);T.auto=true;T.setMode('flat');T.step(2);
    S.view.set({target:[20,1.2,65],dist:25});T.step(2);check('农田 d=25 保留目标',S.view.get().target[0]===20&&S.view.get().target[2]===65&&S.view.get().dist===25&&S.terrain.fade.rest>0);
    S.view.set({mode:'roam'});check('农田禁漫游',S.view.get().mode==='free');S.section.setMode(true);check('农田禁剖视',!S.section.state.mode);
    S.view.set({target:[0,1.2,0],mode:'roam'});check('城镇可漫游',S.view.get().mode==='roam');T.setMode('sphere');check('切换先退出漫游',S.view.get().mode==='free');T.step(2);S.section.setMode(true);check('球形禁剖视',!S.section.state.mode);
    T.setMode('flat');T.step(2);S.section.setMode(true);check('城镇可剖视',S.section.state.mode);T.setMode('sphere');check('切换先退出剖视',!S.section.state.mode);
    return checks;
  });
  out(r.every(x=>x[1]),'W8e-a C2 模式与交互',r.map(x=>`${x[1]?'PASS':'FAIL'} ${x[0]}`));
  const rows=[];let ok=true;
  const pA=await open(640,400),pB=await open(640,400);
  for(const mode of ['flat','sphere']){
    for(const p of [pA,pB])await p.evaluate(()=>{const S=window.__scene;S.weather.lock('clear');S.view.set({target:[20,1.2,65],dist:25});});
    await pA.evaluate(mode=>{const S=window.__scene;S.transition.setMode(mode);S.transition.step(2);S.view.set({dist:400,target:[45,1.2,-15]});window.__step(2);},mode);
    await pB.evaluate(mode=>{const S=window.__scene;S.transition.setMode(mode==='flat'?'sphere':'flat');S.transition.step(2);S.transition.setMode(mode);S.transition.step(2);S.view.set({dist:9,target:[-70,1.2,15]});window.__step(2);},mode);
    for(const p of [pA,pB])await p.evaluate(()=>{window.__scene.view.set({dist:25,target:[20,1.2,65]});window.__step(4);});
    const a=await state(pA),b=await state(pB),same=JSON.stringify(a)===JSON.stringify(b),df=await diff(pA,await shot(pA),await shot(pB));
    if(df.max){const dir=path.join(root,'docs/world/w8e');fs.mkdirSync(dir,{recursive:true});for(const [label,p] of [['a',pA],['b',pB]]){fs.writeFileSync(path.join(dir,`path-${mode}-${label}.png`),Buffer.from((await shot(p)).split(',')[1],'base64'));}}
    ok&&=same&&df.max===0;rows.push(`${mode} 农田 d=25：状态一致 ${same}，最大通道差 ${df.max}，超差像素 ${df.over}`);
  }
  await pA.close();await pB.close();out(ok,'W8e-a 路径无关：同模式同位置逐像素一致（固定时钟、晴夜锁定）',rows);
}
// ---- C3
if (want('c3')) {
  const r = await page.evaluate(async () => {
    const S = window.__scene, T = S.transition.api, B = S.bend, W = window.WORLD, R = B.R, D = Math.PI / 180; S.terrain.buildRest(); const samp = S.terrain.sampler();
    let s = 12345; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    let worstAng = 0, minClear = 1e9, minRaw = 1e9, lifted = 0; const cam = S.camera;
    for (let i = 0; i < 1000; i++) {
      const lon = -180 + rnd() * 360, lat = -84 + rnd() * 168, q = W.lonLatToTown(lon, lat), yaw = rnd() * 6.283, pitch = 0.05 + rnd() * 1.4, d = 9 + rnd() * 391, h0 = Math.max(0, samp(lon, lat) ?? 0);
      const fr = T.frame(B, [q.x, h0 + 1.2, q.z], d, yaw, pitch, 1), P = B.point(q.x, h0 + 1.2, q.z, 1), rv = [P[0], P[1] + R, P[2]], rl = Math.hypot(...rv), upv = fr.up;
      const ang = Math.acos(Math.max(-1, Math.min(1, (rv[0] * upv[0] + rv[1] * upv[1] + rv[2] * upv[2]) / rl))) / D; worstAng = Math.max(worstAng, ang);
      cam.position.set(...fr.position); const alt0 = (v => Math.hypot(v.x, v.y + R, v.z))(cam.position); S.transition.lift();
      const v = cam.position, r = Math.hypot(v.x, v.y + R, v.z), lam = Math.atan2(v.x, v.y + R), phi = Math.asin(-v.z / r), g = Math.max(0, samp(lam / D, phi / D) ?? 0);
      minRaw = Math.min(minRaw, alt0 - R - g); if (alt0 - R - g < 0.5) lifted++; minClear = Math.min(minClear, r - R - g);
    }
    return { worstAng, minClear, minRaw, lifted };
  });
  const ok = r.worstAng <= 0.01 && r.minClear >= 0.25;
  out(ok, 'W8a-C3 uBend = 1 时 camera.up 与目标点径向一致、相机不穿入地形', [`1000 个确定性随机目标（经度 ±180°、纬度 ±84°，d 9–400 m，俯仰 0.05–1.45 rad）：up 与径向的最大夹角 ${f(r.worstAng, 5)}°（≤ 0.01°）；相机到渲染地形的最小净空 ${f(r.minClear, 2)} m（≥ 0.25 m，相机每次径向抬升到地形上 0.5 m）；未抬升前的最小净空 ${f(r.minRaw, 2)} m，其中 ${r.lifted} 个需要抬升`]);
}
// ---- C5: pure visibility and two-second easing (no render-history dependencies)
if(want('c5')){
  const r=await page.evaluate(()=>{const T=window.__scene.transition.api;let max=0;for(let i=1;i<=120;i++)max=Math.max(max,T.bendOf(i/120)-T.bendOf((i-1)/120));return{max,ends:[T.bendOf(0),T.bendOf(1)],town:T.visibilityOf(25,0),field:T.visibilityOf(25,24),far:[T.farOf('flat'),T.farOf('sphere')]};});
  out(r.max<.02&&r.ends[0]===0&&r.ends[1]===1&&r.town===0&&r.field===1&&r.far[0]===400&&r.far[1]===600,'W8e-a C5 纯函数淡入与 2 秒缓动',[JSON.stringify(r)]);
}
if(args.includes('--shots')){
 const dir=path.join(root,'docs/world/w8e');fs.mkdirSync(dir,{recursive:true});const ps=await open(1280,800);
 async function save(name){fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from((await shot(ps)).split(',')[1],'base64'));}
 const farm=await ps.evaluate(()=>{const S=window.__scene,W=window.WORLD;S.cover.ensure();const cells=S.cover.data().cells.filter(c=>c.kind==='water'&&c.area>18&&c.group==='farm'&&W.townPatchDistance(c.seed.lon,c.seed.lat)>6&&W.townPatchDistance(c.seed.lon,c.seed.lat)<30),cell=cells[Math.floor(cells.length*.3)],q=W.lonLatToTown(cell.seed.lon,cell.seed.lat);window.__farm=[q.x,1.2,q.z];S.view.set({target:window.__farm,dist:25,yaw:2.5,pitch:.65});window.__step(4);return window.__farm;});console.log('farm target',JSON.stringify(farm));await save('flat-farm-close');
 await ps.evaluate(()=>{const S=window.__scene;S.view.set({target:[0,1.2,0],dist:300,yaw:2.5,pitch:.95});S.transition.setMode('sphere');});
 for(let i=1;i<=4;i++){await ps.evaluate(()=>{window.__scene.transition.step(.5);window.__step(1);});await save('town-to-sphere-'+i);}
 await ps.evaluate(()=>{const S=window.__scene;S.transition.step(2);S.view.set({target:window.__farm,dist:25,yaw:2.5,pitch:.65});window.__step(4);});await save('sphere-farm-close');
 await ps.close();out(true,'W8e-a 截图 docs/world/w8e/',['平面农田、切换四帧、球形农田近景']);
}
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
console.log(fails.length ? `FAIL transition_check：${fails.join('；')}` : `PASS transition_check（${results.length} 项）`);
process.exitCode = fails.length ? 1 : 0;

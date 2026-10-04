import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=process.env.BUILDING_KIT_ROOT?path.resolve(process.env.BUILDING_KIT_ROOT):path.resolve(dir,'../..');
const L=createRequire(import.meta.url)(path.join(root,'layout.js'));
const catalog=JSON.parse(fs.readFileSync(path.join(dir,'catalog.json'),'utf8'));
const prompts=JSON.parse(fs.readFileSync(path.join(dir,'IMAGE_PROMPTS.json'),'utf8')).prompts;
const assert=(v,m)=>{if(!v)throw Error(m)};
assert(catalog.length===L.plots.length,'plot coverage');
assert(new Set(catalog.map(r=>r.id)).size===catalog.length,'duplicate plot ids');
assert(prompts.length===catalog.length,'prompt coverage');
let links=0,bytes=0;
for(const r of catalog){
 const p=L.plots.find(p=>p.id===r.id);assert(p,'unknown plot '+r.id);
 for(const key of ['rect','buildable','entrances','frontages'])assert(JSON.stringify(r[key])===JSON.stringify(p[key]),r.id+' stale '+key);
 assert(r.front===p.front && r.maxHeight===p.maxHeight && r.plotType===p.type,r.id+' stale constraints');
 assert(prompts.some(p=>p.id===r.id),r.id+' missing prompt');
 for(const key of ['task','reference'])assert(fs.existsSync(path.join(dir,r[key])),r.id+' missing '+key);
 const b=fs.readFileSync(path.join(dir,r.reference));assert(b[0]===255&&b[1]===216,r.id+' invalid JPEG');bytes+=b.length;
 assert(r.views.length===8,r.id+' missing view definitions');
}
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])}
for(const f of walk(dir).filter(f=>f.endsWith('.md'))){
 const s=fs.readFileSync(f,'utf8');
 for(const m of s.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  if(/^(https?:|#)/.test(m[1]))continue;
  const dest=path.resolve(path.dirname(f),m[1].split('#')[0]);assert(fs.existsSync(dest),'broken link '+f+' -> '+m[1]);links++;
 }
}
console.log('PASS: '+catalog.length+' plots, '+catalog.length+' task cards, '+catalog.length+' eight-view JPEGs, '+prompts.length+' prompts; '+links+' local links; '+(bytes/1048576).toFixed(1)+' MiB references');


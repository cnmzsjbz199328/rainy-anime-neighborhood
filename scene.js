(()=>{'use strict';
const scene=new THREE.Scene();scene.background=new THREE.Color('#252e43');scene.fog=new THREE.FogExp2('#252e43',.0055);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;document.body.appendChild(renderer.domElement);
// Default view: from the north-east of the store corner, looking across X01 at the shop front.
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.25,400);let yaw=2.5,pitch=.5,dist=34;const target=new THREE.Vector3(-7,1.2,20);
const hemi=new THREE.HemisphereLight(0x8fb6ed,0x252438,2.0);scene.add(hemi);const moon=new THREE.DirectionalLight(0x9dbbff,2.3);moon.position.set(-6,9,4);scene.add(moon);
const ramp=new THREE.DataTexture(new Uint8Array([110,170,220,255]),4,1,THREE.RedFormat);ramp.needsUpdate=true;ramp.minFilter=ramp.magFilter=THREE.NearestFilter;
const mats={};
let seed=3187;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const paper=document.createElement('canvas');paper.width=paper.height=256;const pc=paper.getContext('2d');pc.fillStyle='#f5f1e8';pc.fillRect(0,0,256,256);
for(let i=0;i<5000;i++){pc.fillStyle='rgba(78,86,104,'+(.025+rnd()*.05)+')';pc.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1);}
for(let i=0;i<160;i++){pc.strokeStyle='rgba(92,96,107,.035)';pc.beginPath();let x=rnd()*256,y=rnd()*256;pc.moveTo(x,y);pc.lineTo(x+15+rnd()*40,y-8-rnd()*20);pc.stroke();}
const paperTex=new THREE.CanvasTexture(paper);paperTex.wrapS=paperTex.wrapT=THREE.RepeatWrapping;paperTex.colorSpace=THREE.SRGBColorSpace;
function mat(c){return mats[c]||(mats[c]=new THREE.MeshToonMaterial({color:c,gradientMap:ramp,map:paperTex}));}

// Named groups let the layout move each building and street fixture as a whole (translate, rotate, uniform scale only).
const groups={};let root=scene;
function group(name,parent=scene){let g=groups[name];if(!g){g=groups[name]=new THREE.Group();g.name=name;parent.add(g);}root=g;return g;}
const ink=new THREE.LineBasicMaterial({color:LOOK.PARAMS.inkColor,transparent:true,opacity:.68});
// W10c merge-ready: the edges of a geometry are computed once per distinct shape (type, vertices and index, a 64-bit fingerprint) and copied; the
// EdgesGeometry object itself is still made for every outline (three.js draws its id from Math.random: the town's rain keeps its stream)
const edgeCache=new Map();
function edgesOf(g){const p=g.attributes.position.array,ix=g.index?g.index.array:null;let h=2166136261|0;
  const mix=v=>{let k=Math.imul(v,0xcc9e2d51);k=(k<<15)|(k>>>17);k=Math.imul(k,0x1b873593);h^=k;h=(h<<13)|(h>>>19);h=(Math.imul(h,5)+0xe6546b64)|0;};
  const u=new Uint32Array(p.buffer,p.byteOffset,p.byteLength>>2);for(let i=0;i<u.length;i++)mix(u[i]);if(ix)for(let i=0;i<ix.length;i++)mix(ix[i]);
  const k=g.type+'|'+p.length+'|'+(ix?ix.length:0)+'|'+(h>>>0),same=(a,b)=>{if(!a||!b)return a===b;if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;};
  const list=edgeCache.get(k)||[],c=list.find(q=>same(q.p,p)&&same(q.ix,ix));          // the hash only buckets: a reuse needs the very same vertices and index
  if(!c){const e=new THREE.EdgesGeometry(g,35);list.push({p:p.slice(),ix:ix?ix.slice():null,out:e.attributes.position.array.slice()});edgeCache.set(k,list);return e;}     // exactly one geometry object per call either way
  const e=new THREE.EdgesGeometry(null,35);e.setAttribute('position',new THREE.Float32BufferAttribute(c.out.slice(),3));return e;}
function mesh(g,m,x,y,z,outline=true,parent=root){const a=new THREE.Mesh(g,typeof m==='string'?mat(m):m);a.position.set(x,y,z);parent.add(a);if(outline){const e=new THREE.LineSegments(edgesOf(g),ink);a.add(e);if(g.type==='BoxGeometry'){const eg=e.geometry.clone(),at=eg.attributes.position;for(let k=0;k<at.count;k++){at.setXYZ(k,at.getX(k)+(rnd()-.5)*.013,at.getY(k)+(rnd()-.5)*.013,at.getZ(k)+(rnd()-.5)*.013);}a.add(new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0x334458,transparent:true,opacity:.15})));}}return a;}
function box(x,y,z,w,h,d,c,outline=true,parent=root){return mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,outline,parent);}
function cyl(x,y,z,r,h,c,parent=root){return mesh(new THREE.CylinderGeometry(r,r,h,12),c,x,y,z,true,parent);}
function line(points,c='#34465c',r=.025,parent=root){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,32,r,6,false),mat(c),0,0,0,false,parent);}
function glow(c,opacity=.2){return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});}
function light(x,y,z,c,power,range){const l=new THREE.PointLight(c,power,range,2);l.position.set(x,y,z);root.add(l);return l;}
function label(text,x,y,z,w,h,bg='#f6e9c5',fg='#254755',size=55){const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const q=c.getContext('2d');q.fillStyle=bg;q.fillRect(0,0,c.width,c.height);q.fillStyle=fg;q.font=`bold ${size}px sans-serif`;q.textAlign='center';q.textBaseline='middle';q.fillText(text,512,c.height/2);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}),x,y,z,false);}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
// Shared by the building kit: window glass and the product/accent palette.
const glass=new THREE.MeshPhysicalMaterial({color:0xb1e1e4,transparent:true,opacity:.105,roughness:.2,metalness:.1,side:THREE.DoubleSide,depthWrite:false});
const colors=['#da8b80','#e7c978','#78aaa2','#7e99b5','#bd9abb','#ece2be'];
// The ink jitter sequence is pinned to the values it had when the retired samples were drawn first, so the
// remaining fixtures and every building keep their exact line work.
seed=679665027;
group('guardRail');for(let i=0;i<3;i++){let x=-2.1+i*1.25;cyl(x,.63,3.13,.045,.8,'#b5c3b6');}line([[-2.1,.91,3.13],[.4,.91,3.13]],'#b5c3b6',.045);
// The convenience-store lamp (the former sample) is a road lamp of streetlights.js now (W10c); its one outlined box drew 72 jitter values, which are
// still drawn so that the pole and signal below keep their ink. Utility pole: careful silhouette above the small roof.
for(let i=0;i<72;i++)rnd();
group('utilityPole');cyl(-4.7,2.91,-3.85,.1,5.7,'#7c8290');box(-4.7,5.25,-3.85,1.28,.08,.09,'#748f9b');for(let i=0;i<3;i++){cyl(-5.2+i*.5,5.39,-3.85,.05,.2,'#a6bcb5');line([[-5.2+i*.5,5.49,-3.85],[-2+i*.5,4.97,-4.9],[5.7,5.4,-4.9]],'#283746',.018);}
label('止まれ',-4.71,2.25,-3.72,.57,.5,'#b6797b','#eee1c6',170);
box(-4.71,3.1,-3.72,.7,.24,.025,'#648b9e');label('小路  KOMOREBI',-4.71,3.1,-3.7,.65,.2,'#648b9e','#e5e7d8',65);
group('trafficSignal');const signals=[];box(5.1,2.5,-4.75,.07,4.5,.07,'#4e6f7b');box(4.85,4.4,-4.75,.6,.22,.2,'#364d58');for(let i=0;i<3;i++){signals.push(mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:i===0?'#79c8ac':'#455563'}),4.66+i*.18,4.4,-4.635,false));}

// New buildings: buildings/<plot>.js registers BUILDINGS[plot](kit, record) and draws in its own local frame
// (front +z); the groups are placed below with the layout transforms. The kit shares the
// ink, toon ramp, paper grain and glass. Modules return an update(t, dt) for local animation.
// The shared random sequence is restored afterwards, so ground and later details never shift.
const warmMats={},amber=new THREE.Color('#ffb36b');
// Interior surfaces seen through glass: same toon paper material plus a soft amber self-light instead of extra lamps.
function warm(c,k=.3,map=paperTex){const key=c+'|'+k+'|'+map.uuid;return warmMats[key]||(warmMats[key]=new THREE.MeshToonMaterial({color:c,gradientMap:ramp,map,emissive:new THREE.Color(c).multiply(amber).multiplyScalar(k)}));}
// One wall slab with rectangular openings, inked only on its real edges. Openings [u0,u1,y0,y1] in wall coordinates:
// axis 'x' runs along x at depth z=at, axis 'z' runs along z at x=at.
function wall(axis,at,t,[u0,u1,y0,y1],holes,c,parent=root){const V=THREE.Vector2,s=new THREE.Shape([new V(u0,y0),new V(u1,y0),new V(u1,y1),new V(u0,y1)]);
  for(const [a,b,p,q] of holes)s.holes.push(new THREE.Path([new V(a,p),new V(a,q),new V(b,q),new V(b,p)]));
  const g=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false,curveSegments:1});g.translate(0,0,-t/2);tileUV(g,.5,.5);
  const m=mesh(g,c,axis==='x'?0:at,0,axis==='x'?at:0,true,parent);if(axis==='z')m.rotation.y=-Math.PI/2;return m;}
// Un-inked lining (interior finishes, wainscot) as strips around the same openings.
function panel(axis,at,t,[u0,u1,y0,y1],holes,c,parent=root){const us=[...new Set([u0,u1,...holes.flatMap(h=>[h[0],h[1]]).filter(u=>u>u0&&u<u1)])].sort((a,b)=>a-b);
  for(let i=0;i+1<us.length;i++){const a=us[i],b=us[i+1],m=(a+b)/2;let ys=[[y0,y1]];
    for(const h of holes.filter(h=>h[0]<m&&h[1]>m))ys=ys.flatMap(([p,q])=>[[p,Math.min(q,h[2])],[Math.max(p,h[3]),q]]).filter(([p,q])=>q-p>1e-3);
    for(const [p,q] of ys)axis==='x'?box((a+b)/2,(p+q)/2,at,b-a,q-p,t,c,false,parent):box(at,(p+q)/2,(a+b)/2,t,q-p,b-a,c,false,parent);}}
// Static detail collapses into one mesh per material (split at walking height, so measured footprints stay
// exact) and one batch per ink layer: a whole building costs a few dozen draw calls. Objects under a node
// flagged userData.live (animated drips, steam) are left alone; userData.layer (e.g. 'roof') keeps its own
// batches, tagged with the layer, so review tools can lift a roof or storey off.
// W10a: tint (the landmarks, which have no measured footprints) drops the walking-height split and gives every plain toon colour (opaque, no emissive,
// offset or shader edit of its own) one batch per texture: the colour moves into the vertex colours of a shared white copy (colour x texel is unchanged).
const tintMats={};
const plainToon=m=>m.isMeshToonMaterial&&!m.transparent&&!m.vertexColors&&!m.polygonOffset&&m.emissive.getHex()===0&&!m._bendUserCompile&&!Object.keys(m.userData).length;
function tintMat(m){const k=['T',m.map&&m.map.uuid,m.gradientMap&&m.gradientMap.uuid,m.side,m.flatShading,m.alphaTest,m.fog,m.depthTest,m.depthWrite].join('|');
  if(!tintMats[k]){const t=m.clone();t.color.setRGB(1,1,1);t.vertexColors=true;tintMats[k]=t;}return tintMats[k];}
function bake(g,tint=false){g.updateMatrixWorld(true);const inv=g.matrixWorld.clone().invert(),buckets=new Map(),done=[],bb=new THREE.Box3();
  g.traverse(o=>{if(!(o.isMesh||o.isLineSegments))return;for(let p=o;p&&p!==g;p=p.parent)if(p.userData.live)return;
    let layer='';for(let p=o;p&&p!==g;p=p.parent)if(p.userData.layer){layer=p.userData.layer;break;}
    const tm=tint&&o.isMesh&&plainToon(o.material)?tintMat(o.material):null,m=tm||o.material,lk=o.isLineSegments?'L'+m.color.getHex()+'|'+m.opacity:null;let band=false;if(!tint){bb.setFromObject(o,true);band=bb.max.y>.3&&bb.min.y<1.8;}
    const k=(lk||m.uuid)+'|'+band+'|'+layer;if(!buckets.has(k))buckets.set(k,{line:!!lk,m,layer,tinted:!!tm,list:[]});buckets.get(k).list.push(o);done.push(o);});
  /* W10c merge-ready: the parts are copied once into typed arrays of the final size (the same float32 values the plain arrays held; the same geometry
     objects are made in the same order, so the town's Math.random stream for the rain is untouched) */
  for(const {line,m,layer,tinted,list} of buckets.values()){const parts=[];let pl=0,nl=0,ul=0,cl=0;
    for(const o of list){let q=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();q.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));
      const a=q.attributes,n=a.position.count,pt={p:a.position.array,n:line?null:(a.normal?a.normal.array:n*3),u:line?null:(a.uv?a.uv.array:n*2),c:tinted?o.material.color:null,cnt:n};
      parts.push(pt);pl+=pt.p.length;if(!line){nl+=typeof pt.n==='number'?pt.n:pt.n.length;ul+=typeof pt.u==='number'?pt.u:pt.u.length;}if(tinted)cl+=n*3;q.dispose();}
    const P=new Float32Array(pl),N=new Float32Array(nl),U=new Float32Array(ul),C=new Float32Array(cl);let po=0,no=0,uo=0,co=0;
    for(const pt of parts){P.set(pt.p,po);po+=pt.p.length;if(!line){if(typeof pt.n==='number')no+=pt.n;else{N.set(pt.n,no);no+=pt.n.length;}if(typeof pt.u==='number')uo+=pt.u;else{U.set(pt.u,uo);uo+=pt.u.length;}}
      if(pt.c){const r=pt.c.r,g=pt.c.g,b=pt.c.b;for(let i=0;i<pt.cnt;i++){C[co++]=r;C[co++]=g;C[co++]=b;}}}
    const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
    if(!line){q.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));q.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));}
    if(tinted)q.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
    const b=line?new THREE.LineSegments(q,m):new THREE.Mesh(q,m);if(layer)b.userData.layer=layer;g.add(b);}
  for(const o of done)o.removeFromParent();}
const buildingFx=[];
seed=1395410823;
let landmarkKit=null;
{const s0=seed,kit={THREE,ramp,group,mesh,box,cyl,line,label,mat,warm,glow,glass,wall,panel,canvasTex,tileUV,colors,
    setRoot:r=>{root=r;},rand:k=>()=>((k=(k*1664525+1013904223)>>>0)/4294967296)};
  for(const b of LAYOUT.buildings){const build=(globalThis.BUILDINGS||{})[b.module];if(!build)continue;const beforeModuleSeed=seed;const fx=build(kit,b);if(b.module==='B05-P01')seed=beforeModuleSeed;if(fx&&fx.update)buildingFx.push(fx.update);
    for(const p of b.parts)if(groups[p.group])bake(groups[p.group]);}
  kit.ground=(lon,lat)=>terrain.sampler()(lon,lat);   // W8g-b (B3): the rendered terrain's height for the landmarks' anchors and entrance pads
  landmarkKit=kit;seed=s0;root=scene;}
// Town ground generated from LAYOUT (layout.js): carriageways, raised pavement islands with
// curb returns and step-free curb cuts, facility bands, alleys, walkway, bus aprons, edge trim and plots.
const L=LAYOUT,LV=L.LEVELS,BH=L.BASE.half,R=L.INTERSECTION.curbRadius;
// Hand-drawn ground textures on the paper grain (own seed, so the building details never shift).
let tseed=917;const trnd=()=>((tseed=(tseed*1664525+1013904223)>>>0)/4294967296);
function groundTex(draw){const c=document.createElement('canvas');c.width=c.height=256;const q=c.getContext('2d');q.drawImage(paper,0,0);draw(q);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
const TEX={   // one texture repeat = 4 × 4 units (64 px per unit)
  paving:groundTex(q=>{q.strokeStyle='rgba(52,62,74,.17)';q.lineWidth=1.3;for(let r=0;r<8;r++){const y=r*32+.5;q.beginPath();q.moveTo(0,y+(trnd()-.5));q.lineTo(256,y+(trnd()-.5));q.stroke();for(let x=(r%2)*32;x<256;x+=64){q.beginPath();q.moveTo(x+.5,y);q.lineTo(x+.5+(trnd()-.5),y+32);q.stroke();}}}),
  asphalt:groundTex(q=>{for(let i=0;i<2600;i++){q.fillStyle=trnd()<.5?'rgba(255,255,255,.05)':'rgba(0,0,0,.07)';q.fillRect(trnd()*256,trnd()*256,1+trnd()*1.5,1);}q.lineCap='round';for(let i=0;i<26;i++){q.strokeStyle='rgba(70,82,104,.05)';q.lineWidth=14+trnd()*22;q.beginPath();const x=trnd()*256,y=trnd()*256;q.moveTo(x,y);q.lineTo(x+40+trnd()*70,y+(trnd()-.5)*30);q.stroke();}}),
  grass:groundTex(q=>{q.lineCap='round';for(let i=0;i<1100;i++){q.strokeStyle=`rgba(44,78,58,${.1+trnd()*.12})`;q.lineWidth=1;const x=trnd()*256,y=trnd()*256,l=4+trnd()*6;q.beginPath();q.moveTo(x,y);q.lineTo(x+l*.45,y-l);q.stroke();}}),
  gravel:groundTex(q=>{for(let i=0;i<2400;i++){q.fillStyle=`rgba(${trnd()<.5?'58,60,62':'255,255,250'},${.08+trnd()*.12})`;const r=.6+trnd()*1.3;q.beginPath();q.arc(trnd()*256,trnd()*256,r,0,6.3);q.fill();}}),
};
const texMats={};function matT(c,tex,flat=false){const k=c+tex+flat;return texMats[k]||(texMats[k]=new THREE.MeshToonMaterial({color:c,gradientMap:ramp,map:TEX[tex],polygonOffset:flat,polygonOffsetFactor:flat?-1:0,polygonOffsetUnits:flat?-2:0}));}
const flatMats={};function flatMat(c){return flatMats[c]||(flatMats[c]=new THREE.MeshToonMaterial({color:c,gradientMap:ramp,map:paperTex,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));}
// Paper grain repeats every 4 units on ground pieces instead of stretching across the whole face.
function tileUV(g,sx,sy){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*sx,uv.getY(i)*sy);return g;}
function slab([x0,z0,x1,z1],y0,y1,c,outline=true){const w=x1-x0,d=z1-z0,h=y1-y0,g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv;for(let i=0;i<uv.count;i++){const f=Math.floor(i/4),s=f<2?[d,h]:f<4?[w,d]:[w,h];uv.setXY(i,uv.getX(i)*s[0]/4,uv.getY(i)*s[1]/4);}const a=mesh(g,c,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,outline);a.userData.groundOccupancy=true;return a;}
function flat([x0,z0,x1,z1],y,c){const a=mesh(tileUV(new THREE.PlaneGeometry(x1-x0,z1-z0),(x1-x0)/4,(z1-z0)/4),typeof c==='string'?flatMat(c):c,(x0+x1)/2,y,(z0+z1)/2,false);a.rotation.x=-Math.PI/2;a.userData.groundOccupancy=true;return a;}
// Splits a rect along axis i (0 = x, 1 = z) around excluded [a, b] spans.
function without(r,i,spans){let out=[r];for(const [a,b] of spans)out=out.flatMap(q=>{if(b<=q[i]||a>=q[i+2])return[q];const res=[];if(a>q[i]){const p=q.slice();p[i+2]=a;res.push(p);}if(b<q[i+2]){const p=q.slice();p[i]=b;res.push(p);}return res;});return out;}
const overlaps=(a,b)=>a[0]<b[2]-1e-6&&b[0]<a[2]-1e-6&&a[1]<b[3]-1e-6&&b[1]<a[3]-1e-6;
// Pavement islands: corners at intersections are curb-return arcs, curb cuts are notches in the curb.
for(const is of L.islands){const [x0,z0,x1,z1]=is.rect,C=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],names=['NW','NE','SE','SW'],mx=(x0+x1)/2,mz=(z0+z1)/2,pts=[];
  for(let i=0;i<4;i++){const c=C[i],p=C[(i+3)%4],n=C[(i+1)%4];
    if(is.round[names[i]]){const din=[Math.sign(c[0]-p[0]),Math.sign(c[1]-p[1])],dout=[Math.sign(n[0]-c[0]),Math.sign(n[1]-c[1])],o=[c[0]+Math.sign(mx-c[0])*R,c[1]+Math.sign(mz-c[1])*R];
      const A0=Math.atan2(c[1]-din[1]*R-o[1],c[0]-din[0]*R-o[0]);let d=Math.atan2(c[1]+dout[1]*R-o[1],c[0]+dout[0]*R-o[0])-A0;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
      for(let k=0;k<=12;k++)pts.push([o[0]+R*Math.cos(A0+d*k/12),o[1]+R*Math.sin(A0+d*k/12)]);}
    else pts.push(c);
    const ax=c[1]===n[1]?'z':'x',v=ax==='z'?c[1]:c[0],sg=ax==='z'?Math.sign(n[0]-c[0]):Math.sign(n[1]-c[1]),P=(s,o)=>ax==='z'?[s,v+o]:[v+o,s];
    const j=ax==='z'?0:1,lo=Math.min(c[j],n[j]),hi=Math.max(c[j],n[j]);
    for(const k of L.curbCuts.filter(k=>k.line===ax&&k.at===v&&k.s0>=lo&&k.s1<=hi).sort((a,b)=>sg*(a.s0-b.s0))){
      const [a,b]=sg>0?[k.s0,k.s1]:[k.s1,k.s0];pts.push(P(a,0),P(a,k.dir*k.depth),P(b,k.dir*k.depth),P(b,0));}}
  const g=new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z))),{depth:LV.pavement-LV.plinth,bevelEnabled:false,curveSegments:1});tileUV(g,.25,.25);
  // Omit the old outer plinth curb; interior street-facing curbs still use the same island mesh.
  const gp=g.getAttribute('position'),kept=[];
  for(let t=0;t<gp.count;t+=3){const a=[t,t+1,t+2],sameX=Math.abs(gp.getX(a[0])-gp.getX(a[1]))<1e-5&&Math.abs(gp.getX(a[1])-gp.getX(a[2]))<1e-5,
    sameY=Math.abs(gp.getY(a[0])-gp.getY(a[1]))<1e-5&&Math.abs(gp.getY(a[1])-gp.getY(a[2]))<1e-5,
    outer=(sameX&&Math.abs(Math.abs(gp.getX(a[0]))-BH)<1e-5)||(sameY&&Math.abs(Math.abs(gp.getY(a[0]))-BH)<1e-5),
    side=Math.max(...a.map(i=>gp.getZ(i)))-Math.min(...a.map(i=>gp.getZ(i)))>1e-5;
    if(!(outer&&side))kept.push(...a);}
  g.setIndex(kept);
  const m=mesh(g,matT('#87908c','paving'),0,LV.plinth,0);m.rotation.x=-Math.PI/2;m.userData.groundOccupancy=true;}
// Ramps fill the notches: a 1:10 slope from the carriageway up to pavement level, no step at either end.
for(const k of L.curbCuts){if(k.kind==='driveway'&&/^A0/.test(k.id))continue; // Unified alley strips supply these mouths.
  const lo=LV.carriageway,hi=LV.pavement,a=k.at,b=k.at+k.dir*k.depth;
  const V=k.line==='x'?[[a,lo,k.s0],[a,lo,k.s1],[b,hi,k.s1],[b,hi,k.s0]]:[[k.s0,lo,a],[k.s1,lo,a],[k.s1,hi,b],[k.s0,hi,b]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(V.flat(),3));
  const l=k.s1-k.s0;g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,l/4,0,l/4,k.depth/4,0,k.depth/4],2));
  const up=(V[1][0]-V[0][0])*(V[2][2]-V[0][2])-(V[1][2]-V[0][2])*(V[2][0]-V[0][0])<0;g.setIndex(up?[0,1,2,0,2,3]:[0,2,1,0,3,2]);g.computeVertexNormals();
  const m=mesh(g,k.kind==='ramp'?'#8a918c':'#848a86',0,0,0);m.userData.groundOccupancy=true;}
// Facility bands (curb strip where lamps, poles and drains stand), cut back at ramps, driveways and
// the curb returns, which stay plain pavement.
for(const s of L.surfaces.filter(s=>s.kind==='band')){const road=L.roads.find(r=>r.id===s.road),i=road.axis==='x'?0:1;
  const returns=L.roads.filter(o=>o.axis!==road.axis).map(o=>{const h=L.ROAD_TYPES[o.type].carriageway/2;return[o.at-h-R,o.at+h+R];});
  for(const r of without(s.rect,i,[...returns,...L.curbCuts.filter(k=>overlaps(k.rect,s.rect)).map(k=>[k.s0,k.s1])]))flat(r,LV.pavement,'#9aa29c');}
// Alley surfaces now come from the unified road strips; the former flat rectangles covered their junction ramps.
for(const w of L.walkways)flat([w.poly[0][0],w.poly[0][1],w.poly[2][0],w.poly[2][1]],LV.pavement,'#8d8c80');
for(const a of L.aprons)flat([a.poly[0][0],a.poly[0][1],a.poly[2][0],a.poly[2][1]],LV.pavement,'#8c9ba3');
// Plots: reserved land is low grass or cinder with the buildable envelope in pale gravel, so the
// space kept for future buildings reads at a glance; occupied plots are paved up to the sample floor.
group('plots');
const groundOf={school:'#7f9a6f',park:'#759d6c',house:'#86997a',apartment:'#86997a',shop:'#8f9583',store:'#8f9583',mixed:'#8f9583',civic:'#899682'};
const sampleTop=s=>Math.min(...s.parts.filter(p=>p.role==='building').map(p=>p.localBounds.min[1]))*(s.transform.scale??L.SAMPLE_SCALE);
function worldRect(s,[x0,z0,x1,z1]){const c=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>L.toWorld(s,x,z)),xs=c.map(p=>p[0]),zs=c.map(p=>p[1]);return[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];}
for(const p of L.plots){const s=L.structures.find(s=>s.plot===p.id);
  if(!s){const grass=['school','park','house','apartment'].includes(p.type);slab(p.rect,LV.pavement,LV.plot,matT(groundOf[p.type],grass?'grass':'gravel'));flat(p.buildable,LV.plot,p.type==='park'?matT('#8fae7e','grass',true):matT('#aca78f','gravel',true));continue;}
  const top=sampleTop(s);slab(p.rect,LV.pavement,top,'#9a9384');
  // Attachments (bicycles, planters, bins) stand on low concrete aprons instead of floating.
  for(const part of s.parts.filter(q=>q.role==='attachment')){const y=part.localBounds.min[1]*(s.transform.scale??L.SAMPLE_SCALE);
    if(y-top>.02){const r=worldRect(s,part.localBounds.ground);slab([r[0]-.06,r[1]-.06,r[2]+.06,r[3]+.06],top,y,'#8a877d');}}}
let townSignalPhases=[];
const buildTownRoadDetails=parent=>{const previousRoot=root;root=parent;let phased;
// ---- Street details (P3): markings, drainage, lamps, poles and wires, signals, signs, wet ground ----
// One quad batch per material keeps hundreds of stripes, gutters and channels to a few draw calls.
function quads(rects,y,m){const P=[],U=[],I=[];rects.forEach(([x0,z0,x1,z1],k)=>{P.push(x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1);U.push(x0/4,-z0/4,x1/4,-z0/4,x1/4,-z1/4,x0/4,-z1/4);const b=k*4;I.push(b,b+2,b+1,b,b+3,b+2);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();return mesh(g,m,0,0,0,false);}
// Flat decal lying on the ground, its "up" edge pointing along `heading`.
function decal(tex,w,h,x,y,z,heading,m){const a=mesh(new THREE.PlaneGeometry(w,h),m||new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-6}),x,y,z,false);a.rotation.set(-Math.PI/2,Math.atan2(-heading[0],-heading[1]),0,'YXZ');return a;}
const faceY=([fx,fz])=>Math.atan2(fx,fz);   // rotation that turns local +z towards (fx, fz)
group('markings',parent);
const paint=new THREE.MeshBasicMaterial({color:'#c9cfc4',transparent:true,opacity:.78,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-6});
quads(L.markings.filter(m=>m.rect).map(m=>m.rect),LV.carriageway,paint);
const paintTex=(w,h,draw)=>canvasTex(w,h,(q,W,H)=>{q.fillStyle=q.strokeStyle='#fff';draw(q,W,H);});
const diaTex=paintTex(64,160,(q,W,H)=>{q.lineWidth=9;q.beginPath();q.moveTo(W/2,6);q.lineTo(W-6,H/2);q.lineTo(W/2,H-6);q.lineTo(6,H/2);q.closePath();q.stroke();});
const textTex={};
for(const m of L.markings.filter(m=>!m.rect)){
  const tex=m.kind==='diamond'?diaTex:textTex[m.text]||(textTex[m.text]=paintTex(512,512,(q,W,H)=>{const k=2.3;q.font='bold 148px sans-serif';q.textAlign='center';q.textBaseline='middle';q.setTransform(1,0,0,k,0,0);q.fillText(m.text,W/2,H/2/k,W-24);}));
  decal(tex,m.size[0],m.size[1],m.x,LV.carriageway,m.z,m.heading,new THREE.MeshBasicMaterial({map:tex,color:'#c9cfc4',transparent:true,opacity:.78,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-6}));}
// Drainage: L-gutters along the curbs, grates and alley channels.
group('drainage',parent);
quads(L.gutters.map(g=>g.rect),LV.carriageway,flatMat('#737c7d'));
quads(L.channels.map(c=>c.rect),LV.pavement,flatMat('#5f6661'));
const grateTex=canvasTex(64,32,(q,W,H)=>{q.fillStyle='#2b3239';q.fillRect(0,0,W,H);q.fillStyle='#69737a';for(let i=4;i<W;i+=7)q.fillRect(i,3,3,H-6);});
const grateMat=new THREE.MeshToonMaterial({color:'#9aa3a6',gradientMap:ramp,map:grateTex});
for(const g of L.grates){const [w,d]=L.DRAIN.grate,a=box(g.x,LV.carriageway+.006,g.z,g.line==='z'?w:d,.012,g.line==='z'?d:w,grateMat);}
for(const c of L.channels)for(let x=c.rect[0]+1;x<c.rect[2]-.5;x+=1)box(x,LV.pavement+.004,(c.rect[1]+c.rect[3])/2,.04,.008,L.DRAIN.channel,'#3f4547',false);
// Alley security lamps, utility poles with catenary wires, signals and stop signs; the street lamps are road lamps of streetlights.js (W10c).
group('streetFurniture',parent);
const glowTex=canvasTex(128,128,(q,W)=>{const g=q.createRadialGradient(W/2,W/2,0,W/2,W/2,W/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');q.fillStyle=g;q.fillRect(0,0,W,W);});
const glowMat=(c,o)=>new THREE.MeshBasicMaterial({map:glowTex,color:c,transparent:true,opacity:o,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8});
const ledHead=new THREE.MeshBasicMaterial({color:'#eef2e4'});
const lamps=[];
for(const f of L.furniture){if(f.kind==='lamp'){for(let i=0;i<72;i++)rnd();continue;}   // a street lamp's outlined head box drew 72 jitter values: keep the later fixtures' ink
  const g=new THREE.Group();g.position.set(f.x,LV.pavement,f.z);root.add(g);
  if(f.kind==='alley-lamp'){g.rotation.y=faceY(f.face);cyl(0,1.6,0,.045,3.2,'#8a9096',g);box(0,3.05,.22,.08,.08,.4,'#8a9096',true,g);box(0,2.98,.4,.22,.09,.13,'#c9cec6',true,g);box(0,2.93,.4,.18,.01,.1,ledHead,false,g);
    lamps.push({x:f.x+f.face[0]*.4,z:f.z+f.face[1]*.4,c:'#dfe9e2',r:2.4,o:.26});}
  else if(f.kind==='pole'){g.rotation.y=faceY(f.across);cyl(0,2.85,0,.1,5.7,'#7c8290',g);box(0,5.1,0,.09,.08,1.28,'#748f9b',true,g);for(let i=0;i<3;i++)cyl(0,5.24,-.5+i*.5,.05,.2,'#a6bcb5',g);
    box(0,2.6,.105,.3,.9,.012,'#cfd5c4',true,g);}   // the usual tin address plate
  else if(f.kind==='signal'){g.rotation.y=faceY(f.face);box(0,2.25,0,.07,4.5,.07,'#4e6f7b',true,g);box(-.25,4.25,0,.6,.22,.2,'#364d58',true,g);
    const heads=[0,1,2].map(i=>mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:'#455563'}),-.44+i*.18,4.25,.115,false,g));f.heads=heads;}
  else if(f.kind==='stop-sign'){g.rotation.y=faceY(f.face);cyl(0,1.25,0,.035,2.5,'#b3bcc0',g);
    const t=canvasTex(256,224,(q,W,H)=>{q.fillStyle='#f1ece0';q.beginPath();q.moveTo(4,4);q.lineTo(W-4,4);q.lineTo(W/2,H-4);q.closePath();q.fill();q.fillStyle='#b6797b';q.beginPath();q.moveTo(22,15);q.lineTo(W-22,15);q.lineTo(W/2,H-26);q.closePath();q.fill();q.fillStyle='#f1ece0';q.font='bold 46px sans-serif';q.textAlign='center';q.fillText('止まれ',W/2,82);});
    mesh(new THREE.PlaneGeometry(.75,.66),new THREE.MeshBasicMaterial({map:t,transparent:true}),0,2.25,.045,false,g);const b=mesh(new THREE.PlaneGeometry(.75,.66),new THREE.MeshBasicMaterial({map:t,color:'#59636b',transparent:true}),0,2.25,.04,false,g);b.rotation.y=Math.PI;}
  f.group3=g;}
// Wires: three conductors per span, each a sagging catenary between matching insulators.
const legacyPole=L.legacyFurniture.find(f=>f.group==='utilityPole');groups.utilityPole.updateMatrixWorld(true);
const attach=f=>f.kind==='legacy'?legacyPole.wireAttach.map(p=>groups.utilityPole.localToWorld(new THREE.Vector3(...p))):[0,1,2].map(i=>{const [ax,az]=f.across,o=-.5+i*.5;return new THREE.Vector3(f.x+ax*o,LV.pavement+5.34,f.z+az*o);});
const byId=Object.fromEntries(L.furniture.map(f=>[f.id,f]));
for(const pl of L.poleLines)for(const [a,b] of pl.spans){const A=attach(byId[a]),B=attach(byId[b]);for(let i=0;i<3;i++){const pts=[];for(let k=0;k<=6;k++){const t=k/6,p=A[i].clone().lerp(B[i],t);p.y-=.42*4*t*(1-t);pts.push(p.toArray());}line(pts,'#34465c',.012);}}
// X01 phases: N–S traffic follows the original signal (green 0–19 s of a 30 s cycle), E–W gets green
// after a short all-red, then amber.
phased=L.furniture.filter(f=>f.kind==='signal').map(f=>({h:f.heads,ns:L.roads.find(r=>r.id===f.road).axis==='z'}));
// Light pools under the alley lamps: additive washes rather than real lights (the street lamps' pools are streetlights.js's).
for(const l of lamps)decal(null,l.r*2,l.r*2,l.x,LV.pavement,l.z,[0,-1],glowMat(l.c,l.o));
// Wet ground: puddles along the gutters and alley channels (their ripples: roads.js; the lamps' reflections in them: streetlights.js, from the final lamp table).
group('wetStreet',parent);
const puddleMat=new THREE.MeshStandardMaterial({color:'#456a80',transparent:true,opacity:.45,metalness:.6,roughness:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});

L.puddles.forEach(p=>{const y=p.on==='road'?LV.carriageway:LV.pavement,a=mesh(new THREE.CircleGeometry(1,32),puddleMat,p.x,y,p.z,false);a.rotation.x=-Math.PI/2;a.scale.set(p.rx,p.rz,1);});

root=previousRoot;townSignalPhases=phased;return {puddles:L.puddles.map(p=>({x:p.x,z:p.z,rx:p.rx,rz:p.rz,y:p.on==='road'?LV.carriageway:LV.pavement})),alleyLamps:lamps,markings:L.markings,gutters:L.gutters,channels:L.channels,grates:L.grates,outlets:L.outlets};
};
// Buildings move as whole groups (translate, rotate about Y, uniform scale); see layout.js.
for(const s of L.structures)for(const p of s.parts){const g=groups[p.group],t=s.transform;g.position.set(t.x,0,t.z);g.rotation.y=t.rotY;g.scale.setScalar(t.scale??L.SAMPLE_SCALE);}
// Original street furniture goes to provisional slots in the facility bands, foot on the band (the store's lamp: streetlights.js).
for(const f of L.legacyFurniture.filter(f=>f.group!=='streetLamp')){const g=groups[f.group],{x,z,rotY}=f.slot,c=Math.cos(rotY),n=Math.sin(rotY),[ax,az]=f.anchor,y0=new THREE.Box3().setFromObject(g,true).min.y;
  g.rotation.y=rotY;g.position.set(x-(ax*c+az*n),LV.pavement-y0,z-(-ax*n+az*c));}
// The pole's wires end at fixed points of the old street; hidden until P3 rewires the network.
groups.utilityPole.traverse(o=>{if(o.isMesh&&o.geometry.type==='TubeGeometry')o.visible=false;});
// Everything built so far is the town (ground, buildings, furniture); the weather registers its animated drips below.
const townRoots=scene.children.slice();
// Rain falls in a box that follows the view target, never under the roofs and awnings of the town's buildings (their registered shelter rects, see layout.js).
// WX2: every drop falls from 6.8 m above its floor to its floor, the receiving surface below it + 0.2 m (weather_fx.surfaceY: in the town the street ground, so 0.2 as
// always; the terrain, the sea, road decks and the landmarks' roofs elsewhere); a drop whose eight tries all fell under a shelter is parked for that fall (drawn
// nowhere); a drop shows only where the weather rains: its own hash below the field's rain weight at its spot. `positions` keeps the drops exactly as before (the
// town's Math.random stream and its pictures are unchanged); the GPU buffer `rainShow` is a copy with the hidden drops moved out of sight.
const roofs=L.structures.flatMap(s=>s.shelter?s.shelter.map(r=>worldRect(s,r)):s.parts.filter(p=>p.role==='building').map(p=>{const b=p.localBounds,r=worldRect(s,[b.min[0],b.min[2],b.max[0],b.max[2]]);return[r[0]-.1,r[1]-.1,r[2]+.1,r[3]+.1];}));
const rainBox=40,rainTop=7,rainCount=2800,positions=new Float32Array(rainCount*6),speeds=[];let rb=[0,0,0,0],roam=null,rainSurface=null,rainStamp=-1,rainShown=0,rainLv=-1,rainBucket=-9,rainRefresh=0,rainPass=0;
const rainShow=new Float32Array(rainCount*6),rainFloor=new Float64Array(rainCount).fill(.2),rainPark=new Uint8Array(rainCount),rainW=new Float32Array(rainCount),rainHash=new Float32Array(rainCount),rainLL={};
for(let i=0;i<rainCount;i++){let h=Math.imul(i+1,2654435761);h=Math.imul(h^(h>>>15),2246822519);h^=h>>>13;rainHash[i]=(h>>>0)/4294967296;}
function rainBounds(){const h=rainBox/2,center=roam?roam.position:target;rb=[center.x-h,center.z-h,center.x+h,center.z+h];}
function dropAt(i,y,floor0){let x,z,free=false;for(let k=0;k<8;k++){x=rb[0]+Math.random()*(rb[2]-rb[0]);z=rb[1]+Math.random()*(rb[3]-rb[1]);if(!roofs.some(r=>x>r[0]&&x<r[2]&&z>r[1]&&z<r[3])){free=true;break;}}
  const f=rainSurface?rainSurface(x,z)+.2:.2;if(f!==floor0)y=y-floor0+f;rainFloor[i]=f;rainPark[i]=free?0:1;rainW[i]=rainStamp<0?1:weatherFx.fieldXZ(x,z,rainLL).rain;positions.set([x,y,z,x-.035,y+.18,z-.014],i*6);}
rainBounds();for(let i=0;i<rainCount;i++){dropAt(i,Math.random()*rainTop,.2);speeds.push(4+Math.random()*3);}
const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(rainShow,3));const rainMat=new THREE.LineBasicMaterial({color:0xa9c9df,transparent:true,opacity:.29,depthWrite:false});rainMat.userData.noWrap=true;/* W8e-b: the rain box is laid out in the display frame (bend.js seam) */const rainObj=new THREE.LineSegments(rg,rainMat);rainObj.frustumCulled=false;/* W10a: the box follows the view target over the whole flat map, its first bounds would cull it away from the town */scene.add(rainObj);
// WX-G: the explicit bases of the lights and the fog. The light presets (look.js), the map transition and the walk write them; the weather writes base x its
// multiplier (and base fog + its added fog) every frame (weather_fx.js), the night gain of nightlight.js between them.
const lightBase={hemi:hemi.intensity,moon:moon.intensity,fog:scene.fog.density,fogColor:scene.fog.color.clone()};
const weatherFx=WEATHER_FX.attach(THREE,scene,{hemi,moon,look:lightBase,bend:BEND,nightGain:()=>1+NIGHTLIGHT.GAIN*nightLight.k()});rainSurface=weatherFx.surfaceY;
root=scene;
// User interaction: one finger or left mouse orbit, wheel/pinch zoom; pan by right mouse, Shift/Ctrl + drag, two-finger drag or WASD/arrows.
// W8e-b: the flat map runs from the seam at -85 deg to one circumference east of it (bend.js shifts what lies west of the seam); flat pans clamp to it, sphere pans wrap into it; latitude +-80 deg.
const ZOOM=TRANSITION.ZOOM,zoomTo=d=>Math.max(ZOOM[0],Math.min(ZOOM[1],d));
const TR={auto:true,mode:'flat',phase:0,animating:false,fog0:scene.fog.density,limitZ:Math.abs(WORLD.lonLatToTown(0,80).z),span:Math.PI*BEND.R,xMin:BEND.SEAM,xMax:BEND.SEAM+BEND.PERIOD};
const canonLon=l=>((l+180)%360+360)%360-180,lonLatAt=(x,z)=>{const ll=WORLD.townToLonLat(x,z);ll.lon=canonLon(ll.lon);return ll;};
const zoomUser=zoomTo;
const sphereCamera=SPHERE_CAMERA(THREE,BEND,camera);
function syncSphereTarget(){const p=sphereCamera.flat();target.x=p[0];target.z=p[1];}
function orbitSphere(dx,dy){yaw-=dx*.006;pitch=Math.max(.16,Math.min(Math.PI/2,pitch+dy*.005));}
function setMapMode(mode){if(!['flat','sphere'].includes(mode)||mode===TR.mode)return;setRoaming(false);if(mode==='sphere')sphereCamera.reset(target.toArray());else{target.z=Math.max(-TR.limitZ,Math.min(TR.limitZ,target.z));pitch=Math.min(1.45,pitch);}TR.mode=mode;TR.animating=true;mapButton.textContent=mode==='flat'?'球形地图':'平面地图';mapButton.setAttribute('aria-pressed',String(mode==='sphere'));}
function shiftTarget(wx,wz){target.z=Math.max(-TR.limitZ,Math.min(TR.limitZ,target.z+wz));const x=target.x+wx;target.x=TR.mode==='sphere'?BEND.wrapX(x):Math.max(TR.xMin,Math.min(TR.xMax,x));}

function pan(dx,dy){const k=dist*.0011,c=Math.cos(yaw),n=Math.sin(yaw);shiftTarget(-(dx*c+dy*n)*k,-(-dx*n+dy*c)*k);}
// W10f (W10_SPEC 2.8): one walk on the whole flat map. It stands on the walkable surfaces of the one ground sampler (ground.js: the roads with their shoulders, the
// bridge decks, stairs and boardwalk, the town's carriageways, alleys, pavements, ramps, the walkway and the bus aprons) with the W9a pace and eye in true metres,
// times the display scale s of the surface under it (1 in the town frame): 1.5 m/s, the eye 1.62 m above the ground under the camera, 3.1 m behind the walker, the
// look point 1.28 m up and 4 m ahead. A step goes on to the layer nearest the walker's height (a deck stays a deck, a tunnel a tunnel) and climbs at most 0.25 m (a curb,
// a stair riser); a blocked step slides along x or z. The camera stays over the walkable surface (pulled in where the surface behind ends). Entering starts at the
// nearest carriageway to the view target (ground.spawn); the free view's target, yaw, pitch and distance are kept for the way back.
const WALK={speed:1.5,eye:1.62,look:1.28,back:3.1,ahead:4,climb:.25,sub:.25};
let ground=null,roamButton=null,joystickValue=[0,0],lookPointer=null;
const keys=new Set();
const roamAvailable=()=>!!ground&&TR.mode==='flat'&&BEND.get()===0&&!TR.animating;
function setRoaming(enabled){if(enabled&&!roamAvailable())return;if(enabled===!!roam)return;
  if(enabled){const sp=ground.spawn(target.x,target.z,[target.x-camera.position.x,target.z-camera.position.z]);if(!sp)return;
    roam={position:new THREE.Vector3(sp.x,sp.y,sp.z),heading:sp.heading,lookPitch:0,sample:sp,spawn:{x:sp.x,z:sp.z,heading:sp.heading,distance:sp.distance,line:sp.line,edge:sp.edge},cameraPosition:new THREE.Vector3(),camSample:null,hasCameraPosition:false};
    camera.fov=46;camera.near=.08;camera.far=400;camera.updateProjectionMatrix();}
  else{roam=null;camera.fov=36;camera.near=.25;camera.far=400;camera.updateProjectionMatrix();lookPointer=null;joystickValue=[0,0];}
  if(roamButton){roamButton.textContent=roam?'自由视角  V':'街景漫游  V';roamButton.setAttribute('aria-pressed',String(!!roam));}canvas.style.cursor=roam?'grab':'';}
// one walk step: the surface at (x, z) on the walker's layer, if it is no higher or lower than a curb; x wraps into the flat map (the camera follows the wrap)
function walkTo(x,z,y){const q=ground.at(x,z,{y});return q&&Math.abs(q.y-y)<=WALK.climb*q.s?q:null;}
function roamStep(dt,[mx,mz]){const p=roam.position,h=roam.heading,fX=Math.sin(h),fZ=Math.cos(h),rX=-Math.cos(h),rZ=Math.sin(h),v=WALK.speed*roam.sample.s*dt,dx=(fX*mz+rX*mx)*v,dz=(fZ*mz+rZ*mx)*v,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(WALK.sub*roam.sample.s)));
  for(let i=0;i<n;i++){const ax=dx/n,az=dz/n;let tx=p.x+ax,tz=p.z+az,q=walkTo(tx,tz,p.y);if(!q&&ax){tx=p.x+ax;tz=p.z;q=walkTo(tx,tz,p.y);}if(!q&&az){tx=p.x;tz=p.z+az;q=walkTo(tx,tz,p.y);}if(!q)break;
    if(Math.abs(q.x-tx)>1)roam.cameraPosition.x+=q.x-tx;p.set(q.x,q.y,q.z);roam.sample=q;}}
function roamCamera(dt){const p=roam.position,s=roam.sample.s,h=roam.heading,fX=Math.sin(h),fZ=Math.cos(h),c=roam.cameraPosition,reach=d=>WALK.climb*s+.15*d;let want=null;
  for(const f of [1,.8,.6,.45,.3,.2,.1]){const d=WALK.back*s*f,q=ground.at(p.x-fX*d,p.z-fZ*d,{y:p.y});if(q&&Math.abs(q.y-p.y)<=reach(d)){want=q;break;}}
  if(!want)want=roam.sample;
  if(!roam.hasCameraPosition){c.x=want.x;c.z=want.z;roam.hasCameraPosition=true;}else{const k=1-Math.exp(-dt*5);c.x+=(want.x-c.x)*k;c.z+=(want.z-c.z)*k;}
  let cq=ground.at(c.x,c.z,{y:p.y});if(!cq||Math.abs(cq.y-p.y)>reach(WALK.back*s)){c.x=want.x;c.z=want.z;cq=want;}
  c.y=cq.y+WALK.eye*cq.s;roam.camSample=cq;camera.position.copy(c);const ad=WALK.ahead*s;camera.lookAt(p.x+fX*ad,p.y+WALK.look*s+Math.tan(roam.lookPitch)*ad,p.z+fZ*ad);}
function toggleRoaming(){setRoaming(!roam);}
const style=document.createElement('style');style.textContent=`#town-view-toggle{position:fixed;z-index:5;top:14px;right:14px;padding:8px 11px;border:1px solid rgba(205,220,220,.32);border-radius:18px;background:rgba(23,34,49,.62);color:#e8e5d9;font:12px/1.2 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(5px);cursor:pointer;opacity:.78}#town-view-toggle:hover,#town-view-toggle:focus-visible{opacity:1;background:rgba(31,47,63,.9);outline:1px solid rgba(205,220,220,.55)}#town-walk-stick{position:fixed;z-index:4;left:24px;bottom:24px;width:108px;height:108px;border:1px solid rgba(210,224,224,.22);border-radius:50%;background:rgba(23,34,49,.25);touch-action:none;display:none}#town-walk-nub{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border:1px solid rgba(225,233,224,.42);border-radius:50%;background:rgba(89,116,125,.56);pointer-events:none}@media(pointer:coarse){#town-walk-stick{display:block}}@media(max-width:520px){#town-view-toggle{top:10px;right:10px;font-size:11px;padding:7px 9px}#town-walk-stick{left:18px;bottom:20px;width:100px;height:100px}}`;
document.head.appendChild(style);roamButton=document.createElement('button');roamButton.id='town-view-toggle';roamButton.type='button';roamButton.textContent='街景漫游  V';roamButton.title='切换街景漫游与自由视角';roamButton.setAttribute('aria-label','切换街景漫游与自由视角');roamButton.addEventListener('click',toggleRoaming);document.body.appendChild(roamButton);
const mapButton=document.createElement('button');mapButton.id='map-mode-toggle';mapButton.type='button';mapButton.textContent='球形地图';mapButton.setAttribute('aria-label','切换平面地图与球形地图');mapButton.setAttribute('aria-pressed','false');mapButton.style.cssText='position:fixed;z-index:5;top:54px;right:14px;padding:7px 11px;border:1px solid #81939c;border-radius:18px;background:#172231cc;color:#e8e5d9;cursor:pointer;font:12px system-ui';mapButton.addEventListener('click',()=>setMapMode(TR.mode==='flat'?'sphere':'flat'));document.body.appendChild(mapButton);
const stick=document.createElement('div');stick.id='town-walk-stick';stick.setAttribute('aria-label','街景移动摇杆');const nub=document.createElement('div');nub.id='town-walk-nub';stick.appendChild(nub);document.body.appendChild(stick);let stickPointer=null;
function updateStick(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),max=33,k=len>max?max/len:1;joystickValue=[dx*k/max,-dy*k/max];nub.style.transform=`translate(${dx*k}px,${dy*k}px)`;}
stick.addEventListener('pointerdown',e=>{if(!roam)return;stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);e.preventDefault();});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)updateStick(e);});for(const ev of ['pointerup','pointercancel'])stick.addEventListener(ev,e=>{if(e.pointerId===stickPointer){stickPointer=null;joystickValue=[0,0];nub.style.transform='';}});
const pointers=new Map();let last=null,pinch=0,mid=null;const canvas=renderer.domElement;canvas.style.touchAction='none';canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});last={x:e.clientX,y:e.clientY};if(TR.mode==='sphere'&&!roam&&pointers.size===1)sphereCamera.begin(e.clientX,e.clientY,canvas.getBoundingClientRect());if(roam)canvas.style.cursor='grabbing';if(pointers.size===2){let p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};}});canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&!roam){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);const m={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};dist=zoomUser(dist*pinch/d);pinch=d;if(TR.mode==='sphere'){sphereCamera.end();orbitSphere(m.x-mid.x,m.y-mid.y);}else pan(m.x-mid.x,m.y-mid.y);mid=m;}else if(last){let dx=e.clientX-last.x,dy=e.clientY-last.y;if(roam){roam.heading+=dx*.005;roam.lookPitch=Math.max(-.45,Math.min(.7,roam.lookPitch+dy*.003));}else if(TR.mode==='sphere'){if(e.buttons===2||e.shiftKey||e.ctrlKey){sphereCamera.end();orbitSphere(dx,dy);}else{sphereCamera.drag(e.clientX,e.clientY);syncSphereTarget();}}else if(e.buttons===2||e.shiftKey||e.ctrlKey)pan(dx,dy);else{yaw-=dx*.006;pitch=Math.max(.16,Math.min(1.45,pitch+dy*.005));}}last={x:e.clientX,y:e.clientY};});for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,e=>{pointers.delete(e.pointerId);if(TR.mode==='sphere')sphereCamera.end();last=null;if(TR.mode==='sphere'&&pointers.size===1){last={...[...pointers.values()][0]};sphereCamera.begin(last.x,last.y,canvas.getBoundingClientRect());}if(roam)canvas.style.cursor='grab';});canvas.addEventListener('wheel',e=>{if(roam)return;e.preventDefault();dist=zoomUser(dist*Math.exp(e.deltaY*.001));},{passive:false});
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&(k==='v'||(k==='escape'&&roam))){toggleRoaming();e.preventDefault();return;}if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){keys.add(k);e.preventDefault();}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
function movement(){let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystickValue[0],z=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+joystickValue[1],m=Math.hypot(x,z);if(m>1){x/=m;z/=m;}return[x,z];}
// Planet landmarks (W7): landmarks/<id>.js registers LANDMARKS[id](kit, record) and draws in its own local frame (origin = site anchor, +Z towards the first entrance,
// +X to the left of +Z, 1 unit = 1 m). They are built at start-up (worldgen.js; inside the terrain's private random stream, so the town's rain is untouched) and
// then mapped vertex by vertex into the flat Mercator frame of the terrain (docs/world/W7_SPEC.md section 2): a local point (x, y, z) at distance d and bearing heading + atan2(-x, z)
// from the anchor is moved to the lon/lat that lies d * R / (R + altitude) along the sphere (the bend lengthens lateral distances at height by (R + altitude) / R, so this keeps
// every length in true metres, at any latitude), its flat height is (anchor altitude + y - 1.6) / cos(lat), and the normals are turned by the heading. bend.js then rolls it onto the sphere.
// Animated parts (userData.live) are not baked: they are re-parented into a wrapper at their mapped position with the local scale 1 / cos(lat).
// W8g-a: a stepped build (TERRAIN.job, one private stream for all of them as before), one step per landmark; between steps the town's own seed and root are back.
// W10a: each module group is baked with tint (bake above): one batch per texture for the plain colours, so the landmarks cost 172 draw calls instead of 445.
const landmarkGroups=[],landmarkFx=[],landmarkInfo={};
const landmarkJob=TERRAIN.job(function*(){const s0=seed,WO=window.WORLD,RR=90,DD=Math.PI/180;let k=0;
    for(const lm of WO.landmarks){if(lm.id==='TOWN')continue;const build=(globalThis.LANDMARKS||{})[lm.id];if(!build)continue;
      const before=new Set(Object.keys(groups));seed=424242+37*(++k);const fx=build(landmarkKit,lm);let roadGroundCut=null;
      const h=landmarkKit.ground(lm.lon,lm.lat),headDeg=lm.entrances[0]?lm.entrances[0].heading:0,th=Math.PI-headDeg*DD,cth=Math.cos(th),sth=Math.sin(th),own=[];
      // local point -> [flat x, flat y, flat z, 1 / cos(lat), k]
      const map=(x,y,z)=>{const d0=Math.hypot(x,z),yt=Math.max(-1.6,h+y-1.6),kk=RR/(RR+yt),d=d0*kk;let lon=lm.lon,lat=lm.lat;
        if(d0>1e-9){const q=WO.destination({lon:lm.lon,lat:lm.lat},headDeg+Math.atan2(-x,z)/DD,d);lat=q.lat;lon=lm.lon+(((q.lon-lm.lon+540)%360)-180);}
        const cc=1/Math.cos(lat*DD);return[RR*lon*DD,(h+y-1.6)*cc,-RR*Math.asinh(Math.tan(lat*DD)),cc,kk];};
      // The harbour tip is 31 m from LM10's anchor. A small rigid lamp needs its own tangent chart;
      // mapping its width from the distant site origin contracts it by about 1.9% on the globe.
      const mapRigid=(x,y,z,cx,cz)=>{const yt=Math.max(-1.6,h+y-1.6),kk=RR/(RR+yt);
        const base=WO.destination({lon:lm.lon,lat:lm.lat},headDeg+Math.atan2(-cx,cz)/DD,Math.hypot(cx,cz)*kk);
        const dx=x-cx,dz=z-cz,dd=Math.hypot(dx,dz),q=dd>1e-9?WO.destination(base,headDeg+Math.atan2(-dx,dz)/DD,dd*kk):base;
        const lon=lm.lon+(((q.lon-lm.lon+540)%360)-180),cc=1/Math.cos(q.lat*DD);
        return[RR*lon*DD,(h+y-1.6)*cc,-RR*Math.asinh(Math.tan(q.lat*DD)),cc,kk];};
      const warp=o=>{const g=o.geometry,p=g.attributes.position,nrm=g.attributes.normal,layer=o.userData.layer;
        const mapper=lm.id==='LM10'&&layer==='lm10-rigid-tip'?(x,y,z)=>mapRigid(x,y,z,31.2,3.2):lm.id==='LM10'&&layer==='lm10-rigid-lane'?(x,y,z)=>mapRigid(x,y,z,0,20):map;
        g.userData.local=Float32Array.from(p.array);
        for(let i=0;i<p.count;i++){const m=mapper(p.getX(i),p.getY(i),p.getZ(i));p.setXYZ(i,m[0],m[1],m[2]);
          if(nrm){const nx=nrm.getX(i),nz=nrm.getZ(i);nrm.setXYZ(i,nx*cth+nz*sth,nrm.getY(i),-nx*sth+nz*cth);}}
        p.needsUpdate=true;if(nrm)nrm.needsUpdate=true;g.computeBoundingSphere();g.computeBoundingBox();o.matrixAutoUpdate=false;o.updateMatrix();};
      for(const name of Object.keys(groups))if(!before.has(name)){const g=groups[name];g.updateMatrixWorld(true);
        // live objects: detach with their local position, re-attach in a wrapper at the mapped position
        const live=[];g.traverse(o=>{if(o.userData&&o.userData.live&&!live.some(q=>q.contains&&0))live.push(o);});
        const topLive=live.filter(o=>{for(let p=o.parent;p&&p!==g;p=p.parent)if(p.userData&&p.userData.live)return false;return true;});
        const wraps=topLive.map(o=>{const v=new THREE.Vector3();o.getWorldPosition(v);const m=map(v.x,v.y,v.z);o.updateMatrixWorld(true);const parentInv=new THREE.Matrix4().copy(o.parent.matrixWorld).invert();void parentInv;
          const w=new THREE.Group();w.name=name+':live';w.position.set(m[0],m[1],m[2]);w.rotation.y=th;w.scale.set(m[3]*m[4],m[3],m[3]*m[4]);
          // keep the object's own orientation and place it at the wrapper origin
          const q=new THREE.Quaternion();o.getWorldQuaternion(q);const sc=new THREE.Vector3();o.getWorldScale(sc);o.parent.remove(o);o.position.set(0,0,0);o.quaternion.copy(q);o.scale.copy(sc);w.add(o);scene.add(w);return w;});
        bake(g,true);g.traverse(o=>{if((o.isMesh||o.isLineSegments)&&o.geometry&&o.geometry.attributes.position&&!o.userData.warped){o.userData.warped=true;warp(o);}});
        if(/(?:Ground|Platform|Sando|Ice)$/.test(name))g.traverse(o=>{if(o.isMesh)o.userData.groundOccupancy=true;});
        if(terrain.cutGroundMeshes&&(/^(lm02Ground|lm04Sando|lm09Ground|lm09Platform|lm07Ice)$/.test(name))){const surfaces=[];g.traverse(o=>{if(o.isMesh&&o.geometry?.userData?.local&&(name!=='lm07Ice'||o.userData.layer==='ice-overlay'))surfaces.push(o);});const yr=name==='lm07Ice'?[-1.5,0.2]:name==='lm09Platform'?[0.86,0.95]:[-0.08,0.16];roadGroundCut=terrain.cutGroundMeshes(surfaces,yr);}
        g.position.set(0,0,0);g.rotation.set(0,0,0);g.scale.set(1,1,1);g.visible=true;wraps.forEach(w=>{w.visible=true;g.userData.wraps=(g.userData.wraps||[]).concat(w);landmarkGroups.push(w);});landmarkGroups.push(g);own.push(g);}
      landmarkInfo[lm.id]={groups:own,heading:headDeg,height:h,roadGroundCut};
      landmarkInfo[lm.id].fx=fx||null;if(fx&&fx.update)landmarkFx.push({id:lm.id,update:fx.update,groups:own});seed=s0;root=scene;yield;}
    seed=s0;root=scene;for(const g of landmarkGroups)BEND.seamSplit(g);},ms=>{landmarkInfo.buildMs=ms;});
function transitionStep(dt){
  if(TR.auto&&TR.animating){const end=TR.mode==='sphere'?1:0;TR.phase=Math.max(0,Math.min(1,TR.phase+(end?1:-1)*dt/TRANSITION.DURATION));BEND.set(TRANSITION.bendOf(TR.phase));TR.animating=TR.phase!==end;}
  if(TR.auto){scene.fog.density=lightBase.fog=TR.fog0*TRANSITION.fogOf(BEND.get());}
  const available=roamAvailable();roamButton.disabled=!available;roamButton.title=available?'切换街景漫游与自由视角':'球形地图与切换动画中不可漫游';
}
// the point the camera looks at: the target, target.y above the shown ground under it (ground.js, the same in the town and outside it); a point of the flat frame,
// so the bend carries it onto the sphere with everything else (a pure function of the target: no hysteresis; u is kept for the callers)
function lookTarget(u){void u;return[target.x,target.y+ground.y(target.x,target.z),target.z];}
// W8b: the weather at the camera's target and the camera's height above the ground there (weather_fx.js fades every effect with that height), and the camera-target
// distance d (the weather's fog keeps the target visible from there). On the flat map the height is taken above the look target, which sits on the shown ground
// (lookTarget: the rendered terrain, the sea at 0, 1.2 m in the town), not above the unlifted target.y (on high ground that counted the hill as camera height).
function weatherView(){if(roam){const p=roam.position,ll=lonLatAt(p.x,p.z);return{lonLat:ll,h:camera.position.y-p.y,d:camera.position.distanceTo(p),target:[p.x,p.y,p.z],u:0};}
  const u=BEND.get(),ll=lonLatAt(target.x,target.z);let h;if(u>0){const R=BEND.R,P=camera.position;h=Math.hypot(P.x,P.y+R,P.z)-R-Math.max(0,WORLD.height(ll.lon,ll.lat)-1.6);}else h=camera.position.y-lookTarget(0)[1];return{lonLat:ll,h,d:dist,target:[target.x,target.y,target.z],u,cam:[camera.position.x,camera.position.z]};}
// W8c: the night light by the camera's height above the ground (nightlight.js, stars.js): lamps and light band, far lights, readable panorama light, stars; all of it is 0 / 1 on the flat town
function nightStep(wv){nightLight.tick({h:wv.h,u:BEND.get()});}
// keep the camera 0.5 m above the shown ground's altitude under it (ground.js; the sphere's radial direction under the camera)
function liftCamera(){const R=BEND.R,P=camera.position,vx=P.x,vy=P.y+R,vz=P.z,r=Math.hypot(vx,vy,vz),lam=Math.atan2(vx,vy),phi=Math.asin(Math.max(-1,Math.min(1,-vz/r))),want=R+ground.alt(lam/(Math.PI/180),phi/(Math.PI/180))+.5;if(r<want){const k=want/r;camera.position.set(vx*k,vy*k-R,vz*k);}}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});let prev=0;function frame(ms){requestAnimationFrame(frame);const t=ms*.001,elapsed=Math.min(.12,t-prev),dt=Math.min(.04,elapsed);prev=t;
if(roam){roamStep(elapsed,movement());roamCamera(elapsed);
}else{const [kx,kz]=movement();if((kx||kz)&&TR.mode==='sphere'){sphereCamera.move(kx,kz,Math.max(3,Math.min(40,dist*.6))*elapsed,yaw);syncSphereTarget();}else if(kx||kz){const sp=dist*.6*elapsed;shiftTarget((Math.cos(yaw)*kx-Math.sin(yaw)*kz)*sp,(-Math.sin(yaw)*kx-Math.cos(yaw)*kz)*sp);}transitionStep(elapsed);const u=BEND.get(),fr=TR.mode==='sphere'&&u===1?sphereCamera.frame(lookTarget(u),dist,yaw,pitch):TRANSITION.frame(BEND,lookTarget(u),dist,yaw,pitch,u),far=TRANSITION.farOf(TR.mode);if(camera.far!==far){camera.far=far;camera.updateProjectionMatrix();}
  if(u>0&&!fr.screenUp){const centering=TRANSITION.smoothstep(80,300,dist)*u;fr.lookAt=[fr.lookAt[0]*(1-centering),fr.lookAt[1]*(1-centering)-BEND.R*centering,fr.lookAt[2]*(1-centering)];}
  camera.position.set(fr.position[0],fr.position[1],fr.position[2]);if(u>0){camera.up.set(fr.up[0],fr.up[1],fr.up[2]);liftCamera();if(fr.screenUp&&pitch>Math.PI/2-1e-7)camera.up.fromArray(fr.screenUp);camera.lookAt(fr.lookAt[0],fr.lookAt[1],fr.lookAt[2]);}else{if(camera.up.x!==0||camera.up.y!==1||camera.up.z!==0)camera.up.set(0,1,0);camera.lookAt(fr.lookAt[0],fr.lookAt[1],fr.lookAt[2]);}}
{const wv=weatherView();nightStep(wv);weatherFx.tick(t,dt,wv);if(window.ROADS_API)window.ROADS_API.setPuddleWeight(weatherFx.get()?.puddleWeight??1);}
rainBounds();const rs=weatherFx.stamp();if(rs!==rainStamp){const jump=weatherFx.lockVersion()!==rainLv||Math.abs(weatherFx.bucket()-rainBucket)>1;rainLv=weatherFx.lockVersion();rainBucket=weatherFx.bucket();rainRefresh=jump?rainCount:0;rainPass=jump?0:8;}rainStamp=rs;
/* the drops' rain weights follow the field: at once when the lock changes or the weather time jumps (so a locked clear is clear at the next frame), else over 8 frames */
const rfrom=rainPass>0?(8-rainPass)*rainCount/8:0,rto=rainPass>0?(9-rainPass)*rainCount/8:rainRefresh;if(rainPass>0)rainPass--;else rainRefresh=0;for(let i=0;i<rainCount;i++){let n=i*6;positions[n+1]-=dt*speeds[i];positions[n+4]-=dt*speeds[i];const x=positions[n],z=positions[n+2];if(positions[n+1]<rainFloor[i])dropAt(i,rainTop,.2);else if(x<rb[0]||x>rb[2]||z<rb[1]||z>rb[3])dropAt(i,positions[n+1],rainFloor[i]);else if(i>=rfrom&&i<rto)rainW[i]=weatherFx.fieldXZ(x,z,rainLL).rain;}
rainShown=0;for(let i=0;i<rainCount;i++){const n=i*6;if(!rainPark[i]&&rainHash[i]<rainW[i]){for(let k=0;k<6;k++)rainShow[n+k]=positions[n+k];rainShown++;}else{rainShow[n]=rainShow[n+3]=positions[n];rainShow[n+2]=rainShow[n+5]=positions[n+2];rainShow[n+1]=rainShow[n+4]=-1e4;}}
rg.attributes.position.needsUpdate=true;rainMat.opacity=(roam?.29:.29*Math.max(0,Math.min(1,(110-dist)/60)))*weatherFx.gains().dry;rainObj.visible=weatherFx.gains().rainOn&&rainShown>0&&rainMat.opacity>.001&&BEND.get()<1;signals[0].material.color.set(t%30<19?'#7cceae':'#43565d');{const c=t%30;for(const p of townSignalPhases){const st=p.ns?(c<19?0:2):(c>=19.5&&c<27.5?0:c>=27.5&&c<29.5?1:2);p.h[0].material.color.set(st===0?'#7cceae':'#43565d');p.h[1].material.color.set(st===1?'#e7c27a':'#43565d');p.h[2].material.color.set(st===2?'#d28d8e':'#43565d');}}signals[2].material.color.set(t%30>=19?'#d28d8e':'#43565d');for(const u of buildingFx)u(t,dt);for(const f of landmarkFx)f.update(t,dt);if(window.LOOK_API)window.LOOK_API.tick(t,camera);if(window.ROADS_API)window.ROADS_API.tick(t,camera);if(window.OCEAN_API)window.OCEAN_API.tick(t,camera);if(window.LANDCOVER_API)window.LANDCOVER_API.tick(t,camera);streetlights.tick(t,camera);weatherFx.apply();renderer.render(scene,camera);quality.frame(ms,camera);if(worldgen.frame()){loading.remove();renderer.domElement.style.visibility='';}}
// Hooks for browser checks and review shots.
const stars=STARS.attach(THREE,scene),martB=L.buildings.find(b=>b.plot==='B05-P01'),martL=martB.parts.find(p=>p.role==='building').localBounds,martAt=L.toWorld(martB,(martL.min[0]+martL.max[0])/2,(martL.min[2]+martL.max[2])/2),
nightLight=NIGHTLIGHT.attach({THREE,scene,camera,hemi,moon,stars,getSetting:()=>window.LOOK_API?window.LOOK_API.state.settings.light:'rainy',town:{store:martAt}});
const terrain=TERRAIN.attach(scene,()=>{const m=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:ramp});m.onBeforeCompile=WEATHER_FX.snowCover;return m;},BEND);   // WX3: a thin whitening of the ground where it snows
BEND.attach(scene);
const look=LOOK.attach(scene,{lights:{hemi,moon},ramp,renderer,lightBase},BEND,terrain);
const roads=ROADS.attach(scene,{ramp,renderer,townAsphalt:matT('#46505b','asphalt'),buildTownRoadDetails},BEND,terrain,look);
const ocean=OCEAN.attach(scene,{lights:{hemi,moon},ramp,renderer},BEND,terrain,look);
const quality=QUALITY.create();const cover=LANDCOVER.attach(scene,{lights:{hemi,moon},ramp,renderer,quality},BEND,terrain,look);
// W10c: every ordinary road lamp from one table (streetlights.js), planned once the land cover exists so that a lamp steps aside and the fields never do
const streetlights=STREETLIGHTS.attach(scene,{ramp,renderer},BEND,terrain,look);
// W8e-c: the clear daytime of the sphere, applied at render time only (daylight.js); the sun's frame follows the view target
const daylight=DAYLIGHT.attach({THREE,scene,hemi,moon,BEND,target:()=>[target.x,target.y,target.z],glint:()=>window.OCEAN_API&&window.OCEAN_API.state.built?window.OCEAN_API.uniforms:null});
// W10a (W10_SPEC 2.4): the whole world is built before the first frame (worldgen.js), behind the loading screen of build.py; the canvas stays hidden
// until the first frame, which is the complete world. No module is built on demand and none is shown or hidden by view.
renderer.domElement.style.visibility='hidden';
const loading=document.getElementById('loading');
const worldgen=WORLDGEN.create({progress:(value,label)=>{loading.querySelector('progress').value=value;loading.querySelector('p').textContent=label;},steps:[
  {name:'rest',label:'正在铺设地形',job:terrain.restJob},
  {name:'sampler',deps:['rest'],job:terrain.samplerJob},
  {name:'look-ink',deps:['sampler'],label:'正在准备外观',job:look.jobs.ink},
  {name:'roads',deps:['look-ink'],label:'正在连接道路',job:roads.job},
  {name:'ocean',deps:['roads'],label:'正在绘制海岸',job:ocean.job},
  {name:'landcover',deps:['ocean'],label:'正在种植森林',job:cover.job},
  {name:'streetlights',deps:['landcover'],label:'正在点亮路灯',job:streetlights.job},
  {name:'landmarks',deps:['landcover'],label:'正在安放村落',job:landmarkJob}
]});
worldgen.start().then(()=>{
const groundOccupancy=[];scene.traverse(o=>{if(o.isMesh&&o.userData.groundOccupancy)groundOccupancy.push(o);});
terrain.stats.occupancyCut=terrain.cutTerrainByGround(groundOccupancy);terrain.stats.occupancyCut.meshesTagged=groundOccupancy.length;
// W10f (W10_SPEC 2.5, 2.8): the one ground sampler of the camera and the walk; then one geometry for the flat map and the sphere: every mesh and line set with a part in
// the town and a horizontal edge over 4 m is cut to <= 4 m now, while the world is built (bend.js subdivide; the chord of a 4 m edge sags 2.2 cm on the sphere). The far
// lights of the night panorama are made first (night step, else at the first frame) so that they are cut too.
ground=GROUND.attach({W:WORLD,L,terrain:terrain.sampler(),roads:roads.data(),ROADS,BRIDGE,SEAM:BEND.SEAM});
nightStep(weatherView());
const townGeometry=BEND.subdivide([scene],{maxEdge:4,region:[-BH,-BH,BH,BH]});
// WX2 (docs/world/WEATHER_COMPLETION_PLAN.md 5.2, 5.3): the weather's receiving surfaces (the rendered terrain, the roads and decks of the lamp table, each landmark's
// roofs and grounds) and its registered effects: the buildings' animated drips and window runs (their live line batches in the drip colours) and rain rings (live
// additive rings), the landmarks' tagged parts (userData.weather), the mist belt of ameni-dake. Only their opacity and visibility follow the weather; nothing moves.
weatherFx.setSurface({terrain:terrain.sampler(),roads:(streetlights.data()&&streetlights.data().surface)||null});
for(const lm of WORLD.landmarks){const info=landmarkInfo[lm.id];if(info)weatherFx.setSurface({landmark:lm,groups:info.groups});}
{const v=new THREE.Vector3(),dripHex=new Set(['cee7e5','c1e4df','d4ecea']);for(const r of townRoots)r.traverse(o=>{if(!o.material)return;let live=false;for(let p=o.parent;p;p=p.parent)if(p.userData&&p.userData.live){live=true;break;}if(!live)return;
  let top=o;while(top.parent&&top.parent!==scene)top=top.parent;o.getWorldPosition(v);const ll=lonLatAt(v.x,v.z),src='building:'+top.name;
  if(o.isLineSegments&&o.material.isLineBasicMaterial&&dripHex.has(o.material.color.getHexString()))weatherFx.register(o,{kind:'drip',src,lon:ll.lon,lat:ll.lat});   // eave drips, window runs, rain chains and spouts
  else if(o.isMesh&&o.geometry&&o.geometry.type==='RingGeometry'&&o.material.blending===THREE.AdditiveBlending&&!/Chozu$/.test(top.name))   // the chozu basins' rings come from their spouts: not weather
    weatherFx.register(o,{kind:/Rain$/.test(top.name)?'drip':'impact',owner:'reset',src,lon:ll.lon,lat:ll.lat});});}   // a rain chain's basin rings follow its flow (drip), a pond's follow the rain
for(const lm of WORLD.landmarks){const info=landmarkInfo[lm.id];if(!info)continue;for(const g of info.groups)for(const r of [g,...(g.userData.wraps||[])])r.traverse(o=>{const k=o.userData&&o.userData.weather;if(k&&o.material)weatherFx.register(o,{kind:k,owner:'reset',src:lm.id,lon:lm.lon,lat:lm.lat});});}
if(cover.objects.mist){const lm=WORLD.landmarks.find(q=>q.id==='LM01');weatherFx.register(cover.objects.mist,{kind:'mist',owner:'reset',keepsVisible:true,src:'cover:mist',lon:lm.lon,lat:lm.lat});}
const surfaceOf=q=>({y:q.y,s:q.s,kind:q.kind,layer:q.layer,line:q.line,route:q.route,edge:q.edge,station:q.station,offset:q.offset,slope:q.slope});
window.__scene={scene,renderer,camera,look,rain:{obj:rainObj,shown:()=>rainShown,count:rainCount,floor:rainFloor,park:rainPark,weight:rainW,hash:rainHash,positions,show:rainShow},sphereCamera,groups,worldgen,quality,weather:weatherFx,night:{light:nightLight,stars,api:NIGHTLIGHT},day:daylight,bend:BEND,transition:Object.assign(TR,{api:TRANSITION,step:transitionStep,lift:liftCamera,lookTarget,setMode:setMapMode,roamAvailable}),terrain,look,roads,ocean,cover,streetlights,landmarks:{info:landmarkInfo,fx:landmarkFx},town:{roots:townRoots,geometry:townGeometry.stats},ground,walk:{config:WALK,step(dt,input){if(roam){roamStep(dt,input||[0,0]);roamCamera(dt);}return roam?window.__scene.view.get().roam:null;}},view:{get:()=>({yaw,pitch,dist,mapMode:TR.mode,target:target.toArray(),mode:roam?'roam':'free',cameraPosition:camera.position.toArray(),input:movement(),roam:roam?{position:roam.position.toArray(),heading:roam.heading,lookPitch:roam.lookPitch,surface:surfaceOf(roam.sample),camera:roam.camSample?surfaceOf(roam.camSample):null,spawn:roam.spawn}:null}),set(v){if(v.target){target.fromArray(v.target);target.x=BEND.wrapX(target.x);}if(v.mapMode)setMapMode(v.mapMode);if(v.mode){setRoaming(v.mode==='roam');}if(v.yaw!=null)yaw=v.yaw;if(v.pitch!=null)pitch=v.pitch;if(v.dist!=null)dist=zoomTo(v.dist);if(v.target&&TR.mode==='sphere')sphereCamera.reset(target.toArray());if(v.position&&roam){const q=ground.at(v.position[0],v.position[1]);if(q){roam.position.set(q.x,q.y,q.z);roam.sample=q;roam.hasCameraPosition=false;}}if(v.heading!=null&&roam)roam.heading=v.heading;},isWalkable(p){return !!ground.at(p[0],p[1]);},pan}};
requestAnimationFrame(frame);
}).catch(error=>{console.error(error);loading.querySelector('p').textContent='世界加载失败，请刷新重试';});
})();

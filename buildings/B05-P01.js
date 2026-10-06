// S3 こもれび MART. Door origin; +Z faces north, +X is the west service side.
// Static geometry is baked by the common loader; roof and animated assemblies remain separate.
(globalThis.BUILDINGS=globalThis.BUILDINGS||{})['B05-P01']=(K,rec)=>{
 const {THREE,group,box,mesh,cyl,line,wall,panel,mat,warm,glow,label}=K;
 const F=rec.floor, X0=-4.4,X1=2.5,Z1=-5.5,H=3.15,T=.16,C=-.95;
 const cream=mat('#d7d0b9'),trim=mat('#54777b'),roofmat=mat('#465965');
 const W=warm('#f1dfb8',.68),floor=warm('#d9cbaa',.55),steel=warm('#acbbb3',.42);
 const cols=['#da8b80','#e7c978','#78aaa2','#7e99b5','#bd9abb','#ece2be'].map(c=>warm(c,.5));
 const glass=K.glass.clone();glass.opacity=.09;
 const body=group('mart');
 const front=[[-4.22,-.69,F+.25,F+2.35],[-.6,.6,F,F+2.12],[.72,2.32,F+.25,F+2.35]];
 const east=[[-5.05,-.28,F+.65,F+2.3]],west=[[-4.95,-3.8,F+1.3,F+2.15]],back=[[-.5,.5,F,F+2.12],[-3.75,-2.35,F+1.1,F+2.1]];
 wall('x',-.08,T,[X0,X1,F,H],front,cream);wall('x',Z1+.08,T,[X0,X1,F,H],back,cream);
 wall('z',X0+.08,T,[Z1,0,F,H],east,cream);wall('z',X1-.08,T,[Z1,0,F,H],west,cream);
 box(C,F-.045,-2.75,6.9,.09,5.5,floor,false);
 panel('x',-.17,.014,[X0+.16,X1-.16,F,H],front,W);panel('x',Z1+.17,.014,[X0+.16,X1-.16,F,H],back,W);
 panel('z',X0+.17,.014,[Z1,0,F,H],east,W);panel('z',X1-.17,.014,[Z1,0,F,H],west,W);
 const roof=new THREE.Group();roof.userData.layer='roof';body.add(roof);
 box(C,H+.08,-2.75,7.28,.2,5.9,roofmat,true,roof);
 box(C,H-.08,-2.75,6.58,.04,5.2,W,false,roof);
 for(const x of [X0-.12,X1+.12])box(x,H+.28,-2.75,.09,.28,5.82,trim,true,roof);
 for(const z of [.15,-5.65])box(C,H+.28,z,7.25,.28,.09,trim,true,roof);
 // Layered green/coral fascia wraps the two street elevations and rear.
 for(const [y,h,c] of [[2.88,.15,'#78b4a4'],[3.03,.055,'#d59480']]){
  box(C,y,.035,6.88,h,.06,c);box(C,y,-5.535,6.88,h,.06,c);for(const x of [-4.435,2.535])box(x,y,-2.75,.06,h,5.5,c);
 }
 box(C,2.67,.34,7.28,.1,.82,trim);box(C,2.68,.74,7.28,.14,.075,'#3f6867');
 for(let i=0;i<13;i++)line([[-4.45+i*.57,2.74,-.04],[-4.45+i*.57,2.74,.74]],'#8ca39a',.012);
 const glaze=(axis,at,hole)=>{const[a,b,p,q]=hole,u=(a+b)/2,y=(p+q)/2;
  const ab=(u,y,w,h,d,c,o=true)=>axis==='x'?box(u,y,at,w,h,d,c,o):box(at,y,u,d,h,w,c,o);
  ab(u,y,b-a-.07,q-p-.07,.014,glass,false);for(const v of[a,b])ab(v,y,.045,q-p+.04,.085,trim);
  for(const v of[p,q])ab(u,v,b-a+.04,.045,.085,trim);
  for(let v=a+1.2;v<b-.2;v+=1.2)ab(v,y,.04,q-p,.09,trim);
 };
 for(const h of [front[0],front[2]])glaze('x',.012,h);
 for(const h of east)glaze('z',X0-.012,h);for(const h of west)glaze('z',X1+.012,h);glaze('x',Z1-.012,back[1]);
 const doors=[];
 for(let i=0;i<2;i++){const g=new THREE.Group();g.userData.live=true;g.name='martAutomaticDoor'+i;g.position.set(i? .3:-.3,0,.045);body.add(g);
  box(0,F+1.06,0,.57,2.1,.018,glass,false,g);for(const x of[-.29,.29])box(x,F+1.06,0,.035,2.12,.06,trim,true,g);
  for(const y of[F+.02,F+2.1,F+1])box(0,y,0,.6,.035,.06,trim,true,g);doors.push(g);
 }
 box(0,F+2.17,.04,1.32,.1,.13,trim);label('いらっしゃいませ',0,2.55,.09,1.28,.13,'#efe3c4','#446760',72);
 const signG=new THREE.Group();signG.userData.live=true;body.add(signG);K.setRoot(signG);
 const sign=label('こもれび  MART',-1.2,2.99,.115,4.9,.28,'#fff1cc','#377f7e',48);
 label('24 OPEN',1.78,3.02,.116,.82,.28,'#fff1cc','#aa6864',85);K.setRoot(body);
 // Original three interior lights, replacing the detached legacy lights. No vending lights.
 for(const [x,y,z,c,i,d] of [[-1.34,2.7,1,0xffd8a1,17,7],[-2.84,2.5,-2.8,0xffe4b0,13,6],[.86,2.5,-3.8,0xffdfb4,12,6]]){const l=new THREE.PointLight(c,i,d,2);l.position.set(x,y,z);body.add(l);}
 // Back-room partition with a full-height opening in the uninterrupted central aisle.
 wall('x',-4.12,.12,[X0+.16,X1-.16,F,H-.1],[[-.55,.55,F,F+2.12]],W);
 label('STAFF',0,2.64,-4.045,.65,.18,'#d9d8bd','#486466',95);
 box(0,F+1.06,-5.48,.94,2.12,.065,trim);box(.32,F+1,-5.54,.035,.16,.06,'#c5c8aa');
 const shelf=(x,z,w,levels=3)=>{box(x,F+.62,z-.2,w,1.24,.035,steel);for(const dx of[-w/2+.035,w/2-.035])box(x+dx,F+.62,z,.04,1.24,.45,steel);for(let k=0;k<levels;k++){
  const y=F+.22+k*.38;box(x,y,z,w+.04,.035,.57,W);
  for(let j=0;j<Math.floor(w/.22);j++){const px=x-w/2+.14+j*.22;box(px,y+.13,z+.12,.15,.23,.2,cols[(j+k)%6],false);box(px,y+.12,z+.225,.1,.04,.012,W,false);}
 }};
 // Narrow central island on the east, checkout on west; clear 1.05 m spine at x=0.
 shelf(-2.05,-2.35,1.95);
 // Open bento display: food trays on supported decks, with rice balls on the top ledge.
 for(const x of[-2.94,-1.16])box(x,F+.54,-.68,.045,1.08,.48,steel);
 for(const y of[F+.24,F+.62,F+1.065])box(-2.05,y,-.68,1.85,.03,.56,W);
 for(let k=0;k<2;k++)for(let j=0;j<5;j++){const x=-2.73+j*.34,y=F+.30+k*.38;
  box(x,y,-.6,.29,.09,.3,trim);box(x,y+.05,-.6,.25,.02,.26,W,false);
  box(x-.06,y+.075,-.6,.095,.03,.2,cols[1],false);box(x+.065,y+.075,-.6,.1,.03,.2,cols[2],false);
 }
 for(let i=0;i<6;i++){mesh(new THREE.ConeGeometry(.09,.18,3),W,-2.68+i*.25,F+1.17,-.58,true);box(-2.68+i*.25,F+1.13,-.48,.07,.07,.015,trim,false);}
 label('おにぎり・お弁当',-2.05,F+1.45,-.37,1.85,.18,'#e7bd80','#68584a',66);
 // Rear cold cabinets stocked with bottles; warm-lit geometry, never opaque glowing glass.
 for(let i=0;i<3;i++){const x=-3.56+i*.86;box(x,F+1,-3.72,.8,2,.48,steel);box(x,F+1,-3.468,.7,1.78,.018,trim,false);
  for(let k=0;k<4;k++){box(x,F+.25+k*.43,-3.35,.72,.03,.22,W);for(let j=0;j<4;j++)cyl(x-.25+j*.16,F+.38+k*.43,-3.34,.045,.2,cols[(i+j+k)%6]);}
  box(x,F+1,-3.18,.73,1.84,.012,glass,false);box(x+.27,F+1,-3.155,.025,.3,.025,W);
 }
 label('DRINKS · 冷たい飲み物',-2.7,2.66,-3.38,2.55,.19,'#d8e5c8','#447e81',62);
 box(1.54,F+.42,-1.45,1.3,.84,.72,trim);box(1.54,F+.91,-1.45,1.4,.08,.82,W);
 box(1.27,F+1.12,-1.42,.3,.34,.26,trim);box(1.27,F+1.18,-1.275,.24,.15,.015,cols[2]);
 box(1.99,F+1.05,-1.45,.42,.2,.42,steel);for(let j=0;j<6;j++)cyl(1.88+(j%2)*.15,F+1.18,-1.6+Math.floor(j/2)*.13,.047,.035,cols[1]);
 for(const x of[1.78,2.2])for(const z of[-1.66,-1.24])box(x,F+1.25,z,.018,.25,.018,steel);box(1.99,F+1.38,-1.45,.46,.04,.46,glass);box(1.99,F+1.53,-1.43,.025,.32,.025,steel);label('おでん',1.98,F+1.54,-1.2,.46,.22,'#e5b67f','#6b4d43',145);
 box(1.65,F+.43,-2.7,1.1,.86,.65,steel);box(1.65,F+1.22,-2.7,.42,.65,.42,trim);box(1.65,F+1.26,-2.475,.28,.2,.025,W);cyl(1.65,F+.98,-2.42,.085,.14,W);
 box(1.54,F+.4,-.52,1.28,.8,.55,steel);box(1.54,F+.83,-.52,1.2,.04,.49,glass);label('ICE CREAM',1.54,F+.48,-.23,1.18,.18,'#d9e6de','#56848b',65);
 shelf(-3.65,-.58,.67,2);box(-3.65,F+.835,-.29,.74,.03,.24,W);for(let i=0;i<4;i++){const m=box(-3.88+i*.15,F+1.02,-.26,.13,.33,.035,cols[i]);m.rotation.x=-.22;}
 label('新刊 · MAGAZINE',-3.65,F+1.3,-.23,.75,.14,'#e8dbc3','#5a7473',53);
 // Stock room: lockers, cartons and worktop; route continues from STAFF to rear door.
 for(const x of[1.05,1.6,2.15]){box(x,F+.91,-5.12,.49,1.82,.45,steel);box(x+.13,F+.88,-4.875,.025,.12,.025,trim);}
 for(const x of[-3.65,-2.95,-2.25]){box(x,F+.23,-4.9,.6,.46,.65,cols[1]);box(x,F+.55,-4.9,.55,.18,.55,W);}
 for(const z of[-.55,-1.5,-2.6]){const a=label('↑',0,F+.007,z,.24,.36,'#d9cbaa','#ac896b',650);a.rotation.x=-Math.PI/2;}
 // Equipment, brackets, roof seams, drain and service-side posters.
 for(const [x,z] of[[-3.1,-4.6],[1.05,-3.8]]){box(x,H+.25,z,1,.2,.85,trim,true,roof);box(x,H+.69,z,.86,.68,.65,cream,true,roof);for(let k=0;k<6;k++)box(x,H+.47+k*.08,z+.335,.68,.024,.02,trim,false,roof);}
 for(const x of[-3.8,-2.4,-1,.4,1.8])line([[x,H+.19,-5.5],[x,H+.19,0]],'#75838a',.01,roof);
 line([[2.5,3.3,-4.2],[2.74,3.3,-4.2],[2.74,.34,-4.2]],'#7b8e97',.038);
 for(let i=0;i<4;i++){const a=label(i%2?'SALE':'夏の便り',2.59,1.4+Math.floor(i/2)*.43,-1.1+(i%2)*.4,.32,.36,['#d8b79a','#a4bbae'][i%2],'#445c60',105);a.rotation.y=Math.PI/2;}
 // Batches of moving rain line segments: 40 glass traces and 18 eave drops.
 const rain=new THREE.Group();rain.userData.live=true;body.add(rain);const rainBatches=[];
 for(const [n,z,speed,len,base,range] of[[40,.045,.11,.09,.6,1.95],[18,.755,2.2,.12,.32,2.32]]){
  const pos=new Float32Array(n*6),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const obj=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#cee7e5',transparent:true,opacity:.4,depthWrite:false}));rain.add(obj);
  rainBatches.push({pos,geo,n,z,speed,len,base,range});
 }
 group('martVending');
 for(let i=0;i<2;i++){const x=-3.6+i*.91,z=.38;box(x,F+.925,z,.79,1.85,.66,cols[i?0:2]);box(x,F+1.14,z+.342,.62,1.05,.022,trim);
  for(let k=0;k<3;k++)for(let j=0;j<4;j++){cyl(x-.23+j*.15,F+.8+k*.29,z+.37,.044,.17,cols[(j+k)%6]);box(x-.23+j*.15,F+.67+k*.29,z+.38,.07,.025,.015,W,false);}
  box(x-.1,F+.27,z+.35,.37,.14,.035,trim);box(x+.23,F+.4,z+.35,.12,.18,.03,steel);label('つめたい',x,F+1.8,z+.345,.61,.13,'#d6ece2','#537a81',86);
 }
 group('martBikes');
 for(const z of[-1.9,-3.3]){const x=-5.08;for(const zz of[z-.53,z+.53]){const wheel=mesh(new THREE.TorusGeometry(.32,.028,6,18),trim,x,F+.33,zz,false);wheel.rotation.y=Math.PI/2;const rim=mesh(new THREE.TorusGeometry(.28,.012,6,18),steel,x,F+.33,zz,false);rim.rotation.y=Math.PI/2;for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[x,F+.33,zz],[x,F+.33+Math.sin(a)*.28,zz+Math.cos(a)*.28]],'#7c969d',.005);}}
 line([[x,F+.33,z-.53],[x,F+.76,z-.2],[x,F+.33,z+.04],[x,F+.33,z-.53],[x,F+.68,z+.39],[x,F+.33,z+.53],[x,F+.33,z+.04]],'#c4a083',.025);
 box(x,F+.79,z-.18,.22,.05,.23,trim);line([[x,F+.33,z+.53],[x,F+.87,z+.4],[x-.18,F+.94,z+.38]],'#9bb8bc',.024);}
 group('martService');
 box(1.14,F+.255,.38,.36,.51,.34,trim);for(let i=0;i<4;i++){const x=1.02+i*.08;line([[x,F+.2,.38],[x,F+.95,.38],[x+.07,F+1.01,.38]],'#b1c5c1',.014);mesh(new THREE.ConeGeometry(.055,.55,7),cols[i],x,F+.55,.38,true);}
 for(const z of[-.5,-1.2]){cyl(3.2,F+.36,z,.23,.72,trim);cyl(3.2,F+.74,z,.24,.07,steel);}
 for(const z of[-2.65,-4.8]){box(2.97,F+.08,z,.7,.16,.85,trim);box(2.97,F+.57,z,.6,.82,.8,cream);for(let i=0;i<8;i++)box(3.285,F+.29+i*.075,z,.025,.025,.64,trim,false);}
 group('martRear');box(-1.45,F+.2,-5.85,.65,.4,.4,cols[2]);box(-2.18,F+.2,-5.85,.65,.4,.4,cols[1]);
 group('martGround');box(0,F-.023,.28,1.26,.025,.52,trim,false);
 group('martReflection');
 // Preserve the existing public-sidewalk light decal, not a physical footprint.
 const rnd=K.rand(5301),amber=glow('#efc494',.12),cyan=glow('#8ee1d2',.1);
 for(let i=0;i<70;i++)box(-2.5+rnd()*6.8-1.84,.162,4.1+rnd()*1.8-1.8,.025+rnd()*.1,.004,.09+rnd()*.37,i%3?amber:cyan,false);
 const ref=label('こもれび MART',.7-1.84,.164,5-1.8,5,.48,'#2c4354','#93b7ac',80);ref.rotation.x=-Math.PI/2;ref.material.transparent=true;ref.material.opacity=.2;ref.material.depthWrite=false;
 return {update(t){const c=t%19,o=c>10&&c<15?Math.min(1,(c-10)*1.5,(15-c)*1.5):0;doors[0].position.x=-.3-o*.46;doors[1].position.x=.3+o*.46;sign.material.color.setScalar(1-.07*Math.pow(Math.sin(t*1.7),24));
 for(const b of rainBatches){for(let i=0;i<b.n;i++){const x=-4.2+(i+.3)/b.n*6.45,y=b.base+((i*.137-t*b.speed)%b.range+b.range)%b.range;b.pos.set([x,y,b.z,x,y+b.len,b.z],i*6);}b.geo.attributes.position.needsUpdate=true;}}
 };
};

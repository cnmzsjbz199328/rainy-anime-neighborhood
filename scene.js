(()=>{'use strict';
const scene=new THREE.Scene();scene.background=new THREE.Color('#252e43');scene.fog=new THREE.FogExp2('#252e43',.0055);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;document.body.appendChild(renderer.domElement);
// Default view: from the north-east of the store corner, looking across X01 at the shop front.
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.25,400);let yaw=2.5,pitch=.5,dist=34;const target=new THREE.Vector3(-7,1.2,20);
scene.add(new THREE.HemisphereLight(0x8fb6ed,0x252438,2.0));const moon=new THREE.DirectionalLight(0x9dbbff,2.3);moon.position.set(-6,9,4);scene.add(moon);
const ramp=new THREE.DataTexture(new Uint8Array([110,170,220,255]),4,1,THREE.RedFormat);ramp.needsUpdate=true;ramp.minFilter=ramp.magFilter=THREE.NearestFilter;
const mats={};
let seed=3187;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const paper=document.createElement('canvas');paper.width=paper.height=256;const pc=paper.getContext('2d');pc.fillStyle='#f5f1e8';pc.fillRect(0,0,256,256);
for(let i=0;i<5000;i++){pc.fillStyle='rgba(78,86,104,'+(.025+rnd()*.05)+')';pc.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1);}
for(let i=0;i<160;i++){pc.strokeStyle='rgba(92,96,107,.035)';pc.beginPath();let x=rnd()*256,y=rnd()*256;pc.moveTo(x,y);pc.lineTo(x+15+rnd()*40,y-8-rnd()*20);pc.stroke();}
const paperTex=new THREE.CanvasTexture(paper);paperTex.wrapS=paperTex.wrapT=THREE.RepeatWrapping;paperTex.colorSpace=THREE.SRGBColorSpace;
function mat(c){return mats[c]||(mats[c]=new THREE.MeshToonMaterial({color:c,gradientMap:ramp,map:paperTex}));}

// Named groups let the layout move each existing sample as a whole (translate, rotate, uniform scale only).
const groups={};let root=scene;
function group(name){let g=groups[name];if(!g){g=groups[name]=new THREE.Group();g.name=name;scene.add(g);}root=g;return g;}
const ink=new THREE.LineBasicMaterial({color:0x273647,transparent:true,opacity:.68});
function mesh(g,m,x,y,z,outline=true,parent=root){const a=new THREE.Mesh(g,typeof m==='string'?mat(m):m);a.position.set(x,y,z);parent.add(a);if(outline){const e=new THREE.LineSegments(new THREE.EdgesGeometry(g,35),ink);a.add(e);if(g.type==='BoxGeometry'){const eg=e.geometry.clone(),at=eg.attributes.position;for(let k=0;k<at.count;k++){at.setXYZ(k,at.getX(k)+(rnd()-.5)*.013,at.getY(k)+(rnd()-.5)*.013,at.getZ(k)+(rnd()-.5)*.013);}a.add(new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0x334458,transparent:true,opacity:.15})));}}return a;}
function box(x,y,z,w,h,d,c,outline=true,parent=root){return mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,outline,parent);}
function cyl(x,y,z,r,h,c,parent=root){return mesh(new THREE.CylinderGeometry(r,r,h,12),c,x,y,z,true,parent);}
function line(points,c='#34465c',r=.025,parent=root){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,32,r,6,false),mat(c),0,0,0,false,parent);}
function glow(c,opacity=.2){return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});}
function light(x,y,z,c,power,range){const l=new THREE.PointLight(c,power,range,2);l.position.set(x,y,z);root.add(l);return l;}
function label(text,x,y,z,w,h,bg='#f6e9c5',fg='#254755',size=55){const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const q=c.getContext('2d');q.fillStyle=bg;q.fillRect(0,0,c.width,c.height);q.fillStyle=fg;q.font=`bold ${size}px sans-serif`;q.textAlign='center';q.textBaseline='middle';q.fillText(text,512,c.height/2);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}),x,y,z,false);}
group('store');
// Store walls, tiled floor, and a shallow roof to retain window sightlines.
box(.85,.3,-1,6.9,.16,5.6,'#e3d1ad');box(.85,1.85,-3.77,6.9,3,.14,'#809da1');box(4.26,1.85,-1,.14,3,5.5,'#739194');
for(let i=0;i<14;i++)for(let j=0;j<11;j++)box(-2.32+i*.49,.391,-3.5+j*.49,.478,.014,.478,(i+j)%2?'#e9ddbf':'#d9ceb1',false);
box(.85,3.44,-1.05,7.25,.22,5.85,'#577079');box(.85,3.58,-1.05,6.85,.07,5.45,'#708b91');
// Pane divisions and glass.
const glass=new THREE.MeshPhysicalMaterial({color:0xb1e1e4,transparent:true,opacity:.105,roughness:.2,metalness:.1,side:THREE.DoubleSide,depthWrite:false});
for(const x of [-2.58,-.7,1.23,2.6,4.28])box(x,1.74,1.77,.065,2.55,.09,'#375965');
box(.85,.48,1.77,6.85,.19,.12,'#416774');box(.85,3.04,1.77,6.9,.12,.12,'#416774');
for(const [x,w]of[[-1.64,1.78],[.25,1.8],[3.44,1.57]])box(x,1.75,1.77,w,2.43,.015,glass,false);
for(const z of [-3.7,-1.9,-.1,1.72])box(-2.6,1.75,z,.08,2.65,.07,'#375965');
for(let i=0;i<3;i++)box(-2.61,1.75,-2.8+i*1.8,.014,2.4,1.7,glass,false);
box(-2.61,.5,-1,.1,.2,5.45,'#416774');box(-2.61,3.05,-1,.1,.12,5.5,'#416774');
const doors=[];for(let i=0;i<2;i++){let g=new THREE.Group();root.add(g);g.position.set(1.58+i*.52,0,1.8);box(0,1.65,0,.49,2.3,.024,glass,false,g);for(const x of [-.25,.25])box(x,1.65,0,.035,2.35,.055,'#9cb8b7',true,g);box(0,.5,0,.53,.05,.05,'#9cb8b7',true,g);box(0,2.8,0,.53,.05,.05,'#9cb8b7',true,g);box(0,1.52,.035,.28,.05,.035,'#81a6a4',true,g);doors.push(g);}
box(1.85,.27,2.06,1.25,.04,.55,'#384c57');label('いらっしゃいませ',1.85,2.89,1.835,1.22,.14,'#cce3c7','#294d49',65);
// Deep canopy, the fictional neighborhood shop's illuminated sign.
box(.85,3.02,2.02,7.35,.15,1,'#436b74');box(.85,3.23,2.5,7.35,.52,.15,'#e6e7d4');
box(.85,3.05,2.588,7.25,.07,.015,'#7fc5bf');box(.85,3.43,2.588,7.25,.065,.015,'#d9988c');
const sign=label('こもれび  MART',.85,3.25,2.591,5.45,.32,'#f4efdb','#377f7e',73);label('24 OPEN',3.83,3.24,2.592,.7,.28,'#f4efdb','#aa6864',85);
light(.5,2.7,2.8,0xffd8a1,17,7);light(-1,2.5,-1,0xffe4b0,13,6);light(2.7,2.5,-2,0xffdfb4,12,6);
for(let i=0;i<3;i++)box(-1.3+i*2.1,3.27,-.9,1.45,.025,.35,new THREE.MeshBasicMaterial({color:'#fff0c4'}),false);
// Racks: actual individual boxes, tins and bottles, with shelf edging.
const colors=['#da8b80','#e7c978','#78aaa2','#7e99b5','#bd9abb','#ece2be'];
function shelf(x,z,w,levels=3){box(x,1.13,z,w,1.5,.51,'#a5b1a4');for(let k=0;k<levels;k++){let y=.63+k*.46;box(x,y,z,w+.08,.045,.61,'#f1dec2');for(let j=0;j<Math.floor(w/.19);j++){let px=x-w/2+.12+j*.19;box(px,y+.14,z+.07,.13,.24,.2,colors[(j+k)%6],false);box(px,y+.14,z+.178,.085,.05,.007,'#f2e8c9',false);}box(x,y-.06,z+.32,w,.08,.015,'#a47164',false);}}
shelf(-.8,-1.45,1.72);shelf(1.48,-1.45,1.6);shelf(-.8,.14,1.75,2);
// Beverage cooler against the back wall.
for(let i=0;i<4;i++){let x=-1.88+i*.78;box(x,1.6,-3.45,.73,2.34,.45,'#b0c3bf');box(x,1.6,-3.205,.65,2.12,.015,'#36505d');for(let k=0;k<4;k++){box(x,.69+k*.46,-3.08,.64,.027,.25,'#a5c5c2');for(let j=0;j<4;j++){cyl(x-.23+j*.15,.81+k*.46,-3.08,.045,.2,colors[(j+k+i)%6]);}}box(x,1.6,-2.94,.66,2.09,.012,glass,false);box(x+.25,1.6,-2.92,.028,.37,.025,'#e0e3cf');}
label('DRINKS · 冷たい飲み物',-.74,2.91,-3.15,3.02,.18,'#c8e4dd','#447e81',56);
// Bento cabinet, triangular rice balls and low freezer.
box(3.62,1,-2.27,.82,1.24,1.7,'#acb9a6');for(let k=0;k<3;k++){box(3.58,.62+k*.38,-2.2,.9,.04,1.65,'#ebdab7');for(let j=0;j<5;j++){box(3.4,.72+k*.38,-2.84+j*.3,.44,.12,.23,'#454b44');box(3.4,.79+k*.38,-2.84+j*.3,.36,.02,.17,colors[(j+k)%6],false);}}
box(3.3,.85,.5,1.5,.85,.85,'#dae1cc');box(3.3,1.3,.5,1.42,.035,.77,glass);label('ICE CREAM',3.3,1.02,.94,1.25,.19,'#d9e6de','#6c969e',65);
for(let j=0;j<6;j++){mesh(new THREE.ConeGeometry(.1,.21,3),mat('#f0e8d6'),-1.49+j*.25,1.7,.19,true);box(-1.49+j*.25,1.64,.285,.075,.085,.015,'#294c48',false);}
label('おにぎり · お弁当',-.8,1.92,.46,1.7,.2,'#e7bd80','#68584a',66);
// Checkout, coffee, oden, register and magazine display.
box(2.2,.94,-.15,1.55,1.1,.75,'#729b90');box(2.2,1.52,-.15,1.7,.12,.87,'#ecdfc2');box(2.2,1.77,-.12,.33,.34,.25,'#44545a');box(2.2,1.83,.015,.27,.18,.014,'#9ad5ca');box(2.69,1.73,-.1,.4,.28,.38,'#9b9881');for(let i=0;i<6;i++)cyl(2.57+(i%2)*.17,1.88,-.23+Math.floor(i/2)*.13,.048,.028,'#ebc887');
box(3.67,1.73,-.85,.45,.65,.4,'#3a5057');box(3.67,1.8,-.634,.28,.22,.025,'#b2c5b6');cyl(3.67,1.51,-.58,.085,.14,'#e8dfc5');
shelf(-1.98,.99,.77,2);for(let i=0;i<4;i++){let a=box(-2.23+i*.16,1.34,1.29,.14,.34,.035,colors[i]);a.rotation.x=-.22;}
label('新刊 · MAGAZINE',-1.98,1.68,1.31,.76,.14,'#e8dbc3','#5a7473',53);
box(3.73,1.66,-3.5,.68,2.25,.065,'#617d7f');box(3.45,1.6,-3.44,.03,.15,.035,'#d2d5c0');label('STAFF',3.73,2.22,-3.455,.5,.16,'#bcc9b8','#3c565b',85);
label('ほっとひと息 ☕',.72,2.64,-3.65,.84,.57,'#e1b78e','#645d56',95);label('おでん',2.73,2.35,-.48,.49,.43,'#e5b67f','#6b4d43',150);
for(let i=0;i<3;i++){box(.8,.415,.9-i*.48,.06,.01,.24,'#ca9673',false);}
group('vending');
// Outside vending machines with individually stocked illuminated windows.
function vending(x,z,c){box(x,1.14,z,.79,1.85,.66,c);box(x,1.4,z+.342,.62,1.05,.022,'#273e50');for(let k=0;k<3;k++)for(let j=0;j<4;j++){cyl(x-.23+j*.15,1.08+k*.29,z+.37,.044,.17,colors[(j+k)%6]);box(x-.23+j*.15,.95+k*.29,z+.38,.07,.025,.015,'#d3dbbf',false);}box(x+.23,.67,z+.354,.12,.18,.03,'#90b4bd');box(x-.1,.53,z+.35,.37,.14,.035,'#243f4b');label('つめたい',x,2.02,z+.345,.61,.13,'#d6ece2','#537a81',86);light(x,1,z+.8,0x80dfe5,3,3);}
vending(-1.75,2.3,'#88bbb6');vending(-.84,2.3,'#bd807e');
group('bicycles');
// Bicycles in the side alley.
function bicycle(z){const g=new THREE.Group();g.position.set(-3.25,.29,z);root.add(g);for(const zz of [-.53,.53]){let t=mesh(new THREE.TorusGeometry(.32,.035,8,24),mat('#253b49'),0,.34,zz,false,g);t.rotation.y=Math.PI/2;let rim=mesh(new THREE.TorusGeometry(.28,.012,6,24),mat('#94b3b4'),0,.34,zz,false,g);rim.rotation.y=Math.PI/2;for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[0,.34,zz],[0,.34+Math.sin(a)*.28,zz+Math.cos(a)*.28]],'#7c969d',.005,g);}}
line([[0,.34,-.53],[0,.77,-.19],[0,.34,.04],[0,.34,-.53],[0,.68,.39],[0,.34,.53],[0,.34,.04]],'#c4a083',.028,g);line([[0,.34,.53],[0,.87,.4],[-.18,.94,.38]],'#9bb8bc',.024,g);box(0,.8,-.18,.22,.05,.23,'#344352',true,g);box(0,.79,.66,.35,.23,.32,'#69848a',true,g);}
bicycle(-.3);bicycle(-1.6);
// Umbrellas, bins, AC grille, posters and guard rails.
group('storeProps');box(2.7,.52,2.19,.36,.51,.34,'#5e7d85');for(let i=0;i<4;i++){let x=2.58+i*.08;line([[x,.48,2.18],[x,1.24,2.18],[x+.07,1.3,2.18],[x+.09,1.22,2.18]],'#b1c5c1',.014);mesh(new THREE.ConeGeometry(.055,.55,7),mat(colors[i]),x,.82,2.18,true);}
for(let i=0;i<2;i++){cyl(4.9,.64,.65+i*.65,.23,.72,'#829e9d');cyl(4.9,1.02,.65+i*.65,.24,.07,'#a5bab0');box(4.9,.8,.9+i*.65,.22,.09,.01,'#304e58');}
box(4.57,.73,-2.7,.51,.83,1.05,'#bcc8b8');for(let i=0;i<9;i++)box(4.84,.4+i*.075,-2.7,.025,.025,.86,'#708989',false);
group('store');box(4.365,2,-.6,.025,1.02,.81,'#6c8076');for(let i=0;i<4;i++){let a=label(i%2?'SALE':'夏の便り',4.39,1.8+Math.floor(i/2)*.44,-.8+(i%2)*.37,.29,.36,colors[i],'#445c60',120);a.rotation.y=Math.PI/2;}
group('guardRail');for(let i=0;i<3;i++){let x=-2.1+i*1.25;cyl(x,.63,3.13,.045,.8,'#b5c3b6');}line([[-2.1,.91,3.13],[.4,.91,3.13]],'#b5c3b6',.045);
// Lamp and utility pole: careful silhouette above the small roof.
group('streetLamp');cyl(-3.7,2.27,2.6,.06,4.4,'#596f80');line([[-3.7,4.45,2.6],[-3.7,4.64,2.6],[-3.3,4.69,2.6],[-2.93,4.64,2.6]],'#597082',.055);box(-2.95,4.59,2.6,.48,.12,.25,'#b7c6bb');box(-2.95,4.515,2.6,.39,.015,.19,new THREE.MeshBasicMaterial({color:'#ffe4b0'}),false);light(-2.95,3.8,2.6,0xffdeaa,16,7);
group('utilityPole');cyl(-4.7,2.91,-3.85,.1,5.7,'#7c8290');box(-4.7,5.25,-3.85,1.28,.08,.09,'#748f9b');for(let i=0;i<3;i++){cyl(-5.2+i*.5,5.39,-3.85,.05,.2,'#a6bcb5');line([[-5.2+i*.5,5.49,-3.85],[-2+i*.5,4.97,-4.9],[5.7,5.4,-4.9]],'#283746',.018);}
label('止まれ',-4.71,2.25,-3.72,.57,.5,'#b6797b','#eee1c6',170);
box(-4.71,3.1,-3.72,.7,.24,.025,'#648b9e');label('小路  KOMOREBI',-4.71,3.1,-3.7,.65,.2,'#648b9e','#e5e7d8',65);
group('trafficSignal');const signals=[];box(5.1,2.5,-4.75,.07,4.5,.07,'#4e6f7b');box(4.85,4.4,-4.75,.6,.22,.2,'#364d58');for(let i=0;i<3;i++){signals.push(mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:i===0?'#79c8ac':'#455563'}),4.66+i*.18,4.4,-4.635,false));}

// Two distinct new buildings, connected by a quiet service alley.
// Ramen shop: transparent storefront and visible counter/kitchen.
group('ramen');box(6.9,.38,-1.2,3.2,.17,4.5,'#cfbda4');box(6.9,1.63,-3.45,3.2,2.5,.14,'#9c9291');box(8.48,1.63,-1.2,.14,2.5,4.5,'#a09b95');box(5.32,1.63,-1.2,.14,2.5,4.5,'#a09b95');
box(6.9,2.95,-1.2,3.5,.22,4.8,'#616f84');for(let i=0;i<12;i++){box(5.37+i*.28,3.08,-1.2,.035,.07,4.7,'#7d8694',false);}
for(let x of [5.34,6.32,7.3,8.47])box(x,1.66,1.04,.06,2.43,.09,'#655d65');box(6.9,1.66,1.04,3.07,2.34,.012,glass,false);box(6.9,.5,1.04,3.2,.2,.1,'#656470');
box(6.9,2.65,1.35,3.6,.17,.8,'#88778a');label('雨音らーめん',6.9,2.84,1.77,3.1,.38,'#e8d0af','#67535a',130);
for(let i=0;i<5;i++){let x=5.54+i*.55;box(x,2.29,1.09,.49,.5,.025,'#748d96');label(i===2?'麺':'',x,2.29,1.11,.43,.45,'#748d96','#ece2ca',240);}
box(6.15,1.13,-.65,.65,1.3,3.1,'#967969');box(6.15,1.83,-.65,.91,.1,3.3,'#c5a780');for(let j=0;j<4;j++){let z=.5-j*.79;cyl(7.06,.9,z,.21,.15,'#b3907b');cyl(7.06,.61,z,.035,.53,'#67717d');mesh(new THREE.SphereGeometry(.13,12,8,0,Math.PI*2,0,Math.PI/2),mat('#e6d9bd'),6.24,1.91,z,false);line([[6.44,1.91,z-.06],[6.72,1.91,z-.06]],'#4f5260',.009);}
box(6.75,1.05,-2.85,2.2,1.2,.55,'#8b9494');box(6.75,1.7,-2.85,2.3,.08,.65,'#c3c3af');for(let i=0;i<3;i++){cyl(6+i*.65,1.83,-2.85,.2,.18,'#b5b8ae');cyl(6+i*.65,1.94,-2.85,.21,.03,'#d1cabc');}
label('醤油  みそ  塩',7.4,2.17,-3.36,1.55,.47,'#d4b894','#65515b',120);light(6.7,2.2,0,0xffc798,12,5);
for(let x of [5.7,8.1]){cyl(x,2.08,1.6,.18,.48,'#d89e87');for(let j=0;j<5;j++)cyl(x,1.9+j*.09,1.6,.184,.012,'#9d7472');label('麺',x,2.1,1.79,.19,.27,'#d89e87','#665260',240);}
// Apartment: staggered warm windows, balconies, stairs, rooftop water tank.
group('apartment');box(.9,2.59,-6.6,5.7,4.8,3.3,'#a3a5aa');box(.9,5.1,-6.6,6,.2,3.6,'#697a8b');box(.9,5.22,-6.6,5.8,.13,3.4,'#8795a0');
for(let floor=0;floor<3;floor++)for(let j=0;j<3;j++){let x=-.94+j*1.8,y=1.02+floor*1.45;box(x,y,-4.925,1.19,.97,.04,'#425c73');box(x,y,-4.89,1.05,.83,.018,new THREE.MeshBasicMaterial({color:(floor+j)%3?'#dec3a0':'#617d93'}));box(x,y,-4.86,.034,.86,.025,'#526677');box(x,y+.43,-4.86,1.1,.03,.025,'#526677');for(let k=0;k<2;k++)box(x-.38+k*.76,y,-4.85,.21,.8,.016,'#b1aaa3');if(floor>0){box(x,y-.58,-4.56,1.48,.1,.72,'#8f989f');for(let k=0;k<6;k++)box(x-.64+k*.25,y-.25,-4.24,.02,.58,.025,'#67798c');box(x,y+.05,-4.24,1.46,.028,.025,'#67798c');}}
box(.9,.96,-4.88,.74,1.45,.04,'#607786');label('こもれび荘',.9,1.88,-4.84,1.1,.24,'#bbc3be','#556c7b',95);for(let i=0;i<4;i++)box(-1.42+i*.27,.9,-4.84,.2,.25,.07,'#8e9699');
// Exterior switchback stair: two realistic floor-to-floor flights with landings aligned to side doors.
const apartmentStairFlights=[
  {x:-2.31,z0:-5.15,z1:-7.39,y0:.3,y1:1.75},
  {x:-3.02,z0:-7.39,z1:-5.15,y0:1.75,y1:3.2},
];
const stairRisers=9,stairTread=.28,stairTreads=stairRisers-1,stairWidth=.6;
for(const f of apartmentStairFlights){
  const dir=Math.sign(f.z1-f.z0),rise=(f.y1-f.y0)/stairRisers;
  for(let i=0;i<stairTreads;i++){
    const z=f.z0+dir*stairTread*(i+.5),top=f.y0+rise*(i+1);
    box(f.x,top-.045,z,stairWidth,.09,stairTread-.015,'#768a97');
  }
  for(const side of [-1,1]){
    const x=f.x+side*(stairWidth/2+.035);
    line([[x,f.y0+.12,f.z0],[x,f.y1+.12,f.z1]],'#526a7d',.045);
    line([[x,f.y0+.96,f.z0],[x,f.y1+.96,f.z1]],'#526a7d',.035);
    for(let i=0;i<=stairTreads;i+=2){
      const z=f.z0+dir*stairTread*(i+.15),y=f.y0+rise*i+.12;
      cyl(x,y+.39,z,.018,.78,'#61788a');
    }
  }
}
// Deep steel landings at the second- and third-floor thresholds.
for(const [level,z] of [[1.75,-7.39],[3.2,-5.15]]){
  box(-2.655,level-.08,z,1.39,.16,.84,'#73879a');
  box(-3.31,level/2+.15,z,.07,level-.3,.07,'#586f82');
  box(-3.31,level/2+.15,z-.31,.07,level-.3,.07,'#586f82');
  box(-3.31,level/2+.15,z+.31,.07,level-.3,.07,'#586f82');
  line([[-3.28,level-.16,z-.3],[-2.02,level-.16,z-.3]],'#566d80',.045);
  line([[-3.28,level-.16,z+.3],[-2.02,level-.16,z+.3]],'#566d80',.045);
  // Side-entry door leaves and frames meet each landing; the apartment's legacy shell remains intact.
  box(-1.98,level+.69,z,.045,1.3,.76,'#40576d');
  box(-2.012,level+.69,z,.025,1.2,.66,'#738894');
  box(-2.03,level+1.05,z,.018,.36,.42,'#afc1bf',false);
  for(const dz of [-.39,.39])box(-2.025,level+.69,z+dz,.06,1.4,.055,'#526a7d');
  box(-2.025,level+1.39,z,.06,.055,.83,'#526a7d');
  cyl(-2.06,level+.7,z-.25,.024,.05,'#d3c29c');
}
// A small ground landing ties the stair foot back to the apartment frontage.
box(-2.62,.22,-5.02,1.47,.16,.92,'#73879a');
cyl(2.15,5.7,-6.9,.57,.9,'#9eafb2');cyl(2.15,6.17,-6.9,.6,.06,'#748b9b');
// Down pipe and planters.
group('store');line([[4.34,3.3,-2.4],[4.54,3.3,-2.4],[4.54,.45,-2.4]],'#7b8e97',.038);
for(let i=0;i<7;i++){group(i<4?'ramenPlants':'apartmentPlants');let x=i<4?5.65+i*.7:-1.7+(i-4)*.53,z=i<4?2.25:-4.52;cyl(x,.48,z,.14,.3,'#aa8980');for(let k=0;k<4;k++){mesh(new THREE.SphereGeometry(.13,7,5),mat('#6f9690'),x+(rnd()-.5)*.17,.72+rnd()*.18,z+(rnd()-.5)*.17,false);}}
// New buildings: buildings/<plot>.js registers BUILDINGS[plot](kit, record) and draws in its own local frame
// (front +z, as the samples); the groups are placed below with the layout transforms. The kit shares the
// samples' ink, toon ramp, paper grain and glass. Modules return an update(t, dt) for local animation.
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
function bake(g){g.updateMatrixWorld(true);const inv=g.matrixWorld.clone().invert(),buckets=new Map(),done=[],bb=new THREE.Box3();
  g.traverse(o=>{if(!(o.isMesh||o.isLineSegments))return;for(let p=o;p&&p!==g;p=p.parent)if(p.userData.live)return;
    let layer='';for(let p=o;p&&p!==g;p=p.parent)if(p.userData.layer){layer=p.userData.layer;break;}
    const m=o.material,lk=o.isLineSegments?'L'+m.color.getHex()+'|'+m.opacity:null;bb.setFromObject(o,true);const band=bb.max.y>.3&&bb.min.y<1.8;
    const k=(lk||m.uuid)+'|'+band+'|'+layer;if(!buckets.has(k))buckets.set(k,{line:!!lk,m,layer,list:[]});buckets.get(k).list.push(o);done.push(o);});
  for(const {line,m,layer,list} of buckets.values()){const P=[],N=[],U=[];
    for(const o of list){let q=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();q.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));
      const a=q.attributes,n=a.position.count;P.push(...a.position.array);if(!line){N.push(...(a.normal?a.normal.array:new Float32Array(n*3)));U.push(...(a.uv?a.uv.array:new Float32Array(n*2)));}q.dispose();}
    const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
    if(!line){q.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));q.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));}
    const b=line?new THREE.LineSegments(q,m):new THREE.Mesh(q,m);if(layer)b.userData.layer=layer;g.add(b);}
  for(const o of done)o.removeFromParent();}
const buildingFx=[];
{const s0=seed,kit={THREE,ramp,group,mesh,box,cyl,line,label,mat,warm,glow,glass,wall,panel,canvasTex,tileUV,colors,
    setRoot:r=>{root=r;},rand:k=>()=>((k=(k*1664525+1013904223)>>>0)/4294967296)};
  for(const b of LAYOUT.buildings){const build=(globalThis.BUILDINGS||{})[b.module];if(!build)continue;const fx=build(kit,b);if(fx&&fx.update)buildingFx.push(fx.update);
    for(const p of b.parts)if(groups[p.group])bake(groups[p.group]);}
  seed=s0;root=scene;}
// Town ground generated from LAYOUT (layout.js): plinth, carriageways, raised pavement islands with
// curb returns and step-free curb cuts, facility bands, alleys, walkway, bus aprons, edge trim and plots.
const L=LAYOUT,LV=L.LEVELS,BH=L.BASE.half,R=L.INTERSECTION.curbRadius;
// Hand-drawn ground textures on the paper grain (own seed, so the samples' random details never shift).
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
function slab([x0,z0,x1,z1],y0,y1,c,outline=true){const w=x1-x0,d=z1-z0,h=y1-y0,g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv;for(let i=0;i<uv.count;i++){const f=Math.floor(i/4),s=f<2?[d,h]:f<4?[w,d]:[w,h];uv.setXY(i,uv.getX(i)*s[0]/4,uv.getY(i)*s[1]/4);}return mesh(g,c,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,outline);}
function flat([x0,z0,x1,z1],y,c){const a=mesh(tileUV(new THREE.PlaneGeometry(x1-x0,z1-z0),(x1-x0)/4,(z1-z0)/4),typeof c==='string'?flatMat(c):c,(x0+x1)/2,y,(z0+z1)/2,false);a.rotation.x=-Math.PI/2;return a;}
// Splits a rect along axis i (0 = x, 1 = z) around excluded [a, b] spans.
function without(r,i,spans){let out=[r];for(const [a,b] of spans)out=out.flatMap(q=>{if(b<=q[i]||a>=q[i+2])return[q];const res=[];if(a>q[i]){const p=q.slice();p[i+2]=a;res.push(p);}if(b<q[i+2]){const p=q.slice();p[i]=b;res.push(p);}return res;});return out;}
const overlaps=(a,b)=>a[0]<b[2]-1e-6&&b[0]<a[2]-1e-6&&a[1]<b[3]-1e-6&&b[1]<a[3]-1e-6;
group('base');slab([-BH,-BH,BH,BH],LV.plinth-1.6,LV.plinth,'#273443');
// One asphalt sheet under everything: crossing carriageways cannot overlap or leave seams.
group('roads');slab([-BH,-BH,BH,BH],LV.plinth,LV.carriageway,matT('#46505b','asphalt'),false);
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
  const m=mesh(g,matT('#87908c','paving'),0,LV.plinth,0);m.rotation.x=-Math.PI/2;}
// Ramps fill the notches: a 1:10 slope from the carriageway up to pavement level, no step at either end.
for(const k of L.curbCuts){const lo=LV.carriageway,hi=LV.pavement,a=k.at,b=k.at+k.dir*k.depth;
  const V=k.line==='x'?[[a,lo,k.s0],[a,lo,k.s1],[b,hi,k.s1],[b,hi,k.s0]]:[[k.s0,lo,a],[k.s1,lo,a],[k.s1,hi,b],[k.s0,hi,b]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(V.flat(),3));
  const l=k.s1-k.s0;g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,l/4,0,l/4,k.depth/4,0,k.depth/4],2));
  const up=(V[1][0]-V[0][0])*(V[2][2]-V[0][2])-(V[1][2]-V[0][2])*(V[2][0]-V[0][0])<0;g.setIndex(up?[0,1,2,0,2,3]:[0,2,1,0,3,2]);g.computeVertexNormals();
  mesh(g,k.kind==='ramp'?'#8a918c':'#848a86',0,0,0);}
// Facility bands (curb strip where lamps, poles and drains stand), cut back at ramps, driveways and
// the curb returns, which stay plain pavement.
for(const s of L.surfaces.filter(s=>s.kind==='band')){const road=L.roads.find(r=>r.id===s.road),i=road.axis==='x'?0:1;
  const returns=L.roads.filter(o=>o.axis!==road.axis).map(o=>{const h=L.ROAD_TYPES[o.type].carriageway/2;return[o.at-h-R,o.at+h+R];});
  for(const r of without(s.rect,i,[...returns,...L.curbCuts.filter(k=>overlaps(k.rect,s.rect)).map(k=>[k.s0,k.s1])]))flat(r,LV.pavement,'#9aa29c');}
for(const a of L.alleys)flat(a.rect,LV.pavement,matT('#8f8a7c','paving',true));
for(const w of L.walkways)flat([w.poly[0][0],w.poly[0][1],w.poly[2][0],w.poly[2][1]],LV.pavement,'#8d8c80');
for(const a of L.aprons)flat([a.poly[0][0],a.poly[0][1],a.poly[2][0],a.poly[2][1]],LV.pavement,'#8c9ba3');
// Plinth trim: a low planting strip around the blocks, open where roads and alleys leave the base.
{const M=L.BASE.margin,open=[...L.roads.map(r=>L.corridorRect(r)),...L.alleys.map(a=>a.rect)];
  for(const [r,i] of [[[-BH,-BH,BH,-BH+M],0],[[-BH,BH-M,BH,BH],0],[[-BH,-BH+M,-BH+M,BH-M],1],[[BH-M,-BH+M,BH,BH-M],1]])
    for(const q of without(r,i,open.filter(o=>overlaps(o,r)).map(o=>[o[i],o[i+2]])))slab(q,LV.pavement,LV.pavement+.06,'#56664f');}
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
// ---- Street details (P3): markings, drainage, lamps, poles and wires, signals, signs, wet ground ----
// One quad batch per material keeps hundreds of stripes, gutters and channels to a few draw calls.
function quads(rects,y,m){const P=[],U=[],I=[];rects.forEach(([x0,z0,x1,z1],k)=>{P.push(x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1);U.push(x0/4,-z0/4,x1/4,-z0/4,x1/4,-z1/4,x0/4,-z1/4);const b=k*4;I.push(b,b+2,b+1,b,b+3,b+2);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();return mesh(g,m,0,0,0,false);}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
// Flat decal lying on the ground, its "up" edge pointing along `heading`.
function decal(tex,w,h,x,y,z,heading,m){const a=mesh(new THREE.PlaneGeometry(w,h),m||new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-6}),x,y,z,false);a.rotation.set(-Math.PI/2,Math.atan2(-heading[0],-heading[1]),0,'YXZ');return a;}
const faceY=([fx,fz])=>Math.atan2(fx,fz);   // rotation that turns local +z towards (fx, fz)
group('markings');
const paint=new THREE.MeshBasicMaterial({color:'#c9cfc4',transparent:true,opacity:.78,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-6});
quads(L.markings.filter(m=>m.rect).map(m=>m.rect),LV.carriageway,paint);
const paintTex=(w,h,draw)=>canvasTex(w,h,(q,W,H)=>{q.fillStyle=q.strokeStyle='#fff';draw(q,W,H);});
const diaTex=paintTex(64,160,(q,W,H)=>{q.lineWidth=9;q.beginPath();q.moveTo(W/2,6);q.lineTo(W-6,H/2);q.lineTo(W/2,H-6);q.lineTo(6,H/2);q.closePath();q.stroke();});
const textTex={};
for(const m of L.markings.filter(m=>!m.rect)){
  const tex=m.kind==='diamond'?diaTex:textTex[m.text]||(textTex[m.text]=paintTex(512,512,(q,W,H)=>{const k=2.3;q.font='bold 148px sans-serif';q.textAlign='center';q.textBaseline='middle';q.setTransform(1,0,0,k,0,0);q.fillText(m.text,W/2,H/2/k,W-24);}));
  decal(tex,m.size[0],m.size[1],m.x,LV.carriageway,m.z,m.heading,new THREE.MeshBasicMaterial({map:tex,color:'#c9cfc4',transparent:true,opacity:.78,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-6}));}
// Drainage: L-gutters along the curbs, grates, alley channels and outlets in the plinth face.
group('drainage');
quads(L.gutters.map(g=>g.rect),LV.carriageway,flatMat('#737c7d'));
quads(L.channels.map(c=>c.rect),LV.pavement,flatMat('#5f6661'));
const grateTex=canvasTex(64,32,(q,W,H)=>{q.fillStyle='#2b3239';q.fillRect(0,0,W,H);q.fillStyle='#69737a';for(let i=4;i<W;i+=7)q.fillRect(i,3,3,H-6);});
const grateMat=new THREE.MeshToonMaterial({color:'#9aa3a6',gradientMap:ramp,map:grateTex});
for(const g of L.grates){const [w,d]=L.DRAIN.grate,a=box(g.x,LV.carriageway+.006,g.z,g.line==='z'?w:d,.012,g.line==='z'?d:w,grateMat);}
for(const c of L.channels)for(let x=c.rect[0]+1;x<c.rect[2]-.5;x+=1)box(x,LV.pavement+.004,(c.rect[1]+c.rect[3])/2,.04,.008,L.DRAIN.channel,'#3f4547',false);
const stain=new THREE.MeshBasicMaterial({color:'#141b26',transparent:true,opacity:.45,depthWrite:false});
for(const o of L.outlets){const [fx,fz]=o.face,y=-.22,g=new THREE.Group();g.position.set(o.x,0,o.z);g.rotation.y=faceY(o.face);root.add(g);
  box(0,y,.03,.55,.36,.06,'#7d8584',true,g);const p=cyl(0,y,.09,.12,.14,'#5d6668',g);p.rotation.x=Math.PI/2;mesh(new THREE.CircleGeometry(.085,16),new THREE.MeshBasicMaterial({color:'#11161d'}),0,y,.161,false,g);
  mesh(new THREE.PlaneGeometry(.22,1.1),stain,0,y-.72,.004,false,g);}
// Street lamps, alley security lamps, utility poles with catenary wires, signals and stop signs.
group('streetFurniture');
const glowTex=canvasTex(128,128,(q,W)=>{const g=q.createRadialGradient(W/2,W/2,0,W/2,W/2,W/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');q.fillStyle=g;q.fillRect(0,0,W,W);});
const glowMat=(c,o)=>new THREE.MeshBasicMaterial({map:glowTex,color:c,transparent:true,opacity:o,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8});
const lampHead=new THREE.MeshBasicMaterial({color:'#ffe4b0'}),ledHead=new THREE.MeshBasicMaterial({color:'#eef2e4'});
const lamps=[];
for(const f of L.furniture){const g=new THREE.Group();g.position.set(f.x,LV.pavement,f.z);root.add(g);
  if(f.kind==='lamp'){g.rotation.y=faceY(f.face);cyl(0,2.2,0,.06,4.4,'#596f80',g);line([[0,4.35,0],[0,4.6,.05],[0,4.66,.45],[0,4.6,.85]],'#597082',.05,g);box(0,4.56,.85,.25,.12,.48,'#b7c6bb',true,g);box(0,4.49,.85,.19,.015,.39,lampHead,false,g);
    lamps.push({x:f.x+f.face[0]*.85,z:f.z+f.face[1]*.85,c:'#ffd9a0',r:3.6,o:.32});}
  else if(f.kind==='alley-lamp'){g.rotation.y=faceY(f.face);cyl(0,1.6,0,.045,3.2,'#8a9096',g);box(0,3.05,.22,.08,.08,.4,'#8a9096',true,g);box(0,2.98,.4,.22,.09,.13,'#c9cec6',true,g);box(0,2.93,.4,.18,.01,.1,ledHead,false,g);
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
const phased=L.furniture.filter(f=>f.kind==='signal').map(f=>({h:f.heads,ns:L.roads.find(r=>r.id===f.road).axis==='z'}));
// Light pools under the lamps: additive washes rather than real lights, so 35 lamps stay cheap.
for(const l of lamps)decal(null,l.r*2,l.r*2,l.x,LV.pavement,l.z,[0,-1],glowMat(l.c,l.o));
// Wet ground: puddles along the gutters and alley channels, ripples, restrained reflections of lamps.
group('wetStreet');
const puddleMat=new THREE.MeshStandardMaterial({color:'#456a80',transparent:true,opacity:.45,metalness:.6,roughness:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
const rings=[],ringMat=()=>new THREE.MeshBasicMaterial({color:'#acd8de',transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});
L.puddles.forEach((p,i)=>{const y=p.on==='road'?LV.carriageway:LV.pavement,a=mesh(new THREE.CircleGeometry(1,32),puddleMat,p.x,y,p.z,false);a.rotation.x=-Math.PI/2;a.scale.set(p.rx,p.rz,1);
  const near=lamps.find(l=>Math.hypot(l.x-p.x,l.z-p.z)<5.5);if(near){const r=decal(null,Math.min(p.rx,p.rz)*1.4,Math.max(p.rx,p.rz)*1.6,p.x,y,p.z,p.rx>p.rz?[1,0]:[0,1],glowMat(near.c,.22));}
  for(let k=0;k<(i%3?1:2);k++){const r=mesh(new THREE.RingGeometry(.95,1,32),ringMat(),p.x+(Math.random()-.5)*p.rx,y+.004,p.z+(Math.random()-.5)*p.rz,false);r.rotation.x=-Math.PI/2;rings.push({a:r,phase:Math.random()});}});
// The store's light spilling on the wet sidewalk in front of it: sign glyphs broken up by water.
{const s=L.samples.find(s=>s.id==='store'),t=s.transform,g=new THREE.Group();g.position.set(t.x,LV.pavement+.012,t.z);g.rotation.y=t.rotY;root.add(g);
  for(let i=0;i<70;i++)box(-2.5+Math.random()*6.8,0,4.1+Math.random()*1.8,.025+Math.random()*.1,.004,.09+Math.random()*.37,glow(i%3?'#efc494':'#8ee1d2',.05+Math.random()*.12),false,g);
  const ref=label('こもれび MART',.7,.002,5,5,.48,'#2c4354','#93b7ac',80);g.add(ref);ref.rotation.x=-Math.PI/2;ref.material.transparent=true;ref.material.opacity=.2;ref.material.depthWrite=false;}
// Existing samples and new buildings move as whole groups (translate, rotate about Y, uniform scale); see layout.js.
for(const s of L.structures)for(const p of s.parts){const g=groups[p.group],t=s.transform;g.position.set(t.x,0,t.z);g.rotation.y=t.rotY;g.scale.setScalar(t.scale??L.SAMPLE_SCALE);}
// Original street furniture goes to provisional slots in the facility bands, foot on the band.
for(const f of L.legacyFurniture){const g=groups[f.group],{x,z,rotY}=f.slot,c=Math.cos(rotY),n=Math.sin(rotY),[ax,az]=f.anchor,y0=new THREE.Box3().setFromObject(g,true).min.y;
  g.rotation.y=rotY;g.position.set(x-(ax*c+az*n),LV.pavement-y0,z-(-ax*n+az*c));}
// The pole's wires end at fixed points of the old street; hidden until P3 rewires the network.
groups.utilityPole.traverse(o=>{if(o.isMesh&&o.geometry.type==='TubeGeometry')o.visible=false;});
// Rain falls in a box that follows the view target (clamped to the plinth), never under the roofs and
// awnings of samples (building-part bounds) and new buildings (their registered shelter rects, see layout.js).
const roofs=L.structures.flatMap(s=>s.shelter?s.shelter.map(r=>worldRect(s,r)):s.parts.filter(p=>p.role==='building').map(p=>{const b=p.localBounds,r=worldRect(s,[b.min[0],b.min[2],b.max[0],b.max[2]]);return[r[0]-.1,r[1]-.1,r[2]+.1,r[3]+.1];}));
const rainBox=40,rainTop=7,rainCount=2800,positions=new Float32Array(rainCount*6),speeds=[];let rb=[0,0,0,0],roam=null;
function rainBounds(){const h=rainBox/2,center=roam?roam.position:target;rb=[Math.max(-BH,center.x-h),Math.max(-BH,center.z-h),Math.min(BH,center.x+h),Math.min(BH,center.z+h)];}
function dropAt(i,y){let x,z;for(let k=0;k<8;k++){x=rb[0]+Math.random()*(rb[2]-rb[0]);z=rb[1]+Math.random()*(rb[3]-rb[1]);if(!roofs.some(r=>x>r[0]&&x<r[2]&&z>r[1]&&z<r[3]))break;}positions.set([x,y,z,x-.035,y+.18,z-.014],i*6);}
rainBounds();for(let i=0;i<rainCount;i++){dropAt(i,Math.random()*rainTop);speeds.push(4+Math.random()*3);}
const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(positions,3));const rainMat=new THREE.LineBasicMaterial({color:0xa9c9df,transparent:true,opacity:.29,depthWrite:false});scene.add(new THREE.LineSegments(rg,rainMat));
group('store');const drops=[];for(let i=0;i<40;i++){let x=-2.4+Math.random()*6.5;let a=box(x,.7+Math.random()*2,1.806,.012,.07+Math.random()*.06,.003,glow('#c1e4df',.32),false);drops.push(a);}
group('store');const drips=[];for(let i=0;i<18;i++){let a=box(-2.7+Math.random()*7.1,Math.random()*3,2.55,.013,.09,.012,glow('#cee7e5',.5),false);drips.push(a);}
root=scene;
// User interaction: one finger or left mouse orbit, wheel/pinch zoom, right mouse pan.
// Pan slides the target over the ground at a speed proportional to distance and never leaves the plinth.
const ZOOM=[9,150],PAN_LIMIT=BH-2,zoomTo=d=>Math.max(ZOOM[0],Math.min(ZOOM[1],d));
function pan(dx,dy){const k=dist*.0011,c=Math.cos(yaw),n=Math.sin(yaw);target.x=Math.max(-PAN_LIMIT,Math.min(PAN_LIMIT,target.x-(dx*c+dy*n)*k));target.z=Math.max(-PAN_LIMIT,Math.min(PAN_LIMIT,target.z-(-dx*n+dy*c)*k));}
// Town walking camera (W9a) uses only the frozen roads and alleys in layout.js.
// Walkable rectangles are narrower than the carriageways, keeping the camera away from plots.
const nodeById=Object.fromEntries(L.roadNodes.map(n=>[n.id,n])),walkRects=[];
for(const r of L.roads){const half=L.ROAD_TYPES[r.type].carriageway/2-.4;for(let i=0;i<r.nodes.length-1;i++){const a=nodeById[r.nodes[i]],b=nodeById[r.nodes[i+1]];walkRects.push(a.z===b.z?[Math.min(a.x,b.x),a.z-half,Math.max(a.x,b.x),a.z+half]:[a.x-half,Math.min(a.z,b.z),a.x+half,Math.max(a.z,b.z)]);}}
for(const a of L.alleys){const m=.3;walkRects.push([a.rect[0]+m,a.rect[1]+m,a.rect[2]-m,a.rect[3]-m]);}
function constrainWalk(x,z){let best=null,bestD=Infinity;for(const r of walkRects){const px=Math.max(r[0]+.12,Math.min(r[2]-.12,x)),pz=Math.max(r[1]+.12,Math.min(r[3]-.12,z)),d=(px-x)**2+(pz-z)**2;if(d<bestD){bestD=d;best=[px,pz];}}return best||[0,15];}
let roamButton=null,joystickValue=[0,0],lookPointer=null;
const keys=new Set();
function setRoaming(enabled){if(enabled===!!roam)return;if(enabled){roam={position:new THREE.Vector3(-8,LV.carriageway,15),heading:-Math.PI/2,lookYaw:0,lookPitch:0,lastLook:0,cameraPosition:new THREE.Vector3(),hasCameraPosition:false};camera.fov=46;camera.near=.08;camera.far=400;camera.updateProjectionMatrix();}else{roam=null;camera.fov=36;camera.near=.25;camera.far=400;camera.updateProjectionMatrix();lookPointer=null;joystickValue=[0,0];}if(roamButton){roamButton.textContent=roam?'自由视角  V':'街景漫游  V';roamButton.setAttribute('aria-pressed',String(!!roam));}canvas.style.cursor=roam?'grab':'';}
function toggleRoaming(){setRoaming(!roam);}
const style=document.createElement('style');style.textContent=`#town-view-toggle{position:fixed;z-index:5;top:14px;right:14px;padding:8px 11px;border:1px solid rgba(205,220,220,.32);border-radius:18px;background:rgba(23,34,49,.62);color:#e8e5d9;font:12px/1.2 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(5px);cursor:pointer;opacity:.78}#town-view-toggle:hover,#town-view-toggle:focus-visible{opacity:1;background:rgba(31,47,63,.9);outline:1px solid rgba(205,220,220,.55)}#town-walk-stick{position:fixed;z-index:4;left:24px;bottom:24px;width:108px;height:108px;border:1px solid rgba(210,224,224,.22);border-radius:50%;background:rgba(23,34,49,.25);touch-action:none;display:none}#town-walk-nub{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border:1px solid rgba(225,233,224,.42);border-radius:50%;background:rgba(89,116,125,.56);pointer-events:none}@media(pointer:coarse){#town-walk-stick{display:block}}@media(max-width:520px){#town-view-toggle{top:10px;right:10px;font-size:11px;padding:7px 9px}#town-walk-stick{left:18px;bottom:20px;width:100px;height:100px}}`;
document.head.appendChild(style);roamButton=document.createElement('button');roamButton.id='town-view-toggle';roamButton.type='button';roamButton.textContent='街景漫游  V';roamButton.title='切换街景漫游与自由视角';roamButton.setAttribute('aria-label','切换街景漫游与自由视角');roamButton.addEventListener('click',toggleRoaming);document.body.appendChild(roamButton);
const stick=document.createElement('div');stick.id='town-walk-stick';stick.setAttribute('aria-label','街景移动摇杆');const nub=document.createElement('div');nub.id='town-walk-nub';stick.appendChild(nub);document.body.appendChild(stick);let stickPointer=null;
function updateStick(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),max=33,k=len>max?max/len:1;joystickValue=[dx*k/max,-dy*k/max];nub.style.transform=`translate(${dx*k}px,${dy*k}px)`;}
stick.addEventListener('pointerdown',e=>{if(!roam)return;stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);e.preventDefault();});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)updateStick(e);});for(const ev of ['pointerup','pointercancel'])stick.addEventListener(ev,e=>{if(e.pointerId===stickPointer){stickPointer=null;joystickValue=[0,0];nub.style.transform='';}});
const pointers=new Map();let last=null,pinch=0;const canvas=renderer.domElement;canvas.style.touchAction='none';canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});last={x:e.clientX,y:e.clientY};if(roam)canvas.style.cursor='grabbing';if(pointers.size===2){let p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&!roam){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);dist=zoomTo(dist*pinch/d);pinch=d;}else if(last){let dx=e.clientX-last.x,dy=e.clientY-last.y;if(roam){roam.lookYaw=Math.max(-1.35,Math.min(1.35,roam.lookYaw-dx*.005));roam.lookPitch=Math.max(-.32,Math.min(.42,roam.lookPitch+dy*.003));roam.lastLook=performance.now()*.001;}else if(e.buttons===2)pan(dx,dy);else{yaw-=dx*.006;pitch=Math.max(.16,Math.min(1.45,pitch+dy*.005));}}last={x:e.clientX,y:e.clientY};});for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,e=>{pointers.delete(e.pointerId);last=null;if(roam)canvas.style.cursor='grab';});canvas.addEventListener('wheel',e=>{if(roam)return;e.preventDefault();dist=zoomTo(dist*Math.exp(e.deltaY*.001));},{passive:false});
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&(k==='v'||(k==='escape'&&roam))){toggleRoaming();e.preventDefault();return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){keys.add(k);if(roam)e.preventDefault();}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
function movement(){let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystickValue[0],z=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+joystickValue[1],m=Math.hypot(x,z);if(m>1){x/=m;z/=m;}return[x,z];}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});let prev=0;function frame(ms){requestAnimationFrame(frame);const t=ms*.001,elapsed=Math.min(.12,t-prev),dt=Math.min(.04,elapsed);prev=t;
if(roam){const [mx,mz]=movement(),fX=Math.sin(roam.heading),fZ=Math.cos(roam.heading),rX=Math.cos(roam.heading),rZ=-Math.sin(roam.heading),moveX=fX*mz+rX*mx,moveZ=fZ*mz+rZ*mx,speed=1.5,[wx,wz]=constrainWalk(roam.position.x+moveX*speed*elapsed,roam.position.z+moveZ*speed*elapsed);roam.position.x=wx;roam.position.z=wz;
  if(Math.hypot(moveX,moveZ)>.05){const next=Math.atan2(moveX,moveZ),delta=Math.atan2(Math.sin(next-roam.heading),Math.cos(next-roam.heading));roam.heading+=delta*(1-Math.exp(-elapsed*4));}
  if(t-roam.lastLook>1.4){const fade=1-Math.exp(-elapsed*1.5);roam.lookYaw*=1-fade;roam.lookPitch*=1-fade;}
  const backX=roam.position.x-Math.sin(roam.heading)*3.1,backZ=roam.position.z-Math.cos(roam.heading)*3.1,[cx,cz]=constrainWalk(backX,backZ),camTarget=new THREE.Vector3(roam.position.x,LV.carriageway+1.28,roam.position.z),wantCam=new THREE.Vector3(cx,LV.carriageway+1.62,cz);if(!roam.hasCameraPosition){roam.cameraPosition.copy(wantCam);roam.hasCameraPosition=true;}else roam.cameraPosition.lerp(wantCam,1-Math.exp(-elapsed*5));camera.position.copy(roam.cameraPosition);const lookAngle=roam.heading+roam.lookYaw,lookDist=4;camera.lookAt(camTarget.x+Math.sin(lookAngle)*lookDist,camTarget.y+Math.tan(roam.lookPitch)*lookDist,camTarget.z+Math.cos(lookAngle)*lookDist);
}else{camera.position.set(target.x+dist*Math.sin(yaw)*Math.cos(pitch),target.y+dist*Math.sin(pitch),target.z+dist*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);}
rainBounds();for(let i=0;i<rainCount;i++){let n=i*6;positions[n+1]-=dt*speeds[i];positions[n+4]-=dt*speeds[i];const x=positions[n],z=positions[n+2];if(positions[n+1]<.2)dropAt(i,rainTop);else if(x<rb[0]||x>rb[2]||z<rb[1]||z>rb[3])dropAt(i,positions[n+1]);}rg.attributes.position.needsUpdate=true;rainMat.opacity=roam?.29:.29*Math.max(0,Math.min(1,(110-dist)/60));for(const r of rings){let p=(t*.6+r.phase)%1;r.a.scale.setScalar(.02+p*.48);r.a.material.opacity=(1-p)*.24;}for(const d of drops){d.position.y-=dt*.11;if(d.position.y<.6)d.position.y=2.85;}for(const d of drips){d.position.y-=dt*2.2;if(d.position.y<.25)d.position.y=3.02;}let cycle=t%19,open=cycle>10&&cycle<15?Math.min(1,(cycle-10)*1.5,(15-cycle)*1.5):0;doors[0].position.x=1.58-open*.46;doors[1].position.x=2.1+open*.46;sign.material.color.setScalar(1-.07*Math.pow(Math.sin(t*1.7),24));signals[0].material.color.set(t%30<19?'#7cceae':'#43565d');{const c=t%30;for(const p of phased){const st=p.ns?(c<19?0:2):(c>=19.5&&c<27.5?0:c>=27.5&&c<29.5?1:2);p.h[0].material.color.set(st===0?'#7cceae':'#43565d');p.h[1].material.color.set(st===1?'#e7c27a':'#43565d');p.h[2].material.color.set(st===2?'#d28d8e':'#43565d');}}signals[2].material.color.set(t%30>=19?'#d28d8e':'#43565d');for(const u of buildingFx)u(t,dt);renderer.render(scene,camera);}requestAnimationFrame(frame);
// Hooks for browser checks and review shots.
window.__scene={scene,renderer,camera,groups,view:{get:()=>({yaw,pitch,dist,target:target.toArray(),mode:roam?'roam':'free',cameraPosition:camera.position.toArray(),input:movement(),roam:roam?{position:roam.position.toArray(),heading:roam.heading,lookYaw:roam.lookYaw}:null}),set(v){if(v.mode)setRoaming(v.mode==='roam');if(v.yaw!=null)yaw=v.yaw;if(v.pitch!=null)pitch=v.pitch;if(v.dist!=null)dist=zoomTo(v.dist);if(v.target)target.fromArray(v.target);if(v.position&&roam)roam.position.set(v.position[0],LV.carriageway,v.position[1]);if(v.heading!=null&&roam)roam.heading=v.heading;},isWalkable(p){return walkRects.some(r=>p[0]>=r[0]+.12-1e-6&&p[0]<=r[2]-.12+1e-6&&p[1]>=r[1]+.12-1e-6&&p[1]<=r[3]-.12+1e-6);},pan}};
})();

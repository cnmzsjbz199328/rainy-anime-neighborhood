(()=>{'use strict';
const scene=new THREE.Scene();scene.background=new THREE.Color('#252e43');scene.fog=new THREE.FogExp2('#252e43',.012);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;document.body.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,100);let yaw=-.57,pitch=.52,dist=30;const target=new THREE.Vector3(1,1.8,-1.3);
scene.add(new THREE.HemisphereLight(0x8fb6ed,0x252438,2.0));const moon=new THREE.DirectionalLight(0x9dbbff,2.3);moon.position.set(-6,9,4);scene.add(moon);
const ramp=new THREE.DataTexture(new Uint8Array([110,170,220,255]),4,1,THREE.RedFormat);ramp.needsUpdate=true;ramp.minFilter=ramp.magFilter=THREE.NearestFilter;
const mats={};
let seed=3187;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const paper=document.createElement('canvas');paper.width=paper.height=256;const pc=paper.getContext('2d');pc.fillStyle='#f5f1e8';pc.fillRect(0,0,256,256);
for(let i=0;i<5000;i++){pc.fillStyle='rgba(78,86,104,'+(.025+rnd()*.05)+')';pc.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1);}
for(let i=0;i<160;i++){pc.strokeStyle='rgba(92,96,107,.035)';pc.beginPath();let x=rnd()*256,y=rnd()*256;pc.moveTo(x,y);pc.lineTo(x+15+rnd()*40,y-8-rnd()*20);pc.stroke();}
const paperTex=new THREE.CanvasTexture(paper);paperTex.wrapS=paperTex.wrapT=THREE.RepeatWrapping;paperTex.colorSpace=THREE.SRGBColorSpace;
function mat(c){return mats[c]||(mats[c]=new THREE.MeshToonMaterial({color:c,gradientMap:ramp,map:paperTex}));}

const ink=new THREE.LineBasicMaterial({color:0x273647,transparent:true,opacity:.68});
function mesh(g,m,x,y,z,outline=true,parent=scene){const a=new THREE.Mesh(g,typeof m==='string'?mat(m):m);a.position.set(x,y,z);parent.add(a);if(outline){const e=new THREE.LineSegments(new THREE.EdgesGeometry(g,35),ink);a.add(e);if(g.type==='BoxGeometry'){const eg=e.geometry.clone(),at=eg.attributes.position;for(let k=0;k<at.count;k++){at.setXYZ(k,at.getX(k)+(rnd()-.5)*.013,at.getY(k)+(rnd()-.5)*.013,at.getZ(k)+(rnd()-.5)*.013);}a.add(new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0x334458,transparent:true,opacity:.15})));}}return a;}
function box(x,y,z,w,h,d,c,outline=true,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,outline,parent);}
function cyl(x,y,z,r,h,c,parent=scene){return mesh(new THREE.CylinderGeometry(r,r,h,12),c,x,y,z,true,parent);}
function line(points,c='#34465c',r=.025,parent=scene){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,32,r,6,false),mat(c),0,0,0,false,parent);}
function glow(c,opacity=.2){return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});}
function light(x,y,z,c,power,range){const l=new THREE.PointLight(c,power,range,2);l.position.set(x,y,z);scene.add(l);return l;}
function label(text,x,y,z,w,h,bg='#f6e9c5',fg='#254755',size=55){const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const q=c.getContext('2d');q.fillStyle=bg;q.fillRect(0,0,c.width,c.height);q.fillStyle=fg;q.font=`bold ${size}px sans-serif`;q.textAlign='center';q.textBaseline='middle';q.fillText(text,512,c.height/2);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}),x,y,z,false);}
// The square plinth and the L-shaped neighborhood street.
box(0,-.32,0,18,.65,18,'#273443');box(0,.02,0,17.9,.06,17.9,'#354452');box(.95,.13,-.95,7.8,.22,7.8,'#75858a');
box(0,.064,4.4,17.85,.035,2.9,'#28364a');box(-4.45,.064,-2.8,2.9,.035,14.4,'#28364a');
for(let i=0;i<10;i++){box(-2.85,.25,-5.4+i*.85,.16,.2,.79,'#a0aaa7');box(-2.5+i*.86,.25,2.92,.8,.2,.16,'#a0aaa7');}
for(let i=0;i<7;i++){box(-4.48,.092,2.8+i*.41,2.05,.01,.23,'#b1c5ca',false);box(-1.85+i*.43,.094,4.4,.25,.01,2,'#b1c5ca',false);}
for(let i=0;i<4;i++)box(2+i*.78,.255,2.35,.05,.008,.85,'#d6dbc8',false);
for(let i=0;i<28;i++){box(-2.65,.26,-5.4+i*.29,.18,.025,.15,'#263d47',false);}
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
const doors=[];for(let i=0;i<2;i++){let g=new THREE.Group();scene.add(g);g.position.set(1.58+i*.52,0,1.8);box(0,1.65,0,.49,2.3,.024,glass,false,g);for(const x of [-.25,.25])box(x,1.65,0,.035,2.35,.055,'#9cb8b7',true,g);box(0,.5,0,.53,.05,.05,'#9cb8b7',true,g);box(0,2.8,0,.53,.05,.05,'#9cb8b7',true,g);box(0,1.52,.035,.28,.05,.035,'#81a6a4',true,g);doors.push(g);}
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
// Outside vending machines with individually stocked illuminated windows.
function vending(x,z,c){box(x,1.14,z,.79,1.85,.66,c);box(x,1.4,z+.342,.62,1.05,.022,'#273e50');for(let k=0;k<3;k++)for(let j=0;j<4;j++){cyl(x-.23+j*.15,1.08+k*.29,z+.37,.044,.17,colors[(j+k)%6]);box(x-.23+j*.15,.95+k*.29,z+.38,.07,.025,.015,'#d3dbbf',false);}box(x+.23,.67,z+.354,.12,.18,.03,'#90b4bd');box(x-.1,.53,z+.35,.37,.14,.035,'#243f4b');label('つめたい',x,2.02,z+.345,.61,.13,'#d6ece2','#537a81',86);light(x,1,z+.8,0x80dfe5,3,3);}
vending(-1.75,2.3,'#88bbb6');vending(-.84,2.3,'#bd807e');
// Bicycles in the side alley.
function bicycle(z){const g=new THREE.Group();g.position.set(-3.25,.29,z);scene.add(g);for(const zz of [-.53,.53]){let t=mesh(new THREE.TorusGeometry(.32,.035,8,24),mat('#253b49'),0,.34,zz,false,g);t.rotation.y=Math.PI/2;let rim=mesh(new THREE.TorusGeometry(.28,.012,6,24),mat('#94b3b4'),0,.34,zz,false,g);rim.rotation.y=Math.PI/2;for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[0,.34,zz],[0,.34+Math.sin(a)*.28,zz+Math.cos(a)*.28]],'#7c969d',.005,g);}}
line([[0,.34,-.53],[0,.77,-.19],[0,.34,.04],[0,.34,-.53],[0,.68,.39],[0,.34,.53],[0,.34,.04]],'#c4a083',.028,g);line([[0,.34,.53],[0,.87,.4],[-.18,.94,.38]],'#9bb8bc',.024,g);box(0,.8,-.18,.22,.05,.23,'#344352',true,g);box(0,.79,.66,.35,.23,.32,'#69848a',true,g);}
bicycle(-.3);bicycle(-1.6);
// Umbrellas, bins, AC grille, posters and guard rails.
box(2.7,.52,2.19,.36,.51,.34,'#5e7d85');for(let i=0;i<4;i++){let x=2.58+i*.08;line([[x,.48,2.18],[x,1.24,2.18],[x+.07,1.3,2.18],[x+.09,1.22,2.18]],'#b1c5c1',.014);mesh(new THREE.ConeGeometry(.055,.55,7),mat(colors[i]),x,.82,2.18,true);}
for(let i=0;i<2;i++){cyl(4.9,.64,.65+i*.65,.23,.72,'#829e9d');cyl(4.9,1.02,.65+i*.65,.24,.07,'#a5bab0');box(4.9,.8,.9+i*.65,.22,.09,.01,'#304e58');}
box(4.57,.73,-2.7,.51,.83,1.05,'#bcc8b8');for(let i=0;i<9;i++)box(4.84,.4+i*.075,-2.7,.025,.025,.86,'#708989',false);
box(4.365,2,-.6,.025,1.02,.81,'#6c8076');for(let i=0;i<4;i++){let a=label(i%2?'SALE':'夏の便り',4.39,1.8+Math.floor(i/2)*.44,-.8+(i%2)*.37,.29,.36,colors[i],'#445c60',120);a.rotation.y=Math.PI/2;}
for(let i=0;i<3;i++){let x=-2.1+i*1.25;cyl(x,.63,3.13,.045,.8,'#b5c3b6');}line([[-2.1,.91,3.13],[.4,.91,3.13]],'#b5c3b6',.045);
// Lamp and utility pole: careful silhouette above the small roof.
cyl(-3.7,2.27,2.6,.06,4.4,'#596f80');line([[-3.7,4.45,2.6],[-3.7,4.64,2.6],[-3.3,4.69,2.6],[-2.93,4.64,2.6]],'#597082',.055);box(-2.95,4.59,2.6,.48,.12,.25,'#b7c6bb');box(-2.95,4.515,2.6,.39,.015,.19,new THREE.MeshBasicMaterial({color:'#ffe4b0'}),false);light(-2.95,3.8,2.6,0xffdeaa,16,7);
cyl(-4.7,2.91,-3.85,.1,5.7,'#7c8290');box(-4.7,5.25,-3.85,1.28,.08,.09,'#748f9b');for(let i=0;i<3;i++){cyl(-5.2+i*.5,5.39,-3.85,.05,.2,'#a6bcb5');line([[-5.2+i*.5,5.49,-3.85],[-2+i*.5,4.97,-4.9],[5.7,5.4,-4.9]],'#283746',.018);}
label('止まれ',-4.71,2.25,-3.72,.57,.5,'#b6797b','#eee1c6',170);
box(-4.71,3.1,-3.72,.7,.24,.025,'#648b9e');label('小路  KOMOREBI',-4.71,3.1,-3.7,.65,.2,'#648b9e','#e5e7d8',65);
const signals=[];box(5.1,2.5,-4.75,.07,4.5,.07,'#4e6f7b');box(4.85,4.4,-4.75,.6,.22,.2,'#364d58');for(let i=0;i<3;i++){signals.push(mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:i===0?'#79c8ac':'#455563'}),4.66+i*.18,4.4,-4.635,false));}

// Two distinct new buildings, connected by a quiet service alley.
box(6.8,.13,-1,4.2,.22,7.8,'#75858a');box(1,.13,-6.45,7.8,.22,4.9,'#75858a');
// Ramen shop: transparent storefront and visible counter/kitchen.
box(6.9,.38,-1.2,3.2,.17,4.5,'#cfbda4');box(6.9,1.63,-3.45,3.2,2.5,.14,'#9c9291');box(8.48,1.63,-1.2,.14,2.5,4.5,'#a09b95');box(5.32,1.63,-1.2,.14,2.5,4.5,'#a09b95');
box(6.9,2.95,-1.2,3.5,.22,4.8,'#616f84');for(let i=0;i<12;i++){box(5.37+i*.28,3.08,-1.2,.035,.07,4.7,'#7d8694',false);}
for(let x of [5.34,6.32,7.3,8.47])box(x,1.66,1.04,.06,2.43,.09,'#655d65');box(6.9,1.66,1.04,3.07,2.34,.012,glass,false);box(6.9,.5,1.04,3.2,.2,.1,'#656470');
box(6.9,2.65,1.35,3.6,.17,.8,'#88778a');label('雨音らーめん',6.9,2.84,1.77,3.1,.38,'#e8d0af','#67535a',130);
for(let i=0;i<5;i++){let x=5.54+i*.55;box(x,2.29,1.09,.49,.5,.025,'#748d96');label(i===2?'麺':'',x,2.29,1.11,.43,.45,'#748d96','#ece2ca',240);}
box(6.15,1.13,-.65,.65,1.3,3.1,'#967969');box(6.15,1.83,-.65,.91,.1,3.3,'#c5a780');for(let j=0;j<4;j++){let z=.5-j*.79;cyl(7.06,.9,z,.21,.15,'#b3907b');cyl(7.06,.61,z,.035,.53,'#67717d');mesh(new THREE.SphereGeometry(.13,12,8,0,Math.PI*2,0,Math.PI/2),mat('#e6d9bd'),6.24,1.91,z,false);line([[6.44,1.91,z-.06],[6.72,1.91,z-.06]],'#4f5260',.009);}
box(6.75,1.05,-2.85,2.2,1.2,.55,'#8b9494');box(6.75,1.7,-2.85,2.3,.08,.65,'#c3c3af');for(let i=0;i<3;i++){cyl(6+i*.65,1.83,-2.85,.2,.18,'#b5b8ae');cyl(6+i*.65,1.94,-2.85,.21,.03,'#d1cabc');}
label('醤油  みそ  塩',7.4,2.17,-3.36,1.55,.47,'#d4b894','#65515b',120);light(6.7,2.2,0,0xffc798,12,5);
for(let x of [5.7,8.1]){cyl(x,2.08,1.6,.18,.48,'#d89e87');for(let j=0;j<5;j++)cyl(x,1.9+j*.09,1.6,.184,.012,'#9d7472');label('麺',x,2.1,1.79,.19,.27,'#d89e87','#665260',240);}
// Apartment: staggered warm windows, balconies, stairs, rooftop water tank.
box(.9,2.59,-6.6,5.7,4.8,3.3,'#a3a5aa');box(.9,5.1,-6.6,6,.2,3.6,'#697a8b');box(.9,5.22,-6.6,5.8,.13,3.4,'#8795a0');
for(let floor=0;floor<3;floor++)for(let j=0;j<3;j++){let x=-.94+j*1.8,y=1.02+floor*1.45;box(x,y,-4.925,1.19,.97,.04,'#425c73');box(x,y,-4.89,1.05,.83,.018,new THREE.MeshBasicMaterial({color:(floor+j)%3?'#dec3a0':'#617d93'}));box(x,y,-4.86,.034,.86,.025,'#526677');box(x,y+.43,-4.86,1.1,.03,.025,'#526677');for(let k=0;k<2;k++)box(x-.38+k*.76,y,-4.85,.21,.8,.016,'#b1aaa3');if(floor>0){box(x,y-.58,-4.56,1.48,.1,.72,'#8f989f');for(let k=0;k<6;k++)box(x-.64+k*.25,y-.25,-4.24,.02,.58,.025,'#67798c');box(x,y+.05,-4.24,1.46,.028,.025,'#67798c');}}
box(.9,.96,-4.88,.74,1.45,.04,'#607786');label('こもれび荘',.9,1.88,-4.84,1.1,.24,'#bbc3be','#556c7b',95);for(let i=0;i<4;i++)box(-1.42+i*.27,.9,-4.84,.2,.25,.07,'#8e9699');
for(let i=0;i<16;i++){box(-2.3,.38+i*.25,-5.05-i*.17,.7,.08,.32,'#768a97');}line([[-2.66,.83,-4.98],[-2.66,4.6,-7.62]],'#556b80',.025);cyl(2.15,5.7,-6.9,.57,.9,'#9eafb2');cyl(2.15,6.17,-6.9,.6,.06,'#748b9b');
// Alley paving, drains, pipes and plants give a coherent transition.
box(4.77,.26,-1.65,.77,.07,7.6,'#4d6476');for(let i=0;i<20;i++)box(4.78,.303,-5.2+i*.37,.6,.008,.022,'#8896a1',false);line([[4.34,3.3,-2.4],[4.54,3.3,-2.4],[4.54,.45,-2.4]],'#7b8e97',.038);box(4.77,.32,1.9,.48,.03,.38,'#344d60');for(let i=0;i<6;i++)box(4.57+i*.08,.341,1.9,.023,.01,.32,'#9ba6aa',false);
for(let i=0;i<7;i++){let x=i<4?5.65+i*.7:-1.7+(i-4)*.53,z=i<4?2.25:-4.52;cyl(x,.48,z,.14,.3,'#aa8980');for(let k=0;k<4;k++){mesh(new THREE.SphereGeometry(.13,7,5),mat('#6f9690'),x+(rnd()-.5)*.17,.72+rnd()*.18,z+(rnd()-.5)*.17,false);}}
// Puddles with soft neon reflections; reflected sign glyphs fragmented by water.
const puddles=[];for(let i=0;i<15;i++){const x=i<9?-2.4+i*.82:-4.45,z=i<9?3.65+(i%3)*.66:-4.3+(i-9)*1.18;let p=mesh(new THREE.CircleGeometry(.5,40),new THREE.MeshStandardMaterial({color:i%2?'#567b91':'#4c7d82',transparent:true,opacity:.55,metalness:.65,roughness:.17}),x,.105,z,false);p.rotation.x=-Math.PI/2;p.scale.set(1.2+(i%3)*.2,.35+(i%2)*.25,1);puddles.push([x,z]);}
for(let i=0;i<95;i++){let x=-2.5+Math.random()*6.8,z=3.1+Math.random()*2.65;let s=box(x,.114,z,.025+Math.random()*.1,.005,.09+Math.random()*.37,glow(i%3?'#efc494':'#8ee1d2',.05+Math.random()*.12),false);}
let ref=label('こもれび MART',.7,.122,3.7,5,.48,'#2c4354','#93b7ac',80);ref.rotation.x=-Math.PI/2;ref.material.transparent=true;ref.material.opacity=.22;
// Continuous bounded rainfall, with no rain under the store roof.
const rainCount=1450,positions=new Float32Array(rainCount*6),speeds=[];for(let i=0;i<rainCount;i++){let x=(Math.random()-.5)*17.8,z=(Math.random()-.5)*17.8;if((x>-2.7&&x<4.45&&z>-4&&z<2.5)||(x>5.2&&x<8.7&&z>-3.7&&z<1.8)||(x>-2.2&&x<4&&z>-8.5&&z<-4.7))z=3+Math.random()*2.8;let y=Math.random()*7;positions.set([x,y,z,x-.035,y+.18,z-.014],i*6);speeds.push(4+Math.random()*3);}
const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(positions,3));scene.add(new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xa9c9df,transparent:true,opacity:.29,depthWrite:false})));
const rings=[];for(let i=0;i<35;i++){let [x,z]=puddles[i%puddles.length];let a=mesh(new THREE.RingGeometry(.95,1,32),glow('#acd8de',.2),x+(Math.random()-.5)*.4,.119,z+(Math.random()-.5)*.2,false);a.rotation.x=-Math.PI/2;rings.push({a,phase:Math.random()});}
const drops=[];for(let i=0;i<40;i++){let x=-2.4+Math.random()*6.5;let a=box(x,.7+Math.random()*2,1.806,.012,.07+Math.random()*.06,.003,glow('#c1e4df',.32),false);drops.push(a);}
const drips=[];for(let i=0;i<18;i++){let a=box(-2.7+Math.random()*7.1,Math.random()*3,2.55,.013,.09,.012,glow('#cee7e5',.5),false);drips.push(a);}
// User interaction: one finger or left mouse orbit, wheel/pinch zoom, right mouse pan.
const pointers=new Map();let last=null,pinch=0;const canvas=renderer.domElement;canvas.style.touchAction='none';canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});last={x:e.clientX,y:e.clientY};if(pointers.size===2){let p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);dist=Math.max(9,Math.min(48,dist*pinch/d));pinch=d;}else if(last){let dx=e.clientX-last.x,dy=e.clientY-last.y;if(e.buttons===2){target.x-=dx*.009;target.y+=dy*.009;}else{yaw-=dx*.006;pitch=Math.max(.16,Math.min(1.35,pitch+dy*.005));}}last={x:e.clientX,y:e.clientY};});for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,e=>{pointers.delete(e.pointerId);last=null;});canvas.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(9,Math.min(48,dist*Math.exp(e.deltaY*.001)));},{passive:false});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});let prev=0;function frame(ms){requestAnimationFrame(frame);const t=ms*.001,dt=Math.min(.04,t-prev);prev=t;camera.position.set(target.x+dist*Math.sin(yaw)*Math.cos(pitch),target.y+dist*Math.sin(pitch),target.z+dist*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);for(let i=0;i<rainCount;i++){let n=i*6;positions[n+1]-=dt*speeds[i];positions[n+4]-=dt*speeds[i];if(positions[n+1]<.2){positions[n+1]=7;positions[n+4]=7.18;}}rg.attributes.position.needsUpdate=true;for(const r of rings){let p=(t*.6+r.phase)%1;r.a.scale.setScalar(.02+p*.48);r.a.material.opacity=(1-p)*.24;}for(const d of drops){d.position.y-=dt*.11;if(d.position.y<.6)d.position.y=2.85;}for(const d of drips){d.position.y-=dt*2.2;if(d.position.y<.25)d.position.y=3.02;}let cycle=t%19,open=cycle>10&&cycle<15?Math.min(1,(cycle-10)*1.5,(15-cycle)*1.5):0;doors[0].position.x=1.58-open*.46;doors[1].position.x=2.1+open*.46;sign.material.color.setScalar(1-.07*Math.pow(Math.sin(t*1.7),24));signals[0].material.color.set(t%30<19?'#7cceae':'#43565d');signals[2].material.color.set(t%30>=19?'#d28d8e':'#43565d');renderer.render(scene,camera);}requestAnimationFrame(frame);
window.__scene={scene,renderer,camera};
})();

// こもれび荘: compact three-storey walk-up apartment with warm independent homes, front entry lobby,
// exterior access gallery and supported switchback stair. Origin is the frozen north entrance; front +Z.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B05-P05'] = (K, rec) => {
  const { THREE, group, box, cyl, mat, warm, glass, wall, label } = K;
  const F=rec.floor, X0=-3.45, X1=3.45, Z0=0, Z1=-5.8, T=.16, H=2.7, y2=F+H, y3=F+H*2, top=F+H*3;
  const plaster=mat('#c9c7bd'), timber=mat('#77553e'), warmWall=warm('#eadfc9',.26), glassMat=glass, windowGlow=K.glow('#ffd49a',.34);
  const part=(name)=>group(name);
  const layer=(parent,name)=>{const g=new THREE.Group();g.name=name;g.userData.layer=name;parent.add(g);K.setRoot(g);return g;};
  const win=(x,y,z,w,h,out=1)=>{const pane=z+out*.055,light=z+out*.025,frame=z+out*.09;box(x,y,light,w-.08,h-.08,.012,windowGlow,false);box(x,y,pane,w-.12,h-.12,.012,glassMat,false);for(const xx of [x-w/2,x+w/2])box(xx,y,frame,.055,h+.12,.045,'#354656');for(const yy of [y-h/2,y+h/2])box(x,yy,frame,w+.12,.055,.045,'#354656');box(x,y,frame,.035,h,.045,timber);box(x,y,frame,w,.035,.045,timber);box(x,y-h/2-.075,z+out*.1,w+.24,.08,.24,'#9a9b93');};
  const sideWin=(x,y,z,w,h,out=1)=>{const pane=x+out*.055,light=x+out*.025,frame=x+out*.09;box(light,y,z,.012,h-.08,w-.08,windowGlow,false);box(pane,y,z,.012,h-.12,w-.12,glassMat,false);for(const zz of [z-w/2,z+w/2])box(frame,y,zz,.045,h+.12,.055,'#354656');for(const yy of [y-h/2,y+h/2])box(frame,yy,z,.045,.055,w+.12,'#354656');box(frame,y,z,.045,h,.035,timber);box(frame,y,z,.045,.035,w,timber);box(x+out*.1,y-h/2-.075,z,.24,.08,w+.24,'#9a9b93');};
  const door=(x,y,z,axis='front')=>{if(axis==='front'){box(x,y,z,.98,2.15,.16,'#51483f');box(x,y,z-.095,.82,2.02,.035,'#80684c');box(x+.28,y,z-.12,.035,.15,.04,'#d2b678');}else{box(x,y,z,.16,2.12,.96,'#51483f');box(x+.095,y,z,.035,1.98,.8,'#80684c');box(x+.12,y,z-.27,.04,.15,.035,'#d2b678');}};
  // Main shell and three real floor plates. Upper floor shells can be lifted in the cutaway views.
  let g=part('apartmentNew');
  box(0,F-.035,(Z0+Z1)/2,6.95,.07,5.95,'#aaa99f');
  const bases=[F,y2,y3],roots=[g,layer(g,'f2'),layer(g,'f3')];K.setRoot(g);
  for(let i=0;i<bases.length;i++){
    const base=bases[i],ceiling=base+H-.12;K.setRoot(roots[i]);
    const frontHoles=i===0?[[ -.62,.62,base,base+2.2],[-3.0,-1.45,base+.85,base+2.05],[1.45,3.0,base+.85,base+2.05]]:[[-3.0,-1.45,base+.75,base+2.0],[1.45,3.0,base+.75,base+2.0]];
    wall('x',Z0-T/2,T,[X0,X1,base,ceiling],frontHoles,plaster);
    const backHoles=[];for(const x of [-2.85,1.55])backHoles.push([x,x+1.25,base+.9,base+2.05]);
    wall('x',Z1+T/2,T,[X0,X1,base,ceiling],backHoles,plaster);
    const leftHoles=[[-4.0,-2.7,base+.85,base+2.05]];
    const rightHoles=i===0?[[-4.1,-2.8,base+.85,base+2.05]]:[[-1.1,-.1,base,base+2.15],[-4.1,-2.8,base+.85,base+2.05]];
    wall('z',X1-T/2,T,[Z1,Z0,base,ceiling],rightHoles,plaster);
    wall('z',X0+T/2,T,[Z1,Z0,base,ceiling],leftHoles,plaster);
    if(i>0)box(0,base-.12,(Z0+Z1)/2,6.9,.24,5.8,'#b9b3a7');
  }
  for(let i=0;i<bases.length;i++){const base=bases[i];K.setRoot(roots[i]);
    // Back and west-facing windows keep the service elevations finished and warm.
    for(const x of [-2.22,2.18])win(x,base+1.48,Z1-.04,1.18,1.12,-1);
    sideWin(X0+.02,base+1.45,-3.35,1.3,1.12,-1);
    if(base>F)sideWin(X1-.02,base+1.45,-3.45,1.2,1.12,1);
    // Front glazing and separate apartment windows, with visible amber room depth.
    for(const x of [-2.22,2.22]){win(x,base+1.44,.02,1.42,1.18);box(x,base+.43,-2.55,1.0,.72,.55,warmWall);box(x,base+.82,-2.55,.55,.045,.56,timber);}
    // interior partitions and household furniture visible through the windows
    box(-.95,base+1.28,-2.75,.1,2.45,5.1,plaster,false);box(.95,base+1.28,-3.05,.1,2.45,4.5,plaster,false);
    box(-2.05,base+.56,-3.95,1.35,.92,.8,'#8d7358');box(2.05,base+.43,-3.9,1.2,.68,.72,'#837b6b');
    box(0,base+.42,-1.15,1.25,.72,.62,'#816b54');
  }
  K.setRoot(g);door(0,F+1.07,-.06); // shared entrance
  for(const base of [y2,y3]){K.setRoot(base===y2?roots[1]:roots[2]);door(X1-.01,base+1.08,-.62,'side');}
  K.setRoot(g);
  // Floor bands, rain leaders, front name plaque and covered entry.
  const sconceNode=new THREE.Group();sconceNode.userData.live=true;g.add(sconceNode);const sconce=K.mesh(new THREE.PlaneGeometry(.12,.2),K.glow('#ffd99a',.2),-1.2,2.55,.055,false,sconceNode);
  for(const y of [y2,y3,top-.1])box(0,y,.015,7.1,.16,.23,'#aaa79e');
  box(0,F+2.45,.21,2.4,.42,.11,'#536677');label('こもれび荘',0,F+2.45,.145,2.15,.32,'#536677','#f4e6c8',56);
  box(0,F+2.36,.62,1.5,.08,.9,'#536677');
  for(const x of [-3.24,3.24]){box(x,F+1.38,.05,.08,2.75,.1,timber);box(x,y2+1.38,.05,.08,2.75,.1,timber);box(x,y3+1.38,.05,.08,2.75,.1,timber);}
  // Roof and ceiling are grouped for the roof-lift views.
  g=part('apartmentNew');g=layer(g,'roof');
  box(0,top+.04,-2.98,7.25,.24,6.5,'#66778a');box(0,top+.18,-2.98,7.4,.08,6.6,'#43566d');
  for(const x of [-3.45,3.45])box(x,top-.18,-2.9,.12,.5,6.0,'#65768a');
  // rooftop water tank and service rail
  cyl(2.25,top+.53,-4.45,.48,.62,'#aab6b4');cyl(2.25,top+.86,-4.45,.5,.08,'#728896');
  for(const x of [-2.8,-1.4,0,1.4,2.8])box(x,top+.37,-.35,.045,.55,.045,'#536677');box(0,top+.64,-.35,5.7,.06,.06,'#536677');
  // Front balconies, kept shallow inside the frozen plot; slim rails and supports.
  g=part('apartmentGallery');
  for(const base of [y2,y3]){box(0,base+.03,.55,6.35,.14,1.05,'#a6a59d');for(const x of [-3.05,-2.2,-1.35,-.5,.5,1.35,2.2,3.05])box(x,base+.57,1.03,.055,1.05,.055,timber);box(0,base+1.1,1.03,6.2,.075,.075,timber);}
  // Side access galleries link each exterior landing directly through the side door openings.
  g=part('apartmentStair');
  // Upper access landings meet the side doors; intermediate half-storey landings turn the two flights back.
  for(const lev of [y2,y3]){box(4.3,lev+.03,-.62,1.8,.14,1.35,'#8c9698');for(const x of [3.48,5.12])box(x,lev+.55,-.62,.045,1.0,1.2,timber);box(4.3,lev+1.05,-.62,1.68,.06,.055,timber);}
  for(const mid of [F+1.35,y2+1.35])box(4.48,mid+.03,-2.58,1.82,.14,.9,'#8c9698');
  // Supported switchback flights: two 8-riser runs per storey, ~0.169 m rise and 0.37 m going.
  const halfFlight=(x,z0,z1,y0,y1)=>{const n=8,run=Math.abs(z1-z0)/n,rise=(y1-y0)/n;for(let i=0;i<n;i++){const z=z0+(z1-z0)*(i+.5)/n,y=y0+(i+1)*rise;box(x,y-.03,z,.82,.06,run+.035,'#89979c');box(x,y-rise/2,z+(z1>z0?run/2:-run/2),.82,rise,.04,'#647985');}for(const dx of [-.37,.37]){for(let i=0;i<=n;i+=2){const z=z0+(z1-z0)*i/n,y=y0+(y1-y0)*i/n;box(x+dx,y+.45,z,.045,.9,.045,timber);}const rail=box(x+dx,(y0+y1)/2+.9,(z0+z1)/2,.045,.07,Math.hypot(z1-z0,y1-y0),'#536677');rail.rotation.x=Math.atan2(y1-y0,z1-z0);}};
  for(const base of [F,y2]){halfFlight(4.02,.25,-2.58,base,base+1.35);halfFlight(4.92,-2.58,-.62,base+1.35,base+2.7);}
  g=part('apartmentEntry');box(-2.85,.67,-.35,.4,.95,.38,'#89785f');box(-2.85,1.19,-.35,.46,.08,.44,'#c0aa82');
  for(const x of [-3.05,3.05]){cyl(x,.5,-.35,.22,.42,'#8e7770');for(let i=0;i<4;i++)box(x+(i-1.5)*.08,.83+(i%2)*.08,-.35,.12,.48,.13,['#63836e','#789675','#87a07d','#587864'][i],false);}
  return {update(t){sconce.material.opacity=.18+.035*Math.sin(t*1.25);sconce.position.y=2.55+.02*Math.sin(t*1.1);}};
};

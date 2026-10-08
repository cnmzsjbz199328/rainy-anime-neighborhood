// D13: parallel-transported target frame. No longitude singularity in interaction.
(function(global){
'use strict';
global.SPHERE_CAMERA=function(THREE,B,camera){
  const C=new THREE.Vector3(0,-B.R,0),n=new THREE.Vector3(0,1,0),east=new THREE.Vector3(1,0,0);
  let grab=null,radius=B.R+1.2;
  const v=a=>new THREE.Vector3(...a);
  function reset(target){const b=B.basis(target[0],target[2]);n.fromArray(b.up);east.fromArray(b.east);grab=null;}
  function rotate(q){n.applyQuaternion(q).normalize();east.applyQuaternion(q).addScaledVector(n,-east.dot(n)).normalize();}
  function flat(){const lat=Math.max(-89.9,Math.min(89.9,Math.asin(Math.max(-1,Math.min(1,-n.z)))*180/Math.PI));return[B.wrapX(B.R*Math.atan2(n.x,n.y)),-B.R*Math.asinh(Math.tan(lat*Math.PI/180))];}
  function frame(target,d,yaw,pitch){
    if(!grab){const p=v(B.point(...target,1));radius=p.distanceTo(C);}
    const south=new THREE.Vector3().crossVectors(east,n),back=east.clone().multiplyScalar(Math.sin(yaw)).addScaledVector(south,Math.cos(yaw));
    const P=C.clone().addScaledVector(n,radius),position=P.clone().addScaledVector(n,d*Math.sin(pitch)).addScaledVector(back,d*Math.cos(pitch));
    const t=Math.max(0,Math.min(1,(d-80)/220)),look=P.clone().lerp(C,t*t*(3-2*t));
    // At the exact zenith the radial up is parallel to the view. The limiting
    // screen up is -back, preserving heading instead of lookAt's arbitrary fallback.
    return {position:position.toArray(),lookAt:look.toArray(),up:n.toArray(),screenUp:back.clone().negate().toArray()};
  }
  function hit(x,y,snap){
    const rect=snap.rect,ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(2*(x-rect.left)/rect.width-1,1-2*(y-rect.top)/rect.height),snap.camera);
    return ray.ray.intersectSphere(new THREE.Sphere(C,B.R),new THREE.Vector3());
  }
  function begin(x,y,rect){camera.updateMatrixWorld();const cam=camera.clone();cam.updateMatrixWorld();grab={camera:cam,rect,n:n.clone(),east:east.clone(),x,y,lastX:x,lastY:y,lastQ:new THREE.Quaternion()};grab.anchor=hit(x,y,grab);}
  function drag(x,y){
    if(!grab)return;const end=hit(x,y,grab);let q;
    if(grab.anchor&&end){q=new THREE.Quaternion().setFromUnitVectors(end.sub(C).normalize(),grab.anchor.clone().sub(C).normalize());const pixels=Math.hypot(x-grab.lastX,y-grab.lastY);if(pixels>0)grab.edgeRate=q.angleTo(grab.lastQ)/pixels;grab.lastQ.copy(q);}
    else{
      // Off-disc: continue at the limb's angular scale, in the frozen screen frame.
      const right=new THREE.Vector3().setFromMatrixColumn(grab.camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(grab.camera.matrixWorld,1);
      const scale=grab.edgeRate??(2*Math.tan(grab.camera.fov*Math.PI/360)*grab.camera.position.distanceTo(C)/(grab.rect.height*B.R));
      q=new THREE.Quaternion().setFromAxisAngle(up,-(x-grab.lastX)*scale).multiply(new THREE.Quaternion().setFromAxisAngle(right,-(y-grab.lastY)*scale)).multiply(grab.lastQ);grab.lastQ.copy(q);
    }
    n.copy(grab.n).applyQuaternion(q).normalize();east.copy(grab.east).applyQuaternion(q).normalize();grab.lastX=x;grab.lastY=y;
  }
  function move(x,z,metres,yaw){const south=new THREE.Vector3().crossVectors(east,n),dir=east.clone().multiplyScalar(Math.cos(yaw)*x-Math.sin(yaw)*z).addScaledVector(south,-Math.sin(yaw)*x-Math.cos(yaw)*z);if(dir.lengthSq()<1e-12)return;const axis=new THREE.Vector3().crossVectors(n,dir.normalize()).normalize();rotate(new THREE.Quaternion().setFromAxisAngle(axis,metres/B.R));}
  return{reset,flat,frame,begin,drag,end(){grab=null;},move,state:()=>({normal:n.toArray(),east:east.toArray(),radius,dragging:!!grab})};
};
})(globalThis);

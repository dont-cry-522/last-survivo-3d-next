import * as T from './vendor/three.module.js';
import {smoothSeams} from './hero-finish.js?v=172';

export const lingyaHeadY=y=>y-.029*T.MathUtils.smoothstep(y,1.44,1.59);

// Fit the existing hood, cropped hair and weighted neck around the authored head.
export function refineLingyaHead(root){
 root.traverse(o=>{
  if(!o.isSkinnedMesh)return;
  const skin=o.material.name.includes('Superhero'),hair=o.name==='Hair_Long',hood=o.name.includes('Head_Hood');
  if(!skin&&!hair&&!hood)return;
  o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   if(hair){const covered=1-T.MathUtils.smoothstep(z,.005,.045),fringe=T.MathUtils.smoothstep(z,.045,.10)*(1-T.MathUtils.smoothstep(y,1.665,1.72));x*=1-.12*covered;z=-.025+(z+.025)*(1-.08*covered)-.004*fringe;y=1.67+(y-1.67)*(1-.06*covered);x+=.007*fringe;y+=.011*Math.exp(-(((x+.038)/.029)**2))*fringe;}
   p.setXYZ(i,x,lingyaHeadY(y),z);
  }
  o.geometry.computeVertexNormals();smoothSeams(o.geometry);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
 });
}

// Facial proportions and matching Blink are authored in prepare-lingya-head.py.
// Keep the shared source isolated and finish its materials without reshaping the
// new nose, lips and sockets for a second time at runtime.
export function refineLingyaFace(root){
 if(root.userData.lingyaFaceRefined)return root;
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const g=mesh.geometry.clone();
  if(mesh.material.name==='Lingya_face_skin'&&g.attributes.color){const c=g.attributes.color;for(let i=0;i<c.count;i++)c.setXYZ(i,T.MathUtils.lerp(c.getX(i),.90,.08),T.MathUtils.lerp(c.getY(i),.59,.16),T.MathUtils.lerp(c.getZ(i),.48,.12));}
  g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;
  const polish=m=>{const next=m.clone();if(m.name==='Lingya_eye_white'){next.color.multiplyScalar(.91);next.roughness=.62;}if(m.name==='Lingya_face_skin')next.roughness=.87;if(m.name==='Lingya_face_brow')next.color.lerp(new T.Color(.24,.13,.073),.35);return next;};
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(polish):polish(mesh.material);
 });
 root.userData.lingyaFaceRefined=true;return root;
}

export function refineLingyaAccessories(accessories){
 if(accessories.hood.userData.lingyaEarsRefined)return accessories;
 for(const ear of accessories.hood.children){
  const side=Math.sign(ear.position.x);ear.position.set(side*.136,1.705,-.013);ear.scale.set(side*.98,.93,.90);ear.rotation.z=-side*.10;
 }
 accessories.hood.userData.lingyaEarsRefined=true;return accessories;
}

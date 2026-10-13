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
   if(hair){const covered=1-T.MathUtils.smoothstep(z,.005,.045);x*=1-.12*covered;z=-.025+(z+.025)*(1-.08*covered);y=1.67+(y-1.67)*(1-.06*covered);}
   p.setXYZ(i,x,lingyaHeadY(y),z);
  }
  o.geometry.computeVertexNormals();smoothSeams(o.geometry);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
 });
}

// Small surface corrections to the authored face, not another round of head or
// eye enlargement. Work in the delivered GLTF coordinates and preserve Blink.
function facePoint(x,y,z){
 const front=T.MathUtils.smoothstep(z,.027,.055),nose=Math.exp(-((x/.015)**2)-(((y-1.596)/.012)**2))*front,lip=Math.exp(-((x/.018)**2)-(((y-1.552)/.009)**2))*front,cheek=Math.exp(-(((Math.abs(x)-.049)/.021)**2)-(((y-1.587)/.021)**2))*front,lid=Math.exp(-(((Math.abs(x)-.032)/.020)**2)-(((y-1.636)/.0045)**2))*front;
 return[x*(1-.008*cheek),y,z-.0018*nose-.0011*lip-.0008*cheek-.0005*lid];
}
export function refineLingyaFace(root){
 if(root.userData.lingyaFaceRefined)return root;
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const g=mesh.geometry.clone(),source=g.attributes.position.array.slice(),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setXYZ(i,...facePoint(source[i*3],source[i*3+1],source[i*3+2]));
  for(const delta of g.morphAttributes.position||[])for(let i=0;i<p.count;i++){
   const x=g.morphTargetsRelative?source[i*3]+delta.getX(i):delta.getX(i),y=g.morphTargetsRelative?source[i*3+1]+delta.getY(i):delta.getY(i),z=g.morphTargetsRelative?source[i*3+2]+delta.getZ(i):delta.getZ(i),q=facePoint(x,y,z);
   delta.setXYZ(i,q[0]-(g.morphTargetsRelative?p.getX(i):0),q[1]-(g.morphTargetsRelative?p.getY(i):0),q[2]-(g.morphTargetsRelative?p.getZ(i):0));
  }
  g.computeVertexNormals();smoothSeams(g);
  for(let k=0;k<(g.morphAttributes.normal?.length||0);k++){
   const delta=g.morphAttributes.position[k];if(!delta)continue;
   const posed=new T.BufferGeometry(),positions=p.clone();for(let i=0;i<p.count;i++)positions.setXYZ(i,delta.getX(i)+(g.morphTargetsRelative?p.getX(i):0),delta.getY(i)+(g.morphTargetsRelative?p.getY(i):0),delta.getZ(i)+(g.morphTargetsRelative?p.getZ(i):0));
   posed.setAttribute('position',positions);posed.setIndex(g.index);posed.computeVertexNormals();smoothSeams(posed);const n=posed.attributes.normal,normal=g.morphAttributes.normal[k];
   for(let i=0;i<n.count;i++)normal.setXYZ(i,n.getX(i)-(g.morphTargetsRelative?g.attributes.normal.getX(i):0),n.getY(i)-(g.morphTargetsRelative?g.attributes.normal.getY(i):0),n.getZ(i)-(g.morphTargetsRelative?g.attributes.normal.getZ(i):0));posed.dispose();
  }
  g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;
  const polish=m=>{const next=m.clone();if(m.name==='Lingya_eye_white'){next.color.multiplyScalar(.91);next.roughness=.62;}if(m.name==='Lingya_face_brow')next.color.lerp(new T.Color(.24,.13,.073),.25);return next;};
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(polish):polish(mesh.material);
 });
 root.userData.lingyaFaceRefined=true;return root;
}

export function refineLingyaAccessories(accessories){
 if(accessories.hood.userData.lingyaEarsRefined)return accessories;
 for(const ear of accessories.hood.children){
  ear.position.x=Math.sign(ear.position.x)*.112;ear.position.y-=.013;ear.scale.set(.56,.48,.64);ear.rotation.z=-Math.sign(ear.position.x)*.20;
  const lining=ear.children[1];if(lining)lining.position.z=.052;
 }
 accessories.hood.userData.lingyaEarsRefined=true;return accessories;
}

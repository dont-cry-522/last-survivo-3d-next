import * as T from './vendor/three.module.js';
import {smoothSeams} from './hero-finish.js?v=207';

export const lingyaHeadY=y=>y-.029*T.MathUtils.smoothstep(y,1.44,1.59);

// The new short bob and the weighted neck use one continuous rest-space fit.
export function refineLingyaHead(root){
 root.traverse(o=>{
  if(!o.isSkinnedMesh)return;
  const skin=o.material.name.includes('Superhero'),hair=o.name==='Hair_Long',hood=o.name.includes('Head_Hood');
  if(!skin&&!hair&&!hood)return;
  o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   if(hair){
    // Preserve the authored lock surfaces instead of cutting a flat cap edge.
    const lower=1-T.MathUtils.smoothstep(y,1.60,1.64),front=T.MathUtils.smoothstep(z,.035,.080);
    y=1.62+(y-1.62)*(1-.72*lower);x*=1-.10*lower;z=-.015+(z+.015)*(1-.12*lower);
    x+=.009*front*(1-T.MathUtils.smoothstep(y,1.67,1.73));
   }
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
  if(mesh.material.name==='Lingya_eye_iris'){
   // Colour the existing iris surface; no extra eye shell, texture or light.
   const p=g.attributes.position,colours=new Float32Array(p.count*3),inner=new T.Color(0x93724f),edge=new T.Color(0x5e4637),colour=new T.Color();
   let xmin=Infinity,xmax=0,ymin=Infinity,ymax=-Infinity;
   for(let i=0;i<p.count;i++){const x=Math.abs(p.getX(i)),y=p.getY(i);xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}
   const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2,rx=Math.max((xmax-xmin)/2,1e-6),ry=Math.max((ymax-ymin)/2,1e-6);
   for(let i=0;i<p.count;i++){const x=(Math.abs(p.getX(i))-cx)/rx,y=(p.getY(i)-cy)/ry,r=Math.hypot(x,y);colour.copy(inner).lerp(edge,T.MathUtils.smoothstep(r,.58,1)).multiplyScalar(1-.09*Math.max(0,y));colour.toArray(colours,i*3);}
   g.setAttribute('color',new T.BufferAttribute(colours,3));
  }
  g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;
  const polish=m=>{const next=m.clone();if(m.name==='Lingya_eye_brown'){next.color.set(0xe7ded0);next.roughness=.58;next.normalMap=null;}if(m.name==='Lingya_eye_white'){next.color.multiplyScalar(.91);next.roughness=.62;}if(m.name==='Lingya_eye_iris'){next.color.set(0xffffff);next.vertexColors=true;next.roughness=.46;}if(m.name==='Lingya_face_skin')next.roughness=.87;return next;};
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(polish):polish(mesh.material);
 });
 root.userData.lingyaFaceRefined=true;return root;
}

export function refineLingyaAccessories(accessories){
 // Retain the attachment interface without the former two ear-cover shells.
 return accessories;
}

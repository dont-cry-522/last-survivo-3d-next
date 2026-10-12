import * as T from './vendor/three.module.js';
import {smoothSeams} from './hero-finish.js?v=170';

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

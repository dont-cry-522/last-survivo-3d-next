import {MathUtils,Matrix4,Vector3} from './vendor/three.module.js';

// Static weights follow the existing random terrain. No new collision, rewards,
// lights, timers or per-frame spatial searches are introduced.
export function forestHabitatAt(world,x,z){
 const h=world.forestHabitats;if(!h||h.region&&!h.region.contains(x,z))return{shade:0,bank:0,ruin:0};
 const ruin=h.relic?1-MathUtils.smoothstep(Math.hypot(x-h.relic.x,z-h.relic.z),7,21):0;
 let bank=0;
 for(const p of h.ponds){const a=p.angle||0,c=Math.cos(a),s=Math.sin(a),dx=x-p.x,dz=z-p.z;
  const distance=(Math.hypot((c*dx-s*dz)/p.rx,(s*dx+c*dz)/p.rz)-1)*Math.min(p.rx,p.rz);
  bank=Math.max(bank,1-MathUtils.smoothstep(Math.max(0,distance),2,9));
 }
 let shade=0;for(const g of h.groves)shade=Math.max(shade,1-MathUtils.smoothstep(Math.hypot(x-g.x,z-g.z),4,17));
 return{shade:shade*(1-bank*.8)*(1-ruin),bank,ruin};
}

export function installForestHabitats(world,id){
 if(world.forestHabitats)return world.forestHabitats;
 const region=world.regions?.find(r=>r.id==='forest');
 if(id!=='forest'&&!(id==='confluence'&&region))return null;
 const inside=p=>!region||region.contains(p.x,p.z),relic=world.sites.find(s=>s.type==='relic'&&inside(s));
 const h={region,relic,ponds:world.ponds.filter(inside),groves:(region?.groves||world.groves||[]).filter(inside).map(p=>({x:p.x,z:p.z})),elder:null,trees:0};world.forestHabitats=h;
 const trees=world.obstacles.filter(o=>o.mesh.userData.treeBiome==='forest'&&!o.mesh.userData.forestVistaTrunk&&!world.breakables?.includes(o)&&inside(o));
 // The joined map has no grove descriptors; reuse a few separated tree anchors.
 if(!h.groves.length)for(const o of trees){if(h.groves.every(g=>Math.hypot(g.x-o.x,g.z-o.z)>23))h.groves.push({x:o.x,z:o.z});if(h.groves.length===6)break;}
 if(relic)h.elder=trees.filter(o=>Math.hypot(o.x-relic.x,o.z-relic.z)<24&&Math.hypot(o.x-world.spawn.x,o.z-world.spawn.z)>8).sort((a,b)=>Math.hypot(a.x-relic.x,a.z-relic.z)-Math.hypot(b.x-relic.x,b.z-relic.z))[0]||null;
 for(const o of trees){
  const canopy=o.mesh.getObjectByName('tree-canopy'),trunk=o.mesh.getObjectByName('tree-trunk');if(!canopy||!trunk)continue;
  const {shade,bank,ruin}=forestHabitatAt(world,o.x,o.z),elder=o===h.elder;
  // Keep the ground-level trunk footprint: only height and overhead foliage change.
  const height=elder?1.65:1+shade*.17-bank*.04,width=elder?1.70:1+shade*.34-ruin*.18-bank*.12,crownStretch=elder?1.32:1+shade*.12;
  trunk.scale.y*=height;canopy.position.y*=height;canopy.scale.y*=crownStretch;
  const depth=elder?1.38:width;
  canopy.scale.x*=width;canopy.scale.z*=depth;o.mesh.userData.forestHabitat=elder?'elder':bank>.5?'bank':shade>.4?'thicket':'clearing';h.trees++;
  if(elder)o.mesh.name='SM_Tree_Elder_A';
  {
   // Match the actual crown, including pre-existing ruin thinning and the tree's
   // individual lean/width. Clone once at world creation;
   // the normal ownedGeometry cleanup releases it, leaving shared templates intact.
   trunk.geometry=trunk.geometry.clone();trunk.userData.ownedGeometry=true;
   trunk.updateMatrix();canopy.updateMatrix();
   const crownTransform=new Matrix4().copy(trunk.matrix).invert().multiply(canopy.matrix),target=new Vector3(),template=canopy.userData.treeTemplate,p=trunk.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const y=p.getY(i),r=Math.hypot(p.getX(i),p.getZ(i)),weight=elder?MathUtils.smoothstep(y,.25,.7)*(1-MathUtils.smoothstep(y,2.1,3.6)):0,scale=1+weight*.8;
    const radius=Math.min(r*scale,Math.max(r,o.r*.89)),fork=MathUtils.smoothstep(y,1.8,3.3),thickness=r>1e-6?radius/r:1;
    // Inverse of treeTemplate's tipPosition: trunk template -> crown coordinates.
    // Finish the blend below every terminal twig, so low sprays also stay attached.
    target.set(p.getX(i)/2.04,(y*.8496/5-.53)*template.canopyHeight/.47,p.getZ(i)/(2.04*(.94+template.variant*.035))).applyMatrix4(crownTransform);
    p.setXYZ(i,MathUtils.lerp(p.getX(i)*thickness,target.x,fork),MathUtils.lerp(y,target.y,fork),MathUtils.lerp(p.getZ(i)*thickness,target.z,fork));
   }
   trunk.geometry.computeVertexNormals();trunk.geometry.computeBoundingBox();trunk.geometry.computeBoundingSphere();
  }
 }
 // Color only the existing owned floor vertices. This connects plant patches
 // without extra transparent ground layers or changing terrain heights.
 const ground=world.ground,p=ground?.geometry.attributes.position,color=ground?.geometry.attributes.color;
 if(ground?.userData.ownedGeometry&&color)for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=-p.getY(i);if(!inside({x,z}))continue;
  const area=forestHabitatAt(world,x,z),patch=.5+.5*Math.sin(x*.17+Math.sin(z*.11)*1.7),moss=area.shade*patch;
  color.setXYZ(i,color.getX(i)*(1-moss*.13+area.ruin*.04),color.getY(i)*(1-moss*.025),color.getZ(i)*(1+moss*.055-area.ruin*.04));
 }
 if(color)color.needsUpdate=true;
 return h;
}

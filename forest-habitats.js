import {MathUtils} from './vendor/three.module.js';

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
  const height=elder?1.65:1+shade*.17-bank*.04,width=elder?1.70:1+shade*.34-ruin*.18-bank*.12;
  trunk.scale.y*=height;canopy.position.y*=height;canopy.scale.y*=elder?1.32:1+shade*.12;
  canopy.scale.x*=width;canopy.scale.z*=width;o.mesh.userData.forestHabitat=elder?'elder':bank>.5?'bank':shade>.4?'thicket':'clearing';h.trees++;
  if(elder){
   o.mesh.name='SM_Tree_Elder_A';
   // A thick taper below the forks, not a stretched sapling. Roots and branch
   // ends keep their old positions; the lower bole stays inside the collider.
   trunk.geometry=trunk.geometry.clone();trunk.userData.ownedGeometry=true;
   const p=trunk.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const y=p.getY(i),r=Math.hypot(p.getX(i),p.getZ(i)),weight=MathUtils.smoothstep(y,.25,.7)*(1-MathUtils.smoothstep(y,2.1,3.6)),scale=1+weight*.8;
    const radius=Math.min(r*scale,Math.max(r,o.r*.89));if(r>1e-6)p.setXYZ(i,p.getX(i)*radius/r,y,p.getZ(i)*radius/r);
   }
   trunk.geometry.computeVertexNormals();trunk.geometry.computeBoundingBox();trunk.geometry.computeBoundingSphere();
  }
 }
 return h;
}

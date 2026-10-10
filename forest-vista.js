import * as T from './vendor/three.module.js';
import{mergeGeometries}from'./vendor/BufferGeometryUtils.js';
import{mesh,mat}from'./world.js?v=125';
import{naturalRockGeometry}from'./biome-scenery.js?v=125';
import{polishEnvironmentModels}from'./environment-props.js?v=125';
import{seeded,segmentDistance}from'./rules.js?v=125';

// All new pieces share the existing scene geometry/material families. Bake the
// few ruined structures into three opaque batches, with no extra lights or ticks.
const finishes={};
for(const kind of['stone','leaf','gold']){
 const material=mat(0xffffff).clone();material.vertexColors=true;material.flatShading=false;
 material.roughness=kind==='gold'?.79:.96;material.metalness=kind==='gold'?.2:0;
 if(kind==='gold'){material.emissive.setHex(0x806a35);material.emissiveIntensity=.08;}
 finishes[kind]=material;
}
// A closed, pointed leaf with a raised midrib replaces the tiny oval beads.
// Twelve triangles remain readable from above without a transparent material.
const vineLeafGeometry=(()=>{
 const g=new T.BufferGeometry(),positions=[0,0,-1,-.70,0,-.40,-.88,0,.18,0,.12,1,.88,0,.18,.70,0,-.40,0,.30,0,0,-.09,0],indices=[],colors=[];
 for(let i=0;i<6;i++){indices.push(6,i,(i+1)%6,7,(i+1)%6,i);colors.push(.90,.95,.88);}
 colors.push(1.03,1.04,.97,.68,.76,.66);
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
})();

export function installForestVista(world,mapId){
 if(world.forestVista)return world.forestVista;
 const region=world.regions?.find(r=>r.id==='forest');
 if(mapId!=='forest'&&!(mapId==='confluence'&&region))return null;
 const sites=world.sites.filter(s=>!region||s.biome==='forest'),relic=sites.find(s=>s.type==='relic');
 if(!relic)return null;
 const start=world.spawn,pathStart=region?{x:region.x,z:region.z}:start,pathAt=f=>({x:pathStart.x+(relic.x-pathStart.x)*f+Math.sin(f*Math.PI)*4,z:pathStart.z+(relic.z-pathStart.z)*f});
 const isForest=(x,z)=>!region||region.contains(x,z);
 const allowed=(x,z,pad=.6)=>{
  if(Math.abs(x)+pad>world.half-2||Math.abs(z)+pad>world.half-2||!isForest(x,z))return false;
  return !world.ponds.some(p=>{const a=p.angle||0,dx=x-p.x,dz=z-p.z;return Math.hypot((Math.cos(a)*dx-Math.sin(a)*dz)/(p.rx+pad),(Math.sin(a)*dx+Math.cos(a)*dz)/(p.rz+pad))<1.12;});
 };
 // Tall stone sleeves stay inside existing trunk footprints. Their broken
 // lintels overhang above head height, leaving the original walkable paths open.
 const candidates=world.obstacles.filter(o=>o.mesh.userData.treeBiome==='forest'&&!o.tactic&&!world.breakables?.includes(o)&&allowed(o.x,o.z,1)&&Math.hypot(o.x-start.x,o.z-start.z)>6);
 // Choose a viable pair first. A lone nearest tree must not prevent a
 // slightly farther, clearly readable gateway beside the early relic path.
 const pathSamples=Array.from({length:10},(_,i)=>pathAt(.08+i*.095));let gate=null,bestScore=Infinity;
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
  const a=candidates[i],b=candidates[j],distance=Math.hypot(a.x-b.x,a.z-b.z);if(distance<4||distance>8.5)continue;
  const x=(a.x+b.x)/2,z=(a.z+b.z)/2,fromStart=Math.hypot(x-start.x,z-start.z),pathDistance=Math.min(...pathSamples.map(p=>Math.hypot(x-p.x,z-p.z)));
  if(fromStart>36||pathDistance>22||!allowed(x,z,1.4)||world.obstacles.some(o=>o!==a&&o!==b&&Math.hypot(o.x-x,o.z-z)<o.r+1.1))continue;
  const score=pathDistance*2+fromStart*.55+Math.abs(distance-5.5)*.6;
  if(score<bestScore){bestScore=score;gate=[a,b];}
 }
 const selected=gate?[...gate]:[],focuses=gate?[relic,sites.find(s=>s.event)||relic]:[pathAt(.30),relic,sites.find(s=>s.event)||relic];
 for(const focus of focuses){
  if(selected.length>=4)break;
  const choices=candidates.filter(o=>!selected.includes(o)&&selected.every(q=>Math.hypot(q.x-o.x,q.z-o.z)>3.2)).sort((a,b)=>Math.hypot(a.x-focus.x,a.z-focus.z)-Math.hypot(b.x-focus.x,b.z-focus.z));
  const first=choices.find(o=>Math.hypot(o.x-focus.x,o.z-focus.z)<19);if(first)selected.push(first);
 }
 // Open the actual silhouette: these few trunks become bare trees threaded
 // through the old columns. Shared tree geometry stays alive for the forest.
 const removedCanopies=new Set();
 for(const o of selected){
  for(const part of [...o.mesh.children]){
   if(part.userData.treeCanopy){removedCanopies.add(part);part.removeFromParent();}
   else if(part.name==='tree-trunk'){part.scale.x*=.74;part.scale.y*=.72;part.scale.z*=.74;}
  }
  o.mesh.userData.forestVistaTrunk=true;
 }
 for(const scope of[world,...(world.regions||[])])if(scope.foliage)scope.foliage=scope.foliage.filter(f=>!removedCanopies.has(f.leaf));
 let thinnedCanopies=0;
 if(gate){
  const [a,b]=gate;
  if(Math.hypot(a.x-b.x,a.z-b.z)<8.5){
   const neighbors=candidates.filter(o=>!selected.includes(o)&&segmentDistance(o.x,o.z,a.x,a.z,b.x,b.z)<3.3).sort((p,q)=>segmentDistance(p.x,p.z,a.x,a.z,b.x,b.z)-segmentDistance(q.x,q.z,a.x,a.z,b.x,b.z)).slice(0,3);
   for(const o of neighbors)for(const canopy of o.mesh.children)if(canopy.userData.treeCanopy){canopy.scale.x*=.62;canopy.scale.z*=.62;thinnedCanopies++;}
  }
 }
 const parts={stone:new T.Group(),leaf:new T.Group(),gold:new T.Group()},rnd=seeded(Math.round((relic.x+200)*173+(relic.z+200)*971));
 let stones=0,leaves=0,arches=0,archFragments=0;
 const block=(kind,color,x,y,z,sx,sy,sz,angle=0,tilt=0)=>{const o=mesh('BoxGeometry',[1,1,1],color,x,y,z,parts[kind]);o.scale.set(sx,sy,sz);o.rotation.set(0,angle,tilt);return o;};
 const segment=(kind,color,a,b,r)=>{
  const direction=new T.Vector3().subVectors(b,a),o=mesh('CylinderGeometry',[r,r*.85,1,6],color,0,0,0,parts[kind]);
  o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=direction.length();o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());return o;
 };
 const leaf=(x,y,z,angle)=>{const o=new T.Mesh(vineLeafGeometry,mat(leaves%3===0?0x688050:0x435c42));o.position.set(x,y,z);o.rotation.set(.15+Math.sin(x*2+y)*.15,angle,-.3);o.scale.set(.19,.065,.15);parts.leaf.add(o);leaves++;};
 for(const [i,o]of selected.entries()){
  const height=i===0?3.1:i===1?2.7:1.4+i*.37,angle=Math.atan2(relic.x-o.x,relic.z-o.z),s=Math.sin(angle),c=Math.cos(angle);
  block('stone',0x66725f,o.x,.10,o.z,.88,.25,.86,angle);
  for(let row=0;row<4;row++){
   const h=height/4,lean=Math.sin(row*1.8+i)*.026;
   block('stone',row%2?0x829080:0x778473,o.x+lean,h*(row+.5),o.z,.65,h-.035,.61,angle+lean);
  }
  block('stone',0x959b80,o.x,height+.025,o.z,.83,.15,.78,angle-.045);
  // An off-centre, eroded capital rather than a perfect square cap.
  const broken=new T.Mesh(naturalRockGeometry,mat(0x819076));broken.position.set(o.x-.07,height+.16,o.z+.025);broken.scale.set(.36,.21,.31);broken.rotation.y=angle;parts.stone.add(broken);
  let previous=null;
  for(let n=0;n<9;n++){
   const y=.08+n/8*(height+.13),a=angle+n*.49,p=new T.Vector3(o.x+Math.sin(a)*.39,y,o.z+Math.cos(a)*.38);
   if(previous)segment('leaf',0x3c5038,previous,p,.038);previous=p;
   if(n%2){leaf(p.x,p.y+.025,p.z,a);leaf(p.x+Math.cos(a)*.11,p.y+.075,p.z-Math.sin(a)*.11,a+1.1);}
  }
  // Worn bronze inlay sits flush against the stone: warm focus, no neon runes.
  for(let n=0;n<3;n++)block('gold',0xa99b68,o.x+s*.322,1.05+n*.21,o.z+c*.322,.23-n*.035,.043,.022,angle,-.08+n*.05);
  for(let n=0;n<5;n++){
   const a=rnd()*Math.PI*2,r=.9+rnd()*1.1,x=o.x+Math.sin(a)*r,z=o.z+Math.cos(a)*r;if(!allowed(x,z))continue;
   const chip=new T.Mesh(naturalRockGeometry,mat(n%2?0x69775e:0x93977b));chip.position.set(x,.014,z);chip.rotation.y=a;chip.scale.set(.20+rnd()*.13,.06,.18+rnd()*.15);parts.stone.add(chip);stones++;
  }
 }
 // Two incomplete halves form the main focus. Rare maps without any valid
 // pair still get one legible cantilevered arch fragment above the clear ground.
 if(selected.length){
  const a=selected[0],b=gate?.[1],angle=Math.atan2((b||relic).x-a.x,(b||relic).z-a.z),dx=Math.sin(angle),dz=Math.cos(angle);
  const origins=b?[[a,1],[b,-1]]:[[a,1]];
  for(const [origin,side]of origins){
   archFragments++;
   for(let n=0;n<3;n++){
    const offset=.38+n*.51,peak=(origin===a?3.22:2.84)+n*.27;
    const voussoir=block('stone',n===2?0x929881:0x7e8974,origin.x+dx*offset*side,peak,origin.z+dz*offset*side,.48,.35,.69,angle,0);voussoir.rotation.x=-side*.42;
    const x=origin.x+dx*offset*side,z=origin.z+dz*offset*side;
    if(n<2)for(let j=0;j<3;j++)leaf(x+(j-1)*.15,peak+.23,z,angle+j*.7);
   }
  }
  arches=Number(!!b);
 }
 // Sparse embedded fragments accompany the existing soft path, not two rows
 // of paving tiles. Irregular clusters leave most of the earth visible.
 for(const progress of[.23,.43,.67]){
  const cluster=progress+(rnd()-.5)*.09,count=2+Math.floor(rnd()*3);
  for(let j=0;j<count;j++){
   const f=cluster+(rnd()-.5)*.055,p=pathAt(f),tangent=Math.atan2(relic.x-pathStart.x+4*Math.PI*Math.cos(f*Math.PI),relic.z-pathStart.z),offset=(rnd()-.5)*1.8;
   const x=p.x+Math.cos(tangent)*offset,z=p.z-Math.sin(tangent)*offset;
   if(!allowed(x,z)||world.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+.4)||sites.some(s=>Math.hypot(x-s.x,z-s.z)<4.7))continue;
   const stone=new T.Mesh(naturalRockGeometry,mat(j%2?0x616c56:0x58634f));stone.position.set(x,-.007,z);stone.rotation.y=tangent+rnd()*2;stone.scale.set(.18+rnd()*.21,.032,.16+rnd()*.19);parts.stone.add(stone);stones++;
  }
 }
 const group=new T.Group();group.name='forest-vista';(region?.group||world.group).add(group);
 let triangles=0;
 for(const [kind,source]of Object.entries(parts)){
  polishEnvironmentModels({group:source,obstacles:[]});source.updateMatrixWorld(true);const geometryParts=[];
  source.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone(),position=g.attributes.position,color=[];
   if(kind==='stone'&&g.type==='BoxGeometry'){
    for(let i=0;i<position.count;i++){
     const x=position.getX(i),y=position.getY(i),z=position.getZ(i),a=Math.abs(x),b=Math.abs(y),c=Math.abs(z),edge=Math.max(Math.min(a,b),Math.min(b,c),Math.min(a,c));
     const wear=1-.042*T.MathUtils.smoothstep(edge,.28,.48)*(.5+.5*Math.sin(x*9+y*7+z*11+o.position.x*.17+o.position.z*.21));position.setXYZ(i,x*wear,y*wear,z*wear);
    }
    g.computeVertexNormals();
   }
   g.applyMatrix4(o.matrixWorld);
   for(let i=0;i<position.count;i++){
    const existing=g.attributes.color,shade=new T.Color().copy(o.material.color);if(existing)shade.multiply(new T.Color().setRGB(existing.getX(i),existing.getY(i),existing.getZ(i)));
    if(kind==='stone'){
     const x=position.getX(i),y=position.getY(i),z=position.getZ(i),patch=.5+.5*Math.sin(x*2.1+z*1.7+y*.8),damp=(1-T.MathUtils.smoothstep(y,.02,1.1))*.20,lichen=Math.max(0,g.attributes.normal.getY(i))*.09*patch;
     shade.multiplyScalar(.94+patch*.06).lerp(new T.Color(0x3d5034),damp).lerp(new T.Color(0x8b9272),lichen);
    }
    color.push(shade.r,shade.g,shade.b);
   }
   g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.deleteAttribute('uv');geometryParts.push(g);
  });
  if(!geometryParts.length)continue;
  const geometry=mergeGeometries(geometryParts);for(const g of geometryParts)g.dispose();
  const batch=new T.Mesh(geometry,finishes[kind]);batch.name='forest-vista-'+kind;batch.receiveShadow=true;batch.castShadow=kind==='stone';batch.userData.ownedGeometry=true;group.add(batch);triangles+=geometry.index.count/3;
 }
 const stats={group,columns:selected.length,removedCanopies:removedCanopies.size,thinnedCanopies,arches,archFragments,gateCenter:gate?{x:(gate[0].x+gate[1].x)/2,z:(gate[0].z+gate[1].z)/2}:null,stones,leaves,drawCalls:group.children.length,triangles,anchors:selected.map(o=>({x:o.x,z:o.z,r:o.r})),pathTarget:{x:relic.x,z:relic.z}};
 world.forestVista=stats;return stats;
}

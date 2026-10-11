import * as T from './vendor/three.module.js';
import{mergeGeometries}from'./vendor/BufferGeometryUtils.js';
import{naturalRockGeometry}from'./biome-scenery.js?v=143';
import{stoneSurfaceMaterial,wornStoneBlock}from'./environment-props.js?v=143';

const templates=new Map(),finishes={
 stone:stoneSurfaceMaterial(new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.96})),
 trim:new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.79,metalness:.16}),
 lamp:new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.46,emissive:0x7c5428,emissiveIntensity:.22})
};
const kinds={snow:'frost-watch',ash:'broken-furnace',sand:'wind-carved-gate',coast:'harbor-lantern'};

// Four finite templates. Copies owned by each world are released by its existing
// cleanup; source rocks, the worn block and the three materials stay shared.
function landmarkTemplate(id){
 if(templates.has(id))return templates.get(id);
 const parts={stone:[],trim:[],lamp:[]},dummy=new T.Object3D(),tint=new T.Color();
 const piece=(color,x,y,z,sx,sy,sz,turn=0,tilt=0,kind='stone',source=wornStoneBlock)=>{
  const g=source.clone();dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,turn,tilt);dummy.updateMatrix();g.applyMatrix4(dummy.matrix);
  const p=g.attributes.position,c=g.attributes.color,colors=[];tint.setHex(color);
  g.computeBoundingBox();const low=g.boundingBox.min.y<3.2;
  for(let i=0;i<p.count;i++){
   // Clamp the whole low piece, not just its bottom vertices: an edge joining
   // a narrow base to an upper corner must not cut across the safe passage.
   const r=Math.hypot(p.getX(i),p.getZ(i));if(low&&r>.60){p.setX(i,p.getX(i)*.60/r);p.setZ(i,p.getZ(i)*.60/r);}
   const shade=c?(c.getX(i)+c.getY(i)+c.getZ(i))/3:1;colors.push(tint.r*shade,tint.g*shade,tint.b*shade);
  }
  g.computeVertexNormals();g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.deleteAttribute('uv');parts[kind].push(g);
 };
 if(id==='snow'){
  // A dark, wind-worn crag with a broad broken ice crown, not a fir trunk.
  for(const[x,y,z,sx,sy,sz]of[[0,.88,0,.72,1.2,.69],[-.06,2.0,.04,.67,1.03,.63],[.05,3.0,-.04,.71,.94,.65]])piece(0x627b80,x,y,z,sx,sy,sz,y*.11,-.04,'stone',naturalRockGeometry);
  piece(0x7c9395,-.10,3.55,0,1.9,.55,1.65,.12);
  for(const[x,y,z,sx,sy,sz]of[[-.30,4.69,.12,.82,1.45,.69],[.43,4.55,-.11,.63,1.23,.70]])piece(0x738c90,x,y,z,sx,sy,sz,.3+x,.035,'stone',naturalRockGeometry);
  for(const[x,y,z,sx,sy,sz]of[[-.32,5.53,.05,.66,.91,.59],[.48,5.30,-.10,.49,.57,.62],[-.77,4.10,.32,.31,.43,.32]])piece(0xd0dedc,x,y,z,sx,sy,sz,.4+x,-.055,'trim',naturalRockGeometry);
  piece(0xdde8e1,-.12,3.78,.06,1.93,.14,1.65,.12,0,'trim');
 }else if(id==='ash'){
  // Splayed masonry, an open furnace throat and two unequal broken flues.
  for(let row=0;row<4;row++)piece(row%2?0x66564e:0x514d49,Math.sin(row)*.03,.45+row*.83,0,1.22-row*.055,1.0,1.1-row*.04,row*.035);
  piece(0x726051,0,3.52,0,1.84,.46,1.62,.03);
  for(const side of[-1,1])piece(0x594e46,side*.65,4.24,0,.34,1.33,1.49,side*.04);
  piece(0x423d37,0,4.23,-.57,1.45,1.39,.34,.02);
  piece(0x292a29,0,3.69,.10,1.20,.09,1.07);
  piece(0x7d6350,-.08,4.88,0,1.73,.27,1.49,.025);
  piece(0x635349,-.39,5.48,-.08,.74,1.32,.81,.07,-.025);
  piece(0x514a43,.53,5.20,-.18,.38,.90,.55,-.08,.055);
  for(const y of[1.53,2.82])piece(0x8e7055,0,y,.015,1.04,.095,.99,0,0,'trim');
  for(const side of[-1,1])piece(0x916b46,side*.53,4.19,.70,.12,1.12,.09,0,0,'trim');
  piece(0xa3794a,0,4.70,.69,1.30,.12,.09,0,0,'trim');
 }else if(id==='sand'){
  // A squat eroded gate remnant: cleft upper masonry and a broken crosspiece.
  for(let row=0;row<4;row++)piece(row%2?0xb9a17d:0xa58f70,Math.sin(row*1.5)*.025,.45+row*.84,0,1.23-row*.045,1.00,1.12-row*.035,row*.025,-.015);
  piece(0xb5a07c,-.05,3.62,-.02,1.61,.71,1.06,.06);
  piece(0xc0aa83,-.40,4.51,0,.75,1.39,.91,.04,-.025);
  piece(0x9e8867,.47,4.34,-.045,.45,1.12,.82,-.06,.05);
  piece(0xcbb893,.11,5.25,0,2.29,.50,1.0,-.07,.045);
  piece(0xac9875,-.45,5.79,.015,.63,.93,.88,.05,-.085);
  for(const y of[3.96,4.22,4.48])piece(0x806e52,-.39,y,.455,.36,.055,.035,0,-.03,'trim');
 }else{
  // A continuous tapered lighthouse shell avoids the stacked pole silhouette.
  const shell=new T.LatheGeometry([[.60,.02],[.59,.28],[.55,.46],[.51,1.6],[.44,4.66],[.50,4.77]].map(([r,y])=>new T.Vector2(r,y)),16);
  piece(0x9aa89e,0,0,0,1,1,1,0,0,'stone',shell);shell.dispose();
  for(const y of[.37,3.48])piece(0x687f75,0,y,0,y>3?.93:1.14,.13,y>3?.93:1.14,0,0,'trim');
  piece(0x607772,0,4.86,0,1.30,.25,1.30,0,0,'trim');
  for(const x of[-.42,.42])for(const z of[-.42,.42])piece(0x59685f,x,5.40,z,.10,.99,.10,0,0,'trim');
  piece(0xe5c692,0,5.36,0,.37,.64,.37,0,0,'lamp');
  for(const side of[-1,1])piece(0x4e716e,side*.32,6.02,0,.77,.16,1.41,0,-side*.32,'trim');
  piece(0x7e8d7d,0,6.22,0,.13,.48,.13,0,0,'trim');
  for(const y of[1.37,2.54,3.71])piece(0x3f5352,0,y,.562-y*.023,.17,.38,.045,0,0,'trim');
 }
 const batches=[];
 for(const[kind,geometries]of Object.entries(parts))if(geometries.length){const geometry=mergeGeometries(geometries);for(const g of geometries)g.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();batches.push({kind,geometry,material:finishes[kind]});}
 templates.set(id,batches);return batches;
}

export function installExplorationLandmarks(world,mapId){
 if(world.explorationLandmarks)return world.explorationLandmarks;
 const markers=[],skips=[];world.explorationLandmarks=markers;world.explorationLandmarkSkips=skips;
 const scopes=world.regions||[{id:mapId}],protectedRoots=new Set([
  ...world.sites.map(s=>s.mesh),...(world.regions||[]).map(r=>r.beacon?.parent),
  ...(world.discoveries||[]).map(d=>d.mesh),...(world.roaming||[]).map(r=>r.mesh)
 ]),gates=new Set(world.sites.flatMap(s=>s.gates||[])),removedCanopies=new Set();
 for(const scope of scopes){
  const id=scope.id,sites=world.sites.filter(s=>(!world.regions||s.biome===id)&&(s.type==='relic'||s.event));
  if(id==='forest'){
   const elder=world.forestHabitats?.elder,anchor=world.forestVista?.anchors[0],obstacle=elder||(anchor&&world.obstacles.find(o=>o.x===anchor.x&&o.z===anchor.z));
   if(obstacle){const mesh=elder?obstacle.mesh:world.forestVista.group;mesh.updateWorldMatrix(true,true);const height=new T.Box3().setFromObject(mesh).max.y;markers.push({biome:id,x:obstacle.x,z:obstacle.z,height,kind:elder?'elder':'forest-ruins',site:world.forestHabitats?.relic||sites.find(s=>s.type==='relic'),obstacle,mesh});}
   else skips.push({biome:id,reason:'no-existing-forest-landmark'});
   continue;
  }
  if(!kinds[id]){skips.push({biome:id,reason:'unsupported-biome'});continue;}
  const candidates=world.obstacles.filter(o=>o.mesh?.parent&&o.mesh.visible&&o.r>=.60&&!o.tactic&&!world.breakables?.includes(o)&&!o.mesh.userData.fragile&&!protectedRoots.has(o.mesh)&&!gates.has(o)&&(!world.regions||o.biome===id&&scope.contains(o.x,o.z)));
  let chosen=null,best=Infinity;
  for(const obstacle of candidates)for(const site of sites){
   const distance=Math.hypot(obstacle.x-site.x,obstacle.z-site.z);if(distance>34)continue;
   const beacon=id==='coast'&&obstacle.mesh.userData.district==='beacon'&&obstacle.r>=1;
   const score=distance-(obstacle.r>=.9?40:0)-obstacle.r*10-(beacon?10:0);if(score<best){best=score;chosen={obstacle,site};}
  }
  if(!chosen){skips.push({biome:id,reason:'no-safe-root-near-site'});continue;}
  const{obstacle,site}=chosen,root=obstacle.mesh,group=new T.Group();group.name='SM_Landmark_'+id+'_A';group.userData.explorationLandmark=true;
  // Keep old owned buffers attached but hidden so the normal world cleanup can
  // dispose them. No shared source material/geometry is released here.
  for(const child of root.children){child.traverse(o=>{if(o.userData.treeCanopy)removedCanopies.add(o);});child.visible=false;}
  const width=obstacle.r/.62;group.scale.set(width,1,width);group.rotation.y=Math.atan2(site.x-obstacle.x,site.z-obstacle.z)-root.rotation.y;
  for(const part of landmarkTemplate(id)){
   const batch=new T.Mesh(part.geometry.clone(),part.material);batch.name=group.name+'_'+part.kind;batch.userData.ownedGeometry=true;batch.castShadow=batch.receiveShadow=true;
   batch.geometry.addEventListener('dispose',()=>{batch.visible=false;});group.add(batch);
  }
  root.add(group);group.updateWorldMatrix(true,true);const height=new T.Box3().setFromObject(group).max.y;obstacle.sceneryHeight=height;
  markers.push({biome:id,x:obstacle.x,z:obstacle.z,height,kind:kinds[id],site,obstacle,mesh:group});
 }
 for(const scope of[world,...(world.regions||[])])if(scope.foliage)scope.foliage=scope.foliage.filter(f=>!removedCanopies.has(f.leaf));
 return markers;
}

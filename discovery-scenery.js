import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {wornStoneBlock} from './environment-props.js?v=131';
import {naturalRockGeometry} from './biome-scenery.js?v=131';

const biomes=new Set(['forest','snow','ash','sand','coast']),templates=new Map();
const materials={
 dry:new T.MeshStandardMaterial({vertexColors:true,roughness:.93,side:T.DoubleSide}),
 metal:new T.MeshStandardMaterial({vertexColors:true,roughness:.68,metalness:.26,side:T.DoubleSide})
};

function build(biome,variant){
 const parts={dry:[],metal:[]},matrix=new T.Matrix4(),object=new T.Object3D(),features=[];
 const add=(geometry,color,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],kind='dry')=>{
  if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
  object.position.set(...position);object.scale.set(...scale);object.rotation.set(...rotation);object.updateMatrix();matrix.copy(object.matrix);geometry.applyMatrix4(matrix);
  const p=geometry.attributes.position,old=geometry.attributes.color,tint=new T.Color(color),colors=[];
  for(let i=0;i<p.count;i++){
   const shade=.93+.05*Math.sin(p.getX(i)*7.1+p.getZ(i)*5.3+p.getY(i)*4.2);
   colors.push(tint.r*shade*(old?.getX(i)??1),tint.g*shade*(old?.getY(i)??1),tint.b*shade*(old?.getZ(i)??1));
  }
  geometry.deleteAttribute('uv');geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));parts[kind].push(geometry);
 };
 const box=(color,x,y,z,sx,sy,sz,angle=0,kind='dry')=>add(wornStoneBlock.clone(),color,[x,y,z],[sx,sy,sz],[0,angle,0],kind);
 const stone=(color,x,y,z,sx,sy,sz,angle=0)=>add(naturalRockGeometry.clone(),color,[x,y,z],[sx,sy,sz],[0,angle,0]);
 const bar=(color,a,b,r,kind='dry')=>{
  const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from),g=new T.CylinderGeometry(r*.8,r,delta.length(),7);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
  add(g,color,from.add(to).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],kind);
 };
 const cloth=(color,x,y,z,width,depth,angle=0)=>{
  const p=[],indices=[];
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){
   const u=col/4,v=row/3,rag=col===4?(row%2?-.13:.035):col===0?(row%2?.025:-.06):0;
   p.push((u-.5+rag)*width,y+.025+Math.sin(u*Math.PI*3+v*.6)*.022+Math.sin(v*Math.PI)*.045,(v-.5)*depth+(col%2?-.035:.02));
   if(row<3&&col<4){const n=row*5+col;indices.push(n,n+5,n+1,n+1,n+5,n+6);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();add(g,color,[x,0,z],[1,1,1],[0,angle,0]);
 };
 const branch=(x,z,length,angle,color=0x76614c)=>{
  const at=(u,y,v)=>[x+Math.cos(angle)*u+Math.sin(angle)*v,y,z-Math.sin(angle)*u+Math.cos(angle)*v];
  const a=at(-length*.5,.075,0),b=at(0,.13,.04),c=at(length*.5,.09,-.03);bar(color,a,b,.070);bar(color,b,c,.045);
  bar(color,b,at(length*.15,.10,.33),.027);bar(0x9f8b68,c,at(length*.46,.09,-.025),.044);
 };
 const herbs=(x,y,z,scale=1)=>{
  for(let i=0;i<6;i++){
   const p=[0,0,0,-.052,.10,.045,0,.24,.16,.045,.11,.052],g=new T.BufferGeometry();
   g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
   add(g,i%2?0x608052:0x8a9c68,[x,y,z],[scale,scale,scale],[0,i*2.4,.12]);
  }
 };
 const basket=(x,z,scale=1)=>{
  const profile=[[0,0],[.20,0],[.25,.05],[.30,.30],[.28,.34],[.25,.30],[.21,.07],[0,.05]].map(p=>new T.Vector2(...p));
  add(new T.LatheGeometry(profile,14),0xa28b60,[x,.015,z],[scale,scale,scale]);
  for(const y of [.10,.21,.315])add(new T.TorusGeometry(.215+y*.20,.013,4,14),0x6c5940,[x,.015+y*scale,z],[scale,scale,scale],[Math.PI/2,0,0]);
  add(new T.TorusGeometry(.24,.016,5,14,Math.PI),0x8b754e,[x,.30*scale,z],[scale,scale,scale]);
  herbs(x,.30*scale,z,.9*scale);
 };
 const jar=(x,z,scale=1,broken=false)=>{
  const profile=[[0,0],[.16,.0],[.28,.12],[.30,.25],[.22,.38],[.15,.43],[.16,.48],[.12,.48],[.12,.43],[.19,.37],[.26,.24],[.235,.13],[.13,.04],[0,.04]].map(p=>new T.Vector2(...p));
  const g=new T.LatheGeometry(profile,14,.25,broken?Math.PI*1.54:Math.PI*2),p=g.attributes.position;
  for(let i=0;i<p.count;i++)if(p.getY(i)>.35)p.setY(i,p.getY(i)+Math.sin(Math.atan2(p.getZ(i),p.getX(i))*5)*.018);
  g.computeVertexNormals();add(g,broken?0xa77b56:0xb48d64,[x,.015,z],[scale,scale,scale]);
 };
 const crate=(x,z,scale=1)=>{
  const b=(c,dx,y,dz,sx,sy,sz)=>box(c,x+dx*scale,y*scale+.01,z+dz*scale,sx*scale,sy*scale,sz*scale);
  b(0x66584a,0,.06,0,.68,.09,.55);
  for(const side of [-1,1])for(let row=0;row<3;row++){b(row%2?0x8d7b5b:0x76614c,0,.13+row*.115,side*.25,.69,.085,.055);if(row!==2||side<0)b(0x806e54,side*.315,.13+row*.115,0,.06,.085,.51);}
  for(const sx of [-1,1])for(const sz of [-1,1])b(0x9a8763,sx*.315,.225,sz*.24,.052,.42,.052);
 };
 const sled=(x,z,scale=1)=>{
  const at=(u,y,v)=>[x+u*scale,y*scale+.015,z+v*scale];
  for(const side of [-1,1]){
   const runner=[[-1,.22,side*.34],[-.83,.065,side*.34],[.84,.065,side*.34],[1.05,.16,side*.34]];
   for(let i=1;i<runner.length;i++)bar(0x837b64,at(...runner[i-1]),at(...runner[i]),.041*scale);
  }
  for(let i=0;i<5;i++)box(i%2?0x8e8065:0x766c55,x+(-.63+i*.32)*scale,.19*scale+.015,z,.23*scale,.07*scale,.71*scale);
  cloth(0x8b6655,x-.16*scale,.22*scale,z,1.05*scale,.64*scale,.08);
  bar(0x5e696a,at(-.6,.12,.20),at(.55,.38,.15),.015*scale,'metal');
 };
 const pick=(x,z,scale=1)=>{
  bar(0x856b4e,[x-.35*scale,.085,z+.16*scale],[x+.35*scale,.10,z-.16*scale],.029*scale);
  const a=[x+.23*scale,.14,z-.34*scale],b=[x+.35*scale,.13,z-.16*scale],c=[x+.58*scale,.055,z+.02*scale];
  bar(0x727878,a,b,.043*scale,'metal');bar(0x515a59,b,c,.035*scale,'metal');
 };
 const wheel=(x,y,z,r=.12)=>{
  add(new T.CylinderGeometry(r,r,.055,12),0x3e4442,[x,y,z],[1,1,1],[Math.PI/2,0,0],'metal');
  add(new T.CylinderGeometry(r*.38,r*.38,.067,8),0x8a8470,[x,y,z],[1,1,1],[Math.PI/2,0,0],'metal');
 };
 const cart=(x,z)=>{
  for(const dx of [-.28,.28])for(const dz of [-.29,.29])wheel(x+dx,.125,z+dz);
  box(0x514c43,x,.22,z,.78,.075,.58);
  for(const side of [-1,1]){box(0x7c7060,x,.36,z+side*.25,.80,.26,.065);box(0x645f52,x+side*.38,.35,z,.065,.25,.52);}
  for(let i=0;i<5;i++)stone(i%2?0x78665c:0x544d4a,x+Math.sin(i*2.4)*.21,.37,z+Math.cos(i*2.4)*.15,.16,.13,.13,i);
  bar(0x5d645e,[x+.42,.20,z-.13],[x+.91,.13,z-.13],.025,'metal');bar(0x5d645e,[x+.42,.20,z+.13],[x+.91,.13,z+.13],.025,'metal');
 };
 const rib=(x,z,width=1)=>{
  for(const side of [-1,1]){
   const path=[[0,.09,0],[0,.16,side*.20*width],[.015,.33,side*.38*width],[.08,.48,side*.46*width]];
   for(let i=1;i<path.length;i++)bar(0x8c8670,path[i-1].map((v,j)=>v+(j===0?x:j===2?z:0)),path[i].map((v,j)=>v+(j===0?x:j===2?z:0)),.035);
  }
 };

 if(variant==='cache'){
  if(biome==='forest'){features.push('herbalist-baskets','fallen-branch');basket(-1.1,-.65);basket(-1.57,.12,.73);branch(.08,1.30,2.15,.12);cloth(0x748368,1.2,.035,-.62,.66,.48,-.4);}
  else if(biome==='snow'){features.push('torn-expedition-sled');sled(0,1.32);stone(0xc9d8d6,-1.1,.06,1.2,.36,.085,.34);cloth(0x697a80,-1.23,.035,-.58,.72,.48,.3);}
  else if(biome==='ash'){features.push('abandoned-ore-cart','miners-pick');cart(-1.27,-.85);pick(1.18,.75,1.2);stone(0x835e46,.72,.06,1.15,.22,.09,.21);}
  else if(biome==='sand'){features.push('torn-caravan-cloth','shattered-jars');cloth(0x9e7a56,0,.015,1.26,1.85,.67,-.10);jar(-1.23,-.64);jar(1.22,-.60,.74,true);for(let i=0;i<3;i++)stone(0xb08b61,1.2+i*.17,.035,.22+i*.14,.11,.038,.16,i);}
  else{features.push('wreck-ribs','salvage-crate','driftwood');branch(0,1.38,2.1,0,0x938c72);for(const x of [-.62,0,.62])rib(x,1.38,.83);crate(1.25,-.68);branch(-1.21,-.48,.9,.70,0x96927b);}
 }else{
  // Each fragment sits beside its clue, leaving all three .65m node disks open.
  features.push('three-scattered-fragments');
  if(biome==='forest'){features.push('herb-gathering-trail');basket(-2.4,-.96,.65);herbs(.06,.02,2.38,1.2);cloth(0x829267,0,.015,2.35,.64,.42);branch(2.4,-1.0,.91,.12);}
  else if(biome==='snow'){features.push('lost-sled-pieces');sled(-2.4,-1.0,.46);cloth(0x986d56,0,.018,2.4,.73,.45,-.2);bar(0x897e65,[1.9,.075,-1.0],[2.8,.09,-.96],.045);bar(0x69767a,[2.6,.09,-1.0],[2.75,.21,-1.0],.035,'metal');}
  else if(biome==='ash'){features.push('mining-debris-trail');pick(-2.4,-1.03,.63);for(let i=0;i<3;i++)stone(i%2?0x916f4c:0x645d51,Math.sin(i*2.4)*.16,.105,2.40+Math.cos(i*2.4)*.12,.20,.11,.16,i);wheel(2.4,.23,-1.0,.22);}
  else if(biome==='sand'){features.push('caravan-fragments');for(let i=0;i<3;i++)stone(0xac8158,-2.4+(i-1)*.18,.045,-1.0+(i%2)*.06,.12,.055,.19,i);cloth(0xae8b61,0,.015,2.4,.74,.46,.1);jar(2.4,-1.02,.68,true);}
  else{features.push('wreck-fragments');rib(-2.4,-1.1,.64);branch(0,2.42,.85,.05,0x9b977e);crate(2.4,-1.05,.65);}
 }
 const geometries={};
 for(const [kind,pieces]of Object.entries(parts))if(pieces.length){const geometry=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries[kind]=geometry;}
 return{geometries,features};
}

/** Shared static scenery: remove each returned group with its discovery, but do
 * not dispose its cached geometry/materials during ordinary world cleanup.
 */
export function createDiscoveryScenery(biome,variant='cache'){
 if(!biomes.has(biome))biome='forest';if(variant!=='trail')variant='cache';
 const key=biome+':'+variant;if(!templates.has(key))templates.set(key,build(biome,variant));
 const template=templates.get(key),group=new T.Group();group.name='discovery-scenery-'+biome+'-'+variant;
 group.userData={discoveryScenery:true,biome,variant,features:[...template.features]};
 for(const [kind,geometry]of Object.entries(template.geometries)){const mesh=new T.Mesh(geometry,materials[kind]);mesh.name=group.name+'-'+kind;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
 return group;
}

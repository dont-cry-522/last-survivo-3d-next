import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installBiomePlaces} from '../biome-places.js?v=196';
import {installEnvironmentClusters} from '../environment-clusters.js?v=196';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const create=id=>{const w=buildWorld(id,7);installForestVista(w,id);installForestHabitats(w,id);installBiomePlaces(w,id);return{w,s:installEnvironmentClusters(w,id)};};
const clean=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});

test('mineral model changes preserve v188 placement, scale, collision height and radius exactly',()=>{
 const before={"forest":"dc8b59a9ea40d701ee0b4bb95417e8e369c517376558a022ee2fb7d17e35b639","snow":"4f59d2508bf032a096f2ceab0d1bbbc9ca6943a1202ba36a869ec8bd2a9b6ab8","ash":"ae80cadbf5174aac0edeaf51b372fa0684ebe0ce9d6a533eab2247f58c412b41","sand":"a609bc7b0397a1639b075c1369e9afed9082121a0d45352c225c969c190e2f0c","coast":"877bbb375bd4a1acb31613942f6d51ac5e4623e1c580466e0a7ef5ab213b4aaa","confluence":"0b165c40d1c0de71076bb19ac0b603cfb0256d1f2435e10538909edfa41ee385"};
 for(const [id,expected]of Object.entries(before)){
  const{w,s}=create(id),records=s.records.map(({obstacle,...r})=>r);
  assert.equal(createHash('sha256').update(JSON.stringify(records)).digest('hex'),expected,id+' moved scenery or changed collision');
  for(const mesh of s.group.children.filter(o=>o.isInstancedMesh)){
   const [,biome,variant]=mesh.name.match(/^SM_Cluster_(\w+)_(\d)_/),r=s.records.find(r=>r.biome===biome&&r.variant===Number(variant)),p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i++){assert(Math.hypot(p.getX(i),p.getZ(i))<r.footprint/r.scale);assert(p.getY(i)<=r.height/r.scale+.000001);}
  }
  assert(s.triangles<40000);clean(w);
 }
});

test('snow is a thin conforming covering on the exposed fractured rock, not a floating oval cap',()=>{
 const{w,s}=create('snow');
 for(const variant of[0,1]){
  const stone=s.group.getObjectByName('SM_Cluster_snow_'+variant+'_2').geometry.attributes.position,snow=s.group.getObjectByName('SM_Cluster_snow_'+variant+'_3').geometry.attributes.position;
  assert(snow.count>200&&snow.count<500);
  for(let i=0;i<snow.count;i++){
   let gap=Infinity;for(let j=0;j<stone.count;j++)if(Math.hypot(snow.getX(i)-stone.getX(j),snow.getZ(i)-stone.getZ(j))<.000001&&snow.getY(i)>stone.getY(j))gap=Math.min(gap,snow.getY(i)-stone.getY(j));
   assert(gap>.007&&gap<.023,'snow does not follow the supporting rock within 7–23 mm');
  }
 }
 assert(s.triangles<1760*14,'snow detail increased the original triangle count');clean(w);
});

test('ash uses broad oblique fracture faces while retaining the original triangle budget',()=>{
 const{w,s}=create('ash'),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(const variant of[0,1]){
  const g=s.group.getObjectByName('SM_Cluster_ash_'+variant+'_0').geometry,p=g.attributes.position,index=g.index,faces=new Map();
  assert.equal(index.count/3,360);
  for(let i=0;i<index.count;i+=3){
   a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));
   const n=new T.Vector3().crossVectors(b.sub(a),c.sub(a)).normalize();if(n.y<.65)continue;
   const key=n.toArray().map(v=>Math.round(v*1000)).join(',');faces.set(key,(faces.get(key)||0)+1);
  }
  assert([...faces.values()].filter(n=>n>=4).length>=3,'ash stones returned to rounded potato silhouettes');
 }
 assert.equal(s.triangles,540*14);clean(w);
});

test('sandstone is one closed outcrop with a broad tilted crown rather than stacked blocks or a stepped cone',()=>{
 const{w,s}=create('sand');
 for(const variant of[0,1]){
  const g=s.group.getObjectByName('SM_Cluster_sand_'+variant+'_0').geometry,p=g.attributes.position,index=g.index,edges=new Map(),adjacent=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');
  // The last two 120-triangle pieces are separate scree. Inspect the main outcrop.
  const end=index.count-2*120*3;assert(end>600&&end<4*108*3);
  const crown=new T.Box3();for(let i=end-16*3;i<end;i++)crown.expandByPoint(new T.Vector3().fromBufferAttribute(p,index.getX(i)));
  assert(crown.max.y>=1.48&&crown.min.y<.72,'one shoulder must stay high while the opposite edge slopes down');
  assert(crown.max.x-crown.min.x>1.8&&crown.max.z-crown.min.z>1.1,'the fracture crown narrowed into a cone');
  for(let i=0;i<end;i+=3)for(let j=0;j<3;j++){
   const a=key(index.getX(i+j)),b=key(index.getX(i+(j+1)%3)),edge=[a,b].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);
   if(!adjacent.has(a))adjacent.set(a,new Set());adjacent.get(a).add(b);
  }
  assert([...edges.values()].every(n=>n===2),'erosion opened a hole in the bedrock');
  const seen=new Set(),queue=[adjacent.keys().next().value];while(queue.length){const v=queue.pop();if(seen.has(v))continue;seen.add(v);queue.push(...adjacent.get(v));}
  assert.equal(seen.size,adjacent.size,'the ledges are separate floating blocks');
 }
 assert(s.triangles<672*14,'outcrop detail increased the original triangle count');clean(w);
});

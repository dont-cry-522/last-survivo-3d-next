import test from'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import * as T from'../vendor/three.module.js';
import{buildWoodlandPlace}from'../woodland-places.js?v=203';

const collisionHashes={
 forest:['3baae8f962f742d3a6b8f56bb6a6ddafec11ac5f5a9ceccb22cf18691555f74e','785ccf9b55f54d3514f27d4f9e3c0a6e95dd8623d6d3d5d303700c3081297dc5'],
 snow:['fd1f0c9dc28d4df45f017784c201f42db336a0e2e0b8b51a508534b5375ffccc','c0a1576c76800a39c7ffcd03976c7e15d27d6d68bffa1b63ca85b51d701c2609'],
};

for(const biome of['forest','snow'])for(let variant=0;variant<2;variant++)test(`${biome} place ${variant}: close detail preserves collision, passage and batch budgets`,()=>{
 const solids=[],pieces=[];
 buildWoodlandPlace(biome,{piece:(category,geometry,color,transform={})=>pieces.push({category,geometry,transform}),solid:(...values)=>solids.push(values)},variant);
 try{
  // Baseline collision includes heights used for jumping and camera clearance.
  assert.equal(createHash('sha256').update(JSON.stringify(solids)).digest('hex'),collisionHashes[biome][variant]);
  assert.equal(pieces.length,biome==='forest'?156:variant?58:51);
  assert.equal(new Set(pieces.map(p=>p.category)).size,4);
  assert(pieces.reduce((sum,p)=>sum+p.geometry.index.count/3,0)<(biome==='forest'?16000:6500));
  for(const{geometry:g,transform:t}of pieces){
   const p=g.attributes.position;assert([...p.array,...g.attributes.normal.array].every(Number.isFinite));
   if(g.name==='SM_Woodland_WornPlank_A'){
    const{width,height,depth}=g.parameters;
    for(let i=0;i<p.count;i++)assert(Math.abs(p.getX(i))<=width/2+1e-6&&Math.abs(p.getY(i))<=height/2+1e-6&&Math.abs(p.getZ(i))<=depth/2+1e-6,'weathering enlarged a plank');
   }
   if(g.name==='SM_Forest_FoldedCanvas_A'){
    g.computeBoundingBox();assert(g.boundingBox.max.y*t.sy+t.y<.60,'folded canvas exceeds the original low collider');
   }
   if(g.name==='SM_Snow_SledDrift_A'){
    g.computeBoundingBox();assert(g.boundingBox.min.y<0&&g.boundingBox.min.y>-.04,'snow must feather into soil');assert(g.boundingBox.max.y<.45,'snow rises beyond the sled deck');
    let upward=0;for(let i=0;i<p.count;i++)if(g.attributes.normal.getY(i)>.25)upward++;assert(upward>p.count*.75,'drift top normals face away from the light');
    for(let i=0;i<p.count;i++)assert(Math.abs(t.x+p.getX(i)*Math.cos(t.ry||0)+p.getZ(i)*Math.sin(t.ry||0))>3.1,'new snow invades the central passage');
   }
  }
 }finally{for(const p of pieces)p.geometry.dispose();}
});

test('thin ridge ice follows actual rock triangles instead of floating rounded stones',()=>{
 const material=new T.MeshBasicMaterial({side:T.DoubleSide}),ray=new T.Raycaster(),point=new T.Vector3(),vertex=new T.Vector3();
 try{for(const variant of[0,1]){
  const pieces=[];buildWoodlandPlace('snow',{piece:(category,geometry)=>pieces.push(geometry),solid(){}},variant);
  try{
   const rocks=pieces.filter(g=>g.name==='SM_Snow_RockRidge_A').map(g=>new T.Mesh(g,material));rocks.forEach(m=>m.updateMatrixWorld(true));
   const ice=pieces.filter(g=>g.name.startsWith('SM_Snow_RidgeIce'));assert.equal(ice.length,32);
   for(const g of ice)for(let i=0;i<g.index.count;i+=3){
    point.set(0,0,0);for(let j=0;j<3;j++)point.add(vertex.fromBufferAttribute(g.attributes.position,g.index.getX(i+j)).multiplyScalar(1/3));
    const iceY=point.y;point.y=10;ray.set(point,new T.Vector3(0,-1,0));const hit=ray.intersectObjects(rocks,false)[0];assert(hit,'ice no longer sits over a real ridge');
    assert(iceY-hit.point.y>.007&&iceY-hit.point.y<.015,'ice is embedded or detached from the visible rock triangles');
   }
  }finally{for(const g of pieces)g.dispose();}
 }}finally{material.dispose();}
});

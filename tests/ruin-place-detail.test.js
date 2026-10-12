import test from'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{buildRuinPlace}from'../ruin-places.js?v=164';

function collect(id,variant){
 const pieces=[],solids=[],info=buildRuinPlace(id,{piece(category,geometry,color,transform={}){pieces.push({category,geometry,color,transform});},solid(...data){solids.push(['sphere',...data]);},solidBox(...data){solids.push(['box',...data]);}},variant);
 return{pieces,solids,info,dispose(){for(const p of pieces)p.geometry.dispose();}};
}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const collisionBaselines={ash:['9f49a14ec4f174f7e71105751f67f73d4c002c0a7a3e2f961388531d7ce82849','1661203b16533d20b152b9c756fdc288d1cf5d827e13ac31816ebd82aa3574db'],sand:['7370ea9d7d60b1e9660a835ccbc01a0b4aa8542a58e1c45998429f6f9cc44938','b26eadaf771f8232a95edd9286474a5dc230a5337340baa5738a872870b47e6c']};

test('masonry relief preserves broken silhouettes, ground clearance and the original physical footprints',()=>{
 for(const id of['ash','sand'])for(const variant of[0,1]){
  const scene=collect(id,variant),walls=scene.pieces.filter(p=>p.geometry.userData.ruinWall);assert(walls.length>=4);assert.equal(digest(scene.solids),collisionBaselines[id][variant],'visual stone courses changed gameplay colliders');
  let triangles=0;for(const{geometry:g}of scene.pieces){triangles+=(g.index?.count??g.attributes.position.count)/3;assert(g.attributes.position.array.every(Number.isFinite));assert(g.attributes.normal.array.every(Number.isFinite));if(g.userData.ruinGroundLayer){assert(Math.max(...Array.from({length:g.attributes.position.count},(_,i)=>g.attributes.position.getY(i)))<=g.userData.ruinGroundLayer.ceiling+1e-7);}}
  assert(triangles<17000,id+' close-up pass exceeded its template budget');
  for(const{geometry:g}of walls){
   const{profile,depth}=g.userData.ruinWall,p=g.attributes.position,n=g.attributes.normal;let angledFaces=0;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),segment=profile.findIndex((q,j)=>j&&x<=q[0]+1e-6),a=profile[Math.max(1,segment)-1],b=profile[Math.max(1,segment)],height=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
    assert(x>=profile[0][0]-1e-6&&x<=profile.at(-1)[0]+1e-6);assert(y>=-.100001&&y<=height+1e-6,'stone bevel enlarged the broken crown');assert(Math.abs(z)<=depth*.5+.035+1e-6,'stone lip enlarged the original wall envelope');
    if(Math.abs(n.getZ(i))>.15&&Math.abs(n.getZ(i))<.9)angledFaces++;
   }
   assert(angledFaces>30,'stone seams became a color-only flat sheet');assert(g.index.count/3<1700);
  }
  const roofs=scene.pieces.filter(p=>p.transform.overhead).map(p=>[Array.from(p.geometry.attributes.position.array),p.transform]);if(id==='ash'&&variant===0)assert.equal(digest(roofs),'3e85188041b996ebe6120ce87d88336862067da66a357580852bcca7cfb1d92b','close-up polish changed kiln head clearance');else assert.equal(roofs.length,0);
  scene.dispose();
 }
});

test('broken pottery has closed material thickness, an uneven rim and bounded finite geometry',()=>{
 for(const variant of[0,1]){
  const scene=collect('sand',variant),pots=scene.pieces.filter(p=>p.geometry.userData.ruinPot);assert.equal(pots.length,4);
  for(const{geometry:g}of pots){
   const p=g.attributes.position,{size,height}=g.userData.ruinPot,keys=[],edges=new Map(),rim=[];
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert(Math.hypot(x,z)<size*.541);assert(y>=-1e-7&&y<=size*height+1e-7);keys.push([x,y,z].map(n=>n.toFixed(6)).join(','));if(y>size*(height-.05))rim.push(y);
   }
   for(let i=0;i<g.index.count;i+=3){const[a,b,c]=[0,1,2].map(j=>keys[g.index.getX(i+j)]);if(new Set([a,b,c]).size<3)continue;for(const[x,y]of[[a,b],[b,c],[c,a]]){const key=[x,y].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}}
   assert(edges.size>200);assert([...edges.values()].every(n=>n===2),'a cut edge is still an open single sheet');assert(Math.max(...rim)-Math.min(...rim)>.01*size,'the broken rim became a level ring');assert(g.index.count/3<=460);assert(g.attributes.normal.array.every(Number.isFinite));
  }
  scene.dispose();
 }
});

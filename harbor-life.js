import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {batchedSurfaceMaterial,prepareBatchedSurface} from './environment-props.js?v=189';
import {waterDepth} from './water.js?v=189';
import {bridgeContains} from './coast.js?v=189';

// Small working craft belong to actual piers, not arbitrary dry-ground scatters.
// Keep the deck, its end approach and the other side open for travel/swimming.
const HALF_LENGTH=2.45,HALF_BEAM=.92;
const boatSolids=[{z:-2.1,r:.55},{z:-1.4,r:.82},{z:-.7,r:.99},{z:0,r:1.03},{z:.7,r:.99},{z:1.4,r:.82},{z:2.1,r:.55}];
const beam=t=>.115+(HALF_BEAM-.115)*Math.max(0,1-t*t)**.62;
// Selection uses a conservative boat envelope; movement/support follows the
// actual sides, seats and floor instead of filling its open interior to rim height.
const collisionProfile=[
 ...[-1,1].flatMap(side=>Array.from({length:13},(_,i)=>{const t=-1+i/6;return{x:side*beam(t)*.97,z:t*HALF_LENGTH,r:.28,height:Math.min(.845,.635+.25*t*t),part:'hull'};})),
 ...[-2.1,-1.4,-.7,0,.7,1.4,2.1].map(z=>({x:0,z,r:beam(z/HALF_LENGTH)*.76,height:.1875,part:'floor'})),
 ...[-.94,.88].flatMap(z=>[-.46,0,.46].map(x=>({x,z,r:.28,height:.491,part:'seat'})))
];
const materials=new Map();let template;
const at=(place,x,z)=>({x:place.x+Math.cos(place.angle)*x+Math.sin(place.angle)*z,z:place.z-Math.sin(place.angle)*x+Math.cos(place.angle)*z});
function finish(kind){
 if(!materials.has(kind)){
  const source=new T.MeshStandardMaterial({vertexColors:true,roughness:kind==='wood'?.87:.98,side:T.DoubleSide});
  const material=batchedSurfaceMaterial(source,kind);if(material!==source)source.dispose();
  material.name='M_Harbor_Workboat_'+kind;materials.set(kind,material);
 }
 return materials.get(kind);
}
function builder(){
 const parts={wood:[],cloth:[]},dummy=new T.Object3D(),tint=new T.Color();
 return{parts,add(kind,g,color,{x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}={}){
  prepareBatchedSurface(g,kind,{sx,sy,sz});dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();g.applyMatrix4(dummy.matrix);
  tint.setHex(color);const colors=[],p=g.attributes.position;
  for(let i=0;i<p.count;i++){const weather=.92+.05*Math.sin(p.getZ(i)*7.4+p.getX(i)*3.1),damp=kind==='wood'?.16*(1-T.MathUtils.smoothstep(p.getY(i),-.02,.27)):0,shade=weather-damp;colors.push(tint.r*shade,tint.g*shade,tint.b*shade);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  for(const key of Object.keys(g.attributes))if(!['position','normal','color','surfaceCoord','surfaceKind'].includes(key))g.deleteAttribute(key);
  if(!g.index)g.setIndex(Array.from({length:p.count},(_,i)=>i));parts[kind].push(g);
 },merge(kind){const list=parts[kind],g=mergeGeometries(list);for(const part of list)part.dispose();g.computeBoundingBox();g.computeBoundingSphere();return g;}};
}
function line(kit,kind,points,color,r=.025){
 const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
 kit.add(kind,new T.TubeGeometry(path,Math.max(4,points.length-1),r,4,false),color);
}
function skiffTemplate(){
 if(template)return template;
 const kit=builder(),wood=0x918570,dark=0x4b6765,cut=0xaaa18a,rope=0x9e9d82;
 const hull=(t,u,side,inner=false)=>[side*(beam(t)*(.10+.90*Math.sin(u*Math.PI/2))-(inner?.045:0)), -.23+.77*u**1.35+.25*t*t*u+(inner?.025:0),t*HALF_LENGTH];
 // Continuous thin hull with a rolled gunwale and real interior, not a solid tub.
 for(const side of [-1,1]){
  const positions=[],indices=[],steps=24,rows=5,layer=(steps+1)*rows;
  for(const inner of [false,true])for(let j=0;j<=steps;j++)for(let i=0;i<rows;i++)positions.push(...hull(-1+2*j/steps,i/(rows-1),side,inner));
  const face=(a,b,c,reverse=false)=>{if(reverse)indices.push(a,c,b);else indices.push(a,b,c);};
  for(let skin=0;skin<2;skin++)for(let j=0;j<steps;j++)for(let i=0;i<rows-1;i++){
   const n=skin*layer+j*rows+i,reverse=(side<0)!==!!skin;
   face(n,n+1,n+rows,reverse);face(n+1,n+rows+1,n+rows,reverse);
  }
  for(let j=0;j<steps;j++)for(const i of [0,rows-1]){
   const a=j*rows+i,b=a+rows,reverse=(i===0)!==(side<0);
   face(a,b,a+layer,reverse);face(b,b+layer,a+layer,reverse);
  }
  for(const j of [0,steps])for(let i=0;i<rows-1;i++){
   const a=j*rows+i,reverse=(j===0)!==(side<0);
   face(a,a+layer,a+1,reverse);face(a+1,a+layer,a+layer+1,reverse);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();kit.add('wood',g,dark);
  line(kit,'wood',Array.from({length:25},(_,i)=>hull(-1+i/12,1,side)),cut,.040);
  // A slender pale strake follows the same hull instead of a painted box edge.
  line(kit,'wood',Array.from({length:17},(_,i)=>hull(-1+i/8,.76,side)),0x697d76,.016);
 }
 // The bottom boards sit above the existing water plane, avoiding water inside.
 for(let i=0;i<15;i++){
  const z=-2.05+i*.293,w=beam(z/HALF_LENGTH)*1.46;
  kit.add('wood',new T.BoxGeometry(w,.055,.274),i%3?wood:0x746f5b,{y:.16,z});
 }
 for(const z of [-1.6,-.65,.65,1.6])for(const side of [-1,1]){
  const t=z/HALF_LENGTH;line(kit,'wood',[.22,.44,.7,.96].map(u=>{const p=hull(t,u,side,true);p[0]-=side*.022;return p;}),cut,.029);
 }
 for(const z of [-.94,.88]){
  const width=beam(z/HALF_LENGTH)*1.78;
  kit.add('wood',new T.BoxGeometry(width,.072,.32),cut,{y:.455,z});
  for(const side of [-1,1])kit.add('wood',new T.BoxGeometry(.07,.28,.21),wood,{x:side*width*.40,y:.28,z});
 }
 // Stowed oars stay within the hull; they cannot become invisible swimming walls.
 for(const side of [-1,1]){
  line(kit,'wood',[[side*.47,.2115,-1.55],[side*.55,.2115,.55]],wood,.024);
  const blade=new T.SphereGeometry(1,8,4);kit.add('wood',blade,cut,{x:side*.57,y:.2105,z:.97,sx:.11,sy:.023,sz:.45,ry:side*.02});
 }
 // One gathered fishing net crosses the forward well. Open weave and a soft
 // folded sail explain the boat's use without crates/ornaments piled everywhere.
 for(let i=0;i<8;i++){
  const x=-.56+i*.16;
  line(kit,'cloth',[[x,.57,.99],[x*.96,.39,1.39],[x*.71,.44,1.85]],0x687d70,.012);
 }
 for(let i=0;i<6;i++){
  const z=1.03+i*.16,b=beam(z/HALF_LENGTH)*.78;
  line(kit,'cloth',[[-b,.48,z],[0,.37,z+.03],[b,.48,z]],0x687d70,.012);
 }
 const p=[],indices=[];
 for(let j=0;j<=5;j++)for(let i=0;i<=12;i++){
  const u=i/12,v=j/5;p.push((u-.5)*1.25,.44+.09*Math.sin(u*Math.PI)+.018*Math.sin(u*29)*(1-v*.5),-1.60+v*.46);
  if(j<5&&i<12){const n=j*13+i;indices.push(n,n+1,n+13,n+1,n+14,n+13);}
 }
 const sail=new T.BufferGeometry();sail.setAttribute('position',new T.Float32BufferAttribute(p,3));sail.setIndex(indices);sail.computeVertexNormals();kit.add('cloth',sail,0xa4b1a5);
 for(const x of [-.43,.43])line(kit,'cloth',[[x,.46,-1.62],[x,.57,-1.38],[x,.46,-1.12]],rope,.019);
 template={wood:kit.merge('wood'),cloth:kit.merge('cloth')};
 template.wood.name='SM_Harbor_Workboat_Hull';template.cloth.name='SM_Harbor_Workboat_Net';return template;
}

function plan(world,place,region,ponds){
 const pier=place.pier;if(!pier)return null;
 const end=pier.localEndZ,spans=Math.max(1,Math.ceil((pier.localStartZ-end)/4));
 const posts=Array.from({length:spans+1},(_,i)=>pier.localStartZ+(end-pier.localStartZ)*i/spans+.12);
 for(const side of [place.index%2?-1:1,place.index%2?1:-1])for(const offset of [1.05,0,-1,-2,-3.5]){
  const x=side*3.1,z=end+offset,solids=boatSolids.map(s=>({...s,...at(place,x,z+s.z)}));
  if(solids.some(s=>Math.abs(s.x)+s.r>world.half-2||Math.abs(s.z)+s.r>world.half-2||region&&!region.contains(s.x,s.z)))continue;
  // Validate the whole silhouette against the lowest tide. Bridges/ford routes
  // keep their old clearance; neither ponds nor traversal rules are changed.
  let wet=true;
  for(let i=0;i<=10&&wet;i++)for(const dx of [-HALF_BEAM,0,HALF_BEAM]){
   const q=at(place,x+dx,z-HALF_LENGTH+i*HALF_LENGTH/5);
   if(!ponds.some(p=>waterDepth(p,q.x,q.z)>=.18)||region&&!region.contains(q.x,q.z)){wet=false;break;}
  }
  if(!wet||solids.some(s=>(world.obstacles||[]).some(o=>Math.hypot(s.x-o.x,s.z-o.z)<s.r+o.r+.14)))continue;
  if(solids.some(s=>(world.bridges||[]).some(b=>bridgeContains(b,s.x,s.z,s.r+.15))||(world.fords||[]).some(f=>bridgeContains({x:f.x,z:f.z,angle:f.angle,width:f.half*2,length:f.width},s.x,s.z,s.r+.7))))continue;
  const clearings=[{...world.spawn,r:7},...(world.sites||[]).map(s=>({...s,r:s.event?8:4.5})),...(world.discoveries||[]).map(d=>({...d,r:4}))];
  if(solids.some(s=>clearings.some(c=>Math.hypot(s.x-c.x,s.z-c.z)<s.r+c.r)||(world.road||[]).some(p=>Math.hypot(s.x-p.x,s.z-p.z)<s.r+5.8)))continue;
  const ties=[-1.65,1.65].map(dz=>{
   const boat={x:x-side*.70,y:.67,z:z+dz},pz=posts.reduce((best,p)=>Math.abs(p-boat.z)<Math.abs(best-boat.z)?p:best,posts[0]);
   return{boat,post:{x:side*1.55,y:.91,z:pz}};
  });
  return{x,z,side,solids,ties};
 }
 return null;
}

export function installHarborLife(world,mapId){
 if(world.harborLife)return world.harborLife;
 if(mapId!=='coast'&&mapId!=='confluence')return null;
 const region=world.regions?.find(r=>r.id==='coast');
 const ponds=(world.ponds||[]).filter(p=>p.biome==='coast').map(p=>{const rx=p.baseRx??p.rx,rz=p.baseRz??p.rz;return{...p,rx,rz,r:Math.max(rx,rz)*1.12};});
 const group=new T.Group();group.name='SM_Harbor_WorkingBerths';const records=[];
 for(const place of (world.biomePlaces||[]).filter(p=>p.biome==='coast'&&p.pier).slice(0,2)){
  const placement=plan(world,place,region,ponds);if(!placement)continue;
  const boat=new T.Group();boat.name='SM_Harbor_MooredSkiff_'+place.index;boat.position.set(place.x,0,place.z);boat.rotation.y=place.angle;group.add(boat);
  const source=skiffTemplate(),cloth=builder(),translation=new T.Matrix4().makeTranslation(placement.x,0,placement.z);
  const hull=new T.Mesh(source.wood,finish('wood'));hull.position.set(placement.x,0,placement.z);hull.castShadow=hull.receiveShadow=true;hull.name='SM_Harbor_Workboat_Hull';boat.add(hull);
  const cargo=source.cloth.clone().applyMatrix4(translation);cloth.parts.cloth.push(cargo);
  for(const tie of placement.ties){
   const a=tie.boat,b=tie.post;line(cloth,'cloth',[[a.x,a.y,a.z],[(a.x+b.x)/2,Math.min(a.y,b.y)-.13,(a.z+b.z)/2],[b.x,b.y,b.z]],0x9e9d82,.025);
  }
  const fabric=new T.Mesh(cloth.merge('cloth'),finish('cloth'));fabric.name='SM_Harbor_MooringAndNet';fabric.userData.ownedGeometry=true;fabric.castShadow=fabric.receiveShadow=true;boat.add(fabric);
  const solids=collisionProfile.map(s=>{const marker=new T.Object3D(),x=placement.x+s.x,z=placement.z+s.z,q=at(place,x,z);marker.name='COL_Harbor_Workboat_'+s.part;marker.position.set(x,0,z);boat.add(marker);return{...q,r:s.r,height:s.height,sceneryHeight:s.height,mesh:marker,biome:'coast',harborLife:true,boatPart:s.part};});
  world.obstacles.push(...solids);if(region)region.obstacles.push(...solids);
  records.push({placeIndex:place.index,x:placement.x,z:placement.z,side:placement.side,angle:place.angle,origin:{x:place.x,z:place.z},ties:placement.ties,solids:solids.map(({x,z,r,height,boatPart})=>({x,z,r,height,boatPart}))});
 }
 group.userData.records=records;world.group.add(group);world.harborLife=group;return group;
}

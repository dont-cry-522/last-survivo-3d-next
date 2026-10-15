import * as T from './vendor/three.module.js';
import{mergeGeometries}from'./vendor/BufferGeometryUtils.js';
import{groundWindTime}from'./adventure-ground-detail.js?v=208';

// A real basin outside the walking boundary, aligned with the existing lagoon.
// No pond/collision records are added: this water is background scenery only.
export function harborBayLayout(world,id,biomeAt=()=>id){
 if(id!=='coast'&&id!=='confluence')return null;
 if(world.harborBay&&!world.harborBay.disposed)return world.harborBay;
 const ponds=(world.ponds||[]).filter(p=>p.biome==='coast'),candidates=[],half=world.half;
 for(const pond of ponds)for(let i=0;i<32;i++){
  const a=i/32*Math.PI*2,u=Math.cos(a)*pond.rx,v=Math.sin(a)*pond.rz,c=Math.cos(pond.angle||0),s=Math.sin(pond.angle||0),x=pond.x+c*u+s*v,z=pond.z-s*u+c*v;
  candidates.push({angle:Math.atan2(x,z),extent:Math.max(Math.abs(x),Math.abs(z)),source:pond});
 }
 candidates.sort((a,b)=>b.extent-a.extent);
 // Among the outermost channel tips, favor the side closer to the normal of
 // the square shore, leaving room for the existing headland settlements.
 const extent=candidates[0]?.extent,crossAngle=a=>Math.abs(Math.atan2(Math.sin(a*4),Math.cos(a*4)))/4;
 const tips=candidates.filter(p=>p.extent>=extent-3).sort((a,b)=>crossAngle(a.angle)-crossAngle(b.angle));
 const halfAngle=15/(half+24);
 for(const candidate of tips){
  let valid=true;
  if(id==='confluence')for(const d of[-1.4,-1,0,1,1.4]){
   const angle=candidate.angle+d*halfAngle,s=Math.sin(angle),c=Math.cos(angle),edge=half/Math.max(Math.abs(s),Math.abs(c));
   if(biomeAt(s*edge,c*edge)!=='coast'||biomeAt(s*(edge+44),c*(edge+44))!=='coast')valid=false;
  }
  if(valid){const layout={...candidate,half,halfAngle,inner:12.2,outer:42,y:.055,disposed:false};world.harborBay=layout;return layout;}
 }
 return null;
}
export function harborBayCut(bay,x,z){
 if(!bay)return 0;
 const angle=Math.atan2(x,z),delta=Math.abs(Math.atan2(Math.sin(angle-bay.angle),Math.cos(angle-bay.angle))),edge=bay.half/Math.max(Math.abs(Math.sin(angle)),Math.abs(Math.cos(angle))),offset=Math.hypot(x,z)-edge;
 return(1-T.MathUtils.smoothstep(delta,bay.halfAngle*.52,bay.halfAngle*1.10))*T.MathUtils.smoothstep(offset,10,17)*(1-T.MathUtils.smoothstep(offset,34,44));
}

let bayWaterMaterial,boatMaterial,boatGeometry;
function installHarborBay(world,bay,ridge){
 if(!bay||bay.mesh&&!bay.disposed)return;
 const group=new T.Group();group.name='SM_Harbor_Bay_A';bay.mesh=group;world.group.add(group);
 if(!bayWaterMaterial){
  bayWaterMaterial=new T.MeshStandardMaterial({color:0x385f69,roughness:.34,metalness:.12});
  bayWaterMaterial.onBeforeCompile=shader=>{
   shader.uniforms.harborTime=groundWindTime;
   shader.vertexShader='varying vec2 harborWaterPoint;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nharborWaterPoint=(modelMatrix*vec4(position,1.0)).xz;');
   shader.fragmentShader='uniform float harborTime; varying vec2 harborWaterPoint;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
    normal=normalize(normal+vec3(sin(harborWaterPoint.x*.38+harborWaterPoint.y*.19+harborTime*.38)*.045,sin(harborWaterPoint.y*.45-harborTime*.27)*.035,0.0));`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float ripple=sin(harborWaterPoint.x*.54+harborWaterPoint.y*.11+harborTime*.30)*sin(harborWaterPoint.y*.67-harborTime*.21);
    diffuseColor.rgb*=.97+ripple*.035;`);
  };
  bayWaterMaterial.customProgramCacheKey=()=> 'harbor-bay-water-v1';
 }
 const positions=[],indices=[],segments=32,rows=8;
 for(let i=0;i<=segments;i++){
  const a=bay.angle+(i/segments*2-1)*bay.halfAngle,s=Math.sin(a),c=Math.cos(a),edge=bay.half/Math.max(Math.abs(s),Math.abs(c));
  for(let j=0;j<=rows;j++){const r=edge+T.MathUtils.lerp(bay.inner,bay.outer,j/rows);positions.push(s*r,bay.y,c*r);if(i<segments&&j<rows){const n=i*(rows+1)+j;indices.push(n,n+1,n+rows+1,n+1,n+rows+2,n+rows+1);}}
 }
 const surface=new T.BufferGeometry();surface.setAttribute('position',new T.Float32BufferAttribute(positions,3));surface.setIndex(indices);surface.computeVertexNormals();
 const water=new T.Mesh(surface,bayWaterMaterial);water.name='SM_Harbor_OffshoreWater_A';water.userData.ownedGeometry=true;group.add(water);bay.water=water;
 // Leave the enclosing mountain geometry in place below the water. This makes
 // actual headlands and banks occlude the surface, rather than painting blue on land.
 ridge.updateWorldMatrix(true,false);const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,400),boats=[];
 for(const [index,offset]of[22,29].entries()){
  const s=Math.sin(bay.angle),c=Math.cos(bay.angle),edge=bay.half/Math.max(Math.abs(s),Math.abs(c)),x=s*(edge+offset),z=c*(edge+offset);
  let wet=true;
  // Full possible orbit and hull footprint must remain below this waterline.
  for(let i=0;i<32;i++){const a=i/32*Math.PI*2,tx=Math.cos(a)*5.4,tz=Math.sin(a)*3.3,px=x+c*tx+s*tz,pz=z-s*tx+c*tz;ray.ray.origin.set(px,200,pz);const hits=ray.intersectObject(ridge,false);if(!hits.length||hits[0].point.y>bay.y-.13)wet=false;}
  if(wet)boats.push({x,z,y:bay.y,angle:bay.angle,phase:index*Math.PI,offset});
 }
 bay.boats=boats;
 if(boats.length){
  if(!boatGeometry){
   const pieces=[],tint=new T.Color();
   const add=(g,color)=>{tint.setHex(color);const colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(tint.r,tint.g,tint.b);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));for(const name of Object.keys(g.attributes))if(!['position','normal','color'].includes(name))g.deleteAttribute(name);if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));pieces.push(g);};
   const hull=new T.Shape();hull.moveTo(-1.75,.30);hull.lineTo(-1.25,-.19);hull.lineTo(1.20,-.19);hull.lineTo(1.90,.42);hull.closePath();const shell=new T.ExtrudeGeometry(hull,{depth:.88,steps:1,bevelEnabled:true,bevelSize:.07,bevelThickness:.07,bevelSegments:1});shell.translate(0,0,-.44);add(shell,0x48605d);
   const mast=new T.CylinderGeometry(.043,.067,3.75,6);mast.translate(-.3,1.74,0);add(mast,0x62766b);
   const spar=new T.CylinderGeometry(.037,.045,2.4,6);spar.rotateZ(Math.PI/2);spar.translate(.45,3.01,0);add(spar,0x62766b);
   const p=[],ix=[];for(let row=0;row<=4;row++)for(let col=0;col<=4;col++){const u=col/4,v=row/4;p.push(-.68+u*(2.35-v*.48),2.91-v*2.03,.04+Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.22);if(row<4&&col<4){const n=row*5+col;ix.push(n,n+1,n+5,n+1,n+6,n+5);}}
   const sail=new T.BufferGeometry();sail.setAttribute('position',new T.Float32BufferAttribute(p,3));sail.setIndex(ix);sail.computeVertexNormals();add(sail,0x9daea5);boatGeometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();
   boatMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.95,side:T.DoubleSide});
   boatMaterial.onBeforeCompile=shader=>{
    shader.uniforms.harborTime=groundWindTime;
    shader.vertexShader=`uniform float harborTime; attribute vec3 harborPivot; attribute vec2 harborCourse;
     float harborPhase(){return harborTime*.014+harborCourse.y;}
     float harborHeading(){float p=harborPhase();return harborCourse.x-atan(1.10*cos(p),-3.30*sin(p));}
     mat2 harborRotation(){float a=harborHeading();return mat2(cos(a),-sin(a),sin(a),cos(a));}
    `+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal.xz=harborRotation()*objectNormal.xz;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     float phase=harborPhase(); vec2 tangent=vec2(cos(harborCourse.x),-sin(harborCourse.x)),outward=vec2(sin(harborCourse.x),cos(harborCourse.x));
     transformed.xz=harborRotation()*(transformed.xz-harborPivot.xz)+harborPivot.xz+tangent*(3.30*cos(phase))+outward*(1.10*sin(phase));
     transformed.y+=sin(harborTime*.62+harborCourse.y)*.018;`);
   };
   boatMaterial.customProgramCacheKey=()=> 'harbor-bay-boat-v1';
  }
  const parts=[];for(const boat of boats){const g=boatGeometry.clone();g.translate(boat.x,boat.y,boat.z);const pivot=[],course=[];for(let i=0;i<g.attributes.position.count;i++){pivot.push(boat.x,boat.y,boat.z);course.push(boat.angle,boat.phase);}g.setAttribute('harborPivot',new T.Float32BufferAttribute(pivot,3));g.setAttribute('harborCourse',new T.Float32BufferAttribute(course,2));parts.push(g);}
  const geometry=mergeGeometries(parts);for(const g of parts)g.dispose();geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(5.5);geometry.computeBoundingSphere();geometry.boundingSphere.radius+=5.5;
  const mesh=new T.Mesh(geometry,boatMaterial);mesh.name='SM_Harbor_DistantSails_A';mesh.userData.ownedGeometry=true;group.add(mesh);bay.sails=mesh;
 }
 for(const mesh of group.children)mesh.geometry.addEventListener('dispose',()=>{bay.disposed=true;group.visible=false;});
}

// Small, permanent source library. Only the world-space merged copies belong to
// a run; materials and these three silhouettes survive world cleanup.
let library;
const materials=[
 new T.MeshStandardMaterial({vertexColors:true,roughness:1}),
 new T.MeshStandardMaterial({vertexColors:true,roughness:.93}),
 new T.MeshStandardMaterial({vertexColors:true,roughness:.89,side:T.DoubleSide})
];
function templates(){
 if(library)return library;
 library=[];
 for(let variant=0;variant<3;variant++){
  const parts=[[],[],[]],matrix=new T.Matrix4(),color=new T.Color();
  const add=(g,tint,category=1,x=0,y=0,z=0,rotation=0)=>{
   matrix.makeRotationY(rotation);matrix.setPosition(x,y,z);g.applyMatrix4(matrix);
   color.setHex(tint);const colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(color.r,color.g,color.b);
   g.setAttribute('color',new T.Float32BufferAttribute(colors,3));if(!g.attributes.normal)g.computeVertexNormals();
   for(const key of Object.keys(g.attributes))if(!['position','normal','color'].includes(key))g.deleteAttribute(key);
   if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));parts[category].push(g);
  };
  const box=(x,y,z,w,h,d,tint=0x65726b,category=1)=>add(new T.BoxGeometry(w,h,d),tint,category,x,y,z);
  const beam=(a,b,r=.10,tint=0x596963)=>{
   const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start),g=new T.CylinderGeometry(r*.86,r,delta.length(),6);
   g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
   start.add(end).multiplyScalar(.5);add(g,tint,1,start.x,start.y,start.z);
  };
  const shed=(x,z,w,d,h,tint)=>{
   box(x,h/2,z,w,h,d,tint,0);
   // A closed extruded gable, plus two thick roof planes; no view-facing cards.
   const peak=h+w*.20,shape=new T.Shape();shape.moveTo(-w/2,h);shape.lineTo(0,peak);shape.lineTo(w/2,h);shape.closePath();
   add(new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1}),tint,0,x,0,z-d/2);
   for(const side of[-1,1]){
    const pitch=Math.atan(.4),g=new T.BoxGeometry((w/2+.28)/Math.cos(pitch),.16,d+.65);
    g.rotateZ(-side*pitch);add(g,variant===1?0x526d72:0x586f72,1,x+side*w/4,h+w*.10+.10,z);
   }
   beam([x,peak+.15,z-d/2-.32],[x,peak+.15,z+d/2+.32],.085,0x7a8b83);
   for(const side of[-1,1])box(x+side*w*.42,h*.49,z-d/2-.025,.14,h,.12,0x52635d);
   // Wide loading door and a short awning keep the facade legible from afar.
   box(x,h*.35,z-d/2-.07,w*.34,h*.69,.12,0x364e51,0);
   box(x,h*.73,z-d/2-.36,w*.44,.13,.9,0x7c8b7a);
  };
  const crane=(x,z,height)=>{
   for(const s of[-1,1])beam([x+s*.95,.06,z+s*.42],[x,height-.4,z],.16);
   beam([x-.9,1.25,z-.4],[x+.9,1.25,z+.4],.10);
   beam([x,height,z],[x-3.6,height-.8,z-.75],.15);
   beam([x,height-2.3,z],[x-3.4,height-.87,z-.72],.085);
   beam([x-3.35,height-.88,z-.7],[x-3.35,1.4,z-.7],.025,0x9b9d88);
   box(x-3.35,.95,z-.7,1.15,1.1,.95,0x738077);
  };
  if(variant===0){
   shed(-3.5,.15,7.5,5.2,3.2,0x748079);shed(3.15,1.0,5.1,4.1,2.65,0x697873);crane(7.05,-1.45,7.1);
  }else if(variant===1){
   shed(-4.75,1.25,6.5,4.2,3.2,0x77857b);
   // A broad hull under repair, resting on a timber slipway, with a bowed sail.
   for(const z of[-2,0,2])box(3.6,.20,z,8.0,.4,.35,0x65726a);
   const hull=new T.Shape();hull.moveTo(-3.9,1.6);hull.lineTo(-2.7,.38);hull.lineTo(2.5,.38);hull.lineTo(4.0,1.85);hull.closePath();
   add(new T.ExtrudeGeometry(hull,{depth:2.35,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:1,steps:1}),0x556961,1,3.5,0,-1.2);
   beam([2.5,.5,0],[2.8,8.0,.14],.14);beam([.1,6.9,.10],[6.7,6.9,.10],.095);
   const p=[],ix=[],cols=6,rows=6;
   for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const u=col/cols,v=row/rows;p.push(.35+u*(6.1-v*.7),6.7-v*(3.75+.22*Math.sin(u*Math.PI)),.22+.64*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)+.04*Math.sin(u*10));
    if(row<rows&&col<cols){const n=row*(cols+1)+col;ix.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
   }
   const sail=new T.BufferGeometry();sail.setAttribute('position',new T.Float32BufferAttribute(p,3));sail.setIndex(ix);sail.computeVertexNormals();add(sail,0xa8b4a5,2);
   for(const side of[.3,6.5])beam([side,6.9,.1],[side*.79+.65,2.6,.22],.022,0x969e8a);
  }else{
   shed(-4.4,.9,6.7,5.6,3.65,0x74817b);shed(3.5,-.7,6.1,4.4,2.9,0x677975);crane(5.9,2.6,6.7);
   // Folded canvas hangs under the loading beam, with a real rolled section.
   const roll=new T.CylinderGeometry(.19,.19,3.2,8);roll.rotateZ(Math.PI/2);add(roll,0xa7ad96,2,3.5,3.2,-3.3);
  }
  // The first silhouette also has bundled canvas, so every template can batch
  // the same three finishes without allocating one material per settlement.
  if(variant===0){const g=new T.CylinderGeometry(.22,.22,2.2,8);g.rotateZ(Math.PI/2);add(g,0x9daa99,2,-3.5,1.1,-2.8);}
  library.push(parts.map(list=>{const merged=mergeGeometries(list);for(const g of list)g.dispose();merged.computeBoundingBox();return merged;}));
 }
 return library;
}

export function installHarborHorizon(world,id,biomeAt=()=>id,ridge){
 if(id!=='coast'&&id!=='confluence')return null;
 if(world.harborHorizon&&!world.harborHorizon.userData.disposed)return world.harborHorizon;
 if(!ridge?.isMesh)return null;
 const bay=harborBayLayout(world,id,biomeAt);installHarborBay(world,bay,ridge);
 const half=world.half,candidates=[],sources=templates(),dummy=new T.Object3D();
 ridge.updateWorldMatrix(true,false);
 const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,400),parts=[[],[],[]],records=[];
 const ground=(x,z)=>{ray.ray.origin.set(x,200,z);return ray.intersectObject(ridge,false)[0]?.point.y;};
 // Only whole footprints well inside the coastal boundary sector qualify.
 // Select from deterministic angles without consuming the world's random stream.
 for(let i=0;i<128;i++){
  const direction=(i+.37)/128*Math.PI*2,s=Math.sin(direction),c=Math.cos(direction),edge=half/Math.max(Math.abs(s),Math.abs(c));
  // Quays face the actual square shoreline, not the centre of a circular fence.
  const angle=Math.round(direction/(Math.PI/2))*Math.PI/2,ca=Math.cos(angle),sa=Math.sin(angle);
  for(const offset of[12,14]){
  const radius=edge+offset,x=s*radius,z=c*radius;
  let safe=true;
  for(const dx of[-9.4,0,9.4])for(const dz of[-4,0,4]){
   const px=x+ca*dx+sa*dz,pz=z-sa*dx+ca*dz;
   if(Math.max(Math.abs(px),Math.abs(pz))<half+2||(id==='confluence'&&biomeAt(px,pz)!=='coast'))safe=false;
   if(harborBayCut(bay,px,pz)>.01)safe=false;
   // Project the whole footprint back onto the playable edge as well: curved
   // regional borders outside the map must not leak into adjacent inland regions.
   const scale=half/Math.max(Math.abs(px),Math.abs(pz));
   if(id==='confluence'&&biomeAt(px*scale,pz*scale)!=='coast')safe=false;
  }
  if(!safe)continue;
  const supports=[];
  for(const dx of[-9.25,0,9.25])for(const dz of[-3.85,0,3.85]){
   const px=x+ca*dx+sa*dz,pz=z-sa*dx+ca*dz,y=ground(px,pz);if(Number.isFinite(y))supports.push({x:px,z:pz,y});
  }
  if(supports.length!==9)continue;
  const low=Math.min(...supports.map(p=>p.y))-.24,y=Math.max(...supports.map(p=>p.y))+.04;
  // Never balance a village on a steep ridge with a tall, exposed plinth.
  if(y-low>2.5||y>2.25)continue;
  candidates.push({x,z,angle,y,low,supports});break;
  }
 }
 if(!candidates.length)return null;
 for(let n=0;n<8;n++){
  let p=candidates[0],distance=-1;
  if(records.length)for(const candidate of candidates){const d=Math.min(...records.map(q=>Math.hypot(candidate.x-q.x,candidate.z-q.z)));if(d>distance){distance=d;p=candidate;}}
  if(records.length&&distance<21)break;
  const{y,low,supports}=p,variant=n%3;
  dummy.position.set(p.x,y,p.z);dummy.rotation.set(0,p.angle,0);dummy.updateMatrix();
  for(let category=0;category<3;category++)parts[category].push(sources[variant][category].clone().applyMatrix4(dummy.matrix));
  // Bury the quay in an irregular rubble apron instead of displaying a single
  // dark rectangular box. Its outer foot follows the real ridge at each point.
  const corners=[[-8.6,-3.85],[8.6,-3.85],[9.25,-3.2],[9.25,3.2],[8.6,3.85],[-8.6,3.85],[-9.25,3.2],[-9.25,-3.2]],rim=[],c=Math.cos(p.angle),s=Math.sin(p.angle);
  const allowed=(x,z)=>{
   if(Math.max(Math.abs(x),Math.abs(z))<half+2)return false;
   if(id!=='confluence')return true;
   const scale=half/Math.max(Math.abs(x),Math.abs(z));return biomeAt(x,z)==='coast'&&biomeAt(x*scale,z*scale)==='coast';
  };
  for(let edge=0;edge<corners.length;edge++)for(let step=0;step<4;step++){
   const a=corners[edge],b=corners[(edge+1)%corners.length],t=step/4,dx=a[0]+(b[0]-a[0])*t,dz=a[1]+(b[1]-a[1])*t;
   const x=p.x+c*dx+s*dz,z=p.z-s*dx+c*dz,spread=.65+.42*(.5+.5*Math.sin((edge*4+step)*2.7+n)),length=Math.hypot(dx,dz);
   let ox=x+(c*dx+s*dz)/length*spread,oz=z+(-s*dx+c*dz)/length*spread;
   if(!allowed(ox,oz)){ox=x;oz=z;}
   ray.ray.origin.set(ox,200,oz);const hit=ray.intersectObject(ridge,false)[0],shade=new T.Color(0x5e7a74);
   if(hit?.face&&ridge.geometry.attributes.color){
    const colors=ridge.geometry.attributes.color,face=hit.face;shade.fromBufferAttribute(colors,face.a).add(new T.Color().fromBufferAttribute(colors,face.b)).add(new T.Color().fromBufferAttribute(colors,face.c)).multiplyScalar(1/3);
   }
   rim.push({x,z,ox,oz,foot:(hit?.point.y??-.03)-.13,shade});
  }
  const vertices=[p.x,y-.035,p.z],colors=[],indices=[],top=new T.Color(0x718177);colors.push(top.r,top.g,top.b);
  for(let row=0;row<3;row++)for(let i=0;i<rim.length;i++){
   const q=rim[i],t=row/2,shade=top.clone().lerp(q.shade,t);
   vertices.push(q.x+(q.ox-q.x)*t,y-.035+(q.foot-y+.035)*t+(row===1?.09*Math.sin(i*1.8+n):0),q.z+(q.oz-q.z)*t);colors.push(shade.r,shade.g,shade.b);
   if(row===0)indices.push(0,1+(i+1)%rim.length,1+i);
   if(row<2){const a=1+row*rim.length+i,b=1+row*rim.length+(i+1)%rim.length,d=a+rim.length,e=b+rim.length;indices.push(a,b,d,b,e,d);}
  }
  const apron=new T.BufferGeometry();apron.setAttribute('position',new T.Float32BufferAttribute(vertices,3));apron.setAttribute('color',new T.Float32BufferAttribute(colors,3));apron.setIndex(indices);apron.computeVertexNormals();parts[0].push(apron);
  // Half-buried, squat stones interrupt the long lip without turning the quay
  // into a row of posts. They remain in the same opaque masonry batch.
  for(let i=1;i<rim.length;i+=3){
   const q=rim[i],t=.58,g=new T.IcosahedronGeometry(1,0),size=.41+.14*(.5+.5*Math.sin(i*2.3+n));
   g.scale(size*1.35,size*.65,size);g.rotateY(i*.79);g.translate(q.x+(q.ox-q.x)*t,y-.035+(q.foot-y+.035)*t+.02,q.z+(q.oz-q.z)*t);
   const positions=g.attributes.position;if(Array.from({length:positions.count},(_,j)=>j).some(j=>!allowed(positions.getX(j),positions.getZ(j)))){g.dispose();continue;}
   const shade=top.clone().lerp(q.shade,.45).multiplyScalar(.95+.08*Math.sin(i)),tints=[];for(let j=0;j<positions.count;j++)tints.push(shade.r,shade.g,shade.b);
   g.setAttribute('color',new T.Float32BufferAttribute(tints,3));g.deleteAttribute('uv');g.setIndex(Array.from({length:positions.count},(_,j)=>j));parts[0].push(g);
  }
  records.push({...p,y,low,variant,supports});
 }
 if(!records.length)return null;
 const group=new T.Group();group.name='SM_Harbor_Horizon_A';group.userData={records,disposed:false};
 for(let category=0;category<3;category++){
  const geometry=mergeGeometries(parts[category]);for(const g of parts[category])g.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,materials[category]);mesh.name='SM_Harbor_Horizon_'+['Masonry','Timber','Canvas'][category];mesh.userData.ownedGeometry=true;
  geometry.addEventListener('dispose',()=>{group.userData.disposed=true;group.visible=false;});group.add(mesh);
 }
 world.harborHorizon?.removeFromParent();world.group.add(group);world.harborHorizon=group;return group;
}

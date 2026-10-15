import * as T from './vendor/three.module.js';
import{mergeGeometries}from'./vendor/BufferGeometryUtils.js';
import{MAP_HALF}from'./map-layout.js?v=207';
export const TERRAIN_TIPS={
 forest:'浅色裂口的枯木可以打倒。倒木短暂挡路约 8 秒，可跳过低矮树干或从两端绕行；追来的怪物也会破坏它，不能永久堵怪。',
 snow:'浅蓝裂纹冰面会保留一点滑行惯性，人和地面怪物都会滑。提前转向、借冰面拉开距离；离开冰面立即恢复普通移动。',
 ash:'地火喷发前会冒烟并发出低鸣，提前 1.25 秒预告。把怪物引进裂隙后撤开，喷发会同时伤害双方，重型首领受到较少伤害。',
 sand:'有深色裂纹的残墙可以打碎，也能挡住怪物的远程投射。受击后逐渐破损，不能一直躲在墙后；从缺口穿行。',
 coast:'岸边断续石块连成退潮浅滩。退潮时走浅滩更快，涨潮前有 3 秒提示；涨潮淹没石路后恢复深水，附近栈桥始终可通行。'
};
const geometries=new Map(),materials=new Map();
const fallenBounds=new T.Box3();
export function terrainMesh(parent,kind,args,color,x=0,y=0,z=0){const key=kind+args.join(',');if(!geometries.has(key))geometries.set(key,new T[kind](...args));if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.94}));const m=new T.Mesh(geometries.get(key),materials.get(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function deadTimber(parent){
 if(!geometries.has('dead-timber')){
  const parts=[],bark=new T.Color(0x665d4b),cut=new T.Color(0xb6a07b);
  const color=(g,base)=>{const p=g.attributes.position,c=[],exposed=base===cut;for(let i=0;i<p.count;i++){const y=p.getY(i),a=Math.atan2(p.getZ(i),p.getX(i)),shade=.84+.11*Math.sin(a*7+.4*Math.sin(y*1.7))+.055*Math.cos(a*13-y*.6),damp=exposed?0:.10*(1-T.MathUtils.smoothstep(y,.03,.6));c.push(base.r*(shade-damp),base.g*(shade-damp*.4),base.b*(shade-damp*.2));}g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('timberGrain',new T.BufferAttribute(p.array.slice(),3));g.setAttribute('timberCut',new T.Float32BufferAttribute(new Float32Array(p.count).fill(exposed?1:0),1));g.deleteAttribute('uv');return g;};
  const bend=h=>({x:.055*Math.sin(h*1.7)+.035*Math.sin(h*3.1),z:.026*Math.sin(h*1.2)});
  const radius=(h,a,base,tip,height)=>(base+(tip-base)*h/height)*(1+.07*Math.sin(a*7+.4*Math.sin(h*1.7))+.028*Math.cos(a*13-h*.6));
  const stem=(height,base,tip,sides,steps,x,y,z,turn,azimuth)=>{
   const g=new T.CylinderGeometry(tip,base,height,sides,steps,true),p=g.attributes.position;
   for(let i=0;i<p.count;i++){
    const h=p.getY(i)+height/2,a=Math.atan2(p.getZ(i),p.getX(i)),r=radius(h,a,base,tip,height),curve=bend(h);
    p.setXYZ(i,Math.cos(a)*r+curve.x,h+(h>height-.001?-.12+.085*Math.sin(a*3)+.03*Math.cos(a*5):0),Math.sin(a)*r+curve.z);
   }
   const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(0,azimuth,turn)),new T.Vector3(1,1,1));
   // Uneven exposed end grain follows the splintered ring, including the end visible after falling.
   for(const row of[0,steps]){
    const vertices=[],indices=[],start=row*(sides+1),center=new T.Vector3();
    for(let i=0;i<sides;i++){const v=new T.Vector3().fromBufferAttribute(p,start+i);center.add(v);vertices.push(v.x,v.y,v.z);}center.divideScalar(sides);
    // Broken fibres surround a shallow, eccentric heartwood recess, not a saw-cut disk or spike.
    for(let i=0;i<sides;i++){const v=new T.Vector3().fromBufferAttribute(p,start+i).lerp(center,.44);vertices.push(v.x,v.y-(row?0:.035),v.z);}
    vertices.push(center.x,center.y-(row?0:.075),center.z);
    const face=(a,b,c)=>indices.push(...(row?[a,c,b]:[a,b,c]));
    for(let i=0;i<sides;i++){const j=(i+1)%sides;face(i,j,sides+i);face(j,sides+j,sides+i);face(sides*2,sides+i,sides+j);}
    const cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(vertices,3));cap.setIndex(indices);cap.computeVertexNormals();parts.push(color(cap,cut).applyMatrix4(matrix));
   }
   g.computeVertexNormals();parts.push(color(g,bark).applyMatrix4(matrix));
  };
  stem(3.4,.37,.22,14,9,0,0,0,0,0);
  stem(.93,.14,.070,8,4,-.025,1.57,.015,.78,-.20);
  stem(.89,.13,.061,8,4,.01,2.10,.01,-.85,.45);
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2+.37,vertices=[],indices=[],sides=7;
   for(let row=0;row<4;row++)for(let j=0;j<sides;j++){
    const t=row/3,angle=j/sides*Math.PI*2,r=[.15,.13,.065,.008][row],x=.16+t*(.36+.025*Math.sin(i*2.1)),y=[.19,.12,.045,-.026][row]+Math.sin(angle)*r*.55,z=Math.cos(angle)*r+Math.sin(t*Math.PI)*.035;
    vertices.push(Math.cos(a)*x-Math.sin(a)*z,y,Math.sin(a)*x+Math.cos(a)*z);
    if(row<3){const p=row*sides+j,q=row*sides+(j+1)%sides;indices.push(p,q,p+sides,q,q+sides,p+sides);}
   }
   const root=new T.BufferGeometry();root.setAttribute('position',new T.Float32BufferAttribute(vertices,3));root.setIndex(indices);root.computeVertexNormals();parts.push(color(root,bark));
  }
  // A pale, narrow bark wound keeps the existing breakable-timber cue legible.
  const scar=new T.PlaneGeometry(.075,.86,1,8),p=scar.attributes.position;
  for(let i=0;i<p.count;i++){const y=p.getY(i)+.75,curve=bend(y),x=p.getX(i)*(.62+.30*Math.sin(y*17))+curve.x+.02*Math.sin(y*9);p.setXYZ(i,x,y,radius(y,Math.PI/2,.37,.22,3.4)+curve.z+.008);}
  scar.computeVertexNormals();parts.push(color(scar,cut));
  const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.set('dead-timber',geometry);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
  // Small object-space grooves follow the timber when it falls. No textures,
  // time uniforms or per-log updates; fade grain before it becomes pixel noise.
  material.onBeforeCompile=shader=>{
   shader.vertexShader='attribute vec3 timberGrain; attribute float timberCut; varying vec3 timberPoint; varying float timberEnd;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntimberPoint=timberGrain;timberEnd=timberCut;');
   shader.fragmentShader='varying vec3 timberPoint; varying float timberEnd;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float timberPixel=max(length(dFdx(timberPoint)),length(dFdy(timberPoint))),timberDetail=1.0-smoothstep(.018,.085,timberPixel);
    float timberFurrow=.5+.25*(sin(timberPoint.x*65.0+sin(timberPoint.y*2.7+timberPoint.z*9.0)*.75)+sin(timberPoint.z*58.0+sin(timberPoint.y*1.9-timberPoint.x*12.0)*.7));
    float timberRidge=smoothstep(.25,.80,timberFurrow),timberRing=.5+.5*sin(length(timberPoint.xz)*95.0+sin(atan(timberPoint.z,timberPoint.x)*3.0)*.3);
    diffuseColor.rgb*=mix(1.0,mix(.70+timberRidge*.38,.84+timberRing*.16,timberEnd),timberDetail);
    float timberRelief=timberRidge*.009*timberDetail*(1.0-timberEnd);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 timberDx=dFdx(-vViewPosition),timberDy=dFdy(-vViewPosition),timberRx=cross(timberDy,normal),timberRy=cross(normal,timberDx);
    float timberDet=dot(timberDx,timberRx);
    normal=normalize(abs(timberDet)*normal-sign(timberDet)*(dFdx(timberRelief)*timberRx+dFdy(timberRelief)*timberRy));
   `);
  };
  material.customProgramCacheKey=()=> 'timber-broken-bark';materials.set('dead-timber',material);
 }
 const m=new T.Mesh(geometries.get('dead-timber'),materials.get('dead-timber'));m.name='breakable-dead-timber';m.castShadow=m.receiveShadow=true;parent.add(m);
}
export function installTactics(w,id,rnd){
 w.breakables=[];w.ice=[];w.fords=[];
 if(id==='forest')for(const o of [...w.obstacles].sort((a,b)=>Math.hypot(a.x-w.spawn.x,a.z-w.spawn.z)-Math.hypot(b.x-w.spawn.x,b.z-w.spawn.z))){
  if(w.breakables.length>=6)break;if(w.breakables.some(b=>Math.hypot(b.x-o.x,b.z-o.z)<11))continue;
  w.foliage=w.foliage.filter(f=>f.leaf.parent!==o.mesh);o.mesh.clear();deadTimber(o.mesh);
  Object.assign(o,{tactic:'timber',hp:42,state:'standing',age:0});w.breakables.push(o);
 }
 if(id==='sand')for(const o of w.obstacles.filter(o=>o.mesh.userData.fragile).slice(0,16)){
  Object.assign(o,{tactic:'wall',hp:90,state:'standing',age:0});w.breakables.push(o);
  for(const s of[-1,1]){const crack=terrainMesh(o.mesh,'BoxGeometry',[.035,.55,.03],0x615c50,s*.11,.5,.44);crack.rotation.z=s*.5;}
 }
 if(id==='snow')for(let i=0;i<3;i++)for(let attempt=0;attempt<450;attempt++){
  const angle=rnd()*Math.PI*2,d=18+i*15+rnd()*8,r=2.7+rnd()*.8,x=w.spawn.x+Math.sin(angle)*d,z=w.spawn.z+Math.cos(angle)*d;
  if((w.contains&&!w.contains(x,z))||Math.abs(x)>(w.half||MAP_HALF)-6||Math.abs(z)>(w.half||MAP_HALF)-6||w.obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<r+o.r+.6)||w.sites.some(s=>Math.hypot(s.x-x,s.z-z)<r+6)||w.ponds.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+r+1)||[...w.discoveries,...w.ice].some(p=>Math.hypot(p.x-x,p.z-z)<r+4))continue;
  const p={x,z,r,kind:'ice',rx:r,rz:r*.76};w.patches.push(p);
  const g=new T.Group();g.position.set(p.x,.07,p.z);g.scale.set(p.r,1,p.r*.76);w.group.add(g);const surface=terrainMesh(g,'CircleGeometry',[1,15],0x8ab5c1);surface.rotation.x=-Math.PI/2;surface.castShadow=false;surface.material.transparent=true;surface.material.opacity=.68;surface.material.depthWrite=false;surface.material.roughness=.35;if(!surface.geometry.userData.irregular){const a=surface.geometry.attributes.position;for(let i=1;i<a.count;i++){const t=Math.atan2(a.getY(i),a.getX(i)),k=1+.1*Math.sin(t*3)+.06*Math.cos(t*5);a.setXY(i,a.getX(i)*k,a.getY(i)*k);}a.needsUpdate=true;surface.geometry.userData.irregular=true;}
  for(let i=0;i<5;i++){const crack=terrainMesh(g,'BoxGeometry',[.02,.009,.42],0xc0d9da,Math.sin(i*2.4)*.48,.012,Math.cos(i*2.4)*.48);crack.rotation.y=i*.9;crack.castShadow=false;}
  w.ice.push(p);break;
 }
 if(id==='coast'){
  const crossings=w.coastLayout?.fords||w.ponds.slice(0,3).map(p=>{const turn=(p.angle||0)+(p.rx>p.rz?Math.PI/2:0),offset=Math.min(6,Math.max(p.rx,p.rz)*.4);return{x:p.x+Math.sin(turn)*offset,z:p.z+Math.cos(turn)*offset,half:Math.min(p.rx,p.rz)*1.3,width:1.5,angle:turn};});
  for(const crossing of crossings){
   const f={...crossing,mesh:new T.Group()};f.mesh.position.set(f.x,0,f.z);f.mesh.rotation.y=f.angle||0;w.group.add(f.mesh);w.fords.push(f);
   for(let x=-f.half;x<=f.half;x+=1.2){const rock=terrainMesh(f.mesh,'DodecahedronGeometry',[1,0],0x6f8884,x,.1,Math.sin(x*.4)*.25+(rnd()-.5)*.16);rock.scale.set(.42+rnd()*.22,.12+rnd()*.06,.34+rnd()*.22);rock.rotation.y=rnd()*6;rock.castShadow=false;}
  }
 }
}
export const onIce=(w,x,z)=>!!w.ice?.some(p=>Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)<1);
export const onFord=(w,x,z)=>!w.tide?.high&&!!w.fords?.some(f=>{const c=Math.cos(f.angle||0),s=Math.sin(f.angle||0),dx=x-f.x,dz=z-f.z;return Math.abs(c*dx-s*dz)<f.half&&Math.abs(s*dx+c*dz)<f.width/2;});
// Integrate the exponential velocity exactly so stopping distance is independent of frame rate.
export function iceMotion(p,vx,vz,dt,icy){
 if(!icy){p.iceVX=vx;p.iceVZ=vz;return{x:vx*dt,z:vz*dt};}
 const rate=4.8,blend=-Math.expm1(-rate*dt),ox=p.iceVX??vx,oz=p.iceVZ??vz;
 p.iceVX=ox+(vx-ox)*blend;p.iceVZ=oz+(vz-oz)*blend;
 return{x:vx*dt+(ox-vx)*blend/rate,z:vz*dt+(oz-vz)*blend/rate};
}
export function damageTerrain(o,damage,from){
 if(!o?.tactic||o.state!=='standing'||damage<=0)return false;o.hp-=damage;
 if(o.hp>0){o.mesh.scale.y=.92+.08*Math.max(0,o.hp)/(o.tactic==='wall'?90:42);return true;}
 o.state=o.tactic==='timber'?'falling':'crumbling';o.age=0;o.angle=Math.atan2(o.x-from.x,o.z-from.z);return true;
}
export function updateTactics(w,dt,{player,foes,clear,fx}){
 if(dt<=0)return;
 for(const f of w.fords||[])f.mesh.scale.y=1-(w.tide?.rise||0)*.92;
 for(const o of w.breakables||[]){
  if(o.state==='standing'){
   const near=foes.filter(e=>e.alive&&Math.hypot(e.x-o.x,e.z-o.z)<o.r+e.size+.65);
   if(near.length)damageTerrain(o,dt*near.reduce((n,e)=>n+(e.role==='golem'?22:8),0),near[0]);
  }
  if(['standing','spent'].includes(o.state))continue;o.age+=dt;
  if(o.state==='falling'){
   o.mesh.rotation.set(Math.min(1,o.age/.75)**2*Math.PI/2,o.angle,0,'YXZ');
   if(o.age>=.75){w.obstacles=w.obstacles.filter(b=>b!==o);o.state='fallen';o.age=0;
    // Measure the final rotated vertices once; standing-tree heights would make
    // this low trunk an invisible wall. Every proxy uses the same safe upper bound.
    o.mesh.updateWorldMatrix(true,true);
    const height=Math.max(.15,fallenBounds.setFromObject(o.mesh,true).max.y);
    for(let i=0;i<5;i++){const d=.35+i*.66,x=o.x+Math.sin(o.angle)*d,z=o.z+Math.cos(o.angle)*d;
     if(clear(x,z,.35)&&[player,...foes.filter(e=>e.alive)].every(p=>Math.hypot(p.x-x,p.z-z)>(p.size||.45)+.65))w.obstacles.push({x,z,r:.34,height,sceneryHeight:height,mesh:o.mesh,owner:o});
    }fx(o,'fall');
   }
  }else if(o.state==='crumbling'){
   o.mesh.scale.y=Math.max(.08,1-o.age*2);if(o.age>=.5){w.obstacles=w.obstacles.filter(b=>b!==o);o.state='spent';fx(o,'break');}
  }else if(o.state==='fallen'){
   // Contact wears fallen timber down sooner, but never extends its lifetime.
   if(foes.some(e=>e.alive&&Math.hypot(e.x-o.x,e.z-o.z)<4))o.age+=dt;
   if(o.age>=8){w.obstacles=w.obstacles.filter(b=>b.owner!==o);o.state='spent';o.mesh.position.y=-.2;fx(o,'break');}
  }
 }
}

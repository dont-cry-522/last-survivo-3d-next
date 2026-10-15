import test from'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import * as T from'../vendor/three.module.js';
import{EnvironmentLighting,FOREST_CYCLE,installDistantLandscape}from'../environment-lighting.js';
import{buildWorld}from'../world.js';
import{biomeAt}from'../confluence.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const release=world=>world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});

test('slope finishes carry normalized climate weights and fade on the far range without extra draws',()=>{
 let shared;
 for(const id of ['forest','snow','ash','sand','coast','confluence']){
  const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,id,biomeAt),g=mesh.geometry,w=g.attributes.ridgeClimate,l=g.attributes.ridgeLayer;
  if(shared)assert.equal(mesh.material,shared);shared=mesh.material;
  assert.equal(w.count,g.attributes.position.count);assert.equal(l.count,w.count);assert.equal(g.groups.length,0);assert.equal(g.index.count/3,6144);
  const seen=new Set();let blended=0;
  for(let i=0;i<w.count;i++){
   const weights=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)],total=weights.reduce((a,b)=>a+b,0);
   assert(weights.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&total<=1.000001);
   if(weights.filter(n=>n>0).length>1)blended++;
   weights.concat(Math.max(0,1-total)).forEach((n,k)=>{if(n>.01)seen.add(k);});
   assert(l.getX(i)>=0&&l.getX(i)<=(i<193*9?1:.281));
   if(i%9===0)assert.equal(l.getX(i),0,'detail must join the old foothill edge without a seam');
  }
  assert.equal(seen.size,id==='confluence'?5:1);if(id==='confluence')assert(blended>0,'joined regions lost their blended slope finish');
  release(world);
 }
});

test('broad distant ranges rise above foothills at eye level and retain substantial low passes',()=>{
 const rows=9,segments=192,ringSize=(segments+1)*rows;
 for(const id of['forest','snow','ash','sand','coast']){
  const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,id),p=mesh.geometry.attributes.position;
  const heights=[[],[]],elevations=[[],[]];
  for(let i=0;i<segments;i++){
   const radius=k=>Math.hypot(p.getX(k),p.getZ(k)),near=i*rows,far=ringSize+near;
   assert(radius(far)<radius(near+rows-1),id+' has an unsupported gap between near and far slopes');
   const edge=96/Math.max(Math.abs(Math.sin(i/segments*Math.PI*2)),Math.abs(Math.cos(i/segments*Math.PI*2)));
   assert(radius(far+rows-1)-edge>60,id+' far range is still a narrow strip immediately behind the foothills');
   for(let ring=0;ring<2;ring++){
    const top=ring*ringSize+near+rows-1,h=p.getY(top);heights[ring].push(h);elevations[ring].push(Math.atan2(h-1.65,radius(top)));
   }
  }
  const nearPeak=Math.max(...heights[0]),farPeak=Math.max(...heights[1]);
  assert(farPeak>nearPeak*1.6,id+' distant massif has no scale contrast');
  assert(Math.max(...elevations[1])>Math.max(...elevations[0])+Math.PI/60,id+' far peaks do not emerge above the foothills at eye level');
  assert(heights[1].filter(y=>y<farPeak*.3).length>=15,id+' skyline closes into a uniformly high bowl');
  release(world);
 }
});

test('the real harbor bay stays open through the far range on standalone and confluence maps',()=>{
 for(const id of['coast','confluence'])for(const seed of[7,522,43837033]){
  const world=buildWorld(id,seed),ridge=installDistantLandscape(world,id,biomeAt),bay=world.harborBay;
  assert(bay?.boats.length===2,'landscape change lost the existing offshore water or sailboats');
  ridge.updateWorldMatrix(true,false);const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,400);
  const s=Math.sin(bay.angle),c=Math.cos(bay.angle),edge=world.half/Math.max(Math.abs(s),Math.abs(c));
  for(const offset of[44,51,58]){
   ray.ray.origin.set(s*(edge+offset),200,c*(edge+offset));const hit=ray.intersectObject(ridge,false)[0];
   assert(hit&&hit.point.y<bay.y,id+' new far range blocks the water-facing opening');
  }
  release(world);
 }
});

test('actual ridge vertices form rounded forest shoulders, long snow gullies, cone flanks and mesa tops',()=>{
 const profiles={};
 for(const id of['forest','snow','ash','sand']){
  const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,id),p=mesh.geometry.attributes.position,profile=Array(9).fill(0);
  const height=(i,row)=>p.getY(((i+192)%192)*9+row),normalized=(i,row)=>height(i,row)/height(i,8);
  for(let i=0;i<192;i++)for(let row=1;row<9;row++)profile[row]+=normalized(i,row)/192;
  profiles[id]=profile;
  if(id==='snow'){
   // A channel must be lower than both neighboring flanks at the middle and
   // upper slope. Test geometry, not a shader/noise contrast proxy.
   const depth=(i,row)=>(normalized(i-2,row)+normalized(i+2,row))/2-normalized(i,row);let channels=0,deepest=0;
   for(let i=0;i<192;i++){if(depth(i,4)>.06&&depth(i,6)>.025)channels++;deepest=Math.max(deepest,depth(i,4));}
   assert(channels>=20&&deepest>.12,'alpine channels no longer extend along the actual slope');
  }
  release(world);
 }
 const forest=profiles.forest,ash=profiles.ash,sand=profiles.sand;
 assert(forest[4]>.42&&(forest[5]-forest[3])>(forest[8]-forest[6])*1.5,'forest still rises as a convex curtain without a rounded shoulder');
 assert(ash[4]>.4&&ash[4]<.55&&(ash[8]-ash[4])/(ash[4]-ash[1])<1.9,'volcanic flanks bend upward like an enclosing wall');
 assert(sand[6]-sand[4]>.5&&sand[8]-sand[6]<.08,'desert lost its exposed escarpment and broad upper table');
});

test('island ridges retain low straits and every existing near-shore support height',()=>{
 const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,'coast'),p=mesh.geometry.attributes.position,ringSize=193*9;
 // Quantized v209 near-shore heights protect the whole quay-bearing surface,
 // independently of the new far island profile. XZ/topology are unchanged.
 const near=Array.from({length:ringSize},(_,i)=>Math.round(p.getY(i)*1e5));
 assert.equal(createHash('sha256').update(JSON.stringify(near)).digest('hex'),'c459ab7fab48f6b52297d97192efbc4563b39442b4b036de40f1edebc6b4aafb');
 const far=Array.from({length:192},(_,i)=>p.getY(ringSize+i*9+8)),peak=Math.max(...far);
 assert(far.filter(y=>y<peak*.18).length>=60&&far.filter(y=>y>peak*.60).length>=15,'outer islands merged into a continuous high coastal wall');
 release(world);
});

test('broad slope shading follows the existing directional light before distance fog without new samples',()=>{
 const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,'forest'),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 mesh.material.onBeforeCompile(shader);
 assert.deepEqual(Object.keys(shader.uniforms),['ridgeGrain']);
 assert.equal((shader.fragmentShader.match(/texture2D\(ridgeGrain/g)||[]).length,2);
 assert(shader.fragmentShader.includes('dot(ridgeSlopeNormal,directionalLights[0].direction)'),'slope shading must turn with the real sun/moon');
 assert(shader.fragmentShader.includes('dot(directionalLights[0].color,vec3(.2126,.7152,.0722))')&&shader.fragmentShader.includes('smoothstep(0.0,.24,ridgeNear)*ridgeSunStrength'),'slope shading must fade with the actual primary light');
 assert(shader.fragmentShader.indexOf('outgoingLight*=')<shader.fragmentShader.indexOf('#include <fog_fragment>'),'mountain shading must not paint over distance fog');
 assert(shader.fragmentShader.includes('smoothstep(0.0,.24,ridgeNear)'),'foot joins need a continuous fade');
 release(world);
});

test('sun direction and slope contrast stay continuous at dawn/dusk in pure and mixed forests',()=>{
 const scene=new T.Scene();scene.fog=new T.FogExp2();scene.background=new T.Color();
 const light=new EnvironmentLighting(scene,{toneMappingExposure:1},new T.HemisphereLight(),new T.DirectionalLight(),new T.DirectionalLight());
 const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,'forest'),joined={half:96,group:new T.Group()},mixed=installDistantLandscape(joined,'confluence',biomeAt);
 const normals=[new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,1093),new T.Vector3().fromBufferAttribute(mixed.geometry.attributes.normal,2084)];
 const shade=(time,forest)=>{
  light.update(forest===1?'forest':'confluence',forest===1?null:{forest,snow:1-forest},0,time);
  const c=light.sun.color,energy=(c.r*.2126+c.g*.7152+c.b*.0722)*light.sun.intensity;
  const strength=T.MathUtils.smoothstep(energy,0,.8);
  return{direction:light.direction.clone(),values:normals.map(normal=>T.MathUtils.lerp(1,T.MathUtils.lerp(.58,1.04,T.MathUtils.smoothstep(normal.dot(light.direction),.25,.95)),strength))};
 };
 for(const forest of[0,.2,.7298866568,.95,1])for(const angle of[Math.PI,Math.PI*2]){
  const transition=(angle-FOREST_CYCLE.startAngle)/(Math.PI*2)*FOREST_CYCLE.seconds;
  const before=shade(transition-.001,forest),after=shade(transition+.001,forest);
  assert(before.direction.distanceTo(after.direction)<1e-12,'neighboring light retained a sun/moon direction snap');
  for(let i=0;i<normals.length;i++)assert(Math.abs(before.values[i]-after.values[i])<1e-5,'mixed slope contrast jumped at the handover');
  if(forest===1){assert.deepEqual(before.values,[1,1]);assert.deepEqual(after.values,[1,1]);}
  let previous=shade(transition-8,forest);
  for(let frame=1;frame<=960;frame++){
   const current=shade(transition-8+frame/60,forest);
   assert(current.direction.distanceTo(previous.direction)<.005,'dawn/dusk light direction changed abruptly');
   for(let i=0;i<normals.length;i++)assert(Math.abs(current.values[i]-previous.values[i])<.005,'dawn/dusk slope contrast changed abruptly');previous=current;
  }
 }
 release(world);release(joined);
});

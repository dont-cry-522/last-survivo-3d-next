import * as T from './vendor/three.module.js';
import{mergeGeometries}from'./vendor/BufferGeometryUtils.js';
import{sceneryAllowed}from'./biome-scenery.js?v=134';
import{createDiscoveryScenery}from'./discovery-scenery.js?v=135';
export const SMALL_FINDS={
 forest:{name:'蜜露花丛',tip:'靠近花心采集；附近有怪物时先脱离战斗。',xp:6,heal:.12,color:0xb8dc8f},
 snow:{name:'双霜晶',tip:'分别碰触两侧霜晶，点亮后领取。',xp:18,heal:.08,color:0xa5dbea},
 ash:{name:'余烬矿隙',tip:'亮红时灼热，暗下后靠近拾取；无需站在热区等待。',xp:22,heal:0,color:0xf5ad65},
 sand:{name:'风埋行囊',tip:'靠近清理积沙 2.5 秒；敌人或沙暴会暂停，进度保留。',xp:24,heal:0,color:0xdcc187},
 coast:{name:'潮赠贝簇',tip:'退潮时靠近拾贝；涨潮预告和涨潮期间等待。',xp:12,heal:.12,color:0x9bcfc5}
};
const findNames={forest:['采药人的遗篮','林间萤石踪迹'],snow:['远征队的雪橇','风雪引路残片'],ash:['矿工的遗留箱','余烬矿脉碎片'],sand:['旅人的覆沙行李','古道刻石残片'],coast:['沉船漂流物','潮岸贝光踪迹']};
const extraFinds=Object.fromEntries(Object.entries(findNames).map(([id,names])=>[id,{
 cache:{name:names[0],tip:'安全时靠近整理 1.8 秒；离开或遇敌暂停，进度保留。',xp:20,heal:.08,color:SMALL_FINDS[id].color},
 trail:{name:names[1],tip:'依次走近三处微光残片；收齐后获得经验，离开保留进度。',xp:24,heal:0,color:SMALL_FINDS[id].color}
}]));
export function discoveryInfo(n){return extraFinds[n.id]?.[n.variant]||SMALL_FINDS[n.id];}
export function discoveryVariants(id){return[SMALL_FINDS[id],...Object.values(extraFinds[id]||{})];}
export function discoveryThreatened(n,x,z,radius){return Math.hypot(x-n.x,z-n.z)<radius||n.variant==='trail'&&n.nodes.some(p=>Math.hypot(x-p.x,z-p.z)<radius);}
const footprints=new Map();
function dryScenery(w,id,variant,x,z,angle){
 // Shore wreckage may touch the sea. Inland objects must fit wholly on dry land.
 if(id==='coast'||!w.ponds.length)return true;
 const key=id+':'+variant;
 if(!footprints.has(key))footprints.set(key,new T.Box3().setFromObject(createDiscoveryScenery(id,variant)));
 const box=footprints.get(key),c=Math.cos(angle),s=Math.sin(angle),corners=[[box.min.x,box.min.z],[box.max.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z]].map(([dx,dz])=>({x:x+c*dx+s*dz,z:z-s*dx+c*dz}));
 for(const p of w.ponds){
  // The analytic 1.12 envelope contains the irregular shoreline at maximum tide.
  // Checking the full rectangle catches water cutting through its edges/interior.
  const turn=p.angle||0,pc=Math.cos(turn),ps=Math.sin(turn),tide=p.baseRx===undefined?1:1.19,rx=(p.baseRx??p.rx)*tide*1.12,rz=(p.baseRz??p.rz)*tide*1.12;
  const q=corners.map(v=>({x:(pc*(v.x-p.x)-ps*(v.z-p.z))/rx,z:(ps*(v.x-p.x)+pc*(v.z-p.z))/rz})),crosses=[];
  for(let i=0;i<4;i++){
   const a=q[i],b=q[(i+1)%4],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(-(a.x*dx+a.z*dz)/(dx*dx+dz*dz||1),0,1);
   if((a.x+t*dx)**2+(a.z+t*dz)**2<=1)return false;
   crosses.push(a.x*b.z-a.z*b.x);
  }
  if(crosses.every(v=>v>=0)||crosses.every(v=>v<=0))return false;
 }
 return true;
}
// Fit the visual/interaction footprint after placement, without consuming map RNG.
// If no full-size trail fits, try a cache; if that cannot stay dry, keep the native find.
function trailLayout(w,id,x,z){
 const scale=1;for(let i=0;i<16;i++){
  const angle=i*Math.PI/8,c=Math.cos(angle),s=Math.sin(angle),nodes=[[-2.4,0],[0,1.4],[2.4,0]].map(([dx,dz])=>({x:x+(dx*c+dz*s)*scale,z:z+(-dx*s+dz*c)*scale,lit:false}));
  if(nodes.every(p=>sceneryAllowed(w,p.x,p.z)&&w.obstacles.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>o.r+.85))&&dryScenery(w,id,'trail',x,z,angle))return{angle,scale,nodes};
 }
 return null;
}
const cache=new Map(),baseMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.95}),lights=new Map();
function light(color){if(!lights.has(color))lights.set(color,new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.22,roughness:.6}));return lights.get(color);}
const crystalGeometry=new T.OctahedronGeometry(.18),pearlGeometry=new T.SphereGeometry(.10,8,5);
function terrainPiece(id){if(cache.has(id))return cache.get(id);const parts=[],o=new T.Object3D();
 const add=(geometry,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>{if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(rx,ry,rz);o.updateMatrix();geometry.applyMatrix4(o.matrix);const c=new T.Color(color),a=[];for(let i=0;i<geometry.attributes.position.count;i++)a.push(c.r,c.g,c.b);geometry.setAttribute('color',new T.Float32BufferAttribute(a,3));parts.push(geometry);};
 const rock=(c,x,y,z,sx,sy,sz)=>add(new T.DodecahedronGeometry(1,0),c,x,y,z,sx,sy,sz,0,x*.7);
 const stick=(c,x,y,z,length,angle)=>add(new T.CylinderGeometry(.10,.14,1,7),c,x,y,z,1,length,1,Math.PI/2,0,angle);
 if(id==='forest'){
  stick(0x645239,-.35,.12,.3,2.4,.72);stick(0x766147,.55,.10,.65,1.1,-.6);
  for(let i=0;i<12;i++){const a=i*2.4,r=.25+(i%4)*.27,x=Math.sin(a)*r,z=Math.cos(a)*r;rock(i%2?0x53784d:0x70975a,x,.11,z,.35,.12,.26);add(new T.ConeGeometry(.08,.42,5),0x7b9d64,x,.27,z,1,1,1,0,a,.3);rock(i%3?0xb3cba5:0xe5d6ac,x,.46,z,.12,.065,.10);}
 }else if(id==='snow'){
  for(let i=0;i<7;i++){const a=i*2.4;rock(0xc5d9dd,Math.sin(a)*.8,.05,Math.cos(a)*.6,.58,.10,.32);}
  for(const s of[-1,1]){rock(0x829aa1,s*1.25,.20,0,.43,.30,.4);add(new T.ConeGeometry(.22,.7,5),0x8eb9c9,s*1.25,.65,0,1,1,1,.12,0,s*.12);}
 }else if(id==='ash'){
  for(let i=0;i<8;i++){const a=i*2.4,r=.40+(i%3)*.3;rock(i%2?0x413b3b:0x66504a,Math.sin(a)*r,.15,Math.cos(a)*r,.36,.24,.32);}
  stick(0x302e2c,.65,.10,.25,1.6,.5);for(let i=0;i<6;i++)rock(0x9e5d3d,Math.sin(i*2.4)*.5,.06,Math.cos(i*2.4)*.4,.11,.055,.14);
 }else if(id==='sand'){
  rock(0xbda67d,-.2,.06,0,1.5,.08,.9);add(new T.BoxGeometry(1,1,1),0x827055,.1,.18,.15,.75,.35,.5,0,.35,-.12);stick(0x72624b,-.6,.12,-.2,1.8,.8);
  add(new T.CylinderGeometry(.32,.24,.48,10,1,true),0xb98c5d,.55,.20,-.45,1,1,1,.3,0,.4);for(let i=0;i<6;i++)rock(0x997b55,Math.sin(i*2.3)*1.1,.04,Math.cos(i*2.3)*.7,.12,.06,.16);
 }else{
  stick(0x9e9478,-.15,.12,.5,2.3,.35);stick(0x7d765f,-.5,.08,.2,1.2,-.8);
  for(let i=0;i<9;i++){const a=i*2.4,r=.3+(i%3)*.3,x=Math.sin(a)*r,z=Math.cos(a)*r;add(new T.SphereGeometry(1,8,5),i%2?0xd6c9aa:0xafa78d,x,.06,z,.18,.055,.14,0,a);if(i%3===0)add(new T.ConeGeometry(.10,.35,4),0x5b7864,x,.19,z,1,1,1,.2,a,.3);}
 }
 const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());cache.set(id,result);return result;
}
export function installDiscoveries(w,id,rnd){
 w.discoveries=[];for(let i=0;i<(w.regional?3:5);i++)for(let attempt=0;attempt<700;attempt++){
  const a=rnd()*Math.PI*2,r=(i<3?18+i*18:66+(i-3)*14)+rnd()*12;let x=w.spawn.x+Math.sin(a)*r,z=w.spawn.z+Math.cos(a)*r;
  if(id==='coast'&&w.ponds.length){const p=w.ponds[Math.floor(rnd()*w.ponds.length)],dx=Math.sin(a)*((p.baseRx||p.rx)*1.19+1.8),dz=Math.cos(a)*((p.baseRz||p.rz)*1.19+1.8),turn=p.angle||0;x=p.x+Math.cos(turn)*dx+Math.sin(turn)*dz;z=p.z-Math.sin(turn)*dx+Math.cos(turn)*dz;}
  if(id==='coast'&&!w.regional){const distance=Math.hypot(x-w.spawn.x,z-w.spawn.z);if(i===0&&distance>45||i>=3&&distance<(i===3?55:70))continue;}
  if(w.coastLayout?.fords.some(f=>{const c=Math.cos(f.angle),s=Math.sin(f.angle),dx=x-f.x,dz=z-f.z;return Math.abs(c*dx-s*dz)<f.half+2&&Math.abs(s*dx+c*dz)<f.width/2+2;}))continue;
  if(!sceneryAllowed(w,x,z)||w.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+3.2)||w.sites.some(s=>Math.hypot(x-s.x,z-s.z)<11)||w.discoveries.some(n=>Math.hypot(x-n.x,z-n.z)<15))continue;
  const layout=i===1?trailLayout(w,id,x,z):null;let variant=i===1?(layout?'trail':'cache'):i===2?'cache':'native',angle=layout?.angle??(id==='snow'?0:a);
  if(variant==='cache'){
   const startAngle=angle;let dry=false;
   for(let turn=0;turn<16;turn++){angle=startAngle+turn*Math.PI/8;if(dryScenery(w,id,variant,x,z,angle)){dry=true;break;}}
   if(!dry){variant='native';angle=id==='snow'?0:a;}
  }
  const mesh=new T.Group();mesh.position.set(x,0,z);
  const base=variant==='native'?new T.Mesh(terrainPiece(id),baseMaterial):createDiscoveryScenery(id,variant);
  base.rotation.y=angle;if(layout)base.scale.setScalar(layout.scale);base.receiveShadow=true;mesh.add(base);
  const nodes=layout?.nodes??(variant==='native'&&id==='snow'?[-1.25,1.25].map(dx=>({x:x+dx,z,lit:false})):[]);
  const markers=(nodes.length?nodes:[{x,z}]).map(n=>{const m=new T.Mesh(id==='coast'?pearlGeometry:crystalGeometry,light(SMALL_FINDS[id].color));m.position.set(n.x-x,variant==='trail'?.20:variant==='cache'?.36:id==='snow'?.98:id==='forest'?.55:.25,n.z-z);m.visible=false;mesh.add(m);return m;});
  mesh.visible=variant!=='native';w.group.add(mesh);w.discoveries.push({id,variant,x,z,mesh,markers,nodes,availableAt:10+i*35,discovered:false,claimed:false,progress:0,phase:rnd()*8});break;
 }
}
export function advanceDiscovery(n,dt,{time,player,contested=false,tide,sandstorm}){
 const result={found:false,complete:false};if(n.claimed||dt<=0||time<n.availableAt)return result;
 const distance=Math.hypot(player.x-n.x,player.z-n.z);if(!n.discovered&&distance<9){n.discovered=true;result.found=true;}if(!n.discovered)return result;
 n.blocked=n.id==='ash'&&(time+n.phase)%8>=4||n.id==='coast'&&!!(tide?.high||tide?.warning)||n.id==='sand'&&!!(sandstorm?.active||sandstorm?.warning);
 if(contested||n.blocked)return result;
 if(n.variant==='trail'){const p=n.nodes[n.progress];if(p&&Math.hypot(player.x-p.x,player.z-p.z)<.85){p.lit=true;n.progress++;result.node=true;}n.claimed=n.progress===n.nodes.length;}
 else if(n.variant==='cache'){if(distance<1.7){n.progress=Math.min(1.8,n.progress+dt);n.claimed=n.progress>=1.8;}}
 else if(n.id==='snow'){for(const p of n.nodes)if(Math.hypot(player.x-p.x,player.z-p.z)<.85)p.lit=true;n.progress=n.nodes.filter(p=>p.lit).length;if(n.progress===2)n.claimed=true;}
 else if(distance<1.7){if(n.id==='sand'){n.progress=Math.min(2.5,n.progress+dt);n.claimed=n.progress>=2.5;}else n.claimed=true;}
 result.complete=n.claimed;return result;
}
export function discoveryHint(n){const info=discoveryInfo(n);if(n.contested)return info.name+' · 先击退附近怪物';if(n.blocked)return info.name+' · '+({ash:'余烬灼热，暗下再拾取',sand:'等待风息，进度保留',coast:'等待退潮'}[n.id]);return info.name+' · '+(n.variant==='trail'?'循亮点寻找残片 '+n.progress+'/3':n.variant==='cache'?'整理补给 '+Math.floor(n.progress/1.8*100)+'%':n.id==='snow'?'点亮霜晶 '+n.progress+'/2':n.id==='sand'?'清理积沙 '+Math.floor(n.progress/2.5*100)+'%':info.tip);}
export function animateDiscoveries(w,t){for(const n of w.discoveries||[]){n.mesh.visible=n.discovered||n.variant==='cache'||n.variant==='trail';for(const [i,m]of n.markers.entries()){m.visible=n.discovered&&!n.claimed;if(!m.visible)continue;const hot=n.id==='ash'&&(t+n.phase)%8>=4,lit=n.nodes[i]?.lit,waiting=n.variant==='trail'&&i>n.progress;m.material=light(hot?0xe76637:lit?0xe7f6ec:discoveryInfo(n).color);const pulse=(waiting?.48:lit?.68:1)+Math.sin(t*2+n.phase+i)*.08;m.scale.setScalar(pulse);m.rotation.y=t*.3+n.phase;}}}

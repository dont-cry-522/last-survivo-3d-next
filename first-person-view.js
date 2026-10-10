import{WEAPON_OUTLETS}from'./weapon-outlets.js?v=125';
import * as T from './vendor/three.module.js';
import {GRIP_POINTS,SCYTHE_SUPPORT} from './weapon-grips.js?v=128';

import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {weaponGesture,WEAPON_RECOVERY,scythePose} from './weapon-performance.js?v=130';

// Camera-space equipment assembled from the actual weapon plus a small procedural hand rig.
// This is not a new authored arm-animation asset. Layer 1 gets a small depth-correct overlay pass.
const PALETTES={
 scout:[0x344f3e,0x73543a,0xb29159,0xc39879],silver:[0x25354c,0x202a38,0x91acbf,0xe1c5b1],
 wraith:[0x292c38,0x181c26,0x758699,0x8895a3],tide:[0x305f68,0x293e45,0xafad80,0xbe9f84],
 lingya:[0x6e634f,0x594335,0xc9a279,0xe8bda2],wuling:[0x47334f,0x362639,0xb08b69,0xdbbca7],mirage:[0x30213f,0x231c30,0xa49db8,0xdacade]
};
const PROFILES={
 rifle:{type:'gun',width:.85,height:1,depth:.62,x:.38,y:-.48,pitch:.025,support:[0,-.045,.34]},
 shotgun:{type:'gun',width:.85,height:1,depth:.65,x:.38,y:-.49,pitch:.015,support:[0,-.025,.34]},
 crossbow:{type:'bow',width:.87,height:1,depth:.55,x:.30,y:-.46,pitch:.08,support:[0,-.05,.26]},
 fire:{type:'staff',width:.64,height:1.36,depth:.40,x:.64,y:-.25,pitch:.04},
 dark:{type:'staff',width:.64,height:1.36,depth:.40,x:.64,y:-.25,pitch:.04},
 shuriken:{type:'throw',width:.58,height:.85,depth:.44,x:.56,y:-.57,pitch:.60},
 boomerang:{type:'throw',width:.73,height:1,depth:.48,x:.46,y:-.48,pitch:.72},
 shadowblade:{type:'scythe',width:.80,height:1.50,depth:.70,x:-.18,y:-.62,pitch:.12,support:SCYTHE_SUPPORT},
 shade:{type:'palm',width:.42,height:.72,depth:.35,x:.42,y:-.48,pitch:.12},
 grimoire:{type:'book',width:.74,height:.66,depth:.44,x:.01,y:-.47,pitch:.42,grip:[-.15,.01,.065],support:[.16,.01,.065]},
 harpoon:{type:'thrust',width:.76,height:1,depth:1.66,x:.42,y:-.66,pitch:.13,support:[0,0,.36]},
 sporelantern:{type:'lamp',width:.64,height:1.08,depth:.36,x:.58,y:-.40,pitch:.01},
 miasmalantern:{type:'lamp',width:.62,height:1.08,depth:.36,x:.58,y:-.40,pitch:.01}
};
const CONTACT=new T.Vector3(0,.045,-.023),UP=new T.Vector3(0,1,0);
// Screen-relative lowering, pitch and bank. The game owns dodge timing; this is presentation only.
const DODGE_POSES={roll:[.50,-.18,.18,-.04],blink:[.25,-.05,.07,-.08],dive:[.80,-.34,.07,-.10],hop:[.26,-.09,.12,-.025],mist:[.38,-.13,.07,-.05]};
function colored(geometry,color){const c=new T.Color(color),p=geometry.attributes.position,values=[];for(let i=0;i<p.count;i++)values.push(c.r,c.g,c.b);geometry.setAttribute('color',new T.Float32BufferAttribute(values,3));geometry.deleteAttribute('uv');return geometry;}
function handGeometry(palette,fingerless){
 const make=open=>{
  const parts=[];
  // Palm, heel of thumb and knuckle web overlap into a solid glove instead of five hollow loops.
  for(const [scale,position]of[[[.036,.046,.021],[0,.003,0]],[[.027,.028,.018],[0,.019,-.014]],[[.016,.025,.017],[-.026,0,-.006]],[[.032,.012,.013],[0,.036,-.003]]]){
   const pad=new T.SphereGeometry(1,12,8);pad.scale(...scale);pad.translate(...position);parts.push(colored(pad,palette[1]));
  }
  for(let finger=0;finger<5;finger++){
   let points,radius;
   if(finger===4){points=open?[[-.028,-.015,0],[-.046,.003,-.005],[-.057,.022,-.008],[-.060,.030,-.012]]:[[-.028,-.013,0],[-.038,.008,-.018],[-.026,.026,-.035],[-.013,.023,-.038]];radius=.010;}
   else{
    const x=(-1.5+finger)*.0165,length=[.052,.059,.055,.043][finger],spread=open?(finger-1.5)*.008:0;
    points=open?[[x,.028,0],[x+spread*.4,.028+length*.4,-.002],[x+spread,.028+length*.78,-.005],[x+spread*1.1,.028+length,-.010]]:[[x,.028,0],[x,.049,-.009],[x,.050,-.026],[x,.027,-.034]];radius=finger===3?.008:.009;
   }
   const g=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),8,radius,7,false);colored(g,palette[1]);
   if(fingerless){const c=new T.Color(palette[3]),colors=g.attributes.color;for(let i=5*8;i<colors.count;i++)colors.setXYZ(i,c.r,c.g,c.b);}
   parts.push(g);const tip=new T.SphereGeometry(radius,7,5);tip.translate(...points.at(-1));parts.push(colored(tip,fingerless?palette[3]:palette[1]));
  }
  const merged=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());return merged;
 };
 const closed=make(false),open=make(true);closed.morphAttributes.position=[open.attributes.position];closed.morphAttributes.normal=[open.attributes.normal];closed.computeBoundingSphere();open.dispose();return closed;
}
function sleeveGeometry(palette){
 const vertices=[],colors=[],indices=[],color=new T.Color(),rings=8,sides=12;
 for(let i=0;i<=rings;i++){
  const t=i/rings,r=.057*(1-t)+.032*t+.008*Math.sin(t*Math.PI),bend=.018*Math.sin(t*Math.PI);
  color.setHex(i>=7?palette[1]:i===6?palette[2]:palette[0]);
  for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,crease=1+.035*Math.sin(a*3+t*9);vertices.push(Math.cos(a)*r*crease+bend,t,Math.sin(a)*r*.84*crease);colors.push(color.r,color.g,color.b);}
 }
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function hullGeometry(rings,directions){
 const p=[],index=[],edge=[[-.35,-.5],[.35,-.5],[.5,-.32],[.5,.32],[.35,.5],[-.35,.5],[-.5,.32],[-.5,-.32]];
 for(let i=0;i<rings.length;i++){const [x,y,z,width,height]=rings[i],axis=directions?.[i];for(const [u,v]of edge)p.push(x+u*width*(axis?.x??1),y+v*height,z+u*width*(axis?.z??0));}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;index.push(a,b,a+8,b,b+8,a+8);}
 for(const end of[0,rings.length-1]){const n=p.length/3;p.push(...rings[end].slice(0,3));for(let j=0;j<8;j++){const a=end*8+j,b=end*8+(j+1)%8;index.push(...(end?[n,a,b]:[n,b,a]));}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();return g;
}
function crossbowDetail(source,gun){
 if(source.geometry.type!=='BoxGeometry')return null;
 let geometry,name;
 if(source.parent===gun&&source.scale.x>.3){
  const side=Math.sign(source.position.x),curve=new T.CatmullRomCurve3([[0,.11,.42],[side*.16,.115,.463],[side*.32,.118,.432],[side*.44,.11,.36]].map(p=>new T.Vector3(...p))),rings=[],directions=[];
  // Curved tapered spring limbs keep their tips on the original animated string anchors.
  for(let i=0;i<=8;i++){const t=i/8,c=curve.getPoint(t),axis=curve.getTangent(t);rings.push([c.x,c.y,c.z,.040-.025*t,.020-.009*t]);directions.push(new T.Vector3(axis.z,0,-axis.x).normalize());}
  geometry=hullGeometry(rings,directions);
  geometry.applyMatrix4(new T.Matrix4().compose(source.position,source.quaternion,source.scale).invert());name='recurved-limb';
 }else if(source.parent===gun&&(source.scale.z>.3||source.scale.y>.15)){
  geometry=hullGeometry([[0,0,-.5,.76,.78],[0,0,-.30,1,1],[0,.035,.27,.87,.87],[0,.045,.5,.59,.62]]);
  if(source.scale.y>.15)geometry.rotateX(Math.PI/2);name=source.scale.y>.15?'shaped-grip':'beveled-receiver';
 }else if(source.parent===gun.userData.crossbowBolt){
  geometry=new T.CylinderGeometry(.5,.5,1,8);geometry.rotateX(Math.PI/2);name='round-bolt';
 }
 if(geometry)geometry.name='First_person_'+name;return geometry;
}
function closeDetail(source,gun,id){
 if(id==='crossbow')return crossbowDetail(source,gun);
 let geometry;
 if(['rifle','shotgun'].includes(id)&&source.geometry.type==='BoxGeometry'){
  // Keep the authored contact points, but round receiver edges and taper the wooden stock.
  geometry=hullGeometry([[0,0,-.5,.72,.78],[0,0,-.36,1,1],[0,.025,.29,.94,.92],[0,.025,.5,.65,.70]]);
  if(source.scale.y>source.scale.z&&source.scale.y>source.scale.x)geometry.rotateX(Math.PI/2);
  else if(source.scale.x>source.scale.z)geometry.rotateY(Math.PI/2);
  geometry.name='First_person_shaped-firearm';
 }else if(id==='grimoire'&&source.geometry.type==='BoxGeometry'){
  if(source===gun.userData.page){
   // Slightly curled flying sheet, retaining the source page's transform/flip timing.
   geometry=new T.PlaneGeometry(1,1,8,1);geometry.rotateX(-Math.PI/2);
   const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,.14*Math.sin((p.getX(i)+.5)*Math.PI));geometry.computeVertexNormals();geometry.name='First_person_turning-page';
  }else if(source.position.y>.01){
   const sheets=[];for(let i=0;i<5;i++){const sheet=hullGeometry([[0,0,-.5,.97,.12],[0,0,.5,1,.12]]);sheet.translate((i%2)*.007,-.40+i*.20,0);sheets.push(sheet);}
   geometry=mergeGeometries(sheets,false);sheets.forEach(g=>g.dispose());geometry.name='First_person_layered-pages';
  }else{geometry=hullGeometry([[0,0,-.5,.92,.70],[0,0,-.45,1,1],[0,0,.45,1,1],[0,0,.5,.92,.70]]);geometry.name='First_person_bound-cover';}
 }else if(id==='grimoire'&&source.geometry.type==='TubeGeometry'){
  const points=source.geometry.parameters.path.points,sign=Math.sign(points[0].x),z=points[0].z;
  const strokes=Math.abs(z)<.001?[[[sign*.041,z],[sign*.071,z]],[[sign*.138,z],[sign*.170,z]]]:[[[sign*.041,z],[sign*.078,z]],[[sign*.088,z],[sign*.115,z]],[[sign*.127,z],[sign*.161,z]]];
  geometry=pageInk(strokes,.0011);geometry.name='First_person_fine-incantation';
 }else if(id==='shuriken'&&source.geometry.type==='ConeGeometry'){
  const shape=new T.Shape();shape.moveTo(-.063,-.135);shape.lineTo(.062,-.11);shape.lineTo(.007,.145);shape.lineTo(-.018,.02);shape.closePath();
  geometry=new T.ExtrudeGeometry(shape,{depth:.040,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1,steps:1});geometry.translate(0,0,-.02);geometry.name='First_person_ground-throwing-edge';
 }
 return geometry;
}
function pageInk(strokes,width){
 const p=[],indices=[];
 for(const stroke of strokes)for(let i=1;i<stroke.length;i++){
  const [ax,az]=stroke[i-1],[bx,bz]=stroke[i],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),x=-dz/length*width*.5,z=dx/length*width*.5,n=p.length/3;
  p.push(ax-x,.0307,az-z,ax+x,.0307,az+z,bx-x,.0307,bz-z,bx+x,.0307,bz+z);indices.push(n,n+1,n+2,n+2,n+1,n+3);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function detailBatch(){
 const parts=[];
 return{
  add(geometry,color){parts.push(color===undefined?geometry:colored(geometry,color));},
  line(points,radius,color){this.add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(3,points.length*2),radius,5,false),color);},
  stud(x,y,z,r,color){const g=new T.SphereGeometry(r,8,5);g.scale(1,.42,1);g.translate(x,y,z);this.add(g,color);},
  finish(){const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());return g;}
 };
}
export class FirstPersonView {
 constructor(camera){
  this.camera=camera;this.root=new T.Group();this.root.name='First_person_equipment';this.root.layers.set(1);this.root.visible=false;camera.add(this.root);
  this.materials=new Map();this.parts=[];this.ownedGeometry=[];this.gait=0;this.sway=0;this.disposed=false;this.scratch=new T.Vector3();this.wrist=new T.Vector3();this.restRotation=new T.Quaternion();this.elbow=new T.Vector3();this.dodgeBasePosition=new T.Vector3();this.dodgeBaseRotation=new T.Euler();this.scytheContact=new T.Object3D();this.handRotation=new T.Quaternion();
 }
 clear(){
  this.root.clear();for(const material of this.materials.values())material.dispose();for(const geometry of this.ownedGeometry)geometry.dispose();
  this.materials.clear();this.ownedGeometry.length=0;this.parts.length=0;this.weapon=null;this.model=null;this.source=null;this.hero=null;this.hands=[];this.arms=[];this.handPoints=[];this.bowStrings=[];this.charged=[];this.details=[];this.poseReady=false;this.dodgeWeight=0;this.root.visible=false;
 }
 material(source){
  if(this.materials.has(source))return this.materials.get(source);
  const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;
  // Preserve the real material's depth/alpha rules inside the isolated equipment layer.
  m.fog=false;m.clippingPlanes=null;m.clipping=false;m.forceSinglePass=true;
  this.materials.set(source,m);return m;
 }
 copyPart(source){
  // Object3D.clone serializes userData; page/pump/heart references then cease to be meshes.
  // Weapons are ordinary Groups/Meshes, so copy only the render graph and keep a pose map.
  const detail=source.isMesh?closeDetail(source,this.source,this.weaponId):null;if(detail)this.ownedGeometry.push(detail);
  const node=source.isMesh?new T.Mesh(detail||source.geometry,Array.isArray(source.material)?source.material.map(m=>this.material(m)):this.material(source.material)):new T.Group();
  node.name=source.name;node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);node.visible=source.visible;
  node.layers.set(1);node.renderOrder=10000;node.frustumCulled=false;node.castShadow=node.receiveShadow=false;this.parts.push([source,node]);
  for(const child of source.children)node.add(this.copyPart(child));return node;
 }
 addDetail(batch,parent,name,{roughness=.55,metalness=.35,emissive=0,side=T.FrontSide}={}){
  const geometry=batch.finish();geometry.name='First_person_'+name;this.ownedGeometry.push(geometry);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness,metalness,fog:false,side,emissive,emissiveIntensity:.13});this.materials.set(material,material);
  const mesh=new T.Mesh(geometry,material);mesh.name=geometry.name;mesh.layers.set(1);mesh.renderOrder=10000;mesh.frustumCulled=false;parent.add(mesh);this.details.push(mesh);return mesh;
 }
 finishWeapon(){
  const id=this.weaponId,gun=this.source,find=source=>this.parts.find(([s])=>s===source)?.[1];
  if(['rifle','shotgun'].includes(id)){
   const batch=detailBatch();
   for(const z of[-.26,-.21,-.16]){
    batch.line([[-.032,.117,z-.013],[0,.118,z],[.032,.117,z-.013]],.0017,0x9d7650);
   }
   for(const z of[.025,.15,.37])batch.stud(0,.151,z,.009,0xc0bdaf);
   // Recessed ejection-port seam and brass extractor distinguish the receiver from the stock.
   batch.line([[.056,.102,.045],[.058,.106,.15],[.058,.065,.15]],.003,0x10181c);
   batch.line([[.06,.07,.055],[.06,.07,.115]],.004,0xb6a078);
   this.addDetail(batch,this.model,'machined-fittings');
   for(const [source,node]of this.parts)if(node.isMesh&&node.material.isMeshStandardMaterial){const hex=source.material.color.getHex(),wood=[0x5c4a3e,0x624f3d,0x8c6e48].includes(hex);node.material.roughness=wood?.76:.34;node.material.metalness=wood?0:.68;}
  }else if(['fire','dark'].includes(id)){
   const batch=detailBatch(),wrap=[];
   for(let i=0;i<=48;i++){const a=i/48*Math.PI*12;wrap.push([Math.sin(a)*.031,-.18+i/48*.32,.045+Math.cos(a)*.031]);}
   batch.line(wrap,.005,id==='fire'?0x573d2f:0x353044);
   for(const sign of[-1,1])batch.line([[sign*.014,.20,.068],[sign*.022,.35,.065],[sign*.010,.48,.070]],.0025,id==='fire'?0xc2945d:0x908ca5);
   this.addDetail(batch,this.model,'wrapped-staff-inlay',{roughness:.72,metalness:.12});
   for(const [source,node]of this.parts)if(source.geometry?.type==='OctahedronGeometry'){
    node.material.roughness=.24;node.material.metalness=.22;node.material.emissive.copy(node.material.color);this.charged.push({material:node.material,base:.45,power:1.0});
   }
  }else if(id==='grimoire'){
   const batch=detailBatch();
   for(const leaf of gun.children.filter(n=>n.isGroup)){
    // Fine broken script and a small angular seal leave broad areas of quiet parchment.
    const sign=Math.sign(leaf.rotation.z),local=detailBatch();
    const strokes=[];
    for(const [row,z]of[-.100,-.046,.046,.100].entries())for(let word=0;word<3;word++){
     const x=.038+word*.047,length=.021+((word+row)%3)*.006;
     strokes.push([[sign*x,z],[sign*(x+length*.64),z],[sign*(x+length*.71),z+.002],[sign*(x+length),z+.002]]);
    }
    strokes.push([[sign*.178,-.105],[sign*.178,.103]],[[sign*.026,-.104],[sign*.026,-.086]]);
    local.add(pageInk(strokes,.00075),0x5c5064);
    local.add(pageInk([[[sign*.104,-.021],[sign*.124,0],[sign*.104,.021],[sign*.084,0],[sign*.104,-.021]],[[sign*.096,-.008],[sign*.112,0],[sign*.096,.008]],[[sign*.104,-.028],[sign*.104,-.024]],[[sign*.104,.024],[sign*.104,.028]]],.001),0x493e52);
    for(const z of[-.116,.116])local.line([[sign*.18,.010,z],[sign*.217,.011,z],[sign*.217,.011,z-Math.sign(z)*.027]],.004,0x777a84);
    const g=local.finish();g.applyMatrix4(new T.Matrix4().compose(leaf.position,leaf.quaternion,leaf.scale));batch.add(g);
   }
   this.addDetail(batch,this.model,'book-corners-and-script',{roughness:.63,metalness:.25});
   for(const [source,node]of this.parts){
    if(source.geometry?.type==='BoxGeometry'){
     if(source.position.y>.01){node.material.color.setHex(source===gun.userData.page?0xaaa2b0:0x8b8392);node.material.roughness=.95;node.material.metalness=0;}
     if(source===gun.userData.page){node.material.side=T.DoubleSide;node.material.needsUpdate=true;}
    }else if(source.geometry?.type==='TubeGeometry'){node.material.color.setHex(0x5c5064);node.material.toneMapped=true;}
   }
  }else if(['sporelantern','miasmalantern'].includes(id)){
   const mist=id==='miasmalantern',heart=find(gun.userData.heart),batch=detailBatch();
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5,r=mist?.081:.115,y=mist?-.196:-.240;batch.stud(Math.sin(a)*r,y,Math.cos(a)*r,.011,mist?0xa6a1b7:0xd7b671);}
   this.addDetail(batch,this.model,'lantern-rivets',{roughness:.31,metalness:.7});
   if(heart){
    const filaments=detailBatch();
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3,points=[];for(let j=0;j<=8;j++){const t=j/8,y=-.78+t*1.5,r=Math.sqrt(Math.max(0,1-y*y))*1.013;points.push([Math.sin(a+t*.9)*r,y,Math.cos(a+t*.9)*r]);}filaments.line(points,.019,mist?0xd0b6ea:0xffd494);}
    const detail=this.addDetail(filaments,heart,'lantern-core-filaments',{roughness:.4,metalness:.1,emissive:mist?0x65457d:0x7d4421});
    heart.material.roughness=.29;heart.material.emissive.copy(heart.material.color);this.charged.push({material:heart.material,base:.20,power:.75},{material:detail.material,base:.15,power:.35});
   }
  }else if(id==='boomerang'){
   const batch=detailBatch();
   for(const sign of[-1,1])for(let i=0;i<3;i++){const x=sign*(.16+i*.075),z=.008+i*.064;batch.line([[x-sign*.017,.030,z-.012],[x,.031,z+.015],[x+sign*.017,.030,z+.005]],.0023,0x8a7047);}
   this.addDetail(batch,this.model,'bone-carving',{roughness:.89,metalness:0});
  }
 }
 setHero(hero,weaponId){
  if(this.disposed)return;this.clear();this.hero=hero;this.weaponId=weaponId;this.profile=PROFILES[weaponId]||PROFILES.rifle;this.source=hero?.userData?.gun||hero?.userData?.weapon;
  if(!this.source)return;
  this.weapon=new T.Group();this.weapon.name='First_person_weapon';this.model=new T.Group();this.weapon.add(this.model);
  for(const child of this.source.children)this.model.add(this.copyPart(child));
  this.finishWeapon();
  this.bowStrings=(this.source.userData.crossbowStrings||[]).map(source=>[source,this.parts.find(([part])=>part===source)?.[1]]);
  this.model.updateMatrixWorld(true);const box=new T.Box3(),partBox=new T.Box3();
  // The bow's unposed string starts as a unit cylinder. Its authored limbs/rail define framing.
  for(const [source,clone]of this.parts)if(clone.isMesh&&!this.source.userData.crossbowStrings?.includes(source)){if(!clone.geometry.boundingBox)clone.geometry.computeBoundingBox();box.union(partBox.copy(clone.geometry.boundingBox).applyMatrix4(clone.matrixWorld));}
  const size=box.getSize(new T.Vector3());
  if(box.isEmpty()){this.clear();return;}
  this.center=box.getCenter(new T.Vector3());this.dimensions=size;
  // A pole is held at the rear hand, not balanced on its bounding-box centre.
  // This leaves the shaft extending both behind the grip and far ahead into perspective.
  if(weaponId==='harpoon')this.center.set(...GRIP_POINTS.harpoon);
  this.model.position.copy(this.center).negate();
  this.grip=new T.Vector3(...(this.profile.grip||GRIP_POINTS[weaponId]||[0,0,0])).sub(this.center);this.root.add(this.weapon);
  const inferred=['shade','shadowblade','grimoire'].includes(weaponId)?'wraith':weaponId==='miasmalantern'?'mirage':weaponId==='sporelantern'?'wuling':weaponId==='boomerang'?'lingya':weaponId==='harpoon'?'tide':['crossbow','shuriken','dark'].includes(weaponId)?'silver':'scout';
  this.kind=hero.userData.kind||inferred;const palette=PALETTES[this.kind]||PALETTES.scout;
  const hand=handGeometry(palette,['scout','lingya','tide','wuling'].includes(this.kind)),sleeve=sleeveGeometry(palette);this.ownedGeometry.push(hand,sleeve);
  const cloth=new T.MeshStandardMaterial({vertexColors:true,roughness:.88,fog:false});this.materials.set(cloth,cloth);
  this.hands=[];this.arms=[];this.handPoints=[this.grip,new T.Vector3(...(this.profile.support||[-.20,-.07,.08])).sub(this.center)];
  for(let i=0;i<2;i++){
   const mesh=new T.Mesh(hand,cloth);mesh.name=i?'First_person_support_hand':'First_person_grip_hand';this.root.add(mesh);this.hands.push(mesh);
   const arm=new T.Mesh(sleeve,cloth);arm.name=i?'First_person_left_sleeve':'First_person_right_sleeve';this.root.add(arm);this.arms.push(arm);
   for(const node of[mesh,arm]){node.layers.set(1);node.renderOrder=10000;node.frustumCulled=false;node.castShadow=node.receiveShadow=false;}
  }
  this.gait=0;this.sway=0;this.attackAge=10;this.previousAttack=0;this.update(0,0,{visible:false});
 }
 poseScythe(object,pose,scale){
  object.scale.setScalar(scale);object.rotation.set(this.profile.pitch,Math.PI-.045,0,'YXZ');this.restRotation.copy(object.quaternion);
  object.position.set(-(pose.x+.20)*.9,(pose.y+.28)*.85,-(pose.z-.28)*.8);
  // Camera framing turns the crescent above the shaft; retain the same action
  // phases without forcing this close-up grip orientation onto the body skeleton.
  object.rotation.set(this.profile.pitch-pose.pitch,Math.PI-.045+Math.PI-pose.yaw,-pose.roll,'YXZ');
  this.scratch.copy(this.grip).multiplyScalar(scale);object.position.add(this.wrist.copy(this.scratch).applyQuaternion(this.restRotation)).sub(this.scratch.applyQuaternion(object.quaternion));
  object.updateMatrix();
 }
 update(time,dt,{moving=0,attack=0,attackDuration=.18,visible=false,dodgePose=null}={}){
  if(this.disposed||!this.weapon)return;this.root.visible=!!visible;
  if(!visible){if(dodgePose===null){this.poseReady=false;this.dodgeWeight=0;}return;}
  const step=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0)),speed=T.MathUtils.clamp(Number(moving)||0,0,1);
  // A paused render may receive a later wall clock or input; never advance the held pose.
  if(step===0&&this.poseReady){
   // Explicit null is cancellation (death/exit), while an active pose stays frozen.
   if(dodgePose===null&&this.dodgeWeight>0){this.root.position.copy(this.dodgeBasePosition);this.root.rotation.copy(this.dodgeBaseRotation);this.dodgeWeight=0;}
   return;
  }
  this.sway+=(speed-this.sway)*(1-Math.exp(-step*10));this.gait+=step*speed*8;
  for(const [source,node]of this.parts){node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);node.visible=source.visible;}
  this.weapon.visible=this.source.visible;
  for(const [source,m]of this.materials){
   if(source===m)continue;m.opacity=source.opacity;
   // Shader strips share geometry but retain independent material/uniform containers.
   if(source.uniforms)for(const [key,uniform]of Object.entries(source.uniforms))if(m.uniforms[key]){const from=uniform.value,to=m.uniforms[key].value;if(to?.copy&&from?.constructor===to.constructor)to.copy(from);else if(typeof from!=='object'||from?.isTexture)m.uniforms[key].value=from;}
  }
  const profile=this.profile,id=this.weaponId,data=this.hero.userData,depth=.82,halfH=Math.tan(T.MathUtils.degToRad(this.camera.fov||50)/2)*depth,halfW=halfH*(this.camera.aspect||1);
  const scale=Math.min(halfW*profile.width/Math.max(.001,this.dimensions.x),halfH*profile.height/Math.max(.001,this.dimensions.y),profile.depth/Math.max(.001,this.dimensions.z),id==='harpoon'?.65:id==='shade'?1.8:2.4);
  const fired=attack>this.previousAttack+.025;this.previousAttack=attack;this.attackAge=fired?0:this.attackAge+step;
  const age=Number.isFinite(data.attackAge)?data.attackAge:this.attackAge,period=data.reloadDuration||WEAPON_RECOVERY[id]||attackDuration,cycle=Number.isFinite(data.reloadPhase)?data.reloadPhase:Math.min(1,age/period),motion=weaponGesture(id,age,cycle,period),kick=motion.kick,sweep=motion.sweep,draw=motion.draw;
  this.motion=motion;
  // Only the existing crystal/lantern core brightens; no extra light or screen-sized halo.
  for(const charged of this.charged)charged.material.emissiveIntensity=charged.base+charged.power*Math.min(1,motion.gather+kick*.60);
  // Third-person string posing begins only in the aiming layer. Before that, its
  // authored unit cylinders are not a valid bow pose; initialize only the clones.
  for(let i=0;i<this.bowStrings.length;i++){
   const [source,clone]=this.bowStrings[i];
   if(!clone||source.position.lengthSq()>1e-10||Math.abs(source.scale.y-1)>1e-6)continue;
   this.wrist.set(i?.44:-.44,.11,.36);this.scratch.set(0,.12,.29-.34*draw).sub(this.wrist);
   clone.position.copy(this.wrist).addScaledVector(this.scratch,.5);clone.scale.y=this.scratch.length();clone.quaternion.setFromUnitVectors(UP,this.scratch.normalize());
  }
  this.root.position.set(halfW*profile.x*(this.camera.aspect<.8?.88:1)+Math.sin(this.gait)*.009*this.sway,halfH*profile.y+Math.cos(this.gait*2)*.005*this.sway,-depth);
  this.root.rotation.set(0,0,Math.sin(this.gait)*.010*this.sway);
  this.weapon.scale.setScalar(scale);this.weapon.position.set(0,0,0);this.weapon.rotation.set(profile.pitch,Math.PI-.045,0);
  if(profile.type==='gun'||profile.type==='bow'){
   this.weapon.position.z=kick*(id==='shotgun'?.075:.035);this.weapon.rotation.x+=kick*(id==='shotgun'?.17:.075);this.weapon.rotation.z-=draw*.045;
  }else if(profile.type==='thrust'){
   // Aim the distant fork inward from the rear-hand position. Narrow screens retain
   // that perspective instead of rotating the entire two-metre pole across the view.
   this.weapon.rotation.y=Math.PI+Math.atan2(halfW*profile.x*.72,1.6*scale);
   const combo=data.harpoonCombo||0,gather=motion.gather;
   if(combo===1){
    this.weapon.position.set(-.18*motion.cut,.025*kick,-.15*kick+.06*gather);
    this.weapon.rotation.y-=.45*motion.cut;this.weapon.rotation.z=-.11*sweep;this.weapon.rotation.x+=.035*kick;
   }else if(combo===2){
    this.weapon.position.set(-.035*sweep,.035*kick-.035*sweep,-.16*kick+.095*sweep);this.weapon.rotation.x-=.09*sweep;
   }else{this.weapon.position.set(-.025*kick,.018*kick,-.27*kick+.04*gather);this.weapon.rotation.x-=.02*kick;}
   this.weapon.position.x+=.035*motion.recover;this.weapon.position.y-=.025*motion.recover;
  }else if(profile.type==='scythe'){
   this.poseScythe(this.weapon,scythePose(age,period,data.scytheCombo||0),scale);
  }else if(profile.type==='throw'){
   const flick=id==='shuriken',bank=id==='boomerang';
   this.weapon.position.set(-(bank?.14:.075)*sweep,(flick?.025:.055)*kick,-(flick?.14:.11)*kick);
   this.weapon.rotation.z=-sweep*(flick?1.05:bank?.48:.70);this.weapon.rotation.x-=kick*(flick?.18:bank?.25:.38);this.weapon.rotation.y+=sweep*(bank?.28:0);
  }else if(profile.type==='lamp'){
   this.weapon.rotation.z=Math.sin((Number(time)||0)*1.7)*(.035+.025*this.sway)+sweep*.20;this.weapon.position.set(-sweep*.035,kick*.085,-kick*.055);
  }else if(profile.type==='book'){
   this.weapon.rotation.x+=kick*.10;this.weapon.rotation.z=Math.sin((Number(time)||0)*1.8)*.018;this.weapon.position.y=kick*.035;
  }else{
   this.weapon.rotation.x-=kick*(id==='fire'?.27:.20);this.weapon.rotation.z=sweep*(id==='dark'?-.16:.10);this.weapon.position.z=-kick*.065;
   if(profile.type==='staff')this.weapon.position.y=motion.gather*.018;
  }
  const meleeTarget=id==='harpoon'?data.harpoonTarget:id==='shadowblade'?data.scytheTarget:null;
  if(meleeTarget&&age<Math.min(WEAPON_RECOVERY[id],period*.9)){
   // Match the visible fork to the committed hit's screen position. The held rig
   // has its own depth layer; copying full world distance would stretch the arms.
   const hit=id==='harpoon'?.34:.44,u=age/Math.min(WEAPON_RECOVERY[id],Math.max(.12,period*.9)),ease=(a,b)=>{const q=T.MathUtils.clamp((u-a)/(b-a),0,1);return q*q*(3-2*q);},drive=ease(.08,hit)*(1-ease(hit+.12,.96));
   this.weapon.position.z-=drive*(id==='shadowblade'?.12:data.harpoonCombo===1?.22:.45);
   this.weapon.updateMatrix();
   // Calibrate the scythe once at its contact phase, not at every current pose.
   // Chasing the target with the current blade cancelled the lateral cutting arc.
   let contactMatrix=this.weapon.matrix;
   if(id==='shadowblade'){
    this.poseScythe(this.scytheContact,scythePose(Math.min(WEAPON_RECOVERY[id],Math.max(.12,period*.9))*hit,period,data.scytheCombo||0),scale);
    this.scytheContact.position.z-=.12;this.scytheContact.updateMatrix();contactMatrix=this.scytheContact.matrix;
   }
   this.scratch.set(...(id==='harpoon'?[0,0,1.75]:[.78,.54,.045])).sub(this.center).applyMatrix4(contactMatrix).applyQuaternion(this.root.quaternion).add(this.root.position);
   this.camera.updateWorldMatrix(true,false);this.wrist.set(meleeTarget.x,meleeTarget.y,meleeTarget.z);this.camera.worldToLocal(this.wrist);
   if(this.wrist.z<-.3&&Math.abs(this.wrist.x/this.wrist.z)<halfW/depth*1.1&&Math.abs(this.wrist.y/this.wrist.z)<halfH/depth*1.1){const ratio=this.scratch.z/this.wrist.z,dx=this.wrist.x*ratio-this.scratch.x,dy=this.wrist.y*ratio-this.scratch.y,c=Math.cos(this.root.rotation.z),s=Math.sin(this.root.rotation.z);this.weapon.position.x+=(dx*c+dy*s)*drive;this.weapon.position.y+=(dy*c-dx*s)*drive;}
  }
  this.weapon.updateMatrix();
  const handScale=T.MathUtils.clamp(halfW/.29,.66,1.10),support=!!profile.support;
  for(let i=0;i<2;i++){
   const hand=this.hands[i],arm=this.arms[i],point=this.scratch.copy(this.handPoints[i]);
   if(i&&id==='shotgun')point.z+=this.source.userData.pump?.position.z||0;
   if(i&&id==='crossbow')point.lerp(this.wrist.set(.085,.13,.30-.28*draw).sub(this.center),Math.min(1,draw*2.2));
   point.applyMatrix4(this.weapon.matrix);
   if(i&&!support)point.set(-halfW*.48-this.root.position.x,-halfH*.72-this.root.position.y+kick*.045,.11-kick*.06);
   hand.rotation.set(i?(support?-.30:-.45):-.18,i?-.20:.12,i?(support?-.38:.18):-.38);
   if(profile.type==='book')hand.rotation.set(-.75,i?-.20:.20,i?.55:-.55);
   if(profile.type==='lamp'&&!i)hand.rotation.set(-.12,0,-.92);
   if(profile.type==='palm'&&!i)hand.rotation.set(-.52,.10,-.08);
   if(id==='shadowblade'){this.handRotation.setFromEuler(new T.Euler(-.18,-Math.PI,i?.38:-.38));hand.quaternion.copy(this.weapon.quaternion).multiply(this.handRotation);}
   if(id==='harpoon')hand.rotation.set(-.10,(i?-1:1)*Math.PI/2+this.weapon.rotation.y-Math.PI,i?.35:-.35);
   hand.scale.set(i?-handScale:handScale,handScale,handScale);
   hand.position.copy(point).sub(this.wrist.copy(CONTACT).multiply(hand.scale).applyQuaternion(hand.quaternion));
   hand.morphTargetInfluences[0]=i&&!support?.72+.20*kick:profile.type==='palm'?.78+.18*kick:profile.type==='book'?.48:profile.type==='throw'?Math.max(kick*.90,this.source.visible?0:.88):i&&id==='crossbow'?draw*.40:0;
   // The arms remain after a thrown weapon leaves the hand; only the source weapon is hidden.
   hand.visible=arm.visible=true;
   this.wrist.set(0,-.038,0).multiply(hand.scale).applyQuaternion(hand.quaternion).add(hand.position);
   this.elbow.set(halfW*(i?-.30:.66)-this.root.position.x,-halfH*1.15-this.root.position.y,.35);
   if(id==='harpoon'||id==='shadowblade'){this.elbow.x+=(i?-.035:.06)*motion.cut;this.elbow.y+=.025*motion.gather;this.elbow.z-=.055*kick;}
   if(id==='shadowblade')this.elbow.z-=.12;
   arm.position.copy(this.elbow);this.scratch.copy(this.wrist).sub(this.elbow);const length=this.scratch.length();
   arm.quaternion.setFromUnitVectors(UP,this.scratch.normalize());arm.scale.set(handScale,length,handScale);
  }
  const finite=x=>Number.isFinite(x)?x:0,weight=T.MathUtils.clamp(finite(dodgePose?.weight),0,1),w=weight*weight*(3-2*weight),pose=DODGE_POSES[dodgePose?.kind]||DODGE_POSES.roll,side=T.MathUtils.clamp(finite(dodgePose?.side),-1,1),forward=T.MathUtils.clamp(finite(dodgePose?.forward),-1,1);
  // Transform the completed equipment/hand rig together, so both contacts survive all dodges.
  this.dodgeBasePosition.copy(this.root.position);this.dodgeBaseRotation.copy(this.root.rotation);this.dodgeWeight=weight;
  this.root.position.x-=halfW*.055*side*w;this.root.position.y-=halfH*pose[0]*w;this.root.position.z+=pose[3]*w;
  this.root.rotation.x=(pose[1]-.025*forward)*w;this.root.rotation.z+=pose[2]*side*w;
  this.poseReady=true;
 }

 launchPoint(target=new T.Vector3()){
  const point=WEAPON_OUTLETS[this.weaponId];if(!point||!this.model||!this.poseReady)return null;
  this.model.updateWorldMatrix(true,false);return this.model.localToWorld(target.set(...point));
 }
 render(renderer,scene){
  if(this.disposed||!this.root.visible||!this.weapon)return;
  const mask=this.camera.layers.mask,background=scene.background,autoClear=renderer.autoClear;
  try{this.camera.layers.set(1);scene.background=null;renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,this.camera);}
  finally{this.camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear;}
 }
 dispose(){if(this.disposed)return;this.clear();this.root.removeFromParent();this.disposed=true;}
}

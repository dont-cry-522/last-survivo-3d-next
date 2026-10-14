import{WEAPON_OUTLETS}from'./weapon-outlets.js?v=195';
import * as T from './vendor/three.module.js';
import {GRIP_POINTS,SCYTHE_SUPPORT} from './weapon-grips.js?v=195';
import {finishShadowTone,SHADOW_PALETTE} from './shadow-appearance.js?v=195';
import {sporePod} from './wuling-appearance.js?v=195';
import {poseSlingshot} from './slingshot-model.js';

import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {weaponGesture,WEAPON_RECOVERY,scythePose,crossbowMechanism} from './weapon-performance.js?v=195';

// Camera-space equipment assembled from the actual weapon plus a small procedural hand rig.
// This is not a new authored arm-animation asset. Layer 1 gets a small depth-correct overlay pass.
const PALETTES={
 scout:[0x4c654c,0x593f2b,0x94815b,0xc39879],silver:[0x304455,0x192633,0xb0c5ce,0xe1c5b1],
 wraith:[SHADOW_PALETTE.cloth,SHADOW_PALETTE.leather,SHADOW_PALETTE.ivory,SHADOW_PALETTE.soul],tide:[0x4f7387,0x253c4c,0x7c99a5,0xbe9f84],
 lingya:[0xf2e8d5,0x76503b,0xa65f42,0xefbda1],wuling:[0x352339,0x322730,0x927955,0xdbbca7],mirage:[0x1e2331,0x202430,0xa9b4c4,0xdacade]
};
const PROFILES={
 rifle:{type:'gun',width:.85,height:1,depth:.62,x:.38,y:-.48,pitch:.025,support:[0,-.045,.34]},
 shotgun:{type:'gun',width:.85,height:1,depth:.65,x:.38,y:-.49,pitch:.015,support:[0,-.025,.34]},
 crossbow:{type:'bow',width:.87,height:1,depth:.55,x:.30,y:-.46,pitch:.08,support:[0,-.05,.18]},
 fire:{type:'staff',width:.64,height:1.36,depth:.40,x:.64,y:-.25,pitch:.04},
 dark:{type:'staff',width:.64,height:1.36,depth:.40,x:.64,y:-.25,pitch:.04},
 shuriken:{type:'throw',width:.58,height:.85,depth:.44,x:.56,y:-.57,pitch:.60},
 boomerang:{type:'sling',width:.68,height:.94,depth:.55,x:.34,y:-.49,pitch:.04,support:[0,.22,-.07]},
 shadowblade:{type:'scythe',width:.60,height:1.16,depth:.70,x:.42,y:-.80,pitch:.12,support:SCYTHE_SUPPORT},
 // The small rift floats above the fingertips, rather than an oversized hidden glove.
 shade:{type:'palm',width:.42,height:.72,depth:.35,x:.42,y:-.43,pitch:.12,grip:[0,.085,.07]},
 grimoire:{type:'book',width:.74,height:.66,depth:.44,x:.01,y:-.47,pitch:.42,grip:[-.15,.01,.065],support:[.16,.01,.065]},
 harpoon:{type:'thrust',width:1.16,height:1,depth:1.66,x:.42,y:-.66,pitch:.13,support:[0,0,.36]},
 sporelantern:{type:'lamp',width:.64,height:1.08,depth:.36,x:.58,y:-.40,pitch:.01},
 miasmalantern:{type:'lamp',width:.62,height:1.08,depth:.36,x:.58,y:-.40,pitch:.01}
};
const CONTACT=new T.Vector3(0,.045,-.023),UP=new T.Vector3(0,1,0);
// Screen-relative lowering, pitch and bank. The game owns dodge timing; this is presentation only.
const DODGE_POSES={roll:[.50,-.18,.18,-.04],blink:[.25,-.05,.07,-.08],dive:[.80,-.34,.07,-.10],hop:[.26,-.09,.12,-.025],mist:[.38,-.13,.07,-.05]};
function colored(geometry,color){const c=new T.Color(color),p=geometry.attributes.position,values=[];for(let i=0;i<p.count;i++)values.push(c.r,c.g,c.b);geometry.setAttribute('color',new T.Float32BufferAttribute(values,3));geometry.deleteAttribute('uv');return geometry;}
function handGeometry(palette,fingerless,grip='handle'){
 const make=(open,trigger=false)=>{
  const parts=[];
  // Palm, heel of thumb and knuckle web overlap into a solid glove instead of five hollow loops.
  for(const [scale,position]of[[[.036,.046,.021],[0,.003,0]],[[.027,.028,.018],[0,.019,-.014]],[[.016,.025,.017],[-.026,0,-.006]],[[.032,.012,.013],[0,.036,-.003]]]){
   const pad=new T.SphereGeometry(1,12,8);pad.scale(...scale);if(grip!=='handle')pad.scale(1,1,.90);pad.translate(...position);parts.push(colored(pad,palette[1]));
  }
  for(let finger=0;finger<5;finger++){
   let points,radius;
   if(finger===4){points=open?[[-.028,-.015,0],[-.046,.003,-.005],[-.057,.022,-.008],[-.060,.030,-.012]]:[[-.028,-.013,0],[-.038,.008,-.018],[-.026,.026,-.035],[-.013,.023,-.038]];radius=.010;}
   else{
    const x=(-1.5+finger)*.0165,length=[.052,.059,.055,.043][finger],spread=open?(finger-1.5)*.008:0;
    points=open?[[x,.028,0],[x+spread*.4,.028+length*.4,-.002],[x+spread,.028+length*.78,-.005],[x+spread*1.1,.028+length,-.010]]:[[x,.028,0],[x,.049,-.009],[x,.050,-.026],[x,.027,-.034]];radius=finger===3?.008:.009;
   }
   // Different objects are held by different fingers. All poses retain the same
   // contact frame and topology, so release blends need no extra mesh or draw call.
   if(!open&&grip==='pinch'){
    if(finger===0)points=[[-.02475,.028,0],[-.020,.067,-.006],[.006,.067,-.024],[.006,.040,-.032]];
    else if(finger===4)points=[[-.028,-.013,0],[-.043,.010,-.015],[-.019,.040,-.041],[-.006,.040,-.032]];
    else{const x=(-1.5+finger)*.0165;points=[[x,.028,0],[x+.003,.061,-.005],[x+.005,.067,-.023],[x+.006,.045,-.040]];}
   }else if(!open&&grip==='cup'){
    if(finger===4)points=[[-.028,-.013,0],[-.046,.010,-.016],[-.044,.038,-.044],[-.025,.046,-.057]];
    else{const x=(-1.5+finger)*.0165,splay=(finger-1.5)*.004,l=[.048,.057,.052,.039][finger];points=[[x,.028,0],[x+splay,.028+l*.7,-.008],[x+splay,.028+l,-.036],[x+splay*.7,.028+l*.7,-.056]];}
   }else if(!open&&grip==='hook'){
    if(finger===4)points=[[-.028,-.013,0],[-.039,.011,-.017],[-.027,.036,-.029],[-.013,.034,-.033]];
    else{const x=(-1.5+finger)*.0165,drop=finger===3?.006:0;points=[[x,.028,0],[x,.066-drop,-.003],[x,.066-drop,-.025],[x,.042-drop,-.039]];}
   }else if(!open&&grip==='trigger'){
    // Only the index squeezes: the other fingers stay wrapped around the stock.
    if(finger===0)points=[[-.02475,.028,0],[-.030,.065,-.006],[-.022,.071,-.026],[-.010,.056-(trigger?.007:0),-.038+(trigger?.006:0)]];
   }else if(!open&&['shaft','guide'].includes(grip)){
    if(finger===4)points=[[-.028,-.013,0],[-.039,.008,-.018],[-.028,.036,-.038],[-.014,.035,-.041]];
    else{const x=(-1.5+finger)*.0165,drop=finger*.003,guide=grip==='guide'?.004:0;points=[[x,.028,0],[x,.057-drop,-.004],[x,.059-drop+guide,-.027],[x,.034-drop+guide,-.043]];}
   }else if(!open&&['cast','read'].includes(grip)){
    if(finger===4)points=[[-.028,-.013,0],[-.044,.010,-.012],[-.047,.029,-.026],[-.037,.039,-.035]];
    else{const x=(-1.5+finger)*.0165,l=[.045,.055,.050,.036][finger],splay=(finger-1.5)*.003;points=[[x,.028,0],[x+splay,.028+l*.50,-.009],[x+splay,.028+l*.85,-.023],[x+splay*.8,.028+l*(grip==='read'?.95:.65),-.031]];}
   }
   const g=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),8,radius,7,false);colored(g,palette[1]);
   if(fingerless){const c=new T.Color(palette[3]),colors=g.attributes.color;for(let i=5*8;i<colors.count;i++)colors.setXYZ(i,c.r,c.g,c.b);}
   parts.push(g);const tip=new T.SphereGeometry(radius,7,5);tip.translate(...points.at(-1));parts.push(colored(tip,fingerless?palette[3]:palette[1]));
  }
  const merged=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());return merged;
 };
 const closed=make(false),open=make(true);closed.name='SM_Hand_'+grip;closed.morphAttributes.position=[open.attributes.position];closed.morphAttributes.normal=[open.attributes.normal];
 if(grip==='trigger'){const squeezed=make(false,true);closed.morphAttributes.position.push(squeezed.attributes.position);closed.morphAttributes.normal.push(squeezed.attributes.normal);squeezed.dispose();}
 closed.computeBoundingSphere();open.dispose();return closed;
}
// Same elbow/wrist endpoints as the existing hand rig; only the fabric between
// them differs. Cut, fold and cuff profiles make identity visible in first person.
function sleeveGeometry(palette,kind){
 const vertices=[],colors=[],uv=[],indices=[],color=new T.Color(),rings=32,sides=20;
 for(let i=0;i<=rings;i++){
  const t=i/rings,envelope=Math.sin(t*Math.PI),bend=.018*envelope;
  let radius=.057*(1-t)+.032*t,hex=t>.88?palette[1]:palette[0];
  if(kind==='scout'){radius+=.007*envelope;if(t>.52)hex=palette[1];if(t>.52&&t<.59||t>.77&&t<.81){radius+=.0035;hex=palette[2];}}
  else if(kind==='silver'){radius*=.90;radius+=.003*envelope;if(t>.62)hex=palette[1];if(t>.81&&t<.85){radius+=.002;hex=palette[2];}}
  else if(kind==='wraith'){radius+=.014*envelope**2;if(t>.79&&t<.82){radius+=.0015;hex=palette[2];}else if(t>=.82)hex=palette[1];}
  else if(kind==='tide'){if(t<.51)radius+=.009*envelope;else if(t<.62){radius+=.013*Math.sin((t-.51)/.11*Math.PI);hex=palette[2];}else if(t<.86){radius*=.91;hex=palette[3];}else hex=palette[1];}
  else if(kind==='lingya'){if(t<.24){radius+=.016*Math.sin(t/.24*Math.PI);hex=t>.19?palette[2]:palette[0];}else if(t<.86){radius*=.90;hex=palette[3];}else{radius+=.0015;hex=t<.90?palette[2]:palette[1];}}
  else if(kind==='wuling'){radius+=.008*envelope+.008*Math.exp(-(((t-.83)/.12)**2));if(t>.72)hex=t<.76||t>.87&&t<.91?palette[2]:palette[1];}
  else if(kind==='mirage'){radius*=.92;radius+=.010*Math.exp(-(((t-.82)/.11)**2));if(t>.72&&t<.88)hex=t>.81&&t<.85?palette[2]:0x353750;}
  color.setHex(hex);
  for(let j=0;j<sides;j++){
   const a=j/sides*Math.PI*2,cloth=!(kind==='tide'&&t>.62&&t<.86||kind==='lingya'&&t>=.24&&t<.86),crease=1+(cloth?.027:0)*envelope*Math.sin(a*5+t*15),cuff=kind==='mirage'?.023*envelope*Math.sin(a*2)*Math.exp(-(((t-.82)/.07)**2)):0;
   vertices.push(Math.cos(a)*radius*crease+bend,t+cuff,Math.sin(a)*radius*.84*crease);colors.push(color.r,color.g,color.b);uv.push(j/sides,t*2.5);
  }
 }
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
 const g=new T.BufferGeometry();g.name='SM_Hero_'+kind+'_FirstPersonSleeve';g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function hullGeometry(rings,directions){
 const p=[],index=[],edge=[[-.35,-.5],[.35,-.5],[.5,-.32],[.5,.32],[.35,.5],[-.35,.5],[-.5,.32],[-.5,-.32]];
 for(let i=0;i<rings.length;i++){const [x,y,z,width,height]=rings[i],axis=directions?.[i];for(const [u,v]of edge)p.push(x+u*width*(axis?.x??1),y+v*height,z+u*width*(axis?.z??0));}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;index.push(a,b,a+8,b,b+8,a+8);}
 for(const end of[0,rings.length-1]){const n=p.length/3;p.push(...rings[end].slice(0,3));for(let j=0;j<8;j++){const a=end*8+j,b=end*8+(j+1)%8;index.push(...(end?[n,a,b]:[n,b,a]));}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();return g;
}
function closeDetail(source,gun,id){
 if(source.userData.identityDetail)return;
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
  // Above the shared bound paper's shallow crown (.03136 at its highest).
  p.push(ax-x,.0317,az-z,ax+x,.0317,az+z,bx-x,.0317,bz-z,bx+x,.0317,bz+z);indices.push(n,n+1,n+2,n+2,n+1,n+3);
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
  this.materials.clear();this.ownedGeometry.length=0;this.parts.length=0;this.weapon=null;this.model=null;this.source=null;this.hero=null;this.pod=null;this.hands=[];this.arms=[];this.handPoints=[];this.bowStrings=[];this.charged=[];this.details=[];this.poseReady=false;this.dodgeWeight=0;this.root.visible=false;
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
   for(const [source,node]of this.parts)if(node.isMesh&&node.material.isMeshStandardMaterial&&!source.userData.identityDetail&&!source.material.userData.identityFinish){const hex=source.material.color.getHex(),wood=[0x5c4a3e,0x624f3d,0x8c6e48].includes(hex);node.material.roughness=wood?.76:.34;node.material.metalness=wood?0:.68;}
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
   for(const leaf of gun.children.filter(n=>n.isGroup&&!n.userData.identityDetail&&!n.userData.identityMotif)){
    // Fine broken script and a small angular seal leave broad areas of quiet parchment.
    const sign=Math.sign(leaf.rotation.z),local=detailBatch();
    const strokes=[];
    for(const [row,z]of[-.100,-.046,.046,.100].entries())for(let word=0;word<3;word++){
     const x=.038+word*.047,length=.021+((word+row)%3)*.006;
     strokes.push([[sign*x,z],[sign*(x+length*.64),z],[sign*(x+length*.71),z+.002],[sign*(x+length),z+.002]]);
    }
    strokes.push([[sign*.178,-.105],[sign*.178,.103]],[[sign*.026,-.104],[sign*.026,-.086]]);
    local.add(pageInk(strokes,.00075),SHADOW_PALETTE.lining);
    local.add(pageInk([[[sign*.104,-.021],[sign*.124,0],[sign*.104,.021],[sign*.084,0],[sign*.104,-.021]],[[sign*.096,-.008],[sign*.112,0],[sign*.096,.008]],[[sign*.104,-.028],[sign*.104,-.024]],[[sign*.104,.024],[sign*.104,.028]]],.001),SHADOW_PALETTE.cloth);
    for(const z of[-.116,.116])local.line([[sign*.18,.010,z],[sign*.217,.011,z],[sign*.217,.011,z-Math.sign(z)*.027]],.004,SHADOW_PALETTE.edge);
    const g=local.finish();g.applyMatrix4(new T.Matrix4().compose(leaf.position,leaf.quaternion,leaf.scale));batch.add(g);
   }
   this.addDetail(batch,this.model,'book-corners-and-script',{roughness:.63,metalness:.25});
   for(const [source,node]of this.parts){
    if(source.userData.identityDetail||source.material?.userData.identityFinish)continue;
    if(source.geometry?.type==='BoxGeometry'){
     if(source.position.y>.01){node.material.roughness=.95;node.material.metalness=0;}
     // The thin moving sheet needs two sides without changing the bound pages
     // that share its source parchment material. Both keep the original colour.
     if(source===gun.userData.page){node.material=this.material(node.material);node.material.side=T.DoubleSide;node.material.needsUpdate=true;}
    }else if(source.geometry?.type==='TubeGeometry')node.material.toneMapped=true;
   }
  }else if(['sporelantern','miasmalantern'].includes(id)){
   const mist=id==='miasmalantern',heart=find(gun.userData.heart),batch=detailBatch();
   const ribs=mist?(gun.userData.petals?.length||4):5;
   for(let i=0;i<ribs;i++){const a=i*Math.PI*2/ribs+(mist?Math.PI/4:0),r=mist?.081:.115,y=mist?-.196:-.240;batch.stud(Math.sin(a)*r,y,Math.cos(a)*r,.011,mist?0xa6a1b7:0xd7b671);}
   this.addDetail(batch,this.model,'lantern-rivets',{roughness:.31,metalness:.7});
   // Keep the actual core's granular spores or folded mist, including its PBR
   // maps. Camera-space copying must not turn both lamps into the same light bulb.
   if(heart)this.charged.push({material:heart.material,base:heart.material.emissiveIntensity,power:mist?.40:.30});
  }
 }
 setHero(hero,weaponId){
  if(this.disposed)return;this.clear();this.hero=hero;this.weaponId=weaponId;this.profile=PROFILES[weaponId]||PROFILES.rifle;this.source=hero?.userData?.gun||hero?.userData?.weapon;
  if(!this.source)return;
  this.weapon=new T.Group();this.weapon.name='First_person_weapon';this.model=new T.Group();this.weapon.add(this.model);
  for(const child of this.source.children)this.model.add(this.copyPart(child));
  this.finishWeapon();
  this.bowStrings=(this.source.userData.crossbowStrings||[]).map(source=>[source,this.parts.find(([part])=>part===source)?.[1]]);
  if(weaponId==='boomerang'&&this.source.userData.pouch){const find=source=>this.parts.find(([part])=>part===source)?.[1],d=this.source.userData;Object.assign(this.model.userData,{pouch:find(d.pouch),bands:d.bands.map(find),projectile:find(d.projectile),bandAnchors:d.bandAnchors});}
  this.model.updateMatrixWorld(true);const box=new T.Box3(),partBox=new T.Box3();
  // The bow's unposed string starts as a unit cylinder. Its authored limbs/rail define framing.
  for(const [source,clone]of this.parts)if(clone.isMesh&&!this.source.userData.crossbowStrings?.includes(source)&&!this.source.userData.bands?.includes(source)&&source.parent!==this.source.userData.pouch){if(!clone.geometry.boundingBox)clone.geometry.computeBoundingBox();box.union(partBox.copy(clone.geometry.boundingBox).applyMatrix4(clone.matrixWorld));}
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
  const fingerless=['scout','lingya','tide','wuling'].includes(this.kind),lamp=this.profile.type==='lamp';
  const type=this.profile.type,rightGrip=lamp?'hook':['gun','bow'].includes(type)?'trigger':['staff','scythe','thrust'].includes(type)?'shaft':type==='throw'?'pinch':type==='book'?'read':type==='palm'?'cast':'handle';
  const hand=handGeometry(palette,fingerless,rightGrip),supportGrip=weaponId==='boomerang'?'pinch':weaponId==='sporelantern'?'cup':lamp?'handle':type==='gun'||type==='bow'||type==='scythe'||type==='thrust'?'guide':type==='book'?'read':type==='staff'?'cast':null;
  const supportHand=supportGrip?handGeometry(palette,fingerless,supportGrip):hand,sleeve=sleeveGeometry(palette,this.kind);this.ownedGeometry.push(hand,sleeve);if(supportHand!==hand)this.ownedGeometry.push(supportHand);
  const cloth=new T.MeshStandardMaterial({vertexColors:true,roughness:.9,fog:false}),glove=new T.MeshStandardMaterial({vertexColors:true,roughness:.67,metalness:.015,fog:false});this.materials.set(cloth,cloth);this.materials.set(glove,glove);
  if(this.kind==='wraith'){finishShadowTone(cloth);finishShadowTone(glove);}
  // Share the real outfit's micro-surface without owning or recoloring its maps.
  let sleeveSurface;hero.userData.model?.traverse(o=>{if(!sleeveSurface&&o.isMesh&&(/Sleeve/i.test(o.geometry.name)||o.userData.wildMistPart==='sleeves'))sleeveSurface=o.material;});
  if(sleeveSurface){cloth.normalMap=sleeveSurface.normalMap;cloth.roughnessMap=sleeveSurface.roughnessMap;cloth.normalScale.copy(sleeveSurface.normalScale);cloth.roughness=sleeveSurface.roughness;}
  cloth.name='MAT_Hero_'+this.kind+'_FirstPersonCloth';glove.name='MAT_Hero_'+this.kind+'_FirstPersonLeather';
  this.hands=[];this.arms=[];this.handPoints=[this.grip,new T.Vector3(...(this.profile.support||[-.20,-.07,.08])).sub(this.center)];
  for(let i=0;i<2;i++){
   const mesh=new T.Mesh(i?supportHand:hand,glove);mesh.name=i?'First_person_support_hand':'First_person_grip_hand';this.root.add(mesh);this.hands.push(mesh);
   const arm=new T.Mesh(sleeve,cloth);arm.name=i?'First_person_left_sleeve':'First_person_right_sleeve';this.root.add(arm);this.arms.push(arm);
   for(const node of[mesh,arm]){node.layers.set(1);node.renderOrder=10000;node.frustumCulled=false;node.castShadow=node.receiveShadow=false;}
  }
  if(weaponId==='sporelantern'){
   // Share the existing held pod's geometry; its cloned materials belong to this view.
   this.pod=new T.Group();this.pod.name='First_person_held_seed_pod';this.pod.position.set(0,.062,-.044);this.pod.scale.setScalar(.78);this.hands[1].add(this.pod);
   for(const child of(hero.userData.sporePod||sporePod()).children)this.pod.add(this.copyPart(child));
  }
  this.gait=0;this.sway=0;this.attackAge=10;this.previousAttack=0;this.update(0,0,{visible:false});
 }
 poseScythe(object,pose,scale){
  object.scale.setScalar(scale);object.rotation.set(this.profile.pitch,Math.PI-.045,0,'YXZ');this.restRotation.copy(object.quaternion);
  object.position.set(-(pose.x+.20)*.9,(pose.y+.28)*.85,-(pose.z-.28)*.8);
  // Hold the socket above the hands, with the hooked tip pointing down-left.
  // Turn around the shaft's own axis; both palms and contact calibration use this same frame.
  object.rotation.set(this.profile.pitch-pose.pitch,Math.PI-.045+Math.PI-pose.yaw,-pose.roll-1.36,'YXZ');
  object.rotateY(Math.PI);
  this.scratch.copy(this.grip).multiplyScalar(scale);object.position.add(this.wrist.copy(this.scratch).applyQuaternion(this.restRotation)).sub(this.scratch.applyQuaternion(object.quaternion));
  object.updateMatrix();
 }
 update(time,dt,{moving=0,strafe=0,yaw=0,pitch=0,attack=0,attackDuration=.18,visible=false,dodgePose=null}={}){
  if(this.disposed||!this.weapon)return;this.root.visible=!!visible;
  if(!visible){if(dodgePose===null){this.poseReady=false;this.dodgeWeight=0;}return;}
  const step=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0)),speed=T.MathUtils.clamp(Number(moving)||0,0,1);
  // A paused render may receive a later wall clock or input; never advance the held pose.
  if(step===0&&this.poseReady){
   // Explicit null is cancellation (death/exit), while an active pose stays frozen.
   if(dodgePose===null&&this.dodgeWeight>0){this.root.position.copy(this.dodgeBasePosition);this.root.rotation.copy(this.dodgeBaseRotation);this.dodgeWeight=0;}
   return;
  }
  const blend=1-Math.exp(-step*12),safeYaw=Number.isFinite(yaw)?yaw:0,safePitch=Number.isFinite(pitch)?pitch:0;
  if(!this.poseReady){this.lastYaw=safeYaw;this.lastPitch=safePitch;this.lookSwayX=this.lookSwayY=this.sideSway=0;}
  // Only the held rig lags a few millimetres. Camera aim and hit direction stay immediate.
  const turn=Math.atan2(Math.sin(safeYaw-this.lastYaw),Math.cos(safeYaw-this.lastYaw));
  this.lookSwayX+=(T.MathUtils.clamp(-turn/Math.max(step,.001)*.006,-.026,.026)-this.lookSwayX)*blend;
  this.lookSwayY+=(T.MathUtils.clamp(-(safePitch-this.lastPitch)/Math.max(step,.001)*.006,-.018,.018)-this.lookSwayY)*blend;
  this.sideSway+=((Number.isFinite(strafe)?T.MathUtils.clamp(strafe,-1,1):0)-this.sideSway)*blend;
  this.lastYaw=safeYaw;this.lastPitch=safePitch;
  this.sway+=(speed-this.sway)*(1-Math.exp(-step*10));this.gait+=step*this.sway*8;
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
  const age=Number.isFinite(data.attackAge)?data.attackAge:this.attackAge,period=data.reloadDuration||WEAPON_RECOVERY[id]||attackDuration,cycle=Number.isFinite(data.reloadPhase)?data.reloadPhase:Math.min(1,age/period),gestureAge=(id==='boomerang'||id==='sporelantern')&&data.shotSerial?cycle*period:age,motion=weaponGesture(id,gestureAge,cycle,period),kick=motion.kick,sweep=motion.sweep,draw=motion.draw;
  this.motion=motion;
  if(id==='boomerang')poseSlingshot(this.model,gestureAge,period);
  // Only the existing crystal/lantern core brightens; no extra light or screen-sized halo.
  for(const charged of this.charged)charged.material.emissiveIntensity=charged.base+charged.power*Math.min(1,motion.gather+kick*.60);
  // Third-person string posing begins only in the aiming layer. Before that, its
  // authored unit cylinders are not a valid bow pose; initialize only the clones.
  for(let i=0;i<this.bowStrings.length;i++){
   const [source,clone]=this.bowStrings[i];
   if(!clone||source.position.lengthSq()>1e-10||Math.abs(source.scale.y-1)>1e-6)continue;
   this.wrist.set(i?.44:-.44,.11,.36);this.scratch.set(0,.16,.29-crossbowMechanism(cycle).pull).sub(this.wrist);
   clone.position.copy(this.wrist).addScaledVector(this.scratch,.5);clone.scale.y=this.scratch.length();clone.quaternion.setFromUnitVectors(UP,this.scratch.normalize());
  }
  const breath=Math.sin((Number(time)||0)*1.65)*.0018*(1-this.sway),settle=1-Math.min(1,motion.kick+motion.gather);
  this.root.position.set(halfW*profile.x*(this.camera.aspect<.8?.88:1)+Math.sin(this.gait)*.009*this.sway+this.lookSwayX-this.sideSway*.012,halfH*profile.y+Math.cos(this.gait*2)*.005*this.sway+this.lookSwayY+breath*settle,-depth);
  this.root.rotation.set(0,0,Math.sin(this.gait)*.010*this.sway-this.sideSway*.018);
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
  }else if(id==='boomerang'){
   // The fork stays braced. The pouch and pulling hand supply the large motion.
   this.weapon.position.set(-.012*draw,.014*draw-.010*kick,.015*kick);this.weapon.rotation.x+=.018*kick;this.weapon.rotation.z=-.025*draw+.018*kick;
  }else if(profile.type==='throw'){
   const flick=id==='shuriken';
   this.weapon.position.set(-.075*sweep,(flick?.025:.055)*kick,-(flick?.14:.11)*kick);
   this.weapon.rotation.z=-sweep*(flick?1.05:.70);this.weapon.rotation.x-=kick*(flick?.18:.38);
  }else if(profile.type==='lamp'){
   const gather=motion.gather,carry=Math.sin((Number(time)||0)*1.7)*(.014+.018*this.sway);
   if(id==='sporelantern'){
    // The right hand carries the lamp; the left hand delivers the seed pod.
    this.weapon.rotation.z=carry+.025*kick;this.weapon.position.set(.008*gather,.012*kick,-.018*kick);
   }else{
    this.weapon.rotation.x+=.065*gather-.15*kick;this.weapon.rotation.z=carry+.035*sweep;
    this.weapon.position.set(.025*gather-.020*kick,.025*gather+.042*kick,.060*gather-.095*kick-.020*sweep);
   }
  }else if(profile.type==='book'){
   this.weapon.rotation.x+=kick*.10;this.weapon.rotation.z=Math.sin((Number(time)||0)*1.8)*.018;this.weapon.position.y=kick*.035;
  }else if(profile.type==='palm'){
   this.weapon.position.set(-.022*motion.gather+.025*kick,.012*motion.gather+.024*kick,.028*motion.gather-.052*kick);
   this.weapon.rotation.x+=.08*motion.gather-.045*kick;this.weapon.rotation.z=-.11*motion.gather+.06*kick;
  }else{
   this.weapon.rotation.x-=kick*(id==='fire'?.27:.20);this.weapon.rotation.z=sweep*(id==='dark'?-.16:.10);this.weapon.position.z=-kick*.065;
   if(profile.type==='staff')this.weapon.position.y=motion.gather*.018;
  }
  const meleeTarget=id==='harpoon'?data.harpoonTarget:id==='shadowblade'?data.scytheTarget:null;
  if(meleeTarget&&age<Math.min(WEAPON_RECOVERY[id],period*.9)){
   // Match the visible fork to the committed hit's screen position. The held rig
   // has its own depth layer; copying full world distance would stretch the arms.
   const hit=id==='harpoon'?.34:.44,u=age/Math.min(WEAPON_RECOVERY[id],Math.max(.12,period*.9)),ease=(a,b)=>{const q=T.MathUtils.clamp((u-a)/(b-a),0,1);return q*q*(3-2*q);},drive=id==='shadowblade'?ease(0,.24)*(1-ease(.68,1)):ease(.08,hit)*(1-ease(hit+.12,.96));
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
   if(i&&id==='crossbow'){const mechanism=crossbowMechanism(cycle);point.lerp(this.wrist.set(.06,.13,.29-mechanism.pull).sub(this.center),mechanism.hand);}
   if(i&&id==='boomerang')point.set(0,.22,-.07-.30*motion.handPull).sub(this.center);
   point.applyMatrix4(this.weapon.matrix);
   if(i&&!support)point.set(-halfW*.48-this.root.position.x,-halfH*.72-this.root.position.y+kick*.045,.11-kick*.06);
   if(i&&id==='sporelantern')point.add(this.wrist.set(-.035*motion.gather+.065*kick,.045*motion.gather+.095*kick-.025*sweep,.065*motion.gather-.135*kick));
   if(i&&id==='miasmalantern')point.add(this.wrist.set(.075*motion.gather+.035*kick,.055*motion.gather+.020*kick,-.025*motion.gather-.045*kick));
   if(i&&profile.type==='palm')point.add(this.wrist.set(.025*motion.gather+.018*kick,halfH*.05+.020*motion.gather+.014*kick,-.014*motion.gather-.030*kick));
   hand.rotation.set(i?(support?-.30:-.45):-.18,i?-.20:.12,i?(support?-.38:.18):-.38);
   if(profile.type==='book')hand.rotation.set(-.75,i?-.20:.20,i?.55:-.55);
   if(profile.type==='lamp'&&!i)hand.rotation.set(-.12,0,-.92);
   if(i&&id==='sporelantern')hand.rotation.set(-.60-.22*motion.gather+.36*kick,-.20+.22*kick,.18-.13*kick);
   if(i&&id==='miasmalantern')hand.rotation.set(-.45-.18*motion.gather,-.20-.15*motion.gather,.18-.16*kick);
   if(i&&id==='boomerang')hand.rotation.set(-.55+.10*motion.open,-.28,.48-.12*motion.open);
   if(profile.type==='palm'&&!i)hand.rotation.set(-.96-.10*motion.gather+.15*kick,.12-.10*motion.gather,-.10+.10*kick);
   if(profile.type==='palm'&&i)hand.rotation.set(-.94-.08*motion.gather+.10*kick,-.22,.20-.08*motion.gather);
   if(profile.type==='staff'&&i)hand.rotation.set(-.52-(id==='fire'?.12:.22)*motion.gather,-.20+(id==='fire'?.12:-.14)*kick,.18+(id==='fire'?-.10:.10)*kick);
   if(profile.type==='book')hand.rotation.x-=.045*motion.sweep;
   if(!i&&(profile.type==='lamp'||id==='boomerang')){
    // Follow the handle's rotation delta, retaining the calibrated resting palm.
    this.restRotation.setFromEuler(new T.Euler(profile.pitch,Math.PI-.045,0)).invert();this.handRotation.copy(this.weapon.quaternion).multiply(this.restRotation);hand.quaternion.premultiply(this.handRotation);
   }
   if(id==='shadowblade'){this.handRotation.setFromEuler(new T.Euler(-.18,-Math.PI,i?.38:-.38));hand.quaternion.copy(this.weapon.quaternion).multiply(this.handRotation);}
   if(id==='harpoon')hand.rotation.set(-.10,(i?-1:1)*Math.PI/2+this.weapon.rotation.y-Math.PI,i?.35:-.35);
   hand.scale.set(i?-handScale:handScale,handScale,handScale);
   hand.position.copy(point).sub(this.wrist.copy(CONTACT).multiply(hand.scale).applyQuaternion(hand.quaternion));
   hand.morphTargetInfluences[0]=i&&!support?.72+.20*kick:profile.type==='palm'?.78+.18*kick:profile.type==='book'?.48:profile.type==='throw'?Math.max(kick*.90,this.source.visible?0:.88):i&&id==='crossbow'?crossbowMechanism(cycle).hand*.24:0;
   if(i&&id==='sporelantern')hand.morphTargetInfluences[0]=.92*motion.open;
   if(id==='boomerang')hand.morphTargetInfluences[0]=i?.80*motion.open:0;
   if(profile.type==='palm')hand.morphTargetInfluences[0]=i?.79-.10*motion.gather+.07*kick:.84-.12*motion.gather+.09*kick;
   if(hand.morphTargetInfluences.length>1)hand.morphTargetInfluences[1]=kick*.85;
   if(profile.type==='staff'&&i)hand.morphTargetInfluences[0]=id==='fire'?.62+.30*kick-.14*motion.gather:.50+.17*kick-.23*motion.gather;
   if(profile.type==='book')hand.morphTargetInfluences[0]=i?.56+.08*motion.sweep:.34+.07*motion.gather;
   // The arms remain after a thrown weapon leaves the hand; only the source weapon is hidden.
   hand.visible=arm.visible=true;
   this.wrist.set(0,-.038,0).multiply(hand.scale).applyQuaternion(hand.quaternion).add(hand.position);
   this.elbow.set(halfW*(i?-.30:.66)-this.root.position.x,-halfH*1.15-this.root.position.y,.35);
   if(i&&id==='sporelantern'){this.elbow.x+=.015*kick-.025*motion.gather;this.elbow.y+=.018*kick;this.elbow.z-=.040*kick;}
   if(i&&id==='boomerang'){this.elbow.x-=.045*motion.handPull;this.elbow.y+=.025*motion.handPull;this.elbow.z+=.065*motion.handPull;}
   if(!i&&id==='miasmalantern'){this.elbow.x+=.018*motion.gather-.025*kick;this.elbow.y+=.015*motion.gather-.018*sweep;this.elbow.z+=.025*motion.gather-.040*kick;}
   if(id==='harpoon'||id==='shadowblade'){this.elbow.x+=(i?-.035:.06)*motion.cut;this.elbow.y+=.025*motion.gather;this.elbow.z-=.055*kick;}
   if(id==='shadowblade')this.elbow.z-=.12;
   arm.position.copy(this.elbow);this.scratch.copy(this.wrist).sub(this.elbow);const length=this.scratch.length();
   arm.quaternion.setFromUnitVectors(UP,this.scratch.normalize());arm.scale.set(handScale,length,handScale);
  }
  if(this.pod)this.pod.visible=motion.podHeld;
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
  const mask=this.camera.layers.mask,background=scene.background,autoClear=renderer.autoClear,autoMatrix=scene.matrixWorldAutoUpdate;
  // The world pass immediately before this overlay updated the whole scene,
  // including the camera's held rig. Layer filtering alone would still compose
  // every tree and monster a second time. No transforms change between passes.
  try{this.camera.layers.set(1);scene.background=null;renderer.autoClear=false;scene.matrixWorldAutoUpdate=false;renderer.clearDepth();renderer.render(scene,this.camera);}
  finally{this.camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear;scene.matrixWorldAutoUpdate=autoMatrix;}
 }
 dispose(){if(this.disposed)return;this.clear();this.root.removeFromParent();this.disposed=true;}
}

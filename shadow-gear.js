import * as T from './vendor/three.module.js';
import {weaponInlay,nameWeapon} from './weapon-identity.js?v=188';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {SHADOW_PALETTE as SHADOW} from './shadow-appearance.js?v=188';

const geometry=new Map(),materials=new Map(),pageInk=new Map();
function part(parent,key,create,color,position=[0,0,0],scale=[1,1,1],glow=false){
 if(!geometry.has(key))geometry.set(key,create());
 const mk=color+':'+glow;if(!materials.has(mk))materials.set(mk,glow?new T.MeshBasicMaterial({color,toneMapped:false,side:T.DoubleSide}):new T.MeshStandardMaterial({color,roughness:.86,metalness:.08}));
 const m=new T.Mesh(geometry.get(key),materials.get(mk));m.position.set(...position);m.scale.set(...scale);m.castShadow=!glow;m.receiveShadow=true;parent.add(m);return m;
}
function line(parent,color,points,radius=.006,glow=false,segments=24){
 return part(parent,'line:'+radius+':'+segments+JSON.stringify(points),()=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,radius,6,false),color,undefined,undefined,glow);
}
// Different substances must not change the color-keyed material of another
// weapon. The finished surfaces are immutable, shared between held instances.
function finish(mesh,key,options){
 const id='finish:'+key;if(!materials.has(id)){const m=mesh.material.clone();Object.assign(m,options);m.userData.identityFinish=true;materials.set(id,m);}
 mesh.material=materials.get(id);mesh.userData.identityDetail=true;return mesh;
}
function scytheBinding(base){
 const p=[],c=[],ix=[],steps=72,dark=new T.Color(SHADOW.leather),edge=new T.Color(0x62666a),color=new T.Color();
 // A closed, flat leather strap, with its lower edge tucked under the next
 // turn. This replaces round white cord without changing either hand contact.
 for(let i=0;i<=steps;i++){
  const t=i/steps,a=t*Math.PI*10,y=base+t*.22;
  for(const [r,dy]of[[.030,-.020],[.035,-.020],[.035,.020],[.030,.020]]){
   const h=y+dy,x=Math.max(0,h-.05)*.025/.67;p.push(x+Math.cos(a)*r,h,.02+Math.sin(a)*r);
   color.copy(dark).lerp(edge,dy<0?.48:.08);c.push(color.r,color.g,color.b);
  }
  if(i<steps)for(let j=0;j<4;j++){const n=i*4+j,m=i*4+(j+1)%4;ix.push(n,n+4,m,m,n+4,m+4);}
 }
 ix.push(0,1,2,0,2,3,steps*4,steps*4+2,steps*4+1,steps*4,steps*4+3,steps*4+2);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();g.name='SM_Scythe_FlatLeatherBinding';return g;
}
function scytheShaft(){
 const g=new T.TubeGeometry(new T.CatmullRomCurve3([[0,-.48,.02],[0,.05,.02],[.025,.72,.02]].map(p=>new T.Vector3(...p))),24,.030,10,false),p=g.attributes.position,uv=g.attributes.uv,c=[],dark=new T.Color(0x181b1e),grain=new T.Color(0x494b4c),color=new T.Color();
 for(let i=0;i<p.count;i++){const u=uv.getX(i),v=uv.getY(i),fiber=.5+.5*Math.sin(v*63+Math.sin(u*11)*.6);color.copy(dark).lerp(grain,.12+fiber*.24);c.push(color.r,color.g,color.b);}
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.name='SM_Scythe_BlackwoodShaft_A';return g;
}
function scytheSocket(){
 const profile=[[0,-.075],[.040,-.075],[.045,-.066],[.041,-.054],[.039,.038],[.044,.045],[.044,.067],[.037,.075],[0,.075]];
 const g=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),12);g.name='SM_Scythe_RebatedBladeSocket_A';return g;
}
function warScytheBlade(){
 const outer=new T.CubicBezierCurve(new T.Vector2(-.045,.03),new T.Vector2(.32,.36),new T.Vector2(.94,.32),new T.Vector2(1.06,-.45));
 const inner=new T.CubicBezierCurve(new T.Vector2(.03,-.04),new T.Vector2(.45,.12),new T.Vector2(.80,.01),new T.Vector2(1.06,-.45));
 const p=[],c=[],ix=[],steps=32,section=[0,.18,.70,.90,1],tints=[SHADOW.fold,SHADOW.cloth,SHADOW.lining,SHADOW.metal,SHADOW.soul];
 // Forged ridge on both faces, tapering into a genuinely thin cutting edge.
 // The silhouette and established world-space contact point remain unchanged.
 for(const face of[-1,1])for(let i=0;i<=steps;i++){
  const t=i/steps,a=outer.getPoint(t),b=inner.getPoint(t),tip=Math.pow(1-t,.45);
  for(let j=0;j<section.length;j++){
   const s=section[j],v=a.clone().lerp(b,s),depth=[.014,.030,.023,.009,.002][j]*tip;
   p.push(v.x,v.y,.0125+depth*face);const color=new T.Color(tints[j]);c.push(color.r,color.g,color.b);
  }
 }
 const rows=(steps+1)*5;
 for(let face=0;face<2;face++)for(let i=0;i<steps;i++)for(let j=0;j<4;j++){const a=face*rows+i*5+j,b=a+5;ix.push(...(face?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]));}
 for(let i=0;i<steps;i++)for(const j of[0,4]){const a=i*5+j,b=a+5;ix.push(a,a+rows,b,b,a+rows,b+rows);}
 for(let j=0;j<4;j++)ix.push(j,j+1,j+rows,j+1,j+1+rows,j+rows);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();g.name='SM_Scythe_ForgedBlade_A';return g;
}
function riftPoint(side,v,u){
 const taper=Math.sin(v*Math.PI),center=.045*Math.sin(v*7)+.025*Math.sin(v*15),gap=.024+.016*taper,width=(.08+.47*taper**.8)*taper**.45;
 return [center+side*(gap+u*width),(v-.5)*2.85,.065*taper*(1-u)+.045*Math.sin(v*Math.PI*2+side*.5)*u+.048*taper*Math.sin(u*Math.PI)];
}
function riftVeil(){
 // Two curved, tapering sheets leave actual negative space between the fingers.
 // Their thin surface reads as a held shadow tear instead of solid glove armour.
 const p=[],uv=[],c=[],ix=[],rows=32,cols=4,inner=new T.Color(),outer=new T.Color(),shade=new T.Color();
 for(const side of[-1,1]){
  // One lip drinks the light; the other carries a narrow, pale soul edge.
  inner.set(side<0?SHADOW.cloth:SHADOW.ivory);outer.set(side<0?SHADOW.lining:SHADOW.fold);
  const start=p.length/3;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const v=j/rows,u=i/cols;
   p.push(...riftPoint(side,v,u));
   uv.push(u,v);shade.copy(inner).lerp(outer,T.MathUtils.smoothstep(u,0,.5));c.push(shade.r,shade.g,shade.b);
   if(j<rows&&i<cols){const n=start+j*(cols+1)+i;ix.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();g.name='SM_Shade_CurvedShadowTear';return g;
}
function bookPages(){
 const layers=[];
 for(let layer=0;layer<9;layer++){
  const sheet=new T.BoxGeometry(1,.070,1,3,1,2),p=sheet.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),curl=.07*Math.cos(x*Math.PI)*Math.cos(z*Math.PI);
   p.setXYZ(i,x*(.974+layer*.002),p.getY(i)-.4+layer*.1+curl,z*(.978+layer*.002));
  }
  sheet.computeVertexNormals();layers.push(sheet);
 }
 const g=mergeGeometries(layers,false);layers.forEach(s=>s.dispose());g.name='SM_Grimoire_BoundPageLayers';return g;
}
function bookSpine(){
 // The two covers hinge onto one rounded leather spine. Its upper gutter sits
 // under the page roots, rather than leaving two independent floating blocks.
 const g=new T.CylinderGeometry(.011,.011,.282,12,1,false);g.rotateX(Math.PI/2);g.scale(1,1.15,1);g.name='SM_Grimoire_ContinuousSpine';return g;
}
function boundPageInk(pages,key,paths){
 if(!pageInk.has(key)){
  const surface=new T.Mesh(pages.geometry,pages.material),ray=new T.Raycaster();surface.updateMatrixWorld();
  // Query only the cached, unposed page surface once, not either animated hand.
  pageInk.set(key,paths.map(path=>path.map(([x,,z])=>{
   ray.set(new T.Vector3((x-pages.position.x)/pages.scale.x,2,z/pages.scale.z),new T.Vector3(0,-1,0));
   const hit=ray.intersectObject(surface,false)[0];return[x,pages.position.y+(hit?.point.y??.45)*pages.scale.y+.0005,z];
  })));
 }
 return pageInk.get(key);
}
function bookCover(){
 const g=new T.BoxGeometry(1,1,1,6,1,6),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),corner=Math.abs(x)>.37&&Math.abs(z)>.37;
  p.setXYZ(i,x*(corner?.963:1),p.getY(i)*(.90+.10*Math.cos(x*Math.PI)*Math.cos(z*Math.PI)),z*(corner?.976:1));
 }
 g.computeVertexNormals();g.name='SM_Grimoire_SoftBoundCover';return g;
}
export function shadowFocus(id){
 const g=new T.Group();g.name='shadow-focus-'+id;
 if(id==='shadowblade'){
  g.name='SM_Weapon_WarScythe_A';
  const shaft=part(g,'scythe-blackwood',scytheShaft,0xffffff);shaft.name='SM_Scythe_BlackwoodShaft_A';finish(shaft,'scythe-wood',{vertexColors:true,roughness:.71,metalness:0});
  for(const [index,base]of[-.13,.24].entries()){
   const leather=part(g,'scythe-flat-wrap:'+index,()=>scytheBinding(base),0xffffff);leather.name='SM_Scythe_LeatherBinding_'+index;finish(leather,'scythe-leather',{vertexColors:true,roughness:.88,metalness:0});
  }
  for(const [i,y]of[-.43,.55,.66].entries()){
   const collar=part(g,'scythe-collar',()=>new T.CylinderGeometry(.037,.040,.048,12),SHADOW.metal,[Math.max(0,y-.05)*.025/.67,y,.02]);collar.name='SM_Scythe_SteelCollar_'+i;collar.material.roughness=.37;collar.material.metalness=.64;
  }
  const socket=part(g,'scythe-socket',scytheSocket,SHADOW.fold,[.025,.69,.02]);socket.name='SM_Scythe_BladeSocket_A';finish(socket,'scythe-socket',{roughness:.34,metalness:.72});
  const blade=part(g,'war-scythe',warScytheBlade,0xffffff,[.015,.70,.02]);blade.name='SM_Scythe_ForgedBlade_A';blade.material.vertexColors=true;blade.material.roughness=.34;blade.material.metalness=.72;
  const brace=line(g,SHADOW.metal,[[.025,.60,.02],[.065,.70,.02],[.20,.79,.025]],.016);brace.name='SM_Scythe_SocketBrace_A';brace.material.roughness=.4;brace.material.metalness=.62;
  for(const side of[-1,1]){
   const pin=part(g,'scythe-pin',()=>new T.SphereGeometry(.018,10,6),SHADOW.soul,[.060,.72,.02+side*.045],[1,1,.45]);pin.name='SM_Scythe_Rivet_'+side;pin.material.roughness=.31;pin.material.metalness=.76;
  }
  // Both faces carry the same small soul scar. Project it onto the forged
  // surface so it never floats above, or disappears inside, the raised ridge.
  const scars=[],ray=new T.Raycaster();blade.updateMatrixWorld(true);
  for(const face of[-1,1]){
   const points=[];
   for(const [x,y]of[[.20,.79],[.225,.832],[.27,.839],[.30,.88]]){
    ray.set(new T.Vector3(x,y,face),new T.Vector3(0,0,-face));const hit=ray.intersectObject(blade,false)[0];
    if(hit)points.push([x,y,hit.point.z+face*.001]);
   }
   if(points.length>1)scars.push(points);
  }
  weaponInlay(g,'SM_Scythe_SoulRiftEngraving',scars,SHADOW.ivory,.0017,.42);
 }else if(id==='grimoire'){
  const spine=part(g,'book-spine',bookSpine,SHADOW.leather,[0,.076,.06]);spine.name='SM_Grimoire_ContinuousSpine';finish(spine,'book-spine',{roughness:.86,metalness:0});
  const gutter=part(g,'book-gutter',()=>new T.CylinderGeometry(.006,.006,.259,10),SHADOW.ivory,[0,.094,.06]);gutter.rotation.x=Math.PI/2;gutter.name='SM_Grimoire_FoldedGutter';finish(gutter,'book-gutter',{roughness:.96,metalness:0});
  for(const sign of [-1,1]){
   const leaf=new T.Group();leaf.rotation.z=sign*.18;leaf.position.set(0,.075,.06);g.add(leaf);
   const cover=part(leaf,'book-cover',bookCover,SHADOW.lining,[sign*.115,0,0],[.23,.028,.29]);cover.name='SM_Grimoire_SoulhideCover_'+sign;cover.userData.identityDetail=true;cover.material.userData.identityFinish=true;
   const pages=part(leaf,'book-pages',bookPages,SHADOW.ivory,[sign*.11,.022,0],[.21,.018,.26]);pages.name='SM_Grimoire_AshenPages_'+sign;pages.userData.identityDetail=true;pages.material.roughness=.95;pages.material.metalness=0;
   const lines=[-.07,0,.07].map(z=>[[sign*.040,0,z],[sign*.090,0,z],[sign*.105,0,z+.010],[sign*.148,0,z+.010]]);
   weaponInlay(leaf,'SM_Grimoire_BoundPageScript_'+sign,boundPageInk(pages,'script:'+sign,lines),SHADOW.lining,.00085,0);
   const margins=[[[sign*.176,0,-.10],[sign*.167,0,-.057],[sign*.177,0,-.025]],[[sign*.182,0,.016],[sign*.190,0,.05],[sign*.181,0,.103]]];
   weaponInlay(leaf,'SM_Grimoire_SoulMargin_'+sign,boundPageInk(pages,'margin:'+sign,margins),SHADOW.cloth,.0008,0);
  }
  g.userData.page=part(g,'box',()=>new T.BoxGeometry(1,1,1),SHADOW.ivory,[.095,.12,.06],[.18,.004,.25]);
  // Ink belongs to the existing turning page, so it follows its original hinge.
  weaponInlay(g.userData.page,'SM_Grimoire_TurningPageInk',[-.23,0,.23].map(z=>[[-.34,.65,z],[-.16,.65,z],[.01,.65,z+.045],[.15,.65,z+.045],[.32,.65,z+.018]]),SHADOW.lining,.006,0);
 }else{
  const focus=part(g,'curved-shadow-tear',riftVeil,0xfefefe,[0,.11,.13],[.052,.052,.052]);g.userData.focus=focus;focus.name='SM_Weapon_Shade_ControlledRift';focus.userData.identityDetail=true;
  const material=focus.material;focus.castShadow=focus.receiveShadow=false;
  if(!material.userData.controlledRift){
  material.userData.controlledRift=true;material.vertexColors=true;material.metalness=0;material.roughness=.86;material.transparent=true;material.opacity=.86;material.depthWrite=false;material.side=T.DoubleSide;
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec2 vRiftUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRiftUv=uv;');
   shader.fragmentShader='varying vec2 vRiftUv;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=(1.0-smoothstep(.50,1.0,vRiftUv.x))*smoothstep(0.0,.10,vRiftUv.y)*(1.0-smoothstep(.90,1.0,vRiftUv.y));');
  };material.customProgramCacheKey=()=> 'shade-controlled-rift';
  }
  // Each seam follows its own real lip, leaving the center genuinely open.
  // It no longer crosses the empty gap as an unrelated floating white stroke.
  for(const side of[-1,1]){
   const points=Array.from({length:25},(_,i)=>riftPoint(side,.07+i/24*.86,.012));
   const seam=line(focus,side>0?SHADOW.soul:SHADOW.cloth,points,.010,side>0,24);seam.name='SM_Shade_FoldedRiftLip_'+side;seam.userData.identityDetail=true;
  }
 }
 return nameWeapon(g,'wraith',id);
}

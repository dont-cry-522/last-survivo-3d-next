import * as T from './vendor/three.module.js';
import{weaponInlay,nameWeapon,lanternCoreMaterial}from'./weapon-identity.js?v=202';
// Programmatic prototype: existing rig and cloth surfaces, original herb-gatherer accessories.
export const WULING_PALETTE=Object.freeze({cloak:0x342139,trim:0x927955,copper:0x9d7f4d,leather:0x322730,ivory:0xb6a995,glass:0xe4c484});
const geometry=new Map(),materials=new Map();
function part(parent,kind,args,color,x,y,z,sx=1,sy=1,sz=1){const key=kind+JSON.stringify(args);if(!geometry.has(key))geometry.set(key,new T[kind](...args));if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:color===WULING_PALETTE.copper?.60:.92,metalness:color===WULING_PALETTE.copper?.52:0}));const m=new T.Mesh(geometry.get(key),materials.get(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
const ell=(g,c,x,y,z,sx,sy,sz)=>part(g,'SphereGeometry',[1,12,8],c,x,y,z,sx,sy,sz);
export function wulingOutfit(root){root.traverse(o=>{
 if(!o.isMesh)return;o.material=o.material.clone();if(/Pauldron/.test(o.name))o.visible=false;if(o.material.name.includes('Regular'))return;
 const body=o.name.endsWith('_Body'),belt=o.name.includes('Body_Belt'),hood=o.name.includes('Head_Hood'),color=o.name.includes('Feet')?0x29212a:o.name.includes('Legs')?0x221d2b:o.name.includes('Belt')?0x322730:o.name.includes('Bracer')?0x3d2b3d:hood?0x342139:o.name.includes('Arms')?0x51324f:0x352339;
 // Convert the authored sRGB palette to linear values once; bright lobby lighting must not turn it pink.
 const tint=new T.Color(color).toArray().join(',');o.material.color.set(0xffffff);o.material.roughness=.96;o.material.roughnessMap=null;o.material.metalness=.01;o.material.normalScale?.setScalar(body?.10:.22);
 if(body||belt||hood){
  // Soften the source ranger's separate chest plates into a continuous cloth front, retaining skin weights.
  o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   if(hood){p.setX(i,x*.95);continue;}
   p.setX(i,x*(1-.07*Math.exp(-(((y-1.17)/.15)**2))));
   if(!body||z<=.035)continue;const w=(1-T.MathUtils.smoothstep(Math.abs(x),.105,.165))*T.MathUtils.smoothstep(y,1.20,1.26)*(1-T.MathUtils.smoothstep(y,1.40,1.46));p.setZ(i,T.MathUtils.lerp(z,.132-.024*(x/.165)**2,w*.82));}
  o.geometry.computeVertexNormals();
 }
 o.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nfloat herbWeave=dot(diffuseColor.rgb,vec3(.21,.72,.07));diffuseColor.rgb=vec3(${tint})*(.78+herbWeave*.48);`);};o.material.customProgramCacheKey=()=> 'wuling-cloth-'+tint;
});}
export function wulingMask(model,sample){
 let skin;model.traverse(o=>{if(o.isSkinnedMesh&&o.material.name.includes('Superhero'))skin=o;});
 const material=new T.MeshStandardMaterial({color:0x756d88,roughness:.72,metalness:.07,side:T.DoubleSide});
 const probe=new T.Mesh(skin.geometry,material),ray=new T.Raycaster(),pos=[],uv=[],indices=[],cols=32,rows=24;
 // Full forehead-to-chin shell with cheek returns tucked inside the hood.
 // The sculpted profile bridges facial creases; ray clearance keeps the actual nose behind it.
 const profile=[[1.539,.026,.088,.054],[1.568,.053,.113,.036],[1.610,.079,.128,-.001],[1.650,.089,.145,-.011],[1.693,.090,.126,-.014],[1.727,.084,.105,-.017],[1.757,.072,.084,-.024]];
 probe.updateMatrixWorld(true);
 for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
  const v=row/rows,y=T.MathUtils.lerp(profile[0][0],profile.at(-1)[0],v),u=col/cols*2-1;
  let j=0;while(j<profile.length-2&&y>profile[j+1][0])j++;
  const a=profile[j],b=profile[j+1],f=(y-a[0])/(b[0]-a[0]),width=T.MathUtils.lerp(a[1],b[1],f),center=T.MathUtils.lerp(a[2],b[2],f),edge=T.MathUtils.lerp(a[3],b[3],f),x=u*width;
  let hit;if(sample)hit=sample(x,y);else{ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));hit=ray.intersectObject(probe,false)[0];}
  pos.push(x,y,Math.max(edge+(center-edge)*Math.pow(1-u*u,.62),(hit?.point.z??-.1)+.006));uv.push(col/cols,v);
 }
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
 const shape=new T.BufferGeometry();shape.setAttribute('position',new T.Float32BufferAttribute(pos,3));shape.setAttribute('uv',new T.Float32BufferAttribute(uv,2));shape.setIndex(indices);shape.computeVertexNormals();
 // Opaque narrow eye insets and a restrained plant engraving: one surface, no lights or extra meshes.
 material.onBeforeCompile=s=>{
  s.vertexShader='varying vec2 herbMaskPoint; varying vec2 herbMaskUV;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nherbMaskPoint=position.xy; herbMaskUV=uv;');
  s.fragmentShader='varying vec2 herbMaskPoint; varying vec2 herbMaskUV;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ax=abs(herbMaskPoint.x),y=herbMaskPoint.y;
   float eyeT=clamp((ax-.018)/.048,0.0,1.0),eyeCurve=1.670+.0015*sin(eyeT*3.14159)-.009*eyeT;
   float eyeWidth=.0011+.0021*sin(eyeT*3.14159);
   float eye=(1.0-smoothstep(eyeWidth,eyeWidth+.0018,abs(y-eyeCurve)))*smoothstep(.017,.023,ax)*(1.0-smoothstep(.061,.069,ax));
   float rim=1.0-smoothstep(.011,.025,min(herbMaskUV.x,1.0-herbMaskUV.x));
   float leaf=length((herbMaskPoint-vec2(-.059,1.709))/vec2(.006,.016));
   float engraving=(1.0-smoothstep(.06,.17,abs(leaf-1.0)))*smoothstep(1.684,1.693,y);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.25,.22,.19),max(rim*.65,engraving*.65));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.006,.004,.009),eye);`);
 };material.customProgramCacheKey=()=> 'wuling-full-mask';
 const mask=new T.Mesh(shape,material);mask.name='wuling-full-mask';mask.castShadow=mask.receiveShadow=true;return mask;
}
export function sporeLantern(){
 const g=new T.Group();g.name='Wuling_spore_lantern';
 // Keep the handle and the palm contact fixed; only change the hanging body.
 part(g,'TorusGeometry',[.085,.013,8,24],WULING_PALETTE.copper,0,-.070,0);
 const stem=[new T.Vector2(.010,-.145),new T.Vector2(.014,-.148),new T.Vector2(.014,-.157),new T.Vector2(.010,-.162),new T.Vector2(.015,-.172),new T.Vector2(.026,-.181),new T.Vector2(.026,-.184)];
 part(g,'LatheGeometry',[stem,20],WULING_PALETTE.copper,0,0,0).name='SM_Weapon_Spore_HandleSocket';
 const roof=[new T.Vector2(0,0),new T.Vector2(.025,-.004),new T.Vector2(.058,-.021),new T.Vector2(.087,-.046),new T.Vector2(.112,-.065),new T.Vector2(.125,-.073),new T.Vector2(.122,-.083),new T.Vector2(.068,-.071),new T.Vector2(.025,-.057)];
 const shade=part(g,'LatheGeometry',[roof.reverse(),32],WULING_PALETTE.copper,0,-.155,0);shade.name='SM_Weapon_Spore_GilledCanopy';shade.userData.identityDetail=true;
 const gills=[];for(let i=0;i<16;i++){const a=i*Math.PI/8;gills.push([[Math.sin(a)*.031,-.219,Math.cos(a)*.031],[Math.sin(a)*.070,-.228,Math.cos(a)*.070],[Math.sin(a)*.116,-.239,Math.cos(a)*.116]]);}
 weaponInlay(g,'SM_Weapon_Spore_GillRibs',gills,0x5d4937,.0020,.18);
 part(g,'TorusGeometry',[.121,.009,6,24],WULING_PALETTE.copper,0,-.24,0).rotation.x=Math.PI/2;
 const heart=ell(g,0xb5bc7c,0,-.335,0,.068,.105,.068);heart.name='Spore_lantern_heart';heart.material=lanternCoreMaterial('spore');
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5,s=Math.sin(a),c=Math.cos(a),curve=new T.CatmullRomCurve3([new T.Vector3(s*.115,-.233,c*.115),new T.Vector3(s*.117,-.255,c*.117),new T.Vector3(s*.125,-.32,c*.125),new T.Vector3(s*.083,-.43,c*.083),new T.Vector3(0,-.48,0)]);part(g,'TubeGeometry',[curve,16,.007,6,false],WULING_PALETTE.copper,0,0,0);}
 ell(g,WULING_PALETTE.cloak,0,-.463,0,.073,.032,.073);ell(g,WULING_PALETTE.copper,0,-.507,0,.016,.034,.016);g.userData.heart=heart;return nameWeapon(g,'wuling','sporelantern');
}
export function sporeSatchel(){
 const g=new T.Group();g.name='Wuling_herb_satchel';ell(g,WULING_PALETTE.leather,0,0,0,.108,.127,.068);ell(g,0x4c3945,0,.075,.04,.112,.033,.051);
 part(g,'TorusGeometry',[.022,.006,6,16],WULING_PALETTE.copper,0,.032,.083);
 const label=part(g,'BoxGeometry',[.024,.05,.006],WULING_PALETTE.ivory,.048,-.018,.073);label.rotation.z=-.15;
 return g;
}
export function sporePod(){const g=new T.Group();g.name='Wuling_held_seed_pod';ell(g,0xaeb475,0,0,0,.05,.075,.045);part(g,'CylinderGeometry',[.008,.013,.038,6],0x705e3b,0,.081,0);return g;}
export function wulingAccessories(){
 const chest=new T.Group(),head=new T.Group(),basket=new T.Group();chest.name='Wuling_gathering_harness';head.name='Wuling_hood_clasp';basket.name='Wuling_herb_basket';
 const strap=part(chest,'BoxGeometry',[1,1,1],WULING_PALETTE.leather,0,1.275,.158,.028,.38,.014);strap.rotation.z=.55;
 // A narrow linen neckline follows the cloth instead of adding rounded collar ornaments.
 for(const side of[-1,1]){const edge=new T.CatmullRomCurve3([new T.Vector3(0,1.481,.069),new T.Vector3(side*.036,1.46,.10),new T.Vector3(side*.071,1.432,.125)]);part(chest,'TubeGeometry',[edge,10,.005,5,false],WULING_PALETTE.ivory,0,0,0);}
 const clasp=ell(chest,WULING_PALETTE.copper,-.105,1.397,.141,.019,.034,.009);clasp.rotation.z=-.55;
 ell(chest,0x7e547f,-.105,1.398,.152,.009,.019,.005);
 for(let i=0;i<2;i++){const x=-.055+i*.07;ell(chest,[0xc5a579,0x846a99][i],x,1.08,.153,.022,.046,.021);part(chest,'CylinderGeometry',[.011,.013,.014,6],WULING_PALETTE.copper,x,1.126,.153);}
 // A leaf-shaped copper fastening replaces the oversized mushroom hair spray.
 const pin=ell(head,WULING_PALETTE.copper,.137,1.674,.055,.012,.041,.006);pin.rotation.z=-.38;
 for(let i=0;i<2;i++){const leaf=ell(head,WULING_PALETTE.trim,.137+(i?-.008:.009),1.674+(i?.012:-.009),.061,.012,.018,.004);leaf.rotation.z=i?.4:-.8;}
 // Compact field pack: dried plants stay below the head silhouette.
 ell(basket,0x43333f,0,1.19,-.245,.142,.15,.087);
 for(let i=0;i<3;i++){const ring=part(basket,'TorusGeometry',[.137,.008,6,20],0x917555,0,1.08+i*.085,-.245,1,.6,1);ring.rotation.x=Math.PI/2;}
 const linen=part(basket,'CylinderGeometry',[.046,.046,.235,16],WULING_PALETTE.ivory,0,1.342,-.247);linen.rotation.z=Math.PI/2;
 for(let i=0;i<2;i++){const x=-.075+i*.12;part(basket,'CylinderGeometry',[.007,.009,.075,6],0x9d8768,x,1.35,-.263);ell(basket,i?0x8f7183:0xba9d75,x,1.392,-.263,.038,.012,.029);}
 return{chest,head,basket};
}

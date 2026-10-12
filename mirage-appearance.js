import * as T from './vendor/three.module.js';
import{mirrorPetalGeometry,nameWeapon}from'./weapon-identity.js?v=172';
import {wulingOutfit,wulingMask} from './wuling-appearance.js?v=172';

// Authored procedural prototype on the existing female rig; no extra model download.
export const MIRAGE_PALETTE=Object.freeze({cloth:0x24142e,violet:0x4a2b63,mist:0xa78cc7,ivory:0xe9e3f2,silver:0x797484,glow:0x8f5cff});
const shapes=new Map(),surfaces=new Map();
function piece(group,kind,args,color,x,y,z,sx=1,sy=1,sz=1){
 const key=kind+JSON.stringify(args);if(!shapes.has(key))shapes.set(key,new T[kind](...args));
 if(!surfaces.has(color))surfaces.set(color,new T.MeshStandardMaterial({color,roughness:color===MIRAGE_PALETTE.silver?.48:.83,metalness:color===MIRAGE_PALETTE.silver?.5:0}));
 const mesh=new T.Mesh(shapes.get(key),surfaces.get(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
}
const oval=(g,c,x,y,z,sx,sy,sz)=>piece(g,'SphereGeometry',[1,16,10],c,x,y,z,sx,sy,sz);
export function mirageOutfit(root){
 // The utility clones surfaces and altered cloth geometry before touching them.
 wulingOutfit(root);
 root.traverse(o=>{
  if(!o.isMesh)return;
  if(/Head_Hood|Pauldron/.test(o.name))o.visible=false;
  if(o.material.name.includes('Regular'))return;
  const color=/Feet|Legs/.test(o.name)?0x211b2b:/Bracer|Belt/.test(o.name)?0x38303f:/Arms/.test(o.name)?0x4a2b63:0x2e193c;
  const tint=new T.Color(color).toArray().join(',');o.material.roughness=.9;o.material.metalness=/Bracer|Belt/.test(o.name)?.12:.015;
  o.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nfloat mirageWeave=dot(diffuseColor.rgb,vec3(.21,.72,.07));diffuseColor.rgb=vec3(${tint})*(.82+mirageWeave*.38);`);};
  o.material.customProgramCacheKey=()=> 'mirage-cloth-'+tint;
 });
}
export function mirageHair(root){
 root.traverse(o=>{if(!o.isMesh)return;o.userData.hairstyle=true;o.userData.mirageLongHair=true;
  // Preserve the authored crown, fringe, strand texture and weights. Only this
  // template's rear lengths are reshaped; silver keeps its original short cut.
  o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),rear=1-T.MathUtils.smoothstep(z,-.018,.075),length=T.MathUtils.clamp((1.68-y)/.18,0,1),fall=T.MathUtils.smoothstep(length,0,.82)*rear;
   p.setXYZ(i,x*(1+.26*Math.sin(length*Math.PI)*rear),y-.445*fall,z-.205*T.MathUtils.smoothstep(length,0,.58)*rear-.012*Math.sin(length*Math.PI)*rear);
  }
  o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  o.material=o.material.clone();o.material.color.set(0xffffff);o.material.roughness=.75;o.material.normalScale?.setScalar(.2);
  const tint=new T.Color(0xc4b7db).toArray().join(',');o.material.onBeforeCompile=s=>{
   s.vertexShader='varying vec3 vMirageHair;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMirageHair=position;');
   s.fragmentShader='varying vec3 vMirageHair;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nfloat mirageStrand=dot(diffuseColor.rgb,vec3(.21,.72,.07));float fiber=sin(vMirageHair.x*210.0+sin(vMirageHair.y*6.0)*.65)*.038+sin(vMirageHair.x*385.0)*.018;diffuseColor.rgb=vec3(${tint})*(.63+mirageStrand*.39+fiber);`);
  };o.material.customProgramCacheKey=()=> 'mirage-silver-long-hair';
 });
}
export function prepareMirageHair(model){
 const locks=[];
 model.traverse(o=>{
  if(!o.isMesh||!o.userData.mirageLongHair)return;
  o.geometry=o.geometry.clone();const original=o.material;o.material=original.clone();o.material.onBeforeCompile=original.onBeforeCompile;o.material.customProgramCacheKey=original.customProgramCacheKey;
  const p=o.geometry.attributes.position,n=o.geometry.attributes.normal,weights=new Float32Array(p.count),slopes=new Float32Array(p.count);
  for(let i=0;i<p.count;i++){const q=T.MathUtils.clamp((1.64-p.getY(i))/.59,0,1);weights[i]=q*q*(3-2*q);slopes[i]=-6*q*(1-q)/.59;}
  o.userData.hairMotion={rest:p.array.slice(),normals:n.array.slice(),weights,slopes,x:0,vx:0,z:0,vz:0};p.setUsage(T.DynamicDrawUsage);n.setUsage(T.DynamicDrawUsage);locks.push(o);
 });
 return locks;
}
function settleHair(s,key,velocity,target,dt){
 // Analytic damped spring: a stop/turn settles softly at different frame rates.
 const stiffness=9,offset=s[key]-target,j=s[velocity]+stiffness*offset,e=Math.exp(-stiffness*dt);
 s[key]=target+(offset+j*dt)*e;s[velocity]=(s[velocity]-stiffness*j*dt)*e;
}
export function animateMirageHair(locks,t,dt,d,relative){
 if(dt<=0)return;
 const run=T.MathUtils.clamp(d.smoothedSpeed/6,0,1),slip=Math.sin(Math.PI*T.MathUtils.clamp((d.dashTime||0)/.52,0,1));
 for(const mesh of locks){
  const s=mesh.userData.hairMotion,p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
  settleHair(s,'x','vx',T.MathUtils.clamp(-(d.turnRate||0)*.018,-.095,.095)-Math.sin(relative)*run*.027,dt);
  settleHair(s,'z','vz',-.055*run-.075*slip-.10*T.MathUtils.smoothstep(d.waterBlend||0,.3,.8),dt);
  const amplitude=.0035+.009*run;
  for(let i=0;i<p.count;i++){
   const j=i*3,w=s.weights[i],dw=s.slopes[i],phase=t*2.5-w*2.8+s.rest[j]*5,backPhase=t*3.1-w*2.2;
   const x=s.x+Math.sin(phase)*amplitude,z=s.z+Math.sin(backPhase)*amplitude*.55;
   p.setXYZ(i,s.rest[j]+w*x,s.rest[j+1],s.rest[j+2]+w*z);
   const dx=dw*(x-w*2.8*Math.cos(phase)*amplitude),dz=dw*(z-w*2.2*Math.cos(backPhase)*amplitude*.55);
   const nx=s.normals[j]/(1+w*Math.cos(phase)*amplitude*5),ny=s.normals[j+1]-nx*dx-s.normals[j+2]*dz,nz=s.normals[j+2],l=Math.hypot(nx,ny,nz)||1;n.setXYZ(i,nx/l,ny/l,nz/l);
  }
  p.needsUpdate=n.needsUpdate=true;
 }
}
export function mirageMask(model){
 const mask=wulingMask(model);mask.name='mirage-full-mask';
 // A complete fitted shell, inspired by Volto masks: rounded jaw, cheek returns,
 // a visible edge and dark eye insets. No skin or lips are exposed through it.
 const p=mask.geometry.attributes.position,uv=mask.geometry.attributes.uv,pos=[],tex=[],indices=Array.from(mask.geometry.index.array),cols=32,rows=24;
 let skin;model.traverse(o=>{if(o.isSkinnedMesh&&o.material.name.includes('Superhero'))skin=o;});
 const probe=new T.Mesh(skin.geometry,mask.material),ray=new T.Raycaster();probe.updateMatrixWorld(true);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),lower=1-T.MathUtils.smoothstep(y,1.539,1.622),cheek=Math.exp(-(((y-1.617)/.052)**2)),upper=T.MathUtils.smoothstep(y,1.687,1.757);
  const nx=x*(1+.28*lower+.085*cheek),across=uv.getX(i)*2-1,ny=y>1.687?1.687+(.037-.021*across*across)*(y-1.687)/.07:y-.015*lower;
  let nz=p.getZ(i)+.003*cheek-upper*.026;
  if(upper){ray.set(new T.Vector3(nx,ny,1),new T.Vector3(0,0,-1));const hit=ray.intersectObject(probe,false)[0];if(hit)nz=Math.max(nz,hit.point.z+.004);}
  pos.push(nx,ny,nz);tex.push(uv.getX(i),uv.getY(i));
 }
 // Fold the perimeter inward to show a thin physical rim in side views.
 const edge=[];for(let c=0;c<=cols;c++)edge.push(c);for(let r=1;r<=rows;r++)edge.push(r*(cols+1)+cols);for(let c=cols-1;c>=0;c--)edge.push(rows*(cols+1)+c);for(let r=rows-1;r>0;r--)edge.push(r*(cols+1));
 const rimStart=pos.length/3;
 for(const i of edge){pos.push(pos[i*3]*.985,1.65+(pos[i*3+1]-1.65)*.99,pos[i*3+2]-.006);tex.push(tex[i*2],tex[i*2+1]);}
 for(let j=0;j<edge.length;j++){const k=(j+1)%edge.length;indices.push(edge[j],rimStart+j,edge[k],edge[k],rimStart+j,rimStart+k);}
 mask.geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));mask.geometry.setAttribute('uv',new T.Float32BufferAttribute(tex,2));mask.geometry.setIndex(indices);mask.geometry.deleteAttribute('normal');mask.geometry.computeVertexNormals();mask.geometry.computeBoundingBox();mask.geometry.computeBoundingSphere();
 const m=mask.material;m.color.set(0x301c44);m.roughness=.68;m.metalness=.16;
 m.onBeforeCompile=s=>{
  s.vertexShader='varying vec2 mirageMaskPoint;varying vec2 mirageMaskUV;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmirageMaskPoint=position.xy;mirageMaskUV=uv;');
  s.fragmentShader='varying vec2 mirageMaskPoint;varying vec2 mirageMaskUV;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ax=abs(mirageMaskPoint.x),y=mirageMaskPoint.y;
   float eyeX=(ax-.044)/.025,eyeY=(y-1.670-(ax-.044)*.16)/.0085;
   float eyeShape=eyeX*eyeX+eyeY*eyeY;
   float eye=1.0-smoothstep(.78,1.0,eyeShape);
   float eyeRim=(1.0-smoothstep(1.05,1.43,eyeShape))*smoothstep(.65,.93,eyeShape);
   float border=min(min(mirageMaskUV.x,1.0-mirageMaskUV.x),min(mirageMaskUV.y,1.0-mirageMaskUV.y));
   float rim=1.0-smoothstep(.006,.019,border);
   float crest=abs(mirageMaskPoint.x)/.009+abs(y-1.699)/.016;
   float flower=1.0-smoothstep(.07,.20,abs(crest-1.0));
   float stemX=.041+.022*sin(clamp((y-1.56)/.08,0.0,1.0)*2.4);
   float stem=(1.0-smoothstep(.0007,.0020,abs(ax-stemX)))*smoothstep(1.555,1.570,y)*(1.0-smoothstep(1.630,1.645,y));
   float nose=(1.0-smoothstep(.002,.011,ax))*smoothstep(1.619,1.645,y)*(1.0-smoothstep(1.690,1.713,y));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.085,.032,.145),nose*.45);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.18,.32),max(rim*.85,max(eyeRim*.66,flower*.72)));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.080,.22),stem*.75);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.0015,.0008,.003),eye);`);
 };
 m.customProgramCacheKey=()=> 'mirage-volto-full-mask';return mask;
}
export function miasmaLantern(){
 const g=new T.Group();g.name='Mirage_poison_flower_lantern';
 piece(g,'TorusGeometry',[.078,.010,8,24],MIRAGE_PALETTE.silver,0,-.063,0);
 oval(g,MIRAGE_PALETTE.cloth,0,-.18,0,.088,.046,.088);
 piece(g,'TorusGeometry',[.083,.007,6,24],MIRAGE_PALETTE.silver,0,-.196,0).rotation.x=Math.PI/2;
 const heart=oval(g,0xb98cff,0,-.298,0,.050,.088,.050);heart.name='Mirage_flower_core';
 const petals=[];
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+Math.PI/4,petal=oval(g,i%2?0x796486:0x594866,Math.sin(a)*.076,-.306,Math.cos(a)*.076,.039,.125,.017);
  petal.geometry=mirrorPetalGeometry();petal.name='SM_Weapon_Mirage_MirrorPetal_'+i;petal.userData.identityDetail=true;petal.material.side=T.DoubleSide;petal.material.metalness=.44;petal.material.roughness=.40;
  petal.rotation.set(Math.cos(a)*.27,a,-Math.sin(a)*.27);petal.userData.rest=petal.quaternion.clone();petals.push(petal);
  const curve=new T.CatmullRomCurve3([new T.Vector3(Math.sin(a)*.080,-.19,Math.cos(a)*.080),new T.Vector3(Math.sin(a)*.112,-.29,Math.cos(a)*.112),new T.Vector3(Math.sin(a)*.060,-.392,Math.cos(a)*.060),new T.Vector3(0,-.43,0)]);
  piece(g,'TubeGeometry',[curve,12,.005,5,false],MIRAGE_PALETTE.silver,0,0,0);
 }
 oval(g,MIRAGE_PALETTE.silver,0,-.445,0,.013,.035,.013);
 g.userData.heart=heart;g.userData.petals=petals;return nameWeapon(g,'mirage','miasmalantern');
}
export function mirageAccessories(){
 const chest=new T.Group(),head=new T.Group();chest.name='Mirage_tailored_clasps';head.name='Mirage_flower_hairpin';
 for(const side of[-1,1]){
  const edge=new T.CatmullRomCurve3([new T.Vector3(side*.023,1.48,.071),new T.Vector3(side*.063,1.433,.122),new T.Vector3(side*.020,1.23,.145)]);
  piece(chest,'TubeGeometry',[edge,14,.0035,5,false],MIRAGE_PALETTE.mist,0,0,0);
 }
 const clasp=oval(chest,MIRAGE_PALETTE.silver,-.10,1.401,.142,.023,.037,.008);clasp.rotation.z=-.4;
 oval(chest,MIRAGE_PALETTE.mist,-.10,1.401,.151,.011,.024,.004);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const petal=oval(head,i%2?0x8b72aa:MIRAGE_PALETTE.violet,.128+Math.cos(a)*.022,1.717+Math.sin(a)*.023,.017,.013,.025,.007);petal.rotation.z=a-.5;}
 oval(head,MIRAGE_PALETTE.silver,.128,1.718,.026,.008,.010,.005);
 return{chest,head};
}
export function miragePetalTails(){
 const pos=[],uv=[],index=[],cols=8,rows=14;
 for(let side=-1;side<=1;side+=2){const offset=pos.length/3;
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
   const u=x/cols,v=y/rows,a=side*(1.1+(u-.5)*1.1),r=.19+.075*Math.sin(v*Math.PI),width=Math.sin(v*Math.PI)*.02;
   pos.push(Math.sin(a)*r,1.08-v*(side<0?.42:.34)+Math.pow(Math.abs(u-.5)*2,2)*.105*v,Math.cos(a)*r*.6-.02-width);uv.push(u,v);
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=offset+y*(cols+1)+x;index.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color:MIRAGE_PALETTE.violet,roughness:.88,side:T.DoubleSide}),wind={time:{value:0},run:{value:0}};
 material.onBeforeCompile=s=>{s.uniforms.mirageClothTime=wind.time;s.uniforms.mirageClothRun=wind.run;s.vertexShader='uniform float mirageClothTime;uniform float mirageClothRun;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nfloat freeTail=clamp((1.08-position.y)/.42,0.0,1.0);transformed.z+=sin(mirageClothTime*4.0+position.x*9.0)*(.007+mirageClothRun*.037)*freeTail;`);};
 material.customProgramCacheKey=()=> 'mirage-petal-tails';const mesh=new T.Mesh(geometry,material);mesh.name='Mirage_petal_coattails';mesh.userData.wind=wind;mesh.castShadow=mesh.receiveShadow=true;return mesh;
}

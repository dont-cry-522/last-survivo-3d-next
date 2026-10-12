import * as T from './vendor/three.module.js';
import {smoothSeams} from './hero-finish.js?v=172';

// These garments replace the old Ranger torso, keeping its authored skin binding.
// All coordinates are in the existing shared T-pose, not attached rigid props.
const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
const PALETTE={scout:{cloth:0x526348,leather:0x533a27,edge:0xbaa47a,inner:0x28342b},silver:{cloth:0x34415b,leather:0x182131,edge:0x9cabb7,inner:0x111822}};
let weave;
function fabricMaps(){
 if(weave)return weave;
 const normal=new Uint8Array(128*128*4),rough=new Uint8Array(normal.length);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4,a=Math.sin(x*Math.PI/2),b=Math.sin(y*Math.PI/2),grain=Math.sin(x*12.9898+y*78.233)*43758.5453%1;
  normal.set([128+a*13,128+b*13,253,255],i);const r=218+grain*12+(a*b)*5;rough.set([r,r,r,255],i);
 }
 const texture=data=>{const t=new T.DataTexture(data,128,128);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.repeat.set(7,7);t.needsUpdate=true;return t;};
 return weave={normal:texture(normal),roughness:texture(rough)};
}
function material(kind,part,color){
 const maps=fabricMaps(),leather=/Boot|Glove|Harness|Bracer|Belt/.test(part),m=new T.MeshStandardMaterial({color,roughness:leather?.66:.88,metalness:leather?.025:0,normalMap:maps.normal,normalScale:new T.Vector2(leather?.13:.23,leather?.13:.23),roughnessMap:leather?null:maps.roughness});
 m.name='M_Hero_'+part+'_'+kind;m.side=T.DoubleSide;return m;
}
function finishGeometry(g){g.computeVertexNormals();smoothSeams(g);g.computeBoundingBox();g.computeBoundingSphere();return g;}
const skinPoints=new WeakMap();
function indexedSkin(geometry){
 let points=skinPoints.get(geometry);if(points)return points;
 const p=geometry.attributes.position,used=[...new Set(geometry.index?.array||Array.from({length:p.count},(_,i)=>i))];
 points=used.map((i,order)=>[p.getX(i),p.getY(i),p.getZ(i),i,order]).sort((a,b)=>a[0]-b[0]||a[4]-b[4]);skinPoints.set(geometry,points);return points;
}
function skinFrom(geometry,source){
 const p=geometry.attributes.position,si=source.geometry.attributes.skinIndex,sw=source.geometry.attributes.skinWeight,points=indexedSkin(source.geometry),indices=[],weights=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nearest=[];let lo=0,hi=points.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid][0]<x)lo=mid+1;else hi=mid;}
  let left=lo-1,right=lo;
  while(left>=0||right<points.length){
   const dl=left>=0?(x-points[left][0])**2:Infinity,dr=right<points.length?(x-points[right][0])**2:Infinity;
   // X distance is a lower bound for full distance; equal-distance points must
   // still be visited so ties keep the source's original index order.
   if(nearest.length===4&&Math.min(dl,dr)>nearest[3][0])break;
   const q=dl<=dr?points[left--]:points[right++],d=(x-q[0])**2+(y-q[1])**2+(z-q[2])**2;
   if(nearest.length<4||d<nearest[3][0]||d===nearest[3][0]&&q[4]<nearest[3][2]){nearest.push([d,q[3],q[4]]);nearest.sort((a,b)=>a[0]-b[0]||a[2]-b[2]);nearest.length=Math.min(4,nearest.length);}
  }
  const influence=new Map();for(const [distance,j]of nearest){const amount=1/Math.max(1e-8,distance);for(let k=0;k<4;k++){const bone=si.array[j*4+k],value=sw.array[j*4+k]*amount;influence.set(bone,(influence.get(bone)||0)+value);}}
  const top=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,p)=>n+p[1],0);for(let k=0;k<4;k++){indices.push(top[k]?.[0]||0);weights.push((top[k]?.[1]||0)/sum);}
 }
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));return geometry;
}
function grid(columns,rows,point){
 const p=[],uv=[],ix=[];for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){p.push(...point(i/columns,j/rows));uv.push(i/columns,j/rows);if(j<rows&&i<columns){const n=j*(columns+1)+i;ix.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);return finishGeometry(g);
}
function closeEnds(g,columns,rows){
 const p=Array.from(g.attributes.position.array),uv=Array.from(g.attributes.uv.array),ix=Array.from(g.index.array);
 for(const row of [0,rows]){const center=new T.Vector3();for(let i=0;i<columns;i++)center.add(new T.Vector3().fromArray(p,(row*(columns+1)+i)*3));center.multiplyScalar(1/columns);const n=p.length/3;p.push(...center.toArray());uv.push(.5,row/rows);for(let i=0;i<columns;i++){const a=row*(columns+1)+i;ix.push(...(row?[n,a,a+1]:[n,a+1,a]));}}
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);return finishGeometry(g);
}
function coatGeometry(kind){
 const silver=kind==='silver',profile=silver?[[1.017,.172,.114,.127],[1.066,.157,.102,.111],[1.135,.134,.096,.108],[1.23,.143,.107,.114],[1.34,.167,.155,.123],[1.43,.182,.132,.123],[1.475,.157,.108,.101],[1.51,.074,.073,.067],[1.548,.071,.070,.068]]:[[.885,.222,.146,.158],[.99,.209,.138,.151],[1.14,.170,.112,.132],[1.24,.172,.124,.131],[1.37,.204,.146,.151],[1.48,.218,.143,.149],[1.53,.185,.110,.110],[1.565,.085,.079,.081],[1.60,.080,.076,.078]];
 return grid(40,40,(u,v)=>{
  const f=v*(profile.length-1),k=Math.min(profile.length-2,Math.floor(f)),t=f-k;
  // Cubic slopes pass through the tailoring stations without horizontal ledges.
  const sample=column=>{const b=profile[k][column],c=profile[k+1][column],a=profile[Math.max(0,k-1)][column],d=profile[Math.min(profile.length-1,k+2)][column];return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);};
  const [y,rx,front,back]=[0,1,2,3].map(sample),a=u*Math.PI*2,s=Math.sin(a),c=Math.cos(a),hem=(1-v)**7;
  // Two cut fronts and a slightly longer rear keep the coat readable in silhouette.
  const split=c>0?(.030+Math.exp(-((s/.24)**2))*.055)*hem:-.018*hem;
  const dart=.004*Math.cos(a*6+v*2)*Math.sin(v*Math.PI)**2+.0045*Math.sin(y*56+Math.abs(s)*4)*Math.exp(-(((y-1.16)/.115)**2))*(.3+.7*Math.abs(s)),panels=silver?.007*Math.exp(-(((Math.abs(s)-.68)/.12)**2))*Math.sin(v*Math.PI):0;
  return[s*(rx+dart+panels),y+split,-.030+c*((c>0?front:back)+dart+panels)];
 });
}
function replace(mesh,kind,part,geometry,color){
 mesh.userData.rebuildSourceName??=mesh.name;mesh.name='SM_Hero_'+part+'_'+kind;mesh.geometry=geometry;mesh.material=material(kind,part,color);mesh.userData.rangerRebuild=true;mesh.castShadow=mesh.receiveShadow=true;
}
function addSkinned(root,source,kind,part,g,color){
 const mesh=new T.SkinnedMesh(skinFrom(g,source),material(kind,part,color));mesh.name='SM_Hero_'+part+'_'+kind;mesh.bindMode=source.bindMode;mesh.bind(source.skeleton,source.bindMatrix);mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.rangerRebuild=true;root.add(mesh);return mesh;
}
const projectionBounds=new WeakMap();
function projectionProbe(source){
 const geometry=source.geometry;let bounds=projectionBounds.get(geometry);
 if(!bounds){
  const p=geometry.attributes.position,ix=geometry.index.array;bounds=[];
  for(let i=0;i<ix.length;i+=3){const a=ix[i],b=ix[i+1],c=ix[i+2];bounds.push([a,b,c,Math.min(p.getX(a),p.getX(b),p.getX(c)),Math.max(p.getX(a),p.getX(b),p.getX(c)),Math.min(p.getY(a),p.getY(b),p.getY(c)),Math.max(p.getY(a),p.getY(b),p.getY(c))]);}
  projectionBounds.set(geometry,bounds);
 }
 // A temporary index is the only mutable part. The source garment and its
 // attributes stay untouched; Three still computes the exact triangle hit.
 const g=new T.BufferGeometry();for(const [name,a]of Object.entries(geometry.attributes))g.setAttribute(name,a);g.boundingBox=geometry.boundingBox;g.boundingSphere=geometry.boundingSphere;
 const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);
 return{mesh,select(x,y){const ids=[];for(const b of bounds)if(y>=b[5]-1e-7&&y<=b[6]+1e-7&&(x===null||x>=b[3]-1e-7&&x<=b[4]+1e-7))ids.push(b[0],b[1],b[2]);g.setIndex(ids);},dispose(){g.dispose();mesh.material.dispose();}};
}
function conformPatch(source,points,width,lift=.003){
 const probe=projectionProbe(source),ray=new T.Raycaster();
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=grid(4,28,(u,v)=>{
  const p=curve.getPoint(v),t=curve.getTangent(v),normal=new T.Vector3(t.y,-t.x,0).normalize();p.addScaledVector(normal,(u-.5)*(typeof width==='function'?width(v):width));probe.select(p.x,p.y);ray.set(new T.Vector3(p.x,p.y,1),new T.Vector3(0,0,-1));const hit=ray.intersectObject(probe.mesh,false)[0];p.z=(hit?.point.z??p.z)+.004+Math.sin(u*Math.PI)*lift;return p.toArray();
 });probe.dispose();return g;
}
function wrapBand(body,y,height){
 const probe=projectionProbe(body),ray=new T.Raycaster();
 const g=grid(40,4,(u,v)=>{const a=u*Math.PI*2,dir=new T.Vector3(Math.sin(a),0,Math.cos(a)),origin=dir.clone().multiplyScalar(1);origin.y=y+(v-.5)*height;origin.z-=.030;probe.select(null,origin.y);ray.set(origin,dir.clone().negate());const hit=ray.intersectObject(probe.mesh,false)[0];return(hit?.point.clone().addScaledVector(dir,.004+Math.sin(v*Math.PI)*.002)||origin.multiplyScalar(.16)).toArray();});probe.dispose();return g;
}
function soften(geometry,strength=.16){
 const g=geometry.clone(),p=g.attributes.position,groups=new Map(),groupAt=[],nodes=[];
 const used=new Set(g.index?.array||Array.from({length:p.count},(_,i)=>i));
 for(const i of used){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*100000)).join(',');if(!groups.has(key)){groups.set(key,nodes.length);nodes.push({p:new T.Vector3().fromBufferAttribute(p,i),ids:[],neighbors:new Set()});}const id=groups.get(key);nodes[id].ids.push(i);groupAt[i]=id;}
 const ix=g.index.array;for(let i=0;i<ix.length;i+=3)for(let k=0;k<3;k++){const a=groupAt[ix[i+k]],b=groupAt[ix[i+(k+1)%3]];if(a!==b){nodes[a].neighbors.add(b);nodes[b].neighbors.add(a);}}
 for(let pass=0;pass<2;pass++){const next=nodes.map(n=>{const mean=new T.Vector3();for(const id of n.neighbors)mean.add(nodes[id].p);return n.neighbors.size?n.p.clone().lerp(mean.multiplyScalar(1/n.neighbors.size),pass?-.12:strength):n.p.clone();});nodes.forEach((n,i)=>n.p.copy(next[i]));}
 for(const n of nodes)for(const i of n.ids)p.setXYZ(i,n.p.x,n.p.y,n.p.z);return finishGeometry(g);
}
function reshapeCloth(mesh,kind,part){
 const g=soften(mesh.geometry,.24),p=g.attributes.position,silver=kind==='silver';
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.abs(x);
  if(part==='Sleeves'){
   const joint=T.MathUtils.smoothstep(a,.25,.42)*(1-T.MathUtils.smoothstep(a,.66,.73)),center=silver?1.405:1.451;
   const fold=(Math.sin(a*85)*.0018+Math.sin(a*37+z*11)*.002)*joint;
   y=center+(y-center)*(silver?.96:1.08)+fold;z=-.052+(z+.052)*(silver?.97:1.07)+fold;
  }else if(part==='Bracers'){
   const center=silver?1.408:1.449;y=center+(y-center)*.89;z=-.056+(z+.056)*.91;
  }else if(part==='Trousers'){
   const cx=Math.sign(x)*.09,lower=1-T.MathUtils.smoothstep(y,.60,.93);x=cx+(x-cx)*(1+.085*lower);z+=Math.sin(y*63+a*9)*.0025*lower;
  }else if(part==='Boots'){
   const center=Math.sign(x)*(silver?.111:.093),shaft=T.MathUtils.smoothstep(y,.145,.20)*(1-T.MathUtils.smoothstep(y,silver?.685:.50,silver?.70:.57));
   const rim=Math.exp(-(((y-(silver?.673:.49))/.012)**2))*.010,wrinkle=Math.sin(y*81)*.0025*Math.exp(-(((y-.20)/.07)**2)),expand=(silver?.045:.018)*shaft;
   x=center+(x-center)*(1+expand)+Math.sign(x-center)*(rim+wrinkle);z=-.047+(z+.047)*(1+expand)+Math.sign(z+.047)*(rim+wrinkle);
  }
  p.setXYZ(i,x,y,z);
 }
 return finishGeometry(g);
}
function gloves(mesh,kind){
 const silver=kind==='silver',geometry=mesh.geometry.clone(),p=geometry.attributes.position,n=geometry.attributes.normal;
 const wrist=silver?.682:.747,knuckle=silver?.766:.831;
 for(let i=0;i<p.count;i++){const a=Math.abs(p.getX(i)),pad=T.MathUtils.smoothstep(a,wrist,wrist+.012)*(1-T.MathUtils.smoothstep(a,knuckle-.02,knuckle))*.0018;p.setXYZ(i,p.getX(i)+n.getX(i)*pad,p.getY(i)+n.getY(i)*pad,p.getZ(i)+n.getZ(i)*pad);}
 mesh.geometry=finishGeometry(geometry);const before=mesh.material;mesh.material=before.clone();const m=mesh.material,original=before.onBeforeCompile,oldKey=before.customProgramCacheKey();
 // Keep the existing skin shader on the fingertips; the palm and cuff are a fitted leather glove.
 m.name='M_Hero_Regular_Gloves_'+kind;mesh.name='SM_Hero_Hands_'+kind;mesh.userData.rangerRebuild=true;
 m.onBeforeCompile=shader=>{
  original(shader);shader.vertexShader='varying float vGloveX;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGloveX=abs(position.x);');
  shader.fragmentShader='varying float vGloveX;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float glove=smoothstep(${wrist.toFixed(3)},${(wrist+.006).toFixed(3)},vGloveX)*(1.0-smoothstep(${(knuckle-.004).toFixed(3)},${knuckle.toFixed(3)},vGloveX));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${silver?'.028,.037,.055':'.085,.052,.029'}),glove);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.69,glove);');
 };m.customProgramCacheKey=()=>oldKey+'-fitted-gloves-'+kind;
}
function scalp(mesh,kind){
 mesh.geometry=soften(mesh.geometry,.24);const p=mesh.geometry.attributes.position,silver=kind==='silver';
 for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const crown=T.MathUtils.smoothstep(y,silver?1.67:1.73,silver?1.77:1.84);x*=1+.025*crown;if(!silver){y+=.012*crown*(.45+.55*T.MathUtils.smoothstep(x,-.08,.06));z-=.007*crown;}else{const tips=1-T.MathUtils.smoothstep(y,1.54,1.65);x+=Math.sign(x)*.003*tips;z-=.004*tips;}p.setXYZ(i,x,y,z);}
 finishGeometry(mesh.geometry);mesh.name='SM_Hero_Hair_'+kind;mesh.userData.hairstyle=true;const previous=mesh.material;mesh.material=previous.clone();mesh.material.onBeforeCompile=previous.onBeforeCompile;mesh.material.customProgramCacheKey=previous.customProgramCacheKey;mesh.material.roughness=silver?.67:.75;mesh.material.normalScale?.setScalar(.18);mesh.userData.rangerRebuild=true;
}
export function rebuildRanger(root,kind){
 if(!['scout','silver'].includes(kind)||root.userData.rangerRebuilt)return;
 const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});const body=meshes.find(o=>/_Body$/.test(o.name)),colors=PALETTE[kind];if(!body)return;
 const source=body.clone(),silver=kind==='silver';
 replace(body,kind,'Body',skinFrom(coatGeometry(kind),source),colors.cloth);
 // The old double belts and shoulder plate belong to the replaced medieval tunic.
 for(const mesh of meshes){
  const name=mesh.name;
  if(/Pauldron|Belt_[12]/.test(name)){mesh.visible=false;continue;}
  if(!mesh.visible)continue;
  if(/Arms/.test(name)&&mesh.material.name.includes('Regular'))gloves(mesh,kind);
  else if(/Arms/.test(name)&&!mesh.material.name.includes('Regular')){
   const part=name.includes('Bracer')?'Bracers':'Sleeves';replace(mesh,kind,part,reshapeCloth(mesh,kind,part),part==='Bracers'?colors.leather:colors.cloth);
  }else if(/Legs/.test(name)&&!silver)replace(mesh,kind,'Trousers',reshapeCloth(mesh,kind,'Trousers'),colors.inner);
  else if(/Feet/.test(name))replace(mesh,kind,'Boots',reshapeCloth(mesh,kind,'Boots'),colors.leather);
  else if(name==='Silver_Hunter_Boots_Shorts'){
   mesh.geometry=reshapeCloth(mesh,kind,'Boots');mesh.name='SM_Hero_Legs_Silver';mesh.userData.rangerRebuild=true;
  }else if(mesh.userData.hairstyle)scalp(mesh,kind);
  else if(name==='Eyebrows'){
   mesh.geometry=soften(mesh.geometry,.10);const p=mesh.geometry.attributes.position,mid=silver?1.668:1.708;for(let i=0;i<p.count;i++)p.setY(i,mid+(p.getY(i)-mid)*.82);finishGeometry(mesh.geometry);
  }
 }
 const strap=conformPatch(body,silver?[[.12,1.45,.10],[.09,1.30,.14],[.04,1.13,.09],[-.035,1.035,.10]]:[[-.155,1.515,.09],[-.11,1.36,.13],[.035,1.17,.11],[.15,1.04,.12]],silver?.027:.047);
 addSkinned(root,source,kind,'Harness',strap,colors.leather);
 // Lapels turn outwards from the neck and converge into the jacket overlap.
 for(const side of[-1,1]){
  const patch=conformPatch(body,silver?[[side*.061,1.51,.07],[side*.102,1.405,.13],[side*.025,1.235,.10]]:[[side*.074,1.573,.06],[side*.112,1.43,.13],[side*.020,1.23,.12]],v=>(silver?.048:.067)*Math.sin(v*Math.PI*.92)+.010,.012);
  addSkinned(root,source,kind,'Lapel_'+(side<0?'L':'R'),patch,silver?0x4a5670:0x344638);
 }
 const waist=silver?1.085:1.145,band=wrapBand(body,waist,silver?.030:.044);
 addSkinned(root,source,kind,'Belt',band,colors.leather);
 const buckle=conformPatch(body,[[-.019,waist,.12],[.019,waist,.12]],.034,.005);
 addSkinned(root,source,kind,'Buckle',buckle,silver?0x9aa2a5:0x9d855a);
 const pouch=grid(24,12,(u,v)=>{
  const a=u*Math.PI*2,r=.78+.22*Math.sin(v*Math.PI),x=silver?.156:-.178,y=silver?.998:1.010;
  return[x+Math.sin(a)*.041*r,y+(v-.5)*(silver?.112:.155),.082+Math.cos(a)*.035*r+.006*Math.sin(v*Math.PI*3)];
 });
 addSkinned(root,source,kind,'BeltPouch',closeEnds(pouch,24,12),colors.leather);
 const shoulder=conformPatch(body,[[.175,silver?1.464:1.515,.03],[.14,silver?1.425:1.465,.08],[.15,silver?1.365:1.385,.09]],silver?.055:.080,.006);
 addSkinned(root,source,kind,'ShoulderYoke',shoulder,silver?0x263247:0x5b452e);
 if(silver){
  const legs=meshes.find(m=>m.name==='SM_Hero_Legs_Silver');
  if(legs)for(const side of[-1,1]){
   const shin=conformPatch(legs,[[side*.113,.640,.03],[side*.12,.45,.025],[side*.131,.205,.045]],v=>.030+.018*Math.sin(v*Math.PI),.004);
   addSkinned(root,legs,kind,'BootPanel_'+(side<0?'L':'R'),shin,0x283446);
  }
 }
 if(!silver){
  const scarf=grid(40,8,(u,v)=>{const a=u*Math.PI*2,r=.088+.012*Math.sin(v*Math.PI)+.002*Math.sin(a*3+v*8);return[Math.sin(a)*r,1.552+v*.040+.0033*Math.sin(a*2+v*7),-.027+Math.cos(a)*r*.88];});
  addSkinned(root,source,kind,'Scarf',scarf,0x829075);
 }
 root.userData.rangerRebuilt=true;root.userData.rebuildStyle=silver?'indigo-short-coat-hunter':'olive-leather-expedition';
}

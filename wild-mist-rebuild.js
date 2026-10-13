import * as T from './vendor/three.module.js';
import {smoothSeams} from './hero-finish.js';

// Three authored wardrobes on the existing female rig. Vertices inherit the
// nearby source garment's weights; no new bone, actor transform or grip exists.
const palettes={
 lingya:{cloth:0x6d8474,shade:0x526a5a,trim:0xd2c4a8,leaf:0x8a9a82,leather:0x665143,sole:0x403c33},
 wuling:{cloth:0x352339,shade:0x221d2b,trim:0x927955,leaf:0x51324f,leather:0x322730,sole:0x504333},
 mirage:{cloth:0x1e2331,shade:0x131622,trim:0xa9b4c4,leaf:0x353750,leather:0x202430,sole:0x181b23}
};
const clamp=T.MathUtils.clamp,smooth=T.MathUtils.smoothstep;
const finishes=new Map();
function finishMaps(leather){
 if(finishes.has(leather))return finishes.get(leather);
 const size=128,normal=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),tau=Math.PI*2;
 // Periodic height fields avoid a visible repeat seam. Normal and roughness
 // maps are data, kept linear and shared by every template and live clone.
 const height=(x,y)=>leather?Math.sin((x*9+y*13)*tau/size)*.035+Math.sin((x*23-y*17)*tau/size)*.017+Math.cos((x*31+y*29)*tau/size)*.009:
  Math.cos(x*tau/8)*(.10+.025*Math.sin(y*tau/16))+Math.cos(y*tau/8)*(.075-.025*Math.sin(x*tau/16));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const k=(y*size+x)*4,dx=(height(x+1,y)-height(x-1,y))*2.5,dy=(height(x,y+1)-height(x,y-1))*2.5,length=Math.hypot(dx,dy,1);
  normal[k]=Math.round((.5-dx/length*.5)*255);normal[k+1]=Math.round((.5-dy/length*.5)*255);normal[k+2]=Math.round((.5+.5/length)*255);normal[k+3]=255;
  const r=Math.round(clamp((leather?.88:.94)+height(x,y)*.24,.75,1)*255);roughness[k]=roughness[k+1]=roughness[k+2]=r;roughness[k+3]=255;
 }
 const texture=data=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(leather?5:8,leather?7:12);t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 const maps={normalMap:texture(normal),roughnessMap:texture(roughness)};finishes.set(leather,maps);return maps;
}
function sampler(mesh){
 const a=mesh.geometry.attributes,used=new Set(mesh.geometry.index?.array??Array.from({length:a.position.count},(_,i)=>i));
 const points=[...used].map(i=>[a.position.getX(i),a.position.getY(i),a.position.getZ(i),i]);
 return(x,y,z)=>{
  const near=[];
  for(const p of points){const d=(x-p[0])**2+(y-p[1])**2+(z-p[2])**2;if(near.length<3||d<near[2][0]){near.push([d,p[3]]);near.sort((a,b)=>a[0]-b[0]);near.length=Math.min(3,near.length);}}
  const weights=new Map();for(const [d,i]of near){const w=1/Math.max(1e-7,d);for(let j=0;j<4;j++){const bone=a.skinIndex.array[i*4+j],amount=a.skinWeight.array[i*4+j]*w;if(amount>0)weights.set(bone,(weights.get(bone)||0)+amount);}}
  const best=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,p)=>n+p[1],0);while(best.length<4)best.push([0,0]);return[best.map(p=>p[0]),best.map(p=>p[1]/sum)];
 };
}
function surface(source){
 const p=[],uv=[],color=[],skinIndex=[],skinWeight=[],index=[],sample=sampler(source);
 return{
  binding:sample,
  vertex(x,y,z,c,u=0,v=0,binding=null){const k=p.length/3,[bones,weights]=binding||sample(x,y,z),shade=new T.Color(c);p.push(x,y,z);uv.push(u,v);color.push(shade.r,shade.g,shade.b);skinIndex.push(...bones);skinWeight.push(...weights);return k;},
  quad(a,b,c,d){index.push(a,b,c,b,d,c);},
  triangle(a,b,c){index.push(a,b,c);},
  build(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));g.setIndex(index);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}
 };
}
function grid(out,rows,cols,point){
 const ids=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const [x,y,z,c,binding]=point(i/cols,j/rows);ids.push(out.vertex(x,y,z,c,i/cols,j/rows,binding));}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;out.quad(ids[a],ids[a+cols+1],ids[a+1],ids[a+cols+2]);}
}
function rings(out,sections,point,sides=24,reverse=false){
 const ids=[];for(let j=0;j<sections.length;j++)for(let i=0;i<=sides;i++)ids.push(out.vertex(...point(sections[j],i/sides*Math.PI*2,j),i/sides,j/(sections.length-1)));
 for(let j=0;j<sections.length-1;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i;if(reverse)out.quad(ids[a],ids[a+sides+1],ids[a+1],ids[a+sides+2]);else out.quad(ids[a],ids[a+1],ids[a+sides+1],ids[a+sides+2]);}
 return ids;
}
function garmentMaterial(kind,part){
 const leather=/boot|cuff/.test(part),mirrorSeam=kind==='mirage'&&part==='robe',material=new T.MeshStandardMaterial({name:'WildMist_'+kind+'_'+part,vertexColors:true,roughness:leather?.85:.98,metalness:0,side:T.DoubleSide,...finishMaps(leather),normalScale:new T.Vector2(leather?.18:kind==='wuling'?.28:.24,leather?.18:kind==='wuling'?.28:.24)});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 tailoredPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntailoredPoint=position;');
  shader.fragmentShader='varying vec3 tailoredPoint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float weaveFade=1.-smoothstep(.003,.014,max(length(dFdx(tailoredPoint)),length(dFdy(tailoredPoint))));
   float weave=sin(tailoredPoint.y*540.)*sin((tailoredPoint.x+tailoredPoint.z)*470.);
   diffuseColor.rgb*=1.+weave*.025*weaveFade;
   ${mirrorSeam?`float petalHeight=clamp((tailoredPoint.y-1.045)/.38,0.,1.);
   float petalEdge=.025+.063*sin(petalHeight*3.14159265);
   float mirrorSeam=(1.-smoothstep(.0012,.0032,abs(abs(tailoredPoint.x)-petalEdge)))*smoothstep(.025,.065,tailoredPoint.z)*smoothstep(1.045,1.065,tailoredPoint.y)*(1.-smoothstep(1.405,1.425,tailoredPoint.y));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${new T.Color(palettes.mirage.trim).toArray().join(',')}),mirrorSeam*.76);`:''}`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=max(roughnessFactor,${leather?'.68':'.86'});
   ${part==='boots'?'roughnessFactor=mix(.98,roughnessFactor,smoothstep(.08,.15,tailoredPoint.y));':''}
   ${mirrorSeam?'roughnessFactor=mix(roughnessFactor,.54,mirrorSeam);':''}`);
  if(mirrorSeam)shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,.34,mirrorSeam);');
 };material.customProgramCacheKey=()=> 'wild-mist-tailored-'+kind+'-'+(mirrorSeam?'mirror-seam':part==='boots'?'mud':leather?'leather':'cloth');return material;
}
function replace(mesh,geometry,kind,part){smoothSeams(geometry);mesh.geometry=geometry;mesh.material=garmentMaterial(kind,part);mesh.userData.wildMistPart=part;mesh.visible=true;mesh.castShadow=mesh.receiveShadow=true;}
function profileAt(profile,y){
 let i=0;while(i<profile.length-2&&y>profile[i+1][0])i++;
 const a=profile[Math.max(0,i-1)],b=profile[i],c=profile[i+1],d=profile[Math.min(profile.length-1,i+2)],span=c[0]-b[0],t=clamp((y-b[0])/span,0,1),t2=t*t,t3=t2*t;
 return b.slice(1).map((v,k)=>{const q=k+1,m0=(c[q]-a[q])/(c[0]-a[0]),m1=(d[q]-b[q])/(d[0]-b[0]);return(2*t3-3*t2+1)*v+(t3-2*t2+t)*span*m0+(-2*t3+3*t2)*c[q]+(t3-t2)*span*m1;});
}
function torso(mesh,kind){
 const p=palettes[kind],out=surface(mesh),child=kind==='lingya',mist=kind==='mirage';
 const sections=child?[[.99,.174,.114],[1.075,.165,.116],[1.14,.144,.110],[1.23,.147,.120],[1.32,.171,.128],[1.39,.184,.121],[1.44,.166,.097],[1.472,.091,.073],[1.493,.069,.062],[1.503,.064,.060],[1.505,.060,.058]]:
 mist?[[.925,.206,.124],[1.015,.182,.120],[1.11,.142,.103],[1.19,.126,.110],[1.27,.151,.135],[1.35,.179,.143],[1.405,.198,.121],[1.452,.174,.088],[1.48,.080,.060],[1.515,.064,.060]]:
 [[.82,.219,.149],[.90,.211,.147],[1.015,.190,.135],[1.10,.165,.117],[1.18,.140,.110],[1.26,.158,.137],[1.35,.183,.144],[1.41,.201,.120],[1.463,.135,.079],[1.49,.074,.063]];
 const facing=(y,a)=>{const start=mist?1.425:1.405,height=mist?.38:.54,v=clamp((start-y)/height,0,1),angle=Math.atan2(Math.sin(a),Math.cos(a)),center=mist?0:.14*(1-v),edge=Math.abs(angle-center)/(mist?.50:.73);return{v,edge,inside:!child&&y<start&&y>start-height&&edge<1};};
 const shape=(y,a)=>{const[rx,rz]=profileAt(sections,y),hem=1-smooth(y,sections[0][0],1.15);
  // Folds open below the tied waist and compress at the ribs; their small
  // changing depth catches light without turning the whole coat into fluting.
  const tension=Math.exp(-(((y-1.15)/.14)**2)),f=facing(y,a),seam=f.inside?.0012*Math.exp(-(((f.edge-.94)/.08)**2))*Math.sin(Math.PI*f.v):0,fold=(.0042*Math.sin(a*9+(y-1.1)*9)+.002*Math.sin(a*15-y*14))*tension+.004*Math.cos(a*(mist?6:10)+.4)*hem-seam;
  return[Math.sin(a)*(rx+fold),y+(mist?-.032*(.5+.5*Math.cos(a*4))*hem:child?0:.025*Math.sin(a-.5)*hem),Math.cos(a)*(rz+fold)-.028-(child?.012*smooth(y,1.46,1.50):0)];
 };
 const dense=[];for(let j=0;j<sections.length-1;j++)for(let step=0;step<3;step++)dense.push(sections[j][0]+(sections[j+1][0]-sections[j][0])*step/3);dense.push(sections.at(-1)[0]);
 // The front facing is part of the same surface. The previous separate patch
 // sampled different triangles/weights only 2.5 mm above the robe, intersecting
 // it in cast poses and leaving sharp dark slivers across the chest.
 // Exact wrap coordinates also select identical skin weights at the front seam.
 rings(out,dense,(y,a,j)=>{if(child&&a===Math.PI*2)a=0;const f=facing(y,a),leafShoulder=child&&y>1.32&&Math.abs(Math.sin(a))>.70;return[...shape(y,a),j===0||j===dense.length-1||child&&y>1.465?p.trim:y>1.11&&y<1.165?p.shade:f.inside||leafShoulder?p.leaf:Math.abs(Math.sin(a))>.88?p.shade:p.cloth];},32);
 return out.build();
}
function sleeves(mesh,kind){
 const p=palettes[kind],out=surface(mesh),child=kind==='lingya',mist=kind==='mirage';
 for(const side of[-1,1]){
  // The new uncovered shoulder needs its sleeve root tucked inside the torso.
  const profile=child?[[.075,.030],[.12,.047],[.175,.065],[.21,.070],[.28,.067],[.35,.059],[.405,.055],[.46,.055],[.53,.049],[.59,.046],[.63,.046]]:
   mist?[[.148,.065],[.21,.069],[.30,.064],[.39,.060],[.45,.054],[.52,.056],[.585,.075],[.645,.066]]:
   [[.148,.068],[.21,.077],[.30,.073],[.39,.065],[.45,.062],[.52,.070],[.58,.072],[.625,.064]];
  const dense=[];for(let j=0;j<profile.length-1;j++)for(let step=0;step<2;step++){const x=T.MathUtils.lerp(profile[j][0],profile[j+1][0],step/2);dense.push([x,profileAt(profile,x)[0]]);}dense.push(profile.at(-1));
  rings(out,dense,([x,r],a,j)=>{const elbow=Math.exp(-(((x-.41)/.075)**2)),crease=(.0028*Math.sin((x-.35)*105+a*1.6)+.0012*Math.cos(a*5))*elbow,tip=mist?smooth(x,.53,.645)*.020*Math.cos(a):0;
   const radius=(r+crease)*(1-.13*smooth(x,.48,.52)*(1-smooth(x,.605,.625)));
   return[side*(x+tip),1.415+Math.cos(a)*radius,-.049+Math.sin(a)*radius*.90,j===dense.length-1||child&&x>=.45&&x<=.47?p.trim:mist&&x>.52?p.leaf:p.cloth];
  },20,side<0);
 }
 // Retain the authored glove/finger triangles exactly outside the new cuffs.
 const g=mesh.geometry,a=g.attributes,ids=g.index?.array??Array.from({length:a.position.count},(_,i)=>i),copied=new Map();
 for(let i=0;i<ids.length;i+=3){const tri=[ids[i],ids[i+1],ids[i+2]];if(Math.min(...tri.map(i=>Math.abs(a.position.getX(i))))<.625)continue;const mapped=tri.map(i=>{if(!copied.has(i))copied.set(i,out.vertex(a.position.getX(i),a.position.getY(i),a.position.getZ(i),p.leather,a.uv?.getX(i)||0,a.uv?.getY(i)||0,[a.skinIndex.array.slice(i*4,i*4+4),a.skinWeight.array.slice(i*4,i*4+4)]));return copied.get(i);});out.triangle(...mapped);}
 return out.build();
}
function cuffs(mesh,kind){
 const p=palettes[kind],out=surface(mesh),mist=kind==='mirage',child=kind==='lingya';
 const profile=child?[[.535,.058],[.55,.063],[.565,.062],[.585,.059],[.601,.056],[.607,.054]]:[[.49,.074],[.507,.077],[.535,.078],[.57,.077],[.597,.071],[.607,.069]];
 for(const side of[-1,1])rings(out,profile,([x,r],a,j)=>[side*x,1.415+Math.cos(a)*r,-.049+Math.sin(a)*r*.95,j===0||j===5?p.trim:mist||child?p.leaf:p.leather],16,side<0);
 return out.build();
}
function legs(mesh,kind){
 const p=palettes[kind],out=surface(mesh),child=kind==='lingya',mist=kind==='mirage';
 for(const side of[-1,1])rings(out,[[.24,.061,.065],[.36,.063,.068],[.47,.069,.074],[.57,.070,.076],[.66,.079,.081],[.76,.085,.090],[.87,.089,.095],[.97,.092,.096],[1.04,.084,.087]],([y,rx,rz],a)=>{
  const cx=side*(.10+.025*smooth(y,.30,.97)),z=-.033+Math.cos(a)*rz,color=child?(y<.49?p.trim:y>.79?p.leaf:0xe4b391):mist?(Math.abs(Math.sin(a))>.8?p.leaf:p.shade):p.shade;
  return[cx+Math.sin(a)*rx,y,z,color];
 },20);
 return out.build();
}
function boots(mesh,kind){
 const p=palettes[kind],out=surface(mesh),child=kind==='lingya',mist=kind==='mirage',height=child?.28:mist?.60:.47;
 const profile=[[.004,.064,.105,.013],[.023,.073,.121,.014],[.043,.073,.121,.014],[.070,.070,.114,.012],[.112,.063,.089,-.018],[.16,.062,.075,-.030],...(!child?[[height*.68,mist?.078:.073,mist?.084:.080,-.035]]:[]),[height-.038,mist?.079:.070,mist?.084:.076,-.033],[height-.023,mist?.081:.080,mist?.086:.086,-.033],[height,mist?.078:.079,mist?.083:.084,-.033]];
 for(const side of[-1,1]){const ids=rings(out,profile,([y,rx,rz,cz],a,j)=>{
  const toe=Math.max(0,Math.cos(a)),x=side*(.10+.025*smooth(y,.30,.97))+Math.sin(a)*rx,z=cz+Math.cos(a)*rz+toe*.015*(1-smooth(y,.045,.13)),mud=!mist&&y<.105;
  return[x,y,z,j<3||mud?p.sole:y>=height-.023?p.trim:p.leather];
 },24);const sole=out.vertex(side*.10,.004,.013,p.sole);for(let i=0;i<24;i++)out.triangle(sole,ids[i+1],ids[i]);}
 return out.build();
}
function hood(mesh,kind){
 const p=palettes[kind],out=surface(mesh),child=kind==='lingya',center=child?1.614:1.630,rx=child?.149:.161,ry=child?.151:.175;
 grid(out,14,32,(u,v)=>{const a=u*Math.PI*2,theta=.94+v*(Math.PI-.94),r=Math.sin(theta),edge=1-smooth(v,0,.11),fold=1+.018*Math.cos(a*8)*Math.sin(v*Math.PI),roll=child?.0045*Math.sin(Math.PI*Math.min(1,v/.13)):0;
  return[Math.cos(a)*(rx*r*fold+roll),center+Math.sin(a)*(ry*r+roll), (child?-.037:-.050)+Math.cos(theta)*(child?.174:.186)+roll*.6,edge>.3?p.trim:child?p.leaf:p.shade];
 });return out.build();
}
function longHair(mesh){
 // mirageHair now sculpts and subdivides the real rear locks in one pass.
 // Do not stretch the fringe a second time during wardrobe rebuilding.
 mesh.geometry=mesh.geometry.clone();mesh.userData.wildMistPart='long-hair';mesh.castShadow=mesh.receiveShadow=true;
}
export function rebuildWildMist(root,kind){
 if(!palettes[kind]||root.userData.wildMistRebuilt)return root;
 const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const find=ending=>meshes.find(o=>o.name.endsWith(ending));
 const body=find('_Body'),arms=find('_Arms_1'),feet=find('_Feet'),cuff=find('_Arms_Bracer'),head=find('_Head_Hood');
 if(!body||!arms||!feet||!cuff||!head)throw new Error('Wild/mist rebuild requires the complete female ranger template');
 replace(body,torso(body,kind),kind,'robe');replace(arms,sleeves(arms,kind),kind,'sleeves');replace(cuff,cuffs(cuff,kind),kind,'cuffs');replace(feet,boots(feet,kind),kind,'boots');
 const lower=kind==='lingya'?meshes.find(o=>o.name==='Superhero_Female'&&!o.material.name):find('_Legs');
 if(!lower)throw new Error('Wild/mist rebuild requires weighted legs');replace(lower,legs(lower,kind),kind,'legs');
 for(const m of meshes)if(/_Body_Belt_|Pauldrons/.test(m.name))m.visible=false;
 if(kind==='mirage'){head.visible=false;for(const m of meshes)if(m.userData.mirageLongHair)longHair(m);}else if(kind==='lingya')head.visible=false;else replace(head,hood(head,kind),kind,'hood');
 root.userData.wildMistRebuilt=kind;return root;
}

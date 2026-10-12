import * as T from './vendor/three.module.js';
import{mergeGeometries}from'./vendor/BufferGeometryUtils.js';

// Six shared templates keep each tree independently removable without per-tree GPU assets.
const templates=new Map(),material=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
// Updated from the existing game-time canopy loop, never from wall-clock time.
const treeBreezeTime={value:0};
// Object-space detail stays attached during canopy sway and fades before it becomes subpixel noise.
material.onBeforeCompile=shader=>{
 shader.vertexShader='attribute float treeSurface; varying float treeKind; varying vec3 treePoint;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntreeKind=treeSurface;treePoint=position;');
 shader.fragmentShader=`varying float treeKind; varying vec3 treePoint;
  float treeHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float treeNoise(vec3 p){
   vec3 c=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
   return mix(mix(mix(treeHash(c),treeHash(c+vec3(1,0,0)),f.x),mix(treeHash(c+vec3(0,1,0)),treeHash(c+vec3(1,1,0)),f.x),f.y),
    mix(mix(treeHash(c+vec3(0,0,1)),treeHash(c+vec3(1,0,1)),f.x),mix(treeHash(c+vec3(0,1,1)),treeHash(c+vec3(1,1,1)),f.x),f.y),f.z);
  }
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float treeFootprint=max(length(dFdx(treePoint)),length(dFdy(treePoint)));
  float treeDetail=1.0-smoothstep(.035,.13,treeFootprint),treeRelief=0.0,treeScatter=0.0;
  if(treeKind>.5){
   // Thin leaves carry their variation in vertices, rather than noisy swollen surfaces.
   treeScatter=1.0-step(1.5,treeKind);
  }else{
   float treeGrain=treeNoise(treePoint*vec3(27.0,1.15,27.0)),treeFissure=smoothstep(.30,.65,treeGrain);
   float treeBark=treeNoise(treePoint*vec3(53.0,5.0,53.0));
   diffuseColor.rgb*=mix(1.0,.64+treeFissure*.47+treeBark*.18,treeDetail);
   treeRelief=(treeFissure*.018+treeBark*.005)*treeDetail;
  }
 `);
 // A leaf crown scatters a little back-light; bark and snow keep opaque material response.
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
   if(treeKind>.5 && treeKind<1.5){
    float leafTransmission=pow(max(0.0,dot(-normal,directionalLights[0].direction)),2.0);
    reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*vec3(.035,.065,.018)*leafTransmission*treeScatter;
   }
  #endif
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  vec3 treeDx=dFdx(-vViewPosition),treeDy=dFdy(-vViewPosition),treeRx=cross(treeDy,normal),treeRy=cross(normal,treeDx);
  float treeDet=dot(treeDx,treeRx);
  normal=normalize(abs(treeDet)*normal-sign(treeDet)*(dFdx(treeRelief)*treeRx+dFdy(treeRelief)*treeRy));
 `);
};
material.customProgramCacheKey=()=> 'tree-open-leaf-sprays';
function tint(geometry,color,canopy=false){
 const p=geometry.attributes.position,n=geometry.attributes.normal,c=new T.Color(color),colors=[];
 for(let i=0;i<p.count;i++){
  const light=canopy?Math.max(0,n.getY(i)):0,angle=Math.atan2(p.getZ(i),p.getX(i)),moss=canopy?0:Math.max(0,1-p.getY(i)/1.25)*.11;
  const grain=canopy?.04*Math.sin(p.getX(i)*2.3+p.getY(i)*1.7+p.getZ(i)*1.3):.11*Math.sin(angle*5+.18*Math.sin(p.getY(i)*2))+.055*Math.cos(angle*9-p.getY(i)*.8);
  const shade=(canopy?.77+light*.25:.82)+grain;colors.push(c.r*shade*(1+light*.045-moss),c.g*(shade+moss*.38),c.b*shade*(1-light*.06-moss*.3));
 }
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.deleteAttribute('uv');return geometry;
}
function merge(parts){const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;}
function surface(vertices,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function limb(points,radii,sides=7){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),up=new T.Vector3(0,1,0),q=new T.Quaternion(),v=new T.Vector3(),vertices=[],indices=[];
 for(let i=0;i<radii.length;i++){
  const t=i/(radii.length-1),center=curve.getPoint(t);q.setFromUnitVectors(up,curve.getTangent(t));
  for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,r=radii[i]*(1+.045*Math.cos(a*3+i*.4));v.set(Math.cos(a)*r,0,Math.sin(a)*r).applyQuaternion(q).add(center);vertices.push(v.x,v.y,v.z);}
 }
 for(let i=0;i<radii.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
 for(const end of[0,radii.length-1]){const p=curve.getPoint(end/(radii.length-1)),center=vertices.length/3;vertices.push(p.x,p.y,p.z);for(let j=0;j<sides;j++){const a=end*sides+j,b=end*sides+(j+1)%sides;indices.push(...(end?[center,b,a]:[center,a,b]));}}
 return surface(vertices,indices);
}
// The same asymmetric branching pattern drives scanned and offline foliage.
// Leaves grow from six tapering side twigs, with open channels between the twigs.
const leafSpray=(()=>{
 const root=[.48,.86],tip=[.56,.13],stems=[[root,tip]],leaves=[];
 const ends=[[.14,.55],[.82,.51],[.17,.28],[.82,.23],[.32,.12],[.67,.07]];
 for(let twig=0;twig<6;twig++){
  const t=.15+twig*.145,start=[T.MathUtils.lerp(root[0],tip[0],t),T.MathUtils.lerp(root[1],tip[1],t)],end=ends[twig],dx=end[0]-start[0],dy=end[1]-start[1],heading=Math.atan2(dx,-dy);stems.push([start,end]);
  for(let i=0;i<11;i++){
   const along=.10+i*.078,length=.108+.040*(.5+.5*Math.sin(twig*2.8+i*1.7));
   leaves.push({x:start[0]+dx*along,y:start[1]+dy*along,angle:heading+(i%2?1:-1)*(.70+.20*Math.sin(i*1.3+twig)),length,index:twig*11+i});
  }
 }
 return{stems,leaves};
})();
function leafTexture(data,size,name,flipY=false){
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.name=name;texture.flipY=flipY;texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
function fallbackBlade(data,size,{x:cx,y:cy,angle,length,index,width=length*.42}){
 const cos=Math.cos(angle),sin=Math.sin(angle),extent=length+width,warm=.5+.5*Math.sin(index*2.17);
 for(let y=Math.max(1,Math.floor((cy-extent)*size));y<Math.min(size-1,(cy+extent)*size);y++)for(let x=Math.max(1,Math.floor((cx-extent)*size));x<Math.min(size-1,(cx+extent)*size);x++){
  const dx=(x+.5)/size-cx,dy=(y+.5)/size-cy,t=(dx*sin-dy*cos)/length,across=dx*cos+dy*sin;if(t<=0||t>=1)continue;
  const outline=width*.5*Math.pow(Math.sin(t*Math.PI),.78)*(1+.035*Math.sin(t*29+index)),alpha=Math.round(T.MathUtils.clamp((outline-Math.abs(across))*size+.5,0,1)*255);if(!alpha)continue;
  const light=(.85+t*.17)*(across>0?.94:1.03),at=(y*size+x)*4;
  data[at]=Math.round((93+warm*18)*light);data[at+1]=Math.round((121+warm*18)*light);data[at+2]=Math.round((69+warm*13)*light);data[at+3]=Math.max(data[at+3],alpha);
 }
}
function leafAtlas(){
 const size=256,data=new Uint8Array(size*size*4);
 for(const [n,[a,b]]of leafSpray.stems.entries()){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,width=n?.0019:.0034;
  for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){
   const px=(x+.5)/size-a[0],py=(y+.5)/size-a[1],t=T.MathUtils.clamp((px*dx+py*dy)/length,0,1);
   if(Math.hypot(px-dx*t,py-dy*t)>width*(1-t*.75))continue;const at=(y*size+x)*4;data.set([111,101,69,255],at);
  }
 }
 for(const leaf of leafSpray.leaves)fallbackBlade(data,size,leaf);
 for(let y=126;y<130;y++)for(let x=126;x<130;x++)data.set([109,132,73,255],(y*size+x)*4);
 return leafTexture(data,size,'shared-tree-leaf-atlas');
}
const leafMaterial=new T.MeshStandardMaterial({name:'shared-cutout-leaves',map:leafAtlas(),vertexColors:true,roughness:.96,side:T.DoubleSide,alphaTest:.30,transparent:false});
// Assemble the scanned leaves once into the same small curved sprays. This
// changes foliage detail without extra tree meshes, draw calls or runtime URLs.
export const TREE_LEAF_FILES={map:'island_tree_01_leaves_diff_1k.jpg',alphaMap:'island_tree_01_leaves_alpha_1k.png'};
// [u minimum, v minimum, width, height], with v=0 at the leaf's stem.
export const TREE_LEAF_UVS=[[.005,.48,.155,.52],[.160,.59,.185,.41],[.357,.63,.132,.35],[.505,.63,.155,.34],[.671,.56,.152,.44],[.00,.00,.18,.40],[.174,.00,.18,.43],[.413,.00,.165,.40]];
const leafSurfaces=new Set(),leafHooks=new WeakSet();let rawLeafMap;
function rawLeafFallback(){
 const size=256,data=new Uint8Array(size*size*4);
 for(const [index,[u,v,w,h]]of TREE_LEAF_UVS.entries())fallbackBlade(data,size,{x:u+w*.5,y:1-v-h*.015,angle:0,length:h*.97,width:w*.86,index});
 // Stems in small plant meshes use this stable, opaque point on the first leaf.
 for(let y=55;y<59;y++)for(let x=20;x<24;x++)data.set([103,129,77,255],(y*size+x)*4);
 return leafTexture(data,size,'shared-raw-leaf-fallback',true);
}
function thinLeafLight(shader){
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
  #if NUM_HEMI_LIGHTS > 0
   reflectedLight.indirectDiffuse+=diffuseColor.rgb*hemisphereLights[0].skyColor*(gl_FrontFacing?.045:.19);
  #endif
  #if NUM_DIR_LIGHTS > 0
   float leafTransmission=pow(max(0.0,dot(-normal,directionalLights[0].direction)),2.0);
   reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*vec3(.085,.12,.045)*leafTransmission;
  #endif
 `);
}
// Raw scanned leaves for small plants, not the composed crown atlas. Retain wind hooks.
export function applyTreeLeafSurface(target){
 if(leafSurfaces.has(target))return target;
 target.map=rawLeafMap??=rawLeafFallback();target.alphaMap=null;target.side=T.DoubleSide;target.alphaTest=.34;target.roughness=.92;target.transparent=false;target.depthWrite=true;target.needsUpdate=true;
 if(!leafHooks.has(target)){
  const before=target.onBeforeCompile,key=target.customProgramCacheKey();
  target.onBeforeCompile=(shader,renderer)=>{before.call(target,shader,renderer);thinLeafLight(shader);};
  target.customProgramCacheKey=()=>key+'|scanned-thin-tree-leaf';leafHooks.add(target);target.addEventListener('dispose',()=>leafSurfaces.delete(target));
 }
 leafSurfaces.add(target);return target;
}
let treeLoading;
export function loadTreeTextures(){
 if(treeLoading)return treeLoading;
 const loader=new T.ImageLoader();
 treeLoading=Promise.all(Object.values(TREE_LEAF_FILES).map(file=>loader.loadAsync(new URL('./assets/environment/'+file,import.meta.url).href))).then(([color,mask])=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(color,0,0,1024,1024);const pixels=ctx.getImageData(0,0,1024,1024);
  ctx.clearRect(0,0,1024,1024);ctx.drawImage(mask,0,0,1024,1024);const alpha=ctx.getImageData(0,0,1024,1024).data;
  for(let i=0;i<alpha.length;i+=4)pixels.data[i+3]=alpha[i+1];ctx.putImageData(pixels,0,0);
  const atlas=document.createElement('canvas');atlas.width=atlas.height=1024;const paint=atlas.getContext('2d');
  paint.strokeStyle='#716549';paint.lineCap='round';
  for(const [i,[a,b]]of leafSpray.stems.entries()){
   paint.lineWidth=i?2.2:3.8;paint.beginPath();paint.moveTo(a[0]*1024,a[1]*1024);paint.lineTo(b[0]*1024,b[1]*1024);paint.stroke();
  }
  for(const {x,y,angle,length,index}of leafSpray.leaves){
   const [sx,v,sw,sh]=TREE_LEAF_UVS[index%TREE_LEAF_UVS.length],sy=1-v-sh,width=length*sw/sh;
   paint.save();paint.translate(x*1024,y*1024);paint.rotate(angle);
   paint.drawImage(canvas,sx*1024,sy*1024,sw*1024,sh*1024,-width*512,-length*1024,width*1024,length*1024);paint.restore();
  }
  // Extra geometric leaves sample this small opaque texel, at every LOD and load order.
  paint.fillStyle='#6d8449';paint.fillRect(510,510,4,4);
  const rgba=paint.getImageData(0,0,1024,1024).data,texture=leafTexture(new Uint8Array(rgba),1024,'M_Tree_ScannedLeafSprays_A'),raw=leafTexture(new Uint8Array(pixels.data),1024,'M_Tree_ScannedLeaves_Raw',true);
  const previous=leafMaterial.map,previousRaw=rawLeafMap;leafMaterial.map=texture;leafMaterial.needsUpdate=true;rawLeafMap=raw;
  for(const target of leafSurfaces){target.map=raw;target.needsUpdate=true;}previous.dispose();previousRaw?.dispose();return true;
 }).catch(()=>false);return treeLoading;
}
const firMaterial=material.clone();firMaterial.side=T.DoubleSide;
firMaterial.onBeforeCompile=shader=>{
 material.onBeforeCompile(shader);
 // The distant folded spray is double-sided; its underside stays needle-green.
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb*=vec3(.40,.56,.52);');
};
firMaterial.customProgramCacheKey=()=> 'tree-rounded-snow-sprays';
leafMaterial.onBeforeCompile=shader=>{
 shader.uniforms.treeBreezeTime=treeBreezeTime;
 shader.vertexShader='uniform float treeBreezeTime; attribute float treeLeafFlex;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  mat4 treeFrame=modelMatrix;
  #ifdef USE_INSTANCING
   treeFrame=modelMatrix*instanceMatrix;
  #endif
  vec3 treeOrigin=treeFrame[3].xyz;
  float treePhase=treeOrigin.x*.17+treeOrigin.z*.13;
  float treeGust=.65+.35*(.5+.5*sin(treeBreezeTime*.42+treeOrigin.x*.08+treeOrigin.z*.06));
  float treeFlutter=sin(treeBreezeTime*1.3+position.x*2.1+position.z*1.4+treePhase)*.008+sin(treeBreezeTime*2.07+position.y*2.4+treePhase*.7)*.003;
  vec2 treeWind=vec2(-.644,.765);
  vec2 treeLocalWind=vec2(dot(treeWind,normalize(treeFrame[0].xz)),dot(treeWind,normalize(treeFrame[2].xz)));
  transformed.xz+=treeLocalWind*treeFlutter*treeGust*treeLeafFlex;
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=vec3(1.13,1.10,1.02);');
 thinLeafLight(shader);
};
leafMaterial.customProgramCacheKey=()=> 'tree-branched-thin-leaves-breeze';
function sprayPose(x,y,z,width,depth,height,phase,spray){
 // A twig carries a hanging skirt, two shoulders and a tilted top, with their
 // edges overlapping. The crown reads as a volume even from ground level.
 const angle=phase+[-.55,1.72,3.12,4.65,.48][spray],tilt=[-.34,.45,.29,.60,.95][spray],normal=new T.Vector3(Math.cos(angle)*.72,tilt,Math.sin(angle)*.72).normalize();
 const across=new T.Vector3().crossVectors(new T.Vector3(0,1,0),normal).normalize(),along=new T.Vector3().crossVectors(normal,across);
 const center=new T.Vector3(x+Math.cos(angle)*width*[.38,.31,.26,.29,.12][spray],y+height*[-.08,.21,.09,.35,.52][spray],z+Math.sin(angle)*depth*[.38,.31,.26,.29,.12][spray]);
 return{center,normal,across,along};
}
const sprayBow=(u,v)=>.23-.25*(u*u+v*v)/(1.17*1.17)-.07*v*v*v;
function broadFan(x,y,z,width,depth,height,phase){
 // Five small curved sprays sit around a twig, rather than intersecting at one large card.
 // The six-triangle fans retain leaf gaps without a solid outer shell.
 const vertices=[],indices=[],colors=[],uvs=[],normals=[],flex=[],point=new T.Vector3(),shading=new T.Vector3();
 for(let spray=0;spray<5;spray++){
  const first=vertices.length/3,{center,normal,across,along}=sprayPose(x,y,z,width,depth,height,phase,spray);
  const vertex=(u,v)=>{
   point.copy(center).addScaledVector(across,u*width*.72).addScaledVector(along,v*depth*.96).addScaledVector(normal,sprayBow(u,v)*height);
   vertices.push(point.x,point.y,point.z);uvs.push(.5+u*.5,.5+v*.5);flex.push(Math.min(1,Math.hypot(u,v)/1.17));
   // Continuous dome normals avoid six broad triangular highlights across one leaf cluster.
   shading.copy(normal).addScaledVector(across,.50*height*u/(1.17*1.17*width*.72)).addScaledVector(along,height*(.50*v/(1.17*1.17)+.21*v*v)/(depth*.96)).normalize();normals.push(shading.x,shading.y,shading.z);
   const shade=.83+(normal.y+1)*.075+spray*.012,warm=.5+.5*Math.sin(phase*2.7+spray);
   colors.push(Math.min(1,shade*(.97+warm*.06)),Math.min(1,shade),Math.min(1,shade*(.89-warm*.04)));
  };
  vertex(0,0);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,r=1.17*(.95+.035*Math.sin(a*3+phase+spray*.6)+.015*Math.cos(a*2-phase));vertex(Math.cos(a)*r,Math.sin(a)*r);}
  for(let i=0;i<6;i++)indices.push(first,first+1+i,first+1+(i+1)%6);
 }
 const g=surface(vertices,indices);g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setAttribute('treeLeafFlex',new T.Float32BufferAttribute(flex,1));return g;
}
function rootedStem(stem,radii,snow,variant){
 // One continuous bark surface rolls from buried, unequal roots into the stem.
 // Reuse the old root triangle allowance for rounded rings, not separate fins.
 const sides=snow?8:16,steps=snow?[0,.125,.25,.5,.75,1]:[0,.125,.25,.375,.5,.75,1];
 const curve=new T.CatmullRomCurve3(stem.map(p=>new T.Vector3(...p))),up=new T.Vector3(0,1,0),q=new T.Quaternion(),v=new T.Vector3(),vertices=[],indices=[];
 for(const t of steps){
  const center=curve.getPoint(t),section=t*4,k=Math.min(3,Math.floor(section)),radius=T.MathUtils.lerp(radii[k],radii[k+1],section-k),flare=1-T.MathUtils.smoothstep(t,0,.36);
  q.setFromUnitVectors(up,curve.getTangent(t));
  for(let j=0;j<sides;j++){
   const a=j/sides*Math.PI*2,turn=a-variant*.67+flare*.11;let root=0;
   for(const [angle,reach]of[[0,1],[1.55,.78],[3.25,.90],[4.80,.68]])root=Math.max(root,Math.max(0,Math.cos(turn-angle))**10*reach);
   const r=radius*(1+.045*Math.cos(a*3+t*1.6))+flare*(snow?.23:.20)*root;
   v.set(Math.cos(a)*r,0,Math.sin(a)*r).applyQuaternion(q).add(center);if(t===0)v.y=-.042;vertices.push(v.x,v.y,v.z);
  }
 }
 for(let i=0;i<steps.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
 for(const end of[0,steps.length-1]){
  const p=curve.getPoint(steps[end]),center=vertices.length/3;vertices.push(p.x,end?p.y:-.042,p.z);
  for(let j=0;j<sides;j++){const a=end*sides+j,b=end*sides+(j+1)%sides;indices.push(...(end?[center,b,a]:[center,a,b]));}
 }
 return surface(vertices,indices);
}
function firFan(angle,height,reach,width,variant,level){
 // Overlapping needle wings carry a scalloped snow ridge. Close LODs include
 // the dark lower surface, so looking up sees foliage rather than white cards.
 const vertices=[],indices=[],colors=[],normals=[],c=new T.Color(),normal=new T.Vector3(),cos=Math.cos(angle),sin=Math.sin(angle),needles=new T.Color(0x55766b),snow=new T.Color(0xd0dfd9);
 const vertex=(x,y,z,nx,ny,nz,cover)=>{
  vertices.push(cos*x-sin*z,y,sin*x+cos*z);normal.set(nx,ny,nz).normalize();normals.push(cos*normal.x-sin*normal.z,normal.y,sin*normal.x+cos*normal.z);
  c.copy(needles).lerp(snow,cover);colors.push(c.r,c.g,c.b);return vertices.length/3-1;
 };
 for(let leaf=0;leaf<6;leaf++){
  const start=.08+Math.floor(leaf/2)*.24+Math.sin(angle+leaf*1.9+variant)*.026,side=leaf%2?1:-1,spread=1-start*.45;
  const x=(start+.19)*reach,z=side*spread*width*.46,y=height-(start+.17)*reach*.17,rx=reach*(.25+.015*Math.sin(angle+leaf)),rz=spread*width*.58,rise=reach*(.065+.02*Math.sin(angle*2+leaf+variant)),drop=reach*.050;
  const point=(u,v,depth=0,lower=false)=>{
   // Needles hang below each ridge. Even the distant four-point fold has a
   // raised spine and drooping wings, so conifers retain depth in side views.
   const q=u*u+v*v,edge=q>.99,py=y-u*rx*.20-side*v*rz*.15+(lower?-drop:rise)*(1-q)-Math.abs(v)*reach*.16+(level===2?rise*(1-Math.abs(v)):0);
   return vertex(x+u*rx,py,z+v*rz+side*u*width*.13,edge?u/rx:.20+2*(lower?-drop:rise)*u/rx,edge?.10:lower?-1:1,edge?v/rz:side*.15+2*(lower?-drop:rise)*v/rz,level===2?.48+.045*Math.sin(leaf+u):lower?.06:edge?.22:.74-depth*.13);
  };
  if(level===2){
   const first=vertices.length/3;for(let i=0;i<4;i++){const a=i*Math.PI*.5;point(Math.cos(a),Math.sin(a));}
   indices.push(first,first+2,first+1,first,first+3,first+2);
  }else{
   const sides=level===0?8:4,center=point(0,0),rings=[];
   for(const radius of level===0?[.55,1]:[1]){
    const ring=[];for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,edge=radius===1&&sides===8&&i%2?.84:1;ring.push(point(Math.cos(a)*radius*edge,Math.sin(a)*radius*edge,radius));}rings.push(ring);
   }
   for(let i=0;i<sides;i++)indices.push(center,rings[0][(i+1)%sides],rings[0][i]);
   if(rings.length===2)for(let i=0;i<sides;i++){const j=(i+1)%sides,a=rings[0],b=rings[1];indices.push(a[i],a[j],b[i],a[j],b[j],b[i]);}
   const bottom=point(0,0,0,true),rim=rings.at(-1);
   for(let i=0;i<sides;i++)indices.push(bottom,rim[i],rim[(i+1)%sides]);
  }
 }
 // The fine curved midrib remains visible through the gaps between cushions.
 const first=vertices.length/3;
 for(const [r,h,z]of[[0,0,0],[.52,-.040,.028],[1,-.24,0],[.52,-.040,-.028]])vertex(r*reach,height+h*reach,z*width,0,1,0,.04);
 indices.push(first,first+1,first+2,first,first+2,first+3);
 const g=surface(vertices,indices);g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
function firCrown(variant,level){
 const parts=[];
 for(let layer=0;layer<4;layer++)for(let j=0;j<6;j++){
  const a=j*Math.PI/3+layer*.65+variant*.57+Math.sin(j*2.8+layer+variant)*.10,reach=(1.42-layer*.23)*(1+Math.sin(j*2.2+variant+layer*.7)*.09),rise=Math.sin(j*1.8+variant+layer*2.4)*.105;
  parts.push(firFan(a,.38+layer*.56+rise,reach,(.56-layer*.080)*(1+Math.cos(j*1.7+layer)*.08),(j+variant)%3,level));
 }
 // Short, tapering sprays grow from one eccentric leader rather than carrying
 // detached snowballs. The sparse green tip continues the upper branch group.
 const lean=(variant-1)*.04,leader=limb([[lean+.01,1.94,0],[lean+.04,2.35,-.018],[lean+.065,2.76,0]],[.035,.020,.003],3),p=leader.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,Math.min(2.76,p.getY(i)));
 parts.push(tint(leader,0x577568));
 for(let j=0;j<3;j++){
  const y=[2.18,2.42,2.65][j],t=(y-1.94)/.82,g=firFan(j*2.399+variant*.71,y,[.38,.29,.18][j],[.15,.115,.085][j],(j+variant)%3,level);
  g.translate(lean+.01+t*.055,0,-Math.sin(t*Math.PI)*.018);parts.push(g);
 }
 return merge(parts);
}
function treeTemplate(id,variant){
 const key=id+variant;if(templates.has(key))return templates.get(key);const snow=id==='snow',wood=snow?0x687675:0x665b43;
 const trunkHeight=5,lean=(variant-1)*.16;
 // Keep the established stem curve and forks; only its surface and lower root
 // transition change. Habitat stretching can still follow the same crown joins.
 const stem=[[0,0,0],[.05,.42,-.015],[lean-.16,1.65,.085],snow?[lean*.6+.10,3.35,-.075]:[[.05,3.35,-.16],[.20,3.35,.10],[-.08,3.35,.23]][variant],snow?[lean-.04,5,.09]:[[-.25,5,.22],[.46,5,-.05],[-.48,5,.38]][variant]];
 const branches=[tint(rootedStem(stem,snow?[.35,.25,.18,.10,.035]:[.49,.31,.285,.19,.07],snow,variant),wood)];
 if(snow)for(let i=0;i<3;i++){
  const a=i*2.15+variant*.71,cos=Math.cos(a),sin=Math.sin(a),start=snow?2.8+i*.42:1.88+i*.48,reach=snow?.62:1.18-(i%2)*.12,tip=snow?start+.65:3.64+i*.31;
  branches.push(tint(limb([[lean*.7,start,0],[cos*reach*.38,start+.48,sin*reach*.30],[cos*reach*.78,tip-.12,sin*reach*.74],[cos*reach,tip,sin*reach]],snow?[.09,.052,.018]:[.19-i*.018,.105,.017],snow?4:6),wood));
 }
 const crowns=[],tips=[],sprays=[];
 if(snow){
  crowns.push(firCrown(variant,2));
 }else{
  // Open spreading, upright forked, and one-sided woodland crowns. The same
  // twenty clusters form uneven interlocking lobes, with middle leaves rooted
  // on the forks instead of an empty hollow between the outer branch tips.
  const shape=[
   [[.15,.09,.90,1.00],[1.96,.50,.79,.96],[3.53,.28,.87,1.03],[5.05,.94,.65,.88]],
   [[.57,.15,.74,.90],[3.62,.44,.83,.96],[2.08,.99,.62,.83],[5.21,1.12,.59,.87]],
   [[-.12,.20,.97,.96],[1.08,.66,.85,1.00],[2.71,.31,.66,.85],[4.68,1.03,.61,.87]],
  ][variant],twigs=[[4,3,3,2],[3,4,2,3],[4,3,2,3]][variant];
  for(let branch=0;branch<4;branch++){
   const[a,y,r,spread]=shape[branch],count=twigs[branch];
   for(let twig=0;twig<count;twig++){
    const side=twig-(count-1)*.5,central=1-Math.abs(side)/(count*.5),angle=a+side*(.38+variant*.055),reach=r+central*.13+Math.sin(branch*2.7+twig+variant)*.045;
    const inset=variant===0?.975:1,x=(Math.cos(angle)*reach+(variant===2?.08:0))*inset,z=Math.sin(angle)*reach*(variant===1?.9:1)*inset,leafY=y+central*.20+side*.12+Math.cos(twig*2.1+a)*.075,h=(.61+central*.12)*(variant===1?1.13:1);
    sprays.push([x,leafY,z,(.51+central*.12)*spread*inset,(.37+central*.06)*spread*inset,h,angle+.16*side]);crowns.push(broadFan(...sprays.at(-1)));tips.push({x,y:leafY+h*.24,z,branch});
   }
  }
  for(let j=0;j<3;j++){
   const a=j*2.3+variant*.8,r=j===2?.14:.34;
   const x=Math.cos(a)*r+(variant===2?.12:variant===1?.16:0),z=Math.sin(a)*r,y=1.30+j*.21+Math.sin(a)*.11;sprays.push([x,y,z,.58-j*.07,.42-j*.025,.65,a]);crowns.push(broadFan(...sprays.at(-1)));tips.push({x,y:y+.65*.24,z,branch:4});
  }
  for(let j=0;j<5;j++){
   const branch=j%4,[a,y]=shape[branch],angle=a+(j===4?.62:-.22),r=j===4?.22:.48+.04*Math.sin(a+variant),x=Math.cos(angle)*r+(variant===2?.13:0),z=Math.sin(angle)*r,leafY=j===4?1.08:y+.36,h=.76;
   sprays.push([x,leafY,z,.60,.43,h,angle+.35]);crowns.push(broadFan(...sprays.at(-1)));tips.push({x,y:leafY+h*.24,z,branch});
  }
 }
 const canopy=merge(crowns),bottom=canopy.boundingBox.min.y;canopy.translate(0,-bottom,0);canopy.computeBoundingBox();
 // Match twig tips to the same normalized crown coordinates used by addTree.
 // Thus tall trees keep supported leaf groups without changing their overall height or collision radius.
 if(!snow){
  const tipPosition=tip=>[tip.x*2.04,((tip.y-bottom)/canopy.boundingBox.max.y*.47+.53)*5/.8496,tip.z*2.04*(.94+variant*.035)],stemCurve=new T.CatmullRomCurve3(stem.map(p=>new T.Vector3(...p))),forkEnds=[];
  for(let b=0;b<4;b++){
   const ends=tips.filter(t=>t.branch===b).map(tipPosition),end=[0,0,0];for(const p of ends)for(let i=0;i<3;i++)end[i]+=p[i]/ends.length;
   end[0]*=.72;end[2]*=.72;end[1]-=.42;
   const base=stemCurve.getPoint([.56,.64,.73,.80][b]).toArray(),middle=base.map((v,i)=>T.MathUtils.lerp(v,end[i],.5)+(i===1?.13:0));forkEnds.push(end);
   branches.push(tint(limb([base,middle,end],[.215-b*.021,.115-b*.009,.067-b*.004],6),wood));
  }
  for(const tip of tips){
   const base=tip.branch===4?stem.at(-1):forkEnds[tip.branch],end=tipPosition(tip),middle=base.map((v,i)=>T.MathUtils.lerp(v,end[i],.54)+(i===1?.08:0));
   branches.push(tint(limb([base,middle,end],[.066,.032,.006],3),wood));
  }
 }
 const trunk=merge(branches);
 for(const [geometry,kind]of[[trunk,0],[canopy,snow?2:1]])geometry.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(kind),1));
 const template={trunk,trunkHeight,canopy,canopyHeight:canopy.boundingBox.max.y,sprays,bottom,snow,variant,lods:[null,null,canopy]};templates.set(key,template);return template;
}
export function addTree(parent,id,tall,{angle=0,variation=1,bend=0}={}){
 const variant=Math.abs(Math.floor(angle*1.7))%3,template=treeTemplate(id,variant),height=id==='snow'?5.2+tall*.52:5.6+tall*.26,canopyHeight=height*(id==='snow'?.46:.47),width=(.88+variation*.12)*(id==='snow'?1:2.04);
 parent.userData.treeBiome=id;parent.rotation.y=angle;
 const trunk=new T.Mesh(template.trunk,material);trunk.name='tree-trunk';trunk.scale.set(.94+variation*.06,(height-canopyHeight*.32)/template.trunkHeight,.94+variation*.06);trunk.rotation.z=bend*.10;
 // Snow hangs slightly lower while its top and the independently scaled trunk stay fixed.
 const snowDrop=id==='snow'?.24:0,canopy=new T.Mesh(template.canopy,id==='snow'?firMaterial:leafMaterial);canopy.name='tree-canopy';canopy.userData.treeCanopy=true;canopy.userData.treeTemplate=template;canopy.userData.treeLOD=2;canopy.position.set(bend*.5,height-canopyHeight-snowDrop,0);canopy.scale.set(width,(canopyHeight+snowDrop)/template.canopyHeight,width*(.94+variant*.035));
 for(const mesh of[trunk,canopy]){mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);}return canopy;
}

// Add folded leaves to the existing silhouette, rather than swapping it for a
// different crown. All three variants share their LOD geometries and material.
// The constant UV samples one opaque leaf texel; vertex tint supplies leaf veins.
function detailedCrown(template,level){
 if(template.lods[level])return template.lods[level];
 if(template.snow){
  const g=firCrown(template.variant,level),p=g.attributes.position,bounds=template.canopy.boundingBox;g.translate(0,-template.bottom,0);
  // Snow detail cannot widen a walkable gap or change the overhead envelope.
  for(let i=0;i<p.count;i++)p.setXYZ(i,T.MathUtils.clamp(p.getX(i),bounds.min.x,bounds.max.x),T.MathUtils.clamp(p.getY(i),bounds.min.y,bounds.max.y),T.MathUtils.clamp(p.getZ(i),bounds.min.z,bounds.max.z));
  g.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(p.count).fill(2),1));g.computeBoundingBox();g.computeBoundingSphere();return template.lods[level]=g;
 }
 const p=[],ix=[],uv=[],colors=[],flex=[],point=new T.Vector3();
 const u=.5,v=.5,count=level===0?14:5;
 for(const [x,y,z,width,depth,height,phase]of template.sprays)for(let spray=0;spray<5;spray++){
  const {center,normal,across,along}=sprayPose(x,y,z,width,depth,height,phase,spray);
  for(let leaf=0;leaf<count;leaf++){
   const a=leaf*2.399+phase,r=Math.sqrt((leaf+.5)/count),cx=Math.cos(a)*r*width*.68,cy=Math.sin(a)*r*depth*.91;
   const direction=a*.47+spray,co=Math.cos(direction),si=Math.sin(direction),length=.11+.055*(.5+.5*Math.sin(leaf*7+phase)),w=length*.24,first=p.length/3;
   const leafU=cx/(width*.72),leafV=cy/(depth*.96),leafCenter=center.clone().addScaledVector(across,cx).addScaledVector(along,cy).addScaledVector(normal,height*sprayBow(leafU,leafV));
   const leafNormal=normal.clone().addScaledVector(across,.50*height*leafU/(1.17*1.17*width*.72)).addScaledVector(along,height*(.50*leafV/(1.17*1.17)+.21*leafV*leafV)/(depth*.96)).normalize();
   const leafAcross=across.clone().addScaledVector(leafNormal,-across.dot(leafNormal)).normalize(),leafAlong=new T.Vector3().crossVectors(leafNormal,leafAcross);
   // Six vertices, six triangles: raised midrib and drooping tip retain a smooth folded profile.
   const shape=[[0,-length*.5,length*.07],[0,0,length*.12],[-w,0,length*.025],[0,length*.55,-length*.04],[w,0,length*.025],[0,length*.25,length*.065]];
   for(const [i,[lx,ly,bow]]of shape.entries()){
    // The local tangent follows the curved spray without stretching individual leaves.
    point.copy(leafCenter).addScaledVector(leafAcross,lx*co-ly*si).addScaledVector(leafAlong,lx*si+ly*co).addScaledVector(leafNormal,bow);
    p.push(point.x,point.y-template.bottom,point.z);uv.push(u,v);flex.push([0,.5,.5,1,.5,.75][i]);
    const shade=(i===1||i===5?1:.83)+.08*Math.sin(a*3+spray);colors.push(Math.min(1,shade*.98),Math.min(1,shade),shade*.86);
   }
   ix.push(first,first+1,first+2,first+2,first+1,first+5,first+2,first+5,first+3,first,first+4,first+1,first+4,first+5,first+1,first+4,first+3,first+5);
  }
 }
 const detail=surface(p,ix);detail.setAttribute('uv',new T.Float32BufferAttribute(uv,2));detail.setAttribute('color',new T.Float32BufferAttribute(colors,3));detail.setAttribute('treeLeafFlex',new T.Float32BufferAttribute(flex,1));detail.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(p.length/3).fill(1),1));
 // Keep extra leaves inside the existing crown envelope, preserving camera clearance.
 const bounds=template.canopy.boundingBox,a=detail.attributes.position;
 for(let i=0;i<a.count;i++)a.setXYZ(i,T.MathUtils.clamp(a.getX(i),bounds.min.x,bounds.max.x),T.MathUtils.clamp(a.getY(i),bounds.min.y,bounds.max.y),T.MathUtils.clamp(a.getZ(i),bounds.min.z,bounds.max.z));
 detail.computeVertexNormals();
 return template.lods[level]=merge([template.canopy.clone(),detail]);
}
export function updateTreeDetail(canopy,x,z){
 const template=canopy.userData.treeTemplate,parent=canopy.parent;if(!template||!parent)return;
 const distance=Math.hypot(parent.position.x-x,parent.position.z-z),previous=canopy.userData.treeLOD;
 // 10/30 metre bands with hysteresis prevent repeated swaps while standing at a boundary.
 const near=previous===0?11:9,far=previous===2?28:32,level=distance<near?0:distance<far?1:2;
 if(level===previous)return;
 canopy.geometry=level===2?template.canopy:detailedCrown(template,level);canopy.userData.treeLOD=level;
}

export function animateTreeCanopy(canopy,time,{x=0,z=0,phase=0}={}){
 if(!Number.isFinite(time))return;
 const parent=canopy.parent;
 if(parent?.userData.treeBiome!=='forest'){
  // Preserve the existing snow motion and other biome animation exactly.
  const sway=Math.sin(time*1.35+phase)*.026+Math.sin(time*2.7+phase)*.008;
  canopy.rotation.z=sway;canopy.position.x=x+sway*1.3;canopy.position.z=z+Math.cos(time*1.1+phase)*.015;return;
 }
 treeBreezeTime.value=time;
 const gust=.65+.35*(.5+.5*Math.sin(time*.42+parent.position.x*.08+parent.position.z*.06));
 const lean=gust*(Math.sin(time*.68+phase)*.009+Math.sin(time*1.07+phase*1.37)*.003),c=Math.cos(parent.rotation.y),s=Math.sin(parent.rotation.y),dx=-.644*c-.765*s,dz=-.644*s+.765*c;
 canopy.rotation.x=dz*lean;canopy.rotation.z=-dx*lean;canopy.position.x=x+dx*lean*1.8;canopy.position.z=z+dz*lean*1.8;
}

// Backdrop trees remain wholly outside the playable square, on its low foothills.
// Six batches, shared far geometry, no collision, no per-frame updates or lights.
export function installForestBackdrop(world,id,biomeAt=()=>id){
 if(id!=='forest'&&id!=='confluence')return null;
 if(world.forestBackdrop&&!world.forestBackdrop.userData.disposed)return world.forestBackdrop;
 const group=new T.Group(),records=[],dummy=new T.Object3D(),matrix=new T.Matrix4(),color=new T.Color();group.name='SM_Forest_Backdrop_A';group.userData={records,disposed:false};
 const landscape=world.group.getObjectByName('distant-landscape'),ray=landscape?new T.Raycaster():null,origin=new T.Vector3(),down=new T.Vector3(0,-1,0),inverse=new T.Matrix4(),hits=[];
 if(landscape){landscape.updateWorldMatrix(true,false);inverse.copy(world.group.matrixWorld).invert();down.transformDirection(world.group.matrixWorld);}
 for(let i=0;i<240;i++){
  const grove=Math.floor(i/20),member=i%20,center=(grove+.5)/12*Math.PI*2+.10*Math.sin(grove*2.1),spread=.15+.085*(.5+.5*Math.sin(grove*1.7+.6));
  const angle=center+((member*.61803398875)%1-.5)*spread*2+Math.sin(i*13.7)*.022,s=Math.sin(angle),c=Math.cos(angle),edge=world.half/Math.max(Math.abs(s),Math.abs(c));
  if(id==='confluence'&&biomeAt(s*edge,c*edge)!=='forest')continue;
  // Sparse fronts and deeper overlapping clumps keep the same 240-tree budget,
  // with gaps between uneven groves rather than a single circular fence.
  const depth=(member*.754877666)%1,radius=edge+11+depth*22+Math.sin(grove*2.3)**2*5;
  const x=s*radius,z=c*radius;let y=-.35;
  // Sample the already-built hill triangles once; no duplicate hill formula or
  // animation raycasts, and deep clumps cannot disappear inside the ridgeline.
  if(ray){ray.set(origin.set(x,80,z).applyMatrix4(world.group.matrixWorld),down);hits.length=0;ray.intersectObject(landscape,false,hits);if(hits.length)y=origin.copy(hits[0].point).applyMatrix4(inverse).y-.025;}
  records.push({x,z,y,scale:1.21+.17*Math.sin(grove*1.9)+.22*depth+.05*Math.sin(i*1.7),angle,variant:i%3});
 }
 for(let variant=0;variant<3;variant++){
  const list=records.filter(p=>p.variant===variant);if(!list.length)continue;
  const source=new T.Group();addTree(source,'forest',4,{angle:variant===2?1.5:variant});
  const template=treeTemplate('forest',variant);
  if(!template.backdropTrunk){
   const lean=(variant-1)*.16,parts=[tint(limb([[0,0,0],[lean-.12,2.5,.06],[lean,5,0]],[.35,.20,.025],5),0x665b43)];
   for(const side of[-1,1])parts.push(tint(limb([[0,2.7,0],[side*.6,3.6,side*.2],[side,4.3,side*.4]],[.12,.065,.008],4),0x665b43));
   template.backdropTrunk=merge(parts);template.backdropTrunk.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(template.backdropTrunk.attributes.position.count),1));
   // Interior lobes matter underneath a live crown; distant hills only need
   // the original fifteen outer lobes. Keep the six backdrop batches' budget.
   template.backdropCanopy=template.canopy.clone();template.backdropCanopy.setIndex(Array.from(template.canopy.index.array.slice(0,450*3)));
  }
  source.children[0].geometry=template.backdropTrunk;source.children[1].geometry=template.backdropCanopy;
  for(const part of source.children){
   part.updateMatrix();const batch=new T.InstancedMesh(part.geometry,part.material,list.length);batch.name=part.name+'-backdrop';batch.receiveShadow=true;
   for(const [i,p]of list.entries()){
    dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();matrix.multiplyMatrices(dummy.matrix,part.matrix);batch.setMatrixAt(i,matrix);batch.setColorAt(i,color.setHex(0xb8c9b8).multiplyScalar(.88+.12*Math.sin(p.angle*5)**2));
   }
   batch.computeBoundingSphere();batch.addEventListener('dispose',()=>{batch.visible=false;group.userData.disposed=true;});group.add(batch);
  }
 }
 if(!records.length)return null;
 world.group.add(group);world.forestBackdrop=group;return group;
}

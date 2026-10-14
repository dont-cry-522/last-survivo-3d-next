import {createShadowAura,updateShadowAura,disposeShadowAura} from './shadow-aura.js?v=192';
import {shadowOutfit,shadowAccessories,finishShadowTone,SHADOW_PALETTE} from './shadow-appearance.js?v=192';
import {shadowFocus} from './shadow-gear.js?v=192';
import {GRIP_POINTS,SCYTHE_SUPPORT,primaryGripFrame,fitWeaponToPalm,createHandGrips,restoreGripWrists,captureGripWrists,aimGrip,supportGripTarget,aimSupportGrip,aimShadeGuide,poseGripFingers} from './weapon-grips.js?v=192';
import {refineLingyaFace} from './lingya-face.js?v=192';
import {createLingyaHair,animateLingyaHair} from './lingya-hair.js?v=192';
import {finishHeroSurface,smoothSeams,prepareSilverHair,animateSilverHair} from './hero-finish.js?v=192';
import {rebuildRanger} from './ranger-rebuild.js?v=192';
import {rebuildShadowTide} from './shadow-tide-rebuild.js?v=192';
import {rebuildWildMist} from './wild-mist-rebuild.js?v=192';
import {applyHeroIdentity,settleHeroIdentity} from './hero-identity.js?v=192';
import{WULING_PALETTE,wulingOutfit,wulingAccessories,wulingMask,sporeLantern,sporeSatchel,sporePod}from'./wuling-appearance.js?v=192';
import{MIRAGE_PALETTE,mirageOutfit,mirageHair,prepareMirageHair,animateMirageHair,mirageMask,mirageAccessories,miragePetalTails,miasmaLantern}from'./mirage-appearance.js?v=192';
import{newHeroAttack,heroCarryPose,committedWeaponYaw}from'./new-hero-motion.js?v=192';
import{heroDodgePose}from'./hero-dodge.js?v=192';
import{lingyaHopPose}from'./lingya-motion.js?v=192';
import{lingyaOutfit,lingyaAccessories,lingyaLegs}from'./lingya-appearance.js?v=192';
import{makeSlingshot,poseSlingshot}from'./slingshot-model.js?v=192';
import{makeHarpoon}from'./coast-models.js?v=192';
import{weaponGesture,shotStarted,scythePose,crossbowMechanism,slingshotMechanism}from'./weapon-performance.js?v=192';
import{rollProgress,rollWeight}from'./dodge-motion.js?v=192';
import * as T from './vendor/three.module.js';
import {clone} from './vendor/SkeletonUtils.js';
import {loadCharacterData} from './character-loader.js?v=192';
import {makeHero as makePrototype,poseCrossbow} from './hero-model.js?v=192';
import {restSurface} from './hero-rest-surface.js?v=192';

const templates=new Map(),clips=new Map();
let lingyaFace;
const lingyaFaceSkins=new WeakMap();
const fittedMasks=new WeakMap();

function cachedFaceMask(model,kind){
  let skin;model.traverse(o=>{if(o.isSkinnedMesh&&o.material.name.includes('Superhero'))skin=o;});
  let masks=fittedMasks.get(skin.geometry);if(!masks){masks=new Map();fittedMasks.set(skin.geometry,masks);}
  let source=masks.get(kind);
  if(!source){
    const sample=restSurface(skin.geometry);
    source=kind==='wuling'?wulingMask(model,sample):kind==='mirage'?mirageMask(model,sample):faceMask(model,kind,sample);
    masks.set(kind,source);
  }
  // Templates never enter a live actor's owned list. Each actor still owns its
  // mask buffers and material, so cloaking/disposal cannot affect another one.
  const mask=source.clone();mask.geometry=source.geometry.clone();mask.material=source.material.clone();
  mask.material.onBeforeCompile=source.material.onBeforeCompile;mask.material.customProgramCacheKey=source.material.customProgramCacheKey;
  return mask;
}

let loaded=false;
const upper=/^(spine_|clavicle|upperarm|lowerarm|hand|index|middle|pinky|ring|thumb)/;
const isUpper=t=>upper.test(t.name.match(/\[([^\]]+)\]/)?.[1]||t.name.split('.')[0]);
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function reverseClip(clip){
  const reversed=clip.clone();reversed.name=clip.name+'-reverse';
  for(const track of reversed.tracks){const times=track.times.slice(),values=track.values.slice(),size=track.getValueSize(),n=times.length;for(let i=0;i<n;i++){track.times[i]=clip.duration-times[n-1-i];for(let k=0;k<size;k++)track.values[i*size+k]=values[(n-1-i)*size+k];}}
  return reversed;
}
function cutGeometry(geometry,keepTriangle){
  const g=geometry.clone(),p=g.attributes.position,ids=g.index?.array,keep=[];
  for(let i=0;i<(ids?.length||p.count);i+=3){const a=ids?ids[i]:i,b=ids?ids[i+1]:i+1,c=ids?ids[i+2]:i+2;if(keepTriangle(p,a,b,c))keep.push(a,b,c);}
  g.setIndex(keep);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function hunterLegs(base){
  let source;base.traverse(o=>{if(o.isSkinnedMesh&&o.material.name.includes('Superhero'))source=o;});
  const legs=source.clone();legs.name='Silver_Hunter_Boots_Shorts';
  legs.geometry=cutGeometry(source.geometry,(p,a,b,c)=>Math.max(p.getY(a),p.getY(b),p.getY(c))<1.09&&Math.min(p.getY(a),p.getY(b),p.getY(c))>.095);
  legs.material=source.material.clone();skinTone(legs.material,'silver');legs.material.normalScale.set(.10,.10);legs.material.roughness=.63;
  const skinCompile=legs.material.onBeforeCompile;
  legs.material.onBeforeCompile=s=>{
    skinCompile(s);s.vertexShader='varying vec3 vHunterRest;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHunterRest=position;');
    s.fragmentShader='varying vec3 vHunterRest;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float h=vHunterRest.y;
      float leather=1.0-smoothstep(.681,.686,h)+smoothstep(.878,.883,h);
      float trim=(1.0-smoothstep(.003,.007,abs(h-.676)))+(1.0-smoothstep(.002,.005,abs(h-.887)));
      vec3 bootColor=mix(vec3(.016,.022,.028),vec3(.15,.17,.18),clamp(trim,0.0,1.0));
      diffuseColor.rgb=mix(diffuseColor.rgb,bootColor,clamp(leather+trim,0.0,1.0));`);
    // This reused body mesh contains skin, leather and fittings; its old skin atlas cannot describe the boots.
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(mix(.78,.66,leather),.42,clamp(trim,0.0,1.0));`);
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor=clamp(trim,0.0,1.0)*.55;`);
  };legs.material.customProgramCacheKey=()=> 'silver-hunter-legs';return legs;
}
function firstSkin(root){let result;root.traverse(o=>{if(o.isSkinnedMesh&&!result)result=o;});return result;}
function palette(material,color){
  material.color.set(0xffffff);material.roughness=.88;material.metalness=.025;
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float clothValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    diffuseColor.rgb=vec3(.055,.06,.067)+clothValue*vec3(.25,.27,.29);`);};
  material.customProgramCacheKey=()=>String(color);
}
function skinTone(material,kind){
  material.color.set(0xffffff);material.metalness=0;material.roughness=.78;material.normalScale.setScalar(kind==='lingya'?.06:['wuling','mirage'].includes(kind)?.055:.12);
  if(kind==='lingya'){material.color.set(0xefbda1);material.map=null;material.normalMap=null;material.aoMap=null;return;}
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float skinShade=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    diffuseColor.rgb=vec3(${kind==='wraith'?'.085,.080,.095':kind==='silver'?'.80,.66,.60':kind==='mirage'?'.70,.58,.68':kind==='wuling'?'.57,.36,.28':kind==='lingya'?'.78,.60,.47':'.63,.43,.32'})*(.72+skinShade*.42)+diffuseColor.rgb*.09;`);};
  material.customProgramCacheKey=()=> 'skin-'+kind;
}
function bindParts(root,extra,onlyHead=false,kind=''){
  const target=firstSkin(root).skeleton,bones=new Map(target.bones.map(b=>[b.name,b]));const meshes=[];
  extra.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  for(const m of meshes){
    if(kind==='lingya'&&['Eyes','Eyebrows'].includes(m.name))continue;
    if(onlyHead&&m.material.name.includes('Superhero')){
      // Lingya's independent head includes its own complete neck.
      if(kind==='lingya')continue;
      const g=m.geometry.clone(),p=g.attributes.position,ids=g.index?.array,keep=[];
      // The source base body is continuous; retain only head and neck above the outfit collar.
      for(let i=0;i<(ids?.length||p.count);i+=3){const a=ids?ids[i]:i,b=ids?ids[i+1]:i+1,c=ids?ids[i+2]:i+2;if(Math.min(p.getY(a),p.getY(b),p.getY(c))>1.40&&Math.max(Math.abs(p.getX(a)),Math.abs(p.getX(b)),Math.abs(p.getX(c)))<.125&&(kind!=='lingya'||Math.max(p.getY(a),p.getY(b),p.getY(c))<1.47))keep.push(a,b,c);}
      if(kind==='silver')for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y>1.51){const jaw=Math.exp(-(((y-1.572)/.045)**2));x*=1-.035*jaw;if(y<1.62)y+=.002*jaw;if(z>.08&&Math.abs(x)<.027&&y>1.60&&y<1.665)z-=.002*Math.exp(-(((y-1.635)/.024)**2));p.setXYZ(i,x,y,z);}}
      g.setIndex(keep);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();m.geometry=g;
    }
    const mapped=m.skeleton.bones.map(b=>bones.get(b.name));if(mapped.some(b=>!b))throw Error('角色骨骼不匹配');
    m.skeleton=new T.Skeleton(mapped,m.skeleton.boneInverses);root.add(m);
  }
}
export async function loadHeroAssets(onProgress=()=>{}){
  if(loaded)return;
  const {models:assets,clips:bakedClips}=await loadCharacterData(onProgress);
  lingyaFace=assets['lingya-face'].scene;lingyaFace.getObjectByName('Lingya-eyes_viewport').add(lingyaFace.getObjectByName('Lingya-eye_dots'));refineLingyaFace(lingyaFace);lingyaFace.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const shadow=clone(assets['scout-outfit'].scene),shadowBase=clone(assets['scout-base'].scene);
  const mirage=clone(assets['silver-outfit'].scene),mirageBase=clone(assets['silver-base'].scene),mirageLocks=clone(assets['silver-hair'].scene);
  const wuling=clone(assets['silver-outfit'].scene),wulingBase=clone(assets['silver-base'].scene),wulingHair=clone(assets['silver-hair'].scene);
  const tideBase=clone(assets['silver-base'].scene),lingyaBase=clone(assets['silver-base'].scene),lingya=clone(assets['silver-outfit'].scene);
  for(const kind of ['silver','scout']){
    const root=assets[kind+'-outfit'].scene;root.skeleton=firstSkin(root).skeleton;
    root.traverse(o=>{if(o.isMesh){if(o.name.includes('Head_Hood')||kind==='silver'&&/Pauldrons|_Legs|Belt_1/.test(o.name))o.visible=false;o.material=o.material.clone();if(kind==='silver'&&o.material.name.includes('Ranger'))palette(o.material,0x526075);if(o.material.name.includes('Regular'))skinTone(o.material,kind);
      if(kind==='silver'&&o.name.includes('_Feet')){o.geometry=cutGeometry(o.geometry,(p,a,b,c)=>Math.min(p.getY(a),p.getY(b),p.getY(c))<.16);o.material=new T.MeshStandardMaterial({color:0x141c24,roughness:.57,metalness:.08});}
      if(kind==='silver'&&o.name.includes('Body')){o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setX(i,p.getX(i)*(1-.12*Math.exp(-(((y-1.13)/.105)**2))));}o.geometry.computeVertexNormals();}
    }});
    const base=assets[kind+'-base'].scene;base.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.name.includes('Hair'))o.material.color.set(kind==='silver'?0x65717f:0x38251d);if(o.material.name.includes('Superhero'))skinTone(o.material,kind);}});
    if(kind==='silver'){const extra=new T.Group();extra.add(hunterLegs(base));bindParts(root,extra);}
    bindParts(root,base,true,kind);
    const hair=assets[kind+'-hair'].scene;hair.traverse(o=>{if(o.isMesh){o.userData.hairstyle=true;o.material=o.material.clone();if(kind==='silver'){
      o.material.color.set(0xdde7f1);o.material.roughness=.78;o.material.normalScale.set(.45,.45);
      o.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float strand=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=vec3(.69,.75,.83)*(.7+strand*.55);`);};o.material.customProgramCacheKey=()=> 'silver-hair';
    }else o.material.color.set(0x58402e);}});bindParts(root,hair);
    if(kind==='silver')root.traverse(o=>{if(o.isMesh&&o.name==='Eyes'){o.material.roughness=.23;o.material.metalness=0;}});
    root.updateMatrixWorld(true);templates.set(kind,root);
  }
  shadow.skeleton=firstSkin(shadow).skeleton;shadowOutfit(shadow);shadow.traverse(o=>{if(o.isMesh&&o.material.name.includes('Regular'))skinTone(o.material,'wraith');});
  shadowBase.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.name.includes('Superhero'))skinTone(o.material,'wraith');if(o.material.name.includes('Hair')||['Eyes','Eyebrows'].includes(o.name))o.visible=false;}});bindParts(shadow,shadowBase,true,'scout');shadow.updateMatrixWorld(true);templates.set('wraith',shadow);
  const tide=assets['tide-outfit'].scene;tide.skeleton=firstSkin(tide).skeleton;
  tide.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.name.includes('Regular'))skinTone(o.material,'tide');else{const tint=o.name.includes('Feet')?'.20,.13,.075':o.name.includes('Legs')?'.022,.052,.068':'.035,.12,.16';o.material.color.set(0xffffff);o.material.roughness=.9;o.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
float weave=dot(diffuseColor.rgb,vec3(.21,.72,.07));diffuseColor.rgb=vec3(${tint})*(.6+weave*1.8);`);};o.material.customProgramCacheKey=()=> 'tide-coat-'+tint;}}});
  tideBase.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.name.includes('Superhero'))skinTone(o.material,'tide');if(o.material.name.includes('Hair'))o.material.color.set(0x231f22);}});bindParts(tide,tideBase,true,'silver');
  const tideHair=assets['tide-hair'].scene;tideHair.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.set(0x29202a);}});bindParts(tide,tideHair);tide.updateMatrixWorld(true);templates.set('tide',tide);
  lingya.skeleton=firstSkin(lingya).skeleton;lingyaOutfit(lingya);const legs=new T.Group();legs.add(lingyaLegs(lingyaBase));bindParts(lingya,legs);
  lingya.traverse(o=>{if(o.isMesh&&o.material.name.includes('Regular')){o.material=o.material.clone();skinTone(o.material,'lingya');}});
  lingyaBase.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.name.includes('Superhero'))skinTone(o.material,'lingya');if(o.material.name.includes('Hair')){o.material.color.set(0x78563e);}}});bindParts(lingya,lingyaBase,true,'lingya');
  lingya.updateMatrixWorld(true);templates.set('lingya',lingya);
  wuling.skeleton=firstSkin(wuling).skeleton;wulingOutfit(wuling);
  wuling.traverse(o=>{if(o.isMesh&&o.material.name.includes('Regular'))skinTone(o.material,'wuling');});
  wulingBase.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.name.includes('Superhero'))skinTone(o.material,'wuling');if(o.material.name.includes('Hair'))o.material.color.set(0x28202b);}});bindParts(wuling,wulingBase,true,'silver');
  wulingHair.traverse(o=>{if(o.isMesh){o.userData.hairstyle=true;o.material=o.material.clone();o.material.color.set(0x453447);o.geometry=cutGeometry(o.geometry,(p,a,b,c)=>Math.max(p.getZ(a),p.getZ(b),p.getZ(c))>.015&&Math.min(p.getY(a),p.getY(b),p.getY(c))<1.735);const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){if(p.getY(i)<1.62)p.setY(i,1.62-(1.62-p.getY(i))*.42);}o.geometry.computeVertexNormals();}});bindParts(wuling,wulingHair);wuling.traverse(o=>{if(o.userData.hairstyle||['Eyes','Eyebrows'].includes(o.name))o.visible=false;});wuling.updateMatrixWorld(true);templates.set('wuling',wuling);
  mirage.skeleton=firstSkin(mirage).skeleton;mirageOutfit(mirage);
  mirage.traverse(o=>{if(o.isMesh&&o.material.name.includes('Regular'))skinTone(o.material,'mirage');});
  mirageBase.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.name.includes('Superhero'))skinTone(o.material,'mirage');if(o.material.name.includes('Hair'))o.material.color.set(0xc4b7db);}});bindParts(mirage,mirageBase,true,'silver');
  mirageHair(mirageLocks);bindParts(mirage,mirageLocks);mirage.traverse(o=>{if(['Eyes','Eyebrows'].includes(o.name))o.visible=false;});mirage.updateMatrixWorld(true);templates.set('mirage',mirage);
  for(const [kind,root] of templates){
    rebuildRanger(root,kind);
    rebuildShadowTide(root,kind);
    rebuildWildMist(root,kind);
    applyHeroIdentity(root,kind);
    finishHeroSurface(root,kind);
  }
  for(const c of bakedClips)clips.set(c.name,c);
  loaded=true;
}
export function heroesReady(){return loaded;}
function attachAtRest(bone,object,root){
  root.updateMatrixWorld(true);object.applyMatrix4(bone.matrixWorld.clone().invert().multiply(root.matrixWorld));bone.add(object);
}
function skinLingyaNeck(face,model){
  const source=face.getObjectByName('Lingya-head'),reference=firstSkin(model),skeleton=reference.skeleton;
  let geometry=lingyaFaceSkins.get(source.geometry);
  if(!geometry){
    geometry=source.geometry.clone();const p=geometry.attributes.position,indices=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
    const ids=['spine_03','neck_01','Head'].map(name=>skeleton.bones.findIndex(b=>b.name===name));
    if(ids.some(i=>i<0))throw Error('铃芽颈部骨骼不匹配');
    for(let i=0;i<p.count;i++){
      const y=p.getY(i),neck=T.MathUtils.smoothstep(y,1.435,1.475),head=T.MathUtils.smoothstep(y,1.475,1.525);
      indices.set([...ids,0],i*4);weights.set([(1-neck)*(1-head),neck*(1-head),head,0],i*4);
    }
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    lingyaFaceSkins.set(source.geometry,geometry);
  }
  // Reuse the actor's existing skeleton and the source outfit's bind space.
  // Attached skinning cancels the Head parent transform for the weighted neck;
  // upper vertices still follow Head exactly, alongside the eyes and eyebrows.
  const head=new T.SkinnedMesh(geometry,source.material);head.name=source.name;head.position.copy(source.position);head.quaternion.copy(source.quaternion);head.scale.copy(source.scale);
  head.castShadow=source.castShadow;head.receiveShadow=source.receiveShadow;head.frustumCulled=false;
  head.morphTargetInfluences=source.morphTargetInfluences.slice();head.morphTargetDictionary={...source.morphTargetDictionary};
  head.bindMode=reference.bindMode;head.bind(skeleton,reference.bindMatrix);source.parent.add(head);source.removeFromParent();
}
function capeMesh(kind,weapon,model){
  const shadowLength=weapon==='shade'?.62:weapon==='shadowblade'?.44:.96;
  const pos=[],uv=[],colors=[],ix=[],cols=24,rows=28;
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const u=x/cols,v=y/rows,w=.22+.13*Math.sin(v*Math.PI*.86),split=.10*Math.exp(-(((u-.5)/.065)**2))*v**8;if(kind==='lingya'){
      // A short back mantle: the old circumferential bell formed a hollow bowl
      // around the lifted arms, regardless of how much its depth was squeezed.
      const q=u*2-1,half=.105+.045*Math.sin(v*Math.PI*.85);
      pos.push(q*half,-.255*v-.045*q*q*(1-v)**3+.018*q*q*v**5,-.022*v+.010*q*q*(1-v)**2);
    }else if(kind==='mirage'){const a=.52+u*(Math.PI*2-1.04),r=.14+.09*Math.sin(v*Math.PI/2);pos.push(Math.sin(a)*r,-v*(.25+.14*Math.sin(a-.4))-.026*Math.cos(a*2)*v**4,Math.cos(a)*r*.82);}else if(kind==='wuling'){const a=.48+u*(Math.PI*2-.96),r=.143+.088*Math.sin(v*Math.PI/2);pos.push(Math.sin(a)*r,-v*(.295+.12*Math.sin(a+.6))-.018*Math.cos(a*3)*v**4,Math.cos(a)*r*.79);}else if(kind==='wraith'){
      // A centred, complete garment with a rounded shoulder yoke. The old
      // offset narrow strip and half-white cape read as a separate back plate.
      const q=u*2-1,width=.126+(weapon==='shade'?.053:weapon==='shadowblade'?.067:.080)*Math.sin(v*Math.PI*.83);
      pos.push(q*width,-v*shadowLength-.064*q*q*(1-v)**3+.022*q*q*v**5,
        -.038*v+.007*Math.cos(q*Math.PI*3)*Math.sin(v*Math.PI));
    }else if(kind==='tide'){
      // Cut a short shoulder mantle at its real length, with a curved yoke and
      // vertical folds, instead of squeezing a long cape into a stiff panel.
      const q=u*2-1,half=.172+.085*Math.sin(v*Math.PI*.76);
      pos.push(q*half,-v*.345-.036*q*q*(1-v)**3+.012*Math.cos(q*Math.PI*3)*v**6,
        .032*q*q*(1-v)**2-.061*v+.015*Math.sin(q*Math.PI*3)*Math.sin(v*Math.PI*.8));
    }else if(kind==='silver'){
      // A shaped shoulder yoke opens into hanging panels, rather than a flat sheet.
      const q=u*2-1,half=.205+.115*Math.sin(v*Math.PI*.86),fold=Math.sin(q*Math.PI*3)*(.006+.018*v);
      pos.push(q*half,-v*.81-.035*Math.abs(q)**1.8*(1-v)**3+.026*Math.cos(q*Math.PI*3)*v**8+split*.55,
        -.025*(1-q*q)+.07*q*q*(1-v)**2-.12*v+fold);
    }else pos.push((u-.5)*w*2,-v*.86+split+Math.cos(u*Math.PI*4)*.013*v,-.12*v-.04*Math.sin(u*Math.PI)+Math.sin(u*Math.PI*8)*.016*v);uv.push(u,v);const base=kind==='lingya'?0x6d8474:kind==='mirage'?MIRAGE_PALETTE.cloth:kind==='wuling'?WULING_PALETTE.cloak:kind==='tide'?0x284b60:kind==='wraith'?SHADOW_PALETTE.cloth:0x253248,trim=kind==='lingya'?0xd2c4a8:kind==='mirage'?MIRAGE_PALETTE.mist:kind==='wuling'?WULING_PALETTE.trim:kind==='tide'?0x7faaa9:kind==='wraith'?SHADOW_PALETTE.lining:0xa8c4d3;const edge=T.MathUtils.smoothstep(Math.max(Math.abs(u-.5)*2,v),kind==='silver'?.978:.93,1),color=new T.Color(base).lerp(new T.Color(trim),edge*.72).multiplyScalar(.86+.14*v+.045*Math.cos(u*Math.PI*8)*v);
      // Colour follows the existing cloth surface: a frost falloff, a shallow
      // tide line, or paired leaf lobes; no hovering emblem or extra mesh.
      if(kind==='wraith'){
        const hem=T.MathUtils.smoothstep(Math.max(Math.abs(u-.5)*2,v),.983,1);
        color.lerp(new T.Color(SHADOW_PALETTE.ivory),hem*.62);
      }else if(kind==='silver'){
        const frost=T.MathUtils.smoothstep(v,.72+.045*Math.cos(u*Math.PI*4),1)*.68;
        color.lerp(new T.Color(0xa8c4d3),frost);
      }else if(kind==='tide'){
        const tideLine=Math.exp(-(((v-.81-.025*Math.sin(u*Math.PI*2))/.055)**2))*.25;
        color.lerp(new T.Color(0x7faaa9),tideLine);
      }else if(kind==='lingya'){
        color.lerp(new T.Color(0x81946b),Math.sin(u*Math.PI*2)**2*T.MathUtils.smoothstep(v,.45,1)*.25);
      }else if(kind==='mirage'){
        color.lerp(new T.Color(MIRAGE_PALETTE.mist),T.MathUtils.smoothstep(v,.77,1)*.16);
      }
      colors.push(color.r,color.g,color.b);
    }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x;ix.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(ix);geometry.computeVertexNormals();
  const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.87,side:T.DoubleSide}),wind={time:{value:0},run:{value:0},turn:{value:0}};
  material.onBeforeCompile=s=>{if(kind==='silver'||kind==='tide'||kind==='wraith'&&weapon==='shadowblade')return;s.uniforms.capeTime=wind.time;s.uniforms.capeRun=wind.run;s.uniforms.capeTurn=wind.turn;s.vertexShader='uniform float capeTime; uniform float capeRun; uniform float capeTurn;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float freeHem=clamp(-position.y/${kind==='wraith'?shadowLength.toFixed(2):kind==='lingya'?'.30':['wuling','mirage'].includes(kind)?'.43':'.85'},0.0,1.0);
    ${kind==='lingya'?`transformed.z-=(.004+.005*capeRun)*(.5+.5*sin(capeTime*3.0-position.y*8.0))*freeHem*freeHem;
    transformed.x+=(sin(capeTime*2.5+position.y*6.0)*.004+capeTurn*.025)*freeHem*freeHem;`:`transformed.z+=sin(position.y*9.0+capeTime*5.0)*(.009+capeRun*.026)*freeHem;
    transformed.x+=(sin(capeTime*3.0+position.y*6.0)*.012+capeTurn*.14)*freeHem*freeHem;
    transformed.z+=sin(position.x*14.0+position.y*7.0-capeTime*3.0)*capeRun*.009*freeHem;`}
    ${kind==='wraith'?'transformed.z-=.055*freeHem*freeHem*(.25+capeRun); transformed.y+=.018*freeHem*freeHem*capeRun;':''}`);
    if(kind==='wraith'){
      s.vertexShader='varying vec2 vShadowHem;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvShadowHem=uv;');
      s.fragmentShader='uniform float capeTime; varying vec2 vShadowHem;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float shroudEdge=.996+.002*sin(vShadowHem.x*61.0+sin(vShadowHem.x*19.0-capeTime*.7));
        if(vShadowHem.y>shroudEdge)discard;
        float fray=(1.0-smoothstep(.002,.022,shroudEdge-vShadowHem.y))*smoothstep(.87,.92,vShadowHem.y);`);
      s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.055,.050,.070)*fray;');
    }
  };
  material.customProgramCacheKey=()=> 'hero-cape-'+kind+(kind==='wraith'?'-'+weapon:'');const m=new T.Mesh(geometry,material);m.userData.wind=wind;m.position.set(0,['lingya','wuling','mirage'].includes(kind)?1.49:1.43,['lingya','wuling','mirage'].includes(kind)?-.025:-.14);if(kind==='wraith'){
    m.name='Shadow_'+weapon+'_cloth';m.position.set(0,1.48,-.14);
    const body=model.getObjectByName('Male_Ranger_Body'),p=geometry.attributes.position,cache=capeMesh.shadowFits??=new WeakMap();
    let fits=cache.get(body.geometry);if(!fits){fits=new Map();cache.set(body.geometry,fits);}const fitted=fits.get(weapon);
    if(fitted)p.array.set(fitted);
    else{
      model.updateMatrixWorld(true);const sample=restSurface(body.geometry,model.matrixWorld.clone().invert().multiply(body.matrixWorld));
      // Fit the upper yoke to the actual coat. Lower cloth continues vertically
      // from that contour, without jumping back to an arbitrary floating plane.
      for(let x=0;x<=cols;x++){
        let lastZ=-.02;
        for(let y=0;y<=rows;y++){
          const i=y*(cols+1)+x,v=y/rows,hit=sample(p.getX(i),p.getY(i)+m.position.y,false);
          const z=hit?hit.point.z-m.position.z-.018-.009*v:lastZ-.002;
          p.setZ(i,z+.002*Math.cos(x/cols*Math.PI*6)*v);lastZ=z;
        }
      }
      for(let pass=0;pass<2;pass++){const z=Array.from({length:p.count},(_,i)=>p.getZ(i));for(let y=0;y<=rows;y++)for(let x=1;x<cols;x++){const i=y*(cols+1)+x;p.setZ(i,Math.min(z[i],(z[i-1]+z[i+1])*.5));}}
      fits.set(weapon,p.array.slice());
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  }
  if(kind==='lingya'){
    m.name='SM_Hero_Cape_Lingya';m.position.set(0,1.445,-.12);
    const body=model.getObjectByName('Female_Ranger_Body'),p=geometry.attributes.position,cache=capeMesh.lingyaFits??=new WeakMap(),fitted=cache.get(body.geometry);
    if(fitted)p.array.set(fitted);
    else{
      const probeMaterial=new T.MeshBasicMaterial({side:T.DoubleSide}),probe=new T.Mesh(body.geometry,probeMaterial),ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3(0,0,1);
      model.updateMatrixWorld(true);probe.matrixAutoUpdate=false;probe.matrix.copy(model.matrixWorld.clone().invert().multiply(body.matrixWorld));probe.updateMatrixWorld(true);
      for(let i=0;i<p.count;i++){
        const v=uv[i*2+1],u=uv[i*2];ray.set(origin.set(p.getX(i),p.getY(i)+m.position.y,-1),direction);const hit=ray.intersectObject(probe,false)[0];
        if(hit)p.setZ(i,hit.point.z-m.position.z-.014-.006*v-.003*Math.sin(u*Math.PI*6)**2*v);
      }
      // Smooth only away from the coat, retaining the actual shoulder clearance.
      for(let pass=0;pass<2;pass++){const depth=Array.from({length:p.count},(_,i)=>p.getZ(i));for(let y=0;y<=rows;y++)for(let x=1;x<cols;x++){const i=y*(cols+1)+x;p.setZ(i,Math.min(depth[i],(depth[i-1]+depth[i+1])*.5));}}
      probeMaterial.dispose();cache.set(body.geometry,p.array.slice());
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  }
  if(kind==='silver'){
    m.name='SM_Hero_Cape_Silver';m.position.set(0,1.46,-.15);
    m.userData.silverCape=geometry.attributes.position.array.slice();geometry.attributes.position.setUsage(T.DynamicDrawUsage);geometry.attributes.normal.setUsage(T.DynamicDrawUsage);
  }
  if(kind==='wraith'&&weapon==='shadowblade'){
    m.name='SM_Hero_Cape_Shadowblade';m.userData.shadowCape=geometry.attributes.position.array.slice();
    geometry.attributes.position.setUsage(T.DynamicDrawUsage);geometry.attributes.normal.setUsage(T.DynamicDrawUsage);
  }
  if(kind==='tide'){
    // A short mantle rests on the back and follows the upper torso. Fit its
    // existing surface once; no per-frame body traversal or collision solver.
    const body=model.getObjectByName('Female_Peasant_Body'),p=geometry.attributes.position,cache=capeMesh.tideFits??=new WeakMap(),fitted=cache.get(body.geometry);
    if(fitted)p.array.set(fitted);
    else{
      model.updateMatrixWorld(true);const sample=restSurface(body.geometry,model.matrixWorld.clone().invert().multiply(body.matrixWorld));
      for(let i=0;i<p.count;i++){
        const hit=sample(p.getX(i)+m.position.x,p.getY(i)+m.position.y,false);if(!hit)continue;
        p.setZ(i,Math.min(p.getZ(i),hit.point.z-m.position.z-.012));
      }
      // Smooth only outwards, retaining the original measured clearance.
      for(let pass=0;pass<2;pass++){const depth=Array.from({length:p.count},(_,i)=>p.getZ(i));for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const i=y*(cols+1)+x,near=[];if(x>0)near.push(depth[i-1]);if(x<cols)near.push(depth[i+1]);if(y>0)near.push(depth[i-cols-1]);if(y<rows)near.push(depth[i+cols+1]);p.setZ(i,Math.min(depth[i],near.reduce((sum,z)=>sum+z,0)/near.length));}}
      cache.set(body.geometry,p.array.slice());
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    m.name='SM_Hero_Cape_Tide';m.userData.tideCape=geometry.attributes.position.array.slice();
    // Start the gravity bend below the fitted shoulder yoke, at its centre.
    const shoulderEnd=Math.round(rows*.22)*(cols+1)+cols/2;
    m.userData.tideFoldOrigin=new T.Vector3().fromBufferAttribute(p,shoulderEnd).toArray();
    geometry.attributes.position.setUsage(T.DynamicDrawUsage);geometry.attributes.normal.setUsage(T.DynamicDrawUsage);
  }
  m.castShadow=true;m.receiveShadow=true;return m;
}
function animateTailoredCape(mesh,t,run,turn,fall){
  const tide=!!mesh.userData.tideCape,rest=mesh.userData.tideCape||mesh.userData.shadowCape||mesh.userData.silverCape,p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
  const bend=fall?(mesh.userData.tideBend??={point:new T.Vector3(),rotation:new T.Quaternion(),pivot:new T.Vector3().fromArray(mesh.userData.tideFoldOrigin)}):null;
  for(let i=0;i<p.count;i++){
    const k=i*3,u=uv.getX(i),v=uv.getY(i),hem=v*v;
    p.setXYZ(i,rest[k]+(Math.sin(t*1.6-v*2)*.003-turn*(tide?.026:.055))*hem,rest[k+1],
      rest[k+2]+(Math.sin(t*2.3-v*4+u*4)*(tide?.003+.007*run:.004+.012*run)-run*(tide?.015:.032))*hem);
    if(bend){bend.rotation.identity().slerp(fall,T.MathUtils.smoothstep(v,.22,.92)*.8);bend.point.fromBufferAttribute(p,i).sub(bend.pivot).applyQuaternion(bend.rotation).add(bend.pivot);p.setXYZ(i,bend.point.x,bend.point.y,bend.point.z);}
  }
  p.needsUpdate=true;mesh.geometry.computeVertexNormals();
}
function shadowRobePanel(side){
  const pos=[],uv=[],ix=[],cols=6,rows=12;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows,width=.17+.018*v;
    pos.push(side*(.115+.020*v)+(u-.5)*width,1.08-v*.72+.055*Math.abs(u-.5)*v**5,.132+.028*v+Math.cos(u*Math.PI*3)*.009*v);uv.push(u,v);
    if(j<rows&&i<cols){const a=j*(cols+1)+i;ix.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(ix);geometry.computeVertexNormals();
  const material=new T.MeshStandardMaterial({color:SHADOW_PALETTE.cloth,roughness:.94,side:T.DoubleSide}),wind={time:{value:0},run:{value:0}};
  material.onBeforeCompile=s=>{s.uniforms.robeTime=wind.time;s.uniforms.robeRun=wind.run;s.vertexShader='uniform float robeTime; uniform float robeRun;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float hem=uv.y*uv.y;
    transformed.z+=sin(robeTime*2.3+uv.y*5.0)*(.008+.018*robeRun)*hem;
    transformed.x+=sin(robeTime*1.7+uv.y*3.0)*.006*hem;`);};
  material.customProgramCacheKey=()=> 'shadow-split-robe';
  geometry.translate(-side*.115,-1.08,-.132);
  const panel=new T.Mesh(geometry,material);panel.position.set(side*.115,1.08,.132);panel.name='Shadow_split_robe_'+side;panel.userData.wind=wind;panel.userData.side=side;panel.castShadow=panel.receiveShadow=true;return panel;
}
function faceMask(model,kind='silver',sample){
  let skin;model.traverse(o=>{if(o.isSkinnedMesh&&o.material.name.includes('Superhero'))skin=o;});
  const shadow=kind==='wraith',material=new T.MeshStandardMaterial({color:shadow?0xffffff:0x111924,roughness:shadow?.94:.86,side:T.DoubleSide});
  if(shadow){
    material.onBeforeCompile=s=>{
      s.vertexShader='varying vec3 vShadowVeil;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvShadowVeil=position;');
      s.fragmentShader='varying vec3 vShadowVeil;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float x=vShadowVeil.x,y=vShadowVeil.y;
        float fold=.75+.25*sin(y*230.0+x*32.0);
        float cutX=.011+.18*(y-1.699)+.003*sin((y-1.66)*140.0);
        float cut=(1.0-smoothstep(.0012,.0032,abs(x-cutX)))*smoothstep(1.651,1.667,y)*(1.0-smoothstep(1.731,1.749,y));
        float brow=(1.0-smoothstep(.0012,.0028,abs(y-1.698-.12*abs(x))))*smoothstep(.021,.028,abs(x))*(1.0-smoothstep(.046,.057,abs(x)));
        diffuseColor.rgb=vec3(.007,.007,.009)*fold;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.85,.81),cut);
        diffuseColor.rgb+=vec3(.22,.23,.22)*brow;`);
      s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.42,.43,.41)*cut+vec3(.12,.13,.12)*brow;');
    };material.customProgramCacheKey=()=> 'wraith-fractured-shadow-veil';
  }
  // Fit to the actual rest-pose face instead of suspending a flat shell in front.
  const probe=new T.Mesh(skin.geometry,material),ray=new T.Raycaster(),pos=[],ix=[],cols=24,rows=shadow?24:10;
  probe.updateMatrixWorld(true);
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const u=col/cols*2-1,v=row/rows,top=(shadow?1.773:1.649)-Math.abs(u)**1.6*(shadow?.035:.017),bottom=(shadow?1.586:1.563)+u*u*(shadow?.030:.022);
    let x=u*(shadow?.070+Math.sin(v*Math.PI)*.009-.029*v*v:.070*(1-v*.30));const y=top+(bottom-top)*v;let hit;
    for(let attempt=0;attempt<12;attempt++){
      if(sample)hit=sample(x,y);else{ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));hit=ray.intersectObject(probe,false)[0];}
      if(hit&&(!shadow||hit.point.z>.025))break;hit=null;x*=.96;
    }
    pos.push(x,y,(hit?.point.z??.08)+(shadow?.009:.0045));
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x;ix.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
  // A cloth envelope bridges the nose and lips instead of copying every facial crease.
  for(let pass=0;pass<32;pass++)for(let row=1;row<rows;row++)for(let col=0;col<=cols;col++){const k=(row*(cols+1)+col)*3+2;pos[k]=Math.max(pos[k],(pos[k-(cols+1)*3]+pos[k+(cols+1)*3])*.5);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setIndex(ix);geometry.computeVertexNormals();smoothSeams(geometry);
  if(!shadow){
    const uv=[];for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++)uv.push(col/cols,row/rows);geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    material.onBeforeCompile=s=>{
      s.vertexShader='varying vec2 vMaskCloth;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMaskCloth=uv;');
      s.fragmentShader='varying vec2 vMaskCloth;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float binding=1.0-smoothstep(.012,.045,min(vMaskCloth.y,1.0-vMaskCloth.y));
        float fabric=sin(vMaskCloth.x*420.0)*sin(vMaskCloth.y*180.0)*(1.0-smoothstep(.002,.012,max(fwidth(vMaskCloth.x),fwidth(vMaskCloth.y))));
        diffuseColor.rgb*=.95+fabric*.025+binding*.18;`);
      s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(.86+fabric*.025-binding*.06,.78,.91);');
    };material.customProgramCacheKey=()=> 'silver-fitted-woven-mask';
  }
  const mask=new T.Mesh(geometry,material);mask.name=shadow?'wraith-shadow-veil':'silver-face-mask';mask.castShadow=mask.receiveShadow=true;return mask;
}
export function createSkinnedHero(kind,weapon){
  const g=new T.Group(),rig=new T.Group(),model=clone(templates.get(kind));rig.add(model);g.add(rig);rig.scale.setScalar(kind==='wraith'?1.04:1.12);if(kind==='lingya')rig.scale.set(.97,.80,.97);if(kind==='wuling')rig.scale.set(1.08,1.07,1.10);if(kind==='mirage')rig.scale.set(1.06,1.07,1.08);
  model.skeleton=firstSkin(model).skeleton;const bones=new Map();model.traverse(o=>{if(o.isBone)bones.set(o.name,o);if(o.isMesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false;}});
  const mixer=new T.AnimationMixer(model),actions={};for(const [name,clip]of clips)actions[name]=mixer.clipAction(clip);
  let idleClip=clips.get('Idle_Loop');
  if(kind==='wuling')idleClip=clips.get('Pistol_Idle_Loop');
  if(kind==='silver'){
    const lower=t=>/^(root|pelvis|thigh|calf|foot|ball)/.test(t.name.match(/\[([^\]]+)\]/)?.[1]||t.name.split('.')[0]);
    idleClip=new T.AnimationClip('Silver_Idle',clips.get('Pistol_Idle_Loop').duration,[...clips.get('Idle_Loop').tracks.filter(t=>!lower(t)),...clips.get('Pistol_Idle_Loop').tracks.filter(lower)]);
  }
  const layer=(clip,name,top)=>{const c=clip.clone();c.name=name;c.tracks=c.tracks.filter(t=>isUpper(t)===top);return mixer.clipAction(c);};
  const idle=layer(idleClip,'idle-lower',false),run=layer(clips.get('Jog_Fwd_Loop'),'run-lower',false),upperIdle=layer(idleClip,'idle-upper',true),upperRun=layer(clips.get('Jog_Fwd_Loop'),'run-upper',true);
  const walk=layer(clips.get('Walk_Loop'),'walk-lower',false),upperWalk=layer(clips.get('Walk_Loop'),'walk-upper',true),backRun=layer(reverseClip(clips.get('Jog_Fwd_Loop')),'back-run',false),backWalk=layer(reverseClip(clips.get('Walk_Loop')),'back-walk',false);
  const dodgeActions=['tide','lingya'].includes(kind)?Object.fromEntries(['Jump_Start','Jump_Loop','Jump_Land'].map(name=>{const a=layer(clips.get(name),'dodge-'+name,false);a.play().setEffectiveWeight(0);a.paused=true;return[name,a];})):null;
  const kineticActions=kind==='tide'||weapon==='shadowblade'?Object.fromEntries(['Punch_Cross','Sword_Attack'].map(name=>{const a=layer(clips.get(name),'kinetic-'+name,false);a.play().setEffectiveWeight(0);a.paused=true;return[name,a];})):null;
  // Mirage carries a pendant lamp: neutral shoulders/neck, with the cast driven by her grip solver.
  const aimName=weapon==='miasmalantern'?'Idle_Loop':['fire','dark','shuriken','boomerang','sporelantern','shade','shadowblade','grimoire'].includes(weapon)?'Spell_Simple_Idle_Loop':'Pistol_Aim_Neutral';
  const upperClip=clips.get(aimName).clone();upperClip.tracks=upperClip.tracks.filter(isUpper);upperClip.name='upper-aim';
  const aim=mixer.clipAction(upperClip);aim.play();aim.setEffectiveWeight(0);
  // Calibrate the authored weapon grip in the actual aiming pose, then return to idle.
  const fullAim=actions.Pistol_Aim_Neutral;fullAim.play();mixer.update(0);model.updateMatrixWorld(true);
  const handGrips=createHandGrips(bones);
  const hand=bones.get('hand_r'),gun=kind==='wraith'?shadowFocus(weapon):weapon==='miasmalantern'?miasmaLantern():weapon==='sporelantern'?sporeLantern():weapon==='boomerang'?makeSlingshot():weapon==='harpoon'?makeHarpoon():makePrototype(kind,weapon).userData.weapon;gun.removeFromParent();gun.position.set(0,.045,0);gun.scale.setScalar(kind==='wraith'?.85:['sporelantern','miasmalantern'].includes(weapon)?.95:weapon==='harpoon'?1.05:weapon==='boomerang'?.9:weapon==='crossbow'?.72:.65);gun.quaternion.copy(primaryGripFrame(weapon).invert());fitWeaponToPalm(gun,GRIP_POINTS[weapon]||[0,0,0]);hand.add(gun);
  fullAim.stop();idle.play();upperIdle.play();run.play().setEffectiveWeight(0);upperRun.play().setEffectiveWeight(0);mixer.update(0);
  for(const a of[walk,upperWalk,backRun,backWalk])a.play().setEffectiveWeight(0);
  model.skeleton.pose();model.updateMatrixWorld(true);
  const owned=[];let cape;
  if(kind==='silver'){g.userData.silverHair=prepareSilverHair(model);owned.push(...g.userData.silverHair);}
  if(['silver','tide','wuling','mirage','wraith'].includes(kind)){
    cape=capeMesh(kind,weapon,model);if(kind==='wuling')cape.scale.set(1,1,1);owned.push(cape);attachAtRest(bones.get('spine_03'),cape,model);
    if(kind==='silver'||kind==='wraith'){const mask=cachedFaceMask(model,kind);owned.push(mask);attachAtRest(bones.get('Head'),mask,model);}
  }
  if(kind==='wraith'){
    const a=shadowAccessories(weapon);attachAtRest(bones.get('spine_03'),a.chest,model);
    g.userData.shadowAura=createShadowAura(weapon);(weapon==='shade'?gun:g).add(g.userData.shadowAura);
    if(weapon==='grimoire'){
      // Split cloth hangs from the waist; its hem lags the stride instead of sticking to each thigh.
      g.userData.shadowRobe=[-1,1].map(side=>{
        const panel=shadowRobePanel(side);owned.push(panel);attachAtRest(bones.get('pelvis'),panel,model);return panel;
      });
    }
  }
  if(kind==='wuling'){const mask=cachedFaceMask(model,kind);owned.push(mask);attachAtRest(bones.get('Head'),mask,model);const pod=sporePod();pod.position.set(.036,.097,0);bones.get('hand_l').add(pod);g.userData.sporePod=pod;const a=wulingAccessories();attachAtRest(bones.get('spine_03'),a.chest,model);attachAtRest(bones.get('Head'),a.head,model);attachAtRest(bones.get('spine_03'),a.basket,model);const satchel=sporeSatchel();satchel.position.set(.23,1.0,.02);attachAtRest(bones.get('pelvis'),satchel,model);}
  if(kind==='mirage'){
    const mask=cachedFaceMask(model,kind),tails=miragePetalTails(),a=mirageAccessories();owned.push(mask,tails);attachAtRest(bones.get('Head'),mask,model);attachAtRest(bones.get('Head'),a.head,model);attachAtRest(bones.get('spine_03'),a.chest,model);attachAtRest(bones.get('pelvis'),tails,model);g.userData.mirageTails=tails;
    g.userData.mirageHair=prepareMirageHair(model);owned.push(...g.userData.mirageHair);
  }
  if(kind==='lingya'){const face=lingyaFace.clone(true);face.name='Lingya_authored_face';skinLingyaNeck(face,model);attachAtRest(bones.get('Head'),face,model);g.userData.face=face;g.userData.faceEyes=face.getObjectByName('Lingya-eyes_viewport');g.userData.faceEyeRest=g.userData.faceEyes.position.z;g.userData.faceMorphs=[];face.traverse(o=>{if(o.morphTargetInfluences)g.userData.faceMorphs.push(o);});const hair=createLingyaHair();attachAtRest(bones.get('Head'),hair,model);g.userData.lingyaHair=hair;const a=lingyaAccessories();const bagPivot=new T.Group();bagPivot.position.set(.24,1,-.10);a.bag.position.set(-.24,-1,.10);bagPivot.add(a.bag);g.userData.satchel=bagPivot;attachAtRest(bones.get('spine_03'),a.chest,model);attachAtRest(bones.get('pelvis'),bagPivot,model);g.userData.satchelRest=bagPivot.quaternion.clone();}
  // Slightly larger head silhouette remains legible from the elevated game camera.
  bones.get('Head')?.scale.setScalar(kind==='silver'?1.035:['wuling','mirage'].includes(kind)?1.025:1.055);
  if(kind==='lingya')bones.get('Head')?.scale.set(1.05,1.05*.97/.80,1.05);
  mixer.update(0);const restCape=cape?.quaternion.clone();
  Object.assign(g.userData,{skinned:true,handGrips,kind,weaponId:weapon,dodgeActions,kineticActions,rig,model,mixer,actions,idle,run,walk,upperIdle,upperRun,upperWalk,backRun,backWalk,aim,gun,gunRest:gun.quaternion.clone(),aimArm:bones.get('upperarm_r'),firingForearm:bones.get('lowerarm_r'),offArm:bones.get('upperarm_l'),offForearm:bones.get('lowerarm_l'),swimHead:bones.get('Head'),swimLeftKnee:bones.get('calf_l'),swimRightKnee:bones.get('calf_r'),swimLeftFoot:bones.get('foot_l'),swimRightFoot:bones.get('foot_r'),swimLeftLeg:bones.get('thigh_l'),swimRightLeg:bones.get('thigh_r'),pelvis:bones.get('pelvis'),spine:bones.get('spine_01'),cape,restCape,owned,blend:0,aimBlend:0,aimHold:0,smoothedSpeed:0,backBlend:0,gaitYaw:0,gaitPhase:0,reloadPhase:1});
  g.userData.support={hand:bones.get('hand_l'),rightHand:bones.get('hand_r'),elbow:new T.Vector3(),goal:new T.Vector3(),axis:new T.Vector3(),bend:new T.Vector3(),target:new T.Vector3(),origin:new T.Vector3(),from:new T.Vector3(),to:new T.Vector3(),delta:new T.Quaternion(),world:new T.Quaternion(),parent:new T.Quaternion(),start:[new T.Quaternion(),new T.Quaternion()]};
  if(weapon==='crossbow')g.userData.crossbowBase=[g.userData.aimArm,g.userData.firingForearm,g.userData.offArm,g.userData.offForearm].map(bone=>[bone,new T.Quaternion()]);
  else g.userData.attackBase=[g.userData.aimArm,g.userData.firingForearm,g.userData.offArm,g.userData.offForearm].map(bone=>[bone,new T.Quaternion()]);
  if(['tide','mirage','wraith'].includes(kind))g.userData.attackBase.push(...[g.userData.spine,g.userData.swimHead].map(bone=>[bone,bone.quaternion.clone()]));
  if(kind==='wuling')g.userData.attackBase.push([g.userData.swimHead,g.userData.swimHead.quaternion.clone()]);
  if(kind==='lingya')g.userData.lingyaPoseBase=[g.userData.spine,g.userData.swimHead,g.userData.swimLeftLeg,g.userData.swimRightLeg,g.userData.swimLeftKnee,g.userData.swimRightKnee,g.userData.swimLeftFoot,g.userData.swimRightFoot,g.userData.aimArm,g.userData.offArm,g.userData.firingForearm,g.userData.offForearm].map(b=>[b,b.quaternion.clone()]);
  settleHeroIdentity(g,kind);
  if(kind==='mirage'){
    // Cloaking must never fade another hero, a pooled lantern, or the lobby preview.
    const isolated=new Map(),unique=new Set(owned.map(o=>o.material)),surfaces=[];
    g.traverse(o=>{if(!o.isMesh)return;const original=o.material;if(!unique.has(original)){if(!isolated.has(original)){const material=original.clone();material.onBeforeCompile=original.onBeforeCompile;material.customProgramCacheKey=original.customProgramCacheKey;isolated.set(original,material);}o.material=isolated.get(original);}o.material.transparent=true;surfaces.push({mesh:o,opacity:o.material.opacity,depthWrite:o.material.depthWrite,castShadow:o.castShadow});});
    Object.assign(g.userData,{mirageSurfaces:surfaces,mirageOwnedMaterials:[...isolated.values()],mirageConceal:0,mirageFade:0});
  }
  if(kind==='wraith')g.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])finishShadowTone(m);});
  return g;
}
export function animateSkinnedHero(g,t,speed,attack,hurt){
  const d=g.userData,dt=d.lastTime===undefined?1/60:Math.max(0,Math.min(d.kineticActions?.1:.05,t-d.lastTime));d.lastTime=t;
  if(d.faceMorphs){const phase=(t%4.3),blink=Math.max(0,1-Math.abs(phase-.13)/.13);for(const face of d.faceMorphs)face.morphTargetInfluences[0]=blink;d.faceEyes.position.z=d.faceEyeRest-blink*.008;}
  if(d.lingyaPoseReady)for(const [bone,q]of d.lingyaPoseBase)bone.quaternion.copy(q);
  const fired=shotStarted(d,attack,d.previousAttack||0);d.previousAttack=attack;d.attackAge=fired?0:(d.attackAge??2)+dt;
  if(d.cancelAttack&&['harpoon','shadowblade'].includes(d.weaponId)){d.cancelAttack=false;d.attackAge=2;d.harpoonTarget=d.scytheTarget=null;}
  const meleeWeapon=['harpoon','shadowblade'].includes(d.weaponId),motion=weaponGesture(d.weaponId,d.weaponId==='boomerang'&&d.shotSerial?(d.reloadPhase??1)*(d.reloadDuration||1):d.attackAge,d.reloadPhase??1,d.reloadDuration||1);
  // The held pod and its fingers use the projectile's cycle, including haste;
  // the existing smoothed whole-arm gesture keeps its own recovery unchanged.
  const gripMotion=d.weaponId==='sporelantern'?weaponGesture(d.weaponId,d.shotSerial?(d.reloadPhase??1)*(d.reloadDuration||1):10,d.reloadPhase??1,d.reloadDuration||1):motion;
  const scythe=d.weaponId==='shadowblade'?scythePose(d.attackAge,d.reloadDuration||1,d.scytheCombo||0):null;
  const newHero=['tide','lingya','wuling','mirage'].includes(d.kind),action=newHeroAttack(d.kind,d.shotSerial?(d.reloadDuration?(d.reloadPhase??1)*d.reloadDuration:d.attackAge):10,d.reloadDuration||1);
  const readyTarget=d.aimActive||attack>0||d.shotSerial&&(d.reloadPhase??1)<1||d.dashTime>0?1:0;d.readyBlend=(d.readyBlend||0)+(readyTarget-(d.readyBlend||0))*(1-Math.exp(-dt*10));
  const dodge=heroDodgePose(d.kind,d.dashTime||0),gaitSpeed=dodge?.weight>.01?Math.min(speed,6):speed;
  d.smoothedSpeed+=(gaitSpeed-d.smoothedSpeed)*(1-Math.exp(-dt*(speed>0?15:22)));
  d.blend+=(Math.min(1,speed/1.6)-d.blend)*(1-Math.exp(-dt*(speed>0?14:18)));
  d.aimHold=['tide','lingya','wuling','mirage'].includes(d.kind)||d.kind==='wraith'&&['grimoire','shadowblade'].includes(d.weaponId)||attack>0||d.aimActive?.45:Math.max(0,d.aimHold-dt);d.aimBlend+=((d.aimHold>0?1:0)-d.aimBlend)*(1-Math.exp(-dt*(d.weaponId==='crossbow'?8:20)));
  const relative=Number.isFinite(d.travelAngle)?angleDelta(d.travelAngle,g.rotation.y):0,backward=Math.abs(relative)>Math.PI*.55;
  d.backBlend+=((backward?1:0)-d.backBlend)*(1-Math.exp(-dt*12));
  const travelYaw=newHero?T.MathUtils.lerp(T.MathUtils.clamp(relative,-.85,.85),T.MathUtils.clamp(angleDelta(relative,Math.PI),-.85,.85),d.backBlend):T.MathUtils.clamp(angleDelta(relative,backward?Math.PI:0),-.85,.85);
  const gaitTarget=d.kind==='lingya'&&d.dashTime>0?T.MathUtils.clamp(angleDelta(d.dashAngle??g.rotation.y,g.rotation.y),-1.3,1.3):speed>.1?travelYaw:0;d.gaitYaw+=(gaitTarget-d.gaitYaw)*(1-Math.exp(-dt*12));
  const jogging=T.MathUtils.smoothstep(d.smoothedSpeed,2.2,4.6),runWeight=d.blend*jogging,walkWeight=d.blend*(1-jogging),upperFree=newHero?(1-d.readyBlend)*.72:1-d.aimBlend;
  d.run.setEffectiveWeight(runWeight*(1-d.backBlend));d.backRun.setEffectiveWeight(runWeight*d.backBlend);d.walk.setEffectiveWeight(walkWeight*(1-d.backBlend));d.backWalk.setEffectiveWeight(walkWeight*d.backBlend);d.idle.setEffectiveWeight(1-d.blend);
  d.upperRun.setEffectiveWeight(runWeight*upperFree);d.upperWalk.setEffectiveWeight(walkWeight*upperFree);d.upperIdle.setEffectiveWeight((1-d.blend)*upperFree);
  const strideScale=d.rig.scale.z/1.23;
  const cadence=T.MathUtils.lerp(d.smoothedSpeed/2.5/d.walk.getClip().duration,d.smoothedSpeed/5.8/d.run.getClip().duration,jogging)/strideScale;d.gaitPhase=(d.gaitPhase+dt*cadence*(d.kind==='lingya'?1-lingyaHopPose(d.dashTime||0).air:1))%1;
  for(const a of[d.run,d.backRun,d.upperRun,d.walk,d.backWalk,d.upperWalk]){a.paused=true;a.time=d.gaitPhase*a.getClip().duration;}d.aim.setEffectiveWeight(newHero?1-upperFree:d.aimBlend);
  const isRoll=d.kind==='scout'&&d.dashTime>0&&!(d.waterDepth>.42)&&!d.waterDash,roll=d.actions.Roll,weight=isRoll?rollWeight(d.dashTime):0,poseBlend=(1-weight)*(d.kind==='lingya'?1-lingyaHopPose(d.dashTime||0).weight:1);
  if(d.kind==='scout'){
    // The parent eases toward the dodge heading; the roll must already follow its travel axis.
    // Remove our previous offset before applying this frame, including the last recovery frame.
    d.rig.rotation.y-=d.rollYaw||0;
    d.rollYaw=isRoll&&Number.isFinite(d.dashAngle)?angleDelta(d.dashAngle,g.rotation.y)*weight:0;
    d.rig.rotation.y+=d.rollYaw;
  }
  if(isRoll){roll.enabled=true;roll.setLoop(T.LoopOnce,1);roll.clampWhenFinished=true;roll.play();roll.setEffectiveWeight(weight);roll.paused=true;roll.time=rollProgress(d.dashTime)*roll.getClip().duration;for(const a of[d.idle,d.run,d.walk,d.backRun,d.backWalk,d.upperIdle,d.upperRun,d.upperWalk,d.aim])a.setEffectiveWeight(a.getEffectiveWeight()*poseBlend);}else roll.stop();
  if(d.dodgeActions){
    for(const action of Object.values(d.dodgeActions))action.setEffectiveWeight(0);
    if(dodge.weight>0){
      const w=dodge.weight;for(const a of[d.idle,d.run,d.walk,d.backRun,d.backWalk])a.setEffectiveWeight(a.getEffectiveWeight()*(1-w));
      const set=(name,weight,time)=>{const action=d.dodgeActions[name];action.time=Math.min(action.getClip().duration-.001,Math.max(0,time));action.setEffectiveWeight(weight*w);};
      if(d.kind==='tide')set('Jump_Start',1,.035);
      else{set('Jump_Start',dodge.launch,dodge.startTime);set('Jump_Loop',dodge.air,dodge.airTime);set('Jump_Land',dodge.land,dodge.landTime);}
    }
  }
  if(d.kineticActions){
    const amount=(meleeWeapon?motion.body:action.weight)*(1-T.MathUtils.smoothstep(d.smoothedSpeed,.4,2.5))*(1-(dodge?.weight||0))*(1-(d.waterBlend||0));
    for(const a of Object.values(d.kineticActions))a.setEffectiveWeight(0);
    if(amount>0){for(const a of[d.idle,d.run,d.walk,d.backRun,d.backWalk])a.setEffectiveWeight(a.getEffectiveWeight()*(1-amount));
      const a=d.kineticActions[d.kind==='lingya'||d.weaponId==='shadowblade'||d.kind==='tide'&&d.harpoonCombo===1?'Sword_Attack':'Punch_Cross'];a.time=(meleeWeapon?motion.clipPhase:action.clipPhase)*(a.getClip().duration-.001);const stance=d.weaponId==='shadowblade'?.35:.85;a.setEffectiveWeight(amount*stance);d.idle.setEffectiveWeight(d.idle.getEffectiveWeight()+amount*(1-stance));
    }
  }
  d.presence=heroCarryPose(d.kind,t,d.gaitPhase,d.blend,d.readyBlend);d.carryTurn=(d.carryTurn||0)+((newHero?T.MathUtils.clamp((d.turnRate||0)*.045,-.18,.18):0)-(d.carryTurn||0))*(1-Math.exp(-dt*5));
  if(d.kind==='lingya')d.rig.rotation.z-=d.hopBank||0;
  const bank=isRoll?0:T.MathUtils.clamp(-(d.turnRate||0)*.008,-.075,.075)*d.blend;d.rig.rotation.z+=(bank-d.rig.rotation.z)*(1-Math.exp(-dt*10));
  // Recovery belongs to the animation, so it can finish after the shot timer.
  d.attackGesture=((d.attackGesture||0)+(motion.kick-(d.attackGesture||0))*(1-Math.exp(-dt*(d.weaponId==='shotgun'?18:32))));
  if(d.weaponId==='boomerang'){d.attackGesture=motion.kick;poseSlingshot(d.gun,d.shotSerial?(d.reloadPhase??1)*(d.reloadDuration||1):10,d.reloadDuration||1);}
  if(meleeWeapon)d.attackGesture=motion.kick;
  const attackBlend=poseBlend*(d.kind==='tide'?1-dodge.weight:1),kick=isRoll?0:d.attackGesture*attackBlend,sweep=isRoll?0:motion.sweep*attackBlend,gather=isRoll?0:motion.gather*attackBlend;
  const acceleration=dt?T.MathUtils.clamp((speed-(d.previousSpeed??speed))/dt,-10,10):0;d.previousSpeed=speed;
  d.motionLean=((d.motionLean||0)+(T.MathUtils.clamp(acceleration*.006,-.045,.045)-(d.motionLean||0))*(1-Math.exp(-dt*9)));
  const recoil={rifle:.075,shotgun:.22,crossbow:.075,shuriken:-.12,fire:-.15,dark:.065,hammer:0,harpoon:-.18,boomerang:-.08,sporelantern:-.065,miasmalantern:-.045,shade:.04,shadowblade:-.08,grimoire:-.035}[d.weaponId];
  d.rig.rotation.x=isRoll?0:-kick*recoil+d.motionLean;
  d.rig.position.z=isRoll?0:d.kind==='tide'?.08*kick-.04*gather-(d.harpoonCombo===2?.08*sweep:0):d.kind==='lingya'?.012*kick-.012*gather:-kick*Math.abs(recoil)*.45;
  if(d.kind==='wuling'){const tuck=Math.sin(Math.PI*T.MathUtils.clamp((d.dashTime||0)/.52,0,1)),side=Math.sin((d.dashAngle??g.rotation.y)-g.rotation.y);d.rig.position.y=-.13*tuck;d.rig.rotation.x+=.22*tuck;d.rig.rotation.z=bank-side*.16*tuck;}
  if(d.kind==='mirage'){const slip=Math.sin(Math.PI*T.MathUtils.clamp((d.dashTime||0)/.52,0,1)),side=Math.sin((d.dashAngle??g.rotation.y)-g.rotation.y);d.rig.position.y=-.08*slip;d.rig.rotation.x+=.12*slip;d.rig.rotation.z=bank-side*.14*slip;}
  // Remove last frame's procedural arm offsets before the mixer blends a new pose.
  if(d.crossbowBaseReady)for(const [bone,rotation]of d.crossbowBase)bone.quaternion.copy(rotation);
  if(d.attackBaseReady)for(const [bone,rotation]of d.attackBase)bone.quaternion.copy(rotation);
  restoreGripWrists(d);d.mixer.update(dt);captureGripWrists(d);poseGripFingers(d,gripMotion);if(d.kind==='tide'){d.slide=dodge.weight;d.rig.rotation.x+=dodge.brace;d.rig.position.y=dodge.height;}
  if(!isRoll&&Math.abs(d.gaitYaw)>.001){
    g.updateMatrixWorld(true);const chest=d.spine.getWorldQuaternion(new T.Quaternion()).normalize(),hips=d.pelvis.getWorldQuaternion(new T.Quaternion()).normalize();
    hips.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),d.gaitYaw));d.pelvis.quaternion.copy(d.pelvis.parent.getWorldQuaternion(new T.Quaternion()).normalize().invert().multiply(hips)).normalize();
    d.pelvis.updateMatrixWorld(true);d.spine.quaternion.copy(d.spine.parent.getWorldQuaternion(new T.Quaternion()).normalize().invert().multiply(chest)).normalize();
  }
  d.gun.quaternion.copy(d.gunRest);
  if(d.attackBase){
    for(const [bone,rotation]of d.attackBase)rotation.copy(bone.quaternion);d.attackBaseReady=true;
    const gesture=isRoll?0:kick;
    if(d.weaponId==='harpoon'){
      // Rear-hand thrust, torso weight transfer and the gaze staying on the target.
      d.spine.rotateY(d.harpoonCombo===1?-.36*gather+.40*gesture+.22*sweep:d.harpoonCombo===2?-.18*gather+.24*gesture-.22*sweep:-.24*gather+.26*gesture+.08*sweep);d.spine.rotateX(.07*gesture-.035*gather+d.presence.breath);d.spine.rotateZ(d.presence.shoulder*(1-action.weight));
      d.swimHead.rotateY(.12*gather-.13*gesture+d.presence.look);d.rig.position.y-=.045*gesture;
      d.aimArm.rotateX(-.28*gesture+.12*gather);d.firingForearm.rotateX(-.24*gesture);
    }else if(d.weaponId==='miasmalantern'){
      const breath=Math.sin(t*1.8)*.007*(1-d.readyBlend*.7);d.spine.rotateX(.025*gesture-.018*gather+breath);d.spine.rotateY(-.06*gather+.10*gesture+.04*sweep);d.swimHead.rotateX(-.10*(1-.5*d.blend)-.01*gesture+.015*gather);d.swimHead.rotateY(.03*gather-.045*gesture);d.aimArm.rotateX(-.16*gesture+.09*gather);d.firingForearm.rotateX(-.13*gesture+.045*gather);d.offArm.rotateY(.18*sweep-.09*gather);d.offForearm.rotateX(-.13*gesture-.09*gather);
    }else if(d.weaponId==='sporelantern'){
      const rest=(1-d.readyBlend)*(1-d.blend)*(1-(d.waterBlend||0));d.swimHead.rotateX(-.065*rest);
      d.offArm.rotateX(-.45*gesture+.14*gather);d.offForearm.rotateX(-.3*gesture);d.aimArm.rotateX(-.04*gesture);
    }else if(d.weaponId==='rifle'){
      d.aimArm.rotateX(-.16*gesture);d.firingForearm.rotateX(.24*gesture);
      d.offArm.rotateX(.14*gesture);d.offForearm.rotateX(-.22*gesture);
    }else if(d.weaponId==='shotgun'){
      const pump=isRoll?0:motion.draw;
      d.aimArm.rotateX(-.25*gesture);d.firingForearm.rotateX(.32*gesture);
      d.offArm.rotateX(.17*gesture-.25*pump);d.offForearm.rotateX(-.15*gesture+.22*pump);
      if(d.gun.userData.pump)d.gun.userData.pump.position.z=isRoll?0:-.23*pump;
    }else if(d.weaponId==='boomerang'){
      d.spine.rotateY(-.045*gather);d.aimArm.rotateX(-.03*gesture);d.offForearm.rotateX(-.05*gather);
    }else if(d.weaponId==='shuriken'){
      d.aimArm.rotateY(-.95*sweep+.25*gather);d.aimArm.rotateZ(.5*sweep);
      d.firingForearm.rotateX(-.7*gesture+.35*gather);d.firingForearm.rotateY(.4*sweep);d.offArm.rotateY(.35*sweep);d.offForearm.rotateX(-.28*gather);
      d.gun.scale.setScalar(.65*(1-.6*gesture));
    }else if(d.weaponId==='shade'){
      // Lift and guide an airborne tear with open palms, rather than the shared
      // inward forearm strike used by the other shadow implements.
      d.spine.rotateY(-.035*sweep);d.spine.rotateX(-.015*gather+.018*gesture);
      d.aimArm.rotateY(-.08*gather+.10*sweep);d.firingForearm.rotateX(-.10*gesture);
      d.offArm.rotateX(-.08*sweep);d.offForearm.rotateZ(.08*gather);
    }else if(d.kind==='wraith'){
      d.spine.rotateY((d.weaponId==='shadowblade'?.25:-.10)*sweep);d.spine.rotateX(-.035*gather+.04*gesture);
      d.aimArm.rotateY(-.30*gather+.25*sweep);d.firingForearm.rotateX(-.25*gesture);
      d.offArm.rotateX(-.22*sweep);d.offForearm.rotateZ(.22*gather);
      if(d.weaponId==='shadowblade'){
        const side=d.scytheCombo===1?-1:1,heavy=d.scytheCombo===2;
        d.gun.scale.setScalar(.85);
        // Torso leads the cut; the head counter-turns instead of following the blade.
        d.spine.rotateY(scythe.torso-.25*sweep);
        d.spine.rotateX(heavy?-.10*gather+.12*kick:.035*kick);
        d.swimHead.rotateY(-side*.16*motion.cut);
        d.rig.position.z=.04*kick-.025*gather;d.rig.rotation.x+=.04*kick-.03*gather;
      }
    }else if(d.weaponId==='fire'){
      d.aimArm.rotateX(-.75*gesture+.18*gather);d.firingForearm.rotateX(-.43*gesture);
      d.offArm.rotateX(-.52*sweep);d.offForearm.rotateZ(-.38*sweep);d.aimArm.rotateZ(-.16*sweep);
    }else if(d.weaponId==='dark'){
      d.aimArm.rotateY(.72*sweep);d.firingForearm.rotateX(.48*gesture-.25*gather);
      d.offArm.rotateZ(.6*sweep);d.offArm.rotateX(-.32*gather);d.offForearm.rotateY(-.55*sweep);d.offForearm.rotateX(-.35*gather);
    }
  }
  if(d.crossbowBase){for(const [bone,rotation]of d.crossbowBase)rotation.copy(bone.quaternion);d.crossbowBaseReady=true;}
  if(d.support&&poseBlend>.01&&d.aimBlend>.01){
    const s=d.support;
    const solve=(bones,hand)=>{
      const [lower,upper]=bones;bones.forEach((bone,i)=>s.start[i].copy(bone.quaternion));
      upper.getWorldPosition(s.origin);lower.getWorldPosition(s.elbow);hand.getWorldPosition(s.from);
      const a=s.origin.distanceTo(s.elbow),b=s.elbow.distanceTo(s.from),distance=T.MathUtils.clamp(s.origin.distanceTo(s.target),Math.abs(a-b)+.001,(a+b)*(meleeWeapon?.94:1)-.001);
      s.axis.copy(s.target).sub(s.origin).normalize();s.goal.copy(s.origin).addScaledVector(s.axis,distance);
      g.getWorldQuaternion(s.world);s.bend.set(hand===s.hand?.6:-.6,-1,-.2).applyQuaternion(s.world);s.bend.addScaledVector(s.axis,-s.bend.dot(s.axis)).normalize();
      const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
      s.from.copy(s.elbow).sub(s.origin).normalize();s.elbow.copy(s.origin).addScaledVector(s.axis,along).addScaledVector(s.bend,height);s.to.copy(s.elbow).sub(s.origin).normalize();
      s.delta.setFromUnitVectors(s.from,s.to);upper.getWorldQuaternion(s.world);s.world.premultiply(s.delta);upper.parent.getWorldQuaternion(s.parent).invert();upper.quaternion.copy(s.parent.multiply(s.world)).normalize();upper.updateWorldMatrix(false,true);
      lower.getWorldPosition(s.origin);hand.getWorldPosition(s.from);s.from.sub(s.origin).normalize();s.to.copy(s.goal).sub(s.origin).normalize();
      s.delta.setFromUnitVectors(s.from,s.to);lower.getWorldQuaternion(s.world);s.world.premultiply(s.delta);lower.parent.getWorldQuaternion(s.parent).invert();lower.quaternion.copy(s.parent.multiply(s.world)).normalize();lower.updateWorldMatrix(false,true);
      // The drawn pouch is already eased by the shot clock. A second joint
      // speed limit lets the pulling hand lag behind it under attack haste.
      bones.forEach((bone,i)=>{bone.quaternion.slerp(s.start[i],scythe?0:1-d.aimBlend*poseBlend);if((newHero||meleeWeapon)&&!scythe&&!(d.weaponId==='boomerang'&&hand===s.hand)){d.armHistory??=new Map();const last=d.armHistory.get(bone);if(last)bone.quaternion.copy(last.rotateTowards(bone.quaternion,dt*14));else d.armHistory.set(bone,bone.quaternion.clone());d.armHistory.get(bone).copy(bone.quaternion);bone.updateWorldMatrix(false,true);}});
    };
    // Solve toward weapon-specific hand positions; grip constraints must retain the gesture.
    const id=d.weaponId,lantern=['sporelantern','miasmalantern'].includes(id),mirage=id==='miasmalantern',staff=['fire','dark'].includes(id),bow=id==='crossbow',throwing=id==='shuriken',sling=id==='boomerang';
    d.aimArm.getWorldPosition(s.origin);d.offArm.getWorldPosition(s.target);s.target.add(s.origin).multiplyScalar(.5);const chest=s.target.clone();g.getWorldQuaternion(s.world);
    if(id==='harpoon')s.to.set(-.21+(d.harpoonCombo===1?-.18*gather+.34*kick+.12*sweep:.05*kick),-.27+.045*kick+dodge.weight*.06,.05+(d.harpoonCombo===1?.32:.49)*kick-.20*gather-(d.harpoonCombo===2?.38*sweep:0)-dodge.weight*.14);
    else if(mirage){const rest=(1-d.readyBlend)*(1-d.blend);s.to.set(-.245+.025*kick+.025*gather,-.245+.125*kick+.025*gather-.035*rest,.13+.255*kick-.10*gather);}
    else if(lantern){const rest=(1-d.readyBlend)*(1-d.blend)*(1-(d.waterBlend||0));s.to.set(-.27,-.26+.035*kick,.10+.06*kick-.03*rest);}
    else if(id==='shade')s.to.set(-.22-.035*sweep,-.22+.045*kick+.025*gather,.24+.12*kick+.035*sweep-.02*gather);
    else if(scythe){s.to.set(scythe.x,scythe.y,scythe.z);if(d.scytheGripPosition)d.scytheGripPosition.lerp(s.to,1-Math.exp(-dt*24));else d.scytheGripPosition=s.to.clone();s.to.copy(d.scytheGripPosition);}
    else if(id==='grimoire')s.to.set(-.22,-.22+.025*kick,.22+.06*kick);
    else if(staff)s.to.set(-.19,-.23,id==='fire'?.24+.22*kick:.22+.09*gather);
    else if(sling)s.to.set(-.10,-.13+.012*gather,.25-.018*kick-.13*Math.max(0,-T.MathUtils.clamp(d.aimPitch||0,-1.3,1.3)));
    else if(throwing)s.to.set(-.24-.18*sweep,-.10-.14*gather,.28+.20*kick);
    else s.to.set(bow?-.09:-.08,-.20+kick*(id==='shotgun'?.06:.025)+(bow?.06*Math.max(0,-(d.aimPitch||0)):0),(bow?.10-.02*Math.abs(d.aimPitch||0):.14)-kick*(id==='shotgun'?.13:.065));
    if(newHero){const step=Math.sin(d.gaitPhase*Math.PI*2)*d.blend*(1-action.weight)*(1-(dodge?.weight||0)),carry=1-d.readyBlend;
      s.to.y-=carry*(id==='boomerang'?.13:.06);if(id==='boomerang'){s.to.x-=carry*.035;s.to.z-=carry*.06;}s.to.z+=step*.035;s.to.x+=step*.025;
    }
    s.to.applyQuaternion(s.world);s.target.add(s.to);solve([d.firingForearm,d.aimArm],s.rightHand);
    const melee=id==='harpoon'||id==='shadowblade',commit=melee?motion.weight:action.weight;
    const yaw=(newHero||melee?committedWeaponYaw(g.rotation.y,d.aimAngle,d.attackAngle,commit):bow?g.rotation.y:Number.isFinite(d.aimAngle)?d.aimAngle:g.rotation.y)+(id==='shadowblade'?scythe.yaw:id==='harpoon'&&d.harpoonCombo===1?-.62*gather+.48*kick+.27*sweep:0);
    s.world.setFromAxisAngle(s.to.set(0,1,0),yaw);
    const pitch=id==='grimoire'?.02:id==='shade'?-.20+.14*kick+.10*sweep-.08*gather:id==='shadowblade'?scythe.pitch:id==='harpoon'?-.04+(1-d.readyBlend)*.30+.08*gather-.06*kick-(d.harpoonCombo===2?.24*sweep:0)-dodge.weight*.30:mirage?-.04-.20*kick+.05*gather:lantern?-.035+.06*Math.sin(d.gaitPhase*Math.PI*2)*d.blend:staff?(id==='fire'?-.15-.4*kick:.08+.15*gather):sling?.02+.03*gather-.03*kick+(1-d.readyBlend)*.20:throwing?-.2+.5*sweep:-kick*(id==='shotgun'?.14:.055);
    s.world.multiply(new T.Quaternion().setFromAxisAngle(s.to.set(1,0,0),pitch-T.MathUtils.clamp(melee?T.MathUtils.lerp(d.aimPitch||0,d.attackPitch??d.aimPitch??0,commit):d.aimPitch||0,-1.3,1.3)));if(id==='shadowblade')s.world.multiply(new T.Quaternion().setFromAxisAngle(s.to.set(0,0,1),scythe.roll));if(id==='boomerang')s.world.multiply(new T.Quaternion().setFromAxisAngle(s.to.set(0,0,1),-.025*gather+.025*kick));if((newHero||meleeWeapon)&&!scythe){if(d.weaponWorld)d.weaponWorld.rotateTowards(s.world,dt*12);else d.weaponWorld=s.world.clone();s.world.copy(d.weaponWorld);}if(scythe){if(d.scytheGripRotation)d.scytheGripRotation.rotateTowards(s.world,dt*8);else d.scytheGripRotation=s.world.clone();s.world.copy(d.scytheGripRotation);}aimGrip(d,s.world,scythe?1:poseBlend*d.aimBlend,dt);
    if(scythe){
      // Keep both palms reachable as a coupled grip. Correct the rear hand rather
      // than letting the forward hand slide off the shaft or stretch its elbow.
      for(let pass=0;pass<6;pass++){
        s.target.set(...SCYTHE_SUPPORT);d.gun.localToWorld(s.target);supportGripTarget(d,s.target);
        d.offArm.getWorldPosition(s.origin);d.offForearm.getWorldPosition(s.elbow);s.hand.getWorldPosition(s.from);
        const reach=(s.origin.distanceTo(s.elbow)+s.elbow.distanceTo(s.from))*.935;
        s.to.copy(s.origin).sub(s.target);const distance=s.to.length();if(distance<=reach)break;
        s.rightHand.getWorldPosition(s.target);s.target.addScaledVector(s.to,(distance-reach)/distance);
        solve([d.firingForearm,d.aimArm],s.rightHand);aimGrip(d,d.scytheGripRotation,1,dt);
      }
      s.target.set(...SCYTHE_SUPPORT);d.gun.localToWorld(s.target);
    }
    else if(sling){const mechanism=slingshotMechanism(d.shotSerial?(d.reloadPhase??1)*(d.reloadDuration||1):10,d.reloadDuration||1);s.target.set(0,.22,-.07-.30*mechanism.handPull);d.gun.localToWorld(s.target);}
    else if(d.kind==='wraith'){if(id==='shade')s.to.set(.17-.04*sweep-.015*gather,-.20+.035*kick+.025*gather,.21+.06*kick-.025*sweep);else s.to.set(.20-.08*gather,-.22+.07*sweep,.13+.15*gather);g.getWorldQuaternion(s.world);s.target.copy(chest).add(s.to.applyQuaternion(s.world));}
    else if(mirage){const rest=(1-d.readyBlend)*(1-d.blend);s.to.set(.23-.035*kick-.08*gather,-.30+.075*kick+.10*gather-.075*rest,.12+.14*kick+.13*gather-.055*rest);g.getWorldQuaternion(s.world);s.target.copy(chest).add(s.to.applyQuaternion(s.world));
    }else if(lantern){const rest=(1-d.readyBlend)*(1-d.blend)*(1-(d.waterBlend||0));s.to.set(.24+.10*gather-.035*kick-.04*rest,-.36+.29*kick+.13*gather-.05*rest,.12-.19*gather+.47*kick-.085*rest);g.getWorldQuaternion(s.world);s.target.copy(chest).add(s.to.applyQuaternion(s.world));
    }else if(staff||throwing){
      s.to.set(throwing?.27:id==='fire'?.24:.18+.13*Math.sin(sweep*Math.PI),throwing?-.24:id==='fire'?-.12:-.10+.12*gather,throwing?.20:id==='fire'?.45+.12*kick:.44-.12*sweep);
      g.getWorldQuaternion(s.world);s.target.copy(chest).add(s.to.applyQuaternion(s.world));
    }else if(bow){const mechanism=crossbowMechanism(T.MathUtils.clamp(d.reloadPhase??1,0,1));s.target.set(T.MathUtils.lerp(0,.06,mechanism.hand),T.MathUtils.lerp(-.05,.13,mechanism.hand),T.MathUtils.lerp(.18,.29-mechanism.pull,mechanism.hand));d.gun.localToWorld(s.target);}
    else{s.target.set(0,id==='harpoon'?0:-.025,.34+(id==='harpoon'?-.08*gather+.10*kick-(d.harpoonCombo===2?.12*sweep:0):0)+(d.gun.userData.pump?.position.z||0));d.gun.localToWorld(s.target);}
    if(scythe||!staff&&!throwing&&!lantern&&d.kind!=='wraith')supportGripTarget(d,s.target);
    solve([d.offForearm,d.offArm],s.hand);
    if(scythe||!staff&&!throwing&&!lantern&&d.kind!=='wraith')aimSupportGrip(d,scythe?1:poseBlend*d.aimBlend);
    if(id==='shade')aimShadeGuide(d,poseBlend*d.aimBlend);
    if(bow)poseCrossbow(d.gun,T.MathUtils.clamp(d.reloadPhase??1,0,1));
  }
  if(d.kind==='wraith'){
    const page=d.gun.userData.page,focus=d.gun.userData.focus;
    if(page){page.rotation.z=Math.sin(t*2)*.07-sweep*.70;page.position.y=.12+Math.sin(t*2)*.008;
      const level=new T.Quaternion().setFromEuler(new T.Euler(.02,g.rotation.y,0));d.gun.quaternion.copy(d.gun.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(level));
    }
    if(focus)focus.scale.setScalar(.052*(1+gather*.18+Math.sin(t*3)*.035));
    fitWeaponToPalm(d.gun,GRIP_POINTS[d.weaponId]);
  }
  if(d.weaponId==='shuriken')fitWeaponToPalm(d.gun,GRIP_POINTS.shuriken);
  if(d.weaponId==='boomerang')d.gun.visible=true;
  if(d.kind==='wuling'){d.sporePod.visible=!d.shotSerial||gripMotion.podHeld;const heart=d.gun.userData.heart;if(heart)heart.scale.set(.068*(1+.035*Math.sin(t*3)),.105,.068);}
  if(d.kind==='mirage'){
    const heart=d.gun.userData.heart;heart.scale.set(.050*(1+.22*gather+.30*kick),.088*(1+.12*gather+.15*kick),.050*(1+.22*gather+.30*kick));
    for(const petal of d.gun.userData.petals){petal.quaternion.copy(petal.userData.rest);petal.rotateX(kick*.34+gather*.11);}
    const wind=d.mirageTails.userData.wind;wind.time.value=t;wind.run.value=d.blend;
    animateMirageHair(d.mirageHair,t,dt,d,relative);
    d.mirageFade+=(T.MathUtils.clamp(d.mirageConceal||0,0,1)-d.mirageFade)*(1-Math.exp(-dt*18));
    for(const surface of d.mirageSurfaces){surface.mesh.material.opacity=surface.opacity*(1-d.mirageFade*.82);surface.mesh.material.depthWrite=surface.depthWrite&&d.mirageFade<.1;surface.mesh.castShadow=surface.castShadow&&d.mirageFade<.5;}
  }
  if(d.kind==='lingya'){
    // Capture the freshly mixed/solved pose; restore it before the next frame to prevent drift.
    for(const [bone,q]of d.lingyaPoseBase)q.copy(bone.quaternion);d.lingyaPoseReady=true;
    const pose=lingyaHopPose(d.dashTime||0),relative=(d.dashAngle??g.rotation.y+Math.PI/2)-g.rotation.y,lateral=Math.sin(relative),forward=Math.cos(relative),side=lateral>=0?1:-1;
    const moving=Math.sin(d.gaitPhase*Math.PI*2)*d.blend*(1-pose.air);
    d.rig.position.y=dodge.height;d.rig.rotation.x+=pose.pitch*.45+pose.bank*forward*.4;d.rig.rotation.y=pose.twist*lateral*.4;
    d.hopBank=-pose.bank*lateral*.45;d.rig.rotation.z+=d.hopBank;
    d.spine.rotateY(-.10*gather+.04*kick-pose.twist*lateral*.8+moving*.045);d.spine.rotateX(.015*kick-.015*gather+d.presence.breath);d.spine.rotateZ(d.presence.shoulder*(1-pose.weight));d.swimHead.rotateY(.04*gather-.025*kick);
    d.swimHead.rotateZ(-moving*.02);d.swimHead.rotateX(-pose.air*.07);
    const glance=speed<.2&&d.readyBlend<.2&&Number.isFinite(d.companionAngle)?T.MathUtils.clamp(angleDelta(d.companionAngle,g.rotation.y),-.3,.3)*Math.max(0,Math.sin(t*.8)):0;d.petGlance=(d.petGlance||0)+(glance-(d.petGlance||0))*(1-Math.exp(-dt*4));d.swimHead.rotateY(d.petGlance+d.presence.look*.5);
    animateLingyaHair(d.lingyaHair,t,d.smoothedSpeed,d.carryTurn);
    if(d.satchel){d.satchel.quaternion.copy(d.satchelRest);d.satchel.rotateX(Math.sin(t*5.4)*d.blend*.035+pose.air*.13-pose.land*.08);d.satchel.rotateZ(-moving*.06-pose.bank*lateral*.45-d.carryTurn*.7);d.satchel.rotateX(-d.motionLean*.8);}
    d.aimArm.rotateZ(-pose.air*.18);d.offArm.rotateZ(pose.air*.26);d.aimArm.rotateX(-pose.air*.18*side);d.offArm.rotateX(pose.air*.18*side);d.firingForearm.rotateX(-pose.weight*.55);d.offForearm.rotateX(-pose.weight*.65);
  }
  // Continue limiting joint velocity when IK fades out; returning to idle must not snap.
  if(newHero){d.finalArmPose??=[d.aimArm,d.firingForearm,d.offArm,d.offForearm].map(b=>[b,b.quaternion.clone()]);for(const [bone,previous]of d.finalArmPose){if(d.weaponId==='boomerang'&&(bone===d.offArm||bone===d.offForearm)&&poseBlend>.99)previous.copy(bone.quaternion);else previous.rotateTowards(bone.quaternion,dt*14);bone.quaternion.copy(previous).normalize();}}
  if(d.silverHair){
    d.silverClothTurn=(d.silverClothTurn||0)+(T.MathUtils.clamp((d.turnRate||0)*.045,-.18,.18)-(d.silverClothTurn||0))*(1-Math.exp(-dt*5));
    animateSilverHair(d.silverHair,t,d.blend,d.silverClothTurn);animateTailoredCape(d.cape,t,d.blend,d.silverClothTurn);
  }
  if(d.cape){d.cape.quaternion.copy(d.restCape);d.cape.rotateX(.06+d.blend*.13+Math.sin(t*5)*.015-d.motionLean*.6+kick*.025);d.cape.rotateZ(-bank*.65-d.carryTurn*.6);d.cape.rotateX(-d.carryTurn*d.blend*.12);if(d.kind==='lingya'){const hop=lingyaHopPose(d.dashTime||0);d.cape.rotateX(hop.air*.13-hop.land*.07);}d.cape.userData.wind.time.value=t;d.cape.userData.wind.run.value=d.blend;d.cape.userData.wind.turn.value=d.carryTurn;}
  // The short coastal mantle turns with its shoulders; forcing it upright in
  // world space made the back turn through its centre during every stride.
  if(d.kind==='tide'){
    d.cape.quaternion.copy(d.restCape);d.tideCapeFall??={world:new T.Quaternion(),local:new T.Quaternion()};const fall=d.tideCapeFall;
    g.getWorldQuaternion(fall.world);d.cape.getWorldQuaternion(fall.local).invert().multiply(fall.world);
    animateTailoredCape(d.cape,t,d.blend,d.carryTurn,fall.local);
  }
  if(d.silverHair){
    // Anchor follows the shoulder, while gravity prevents chest-twist from lifting the whole cape.
    d.capeFall??={world:new T.Quaternion(),parent:new T.Quaternion(),angles:new T.Euler(0,0,0,'YXZ')};
    const fall=d.capeFall;g.getWorldQuaternion(fall.world);fall.angles.setFromQuaternion(fall.world,'YXZ');
    fall.angles.set(.035+d.blend*.10,fall.angles.y,-bank*.18-(d.silverClothTurn||d.carryTurn||0)*.12,'YXZ');fall.world.setFromEuler(fall.angles);
    d.cape.quaternion.copy(d.cape.parent.getWorldQuaternion(fall.parent).invert().multiply(fall.world));
  }
  if(d.kind==='wraith'){
    // The fitted shoulder yoke follows its actual spine attachment. Cancelling
    // that rotation turned the whole garment into a rigid floating back plate.
    const blade=d.weaponId==='shadowblade';
    for(const panel of d.shadowRobe||[]){
      panel.userData.wind.time.value=t;panel.userData.wind.run.value=d.blend;
      const sway=Math.sin(d.gaitPhase*Math.PI*2-.5)*d.blend*panel.userData.side;
      const drape=new T.Quaternion().setFromEuler(new T.Euler(.035+sway*.13,g.rotation.y,bank*.08,'YXZ'));
      panel.quaternion.copy(panel.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(drape));
    }
    d.cape.quaternion.copy(d.restCape);
    if(blade)animateTailoredCape(d.cape,t,d.blend,d.carryTurn);
    updateShadowAura(d.shadowAura,t,d.smoothedSpeed,attack||0,d.dashTime||0);
  }
  g.visible=!(hurt>0&&Math.floor(hurt*28)%2===0)&&!(d.kind==='tide'&&dodge.depth>.985);
}
export function disposeHero(g){
  if(!g?.userData.skinned)return;const d=g.userData,skeletons=new Set();d.mixer.stopAllAction();d.mixer.uncacheRoot(d.model);if(d.shadowAura)disposeShadowAura(d.shadowAura);
  g.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});for(const s of skeletons)s.dispose();for(const o of d.owned){o.geometry.dispose();o.material.dispose();}for(const material of d.mirageOwnedMaterials||[])material.dispose();
}

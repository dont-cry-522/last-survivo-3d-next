import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';

// Load the same versioned module instance used by the real actor entry point.
const worldURL=new URL('../world.js',import.meta.url);
const entry=fs.readFileSync(worldURL,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,worldURL));
before(async()=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(key=>[key,globalThis[key]]));
 try{
  globalThis.self=globalThis;
  globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};
  globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  await loadHeroAssets();
 }finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

function meshes(root){const out=[];root.traverse(o=>{if(o.isMesh)out.push(o);});return out;}
function finite(root){root.updateMatrixWorld(true);root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),o.name+' has an invalid pose'));}
function checkRig(hero){
 const d=hero.userData;assert.equal(d.skinned,true);assert.equal(d.kind,'wraith');assert.equal(d.wraith,undefined);
 assert(d.shadowAura?.parent===(d.weaponId==='shade'?d.gun:hero),'shadow presence is missing from the real actor');assert(d.model.skeleton.bones.length>50);assert(d.gun);assert(!hero.getObjectByName('wraith-tailored-tunic'));
 for(const name of ['pelvis','spine_01','Head','upperarm_r','hand_r','thigh_l','calf_l','foot_l'])assert(d.model.skeleton.bones.some(b=>b.name===name),'missing '+name);
 assert(meshes(d.model).filter(m=>m.isSkinnedMesh).length>=3,'only an isolated body fragment is skinned');finite(hero);
}

test('shadow hero uses the complete Ranger skeleton through both construction entry points',()=>{
 for(const weapon of ['shade','shadowblade','grimoire'])for(const create of [createSkinnedHero,actor]){
  const hero=create('wraith',weapon);try{checkRig(hero);assert.equal(hero.userData.weaponId,weapon);}finally{disposeHero(hero);}
 }
 const hero=createSkinnedHero('wraith','shade'),scout=createSkinnedHero('scout','rifle');
 try{
  const height=root=>{root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root.userData.model,true);return box.max.y-box.min.y;};
  const ratio=height(hero)/height(scout);assert(ratio>.9&&ratio<1.1,'shadow proportions do not match the full-sized Ranger');
  assert(height(hero)>1.75,'old short procedural silhouette returned');
 }finally{disposeHero(hero);disposeHero(scout);}
});

test('shadow skin weights remain normalized and actors retain independent poses',()=>{
 const a=createSkinnedHero('wraith','shade'),b=createSkinnedHero('wraith','shade');
 try{
  for(const body of meshes(a.userData.model).filter(m=>m.isSkinnedMesh)){
   const weights=body.geometry.attributes.skinWeight,indices=body.geometry.attributes.skinIndex;
   assert.equal(weights.count,body.geometry.attributes.position.count);assert.equal(indices.count,weights.count);
   for(let i=0;i<weights.count;i++){
    let sum=0;for(let j=0;j<4;j++){const weight=weights.getComponent(i,j),bone=indices.getComponent(i,j);assert(Number.isFinite(weight)&&weight>=0&&weight<=1);assert(Number.isInteger(bone)&&bone>=0&&bone<body.skeleton.bones.length);sum+=weight;}
    assert(Math.abs(sum-1)<1e-5,'skin weight changes the model scale');
   }
  }
  const aBones=a.userData.model.skeleton.bones,bBones=b.userData.model.skeleton.bones;
  aBones.forEach((bone,i)=>assert.notEqual(bone,bBones[i]));const before=bBones.map(bone=>bone.quaternion.toArray());
  for(let f=1;f<=90;f++)animateSkinnedHero(a,f/60,6,.15,0);
  assert(aBones.some((bone,i)=>bone.quaternion.angleTo(new T.Quaternion().fromArray(before[i]))>.1),'authored locomotion did not move the rig');
  assert.deepEqual(bBones.map(bone=>bone.quaternion.toArray()),before,'animation leaked into another actor');finite(a);finite(b);
 }finally{disposeHero(a);disposeHero(b);}
});

test('all shadow loadouts remain finite through movement, casts, dodges, swimming and settling',()=>{
 for(const weapon of ['shade','shadowblade','grimoire'])for(const fps of[20,60,120]){
  const hero=actor('wraith',weapon),d=hero.userData;checkRig(hero);
  try{
   for(let frame=1;frame<=fps*3;frame++){
    const t=frame/fps,moving=t<2;hero.rotation.y=moving?Math.sin(t*2):Math.sin(4);d.travelAngle=hero.rotation.y+(moving?.35:0);d.turnRate=moving?Math.cos(t*2)*2:0;
    d.waterDepth=moving&&t>1?.88:0;d.dashTime=t>.45&&t<.63?.63-t:0;
    d.aimActive=moving;d.reloadDuration=.8;d.reloadPhase=moving?(t%.8)/.8:1;d.shotSerial=moving?Math.floor(t/.8)+1:d.shotSerial;
    animateActor(hero,t,moving?6:0,moving?Math.max(0,.3-t%.8):0,0);finite(hero);
    if(weapon==='grimoire'){
     const up=new T.Vector3(0,1,0).applyQuaternion(d.gun.getWorldQuaternion(new T.Quaternion()));
     assert(up.y>.99,`book tips away from horizontal at ${fps} fps: ${up.y}`);
     for(const panel of d.shadowRobe){const clothUp=new T.Vector3(0,1,0).applyQuaternion(panel.getWorldQuaternion(new T.Quaternion()));assert(clothUp.y>.96,`long cloth tilts away from gravity at ${fps} fps: ${clothUp.y}`);}
    }
   }
   assert(d.smoothedSpeed<.001,'gait fails to settle after stopping');
   assert.equal(d.waterBlend,0,'water pose fails to clear after returning to land');
  }finally{disposeHero(hero);}
 }
});

test('shadow outfit materials do not recolor the existing scout or share its palette shader',()=>{
 const scout=createSkinnedHero('scout','rifle'),before=meshes(scout.userData.model).map(m=>({material:m.material,color:m.material.color.toArray(),roughness:m.material.roughness,key:m.material.customProgramCacheKey()}));
 const shadow=createSkinnedHero('wraith','shade');
 try{
  const shadowMaterials=new Set(meshes(shadow.userData.model).filter(m=>m.isSkinnedMesh).map(m=>m.material));
  for(const entry of before){assert(!entry.key.includes('shadow-ranger'),'shadow palette leaked into the scout during asset loading');assert.deepEqual(entry.material.color.toArray(),entry.color);assert.equal(entry.material.roughness,entry.roughness);assert.equal(entry.material.customProgramCacheKey(),entry.key);assert(!shadowMaterials.has(entry.material),'shadow outfit mutates a scout material');}
  const scoutCloth=new Set(before.filter(e=>e.material.name.includes('Ranger')).map(e=>e.key));
  assert([...shadowMaterials].some(m=>m.name.includes('Ranger')&&!scoutCloth.has(m.customProgramCacheKey())),'shadow outfit lost its independent palette');
 }finally{disposeHero(scout);disposeHero(shadow);}
});

test('disposing shadow actors frees only owned rig resources and preserves another actor',()=>{
 const a=createSkinnedHero('wraith','grimoire'),b=createSkinnedHero('wraith','grimoire');let disposed=false;
 const aMeshes=meshes(a),bMeshes=meshes(b),skeletons=new Set(aMeshes.filter(m=>m.isSkinnedMesh).map(m=>m.skeleton)),others=new Set(bMeshes.filter(m=>m.isSkinnedMesh).map(m=>m.skeleton));
 const shared=new Set(aMeshes.flatMap(m=>[m.geometry,m.material]).filter(resource=>bMeshes.some(m=>m.geometry===resource||m.material===resource)));let boneDisposals=0,otherDisposals=0,sharedDisposals=0,auraDisposals=0;
 a.userData.shadowAura.children[0].material.addEventListener('dispose',()=>auraDisposals++);
 const onShared=()=>sharedDisposals++;
 for(const skeleton of skeletons){skeleton.computeBoneTexture();skeleton.boneTexture.addEventListener('dispose',()=>boneDisposals++);}
 for(const skeleton of others){skeleton.computeBoneTexture();skeleton.boneTexture.addEventListener('dispose',()=>otherDisposals++);assert(!skeletons.has(skeleton));}
 for(const resource of shared)resource.addEventListener('dispose',onShared);
 try{
  assert(shared.size>0,'templates are copied instead of reusing surfaces');disposeHero(a);disposed=true;
  assert.equal(auraDisposals,1);assert.equal(b.userData.shadowAura.userData.shadowAura.disposed,false);assert.equal(boneDisposals,skeletons.size);assert.equal(otherDisposals,0);assert.equal(sharedDisposals,0);
  animateActor(b,1/60,6,.2,0);finite(b);
  for(const mesh of bMeshes.filter(m=>m.isSkinnedMesh))assert(mesh.getVertexPosition(0,new T.Vector3()).toArray().every(Number.isFinite));
 }finally{for(const resource of shared)resource.removeEventListener('dispose',onShared);if(!disposed)disposeHero(a);disposeHero(b);}
});


test('weapon forms have distinct cloth silhouettes without changing another actor',()=>{
 const forms=['shade','shadowblade','grimoire'].map(weapon=>actor('wraith',weapon));
 try{
  const size=h=>{const g=h.userData.cape.geometry;g.computeBoundingBox();return g.boundingBox.getSize(new T.Vector3());};
  const [traveller,assassin,mage]=forms.map(size);
  assert(traveller.x<assassin.x*.5,'scarf became a broad cape');
  assert(assassin.y<mage.y*.6,'short and long forms lost their silhouette difference');
  assert.equal(forms[0].userData.shadowRobe,undefined);assert.equal(forms[1].userData.shadowRobe,undefined);
  const panels=forms[2].userData.shadowRobe;assert.equal(panels.length,2);assert.equal(panels[0].parent,forms[2].userData.pelvis);assert.equal(panels[1].parent,forms[2].userData.pelvis);
  let freed=0;for(const panel of panels)for(const resource of [panel.geometry,panel.material])resource.addEventListener('dispose',()=>freed++);
  disposeHero(forms.pop());assert.equal(freed,4);
  for(const h of forms){animateActor(h,1,5,.1,0);finite(h);}
 }finally{forms.forEach(disposeHero);}
});


test('two-handed scythe palms remain on their shaft grips through all three cuts, running and pitch',()=>{
 for(const fps of[30,60,120])for(const speed of[0,6]){
  const hero=actor('wraith','shadowblade'),d=hero.userData;let time=0,maxGap=0;
  try{
   d.aimActive=true;d.reloadDuration=.69;
   for(let i=0;i<fps;i++){time+=1/fps;animateActor(hero,time,speed,0,0);}
   for(let combo=0;combo<3;combo++)for(const pitch of[-.65,0,.65]){
    d.scytheCombo=combo;d.aimAngle=d.attackAngle=.2;d.aimPitch=d.attackPitch=pitch;d.shotSerial=(d.shotSerial||0)+1;
    for(let i=0;i<fps*.7;i++){
     time+=1/fps;d.reloadPhase=Math.min(1,i/fps/.69);animateActor(hero,time,speed,.7-i/fps,0);hero.updateMatrixWorld(true);
     for(const [hand,palm,point]of[[d.support.rightHand,[-.036,.097,0],[0,-.035,.02]],[d.support.hand,[.036,.097,0],[.008,.345,.02]]]){
      const gap=hand.localToWorld(new T.Vector3(...palm)).distanceTo(d.gun.localToWorld(new T.Vector3(...point)));maxGap=Math.max(maxGap,gap);
      assert(gap<.018,`hand leaves scythe shaft: ${gap} fps=${fps} speed=${speed} combo=${combo} pitch=${pitch} frame=${i}`);
     }
    }
   }
  }finally{disposeHero(hero);}
 }
});

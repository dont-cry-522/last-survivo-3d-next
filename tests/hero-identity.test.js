import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {applyHeroIdentity,settleHeroIdentity} from '../hero-identity.js';
const entry=fs.readFileSync(new URL('../world.js',import.meta.url),'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,new URL('../world.js',import.meta.url)));
const loadouts={scout:'rifle',silver:'crossbow',wraith:'shadowblade',tide:'harpoon',lingya:'boomerang',wuling:'sporelantern',mirage:'miasmalantern'};

test('seven restrained identity fittings follow real bones and keep shared resources isolated',async t=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();
  for(const [kind,weapon]of Object.entries(loadouts))await t.test(kind+' has one attached fitting, not a stack of ornaments',()=>{
   const hero=createSkinnedHero(kind,weapon),d=hero.userData,mark=hero.getObjectByName('SM_Hero_Identity_'+kind);assert(mark,'identity is absent from the real hero integration');
   assert(mark.parent.isBone);assert.equal(mark.parent.name,kind==='scout'?'pelvis':kind==='mirage'?'Head':'spine_03');
   const markers=[];hero.traverse(o=>{if(o.userData.heroIdentity===true)markers.push(o);});assert.deepEqual(markers,[mark]);
   const pieces=[];mark.traverse(o=>{if(o.isMesh)pieces.push(o);});assert(pieces.length>0&&pieces.length<=2);
   let triangles=0;for(const m of pieces){assert(m.material.isMeshStandardMaterial);assert(m.userData.identityDetail);assert(m.castShadow&&m.receiveShadow);assert(!d.owned.includes(m));triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}
   assert(triangles<1400);hero.updateMatrixWorld(true);const box=new T.Box3().setFromObject(mark);assert(Math.max(...box.getSize(new T.Vector3()).toArray())<.14,'fitting expanded the hero silhouette');
   const location=d.model.worldToLocal(mark.getWorldPosition(new T.Vector3()));assert(Math.abs(location.x)<.24&&Math.abs(location.z)<.25,'fitting floats outside the clothing silhouette: '+JSON.stringify(location.toArray()));assert(location.y>.9&&location.y<1.9);
   const local=mark.matrix.clone(),samples=[];for(let frame=0;frame<75;frame++){d.travelAngle=.4;d.aimActive=true;animateSkinnedHero(hero,frame/60,4,frame%24<8?.2:0,0);hero.updateMatrixWorld(true);assert(mark.matrixWorld.elements.every(Number.isFinite));assert.deepEqual(mark.matrix.elements,local.elements,'fitting slipped away from its bone');samples.push(mark.getWorldPosition(new T.Vector3()));}
   assert(samples.some(p=>p.distanceTo(samples[0])>.015),'the original animation did not move the fitting');
   assert(!['hand_l','hand_r'].includes(mark.parent.name),'identity replaced a functional grip');
   if(kind==='scout')assert.equal(hero.getObjectByName('SM_Hero_Buckle_scout').visible,false);
   if(kind==='tide'){assert.equal(hero.getObjectByName('SM_Hero_Tide_CopperClasp').visible,false);assert.equal(hero.getObjectByName('SM_Hero_Tide_ShoulderRopeKnots').visible,false);}
   if(kind==='wraith')assert.equal(hero.getObjectByName('Shadow_broken_clasp').visible,false);
   if(kind==='lingya'){const old=hero.getObjectByName('Lingya_crossbody_strap').children.find(o=>Math.abs(o.position.y-1.27)<1e-5);assert.equal(old.visible,false);assert(hero.getObjectByName('Lingya_authored_face'));}
   if(kind==='mirage'){
    assert.equal(hero.getObjectByName('Mirage_flower_hairpin').visible,false);
    const hair=[];hero.traverse(o=>{if(o.userData.mirageLongHair)hair.push(o);});
    const direction=new T.Vector3(0,0,-1).applyQuaternion(mark.getWorldQuaternion(new T.Quaternion())),ray=new T.Raycaster(mark.getWorldPosition(new T.Vector3()),direction,0,.008),contact=ray.intersectObjects(hair,false)[0];
    assert(contact,'the live hair clip floats more than 8 mm from its actual animated lock');
   }
   if(kind==='wuling'){const old=hero.getObjectByName('Wuling_gathering_harness').children.filter(o=>Math.abs(o.position.x+.105)<1e-5&&o.position.y>1.39&&o.position.y<1.41);assert.equal(old.length,2);assert(old.every(o=>!o.visible));}
   const count=markers.length;applyHeroIdentity(d.model,kind);settleHeroIdentity(hero,kind);let after=0;hero.traverse(o=>{if(o.userData.heroIdentity===true)after++;});assert.equal(after,count,'identity application duplicated the fitting');
   const other=createSkinnedHero(kind,weapon),otherMark=other.getObjectByName(mark.name),otherPieces=[];otherMark.traverse(o=>{if(o.isMesh)otherPieces.push(o);});assert.notEqual(mark.parent,otherMark.parent);
   let disposed=0;pieces.forEach((m,i)=>{assert.equal(m.geometry,otherPieces[i].geometry);m.geometry.addEventListener('dispose',()=>disposed++);if(kind==='mirage'){assert.notEqual(m.material,otherPieces[i].material);const opacity=otherPieces[i].material.opacity;m.material.opacity=.2;assert.equal(otherPieces[i].material.opacity,opacity);}});
   disposeHero(hero);assert.equal(disposed,0,'actor disposal released a shared identity fitting');animateSkinnedHero(other,1,4,0,0);other.updateMatrixWorld(true);assert(otherMark.matrixWorld.elements.every(Number.isFinite));disposeHero(other);
   console.log(JSON.stringify({kind,meshes:pieces.length,triangles,animatedFrames:75,bone:mark.parent.name}));
  });
 }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {restoreMobilityPose,applyMobilityPose} from '../adventure-mobility.js';
const worldURL=new URL('../world.js',import.meta.url),entry=fs.readFileSync(worldURL,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,disposeHero}=await import(new URL(entry,worldURL));

test('Lingya shorts have two real openings and retain their weighted shape while crouching, swimming and returning to land',async()=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));let hero;
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();hero=actor('lingya','boomerang');const d=hero.userData,parts=[];hero.traverse(o=>{if(o.userData.wildMistPart)parts.push(o);});
  assert(d.skinned);assert.equal(d.cape,undefined);assert.equal(d.lingyaSkirt,undefined);
  const legs=parts.find(o=>o.userData.wildMistPart==='legs'),probe=new T.Mesh(legs.geometry,legs.material),ray=new T.Raycaster();probe.updateMatrixWorld(true);
  const hits=(x,y)=>{ray.set(new T.Vector3(x,y,.6),new T.Vector3(0,0,-1));return ray.intersectObject(probe,false);};
  assert(hits(-.12,.775).length&&hits(.12,.775).length,'both shorts legs must have fabric surfaces');assert.equal(hits(0,.775).length,0,'a skirt surface still bridges the separate leg openings');assert(hits(0,1.11).length,'the pelvis must join the shorts at the waistband');
  const point=new T.Vector3(),other=new T.Vector3(),edges=new Map();
  for(const mesh of parts){const p=mesh.geometry.attributes.position,ix=mesh.geometry.index.array,list=[],seen=new Set();for(let i=0;i<ix.length;i+=3)for(let j=0;j<3;j++){const a=ix[i+j],b=ix[i+(j+1)%3],key=a<b?a+','+b:b+','+a;if(seen.has(key))continue;seen.add(key);const rest=point.fromBufferAttribute(p,a).distanceTo(other.fromBufferAttribute(p,b));if(rest>.015)list.push([a,b,rest]);}edges.set(mesh,list);}
  for(let frame=1;frame<=180;frame++){
   const t=frame/30,swimming=frame>50&&frame<=110;d.waterDepth=swimming?.90:0;d.travelAngle=Math.sin(t)*.4;d.turnRate=Math.cos(t)*.4;d.aimActive=swimming&&frame>85;d.reloadDuration=2/3;d.reloadPhase=(t%(2/3))/(2/3);d.shotSerial=d.aimActive?1+Math.floor(t/(2/3)):0;
   restoreMobilityPose(hero);animateActor(hero,t,frame>130?0:swimming?2.5:1.5,0,0);applyMobilityPose(hero,{crouch:frame<=50?Math.sin(Math.PI*frame/50)**2:0,y:0,groundHeight:0,standHeight:1.52,landTime:0,dashTime:0});hero.updateMatrixWorld(true);
   for(const mesh of parts){for(let i=0;i<mesh.geometry.attributes.position.count;i+=7){mesh.getVertexPosition(i,point);assert(point.toArray().every(Number.isFinite));assert(point.length()<2.5,'an animated garment escaped the actor bounds');}for(const[a,b,rest]of edges.get(mesh)){mesh.getVertexPosition(a,point);mesh.getVertexPosition(b,other);assert(point.distanceTo(other)<Math.max(.18,rest*2.8),'cloth tears across a bent joint');}}
  }
  assert.equal(d.waterBlend,0,'returning to land leaves the swimming pose active');assert(!d.mobilityPose?.active,'crouch offset was not restored');
 }finally{if(hero)disposeHero(hero);for(const[k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});

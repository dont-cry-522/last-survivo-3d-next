import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
const entry=fs.readFileSync(new URL('../world.js',import.meta.url),'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,new URL('../world.js',import.meta.url)));

test('Lingya short mantle stays behind the real animated coat without a hollow wraparound bowl',async()=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));let hero,probe;
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();hero=createSkinnedHero('lingya','boomerang');const d=hero.userData,cape=d.cape,body=d.model.getObjectByName('Female_Ranger_Body'),p=cape.geometry.attributes.position,uv=cape.geometry.attributes.uv;
  assert.equal(cape.name,'SM_Hero_Cape_Lingya');assert(d.owned.includes(cape));assert.equal(cape.parent.name,'spine_03');
  // Every authored row crosses the back once: it cannot turn around the torso
  // into the old bell profile, even if a later pose rotates the shoulder joint.
  for(let row=0;row<29;row++)for(let col=1;col<25;col++)assert(p.getX(row*25+col)>p.getX(row*25+col-1));
  const restBounds=cape.geometry.boundingBox;assert(restBounds.max.x-restBounds.min.x<.365);assert(restBounds.max.y-restBounds.min.y<.31);assert(restBounds.max.z-restBounds.min.z<.13);
  const geometry=body.geometry.clone(),positions=geometry.attributes.position,point=new T.Vector3(),forward=new T.Vector3(),origin=new T.Vector3(),ray=new T.Raycaster(),triangle=new T.Triangle(),closest=new T.Vector3(),indices=geometry.index.array;probe=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));probe.matrixAutoUpdate=false;
  let checked=0,min=Infinity,maxSurface=0;
  for(let frame=0;frame<180;frame++){
   d.travelAngle=.35*Math.sin(frame/36);d.turnRate=.8*Math.cos(frame/36);d.aimActive=frame>=50;d.reloadDuration=2/3;d.reloadPhase=(frame%40)/40;d.shotSerial=1+Math.floor(frame/40);d.attackAge=(frame%40)/60;
   const speed=frame<30?0:frame<100?4:2;animateSkinnedHero(hero,frame/60,speed,frame%40<8?.25:0,0);hero.updateMatrixWorld(true);
   if(frame%9)continue;
   for(let i=0;i<positions.count;i++){body.getVertexPosition(i,point).applyMatrix4(body.matrixWorld);positions.setXYZ(i,point.x,point.y,point.z);}geometry.computeBoundingBox();geometry.computeBoundingSphere();probe.updateMatrixWorld(true);forward.set(0,0,1).transformDirection(cape.matrixWorld);
   for(let i=0;i<p.count;i+=3){if(uv.getY(i)<.10||uv.getY(i)>.94)continue;point.fromBufferAttribute(p,i);
    // Cover both ends of the tiny shader sway rather than assuming the CPU
    // vertices are the rendered surface. Z wind only moves away from the coat.
    const hem=T.MathUtils.clamp(-point.y/.30,0,1);point.x+=(.004+Math.abs(d.carryTurn||0)*.025)*hem*hem;
    cape.localToWorld(point);origin.copy(point).addScaledVector(forward,-1);ray.set(origin,forward);const hit=ray.intersectObject(probe,false)[0];if(!hit)continue;
    min=Math.min(min,hit.distance-1);checked++;
    // At a turned shoulder a forward ray can exit the front of the torso;
    // nearest real triangles measure separation without mistaking torso depth
    // for a floating cape. Ray clearance above separately detects penetration.
    let distance=Infinity;for(let k=0;k<indices.length;k+=3){triangle.a.fromBufferAttribute(positions,indices[k]);triangle.b.fromBufferAttribute(positions,indices[k+1]);triangle.c.fromBufferAttribute(positions,indices[k+2]);triangle.closestPointToPoint(point,closest);distance=Math.min(distance,point.distanceToSquared(closest));}maxSurface=Math.max(maxSurface,Math.sqrt(distance));
   }
  }
  console.log('Lingya mantle animated coat clearance',{checked,min,maxSurface});assert(checked>1000,'clearance probe missed the real coat');assert(min>=-.001,'mantle passes through the animated coat');assert(maxSurface<.07,'mantle floats away from the coat');
  const second=createSkinnedHero('lingya','boomerang');try{const other=second.userData.cape;assert.notEqual(cape.geometry,other.geometry);assert.notEqual(cape.material,other.material);assert.deepEqual(p.array,other.geometry.attributes.position.array);p.setX(0,p.getX(0)+.01);assert.notEqual(p.getX(0),other.geometry.attributes.position.getX(0),'fit cache exposes mutable shared geometry');}finally{disposeHero(second);}
 }finally{if(probe){probe.geometry.dispose();probe.material.dispose();}if(hero)disposeHero(hero);for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

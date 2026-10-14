import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {actor} from '../world.js';
import {animateRegionalAppearance} from '../regional-enemy-appearance.js';

const grounded=['snowhare','frostwolf','emberling','ashstalker','yeti','lavabrute'];
const all=[...grounded,'icewitch','ashseer','snowtotem','cinderwisp'];
const meshes=g=>{const parts=[];g.traverse(o=>{if(o.isMesh)parts.push(o);});return parts;};

test('regional shoulders and hips remain buried inside the actual torso throughout gait and attack',()=>{
 for(const id of grounded){
  const g=actor(id),d=g.userData,source=d.regionalRoot.getObjectByName('SM_Enemy_'+id+'_Body'),body=new T.Mesh(source.geometry,source.material);
  body.updateMatrixWorld(true);
  for(const attacking of [false,true])for(let i=0;i<96;i++){
   d.previousAttack=attacking?.5:0;
   animateRegionalAppearance(d,i/60,1,i/96*Math.PI*2,attacking?i/96:0,0,0);
   for(const leg of [...d.legs,...(d.knuckles||[])]){
    const p=leg.joint.position,side=Math.sign(p.x),hit=new T.Raycaster(new T.Vector3(side*2,p.y,p.z),new T.Vector3(-side,0,0)).intersectObject(body)[0];
    assert(hit,id+' shoulder or hip moved beyond the torso');
    assert(Math.abs(hit.point.x)-Math.abs(p.x)>.018,id+' limb pivot sits on the skin and exposes its cap during rotation');
   }
  }
 }
});

test('frostwolf soft ears bend above a fixed base and use shared immutable position and normal targets',()=>{
 const a=actor('frostwolf'),b=actor('frostwolf'),d=a.userData,ear=d.ears[0].userData.softEar.mesh,other=b.userData.ears[0].userData.softEar.mesh,geometry=ear.geometry;
 assert.equal(geometry,other.geometry);assert.equal(ear.material,other.material);assert.notEqual(ear.morphTargetInfluences,other.morphTargetInfluences);assert(!ear.isSkinnedMesh);assert(ear.castShadow&&ear.receiveShadow);
 const p=geometry.attributes.position,n=geometry.attributes.normal,rest=p.array.slice(),normals=n.array.slice(),base=new T.Vector3(),flexed=new T.Vector3();
 let tip=0,lag=0;
 for(let frame=0;frame<120;frame++){
  animateRegionalAppearance(d,frame/60,1,frame/60*8,0,0,0);
  lag=Math.max(lag,Math.abs(ear.morphTargetInfluences[0]-ear.morphTargetInfluences[1]));
  for(let i=0;i<p.count;i++){
   base.fromBufferAttribute(p,i);ear.getVertexPosition(i,flexed);
   if(base.y<.07)assert(base.distanceTo(flexed)<1e-8,'soft ear detached at its root');
   if(base.y>.22)tip=Math.max(tip,base.distanceTo(flexed));
  }
 }
 assert(tip>.003,'ear tip remained rigid');assert(lag>.04,'ear tip moved in lockstep with the base');
 assert.deepEqual(other.morphTargetInfluences,[0,0]);assert.deepEqual(p.array,rest);assert.deepEqual(n.array,normals);
});

test('low ashstalker crawl keeps overlapping supports while frostwolf retains diagonal trot',()=>{
 const crawl=actor('ashstalker').userData,trot=actor('frostwolf').userData;let threeFeet=0,twoFeet=0;
 for(let i=0;i<120;i++){
  const phase=i/120*Math.PI*2;animateRegionalAppearance(crawl,i/60,1,phase,0,0,0);animateRegionalAppearance(trot,i/60,1,phase,0,0,0);
  const crawling=crawl.legs.filter(l=>l.planted).length,trotting=trot.legs.filter(l=>l.planted).length;
  assert(crawling>=2,'crawler loses opposing support');assert(trotting===2||trotting===4,'wolf diagonal pairs separated');
  if(crawling===3)threeFeet++;if(trotting===2)twoFeet++;
 }
 assert(threeFeet>50,'crawler never transfers weight one foot at a time');assert(twoFeet>70,'wolf lost its diagonal trot');
});

test('all ten regional templates retain full normal buffers and bounded shared geometry',()=>{
 let calls=0,triangles=0;
 for(const id of all){
  const a=meshes(actor(id)),b=meshes(actor(id));
  a.forEach((m,i)=>{
   const g=m.geometry,p=g.attributes.position;assert.equal(g,b[i].geometry);assert.equal(m.material,b[i].material);
   for(const key of ['normal','color']){assert.equal(g.attributes[key].count,p.count,id+' has a truncated '+key+' buffer');assert(g.attributes[key].array.every(Number.isFinite));}
   for(const key of ['position','normal'])for(const target of g.morphAttributes[key]||[]){assert.equal(target.count,p.count,id+' has a truncated morph buffer');assert(target.array.every(Number.isFinite));}
   triangles+=(g.index?.count||p.count)/3;calls++;
  });
 }
 assert.equal(calls,128,'anatomy or soft ears added draw calls');assert(triangles<43000,'regional anatomy exceeded its established triangle budget');
});

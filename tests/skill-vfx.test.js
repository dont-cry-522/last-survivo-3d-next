import{test}from'node:test';
import assert from'node:assert/strict';
import*as T from'../vendor/three.module.js';
import{SkillVFX}from'../skill-vfx.js';
import{WEAPONS,WEAPON_PATHS,weaponStats}from'../rules.js';

test('flames retain volume from every horizontal viewing direction without extra draws or lingering particles',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true}),g=v.geometry.flame,p=g.attributes.position;
 assert(g.index.count/3<=18);assert.equal(g.groups.length,0);assert.equal(g.attributes.uv.count,p.count);
 for(let a=0;a<Math.PI*2;a+=Math.PI/12){let lo=Infinity,hi=-Infinity;for(let i=0;i<p.count;i++){const x=p.getX(i)*Math.cos(a)+p.getZ(i)*Math.sin(a);lo=Math.min(lo,x);hi=Math.max(hi,x);}assert(hi-lo>1.6,'flame collapses into an edge');}
 v.fire(0,0,2,true);const count=v.active.length;v.update(.18);
 const flame=v.active.find(p=>p.shape==='flame');assert(flame);assert(flame.mesh.scale.z<=flame.mesh.scale.x);assert(v.active.length<=count);
 const pose=flame.mesh.matrix.clone(),position=flame.mesh.position.clone(),life=flame.life;v.update(0);assert.equal(flame.life,life);assert(flame.mesh.position.equals(position));assert(flame.mesh.matrix.equals(pose));
 v.clear();assert.equal(v.scene.children.length,0);assert(v.active.length+v.pool.length<=110);
});

test('elemental impacts have a readable core and distinct secondary shapes',()=>{
 const vfx=new SkillVFX(new T.Scene(),{mobile:true});
 for(const [name,cast,shapes]of [
  ['fire',()=>vfx.fire(0,0,2,true),['flame','veil']],
  ['ice',()=>vfx.ice(0,0,5),['crystal','ray','veil']],
  ['storm',()=>vfx.lightning(0,0,2,1,true),['ray','ember']],
  ['dark',()=>vfx.dark(0,0,2,true),['crystal','veil']]
 ]){
  vfx.clear();cast();for(const shape of shapes)assert(vfx.active.some(p=>p.shape===shape),`${name} lacks ${shape}`);
  assert(!vfx.active.some(p=>['ring','disc'].includes(p.shape)),name+' must not draw hard-edged circles');
  assert(vfx.active.length<=vfx.limit);for(const p of vfx.active){assert(p.life>0&&p.life<=1);assert(p.mesh.position.toArray().every(Number.isFinite));}
 }
 for(let i=0;i<90;i++)vfx.update(1/60);assert.equal(vfx.active.length,0);
});
test('ordinary fire and dark hits do not draw range circles',()=>{const vfx=new SkillVFX(new T.Scene());vfx.fire(0,0,1);vfx.dark(0,0,1);assert(!vfx.active.some(p=>p.shape==='ring'));});
test('new weapon contacts keep distinct small silhouettes and remain pooled during a melee crowd',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true});for(const kind of ['shield','hammer','harpoon','boomerang']){v.clear();v.weaponContact(kind,0,0,.4,2);assert(v.active.some(p=>p.shape===(kind==='shield'?'crystal':kind==='hammer'?'stone':'sweep')));assert(!v.active.some(p=>['ring','disc'].includes(p.shape)));}
 for(let i=0;i<600;i++){for(const kind of ['shield','hammer','harpoon','boomerang'])v.weaponContact(kind,0,0,.4,2);v.update(1/60);assert(v.active.length+v.pool.length<=110);}v.update(2);assert.equal(v.active.length,0);
});
test('erupting ice stays rooted and grows before sinking without a spawn-frame pop',()=>{
 const v=new SkillVFX(new T.Scene());v.ice(0,0,4);const p=v.active.find(p=>p.shape==='shard'),base=p.mesh.position.clone(),start=p.mesh.scale.y;
 const positions=p.mesh.geometry.getAttribute('position');for(let i=0;i<positions.count;i++)assert(positions.getY(i)>=0,'geometry must grow from its base');
 v.update(p.max*.25);const peak=p.mesh.scale.y;assert(peak>start*10);assert(p.mesh.position.equals(base));v.update(p.max*.6);assert(p.mesh.scale.y<peak*.5);assert(p.mesh.position.equals(base));v.update(1);assert.equal(v.active.length,0);
});
test('reused meshes reset faceted shading, texture, rotation and erupt animation',()=>{
 const v=new SkillVFX(new T.Scene());const old=v.particle('shard',0xffffff,0,0,0,{motion:'erupt',size:[1,2,1],spin:4});assert(old.material.vertexColors);old.rotation.set(1,2,3);v.clear();
 const reused=v.particle('ember',0xff0000,2,3,4,{size:[1,1,1]});assert.equal(old,reused);assert.equal(reused.material.vertexColors,false);assert.equal(reused.material.map,null);assert.deepEqual(reused.rotation.toArray().slice(0,3),[0,0,0]);v.update(.1);assert.equal(reused.scale.x,reused.scale.y);assert.equal(v.active[0].motion,'');
});
test('lightning cores remain visible through a full mobile elemental combo',()=>{const vfx=new SkillVFX(new T.Scene(),{mobile:true});vfx.ice(0,0,5);for(let i=0;i<5;i++)vfx.lightning(i*2,0,(i+1)*2,0,i===0);assert(vfx.active.length<=vfx.limit);assert(vfx.active.filter(p=>p.shape==='ray'&&p.mesh.material.color.getHex()===0xe1f4ff).length>=35,'some lightning cores disappeared at the particle cap');});
test('mobile effects expire and reuse their pool through three minutes of casting',()=>{const scene=new T.Scene(),vfx=new SkillVFX(scene,{mobile:true});for(let frame=0;frame<10800;frame++){if(frame%36===0)vfx.fire(0,0,2,true);if(frame%47===0)vfx.ice(0,0,5);if(frame%23===0)vfx.lightning(0,0,2,1,true);if(frame%29===0)vfx.dark(0,0,2,true);vfx.update(1/60);assert(vfx.active.length<=vfx.limit);assert.equal(scene.children.length,vfx.active.length);assert(vfx.active.length+vfx.pool.length<=vfx.limit);}for(let frame=0;frame<90;frame++)vfx.update(1/60);assert.equal(vfx.active.length,0);assert.equal(scene.children.length,0);});


test('directional blade impacts and shadow spells stay bounded and expire on mobile',()=>{
 const scene=new T.Scene(),vfx=new SkillVFX(scene,{mobile:true});
 for(let frame=0;frame<900;frame++){
  if(frame%15===0){vfx.bladeImpact(0,0,.7,true);vfx.bladeImpact(2,1,-.4,false);}
  if(frame%90===0){vfx.shadowSpell('veil',0,0);vfx.shadowSpell('chain',0,0,[{x:3,z:2},{x:-2,z:4},{x:1,z:-4}]);vfx.riftCast(0,2,3,.8,true);}
  vfx.update(1/60);assert(vfx.active.length<=110);assert(vfx.pool.length+vfx.active.length<=110);
  for(const p of vfx.active){assert(p.mesh.matrix.elements.every(Number.isFinite));assert(p.mesh.position.toArray().every(Number.isFinite));}
 }
 for(let i=0;i<180;i++)vfx.update(1/60);assert.equal(scene.children.length,0);
});

test('new hero skill effects stay bounded, finite and free of hard circles',()=>{const scene=new T.Scene(),vfx=new SkillVFX(scene,{mobile:true});const kinds=['faultAim','surgeAim','faultPrime','snareMark','saltWake','fault','landing','reprisal','surge','wake','brine','brineMark','briarSet','briarIdle','briar','bond','care','mine','mineBlast','counter','slug','slugHit','volley','rainAim','rain','trail','pursuit','echo','echoHit','soul','spikeAim','spikes'];for(let frame=0;frame<600;frame++){if(frame%15===0)for(const kind of kinds)vfx.skill({kind,x:0,z:0,x2:3,z2:4,angle:.4,armed:true});vfx.update(1/60);assert(vfx.active.length+vfx.pool.length<=110);for(const p of vfx.active){assert(p.mesh.position.toArray().every(Number.isFinite));assert(!['ring','disc'].includes(p.shape));}}for(let i=0;i<180;i++)vfx.update(1/60);assert.equal(vfx.active.length,0);assert.equal(scene.children.length,0);});


test('pair feedback is visible individually and charged stone and claws differ from baseline',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true});for(const kind of ['faultAim','surgeAim','faultPrime','snareMark','saltWake']){v.clear();v.skill({kind,x:0,z:0,angle:.2,delay:.26});assert(v.active.length>0,kind);assert(v.active.some(p=>p.priority===1));v.update(1);assert.equal(v.active.length,0);}
 v.skill({kind:'fault',x:0,z:0});const height=v.active.find(p=>p.shape==='stone').size[1];v.clear();v.skill({kind:'fault',x:0,z:0,charged:true});assert(v.active.find(p=>p.shape==='stone').size[1]>height);
 v.clear();v.skill({kind:'bond',x:0,z:0,linked:true});assert(v.active.some(p=>p.shape==='crystal'));assert(v.active.some(p=>p.priority===1));
});

test('gun contacts distinguish hard fragments from soft puffs and stay within the mobile pool',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true});
 for(const [texture,shape]of [['stone','stone'],['wood','crystal'],['ice','crystal'],['wet','smoke'],['growl','smoke']]){v.clear();v.enemyContact(texture,0x99aa88,1,2,.5,true);assert(v.active.some(p=>p.shape===shape));assert(!v.active.some(p=>p.shape==='waterArc'));assert(v.active.every(p=>p.max<=.24));}
 for(let i=0;i<180;i++){for(let j=0;j<10;j++)v.enemyContact('stone',0xaabbcc,0,0,0,true);v.update(1/60);assert(v.active.length+v.pool.length<=110);}v.update(1);assert.equal(v.active.length,0);
});

test('projectiles retain shared geometry and materials while ranged paths have distinct compact silhouettes',()=>{
 const v=new SkillVFX(new T.Scene()),variants=new Map();
 for(const pathId of [null,...Object.keys(WEAPON_PATHS)]){
  const ids=pathId?[WEAPON_PATHS[pathId].weapon]:Object.keys(WEAPONS);
  for(const id of ids){
   const w={...weaponStats({weaponId:id,weaponPath:pathId?{id:pathId,rank:3}:null}),pathId,pathRank:pathId?3:0},a=v.projectile(w),b=v.projectile(w),parts=[],copies=[];
   a.updateMatrixWorld(true);a.traverse(m=>{assert(m.matrixWorld.elements.every(Number.isFinite),id);if(m.isMesh)parts.push(m);});b.traverse(m=>{if(m.isMesh)copies.push(m);});assert(parts.length>0,id);
   if(id!=='boomerang')for(let i=0;i<parts.length;i++){assert.equal(parts[i].geometry,copies[i].geometry);assert.equal(parts[i].material,copies[i].material);}
   if(['rifle','shotgun'].includes(id)){const box=new T.Box3().setFromObject(a),size=box.getSize(new T.Vector3());assert(size.x<=w.hitRadius*2&&size.y<=w.hitRadius*2,id+' suggests a wider collision');}
   if(pathId){const signature=parts.map(m=>[m.geometry.type,m.material.color.getHex(),...m.scale.toArray(),...m.position.toArray()]);if(!variants.has(id))variants.set(id,[]);variants.get(id).push(signature);}
  }
 }
 for(const id of ['rifle','shotgun','fire','crossbow','shuriken','dark','shade','shadowblade'])assert.notDeepEqual(...variants.get(id),id+' paths should differ without widening the hitbox');
});

test('weapon launch and flight effects remain sparse and reuse the mobile and desktop pool',()=>{
 for(const mobile of [true,false]){
  const scene=new T.Scene(),v=new SkillVFX(scene,{mobile}),shots=Object.entries(WEAPON_PATHS).map(([pathId,{weapon}])=>{
   const w={...weaponStats({weaponId:weapon,weaponPath:{id:pathId,rank:3}}),pathId,pathRank:3};return {w,b:{mesh:v.projectile(w),kind:weapon,pathId,pathRank:3,x:1,z:2,vx:12,vz:8,height:weapon==='boomerang'?.7:1.15,trail:0,elapsed:0}};
  });
  for(const {w,b}of shots){v.clear();v.muzzle(w,1,2,.4);assert(v.active.length<=3,w.id+' launch is too busy');v.clear();v.flight(b,1/60);assert(v.active.length<=2,w.id+' trail is too busy');assert(v.active.every(p=>p.max<=.3));}
  v.clear();
  for(let frame=0;frame<600;frame++){
   for(const {w,b}of shots){if(frame%18===0)v.muzzle(w,1,2,.4);b.elapsed+=1/60;b.returning=frame%120>60;v.flight(b,1/60);}
   v.update(1/60);assert(v.active.length+v.pool.length<=v.limit);assert.equal(scene.children.length,v.active.length);
   for(const p of v.active){assert(p.mesh.position.toArray().every(Number.isFinite));assert(p.mesh.quaternion.toArray().every(Number.isFinite));assert(!['ring','disc','waterArc'].includes(p.shape));}
  }
  v.update(1);assert.equal(v.active.length,0);assert.equal(scene.children.length,0);
 }
});

test('harpoon and returning bone fragments follow the strike direction',()=>{
 const v=new SkillVFX(new T.Scene());
 for(const kind of ['harpoon','boomerang'])for(const combo of [0,2]){
  v.weaponContact(kind,0,0,0,combo);const front=v.active.filter(p=>p.shape==='crystal').map(p=>[...p.velocity]);v.clear();
  v.weaponContact(kind,0,0,Math.PI/2,combo);const right=v.active.filter(p=>p.shape==='crystal');
  for(let i=0;i<front.length;i++){assert(Math.abs(right[i].velocity[0]-front[i][2])<1e-8);assert(Math.abs(right[i].velocity[2]+front[i][0])<1e-8);}v.clear();
 }
});

test('staged material effects use game time, consume only delay overshoot and clear before onset',()=>{
 const scene=new T.Scene(),v=new SkillVFX(scene,{mobile:true}),m=v.particle('vapor',0xffffff,1,2,3,{delay:.1,life:.4,velocity:[2,0,0],endColor:0x222222}),p=v.active[0];
 assert.equal(m.visible,false);v.update(.05);const remaining=p.life;v.update(0);assert.equal(p.life,remaining);assert.equal(m.visible,false);assert.equal(m.position.x,1);
 v.update(.1);assert.equal(m.visible,true);assert(Math.abs(p.life-.35)<1e-9);assert(Math.abs(m.position.x-1.1)<1e-9,'only time after onset may move the plume');
 v.clear();const delayed=v.particle('shard',0xffffff,0,0,0,{delay:.2,motion:'erupt'});assert.equal(delayed.visible,false);v.clear();const reused=v.particle('ember',0xff0000,0,0,0);assert.equal(delayed,reused);assert.equal(reused.visible,true);assert.equal(v.active[0].endColor,null);assert.equal(v.active[0].delay,0);assert.equal(scene.children.length,1);
 v.update(2);assert.equal(scene.children.length,0);assert.equal(v.active.length,0);
});

test('elemental phases retain core priority and finite geometry through coarse and paused updates',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true});
 v.fire(0,0,3,true);v.ice(6,0,3);v.dark(0,6,3,true);v.lightning(5,6,6,6,true);
 assert(v.active.some(p=>p.delay>0&&!p.mesh.visible),'outer fractures and vapour should follow the contact');
 const before=v.active.map(p=>[p.life,p.delay,...p.mesh.position.toArray()]);v.update(0);assert.deepEqual(v.active.map(p=>[p.life,p.delay,...p.mesh.position.toArray()]),before);
 for(const dt of [.016,.033,.09,.15,.20,.4]){v.update(dt);for(const p of v.active){assert(p.mesh.scale.toArray().every(n=>Number.isFinite(n)&&n>=0));assert(p.mesh.material.color.toArray().every(Number.isFinite));assert(p.mesh.material.opacity>=0&&p.mesh.material.opacity<=1);assert(p.delay>=0);}}
 assert.equal(v.active.length,0);assert(v.pool.length<=110);
});

test('flat effects render both faces in one pass and recycled solid fragments restore volume passes',()=>{
 const v=new SkillVFX(new T.Scene());let mesh;
 for(const shape of ['flame','veil','vapor','crest','sweep','claw','waterArc']){
  mesh=v.particle(shape,0xffffff,0,0,0);assert.equal(mesh.material.forceSinglePass,true,shape);assert.equal(mesh.material.side,T.DoubleSide);v.clear();
  const solid=v.particle('shard',0xffffff,0,0,0);assert.equal(solid,mesh);assert.equal(solid.material.forceSinglePass,false);assert.equal(solid.material.side,T.DoubleSide);v.clear();
 }
 for(const id of ['fire','miasmalantern']){const projectile=v.projectile({id});projectile.traverse(part=>{if(part.isMesh&&part.geometry.type==='PlaneGeometry')assert.equal(part.material.forceSinglePass,true,id+' planar aura');});}
});

test('fire contact expires before flying cinders, without adding to the large burst budget',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true});v.fire(0,0,2.5,true);
 assert(v.active.length<=26);
 const flash=v.active.find(p=>p.shape==='flame'&&p.max<=.12),cinders=v.active.filter(p=>p.shape==='crystal');
 assert(flash&&cinders.length>0);assert(cinders.every(p=>p.size[1]>p.size[0]*4&&p.gravity>0&&p.endColor));
 const start=cinders.map(p=>p.mesh.position.clone());v.update(.2);
 assert(!v.active.includes(flash));assert(cinders.every((p,i)=>v.active.includes(p)&&p.mesh.position.distanceTo(start[i])>.1));
 v.update(.8);assert.equal(v.active.length,0);
});

test('ice glints follow actual shard edges and fracture after emergence rather than adding a fog layer',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true});v.ice(0,0,3);
 assert(v.active.length<=43);assert.equal(v.active.filter(p=>p.shape==='vapor').length,2);
 const shards=v.active.filter(p=>p.shape==='shard'),edges=v.active.filter(p=>p.shape==='ray'&&p.delay>=.16);
 assert.equal(edges.length,6);
 for(const edge of edges){
  assert(!edge.mesh.visible);assert(edge.size[0]<=.012);
  const tip=new T.Vector3(0,edge.mesh.scale.y/2,0).applyQuaternion(edge.mesh.quaternion).add(edge.mesh.position);
  assert(shards.some(p=>tip.distanceTo(new T.Vector3(0,p.size[1]*2,0).applyEuler(p.mesh.rotation).add(p.mesh.position))<1e-7),'the highlight must end at a real crystal tip');
 }
 const chips=v.active.filter(p=>p.shape==='crystal');assert(chips.every(p=>p.delay>=.16&&!p.mesh.visible));
 v.update(.28);assert(chips.every(p=>p.mesh.visible));v.update(1);assert.equal(v.active.length,0);
});

test('lightning uses a short thin contact and delayed forks within its existing budget',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true});v.lightning(0,0,2,1,true);
 assert(v.active.length<=37);
 const cores=v.active.filter(p=>p.priority===2),forks=v.active.filter(p=>p.delay>0),contact=v.active.filter(p=>p.max<=.075);
 assert.equal(cores.length,7);assert(cores.every(p=>p.size[0]<=.018&&p.max<=.1));
 assert.equal(forks.length,4);assert(forks.every(p=>p.size[0]<=.017&&!p.mesh.visible));assert.equal(contact.length,2);
 v.update(.08);assert(contact.every(p=>!v.active.includes(p)));assert(forks.every(p=>p.mesh.visible));v.update(1);assert.equal(v.active.length,0);
});

test('shadow marks and rifts keep dark cores and narrow bright tears instead of luminous balls',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true});
 for(const strong of[false,true]){
  v.clear();v.shadowMark(0,0,strong);assert(v.active.length<=(strong?9:3));assert(!v.active.some(p=>p.shape==='ember'||p.shape==='smoke'));
  const core=v.active.find(p=>p.shape==='claw');assert(core);assert.equal(core.mesh.material.blending,T.NormalBlending);assert(core.mesh.material.color.r<.02);
  assert.equal(v.active.filter(p=>p.shape==='ray').length,2);
 }
 v.clear();v.riftCast(0,0,2,.7,false);assert.equal(v.active.length,6);assert(v.active.every(p=>p.shape==='ray'));
 v.clear();v.riftCast(0,0,2,.7,true);assert(v.active.length<=20);
 const bodies=v.active.filter(p=>p.shape==='claw'&&p.opacity===.82),rims=v.active.filter(p=>p.shape==='claw'&&p.delay>0);
 assert.equal(bodies.length,3);assert.equal(rims.length,3);assert(rims.every(p=>p.size[0]<bodies[0].size[0]/4));
 v.update(1);assert.equal(v.active.length,0);assert.equal(v.scene.children.length,0);
});

test('point impacts use the supplied surface and height without retaining or mutating contact objects',()=>{
 const v=new SkillVFX(new T.Scene()),casts=[c=>v.enemyContact('stone',0x9ba488,-5,-6,.4,true,c),c=>v.bladeImpact(-5,-6,.4,true,c),c=>v.boltImpact(-5,-6,true,.4,c),c=>v.weaponContact('harpoon',-5,-6,.4,1,c)];
 for(const y of[.08,1.7,4.6])for(const cast of casts){
  const contact=Object.freeze({x:7,y,z:9,normal:Object.freeze({x:0,y:0,z:-1}),direction:Object.freeze({x:0,y:-.3,z:1}),compact:true});
  v.clear();cast(contact);assert(v.active.length>0&&v.active.length<=6);
  for(const p of v.active){assert(Math.abs(p.mesh.position.x-7)<.25);assert(Math.abs(p.mesh.position.y-y)<.25);assert(Math.abs(p.mesh.position.z-9)<.1);assert(!['ring','disc','veil','vapor','ember'].includes(p.shape));assert.equal(p.mesh.material.depthTest,true);assert.equal(p.mesh.material.depthWrite,false);assert.equal(p.mesh.material.blending,T.NormalBlending);}
  const pose=v.active.map(p=>[p.life,...p.mesh.position.toArray()]),rotations=v.active.map(p=>p.mesh.quaternion.clone());v.update(0);assert.deepEqual(v.active.map(p=>[p.life,...p.mesh.position.toArray()]),pose);v.active.forEach((p,i)=>assert(p.mesh.quaternion.angleTo(rotations[i])<1e-7));
 }
 for(const cast of casts){v.clear();cast({y:2.3,normal:{x:NaN,y:0,z:0},direction:{x:0,y:0,z:0}});assert(v.active.every(p=>p.mesh.position.toArray().every(Number.isFinite)&&p.mesh.quaternion.toArray().every(Number.isFinite)));}
});

test('pitched impacts lie over a horizontal contact surface and compact feedback covers less screen space',()=>{
 const v=new SkillVFX(new T.Scene()),contact={x:2,y:.1,z:3,normal:{x:0,y:1,z:0},direction:{x:0,y:-1,z:0}};
 for(const compact of[false,true]){
  v.clear();v.weaponContact('harpoon',0,0,0,1,{...contact,compact});
  const sheet=v.active.find(p=>p.shape==='sweep'),normal=new T.Vector3(0,0,1).applyQuaternion(sheet.mesh.quaternion);
  assert(normal.distanceTo(new T.Vector3(0,1,0))<1e-7,'sweep must lie against the hit surface, not the world ground convention');
  for(const p of v.active.filter(p=>p.shape==='crystal'))assert(p.velocity[1]>0,'fragments must leave the surface');
 }
 const casts=[c=>v.enemyContact('stone',0xaabbcc,0,0,0,true,c),c=>v.bladeImpact(0,0,0,false,c),c=>v.boltImpact(0,0,true,0,c),c=>v.weaponContact('harpoon',0,0,0,1,c)];
 for(const cast of casts){
  v.clear();cast(contact);const large=new T.Box3().setFromObject(v.scene).getSize(new T.Vector3()).length(),count=v.active.length;
  v.clear();cast({...contact,compact:true});const small=new T.Box3().setFromObject(v.scene).getSize(new T.Vector3()).length();
  assert(small<large*.75);assert(v.active.length<=count);assert(v.active.every(p=>p.max<=.28));
 }
});

test('harpoon thrust and sweep have distinct compact contact traces and recycle without leaking orientation',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true}),contact={x:1,y:2,z:3,normal:{x:.6,y:.8,z:0},compact:true};
 v.weaponContact('harpoon',0,0,0,0,contact);assert.equal(v.active.filter(p=>p.shape==='ribbon').length,1);assert.equal(v.active.filter(p=>p.shape==='sweep').length,2);assert(v.active.some(p=>p.shape==='droplet'));assert(!v.active.some(p=>p.shape==='ray'));
 v.clear();v.weaponContact('harpoon',0,0,0,1,contact);assert.equal(v.active.filter(p=>p.shape==='sweep').length,1);assert(!v.active.some(p=>p.shape==='ray'));
 for(let frame=0;frame<180;frame++){for(let combo=0;combo<3;combo++)v.weaponContact('harpoon',0,0,frame*.05,combo,contact);v.enemyContact('stone',0xaabbcc,0,0,0,true,contact);v.update(1/60);assert(v.active.length+v.pool.length<=110);}
 v.update(1);assert.equal(v.active.length,0);const reused=v.particle('ember',0xffffff,0,0,0);assert.deepEqual(reused.rotation.toArray().slice(0,3),[0,0,0]);
});

test('shadow point marks follow elevated or low surfaces while omitted contacts keep legacy spell marks',()=>{
 const v=new SkillVFX(new T.Scene()),pose=()=>v.active.map(p=>[p.shape,...p.mesh.position.toArray(),...p.mesh.quaternion.toArray(),p.size,p.velocity,p.max]);
 for(const strong of[false,true]){
  v.clear();v.shadowMark(1,2,strong);const legacy=pose();v.clear();v.shadowMark(1,2,strong,undefined);assert.deepEqual(pose(),legacy);
  for(const y of[.1,3.6]){
   v.clear();const contact=Object.freeze({x:5,y,z:-4,normal:Object.freeze({x:1,y:0,z:0}),compact:true});v.shadowMark(1,2,strong,contact);
   assert(v.active.length<=(strong?6:3));assert.equal(v.active.filter(p=>p.shape==='ribbon').length,2);
   assert(v.active.every(p=>Math.abs(p.mesh.position.y-y)<.15&&Math.abs(p.mesh.position.z+4)<.15&&Math.abs(p.mesh.position.x-5)<.05));
   const core=v.active.find(p=>p.shape==='claw'),normal=new T.Vector3(0,0,1).applyQuaternion(core.mesh.quaternion);assert(normal.distanceTo(new T.Vector3(1,0,0))<1e-7);assert(core.mesh.material.color.r<.02);assert.equal(core.mesh.material.blending,T.NormalBlending);
   assert(v.active.every(p=>p.max<=.23&&!['veil','ember','smoke','ring'].includes(p.shape)));v.update(1);assert.equal(v.active.length,0);
  }
 }
});

test('melee trails follow the actual elevated blade, reset across views and recycle on clear',()=>{
 const scene=new T.Scene(),v=new SkillVFX(scene,{mobile:true}),model=new T.Group();scene.add(model);model.position.set(3,4,2);
 v.trackMelee(model,'harpoon',1,.08,1);assert.equal(v.active.length,0);model.position.x+=.1;v.trackMelee(model,'harpoon',1,.1,1);assert.equal(v.active.length,2);assert(v.active.every(p=>Math.abs(p.mesh.position.y-4)<.01),'trail fell to a fixed ground height');
 const count=v.active.length;v.trackMelee(new T.Group(),'harpoon',1,.12,1);assert.equal(v.active.length,count,'view switch bridged unrelated weapons');v.trackMelee(model,'shadowblade',2,1,1);assert.equal(v.meleeEdge,null);v.update(.2);assert.equal(v.active.length,0);v.clear();assert.equal(v.meleeEdge,null);
});

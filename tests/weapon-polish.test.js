import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {makeHero} from '../hero-model.js';
import {makeHarpoon} from '../coast-models.js';
import {shadowFocus} from '../shadow-gear.js';

test('firearm muzzle rays enter a real bore instead of hitting a painted front cap',()=>{
 for(const id of ['rifle','shotgun']){
  const gun=makeHero('scout',id).userData.weapon;gun.removeFromParent();gun.position.set(0,0,0);gun.updateMatrixWorld(true);
  const barrels=gun.children.filter(n=>n.name.startsWith('SM_Firearm_RecessedBarrel_'));assert.equal(barrels.length,id==='shotgun'?2:1);
  for(const barrel of barrels){
   const bounds=new T.Box3().setFromObject(barrel),origin=barrel.position.clone();origin.z=bounds.max.z+.1;
   const ray=new T.Raycaster(origin,new T.Vector3(0,0,-1)),floor=ray.intersectObject(barrel,false)[0];assert(floor,'barrel has an open, unclosed interior');
   assert(bounds.max.z-floor.point.z>.065,'bore floor remains a flat front disk');
   origin.x+=(bounds.max.x-bounds.min.x)*.41;ray.set(origin,new T.Vector3(0,0,-1));const rim=ray.intersectObject(barrel,false)[0];assert(rim&&bounds.max.z-rim.point.z<.005,'muzzle lip has no real outer surface');
   assert(barrel.material.vertexColors&&barrel.material.metalness>.6);assert(barrel.geometry.attributes.color.count===barrel.geometry.attributes.position.count);
  }
 }
});

test('crossbow support palm meets a solid foreend while its original contact and mechanism stay fixed',()=>{
 const gun=makeHero('silver','crossbow').userData.weapon;gun.removeFromParent();gun.position.set(0,0,0);gun.updateMatrixWorld(true);
 const foreend=gun.getObjectByName('SM_Crossbow_PalmForeend_A'),ray=new T.Raycaster(new T.Vector3(0,-.10,.18),new T.Vector3(0,1,0));
 const hit=ray.intersectObject(foreend,false)[0];assert(hit);assert(Math.abs(hit.point.y+.05)<.003,'support contact floats below the stock');
 assert.equal(gun.userData.stringPull,.30);assert.equal(gun.userData.crossbowLatch.position.z,-.30);
});

test('harpoon side tines are rounded at their neck but retain a thin forward contact point',()=>{
 const fork=makeHarpoon(),tip=fork.getObjectByName('SM_Harpoon_CentralGroundPoint'),p=tip.geometry.attributes.position;
 let base=0,end=0;for(let i=0;i<p.count;i++){if(p.getZ(i)<.17)base=Math.max(base,Math.abs(p.getY(i)));if(p.getZ(i)>.37)end=Math.max(end,Math.abs(p.getY(i)));}
 assert(end<base*.4,'cutting tip has the same thickness as the socket');
 for(const side of[-1,1]){const tine=fork.getObjectByName('SM_Harpoon_CurvedTine_'+side);assert(tine.geometry.parameters.shapes.curves.some(c=>c.isQuadraticBezierCurve));}
 const book=shadowFocus('grimoire');for(const side of[-1,1]){const pages=book.getObjectByName('SM_Grimoire_AshenPages_'+side);assert.equal(pages.geometry.name,'SM_Grimoire_BoundPageLayers');assert.equal(pages.material.metalness,0);assert(pages.material.roughness>.9);}
});

test('the broader harpoon fork has a supported blade root while full reach and hand diameters stay fixed',()=>{
 const fork=makeHarpoon(),box=new T.Box3().setFromObject(fork),size=box.getSize(new T.Vector3());
 assert(size.x>.36&&size.x<.38,'fork should read as a distinct broad three-pronged head');
 assert(Math.abs(box.min.z+.78)<1e-5&&Math.abs(box.max.z-1.7584853)<1e-5,'visual reach changed');
 const shaft=fork.getObjectByName('SM_Harpoon_SaltedWoodHaft'),socket=fork.getObjectByName('SM_Harpoon_ForkSocket'),tip=fork.getObjectByName('SM_Harpoon_CentralGroundPoint');
 const bounds=n=>new T.Box3().setFromObject(n),tipSize=bounds(tip).getSize(new T.Vector3()),socketBox=bounds(socket);
 assert(tipSize.x>.115&&tipSize.y>.05,'central blade root still reads like a wire');
 assert(socketBox.intersectsBox(bounds(shaft))&&socketBox.intersectsBox(bounds(tip)),'fork socket is disconnected');
 for(const side of[-1,1])assert(socketBox.intersectsBox(bounds(fork.getObjectByName('SM_Harpoon_CurvedTine_'+side))),'side tine root is disconnected');
 const radiusAt=z=>new T.Raycaster(new T.Vector3(.2,0,z),new T.Vector3(-1,0,0)).intersectObject(shaft,false)[0]?.point.x;
 for(const z of[-.08,.34])assert(Math.abs(radiusAt(z)-.029)<1e-5,'hand contact grew through the unchanged palm');
 assert(radiusAt(1.2)>.0315,'forward haft does not support the enlarged fork');
 let meshes=0,triangles=0;fork.traverse(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
 assert.equal(meshes,10);assert(triangles<=2500,'fork proportions should not require extra ornament layers');
});

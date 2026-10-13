import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {shadowFocus} from '../shadow-gear.js';
import {finishShadowTone} from '../shadow-appearance.js';

test('shade is an open thin rift with independent moving nodes and the existing viewmodel envelope',()=>{
 const a=shadowFocus('shade'),b=shadowFocus('shade'),focus=a.userData.focus,other=b.userData.focus;
 assert(focus?.isMesh&&focus!==other);assert.equal(focus.geometry,other.geometry);
 const geometry=focus.geometry,p=geometry.attributes.position,uv=geometry.attributes.uv;
 assert.equal(p.count,uv.count);assert([...p.array,...geometry.attributes.normal.array].every(Number.isFinite));
 assert.equal(focus.castShadow,false);assert.equal(focus.material.depthWrite,false);
 assert(focus.material.transparent&&focus.material.vertexColors);
 // The two surfaces leave negative space through their centre, instead of
 // boxing the hand into a solid gauntlet. Opposite lips must never close.
 const half=p.count/2,columns=5;
 for(let row=1;row<32;row++){
  const left=row*columns,right=half+left;
  assert(p.getX(right)-p.getX(left)>.047);
 }
 a.updateMatrixWorld(true);const size=new T.Box3().setFromObject(a).getSize(new T.Vector3());
 assert(size.x<.083&&size.y<.155&&size.z<.022);
 let meshes=0;a.traverse(o=>{if(o.isMesh){meshes++;assert(!/Torus|Ring|Box/.test(o.geometry.type));}});assert.equal(meshes,3);
 const rest=other.scale.clone();focus.scale.multiplyScalar(1.12);assert(other.scale.equals(rest),'one actor pulses another actor');
});

test('a later shade factory preserves the shared material tone and feathering shader',()=>{
 const material=shadowFocus('shade').userData.focus.material;
 finishShadowTone(material);const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 const next=shadowFocus('shade');finishShadowTone(next.userData.focus.material);
 assert.equal(next.userData.focus.material,material);assert.equal(material.onBeforeCompile,compile);assert.equal(material.customProgramCacheKey(),key);
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
 material.onBeforeCompile(shader);
 assert(shader.vertexShader.includes('vRiftUv=uv;'));assert(shader.fragmentShader.includes('diffuseColor.a*='));
 assert.equal((shader.fragmentShader.match(/float shadowLight=/g)||[]).length,1,'shadow tone is missing or wrapped twice');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {HERO_SIGNATURES,makeIdentityMark} from '../identity-motifs.js';
import {finishHeroSurface} from '../hero-finish.js';

test('seven compact reliefs have distinct silhouettes and bounded shared geometry',()=>{
 const hashes=new Set();
 for(const kind of Object.keys(HERO_SIGNATURES)){
  const a=makeIdentityMark(kind,.05),b=makeIdentityMark(kind,.05),hash=createHash('sha256');let triangles=0;
  assert(a.children.length<=2);assert.equal(a.children.length,b.children.length);
  a.children.forEach((mesh,i)=>{assert(mesh.geometry.attributes.position.array.every(Number.isFinite));hash.update(Buffer.from(mesh.geometry.attributes.position.array.buffer));triangles+=mesh.geometry.attributes.position.count/3;assert.equal(mesh.geometry,b.children[i].geometry);assert.equal(mesh.material,b.children[i].material);assert(mesh.material.isMeshStandardMaterial);});
  assert(triangles<2200,'a small mark must not become a large model');const box=new T.Box3().setFromObject(a);assert(box.max.z-box.min.z<.02,'relief protrudes too far from a garment');assert(box.max.x-box.min.x<.11&&box.max.y-box.min.y<.11);
  hashes.add(hash.digest('hex'));a.position.x=2;assert.equal(b.position.x,0);
 }
 assert.equal(hashes.size,7,'identities must not be the same recoloured stamp');assert.throws(()=>makeIdentityMark('unknown'));
});

test('surface finishing keeps the sprout bell metal and does not modify its shared template',()=>{
 const a=makeIdentityMark('lingya'),b=makeIdentityMark('lingya'),expected=b.children[0].material.metalness;
 finishHeroSurface(a,'lingya');assert.equal(a.children[0].material.metalness,expected);assert.equal(b.children[0].material.metalness,expected);assert.notEqual(a.children[0].material,b.children[0].material);
});

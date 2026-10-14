import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {forestStreamLayout} from '../forest-stream-layout.js';
import {seeded} from '../rules.js';
import {biomeAt,roadDistance,REGIONS} from '../confluence.js';

const TAU=Math.PI*2,shore=a=>1+.07*Math.sin(a*3)+.045*Math.cos(a*5);
function wet(p,x,z){const c=Math.cos(p.angle),s=Math.sin(p.angle),dx=x-p.x,dz=z-p.z,u=(c*dx-s*dz)/p.rx,v=(s*dx+c*dz)/p.rz;return Math.hypot(u,v)<shore(Math.atan2(v,u));}
function at(p,a,r=1){const u=Math.cos(a)*p.rx*shore(a)*r,v=Math.sin(a)*p.rz*shore(a)*r,c=Math.cos(p.angle),s=Math.sin(p.angle);return{x:p.x+c*u+s*v,z:p.z-s*u+c*v};}
function check(ponds,spawn,sites,{half=96,contains,roadDistance}={}){
 assert(ponds.length>=3&&ponds.length<=8,'no complete stream');
 for(let i=0;i<ponds.length;i++){
  const p=ponds[i];assert(Object.values(p).every(Number.isFinite));assert(p.rx>0&&p.rz>0);
  if(i<ponds.length-1)assert(p.rx>=3&&p.rx<=5,'stream has lost its narrow banks');
  if(i){const prev=ponds[i-1];for(let step=0;step<=100;step++){const t=step/100,x=prev.x+(p.x-prev.x)*t,z=prev.z+(p.z-prev.z)*t;assert(wet(prev,x,z)||wet(p,x,z),'disconnected adjacent reaches');}}
  for(let j=0;j<128;j++){
   const a=j*TAU/128,point=at(p,a);assert(Math.abs(point.x)<half&&Math.abs(point.z)<half,'water clips map edge');
   assert(Math.hypot(point.x-spawn.x,point.z-spawn.z)>=6,'water approaches spawn');
   for(const site of sites)assert(Math.hypot(point.x-site.x,point.z-site.z)>=7,'water approaches an exploration site');
   if(contains||roadDistance)for(const r of[0,.25,.5,.75,1]){const q=at(p,a,r);if(contains)assert(contains(q.x,q.z),'water leaves forest biome');if(roadDistance)assert(roadDistance(q.x,q.z)>=6,'water crosses the dry main road');}
  }
 }
 assert(ponds.at(-1).rx>Math.max(...ponds.slice(0,-1).map(p=>p.rx))*1.5,'end pool is no wider than the stream');
}
function normalSites(seed){const random=seeded(seed),sites=[];for(let i=0;i<5;i++){const a=random()*TAU,r=20+random()*61;sites.push({x:Math.sin(a)*r,z:Math.cos(a)*r});}return sites;}
const confluenceSpawn={x:-83,z:32},confluenceSites=[...REGIONS.flatMap(r=>[{x:r.x+(r.id==='coast'?20:12),z:r.z+11},{x:r.x-17,z:r.z-13}]),{x:-98,z:38}],regional={half:140,center:{x:-72,z:20},contains:(x,z)=>biomeAt(x,z)==='forest',roadDistance};

test('200 forest seeds form one safe meandering stream and broad end pool',()=>{
 const signatures=new Set();let full=0;
 for(let seed=0;seed<200;seed++){
  const spawn={x:-12,z:9},sites=normalSites(seed),ponds=forestStreamLayout(seeded(seed),spawn,sites);check(ponds,spawn,sites);
  signatures.add(JSON.stringify(ponds));if(ponds.length>=6)full++;
  if(ponds.length>=6){const centerLength=ponds.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-ponds[i].x,p.z-ponds[i].z),0);assert(centerLength>=42&&centerLength<57);}
 }assert.equal(signatures.size,200);assert(full>=195,'normal maps unnecessarily degrade to short streams');
});

test('80 confluence seeds keep connected forest water away from every real road and landmark',()=>{
 const signatures=new Set();
 for(let seed=0;seed<80;seed++){const ponds=forestStreamLayout(seeded(seed),confluenceSpawn,confluenceSites,regional);check(ponds,confluenceSpawn,confluenceSites,regional);signatures.add(JSON.stringify(ponds));}
 assert(signatures.size>=60,'regional streams collapse to one fallback silhouette');
});

test('a restrictive pocket falls back to a complete short chain, and impossible regions terminate safely',()=>{
 const spawn={x:-18,z:-18},sites=[{x:18,z:18}];let calls=0;const random=()=>{calls++;return 0;},options={half:20,contains:(x,z)=>Math.hypot(x,z)<18};
 const ponds=forestStreamLayout(random,spawn,sites,options);assert.equal(ponds.length,3);check(ponds,spawn,sites,options);assert(calls<=768);
 calls=0;assert.deepEqual(forestStreamLayout(random,spawn,sites,{contains:()=>false}),[]);assert(calls<=768);
});

test('layout is deterministic, leaves caller data intact, and has no rendering or simulation dependency',()=>{
 const spawn=Object.freeze({x:-12,z:9}),sites=Object.freeze(normalSites(72).map(Object.freeze)),before=JSON.stringify({spawn,sites});
 const a=forestStreamLayout(seeded(72),spawn,sites),b=forestStreamLayout(seeded(72),spawn,sites);assert.deepEqual(a,b);assert.equal(JSON.stringify({spawn,sites}),before);
 assert.notDeepEqual(a,forestStreamLayout(seeded(73),spawn,sites));
 const source=readFileSync(new URL('../forest-stream-layout.js',import.meta.url),'utf8');assert.doesNotMatch(source,/\bimport\s|Math\.random|\bTHREE\b|\blocalStorage\b|\bsetTimeout\b|\bscene\./);
});

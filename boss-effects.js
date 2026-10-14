import * as T from './vendor/three.module.js';

// Burst once at the already-authoritative ground-zone impact. Each attack uses
// the existing bounded VFX pool; effects do not apply damage or create timers.
export function bossZoneEffect(vfx,z,groundHeight=()=>0){
 const {x,z:depth,r,visual,angle=0}=z,y=groundHeight(x,depth),at=(side,forward,h=.08)=>new T.Vector3(x+Math.cos(angle)*side+Math.sin(angle)*forward,y+h,depth-Math.sin(angle)*side+Math.cos(angle)*forward);
 const particle=(shape,color,p,size,extra={})=>vfx.particle(shape,color,p.x,p.y,p.z,{life:.55,size,opacity:.72,additive:false,priority:1,...extra});
 const line=(a,b,color,width=.035,life=.45)=>vfx.segment(a,b,color,width,life,false,1,.72);
 if(visual==='silkweave'){
  for(const s of[-.65,0,.65]){line(at(s*r,-r),at(-s*r,r),0xbbaebf,.025,.65);line(at(-r,s*r),at(r,-s*r),0x8d8498,.018,.65);}
 }else if(visual==='venomspit'){
  particle('veil',0x797143,at(0,0),[r*.85,r*.85,1],{life:.8,opacity:.40});
  for(let i=0;i<5;i++){const a=i*2.4;particle('droplet',0xb2a477,at(Math.sin(a)*r*.35,Math.cos(a)*r*.35,.2),[.07,.16,.07],{velocity:[Math.sin(a)*1.2,1.3,Math.cos(a)*1.2],gravity:5});}
 }else if(visual==='antlerrush'||visual==='thornhooves'){
  for(let i=0;i<5;i++){const a=i*2.4,base=at(Math.sin(a)*r*.58,Math.cos(a)*r*.58),tip=base.clone().add(new T.Vector3(Math.sin(a)*.17,visual==='thornhooves'?.95:.43,Math.cos(a)*.17));line(base,tip,0x7d8851,.065,.55);particle('shard',0x84905c,tip,[.04,.18,.04],{velocity:[0,-.4,0],gravity:2});}
 }else if(['frosthunt','rimehowl','featherring','glacialdive'].includes(visual)){
  const feather=visual==='featherring',fan=visual==='rimehowl';
  for(let i=0;i<5;i++){const a=angle+i*2.4,p=at(Math.sin(a)*r*.48,Math.cos(a)*r*.48,feather?1.4:.16),m=particle('crystal',i%2?0x80b8d2:0xc3e2e3,p,[feather?.09:.07,feather?.55:fan?.18:.68,.07],{velocity:feather?[0,-2.2,0]:[Math.sin(a)*.6,fan?.5:1.2,Math.cos(a)*.6],gravity:feather?0:3});if(m)m.rotation.z=(i-2)*.24;}
  particle('vapor',0x96c5d5,at(0,0,.12),[r*.70,.28,1],{opacity:.22,life:.6,velocity:[0,.15,0]});
 }else if(['horncharge','basaltslam','cinderbreath','ashwings'].includes(visual)){
  const stone=visual==='horncharge'||visual==='basaltslam';
  if(stone)for(let i=0;i<5;i++){const a=i*2.4;particle('stone',i%2?0x56413d:0x997252,at(Math.sin(a)*r*.50,Math.cos(a)*r*.5,.12),[.12,.24,.16],{velocity:[Math.sin(a),2.5,Math.cos(a)],gravity:8,spin:2});}
  for(let i=0;i<(stone?2:5);i++){const p=at((i-2)*r*.26,0,.15),m=particle('flame',i%2?0xda753d:0xf0b36b,p,[r*.26,stone?.45:.78,1],{life:.45,velocity:[Math.sin(angle)*1.6,.25,Math.cos(angle)*1.6],endColor:0x633b39,motion:'combust',opacity:.64});if(m)m.rotation.y=angle;}
 }else if(['sinkhole','sandspout','stonepress','glyphcross'].includes(visual)){
  if(visual==='glyphcross')for(const s of[-1,1]){line(at(s*r*.65,-r*.65),at(s*r*.65,r*.65),0xcfb77b,.042,.6);line(at(-r*.65,s*r*.65),at(r*.65,s*r*.65),0xa28c58,.025,.6);}
  for(let i=0;i<5;i++){const a=i*2.4,press=visual==='stonepress';particle('stone',i%2?0x9f8a61:0xc7b183,at(Math.sin(a)*r*.45,Math.cos(a)*r*.45,press?1.35:.12),press?[.20,.70,.15]:[.13,.24,.12],{velocity:press?[0,-4,0]:[Math.sin(a)*1.3,2.3,Math.cos(a)*1.3],gravity:6,spin:press?.2:2});}
  particle('vapor',0xb4a17a,at(0,0,.16),[r*.8,.40,1],{life:.55,opacity:.23,velocity:[0,.35,0]});
 }else if(['razortide','keelrush','abysspulse','lurelights'].includes(visual)){
  if(visual==='lurelights')particle('ember',0xc4ebdf,at(0,0,.55),[.17,.28,.17],{additive:true,life:.22,endColor:0x52848d});
  for(let i=0;i<3;i++){const a=angle+(i-1)*.6,m=particle('crest',i%2?0x729fa6:0xb3d6cb,at(0,0,.09),[r*.75,.30,.60],{life:.55,velocity:[Math.sin(a)*1.4,0,Math.cos(a)*1.4],endColor:0x426b79,opacity:.52});if(m)m.rotation.y=a;}
  for(let i=0;i<4;i++){const a=i*2.4;particle('droplet',0xadd6d1,at(Math.sin(a)*r*.4,Math.cos(a)*r*.4,.14),[.045,.11,.045],{velocity:[Math.sin(a),1.6,Math.cos(a)],gravity:5});}
 }
}

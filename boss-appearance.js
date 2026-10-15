import * as T from './vendor/three.module.js';
import {form,surface,tube,oval,tint,joint,smooth,stepLeg} from './creature-forms.js?v=202';

import {creatureGait,gaitDistance} from './creature-gait.js?v=202';

// These are the original spawn bounds used by projectile targeting. Appearance
// and anticipation may change; the collision body and attack clock do not.
export const BOSS_COMBAT_HEIGHTS=Object.freeze({boss:4.908318008255805,frostking:4,cinderlord:4.33,dunescorpion:2.9392194505028533,wreckwarden:5.203});
const fittedHeights=new Map(),sides=[-1,1];
const bark=0x4e493a,wood=0x817154,fur=0xb9cbc8,ice=0x779fae,rock=0x3e373b,gold=0x8c7549;
const fissured=(base,low,amount=.23)=>(c,x,y,z)=>c.lerp(new T.Color(low),amount*(.5+.5*Math.sin(x*8+y*3+z*5)));
function crystal(color,x,y,z,length,width,lean=0){return surface(color,[[0,width*.70,width*.60],[length*.62,width,width*.73],[length,width*.035,width*.025]],{sides:5,deform:(a,b,c)=>[a+lean*b,b,c]}).translate(x,y,z);}
function eye(parent,key,x,y,z,width,color){
 const angle=Math.sign(x)*.29,slit=(c,w,h,depth,offset)=>oval(c,0,0,0,w,h,depth,12,6).rotateZ(angle).translate(x,y,z+offset);
 return form(parent,key+'_Eye',()=>[slit(0x101b1d,width*1.14,width*.34,.028,0),slit(color,width*.71,width*.11,.012,.023),slit(0x141d1a,width*.09,width*.15,.006,.034)],{glow:true});
}
const tooth=(c,x,y,z,length,radius,lean=0)=>tint(new T.ConeGeometry(radius,length,5).rotateX(Math.PI).rotateZ(lean).translate(x,y,z),c);
export function bossLeg(parent,key,{x,y,z,side=1,reach=0,a=.65,b=.65,width=.23,color=bark,foot=wood,phase=0,style='toes'}){
 const carrier=joint(parent,x,y,z),upper=joint(carrier),knee=joint(carrier),paw=joint(carrier),shell=style==='shell';
 form(upper,key+'_Upper',()=>[tube(color,[[0,.04,0],[side*width*.18,-a*.40,.06],[0,-a,0]],[width,width*.92,width*.63],{sides:10,steps:10})]);
 form(knee,key+'_Shin',()=>[tube(color,[[0,.035,0],[-side*width*.18,-b*.48,-.03],[0,-b,0]],[width*.67,width*.51,width*.15],{sides:9,steps:9})]);
 const sole=form(paw,key+'_Foot',()=>shell?[tube(foot,[[0,.01,-.08],[side*.05,-.003,.04],[side*.09,-.038,.22]],[width*.42,width*.29,.005],{sides:7,steps:7})]:style==='ape'?[
  oval(color,0,.047,.08,width*.97,.095,width*1.30,14,8),
  ...[-1.5,-.5,.5,1.5].map(i=>oval(foot,i*width*.43,.02,width*1.15,width*.25,.065,width*.57,10,6)),
  oval(foot,-side*width*.90,.035,width*.42,width*.35,.075,width*.49,10,6)
 ]:style==='hoof'||style==='rhino'?[
  oval(color,0,.06,.03,width*.74,.13,width*.79,12,7),
  ...(style==='hoof'?[-.44,.44]:[-.62,0,.62]).map(i=>surface(foot,[[-.035,width*.27,width*.53,0,.02],[.015,width*.30,width*.59,0,.04],[.14,width*.22,width*.43,0,-.01]],{sides:10}).translate(i*width,0,width*.35))
 ]:[
  oval(color,0,.035,.06,width*.86,.075,width*1.25,12,7),
  ...[-1,0,1].map(i=>tube(foot,[[i*width*.50,.045,.04],[i*width*.70,.025,width*1.2],[i*width*.87,-.029,width*(style==='root'?2.5:1.75)]],[width*.29,width*.20,.015],{sides:7,steps:8}))
 ]);
 return{joint:carrier,upper,knee,paw,hip:{x,y,z},rest:{x:x+reach*side,y:.008-sole.geometry.boundingBox.min.y,z:z+.10},soleY:sole.geometry.boundingBox.min.y,a,b,upperLength:a,lowerLength:b,phase,side,reach,planted:true,contact:new T.Vector3(),actorPosition:new T.Vector3(),actorQuaternion:new T.Quaternion()};
}
// Share the ordinary creature's planted-foot solver: world contacts, fixed
// bones and bounded replanting also apply to large, scaled boss rigs.
export function poseBossLeg(l,rig,phase,stride,travel,lift,air=0,support=.64,forward=0){stepLeg(l,rig,phase,stride,{travel,lift,air,support,forward});}
function buildTree(d){
 const r=d.rig;
 d.body=form(r,'Boss_AncientBarkTrunk',()=>[
  surface(bark,[[.20,1.06,.80],[.55,1.02,.74],[1.05,.80,.62],[1.48,.93,.66],[2.12,1.05,.71],[2.72,1.02,.66],[3.18,.82,.57],[3.55,.57,.44],[3.81,.31,.29]],{sides:32,flute:.075,deform:(x,y,z,a)=>[x+.05*Math.sin(y*2),y,z+.045*Math.sin(a*3+y)],shade:fissured(bark,0x303d29,.32)}),
  ...Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9;return tube(i%2?wood:bark,[[Math.cos(a)*.55,.68,Math.sin(a)*.40],[Math.cos(a)*.83,1.20,Math.sin(a)*.59],[Math.cos(a)*1.03,2.1,Math.sin(a)*.70],[Math.cos(a)*.91,2.92,Math.sin(a)*.57],[Math.cos(a)*.43,3.70,Math.sin(a)*.30]],[.13,.12,.09,.075,.025],{sides:7,steps:18});}),
  // A broken cleft below the brow, not a smiling U-shaped mouth.
  surface(0x202b24,[[2.48,.18,.025,0,.70],[2.60,.30,.032,0,.735],[2.75,.34,.03,0,.735],[2.83,.12,.02,0,.722]],{sides:12,flute:.18}),
  ...sides.flatMap(side=>[tube(wood,[[side*.10,3.03,.69],[side*.33,3.17,.69],[side*.63,3.24,.54]],[.09,.15,.045],{steps:10}),tube(bark,[[side*.53,2.96,.55],[side*.39,2.69,.68],[side*.25,2.40,.65]],[.15,.115,.025],{steps:11}),tube(wood,[[side*.29,2.80,.74],[side*.26,2.67,.776],[side*.21,2.62,.76]],[.065,.042,.006],{steps:7,sides:6}),tube(0x334032,[[side*.21,3.33,.55],[side*.09,3.13,.67],[side*.065,2.89,.74]],[.025,.032,.012],{steps:9,sides:6})])
 ]);
 form(r,'Boss_HeartInBark',()=>[surface(0xa6c87a,[[1.45,.04,.025,0,.668],[1.63,.12,.045,-.025,.704],[1.90,.19,.05,.015,.737],[2.13,.10,.04,.035,.738],[2.28,.025,.02,0,.712]],{sides:14}),tube(0x829b58,[[-.02,1.67,.75],[.04,1.88,.798],[-.02,2.12,.78]],[.035,.052,.021],{steps:10})],{glow:true});
 for(const side of sides){
  eye(r,'Boss_Bark'+side,side*.35,3.015,.66,.15,0xc5d59a);
  for(let i=0;i<3;i++)d.legs.push(bossLeg(r,'Boss_RootLeg'+side+i,{x:side*.66,y:.49,z:.65-i*.64,side,reach:.66,a:.55,b:.54,width:.22,color:bark,foot:wood,phase:(i%2)*Math.PI+(side<0?0:Math.PI),style:'root'}));
  const arm=joint(r,side*.94,2.85,0),forearm=joint(arm,side*.12,-.86,.04);
  form(arm,'Boss_ShoulderBranch'+side,()=>[tube(bark,[[0,.12,0],[side*.23,-.25,.01],[side*.19,-.61,.03],[side*.12,-.90,.04]],[.38,.35,.25,.22],{sides:12,steps:13}),tube(wood,[[side*.12,.07,.24],[side*.34,-.30,.20],[side*.22,-.78,.20]],[.09,.07,.04],{steps:10}),tube(bark,[[side*.13,-.16,-.13],[side*.50,.10,-.17],[side*.64,.42,-.16]],[.15,.10,.012],{steps:11})]);
  form(forearm,'Boss_ForkedRootHand'+side,()=>[tube(bark,[[0,.08,0],[side*.07,-.43,.04],[side*.04,-.83,.12]],[.24,.26,.22],{sides:12,steps:12}),...[-1,0,1].map(i=>tube(wood,[[i*.16,-.73,.08],[i*.25,-1.04,.16],[i*.30,-1.34,.31],[i*.27,-1.46,.45]],[.13,.11,.065,.012],{sides:8,steps:12})),tube(wood,[[-side*.17,-.56,.02],[-side*.36,-.77,.23],[-side*.30,-.96,.40]],[.12,.09,.015],{steps:10})]);
  d.arms.push(arm);d.forearms.push(forearm);
  const branch=joint(r,side*.43,3.48,-.07);
  form(branch,'Boss_AntlerBranch'+side,()=>[tube(bark,[[0,0,0],[side*.42,.43,-.06],[side*.77,.85,-.13],[side*.93,1.32,-.19]],[.24,.19,.13,.015],{sides:10,steps:16}),tube(wood,[[side*.32,.34,-.04],[side*.90,.48,.02],[side*1.21,.79,.06]],[.16,.10,.012],{sides:8,steps:12}),tube(wood,[[side*.70,.75,-.11],[side*.54,1.08,-.16],[side*.61,1.40,-.20]],[.11,.07,.01],{sides:8,steps:11})]);
  form(branch,'Boss_LeafCrown'+side,()=>Array.from({length:18},(_,i)=>{
   const a=i*2.399,x=side*(.25+(i%5)*.22),y=.40+Math.floor(i/5)*.23+.08*Math.sin(a),z=-.07+Math.sin(a)*.25;
   return surface(i%3===0?0x8c9d54:0x597b43,[[0,.006,.003],[.18,.13,.016],[.38,.16,.022],[.60,.08,.012],[.72,.003,.002]],{axis:'z',sides:8,deform:(x,y,z)=>[x,y+.10*Math.sin(z*Math.PI/.72),z]}).rotateX(.2+.22*Math.cos(a)).rotateY(a).translate(x,y,z);
  }));
  d.appendages.push(branch);
 }
}
function buildApe(d){
 const r=d.rig;
 d.body=form(r,'Frostking_YetiTorso',()=>[
  surface(fur,[[.91,.47,.40,0,-.11],[1.32,.64,.52,0,-.15],[1.83,.94,.69,0,-.19],[2.27,1.23,.80,0,-.20],[2.65,1.16,.75,0,-.17],[2.95,.87,.58,0,-.10],[3.10,.45,.36,0,-.05]],{sides:32,flute:.026,shade:(c,x,y,z)=>c.lerp(new T.Color(z>.15?0xd0d8cd:0x6e8a94),z>.15?.24:.35)}),
  surface(0xb3c6c1,[[1.37,.28,.07,0,.41],[1.66,.46,.13,0,.49],[2.18,.74,.14,0,.61],[2.58,.70,.10,0,.61]],{sides:24,flute:.065}),
  ...sides.flatMap(side=>Array.from({length:5},(_,i)=>tube(i%2?0xb1c7c7:fur,[[side*(.70+i*.065),2.67-i*.19,-.18],[side*(1.05+i*.025),2.51-i*.19,-.24],[side*(1.02+i*.04),2.25-i*.19,-.30]],[.17,.16,.018],{steps:9,sides:7})))
 ]);
 d.head=joint(r,0,2.84,.39);
 form(d.head,'Frostking_YetiHead',()=>[
  surface(0xe0e5d9,[[-.34,.34,.29,0,.01],[-.08,.58,.40,0,.03],[.23,.57,.40,0,0],[.48,.43,.34,0,-.05],[.59,.16,.19,0,-.08]],{sides:28,flute:.025}),
  oval(0x425a63,0,.0,.365,.40,.34,.14,20,12),oval(0x546e76,0,-.12,.47,.30,.115,.14,18,10),oval(0x283e47,0,-.03,.518,.16,.09,.075,14,8),
  ...sides.flatMap(side=>[oval(0x14282f,side*.085,-.025,.581,.034,.021,.015,9,5),tube(0x91acab,[[side*.045,.12,.438],[side*.19,.23,.46],[side*.38,.27,.391]],[.075,.12,.045],{steps:11,sides:9}),tube(0xb7cbc5,[[side*.40,.16,.21],[side*.43,-.08,.27],[side*.30,-.33,.37]],[.14,.13,.025],{steps:11,sides:8})]),
  oval(0x172d35,0,-.225,.566,.26,.10,.035,16,8),
  ...sides.map(side=>tooth(0xc7cbb5,side*.21,-.245,.603,.18,.043,side*.12)),
  ...sides.flatMap(side=>[crystal(ice,side*.34,.46,-.08,.44,.14,side*.40),crystal(0xaaceda,side*.14,.56,-.05,.57,.13,side*.13),crystal(0x789eae,side*.48,.31,-.17,.32,.11,side*.65)])
 ]);
 d.jaw=joint(d.head,0,-.22,.40);
 form(d.jaw,'Frostking_YetiJaw',()=>[surface(0x637e85,[[-.15,.12,.055,0,.09],[-.09,.26,.11,0,.10],[.015,.26,.12,0,.10],[.06,.16,.075,0,.08]],{sides:18}),...sides.map(side=>tooth(0xbcc7b5,side*.11,.065,.20,.055,.026,Math.PI))]);
 for(const side of sides){
  d.eyes.push(eye(d.head,'Frostking'+side,side*.21,.13,.471,.083,0xc8f1ed));
  d.legs.push(bossLeg(r,'Frostking_YetiHind'+side,{x:side*.52,y:1.15,z:-.32,side,a:.65,b:.60,width:.31,color:0xb3caca,foot:0x6e8992,phase:side<0?0:Math.PI,style:'ape'}));
  const arm=joint(r,side*1.00,2.53,.02),forearm=joint(arm,side*.12,-1.02,.05);
  form(arm,'Frostking_YetiShoulder'+side,()=>[tube(fur,[[0,.11,0],[side*.25,-.22,.015],[side*.18,-.68,.04],[side*.12,-1.03,.05]],[.49,.50,.37,.30],{sides:16,steps:15}),...Array.from({length:4},(_,i)=>tube(0xb8cecb,[[side*.28,-.12-i*.17,-.05],[side*.50,-.33-i*.15,-.09],[side*.43,-.59-i*.15,-.06]],[.15,.13,.012],{steps:8,sides:7}))]);
  form(forearm,'Frostking_YetiForearm'+side,()=>[tube(fur,[[0,.12,0],[side*.03,-.19,.015],[side*.06,-.43,.03],[0,-.83,.08]],[.29,.35,.36,.28],{sides:16,steps:16}),
   ...Array.from({length:5},(_,i)=>{const a=i*Math.PI*2/5;return tube(i%2?0xc3d2cc:fur,[[Math.cos(a)*.23,-.43,Math.sin(a)*.23],[Math.cos(a)*.34,-.66,Math.sin(a)*.34],[Math.cos(a)*.26,-.92,Math.sin(a)*.26]],[.09,.08,.004],{steps:8,sides:6});}),
   oval(0x76949c,0,-.94,.12,.33,.30,.31,16,10),...[-1.5,-.5,.5,1.5].map(i=>tube(0x8ea9ac,[[i*.13,-.91,.29],[i*.14,-1.11,.31],[i*.14,-1.18,.13]],[.09,.10,.065],{sides:8,steps:9})),tube(0x91acae,[[-side*.26,-.80,.09],[-side*.40,-.98,.26],[-side*.24,-1.07,.34]],[.12,.11,.065],{sides:8,steps:9})]);
  d.arms.push(arm);d.forearms.push(forearm);
 }
}
function buildFurnace(d){
 const r=d.rig;
 d.body=form(r,'Cinderlord_StoneTorso',()=>[
  surface(rock,[[.75,.42,.35],[1.12,.63,.45],[1.68,.79,.52],[2.13,.96,.59],[2.55,.91,.57],[2.84,.68,.45],[3.03,.35,.30]],{sides:22,flute:.06,deform:(x,y,z,a,j)=>[x,y+.055*Math.sin(a*5+j*.6),z],shade:fissured(rock,0x241f27,.38)}),
  ...sides.map(side=>surface(0x68514b,[[1.32,.18,.12,side*.48,.34],[1.70,.25,.16,side*.62,.40],[2.17,.30,.15,side*.69,.47],[2.57,.25,.13,side*.58,.43]],{sides:10,flute:.09})),
  ...Array.from({length:5},(_,i)=>tube(0x73584a,[[-.57+i*.045,2.75-i*.265,.39+i*.017],[0,2.64-i*.25,.61],[.57-i*.045,2.75-i*.265,.39+i*.017]],[.08,.10,.08],{steps:12,sides:6})),
  ...sides.map(side=>tube(0x372d34,[[side*.57,2.48,-.30],[side*.58,3.12,-.39],[side*.35,3.51,-.40],[side*.26,3.69,-.32]],[.25,.21,.13,.025],{steps:14,sides:9}))
 ]);
 d.core=form(r,'Cinderlord_FurnaceCore',()=>[
  surface(0xd87335,[[1.22,.075,.04,0,.424],[1.55,.27,.09,0,.518],[1.93,.32,.11,0,.563],[2.30,.25,.08,0,.555],[2.51,.06,.03,0,.501]],{sides:18,flute:.08}),
  ...sides.map(side=>tube(0xe3a04c,[[side*.15,1.44,.58],[side*.23,1.78,.67],[side*.13,2.12,.67],[side*.15,2.42,.59]],[.021,.04,.026,.012],{steps:13,sides:6}))
 ],{glow:true});
 d.head=joint(r,0,3.06,.08);
 form(d.head,'Cinderlord_StoneCrownedHead',()=>[surface(0x3b3438,[[-.20,.18,.21],[-.07,.31,.32],[.17,.40,.34],[.35,.30,.27],[.46,.11,.15]],{sides:16,flute:.10}),...sides.map(side=>tube(0x5c4943,[[side*.24,.27,-.03],[side*.47,.50,-.11],[side*.54,.85,-.19],[side*.43,1.03,-.17]],[.17,.15,.10,.015],{steps:13,sides:7})),...sides.flatMap(side=>[tube(0x7e5c47,[[side*.035,.105,.35],[side*.19,.24,.38],[side*.35,.29,.26]],[.055,.10,.025],{steps:9,sides:6}),tube(0x56453e,[[side*.34,.10,.23],[side*.24,-.11,.31],[side*.15,-.21,.25]],[.09,.10,.015],{steps:8,sides:6})]),surface(0x13171b,[[-.18,.12,.018,0,.32],[-.08,.20,.023,0,.345],[.005,.15,.015,0,.35]],{sides:10}),...sides.map(side=>tooth(0x9c8161,side*.13,-.095,.377,.10,.031,side*.1))]);
 d.jaw=joint(d.head,0,-.11,.24);
 form(d.jaw,'Cinderlord_StoneJaw',()=>[surface(0x58463d,[[-.17,.065,.04,0,.035],[-.10,.17,.08,0,.065],[.005,.19,.10,0,.07],[.035,.11,.06,0,.07]],{sides:12,flute:.05})]);
 for(const side of sides){
  eye(d.head,'Cinderlord'+side,side*.19,.125,.35,.09,0xf5c77d);
  d.legs.push(bossLeg(r,'Cinderlord_StoneLeg'+side,{x:side*.43,y:1.07,z:0,side,a:.62,b:.60,width:.27,color:rock,foot:0x55443e,phase:side<0?0:Math.PI}));
  const arm=joint(r,side*.86,2.62,0),forearm=joint(arm,side*.13,-.83,.02);
  form(arm,'Cinderlord_StoneShoulder'+side,()=>[tube(0x69514a,[[0,.08,0],[side*.25,-.16,.02],[side*.15,-.56,.02],[side*.13,-.83,.02]],[.37,.43,.28,.23],{steps:12,sides:10}),tube(0x40313a,[[side*.13,.12,-.12],[side*.41,.47,-.15],[side*.43,.74,-.22]],[.20,.14,.012],{steps:10,sides:7})]);
  form(forearm,'Cinderlord_StoneGauntlet'+side,()=>[tube(0x57453f,[[0,.06,0],[side*.05,-.40,.02],[side*.03,-.70,.10]],[.25,.34,.28],{steps:11,sides:11}),...[-1,0,1].map(i=>tube(0x7b5846,[[i*.16,-.65,.11],[i*.21,-.92,.21],[i*.19,-1.13,.36]],[.13,.115,.015],{steps:10,sides:7})),tube(0x60483d,[[-side*.22,-.48,.07],[-side*.39,-.73,.24],[-side*.31,-.93,.37]],[.13,.11,.012],{steps:9,sides:7})]);
  form(forearm,'Cinderlord_EmberSeams'+side,()=>[tube(0xd88b41,[[side*.03,-.10,.24],[side*.15,-.35,.31],[side*.08,-.62,.35]],[.023,.035,.020],{steps:10,sides:6})],{glow:true});
  d.arms.push(arm);d.forearms.push(forearm);
 }
}
function buildScorpion(d){
 const r=d.rig;
 d.body=form(r,'Dunescorpion_BeetleCarapace',()=>[
  surface(gold,[[-1.45,.12,.10,0,.81],[-1.22,.59,.32,0,.86],[-.87,.90,.47,0,.91],[-.30,1.05,.49,0,.91],[.25,1.03,.44,0,.92],[.73,.78,.33,0,.94],[1.05,.48,.22,0,.91],[1.24,.20,.12,0,.87]],{axis:'z',sides:32,flute:.025,shade:(c,x,y,z)=>c.lerp(new T.Color(y<.76?0x51452d:0xc7ab6a),y<.76?.55:.18)}),
  ...Array.from({length:5},(_,i)=>tube(0x6d5d3b,[[-.77+.09*i,1.04,-.90+i*.33],[-.40,1.33,-.90+i*.33],[0,1.42,-.92+i*.33],[.40,1.33,-.90+i*.33],[.77-.09*i,1.04,-.90+i*.33]],[.022,.028,.03,.028,.022],{steps:17,sides:6})),
  ...sides.flatMap(side=>[tube(0x51422c,[[side*.14,.84,1.12],[side*.23,.76,1.38],[side*.10,.75,1.53]],[.09,.075,.015],{steps:10,sides:8}),tube(0xd0b175,[[side*.36,1.14,.84],[side*.54,1.19,.62],[side*.69,1.22,.25]],[.04,.055,.02],{steps:10,sides:6})])
 ]);
 for(const side of sides){
  eye(r,'Dunescorpion'+side,side*.27,1.11,1.095,.095,0xd8bd73);
  for(let i=0;i<4;i++)d.legs.push(bossLeg(r,'Dunescorpion_BeetleLeg'+side,{x:side*.80,y:.83,z:.69-i*.53,side,reach:.75,a:.66,b:.63,width:.16,color:gold,foot:0x615136,phase:(i%2)*Math.PI+(side>0?Math.PI:0),style:'shell'}));
  const arm=joint(r,side*.63,.91,.87),forearm=joint(arm,side*.42,0,.77),tip=joint(forearm,-side*.16,0,.40);
  form(arm,'Dunescorpion_BeetlePedipalp'+side,()=>[tube(0x8a7548,[[0,0,-.02],[side*.41,-.05,.35],[side*.42,0,.80]],[.21,.24,.17],{steps:14,sides:11})]);
  form(forearm,'Dunescorpion_BeetlePincer'+side,()=>[surface(0x9c824d,[[-.10,.13,.14],[.10,.32,.27],[.43,.37,.27],[.74,.29,.22],[1.02,.17,.14],[1.16,.025,.025]],{axis:'z',sides:22,deform:(x,y,z)=>[x+side*.14*Math.sin(Math.max(0,z)*2.3),y,z],shade:(c,x,y,z)=>c.multiplyScalar(y<0?.67:.94+.12*Math.sin(z*5))}),tube(0x50452f,[[side*.25,.01,.67],[side*.26,.02,.99],[side*.11,.01,1.30],[-side*.04,0,1.37]],[.16,.13,.075,.008],{steps:12,sides:8}),...[0,1,2].map(i=>tooth(0x50452f,side*(.12-i*.018),.012,.82+i*.15,.14-i*.018,.045,-side*Math.PI/2)),tube(0x6e613e,[[side*.08,.23,.25],[side*.12,.28,.44],[side*.17,.17,.76]],[.014,.021,.007],{steps:7,sides:5})]);
  form(tip,'Dunescorpion_BeetleMovablePincer'+side,()=>[tube(0x8d7042,[[0,0,0],[-side*.23,.02,.35],[-side*.19,.015,.70],[side*.10,0,.91]],[.20,.17,.11,.008],{steps:15,sides:10})]);
  d.arms.push(arm);d.forearms.push(forearm);d.claws.push(tip);
 }
 d.tail=joint(r,0,.89,-1.15);let parent=d.tail;
 for(let i=0;i<5;i++){
  const seg=joint(parent,0,i?.43:0,i?-.06:0),width=.28-i*.025;
  form(seg,'Dunescorpion_BeetleTail'+i,()=>[surface(i%2?0x9f844b:0xb09656,[[-.08,width*.80,width*.80],[.07,width,width*.90],[.30,width*.95,width*.85],[.49,width*.60,width*.65]],{sides:16,flute:.035}),tube(0x6f5b36,[[-width*.8,.23,width*.51],[0,.29,width*.88],[width*.8,.23,width*.51]],[.018,.024,.018],{steps:8,sides:5})]);
  seg.rotation.x=-.30;d.tailSegments.push(seg);parent=seg;
 }
 form(parent,'Dunescorpion_BeetleVenomBulb',()=>[oval(0x81633b,0,.58,.05,.30,.32,.24,16,10),tube(0x403b32,[[0,.66,.14],[0,.58,.48],[0,.38,.70],[0,.17,.78]],[.19,.16,.08,.005],{steps:15,sides:10})]);
}
function buildWreck(d){
 const r=d.rig;
 d.body=form(r,'Wreckwarden_CrabBody',()=>[surface(0x66877c,[[-1.58,.14,.12,0,.84],[-1.26,.77,.47,0,.96],[-.65,1.20,.67,0,1.03],[.03,1.29,.69,0,1.02],[.64,1.09,.51,0,1.02],[1.04,.70,.33,0,1.0],[1.29,.34,.18,0,.96]],{axis:'z',sides:32,flute:.025,shade:fissured(0x6f9183,0x374f4c,.27)}),...sides.map(side=>tube(0xb0b398,[[side*.66,1.29,1.00],[side*1.11,1.47,.55],[side*1.26,1.42,-.20],[side*.96,1.30,-1.02]],[.045,.070,.055,.025],{steps:18,sides:7})),tube(0x334843,[[-.40,.88,1.23],[-.20,.77,1.40],[.20,.77,1.40],[.40,.88,1.23]],[.05,.08,.08,.05],{steps:12,sides:8})]);
 d.shell=joint(r,0,1.37,-.28);
 form(d.shell,'Wreckwarden_BarkShipHull',()=>[
  surface(0x5d5645,[[-1.60,.11,.08,0,.27],[-1.35,.64,.29,0,.28],[-.75,.94,.43,0,.30],[.0,1.01,.46,0,.32],[.73,.82,.39,0,.34],[1.20,.48,.28,0,.37],[1.42,.08,.11,0,.42]],{axis:'z',sides:28,shade:fissured(0x6e614a,0x374340,.3)}),
  ...sides.flatMap(side=>[tube(0x8d7958,[[side*.10,.40,-1.60],[side*.75,.71,-1.20],[side*1.01,.83,-.35],[side*.92,.83,.50],[side*.47,.72,1.25],[0,.58,1.48]],[.06,.09,.095,.09,.07,.025],{steps:22,sides:8}),...Array.from({length:5},(_,i)=>tube(i%2?0x948269:0x796b52,[[side*.31,.06,-1.02+i*.45],[side*.72,.23,-1.02+i*.45],[side*.92,.64,-1.02+i*.45]],[.055,.070,.055],{steps:9,sides:7}))]),
  ...Array.from({length:4},(_,i)=>tube(0x685a45,[[-.75,.51,-.86+i*.49],[0,.43,-.86+i*.49],[.75,.51,-.86+i*.49]],[.063,.07,.063],{steps:10,sides:6})),
  tube(0x5c4f3b,[[0,.34,-.35],[.02,1.22,-.35],[-.04,2.10,-.35],[-.12,3.04,-.35]],[.10,.085,.07,.035],{steps:20,sides:10}),
  tube(0x948768,[[-.75,2.27,-.35],[0,2.35,-.35],[.84,2.36,-.35]],[.04,.055,.035],{steps:12,sides:7}),
  ...sides.map(side=>tube(0xa29a7b,[[side*.82,.72,-.80],[side*.38,1.69,-.57],[-.10,2.88,-.35]],[.017,.016,.014],{steps:16,sides:5}))
 ]);
 d.sail=joint(d.shell,0,2.34,-.35);
 form(d.sail,'Wreckwarden_TornSail',()=>[surface(0xb2b49b,[[0,.77,.025],[ -.30,.72,.12],[ -.64,.59,.17],[ -.93,.53,.11],[ -1.11,.40,.028]],{sides:28,deform:(x,y,z,a,j)=>[x+(j>2?.06*Math.sin(y*6):0),y+(j===4?.12*Math.sin(a*5)+.055*Math.cos(a*9):0),z+.025*Math.sin(x*5+y*3)],shade:(c,x,y,z)=>c.lerp(new T.Color(0x607d72),.24+.22*(1-smooth((y+1.12)/1.12)))})]);
 form(d.shell,'Wreckwarden_CrabBarnacles',()=>Array.from({length:12},(_,i)=>{const side=i%2?1:-1,z=-.94+Math.floor(i/2)*.34;return surface(i%3?0x94a494:0xb8bba3,[[0,.10,.10],[.10,.11,.095],[.17,.065,.065],[.19,.025,.028]],{sides:7}).rotateZ(-side*.65).translate(side*(.76+.12*Math.sin(i)),.67,z);}));
 for(const side of sides){
  const eyestalk=joint(r,side*.42,1.34,.91);
  form(eyestalk,'Wreckwarden_CrabEyestalk'+side,()=>[tube(0x78978c,[[0,0,0],[side*.07,.30,.04],[side*.12,.48,.06]],[.08,.07,.075],{steps:10,sides:9}),oval(0x263e3e,side*.12,.53,.07,.14,.105,.095,14,8)]);
  eye(eyestalk,'Wreckwarden'+side,side*.12,.54,.151,.070,0xb6ddc7);d.eyes.push(eyestalk);
  for(let i=0;i<3;i++)d.legs.push(bossLeg(r,'Wreckwarden_CrabLeg'+side,{x:side*.95,y:.93,z:.64-i*.66,side,reach:.92,a:.80,b:.72,width:.20,color:0x6a8b7e,foot:0x3e5c59,phase:i%2*Math.PI+(side>0?Math.PI:0),style:'shell'}));
  const arm=joint(r,side*.82,1.00,.81),forearm=joint(arm,side*.48,-.06,.84),tip=joint(forearm,-side*.19,0,.45),size=side<0?1.16:.93;
  form(arm,'Wreckwarden_CrabShoulder'+side,()=>[tube(0x779787,[[0,0,0],[side*.45,-.13,.38],[side*.48,-.06,.88]],[.27,.30,.22],{steps:14,sides:12})]);
  form(forearm,'Wreckwarden_CrabCrushingClaw'+side,()=>[surface(0x7e9580,[[-.14,.16,.16],[.13,.36,.31],[.47,.43,.34],[.78,.35,.30],[1.00,.17,.16],[1.10,.035,.035]],{axis:'z',sides:24,deform:(x,y,z)=>[(x+side*.12*Math.sin(z*2.5))*size,y*size,z*size],shade:(c,x,y,z)=>c.multiplyScalar(y<0?.62:.92+.1*Math.sin(z*8))}),tube(0x385752,[[side*.28,.02,.72],[side*.30,.03,1.05],[side*.13,.025,1.36],[-side*.06,0,1.40]],[.20,.17,.075,.01],{steps:13,sides:10}).scale(size,size,size),...[0,1,2].map(i=>tooth(0x415c53,side*(.10-i*.02),.025,.84+i*.16,.18-i*.02,.06,-side*Math.PI/2).scale(size,size,size)),tube(0xb2b59c,[[-side*.18,.25,.20],[side*.02,.355,.47],[side*.18,.20,.78]],[.012,.018,.005],{steps:9,sides:5}).scale(size,size,size)]);
  form(tip,'Wreckwarden_CrabThumb'+side,()=>[tube(0x6a8c7c,[[0,0,0],[-side*.25,.02,.37],[-side*.24,.03,.77],[side*.08,0,.97]],[.23,.21,.13,.01],{steps:15,sides:10}).scale(size,size,size)]);
  d.arms.push(arm);d.forearms.push(forearm);d.claws.push(tip);
 }
}
export function makeBossAppearance(kind){
 if(!Object.hasOwn(BOSS_COMBAT_HEIGHTS,kind))return null;
 const g=new T.Group(),rig=joint(g),d=g.userData={kind,rig,bossModel:true,bossAppearance:true,organicModel:true,combatHeight:BOSS_COMBAT_HEIGHTS[kind],phase:0,legs:[],arms:[],forearms:[],appendages:[],claws:[],eyes:[],tailSegments:[]};
 ({boss:buildTree,frostking:buildApe,cinderlord:buildFurnace,dunescorpion:buildScorpion,wreckwarden:buildWreck})[kind](d);
 // The ape leans from its hips. Place its support under that forward centre of
 // mass so a rear stroke does not repeatedly exhaust the knee's reach.
 if(kind==='frostking')for(const l of d.legs)l.rest.z+=.20;
 animateBossAppearance(g,0,0,0);
 if(!fittedHeights.has(kind)){const first=new T.Box3().setFromObject(g).max.y;rig.scale.y=2;const second=new T.Box3().setFromObject(g).max.y;fittedHeights.set(kind,1+(d.combatHeight-first)/(second-first));}
 d.heightScale=fittedHeights.get(kind);rig.scale.y=d.heightScale;for(const l of d.legs)l.rest.y=.008-l.soleY*d.heightScale;animateBossAppearance(g,0,0,0);g.scale.y=d.combatHeight/new T.Box3().setFromObject(g).max.y;return g;
}

// Read boss-combat's already-authoritative phase. A single release curve blends
// anticipation into follow-through; recovery begins at exactly that end pose.
export function animateBossAppearance(g,t,speed,dt){
 const d=g.userData,r=d.rig,kind=d.kind,stage=d.bossStage||'walk',move=d.bossMove||({boss:'branches',frostking:'leap',cinderlord:'furnace',dunescorpion:'pincers',wreckwarden:'claws'})[kind];
 const s=stage==='strike'?T.MathUtils.clamp(d.strikeProgress||0,0,1):0,rec=stage==='recover'?1-smooth(d.recoverProgress||0):0;
 const wind=stage==='wind'?smooth(d.windProgress||0):stage==='strike'?1-smooth(s/.30):0;
 const strike=stage==='strike'?smooth(s/.30)*(1-.65*smooth((s-.50)/.50)):stage==='recover'?.35*rec:0;
 const landing=stage==='strike'?smooth((s-.58)/.19)*(1-smooth((s-.85)/.15)):stage==='recover'?.18*Math.sin(Math.PI*T.MathUtils.clamp(d.recoverProgress||0,0,1)):0;
 const desired=stage==='walk'||stage==='move'?Math.min(1,Math.max(0,speed)/(kind==='boss'?1.5:kind==='wreckwarden'?1.8:2.3)):0;
 d.walkStride=(d.walkStride||0)+(desired-(d.walkStride||0))*(1-Math.exp(-Math.max(0,dt)*10));const stride=d.walkStride;
 const gait=creatureGait(kind,speed);d.motionGait=gait;
 if(desired>.001)d.phase+=gaitDistance(speed*dt/g.scale.x,gait,desired);const p=d.phase;
 r.position.set(0,(d.lift||0)+Math.abs(Math.sin(p))*.035*stride,0);r.rotation.set(0,0,Math.sin(p)*.025*stride);r.scale.set(1,d.heightScale||1,1);
 const breathe=Math.sin(t*(kind==='frostking'?1.65:1.2))*.006*(1-Math.max(wind,strike));d.body.scale.set(1+breathe*.4,1+breathe,1+breathe*.6);
 if(d.jaw)d.jaw.rotation.x=wind*(kind==='frostking'?.30:.18)+strike*(kind==='frostking'?.18:.10);
 for(let i=0;i<d.arms.length;i++){const side=i?1:-1;d.arms[i].rotation.set(Math.sin(p+i*Math.PI)*.17*stride-wind*.7+strike*.45,0,side*.04);d.forearms[i].rotation.set(-.12-wind*.25+strike*.13,0,0);}
 if(kind==='boss'){
  const roots=move==='roots';r.rotation.x=-wind*.09+strike*.10;r.rotation.y=(roots?-.08:-.21)*wind+(roots?.06:.17)*strike;r.position.y-=wind*.08+strike*.06;
  for(let i=0;i<2;i++){const side=i?1:-1;d.arms[i].rotation.set(-.18-wind*(roots?.60:1.32)+strike*(roots?.30:.60),side*(-.16-wind*(roots?.12:.40)+strike*.30),side*(.36+wind*(roots?.04:.27)-strike*.12));d.forearms[i].rotation.x=-.42-wind*.42+strike*.36;d.appendages[i].rotation.set(Math.sin(t*.85+i)*.012+strike*.025,0,side*Math.sin(t*.7+i)*.018+Math.sin(p-.6)*.012*stride);}
 }else if(kind==='frostking'){
  const leap=move==='leap';r.position.y-=.08+wind*(leap?.31:.13)+landing*.21;r.rotation.x=.27+.045*stride+wind*(leap?.13:-.08)+strike*.15;d.head.rotation.set(-.16-wind*.22+landing*.12,Math.sin(t*.43)*.009*(1-stride),0);
  for(let i=0;i<2;i++){const side=i?1:-1;d.arms[i].rotation.set(-.22+Math.sin(p+i*Math.PI)*.22*stride-wind*(leap?.51:1.43)-strike*(leap?1.45:-.65)+landing*1.15,side*(.05+wind*(leap?.10:.20)),side*(.13+wind*.15+strike*.06));d.forearms[i].rotation.x=.06-wind*(leap?.72:.30)-strike*.28+landing*.28;}
 }else if(kind==='cinderlord'){
  const embers=move==='embers';r.rotation.x=-wind*.10+strike*.13;r.rotation.y=wind*(embers?.13:-.12)-strike*.08;r.position.y+=Math.sin(t*1.2)*.012-wind*.06;d.head.rotation.set(.07-wind*.08+strike*.05,Math.sin(t*.43)*.010,0);
  for(let i=0;i<2;i++){const side=i?1:-1;d.arms[i].rotation.set(-wind*(embers?1.75:1.08)+strike*(embers?-.25:.58),side*(-wind*.24+strike*(embers?.09:.27)),side*(wind*(embers?.28:.57)+strike*(embers?.08:-.18)));d.forearms[i].rotation.x=-.15-wind*.50+strike*.38;}
  d.core.scale.set(1+wind*.025,1+wind*.018,1+wind*.025);
 }else{
  const scorpion=kind==='dunescorpion',tail=move==='tail',burrow=move==='burrow',surge=move==='surge',anchors=move==='anchors';
  r.rotation.x=wind*(tail?.10:surge?-.07:.045)-strike*.055;r.position.y-=wind*(burrow?.17:.055);r.position.z=-wind*.06+strike*.08;
  for(let i=0;i<2;i++){const side=i?1:-1,clawMove=move==='pincers'||move==='claws';d.arms[i].rotation.set(-wind*(anchors?.58:.16)+strike*(anchors?.35:.08),side*(wind*(clawMove?.34:.15)-strike*(clawMove?.37:.10)),side*wind*(anchors?.10:.025));d.forearms[i].rotation.set(-wind*(anchors?.42:.10)+strike*.08,side*(-wind*.12+strike*.14),0);d.claws[i].rotation.y=side*(-wind*.45+strike*.19);}
  if(scorpion){d.tail.rotation.set(.06+wind*(tail?.65:burrow?.32:.13)-strike*(tail?1.18:.08),Math.sin(p*.5)*.035*stride,0);for(let i=0;i<d.tailSegments.length;i++)d.tailSegments[i].rotation.x=-.30+Math.sin(t*.9-i*.5)*.012-wind*(tail?.035:0)+strike*(tail?-.07:0);}
  else{d.shell.rotation.set(-wind*.025+strike*.035,0,Math.sin(p-.6)*.016*stride);d.sail.rotation.set(Math.sin(t*.9)*.027,Math.sin(t*.7)*.05,Math.sin(p-.8)*.013*stride);for(let i=0;i<d.eyes.length;i++)d.eyes[i].rotation.set(-wind*.18+strike*.08,Math.sin(t*.56+i)*.035*(1-stride),0);}
 }
 // A leap carries the complete body; a burrow intentionally takes it below
 // ground. The IK offset follows combat's lift instead of pinning feet in air.
 const air=d.lift||0;for(let i=0;i<d.legs.length;i++)poseBossLeg(d.legs[i],r,p,stride,gait.travel,gait.lift,air,gait.support);
}

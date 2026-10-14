import * as T from './vendor/three.module.js';
import {form,surface,tube,oval,face,joint as organicJoint,leg,stepLeg} from './creature-forms.js?v=190';
const materials=new Map(),geometries=new Map();
function part(parent,color,x,y,z,sx,sy,sz,shape='sphere',lit=false){
 const key=color+':'+lit;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.78,metalness:.12,emissive:lit?color:0,emissiveIntensity:lit?.8:0}));
 if(!geometries.has(shape))geometries.set(shape,shape==='hammer'?new T.CylinderGeometry(1,1,2,8).rotateZ(Math.PI/2):shape==='cone'?new T.ConeGeometry(1,2,9):shape==='stone'?new T.DodecahedronGeometry(1,1):new T.SphereGeometry(1,14,10));
 const m=new T.Mesh(geometries.get(shape),materials.get(key));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function joint(parent,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
function model(kind){const g=new T.Group(),rig=joint(g,0,0,0);g.userData={kind,rig,legs:[],arms:[],phase:0};return g;}
function eyes(p,color,y,z,spread=.3){for(const s of [-1,1])part(p,color,s*spread,y,z,.10,.055,.07,'sphere',true);}
function limb(p,c,x,y,z,length,width){const g=joint(p,x,y,z);part(g,c,0,-length/2,0,width,length/2,width);return g;}
export function makeBoss(kind){
 const g=model(kind),d=g.userData,r=d.rig;d.bossModel=true;d.appendages=[];
 if(kind==='boss'){
  part(r,0x65543d,0,2,0,1.25,2,.88,'stone');part(r,0x79965a,0,3.2,-.1,1.4,.8,1,'stone');
  eyes(r,0xece7a5,2.55,.88,.4);part(r,0xaccd7b,0,1.7,.85,.22,.5,.1,'sphere',true);
  for(const s of [-1,1]){const leg=limb(r,0x524933,s*.65,1.1,0,1.1,.4);part(leg,0x65543d,s*.18,-.95,.35,.5,.2,.8);d.legs.push(leg);
   const arm=limb(r,0x65543d,s*1.25,2.8,0,1.7,.33);for(let j=0;j<3;j++){const finger=limb(arm,0x8a7950,(j-1)*.23,-1.5,.1,.65,.09);finger.rotation.x=-.3-j*.1;}d.arms.push(arm);
   const branch=limb(r,0x66543b,s*.65,3.3,0,1.45,.14);branch.rotation.z=s*2.35;part(branch,0x719552,0,-1.3,0,.7,.28,.55,'stone');d.appendages.push(branch);
  }
 }else if(kind==='frostking'){
  part(r,0xc9dfdf,0,1.8,-.2,1.35,1.35,.95);part(r,0xe3ebe5,0,2.7,.35,.86,.85,.72);part(r,0x526d7b,0,2.65,.94,.55,.46,.20);eyes(r,0xb8f5ff,2.83,1.1,.25);
  for(const s of [-1,1]){const leg=limb(r,0x9cbdc8,s*.64,1.15,-.15,1.05,.39);part(leg,0xb9d4dc,0,-.95,.3,.4,.21,.58);d.legs.push(leg);const arm=limb(r,0xd6e4e2,s*1.17,2.65,.1,2.3,.44);part(arm,0x98b8c7,0,-2.3,.22,.48,.4,.5);d.arms.push(arm);for(let i=0;i<3;i++)part(r,0x92d7ee,s*(.25+i*.28),3.55-i*.13,.22,.16,.45-i*.06,.15,'cone',true);}
 }else if(kind==='cinderlord'){
  part(r,0xff9b4e,0,2,0,.66,.93,.65,'stone',true);part(r,0x342f38,0,3.2,.1,.56,.46,.43,'stone');eyes(r,0xffdc8c,3.22,.49,.25);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,p=joint(r,Math.sin(a)*1.05,2,Math.cos(a)*.9);part(p,0x51434a,0,0,0,.46,.82,.28,'stone');d.appendages.push(p);}
  for(const s of [-1,1]){const arm=limb(r,0x62515a,s*1.38,2.8,0,1.35,.31);part(arm,0xffbd6d,0,-1.35,.1,.22,.24,.22,'stone',true);d.arms.push(arm);part(r,0x4a3c43,s*.48,3.68,0,.18,.65,.2,'cone');}
  for(let i=0;i<4;i++){const a=i*1.57;part(r,0x4c4149,Math.sin(a)*.55,.75,Math.cos(a)*.5,.27,.5,.3,'stone');}
 }else{
  part(r,0xbda168,0,.85,0,1.16,.62,1.6);part(r,0x746240,0,1.1,.9,.85,.36,.67);eyes(r,0xffdc83,1.26,1.42,.4);
  for(const s of [-1,1])for(let i=0;i<3;i++){const leg=joint(r,s*.85,.75,.75-i*.75),seg=part(leg,0x91774c,s*.52,-.1,0,.66,.13,.14);seg.rotation.z=-s*.25;const lower=part(leg,0x68533b,s*1.05,-.45,.08,.14,.55,.14);lower.rotation.z=-s*.4;d.legs.push(leg);}
  for(const s of [-1,1]){const arm=joint(r,s*.9,.9,1),base=part(arm,0xa48953,s*.35,0,.65,.4,.28,.85);base.rotation.y=s*.3;const claw=joint(arm,s*.55,0,1.3);part(claw,0xcead69,s*.22,0,.3,.25,.26,.7);const finger=part(claw,0x70553b,-s*.19,0,.45,.18,.2,.62);finger.rotation.y=-s*.4;d.arms.push(arm);d.appendages.push(finger);}
  d.tail=joint(r,0,1,-1.25);let parent=d.tail;d.tailSegments=[];
  for(let i=0;i<5;i++){const seg=joint(parent,0,i? .43:0,i?-.15:0);part(seg,0x9c8050,0,.23,0,.28-i*.025,.35,.27-i*.025);seg.rotation.x=-.28;d.tailSegments.push(seg);parent=seg;}
  part(parent,0x3d3640,0,.25,.35,.17,.16,.65,'cone');
 }
 return g;
}
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function animateBoss(g,t,speed,dt){
 const d=g.userData,r=d.rig,stride=Math.min(1,speed/2.5);d.phase+=dt*(speed>0.05?speed*2.1:0);const p=d.phase;
 const wind=d.bossStage==='strike'?1-ease((d.strikeProgress||0)/.45):ease(d.windProgress||0),strike=d.bossStage==='strike',release=d.bossStage==='recover'?1-ease(d.recoverProgress):0,hit=strike?Math.sin(Math.PI*Math.min(1,(d.strikeProgress||0)*1.7)):0;
 r.position.set(0,(d.lift||0)+Math.abs(Math.sin(p))*.055*stride,0);r.rotation.set(-wind*.10+hit*.16,0,Math.sin(p)*.045*stride);r.scale.set(1,1,1);
 d.legs.forEach((leg,i)=>{leg.rotation.set(Math.sin(p+(i%2)*Math.PI)*.35*stride,0,0);});
 d.arms.forEach((arm,i)=>arm.rotation.set(Math.sin(p+i*Math.PI)*.3*stride-wind*1.3+hit*.65-release*.2,0,0));
 if(d.kind==='boss'){r.rotation.y=-wind*.3+hit*.35;d.arms.forEach((a,i)=>{a.rotation.z=(i?1:-1)*(-wind*.65-hit*.3);});d.appendages.forEach((a,i)=>a.rotation.z=(i?1:-1)*2.35+Math.sin(t*1.6+i)*.04);}
 if(d.kind==='frostking'){r.position.y-=wind*.5;r.rotation.x+=stride*.22;d.arms.forEach((a,i)=>{a.rotation.x=Math.sin(p+i*Math.PI)*.55*stride-wind*2.1+hit*.8-release*.4;});}
 if(d.kind==='cinderlord'){r.position.y=.25+Math.sin(t*1.8)*.18;r.rotation.z=Math.sin(t*.8)*.045;d.appendages.forEach((a,i)=>{const angle=i*Math.PI/3+t*.24,spread=1+wind*.25-hit*.08;a.position.set(Math.sin(angle)*1.05*spread,2+Math.sin(t*1.5+i)*.12,Math.cos(angle)*.9*spread);a.rotation.y=angle;});}
 if(d.kind==='dunescorpion'){
  r.rotation.x=wind*.07-hit*.08;r.rotation.z=Math.sin(p)*.025*stride;
  d.legs.forEach((leg,i)=>{const side=i<3?-1:1,f=p+(i%3)*2.1+(side>0?Math.PI:0);leg.rotation.set(0,Math.sin(f)*.32*stride,side*Math.max(0,Math.cos(f))*.20*stride);});
  d.arms.forEach((a,i)=>{const side=i?1:-1;a.rotation.set(-wind*.2,side*(wind*.48-hit*.65),0);});
  d.tail.rotation.set(-.15+Math.sin(t*1.6)*.08+(d.bossMove==='tail'?wind*.7-hit*1.2:0),Math.sin(p*.55)*.12*stride,0);
  d.tailSegments.forEach((s,i)=>s.rotation.x=-.28+Math.sin(t*1.7-i*.4)*.035);
  d.appendages.forEach((f,i)=>f.rotation.y=(i?1:-1)*(-.4-wind*.3+hit*.45));
 }
}
export function makeSandEnemy(kind){
 const g=model(kind),d=g.userData,r=d.rig;d.sandModel=true;d.organicModel=true;d.combatHeight={sandworm:.53,clawbeetle:.86,sandguard:1.85,sandspitter:2,duneoracle:2}[kind];
 if(kind==='sandworm'){
  const rings=[];for(let i=0;i<=22;i++){const z=-1.16+i*1.48/22,t=i/22,radius=.06+.23*Math.sin(t*Math.PI*.78),rib=1+(i%2?-.045:.045);rings.push([z,radius*rib,radius*.88*rib,0,.25]);}
  d.body=form(r,'Sandworm_AnnulatedBody',()=>[surface(0xb59a70,rings,{axis:'z',sides:16,flexible:(x,y,z)=>[Math.max(0,(.32-z)/1.48),z*6,.08,.008,.020],shade:(c,x,y)=>c.lerp(new T.Color(y<.23?0x75634a:0xc8b082),Math.abs(y-.25)*1.8)})]);
  d.head=organicJoint(r,0,.25,.25);form(d.head,'Sandworm_Mouth',()=>[surface(0x6f5840,[[-.06,.20,.16,0,0],[.04,.19,.15,0,0],[.08,.14,.10,0,0]],{axis:'z',sides:16}),oval(0x372f28,0,-.015,.082,.125,.084,.012),...face(0xdcc791,.085,.103,.104),...[-1,0,1].map(s=>tube(0xd6c7a2,[[s*.074,-.068,.081],[s*.063,-.030,.095],[s*.044,-.008,.094]],[.025,.020,.002],{steps:5,sides:5}))]);
 }else if(kind==='clawbeetle'){
  d.body=form(r,'Clawbeetle_JoinedCarapace',()=>[surface(0x9b8350,[[-.70,.03,.03,0,.42],[-.56,.33,.26,0,.48],[-.27,.49,.36,0,.48],[.12,.47,.32,0,.47],[.38,.31,.23,0,.43],[.51,.22,.18,0,.40],[.64,.10,.10,0,.37]],{axis:'z',sides:20,shade:(c,x,y,z)=>c.lerp(new T.Color(Math.abs(x)<.025?0x51442f:0xc0a369),y>.59?.35:0)}),...face(0xe1c675,.47,.582,.155),tube(0x665333,[[0,.805,-.50],[0,.837,-.24],[0,.77,.12]],[.009,.011,.007],{steps:10,sides:5})]);
  for(const s of[-1,1])for(let i=0;i<3;i++)d.legs.push(leg(r,'BeetleFoot',{x:s*.32,y:.39,z:.33-i*.31,side:s,reach:.47,a:.33,b:.34,width:.067,color:0x8e734b,foot:0x4d4737,phase:i%2*Math.PI+(s>0?Math.PI:0)}));
  d.jaws=[];for(const s of[-1,1]){const jaw=organicJoint(r,s*.19,.28,.54);form(jaw,'BeetleMandible_'+s,()=>[tube(0x524a36,[[0,0,0],[s*.07,-.015,.18],[s*.02,.015,.35],[-s*.07,.04,.39]],[.07,.068,.037,.002],{steps:11})]);d.jaws.push(jaw);}
 }else{
  const guard=kind==='sandguard',oracle=kind==='duneoracle',c=guard?0x817255:oracle?0x826c8b:0x738e89,trim=guard?0xc6ac74:oracle?0xb9a2b6:0xb7baa0;
  form(r,kind+'_TailoredBody',()=>[surface(c,[[.30,.23,.20],[.42,.31,.23],[.66,.28,.23],[.86,.25,.22],[1.07,guard?.36:.28,.25],[1.18,guard?.33:.25,.22],[1.24,.16,.15]],{sides:20,flute:.045}),tube(trim,[[-.22,1.08,.15],[-.16,.94,.23],[.03,.78,.24],[.22,.65,.18]],[.031,.039,.034,.024],{steps:13}),oval(0x61523c,-.25,.62,.03,.10,.15,.09)]);
  d.hem=organicJoint(r,0,.46,0);form(d.hem,kind+'_SplitCloth',()=>[surface(c,[[0,.28,.23],[-.08,.32,.24],[-.20,.35,.26]],{sides:20,flute:.065})]);
  d.head=organicJoint(r,0,1.44,0);form(d.head,kind+'_WrappedFace',()=>[surface(c,[[-.18,.15,.14],[-.09,.23,.19],[.10,.25,.21],[.24,.24,.20],[.36,.13,.13],[.39,.015,.015]],{flute:.035,sides:20}),oval(0xa68d6b,0,-.025,.166,.153,.137,.071),...[-1,1].flatMap(side=>[oval(0x3f3a30,side*.077,.023,.223,.047,.021,.017),oval(oracle?0xc1a5c7:0xc8b477,side*.079,.021,.237,.017,.012,.006,10,6)]),oval(0x79654d,0,-.037,.228,.027,.049,.025),tube(c,[[-.18,-.09,.11],[-.153,.055,.183],[-.082,.145,.199],[.085,.144,.198],[.16,.055,.180],[.18,-.09,.11]],[.037,.040,.043,.042,.039,.030],{steps:17}),tube(c,[[-.16,-.09,.155],[0,-.118,.207],[.16,-.09,.155]],[.03,.044,.03],{steps:10})]);
  d.forearms=[];
  for(const s of[-1,1]){d.legs.push(leg(r,'SandBoot',{x:s*.15,y:.48,z:0,a:.22,b:.25,width:.10,color:0x69604d,foot:0x4b453b,phase:s<0?0:Math.PI}));const arm=organicJoint(r,s*(guard?.33:.27),1.12,0),forearm=organicJoint(arm,0,-.245,.01);form(arm,kind+'_Sleeve',()=>[tube(c,[[0,.025,0],[s*.014,-.12,.015],[0,-.25,.01]],[.12,.11,.082],{steps:8})]);form(forearm,kind+'_Forearm',()=>[tube(c,[[0,.018,0],[0,-.13,.025],[0,-.245,.048]],[.084,.077,.058],{steps:8}),oval(0xbda981,0,-.275,.05,.064,.069,.074)]);forearm.rotation.x=-.24;d.arms.push(arm);d.forearms.push(forearm);}
  if(guard){
   form(d.forearms[0],'Sandguard_BoundShield',()=>[surface(0x9b8355,[[-.58,.045,.045,0,.11],[-.40,.28,.09,0,.11],[-.08,.32,.12,0,.11],[.20,.24,.10,0,.11],[.26,.05,.03,0,.11]],{sides:16}),tube(0xd4bc84,[[0,-.49,.22],[0,-.14,.245],[0,.19,.21]],[.027,.039,.026],{steps:8})]);
   form(d.forearms[1],'Sandguard_CurvedBlade',()=>[tube(0xb9b9a7,[[0,-.28,.05],[0,-.27,.30],[.04,-.23,.58],[.10,-.19,.77]],[.043,.042,.029,.001],{steps:12,sides:6}),oval(0x796141,0,-.28,.06,.052,.052,.15)]);
  }else{
   d.staff=organicJoint(d.forearms[1],0,-.26,.07);form(d.staff,kind+'_CrookedStaff',()=>[tube(0x6e5b42,[[0,-.65,0],[-.025,-.1,.01],[.02,.45,0],[.0,.84,.015],[-.07,.95,.02]],[.027,.032,.030,.031,.023],{steps:16}),tube(trim,[[-.07,.72,.015],[.11,.83,.02],[.06,.96,.025]],[.025,.026,.015],{steps:8})]);
   d.attackSocket=organicJoint(d.staff,0,.86,.02);d.focus=form(d.attackSocket,kind+'_Focus',()=>[oval(oracle?0xd8b5df:0xb1cab2,0,0,0,.10,.13,.09)],{glow:true});
  }
 }
 animateSandEnemy(g,0,0,0,0);
 return g;
}
export function animateSandEnemy(g,t,speed,attack,dt){
 const d=g.userData,r=d.rig,stride=Math.min(1,speed/3);d.phase+=speed*dt*3.2;const p=d.phase;
 const desiredWind=attack>0?1-Math.min(1,attack/(d.kind==='sandguard'?1.05:.7)):0;d.gather=(d.gather||0)+(desiredWind-(d.gather||0))*(1-Math.exp(-dt*8));const wind=d.gather;if(d.kind==='duneoracle')r.rotation.y=Math.sin(t*1.7)*.055;else r.rotation.y=0;
 if(d.previousAttack>0&&attack<=0)d.release=.3;d.previousAttack=attack;d.release=Math.max(0,(d.release||0)-dt);const rawStrike=Math.sin(Math.PI*d.release/.3);d.strike=(d.strike||0)+(rawStrike-(d.strike||0))*(1-Math.exp(-dt*9));const strike=d.strike;
 const beetle=d.kind==='clawbeetle',worm=d.kind==='sandworm';
 r.rotation.set(wind*(worm?.045:.045)-strike*.065,d.kind==='duneoracle'?Math.sin(t*1.1)*.025:0,Math.sin(p)*.018*stride);r.position.y=-wind*.025+Math.abs(Math.sin(p))*.012*stride;r.position.z=-wind*.025+strike*.035;
 if(worm){d.head.rotation.x=wind*.12-strike*.22;d.head.position.z=.25-wind*.02+strike*.045;r.rotation.z=0;}
 for(const l of d.legs)stepLeg(l,r,p,stride*(1-wind*.7),{travel:beetle?.10:.12,lift:beetle?.075:.09});
 if(d.jaws)d.jaws.forEach((j,i)=>j.rotation.y=(i?1:-1)*(wind*.24-strike*.18));
 d.arms.forEach((a,i)=>{a.rotation.set(Math.sin(p+i*Math.PI)*.12*stride-wind*(i?.75:.38)+strike*(i?.28:.10),wind*(i?.12:-.08),Math.sin(p-.5)*.025*stride);d.forearms[i].rotation.x=-.24-wind*(i?.42:.18)+strike*.16;});
 if(d.hem)d.hem.rotation.set(Math.sin(p-.5)*.045*stride+wind*.03,0,Math.sin(p-.7)*.035*stride);
 if(d.head&&!worm)d.head.rotation.set(wind*.055-strike*.07,Math.sin(t*.8)*.025*(1-stride),Math.sin(p-.4)*.015*stride);
}

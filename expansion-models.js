import {creatureAttackPose} from './creature-gait.js?v=204';
import {ENEMY_MOTION} from './enemy-motion.js?v=204';
import * as T from './vendor/three.module.js';
import {form,surface,tube,oval,tint,joint as organicJoint,leg,stepLeg} from './creature-forms.js?v=204';
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
  const rings=[];for(let i=0;i<=36;i++){const z=-1.20+i*1.49/36,t=i/36,radius=.032+.205*Math.sin(t*Math.PI*.71),rib=1+.085*Math.cos(i*Math.PI);rings.push([z,radius*rib,radius*.78*rib,0,.215]);}
  d.body=form(r,'Sandworm_ArmoredBackAndBelly',()=>[surface(0x8e714d,rings,{axis:'z',sides:20,caps:false,flexible:(x,y,z)=>[Math.max(0,(.29-z)/1.49),z*7,.065,.004,.018],shade:(c,x,y,z)=>c.lerp(new T.Color(y<.16?0xd1b985:0x514c37),y<.16?.6:.18+.17*Math.sin((z+1.20)*Math.PI*36/1.49)**2)}),oval(0x8e714d,0,.215,-1.201,.035,.028,.008,12,6),tube(0x9d8151,[[0,.29,-1.08],[.015,.35,-.78],[-.012,.412,-.42],[0,.428,-.08],[0,.413,.21]],[.014,.028,.032,.036,.024],{steps:22,sides:6,flexible:(x,y,z)=>[Math.max(0,(.29-z)/1.49),z*7,.065,.004,.018]})]);
  d.head=organicJoint(r,0,.25,.265);form(d.head,'Sandworm_OpenRadialMaw',()=>[tint(new T.TorusGeometry(.216,.042,8,24).scale(1,.83,1).translate(0,0,.055),0x79563f),surface(0x51362b,[[-.11,.022,.020],[-.08,.042,.035],[-.052,.053,.044],[-.031,.086,.067],[-.009,.102,.079],[.01,.139,.105],[.027,.157,.122],[.052,.196,.157]],{axis:'z',sides:24,caps:false,inside:true,flute:.075,shade:(c,x,y,z)=>c.lerp(new T.Color(0x977454),T.MathUtils.smoothstep(z,-.06,.052)*(.20+.24*Math.sin(Math.atan2(y,x)*8)**2))}),oval(0x171c17,0,0,-.115,.031,.026,.008,10,6),...Array.from({length:7},(_,i)=>{const a=i*Math.PI*2/7,geo=tube(0xbaac7c,[[Math.sin(a)*.202,Math.cos(a)*.166,.071],[Math.sin(a)*.16,Math.cos(a)*.124,.055],[Math.sin(a)*.12,Math.cos(a)*.08,.018]],[.027,.022,.002],{sides:5,steps:7}),p=geo.attributes.position,c=geo.attributes.color,bone=new T.Color(0xc2b17b),root=new T.Color(0x76543c),shade=new T.Color();for(let j=0;j<p.count;j++){shade.copy(bone).lerp(root,T.MathUtils.smoothstep(p.getZ(j),.045,.082));c.setXYZ(j,shade.r,shade.g,shade.b);}return geo;})]);
 }else if(kind==='clawbeetle'){
  d.body=form(r,'Clawbeetle_DividedElytra',()=>[surface(0x685735,[[-.77,.025,.021,0,.27],[-.60,.28,.15,0,.30],[-.36,.43,.23,0,.33],[-.02,.44,.25,0,.34],[.22,.36,.23,0,.33],[.38,.24,.16,0,.32]],{axis:'z',sides:28,deform:(x,y,z,a)=>[x,y-(y>.34?.027*Math.exp(-((x/.025)**2))+.010*Math.max(0,Math.cos(a*12))**8:0),z],shade:(c,x,y,z)=>{const seam=Math.abs(x)<.027,groove=Math.max(0,Math.cos(Math.atan2(y-.33,x)*12))**8;c.lerp(new T.Color(seam?0x282b20:y<.25?0x333927:0xb49352),seam?.75:y<.25?.5:.18+.19*(1-groove));if(y>.35)c.multiplyScalar(1-groove*.26);}}),surface(0x444632,[[.22,.22,.15,0,.31],[.39,.255,.175,0,.31],[.51,.185,.13,0,.29],[.59,.115,.075,0,.265]],{axis:'z',sides:20}),...[-1,1].flatMap(side=>[oval(0x212921,side*.176,.378,.473,.042,.018,.033,10,6),tube(0x6e603a,[[side*.13,.34,.52],[side*.22,.415,.62],[side*.255,.51,.75]],[.015,.013,.006],{sides:5,steps:10}),tube(0x8e7949,[[side*.075,.24,.57],[side*.085,.20,.64],[side*.042,.19,.69]],[.022,.016,.008],{sides:5,steps:6})])]);
  for(const side of[-1,1])for(let i=0;i<3;i++)d.legs.push(leg(r,'Beetle_HookedTarsus_'+side,{x:side*.30,y:.31,z:.28-i*.29,side,reach:.43,a:.30,b:.28,width:.061,color:0x70603b,foot:0x30372a,sole:'point',phase:i%2*Math.PI+(side>0?Math.PI:0)}));
  d.jaws=[];for(const side of[-1,1]){const jaw=organicJoint(r,side*.135,.235,.53);form(jaw,'Beetle_CuttingMandible_'+side,()=>[tube(0x3f3926,[[0,0,0],[side*.11,-.015,.15],[side*.095,-.017,.32],[-side*.055,.016,.40]],[.067,.092,.065,.003],{steps:13,sides:8}),tube(0xa48b53,[[side*.12,.025,.21],[side*.05,.028,.26],[side*.02,.018,.32]],[.018,.023,.002],{steps:6,sides:5})]);d.jaws.push(jaw);}
 }else{
  const guard=kind==='sandguard',oracle=kind==='duneoracle',c=guard?0x665d43:oracle?0x605868:0x586c63,trim=guard?0x9f895d:oracle?0x948476:0x94947a;
  d.clothColor=c;d.forearms=[];
  const torso=guard?[[.52,.22,.15],[.69,.255,.18],[.83,.235,.18],[1.04,.31,.21],[1.20,.345,.205],[1.30,.25,.18],[1.36,.13,.115]]:[[.47,.26,.16],[.72,.22,.17],[.91,.23,.18],[1.12,.29,.20],[1.24,.255,.17],[1.34,.115,.10]];
  d.body=form(r,kind+'_CutAndWrappedTorso',()=>[surface(c,torso,{sides:24,flute:.028,shade:(color,x,y)=>color.lerp(new T.Color(0xb5a27c),.12*(1-T.MathUtils.smoothstep(y,.5,1.1)))}),surface(guard?0x827258:c,[[1.12,guard?.365:.325,.22],[1.24,guard?.36:.34,.21],[1.34,.19,.14],[1.41,.11,.105]],{sides:24,flute:.025,deform:(x,y,z,a,j)=>[x,y-(j===0?.035*(.5+.5*Math.sin(a*4)):0),z]}),tube(trim,[[-.23,1.20,.15],[-.17,1.05,.215],[.04,.86,.196],[.20,.72,.13]],[.018,.022,.021,.014],{steps:14,sides:6})]);
  d.hem=organicJoint(r,0,.73,0);form(d.hem,kind+'_WeatheredSplitHem',()=>[surface(c,guard?[[0,.25,.18],[-.12,.29,.19],[-.26,.31,.195]]:[[0,.24,.17],[-.15,.28,.20],[-.34,.36,.22],[-.49,.39,.23]],{sides:28,flute:guard?.06:.10,deform:(x,y,z,a,j)=>[x,y+(j===(guard?2:3)?.042*Math.sin(a*5)+.025*Math.sin(a*9):0),z],shade:(color,x,y,z)=>color.lerp(new T.Color(0xb1a07f),T.MathUtils.smoothstep(-y,.17,.49)*.22)})]);
  d.head=organicJoint(r,0,guard?1.48:1.50,0);
  const hood=guard?[[-.20,.135,.10],[-.09,.19,.145],[.10,.205,.16],[.23,.185,.155],[.31,.10,.105],[.35,.025,.025]]:oracle?[[-.21,.14,.115],[-.08,.205,.17],[.13,.20,.17],[.30,.155,.15],[.39,.06,.085],[.415,.004,.012]]:[[.06,.18,.14],[.12,.25,.185,-.018,0],[.21,.245,.18,.014,-.004],[.28,.195,.145,.025,-.014],[.305,.05,.04,.025,-.014]];
  form(d.head,kind+'_WindwornHeadwrap',()=>[
   surface(guard?0x796b50:oracle?0xb1ac91:0x8c7758,[[-.25,.085,.085,0,.01],[-.15,.10,.09,0,.025],[-.07,.115,.105,0,.045],[.045,.14,.145,0,.068],[.14,.145,.13,0,.045],[.23,.085,.085,0,.025],[.25,.008,.015,0,.02]],{sides:12,shade:(color,x,y)=>color.multiplyScalar(.88+.12*T.MathUtils.smoothstep(y,-.20,.12))}),
   surface(guard||oracle?c:0x8e8d73,hood,{sides:24,flute:.028,deform:(x,y,z)=>[x,y,z+(oracle?-.025*Math.max(0,y):0)]}),
   ...[-1,1].flatMap(side=>[oval(0x2e392c,side*.058,.048,.204,.029,.009,.006,10,4),oval(oracle?0xbab393:0xb9ac83,side*.054,.049,.209,.007,.006,.0025,6,4),tube(guard?0x5a513d:oracle?0x726d59:0x665e45,[[side*.020,.066,.202],[side*.053,.075,.206],[side*.091,.073,.198]],[.008,.012,.006],{sides:4,steps:5})]),
   ...(guard||oracle?[tube(c,[[-.17,-.05,.08],[-.135,.13,.16],[-.07,.20,.165],[.075,.19,.16],[.15,.115,.15],[.18,-.055,.085]],[.038,.04,.043,.040,.036,.025],{steps:18,sides:7})]:[
    tube(0xa19e82,[[-.21,.12,.11],[-.11,.135,.19],[.08,.19,.195],[.235,.205,.10]],[.032,.034,.037,.022],{steps:14,sides:7}),
    surface(0x92957c,[[-.065,.12,.026,-.025,.17],[-.18,.075,.025,-.09,.185],[-.35,.065,.022,-.145,.225],[-.51,.067,.020,-.165,.24],[-.665,.056,.012,-.18,.237]],{sides:14,flute:.085,deform:(x,y,z,a,j)=>[x,y+(j===4?.013*Math.sin(a*3):0),z]})
   ]),
   tube(guard||oracle?trim:0x9a9a7f,[[-.16,-.055,.12],[-.04,-.092,.199],[.085,-.081,.18],[.18,-.048,.12]],[.024,.035,.031,.019],{steps:12,sides:7}),
   tube(oracle?0x3f3c46:guard?0x493f2c:0x686a52,oracle?[[-.157,.10,.143],[-.12,.24,.128],[-.054,.354,.08]]:guard?[[-.185,.08,.114],[-.152,.225,.107],[-.081,.299,.087]]:[[-.19,.158,.168],[-.08,.19,.205],[.07,.226,.181],[.17,.244,.128]],[.006,.009,.006],{sides:4,steps:8})
  ]);
  for(const side of[-1,1]){
   d.legs.push(leg(r,guard?'Sandguard_BoundBoot':'Sandcaster_WornBoot',{x:side*.14,y:.64,z:0,a:.305,b:.31,width:guard?.106:.093,color:0x514e3c,foot:0x3c3d31,phase:side<0?0:Math.PI}));
   const arm=organicJoint(r,side*(guard?.305:.275),1.19,0),forearm=organicJoint(arm,side*.012,-.265,.013);
   form(arm,kind+'_DrapedShoulder_'+side,()=>[surface(c,[[.065,.115,.12,-side*.045,-.01],[.01,.145,.14,-side*.008,0],[-.12,.12,.12,side*.012,.015],[-.26,.08,.075,side*.012,.013]],{sides:18,flute:.025})]);
   form(forearm,kind+'_TaperedCuff',()=>[surface(c,[[.032,.072,.07],[.008,.088,.085],[-.07,.084,.081,0,.01],[-.19,.068,.067,0,.025],[-.25,.068,.064,0,.038]],{sides:12,flute:.035}),oval(0x9a8563,0,-.284,.04,.054,.064,.064,12,8)]);forearm.rotation.x=-.24;d.arms.push(arm);d.forearms.push(forearm);
  }
  if(guard){
   form(d.forearms[0],'Sandguard_ErodedShield',()=>[surface(0x7c6e45,[[-.54,.038,.035,0,.105],[-.37,.255,.055,0,.105],[-.05,.295,.073,0,.105],[.21,.205,.06,0,.105],[.25,.038,.029,0,.105]],{sides:20,deform:(x,y,z)=>[x,z>.105?y+.01*Math.sin(x*13):y,z],shade:(color,x,y,z)=>color.lerp(new T.Color(0xb09b6a),.15+.16*Math.sin(x*15+y*8)**2)}),tube(0x413e2b,[[0,-.44,.172],[-.014,-.18,.184],[.012,.12,.172]],[.016,.024,.017],{steps:10})]);
   form(d.forearms[1],'Sandguard_CrescentCutlass',()=>[surface(0x94927b,[[.045,.038,.028,0,-.275],[.26,.040,.035,0,-.275],[.49,.063,.027,.03,-.247],[.70,.021,.012,.09,-.19]],{axis:'z',sides:12}),tube(0x5e4c34,[[0,-.28,-.05],[0,-.28,.06],[0,-.28,.18]],[.037,.038,.025],{steps:7,sides:7})]);
  }else{
   d.staff=organicJoint(d.forearms[1],0,-.26,.055);
   form(d.staff,kind+'_WeatheredFocusStaff',()=>[tube(0x554d36,[[0,-.66,0],[-.022,-.12,.01],[.016,.39,0],[.015,.69,.015],[-.05,.88,.02]],[.03,.03,.027,.036,.018],{steps:19,sides:8}),...(oracle?[-1,1].map(side=>tube(0x918063,[[0,.70,.015],[side*.09,.82,.024],[side*.095,.93,.02],[side*.044,.97,.018]],[.04,.033,.027,.011],{steps:11,sides:7})):[surface(0x6f7853,[[.68,.055,.052],[.74,.10,.081],[.84,.08,.070],[.90,.049,.041]],{sides:14,flute:.05})])]);
   d.attackSocket=organicJoint(d.staff,0,.835,.022);d.focus=form(d.attackSocket,kind+'_SunkenFocus',()=>[oval(oracle?0xa590b0:0x98a16d,0,0,0,oracle?.045:.037,oracle?.065:.043,.031,10,6)],{glow:true});
  }
 }
 animateSandEnemy(g,0,0,0,0);return g;
}
export function animateSandEnemy(g,t,speed,attack,dt){
 const d=g.userData,r=d.rig,walking=d.legs.length>0,travel=d.kind==='clawbeetle'?.24:.22,desiredStride=Math.min(1,speed/(d.kind==='clawbeetle'?1.8:.85));
 if(walking)d.walkStride=(d.walkStride||0)+(desiredStride-(d.walkStride||0))*(1-Math.exp(-dt*14));
 const stride=walking?d.walkStride:Math.min(1,speed/3);
 // Keep support feet in place as the body passes over them, instead of a
 // short decorative shuffle unrelated to actual movement distance.
 d.phase+=speed*dt*(walking?Math.PI*.64/(travel*Math.max(.01,desiredStride)):3.2);const p=d.phase;
 const {wind,strike}=creatureAttackPose(d,attack,dt,ENEMY_MOTION[d.kind]?.recover||.3);
 const beetle=d.kind==='clawbeetle',worm=d.kind==='sandworm',guard=d.kind==='sandguard',oracle=d.kind==='duneoracle',sway=Math.sin(p)*stride;
 r.rotation.set(wind*(worm?.045:.045)-strike*.065,d.kind==='duneoracle'?Math.sin(t*1.1)*.025:0,Math.sin(p)*.018*stride);r.position.y=-wind*.025+Math.abs(Math.sin(p))*.012*stride;r.position.z=-wind*.025+strike*.035;
 if(worm){const breathe=Math.sin(t*2.2)*.012*(1-stride)*(1-wind);d.head.rotation.x=wind*.14-strike*.17;d.head.position.z=.265-wind*.035+strike*.055;d.head.scale.set(1+wind*.10+strike*.06+breathe,1+wind*.10+strike*.06+breathe,1);r.rotation.z=0;r.position.y=0;}
 if(beetle){r.position.set(sway*.006,-wind*.019+Math.abs(Math.sin(p*2))*.004*stride,-wind*.017+strike*.025);r.rotation.set(wind*.055-strike*.075,Math.sin(p-.4)*.008*stride,sway*.009);}
 else if(!worm){
  r.position.set(sway*(guard?.016:oracle?.010:.021),-wind*.025+Math.abs(Math.sin(p))*(guard?.009:oracle?.008:.012)*stride,-wind*.022+strike*.018);
  r.rotation.set((guard?.025:oracle?.012:.065)*stride+wind*(guard?-.04:oracle?-.055:.11)+strike*(guard?.06:oracle?.035:-.075),Math.sin(p-.35)*.014*stride+(guard?-wind*.09+strike*.11:oracle?wind*.04-strike*.03:0),sway*(guard?.025:oracle?.018:.035));
 }
 for(const l of d.legs)stepLeg(l,r,p,stride,{travel,lift:beetle?.065:guard?.070:oracle?.058:.085});
 if(d.jaws)d.jaws.forEach((j,i)=>j.rotation.y=(i?1:-1)*(wind*(i?.27:.21)-strike*(i?.20:.16)+Math.max(0,Math.sin(t*2.7+i*.6))*.026*(1-stride)*(1-wind)));
 d.arms.forEach((a,i)=>{
  const walk=Math.sin(p+i*Math.PI-.45)*stride,side=i?1:-1,forearm=d.forearms[i];
  if(guard){
   // The left shoulder carries the shield while the right elbow folds the
   // blade back, then opens across the body; neither hand leaves its wrist.
   a.rotation.set(i?-.12+walk*.10-wind*.94+strike*.67:-.42+walk*.035-wind*.22+strike*.12,i?-wind*.24+strike*.32:-.15-wind*.08,side*(.035+wind*.06));
   forearm.rotation.set(i?-.30-wind*.66+strike*.27:-.62-wind*.20+strike*.10,0,i?-wind*.08:0);
  }else if(oracle){
   a.rotation.set(i?-.16+walk*.025-wind*.49+strike*.24:walk*.065-wind*.43+strike*.17,side*wind*.11,side*(.035+wind*.08));
   forearm.rotation.set(i?-.30-wind*.43+strike*.15:-.22-wind*.75+strike*.25,0,0);
  }else{
   a.rotation.set(i?-.12+walk*.045-wind*.65+strike*.28:walk*.12-wind*.23+strike*.13,i?wind*.08:-wind*.12,side*(.02+wind*.055));
   forearm.rotation.set(i?-.27-wind*.40+strike*.21:-.20-wind*.39+strike*.12,0,0);
  }
 });
 if(d.hem)d.hem.rotation.set(Math.sin(p-.65)*.045*stride+wind*.03,0,Math.sin(p-.85)*.035*stride);
 if(d.head&&!worm)d.head.rotation.set(-r.rotation.x*.45+wind*(oracle?-.035:.045)-strike*.045,Math.sin(t*.8)*.025*(1-stride)-r.rotation.y*.55,-r.rotation.z*.45);
}

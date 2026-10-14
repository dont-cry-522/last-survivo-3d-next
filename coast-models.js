import * as T from './vendor/three.module.js';
import{weaponInlay,nameWeapon}from'./weapon-identity.js?v=195';
import{form,surface,tube,oval,face,joint as organicJoint,leg,stepLeg}from'./creature-forms.js?v=195';
const geometries=new Map(),materials=new Map();
function part(p,color,pos,size,type='sphere',glow=false){
 if(!geometries.has(type))geometries.set(type,type==='rock'?new T.DodecahedronGeometry(1,1):type==='box'?new T.BoxGeometry(2,2,2):type==='cone'?new T.ConeGeometry(1,2,12):type==='barrel'?new T.CylinderGeometry(.88,1,2,10):type==='hoop'?new T.TorusGeometry(1,.055,5,12):new T.SphereGeometry(1,16,12));
 const key=color+':'+glow;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.62,metalness:.08,emissive:glow?color:0,emissiveIntensity:glow?.6:0}));
 const m=new T.Mesh(geometries.get(type),materials.get(key));m.position.set(...pos);m.scale.set(...size);m.castShadow=m.receiveShadow=true;p.add(m);return m;
}
const joint=(p,x,y,z)=>{const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;};
function eye(p,x,y,z){part(p,0x122e38,[x,y,z],[.07,.08,.05]);part(p,0xd4ffff,[x-.018,y+.025,z+.037],[.018,.019,.01], 'sphere',true);}
function makeCoastCreature(kind){
 const g=new T.Group(),r=organicJoint(g),d=g.userData={kind,rig:r,coastModel:true,organicModel:true,legs:[],claws:[],elbows:[],tips:[],arms:[],eyes:[],phase:0,combatHeight:{foamling:1.16,tidecrab:.97,reefturtle:1.2,jellyseer:1.42,tidestar:.70}[kind]};
 if(kind==='foamling'){
  // A crawling swell rolls forward over its low, broad sole; no human face.
  d.body=form(r,'Foamling_RollingSwell',()=>[surface(0x427e7c,[[-.72,.05,.025,0,.065],[-.57,.31,.085,0,.14],[-.30,.47,.20,0,.23],[.03,.49,.29,0,.32],[.34,.35,.22,0,.29],[.57,.20,.095,0,.15],[.66,.025,.026,0,.074]],{axis:'z',sides:24,flute:.035,shade:(c,x,y)=>c.lerp(new T.Color(0xa4c4b6),T.MathUtils.smoothstep(y,.35,.61))})]);
  d.crest=organicJoint(r);form(d.crest,'Foamling_CurlingFoamLip',()=>[tube(0x94bcb0,[[0,.30,-.43],[0,.57,-.30],[0,.86,-.02],[0,.94,.22],[0,.79,.34],[0,.69,.23]],[.13,.15,.13,.105,.087,.045],{sides:12,steps:26,flexible:(x,y,z)=>[T.MathUtils.smoothstep(y,.32,.9),z*5,.015,.035,.025]}).scale(3.05,1,1),tube(0xc2d5bf,[[-.34,.84,.03],[-.19,.955,.17],[.02,.986,.23],[.25,.93,.18],[.34,.80,.08]],[.027,.036,.028,.024,.012],{sides:6,steps:18})]);
 }else if(kind==='tidecrab'){
  d.body=form(r,'Tidecrab_LowArmoredCarapace',()=>[surface(0x8c5946,[[-.61,.06,.035,0,.33],[-.48,.46,.11,0,.40],[-.26,.64,.17,0,.43],[.04,.67,.20,0,.44],[.28,.54,.15,0,.43],[.46,.33,.12,0,.405],[.54,.17,.065,0,.385]],{axis:'z',sides:28,deform:(x,y,z,a)=>[x*(1+.045*Math.cos(a*8)),y,z],shade:(c,x,y,z)=>c.lerp(new T.Color(y<.36?0x473d32:0xb9835b),y<.36?.55:.18+.22*Math.sin(z*9)**2)}),...[-1,1].flatMap(side=>[tube(0x4c3e32,[[side*.12,.55,.51],[side*.34,.55,.39],[side*.48,.57,.19],[side*.43,.56,-.13]],[.014,.017,.016,.008],{steps:12}),tube(0x685242,[[side*.49,.43,-.30],[side*.68,.42,-.32],[side*.75,.39,-.38]],[.06,.042,.003],{steps:7}),tube(0xb59466,[[side*.17,.405,.53],[side*.44,.437,.34],[side*.65,.447,.05],[side*.61,.415,-.25],[side*.43,.387,-.48]],[.009,.019,.022,.016,.007],{steps:16,sides:5})]),tube(0x322f29,[[-.14,.335,.536],[0,.30,.572],[.14,.335,.536]],[.018,.026,.018],{steps:8})]);
  for(const side of[-1,1]){
   const eye=organicJoint(r,side*.21,.51,.40);form(eye,'Tidecrab_WatchfulEyestalk_'+side,()=>[tube(0x685340,[[0,0,0],[side*.03,.13,.03],[side*.045,.21,.035]],[.032,.029,.031],{steps:7}),oval(0x202925,side*.049,.238,.051,.049,.032,.036,10,6),oval(0x9b9c70,side*.049,.237,.082,.020,.020,.006,8,5),oval(0xd3cc9f,side*.041,.247,.087,.006,.006,.003,6,4)]);d.eyes.push(eye);
   for(let i=0;i<3;i++)d.legs.push(leg(r,'Tidecrab_SideLeg_'+side,{x:side*.45,y:.31,z:.27-i*.28,side,reach:.45,a:.30,b:.31,width:.082,color:0x9c7050,foot:0x423c32,sole:'point',phase:(i%2+(side>0?1:0))*Math.PI}));
   const claw=organicJoint(r,side*.40,.35,.32);form(claw,'Tidecrab_ProximalCheliped_'+side,()=>[tube(0x9c6a4b,[[-side*.025,0,-.025],[side*.13,-.025,.20],[side*.21,.035,.43]],[.12,.112,.125],{steps:10,sides:8})]);
   const elbow=organicJoint(claw,side*.21,.035,.43);form(elbow,'Tidecrab_PincerPalm_'+side,()=>[tube(0x9c6a4b,[[0,0,-.018],[-side*.02,.025,.10],[-side*.04,.04,.19]],[.126,.15,.105],{steps:7,sides:10}),tube(0xb38358,[[-side*.02,.04,.11],[side*.10,.025,.33],[side*.09,-.01,.57],[-side*.03,-.035,.69]],[.12,.092,.060,.003],{steps:14,sides:8}),tube(0x604837,[[side*.06,.029,.34],[-side*.01,.025,.375],[side*.05,.015,.425]],[.026,.02,.016],{steps:6,sides:5})]);
   const finger=organicJoint(elbow,-side*.11,.015,.18);form(finger,'Tidecrab_LockingFinger_'+side,()=>[tube(0x715239,[[0,0,0],[-side*.08,-.025,.19],[-side*.016,-.037,.35],[side*.075,-.05,.50]],[.086,.071,.045,.002],{steps:12}),...Array.from({length:3},(_,i)=>tube(0xc5ad7c,[[-side*(.006-i*.011),-.02,.12+i*.082],[side*(.044+i*.004),-.018,.143+i*.082],[side*(.040+i*.003),-.018,.158+i*.082]],[.022,.010,.001],{sides:5,steps:4}))]);d.claws.push(claw);d.elbows.push(elbow);d.tips.push(finger);
  }
 }else if(kind==='reefturtle'){
  form(r,'Reefturtle_BroadPlastron',()=>[surface(0x626f54,[[-.75,.045,.025,0,.31],[-.56,.52,.12,0,.33],[-.19,.64,.17,0,.34],[.30,.62,.16,0,.33],[.61,.33,.08,0,.34]],{axis:'z',sides:22}),tube(0x5c6850,[[0,.30,-.63],[0,.22,-.84],[0,.14,-.96]],[.083,.054,.003],{steps:9})]);
  const shellY=(x,z)=>.47+.39*Math.sqrt(Math.max(0,1-(x/.70)**2-(z/.82)**2));
  d.shell=form(r,'Reefturtle_LowPlateShell',()=>{
   const parts=[surface(0x45594d,[[.43,.62,.77],[.48,.71,.84],[.56,.69,.81],[.66,.62,.74],[.75,.51,.64],[.815,.35,.49],[.85,.15,.26],[.858,.006,.03]],{sides:40,shade:(c,x,y,z)=>c.lerp(new T.Color(0x9b9b77),.08+.16*Math.sin(z*5+x*3)**2+(y<.57?.30*Math.max(0,Math.sin(x*17+z*11))**3:0))})];
   for(const side of[-1,1])parts.push(tube(0x263b32,[-.64,-.43,-.18,.08,.33,.57].map((z,i)=>{const x=side*(i===0||i===5?.14:i%2?.26:.20);return[x,shellY(x,z)+.003,z];}),[.012,.016,.015,.014,.016,.009],{steps:20,sides:5}));
   for(const z of[-.39,.02,.39])parts.push(tube(0x263b32,[-.53,-.31,-.20,0,.20,.31,.53].map((x,i)=>[x,shellY(x,z)+.003,z+(i%2?.035:0)]),[.009,.014,.014,.015,.014,.014,.009],{steps:20,sides:5}));
   parts.push(tube(0x75826a,[[0,.81,-.31],[.02,.995,-.22],[-.015,1.02,-.08],[.02,.91,.10]],[.10,.10,.08,.035],{sides:8,steps:12}),tube(0x5c7360,[[-.33,.74,-.23],[-.30,.86,-.12],[-.26,.795,.04]],[.083,.072,.025],{sides:7,steps:8}));return parts;
  });
  d.head=organicJoint(r,0,.37,.50);form(d.head,'Reefturtle_ExtendedNeckBeak',()=>[surface(0x879577,[[-.19,.13,.115],[.06,.13,.125,0,-.015],[.24,.17,.14,0,.005],[.42,.20,.135,0,.005],[.58,.145,.09,0,-.018],[.66,.085,.05,0,-.022]],{axis:'z',sides:20,shade:(c,x,y,z)=>c.lerp(new T.Color(y<0?0xb1b493:0x536e58),y<0?.22:.18)}),surface(0x605d46,[[.54,.135,.067,0,-.021],[.66,.091,.055,0,-.047],[.71,.031,.034,0,-.075]],{axis:'z',sides:12}),...[-1,1].map(side=>tube(0x5b7357,[[side*.123,.065,.451],[side*.151,.084,.459],[side*.185,.078,.432],[side*.195,.062,.409]],[.012,.019,.015,.009],{sides:5,steps:8})),tube(0x36483a,[[-.12,-.055,.57],[0,-.062,.665],[.12,-.055,.57]],[.011,.014,.011],{steps:10})]);
  for(const side of[-1,1]){const eye=organicJoint(d.head,side*.158,.057,.43);form(eye,'Reefturtle_LiddedEye_'+side,()=>[oval(0x202d23,0,0,0,.037,.018,.028,10,6),oval(0xb2a575,side*.012,.001,.022,.013,.009,.008,8,5),oval(0x30372b,side*.012,.001,.028,.004,.008,.003,6,4)]);d.eyes.push(eye);}
  // A walking turtle transfers weight around four feet, rather than lifting
  // both diagonal pairs together like a trotting quadruped.
  for(const side of[-1,1])for(const z of[-.39,.38])d.legs.push(leg(r,'Reefturtle_HeavyToes',{x:side*.44,y:.29,z,side,reach:.14,a:.22,b:.20,width:.148,color:0x63795d,foot:0x393d2c,sole:'toes',phase:(side<0?(z<0?0:3):(z<0?2:1))*Math.PI/2}));
 }else if(kind==='jellyseer'){
  d.body=form(r,'Jellyseer_TranslucentUmbrella',()=>[surface(0x8baaaa,[[.91,.48,.43],[.955,.61,.56],[1.00,.59,.55],[1.12,.50,.47],[1.24,.34,.34],[1.31,.16,.17],[1.34,.006,.008]],{sides:32,deform:(x,y,z,a,j)=>[x,y+(j<2?.026*Math.cos(a*10):0),z],shade:(c,x,y)=>c.lerp(new T.Color(0xc5d3be),T.MathUtils.smoothstep(y,1.12,1.34))})],{translucent:true});
  d.inner=form(r,'Jellyseer_RadialCanals',()=>[surface(0x527f83,[[.91,.28,.27],[.97,.34,.33],[1.075,.29,.28],[1.16,.17,.18],[1.20,.008,.008]],{sides:20,shade:(c,x,y,z)=>c.lerp(new T.Color(0xaaa9a6),.28*Math.sin(Math.atan2(x,z)*4)**2)}),...Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return tube(0xb7cbc0,[[Math.sin(a)*.09,1.28,Math.cos(a)*.09],[Math.sin(a)*.37,1.19,Math.cos(a)*.35],[Math.sin(a)*.53,1.02,Math.cos(a)*.48],[Math.sin(a)*.56,.954,Math.cos(a)*.51]],[.009,.015,.018,.010],{sides:5,steps:12});}),...Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return tube(0x96b9b3,[[Math.sin(a)*.38,1.17,Math.cos(a)*.37],[Math.sin(a+.14)*.48,1.10,Math.cos(a+.14)*.46],[Math.sin(a+.28)*.56,.963,Math.cos(a+.28)*.51]],[.010,.008,.004],{sides:4,steps:6});})]);
  d.tentacles=form(r,'Jellyseer_OralArmsAndThreads',()=>[...Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,x=Math.sin(a)*.43,z=Math.cos(a)*.40,end=.06+(i%3)*.055;return tube(0x769a98,[[x,.955,z],[x*1.01,.72,z*1.03],[x*.83,.42,z*.82],[x*.89,end+.1,z*1.07],[x*.63,end,z*.92]],[.014,.016,.013,.008,.002],{steps:19,sides:5,flexible:(px,y,pz)=>[Math.max(0,(.94-y)/.90),a-y*4,.055,.045,.02]});}),...Array.from({length:4},(_,i)=>{const a=i*Math.PI/2+.4,x=Math.sin(a)*.13,z=Math.cos(a)*.13;return tube(0xa0b8ac,[[x,.96,z],[x*1.5,.70,z*.5],[x*.4,.47,z*1.6],[x*1.4,.30,z*.5],[x*.6,.18+i*.02,z]],[.059,.057,.036,.024,.004],{steps:18,sides:7,flexible:(px,y,pz)=>[Math.max(0,(.94-y)/.90),a-y*3,.042,.038,.019]});})]);
  d.attackSocket=organicJoint(r,0,.88,.12);
 }else{
  d.body=form(r,'Tidestar_ThickFiveArms',()=>{
   const positions=[],indices=[],sides=80,rows=[.18,.38,.64,.83,1],colors=[],f=[],bend=[],color=new T.Color(),base=new T.Color(0x8e6553),ridge=new T.Color(0xc0956e);
   const vertex=(layer,u,a)=>{const arm=(.5+.5*Math.cos(a*5))**2,r=(.27+.64*arm)*u,channel=Math.max(0,Math.cos(a*5))**20,y=layer?.125+.28*(1-u*u)+.065*arm*u-.030*channel*u:.055+.014*u;positions.push(Math.sin(a)*r,y,Math.cos(a)*r);color.copy(base).lerp(ridge,layer?(.12+arm*.22+.12*Math.sin(u*29+a*5)**2):.03);if(layer&&channel>.7&&u>.25)color.multiplyScalar(.56);colors.push(color.r,color.g,color.b);f.push(u*u*.60,a*2);bend.push(.012,.009,.033);};
   for(const layer of[0,1]){vertex(layer,0,0);for(const u of rows)for(let i=0;i<sides;i++)vertex(layer,u,i/sides*Math.PI*2);}
   const stride=1+rows.length*sides;for(const layer of[0,1]){const offset=layer*stride;for(let i=0;i<sides;i++){const a=offset+1+i,b=offset+1+(i+1)%sides;indices.push(...(layer?[offset,a,b]:[offset,b,a]));}for(let row=0;row<rows.length-1;row++)for(let i=0;i<sides;i++){const a=offset+1+row*sides+i,b=offset+1+row*sides+(i+1)%sides;indices.push(...(layer?[a,a+sides,b,b,a+sides,b+sides]:[a,b,a+sides,b,b+sides,a+sides]));}}
   for(let i=0;i<sides;i++){const a=1+(rows.length-1)*sides+i,b=1+(rows.length-1)*sides+(i+1)%sides;indices.push(a,b,a+stride,b,b+stride,a+stride);}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('creatureFlex',new T.Float32BufferAttribute(f,2));geo.setAttribute('creatureBend',new T.Float32BufferAttribute(bend,3));geo.setIndex(indices);geo.computeVertexNormals();
   const feet=[];for(let arm=0;arm<5;arm++)for(const reach of[.47,.66])for(const side of[-1,1]){const a=arm*Math.PI*2/5,x=Math.sin(a)*reach+Math.cos(a)*side*.060,z=Math.cos(a)*reach-Math.sin(a)*side*.060;feet.push(tube(0xbca77d,[[x,.080,z],[x+Math.cos(a)*side*.014,.046,z-Math.sin(a)*side*.014],[x+Math.cos(a)*side*.028,.025,z-Math.sin(a)*side*.028]],[.017,.012,.014],{sides:4,steps:3,flexible:(px,y,pz)=>{const u=Math.min(1,Math.hypot(px,pz)/.91);return[u*u*.60,Math.atan2(px,pz)*2,.012,.009,.033];}}));}
   return[geo,surface(0x3b5952,[[.395,.115,.115],[.47,.073,.069],[.55,.027,.025],[.57,.003,.003]],{sides:10,flute:.07}),oval(0x172e2a,0,.406,.02,.064,.011,.061,12,6),...feet];
  });d.attackSocket=organicJoint(r,0,.48,.02);
 }
 d.arms=[...d.claws,...d.tips];d.cap=d.body;animateCoastEnemy(g,0,0,0,0);return g;
}
export function makeCoastEnemy(kind){
 if(kind!=='wreckwarden')return makeCoastCreature(kind);
 const g=new T.Group(),r=new T.Group();g.add(r);const d=g.userData={kind,rig:r,coastModel:true,legs:[],claws:[],tips:[],phase:0};
 {
  const boss=kind==='wreckwarden';d.bossModel=boss;d.coastBoss=boss;if(boss)r.scale.setScalar(2.15);
  part(r,boss?0x687e7c:0xb66c57,[0,.49,0],[.60,.37,.63]);part(r,0xd2a77b,[0,.35,.41],[.39,.19,.29]);
  for(const s of[-1,1]){const stalk=joint(r,s*.21,.65,.4);part(stalk,0x8b8065,[0,.08,0],[.04,.17,.04]);eye(stalk,0,.24,.01);
   for(let i=0;i<3;i++){const leg=joint(r,s*.48,.35,.36-i*.34);const upper=part(leg,boss?0x6c8d85:0xc38965,[s*.25,-.05,0],[.32,.065,.07]);upper.rotation.z=-s*.28;const toe=part(leg,0x3b565d,[s*.51,-.22,.03],[.065,.22,.065]);toe.rotation.z=-s*.5;d.legs.push(leg);}
   const claw=joint(r,s*.42,.43,.46);part(claw,boss?0x91aea3:0xcf9b75,[s*.13,.0,.38],[.20,.17,.39]);const palm=joint(claw,s*.2,0,.68);part(palm,boss?0x98b6a8:0xd9a477,[s*.12,0,.19],[.16,.18,.31]);const tip=joint(palm,-s*.10,0,.03);part(tip,0x587c80,[-s*.05,0,.23],[.10,.13,.27]);d.claws.push(claw);d.tips.push(tip);
  }
  if(boss){d.shell=joint(r,0,.66,-.17);part(d.shell,0x625c50,[0,.39,-.08],[.71,.42,.88]);for(const s of[-1,1]){const side=part(d.shell,0x8c7862,[s*.59,.6,-.04],[.08,.19,.86],'box');side.rotation.z=-s*.2;}for(let i=0;i<4;i++)part(d.shell,0xa99270,[0,.72,-.6+i*.36],[.53,.04,.06],'box');part(d.shell,0x494a42,[0,1.02,-.18],[.05,.74,.05],'box');const sail=part(d.shell,0xbcc4b3,[.28,1.22,-.18],[.28,.36,.018],'box');sail.rotation.y=.2;d.sail=sail;part(d.shell,0x88d4cf,[0,.43,.72],[.16,.14,.10],'sphere',true);}
 }
 d.arms=[...d.claws,...d.tips];d.cap=d.body;return g;
}
export function animateCoastEnemy(g,t,speed,attack,dt){
 const d=g.userData,r=d.rig,walking=d.organicModel&&d.legs.length>0,travel=d.kind==='reefturtle'?.24:.27,desiredStride=Math.min(1,speed/(d.kind==='reefturtle'?.8:1.8));
 if(walking)d.walkStride=(d.walkStride||0)+(desiredStride-(d.walkStride||0))*(1-Math.exp(-dt*14));
 const s=walking?d.walkStride:Math.min(1,speed/3);
 // The shared gait spends 64% of a cycle moving a planted foot from +travel
 // to -travel. Match that retreat to the actor's real translation.
 d.phase+=speed*dt*(walking?Math.PI*.64/(travel*Math.max(.01,desiredStride)):3);const p=d.phase;
 const target=attack>0?Math.min(1,1-attack/1.2):0;d.wind=(d.wind||0)+(target-(d.wind||0))*(1-Math.exp(-dt*10));
 if(d.oldAttack>0&&attack<=0)d.release=.35;d.oldAttack=attack;d.release=Math.max(0,(d.release||0)-dt);const hit=Math.sin((d.release||0)/.35*Math.PI);
 let wind=d.wind,strike=hit;if(d.coastBoss){wind=d.bossStage==='wind'?d.windProgress:d.bossStage==='strike'?1-d.strikeProgress:0;strike=d.bossStage==='strike'?Math.sin(Math.PI*d.strikeProgress):0;}
 if(d.organicModel){
  d.strike=(d.strike||0)+(hit-(d.strike||0))*(1-Math.exp(-dt*12));strike=d.strike;
  r.position.set(0,Math.abs(Math.sin(p))*.010*s-wind*.018,-wind*.016+strike*.025);r.rotation.set(wind*.025-strike*.04,0,Math.sin(p)*.014*s);
  if(d.kind==='foamling'){
   const pulse=Math.sin(p),squash=pulse*.045*s+Math.sin(t*1.45)*.014*(1-s)-wind*.10+strike*.07;
   r.position.y=0;d.body.scale.set(1-squash*.35,1+squash,1-squash*.20);d.crest.position.set(0,-wind*.035+strike*.045,-wind*.075+strike*.10+Math.sin(p-.7)*.022*s);d.crest.rotation.x=-wind*.12+strike*.10+Math.sin(p-.4)*.035*s;r.rotation.z=Math.sin(p-.4)*.012*s;
  }else if(d.kind==='jellyseer'){
   // A brief contraction propels the bell, followed by a slower refill. The
   // canals and hanging arms lag gently instead of breathing as one rigid lump.
   const cycle=T.MathUtils.euclideanModulo(t*.36,1),smooth=x=>x*x*(3-2*x),pump=cycle<.22?smooth(cycle/.22):1-smooth((cycle-.22)/.78),breath=.025-.067*pump+wind*.07-strike*.045;r.position.y=.08+Math.sin(t*1.7)*.08;
   d.body.scale.set(1+breath,1-breath*.65,1+breath);d.body.position.y=.94*breath*.65;d.inner.scale.set(1+breath*.5,1-breath*.45,1+breath*.5);d.inner.position.y=.94*breath*.45;d.tentacles.position.y=-pump*.008+Math.sin(t*2.26-.4)*.006;d.attackSocket.position.z=.12+strike*.035;
  }else if(d.kind==='tidestar'){
   r.position.y=0;r.rotation.set(0,Math.sin(t*.55)*.022*s,0);d.body.scale.set(1-wind*.045,1+wind*.08-strike*.05,1-wind*.045);
  }else{
   const turtle=d.kind==='reefturtle',weight=Math.sin(p)*s;
   // The turtle carries its shell over three supporting feet; the crab
   // braces low between its two alternating tripods before closing a claw.
   r.position.set(weight*(turtle?.016:.007),Math.abs(Math.sin(p*(turtle?1:2)))*(turtle?.007:.004)*s-wind*(turtle?.012:.025),-wind*(turtle?.022:.018)+strike*(turtle?.018:.028));
   r.rotation.set(wind*(turtle?-.025:.04)-strike*(turtle?.025:.035),Math.sin(p-.5)*(turtle?.012:.007)*s,weight*(turtle?.020:.010));
   for(const l of d.legs)stepLeg(l,r,p,s,{travel,lift:d.kind==='reefturtle'?.043:.057});
   d.claws.forEach((o,i)=>{const side=i?1:-1,carry=Math.sin(p+i*Math.PI-.45)*.025*s;o.rotation.set(carry-wind*.16+strike*.12,side*(wind*.20-strike*.20),-side*wind*.04);d.elbows[i].rotation.set(-wind*.12+strike*.10,-side*(wind*.30-strike*.20),0);});d.tips.forEach((o,i)=>o.rotation.y=(i?1:-1)*(-wind*.28+strike*.22));
   if(d.head){d.head.position.z=.50-wind*.12+strike*.14;d.head.rotation.x=-wind*.12+strike*.08-Math.sin(p-.6)*.015*s;d.head.rotation.y=Math.sin(t*.8)*.025*(1-s)-weight*.015;}
   d.eyes.forEach((eye,i)=>{const side=i?1:-1;if(d.kind==='tidecrab'){eye.rotation.set(-wind*.20+strike*.10,Math.sin(t*.85+i*.9)*.12*(1-wind)+side*wind*.10,side*(-wind*.08+Math.sin(t*.63+i)*.028));}else{const phase=T.MathUtils.euclideanModulo(t+i*.065,5.3),blink=phase<.20?Math.sin(phase/.20*Math.PI)**2:0;eye.scale.y=Math.max(.06,1-.92*blink-wind*.16);}});
  }
  return;
 }
 r.position.y=Math.abs(Math.sin(p))*.025*s-wind*.05;r.rotation.z=Math.sin(p)*.035*s;
 d.legs.forEach((o,i)=>{const side=i<d.legs.length/2?-1:1,phase=p+(i%3)*2.1+(side>0?Math.PI:0);o.rotation.set(0,Math.sin(phase)*.26*s,side*Math.max(0,Math.cos(phase))*.18*s);});d.claws.forEach((o,i)=>{const side=i?1:-1;o.rotation.set(-wind*.2,side*(wind*.4-strike*.55),0);});d.tips.forEach((o,i)=>o.rotation.y=(i?1:-1)*(wind*.6-strike*.28));if(d.head)d.head.rotation.x=-wind*.48+strike*.35;if(d.sail)d.sail.rotation.y=.2+Math.sin(t*2)*.1;
}
export function coastProp(parent,index,rnd){
 if(index%17===0){const hull=part(parent,0x665b4e,[0,.40,0],[1.6,.4,.7]);hull.rotation.y=rnd()*6;for(const s of[-1,1])part(hull,0x9e8b70,[s*.0,.75,s*.7],[.75,.12,.08],'box');part(parent,0x766c55,[0,1.1,0],[.065,.8,.065],'box');return 1.5;}
 if(index%3===0){part(parent,0x789088,[0,.55,0],[.74,.56,.68],'rock');part(parent,0xa7b5a2,[.2,.9,.1],[.28,.28,.3],'rock');return .7;}
 // Ordinary dry-land props keep the same .35m footprint and random stream.
 // Only one in four is a lone post; the rest read as fishing/cargo remnants.
 const kind=index%4;parent.userData.coastPropKind=['mooring','cask','net-roll','cargo-sack'][kind];
 if(kind===0){part(parent,0x746b57,[0,.56,0],[.16,.56,.16],'box');const ring=part(parent,0x9f997f,[0,.91,0],[.22,.22,.22],'hoop');ring.rotation.x=Math.PI/2;}
 else if(kind===1){part(parent,0x766c55,[0,.43,0],[.27,.43,.27],'barrel');for(const y of[.16,.68])part(parent,0x506568,[0,y,0],[.27,.27,.27],'hoop').rotation.x=Math.PI/2;}
 else if(kind===2){part(parent,0x59756d,[0,.22,0],[.29,.22,.25]);for(const y of[.15,.28])part(parent,0x9f997f,[0,y,0],[.27,.27,.27],'hoop').rotation.x=Math.PI/2;}
 else{part(parent,0x9c987d,[0,.35,0],[.27,.35,.25]);part(parent,0x746b57,[0,.70,0],[.065,.075,.065],'barrel');}
 return .35;
}
// Smooth shaft and forged, swept tines keep the silhouette readable without white blocks.
let harpoonTemplate;
function harpoonBinding(height,turns){
 const geo=new T.CylinderGeometry(.034,.034,height,12,turns*3),p=geo.attributes.position,colors=[],base=new T.Color(0x294e5b),seam=new T.Color(0x152e37),worn=new T.Color(0x718984),color=new T.Color();
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),v=(p.getY(i)/height+.5),angle=Math.atan2(z,x),phase=T.MathUtils.euclideanModulo(v*turns-angle/(Math.PI*2),1);
  const rim=T.MathUtils.smoothstep(phase,.68,.87)*(1-T.MathUtils.smoothstep(phase,.93,1)),end=T.MathUtils.smoothstep(v,0,.035)*(1-T.MathUtils.smoothstep(v,.965,1)),r=Math.hypot(x,z);
  if(r>.01){const radius=(.030+.004*end)+.002*rim*end;p.setX(i,x/r*radius);p.setZ(i,z/r*radius);}
  color.copy(base).lerp(seam,T.MathUtils.smoothstep(phase,.90,1)*.68).lerp(worn,rim*.32);colors.push(color.r,color.g,color.b);
 }
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();geo.name='SM_Harpoon_ContinuousSailclothBinding';return geo;
}
function harpoonSocket(){
 // A single rebated sleeve receives both the wooden haft and the forged fork;
 // the shoulder is integral metal, not another disconnected decorative ring.
 const profile=[[0,-.07],[.034,-.07],[.040,-.060],[.045,-.035],[.057,-.026],[.057,.015],[.047,.035],[.041,.07],[0,.07]];
 const geo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),12);geo.name='SM_Harpoon_RebatedForkSocket';return geo;
}
export function makeHarpoon(){
 if(harpoonTemplate)return harpoonTemplate.clone();
 const g=new T.Group(),wood=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.78}),steel=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:.64,roughness:.36}),edge=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:.70,roughness:.31}),socketMetal=new T.MeshStandardMaterial({color:0x617781,metalness:.65,roughness:.43}),brass=new T.MeshStandardMaterial({color:0x887354,metalness:.55,roughness:.52}),wrap=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.92});
 const cylinder=(r,h,z,m,segments=1)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,12,segments),m);o.rotation.x=Math.PI/2;o.position.z=z;g.add(o);return o;};
 const shaft=cylinder(.029,2.16,.33,wood,8);shaft.name='SM_Harpoon_SaltedWoodHaft';shaft.userData.identityDetail=true;
 const positions=shaft.geometry.attributes.position,grain=[],woodDark=new T.Color(0x473f36),woodLight=new T.Color(0x82725a),tint=new T.Color();
 for(let i=0;i<positions.count;i++){
  const a=Math.atan2(positions.getZ(i),positions.getX(i)),fiber=.5+.5*Math.sin(a*7+positions.getY(i)*1.7);
  // The forward haft supports the wider fork, while both hand contacts and the
  // cloth bindings retain their original diameter and longitudinal placement.
  const swell=1+.003/.029*T.MathUtils.smoothstep(positions.getY(i)+.33,.55,1.24);
  positions.setX(i,positions.getX(i)*swell);positions.setZ(i,positions.getZ(i)*swell);
  tint.copy(woodDark).lerp(woodLight,.25+fiber*.48);grain.push(tint.r,tint.g,tint.b);
 }
 shaft.geometry.setAttribute('color',new T.Float32BufferAttribute(grain,3));shaft.geometry.computeVertexNormals();
 for(const [index,height,z,turns]of[[0,.54,-.08,8],[1,.30,.34,5]]){
  const grip=new T.Mesh(harpoonBinding(height,turns),wrap);grip.rotation.x=Math.PI/2;grip.position.z=z;grip.name='SM_Harpoon_SailclothGrip_'+index;grip.userData.identityDetail=true;g.add(grip);
 }
 const socket=new T.Mesh(harpoonSocket(),socketMetal);socket.rotation.x=Math.PI/2;socket.position.z=1.32;socket.name='SM_Harpoon_ForkSocket';socket.userData.identityDetail=true;g.add(socket);
 const heel=cylinder(.038,.10,-.73,brass);heel.name='SM_Harpoon_ClosedHeel';heel.userData.identityDetail=true;
 const blade=(points,x,z,m,name)=>{
  const shape=new T.Shape(),tip=Math.max(...points.map(p=>p[1])),last=points.at(-1),first=points[0];shape.moveTo((last[0]+first[0])*.5,(last[1]+first[1])*.5);
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(a[1]===tip){shape.lineTo(...a);shape.lineTo((a[0]+b[0])*.5,(a[1]+b[1])*.5);}else shape.quadraticCurveTo(...a,(a[0]+b[0])*.5,(a[1]+b[1])*.5);}
  shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.036,bevelEnabled:true,bevelThickness:.008,bevelSize:.006,bevelSegments:2,steps:1,curveSegments:4});geo.translate(0,0,-.018);
  const p=geo.attributes.position,colors=[],body=new T.Color(m===edge?0x738e93:0x3c626e),ground=new T.Color(0xc8d6d1),tint=new T.Color();
  for(let i=0;i<p.count;i++){
   const towardTip=T.MathUtils.smoothstep(p.getY(i),tip*.50,tip),bevel=1-T.MathUtils.smoothstep(Math.abs(p.getZ(i)),.0175,.026);
   p.setZ(i,p.getZ(i)*(1-.78*towardTip));tint.copy(body).lerp(ground,Math.max(bevel*.83,towardTip*.7));colors.push(tint.r,tint.g,tint.b);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.rotateX(Math.PI/2);geo.computeVertexNormals();geo.name=name;const o=new T.Mesh(geo,m);o.name=name;o.userData.identityDetail=true;o.position.set(x,0,z);o.scale.x=.78;g.add(o);return o;
 };
 blade([[-.056,0],[-.078,.14],[0,.39],[.078,.14],[.056,0]],0,1.36,edge,'SM_Harpoon_CentralGroundPoint');
 for(const side of[-1,1])blade([[0,0],[side*.15,.075],[side*.245,.25],[side*.21,.445],[side*.145,.28],[side*.10,.15],[-side*.020,.07]],0,1.20,steel,'SM_Harpoon_CurvedTine_'+side);
 const spine=new T.Mesh(new T.CylinderGeometry(.011,.022,.25,8),socketMetal);spine.rotation.x=Math.PI/2;spine.position.set(0,.028,1.505);spine.name='SM_Harpoon_ForgedCentralRidge';spine.userData.identityDetail=true;g.add(spine);
 weaponInlay(g,'SM_Harpoon_TidalNeckEngraving',[[[-.024,.029,1.385],[-.037,.029,1.425],[-.016,.029,1.46]],[[.020,.029,1.405],[.042,.029,1.45],[.015,.029,1.492]]],0xbba477,.0023,.40);
 g.name='Tide_forged_harpoon';nameWeapon(g,'tide','harpoon');g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});harpoonTemplate=g;return g.clone();
}

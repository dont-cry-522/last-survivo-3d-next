import {shadowFocus} from './shadow-gear.js?v=125';
import{weaponGesture,shotStarted}from'./weapon-performance.js?v=126';
import{miasmaLantern}from'./mirage-appearance.js?v=114';
import * as T from './vendor/three.module.js';
// Shared smooth geometry: detail is concentrated on the two heroes, not multiplied across the forest.
const geometries=new Map(),materials=new Map();
function material(color,metal=0,emission=0){const key=[color,metal,emission].join(':');if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,metalness:metal,roughness:metal?.38:.72,emissive:color,emissiveIntensity:emission}));return materials.get(key);}
function part(parent,kind,args,color,pos=[0,0,0],scale=[1,1,1],metal=0,emission=0){const key=kind+JSON.stringify(args);if(!geometries.has(key))geometries.set(key,new T[kind](...args));const m=new T.Mesh(geometries.get(key),material(color,metal,emission));m.position.set(...pos);m.scale.set(...scale);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
const ell=(p,c,pos,scale,metal=0,emission=0)=>part(p,'SphereGeometry',[1,20,14],c,pos,scale,metal,emission);
const block=(p,c,pos,scale,metal=0)=>part(p,'BoxGeometry',[1,1,1],c,pos,scale,metal);
const tube=(p,c,pos,scale,metal=0)=>part(p,'CylinderGeometry',[1,1,1,16],c,pos,scale,metal);
const joint=(p,pos)=>{const g=new T.Group();g.position.set(...pos);p.add(g);return g;};
function tailored(p,c,profile,pos){const key='tailor'+JSON.stringify(profile);if(!geometries.has(key))geometries.set(key,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),24));const m=new T.Mesh(geometries.get(key),material(c));m.position.set(...pos);m.scale.z=.65;m.castShadow=m.receiveShadow=true;p.add(m);return m;}
function cloth(p,color,width,length,z){const key=`cloth:${width}:${length}:${z}`;if(!geometries.has(key)){const vertices=[],indices=[];for(let y=0;y<=6;y++)for(let x=0;x<=6;x++){const u=x/6,v=y/6;vertices.push((u-.5)*width*(.62+.38*v),-length*v,z-Math.sin(v*Math.PI/2)*.18+Math.cos(u*Math.PI*4)*.035*v);}for(let y=0;y<6;y++)for(let x=0;x<6;x++){const a=y*7+x;indices.push(a,a+7,a+1,a+1,a+7,a+8);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();geometries.set(key,g);}const mat=material(color);mat.side=T.DoubleSide;const m=new T.Mesh(geometries.get(key),mat);m.castShadow=m.receiveShadow=true;p.add(m);return m;}
function lock(p,color,x,y,z,length,bend=.12){const key=`lock:${length}:${bend}`;if(!geometries.has(key)){const v=[],ix=[];for(let i=0;i<=10;i++){const f=i/10,r=.069*Math.sin(Math.min(1,f*8)*Math.PI/2)*(1-f)+.001;for(let j=0;j<10;j++){const a=j*Math.PI/5;v.push(Math.cos(a)*r,-f*length,bend*f*f+Math.sin(a)*r*.58);}}for(let i=0;i<10;i++)for(let j=0;j<10;j++){const a=i*10+j,b=i*10+(j+1)%10;ix.push(a,b,a+10,b,b+10,a+10);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();geometries.set(key,g);}const m=new T.Mesh(geometries.get(key),material(color));m.position.set(x,y,z);m.castShadow=true;p.add(m);return m;}
export function makeHero(kind,weapon){
  if(kind==='wraith'){const g=makeHero('scout','dark'),d=g.userData;d.weapon.clear();d.weapon.add(shadowFocus(weapon));d.weaponId=weapon;d.kind=kind;return g;}
  if(kind==='mirage'){
    // Loading fallback uses the existing articulated woman, never a rifle-bearing scout.
    const g=makeHero('silver','dark'),d=g.userData;
    g.traverse(o=>{if(!o.isMesh)return;const c=o.material.color,hsl={};c.getHSL(hsl);const pale=hsl.l>.65,color=pale?0xc4b7db:hsl.l>.25?0x59436d:0x24142e;o.material=material(color,o.material.metalness);});
    const mask=ell(d.head,0xb7abc9,[0,.012,.169],[.176,.216,.074],.14);mask.name='mirage-fallback-full-mask';
    for(const side of[-1,1]){const eye=ell(d.head,0x21162c,[side*.077,.063,.232],[.043,.009,.008]);eye.rotation.z=side*-.12;}
    d.weapon.clear();d.weapon.add(miasmaLantern());d.weapon.scale.setScalar(.95);d.weaponId=weapon;d.kind=kind;g.scale.setScalar(.81);return g;
  }
  const silver=kind==='silver',g=new T.Group(),rig=joint(g,[0,0,0]),torso=joint(rig,[0,1.12,0]);
  const coat=silver?0x202c40:0x344f3e,light=silver?0x3e566c:0x6c7651,dark=0x15212c,trim=silver?0xa4b9d2:0xba9358,hair=silver?0xd6e0ee:0x503326,skin=silver?0xe2bea6:0xcb9c7d,gem=silver?0x7dbfbf:0xc9a867;
  const d=g.userData;Object.assign(d,{kind,weaponId:weapon,rig,torso});
  tailored(torso,coat,[[.23,0],[.21,.16],[silver?.175:.25,.32],[silver?.27:.3,.5],[.23,.62]],[0,0,0]);
  // Shoulder mantle, high collar, contrasting central tunic and fitted belt.
  tailored(torso,light,[[silver?.26:.29,0],[silver?.28:.32,.08],[.25,.13]],[0,.47,0]);
  tube(torso,dark,[0,.65,0],[.13,.15,.115]);
  const chest=block(torso,silver?dark:0x63503e,[0,.34,.163],[silver?.14:.10,.43,.035]);chest.rotation.z=silver?-.12:.5;
  for(const s of [-1,1]){const piping=block(torso,trim,[s*.108,.34,.184],[.009,.43,.008],.45);piping.rotation.z=silver?-.12:.15;}
  if(!silver){const strap=block(torso,0x6a4b32,[-.01,.36,.19],[.085,.56,.035]);strap.rotation.z=-.55;block(torso,trim,[.035,.31,.217],[.075,.065,.016],.6);for(let i=0;i<3;i++){const cartridge=tube(torso,0xb69965,[-.16+i*.055,.21,.192],[.018,.105,.018],.5);cartridge.rotation.z=.12;}}
  tube(torso,dark,[0,.06,0],[.245,.095,.17]);block(torso,trim,[0,.06,.18],[.115,.074,.026],.7);block(torso,dark,[0,.06,.198],[.061,.035,.012]);
  for(const s of [-1,1]){const pouch=ell(torso,silver?0x465261:0x785c3f,[s*.245,.055,0],[.082,.105,.105]);block(torso,trim,[s*.252,.08,.092],[.075,.025,.013],.5);}
  const head=joint(torso,[0,.83,0]);head.scale.setScalar(silver?.91:.94);d.head=head;
  ell(head,skin,[0,.04,.005],[silver?.197:.214,.255,.19]);ell(head,skin,[0,.004,.18],[.022,.037,.024]);
  for(const s of [-1,1]){
    ell(head,skin,[s*.205,.018,-.005],[.035,.063,.039]);
    ell(head,0x293238,[s*.08,.065,.177],[.052,silver?.018:.021,.015]);ell(head,0xe1e5df,[s*.08,.065,.186],[.043,silver?.011:.014,.009]);ell(head,silver?0x437d83:0x655b36,[s*.078,.065,.194],[.014,silver?.012:.015,.006]);ell(head,0x142328,[s*.078,.066,.199],[.006,silver?.009:.011,.003]);
    const brow=ell(head,hair,[s*.08,.107,.177],[.05,.009,.012]);brow.rotation.z=s*(silver?.09:.19);
  }
  if(silver){ell(head,0x14202c,[0,-.066,.161],[.18,.079,.055]);block(head,0x455467,[0,-.068,.218],[.005,.091,.006]);for(const s of [-1,1]){const seam=block(head,0x354854,[s*.082,-.077,.2],[.075,.007,.008]);seam.rotation.z=s*.3;block(head,dark,[s*.182,-.053,.074],[.015,.036,.14]);}}
  else{ell(head,0x79573f,[0,-.131,.106],[.111,.044,.076]);ell(head,0x9a6957,[0,-.082,.181],[.057,.008,.007]);}
  part(head,'SphereGeometry',[1,24,16,0,Math.PI*2,0,1.65],hair,[0,.106,-.018],[.231,.242,.216]);
  for(let i=0;i<7;i++){const h=lock(head,i%3===0?(silver?0xeff2f9:0x79523a):hair,(i-3)*.056,.282,.123,silver?(i<3?.225:.175):.20,.065);h.rotation.z=silver?-.32:(i-3)*-.11;h.rotation.x=-.13;}
  for(let i=0;i<5;i++){const h=lock(head,hair,(i-2)*.064,.309,-.03,.22,-.09);h.rotation.z=silver?-.35:.25;h.rotation.x=.5;}
  for(const s of [-1,1]){const h=lock(head,hair,s*.199,.17,.003,silver?.49:.23,.07);h.rotation.z=s*-.06;}
  if(silver){const pony=joint(head,[.105,.23,-.203]);d.pony=pony;ell(pony,trim,[0,-.02,0],[.071,.044,.064],.6);for(let i=0;i<6;i++){const h=lock(pony,i%2?hair:0xb9cde5,(i-2.5)*.027,-.035,-Math.abs(i-2.5)*.01,.77,.23);h.rotation.z=.18;}}
  else{tailored(torso,0x94703d,[[.155,0],[.2,.045],[.16,.09]],[0,.615,0]);const scarf=cloth(torso,0x94703d,.26,.5,-.17);scarf.position.set(-.17,.64,0);scarf.rotation.z=-.2;d.scarf=scarf;}
  const cape=cloth(torso,silver?0x29394f:0x52634a,silver?.61:.78,silver?1.13:.76,-.16);cape.position.y=.55;d.cape=cape;
  for(const s of [-1,1]){const tail=cloth(torso,silver?0x364d66:coat,silver?.3:.27,silver?.62:.4,.015);tail.position.set(s*.20,.03,-.01);tail.rotation.y=s*.4;if(silver){const edge=cloth(torso,0x7893ae,.025,.6,.019);edge.position.set(s*.29,.03,0);edge.rotation.y=s*.4;}}
  const badge=ell(torso,trim,[.16,.51,.172],[.055,.061,.022],.8);ell(torso,gem,[.16,.51,.194],[.027,.034,.009],.4,.2);
  for(const s of [-1,1]){
    const side=s<0?'left':'right',leg=joint(rig,[s*(silver?.122:.143),1.105,0]);d[side+'Leg']=leg;
    ell(leg,silver?dark:0x3c443c,[0,-.24,0],[silver?.084:.105,.29,silver?.087:.104]);const knee=joint(leg,[0,-.47,0]);d[side+'Knee']=knee;
    ell(knee,silver?0x35465b:0x6c5840,[0,-.04,.061],[.073,.09,.025]);ell(knee,dark,[0,-.255,0],[.077,.265,.077]);
    tailored(knee,silver?0x253245:0x4e4034,[[.082,0],[.084,.13],[.073,.28],[.087,.42]],[0,-.45,0]);tube(knee,trim,[0,-.034,0],[.087,.014,.062],.5);
    ell(knee,silver?0x1b2932:0x3b302a,[0,-.51,.065],[silver?.093:.113,.078,.17]);block(knee,0x273039,[0,-.555,.046],[silver?.18:.21,.032,.29]);
    const arm=joint(torso,[s*(silver?.261:.294),.5,0]);d[side+'Arm']=arm;arm.rotation.z=s*.07;
    ell(arm,silver?coat:s<0?0x6b503a:light,[s*.004,-.024,0],[silver?.093:.119,.122,silver?.102:.128],0);tube(arm,silver?light:0x8b704c,[0,-.075,0],[silver?.092:.107,.018,silver?.089:.1],.15);
    ell(arm,coat,[0,-.17,0],[.083,.175,.085]);const elbow=joint(arm,[0,-.3,0]);d[side+'Elbow']=elbow;
    ell(elbow,dark,[0,-.105,0],[.073,.15,.075]);tube(elbow,silver?0x34475b:0x66503b,[0,-.17,0],[.077,.135,.074]);tube(elbow,trim,[0,-.226,0],[.078,.012,.075],.5);
    ell(elbow,dark,[0,-.287,.012],[.075,.087,.065]);block(elbow,trim,[0,-.28,.069],[.071,.036,.012],.6);
  }
  const gun=joint(d.rightElbow,[0,-.287,.025]);d.weapon=gun;
  if(weapon==='fire'||weapon==='dark'){
    const accent=weapon==='fire'?0xffa55b:0xa68ee8;
    tube(gun,0x675347,[0,.26,.045],[.027,1.3,.027]);for(const y of [-.23,.1,.52])tube(gun,trim,[0,y,.045],[.036,.06,.036],.7);
    const head=joint(gun,[0,.98,.045]);for(const s of [-1,1]){const claw=part(head,'TorusGeometry',[.16,.028,8,20,Math.PI*.8],trim,[0,0,0]);claw.rotation.z=s<0?Math.PI:.2;}
    part(head,'OctahedronGeometry',[.115,0],accent,[0,.07,0],[1,1.5,1],.35,.9);
    part(head,'TorusGeometry',[.085,.013,6,20],trim,[0,.07,0],[1,1,1],.8);
  }else if(weapon==='crossbow'){
    block(gun,0x283845,[0,.045,.16],[.13,.12,.56]);
    block(gun,0x866e59,[0,.12,.18],[.075,.035,.42]);
    block(gun,0x171e28,[0,-.08,.01],[.10,.19,.14]).rotation.x=-.2;
    const strings=[];
    for(const s of[-1,1]){
      const limb=block(gun,0x8b9bab,[s*.23,.11,.43],[.43,.035,.065],.55);limb.rotation.y=s*.2;
      ell(gun,0xc8e7ed,[s*.44,.11,.36],[.025,.035,.025],.6);
      strings.push(part(gun,'CylinderGeometry',[.004,.004,1,4],0xd0dee6));
    }
    const bolt=new T.Group();gun.add(bolt);block(bolt,0xdceaf0,[0,.16,.30],[.022,.023,.43],.6);
    part(bolt,'ConeGeometry',[.045,.13,5],0xc8e7f0,[0,.16,.57],[1,1,1],.65).rotation.x=Math.PI/2;
    gun.userData.crossbowStrings=strings;gun.userData.crossbowBolt=bolt;gun.userData.stringPull=0;
  }else if(weapon==='shuriken'){
    part(gun,'TorusGeometry',[.095,.022,8,20],trim,[0,0,.06],[1,1,1],.8).rotation.x=Math.PI/2;
    for(let i=0;i<4;i++){const blade=part(gun,'ConeGeometry',[.09,.32,3],0xd6e5e6,[Math.sin(i*Math.PI/2)*.21,0,.06+Math.cos(i*Math.PI/2)*.21],[1,1,.26],.85);blade.rotation.set(Math.PI/2,i*Math.PI/2,0);}
  }else{
    const length=.69;
    block(gun,0x253440,[0,.058,.19],[.112,.125,length]);block(gun,0x9caeb6,[0,.133,.23],[.099,.029,length*.83],.8);
    const barrel=tube(gun,0x435562,[0,.072,.2+length/2],[.036,.31,.036],.8);barrel.rotation.x=Math.PI/2;
    const bore=ell(gun,0x080f13,[0,.072,.21+length/2+.155],[.027,.027,.009]);
    const grip=block(gun,0x5c4a3e,[0,-.065,.075],[.096,.21,.13]);grip.rotation.x=-.22;
    block(gun,trim,[.061,.072,.19],[.008,.032,.16],.8);block(gun,0x192831,[0,.169,.13],[.028,.044,.061]);
    block(gun,0x624f3d,[0,.03,-.24],[.115,.17,.22]);block(gun,dark,[0,-.098,.19],[.07,.18,.11]);
    if(weapon==='rifle'){tube(gun,dark,[0,.193,.21],[.045,.14,.045]).rotation.x=Math.PI/2;}
    if(weapon==='shotgun'){const second=tube(gun,0x8c9ca6,[.075,.068,.47],[.032,.43,.032],.75);second.rotation.x=Math.PI/2;const pump=joint(gun,[0,0,0]);for(let i=0;i<4;i++)block(pump,0x8c6e48,[0,.025,.28+i*.037],[.14,.08,.022]);gun.userData.pump=pump;}
  }
  return g;
}
export function animateHero(g,t,speed,attack){
  const d=g.userData,dt=d.lastPoseTime===undefined?1/60:Math.max(0,Math.min(.05,t-d.lastPoseTime));d.lastPoseTime=t;
  d.runBlend=(d.runBlend||0)+(Math.min(1,speed/6.5)-(d.runBlend||0))*(1-Math.exp(-dt*12));
  d.aimBlend=(d.aimBlend||0)+((attack>0?1:0)-(d.aimBlend||0))*(1-Math.exp(-dt*20));
  d.gait=(d.gait||0)+dt*11*Math.max(.25,d.runBlend);
  const run=d.runBlend,phase=d.gait,step=Math.sin(phase),aim=d.aimBlend;
  const fired=shotStarted(d,attack,d.previousAttack||0);d.previousAttack=attack;d.attackAge=fired?0:(d.attackAge??2)+dt;const motion=weaponGesture(d.weaponId,d.attackAge,d.reloadPhase??1,d.reloadDuration||1);
  d.rig.position.y=.012*Math.sin(t*2.8)+Math.abs(step)*.045*run;d.rig.rotation.z=step*.025*run;
  for(const [side,sign]of [['left',1],['right',-1]]){const f=Math.sin(phase+(sign<0?Math.PI:0));d[side+'Leg'].rotation.x=f*.6*run;d[side+'Knee'].rotation.x=Math.max(0,-f)*.95*run+.06;}
  d.torso.rotation.x=.035+run*.08;d.torso.rotation.y=-step*.08*run;
  d.leftArm.rotation.x=-step*.36*run-.1;d.leftElbow.rotation.x=-.24-Math.max(0,step)*.3*run;
  const staff=['fire','dark','miasmalantern'].includes(d.weaponId);d.rightArm.rotation.x=staff?-.12-aim*.3:-.4-aim*.32;d.rightElbow.rotation.x=staff?-.35:-.65-aim*.15;
  d.weapon.rotation.x=staff?.18:-(d.rightArm.rotation.x+d.rightElbow.rotation.x)-.12*(1-aim);
  const k=motion.kick,s=motion.sweep;d.rig.position.z=-k*(d.weaponId==='shotgun'?.10:.035);
  d.rightArm.rotation.y=d.weaponId==='shuriken'?-.7*s:d.weaponId==='dark'?.5*s:0;d.rightArm.rotation.x-=k*(staff?.45:.15);d.rightElbow.rotation.x-=k*(d.weaponId==='shuriken'?.4:.15);d.leftArm.rotation.x-=staff?.4*s:motion.draw*.3;
  if(d.weapon.userData.pump)d.weapon.userData.pump.position.z=-.23*motion.draw;
  d.cape.rotation.x=.07+run*.34+Math.sin(t*5)*.045;d.cape.rotation.z=step*.045*run;
  if(d.pony){d.pony.rotation.x=-.1+run*.22+Math.sin(t*7)*.06;d.pony.rotation.z=step*.06*run;}
  if(d.scarf)d.scarf.rotation.x=run*.4+Math.sin(t*6)*.06;
}

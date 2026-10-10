import{buildConfluence,biomeWeights}from'./confluence.js?v=125';
import{addTree}from'./tree-scenery.js?v=124';
import{installTactics}from'./map-tactics.js?v=114';
import{installRoaming}from'./roaming-events.js?v=125';
import{installDiscoveries}from'./map-discoveries.js?v=125';
import{restoreEnemyHit,animateEnemyHit}from'./enemy-feedback.js?v=114';
import{groveCenters,installScenery,animateScenery}from'./biome-scenery.js?v=125';
import{districtLayout,buildDistricts}from'./map-districts.js?v=125';
import{makeCoastEnemy,animateCoastEnemy,coastProp}from'./coast-models.js?v=114';
import{installCoast}from'./coast.js?v=114';
import{coastLayout as buildCoastLayout}from'./coast-layout.js?v=114';
import{makeBoss,animateBoss,makeSandEnemy,animateSandEnemy}from'./expansion-models.js?v=114';
import{siteSchedule}from'./site-discovery.js?v=114';
import{MAP_EVENTS,biomeEvent,eventNodes}from'./map-events.js?v=114';
import{MAP_HALF,MAP_SCALE}from'./map-layout.js?v=114';
import{buildPonds,animateWater,waterDepth,restoreWaterPose,animateWaterPose}from'./water.js?v=125';
import{ENEMY_MOTION,animateEnemyIdentity}from'./enemy-motion.js?v=120';
import{polishEnemyAppearance}from'./enemy-appearance.js?v=120';
import{REGIONAL_ENEMIES}from'./map-enemies.js?v=114';
import{groundCue}from'./ground-cues.js?v=114';
import{heroesReady,createSkinnedHero,animateSkinnedHero}from'./skinned-hero.js?v=128';
import * as T from './vendor/three.module.js';
import{makeHero,animateHero}from'./hero-model.js?v=128';
import{MAPS,seeded}from'./rules.js?v=125';
const geo=new Map(),materials=new Map(),terrainMaterials=new Map(),detailMaterials=new Map(),weatherMaterials=new Map();
let fireflyTexture;
function softFirefly(){
 if(fireflyTexture)return fireflyTexture;
 const size=32,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;
  data[i]=data[i+1]=data[i+2]=255;
  data[i+3]=Math.round(255*Math.max(0,Math.exp(-r*r*35)*.78+Math.exp(-r*r*4)*.20-.004));
 }
 fireflyTexture=new T.DataTexture(data,size,size);fireflyTexture.magFilter=T.LinearFilter;fireflyTexture.minFilter=T.LinearFilter;fireflyTexture.needsUpdate=true;return fireflyTexture;
}
function geometry(kind,args){const key=kind+args.join(',');if(!geo.has(key))geo.set(key,new T[kind](...args));return geo.get(key);}
export function mat(color,glow=false){const key=color+':'+glow;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:glow?.35:.86,metalness:glow?.25:.08,emissive:glow?color:0,emissiveIntensity:glow?.9:0,flatShading:true}));return materials.get(key);}
export function mesh(kind,args,color,x=0,y=0,z=0,parent=null,glow=false){const dims=args.slice();let radial=1,vertical=1;if(kind==='CylinderGeometry'){vertical=dims[2];dims[2]=1;}if(['CircleGeometry','DodecahedronGeometry'].includes(kind)){radial=dims[0];dims[0]=1;}const m=new T.Mesh(geometry(kind,dims),mat(color,glow));m.scale.set(radial,kind==='CylinderGeometry'?vertical:radial,radial);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent?.add(m);return m;}
const box=(p,c,x,y,z,w,h,d)=>mesh('BoxGeometry',[w,h,d],c,x,y,z,p);
const orb=(p,c,x,y,z,r,glow=false)=>mesh('SphereGeometry',[r,10,7],c,x,y,z,p,glow);
const cone=(p,c,x,y,z,r,h)=>mesh('ConeGeometry',[r,h,7],c,x,y,z,p);
function detailMaterial(color,opacity,vertexColors=false){const key=color+':'+opacity+':'+vertexColors;if(!detailMaterials.has(key))detailMaterials.set(key,new T.MeshStandardMaterial({color,transparent:true,opacity,vertexColors,roughness:1,depthWrite:false,side:T.DoubleSide}));return detailMaterials.get(key);}
export function actor(kind='silver',weapon='crossbow',polished=true){
 if(REGIONAL_ENEMIES[kind]?.map==='coast')return makeCoastEnemy(kind);
 if(['boss','frostking','cinderlord','dunescorpion'].includes(kind))return makeBoss(kind);
 if(REGIONAL_ENEMIES[kind]?.map==='sand')return makeSandEnemy(kind);
 if(REGIONAL_ENEMIES[kind])return regionalActor(kind);
 const g=new T.Group(),rig=new T.Group();g.add(rig);g.userData.rig=rig;
 if(['silver','scout','tide','lingya','wuling','mirage','wraith'].includes(kind))return heroesReady()?createSkinnedHero(kind,weapon):makeHero(kind,weapon);
 if(kind==='mushroom'){
  mesh('CylinderGeometry',[.23,.35,.72,7],0xb7a483,0,.45,0,rig);const capRig=new T.Group();capRig.position.y=1.05;rig.add(capRig);g.userData.cap=capRig;const cap=orb(capRig,0xb95e43,0,0,0,.66);cap.scale.y=.6;for(let i=0;i<5;i++)orb(capRig,0xf2dcad,Math.cos(i*2.4)*.37,.2,Math.sin(i*2.4)*.35,.09);for(const s of [-1,1])orb(rig,0xffdc88,s*.13,.7,.27,.04,true);
 }else if(kind==='wolf'){
  const body=mesh('CapsuleGeometry',[.29,.62,3,7],0x68758c,0,.65,0,rig);body.rotation.x=Math.PI/2;const head=new T.Group();head.position.set(0,.8,.5);rig.add(head);g.userData.head=head;orb(head,0x8897ab,0,.02,0,.31);cone(head,0x718293,-.17,.34,-.07,.13,.35);cone(head,0x718293,.17,.34,-.07,.13,.35);box(head,0x42556b,0,-.08,.27,.23,.19,.28);for(const s of [-1,1])orb(head,0xffd775,s*.15,.08,.21,.04,true);const jaw=box(head,0x293c4d,0,-.21,.27,.18,.065,.25);g.userData.jaw=jaw;const tail=new T.Group();tail.position.set(0,.75,-.46);rig.add(tail);g.userData.tail=tail;const tuft=cone(tail,0x8897ab,0,0,-.2,.13,.5);tuft.rotation.x=-Math.PI/2;for(const x of [-.22,.22])for(const z of [-.28,.28])mesh('CylinderGeometry',[.08,.065,.5,5],0x536076,x,.25,z,rig);
 }else if(kind==='golem'||kind==='boss'){
  const c=kind==='boss'?0x536575:0x68735e;mesh('DodecahedronGeometry',[.72,0],c,0,1,0,rig);mesh('DodecahedronGeometry',[.4,0],0x8c9779,0,1.82,0,rig);for(const s of [-1,1]){mesh('DodecahedronGeometry',[.4,0],c,s*.75,1,0,rig);box(rig,c,s*.3,.28,0,.4,.6,.5);cone(rig,0xc6b58c,s*.58,1.8,0,.18,.65);}orb(rig,kind==='boss'?0xffa66b:0x94e4bd,0,1.15,.64,.16,true);for(const s of [-1,1])box(rig,0xffd591,s*.14,1.85,.32,.14,.055,.06);if(kind==='boss'){g.scale.setScalar(2.3);const halo=mesh('TorusGeometry',[.64,.06,5,10],0xe2ad72,0,2.18,0,rig,true);halo.rotation.x=Math.PI/2;}
 }else{
  const c=kind==='spitter'?0x83618e:0x417b71;cone(rig,c,0,.65,0,.48,1.2);orb(rig,0xb3bb9e,0,1.26,0,.25);cone(rig,kind==='spitter'?0xa98aae:0x4a9680,0,1.61,0,.4,.65);for(const s of [-1,1])orb(rig,0xffda9b,s*.11,1.28,.22,.034,true);const staff=new T.Group();staff.position.set(.48,.76,.1);rig.add(staff);g.userData.staff=staff;mesh('CylinderGeometry',[.035,.04,1.5,5],0x897256,0,0,0,staff);g.userData.focus=orb(staff,kind==='spitter'?0xe19be9:0x8be7b1,0,.82,0,.16,true);
 }
 g.userData.kind=kind;g.userData.legs=[];g.userData.arms=[];
 // Articulate existing meshes around their actual hips/shoulders, retaining shared geometry.
 const pivot=(part,height)=>{const joint=new T.Group();joint.position.copy(part.position);joint.position.y=height;rig.add(joint);part.position.sub(joint.position);joint.add(part);return joint;};
 for(const part of [...rig.children]){
  if(kind==='wolf'&&part.geometry?.type==='CylinderGeometry'){const joint=pivot(part,.48);g.userData.legs.push({joint,phase:(joint.position.x*joint.position.z>0?0:Math.PI)});}
  if(['golem','boss'].includes(kind)&&part.geometry?.type==='BoxGeometry'&&part.position.y<.5){const joint=pivot(part,.57);g.userData.legs.push({joint,phase:joint.position.x<0?0:Math.PI});}
  if(['golem','boss'].includes(kind)&&part.geometry?.type==='DodecahedronGeometry'&&Math.abs(part.position.x)>.6){const arm=pivot(part,1.34);g.userData.arms.push(arm);mesh('CapsuleGeometry',[.23,.32,3,7],kind==='boss'?0x536575:0x68735e,0,-.64,.05,arm);}
 }
 if(polished)polishEnemyAppearance(g);
 return g;
}
function regionalActor(id){
 const cfg=REGIONAL_ENEMIES[id],g=actor(cfg.role,undefined,false),d=g.userData,rig=d.rig,snow=cfg.map==='snow';d.species=id;
 // Materials and geometry are cached; never recolor a material shared with forest actors.
 g.traverse(o=>{if(o.isMesh){const lit=o.material.emissiveIntensity>0,old=o.material.color.getHex();o.material=mat(lit?(snow?0x8bdaf1:0xff9b42):snow?(old===0x42556b||old===0x293c4d?0x486777:0xd5e3df):0x493d43,lit);}});
 if(cfg.role==='mushroom'){
  rig.clear();d.ears=[];d.feet=[];const head=new T.Group();head.position.set(0,.9,.12);rig.add(head);d.cap=head;
  const body=orb(rig,snow?0xdce7e2:0x6c3832,0,.48,0,.43);body.scale.set(1,1.1,.9);
  orb(head,snow?0xe9eee4:0xa14a30,0,0,.05,.28);
  for(const side of [-1,1]){const ear=cone(head,snow?0xd3e7eb:0x372e34,side*.17,.38,0,snow?.075:.11,snow?.62:.4);ear.rotation.z=side*-.16;d.ears.push(ear);orb(head,snow?0x304855:0xffb259,side*.105,.015,.285,.04,!snow);const foot=orb(rig,snow?0xb4cdce:0x4c3031,side*.28,.12,.2,.16);foot.scale.z=1.5;d.feet.push(foot);}
  orb(head,snow?0xcb9695:0xffc15c,0,-.075,.325,.045,!snow);const tail=orb(rig,snow?0xe5eddf:0xda6334,0,.4,-.38,.14,!snow);d.smallTail=tail;if(!snow){tail.scale.set(.65,.65,2.2);for(let i=0;i<3;i++)cone(rig,0xf38a3b,0,.8-i*.12,-.1-i*.14,.09,.25);}
 }else if(cfg.role==='wolf'){
  for(let i=0;i<4;i++){const spike=cone(rig,snow?0xa4cfdd:0xf0934a,0,1.04,-.35+i*.2,.11,snow?.28:.4);spike.rotation.x=-.25;}
  if(!snow){d.head.children.filter(o=>o.geometry?.type==='ConeGeometry').forEach(o=>{o.scale.y=.3;});d.tail.scale.z=1.65;for(const side of [-1,1]){const fin=cone(d.head,0xba6140,side*.3,.12,-.08,.15,.28);fin.rotation.z=side*.8;}}
 }else if(cfg.role==='golem'||cfg.role==='boss'){
  if(snow){g.traverse(o=>{if(o.isMesh&&o.geometry.type==='DodecahedronGeometry')o.geometry=geometry('SphereGeometry',[1,10,7]);if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.geometry.parameters.height>.5)o.geometry=geometry('CapsuleGeometry',[.20,.25,3,8]);});for(const o of [...rig.children])if(o.geometry?.type==='ConeGeometry'||o.geometry?.type==='TorusGeometry'||o.position.y===1.15&&o.position.z===.64)rig.remove(o);
   const face=orb(rig,0x567382,0,1.84,.31,.26);face.scale.set(1,.8,.55);for(const side of [-1,1]){orb(rig,0x92e6f7,side*.115,1.87,.46,.045,true);cone(rig,0xf2eddb,side*.17,1.67,.44,.06,.22);for(let i=0;i<3;i++)cone(rig,0xc7dad8,side*(.49+i*.14),1.25-i*.08,.1,.16,.4);}
   if(cfg.role==='boss')for(let i=-2;i<=2;i++)cone(rig,0x8ecde7,i*.18,2.2+(.2-Math.abs(i)*.06),0,.10,.48-Math.abs(i)*.05);
  }else{for(const side of [-1,1]){const horn=cone(rig,0x372b34,side*.4,2.05,-.05,.17,.8);horn.rotation.z=-side*.4;for(let i=0;i<3;i++){const crack=box(rig,0xea7738,side*(.13+i*.12),.8+i*.2,.65-i*.04,.045,.25,.025);crack.material=mat(0xea7738,true);crack.rotation.z=side*.6;}}}
 }else if(id==='snowtotem'||id==='cinderwisp'){
  rig.clear();d.staff=null;d.focus=null;d.cores=[];d.satellites=new T.Group();rig.add(d.satellites);
  for(let i=0;i<3;i++){const core=mesh('OctahedronGeometry',[.34-i*.07],snow?0x80bad4:0xf38936,0,.6+i*.34,0,rig,!snow);core.scale.y=snow?1.15:.8;d.cores.push(core);}
  for(const side of [-1,1]){const shard=mesh('OctahedronGeometry',[snow?.14:.23],snow?0xc2eef1:0x413544,side*.48,.95,0,d.satellites,snow);shard.scale.y=1.8;}
  if(!snow){for(let i=0;i<3;i++)cone(rig,0x71382e,Math.sin(i*2.1)*.2,1.25,Math.cos(i*2.1)*.2,.10,.4);}
 }else{
  for(const side of [-1,1]){const crown=cone(rig,snow?0x91c9e2:0x382832,side*.23,1.92,0,.1,.45);crown.rotation.z=-side*.3;}
  if(snow)for(const side of [-1,1]){const ice=mesh('OctahedronGeometry',[.13],0xb3dceb,side*.42,1.02,-.13,rig);ice.scale.y=2.3;}
  else {const stole=box(rig,0x973e32,0,.77,.4,.21,.78,.06);stole.rotation.x=-.1;}
 }
 return g;
}
export function animateActor(g,t,speed=0,attack=0,hurt=0){
 const d=g.userData,dt=d.feedbackTime===undefined?1/60:Math.max(0,Math.min(.1,t-d.feedbackTime));d.feedbackTime=t;restoreEnemyHit(g);animateBaseActor(g,t,speed,attack,d.hitReaction?0:hurt);animateEnemyHit(g,dt);
}
function animateBaseActor(g,t,speed=0,attack=0,hurt=0){
 const special=g.userData;if(special.coastModel){const dt=special.lastTime===undefined?1/60:Math.max(0,Math.min(.05,t-special.lastTime));special.lastTime=t;restoreWaterPose(g);animateCoastEnemy(g,t,speed,attack,dt);animateWaterPose(g,t,speed);return;}if(special.bossModel||special.sandModel){const dt=special.lastTime===undefined?1/60:Math.max(0,Math.min(.05,t-special.lastTime));special.lastTime=t;if(special.bossModel)animateBoss(g,t,speed,dt);else animateSandEnemy(g,t,speed,attack,dt);return;}
 if(!g.userData.rig)return;restoreWaterPose(g);const d=g.userData,landSpeed=speed*(1-.9*T.MathUtils.smoothstep(d.waterBlend??d.waterDepth??0,.42,.85));if(d.skinned){animateSkinnedHero(g,t,landSpeed,attack,hurt);animateWaterPose(g,t,speed);return;}if(d.leftKnee){animateHero(g,t,landSpeed,attack);animateWaterPose(g,t,speed);return;}
 if(d.satellites){d.satellites.rotation.y=t*.9;d.satellites.position.y=Math.sin(t*3)*.08;}
 const dt=d.lastTime===undefined?1/60:Math.max(0,Math.min(.05,t-d.lastTime));d.lastTime=t;
 d.stride=(d.stride||0)+(Math.min(1,speed/2.5)-(d.stride||0))*(1-Math.exp(-dt*14));
 const motion=ENEMY_MOTION[d.species||d.kind],stride=d.stride,heavy=['golem','boss'].includes(d.kind),frequency=motion?.cadence||(heavy?5.2:d.kind==='wolf'?13:9);
 d.phase=(d.phase||0)+dt*frequency*(.45+Math.min(speed,8)*.16);const phase=d.walkPhase??d.phase,rig=d.rig;
 if(attack>0&&!(d.previousAttack>0))d.attackLength=attack;
 const wind=attack>0?1-T.MathUtils.clamp(attack/(d.attackLength||.6),0,1):0,pounce=d.pounce||0;
 if((d.previousPounce||0)>0&&pounce<=0)d.landing=.18;d.previousPounce=pounce;
 d.landing=Math.max(0,(d.landing||0)-dt);
 const releaseDuration=motion?.recover||.2;if(attack<=0&&d.previousAttack>0)d.release=d.cancelled?0:releaseDuration;d.cancelled=false;d.previousAttack=attack;
 d.release=Math.max(0,(d.release||0)-dt);const strike=Math.sin(Math.PI*(1-d.release/releaseDuration));
 const impact=Math.sin(Math.PI*T.MathUtils.clamp(hurt/.12,0,1)),brace=Math.sin(Math.PI*wind),landing=Math.sin(Math.PI*(1-d.landing/.18));
 rig.scale.set(1,1,1);rig.position.set(0,0,-impact*.13);rig.rotation.set(-wind*.16+strike*.20-impact*.18,0,0);
 if(d.kind==='mushroom'){
  const bounce=Math.max(0,Math.sin(phase))*stride;rig.position.y=bounce*.19-brace*.14-landing*.09+Math.sin((1-pounce)*Math.PI)*.4*(pounce>0);
  const squash=Math.sin(phase)*.075*stride-wind*.22+Math.sin((1-pounce)*Math.PI)*.12*(pounce>0)-impact*.14;rig.scale.set(1-squash*.5,1+squash,1-squash*.5);rig.rotation.z=Math.sin(phase*.5)*.08*stride;d.cap.rotation.x=wind*.18-pounce*.2;
 }else if(d.kind==='wolf'){
  rig.position.y=Math.abs(Math.sin(phase))*.065*stride-brace*.15-landing*.1+Math.sin((1-pounce)*Math.PI)*.26*(pounce>0);rig.rotation.x+=Math.sin(phase*2)*.035*stride+wind*.18-pounce*.22+landing*.13;d.head.rotation.x=wind*.25-pounce*.24+landing*.12;d.tail.rotation.y=Math.sin(phase*.7)*(.16+.32*stride);d.tail.rotation.x=-wind*.3+pounce*.26;d.jaw.position.y=-.21-wind*.08-pounce*.035;
  for(const leg of d.legs)leg.joint.rotation.x=Math.sin(phase+leg.phase)*.62*stride-wind*.35+pounce*.65*(leg.joint.position.z>0?1:-1);
 }else if(heavy){
  rig.position.y=Math.abs(Math.sin(phase))*.045*stride-brace*.17;rig.rotation.z=Math.sin(phase)*.055*stride;
  for(const leg of d.legs)leg.joint.rotation.x=Math.sin(phase+leg.phase)*.32*stride;
  d.arms.forEach((arm,i)=>{arm.rotation.x=Math.sin(phase+i*Math.PI)*.26*stride-wind*1.05+strike*.9;arm.rotation.z=(i?-.1:.1)*wind;});
 }else{
  rig.position.y=.09+Math.sin(t*2.5)*.055+Math.abs(Math.sin(phase))*.07*stride-brace*.1;rig.rotation.z=Math.sin(t*2)*.025+Math.sin(phase)*.09*stride;rig.rotation.x+=Math.sin(phase)*.035*stride-wind*.1+strike*.17;
  const breathe=1+Math.sin(t*3)*.015;rig.scale.set(breathe,1-brace*.04,breathe);if(d.staff){d.staff.rotation.x=-wind*(d.attackMode==='heal'?.65:1.1)+strike*.28;d.staff.rotation.z=Math.sin(phase+1)*.09*stride;d.staff.position.y=.76+wind*.23;d.focus.scale.setScalar(1+wind*.65);}
 }
 animateEnemyIdentity(d,t,stride,phase,wind,d.release/releaseDuration,impact);
 animateWaterPose(g,t,speed);g.visible=true;
}
function groundTexture(id,theme){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
 const rgb=[theme.ground>>16&255,theme.ground>>8&255,theme.ground&255];
 if(c.createImageData){
  const data=c.createImageData(512,512),pixels=data.data,noise=seeded(id==='forest'?913:id==='snow'?317:711),lattices=[];
  for(const cells of [4,11,31,83])lattices.push({cells,values:Float32Array.from({length:cells*cells},()=>noise()*2-1)});
  const sample=(layer,x,y)=>{const sx=x/512*layer.cells,sy=y/512*layer.cells,ix=Math.floor(sx),iy=Math.floor(sy),u=sx-ix,v=sy-iy,at=(a,b)=>layer.values[(b%layer.cells)*layer.cells+(a%layer.cells)];const a=at(ix,iy)+(at(ix+1,iy)-at(ix,iy))*u,b=at(ix,iy+1)+(at(ix+1,iy+1)-at(ix,iy+1))*u;return a+(b-a)*v;};
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){const n=sample(lattices[0],x,y)*.46+sample(lattices[1],x,y)*.27+sample(lattices[2],x,y)*.16+sample(lattices[3],x,y)*.11;const fleck=(noise()-.5)*5,shade=n*(id==='snow'?28:21)+(id==='sand'?Math.sin(y*.20+Math.sin(x*.018)*2)*2.8:id==='ash'?-Math.max(0,.055-Math.abs(sample(lattices[2],x,y)))*105:id==='coast'?Math.sin(y*.075+x*.025)*1.7:0),i=(y*512+x)*4;for(let k=0;k<3;k++)pixels[i+k]=Math.max(0,Math.min(255,rgb[k]+shade+fleck));pixels[i+3]=255;}
  c.putImageData(data,0,0);
 }else{c.fillStyle='#'+theme.ground.toString(16).padStart(6,'0');c.fillRect(0,0,512,512);}
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(8*MAP_SCALE,8*MAP_SCALE);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function groundShape(cx,cz,r,rnd,color,segments=24){const points=[0,.014,0],colors=[1,1,1,.68],indices=[];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,rad=r*(.87+rnd()*.2);points.push(Math.cos(a)*rad,.014,Math.sin(a)*rad);colors.push(1,1,1,0);if(i)indices.push(0,i,i+1);}indices.push(0,segments,1);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,4));geo.setIndex(indices);geo.computeVertexNormals();const g=new T.Mesh(geo,detailMaterial(color,1,true));g.userData.ownedGeometry=true;g.position.set(cx,0,cz);g.receiveShadow=true;return g;}
function trail(group,spawn,site,id,rnd){
 const n=30,verts=[],colors=[],indices=[],shade=id==='snow'?0xb7d0cc:id==='ash'?0x795c52:id==='sand'?0xd2be94:0x8a7957;
 for(let i=0;i<=n;i++){const f=i/n,curve=Math.sin(f*Math.PI)*4,x=spawn.x+(site.x-spawn.x)*f+curve,z=spawn.z+(site.z-spawn.z)*f,dx=(site.x-spawn.x)+4*Math.PI*Math.cos(f*Math.PI),dz=site.z-spawn.z,l=Math.hypot(dx,dz),w=(1.75+Math.sin(f*19)*.15)*(i===0||i===n?.85:1);
  const sideX=-dz/l,sideZ=dx/l;for(const [sign,alpha] of [[-1.8,0],[-.62,.13],[.62,.13],[1.8,0]]){const rag=(rnd()-.5)*.12;verts.push(x+sideX*(sign*w+rag),.008,z+sideZ*(sign*w+rag));colors.push(1,1,1,alpha);}
  if(i<n)for(let strip=0;strip<3;strip++){const a=i*4+strip;indices.push(a,a+4,a+1,a+1,a+4,a+5);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,4));geo.setIndex(indices);geo.computeVertexNormals();const path=new T.Mesh(geo,detailMaterial(shade,1,true));path.userData.ownedGeometry=true;path.receiveShadow=true;group.add(path);return path;
}
function placeWeatherParticle(weather,p,x,z,initial=false){
 const random=weather.random,angle=random()*Math.PI*2,radius=Math.sqrt(random())*(initial?16:24);
 p.x=T.MathUtils.clamp(x+Math.sin(angle)*radius,-(weather.half||MAP_HALF)+1,(weather.half||MAP_HALF)-1);p.z=T.MathUtils.clamp(z+Math.cos(angle)*radius,-(weather.half||MAP_HALF)+1,(weather.half||MAP_HALF)-1);
 if(weather.kind==='forest')p.y=1+random()*2.6;
 else if(weather.kind==='snow')p.y=initial?0.4+random()*3.6:3.6+random()*0.5;
 else p.y=initial?0.3+random()*3.5:0.3+random()*0.6;
 p.phase=random()*Math.PI*2;p.scale=weather.kind==='snow'?.75+random()*.7:.6+random()*.8;
 p.life=(weather.kind==='ash'?2:4)+random()*(weather.kind==='forest'?7:4);
 p.vx=weather.kind==='snow'?-1.1-random()*.8:weather.kind==='ash'?.15+random()*.55:(random()-.5)*.45;
 p.vz=weather.kind==='snow'?(random()-.5)*.6:weather.kind==='ash'?(random()-.5)*.4:(random()-.5)*.45;
 if(weather.kind==='coast'){p.vx=.7+random()*.4;p.vz=.25;p.y=.4+random()*2;p.scale=.35+random()*.4;}
 if(weather.kind==='sand'){p.vx=1.2+random();p.vz=.2;p.y=.35+random()*1.5;}
 p.vy=weather.kind==='snow'?-1-random()*.6:weather.kind==='ash'?.65+random()*.5:weather.kind==='sand'?.04:(random()-.5)*.2;
}
function makeWeather(id,rnd,group,spawn,half=MAP_HALF){
 const count=id==='snow'?72:id==='ash'?54:42,colors=id==='snow'?[0xf5ffff,0xc9eafa,0xffffff]:id==='ash'?[0xffaa60,0xf7d39a,0xcb6e51]:id==='coast'?[0xc0d5d0,0x8cbabf,0xa4c7c5]:id==='sand'?[0xdac699,0xc0ac7f,0xe1d4af]:[0xffe9a0,0xc5ef9c,0x95dcc1];
 if(!weatherMaterials.has(id))weatherMaterials.set(id,new T.MeshBasicMaterial({color:0xffffff,map:['forest','snow'].includes(id)?softFirefly():null,transparent:true,opacity:id==='forest'?.64:id==='snow'?.72:.82,depthWrite:false,blending:['snow','sand'].includes(id)?T.NormalBlending:T.AdditiveBlending}));
 const material=weatherMaterials.get(id);
 const cloud=new T.InstancedMesh(['forest','snow'].includes(id)?geometry('PlaneGeometry',id==='forest'?[.42,.42]:[.22,.22]):geometry('DodecahedronGeometry',[id==='snow'?.115:.075,0]),material,count);
 cloud.castShadow=false;cloud.receiveShadow=false;cloud.frustumCulled=false;cloud.instanceMatrix.setUsage(T.DynamicDrawUsage);
 const weather={kind:id,half,mesh:cloud,particles:[],dummy:new T.Object3D(),random:rnd,lastTime:undefined};
 for(let i=0;i<count;i++){const p={};placeWeatherParticle(weather,p,spawn.x,spawn.z,true);weather.particles.push(p);cloud.setColorAt(i,new T.Color(colors[i%colors.length]));}
 cloud.instanceColor.needsUpdate=true;group.add(cloud);return weather;
}
function buildSites(group,sites,theme){
 for(const site of sites){const g=new T.Group();g.position.set(site.x,0,site.z);group.add(g);g.visible=false;site.mesh=g;const base=mesh('CylinderGeometry',[2,2.3,.25,8],0x68796b,0,.12,0,g);if(site.type==='relic'){for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const prong=mesh('ConeGeometry',[.28,1.5,5],0xb19a65,Math.sin(a)*1.15,.8,Math.cos(a)*1.15,g);prong.rotation.z=Math.sin(a)*.2;}site.crystal=mesh('OctahedronGeometry',[.8],0xffd572,0,1.1,0,g,true);box(g,0xd9ba78,0,.35,0,1.3,.3,1.3);}else if(site.type==='altar'){for(const side of [-1,1])box(g,0x8d9b88,side*1.3,1.1,0,.42,2.2,.5);box(g,0xabb398,0,2.35,0,3.2,.4,.7);const crystal=mesh('OctahedronGeometry',[.65],theme.accent,0,1.1,0,g,true);site.crystal=crystal;}else{box(g,0x99724c,0,.62,0,1.4,.8,.9);box(g,0xd6b571,0,1.04,0,1.5,.18,1);box(g,0xebd595,0,.72,.48,.18,.45,.07);}const ring=groundCue(theme.accent,2,'glow',.2);ring.position.set(0,.28,0);g.add(ring);site.ring=ring;
  if(site.event){const color=MAP_EVENTS[site.event].color;site.eventGlow=mesh('OctahedronGeometry',[.3],color,0,2.8,0,g,true);
   if(site.event==='lighthouse'){mesh('CylinderGeometry',[.65,1.05,2.5,12],0x9fada3,0,1.25,0,g);mesh('CylinderGeometry',[.9,.9,.18,12],0x6b888a,0,2.55,0,g);site.lantern=mesh('SphereGeometry',[.4,12,8],0x77c7cb,0,2.9,0,g,true);cone(g,0x5b777b,0,3.45,0,1,.65);}
   if(site.event==='excavation'){const mound=mesh('DodecahedronGeometry',[1.6,1],0xb7a079,0,.14,0,g);mound.scale.set(1,.18,.8);const lid=box(g,0x695849,0,.4,0,1.3,.4,.8);lid.rotation.z=.15;for(const x of[-.4,.4])box(g,0xc5a064,x,.64,0,.1,.06,.85);}
   if(site.event==='salvage'){for(const x of[-.7,.65]){const crate=box(g,0x766c55,x,.4,0,.95,.8,.9);crate.rotation.z=x*.16;for(const z of[-.4,.4])box(g,0x96aaa1,x,.46,z,1,.1,.08);}for(let i=0;i<3;i++){const plank=box(g,0x587d78,-1+i,.08,.8+i*.25,1.7,.12,.22);plank.rotation.y=i*.6;}}
   if(site.event==='mechanism'){const wheel=mesh('TorusGeometry',[.65,.12,6,14],0xb19761,0,1.2,.55,g);site.wheel=wheel;box(g,0xa2987b,0,.7,0,1.3,1.2,.7);}
   if(site.event==='purify'){for(let j=0;j<5;j++){const a=j*1.26;const root=mesh('CapsuleGeometry',[.12,1.6,3,5],0x507953,Math.sin(a)*1.2,.65,Math.cos(a)*1.2,g);root.rotation.z=Math.sin(a)*.5;orb(g,0x8fbd7c,Math.sin(a)*.8,1.6,Math.cos(a)*.8,.25);}}
   if(site.event==='beacons'){site.nodes=eventNodes(site.x,site.z,site.eventAngle);for(const n of site.nodes){mesh('CylinderGeometry',[.4,.55,.18,6],0x708c97,n.x-site.x,.1,n.z-site.z,g);n.mesh=mesh('OctahedronGeometry',[.5],0x4b778a,n.x-site.x,.75,n.z-site.z,g);n.mesh.scale.y=1.7;}}
   if(site.event==='forge'){for(let j=0;j<4;j++){const a=j*Math.PI/2;const pipe=mesh('CylinderGeometry',[.3,.4,.85,6],0x796253,Math.sin(a)*1.9,.45,Math.cos(a)*1.9,g);pipe.rotation.z=Math.sin(a)*.3;}site.furnace=mesh('SphereGeometry',[.65,8,6],0xff9c50,0,.55,0,g,true);}
   if(site.event==='ambush')for(const side of [-1,1]){mesh('CylinderGeometry',[.07,.1,2.3,5],0x76624e,side*1.9,1.15,0,g);const banner=box(g,0x9d5d4b,side*1.9,1.75,0,.6,.65,.06);banner.rotation.z=side*.1;}
  }
 }
}
export function buildWorld(id,seed=1){if(id==='confluence')return buildConfluence(seed,{mesh,trail,makeWeather,buildSites,groundShape});const theme=MAPS[id],rnd=seeded(seed),coastLayout=id==='coast'?buildCoastLayout(rnd,MAP_HALF):null,group=new T.Group(),obstacles=[],patches=[],sites=[{x:24+rnd()*10,z:-32+rnd()*10,type:'altar',claimed:false},{x:-34+rnd()*10,z:23+rnd()*10,type:'supply',claimed:false},{x:-25-rnd()*8,z:-5-rnd()*8,type:'relic',claimed:false}],spawn={...(coastLayout?.spawn||{x:-12,z:9})};
 const bearing=rnd()*Math.PI*2;for(const site of sites.slice(0,2)){const x=site.x,z=site.z;site.x=x*Math.cos(bearing)-z*Math.sin(bearing);site.z=x*Math.sin(bearing)+z*Math.cos(bearing);}
 // Place the early relic in a different direction, clear of the central ruin and other landmarks.
 for(let attempt=0;attempt<24;attempt++){const a=rnd()*Math.PI*2,r=20+rnd()*8,x=spawn.x+Math.sin(a)*r,z=spawn.z+Math.cos(a)*r;if(Math.hypot(x,z)>11&&sites.slice(0,2).every(s=>Math.hypot(s.x-x,s.z-z)>15)){Object.assign(sites[2],{x,z});break;}}
 // Outer optional rewards make the expanded space worth exploring; the early relic stays nearby.
 for(const [i,type]of ['supply','altar'].entries()){const a=rnd()*1.1+i*Math.PI+1,r=MAP_HALF-16+rnd()*6;sites.push({x:Math.sin(a)*r,z:Math.cos(a)*r,type,claimed:false});}
 if(coastLayout)sites.forEach((s,i)=>Object.assign(s,coastLayout.sites[i]));
 const districts=coastLayout?.districts||districtLayout(id,spawn),groves=groveCenters(spawn,rnd);
 sites[0].event=biomeEvent(id);sites[0].eventAngle=rnd()*Math.PI*2;sites[3].event=id==='sand'?'excavation':id==='coast'?'salvage':'ambush';sites[3].eventAngle=rnd()*Math.PI*2;sites[3].eventVariant=rnd()<.5?0:1;
 for(const [i,site]of sites.entries()){site.availableAt=siteSchedule(site,i,rnd);site.discovered=false;site.reveal=0;}
 const ground=mesh('PlaneGeometry',[(MAP_HALF+8)*2,(MAP_HALF+8)*2],theme.ground,0,-.03,0,group);ground.rotation.x=-Math.PI/2;
 if(!terrainMaterials.has(id))terrainMaterials.set(id,new T.MeshStandardMaterial({map:groundTexture(id,theme),roughness:1}));ground.material=terrainMaterials.get(id);

 const ponds=id==='sand'?[]:buildPonds(group,id,rnd,spawn,sites,coastLayout?.ponds);patches.push(...ponds);const inWater=(x,z,padding=0)=>ponds.some(p=>waterDepth(id==='coast'?{...p,rx:p.rx*1.19+padding,rz:p.rz*1.19+padding,r:p.r*1.19+padding}:p,x,z)>0);
 // Soft irregular paths and terrain islands give the forest a readable floor.
 for(const site of sites){site.trail=trail(group,spawn,site,id,rnd);site.trail.visible=site.type==='relic';}
 for(let i=0;i<28;i++){const x=(rnd()-.5)*106*MAP_SCALE,z=(rnd()-.5)*106*MAP_SCALE,r=2+rnd()*3;if(Math.hypot(x-spawn.x,z-spawn.z)<9||id==='coast'&&(inWater(x,z,r)||sites.some(s=>Math.hypot(x-s.x,z-s.z)<r+6)))continue;const kind=id==='ash'&&i%3===0&&!sites.some(s=>Math.hypot(x-s.x,z-s.z)<(s.event?9:7))?'vent':'slow',patch={x,z,r,kind,phase:rnd()*4};patches.push(patch);group.add(groundShape(x,z,r,rnd,id==='snow'?0xc1d6d9:id==='ash'?kind==='vent'?0xb55438:0x8b6255:id==='sand'?0x938366:0x2b4640));if(kind==='vent'){const marker=groundCue(0xffa45f,r);marker.position.set(x,.09,z);group.add(marker);marker.visible=false;patch.marker=marker;}}
 for(let i=0;i<300;i++){const center=groves[i%groves.length],cluster=['forest','snow'].includes(id)&&i%4!==0,a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*7,x=cluster?center.x+Math.sin(a)*r:(rnd()-.5)*118*MAP_SCALE,z=cluster?center.z+Math.cos(a)*r:(rnd()-.5)*118*MAP_SCALE;if(obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<2.3)||districts.some(d=>Math.hypot(x-d.x,z-d.z)<10)||(id==='coast'?inWater(x,z,1.2):ponds.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+1))||Math.hypot(x-spawn.x,z-spawn.z)<7||Math.hypot(x,z)<7||sites.some(s=>Math.hypot(x-s.x,z-s.z)<(s.event?9:7))||patches.some(p=>p.kind==='vent'&&Math.hypot(x-p.x,z-p.z)<p.r+1.05)||Math.abs(x-z)<3||Math.abs(x+z)<3)continue;const tall=2.5+rnd()*3.5,tree=new T.Group();tree.position.set(x,0,z);group.add(tree);obstacles.push({x,z,r:.65,mesh:tree});
  if(id==='coast'){obstacles.at(-1).r=coastProp(tree,i,rnd);}
  else if(id==='sand'){const h=.6+rnd()*1.9;if(i%4===0){mesh('CylinderGeometry',[.5,.64,h,10],0xa6977c,0,h/2,0,tree);box(tree,0xc2b89b,0,h+.1,0,1.15,.2,1.15);}else{const rock=mesh('DodecahedronGeometry',[.7,1],i%2?0xb1a083:0x978768,0,.3,0,tree);rock.scale.set(1,.5+rnd()*.6,1);if(i%3===0){const slab=box(tree,0xbcb092,0,.4,0,.9,.45,.8);slab.rotation.z=.25;}}}
  else if(id==='ash'){const stone=mesh('DodecahedronGeometry',[1.2,0],0x66565c,0,tall*.38,0,tree);stone.scale.multiply(new T.Vector3(.7,tall*.55,.8));cone(tree,0xeaa169,0,tall*.8,0,.24,.85);}
  else{
   const bend=(rnd()-.5)*.18,variation=.78+rnd()*.38;let angle=0;
   // Keep the established random stream, so tree shapes never move obstacles or rewards.
   for(let j=0;j<3;j++){angle+=j*2.27+rnd()*.55;if(id!=='snow')angle+=(rnd()-.5)*.13+(rnd()-.5)*.2+(rnd()-.5)*.18;}
   addTree(tree,id,tall,{bend,variation,angle});
  }
 }
 if(id==='sand')for(let i=0;i<18;i++){const x=(rnd()-.5)*(MAP_HALF-10)*2,z=(rnd()-.5)*(MAP_HALF-10)*2;for(const [offset,color]of [[0,0xd5c099],[1.7,0x928469]]){const dune=groundShape(x,z+offset,2.5+rnd()*1.5,rnd,color);dune.scale.set(2.8,1,.7);dune.rotation.y=.25+Math.sin(i)*.2;group.add(dune);}}
 const foliage=[];if(!['ash','sand','coast'].includes(id))for(const o of obstacles)for(const leaf of o.mesh.children)if(leaf.userData.treeCanopy)foliage.push({leaf,x:leaf.position.x,z:leaf.position.z,phase:o.x*.17+o.z*.13});
 buildSites(group,sites,theme);
 if(id==='sand'){const s=sites[0],a=Math.atan2(s.x-spawn.x,s.z-spawn.z);s.gates=[];for(let i=-1;i<=1;i++){const x=s.x-Math.sin(a)*11+Math.cos(a)*i*1.75,z=s.z-Math.cos(a)*11-Math.sin(a)*i*1.75,g=new T.Group();g.position.set(x,0,z);box(g,0x847f6b,0,1.25,0,1.7,2.5,.8);g.rotation.y=a;group.add(g);const gate={x,z,r:.95,mesh:g};obstacles.push(gate);s.gates.push(gate);}}

 const campX=spawn.x-2.5,campZ=spawn.z+1.5,fire=new T.Group();fire.position.set(campX,.18,campZ);group.add(fire);
 const flame=cone(fire,0xff8d42,0,.41,0,.19,.85);flame.material=mat(0xff8d42,true);const core=cone(fire,0xffd188,0,.42,.01,.09,.53);core.material=mat(0xffd188,true);
 const light=new T.PointLight(0xffa85c,6.5,9,2);light.position.set(campX,1.25,campZ);group.add(light);for(let i=0;i<6;i++){const a=i*Math.PI/3;const log=mesh('CylinderGeometry',[.09,.14,1.1,6],0x624c3d,campX+Math.cos(a)*.23,.14,campZ+Math.sin(a)*.23,group);log.rotation.z=Math.PI/2;log.rotation.y=a;}
 const motes=[];for(let i=0;i<18;i++){const m=orb(group,theme.accent,spawn.x+(rnd()-.5)*20,1+rnd()*3,spawn.z+(rnd()-.5)*20,.035,true);motes.push(m);}
 const weather=makeWeather(id,rnd,group,spawn);
 const result={half:MAP_HALF,coastLayout,group,ground,groves,obstacles,patches,ponds,sites,spawn,theme,fire,light,motes,foliage,weather};if(id==='coast')installCoast(result);if(districts.length)buildDistricts(result,id,districts,mesh,rnd);installDiscoveries(result,id,rnd);installTactics(result,id,rnd);installRoaming(result,id,rnd);installScenery(result,id,rnd);return result;
}
export function animateWorld(world,t,focusX=world.spawn.x,focusZ=world.spawn.z){
 if(world.regions){for(const r of world.regions){r.sandstorm=r.id==='sand'?world.sandstorm:null;r.tide=r.id==='coast'?world.tide:null;animateWorld(r,t,focusX,focusZ);}animateScenery(world,t,focusX,focusZ);return;}
 animateWater(world.weather.kind,t);animateScenery(world,t,focusX,focusZ);
 for(const f of world.foliage){const sway=Math.sin(t*1.35+f.phase)*.026+Math.sin(t*2.7+f.phase)*.008;f.leaf.rotation.z=sway;f.leaf.position.x=f.x+sway*1.3;f.leaf.position.z=f.z+Math.cos(t*1.1+f.phase)*.015;}
 const weather=world.weather,dt=weather.lastTime===undefined?0:Math.max(0,Math.min(.05,t-weather.lastTime));weather.lastTime=t;
 for(let i=0;i<weather.particles.length;i++){
  const p=weather.particles[i],d=weather.dummy;
  const gust=weather.kind==='sand'?1+3*(world.sandstorm?.strength||0):weather.kind==='coast'&&world.tide?.high?1.8:1;p.x+=p.vx*dt*gust;p.z+=p.vz*dt;p.y+=p.vy*dt;p.life-=dt;
  if(p.life<=0||p.y<.3||p.y>4.3||Math.hypot(p.x-focusX,p.z-focusZ)>30)placeWeatherParticle(weather,p,focusX,focusZ);
  d.position.set(p.x+Math.sin(t*1.3+p.phase)*.05,weather.kind==='forest'?p.y+Math.sin(t*2+p.phase)*.16:p.y,p.z);
  d.scale.setScalar(p.scale*(weather.kind==='snow'?1:.8)*Math.min(1,p.life*1.5)*(world.regional?(biomeWeights(p.x,p.z)[weather.kind]||0):1));
  if(['forest','snow'].includes(weather.kind)){d.rotation.set(-.79,Math.PI/4,0,'YXZ');d.scale.multiplyScalar(.84+.16*Math.sin(t*1.8+p.phase));}
  else d.rotation.set(0,t*.6+p.phase,0);
  if(weather.kind==='sand'&&world.sandstorm?.active){d.scale.x*=3;d.scale.y*=.5;d.rotation.y=0;}d.updateMatrix();weather.mesh.setMatrixAt(i,d.matrix);
 }
 weather.mesh.instanceMatrix.needsUpdate=true;
}
export function clearAt(world,x,z,r=.45){return Math.abs(x)<(world.half||MAP_HALF)-r&&Math.abs(z)<(world.half||MAP_HALF)-r&&!world.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.r);}
export function moveActor(world,p,dx,dz,r=.45){let x=p.x+dx,z=p.z+dz;if(clearAt(world,x,z,r)){p.x=x;p.z=z;return;}if(clearAt(world,x,p.z,r))p.x=x;if(clearAt(world,p.x,z,r))p.z=z;}

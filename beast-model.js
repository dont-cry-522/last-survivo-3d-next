import{badgerAttack,badgerCadence,badgerIdle,smooth}from'./badger-motion.js?v=114';
import{swimLimb as placeLimb}from'./swim-motion.js?v=114';
import * as T from './vendor/three.module.js';
import{weaponInlay,nameWeapon}from'./weapon-identity.js?v=172';
const geo=new Map(),mats=new Map();
function material(c){if(!mats.has(c))mats.set(c,new T.MeshStandardMaterial({color:c,roughness:.84}));return mats.get(c);}
function sphere(g,c,x,y,z,sx,sy,sz){if(!geo.has('sphere'))geo.set('sphere',new T.SphereGeometry(1,24,16));const m=new T.Mesh(geo.get('sphere'),material(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
const joint=(g,x,y,z)=>{const n=new T.Group();n.position.set(x,y,z);g.add(n);return n;};
let boneTemplate;
export function boneBoomerang(){
 if(boneTemplate)return boneTemplate.clone();const g=new T.Group(),shape=new T.Shape();g.name='Lingya_carved_bone';
 shape.moveTo(-.48,.27);shape.quadraticCurveTo(-.42,.025,-.13,-.14);shape.quadraticCurveTo(0,-.23,.13,-.14);shape.quadraticCurveTo(.42,.025,.48,.27);shape.quadraticCurveTo(.36,.23,.23,.13);shape.quadraticCurveTo(.08,.035,0,-.015);shape.quadraticCurveTo(-.08,.035,-.23,.13);shape.quadraticCurveTo(-.36,.23,-.48,.27);
 const geometry=new T.ExtrudeGeometry(shape,{depth:.032,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3,steps:1,curveSegments:20});geometry.translate(0,0,-.016);geometry.rotateX(Math.PI/2);
 const p=geometry.attributes.position,colors=[];for(let i=0;i<p.count;i++){const c=new T.Color(0xe0d1aa).multiplyScalar(.89+.08*Math.cos(p.getX(i)*9)+.035*Math.sin(p.getZ(i)*31));colors.push(c.r,c.g,c.b);}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.add(new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.66})));
 const wrap=new T.CylinderGeometry(.046,.046,.025,10);for(let i=0;i<5;i++){const m=new T.Mesh(wrap,material(i%2?0x59674e:0x817154));m.rotation.z=Math.PI/2;m.position.set((i-2)*.026,0,-.09);g.add(m);}
 sphere(g,0xa98951,0,.038,-.09,.022,.010,.023);
 const clawMarks=[];for(const side of[-1,1])for(let i=0;i<3;i++){const x=side*(.20+i*.031),z=.043+i*.025;clawMarks.push([[x-side*.009,.029,z-.014],[x,.030,z+.006],[x+side*.009,.029,z+.018]]);}
 weaponInlay(g,'SM_Boomerang_BadgerClawCarving',clawMarks,0x988056,.0017,.08);
 nameWeapon(g,'lingya','boomerang');g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});boneTemplate=g;return g.clone();
}
export function makeBadger(){
 const g=new T.Group(),rig=new T.Group();g.add(rig);const d=g.userData={rig,legs:[],eyes:[],phase:0};
 // A broad low torso and tapered mask distinguish the badger from the enemy wolf.
 d.body=sphere(rig,0x666a68,0,.43,-.05,.34,.27,.53);sphere(rig,0xb1aaa0,0,.32,.09,.28,.13,.34);d.shoulders=joint(rig,0,.42,.25);d.haunch=joint(rig,0,.43,-.35);
 const head=joint(rig,0,.45,.40);d.head=head;
 if(!geo.has('badgerHead')){const h=new T.SphereGeometry(1,28,18),p=h.attributes.position,colors=[];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),taper=1-Math.max(0,z)*.45;p.setXYZ(i,x*.26*taper,y*.225*(1-Math.max(0,z)*.2),z*.33);const stripe=Math.abs(x)>.22&&Math.abs(x)<.73&&y>-.50,grain=.93+.04*Math.sin(x*37+y*22+z*19),c=new T.Color(stripe?0x292e32:0xe1dbcc).multiplyScalar(grain);colors.push(c.r,c.g,c.b);}h.setAttribute('color',new T.Float32BufferAttribute(colors,3));h.computeVertexNormals();geo.set('badgerHead',h);mats.set('mask',new T.MeshStandardMaterial({vertexColors:true,roughness:.86}));}
 const face=new T.Mesh(geo.get('badgerHead'),mats.get('mask'));face.castShadow=true;head.add(face);sphere(head,0x252c2d,0,-.035,.323,.064,.045,.04);
 d.jaw=joint(head,0,-.045,.10);sphere(d.jaw,0xbbb5a8,0,-.025,.105,.11,.045,.16);sphere(d.jaw,0x38312d,0,.014,.14,.078,.012,.095);
 for(const sign of[-1,1]){const ear=joint(head,sign*.20,.17,-.025);sphere(ear,0x484c49,0,0,0,.082,.091,.045);sphere(ear,0xc7b69d,0,.008,.033,.049,.057,.016);d['ear'+sign]=ear;const eye=joint(head,sign*.145,.052,.205);sphere(eye,0x182323,0,0,0,.032,.035,.020);sphere(eye,0xf4e8ca,-.008,.011,.018,.008,.009,.006);d.eyes.push(eye);}
 for(const side of[-1,1])for(const z of[-.35,.31]){const leg=joint(z>0?d.shoulders:d.haunch,side*.235,z>0?-.08:-.09,z>0?.06:0);sphere(leg,0x474b48,0,-.095,0,.086,.14,.096);const knee=joint(leg,0,-.24,0);sphere(knee,0x474b48,0,-.07,.008,.065,.12,.073);const paw=joint(knee,0,-.22,0);sphere(paw,0x353c3c,0,0,.025,.098,.057,.13);for(let k=0;k<3;k++)sphere(paw,0xc8b998,(k-1)*.036,-.007,.139,.010,.012,.031);d.legs.push({joint:leg,knee,paw,front:z>0,side,home:new T.Vector3(side*.235,.06,z),phase:z>0?(side>0?.5:0):(side>0?.25:.75),current:new T.Vector3(),anchor:new T.Vector3(),from:new T.Vector3(),to:new T.Vector3(),ready:false,swinging:false});}
 d.tail=joint(rig,0,.36,-.49);sphere(d.tail,0x737770,0,.07,-.15,.105,.105,.22);sphere(d.tail,0xc0bdb0,0,.08,-.32,.07,.07,.08);
 // Small cloth kerchief ties it visually to Lingya without armor or distracting glow.
 sphere(rig,0x678273,0,.36,.35,.29,.095,.13);return g;
}
const footOrigin=new T.Vector3(),footOffset=new T.Vector3(),footTarget=new T.Vector3(),inverseBody=new T.Quaternion(),footOrientation=new T.Quaternion(),parentOrientation=new T.Quaternion();
export function animateBadger(g,t,speed,state='look',progress=0,turnRate=0){
 const d=g.userData,dt=d.last===undefined?1/60:Math.max(0,Math.min(.05,t-d.last));d.last=t;
 const blend=1-Math.exp(-dt*18),ease=(o,key,target)=>o[key]+=(target-o[key])*blend;
 d.waterBlend=(d.waterBlend||0)+(T.MathUtils.smoothstep(d.waterDepth||0,.25,.80)-(d.waterBlend||0))*(1-Math.exp(-dt*7));const wet=d.waterBlend;
 d.swimPhase=((d.swimPhase||0)+dt*(.65+Math.min(speed,4)*.12))%1;
 if(state==='down'){d.wasDown=true;ease(d.rig.rotation,'z',1.2);ease(d.rig.position,'y',-.06);ease(d.head.rotation,'x',.22);for(const eye of d.eyes)eye.scale.y=.1;return;}
 if(d.wasDown){d.wasDown=false;d.rig.rotation.set(0,0,0);d.rig.position.y=0;d.motionSpeed=0;for(const leg of d.legs){leg.ready=false;leg.swinging=false;}}

 d.motionSpeed=(d.motionSpeed||0)+(speed-(d.motionSpeed||0))*(1-Math.exp(-dt*9));const moving=d.motionSpeed>.12,run=T.MathUtils.smoothstep(d.motionSpeed,2,6),attacking=['wind','pounce','recover'].includes(state),pose=badgerAttack(state,progress);
 if(moving&&!attacking)d.phase=(d.phase+dt*badgerCadence(d.motionSpeed))%1;
 const sway=Math.sin(d.phase*Math.PI*2),stride=Math.min(1,d.motionSpeed/1.2);
 d.idleClock=(d.idleClock||0)+(moving||attacking?0:dt);const idle=badgerIdle(d.idleClock),rest=(1-stride)*(attacking?0:1);
 d.sniffBlend=(d.sniffBlend||0)+(((state==='sniff'?1:0)*rest)-(d.sniffBlend||0))*(1-Math.exp(-dt*4));const sniff=d.sniffBlend;
 ease(d.rig.position,'y',(pose.air-pose.crouch)*(1-wet*.65)+(attacking?0:Math.sin(d.phase*Math.PI*4)*.010*stride)*(1-wet)-wet*.16+Math.sin(d.swimPhase*Math.PI*4)*.008*wet);
 ease(d.rig.rotation,'z',attacking?0:sway*.018*stride-T.MathUtils.clamp(turnRate*.009,-.055,.055)+idle.shift*rest);
 ease(d.rig.rotation,'x',state==='pounce'?-.07*Math.sin(progress*Math.PI*2):state==='recover'?.08*Math.sin(progress*Math.PI):(d.hurt||0)*.35);
 d.shoulders.position.y=.42+sway*.012*stride-pose.crouch*.35;d.haunch.position.y=.43-sway*.008*stride-pose.crouch*.18;
 d.body.scale.y=.27*(1+Math.sin(t*1.8)*.009);d.body.scale.z=.53*(1+pose.reach*.035);
 ease(d.head.position,'z',.40+sniff*(.055+idle.sniff*.009)*(1-wet)+pose.impact*.045);ease(d.head.position,'y',.45-sniff*.085*(1-wet)-pose.crouch*.3+idle.shift*rest*.4+wet*.035);
 ease(d.head.rotation,'x',sniff*(.24+idle.sniff*.025)*(1-wet)-pose.reach*.08+pose.impact*.12-wet*.10);
 ease(d.head.rotation,'y',idle.look*rest*(1-sniff*.7)+T.MathUtils.clamp(-turnRate*.018,-.13,.13)*(1-rest));
 ease(d.jaw.rotation,'x',pose.jaw);ease(d.tail.rotation,'y',sway*.07*stride+idle.tail*rest);d.tail.rotation.x=-pose.crouch*2+pose.reach*.14;
 d['ear-1'].rotation.z=idle.leftEar*rest+sway*.012*stride;d.ear1.rotation.z=-idle.rightEar*rest-sway*.012*stride;for(const eye of d.eyes)eye.scale.y=1-(1-idle.blink)*rest;
 g.updateMatrixWorld(true);g.getWorldQuaternion(inverseBody).invert();
 for(const l of d.legs){if(l.swinging&&t-l.swingStart>=l.swingDuration){l.swinging=false;l.anchor.copy(l.to);l.current.copy(l.to);}l.urgency=l.ready?l.anchor.distanceTo(g.localToWorld(footTarget.copy(l.home))):0;}
 for(const l of [...d.legs].sort((a,b)=>b.urgency-a.urgency)){
  const home=g.localToWorld(footTarget.copy(l.home)),cycle=(d.phase+l.phase)%1,duty=.72-run*.12,wantsSwing=moving&&cycle>duty;
  if(!l.ready){l.current.copy(home);l.anchor.copy(home);l.ready=true;}
  if(attacking){
   const target=l.home.clone(),reach=state==='pounce'&&l.front?Math.sin(Math.PI*T.MathUtils.clamp(progress+(l.side<0?.10:-.07),0,1)):pose.reach;target.y+=pose.air+(l.front?(l.side<0?.075:.045):.075)*reach;target.z+=(l.front?.19:-.13)*reach;target.x+=l.front?l.side*.025*reach:0;
   g.localToWorld(target);l.current.lerp(target,1-Math.exp(-dt*26));l.anchor.copy(l.current);l.swinging=false;
  }else{
   g.worldToLocal(footOffset.copy(l.anchor));const overstretched=footOffset.z<l.home.z-.28||Math.abs(footOffset.x-l.home.x)>.27;
   const settle=!moving&&l.current.distanceTo(home)>.025;
   if(!l.swinging&&((wantsSwing&&!l.wasSwing&&t-(l.lastLift??-10)>.85/Math.max(.5,badgerCadence(d.motionSpeed)))||overstretched||settle)&&d.legs.filter(leg=>leg.swinging).length<(moving?(speed>3.5?4:2):1)){
    l.swinging=true;l.swingStart=l.lastLift=t;l.swingDuration=moving?.18+run*.04:.24;l.from.copy(l.current);
    l.to.copy(l.home);if(moving)l.to.z+=.23+run*.03;g.localToWorld(l.to);
    // Predict the landing under the moving torso; the planted phase itself never follows it.
    l.to.x+=Math.sin(g.rotation.y)*speed*l.swingDuration;l.to.z+=Math.cos(g.rotation.y)*speed*l.swingDuration;
   }
   if(l.swinging){const u=Math.min(1,(t-l.swingStart)/l.swingDuration);l.current.lerpVectors(l.from,l.to,smooth(u));l.current.y+=Math.sin(Math.PI*u)*(moving?.075+run*.06:.025);if(u>=1){l.swinging=false;l.anchor.copy(l.to);}}
   else l.current.copy(l.anchor);
  }
  l.wasSwing=wantsSwing;l.planted=!attacking&&!l.swinging;
  if(wet>.001){
   const cycle=(d.swimPhase+(l.front?(l.side>0?.5:0):(l.side>0?.15:.65)))%1,a=cycle*Math.PI*2;
   const paddle=l.home.clone();paddle.y+=.11+Math.sin(a)*.065;paddle.z+=Math.cos(a)*(l.front?.17:.12);paddle.x+=l.side*.035;
   g.localToWorld(paddle);l.current.lerp(paddle,wet*(attacking?.45:1));l.anchor.copy(l.current);l.swinging=false;l.planted=false;l.ready=true;
  }
  l.joint.getWorldPosition(footOrigin);footOffset.copy(l.current).sub(footOrigin).applyQuaternion(inverseBody).divideScalar(.46);
  placeLimb(g,l.joint,l.knee,l.paw,footOffset,[0,.1,l.front?-1:1],1,()=>{});
  // Keep the sole level while the shoulder and elbow absorb the body's movement.
  g.getWorldQuaternion(footOrientation);l.paw.parent.getWorldQuaternion(parentOrientation).invert();l.paw.quaternion.copy(parentOrientation.multiply(footOrientation));l.paw.rotateX(wet>.001?Math.sin((d.swimPhase+l.phase)*Math.PI*2)*.22*wet:l.swinging?-.12*Math.sin(Math.PI*Math.min(1,(t-l.swingStart)/l.swingDuration)):0);
 }
}

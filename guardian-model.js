import {primaryGripFrame,fitWeaponToPalm,GRIP_POINTS} from './weapon-grips.js?v=125';
import{heroDodgePose}from'./hero-dodge.js?v=114';
import * as T from './vendor/three.module.js';
import {guardianPose} from './guardian-motion.js?v=114';
const geo=new Map(),mats=new Map();
function material(color,metal=0){const key=color+':'+metal;if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,metalness:metal,roughness:metal?.46:.82,side:T.DoubleSide}));return mats.get(key);}
function geometry(key,create){if(!geo.has(key))geo.set(key,create());return geo.get(key);}
function mesh(parent,shape,color,pos,scale=[1,1,1],metal=0){const m=new T.Mesh(shape,material(color,metal));m.position.set(...pos);m.scale.set(...scale);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
const sphere=()=>geometry('sphere',()=>new T.SphereGeometry(1,16,12));
const ell=(p,c,pos,scale,metal=0)=>mesh(p,sphere(),c,pos,scale,metal);
const tube=(p,c,pos,scale,metal=0)=>mesh(p,geometry('tube',()=>new T.CylinderGeometry(1,1,1,12)),c,pos,scale,metal);
const joint=(p,pos)=>{const g=new T.Group();g.position.set(...pos);p.add(g);return g;};
function plate(p,c,outline,pos,depth=.055,bevel=.025,metal=.5){
 const key='plate:'+outline+':'+depth+':'+bevel,g=geometry(key,()=>{const shape=new T.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1,curveSegments:8});g.translate(0,0,-depth*.5);return g;});return mesh(p,g,c,pos,[1,1,1],metal);
}
// Only equipment is procedural; the body uses the same textured skeletal asset as the ranger.
export function equipGuardian(g,grips){
 const d=g.userData;
 const shield=joint(d.support.hand,[0,0,0]);d.shield=shield;const outline=[[-.32,.4],[0,.49],[.32,.4],[.36,.10],[.28,-.31],[0,-.55],[-.28,-.31],[-.36,.10]];
 shield.name='Guardian_forged_shield';plate(shield,0xb69b70,outline,[0,0,0],.08,.035);plate(shield,0x632a36,outline.map(([x,y])=>[x*.86,y*.86]),[0,0,.065],.045,.022);d.shieldContact=joint(shield,[0,0,.16]);
 plate(shield,0xd1b779,[[-.25,-.15],[-.11,.06],[0,-.045],[.12,.24],[.26,-.15]],[0,0,.118],.026,.009);
 plate(shield,0x3b4950,[[-.035,-.15],[.12,.16],[.16,.035],[.11,.075],[.02,-.15]],[0,0,.142],.008,.004);
 plate(shield,0xd1b779,[[-.18,-.21],[.18,-.21],[.15,-.245],[-.15,-.245]],[0,0,.118],.016,.007);
 for(const s of [-1,1])for(const y of [-.17,.28])ell(shield,0xdec696,[s*.25,y,.115],[.025,.025,.021],.6);
 // A raised central ridge and inset lower plate catch light at gameplay distance.
 plate(shield,0xb69b70,[[-.025,.39],[.025,.39],[.018,-.39],[0,-.46],[-.018,-.39]],[0,0,.085],.025,.009);
 plate(shield,0x382931,[[-.20,-.28],[0,-.43],[.20,-.28],[0,-.34]],[0,0,.107],.012,.008);
 const hammer=joint(d.support.rightHand,[0,0,0]);d.hammer=hammer;d.weapon=hammer;hammer.name='Guardian_wrapped_hammer';
 tube(hammer,0x705139,[0,.24,0],[.050,.94,.050]);for(let i=0;i<7;i++)tube(hammer,0xb2986a,[0,-.11+i*.055,0],[.056,.018,.056],.25);
 ell(hammer,0xb69c6d,[0,-.25,0],[.085,.068,.085],.5);
 // Beveled forged cheeks and a reinforced socket replace the barrel-shaped head.
 const hammerShape=geometry('forged-hammer-head',()=>{const sh=new T.Shape();sh.moveTo(-.16,-.15);sh.lineTo(.16,-.15);sh.lineTo(.20,-.10);sh.lineTo(.20,.10);sh.lineTo(.14,.16);sh.lineTo(-.14,.16);sh.lineTo(-.20,.10);sh.lineTo(-.20,-.10);sh.closePath();const h=new T.ExtrudeGeometry(sh,{depth:.65,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3,steps:1});h.translate(0,0,-.325);h.rotateY(Math.PI/2);return h;});
 mesh(hammer,hammerShape,0x7a9094,[0,.66,0],[.84,.82,.86],.38);
 for(const side of[-1,1]){mesh(hammer,hammerShape,0xb59a68,[side*.255,.66,0],[.11,.85,.89],.5);mesh(hammer,hammerShape,0x3f555c,[side*.287,.66,0],[.08,.64,.66],.3);}
 tube(hammer,0xb39a69,[0,.46,0],[.08,.22,.08],.45);
 d.hammerContact=joint(hammer,[0,.66,0]);

 for(const [weapon,grip]of [[shield,grips[0]],[hammer,grips[1]]]){weapon.scale.setScalar(.72);weapon.quaternion.copy(grip).invert();}
 hammer.quaternion.copy(primaryGripFrame('hammer').invert());grips[1].copy(primaryGripFrame('hammer'));fitWeaponToPalm(hammer,GRIP_POINTS.hammer);
 // A visible rear grip bridges the hand to the shield; it remains rigid during blocks.
 tube(shield,0x563d30,[0,0,-.16],[.032,.23,.032]);
 for(const y of[-.13,.13])tube(shield,0x765739,[0,y,-.10],[.025,.14,.025]).rotation.x=Math.PI/2;
 fitWeaponToPalm(shield,[0,0,-.16],'l');
 d.gun=hammer;d.gunRest=hammer.quaternion.clone();d.grips=grips;
 d.guardianPrevious=[];
}
// Solve the actual skeleton's limb directions, rather than assuming an axis for its bones.
function arm(upper,lower,hand,target,pole,grip,desired,previous,dt){
 const origin=upper.getWorldPosition(new T.Vector3()),elbow=lower.getWorldPosition(new T.Vector3()),end=hand.getWorldPosition(new T.Vector3());
 const a=origin.distanceTo(elbow),b=elbow.distanceTo(end),axis=target.clone().sub(origin).normalize(),distance=T.MathUtils.clamp(origin.distanceTo(target),Math.abs(a-b)+.005,a+b-.008);
 const goal=origin.clone().addScaledVector(axis,distance),bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize(),along=(a*a-b*b+distance*distance)/(2*distance);
 const elbowGoal=origin.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
 const rotate=(bone,from,to)=>{const delta=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(delta);bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world)).normalize();bone.updateWorldMatrix(false,true);};
 rotate(upper,elbow.clone().sub(origin),elbowGoal.sub(origin));
 lower.getWorldPosition(elbow);hand.getWorldPosition(end);rotate(lower,end.sub(elbow),goal.sub(elbow));
 const world=desired.clone().multiply(grip);hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world)).normalize();
 // Bound twist speed through nearly straight elbows and rapid attack cancellation.
 for(const [i,bone]of [upper,lower,hand].entries()){if(previous[i])bone.quaternion.copy(previous[i].rotateTowards(bone.quaternion,Math.max(.001,dt)*18));else previous[i]=bone.quaternion.clone();previous[i].copy(bone.quaternion);bone.updateWorldMatrix(false,true);}
}
export function animateGuardian(g,t,speed,dt){
 const d=g.userData;let u=d.shotSerial?T.MathUtils.clamp(d.reloadPhase??1,0,1):1;if(d.cancelAttack||d.dashTime>0)d.impactHold=0;if(d.impactHold>0){u=d.impactPhase;d.impactHold=Math.max(0,d.impactHold-dt);}let pose=guardianPose(d.meleeCombo||0,u);
 if(d.cancelAttack){d.cancelAttack=false;d.cancelPose=d.lastPose?.slice();d.cancelTime=0;}
 if(d.cancelPose){d.cancelTime+=dt;const k=Math.min(1,d.cancelTime/.16),blend=k*k*(3-2*k);pose=pose.map((v,i)=>d.cancelPose[i]+(v-d.cancelPose[i])*blend);if(k===1)d.cancelPose=null;}d.lastPose=pose.slice();
 const dodge=heroDodgePose('guardian',d.dashTime||0);d.brace=dodge.weight;d.guardFlinch=Math.max(0,(d.guardFlinch||0)-dt);const block=Math.sin(Math.PI*d.guardFlinch/.18);
 const carry=(1-(d.readyBlend||0))*(1-d.brace),step=Math.sin(d.gaitPhase*Math.PI*2)*d.blend;
 d.rig.position.z=pose[14]*.65;d.rig.position.y=pose[15]*.45;
 // Mix weight transfer into the authored pelvis/spine while keeping the walking footfall.
 d.spine.rotateY(pose[12]*.85+step*.035*carry);d.spine.rotateX(pose[13]*.55+d.brace*.17+(d.presence?.breath||0));d.spine.rotateZ((d.presence?.shoulder||0)*carry);d.swimHead.rotateY((d.presence?.look||0)-pose[12]*.22);d.swimHead.rotateX(-pose[13]*.16);d.rig.rotation.x+=dodge.brace*.5-block*.045;d.rig.position.z-=block*.035;
 g.updateMatrixWorld(true);const yaw=g.getWorldQuaternion(new T.Quaternion()),chest=d.aimArm.getWorldPosition(new T.Vector3()).add(d.offArm.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
 for(let i=0;i<2;i++){
  const offset=i*6,hand=i?d.support.rightHand:d.support.hand,upper=i?d.aimArm:d.offArm,lower=i?d.firingForearm:d.offForearm;
  const v=new T.Vector3(-pose[offset]*.7,(pose[offset+1]-.6)*.7,pose[offset+2]*.75);
  if(i===0){v.z+=d.brace*.22-block*.085;v.y+=d.brace*.10+block*.025;}else if(d.brace>0){v.z-=d.brace*.15;v.y-=d.brace*.08;}else if(u===1)v.z+=Math.sin(d.gaitPhase*Math.PI*2)*.025*d.blend;
  v.y-=carry*(i?.20:.12);v.y+=(d.presence?.breath||0)*.5;v.z+=(d.presence?.hand||0)*(i?1:-.4);v.z+=step*(i?.095:-.05)*carry;v.x+=carry*(i?-.035:.06);
  const desired=yaw.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(pose[offset+3]+carry*(i?-.55:.10)+step*.045*carry,-pose[offset+4],-pose[offset+5]+carry*(i?.14:-.12))));
  const previous=d.guardianPrevious[i]||(d.guardianPrevious[i]=[]);
  arm(upper,lower,hand,chest.clone().add(v.applyQuaternion(yaw)),new T.Vector3(i?-.6:.6,-1,-.2).applyQuaternion(yaw),d.grips[i],desired,previous,dt);
 }
}

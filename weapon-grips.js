import * as T from './vendor/three.module.js';
import {crossbowMechanism} from './weapon-performance.js?v=192';

// Weapon-space contact points: the wrapped handle, not the model's origin.
export const GRIP_POINTS={shade:[0,0,0],shadowblade:[0,-.035,.02],grimoire:[0,0,0],miasmalantern:[0,.015,0],sporelantern:[0,.015,0],rifle:[0,-.065,.075],shotgun:[0,-.065,.075],crossbow:[0,-.08,.01],fire:[0,0,.045],dark:[0,0,.045],shuriken:[-.07,0,.06],boomerang:[0,-.13,0],harpoon:[0,0,-.08],hammer:[0,.015,0]};
export const SCYTHE_SUPPORT=[.008,.345,.02];
const palm=side=>new T.Vector3(side==='r'?-.036:.036,.097,0);
const frame=(x,y,z)=>new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(...x),new T.Vector3(...y),new T.Vector3(...z)));
const upright=frame([-1,0,0],[0,0,1],[0,1,0]);
const underhand=frame([0,-1,0],[1,0,0],[0,0,1]);
const sideways=frame([0,-1,0],[0,0,-1],[1,0,0]);
const poleSupport=frame([1,0,0],[0,0,-1],[0,1,0]);
const support=frame([0,1,0],[1,0,0],[0,0,-1]);
const fingerBase={l:new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2),r:new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-Math.PI/2)};
// Small objects need different joint bends from a thick weapon handle. The
// contact point stays fixed: a hooked carrying hand, a pouch pinch and a cupped pod.
const lanternHook={index:[.78,1.24,.86],middle:[.88,1.22,.84],ring:[.98,1.16,.78],pinky:[1.04,1.08,.70]};
const pouchPinch={index:[.95,1.18,.70],middle:[.58,.78,.48],ring:[.72,.88,.54],pinky:[.84,.96,.60]};
const podCup={index:[.62,.74,.44],middle:[.66,.78,.46],ring:[.72,.80,.48],pinky:[.82,.86,.52]};
const handleWrap={index:[1.04,1.12,.70],middle:[1.10,1.16,.76],ring:[1.15,1.13,.74],pinky:[1.20,1.10,.68]};
const stockCradle={index:[.88,.96,.56],middle:[.94,1.04,.62],ring:[1.02,1.08,.66],pinky:[1.08,1.10,.64]};
const pumpWrap={index:[.94,1.04,.66],middle:[1.04,1.12,.72],ring:[1.10,1.16,.76],pinky:[1.14,1.12,.68]};
const shaftBrace={index:[.92,1.12,.70],middle:[1.04,1.18,.78],ring:[1.12,1.18,.76],pinky:[1.16,1.10,.70]};
const shaftGuide={index:[.72,.92,.52],middle:[.86,1.02,.64],ring:[.96,1.08,.68],pinky:[1.06,1.08,.64]};
const staffWrap={index:[.94,1.06,.64],middle:[1.04,1.14,.74],ring:[1.12,1.16,.76],pinky:[1.18,1.10,.68]};
const dartPinch={index:[.76,.88,.52],middle:[.92,1.04,.64],ring:[1.04,1.12,.72],pinky:[1.14,1.12,.72]};
const fireGuide={index:[.16,.18,.10],middle:[.22,.22,.12],ring:[.28,.26,.15],pinky:[.34,.28,.18]};
const darkGuide={index:[.34,.36,.22],middle:[.48,.44,.26],ring:[.58,.48,.28],pinky:[.66,.50,.30]};
const shadowGuide={index:[.09,.12,.055],middle:[.14,.17,.07],ring:[.20,.22,.09],pinky:[.26,.25,.11]};
const bookSupport={index:[.20,.26,.16],middle:[.27,.31,.19],ring:[.34,.34,.22],pinky:[.40,.38,.24]};
const bookRead={index:[.12,.16,.09],middle:[.44,.46,.28],ring:[.52,.48,.30],pinky:[.60,.52,.32]};
const fingerOrder={index:0,middle:1,ring:2,pinky:3};
const fingerSpread={fire:[-.10,-.025,.055,.14],dark:[-.06,-.02,.04,.10],shade:[-.15,-.035,.06,.17],grimoire:[-.06,-.01,.045,.095]};
export function primaryGripFrame(id){return(id==='harpoon'?underhand:id==='shuriken'?sideways:upright).clone();}

export function fitWeaponToPalm(weapon,point,side='r'){
  weapon.position.copy(palm(side)).sub(new T.Vector3(...point).multiply(weapon.scale).applyQuaternion(weapon.quaternion));
}

export function createHandGrips(bones){
  const fingers=[],thumb=[];
  for(const side of ['l','r'])for(const name of ['index','middle','ring','pinky'])for(let i=1;i<=3;i++){
    const bone=bones.get(`${name}_0${i}_${side}`);if(bone)fingers.push({bone,side,name,i});
  }
  // Retain the authored opposed thumb, mirrored for a real left-hand grasp.
  for(let i=1;i<=3;i++){const q=bones.get(`thumb_0${i}_r`).quaternion.clone();for(const side of ['l','r'])thumb.push({bone:bones.get(`thumb_0${i}_${side}`),side,i,q:side==='r'?q:new T.Quaternion(q.x,-q.y,-q.z,q.w)});}
  return {fingers,thumb,wrists:['l','r'].map(side=>[bones.get('hand_'+side),new T.Quaternion()]),supportWorld:new T.Quaternion(),scratch:new T.Quaternion(),inverse:new T.Quaternion(),offset:new T.Vector3(),scale:new T.Vector3(),lastWrist:new T.Quaternion(),origin:new T.Vector3(),axis:new T.Vector3(),contact:new T.Vector3()};
}

export function restoreGripWrists(d){d.handGrips.lastWrist.copy(d.support.rightHand.quaternion);if(d.handGrips.ready)for(const [bone,q]of d.handGrips.wrists)bone.quaternion.copy(q);}
export function captureGripWrists(d){for(const [bone,q]of d.handGrips.wrists)q.copy(bone.quaternion);d.handGrips.ready=true;}

function orient(hand,world,blend,scratch){
  hand.parent.getWorldQuaternion(scratch).invert().multiply(world).normalize();hand.quaternion.slerp(scratch,blend);hand.updateWorldMatrix(false,true);
}
export function aimGrip(d,world,blend,dt){
  const h=d.handGrips;h.supportWorld.copy(world).multiply(h.inverse.copy(d.gunRest).invert());orient(d.support.rightHand,h.supportWorld,blend,h.scratch);
  if(d.weaponId!=='shadowblade')d.support.rightHand.quaternion.copy(h.lastWrist.rotateTowards(d.support.rightHand.quaternion,dt*18));d.support.rightHand.updateWorldMatrix(false,true);
}
export function supportGripTarget(d,target){
  const h=d.handGrips;d.gun.getWorldQuaternion(h.supportWorld).multiply(d.weaponId==='shadowblade'?poleSupport:support);d.support.hand.getWorldScale(h.scale);
  h.contact.copy(target);h.offset.copy(palm('l')).multiply(h.scale).applyQuaternion(h.supportWorld);target.sub(h.offset);
  // Slide along the long foregrip when turning would otherwise overextend the arm.
  d.offArm.getWorldPosition(h.origin);const reach=(d.offForearm.position.length()+d.support.hand.position.length())*h.scale.y*.985;
  if(d.weaponId!=='crossbow'&&d.weaponId!=='shadowblade'&&d.weaponId!=='boomerang'){
    d.gun.getWorldQuaternion(h.scratch);h.axis.set(0,0,1).applyQuaternion(h.scratch);
    const limit=d.weaponId==='harpoon'?.25:.10;
    for(let travel=0;target.distanceTo(h.origin)>reach&&travel<limit;travel+=.01){target.addScaledVector(h.axis,-.01);h.contact.addScaledVector(h.axis,-.01);}
  }
}
export function aimSupportGrip(d,blend){orient(d.support.hand,d.handGrips.supportWorld,blend,d.handGrips.scratch);}

// Shade has no physical foregrip: the free palm cups the air beside the tear.
// Orient only this wrist after the existing arm solve; never move the held focus.
export function aimShadeGuide(d,blend){
  const h=d.handGrips;d.gun.getWorldQuaternion(h.supportWorld).multiply(upright);
  h.supportWorld.multiply(h.inverse.setFromAxisAngle(h.offset.set(0,1,0),.22));
  orient(d.support.hand,h.supportWorld,blend,h.scratch);
}

export function poseGripFingers(d,motion={}){
  const id=d.weaponId,h=d.handGrips,hasSupport=['rifle','shotgun','crossbow','harpoon','hammer','shadowblade','boomerang'].includes(id);
  const lantern=id==='sporelantern'||id==='miasmalantern',caster=['fire','dark','shade','grimoire'].includes(id),gun=['rifle','shotgun','crossbow'].includes(id),pole=id==='harpoon'||id==='shadowblade';
  const kick=motion.kick||0,gather=motion.gather||0,latch=id==='crossbow'?crossbowMechanism(d.reloadPhase??1).hand:0;
  const released=id==='shuriken'?(motion.kick||0):0;
  for(const {bone,side,name,i}of h.fingers){
    if(side==='l'&&!hasSupport&&id!=='sporelantern'&&!caster)continue;
    const release=side==='r'?released:id==='boomerang'||id==='sporelantern'?(motion.open||0):0;
    const trigger=side==='r'&&gun&&name==='index';
    const profile=side==='r'&&lantern?lanternHook[name]:side==='l'&&id==='boomerang'?pouchPinch[name]:side==='l'&&id==='sporelantern'?podCup[name]:
      gun?(side==='r'?handleWrap: id==='shotgun'?pumpWrap:stockCradle)[name]:pole?(side==='r'?shaftBrace:shaftGuide)[name]:
      id==='shade'?shadowGuide[name]:id==='grimoire'?(side==='r'?bookSupport:bookRead)[name]:
      id==='fire'||id==='dark'?(side==='r'?staffWrap:id==='fire'?fireGuide:darkGuide)[name]:side==='r'&&id==='shuriken'?dartPinch[name]:null;
    let curl=(trigger?([.28,.54,.32][i-1]+[.10,.16,.12][i-1]*kick):profile?profile[i-1]:[1.22,1.18,.76][i-1])*(1-release*.84);
    // The left index hooks the cocking slide; it returns to supporting the stock.
    // Pump and pole fingers brace a little at load, without sliding either palm.
    if(side==='l'&&id==='crossbow')curl=T.MathUtils.lerp(curl,(name==='index'?[.72,1.18,.72]:[.57,.70,.43])[i-1],latch);
    if(side==='l'&&id==='shotgun')curl+=(motion.draw||0)*.055;
    if(pole)curl+=kick*(side==='r'?.065:.035);
    if(caster&&(side==='l'||id==='shade'))curl*=id==='dark'?1+.20*gather-.20*kick:1-.32*kick;
    h.scratch.setFromAxisAngle(h.offset.set(1,0,0),curl);
    if(i===1)h.scratch.premultiply(fingerBase[side]);
    if(i===1&&caster&&(side==='l'||id==='shade'||id==='grimoire'))h.scratch.multiply(h.inverse.setFromAxisAngle(h.offset.set(0,0,1),fingerSpread[id][fingerOrder[name]]*(side==='l'?1:-1)*(.65+.35*kick)));
    bone.quaternion.slerp(h.scratch,side==='l'&&id!=='hammer'?d.aimBlend:1);
  }
  for(const {bone,side,i,q}of h.thumb){
    if(side==='l'&&(id==='boomerang'||id==='sporelantern')){
      // The thumb must release the pouch/pod too, then oppose it again on the
      // same shot clock. Work from the saved authored pose, never accumulated rotations.
      h.scratch.setFromAxisAngle(h.offset.set(1,0,0),-(motion.open||0)*(i===1?.28:i===2?.48:.32)).premultiply(q);
      bone.quaternion.slerp(h.scratch,d.aimBlend);
    }else if(side==='l'&&id==='crossbow'||caster&&(side==='l'||id==='shade'||id==='grimoire')){
      const loosen=side==='l'&&id==='crossbow'?latch*.18:id==='shade'?(i===1?.42:i===2?.52:.30)+kick*.10-gather*.08:((id==='dark'?.10:.18)+kick*.10)*(i===1?1:.7);
      h.scratch.setFromAxisAngle(h.offset.set(1,0,0),-loosen).premultiply(q);bone.quaternion.slerp(h.scratch,side==='r'?1:d.aimBlend);
    }else if(side==='r'||hasSupport)bone.quaternion.slerp(q,side==='r'?1-released*.8:id==='hammer'?1:d.aimBlend);
  }
}

import * as T from './vendor/three.module.js';

// Weapon-space contact points: the wrapped handle, not the model's origin.
export const GRIP_POINTS={shade:[0,0,0],shadowblade:[0,-.035,.02],grimoire:[0,0,0],miasmalantern:[0,.015,0],sporelantern:[0,.015,0],rifle:[0,-.065,.075],shotgun:[0,-.065,.075],crossbow:[0,-.08,.01],fire:[0,0,.045],dark:[0,0,.045],shuriken:[-.07,0,.06],boomerang:[0,0,-.09],harpoon:[0,0,-.08],hammer:[0,.015,0]};
export const SCYTHE_SUPPORT=[.008,.345,.02];
const palm=side=>new T.Vector3(side==='r'?-.036:.036,.097,0);
const frame=(x,y,z)=>new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(...x),new T.Vector3(...y),new T.Vector3(...z)));
const upright=frame([-1,0,0],[0,0,1],[0,1,0]);
const underhand=frame([0,-1,0],[1,0,0],[0,0,1]);
const sideways=frame([0,-1,0],[0,0,-1],[1,0,0]);
const poleSupport=frame([1,0,0],[0,0,-1],[0,1,0]);
const support=frame([0,1,0],[1,0,0],[0,0,-1]);
const fingerBase={l:new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2),r:new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-Math.PI/2)};
export function primaryGripFrame(id){return(id==='harpoon'?underhand:['boomerang','shuriken'].includes(id)?sideways:upright).clone();}

export function fitWeaponToPalm(weapon,point,side='r'){
  weapon.position.copy(palm(side)).sub(new T.Vector3(...point).multiply(weapon.scale).applyQuaternion(weapon.quaternion));
}

export function createHandGrips(bones){
  const fingers=[],thumb=[];
  for(const side of ['l','r'])for(const name of ['index','middle','ring','pinky'])for(let i=1;i<=3;i++){
    const bone=bones.get(`${name}_0${i}_${side}`);if(bone)fingers.push({bone,side,name,i});
  }
  // Retain the authored opposed thumb, mirrored for a real left-hand grasp.
  for(let i=1;i<=3;i++){const q=bones.get(`thumb_0${i}_r`).quaternion.clone();for(const side of ['l','r'])thumb.push({bone:bones.get(`thumb_0${i}_${side}`),side,q:side==='r'?q:new T.Quaternion(q.x,-q.y,-q.z,q.w)});}
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
  if(d.weaponId!=='crossbow'&&d.weaponId!=='shadowblade'){
    d.gun.getWorldQuaternion(h.scratch);h.axis.set(0,0,1).applyQuaternion(h.scratch);
    const limit=d.weaponId==='harpoon'?.25:.10;
    for(let travel=0;target.distanceTo(h.origin)>reach&&travel<limit;travel+=.01){target.addScaledVector(h.axis,-.01);h.contact.addScaledVector(h.axis,-.01);}
  }
}
export function aimSupportGrip(d,blend){orient(d.support.hand,d.handGrips.supportWorld,blend,d.handGrips.scratch);}

export function poseGripFingers(d,motion={}){
  const id=d.weaponId,h=d.handGrips,hasSupport=['rifle','shotgun','crossbow','harpoon','hammer','shadowblade'].includes(id);
  const released=id==='boomerang'&&d.boomerangAway?1-(d.catchReady||0):id==='shuriken'?(motion.kick||0):0;
  for(const {bone,side,name,i}of h.fingers){
    if(side==='l'&&!hasSupport&&id!=='sporelantern')continue;
    const release=side==='r'?released:id==='sporelantern'?(motion.kick||0):0;
    const trigger=side==='r'&&['rifle','shotgun','crossbow'].includes(id)&&name==='index';
    const curl=(id==='shade'?[.22,.30,.22]:id==='grimoire'?[.30,.36,.24]:trigger?[.36,.64,.45]:id==='harpoon'?[1.02,1.08,.70]:[1.22,1.18,.76])[i-1]*(1-release*.84);
    h.scratch.setFromAxisAngle(h.offset.set(1,0,0),curl);
    if(i===1)h.scratch.premultiply(fingerBase[side]);
    bone.quaternion.slerp(h.scratch,side==='l'&&id!=='hammer'?d.aimBlend:1);
  }
  for(const {bone,side,q}of h.thumb)if(side==='r'||hasSupport)bone.quaternion.slerp(q,side==='r'?1-released*.8:id==='hammer'?1:d.aimBlend);
}

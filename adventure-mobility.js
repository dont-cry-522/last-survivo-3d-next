// Ground movement still uses moveActor. This adds vertical dodging, not climbing.
export const MOBILITY={gravity:18.8,takeoff:6.4,landRest:.20,crouchSpeed:.48,crouchRatio:.55,blendSpeed:6};
export const ATTACK_BANDS={shock:[0,.45],frost:[0,.4],ember:[0,.55],tide:[0,.75],sweep:[1.25,2.2],pounce:[0,1.15],root:[0,2.6],sand:[0,2.6],poison:[0,3],hex:[0,3],boss:[0,4],vent:[0,4]};
export function resetMobility(p){p.y=0;p.jumpVelocity=0;p.jumpRest=0;p.crouch=0;p.landTime=0;}
export function bodyHeight(p){return (p.standHeight||1.8)*(1-(1-MOBILITY.crouchRatio)*(p.crouch||0));}
export function attackReachesPlayer(p,kind){const band=ATTACK_BANDS[kind];return !band||((p.y||0)<=band[1]&&(p.y||0)+bodyHeight(p)>=band[0]);}
export function beginJump(p,depth=0){
 if((p.y||0)>.001||(p.jumpVelocity||0)!==0||(p.jumpRest||0)>0||p.dashTime>0||depth>.42)return false;
 p.jumpVelocity=MOBILITY.takeoff;p.landTime=0;return true;
}
export function tickMobility(p,dt,{crouching=false,depth=0,ceiling=Infinity}={}){
 if(!(dt>0))return false;
 p.jumpRest=Math.max(0,(p.jumpRest||0)-dt);p.landTime=Math.max(0,(p.landTime||0)-dt);
 const airborne=(p.y||0)>0||(p.jumpVelocity||0)>0,wanted=crouching&&!airborne&&p.dashTime<=0&&depth<=.42?1:0,old=p.crouch||0;
 p.crouch=old+Math.max(-MOBILITY.blendSpeed*dt,Math.min(MOBILITY.blendSpeed*dt,wanted-old));
 // A low roof prevents standing; never let releasing Ctrl push the head through it.
 if(!airborne&&ceiling< (p.standHeight||1.8))p.crouch=Math.max(p.crouch,Math.min(1,(1-ceiling/(p.standHeight||1.8))/(1-MOBILITY.crouchRatio)));
 if(!airborne)return false;
 let y=(p.y||0)+(p.jumpVelocity||0)*dt-MOBILITY.gravity*dt*dt/2;p.jumpVelocity=(p.jumpVelocity||0)-MOBILITY.gravity*dt;
 const cap=Math.max(0,ceiling-bodyHeight(p));if(y>cap){y=cap;p.jumpVelocity=Math.min(0,p.jumpVelocity);}
 if(y<=0&&p.jumpVelocity<=0){p.y=0;p.jumpVelocity=0;p.jumpRest=MOBILITY.landRest;p.landTime=.16;return true;}
 p.y=Math.max(0,y);return false;
}

// Restore before the existing mixer so additive joints never accumulate or pollute IK.
export function restoreMobilityPose(hero){const pose=hero.userData.mobilityPose;if(!pose?.active)return;for(const [bone,q]of pose.bones)bone.quaternion.copy(q);hero.userData.rig.position.y=pose.rigY;pose.active=false;}
export function applyMobilityPose(hero,p){
 const d=hero.userData;if(!d.skinned)return;
 const crouch=p.crouch||0,air=Math.min(1,(p.y||0)*3),land=Math.sin(Math.PI*Math.min(1,(p.landTime||0)/.16));
 if(crouch+air+land<.001||p.dashTime>0)return;
 const pose=d.mobilityPose??={bones:[d.swimLeftLeg,d.swimRightLeg,d.swimLeftKnee,d.swimRightKnee,d.swimLeftFoot,d.swimRightFoot,d.spine,d.swimHead].filter(Boolean).map(b=>[b,b.quaternion.clone()])};
 for(const [bone,q]of pose.bones)q.copy(bone.quaternion);pose.rigY=d.rig.position.y;pose.active=true;
 hero.updateMatrixWorld(true);const feet=[d.swimLeftFoot,d.swimRightFoot].filter(Boolean),floor=feet.length?Math.min(...feet.map(b=>b.matrixWorld.elements[13])):null;
 const bend=crouch*1.45+air*.65+land*.14;
 d.rig.position.y-=crouch*(p.standHeight||1.8)*.40+land*.08;
 for(const leg of[d.swimLeftLeg,d.swimRightLeg])leg?.rotateX(-bend);
 for(const knee of[d.swimLeftKnee,d.swimRightKnee])knee?.rotateX(bend*1.85);
 for(const foot of[d.swimLeftFoot,d.swimRightFoot])foot?.rotateX(-bend*.85);
 d.spine?.rotateX(crouch*.28+land*.08);d.swimHead?.rotateX(-crouch*.2);
 if(crouch>0&&air===0&&floor!==null){hero.updateMatrixWorld(true);d.rig.position.y+=floor-Math.min(...feet.map(b=>b.matrixWorld.elements[13]));}
}

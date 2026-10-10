import * as T from './vendor/three.module.js';

const clamp=T.MathUtils.clamp,finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const MIN_DISTANCE=4.8,MAX_DISTANCE=8,CAMERA_RADIUS=.25,GROUND_CLEARANCE=.35;

// Sweep camera clearance against solid footprints with measured heights.
// Legacy callers without height retain unbounded upright cylinders.
function clearFraction(start,end,obstacles){
 const dx=end.x-start.x,dz=end.z-start.z,dy=end.y-start.y,a=dx*dx+dz*dz;
 let nearest=1;
 for(const o of obstacles){
  if(!Number.isFinite(o.x)||!Number.isFinite(o.z)||!Number.isFinite(o.r)||o.r<0)continue;
  const x=start.x-o.x,z=start.z-o.z,r=o.r+CAMERA_RADIUS,c=x*x+z*z-r*r;
  let lo=0,hi=1;
  if(a<1e-12){if(c>0)continue;}
  else{const b=x*dx+z*dz,disc=b*b-a*c;if(disc<0)continue;const root=Math.sqrt(disc);lo=Math.max(lo,(-b-root)/a);hi=Math.min(hi,(-b+root)/a);}
  if(Number.isFinite(o.height)){
   const bottom=(o.y||0)-CAMERA_RADIUS,top=(o.y||0)+o.height+CAMERA_RADIUS;
   if(Math.abs(dy)<1e-12){if(start.y<bottom||start.y>top)continue;}
   else{const t0=(bottom-start.y)/dy,t1=(top-start.y)/dy;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}
  }
  if(lo<=hi&&lo<=nearest)nearest=Math.max(0,lo-.02/Math.max(.001,Math.hypot(dx,dy,dz)));
 }
 return nearest;
}

/** DOM-free orbit/eye camera. Yaw 0 faces +Z, positive yaw turns toward +X;
 * pitch is positive upward. Player is {x,y?,z}; y is the foot elevation.
 * Third-person assumes the player is outside the world's solid footprints,
 * as enforced by moveActor. groundY is one flat plane, not a terrain query.
 */
export class AdventureCamera{
 constructor(camera,{mode='third',yaw=0,pitch=-.25,distance=6,shoulderOffset=.5}={}){
  this.camera=camera;this.yaw=finite(yaw,0);this.pitch=clamp(finite(pitch,-.25),-1.2,1.2);
  this.distance=clamp(finite(distance,6),MIN_DISTANCE,MAX_DISTANCE);
  this.shoulderOffset=finite(shoulderOffset,.5);
  this._target=new T.Vector3();this._raw=new T.Vector3();this._anchor=new T.Vector3();this._end=new T.Vector3();this._forward=new T.Vector3();this._look=new T.Vector3();
  this._ready=false;this._boom=this.distance;this.setMode(mode);
 }
 setMode(mode){
  if(mode!=='first'&&mode!=='third')throw new RangeError('Camera mode must be first or third');
  if(this.mode!==mode){this.mode=mode;this._ready=false;}
  return this;
 }
 toggleMode(){return this.setMode(this.mode==='third'?'first':'third');}
 rotate(deltaYaw,deltaPitch){
  this.yaw=Math.atan2(Math.sin(this.yaw+finite(deltaYaw,0)),Math.cos(this.yaw+finite(deltaYaw,0)));
  this.pitch=clamp(this.pitch+finite(deltaPitch,0),-1.2,1.2);return this;
 }
 zoom(deltaDistance){this.distance=clamp(this.distance+finite(deltaDistance,0),MIN_DISTANCE,MAX_DISTANCE);return this;}
 movement(strafeRight,forward,out=new T.Vector3()){
  const side=finite(strafeRight,0),ahead=finite(forward,0),s=Math.sin(this.yaw),c=Math.cos(this.yaw);
  out.set(s*ahead-c*side,0,c*ahead+s*side);
  if(out.lengthSq()>1)out.normalize();
  return out;
 }
 retract(point){this.camera.position.set(point.x,point.y,point.z);this._boom=Math.min(this._boom,this._target.distanceTo(this.camera.position));this.camera.updateMatrixWorld(true);return this;}
 getShootDirection(out=new T.Vector3()){return out.set(Math.sin(this.yaw),0,Math.cos(this.yaw));}
 getRay(out=new T.Ray()){
  this.camera.getWorldPosition(out.origin);this.camera.getWorldDirection(out.direction);return out;
 }
 update(dt,player,obstacles=[],{eyeHeight=1.65,shoulderHeight=1.15,shoulderOffset=this.shoulderOffset,groundY=0,snap=false,followRate=12,roll=0}={}){
  const seconds=Math.max(0,finite(dt,0)),floor=finite(groundY,0)+GROUND_CLEARANCE;
  const height=this.mode==='first'?finite(eyeHeight,1.65):finite(shoulderHeight,1.15);
  this._anchor.set(player.x,Math.max(floor,finite(player.y,0)+height),player.z);
  this._raw.copy(this._anchor);
  if(this.mode==='third'){
   const offset=finite(shoulderOffset,.5);
   this._raw.x-=Math.cos(this.yaw)*offset;this._raw.z+=Math.sin(this.yaw)*offset;
   this._raw.lerpVectors(this._anchor,this._raw,clearFraction(this._anchor,this._raw,obstacles));
  }
  const reset=snap||!this._ready;
  if(reset||this.mode==='first')this._target.copy(this._raw);
  else{
   this._target.lerp(this._raw,-Math.expm1(-Math.max(0,finite(followRate,12))*seconds));
   // A lagging pivot must not remain on the opposite side of a tree/stone.
   if(clearFraction(this._anchor,this._target,obstacles)<1)this._target.copy(this._raw);
  }
  const cp=Math.cos(this.pitch);
  this._forward.set(Math.sin(this.yaw)*cp,Math.sin(this.pitch),Math.cos(this.yaw)*cp);
  if(this.mode==='first')this.camera.position.copy(this._target);
  else{
   this._end.copy(this._target).addScaledVector(this._forward,-this.distance);
   let safe=this.distance*clearFraction(this._target,this._end,obstacles);
   if(this._forward.y>0)safe=Math.min(safe,(this._target.y-floor)/this._forward.y);
   this._boom=reset?safe:Math.min(safe,this._boom+(this.distance-this._boom)*-Math.expm1(-8*seconds));
   this.camera.position.copy(this._target).addScaledVector(this._forward,-this._boom);
   // The offset pivot's L-shaped path may be clear while the direct view to the
   // actor cuts a corner. Keep that final sightline clear as well.
   this._end.copy(this.camera.position);
   this.camera.position.lerpVectors(this._anchor,this._end,clearFraction(this._anchor,this._end,obstacles));
  }
  // Do not lookAt the pivot: a fully collapsed boom still needs a stable view.
  this._look.copy(this.camera.position).add(this._forward);this.camera.lookAt(this._look);
  // A slight shoulder bank leaves the center ray unchanged; never tumble the view.
  this.camera.rotateZ(clamp(finite(roll,0),-.04,.04));
  this.camera.updateMatrixWorld(true);this._ready=true;return this;
 }
}

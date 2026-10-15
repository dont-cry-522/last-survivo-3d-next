import * as T from './vendor/three.module.js';
import {CLIMATE_LIGHT} from './environment-lighting.js?v=211';

const cloudStrength={forest:.90,snow:.82,ash:.90,sand:.54,coast:.88};
// Frequency / density edges: rounded woodland masses, cold wind sheets,
// broad smoke banks, sparse high wisps and long maritime bands.
const cloudProfiles={forest:[3.4,3.0,.43,.64],snow:[2.7,6.0,.36,.64],ash:[2.2,3.0,.30,.64],sand:[1.8,8.2,.57,.78],coast:[4.8,2.2,.39,.64]};
// Lower edge, full visibility, upper fade and brightness. These only shade the
// background sphere; scene fog and the playable area's contrast stay untouched.
const cloudLayers={forest:[.025,.13,.86,1.04],snow:[.025,.11,.90,1],ash:[.012,.09,.58,.58],sand:[.18,.34,.93,.94],coast:[.02,.12,.82,1.02]};
const vertexShader=`
varying vec3 skyDirection;
void main(){
 skyDirection=position;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const fragmentShader=`
uniform vec3 skyColor;
uniform vec3 fogColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform float sunStrength;
uniform float skyTime;
uniform float cloudAmount;
uniform vec4 cloudProfile;
uniform vec4 cloudLayer;
varying vec3 skyDirection;
float hash(vec2 p){
 p=fract(p*vec2(123.34,456.21));p+=dot(p,p+34.345);
 return fract(p.x*p.y);
}
float cloudNoise(vec2 p){
 vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.,1.)),f.x),f.y);
}
void main(){
 vec3 direction=normalize(skyDirection);
 float height=smoothstep(.015,.26,direction.y);
 float zenith=smoothstep(.10,1.0,direction.y);
 vec3 color=skyColor*mix(vec3(.80,1.01,1.15),vec3(.46,.73,1.03),zenith);
 float facingSun=dot(direction.xz,sunDirection.xz)/max(.001,length(direction.xz)*length(sunDirection.xz));
 float warmHaze=pow(max(0.,facingSun),3.)*(1.-smoothstep(.16,.65,direction.y));
 color=mix(color,mix(skyColor,sunColor,.24),warmHaze*.16);
 // Three shape samples and one shared-scale light sample: opaque-looking lobes
 // with shaded bellies, visible at a normal first-person angle above the fog seam.
 vec2 p=direction.xz/max(.20,direction.y+.30)*cloudProfile.xy;
 p+=vec2(skyTime*.006,skyTime*.002);
 float broad=cloudNoise(p);
 float body=broad*.65+cloudNoise(p*2.17+vec2(8.3,2.7))*.25+cloudNoise(p*4.31-vec2(skyTime*.004,2.1))*.10;
 float density=smoothstep(cloudProfile.z,cloudProfile.w,body);
 float cloud=density*smoothstep(cloudLayer.x,cloudLayer.y,direction.y)*(1.-smoothstep(cloudLayer.z,.995,direction.y));
 float sunward=cloudNoise(p+sunDirection.xz*.32);
 float litEdge=clamp(.66+(broad-sunward)*4.2-density*.16,0.,1.);
 float daylight=dot(skyColor,vec3(.2126,.7152,.0722))*2.1;
 vec3 cloudLight=mix(vec3(daylight),sunColor,.22)*(.64+.36*sunStrength);
 vec3 cloudColor=mix(skyColor*vec3(.62,.70,.82),cloudLight,litEdge)*cloudLayer.w;
 color=mix(color,cloudColor,cloud*cloudAmount);
 float sun=max(0.,dot(direction,sunDirection));
 float halo=pow(sun,32.)*.10+pow(sun,256.)*.035;
 float disc=smoothstep(.9994,.9999,sun)*.26;
 color+=sunColor*(halo+disc)*sunStrength*smoothstep(.02,.20,direction.y);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 // Match Three's post-output fog blend in both HDR and direct rendering.
 // Tone-mapping fog here would produce a seam on the low-cost direct path.
 vec3 horizon=linearToOutputTexel(vec4(fogColor,1.)).rgb;
 gl_FragColor.rgb=mix(horizon,gl_FragColor.rgb,height);
}`;

/** One camera-centered background draw. Pass current lighting colors to preserve
 * mixed-biome transitions; mapId is only the fallback palette/cloud density.
 */
export class AdventureAtmosphere{
 constructor(scene){
  this.scene=scene;this.disposed=false;
  const climate=CLIMATE_LIGHT.forest;
  const material=new T.ShaderMaterial({vertexShader,fragmentShader,side:T.BackSide,depthWrite:false,depthTest:false,fog:false,uniforms:{
   skyColor:{value:new T.Color(climate.sky)},fogColor:{value:new T.Color(climate.fog)},sunColor:{value:new T.Color(climate.sun)},
   sunDirection:{value:new T.Vector3(-18,30,14).normalize()},sunStrength:{value:1},skyTime:{value:0},cloudAmount:{value:cloudStrength.forest},cloudProfile:{value:new T.Vector4(...cloudProfiles.forest)},cloudLayer:{value:new T.Vector4(...cloudLayers.forest)}
  }});
  this.mesh=new T.Mesh(new T.SphereGeometry(160,24,12),material);
  this.mesh.name='adventure-atmosphere';this.mesh.renderOrder=-1000;this.mesh.frustumCulled=false;this.mesh.visible=false;
  scene.add(this.mesh);
 }
 update(time,camera,{world,mapId='forest',visible=true,skyColor,fogColor,sunColor,sunDirection,sunStrength=1,skyStrength=1}={}){
  if(this.disposed)return;
  // New runs use a new world but retain the scenery clock. Only a world change
  // resets cloud climate; crossing regions inside one world still blends.
  if(world!==undefined&&world!==this.world){this.world=world;this.lastTime=undefined;}
  this.mesh.visible=!!visible;if(!visible)return;
  camera.getWorldPosition(this.mesh.position);this.scene.worldToLocal(this.mesh.position);
  const climate=CLIMATE_LIGHT[mapId]||CLIMATE_LIGHT.forest,u=this.mesh.material.uniforms;
  u.skyColor.value.set(skyColor??climate.sky).multiplyScalar(skyStrength);u.fogColor.value.set(fogColor??climate.fog);u.sunColor.value.set(sunColor??climate.sun);
  if(sunDirection)u.sunDirection.value.copy(sunDirection).normalize();
  u.sunStrength.value=Math.max(0,Math.min(1,sunStrength));
  if(Number.isFinite(time)){
   // At a biome boundary the cloud shape blends on the same paused game clock as the sky.
   const blend=this.lastTime===undefined||time<this.lastTime?1:1-Math.exp(-Math.max(0,time-this.lastTime)*1.2),profile=cloudProfiles[mapId]||cloudProfiles.forest,layer=cloudLayers[mapId]||cloudLayers.forest;
   for(let i=0;i<4;i++){u.cloudProfile.value.setComponent(i,T.MathUtils.lerp(u.cloudProfile.value.getComponent(i),profile[i],blend));u.cloudLayer.value.setComponent(i,T.MathUtils.lerp(u.cloudLayer.value.getComponent(i),layer[i],blend));}
   u.cloudAmount.value=T.MathUtils.lerp(u.cloudAmount.value,cloudStrength[mapId]??cloudStrength.forest,blend);
   u.skyTime.value=time;this.lastTime=time;
  }
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.world=null;
  this.mesh.visible=false;this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();
 }
}

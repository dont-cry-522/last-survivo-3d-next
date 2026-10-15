import * as T from './vendor/three.module.js';
import {prepareCreatureSurface} from './creature-surface.js?v=206';

// Finite shared geometry, native morph targets and the existing IK. No skinning
// texture per spawn, new timers, CPU vertex uploads or extra render pass.
const limbs=new Map(),bodies=new WeakMap();
const smooth=T.MathUtils.smoothstep,down=new T.Vector3(0,-1,0),direction=new T.Vector3(),inverse=new T.Quaternion();
const SOFT_LIMBS=new Set(['wolf','frostwolf','snowhare','emberling','ashstalker','yeti','thornstag','rimefang','frostking','cinderdrake','reefturtle']);
const QUADRUPEDS=new Set(['wolf','frostwolf','ashstalker','thornstag','rimefang','moltenrhino','cinderdrake']);
const PLATED=new Set(['golem','lavabrute','boss','cinderlord','clawbeetle','tidecrab','reefturtle','dunescorpion','wreckwarden','obeliskwarden','moltenrhino','sunscarab']);

function limbGeometry(source,a,b,kind,back,arm=false){
 const key=source.uuid+':'+a+':'+b+':'+back+':'+arm;
 if(limbs.has(key))return limbs.get(key);
 source.computeBoundingBox();const size=source.boundingBox.getSize(new T.Vector3()),width=Math.min(size.x,size.z)*.5;
 const p=[],ix=[],colors=[],sine=[],cosine=[],sides=10,rows=['frostking','rimefang','thornstag','cinderdrake'].includes(kind)?28:19,color=new T.Color(0),c=source.attributes.color;
 // Sample coat at the broad upper muscle, preserving that species' palette.
 let count=0;for(let i=0;i<c.count;i++)if(source.attributes.position.getY(i)>-a*.5){color.r+=c.getX(i);color.g+=c.getY(i);color.b+=c.getZ(i);count++;}
 color.multiplyScalar(1/Math.max(1,count));
 const shape=[[-a*.23,0],[-a*.12,.72],[0,1],[a*.23,back?1.08:.96],[a*.62,.74],[a,.53],[a+b*.23,arm?.75:back?.64:.55],[a+b*.65,arm?.70:.39],[a+b,arm?.56:.27],[a+b+.015,0]];
 const contour=new T.CatmullRomCurve3(shape.map(([y,r])=>new T.Vector3(y,r,0)));
 for(let j=0;j<=rows;j++){
  const sample=contour.getPoint(j/rows),along=sample.x,radius=width*Math.max(0,sample.y),w=smooth(along,a-a*.20,a+b*.20);
  for(let i=0;i<sides;i++){
   const angle=i/sides*Math.PI*2,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=-along,dy=y+a;
   p.push(x,y,z);sine.push(0,-z*w,dy*w);cosine.push(0,-dy*w,-z*w);
   const shade=.93+.07*Math.sin(angle+1.1);colors.push(color.r*shade,color.g*shade,color.b*shade);
   if(j){const n=j*sides+i,next=j*sides+(i+1)%sides;ix.push(n-sides,next-sides,n,n,next-sides,next);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(ix);g.computeVertexNormals();
 g.morphTargetsRelative=true;g.morphAttributes.position=[new T.Float32BufferAttribute(sine,3),new T.Float32BufferAttribute(cosine,3)];
 const n=g.attributes.normal,ns=[],nc=[];
 for(let i=0;i<n.count;i++){const w=smooth(-p[i*3+1],a-a*.20,a+b*.20);ns.push(0,-n.getZ(i)*w,n.getY(i)*w);nc.push(0,-n.getY(i)*w,-n.getZ(i)*w);}
 g.morphAttributes.normal=[new T.Float32BufferAttribute(ns,3),new T.Float32BufferAttribute(nc,3)];
 // The shared organic material also expects flex attributes; these limbs use
 // anatomical joint flex only, never the autonomous tentacle shader.
 for(const [name,n]of [['creatureFlex',2],['creatureBend',3]])g.setAttribute(name,new T.Float32BufferAttribute(new Float32Array(p.length/3*n),n));
 prepareCreatureSurface(g,kind,'ContinuousLimb');g.computeBoundingBox();g.computeBoundingSphere();g.boundingBox.setFromBufferAttribute(g.attributes.position);g.userData.limbRows=rows;g.userData.limbSides=sides;g.name='SM_Enemy_'+kind+'_ContinuousLimb';limbs.set(key,g);return g;
}
function soften(l,kind){
 const source=l.upper.children.find(o=>o.isMesh),lower=l.knee.children.find(o=>o.isMesh);if(!source||!lower)return;
 const mesh=new T.Mesh(limbGeometry(source.geometry,l.upperLength,l.lowerLength,kind,l.back??l.hip?.z<0,l.arm),source.material);
 mesh.name='SM_Enemy_'+kind+'_ContinuousLimb';mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=source.customDepthMaterial;
 l.upper.remove(source);l.knee.remove(lower);l.upper.add(mesh);l.softLimb=mesh;
}
function poseLimb(l){
 const mesh=l.softLimb;if(!mesh)return;
 direction.copy(down).applyQuaternion(l.knee.quaternion);
 if(l.knee.parent!==l.upper)direction.applyQuaternion(inverse.copy(l.upper.quaternion).invert());
 const cos=T.MathUtils.clamp(-direction.y,-1,1);let sin=Math.hypot(direction.x,direction.z);
 // Rotate the bend plane, then use sin(theta) and 1-cos(theta) morphs. The
 // lower endpoint exactly follows the old fixed-length shin at every angle.
 if(sin>1e-7){
  const target=Math.atan2(-direction.x,-direction.z);let delta=Math.atan2(Math.sin(target-mesh.rotation.y),Math.cos(target-mesh.rotation.y));
  // Straightening through zero changes bend sign, not the whole skin's yaw.
  if(Math.abs(delta)>Math.PI/2){delta-=Math.sign(delta)*Math.PI;sin=-sin;}
  if(Math.abs(delta)>1e-12)mesh.rotation.y+=delta;
 }
 mesh.morphTargetInfluences[0]=sin;mesh.morphTargetInfluences[1]=1-cos;
}
function bodyFlex(mesh,kind){
 if(!mesh||mesh.morphTargetInfluences?.length)return null;
 const source=mesh.geometry;let g=bodies.get(source);
 if(!g){
  g=source.clone();g.computeBoundingBox();const box=g.boundingBox,size=box.getSize(new T.Vector3()),mid=box.getCenter(new T.Vector3()),quadruped=QUADRUPEDS.has(kind),soft=['mushroom','snowhare','foamling','sandworm','dunedevourer','jellyseer','abyssmedusa','tidestar','sailreaper','webmatriarch'].includes(kind);
  g.morphTargetsRelative=true;g.morphAttributes.position=[];g.morphAttributes.normal=[];
  for(let mode=0;mode<2;mode++){
   const deform=(x,y,z,out)=>{
    const height=smooth(y,box.min.y,box.max.y),center=Math.sin(Math.PI*T.MathUtils.clamp((z-box.min.z)/Math.max(.01,size.z),0,1));
    if(quadruped){const shoulder=Math.exp(-(((z-mid.z-size.z*.20)/(size.z*.27))**2)),side=T.MathUtils.clamp(x/Math.max(.01,size.x*.5),-1,1);out.set(x+(mode===0?side*shoulder*.025*size.x:height*center*.022*size.x),y+(mode===0?center*.022*size.y:side*shoulder*.016*size.y),z+(mode===0?(z-mid.z)*center*.022:side*shoulder*.025*size.z));}
    else if(soft){const band=Math.sin(Math.PI*height);out.set(x*(1+(mode===0?.045*band:.025*Math.sin(z*5)*band)),y-(mode===0?.04*size.y*band:0),z+(mode===0?0:.035*size.z*band));}
    else{const weight=smooth(height,.15,.8),angle=weight*(mode===0?.032:.045),co=Math.cos(angle),si=Math.sin(angle);out.set(mode===1?x*co+z*si:x,y,mode===1?z*co-x*si:z+weight*(mode===0?.016*size.y:0));}
    return out;
   };
   const p=source.attributes.position,n=source.attributes.normal,dp=new Float32Array(p.count*3),dn=new Float32Array(p.count*3),normal=new T.Vector3(),tangent=new T.Vector3(),bitangent=new T.Vector3(),origin=new T.Vector3(),du=new T.Vector3(),dv=new T.Vector3(),epsilon=1e-4;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);deform(x,y,z,origin);dp.set([origin.x-x,origin.y-y,origin.z-z],i*3);
    // Preserve authored smooth normals across duplicated triangle vertices.
    // Recomputing vertex normals on an unindexed surface would facet its skin.
    normal.fromBufferAttribute(n,i);tangent.set(0,Math.abs(normal.y)<.9?1:0,Math.abs(normal.y)<.9?0:1).cross(normal).normalize();bitangent.crossVectors(normal,tangent);
    deform(x+tangent.x*epsilon,y+tangent.y*epsilon,z+tangent.z*epsilon,du).sub(origin);deform(x+bitangent.x*epsilon,y+bitangent.y*epsilon,z+bitangent.z*epsilon,dv).sub(origin);du.cross(dv).normalize();
    dn.set([du.x-normal.x,du.y-normal.y,du.z-normal.z],i*3);
   }
   g.morphAttributes.position.push(new T.Float32BufferAttribute(dp,3));g.morphAttributes.normal.push(new T.Float32BufferAttribute(dn,3));
  }
  g.computeBoundingBox();g.computeBoundingSphere();g.boundingBox.copy(source.boundingBox);bodies.set(source,g);
 }
 mesh.geometry=g;mesh.updateMorphTargets();return mesh;
}
export function installCreatureAnatomy(g,kind){
 const d=g.userData;if(d.anatomy||!d.rig||d.skinned||d.leftKnee||['scout','silver','wraith','tide','lingya','wuling','mirage'].includes(kind))return g;
 const root=d.regionalRoot||d.rig,body=d.body||root.children.find(o=>o.isMesh&&/body/i.test(o.name));
 const chains=[...(d.legs||[]),...(d.knuckles||[])];
 if(kind==='frostking')for(let i=0;i<d.arms.length;i++)chains.push({upper:d.arms[i],knee:d.forearms[i],upperLength:1.02,lowerLength:.83,arm:true});
 if(SOFT_LIMBS.has(kind))for(const l of chains)if(l.upper&&l.knee)soften(l,kind);
 // The ape builder keeps its fingers in a separate hand batch, so replacing
 // the continuous arm sleeve does not hide or disconnect the actual hand.
 const flex=PLATED.has(kind)?null:bodyFlex(body,kind);
 d.anatomy={kind,chains,flex};
 for(const l of chains)poseLimb(l);return g;
}
export function animateCreatureAnatomy(g,t,speed=0){
 const d=g.userData,a=d.anatomy;if(!a)return;
 for(const l of a.chains)poseLimb(l);
 const phase=d.walkPhase??d.phase??t*2,stride=d.walkStride??d.stride??Math.min(1,speed/3),stage=d.bossStage;
 const wind=stage==='wind'?smooth(d.windProgress||0,0,1):stage==='strike'?1-smooth(d.strikeProgress||0,0,.32):d.previousAttack>0?smooth(1-d.previousAttack/(d.attackLength||1),0,.7):0;
 const drive=stage==='strike'?Math.sin(Math.PI*(d.strikeProgress||0)):Math.min(1,(d.release||0)*3),soft=a.kind==='snowhare'||a.kind==='mushroom';
 if(a.flex){const values=a.flex.morphTargetInfluences;values[0]=Math.sin(t*(soft?2.2:1.65))*.15*(1-stride)+Math.sin(phase*2-.55)*stride*.42+wind*.55-drive*.35;values[1]=Math.sin(phase-.65)*stride*.65-wind*.25+drive*.22;}
}

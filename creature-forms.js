import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Finite templates and two shared finishes. No per-enemy geometry/material,
// bone textures, extra lights or disposable particle resources.
const cache=new Map(),clock={value:0},skin=new T.MeshStandardMaterial({name:'M_Creature_Organic',vertexColors:true,roughness:.83,metalness:.03}),light=new T.MeshStandardMaterial({name:'M_Creature_SoftLight',vertexColors:true,roughness:.56,emissive:0xffffff,emissiveIntensity:.25});
// All actors see the same game clock. Species amplitudes live in geometry,
// avoiding per-draw changes to uniforms on a shared StandardMaterial.
export function setCreatureTime(t){if(Number.isFinite(t))clock.value=t;}
function bendShader(shader){
 shader.uniforms.creatureTime=clock;
 shader.vertexShader='uniform float creatureTime; attribute vec2 creatureFlex; attribute vec3 creatureBend;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float creaturePhase=creatureTime*2.1;
 float creatureWave=sin(creaturePhase+creatureFlex.y);
 transformed.x+=creatureWave*creatureFlex.x*creatureBend.x;
 transformed.z+=cos(creaturePhase*.83+creatureFlex.y)*creatureFlex.x*creatureBend.y;
 transformed.y+=max(0.,creatureWave)*creatureFlex.x*creatureBend.z;`);
}
for(const material of[skin,light]){material.onBeforeCompile=bendShader;material.customProgramCacheKey=()=> 'organic-creature-bend';}
const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});depth.onBeforeCompile=bendShader;depth.customProgramCacheKey=()=> 'organic-creature-depth';
export function tint(g,color,flexible){
 const c=new T.Color(color),p=g.attributes.position,colors=[],f=[],b=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),shade=.94+.045*Math.sin(x*11+y*6+z*7),v=flexible?flexible(x,y,z):[];colors.push(c.r*shade,c.g*shade,c.b*shade);f.push(v[0]||0,v[1]||0);b.push(v[2]||0,v[3]||0,v[4]||0);}
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('creatureFlex',new T.Float32BufferAttribute(f,2));g.setAttribute('creatureBend',new T.Float32BufferAttribute(b,3));g.deleteAttribute('uv');return g;
}
export function oval(color,x,y,z,sx,sy,sz,sides=12,rings=8){return tint(new T.SphereGeometry(1,sides,rings).scale(sx,sy,sz).translate(x,y,z),color);}
// Continuous cross-sections along Y or Z, with a single sealed surface and
// subtle folds/scutes already in its topology, rather than stacked spheres.
export function surface(color,rings,{axis='y',sides=16,flute=0,flexible,shade}={}){
 const p=[],ix=[];
 for(let j=0;j<rings.length;j++){
  const [along,rx,rz,cx=0,cz=0]=rings[j];
  for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,k=1+flute*Math.sin(a*7+j*.35),x=cx+Math.cos(a)*rx*k,z=cz+Math.sin(a)*rz*k;p.push(x,axis==='y'?along:z,axis==='y'?z:along);if(j){const n=j*sides+i,b=j*sides+(i+1)%sides;ix.push(n-sides,b-sides,n,n,b-sides,b);}}
 }
 for(const end of[0,1]){const ring=end?rings.length-1:0,start=p.length/3;let x=0,y=0,z=0;for(let i=0;i<sides;i++){x+=p[(ring*sides+i)*3];y+=p[(ring*sides+i)*3+1];z+=p[(ring*sides+i)*3+2];}p.push(x/sides,y/sides,z/sides);for(let i=0;i<sides;i++){const a=ring*sides+i,b=ring*sides+(i+1)%sides;ix.push(...(end?[start,a,b]:[start,b,a]));}}
 // Mapping Y rings to Z reverses handedness; descending hems reverse it again.
 if((axis==='y')===(rings.at(-1)[0]>rings[0][0]))for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();tint(g,color,flexible);
 if(shade){const c=g.attributes.color,base=new T.Color(color),out=new T.Color();for(let i=0;i<c.count;i++){shade(out.copy(base),p[i*3],p[i*3+1],p[i*3+2]);c.setXYZ(i,out.r,out.g,out.b);}}
 return g;
}
export function tube(color,points,radii,{sides=7,steps=12,flexible}={}){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,steps,1,sides,false),p=g.attributes.position,normal=g.attributes.normal;
 for(let i=0;i<=steps;i++){const t=i/steps,at=curve.getPointAt(t),index=t*(radii.length-1),r=T.MathUtils.lerp(radii[Math.floor(index)],radii[Math.min(radii.length-1,Math.ceil(index))],index%1);for(let j=0;j<=sides;j++){const n=i*(sides+1)+j;p.setXYZ(n,at.x+normal.getX(n)*r,at.y+normal.getY(n)*r,at.z+normal.getZ(n)*r);}}
 // Seal even the tapered ends; knees can expose them during deep recovery.
 const positions=Array.from(p.array),indices=Array.from(g.index.array);
 for(const end of[0,1]){const center=positions.length/3,at=curve.getPointAt(end),offset=end*steps*(sides+1);positions.push(at.x,at.y,at.z);for(let j=0;j<sides;j++)indices.push(...(end?[center,offset+j+1,offset+j]:[center,offset+j,offset+j+1]));}
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.deleteAttribute('normal');g.computeVertexNormals();return tint(g,color,flexible);
}
export function form(parent,key,build,{glow=false}={}){
 if(!cache.has(key)){
  const parts=build(),flat=parts.map(p=>p.index?p.toNonIndexed():p),g=mergeGeometries(flat,false);
  for(const p of new Set([...parts,...flat]))p.dispose();g.name='SM_'+key;g.computeBoundingBox();g.computeBoundingSphere();g.boundingSphere.radius+=.14;cache.set(key,g);
 }
 const m=new T.Mesh(cache.get(key),glow?light:skin);m.name='SM_'+key;m.castShadow=!glow;m.receiveShadow=true;m.customDepthMaterial=depth;parent.add(m);return m;
}
export const joint=(parent,x=0,y=0,z=0)=>{const p=new T.Group();p.position.set(x,y,z);parent.add(p);return p;};
export function face(color,y,z,spread=.12){return[-1,1].flatMap(s=>[oval(0x26312f,s*spread,y,z,.059,.049,.025),oval(color,s*spread,y+.008,z+.019,.027,.027,.012),oval(0xf2edcf,s*spread-.008,y+.018,z+.031,.008,.009,.004,6,4)]);}
export const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
export function gait(phase,stride,lift=.10){const u=T.MathUtils.euclideanModulo(phase/(Math.PI*2),1),support=u<.64,q=support?0:(u-.64)/.36;return{support,travel:(support?1-u/.64*2:-1+2*smooth(q))*stride,lift:Math.sin(q*Math.PI)*lift*stride};}
const down=new T.Vector3(0,-1,0),target=new T.Vector3(),direction=new T.Vector3(),bend=new T.Vector3(),elbow=new T.Vector3(),segment=new T.Vector3(),inverse=new T.Matrix4();
// Two fixed links keep the paw contact low during support, then flex at the
// knee for recovery. Curved tapered geometry hides the mechanical hinge.
export function leg(parent,key,{x,y,z,side=1,reach=0,a=.24,b=.25,width=.10,color=0x827258,foot=0x514b40,phase=0}){
 const upper=joint(parent,x,y,z),lower=joint(parent),paw=joint(parent),rest={x:x+reach*side,y:.04,z:z+.04};
 form(upper,key+'_upper',()=>[tube(color,[[0,.02,0],[width*.10,-a*.42,.015],[0,-a,0]],[width,width*.84,width*.59],{steps:7})]);
 form(lower,key+'_lower',()=>[tube(color,[[0,.015,0],[0,-b*.45,-.012],[0,-b,0]],[width*.64,width*.50,width*.35],{steps:7})]);
 form(paw,key+'_foot',()=>[oval(foot,0,.002,.025,width*.75,.034,width*1.5,10,6)]);
 return{joint:upper,knee:lower,paw,upperLength:a,lowerLength:b,rest,phase,side,reach,hip:{x,y,z},planted:true};
}
export function stepLeg(l,rig,phase,stride,{travel=.13,lift=.09,forward=0}={}){
 const step=gait(phase+l.phase,stride,lift);l.planted=step.support||stride<.001;
 target.set(l.rest.x,l.rest.y+step.lift,l.rest.z+step.travel*travel+forward);
 // Invert only the visual rig, so its breathing/banking doesn't push toes into
 // the floor. The actor's position, radius and movement remain untouched.
 rig.updateMatrix();target.applyMatrix4(inverse.copy(rig.matrix).invert());
 direction.copy(target).sub(l.joint.position);const raw=direction.length(),a=l.upperLength,b=l.lowerLength,d=Math.min(a+b-.001,Math.max(Math.abs(a-b)+.001,raw));direction.normalize();
 const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));bend.set(l.reach?l.side:0,.1,l.reach?-.15:1).addScaledVector(direction,-bend.dot(direction)).normalize();
 elbow.copy(l.joint.position).addScaledVector(direction,along).addScaledVector(bend,height);
 l.joint.quaternion.setFromUnitVectors(down,segment.copy(elbow).sub(l.joint.position).normalize());l.knee.position.copy(elbow);l.knee.quaternion.setFromUnitVectors(down,segment.copy(target).sub(elbow).normalize());l.paw.position.copy(target);l.paw.rotation.set(-rig.rotation.x,0,-rig.rotation.z);
}

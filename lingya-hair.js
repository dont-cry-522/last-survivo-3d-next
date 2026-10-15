import * as T from './vendor/three.module.js';
import {crownPositions,crownIndices} from './lingya-hair-crown.js?v=202';

let template;
const smooth=T.MathUtils.smoothstep;
const colour=new T.Color(),rootColour=new T.Color(0x553828),bodyColour=new T.Color(0x855937),lightColour=new T.Color(0xae8154);

function surface(rows,columns,point,tint){
 const positions=[],colours=[],indices=[];
 for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
  const v=row/rows,u=column/columns,p=point(u,v);positions.push(p.x,p.y,p.z);
  colour.copy(rootColour).lerp(bodyColour,.76).lerp(lightColour,tint(u,v));colours.push(colour.r,colour.g,colour.b);
 }
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const a=row*(columns+1)+column,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function lock(points,width,depth,phase=0){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),tangent=new T.Vector3(),across=new T.Vector3(),normal=new T.Vector3(),forward=new T.Vector3(0,0,1);
 return surface(18,8,(u,v)=>{
  const center=curve.getPoint(v);curve.getTangent(v,tangent);across.crossVectors(tangent,forward).normalize();normal.crossVectors(across,tangent).normalize();
  const taper=smooth(v,0,.20)*(.68+.32*Math.sin(Math.PI*v))*(1-.97*smooth(v,.76,1)),angle=u*Math.PI*2;
  return center.addScaledVector(across,Math.cos(angle)*width*taper).addScaledVector(normal,Math.sin(angle)*depth*taper);
 },(u,v)=>.12+.20*Math.max(0,Math.sin(u*Math.PI*2))+.09*Math.sin(v*3+phase)**2);
}

function buildTemplate(){
 const group=new T.Group();group.name='SM_Hero_Lingya_Hair';
 const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.72,metalness:0});material.name='M_Hero_Lingya_ChestnutHair';
 const add=(parent,name,geometry)=>{const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const crown=new T.BufferGeometry(),crownColours=[];
 crown.setAttribute('position',new T.Float32BufferAttribute(crownPositions,3));crown.setIndex(crownIndices);
 for(let i=0;i<crownPositions.length;i+=3){const x=crownPositions[i],y=crownPositions[i+1],z=crownPositions[i+2],angle=Math.atan2(x,z+.023);colour.copy(rootColour).lerp(bodyColour,.82).lerp(lightColour,.10+.10*Math.sin(angle*27+(y-1.65)*6)**2);crownColours.push(colour.r,colour.g,colour.b);}
 crown.setAttribute('color',new T.Float32BufferAttribute(crownColours,3));crown.computeVertexNormals();crown.computeBoundingBox();crown.computeBoundingSphere();
 add(group,'SM_Hero_Lingya_Hair_Crown',crown);
 const fringe=[
  [[-.016,1.721,.013],[-.028,1.713,.053],[-.019,1.680,.073],[.005,1.653,.076]],
  [[-.006,1.723,.017],[-.009,1.715,.058],[.008,1.681,.072],[.028,1.657,.073]],
  [[.004,1.723,.017],[.017,1.713,.057],[.030,1.679,.070],[.043,1.649,.067]],
  [[.015,1.721,.013],[.036,1.710,.052],[.051,1.677,.060],[.061,1.638,.043]],
  [[-.030,1.715,.010],[-.051,1.704,.043],[-.067,1.669,.035],[-.075,1.626,.016]],
 ];
 fringe.forEach((points,i)=>add(group,`SM_Hero_Lingya_Hair_Fringe_${i+1}`,lock(points,i===4?.008:.010,.0025,i)));
 for(const side of[-1,1])add(group,`SM_Hero_Lingya_Hair_Temple_${side<0?'L':'R'}`,lock([[side*.057,1.676,.041],[side*.073,1.658,.034],[side*.077,1.631,.020],[side*.070,1.610,.022]],.005,.0018,side));
 for(const side of[-1,1]){
  const pivot=new T.Group();pivot.name=`SM_Hero_Lingya_Hair_BraidRoot_${side<0?'L':'R'}`;pivot.position.set(side*.083,1.622,-.057);group.add(pivot);
  const path=new T.CatmullRomCurve3([[0,0,0],[side*.020,-.061,-.004],[side*.034,-.124,.011],[side*.047,-.183,.034]].map(p=>new T.Vector3(...p)));
  for(let strand=0;strand<3;strand++){
   const tangent=new T.Vector3(),across=new T.Vector3(),normal=new T.Vector3(),front=new T.Vector3(0,0,1);
   add(pivot,`SM_Hero_Lingya_Hair_Braid_${side<0?'L':'R'}_${strand+1}`,surface(36,8,(u,v)=>{
    const center=path.getPoint(v);path.getTangent(v,tangent);across.crossVectors(tangent,front).normalize();normal.crossVectors(across,tangent).normalize();
    const twist=side*(v*Math.PI*4.5+strand*Math.PI*2/3),orbit=.0068*(1-.55*smooth(v,.75,1)),radius=.0068*(1-.94*smooth(v,.87,1)),angle=u*Math.PI*2;
    return center.addScaledVector(across,Math.cos(twist)*orbit+Math.cos(angle)*radius).addScaledVector(normal,Math.sin(twist)*orbit*.70+Math.sin(angle)*radius*.83);
   },(u,v)=>.12+.18*Math.sin(u*Math.PI*2+strand)**2+.05*Math.sin(v*14)));
  }
 }
 return group;
}

// Geometries/materials belong to the shared template; actor cleanup must not
// dispose them. Only the hierarchy and braid rotations are instance-specific.
export function createLingyaHair(){
 template??=buildTemplate();const hair=template.clone(true);
 hair.userData.braidPivots=[hair.getObjectByName('SM_Hero_Lingya_Hair_BraidRoot_L'),hair.getObjectByName('SM_Hero_Lingya_Hair_BraidRoot_R')];return hair;
}

export function animateLingyaHair(hair,time,motion=0,turn=0){
 const pace=Math.min(1,Math.abs(motion)),steer=T.MathUtils.clamp(turn,-1,1);
 for(const[index,pivot]of hair.userData.braidPivots.entries()){
  const side=index===0?-1:1,phase=time*(2.0+pace*6)+index*.65;
  pivot.rotation.set(.018*Math.sin(time*1.8+index)+pace*.038*Math.sin(phase),-.025*steer,-side*.012+.012*Math.sin(time*2+index)+pace*.032*Math.sin(phase+.7)-steer*.035);
 }
}

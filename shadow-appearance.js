import * as T from './vendor/three.module.js';
import {smoothSeams} from './hero-finish.js?v=205';

// Dark values belong to the lining and veil; the outer cloth must retain shape.
export const SHADOW_PALETTE=Object.freeze({cloth:0x24252a,fold:0x393b41,lining:0x101115,leather:0x202126,edge:0xc6c8c6,ivory:0xe7e4db,soul:0xf4f3ee,metal:0x999f9f});

// Reuse the Ranger's authored cloth, UVs and skinning; each template owns its tints.
export function shadowOutfit(root){
 root.traverse(o=>{
  if(/Pauldron/.test(o.name))o.visible=false;
  if(/Head_Hood/.test(o.name))o.visible=true;
  if(!o.isMesh)return;
  const tintMaterial=source=>{
   const m=source.clone();
   if(!source.name.includes('Ranger'))return m;
   const leather=/Belt|Bracer|Feet/.test(o.name),color=/Belt|Bracer|Feet/.test(o.name)?SHADOW_PALETTE.leather:/Legs|Arms/.test(o.name)?SHADOW_PALETTE.fold:SHADOW_PALETTE.cloth;
   const tint=new T.Color(color).toArray().join(',');
   m.color.set(0xffffff);m.roughness=leather?.86:.94;m.metalness=.015;
   m.roughnessMap=null;m.metalnessMap=null;m.normalScale?.setScalar(leather?.24:.18);
   m.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float shadowWeave=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
     diffuseColor.rgb=vec3(${tint})*(.72+shadowWeave*.68);`);
   };
   m.customProgramCacheKey=()=> 'shadow-ranger-cloth-'+tint;
   return m;
  };
  o.material=Array.isArray(o.material)?o.material.map(tintMaterial):tintMaterial(o.material);
 });
}

const scarfMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0,side:T.DoubleSide});
const claspMaterial=new T.MeshStandardMaterial({color:SHADOW_PALETTE.metal,roughness:.70,metalness:.32});
const scarves=new Map();
let claspGeometry;

function clothForm(weapon){
 if(scarves.has(weapon))return scarves.get(weapon);
 let panels,claspPanel,claspV;
 if(weapon==='shadowblade'){
  // Soft shoulder cloth narrows at each hanging end and drapes down the outer
  // shoulder. Curved hems avoid reading as two rectangular armor plates.
  panels=[1,-1].map(side=>(u,v)=>{
   const bend=v*2-1,width=.080+.061*Math.sin(v*Math.PI),fold=Math.sin(u*Math.PI*3+v*.7)*(.002+.0035*Math.abs(bend))*(1-u*.5);
   return[side*(.072+width*u+.004*Math.sin(v*Math.PI)),1.553-.069*u**1.35-(bend<0?.073:.105)*Math.abs(bend)**1.8+fold,-.146+.275*v+.009*Math.sin(u*Math.PI)*bend];
  });
  claspPanel=panels[0];claspV=.90;
 }else if(weapon==='grimoire'){
  // Open V-shaped cloth falls down the chest instead of filling it with a shell.
  panels=[1,-1].map(side=>(u,v)=>{
   const x=side*(.104-.088*v)+(u-.5)*(.056-.024*v)*(.83+.17*Math.sin(v*Math.PI));
   return[x,1.528-.267*v+.005*Math.sin(u*Math.PI)*v**3,.095+.049*Math.sin(v*Math.PI/2)+Math.sin(u*Math.PI*2)*.006*Math.sin(v*Math.PI)];
  });
  claspPanel=panels[0];claspV=.90;
 }else{
  const neck=(u,v)=>{
   const x=-.094+.196*u;
   return[x,1.546-.041*v+.004*Math.sin(u*Math.PI)-.003*Math.sin(u*Math.PI*3)*v,.095-.027*(x/.11)**2+.004*Math.sin(u*Math.PI*3+v*.4)];
  };
  const sash=(u,v)=>{
   const x=.083-.174*v+(u-.5)*(.058-.012*v);
   return[x,1.526-.206*v+(u-.5)*.025+.004*Math.sin(u*Math.PI)*v,.094+.043*Math.sin(v*Math.PI/2)+Math.sin(u*Math.PI*2+v)*.006*Math.sin(v*Math.PI)];
  };
  panels=[neck,sash];claspPanel=sash;claspV=.18;
 }
 const positions=[],colors=[],indices=[],slices=8,rows=14;
 const cloth=new T.Color(SHADOW_PALETTE.cloth),edge=new T.Color(SHADOW_PALETTE.edge);
 for(const surface of panels){
  const offset=positions.length/3;
  for(let j=0;j<=rows;j++)for(let i=0;i<=slices;i++){
   const u=i/slices,v=j/rows;
   positions.push(...surface(u,v));
   // Both folds are the same cloth. A narrow, continuous sewn edge carries
   // the pale element without turning one half into a separate white plate.
   const hem=Math.max(Math.abs(u-.5)*2,v),trim=T.MathUtils.smoothstep(hem,.975,1);
   const color=cloth.clone().lerp(edge,trim*.68).multiplyScalar(.91+.09*Math.cos(u*Math.PI*3+v));
   colors.push(color.r,color.g,color.b);
   if(j<rows&&i<slices){const n=offset+j*(slices+1)+i;indices.push(n,n+slices+1,n+1,n+1,n+slices+1,n+slices+2);}
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();smoothSeams(geometry);
 const claspPosition=new T.Vector3(...claspPanel(.5,claspV));
 const across=new T.Vector3(...claspPanel(.51,claspV)).sub(claspPosition),down=new T.Vector3(...claspPanel(.5,claspV+.01)).sub(claspPosition);
 const claspNormal=across.cross(down).normalize();if(claspNormal.z<0)claspNormal.negate();
 claspPosition.addScaledVector(claspNormal,.005);
 const form={geometry,claspPosition,claspNormal};scarves.set(weapon,form);return form;
}

export function shadowAccessories(weapon='shade'){
 if(weapon!=='shadowblade'&&weapon!=='grimoire')weapon='shade';
 const form=clothForm(weapon);
 const chest=new T.Group();chest.name='Shadow_traveller_scarf';
 const scarf=new T.Mesh(form.geometry,scarfMaterial);scarf.name='Shadow_short_scarf';chest.add(scarf);
 if(!claspGeometry){
  const upper=new T.Shape();upper.moveTo(-.013,.017);upper.lineTo(-.007,.020);upper.lineTo(.009,.004);upper.lineTo(.003,-.001);upper.closePath();
  const lower=new T.Shape();lower.moveTo(.007,-.006);lower.lineTo(.013,-.003);lower.lineTo(.016,-.012);lower.lineTo(.002,-.021);lower.lineTo(-.002,-.016);lower.lineTo(.009,-.011);lower.closePath();
  claspGeometry=new T.ExtrudeGeometry([upper,lower],{depth:.004,bevelEnabled:true,bevelThickness:.001,bevelSize:.001,bevelSegments:1,curveSegments:1});
 }
 const clasp=new T.Mesh(claspGeometry,claspMaterial);clasp.name='Shadow_broken_clasp';
 clasp.position.copy(form.claspPosition);clasp.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),form.claspNormal);clasp.rotateZ(.30);chest.add(clasp);
 chest.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
 // Coordinates are the source model's rest space; attachAtRest handles the chest bone.
 return{chest};
}

// Moderate colour spill without tinting bone-white cloth blue or crushing the
// layered blacks. Lighting still comes from the scene, not glow.
export function finishShadowTone(material){
 if(!material.isMeshStandardMaterial||material.userData.shadowTone)return;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  compile(shader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float shadowLight=dot(outgoingLight,vec3(.2126,.7152,.0722));
    outgoingLight=mix(outgoingLight,vec3(shadowLight),.24);
    #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>key+'-neutral-shadow';material.userData.shadowTone=true;
}

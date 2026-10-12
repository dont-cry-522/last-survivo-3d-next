import * as T from './vendor/three.module.js';

// Average normals at duplicated UV vertices, retaining UVs and skin weights.
export function smoothSeams(geometry){
 const p=geometry.attributes.position,n=geometry.attributes.normal,groups=new Map();
 if(!n)return;
 const used=new Set(geometry.index?geometry.index.array:Array.from({length:p.count},(_,i)=>i));
 for(const i of used){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 for(const indices of groups.values()){
  const normal=new T.Vector3();for(const i of indices)normal.add(new T.Vector3().fromBufferAttribute(n,i));normal.normalize();
  for(const i of indices)n.setXYZ(i,normal.x,normal.y,normal.z);
 }
 n.needsUpdate=true;
}

export function finishHeroSurface(root,kind){
 root.traverse(o=>{
  if(!o.isMesh)return;
  const name=o.material.name||'',skin=name.includes('Superhero')||name.includes('Regular'),hair=name.includes('Hair')||o.userData.hairstyle||o.name.startsWith('Guardian_');
  // Every template receives its own surfaces; polishing one must not recolor another.
  const original=o.material;o.geometry=o.geometry.clone();o.material=original.clone();o.material.onBeforeCompile=original.onBeforeCompile;o.material.customProgramCacheKey=original.customProgramCacheKey;
  const garment=/Ranger|Peasant/.test(name),softCloth=garment&&/Body|Legs|Hood/.test(o.name);
  if(skin||hair||softCloth)smoothSeams(o.geometry);
  const m=o.material;
  if(m.normalScale)m.normalScale.multiplyScalar(skin?.65:hair?.55:/Belt|Bracer|Feet/.test(o.name)?.65:.48);
  if(kind==='scout'&&name.includes('Ranger')){
   m.color.set(0xc4cbbb);m.roughness=.83;m.metalness=/Pauldron|Bracer/.test(o.name)?.20:.04;
  }
  if(kind==='guardian'&&/Body$|Pauldron|Bracer/.test(o.name)){m.metalness=.32;m.roughness=.64;}
  if(kind==='tide'&&!skin&&!hair){m.roughness=.78;m.metalness=/Bracer|Belt/.test(o.name)?.18:.035;}
  if(kind==='lingya'&&!skin&&!hair){m.roughness=.90;m.metalness=.01;}
  if(garment){
   // Keep authored buckles metallic, while cloth and leather retain broad, soft highlights.
   const leather=/Belt|Bracer|Feet/.test(o.name);
   m.roughness=leather?.72:.93;
   if(m.metalnessMap)m.metalness=.82;
   const compile=m.onBeforeCompile,program=m.customProgramCacheKey();
   m.onBeforeCompile=shader=>{
    compile(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
     float textile=1.0-smoothstep(.08,.52,metalnessFactor);
     float softRoughness=max(roughnessFactor,${leather?'.58':'.86'});
     roughnessFactor=mix(clamp(roughnessFactor,.30,.50),softRoughness,textile);`);
   };
   m.customProgramCacheKey=()=>program+'-tailored-surface-'+(leather?'leather':'cloth');
  }
 });
}

// The short bob stays rooted at the crown; only its free ends lag a turn.
// CPU vertex motion keeps the colour and shadow passes on the same silhouette.
export function prepareSilverHair(model){
 const hair=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.userData.hairstyle)return;
  mesh.geometry=mesh.geometry.clone();
  const original=mesh.material;mesh.material=original.clone();mesh.material.onBeforeCompile=original.onBeforeCompile;mesh.material.customProgramCacheKey=original.customProgramCacheKey;
  mesh.name='SM_Hero_Hair_Silver';
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,weight=new Float32Array(p.count),slope=new Float32Array(p.count);
  for(let i=0;i<p.count;i++){const u=T.MathUtils.clamp((1.72-p.getY(i))/.14,0,1);weight[i]=u*u;slope[i]=u>0&&u<1?-2*u/.14:0;}
  p.setUsage(T.DynamicDrawUsage);n.setUsage(T.DynamicDrawUsage);
  mesh.userData.silverHair={position:p.array.slice(),normal:n.array.slice(),weight,slope};hair.push(mesh);
 });return hair;
}
export function animateSilverHair(hair,time,run,turn){
 const x=Math.sin(time*1.8)*.0025-turn*.018,z=Math.sin(time*2.2+.7)*.002-run*.007;
 for(const mesh of hair){
  const d=mesh.userData.silverHair,p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
  for(let i=0;i<p.count;i++){
   const k=i*3,w=d.weight[i];p.setXYZ(i,d.position[k]+x*w,d.position[k+1],d.position[k+2]+z*w);
   // Inverse transpose of this y-weighted shear: correct highlights without a full normal rebuild.
   const nx=d.normal[k],ny=d.normal[k+1]-d.slope[i]*(x*d.normal[k]+z*d.normal[k+2]),nz=d.normal[k+2],length=Math.hypot(nx,ny,nz)||1;
   n.setXYZ(i,nx/length,ny/length,nz/length);
  }p.needsUpdate=true;n.needsUpdate=true;
 }
}

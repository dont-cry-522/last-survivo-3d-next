import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

const geometry=new Map(),materials=new Map();

// A few inset seams are batched into one draw, never a collection of charms.
// Cached immutable parts are shared by world weapons and the first-person copy.
export function weaponInlay(parent,name,paths,color,radius=.002,metalness=.48){
 const key=name+JSON.stringify(paths)+radius;
 if(!geometry.has(key)){
  const pieces=paths.map(points=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(4,points.length*3),radius,4,false));
  const g=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());g.name=name;geometry.set(key,g);
 }
 const materialKey=color+':'+metalness;
 if(!materials.has(materialKey))materials.set(materialKey,new T.MeshStandardMaterial({name:'MAT_Weapon_Inlay_'+color,color,metalness,roughness:.55}));
 const mesh=new T.Mesh(geometry.get(key),materials.get(materialKey));mesh.name=name;mesh.userData.identityDetail=true;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

export function nameWeapon(root,hero,weapon){
 root.userData.weaponIdentity={hero,weapon};
 root.traverse(o=>{if(!o.isMesh)return;if(!o.name)o.name='SM_Weapon_'+weapon+'_Structure';if(['rifle','shotgun'].includes(weapon))o.material.userData.identityFinish=true;});
 return root;
}

export function mirrorPetalGeometry(){
 if(geometry.has('mirror-petal'))return geometry.get('mirror-petal');
 const p=[],uv=[],index=[],rows=16,cols=8;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const v=j/rows,u=i/cols*2-1,w=.025+.975*Math.sin(v*Math.PI)**.8;
  // A shallow pressed mirror face with a rounded rim, not a swollen seed pod.
  p.push(u*w,v*2-1,.20+.18*Math.sin(v*Math.PI)-.24*Math.abs(u)**6);uv.push(i/cols,v);
  if(j<rows&&i<cols){const n=j*(cols+1)+i;index.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();g.name='SM_Weapon_Mirage_MirrorPetal';geometry.set('mirror-petal',g);return g;
}

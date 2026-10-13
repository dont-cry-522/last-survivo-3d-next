import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

const geometry=new Map(),materials=new Map();

// One closed lathed section: outer steel, chamfered lip, inner wall and recessed
// dark floor. The hole is real geometry rather than a black disk on the muzzle.
export function recessedBarrelGeometry(radius,length){
 const key=`barrel:${radius}:${length}`;if(geometry.has(key))return geometry.get(key);
 const end=length/2,inside=radius*.69,depth=Math.min(.075,length*.25);
 const profile=[[radius,-end],[radius,end-.003],[radius-.002,end],[inside+.002,end],[inside,end-.004],[inside,end-depth],[0,end-depth]];
 const g=new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),20),colors=[];
 for(let i=0;i<g.attributes.position.count;i++){const row=i%profile.length,v=row>=5?.12:row===4?.28:row===3?.67:row===2?.95:.72;colors.push(v,v,v);}
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.rotateX(Math.PI/2);g.name='SM_Weapon_RecessedBarrel';geometry.set(key,g);return g;
}

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

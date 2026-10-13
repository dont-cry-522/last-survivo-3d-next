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
 const p=[],uv=[],colors=[],index=[],rows=16,cols=8,layer=(rows+1)*(cols+1);
 for(let back=0;back<2;back++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const v=j/rows,u=i/cols*2-1,w=.025+.975*Math.sin(v*Math.PI)**.8;
  // Roll the rim inward and close its back inside the original face envelope.
  const rim=Math.abs(u)**10,z=.20+.18*Math.sin(v*Math.PI)-.24*Math.abs(u)**6+.08*rim-back*.08;
  p.push(u*w,v*2-1,z);uv.push(i/cols,v);const c=back?.62:.80+.20*rim;colors.push(c,c,c);
  if(j<rows&&i<cols){const n=back*layer+j*(cols+1)+i;index.push(...(back?[n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2]:[n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1]));}
 }
 const border=[];for(let i=0;i<=cols;i++)border.push(i);for(let j=1;j<=rows;j++)border.push(j*(cols+1)+cols);for(let i=cols-1;i>=0;i--)border.push(rows*(cols+1)+i);for(let j=rows-1;j>0;j--)border.push(j*(cols+1));
 for(let i=0;i<border.length;i++){const a=border[i],b=border[(i+1)%border.length];index.push(a,a+layer,b,b,a+layer,b+layer);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();g.name='SM_Weapon_Mirage_MirrorPetal';geometry.set('mirror-petal',g);return g;
}

// Small opaque PBR maps distinguish a granular seed vessel from condensed mist.
// These cached maps are shared with the viewmodel: no new mesh, light or pass.
export function lanternCoreMaterial(kind){
 const key='lantern-core:'+kind;if(materials.has(key))return materials.get(key);
 const size=128,map=new Uint8Array(size*size*4),rough=new Uint8Array(map.length),emission=new Uint8Array(map.length),spore=kind==='spore',tau=Math.PI*2;
 const clamp=T.MathUtils.clamp,mix=T.MathUtils.lerp;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/(size-1),pole=Math.sin(v*Math.PI),wave=Math.sin(u*tau*3+v*13)*.5+Math.sin(u*tau*7-v*19)*.25;
  let light,body,r;
  if(spore){
   const sx=u*24+Math.sin(v*17)*.7,sy=v*18+Math.sin(u*tau*3)*.4,cx=Math.floor(sx),cy=Math.floor(sy),seed=Math.sin(((cx%24+24)%24)*127.1+cy*311.7)*43758.5453,f=seed-Math.floor(seed);
   const dx=sx-cx-(.22+f*.56),dy=sy-cy-(.24+((f*7)%1)*.52),spot=1-T.MathUtils.smoothstep(.10+f*.09,.22+f*.11,Math.hypot(dx,dy));
   const vein=Math.abs(Math.sin(u*tau*3+Math.sin(v*6)*.22));
   light=spot*pole*(.55+.45*f);body=clamp(.20+wave*.08+light*.73+(1-vein)*.12,0,1);r=.91-light*.20;
  }else{
   const fold=Math.sin(v*29+Math.sin(u*tau*2)*2.1+wave*.8),veil=(.5+.5*fold)**3;
   light=veil*pole*(.52+.30*Math.cos(u*tau+v*3));body=clamp(.10+wave*.045+light*.83,0,1);r=.45-light*.19;
  }
  const dark=spore?[61,66,30]:[35,22,63],lit=spore?[207,212,117]:[193,164,230],i=(y*size+x)*4;
  for(let c=0;c<3;c++){map[i+c]=Math.round(mix(dark[c],lit[c],body));rough[i+c]=Math.round(r*255);emission[i+c]=Math.round(clamp(light*(spore?.83:1),0,1)*255);}
  map[i+3]=rough[i+3]=emission[i+3]=255;
 }
 const texture=(data,name,colorSpace)=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.name='TX_Weapon_'+kind+'_'+name;t.colorSpace=colorSpace;t.wrapS=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 const material=new T.MeshStandardMaterial({name:'MAT_Weapon_'+kind+'_Core',color:0xffffff,map:texture(map,'Color',T.SRGBColorSpace),roughness:1,roughnessMap:texture(rough,'Roughness',T.NoColorSpace),emissive:spore?0xc5d37a:0xb997f0,emissiveIntensity:spore?.14:.20,emissiveMap:texture(emission,'Emission',T.NoColorSpace),metalness:0});
 material.userData.lanternCore=kind;materials.set(key,material);return material;
}

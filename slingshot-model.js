import * as T from './vendor/three.module.js';
import {slingshotMechanism} from './weapon-performance.js?v=209';
import {nameWeapon,weaponInlay} from './weapon-identity.js?v=209';

// +Z is the firing direction. Immutable geometry/materials are shared between
// characters; only the two bands, pouch and loaded pebble change their pose.
export const SLINGSHOT_GRIP=[0,-.13,0],SLINGSHOT_OUTLET=[0,.22,.025];
export const SLINGSHOT_TIPS=[[-.15,.22,0],[.15,.22,0]];
const UP=new T.Vector3(0,1,0),delta=new T.Vector3(),mid=new T.Vector3(),geometries=new Map(),materials=new Map();
function material(name,color,roughness=.72,metalness=0){
 if(!materials.has(name))materials.set(name,new T.MeshStandardMaterial({name:'MAT_Slingshot_'+name,color,roughness,metalness,vertexColors:['Wood','Binding','Pouch'].includes(name)}));return materials.get(name);
}
function geometry(name,make){if(!geometries.has(name)){const g=make();g.name='SM_Slingshot_'+name;geometries.set(name,g);}return geometries.get(name);}
function mesh(parent,name,g,m){const o=new T.Mesh(g,m);o.name='SM_Slingshot_'+name;o.userData.identityDetail=true;o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
function limb(name,points,radius){
 return geometry(name,()=>{
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,24,radius,10,false),p=g.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const t=Math.floor(i/11)/24,center=curve.getPointAt(t),taper=.83+.17*Math.sin(t*Math.PI);p.setXYZ(i,center.x+(p.getX(i)-center.x)*taper,center.y+(p.getY(i)-center.y)*taper,center.z+(p.getZ(i)-center.z)*taper);const c=new T.Color(0xb18b51).multiplyScalar(.87+.075*Math.sin(t*23+i%11*.48)+.025*Math.sin(t*91));colors.push(c.r,c.g,c.b);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
 });
}
function bindingGeometry(){
 return geometry('BandBinding',()=>{
  // Recessed ties remain one closed mesh and never move the elastic anchors.
  const profile=[[0,-.0225],[.027,-.0225],[.029,-.019],[.028,-.015],[.0255,-.013],[.028,-.010],[.0285,-.003],[.0255,0],[.028,.003],[.028,.011],[.0255,.014],[.027,.017],[.027,.0225],[0,.0225]];
  const g=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),12),p=g.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i)),v=r<.026?.60:.92;colors.push(v,v,v);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
 });
}
function pouchGeometry(){
 return geometry('LeatherPouch',()=>{
  // A shallow leather cup opens toward the stone (+Z), with a real folded rim.
  // Its normalized envelope stays inside the previous ellipsoid.
  const p=[],uv=[],colors=[],index=[],rings=4,sides=16,layer=1+rings*sides;
  const vertex=(r,a,back)=>{const x=Math.cos(a)*r,y=Math.sin(a)*r,z=.80*r*r-.65-back*.20,v=back?.69:.63+.37*r*r;p.push(x,y,z);uv.push(x*.5+.5,y*.5+.5);colors.push(v,v,v);};
  for(let back=0;back<2;back++){
   vertex(0,0,back);for(let j=1;j<=rings;j++)for(let i=0;i<sides;i++)vertex(j/rings,i/sides*Math.PI*2,back);
   const offset=back*layer;
   for(let i=0;i<sides;i++){const a=offset+1+i,b=offset+1+(i+1)%sides;index.push(...(back?[offset,b,a]:[offset,a,b]));}
   for(let j=0;j<rings-1;j++)for(let i=0;i<sides;i++){
    const a=offset+1+j*sides+i,b=offset+1+j*sides+(i+1)%sides;index.push(...(back?[a,b+sides,a+sides,a,b,b+sides]:[a,a+sides,b+sides,a,b+sides,b]));
   }
  }
  for(let i=0;i<sides;i++){const a=1+(rings-1)*sides+i,b=1+(rings-1)*sides+(i+1)%sides;index.push(a,a+layer,b+layer,a,b+layer,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();return g;
 });
}
export function makeSlingshot(){
 const g=new T.Group();g.name='Lingya_leafwood_slingshot';
 mesh(g,'WoodHandle',limb('WoodHandle',[[0,-.285,.016],[-.012,-.16,.006],[0,-.02,0],[0,.055,0]],.032),material('Wood',0xffffff,.66));
 for(const side of[-1,1]){
  mesh(g,'WoodFork_'+(side<0?'L':'R'),limb('WoodFork_'+side,[[0,-.01,0],[side*.085,.07,-.008],[side*.132,.14,-.008],[side*.15,.22,0]],.029),material('Wood',0xffffff,.66));
  const cuff=mesh(g,'BandBinding_'+side,bindingGeometry(),material('Binding',0x887153,.91));cuff.position.set(side*.15,.205,0);cuff.rotation.z=-side*.20;
 }
 const grip=mesh(g,'LeatherGrip',geometry('LeatherGrip',()=>new T.LatheGeometry([[.026,-.075],[.037,-.065],[.036,-.035],[.034,.025],[.035,.055],[.028,.064]].map(p=>new T.Vector2(...p)),20)),material('Leather',0x62462f,.87));grip.position.set(...SLINGSHOT_GRIP);
 weaponInlay(g,'SM_Slingshot_GripSeam',[[[-.023,-.19,.025],[-.021,-.16,.029],[-.020,-.13,.028],[-.019,-.10,.026],[-.021,-.074,.022]]],0xc4a364,.002,0);
 const pouch=new T.Group();pouch.name='SM_Slingshot_Pouch';g.add(pouch);
 const pocket=mesh(pouch,'LeatherPouch',pouchGeometry(),material('Pouch',0x705039,.88));pocket.scale.set(.046,.030,.016);
 const projectile=mesh(pouch,'LoadedPebble',geometry('LoadedPebble',()=>new T.DodecahedronGeometry(.024,1)),material('Pebble',0xb4b2a0,.78));projectile.position.z=.018;projectile.scale.set(1,.91,1.05);
 const bands=SLINGSHOT_TIPS.map((tip,i)=>mesh(g,'ElasticBand_'+i,geometry('ElasticBand',()=>new T.CylinderGeometry(1,1,1,8)),material('Elastic',0xb99457,.80)));
 Object.assign(g.userData,{pouch,bands,projectile,bandAnchors:SLINGSHOT_TIPS.map(p=>new T.Vector3(...p))});nameWeapon(g,'lingya','boomerang');poseSlingshot(g,10,1);return g;
}
export function poseSlingshot(g,age,period=1){
 const d=g.userData;if(!d.pouch||!d.bands)return;const m=slingshotMechanism(age,period);
 d.pouch.position.set(0,.22,-.07-.30*m.pull);d.pouch.rotation.set(0,0,.035*m.kick);d.projectile.visible=m.stoneVisible;
 d.bands.forEach((band,i)=>{mid.copy(d.pouch.position);mid.x+=(i?1:-1)*.036;delta.copy(mid).sub(d.bandAnchors[i]);const length=delta.length();band.position.copy(d.bandAnchors[i]).addScaledVector(delta,.5);band.quaternion.setFromUnitVectors(UP,delta.normalize());band.scale.set(.006,length,.012);});
 return m;
}

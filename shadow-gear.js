import * as T from './vendor/three.module.js';

const geometry=new Map(),materials=new Map();
function part(parent,key,create,color,position=[0,0,0],scale=[1,1,1],glow=false){
 if(!geometry.has(key))geometry.set(key,create());
 const mk=color+':'+glow;if(!materials.has(mk))materials.set(mk,glow?new T.MeshBasicMaterial({color,toneMapped:false,side:T.DoubleSide}):new T.MeshStandardMaterial({color,roughness:.86,metalness:.08}));
 const m=new T.Mesh(geometry.get(key),materials.get(mk));m.position.set(...position);m.scale.set(...scale);m.castShadow=!glow;m.receiveShadow=true;parent.add(m);return m;
}
function line(parent,color,points,radius=.006,glow=false){
 return part(parent,'line:'+radius+JSON.stringify(points),()=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,radius,6,false),color,undefined,undefined,glow);
}
function warScytheBlade(){
 const shape=new T.Shape();shape.moveTo(-.045,.03);shape.bezierCurveTo(.32,.36,.94,.32,1.06,-.45);shape.bezierCurveTo(.80,.01,.45,.12,.03,-.04);shape.closePath();
 return new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.008,curveSegments:18});
}
function riftShards(){
 const outlines=[[-.11,1.4,-.76,.57,-.52,-.45,-.17,-1.2,-.03,-.35,-.22,.18,.02,.70],[.20,1.18,.62,.51,.74,-.38,.23,-1.45,.11,-.40,.25,.20,.12,.63]];
 const shapes=outlines.map(points=>{const s=new T.Shape();s.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)s.lineTo(points[i],points[i+1]);s.closePath();return s;});
 const g=new T.ExtrudeGeometry(shapes,{depth:.25,bevelEnabled:true,bevelThickness:.05,bevelSize:.035,bevelSegments:1,steps:1,curveSegments:1});g.translate(0,0,-.125);return g;
}
export function shadowFocus(id){
 const g=new T.Group();g.name='shadow-focus-'+id;
 if(id==='shadowblade'){
  // A held war-scythe: wrapped shaft, offset socket, curved metal blade and a narrow silver edge.
  line(g,0x242733,[[0,-.48,.02],[0,.05,.02],[.025,.72,.02]],.030);
  for(let i=0;i<5;i++)part(g,'scythe-wrap',()=>new T.TorusGeometry(.032,.007,4,10),0x747582,[0,-.10+i*.048,.02]).rotation.x=Math.PI/2;
  part(g,'scythe-socket',()=>new T.SphereGeometry(1,8,6),0x738294,[.025,.70,.02],[.065,.09,.06]);
  const blade=part(g,'war-scythe',warScytheBlade,0x4c586b,[.015,.70,.02]);blade.material.roughness=.44;blade.material.metalness=.42;blade.material.emissive.setHex(0x18202a);blade.material.emissiveIntensity=.18;
  line(g,0xc2cbd5,[[.045,.66,.05],[.33,.71,.05],[.62,.67,.05],[.86,.51,.05],[1.075,.25,.05]],.009);
 }else if(id==='grimoire'){
  for(const sign of [-1,1]){
   const leaf=new T.Group();leaf.rotation.z=sign*.18;leaf.position.set(0,.075,.06);g.add(leaf);
   part(leaf,'box',()=>new T.BoxGeometry(1,1,1),0x18171e,[sign*.115,0,0],[.23,.028,.29]);
   part(leaf,'box',()=>new T.BoxGeometry(1,1,1),0x36353e,[sign*.11,.022,0],[.21,.018,.26]);
   for(const z of [-.07,0,.07])line(leaf,0xbac5cc,[[sign*.040,.036,z],[sign*.090,.038,z],[sign*.105,.038,z+.010],[sign*.148,.036,z+.010]],.0014,true);
  }
  g.userData.page=part(g,'box',()=>new T.BoxGeometry(1,1,1),0x44434d,[.095,.12,.06],[.18,.004,.25]);
 }else{
  const focus=part(g,'rift-shards',riftShards,0x101017,[0,.09,.12],[.052,.052,.052]);g.userData.focus=focus;focus.name='Shadow_compressed_rift';
  // The existing focus scale animation compresses the dark fragments and their narrow split together.
  line(focus,0xc5ced4,[[-.005,.68,.205],[-.18,.19,.205],[-.075,-.08,.205]],.018,true);
  line(focus,0xb4c0c8,[[.105,-.43,.205],[.20,-1.18,.205]],.018,true);
 }
 return g;
}

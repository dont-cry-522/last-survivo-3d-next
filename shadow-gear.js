import * as T from './vendor/three.module.js';

const geometry=new Map(),materials=new Map();
function part(parent,key,create,color,position=[0,0,0],scale=[1,1,1],glow=false){
 if(!geometry.has(key))geometry.set(key,create());
 const mk=color+':'+glow;if(!materials.has(mk))materials.set(mk,glow?new T.MeshBasicMaterial({color,toneMapped:false,side:T.DoubleSide}):new T.MeshStandardMaterial({color,roughness:.86,metalness:.08}));
 const m=new T.Mesh(geometry.get(key),materials.get(mk));m.position.set(...position);m.scale.set(...scale);m.castShadow=!glow;m.receiveShadow=true;parent.add(m);return m;
}
function line(parent,color,points,radius=.006,glow=false,segments=24){
 return part(parent,'line:'+radius+':'+segments+JSON.stringify(points),()=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,radius,6,false),color,undefined,undefined,glow);
}
function warScytheBlade(){
 const outer=new T.CubicBezierCurve(new T.Vector2(-.045,.03),new T.Vector2(.32,.36),new T.Vector2(.94,.32),new T.Vector2(1.06,-.45));
 const inner=new T.CubicBezierCurve(new T.Vector2(.03,-.04),new T.Vector2(.45,.12),new T.Vector2(.80,.01),new T.Vector2(1.06,-.45));
 const p=[],c=[],ix=[],steps=32,section=[0,.18,.70,.90,1],tints=[0x77838f,0x535e70,0x303849,0xadb7c0,0xd2d7da];
 // Forged ridge on both faces, tapering into a genuinely thin cutting edge.
 // The silhouette and established world-space contact point remain unchanged.
 for(const face of[-1,1])for(let i=0;i<=steps;i++){
  const t=i/steps,a=outer.getPoint(t),b=inner.getPoint(t),tip=Math.pow(1-t,.45);
  for(let j=0;j<section.length;j++){
   const s=section[j],v=a.clone().lerp(b,s),depth=[.014,.030,.023,.009,.002][j]*tip;
   p.push(v.x,v.y,.0125+depth*face);const color=new T.Color(tints[j]);c.push(color.r,color.g,color.b);
  }
 }
 const rows=(steps+1)*5;
 for(let face=0;face<2;face++)for(let i=0;i<steps;i++)for(let j=0;j<4;j++){const a=face*rows+i*5+j,b=a+5;ix.push(...(face?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]));}
 for(let i=0;i<steps;i++)for(const j of[0,4]){const a=i*5+j,b=a+5;ix.push(a,a+rows,b,b,a+rows,b+rows);}
 for(let j=0;j<4;j++)ix.push(j,j+1,j+rows,j+1,j+1+rows,j+rows);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();g.name='SM_Scythe_ForgedBlade_A';return g;
}
function riftShards(){
 const outlines=[[-.11,1.4,-.76,.57,-.52,-.45,-.17,-1.2,-.03,-.35,-.22,.18,.02,.70],[.20,1.18,.62,.51,.74,-.38,.23,-1.45,.11,-.40,.25,.20,.12,.63]];
 const shapes=outlines.map(points=>{const s=new T.Shape();s.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)s.lineTo(points[i],points[i+1]);s.closePath();return s;});
 const g=new T.ExtrudeGeometry(shapes,{depth:.25,bevelEnabled:true,bevelThickness:.05,bevelSize:.035,bevelSegments:1,steps:1,curveSegments:1});g.translate(0,0,-.125);return g;
}
export function shadowFocus(id){
 const g=new T.Group();g.name='shadow-focus-'+id;
 if(id==='shadowblade'){
  g.name='SM_Weapon_WarScythe_A';
  const shaft=line(g,0x242733,[[0,-.48,.02],[0,.05,.02],[.025,.72,.02]],.030);shaft.name='SM_Scythe_BlackwoodShaft_A';
  for(const [index,base]of[-.13,.24].entries()){
   const wrap=[];for(let i=0;i<=80;i++){const t=i/80,a=t*Math.PI*12,y=base+t*.22,x=Math.max(0,y-.05)*.025/.67;wrap.push([x+Math.cos(a)*.032,y,.02+Math.sin(a)*.032]);}
   const leather=line(g,0x42414c,wrap,.0045,false,96);leather.name='SM_Scythe_LeatherBinding_'+index;
  }
  for(const [i,y]of[-.43,.55,.66].entries()){
   const collar=part(g,'scythe-collar',()=>new T.CylinderGeometry(.037,.040,.048,12),0x85919e,[Math.max(0,y-.05)*.025/.67,y,.02]);collar.name='SM_Scythe_SteelCollar_'+i;collar.material.roughness=.37;collar.material.metalness=.64;
  }
  const socket=part(g,'scythe-socket',()=>new T.CylinderGeometry(.040,.052,.15,12),0x6d7b89,[.025,.69,.02]);socket.name='SM_Scythe_BladeSocket_A';socket.material.roughness=.38;socket.material.metalness=.68;
  const blade=part(g,'war-scythe',warScytheBlade,0xffffff,[.015,.70,.02]);blade.name='SM_Scythe_ForgedBlade_A';blade.material.vertexColors=true;blade.material.roughness=.34;blade.material.metalness=.72;
  const brace=line(g,0x8895a1,[[.025,.60,.02],[.065,.70,.02],[.20,.79,.025]],.016);brace.name='SM_Scythe_SocketBrace_A';brace.material.roughness=.4;brace.material.metalness=.62;
  for(const side of[-1,1]){
   const pin=part(g,'scythe-pin',()=>new T.SphereGeometry(.018,10,6),0xa6b2ba,[.060,.72,.02+side*.045],[1,1,.45]);pin.name='SM_Scythe_Rivet_'+side;pin.material.roughness=.31;pin.material.metalness=.76;
  }
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

import * as T from './vendor/three.module.js';
import{weaponInlay,nameWeapon}from'./weapon-identity.js?v=188';
const geometries=new Map(),materials=new Map();
function part(p,color,pos,size,type='sphere',glow=false){
 if(!geometries.has(type))geometries.set(type,type==='rock'?new T.DodecahedronGeometry(1,1):type==='box'?new T.BoxGeometry(2,2,2):type==='cone'?new T.ConeGeometry(1,2,12):type==='barrel'?new T.CylinderGeometry(.88,1,2,10):type==='hoop'?new T.TorusGeometry(1,.055,5,12):new T.SphereGeometry(1,16,12));
 const key=color+':'+glow;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.62,metalness:.08,emissive:glow?color:0,emissiveIntensity:glow?.6:0}));
 const m=new T.Mesh(geometries.get(type),materials.get(key));m.position.set(...pos);m.scale.set(...size);m.castShadow=m.receiveShadow=true;p.add(m);return m;
}
const joint=(p,x,y,z)=>{const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;};
function eye(p,x,y,z){part(p,0x122e38,[x,y,z],[.07,.08,.05]);part(p,0xd4ffff,[x-.018,y+.025,z+.037],[.018,.019,.01], 'sphere',true);}
export function makeCoastEnemy(kind){
 const g=new T.Group(),r=new T.Group();g.add(r);const d=g.userData={kind,rig:r,coastModel:true,legs:[],claws:[],tips:[],phase:0};
 if(kind==='foamling'){
  d.body=part(r,0x7fbfbf,[0,.46,0],[.43,.48,.4]);part(r,0xd5e8d6,[0,.22,.13],[.40,.18,.32]);for(const s of[-1,1])eye(r,s*.13,.54,.36);part(r,0x9cdddd,[.13,.91,-.05],[.10,.25,.10],'cone');
 }else if(kind==='tidecrab'||kind==='wreckwarden'){
  const boss=kind==='wreckwarden';d.bossModel=boss;d.coastBoss=boss;if(boss)r.scale.setScalar(2.15);
  part(r,boss?0x687e7c:0xb66c57,[0,.49,0],[.60,.37,.63]);part(r,0xd2a77b,[0,.35,.41],[.39,.19,.29]);
  for(const s of[-1,1]){const stalk=joint(r,s*.21,.65,.4);part(stalk,0x8b8065,[0,.08,0],[.04,.17,.04]);eye(stalk,0,.24,.01);
   for(let i=0;i<3;i++){const leg=joint(r,s*.48,.35,.36-i*.34);const upper=part(leg,boss?0x6c8d85:0xc38965,[s*.25,-.05,0],[.32,.065,.07]);upper.rotation.z=-s*.28;const toe=part(leg,0x3b565d,[s*.51,-.22,.03],[.065,.22,.065]);toe.rotation.z=-s*.5;d.legs.push(leg);}
   const claw=joint(r,s*.42,.43,.46);part(claw,boss?0x91aea3:0xcf9b75,[s*.13,.0,.38],[.20,.17,.39]);const palm=joint(claw,s*.2,0,.68);part(palm,boss?0x98b6a8:0xd9a477,[s*.12,0,.19],[.16,.18,.31]);const tip=joint(palm,-s*.10,0,.03);part(tip,0x587c80,[-s*.05,0,.23],[.10,.13,.27]);d.claws.push(claw);d.tips.push(tip);
  }
  if(boss){d.shell=joint(r,0,.66,-.17);part(d.shell,0x625c50,[0,.39,-.08],[.71,.42,.88]);for(const s of[-1,1]){const side=part(d.shell,0x8c7862,[s*.59,.6,-.04],[.08,.19,.86],'box');side.rotation.z=-s*.2;}for(let i=0;i<4;i++)part(d.shell,0xa99270,[0,.72,-.6+i*.36],[.53,.04,.06],'box');part(d.shell,0x494a42,[0,1.02,-.18],[.05,.74,.05],'box');const sail=part(d.shell,0xbcc4b3,[.28,1.22,-.18],[.28,.36,.018],'box');sail.rotation.y=.2;d.sail=sail;part(d.shell,0x88d4cf,[0,.43,.72],[.16,.14,.10],'sphere',true);}
 }else if(kind==='reefturtle'){
  part(r,0x739789,[0,.57,0],[.66,.41,.82]);d.shell=part(r,0x3b6665,[0,.78,-.06],[.68,.4,.76]);for(let i=0;i<5;i++)part(r,0x92b6a5,[(i%2?1:-1)*.19,.94+i%2*.07,-.46+i*.22],[.18,.19,.14],'cone');d.head=joint(r,0,.49,.64);part(d.head,0xa7b990,[0,0,.23],[.27,.22,.32]);for(const s of[-1,1])eye(d.head,s*.17,.07,.45);for(const s of[-1,1])for(const z of[-.48,.46]){const leg=joint(r,s*.45,.3,z);part(leg,0x8da891,[s*.21,-.12,.04],[.31,.13,.21]);d.legs.push(leg);}
 }else if(kind==='jellyseer'){
  d.body=part(r,0x79c4d1,[0,1.02,0],[.51,.40,.51]);part(r,0xc4eff0,[0,.88,0],[.43,.16,.43],'sphere',true);for(const s of[-1,1])eye(r,s*.17,1.08,.46);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;let p=joint(r,Math.sin(a)*.3,.86,Math.cos(a)*.3);for(let k=0;k<3;k++){const seg=joint(p,0,-.21,0);part(seg,0x98cbd3,[0,-.08,0],[.047,.17,.047]);d.tips.push(seg);p=seg;}}
 }else{
  part(r,0xc59b83,[0,.36,0],[.4,.23,.4]);for(let i=0;i<5;i++){const a=i*Math.PI*2/5,leg=joint(r,0,.3,0);leg.rotation.y=a;part(leg,0xba847e,[0,-.05,.43],[.18,.14,.48]);part(leg,0xe0bfa0,[0,.07,.52],[.04,.05,.28]);d.legs.push(leg);}part(r,0x93d8ce,[0,.56,0],[.18,.14,.18],'sphere',true);for(const s of[-1,1])eye(r,s*.13,.40,.30);
 }
 d.arms=[...d.claws,...d.tips];d.cap=d.body;return g;
}
export function animateCoastEnemy(g,t,speed,attack,dt){
 const d=g.userData,r=d.rig,s=Math.min(1,speed/3);d.phase+=speed*dt*3;const p=d.phase;
 const target=attack>0?Math.min(1,1-attack/1.2):0;d.wind=(d.wind||0)+(target-(d.wind||0))*(1-Math.exp(-dt*10));
 if(d.oldAttack>0&&attack<=0)d.release=.35;d.oldAttack=attack;d.release=Math.max(0,(d.release||0)-dt);const hit=Math.sin((d.release||0)/.35*Math.PI);
 let wind=d.wind,strike=hit;if(d.coastBoss){wind=d.bossStage==='wind'?d.windProgress:d.bossStage==='strike'?1-d.strikeProgress:0;strike=d.bossStage==='strike'?Math.sin(Math.PI*d.strikeProgress):0;}
 r.position.y=Math.abs(Math.sin(p))*.025*s-wind*.05;r.rotation.z=Math.sin(p)*.035*s;
 if(d.kind==='foamling'){r.position.y+=Math.max(0,Math.sin(p))*.18*s;d.body.scale.set(.43*(1+wind*.16-hit*.08),.48*(1-wind*.20+hit*.16),.4);}
 else if(d.kind==='jellyseer'){r.position.y=.1+Math.sin(t*2.2)*.14;d.body.scale.set(.51+Math.sin(t*3)*.025,.4-Math.sin(t*3)*.035,.51+Math.sin(t*3)*.025);d.tips.forEach((o,i)=>o.rotation.set(Math.sin(t*3-i*.6)*.2,0,Math.cos(t*2-i*.7)*.12));}
 else if(d.kind==='tidestar'){d.legs.forEach((o,i)=>o.rotation.x=Math.sin(p+i*1.25)*.18*s-wind*.3);r.rotation.y=Math.sin(t)*.05;}
 else{d.legs.forEach((o,i)=>{const side=i<d.legs.length/2?-1:1,phase=p+(i%3)*2.1+(side>0?Math.PI:0);o.rotation.set(0,Math.sin(phase)*.26*s,side*Math.max(0,Math.cos(phase))*.18*s);});d.claws.forEach((o,i)=>{const side=i?1:-1;o.rotation.set(-wind*.2,side*(wind*.4-strike*.55),0);});d.tips.forEach((o,i)=>o.rotation.y=(i?1:-1)*(wind*.6-strike*.28));if(d.head)d.head.rotation.x=-wind*.48+strike*.35;if(d.sail)d.sail.rotation.y=.2+Math.sin(t*2)*.1;}
}
export function coastProp(parent,index,rnd){
 if(index%17===0){const hull=part(parent,0x665b4e,[0,.40,0],[1.6,.4,.7]);hull.rotation.y=rnd()*6;for(const s of[-1,1])part(hull,0x9e8b70,[s*.0,.75,s*.7],[.75,.12,.08],'box');part(parent,0x766c55,[0,1.1,0],[.065,.8,.065],'box');return 1.5;}
 if(index%3===0){part(parent,0x789088,[0,.55,0],[.74,.56,.68],'rock');part(parent,0xa7b5a2,[.2,.9,.1],[.28,.28,.3],'rock');return .7;}
 // Ordinary dry-land props keep the same .35m footprint and random stream.
 // Only one in four is a lone post; the rest read as fishing/cargo remnants.
 const kind=index%4;parent.userData.coastPropKind=['mooring','cask','net-roll','cargo-sack'][kind];
 if(kind===0){part(parent,0x746b57,[0,.56,0],[.16,.56,.16],'box');const ring=part(parent,0x9f997f,[0,.91,0],[.22,.22,.22],'hoop');ring.rotation.x=Math.PI/2;}
 else if(kind===1){part(parent,0x766c55,[0,.43,0],[.27,.43,.27],'barrel');for(const y of[.16,.68])part(parent,0x506568,[0,y,0],[.27,.27,.27],'hoop').rotation.x=Math.PI/2;}
 else if(kind===2){part(parent,0x59756d,[0,.22,0],[.29,.22,.25]);for(const y of[.15,.28])part(parent,0x9f997f,[0,y,0],[.27,.27,.27],'hoop').rotation.x=Math.PI/2;}
 else{part(parent,0x9c987d,[0,.35,0],[.27,.35,.25]);part(parent,0x746b57,[0,.70,0],[.065,.075,.065],'barrel');}
 return .35;
}
// Smooth shaft and forged, swept tines keep the silhouette readable without white blocks.
let harpoonTemplate;
function harpoonBinding(height,turns){
 const geo=new T.CylinderGeometry(.034,.034,height,12,turns*3),p=geo.attributes.position,colors=[],base=new T.Color(0x294e5b),seam=new T.Color(0x152e37),worn=new T.Color(0x718984),color=new T.Color();
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),v=(p.getY(i)/height+.5),angle=Math.atan2(z,x),phase=T.MathUtils.euclideanModulo(v*turns-angle/(Math.PI*2),1);
  const rim=T.MathUtils.smoothstep(phase,.68,.87)*(1-T.MathUtils.smoothstep(phase,.93,1)),end=T.MathUtils.smoothstep(v,0,.035)*(1-T.MathUtils.smoothstep(v,.965,1)),r=Math.hypot(x,z);
  if(r>.01){const radius=(.030+.004*end)+.002*rim*end;p.setX(i,x/r*radius);p.setZ(i,z/r*radius);}
  color.copy(base).lerp(seam,T.MathUtils.smoothstep(phase,.90,1)*.68).lerp(worn,rim*.32);colors.push(color.r,color.g,color.b);
 }
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();geo.name='SM_Harpoon_ContinuousSailclothBinding';return geo;
}
function harpoonSocket(){
 // A single rebated sleeve receives both the wooden haft and the forged fork;
 // the shoulder is integral metal, not another disconnected decorative ring.
 const profile=[[0,-.07],[.034,-.07],[.040,-.060],[.045,-.035],[.057,-.026],[.057,.015],[.047,.035],[.041,.07],[0,.07]];
 const geo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),12);geo.name='SM_Harpoon_RebatedForkSocket';return geo;
}
export function makeHarpoon(){
 if(harpoonTemplate)return harpoonTemplate.clone();
 const g=new T.Group(),wood=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.78}),steel=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:.64,roughness:.36}),edge=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:.70,roughness:.31}),socketMetal=new T.MeshStandardMaterial({color:0x617781,metalness:.65,roughness:.43}),brass=new T.MeshStandardMaterial({color:0x887354,metalness:.55,roughness:.52}),wrap=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.92});
 const cylinder=(r,h,z,m,segments=1)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,12,segments),m);o.rotation.x=Math.PI/2;o.position.z=z;g.add(o);return o;};
 const shaft=cylinder(.029,2.16,.33,wood,8);shaft.name='SM_Harpoon_SaltedWoodHaft';shaft.userData.identityDetail=true;
 const positions=shaft.geometry.attributes.position,grain=[],woodDark=new T.Color(0x473f36),woodLight=new T.Color(0x82725a),tint=new T.Color();
 for(let i=0;i<positions.count;i++){
  const a=Math.atan2(positions.getZ(i),positions.getX(i)),fiber=.5+.5*Math.sin(a*7+positions.getY(i)*1.7);
  // The forward haft supports the wider fork, while both hand contacts and the
  // cloth bindings retain their original diameter and longitudinal placement.
  const swell=1+.003/.029*T.MathUtils.smoothstep(positions.getY(i)+.33,.55,1.24);
  positions.setX(i,positions.getX(i)*swell);positions.setZ(i,positions.getZ(i)*swell);
  tint.copy(woodDark).lerp(woodLight,.25+fiber*.48);grain.push(tint.r,tint.g,tint.b);
 }
 shaft.geometry.setAttribute('color',new T.Float32BufferAttribute(grain,3));shaft.geometry.computeVertexNormals();
 for(const [index,height,z,turns]of[[0,.54,-.08,8],[1,.30,.34,5]]){
  const grip=new T.Mesh(harpoonBinding(height,turns),wrap);grip.rotation.x=Math.PI/2;grip.position.z=z;grip.name='SM_Harpoon_SailclothGrip_'+index;grip.userData.identityDetail=true;g.add(grip);
 }
 const socket=new T.Mesh(harpoonSocket(),socketMetal);socket.rotation.x=Math.PI/2;socket.position.z=1.32;socket.name='SM_Harpoon_ForkSocket';socket.userData.identityDetail=true;g.add(socket);
 const heel=cylinder(.038,.10,-.73,brass);heel.name='SM_Harpoon_ClosedHeel';heel.userData.identityDetail=true;
 const blade=(points,x,z,m,name)=>{
  const shape=new T.Shape(),tip=Math.max(...points.map(p=>p[1])),last=points.at(-1),first=points[0];shape.moveTo((last[0]+first[0])*.5,(last[1]+first[1])*.5);
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(a[1]===tip){shape.lineTo(...a);shape.lineTo((a[0]+b[0])*.5,(a[1]+b[1])*.5);}else shape.quadraticCurveTo(...a,(a[0]+b[0])*.5,(a[1]+b[1])*.5);}
  shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.036,bevelEnabled:true,bevelThickness:.008,bevelSize:.006,bevelSegments:2,steps:1,curveSegments:4});geo.translate(0,0,-.018);
  const p=geo.attributes.position,colors=[],body=new T.Color(m===edge?0x738e93:0x3c626e),ground=new T.Color(0xc8d6d1),tint=new T.Color();
  for(let i=0;i<p.count;i++){
   const towardTip=T.MathUtils.smoothstep(p.getY(i),tip*.50,tip),bevel=1-T.MathUtils.smoothstep(Math.abs(p.getZ(i)),.0175,.026);
   p.setZ(i,p.getZ(i)*(1-.78*towardTip));tint.copy(body).lerp(ground,Math.max(bevel*.83,towardTip*.7));colors.push(tint.r,tint.g,tint.b);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.rotateX(Math.PI/2);geo.computeVertexNormals();geo.name=name;const o=new T.Mesh(geo,m);o.name=name;o.userData.identityDetail=true;o.position.set(x,0,z);o.scale.x=.78;g.add(o);return o;
 };
 blade([[-.056,0],[-.078,.14],[0,.39],[.078,.14],[.056,0]],0,1.36,edge,'SM_Harpoon_CentralGroundPoint');
 for(const side of[-1,1])blade([[0,0],[side*.15,.075],[side*.245,.25],[side*.21,.445],[side*.145,.28],[side*.10,.15],[-side*.020,.07]],0,1.20,steel,'SM_Harpoon_CurvedTine_'+side);
 const spine=new T.Mesh(new T.CylinderGeometry(.011,.022,.25,8),socketMetal);spine.rotation.x=Math.PI/2;spine.position.set(0,.028,1.505);spine.name='SM_Harpoon_ForgedCentralRidge';spine.userData.identityDetail=true;g.add(spine);
 weaponInlay(g,'SM_Harpoon_TidalNeckEngraving',[[[-.024,.029,1.385],[-.037,.029,1.425],[-.016,.029,1.46]],[[.020,.029,1.405],[.042,.029,1.45],[.015,.029,1.492]]],0xbba477,.0023,.40);
 g.name='Tide_forged_harpoon';nameWeapon(g,'tide','harpoon');g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});harpoonTemplate=g;return g.clone();
}

import * as T from './vendor/three.module.js';
import{weaponInlay,nameWeapon}from'./weapon-identity.js?v=190';
import{form,surface,tube,oval,face,joint as organicJoint,leg,stepLeg}from'./creature-forms.js?v=190';
const geometries=new Map(),materials=new Map();
function part(p,color,pos,size,type='sphere',glow=false){
 if(!geometries.has(type))geometries.set(type,type==='rock'?new T.DodecahedronGeometry(1,1):type==='box'?new T.BoxGeometry(2,2,2):type==='cone'?new T.ConeGeometry(1,2,12):type==='barrel'?new T.CylinderGeometry(.88,1,2,10):type==='hoop'?new T.TorusGeometry(1,.055,5,12):new T.SphereGeometry(1,16,12));
 const key=color+':'+glow;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.62,metalness:.08,emissive:glow?color:0,emissiveIntensity:glow?.6:0}));
 const m=new T.Mesh(geometries.get(type),materials.get(key));m.position.set(...pos);m.scale.set(...size);m.castShadow=m.receiveShadow=true;p.add(m);return m;
}
const joint=(p,x,y,z)=>{const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;};
function eye(p,x,y,z){part(p,0x122e38,[x,y,z],[.07,.08,.05]);part(p,0xd4ffff,[x-.018,y+.025,z+.037],[.018,.019,.01], 'sphere',true);}
function makeCoastCreature(kind){
 const g=new T.Group(),r=organicJoint(g),d=g.userData={kind,rig:r,coastModel:true,organicModel:true,legs:[],claws:[],tips:[],arms:[],phase:0,combatHeight:{foamling:1.16,tidecrab:.97,reefturtle:1.2,jellyseer:1.42,tidestar:.70}[kind]};
 if(kind==='foamling'){
  d.body=form(r,'Foamling_ContinuousDroplet',()=>[surface(0x85bfb9,[[.018,.20,.19],[.08,.36,.30],[.22,.43,.37],[.43,.40,.37],[.63,.35,.31],[.81,.23,.22,.03,-.015],[.98,.10,.10,.10,-.02],[1.10,.045,.038,.12,-.05],[1.16,.001,.001,.09,-.06]],{sides:22,flute:.028,shade:(c,x,y)=>c.lerp(new T.Color(0xd3e5d2),1-T.MathUtils.smoothstep(y,.1,.39))})]);
  d.head=organicJoint(r,0,.52,.34);form(d.head,'Foamling_Face',()=>[...face(0xc7eece,0,.005,.13),oval(0x447b79,0,-.10,.025,.060,.021,.014)]);
 }else if(kind==='tidecrab'){
  form(r,'Tidecrab_CarvedShell',()=>[surface(0xae7059,[[-.65,.04,.05,0,.40],[-.52,.37,.23,0,.47],[-.28,.57,.33,0,.48],[.06,.59,.32,0,.48],[.34,.44,.23,0,.45],[.51,.28,.16,0,.41],[.63,.09,.055,0,.38]],{axis:'z',sides:20,shade:(c,x,y,z)=>c.lerp(new T.Color(y<.36?0x624f45:0xc88d68),y<.36?.55:.28+.1*Math.sin(z*17))}),...[-1,1].flatMap(s=>[tube(0x9a8e6d,[[s*.21,.62,.37],[s*.225,.75,.40],[s*.24,.87,.42]],[.046,.037,.038],{steps:8})]),...face(0xe6e1b2,.875,.439,.24),tube(0x523f36,[[-.11,.365,.585],[0,.342,.63],[.11,.365,.585]],[.016,.020,.016],{steps:8})]);
  for(const side of[-1,1]){
   for(let i=0;i<3;i++)d.legs.push(leg(r,'TidecrabLeg',{x:side*.41,y:.36,z:.33-i*.30,side,reach:.48,a:.33,b:.32,width:.066,color:0xb9815d,foot:0x40565a,phase:(i%2+(side>0?1:0))*Math.PI}));
   const claw=organicJoint(r,side*.41,.44,.39);form(claw,'Tidecrab_ClawArm_'+side,()=>[tube(0xc38a66,[[0,0,0],[side*.11,-.025,.18],[side*.19,.015,.40],[side*.21,.04,.62]],[.115,.12,.18,.13],{steps:13,sides:10}),tube(0xd5a573,[[side*.22,.04,.54],[side*.35,.055,.77],[side*.31,.08,.99],[side*.18,.09,1.09]],[.12,.105,.062,.002],{steps:13,sides:8})]);
   const finger=organicJoint(claw,side*.10,.035,.55);form(finger,'Tidecrab_MovablePincer_'+side,()=>[tube(0x7d6654,[[0,0,0],[-side*.035,.02,.20],[side*.035,.044,.37],[side*.09,.055,.48]],[.085,.071,.048,.002],{steps:10})]);d.claws.push(claw);d.tips.push(finger);
  }
 }else if(kind==='reefturtle'){
  form(r,'Reefturtle_Plastron',()=>[surface(0x8ba18b,[[-.77,.06,.06,0,.35],[-.59,.46,.21,0,.40],[-.18,.63,.24,0,.41],[.28,.58,.23,0,.39],[.61,.26,.15,0,.40]],{axis:'z',sides:20}),tube(0x798d77,[[0,.33,-.61],[0,.21,-.82],[0,.18,-.90]],[.075,.05,.002],{steps:7})]);
  d.shell=form(r,'Reefturtle_ContinuousScutes',()=>[surface(0x456f68,[[.49,.64,.79],[.57,.68,.79],[.72,.65,.74],[.85,.54,.63],[.94,.36,.47],[.985,.16,.26],[.995,.015,.10]],{sides:24,flute:.025,shade:(c,x,y,z)=>{const seam=Math.min(Math.abs(Math.sin(z*10+x*4)),Math.abs(Math.sin(x*10)));return c.lerp(new T.Color(seam<.12?0x304e4a:0x94ac8d),seam<.12?.38:(y-.49)*.56);}}),tube(0x809584,[[0,1.01,-.36],[.02,1.105,-.19],[-.015,1.115,.015],[.018,1.025,.27]],[.09,.075,.065,.035],{sides:8,steps:11}),tube(0x718b7c,[[-.28,.88,-.25],[-.30,.98,-.02],[-.27,.93,.18]],[.07,.07,.018],{sides:7,steps:8}),tube(0x8e9e86,[[.30,.86,-.12],[.29,.98,.10],[.26,.88,.28]],[.065,.065,.018],{sides:7,steps:8})]);
  d.head=organicJoint(r,0,.42,.57);form(d.head,'Reefturtle_NeckAndHead',()=>[surface(0xa8b68c,[[-.10,.14,.14],[.09,.18,.17],[.27,.26,.21],[.43,.225,.17],[.54,.12,.10]],{axis:'z',sides:16}),...face(0xe2d9a0,.08,.433,.177),tube(0x536b55,[[-.13,-.074,.42],[0,-.089,.505],[.13,-.074,.42]],[.008,.010,.008],{steps:8})]);
  for(const side of[-1,1])for(const z of[-.43,.39])d.legs.push(leg(r,'Reefturtle_Flipper',{x:side*.43,y:.29,z,side,reach:.21,a:.22,b:.25,width:.105,color:0x7e9985,foot:0x718772,phase:side*z>0?0:Math.PI}));
 }else if(kind==='jellyseer'){
  d.body=form(r,'Jellyseer_ContinuousBell',()=>[surface(0x84bac5,[[.81,.32,.32],[.83,.48,.48],[.89,.52,.52],[1.03,.47,.47],[1.22,.36,.36],[1.37,.19,.19],[1.42,.015,.015]],{sides:24,flute:.032,shade:(c,x,y)=>c.lerp(new T.Color(0xd1e6db),1-T.MathUtils.smoothstep(y,.84,1.05))}),...face(0xc6f4e5,1.06,.444,.17)]);
  d.tentacles=form(r,'Jellyseer_ContinuousTentacles',()=>Array.from({length:6},(_,i)=>{const a=i*Math.PI/3,x=Math.sin(a)*.31,z=Math.cos(a)*.31;return tube(i%2?0x85b9c2:0xb0d1cb,[[x,.86,z],[x*1.15,.62,z*1.15],[x*.86,.39,z*.86],[x*1.09,.16,z*1.09],[x*.9,.055,z*.9]],[.046,.039,.030,.018,.003],{steps:17,sides:6,flexible:(px,y,pz)=>[Math.max(0,(.84-y)/.80),a-y*4,.065,.045,.025]});}));
  d.attackSocket=organicJoint(r,0,.88,.33);
 }else{
  // A single continuous radial skin connects all five arms to the central disc.
  d.body=form(r,'Tidestar_ContinuousFiveArms',()=>{
   const positions=[],indices=[],sides=60,rows=[.28,.60,1],colors=[],f=[],bend=[],color=new T.Color(),base=new T.Color(0xb78573),ridge=new T.Color(0xe0ba93);
   const vertex=(layer,u,a)=>{const arm=(.5+.5*Math.cos(a*5))**3,r=(.30+.61*arm)*u,y=layer?.16+(.37-.19*u)*Math.sin((1-u)*Math.PI/2)+.035*arm*u:.12;positions.push(Math.sin(a)*r,y,Math.cos(a)*r);color.copy(base).lerp(ridge,layer?(.3+arm*.42*u):.05);colors.push(color.r,color.g,color.b);f.push(u*u*.65,a*2);bend.push(.016,.010,.04);};
   for(const layer of[0,1]){vertex(layer,0,0);for(const u of rows)for(let i=0;i<sides;i++)vertex(layer,u,i/sides*Math.PI*2);}
   const stride=1+rows.length*sides;
   for(const layer of[0,1]){
    const offset=layer*stride;
    for(let i=0;i<sides;i++){const a=offset+1+i,b=offset+1+(i+1)%sides;indices.push(...(layer?[offset,a,b]:[offset,b,a]));}
    for(let row=0;row<rows.length-1;row++)for(let i=0;i<sides;i++){const a=offset+1+row*sides+i,b=offset+1+row*sides+(i+1)%sides;indices.push(...(layer?[a,a+sides,b,b,a+sides,b+sides]:[a,b,a+sides,b,b+sides,a+sides]));}
   }
   for(let i=0;i<sides;i++){const a=1+(rows.length-1)*sides+i,b=1+(rows.length-1)*sides+(i+1)%sides;indices.push(a,b,a+stride,b,b+stride,a+stride);}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('creatureFlex',new T.Float32BufferAttribute(f,2));geo.setAttribute('creatureBend',new T.Float32BufferAttribute(bend,3));geo.setIndex(indices);geo.computeVertexNormals();return[geo,...face(0xcde8c7,.38,.305,.115),oval(0x90c4b5,0,.57,0,.14,.13,.14)];
  });d.attackSocket=organicJoint(r,0,.48,.24);
 }
 d.arms=[...d.claws,...d.tips];d.cap=d.body;animateCoastEnemy(g,0,0,0,0);return g;
}
export function makeCoastEnemy(kind){
 if(kind!=='wreckwarden')return makeCoastCreature(kind);
 const g=new T.Group(),r=new T.Group();g.add(r);const d=g.userData={kind,rig:r,coastModel:true,legs:[],claws:[],tips:[],phase:0};
 {
  const boss=kind==='wreckwarden';d.bossModel=boss;d.coastBoss=boss;if(boss)r.scale.setScalar(2.15);
  part(r,boss?0x687e7c:0xb66c57,[0,.49,0],[.60,.37,.63]);part(r,0xd2a77b,[0,.35,.41],[.39,.19,.29]);
  for(const s of[-1,1]){const stalk=joint(r,s*.21,.65,.4);part(stalk,0x8b8065,[0,.08,0],[.04,.17,.04]);eye(stalk,0,.24,.01);
   for(let i=0;i<3;i++){const leg=joint(r,s*.48,.35,.36-i*.34);const upper=part(leg,boss?0x6c8d85:0xc38965,[s*.25,-.05,0],[.32,.065,.07]);upper.rotation.z=-s*.28;const toe=part(leg,0x3b565d,[s*.51,-.22,.03],[.065,.22,.065]);toe.rotation.z=-s*.5;d.legs.push(leg);}
   const claw=joint(r,s*.42,.43,.46);part(claw,boss?0x91aea3:0xcf9b75,[s*.13,.0,.38],[.20,.17,.39]);const palm=joint(claw,s*.2,0,.68);part(palm,boss?0x98b6a8:0xd9a477,[s*.12,0,.19],[.16,.18,.31]);const tip=joint(palm,-s*.10,0,.03);part(tip,0x587c80,[-s*.05,0,.23],[.10,.13,.27]);d.claws.push(claw);d.tips.push(tip);
  }
  if(boss){d.shell=joint(r,0,.66,-.17);part(d.shell,0x625c50,[0,.39,-.08],[.71,.42,.88]);for(const s of[-1,1]){const side=part(d.shell,0x8c7862,[s*.59,.6,-.04],[.08,.19,.86],'box');side.rotation.z=-s*.2;}for(let i=0;i<4;i++)part(d.shell,0xa99270,[0,.72,-.6+i*.36],[.53,.04,.06],'box');part(d.shell,0x494a42,[0,1.02,-.18],[.05,.74,.05],'box');const sail=part(d.shell,0xbcc4b3,[.28,1.22,-.18],[.28,.36,.018],'box');sail.rotation.y=.2;d.sail=sail;part(d.shell,0x88d4cf,[0,.43,.72],[.16,.14,.10],'sphere',true);}
 }
 d.arms=[...d.claws,...d.tips];d.cap=d.body;return g;
}
export function animateCoastEnemy(g,t,speed,attack,dt){
 const d=g.userData,r=d.rig,s=Math.min(1,speed/3);d.phase+=speed*dt*3;const p=d.phase;
 const target=attack>0?Math.min(1,1-attack/1.2):0;d.wind=(d.wind||0)+(target-(d.wind||0))*(1-Math.exp(-dt*10));
 if(d.oldAttack>0&&attack<=0)d.release=.35;d.oldAttack=attack;d.release=Math.max(0,(d.release||0)-dt);const hit=Math.sin((d.release||0)/.35*Math.PI);
 let wind=d.wind,strike=hit;if(d.coastBoss){wind=d.bossStage==='wind'?d.windProgress:d.bossStage==='strike'?1-d.strikeProgress:0;strike=d.bossStage==='strike'?Math.sin(Math.PI*d.strikeProgress):0;}
 if(d.organicModel){
  d.strike=(d.strike||0)+(hit-(d.strike||0))*(1-Math.exp(-dt*12));strike=d.strike;
  r.position.set(0,Math.abs(Math.sin(p))*.010*s-wind*.018,-wind*.016+strike*.025);r.rotation.set(wind*.025-strike*.04,0,Math.sin(p)*.014*s);
  if(d.kind==='foamling'){
   const hop=Math.max(0,Math.sin(p))*.12*s,squash=Math.sin(p)*.045*s-wind*.10+strike*.07;
   r.position.y=hop;d.body.scale.set(1-squash*.45,1+squash,1-squash*.35);d.head.position.set(0,.52*(1+squash),.34*(1-squash*.35));d.head.rotation.x=wind*.06-strike*.09;r.rotation.z=Math.sin(p-.4)*.035*s;
  }else if(d.kind==='jellyseer'){
   const pulse=Math.sin(t*2.3),breath=.025*pulse+wind*.07-strike*.045;r.position.y=.08+Math.sin(t*1.7)*.08;
   d.body.scale.set(1+breath,1-breath*.65,1+breath);d.body.position.y=.83*breath*.65;d.attackSocket.position.z=.33+strike*.045;
  }else if(d.kind==='tidestar'){
   r.position.y=0;r.rotation.set(0,Math.sin(t*.55)*.022*s,0);d.body.scale.set(1-wind*.045,1+wind*.08-strike*.05,1-wind*.045);
  }else{
   for(const l of d.legs)stepLeg(l,r,p,s*(1-wind*.78),{travel:d.kind==='reefturtle'?.075:.11,lift:d.kind==='reefturtle'?.055:.08});
   d.claws.forEach((o,i)=>{const side=i?1:-1;o.rotation.set(-wind*.12+strike*.09,side*(wind*.25-strike*.30),0);});d.tips.forEach((o,i)=>o.rotation.y=(i?1:-1)*(-wind*.22+strike*.13));
   if(d.head){d.head.position.z=.57-wind*.095+strike*.10;d.head.rotation.x=-wind*.12+strike*.08;d.head.rotation.y=Math.sin(t*.8)*.025*(1-s);}
  }
  return;
 }
 r.position.y=Math.abs(Math.sin(p))*.025*s-wind*.05;r.rotation.z=Math.sin(p)*.035*s;
 d.legs.forEach((o,i)=>{const side=i<d.legs.length/2?-1:1,phase=p+(i%3)*2.1+(side>0?Math.PI:0);o.rotation.set(0,Math.sin(phase)*.26*s,side*Math.max(0,Math.cos(phase))*.18*s);});d.claws.forEach((o,i)=>{const side=i?1:-1;o.rotation.set(-wind*.2,side*(wind*.4-strike*.55),0);});d.tips.forEach((o,i)=>o.rotation.y=(i?1:-1)*(wind*.6-strike*.28));if(d.head)d.head.rotation.x=-wind*.48+strike*.35;if(d.sail)d.sail.rotation.y=.2+Math.sin(t*2)*.1;
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

import {shadowFocus} from './shadow-gear.js?v=193';
import{weaponGesture,shotStarted,crossbowMechanism}from'./weapon-performance.js?v=193';
import{miasmaLantern}from'./mirage-appearance.js?v=193';
import{weaponInlay,nameWeapon,recessedBarrelGeometry}from'./weapon-identity.js?v=193';
import * as T from './vendor/three.module.js';
// Shared smooth geometry: detail is concentrated on the two heroes, not multiplied across the forest.
const geometries=new Map(),materials=new Map();
let woodGrain;
function material(color,metal=0,emission=0){const key=[color,metal,emission].join(':');if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,metalness:metal,roughness:metal?.38:.72,emissive:color,emissiveIntensity:emission}));return materials.get(key);}
function part(parent,kind,args,color,pos=[0,0,0],scale=[1,1,1],metal=0,emission=0){const key=kind+JSON.stringify(args);if(!geometries.has(key))geometries.set(key,new T[kind](...args));const m=new T.Mesh(geometries.get(key),material(color,metal,emission));m.position.set(...pos);m.scale.set(...scale);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
const ell=(p,c,pos,scale,metal=0,emission=0)=>part(p,'SphereGeometry',[1,20,14],c,pos,scale,metal,emission);
const block=(p,c,pos,scale,metal=0)=>part(p,'BoxGeometry',[1,1,1],c,pos,scale,metal);
const tube=(p,c,pos,scale,metal=0)=>part(p,'CylinderGeometry',[1,1,1,16],c,pos,scale,metal);
const joint=(p,pos)=>{const g=new T.Group();g.position.set(...pos);p.add(g);return g;};
// Beveled, tapered sections retain the original weapon-space grip and outlet.
function weaponHull(parent,name,rings,color,metal=0,directions){
 const key=name+JSON.stringify(rings);
 if(!geometries.has(key)){
  const p=[],uv=[],ix=[],edge=[[-.35,-.5],[.35,-.5],[.5,-.32],[.5,.32],[.35,.5],[-.35,.5],[-.5,.32],[-.5,-.32]];
  for(let i=0;i<rings.length;i++){const[x,y,z,w,h]=rings[i],axis=directions?.[i];for(const[j,[u,v]]of edge.entries()){p.push(x+u*w*(axis?.x??1),y+v*h,z+u*w*(axis?.z??0));uv.push(j/8,i/(rings.length-1));}}
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;ix.push(a,b,a+8,b,b+8,a+8);}
  for(const end of[0,rings.length-1]){const n=p.length/3;p.push(...rings[end].slice(0,3));uv.push(.5,.5);for(let j=0;j<8;j++){const a=end*8+j,b=end*8+(j+1)%8;ix.push(...(end?[n,a,b]:[n,b,a]));}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();geo.name=name;geometries.set(key,geo);
 }
 const mesh=new T.Mesh(geometries.get(key),material(color,metal));mesh.name=name;mesh.userData.identityDetail=true;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function weaponLine(parent,name,points,radius,color,metal=0){const mesh=part(parent,'TubeGeometry',[new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(6,points.length*3),radius,6,false],color,undefined,undefined,metal);mesh.name=name;mesh.userData.identityDetail=true;return mesh;}
function woodFinish(mesh){
 const key='wood-finish:'+mesh.material.color.getHex();
 if(!materials.has(key)){
  if(!woodGrain){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const grain=Math.sin(x*.73+Math.sin(y*.085)*.72),fine=Math.sin(x*2.1+y*.041),c=Math.round(220+grain*19+fine*8),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;}woodGrain=new T.DataTexture(data,size,size,T.RGBAFormat);woodGrain.name='TX_Weapon_Leafwood_Grain';woodGrain.colorSpace=T.SRGBColorSpace;woodGrain.wrapS=woodGrain.wrapT=T.RepeatWrapping;woodGrain.magFilter=T.LinearFilter;woodGrain.minFilter=T.LinearMipmapLinearFilter;woodGrain.generateMipmaps=true;woodGrain.needsUpdate=true;}
  const m=mesh.material.clone();m.name='MAT_Weapon_Leafwood';m.map=woodGrain;m.roughness=.76;m.metalness=0;m.userData.identityFinish=true;materials.set(key,m);
 }mesh.material=materials.get(key);return mesh;
}
function staffShaft(parent,fire){
 const key=fire?'emberwood-shaft':'nightfall-shaft';
 if(!geometries.has(key)){
  const profile=[[0,-.39],[.024,-.39],[.027,-.36],[.025,-.205]];
  for(let i=0;i<=24;i++){const y=-.19+i*.36/24;profile.push([.027+(i%4===0?-.002:i%4===2?.002:0),y]);}
  profile.push([.025,.20],[.026,.49],[.024,.73],[.020,.91],[0,.91]);
  const geo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),16),p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const y=p.getY(i),grip=y>-.195&&y<.18,c=new T.Color(fire?(grip?0x46342a:0x705135):(grip?0x373348:0x222b40));c.multiplyScalar(.90+.10*Math.sin(i%profile.length*2.1));colors.push(c.r,c.g,c.b);}
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.name='SM_Staff_'+(fire?'Emberwood':'Nightfall')+'_CarvedShaft';geometries.set(key,geo);
 }
 if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({name:'MAT_Staff_'+key,color:0xffffff,vertexColors:true,roughness:fire?.82:.67,metalness:0}));
 const mesh=new T.Mesh(geometries.get(key),materials.get(key));mesh.name=mesh.geometry.name;mesh.position.z=.045;mesh.userData.identityDetail=true;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function forgedProng(mesh){
 const key='forged:'+mesh.name;
 if(!geometries.has(key)){
  const source=mesh.geometry,geo=source.clone(),p=geo.attributes.position,{path,tubularSegments,radialSegments}=source.parameters,colors=[];
  for(let i=0;i<p.count;i++){const t=Math.floor(i/(radialSegments+1))/tubularSegments,c=path.getPointAt(t),taper=.55+.45*Math.sin(t*Math.PI);p.setXYZ(i,c.x+(p.getX(i)-c.x)*taper,c.y+(p.getY(i)-c.y)*taper,c.z+(p.getZ(i)-c.z)*.58);const v=.67+.33*Math.abs(Math.sin(i%(radialSegments+1)/radialSegments*Math.PI*2));colors.push(v,v,v);}
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();geo.name=mesh.name;geometries.set(key,geo);
 }
 const matKey='forged:'+mesh.material.color.getHex();if(!materials.has(matKey)){const m=mesh.material.clone();m.vertexColors=true;m.roughness=.31;m.userData.identityFinish=true;materials.set(matKey,m);}
 mesh.geometry=geometries.get(key);mesh.material=materials.get(matKey);return mesh;
}
function refineMoonBlade(mesh){
 const key='ground-moon-blade';
 if(!geometries.has(key)){
  const source=mesh.geometry,old=source.attributes.position,oldUV=source.attributes.uv,positions=[],uv=[],edge=source.parameters.shapes.extractPoints(10).shape,colors=[];
  // Extruded caps contain only contour vertices. Add one interior sample per
  // cap triangle so the blade has a real spine instead of thinning every face.
  const push=i=>{positions.push(old.getX(i),old.getY(i),old.getZ(i));uv.push(oldUV.getX(i),oldUV.getY(i));};
  for(let i=0;i<old.count;i+=3){
   if(Math.abs(old.getZ(i)-old.getZ(i+1))<1e-8&&Math.abs(old.getZ(i)-old.getZ(i+2))<1e-8){
    const center=[0,0,0],tex=[0,0];for(let j=0;j<3;j++){center[0]+=old.getX(i+j)/3;center[1]+=old.getY(i+j)/3;center[2]+=old.getZ(i+j)/3;tex[0]+=oldUV.getX(i+j)/3;tex[1]+=oldUV.getY(i+j)/3;}
    for(let j=0;j<3;j++){push(i+j);push(i+(j+1)%3);positions.push(...center);uv.push(...tex);}
   }else for(let j=0;j<3;j++)push(i+j);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i);let distance=Infinity;
   for(let j=0;j<edge.length;j++){const a=edge[j],b=edge[(j+1)%edge.length],dx=b.x-a.x,dy=b.y-a.y,t=T.MathUtils.clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);distance=Math.min(distance,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}
   const spine=T.MathUtils.smoothstep(distance,.002,.028);p.setZ(i,.009+(p.getZ(i)-.009)*(.24+.76*spine));const c=.98-.38*spine;colors.push(c,c,c);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();geo.name='SM_Shuriken_GroundMoonBlade';geometries.set(key,geo);
 }
 if(!materials.has(key)){const m=mesh.material.clone();m.vertexColors=true;m.roughness=.30;m.userData.identityFinish=true;materials.set(key,m);}
 mesh.geometry=geometries.get(key);mesh.material=materials.get(key);
}
function tailored(p,c,profile,pos){const key='tailor'+JSON.stringify(profile);if(!geometries.has(key))geometries.set(key,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),24));const m=new T.Mesh(geometries.get(key),material(c));m.position.set(...pos);m.scale.z=.65;m.castShadow=m.receiveShadow=true;p.add(m);return m;}
function cloth(p,color,width,length,z){const key=`cloth:${width}:${length}:${z}`;if(!geometries.has(key)){const vertices=[],indices=[];for(let y=0;y<=6;y++)for(let x=0;x<=6;x++){const u=x/6,v=y/6;vertices.push((u-.5)*width*(.62+.38*v),-length*v,z-Math.sin(v*Math.PI/2)*.18+Math.cos(u*Math.PI*4)*.035*v);}for(let y=0;y<6;y++)for(let x=0;x<6;x++){const a=y*7+x;indices.push(a,a+7,a+1,a+1,a+7,a+8);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();geometries.set(key,g);}const mat=material(color);mat.side=T.DoubleSide;const m=new T.Mesh(geometries.get(key),mat);m.castShadow=m.receiveShadow=true;p.add(m);return m;}
function lock(p,color,x,y,z,length,bend=.12){const key=`lock:${length}:${bend}`;if(!geometries.has(key)){const v=[],ix=[];for(let i=0;i<=10;i++){const f=i/10,r=.069*Math.sin(Math.min(1,f*8)*Math.PI/2)*(1-f)+.001;for(let j=0;j<10;j++){const a=j*Math.PI/5;v.push(Math.cos(a)*r,-f*length,bend*f*f+Math.sin(a)*r*.58);}}for(let i=0;i<10;i++)for(let j=0;j<10;j++){const a=i*10+j,b=i*10+(j+1)%10;ix.push(a,b,a+10,b,b+10,a+10);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();geometries.set(key,g);}const m=new T.Mesh(geometries.get(key),material(color));m.position.set(x,y,z);m.castShadow=true;p.add(m);return m;}
export function makeHero(kind,weapon){
  if(kind==='wraith'){const g=makeHero('scout','dark'),d=g.userData;d.weapon.clear();d.weapon.add(shadowFocus(weapon));d.weaponId=weapon;d.kind=kind;return g;}
  if(kind==='mirage'){
    // Loading fallback uses the existing articulated woman, never a rifle-bearing scout.
    const g=makeHero('silver','dark'),d=g.userData;
    g.traverse(o=>{if(!o.isMesh)return;const c=o.material.color,hsl={};c.getHSL(hsl);const pale=hsl.l>.65,color=pale?0xc4b7db:hsl.l>.25?0x59436d:0x24142e;o.material=material(color,o.material.metalness);});
    const mask=ell(d.head,0xb7abc9,[0,.012,.169],[.176,.216,.074],.14);mask.name='mirage-fallback-full-mask';
    for(const side of[-1,1]){const eye=ell(d.head,0x21162c,[side*.077,.063,.232],[.043,.009,.008]);eye.rotation.z=side*-.12;}
    d.weapon.clear();d.weapon.add(miasmaLantern());d.weapon.scale.setScalar(.95);d.weaponId=weapon;d.kind=kind;g.scale.setScalar(.81);return g;
  }
  const silver=kind==='silver',g=new T.Group(),rig=joint(g,[0,0,0]),torso=joint(rig,[0,1.12,0]);
  const coat=silver?0x202c40:0x344f3e,light=silver?0x3e566c:0x6c7651,dark=0x15212c,trim=silver?0xa4b9d2:0xba9358,hair=silver?0xd6e0ee:0x503326,skin=silver?0xe2bea6:0xcb9c7d,gem=silver?0x7dbfbf:0xc9a867;
  const d=g.userData;Object.assign(d,{kind,weaponId:weapon,rig,torso});
  tailored(torso,coat,[[.23,0],[.21,.16],[silver?.175:.25,.32],[silver?.27:.3,.5],[.23,.62]],[0,0,0]);
  // Shoulder mantle, high collar, contrasting central tunic and fitted belt.
  tailored(torso,light,[[silver?.26:.29,0],[silver?.28:.32,.08],[.25,.13]],[0,.47,0]);
  tube(torso,dark,[0,.65,0],[.13,.15,.115]);
  const chest=block(torso,silver?dark:0x63503e,[0,.34,.163],[silver?.14:.10,.43,.035]);chest.rotation.z=silver?-.12:.5;
  for(const s of [-1,1]){const piping=block(torso,trim,[s*.108,.34,.184],[.009,.43,.008],.45);piping.rotation.z=silver?-.12:.15;}
  if(!silver){const strap=block(torso,0x6a4b32,[-.01,.36,.19],[.085,.56,.035]);strap.rotation.z=-.55;block(torso,trim,[.035,.31,.217],[.075,.065,.016],.6);for(let i=0;i<3;i++){const cartridge=tube(torso,0xb69965,[-.16+i*.055,.21,.192],[.018,.105,.018],.5);cartridge.rotation.z=.12;}}
  tube(torso,dark,[0,.06,0],[.245,.095,.17]);block(torso,trim,[0,.06,.18],[.115,.074,.026],.7);block(torso,dark,[0,.06,.198],[.061,.035,.012]);
  for(const s of [-1,1]){const pouch=ell(torso,silver?0x465261:0x785c3f,[s*.245,.055,0],[.082,.105,.105]);block(torso,trim,[s*.252,.08,.092],[.075,.025,.013],.5);}
  const head=joint(torso,[0,.83,0]);head.scale.setScalar(silver?.91:.94);d.head=head;
  ell(head,skin,[0,.04,.005],[silver?.197:.214,.255,.19]);ell(head,skin,[0,.004,.18],[.022,.037,.024]);
  for(const s of [-1,1]){
    ell(head,skin,[s*.205,.018,-.005],[.035,.063,.039]);
    ell(head,0x293238,[s*.08,.065,.177],[.052,silver?.018:.021,.015]);ell(head,0xe1e5df,[s*.08,.065,.186],[.043,silver?.011:.014,.009]);ell(head,silver?0x437d83:0x655b36,[s*.078,.065,.194],[.014,silver?.012:.015,.006]);ell(head,0x142328,[s*.078,.066,.199],[.006,silver?.009:.011,.003]);
    const brow=ell(head,hair,[s*.08,.107,.177],[.05,.009,.012]);brow.rotation.z=s*(silver?.09:.19);
  }
  if(silver){ell(head,0x14202c,[0,-.066,.161],[.18,.079,.055]);block(head,0x455467,[0,-.068,.218],[.005,.091,.006]);for(const s of [-1,1]){const seam=block(head,0x354854,[s*.082,-.077,.2],[.075,.007,.008]);seam.rotation.z=s*.3;block(head,dark,[s*.182,-.053,.074],[.015,.036,.14]);}}
  else{ell(head,0x79573f,[0,-.131,.106],[.111,.044,.076]);ell(head,0x9a6957,[0,-.082,.181],[.057,.008,.007]);}
  part(head,'SphereGeometry',[1,24,16,0,Math.PI*2,0,1.65],hair,[0,.106,-.018],[.231,.242,.216]);
  for(let i=0;i<7;i++){const h=lock(head,i%3===0?(silver?0xeff2f9:0x79523a):hair,(i-3)*.056,.282,.123,silver?(i<3?.225:.175):.20,.065);h.rotation.z=silver?-.32:(i-3)*-.11;h.rotation.x=-.13;}
  for(let i=0;i<5;i++){const h=lock(head,hair,(i-2)*.064,.309,-.03,.22,-.09);h.rotation.z=silver?-.35:.25;h.rotation.x=.5;}
  for(const s of [-1,1]){const h=lock(head,hair,s*.199,.17,.003,silver?.49:.23,.07);h.rotation.z=s*-.06;}
  if(silver){const pony=joint(head,[.105,.23,-.203]);d.pony=pony;ell(pony,trim,[0,-.02,0],[.071,.044,.064],.6);for(let i=0;i<6;i++){const h=lock(pony,i%2?hair:0xb9cde5,(i-2.5)*.027,-.035,-Math.abs(i-2.5)*.01,.77,.23);h.rotation.z=.18;}}
  else{tailored(torso,0x94703d,[[.155,0],[.2,.045],[.16,.09]],[0,.615,0]);const scarf=cloth(torso,0x94703d,.26,.5,-.17);scarf.position.set(-.17,.64,0);scarf.rotation.z=-.2;d.scarf=scarf;}
  const cape=cloth(torso,silver?0x29394f:0x52634a,silver?.61:.78,silver?1.13:.76,-.16);cape.position.y=.55;d.cape=cape;
  for(const s of [-1,1]){const tail=cloth(torso,silver?0x364d66:coat,silver?.3:.27,silver?.62:.4,.015);tail.position.set(s*.20,.03,-.01);tail.rotation.y=s*.4;if(silver){const edge=cloth(torso,0x7893ae,.025,.6,.019);edge.position.set(s*.29,.03,0);edge.rotation.y=s*.4;}}
  const badge=ell(torso,trim,[.16,.51,.172],[.055,.061,.022],.8);ell(torso,gem,[.16,.51,.194],[.027,.034,.009],.4,.2);
  for(const s of [-1,1]){
    const side=s<0?'left':'right',leg=joint(rig,[s*(silver?.122:.143),1.105,0]);d[side+'Leg']=leg;
    ell(leg,silver?dark:0x3c443c,[0,-.24,0],[silver?.084:.105,.29,silver?.087:.104]);const knee=joint(leg,[0,-.47,0]);d[side+'Knee']=knee;
    ell(knee,silver?0x35465b:0x6c5840,[0,-.04,.061],[.073,.09,.025]);ell(knee,dark,[0,-.255,0],[.077,.265,.077]);
    tailored(knee,silver?0x253245:0x4e4034,[[.082,0],[.084,.13],[.073,.28],[.087,.42]],[0,-.45,0]);tube(knee,trim,[0,-.034,0],[.087,.014,.062],.5);
    ell(knee,silver?0x1b2932:0x3b302a,[0,-.51,.065],[silver?.093:.113,.078,.17]);block(knee,0x273039,[0,-.555,.046],[silver?.18:.21,.032,.29]);
    const arm=joint(torso,[s*(silver?.261:.294),.5,0]);d[side+'Arm']=arm;arm.rotation.z=s*.07;
    ell(arm,silver?coat:s<0?0x6b503a:light,[s*.004,-.024,0],[silver?.093:.119,.122,silver?.102:.128],0);tube(arm,silver?light:0x8b704c,[0,-.075,0],[silver?.092:.107,.018,silver?.089:.1],.15);
    ell(arm,coat,[0,-.17,0],[.083,.175,.085]);const elbow=joint(arm,[0,-.3,0]);d[side+'Elbow']=elbow;
    ell(elbow,dark,[0,-.105,0],[.073,.15,.075]);tube(elbow,silver?0x34475b:0x66503b,[0,-.17,0],[.077,.135,.074]);tube(elbow,trim,[0,-.226,0],[.078,.012,.075],.5);
    ell(elbow,dark,[0,-.287,.012],[.075,.087,.065]);block(elbow,trim,[0,-.28,.069],[.071,.036,.012],.6);
  }
  const gun=joint(d.rightElbow,[0,-.287,.025]);d.weapon=gun;
  if(weapon==='fire'||weapon==='dark'){
    const fire=weapon==='fire',accent=fire?0xff954f:0xa995cf,metal=fire?0x96724a:0x9ba9ba;
    gun.name='SM_Weapon_'+(fire?'EmberwoodStaff':'NightfallStaff');
    staffShaft(gun,fire);for(const y of [-.23,.1,.52]){const collar=part(gun,'LatheGeometry',[[[.027,-.03],[.033,-.03],[.036,-.023],[.034,-.015],[.034,.015],[.036,.023],[.033,.03],[.027,.03]].map(p=>new T.Vector2(...p)),16],metal,[0,y,.045],undefined,.65);collar.name='SM_Staff_'+(fire?'Copper':'Silver')+'_Ferrule_'+y;collar.userData.identityDetail=true;}
    const head=joint(gun,[0,.98,.045]);head.name='SM_Staff_'+(fire?'SplitEmberCrown':'CrescentCrown');head.scale.y=fire?.85:.91;
    if(fire){
      for(const s of[-1,1])forgedProng(weaponLine(head,'SM_EmberStaff_LeafProng_'+s,[[0,-.16,0],[s*.10,-.06,0],[s*.155,.095,0],[s*.075,.23,0],[s*.025,.27,0]],.018,metal,.6));
      part(head,'OctahedronGeometry',[.096,1],accent,[0,.07,0],[.78,1.58,.7],.12,.8).name='SM_EmberStaff_EmberSeed';
    }else{
      forgedProng(weaponLine(head,'SM_NightfallStaff_MoonFrame',[[.085,.25,0],[-.11,.17,0],[-.16,.015,0],[-.07,-.13,0],[.085,-.10,0]],.019,metal,.64));
      part(head,'OctahedronGeometry',[.087,1],accent,[0,.07,0],[.66,1.32,.66],.22,.5).name='SM_NightfallStaff_NightCore';
    }
  }else if(weapon==='crossbow'){
    gun.name='SM_Weapon_Crossbow_A';
    woodFinish(weaponHull(gun,'SM_Crossbow_WoodStock_A',[[0,.035,-.14,.075,.095],[0,.047,-.075,.13,.12],[0,.047,.24,.11,.092],[0,.065,.435,.057,.06]],0x313d54));
    // The support contact remains (0,-.05,.18); shape the stock down to the
    // palm instead of moving an already calibrated hand rig to hide the gap.
    weaponHull(gun,'SM_Crossbow_PalmForeend_A',[[0,-.006,.11,.081,.064],[0,-.009,.18,.090,.082],[0,-.003,.28,.070,.060]],0x242b32);
    const grip=weaponHull(gun,'SM_Crossbow_Grip_A',[[0,0,-.095,.081,.070],[0,0,-.066,.095,.091],[0,0,.068,.091,.087],[0,0,.095,.083,.076]],0x242b32);grip.rotation.x=-Math.PI/2-.16;grip.position.set(0,-.077,.01);
    for(const side of[-1,1]){
      weaponHull(gun,'SM_Crossbow_SteelRail_'+(side<0?'L':'R'),[[side*.022,.112,-.075,.015,.014],[side*.022,.116,.21,.015,.019],[side*.018,.114,.44,.011,.010]],0xb0b9bf,.68);
      weaponLine(gun,'SM_Crossbow_StockSeam_'+side,[[side*.047,.067,-.10],[side*.062,.074,-.02],[side*.050,.073,.20],[side*.030,.085,.35]],.0023,0x75879d);
    }
    weaponLine(gun,'SM_Crossbow_TriggerGuard_A',[[0,.006,-.052],[0,-.073,-.053],[0,-.103,.085],[0,-.08,.14],[0,.002,.17]],.009,0x687880,.56);
    weaponLine(gun,'SM_Crossbow_Trigger_A',[[0,-.012,.053],[0,-.047,.043],[0,-.066,.075]],.007,0xa0acb4,.72);
    const strings=[];
    for(const s of[-1,1]){
      const curve=new T.CatmullRomCurve3([[0,.11,.42],[s*.16,.115,.463],[s*.32,.118,.432],[s*.44,.11,.36]].map(p=>new T.Vector3(...p))),rings=[],directions=[];
      for(let i=0;i<=10;i++){const t=i/10,c=curve.getPoint(t),a=curve.getTangent(t);rings.push([c.x,c.y,c.z,.054-.033*t,.025-.014*t]);directions.push(new T.Vector3(a.z,0,-a.x).normalize());}
      weaponHull(gun,'SM_Crossbow_RecurvedLimb_'+(s<0?'L':'R'),rings,0x687984,.64,directions);
      weaponLine(gun,'SM_Crossbow_LimbRidge_'+s,[[s*.07,.124,.441],[s*.20,.129,.455],[s*.33,.129,.426],[s*.426,.118,.374]],.0028,0xb2bec4,.72);
      const tip=part(gun,'LatheGeometry',[[[0,-.025],[.014,-.025],[.019,-.020],[.019,-.011],[.012,-.006],[.012,.006],[.019,.011],[.019,.020],[.014,.025],[0,.025]].map(p=>new T.Vector2(...p)),12],0xb4c6ca,[s*.44,.11,.36],[1,1,1.05],.6);tip.name='SM_Crossbow_StringNock_'+s;tip.userData.identityDetail=true;
      const string=part(gun,'CylinderGeometry',[.003,.003,1,6],0x8e8d7e);string.name='SM_Crossbow_String_'+s;strings.push(string);
    }
    const latch=joint(gun,[0,0,-.30]);latch.name='SM_Crossbow_CockingSlide_A';
    weaponHull(latch,'SM_Crossbow_Latch_A',[[0,.13,.263,.060,.021],[0,.131,.272,.068,.024],[0,.135,.278,.072,.026],[0,.135,.295,.072,.026],[0,.129,.300,.048,.015],[0,.129,.305,.048,.015],[0,.13,.31,.054,.021]],0x747e86,.66);
    weaponLine(latch,'SM_Crossbow_CockingTab_A',[[.02,.126,.29],[.059,.134,.29],[.073,.134,.29]],.008,0x9aabb6,.7);
    const bolt=new T.Group();bolt.name='SM_Crossbow_Bolt_A';gun.add(bolt);
    const shaft=part(bolt,'CylinderGeometry',[.009,.009,.53,8],0x99836b,[0,.16,.255]);shaft.rotation.x=Math.PI/2;shaft.name='SM_Crossbow_BoltShaft_A';
    weaponHull(bolt,'SM_Crossbow_BoltHead_A',[[0,.16,.505,.013,.012],[0,.16,.525,.048,.027],[0,.16,.546,.040,.020],[0,.16,.633,.001,.001]],0xc8d1d5,.78);
    for(const s of[-1,1])weaponHull(bolt,'SM_Crossbow_BoltFletching_'+s,[[s*.007,.16,.014,.007,.013],[s*.013,.16,.046,.007,.037],[s*.006,.16,.096,.005,.010]],0x718b98);
    gun.userData.crossbowStrings=strings;gun.userData.crossbowBolt=bolt;gun.userData.crossbowLatch=latch;gun.userData.stringPull=.30;
    const feather=[];for(const s of[-1,1])for(const [x,z]of[[.19,.449],[.29,.441]])feather.push([[s*(x-.024),.130,z+.010],[s*x,.132,z],[s*(x+.035),.130,z-.019]]);
    weaponInlay(gun,'SM_Crossbow_FeatherLimbEngraving',feather,0x9dabb9,.0016);
    poseCrossbow(gun,1);
  }else if(weapon==='shuriken'){
    gun.name='SM_Weapon_CrescentShuriken';
    part(gun,'TorusGeometry',[.095,.016,8,24],0x53627d,[0,0,.06],[1,1,1],.64).rotation.x=Math.PI/2;
    const bladeShape=new T.Shape();bladeShape.moveTo(-.068,-.12);bladeShape.quadraticCurveTo(-.11,.045,.035,.19);bladeShape.quadraticCurveTo(-.005,.055,.063,-.075);bladeShape.quadraticCurveTo(0,-.055,-.068,-.12);
    const blades=joint(gun,[0,0,.06]);blades.name='SM_Shuriken_CrescentAssembly';blades.scale.set(.612,1,.98);
    for(let i=0;i<4;i++){const blade=part(blades,'ExtrudeGeometry',[bladeShape,{depth:.018,bevelEnabled:true,bevelSize:.005,bevelThickness:.004,bevelSegments:2,steps:1,curveSegments:10}],0xc4cddd,[Math.sin(i*Math.PI/2)*.18,-.009,Math.cos(i*Math.PI/2)*.18],[1,1,1],.76);blade.rotation.set(Math.PI/2,0,-i*Math.PI/2);blade.name='SM_Shuriken_MoonBlade_'+i;blade.userData.identityDetail=true;refineMoonBlade(blade);}
  }else{
    const length=.69;
    gun.name='SM_Weapon_'+(weapon==='shotgun'?'RockbreakerShotgun':'RangerRepeater');
    weaponHull(gun,'SM_Firearm_ForestReceiver_'+weapon,[[0,.058,-.155,.086,.10],[0,.058,-.12,.112,.125],[0,.058,.47,.112,.125],[0,.058,.535,.080,.10]],0x35483e,.22);block(gun,0x88948d,[0,.133,.23],[.099,.029,length*.83],.7);
    if(!materials.has('machined-bore'))materials.set('machined-bore',new T.MeshStandardMaterial({color:0x809097,vertexColors:true,metalness:.76,roughness:.32}));
    const barrel=(radius,size,pos,suffix)=>{const m=new T.Mesh(recessedBarrelGeometry(radius,size),materials.get('machined-bore'));m.position.set(...pos);m.name='SM_Firearm_RecessedBarrel_'+suffix;m.userData.identityDetail=true;m.castShadow=m.receiveShadow=true;gun.add(m);return m;};
    barrel(.036,.33,[0,.072,.545],'Main');
    const grip=woodFinish(weaponHull(gun,'SM_Firearm_ShapedGrip_'+weapon,[[0,0,-.10,.079,.109],[0,0,-.080,.096,.126],[0,0,-.040,.085,.119],[0,0,.038,.088,.122],[0,0,.10,.076,.114]],0x5c4a3e));grip.rotation.x=-Math.PI/2-.22;grip.position.set(0,-.065,.075);
    block(gun,trim,[.061,.072,.19],[.008,.032,.16],.8);block(gun,0x192831,[0,.169,.13],[.028,.044,.061]);
    woodFinish(weaponHull(gun,'SM_Firearm_LeafwoodStock_'+weapon,[[0,.03,-.35,.088,.145],[0,.03,-.31,.115,.17],[0,.03,-.16,.115,.17],[0,.03,-.13,.085,.14]],0x6f5036));
    weaponInlay(gun,'SM_Firearm_TriggerAssembly_'+weapon,[[[0,.005,.122],[0,-.081,.127],[0,-.102,.181],[0,-.077,.23],[0,.001,.244]],[[0,-.006,.159],[0,-.042,.16],[0,-.051,.182]]],0x687780,.006,.64);
    weaponInlay(gun,'SM_Firearm_LeafGrain_'+weapon,[[[0,.116,-.292],[.015,.117,-.25],[0,.116,-.193]],[[-.002,.117,-.272],[-.024,.117,-.25],[0,.117,-.227]]],0xb59868,.0018,.28);
    if(weapon==='rifle'){tube(gun,dark,[0,.193,.21],[.045,.14,.045]).rotation.x=Math.PI/2;woodFinish(weaponHull(gun,'SM_Firearm_RiflePalmForeend',[[0,.002,.19,.062,.060],[0,.002,.24,.10,.085],[0,-.002,.34,.098,.086],[0,.001,.45,.069,.062]],0x6f5036));}
    if(weapon==='shotgun'){barrel(.032,.43,[.075,.068,.47],'Side');const pump=joint(gun,[0,0,0]),rings=[[0,.020,.269,.108,.060]];for(let i=0;i<5;i++){const z=.278+i*.0255;rings.push([0,.0175,z,.140,.085],[0,.0175,z+.012,.140,.085],[0,.019,z+.020,.119,.067]);}rings.push([0,.022,.402,.106,.056]);woodFinish(weaponHull(pump,'SM_Firearm_ShotgunGroovedPump',rings,0x8c6e48));gun.userData.pump=pump;}
  }
  nameWeapon(gun,silver?'silver':'scout',weapon);
  return g;
}
const stringUp=new T.Vector3(0,1,0),stringStart=new T.Vector3(),stringEnd=new T.Vector3();
export function poseCrossbow(gun,phase=1){
 const strings=gun.userData.crossbowStrings;if(!strings)return;
 const mechanism=crossbowMechanism(phase);
 for(let i=0;i<2;i++){stringStart.set(i?.44:-.44,.11,.36);stringEnd.set(0,.16,.29-mechanism.pull).sub(stringStart);strings[i].position.copy(stringStart).addScaledVector(stringEnd,.5);strings[i].scale.y=stringEnd.length();strings[i].quaternion.setFromUnitVectors(stringUp,stringEnd.normalize());}
 gun.userData.stringPull=mechanism.pull;gun.userData.crossbowBolt.visible=mechanism.boltVisible;if(gun.userData.crossbowLatch)gun.userData.crossbowLatch.position.z=-mechanism.pull;
}
export function animateHero(g,t,speed,attack){
  const d=g.userData,dt=d.lastPoseTime===undefined?1/60:Math.max(0,Math.min(.05,t-d.lastPoseTime));d.lastPoseTime=t;
  d.runBlend=(d.runBlend||0)+(Math.min(1,speed/6.5)-(d.runBlend||0))*(1-Math.exp(-dt*12));
  d.aimBlend=(d.aimBlend||0)+((attack>0?1:0)-(d.aimBlend||0))*(1-Math.exp(-dt*20));
  d.gait=(d.gait||0)+dt*11*Math.max(.25,d.runBlend);
  const run=d.runBlend,phase=d.gait,step=Math.sin(phase),aim=d.aimBlend;
  const fired=shotStarted(d,attack,d.previousAttack||0);d.previousAttack=attack;d.attackAge=fired?0:(d.attackAge??2)+dt;const motion=weaponGesture(d.weaponId,d.attackAge,d.reloadPhase??1,d.reloadDuration||1);
  d.rig.position.y=.012*Math.sin(t*2.8)+Math.abs(step)*.045*run;d.rig.rotation.z=step*.025*run;
  for(const [side,sign]of [['left',1],['right',-1]]){const f=Math.sin(phase+(sign<0?Math.PI:0));d[side+'Leg'].rotation.x=f*.6*run;d[side+'Knee'].rotation.x=Math.max(0,-f)*.95*run+.06;}
  d.torso.rotation.x=.035+run*.08;d.torso.rotation.y=-step*.08*run;
  d.leftArm.rotation.x=-step*.36*run-.1;d.leftElbow.rotation.x=-.24-Math.max(0,step)*.3*run;
  const staff=['fire','dark','miasmalantern'].includes(d.weaponId);d.rightArm.rotation.x=staff?-.12-aim*.3:-.4-aim*.32;d.rightElbow.rotation.x=staff?-.35:-.65-aim*.15;
  d.weapon.rotation.x=staff?.18:-(d.rightArm.rotation.x+d.rightElbow.rotation.x)-.12*(1-aim);
  const k=motion.kick,s=motion.sweep;d.rig.position.z=-k*(d.weaponId==='shotgun'?.10:.035);
  d.rightArm.rotation.y=d.weaponId==='shuriken'?-.7*s:d.weaponId==='dark'?.5*s:0;d.rightArm.rotation.x-=k*(staff?.45:.15);d.rightElbow.rotation.x-=k*(d.weaponId==='shuriken'?.4:.15);d.leftArm.rotation.x-=staff?.4*s:motion.draw*.3;
  if(d.weapon.userData.pump)d.weapon.userData.pump.position.z=-.23*motion.draw;
  if(d.weaponId==='crossbow')poseCrossbow(d.weapon,d.reloadPhase??1);
  d.cape.rotation.x=.07+run*.34+Math.sin(t*5)*.045;d.cape.rotation.z=step*.045*run;
  if(d.pony){d.pony.rotation.x=-.1+run*.22+Math.sin(t*7)*.06;d.pony.rotation.z=step*.06*run;}
  if(d.scarf)d.scarf.rotation.x=run*.4+Math.sin(t*6)*.06;
}

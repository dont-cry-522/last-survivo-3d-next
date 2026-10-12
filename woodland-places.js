import * as T from './vendor/three.module.js';
import {naturalRockGeometry} from './biome-scenery.js?v=156';

// Authored in local space: the route runs along Z, with |x| < 3.1 kept clear.
// The installer owns placement, batching, materials, colliders and disposal.
function surface(positions,indices,colors){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);
 if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function limb(points,radii,segments=18,sides=12,bark=false){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,segments,1,sides,false),p=g.attributes.position,colors=[];
 for(let row=0;row<=segments;row++){
  const t=row/segments,center=curve.getPointAt(t),at=t*(radii.length-1),radius=T.MathUtils.lerp(radii[Math.floor(at)],radii[Math.min(radii.length-1,Math.floor(at)+1)],at%1);
  for(let side=0;side<=sides;side++){
   const i=row*(sides+1)+side,a=side/sides*Math.PI*2,r=radius*(1+.052*Math.sin(a*5+t*9)+.028*Math.cos(a*9-t*5))*(bark?(.97-.065*(.5+.5*Math.sin(a*13+t*1.9))**6):1);
   p.setXYZ(i,center.x+(p.getX(i)-center.x)*r,center.y+(p.getY(i)-center.y)*r,center.z+(p.getZ(i)-center.z)*r);
   const shade=.80+.14*Math.sin(a*3+t*2)+.06*Math.cos(a*7-t*4);colors.push(shade,shade,shade);
  }
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.userData.bark=bark;g.computeVertexNormals();return g;
}
// Uneven concentric end-grain is geometry, not a flat bright disk/decal.
function brokenEnd(center,direction,radius){
 const p=[],c=[],indices=[],q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...direction).normalize()),v=new T.Vector3(),sides=18;
 for(let ring=0;ring<5;ring++)for(let i=0;i<sides;i++){
  const a=i/sides*Math.PI*2,r=radius*ring/4*(1+.04*Math.sin(a*5)),recess=ring===4?.025:.045+Math.sin(a*3+ring)*.013;
  v.set(Math.cos(a)*r,Math.sin(a)*r,recess).applyQuaternion(q).add(new T.Vector3(...center));p.push(v.x,v.y,v.z);
  const shade=[.76,.95,.72,.91,.57][ring]+Math.sin(a*3)*.035;c.push(shade,shade,shade);
  if(ring) {const n=ring*sides+i,next=ring*sides+(i+1)%sides;indices.push(n,next,n-sides,next,next-sides,n-sides);}
 }
 return surface(p,indices,c);
}
function frond(){
 const p=[],c=[],indices=[];
 for(let n=0;n<7;n++){
  const t=(n+.8)/8,y=.06+Math.sin(t*Math.PI*.78)*.46,z=t*.48,width=Math.sin(t*Math.PI)*.19;
  for(const side of[-1,1]){
   const i=p.length/3;p.push(0,y,z,side*width,y-.035,z-.10,side*width*.68,y+.016,z+.02,0,y+.019,z+.11);
   c.push(.66,.78,.56,.83,.93,.71,1,1,.91,.91,.99,.78);indices.push(i,i+1,i+2,i,i+2,i+3,i+2,i+1,i,i+3,i+2,i);
  }
 }
 const g=surface(p,indices,c);g.name='SM_Woodland_Fern_A';return g;
}
function brokenMoss(seed){
 const p=[],c=[],indices=[];
 // Little exposed cushions share bare gaps and a buried, brown feathered edge.
 // Replace the old solid oval pebble, without another ground decal or texture.
 for(const [i,[cx,cz]]of[[-.62,-.15],[-.28,.18],[.18,-.21],[.55,.25],[-.18,-.52],[.07,.52],[.5,-.51]].entries()){
  const start=p.length/3,x=cx+.055*Math.sin(seed+i*2.4),z=cz+.045*Math.cos(seed*1.3+i),radius=.15+.035*(1+Math.sin(i*1.7+seed));
  p.push(x,.002+.009*Math.sin(i+seed)**2,z);c.push(.83,.90,.66);
  for(let j=0;j<7;j++){
   const a=j/7*Math.PI*2,r=radius*(.77+.23*Math.sin(j*2.9+i+seed)**2);
   p.push(x+Math.sin(a)*r,-.057+.009*Math.sin(j+i),z+Math.cos(a)*r);c.push(.66,.56,.40);
   indices.push(start,start+1+j,start+1+(j+1)%7);
  }
 }
 const g=surface(p,indices,c);g.name='SM_Woodland_BrokenMoss_A';return g;
}
function ridgeSection(side,t,variant=0){
 const z=-7.25+t*14.5,bulge=Math.sin(Math.PI*t)**.35,bay=side===(variant?-1:1)?Math.max(0,1-((z-(variant?-1.3:.8))/3.7)**2)**2:0;
 return{z,bulge,bay,center:side*(6.05+.17*Math.sin(t*7+variant*.8)+bay*.68),width:(.30+bulge*1.61)*(1+.045*Math.sin(t*19+variant))*(1-bay*.12),height:(.10+bulge*(2.42+.52*Math.sin(t*9+.6+variant*.7)+.30*Math.sin(t*22)))*(1-bay*.23)};
}
function ridge(side,snow=false,variant=0){
 const p=[],indices=[],colors=[],rows=19;
 for(let row=0;row<rows;row++){
  const t=row/(rows-1),{z,center,width,height}=ridgeSection(side,t,variant);
  // Rock faces form one connected ridge. The separate snow lid rests directly
  // on its upper three shoulders; no snow spheres stacked along the skyline.
  const section=snow?[[-.84,.39],[-.51,.86],[-.12,1.02],[.39,.90],[.83,.47]]:[[-1,-.04],[-.84,.36],[-.49,.82],[-.10,1],[.42,.86],[.88,.43],[1,-.04]];
  for(let j=0;j<section.length;j++){
   const [cross,high]=section[j],x=center+cross*width,y=high<0?-.08:height*high+(snow?.045:0),shade=snow?.84+high*.15:.62+high*.32+.055*Math.sin(t*24+j);
   p.push(x,y,z);colors.push(shade*(snow?1:.96),shade,shade*(snow?1.02:1.06));
   if(row&&j){const n=p.length/3-1,nc=section.length;indices.push(n,n-nc,n-1,n-1,n-nc,n-nc-1);}
  }
 }
 const g=surface(p,indices,colors);g.name=snow?'SM_Snow_RidgeCap_A':'SM_Snow_RockRidge_A';
 // Keep the front faces outward on both sides; base vertices sit below soil.
 g.computeVertexNormals();return g;
}

// A thin connected drift touches the rock's inner shoulder and feathers into
// the soil. The clear central path remains wider than the authored 6.2 metres.
function snowSkirt(side,variant){
 const p=[],colors=[],indices=[];
 for(let row=0;row<19;row++){
  const t=row/18,{z,center,width,height,bay}=ridgeSection(side,t,variant),foot=center-side*width*.83,tip=side*(3.48+.13*Math.sin(t*17+variant)**2),scoured=1-T.MathUtils.smoothstep(bay,.02,.18);
  for(let j=0;j<3;j++){
   const u=j/2,x=T.MathUtils.lerp(foot,tip,u),y=j===0?height*.40*scoured+.047:j===1?.026+.055*Math.sin(t*13+variant)**2:-.045,shade=.88+(1-u)*.08;
   p.push(x,y,z);colors.push(shade*.97,shade,shade*1.02);
   if(row&&j){const n=p.length/3-1,face=[n,n-3,n-1,n-1,n-3,n-4];if(side>0)face.reverse();indices.push(...face);}
  }
 }
 const g=surface(p,indices,colors);g.name='SM_Snow_RockFoot_A';return g;
}

function forest(kit,variant){
 const add=(category,g,color,transform)=>kit.piece(category,g,color,transform),wood=0x655443;
 const trunk=variant?[[-6.25,.94,5.5],[-5.97,1.09,2.6],[-5.52,.92,-.5],[-5.79,.76,-3.1],[-6.22,.60,-5.8]]:[[-6.0,.96,-5.5],[-5.45,1.08,-2.6],[-5.16,.96,.5],[-5.60,.79,3.1],[-6.12,.70,5.9]],direction=variant?-1:1;
 add('wood',limb(trunk,[.87,.90,.78,.67,.53],32,28,true),wood);
 add('wood',brokenEnd(trunk[4],[-.30,-.04,direction],.54),0xb69a70);
 add('wood',brokenEnd(trunk[0],[-.14,.04,-direction],.84),0x8f795b);
 const trunkCurve=new T.CatmullRomCurve3(trunk.map(p=>new T.Vector3(...p)));
 for(let i=0;i<=18;i++){
  const t=i/18,p=trunkCurve.getPointAt(t),at=t*4,r=[.87,.90,.78,.67,.53],radius=T.MathUtils.lerp(r[Math.floor(at)],r[Math.min(4,Math.floor(at)+1)],at%1);
  kit.solid(p.x,p.z,1.06,p.y+radius*1.08+.12);
 }
 // The uprooted butt has lateral roots curling down into the soil, rather than
 // another upright trunk. All of it remains on the left of the passage.
 const butt=trunk[0],rootX=butt[0]-.13,rootZ=butt[2]-.33*direction;
 for(let i=0;i<9;i++){
  const a=i*2.399+variant*.4,reach=1.12+(i%3)*.20,tip=[rootX+Math.cos(a)*reach,.03,rootZ+Math.sin(a)*reach];
  add('wood',limb([[butt[0]-.02,butt[1]+.04,butt[2]+.02*direction],[rootX+Math.cos(a)*.48,1.12+(i%3)*.29,rootZ+Math.sin(a)*.48],tip],[.24,.16,.025],12,8),i%2?0x574b3e:0x6d5b45);
 }
 kit.solid(rootX,rootZ,1.95,2.10);
 for(const [t,side]of[[.27,-1],[.58,1],[.80,-1]]){
  const p=trunkCurve.getPointAt(t),tip=[p.x+side*.65,.09,p.z+direction*.92];
  add('wood',limb([[p.x,p.y+.10,p.z],[p.x+side*.54,.86,p.z+direction*.4],tip],[.22,.14,.025],10,8),0x584b3c);kit.solid(p.x+side*.32,p.z+direction*.40,.61,1.36);
 }
 // Moss drapes across the sunken bark, with broad irregular patches continuing
 // on the ground; a few fans of fronds supply a readable soft silhouette.
 for(let i=0;i<23;i++){
  const t=.025+i/22*.95,p=trunkCurve.getPointAt(t),at=t*4,radii=[.87,.90,.78,.67,.53],radius=T.MathUtils.lerp(radii[Math.floor(at)],radii[Math.min(4,Math.floor(at)+1)],at%1);
  add('leaf',naturalRockGeometry.clone(),i%3?0x4b593b:0x626849,{x:p.x+.13*Math.sin(i*2.4),y:p.y+radius*.91,z:p.z,sx:.30+(i%3)*.04,sy:.05,sz:.43,ry:i*.73});
 }
 for(const side of[-1,1])for(let i=0;i<12;i++){
  const patch=Math.floor(i/3),z=(-6+patch*3.95+(i%3-1)*.59+.14*Math.sin(i*1.7))*(variant?-1:1),x=side*(4.27+.27*Math.sin(i*1.73+variant)+((side>0&&patch%2)?.45:0));
  add('leaf',brokenMoss(i+variant*13),i%3?0x4c513a:0x59573e,{x:x+side*.27,y:0,z,sx:.68,sy:1,sz:.80,ry:i*.63});
  for(let j=0;j<3;j++)add('leaf',frond(),j%2?0x6f8a52:0x4f7044,{x:x+side*.08,y:.02,z:z+.13*j,ry:j*2.12+i*.4,sx:.85,sy:1,sz:.94});
 }
 // South-east: a collapsed carrier's sleeping platform, folded canvas and a
 // cold hearth. The planks are low and broken; nothing resembles another tower.
 const campZ=variant?-3.0:2.78;
 for(let i=0;i<6;i++)add('wood',new T.BoxGeometry(.32,.14,2.7-(i%3)*.22-(variant&&i===2?.65:0)),i%2?0x79634b:0x665943,{x:5.13+i*.35,y:.18+(i%2)*.025,z:campZ+(variant?.15*Math.sin(i):0),ry:(variant?.13:.04)*Math.sin(i),rz:.02*Math.cos(i)});
 for(const z of[campZ-1.1,campZ+.9]){add('wood',limb([[4.90,.14,z],[5.8,.13,z+.03],[7.12,.10,z-.12]],[.13,.14,.07],8,8),0x574d3e);}
 add('cloth',new T.SphereGeometry(1,14,8),0x827962,{x:6.17,y:.35,z:campZ+.36,sx:variant?.56:.80,sy:variant?.22:.19,sz:variant?1.03:.89,ry:variant?.24:-.18});kit.solid(6.09,campZ+.14,1.34,.60);
 const hearth={x:variant?6.10:6.45,z:variant?2.70:-2.85};
 add('stone',naturalRockGeometry.clone(),0x49463d,{x:hearth.x,y:.016,z:hearth.z,sx:.71,sy:.065,sz:.70});
 for(let i=0;i<9;i++){const a=i/9*Math.PI*2;add('stone',naturalRockGeometry.clone(),i%2?0x7f8170:0x64695d,{x:hearth.x+Math.cos(a)*.72,y:.10,z:hearth.z+Math.sin(a)*.65,sx:.25,sy:.20,sz:.23,ry:a});}
 for(let i=0;i<3;i++)add('wood',limb([[hearth.x-.37+i*.15,.06,hearth.z-.27],[hearth.x-.13+i*.12,.08,hearth.z-.05],[hearth.x+.22+i*.09,.065,hearth.z+.20]],[.09,.10,.07],6,7),0x302f2a);
 return{kind:variant?'root-sheltered-waycamp':'fallen-giant-camp',name:variant?'根盘背风营地':'倒木行旅营地',focus:{x:-5.5,y:1.15,z:variant?2.4:.3}};
}

function snow(kit,variant){
 const add=(category,g,color,transform)=>kit.piece(category,g,color,transform);
 for(const side of[-1,1]){
  add('stone',ridge(side,false,variant),side<0?0x667b82:0x778891);
  add('snow',ridge(side,true,variant),0xdde5df);
  add('snow',snowSkirt(side,variant),0xd3e1df);
  // Overlapping footprint cylinders represent the continuous rock wall. Their
  // inside edge remains outside x=±3.1 even at the widest wind-scoured shoulder.
  for(let z=-6.8;z<=6.81;z+=.68){
   const t=(z+7.25)/14.5,{center,bulge,bay}=ridgeSection(side,t,variant),height=Math.max(...[-.05,0,.05].map(d=>ridgeSection(side,T.MathUtils.clamp(t+d,0,1),variant).height))*1.02+.09;
   kit.solid(center,z,.50+bulge*1.64-bay*.15,height);
  }
  // Dark blue seams follow the inward face, with inset milky ice plates above.
  for(let i=0;i<8;i++){
   const z=-5.9+i*1.64,{center,width}=ridgeSection(side,(z+7.25)/14.5,variant),x=center-side*width*.72,height=.46+(i%3)*.15;
   add('ice',naturalRockGeometry.clone(),i%2?0xa5c4cb:0x739da9,{x,y:height*.62,z,sx:.34,sy:height,sz:.95,ry:.14*Math.sin(i)});
   add('ice',limb([[x-side*.17,.17,z-.48],[x-side*.22,.46,z-.16],[x-side*.18,.64,z+.02]],[.023,.027,.016],6,5),0x446b7d);
  }
 }
 // A half-buried freight sled lies against the east ridge. The broken runner
 // curls upward once, while the deck and remaining crosspieces lean into snow.
 const sign=variant?-1:1,sledX=5.12*sign,shift=variant?-2.05:0,point=([x,y,z])=>[x*sign,y,z+shift];
 for(const side of[-1,1])add('wood',limb([[5.12+side*.62,.08,-1.05],[5.12+side*.62,.16,.65],[5.12+side*.62,.26,2.44],[5.12+side*.55,.73,2.98]].map(point),[.12,.12,.10,.065],18,8),0x645b4b);
 for(let i=0;i<7;i++)add('wood',new T.BoxGeometry(1.45-(i===2?.45:0)-(variant&&i===5?.32:0),.11,.27),i%2?0x978571:0x7c7161,{x:sledX+(i===2?.25*sign:0),y:.28+i*.025,z:shift-.72+i*.43,ry:i===2?.22:variant&&i===5?-.28:.025*Math.sin(i),rz:-.08*sign});
 add('wood',limb([[5.74,.27,.95],[6.02,.65,1.08],[6.10,.94,1.23]].map(point),[.065,.065,.025],7,7),0x696355);
 for(const z of[-.70,.13,.96,1.79,2.62])kit.solid(sledX,z+shift,.94,z>2?1.05:.64);
 for(const [x,z,sx,sz]of[[5.92,-.45,.66,1.12],[5.76,1.58,.53,.81],[4.85,2.78,.57,.39]])add('snow',naturalRockGeometry.clone(),0xe0e8e3,{x:x*sign,y:.29,z:z+shift,sx,sy:.23,sz,ry:.4});
 if(variant){
  // The abandoned load became a low windbreak beside the western bay, rather
  // than a second identical freight sled. Its visible slats remain jumpable.
  for(let i=0;i<5;i++)add('wood',new T.BoxGeometry(.18,.62-i*.045,.16),i%2?0x776958:0x625b50,{x:-4.65-i*.25,y:.30-i*.018,z:1.70+.08*Math.sin(i),rz:.08*Math.sin(i)});
  add('wood',limb([[-4.68,.43,1.76],[-5.22,.39,1.70],[-5.72,.28,1.65]],[.05,.05,.035],7,6),0x645d50);
  kit.solid(-5.16,1.71,.78,.70);
  add('snow',naturalRockGeometry.clone(),0xd5e2e0,{x:-5.38,y:.08,z:1.89,sx:.72,sy:.16,sz:.63});
 }
 return{kind:variant?'sheltered-sled-camp':'wind-cut-sled-pass',name:variant?'雪脊背风歇脚处':'风蚀雪橇山口',focus:{x:sledX,y:.45,z:.85+shift}};
}

export function buildWoodlandPlace(biome,kit,variant=0){
 if(biome==='forest')return forest(kit,variant);
 if(biome==='snow')return snow(kit,variant);
 return null;
}

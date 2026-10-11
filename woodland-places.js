import * as T from './vendor/three.module.js';
import {naturalRockGeometry} from './biome-scenery.js?v=154';

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
 return surface(p,indices,c);
}
function ridgeSection(side,t){
 const z=-7.25+t*14.5,bulge=Math.sin(Math.PI*t)**.35,bay=side>0?Math.max(0,1-((z-.8)/3.7)**2)**2:0;
 return{z,bulge,bay,center:side*(6.05+.17*Math.sin(t*7)+bay*.68),width:(.30+bulge*1.61)*(1+.045*Math.sin(t*19))*(1-bay*.12),height:(.10+bulge*(2.42+.52*Math.sin(t*9+.6)+.30*Math.sin(t*22)))*(1-bay*.23)};
}
function ridge(side,snow=false){
 const p=[],indices=[],colors=[],rows=19;
 for(let row=0;row<rows;row++){
  const t=row/(rows-1),{z,center,width,height}=ridgeSection(side,t);
  // Rock faces form one connected ridge. The separate snow lid rests directly
  // on its upper three shoulders; no snow spheres stacked along the skyline.
  const section=snow?[[-.84,.39],[-.51,.86],[-.12,1.02],[.39,.90],[.83,.47]]:[[-1,-.04],[-.84,.36],[-.49,.82],[-.10,1],[.42,.86],[.88,.43],[1,-.04]];
  for(let j=0;j<section.length;j++){
   const [cross,high]=section[j],x=center+cross*width,y=high<0?-.08:height*high+(snow?.045:0),shade=snow?.84+high*.15:.62+high*.32+.055*Math.sin(t*24+j);
   p.push(x,y,z);colors.push(shade*(snow?1:.96),shade,shade*(snow?1.02:1.06));
   if(row&&j){const n=p.length/3-1,nc=section.length;indices.push(n,n-nc,n-1,n-1,n-nc,n-nc-1);}
  }
 }
 const g=surface(p,indices,colors);
 // Keep the front faces outward on both sides; base vertices sit below soil.
 g.computeVertexNormals();return g;
}

function forest(kit){
 const add=(category,g,color,transform)=>kit.piece(category,g,color,transform),wood=0x655443;
 const trunk=[[-6.0,.96,-5.5],[-5.45,1.08,-2.6],[-5.16,.96,.5],[-5.60,.79,3.1],[-6.12,.70,5.9]];
 add('wood',limb(trunk,[.87,.90,.78,.67,.53],32,28,true),wood);
 add('wood',brokenEnd(trunk[4],[-.30,-.04,1],.54),0xb69a70);
 add('wood',brokenEnd(trunk[0],[-.14,.04,-1],.84),0x8f795b);
 const trunkCurve=new T.CatmullRomCurve3(trunk.map(p=>new T.Vector3(...p)));
 for(let i=0;i<=18;i++){
  const t=i/18,p=trunkCurve.getPointAt(t),at=t*4,r=[.87,.90,.78,.67,.53],radius=T.MathUtils.lerp(r[Math.floor(at)],r[Math.min(4,Math.floor(at)+1)],at%1);
  kit.solid(p.x,p.z,1.06,p.y+radius*1.08+.12);
 }
 // The uprooted butt has lateral roots curling down into the soil, rather than
 // another upright trunk. All of it remains on the left of the passage.
 for(let i=0;i<9;i++){
  const a=i*2.399,reach=1.12+(i%3)*.20,tip=[-6.15+Math.cos(a)*reach,.03,-5.95+Math.sin(a)*reach];
  add('wood',limb([[-6.02,1.00,-5.48],[-6.12+Math.cos(a)*.48,1.12+(i%3)*.29,-5.86+Math.sin(a)*.48],tip],[.24,.16,.025],12,8),i%2?0x574b3e:0x6d5b45);
 }
 kit.solid(-6.13,-5.83,1.95,2.10);
 for(const [z,side]of[[-2.3,-1],[1.0,1],[3.6,-1]]){
  const x=-5.45,tip=[x+side*.65,.09,z+.92];
  add('wood',limb([[x,1.08,z],[x+side*.54,.86,z+.4],tip],[.22,.14,.025],10,8),0x584b3c);kit.solid(x+side*.32,z+.40,.61,1.36);
 }
 // Moss drapes across the sunken bark, with broad irregular patches continuing
 // on the ground; a few fans of fronds supply a readable soft silhouette.
 for(let i=0;i<23;i++){
  const t=.025+i/22*.95,p=trunkCurve.getPointAt(t),at=t*4,radii=[.87,.90,.78,.67,.53],radius=T.MathUtils.lerp(radii[Math.floor(at)],radii[Math.min(4,Math.floor(at)+1)],at%1);
  add('leaf',naturalRockGeometry.clone(),i%3?0x647647:0x788651,{x:p.x+.13*Math.sin(i*2.4),y:p.y+radius*.91,z:p.z,sx:.30+(i%3)*.04,sy:.07,sz:.43,ry:i*.73});
 }
 for(const side of[-1,1])for(let i=0;i<12;i++){
  const z=-6.4+i*1.11,x=side*(4.11+.33*Math.sin(i*1.73));
  add('leaf',naturalRockGeometry.clone(),i%3?0x526741:0x77804e,{x:x+side*.27,y:.035,z,sx:.68,sy:.11,sz:.80,ry:i*.63});
  for(let j=0;j<3;j++)add('leaf',frond(),j%2?0x6f8a52:0x4f7044,{x:x+side*.08,y:.02,z:z+.13*j,ry:j*2.12+i*.4,sx:.85,sy:1,sz:.94});
 }
 // South-east: a collapsed carrier's sleeping platform, folded canvas and a
 // cold hearth. The planks are low and broken; nothing resembles another tower.
 for(let i=0;i<6;i++)add('wood',new T.BoxGeometry(.32,.14,2.7-(i%3)*.22),i%2?0x79634b:0x665943,{x:5.13+i*.35,y:.18+(i%2)*.025,z:2.78,ry:.04*Math.sin(i),rz:.02*Math.cos(i)});
 for(const z of[1.68,3.68]){add('wood',limb([[4.90,.14,z],[5.8,.13,z+.03],[7.12,.10,z-.12]],[.13,.14,.07],8,8),0x574d3e);}
 add('cloth',new T.SphereGeometry(1,14,8),0x827962,{x:6.17,y:.35,z:3.14,sx:.80,sy:.19,sz:.89,ry:-.18});kit.solid(6.09,2.92,1.34,.60);
 const hearth={x:6.45,z:-2.85};
 add('stone',naturalRockGeometry.clone(),0x49463d,{x:hearth.x,y:.016,z:hearth.z,sx:.71,sy:.065,sz:.70});
 for(let i=0;i<9;i++){const a=i/9*Math.PI*2;add('stone',naturalRockGeometry.clone(),i%2?0x7f8170:0x64695d,{x:hearth.x+Math.cos(a)*.72,y:.10,z:hearth.z+Math.sin(a)*.65,sx:.25,sy:.20,sz:.23,ry:a});}
 for(let i=0;i<3;i++)add('wood',limb([[6.08+i*.15,.06,-3.12],[6.32+i*.12,.08,-2.90],[6.67+i*.09,.065,-2.65]],[.09,.10,.07],6,7),0x302f2a);
 return{kind:'fallen-giant-camp',name:'倒木行旅营地',focus:{x:-5.5,y:1.15,z:.3}};
}

function snow(kit){
 const add=(category,g,color,transform)=>kit.piece(category,g,color,transform);
 for(const side of[-1,1]){
  add('stone',ridge(side),side<0?0x667b82:0x778891);
  add('snow',ridge(side,true),0xdde5df);
  // Overlapping footprint cylinders represent the continuous rock wall. Their
  // inside edge remains outside x=±3.1 even at the widest wind-scoured shoulder.
  for(let z=-6.8;z<=6.81;z+=.68){
   const t=(z+7.25)/14.5,{center,bulge,bay}=ridgeSection(side,t),height=Math.max(...[-.05,0,.05].map(d=>ridgeSection(side,T.MathUtils.clamp(t+d,0,1)).height))*1.02+.09;
   kit.solid(center,z,.50+bulge*1.64-bay*.15,height);
  }
  // Dark blue seams follow the inward face, with inset milky ice plates above.
  for(let i=0;i<8;i++){
   const z=-5.9+i*1.64,{center,width}=ridgeSection(side,(z+7.25)/14.5),x=center-side*width*.72,height=.46+(i%3)*.15;
   add('ice',naturalRockGeometry.clone(),i%2?0xa5c4cb:0x739da9,{x,y:height*.62,z,sx:.34,sy:height,sz:.95,ry:.14*Math.sin(i)});
   add('ice',limb([[x-side*.17,.17,z-.48],[x-side*.22,.46,z-.16],[x-side*.18,.64,z+.02]],[.023,.027,.016],6,5),0x446b7d);
  }
 }
 // A half-buried freight sled lies against the east ridge. The broken runner
 // curls upward once, while the deck and remaining crosspieces lean into snow.
 const sledX=5.12;
 for(const side of[-1,1])add('wood',limb([[sledX+side*.62,.08,-1.05],[sledX+side*.62,.16,.65],[sledX+side*.62,.26,2.44],[sledX+side*.55,.73,2.98]],[.12,.12,.10,.065],18,8),0x645b4b);
 for(let i=0;i<7;i++)add('wood',new T.BoxGeometry(1.45-(i===2?.45:0),.11,.27),i%2?0x978571:0x7c7161,{x:sledX+(i===2?.25:0),y:.28+i*.025,z:-.72+i*.43,ry:i===2?.22:.025*Math.sin(i),rz:-.08});
 add('wood',limb([[5.74,.27,.95],[6.02,.65,1.08],[6.10,.94,1.23]],[.065,.065,.025],7,7),0x696355);
 for(const z of[-.70,.13,.96,1.79,2.62])kit.solid(sledX,z,.94,z>2?1.05:.64);
 for(const [x,z,sx,sz]of[[5.92,-.45,.66,1.12],[5.76,1.58,.53,.81],[4.85,2.78,.57,.39]])add('snow',naturalRockGeometry.clone(),0xe0e8e3,{x,y:.29,z,sx,sy:.23,sz,ry:.4});
 // Small wind lips touch the soil and point along the pass, never cover it.
 for(const side of[-1,1])for(let i=0;i<7;i++)add('snow',naturalRockGeometry.clone(),i%2?0xd3e1df:0xc4d7db,{x:side*(4.06+.16*Math.sin(i)),y:.035,z:-6+i*1.9,sx:.37,sy:.13,sz:.88,ry:.06});
 return{kind:'wind-cut-sled-pass',name:'风蚀雪橇山口',focus:{x:5.12,y:.45,z:.85}};
}

export function buildWoodlandPlace(biome,kit){
 if(biome==='forest')return forest(kit);
 if(biome==='snow')return snow(kit);
 return null;
}

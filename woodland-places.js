import * as T from './vendor/three.module.js';
import {naturalRockGeometry} from './biome-scenery.js?v=198';

// Authored in local space: the route runs along Z, with |x| < 3.1 kept clear.
// The installer owns placement, batching, materials, colliders and disposal.
function surface(positions,indices,colors){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);
 if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
// Edge wear is cut inward, so old plank poses and collision heights still apply.
function weatheredPlank(w,h,d,seed){
 const half=[w/2,h/2,d/2],axis=w>=h&&w>=d?0:d>=h?2:1,steps=half.map((_,i)=>i===axis?5:2),g=new T.BoxGeometry(w,h,d,...steps),p=g.attributes.position,colors=[],v=new T.Vector3(),core=new T.Vector3(),bevel=Math.min(.018,h*.17,w*.12,d*.12);
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);const along=v.getComponent(axis)/half[axis],across=v.getComponent(axis===0?2:0),edge=Math.abs(along);
  for(let j=0;j<3;j++)core.setComponent(j,T.MathUtils.clamp(v.getComponent(j),-half[j]+bevel,half[j]-bevel));
  v.sub(core).normalize().multiplyScalar(bevel).add(core);
  const split=(.018+.018*Math.sin(across*27+seed*1.7)**8)*edge**8;
  v.setComponent(axis,v.getComponent(axis)*(1-split));
  if(axis!==1)v.y-=.006*(1-along*along)*(v.y/half[1]+1)*.5;
  p.setXYZ(i,v.x,v.y,v.z);const shade=.91+.05*Math.sin(across*19+seed)-edge**8*.13;colors.push(shade,shade,shade);
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.name='SM_Woodland_WornPlank_A';return g;
}
function foldedCanvas(){
 const g=new T.BoxGeometry(2,2,2,12,2,12),p=g.attributes.position,colors=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),corner=Math.max(0,Math.abs(x)+Math.abs(z)-1.6),fold=.075*Math.sin(z*15+x*.9)+.035*Math.sin(x*11+z*3),hem=Math.exp(-(((z+.63)/.075)**2));
  p.setXYZ(i,x*(.94-corner*.11),y>0?.68+fold-hem*.13:y<0?-.70+fold*.22:fold,z*(.98-corner*.09));
  const shade=(y>0?.98:y<0?.62:.79)-hem*.12+.025*Math.sin(z*15+x*.9);colors.push(shade,shade,shade);
 }
 g.computeVertexNormals();g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.name='SM_Forest_FoldedCanvas_A';return g;
}
// Snow feathers down to the ground instead of forming a floating round cap.
function sledDrift(width,height,depth,seed){
 const p=[],c=[],indices=[],sides=20,rings=5;
 for(let row=0;row<=rings;row++)for(let j=0;j<=sides;j++){
  const t=row/rings,a=j/sides*Math.PI*2,edge=.90+.055*Math.sin(a*3+seed)+.035*Math.cos(a*5-seed),r=t*edge,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const y=height*Math.max(0,1-t*t)**1.35*(.83+.10*x-.06*z)-.032*t**8,shade=.91+.065*(1-t)+.017*Math.sin(a*3+seed)*t;
  p.push(x*width,y,z*depth);c.push(shade*.98,shade,shade*1.015);
  if(row&&j){const n=p.length/3-1;indices.push(n,n-1,n-sides-1,n-1,n-sides-2,n-sides-1);}
 }
 const g=surface(p,indices,c);g.name='SM_Snow_SledDrift_A';return g;
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
const rockSection=[[-1,-.04],[-.84,.36],[-.49,.82],[-.10,1],[.42,.86],[.88,.43],[1,-.04]];
// Broad intersecting strata clip only the visible ridge, never its collision
// envelope. Snow interpolates the actual rock triangles instead of a round lid.
function ridgeFaceHeight(height,cross,t,variant){
 const cut=.79+.055*Math.sin(t*15+variant*.8);
 for(let i=1;i<rockSection.length;i++)if(cross<=rockSection[i][0]){
  const [a,low]=rockSection[i-1],[b,upper]=rockSection[i],from=low<0?-.08:height*Math.min(low,cut+a*.13,.92-a*.19),to=upper<0?-.08:height*Math.min(upper,cut+b*.13,.92-b*.19);
  return T.MathUtils.lerp(from,to,(cross-a)/(b-a));
 }
 return-.08;
}
function ridge(side,snow=false,variant=0){
 const p=[],indices=[],colors=[],rows=19;
 for(let row=0;row<rows;row++){
  const t=row/(rows-1),{z,center,width,height}=ridgeSection(side,t,variant);
  // Rock faces form one connected ridge. The separate snow lid rests directly
  // on its upper three shoulders; no snow spheres stacked along the skyline.
  const wind=.12+.16*(.5+.5*Math.sin(t*15+variant+side)),section=snow?[[-.84+wind,.39],[-.49,.82],[-.10,1],[.42,.86],[.83-wind*.65,.47]]:rockSection;
  for(let j=0;j<section.length;j++){
   const [cross,high]=section[j],x=center+cross*width,y=ridgeFaceHeight(height,cross,t,variant)+(snow?.039+.013*Math.sin(t*13+j+variant)**2:0),shade=snow?.84+high*.15:.62+high*.32+.055*Math.sin(t*24+j);
   p.push(x,y,z);colors.push(shade*(snow?1:.96),shade,shade*(snow?1.02:1.06));
   if(row&&j){const n=p.length/3-1,nc=section.length;indices.push(n,n-nc,n-1,n-1,n-nc,n-nc-1);}
  }
 }
 const g=surface(p,indices,colors);g.name=snow?'SM_Snow_RidgeCap_A':'SM_Snow_RockRidge_A';
 // Keep the front faces outward on both sides; base vertices sit below soil.
 g.computeVertexNormals();return g;
}

// Clip the actual visible ridge triangles, then lift by one centimetre. Thin
// ice cannot float above a differently interpolated rock surface or form bulbs.
function ridgeIce(rock,side,row,seed,seam=false){
 const p=[],colors=[],indices=[],source=rock.attributes.position,col=side<0?5:2;
 const width=.09+.14*Math.sin(seed*2.17+.8)**2,height=.28+.36*Math.cos(seed*1.73+.4)**2;
 const left=side<0?.74+.018*Math.cos(seed)**2:.012+.04*Math.cos(seed)**2,bottom=.10+.22*Math.sin(seed*1.39+.2)**2;
 const outline=[[.05,.12],[.54,0],[.90,.17],[.98,.48],[.72,.90],[.33,1],[0,.60]].map(([u,v])=>[left+u*width,bottom+v*height]);
 const limits=outline.map((a,i)=>{const b=outline[(i+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1];return[-dy,dx,dy*a[0]-dx*a[1]];});
 // The fine oblique fracture is clipped by the same irregular outer rim.
 if(seam){const c=-left/width+.26*bottom/height;limits.push([1/width,-.26/height,c-.32],[-1/width,.26/height,-c+.37]);}
 for(let triangle=0;triangle<2;triangle++){
  const offset=((row-1)*6+col-1)*6+triangle*3;
  let polygon=Array.from({length:3},(_,j)=>{const i=rock.index.getX(offset+j);return[i%7===col?1:0,Math.floor(i/7)===row?1:0,source.getX(i),source.getY(i),source.getZ(i)];});
  for(const [u,v,c]of limits){
   const clipped=[];
   for(let j=0;j<polygon.length;j++){
    const a=polygon[j],b=polygon[(j+1)%polygon.length],distanceA=u*a[0]+v*a[1]+c,distanceB=u*b[0]+v*b[1]+c,insideA=distanceA>=0,insideB=distanceB>=0;
    if(insideA)clipped.push(a);
    if(insideA!==insideB){const t=distanceA/(distanceA-distanceB);clipped.push(a.map((value,k)=>T.MathUtils.lerp(value,b[k],t)));}
   }
   polygon=clipped;
  }
  const start=p.length/3;
  for(const v of polygon){p.push(v[2],v[3]+(seam?.013:.009),v[4]);const shade=.89+.075*v[1]+.035*Math.sin(seed+v[0]*4);colors.push(shade,shade,shade);}
  for(let j=1;j<polygon.length-1;j++)indices.push(start,start+j,start+j+1);
 }
 const g=surface(p,indices,colors);g.name=seam?'SM_Snow_RidgeIceSeam_A':'SM_Snow_RidgeIceFilm_A';return g;
}

// A thin connected drift touches the rock's inner shoulder and feathers into
// the soil. The clear central path remains wider than the authored 6.2 metres.
function snowSkirt(side,variant){
 const p=[],colors=[],indices=[];
 for(let row=0;row<19;row++){
  const t=row/18,{z,center,width,height,bay}=ridgeSection(side,t,variant),foot=center-side*width*.83,tip=side*(3.48+.13*Math.sin(t*17+variant)**2),scoured=1-T.MathUtils.smoothstep(bay,.02,.18);
  for(let j=0;j<3;j++){
   const u=j/2,x=T.MathUtils.lerp(foot,tip,u),y=j===0?ridgeFaceHeight(height,-side*.83,t,variant)*scoured+.047:j===1?.026+.055*Math.sin(t*13+variant)**2:-.045,shade=.88+(1-u)*.08;
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
  const a=i*2.399+variant*.4,reach=1.12+(i%3)*.20,tip=[rootX+Math.cos(a)*reach,-.058,rootZ+Math.sin(a)*reach],knee=[rootX+Math.cos(a)*reach*.77-Math.sin(a)*.07,.11+(i%2)*.03,rootZ+Math.sin(a)*reach*.77+Math.cos(a)*.07];
  const root=limb([[butt[0]-.02,butt[1]+.04,butt[2]+.02*direction],[rootX+Math.cos(a)*.48,1.12+(i%3)*.29,rootZ+Math.sin(a)*.48],knee,tip],[.24,.16,.065,.009],12,8,true);root.name='SM_Forest_BuriedRoot_A';
  add('wood',root,i%2?0x574b3e:0x6d5b45);
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
 for(let i=0;i<6;i++)add('wood',weatheredPlank(.32,.14,2.7-(i%3)*.22-(variant&&i===2?.65:0),i+variant*7),i%2?0x79634b:0x665943,{x:5.13+i*.35,y:.18+(i%2)*.025,z:campZ+(variant?.15*Math.sin(i):0),ry:(variant?.13:.04)*Math.sin(i),rz:.02*Math.cos(i)});
 for(const z of[campZ-1.1,campZ+.9]){add('wood',limb([[4.90,.14,z],[5.8,.13,z+.03],[7.12,.10,z-.12]],[.13,.14,.07],8,8),0x574d3e);}
 add('cloth',foldedCanvas(),0x827962,{x:6.17,y:.35,z:campZ+.36,sx:variant?.56:.80,sy:variant?.22:.19,sz:variant?1.03:.89,ry:variant?.24:-.18});kit.solid(6.09,campZ+.14,1.34,.60);
 const hearth={x:variant?6.10:6.45,z:variant?2.70:-2.85};
 add('stone',naturalRockGeometry.clone(),0x49463d,{x:hearth.x,y:.016,z:hearth.z,sx:.71,sy:.065,sz:.70});
 for(let i=0;i<9;i++){const a=i/9*Math.PI*2;add('stone',naturalRockGeometry.clone(),i%2?0x7f8170:0x64695d,{x:hearth.x+Math.cos(a)*.72,y:.10,z:hearth.z+Math.sin(a)*.65,sx:.25,sy:.20,sz:.23,ry:a});}
 for(let i=0;i<3;i++)add('wood',limb([[hearth.x-.37+i*.15,.06,hearth.z-.27],[hearth.x-.13+i*.12,.08,hearth.z-.05],[hearth.x+.22+i*.09,.065,hearth.z+.20]],[.09,.10,.07],6,7),0x302f2a);
 return{kind:variant?'root-sheltered-waycamp':'fallen-giant-camp',name:variant?'根盘背风营地':'倒木行旅营地',focus:{x:-5.5,y:1.15,z:variant?2.4:.3}};
}

function snow(kit,variant){
 const add=(category,g,color,transform)=>kit.piece(category,g,color,transform);
 for(const side of[-1,1]){
  const rock=ridge(side,false,variant);add('stone',rock,side<0?0x667b82:0x778891);
  add('snow',ridge(side,true,variant),0xdde5df);
  add('snow',snowSkirt(side,variant),0xd3e1df);
  // Overlapping footprint cylinders represent the continuous rock wall. Their
  // inside edge remains outside x=±3.1 even at the widest wind-scoured shoulder.
  for(let z=-6.8;z<=6.81;z+=.68){
   const t=(z+7.25)/14.5,{center,bulge,bay}=ridgeSection(side,t,variant),height=Math.max(...[-.05,0,.05].map(d=>ridgeSection(side,T.MathUtils.clamp(t+d,0,1),variant).height))*1.02+.09;
   kit.solid(center,z,.50+bulge*1.64-bay*.15,height);
  }
  // Small milky ice fractures cling to exposed rock below the snow shoulder.
  for(let i=0;i<8;i++){
   const z=-5.9+i*1.64,row=T.MathUtils.clamp(Math.round((z+7.25)/14.5*18),1,18),seed=i+variant*9;
   add('ice',ridgeIce(rock,side,row,seed),i%2?0x879a9c:0x7c9096);
   add('ice',ridgeIce(rock,side,row,seed,true),0x697e84);
  }
 }
 // A half-buried freight sled lies against the east ridge. The broken runner
 // curls upward once, while the deck and remaining crosspieces lean into snow.
 const sign=variant?-1:1,sledX=5.12*sign,shift=variant?-2.05:0,point=([x,y,z])=>[x*sign,y,z+shift];
 for(const side of[-1,1])add('wood',limb([[5.12+side*.62,.08,-1.05],[5.12+side*.62,.16,.65],[5.12+side*.62,.26,2.44],[5.12+side*.55,.73,2.98]].map(point),[.12,.12,.10,.065],18,8),0x645b4b);
 for(let i=0;i<7;i++)add('wood',weatheredPlank(1.45-(i===2?.45:0)-(variant&&i===5?.32:0),.11,.27,i+variant*7),i%2?0x978571:0x7c7161,{x:sledX+(i===2?.25*sign:0),y:.28+i*.025,z:shift-.72+i*.43,ry:i===2?.22:variant&&i===5?-.28:.025*Math.sin(i),rz:-.08*sign});
 add('wood',limb([[5.74,.27,.95],[6.02,.65,1.08],[6.10,.94,1.23]].map(point),[.065,.065,.025],7,7),0x696355);
 for(const z of[-.70,.13,.96,1.79,2.62])kit.solid(sledX,z+shift,.94,z>2?1.05:.64);
 for(const [i,[x,z,sx,sz]]of[[5.92,-.45,.66,1.12],[5.76,1.58,.53,.81],[4.85,2.78,.57,.39]].entries())add('snow',sledDrift(sx,.51,sz,i+variant*3),0xe0e8e3,{x:x*sign,z:z+shift,ry:.4});
 if(variant){
  // The abandoned load became a low windbreak beside the western bay, rather
  // than a second identical freight sled. Its visible slats remain jumpable.
  for(let i=0;i<5;i++)add('wood',weatheredPlank(.18,.62-i*.045,.16,i+20),i%2?0x776958:0x625b50,{x:-4.65-i*.25,y:.30-i*.018,z:1.70+.08*Math.sin(i),rz:.08*Math.sin(i)});
  add('wood',limb([[-4.68,.43,1.76],[-5.22,.39,1.70],[-5.72,.28,1.65]],[.05,.05,.035],7,6),0x645d50);
  kit.solid(-5.16,1.71,.78,.70);
  add('snow',sledDrift(.72,.25,.63,7),0xd5e2e0,{x:-5.38,z:1.89});
 }
 return{kind:variant?'sheltered-sled-camp':'wind-cut-sled-pass',name:variant?'雪脊背风歇脚处':'风蚀雪橇山口',focus:{x:sledX,y:.45,z:.85+shift}};
}

export function buildWoodlandPlace(biome,kit,variant=0){
 if(biome==='forest')return forest(kit,variant);
 if(biome==='snow')return snow(kit,variant);
 return null;
}

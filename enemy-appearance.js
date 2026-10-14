import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {prepareCreatureSurface,installCreatureSurface} from './creature-surface.js?v=194';

// Five finite, shared sets of geometry. Articulation moves groups, never vertices.
const templates=new Map();
const combatHeights={mushroom:1.3615263199806213,wolf:1.350000011920929,golem:2.1435913920402525,spitter:1.8900000041723253,shaman:1.8900000041723253};
const skin=new T.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0});
const light=new T.MeshStandardMaterial({vertexColors:true,roughness:.6,emissive:0xffffff,emissiveIntensity:.35});
installCreatureSurface(skin);
function colored(g,color){
 const c=new T.Color(color),p=g.attributes.position,a=[];
 for(let i=0;i<p.count;i++)a.push(c.r,c.g,c.b);
 g.setAttribute('color',new T.Float32BufferAttribute(a,3));g.deleteAttribute('uv');return g;
}
function piece(g,color,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
 g.scale(sx,sy,sz);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);return colored(g,color);
}
const oval=(c,x,y,z,sx,sy,sz,sides=10,rings=6)=>piece(new T.SphereGeometry(1,sides,rings),c,x,y,z,sx,sy,sz);
const rock=(c,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>piece(new T.IcosahedronGeometry(1,0),c,x,y,z,sx,sy,sz,rx,ry,rz);
function profile(points,color,{x=0,y=0,z=0,depth=1,bend=0,flute=0,segments=16,lip=0}={}){
 const g=new T.LatheGeometry(points.map(([r,h])=>new T.Vector2(r,h)),segments),p=g.attributes.position;
 const height=Math.max(...points.map(v=>Math.abs(v[1])))||1;
 for(let i=0;i<p.count;i++){
  const py=p.getY(i),angle=Math.atan2(p.getZ(i),p.getX(i)),wave=1+flute*Math.cos(angle*7)*(1-py/height);
  const edge=T.MathUtils.smoothstep(Math.hypot(p.getX(i),p.getZ(i)),.28,.62),ripple=1+lip*edge*Math.sin(angle*5+.7);
  p.setXYZ(i,p.getX(i)*wave*ripple+bend*(py/height)**2,py+lip*edge*(Math.sin(angle*3)+.4*Math.cos(angle*7)),p.getZ(i)*wave*ripple*depth);
 }
 g.computeVertexNormals();return piece(g,color,x,y,z);
}
function branch(c,points,radius=.035,segments=10){
 return colored(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,radius,5,false),c);
}
// Curved, tapered growth: roots and foliage belong to the creature's silhouette.
function rootlet(c,points,radii){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,6,1,6,false),p=g.attributes.position,n=g.attributes.normal;
 for(let row=0;row<=6;row++){const u=row/6,k=u*(radii.length-1),a=Math.min(radii.length-2,Math.floor(k)),r=T.MathUtils.lerp(radii[a],radii[a+1],k-a),at=curve.getPointAt(u);for(let j=0;j<=6;j++){const i=row*7+j;p.setXYZ(i,at.x+n.getX(i)*r,at.y+n.getY(i)*r,at.z+n.getZ(i)*r);}}
 g.computeVertexNormals();return colored(g,c);
}
function frond(c,x,y,z,width,length,tilt=0){
 const p=[],ix=[];
 for(let row=0;row<=7;row++){const u=row/7,w=Math.sin(Math.PI*u)*width*(1-.3*u),cy=y-length*u,cz=z+.09*Math.sin(u*Math.PI);for(const side of[-1,0,1])p.push(x+side*w+tilt*u,cy+Math.abs(side)*.025,cz+(side===0?.028:0));}
 for(let row=0;row<7;row++)for(let col=0;col<2;col++){const i=row*3+col;ix.push(i,i+3,i+1,i+1,i+3,i+4);}
 // Separate back vertices: reversed triangles sharing front vertices cancel
 // their normals and make the leaf look like torn black holes.
 const count=p.length/3,front=[...ix];for(let i=0;i<count;i++)p.push(p[i*3],p[i*3+1],p[i*3+2]-.008);
 for(let i=0;i<front.length;i+=3)ix.push(front[i]+count,front[i+2]+count,front[i+1]+count);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return colored(g,c);
}
function wolfCoat(rings,head=false){
 const p=[],indices=[],sides=16;
 // Shared ring vertices give the shoulder, throat and muzzle one continuous
 // surface without the seams left by overlapping ellipsoids.
 for(const [z,rx,ry,y]of rings.slice(1,-1))for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;p.push(Math.cos(a)*rx,y+Math.sin(a)*ry,z);}
 for(let j=0;j<rings.length-3;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
 for(const end of[0,1]){const ring=rings[end?rings.length-1:0],center=p.length/3,offset=end?(rings.length-3)*sides:0;p.push(0,ring[3],ring[0]);for(let i=0;i<sides;i++){const a=offset+i,b=offset+(i+1)%sides;indices.push(...(end?[center,a,b]:[center,b,a]));}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();colored(g,0x677574);
 const c=g.attributes.color,base=new T.Color(head?0x8b948b:0x79827b),belly=new T.Color(0xc3c2ad),back=new T.Color(0x424e4b),shade=new T.Color();
 for(let i=0;i<c.count;i++){const x=p[i*3],y=p[i*3+1],z=p[i*3+2],low=1-T.MathUtils.smoothstep(y,head?-.14:.50,head?-.015:.76),ridge=T.MathUtils.smoothstep(y,head?.07:.83,head?.23:1.07)*(1-Math.min(1,Math.abs(x)/.26)),throat=head?0:T.MathUtils.smoothstep(z,.15,.46)*(1-T.MathUtils.smoothstep(y,.79,.98));shade.copy(base).lerp(belly,Math.max(low*.76,throat*.66)).lerp(back,ridge*.78);c.setXYZ(i,shade.r,shade.g,shade.b);}
 return g;
}
function boulder(c,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
 const g=new T.IcosahedronGeometry(1,1),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),d=p.getZ(i),wear=.93+.045*Math.sin(a*8+b*5-d*7);p.setXYZ(i,a*wear,b*(.95+.035*Math.cos(d*8+a*5)),d*wear);}
 g.computeVertexNormals();piece(g,c,x,y,z,sx,sy,sz,rx,ry,rz);
 const colors=g.attributes.color,normal=g.attributes.normal,base=new T.Color(c),moss=new T.Color(0x637047),shade=new T.Color();
 for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),d=p.getZ(i),patch=.5+.5*Math.sin(a*19+b*11+d*13),up=T.MathUtils.smoothstep(normal.getY(i),.2,.8);shade.copy(base).multiplyScalar(.87+.17*patch).lerp(moss,up*T.MathUtils.smoothstep(patch,.38,.78)*.62);colors.setXYZ(i,shade.r,shade.g,shade.b);}
 return g;
}
const capTop=r=>r<.19?.35-r/.19*.01:r<.44?.34-(r-.19)/.25*.07:r<.60?.27-(r-.44)/.16*.13:.14-(r-.60)/.04*.11;
function capPatch(x,z,rx,rz,c){
 const points=[x,capTop(Math.hypot(x,z))+.008,z*.95],indices=[];
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2,px=x+Math.cos(a)*rx,pz=z+Math.sin(a)*rz;points.push(px,capTop(Math.hypot(px,pz))+.008,pz*.95);indices.push(0,(i+1)%8+1,i+1);}
 for(let i=0;i<points.length;i+=3){const px=points[i],pz=points[i+2]/.95,a=Math.atan2(pz,px),edge=T.MathUtils.smoothstep(Math.hypot(px,pz),.28,.62),ripple=1+.018*edge*Math.sin(a*5+.7);points[i]*=ripple;points[i+1]+=.018*edge*(Math.sin(a*3)+.4*Math.cos(a*7));points[i+2]*=ripple;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return colored(g,c);
}
function capGills(){
 const positions=[],indices=[];
 for(let i=0;i<28;i++){const a=i/28*Math.PI*2,start=i%2?.28:.19,base=positions.length/3;
  for(const r of[start,.42,.60]){const h=-.123+Math.max(0,r-.27)*.32,angle=a+.025*Math.sin(r*9+i);for(const y of[h,h-(r===.60?.012:.037)])positions.push(Math.cos(angle)*r,y,Math.sin(angle)*r*.95);}
  for(let j=0;j<2;j++){const n=base+j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2,n+2,n+1,n,n+2,n+3,n+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return colored(flat,0xb2946e);
}
function joined(parts){
 // Mixed primitives use different index formats. One non-indexed batch per moving part.
 const flat=parts.map(p=>p.index?p.toNonIndexed():p),g=mergeGeometries(flat,false);
 for(const p of new Set([...parts,...flat]))p.dispose();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
// Two lids are one cached batch; the upper edge stays fixed as the lid closes.
function lids(c,x,w,h){return joined([-1,1].map(side=>oval(c,side*x,-h,0,w,h,.013,10,6)));}
function template(kind){
 if(templates.has(kind))return templates.get(kind);const p={};
 if(kind==='mushroom'){
  p.body=joined([
   profile([[0,.14],[.18,.155],[.265,.23],[.28,.35],[.225,.56],[.184,.79],[.19,.90],[0,.94]],0xc4b491,{depth:.87,bend:-.025,flute:.022,segments:20}),
   ...[-1,1].flatMap(s=>[branch(0x736343,[[s*.17,.47,.17],[s*.12,.65,.20],[s*.075,.80,.18]],.016,6),oval(0x342f28,s*.083,.70,.180,.036,.024,.018),oval(0xc1c57b,s*.083,.70,.194,.020,.009,.006)]),
   ...[-1,0,1].map(s=>rootlet(0x9c8964,[[s*.15,.19,.15],[s*.13,.32,.216],[s*.09,.47,.208]],[.011,.015,.004])),
   ...[-1,1].map(s=>rootlet(0xb5a67a,[[s*.20,.44,.025],[s*.25,.29,.08],[s*.30,.24,.13]],[.067,.048,.006]))
  ]);
  const cap=[profile([[0,-.10],[.29,-.12],[.56,-.055],[.625,-.003],[.64,.03],[.625,.076],[.60,.14],[.44,.27],[.19,.34],[0,.35]],0x985239,{depth:.95,segments:28,lip:.018}),
   profile([[0,-.116],[.27,-.12],[.53,-.059],[.622,.008]],0xc6ad86,{depth:.95,segments:28,lip:.018}),capGills()];
  for(let i=0;i<11;i++){const a=i*2.399,r=.16+(i%4)*.089;cap.push(capPatch(Math.cos(a)*r,Math.sin(a)*r,.037+i%2*.022,.028+i%3*.009,i%2?0xe1cc9e:0xc3a478));}
  p.cap=joined(cap);const capColors=p.cap.attributes.color,capPos=p.cap.attributes.position;for(let i=0;i<capColors.count;i++){const r=Math.hypot(capPos.getX(i),capPos.getZ(i)/.95),y=capPos.getY(i);if(y>.025){const band=1-.09*Math.exp(-(((r-.49)/.065)**2)),edge=.96+.04*Math.sin(Math.atan2(capPos.getZ(i),capPos.getX(i))*6+.4);capColors.setXYZ(i,capColors.getX(i)*band*edge,capColors.getY(i)*band*edge,capColors.getZ(i)*band*edge);}}p.foot=joined([profile([[0,.10],[.07,.08],[.095,-.025],[0,-.06]],0xa88e65,{depth:1.2,segments:10}),...[-1,0,1].map(s=>rootlet(0x93815d,[[s*.025,0,0],[s*.045,-.032,.09],[s*.077,-.042,.17]],[.044,.028,.002]))]);
 }else if(kind==='wolf'){
  p.body=joined([wolfCoat([[-.58,0,0,.69],[-.49,.19,.205,.675],[-.34,.245,.255,.695],[-.13,.215,.228,.728],[.055,.264,.30,.755],[.23,.277,.325,.775],[.36,.221,.27,.81],[.465,.168,.215,.86],[.57,.13,.155,.89],[.61,0,0,.90]])]);
  p.head=joined([
   wolfCoat([[-.25,0,0,.045],[-.20,.135,.175,.042],[-.075,.245,.216,.04],[.075,.205,.194,.018],[.19,.18,.16,-.008],[.29,.132,.108,-.055],[.397,.091,.069,-.055],[.437,0,0,-.044]],true),
   oval(0x354039,0,-.150,.32,.105,.025,.14),
   ...[-1,1].flatMap(s=>[oval(0x34463e,s*.155,.08,.180,.056,.031,.046),oval(0xdcc181,s*.163,.083,.215,.025,.013,.011),oval(0x334035,s*.166,.085,.225,.006,.013,.006,6,4),oval(0xe8ddbe,s*.156,.088,.232,.0035,.003,.002,6,4),rock(0x667970,s*.18,.135,.17,.085,.038,.070,0,0,-s*.20),
    branch(0x45554c,[[s*.096,-.128,.23],[s*.117,-.133,.33],[s*.076,-.115,.429]],.007,6),piece(new T.ConeGeometry(.017,.057,6),0xd4ceb1,s*.09,-.173,.325,1,1,1,Math.PI)])
  ]);
  p.ear=joined([profile([[0,0],[.105,.02],[.075,.14],[.019,.29],[0,.30]],0x7d8e82,{depth:.48,bend:-.018}),oval(0x48584c,0,.12,.040,.048,.10,.008)]);
  p.jaw=joined([oval(0x7b8d80,0,0,.29,.12,.056,.18),oval(0x575447,0,.041,.34,.085,.008,.115),...[-1,1].map(s=>piece(new T.ConeGeometry(.012,.038,5),0xd4ceb1,s*.081,.053,.37))]);
  p.tail=joined([branch(0x677b70,[[0,0,0],[0,-.015,-.10],[0,-.055,-.21],[0,-.09,-.29]],.09)]);
  p.tailTip=joined([oval(0xa8b4af,0,-.025,-.065,.08,.075,.14)]);
  // Muscular shoulder / thigh taper into wrist / hock, with a real separate
  // paw. The ankle node must move the visible foot, not an empty marker.
  p.frontUpper=joined([profile([[0,.12],[.09,.10],[.112,.035],[.094,-.08],[.062,-.22],[.058,-.31],[0,-.34]].reverse(),0x78847b,{depth:1.24,segments:12}),
   ...[-1,1].map(side=>rootlet(0x859083,[[side*.062,.072,-.015],[side*.086,.015,-.072],[side*.069,-.07,-.10]],[.036,.041,.002]))]);
  p.frontLower=joined([profile([[0,.04],[.054,.02],[.055,-.07],[.036,-.21],[.041,-.29],[0,-.33]].reverse(),0x778477,{depth:1.08,segments:10})]);
  p.haunch=joined([profile([[0,.13],[.10,.105],[.14,.005],[.135,-.10],[.093,-.23],[.065,-.32],[0,-.36]].reverse(),0x788079,{depth:1.4,segments:12}),
   ...[-1,1].map(side=>rootlet(0x7b887a,[[side*.071,-.016,-.13],[side*.072,-.10,-.171],[side*.043,-.18,-.176]],[.035,.042,.002]))]);
  p.shin=joined([profile([[0,.04],[.070,.015],[.073,-.07],[.053,-.17],[.038,-.275],[0,-.30]].reverse(),0x68776c,{depth:1.15,segments:10})]);
  p.hock=joined([profile([[0,.035],[.043,.013],[.037,-.07],[.034,-.13],[0,-.171]].reverse(),0x7b887a,{depth:1.05,segments:10})]);
  p.frontUpper.scale(1,.35/.31,1);p.frontLower.scale(1,.35/.32,1);p.haunch.scale(1,.36/.33,1);p.shin.scale(1,.32/.28,1);
  p.paw=joined([oval(0x98a08d,0,.051,.031,.072,.051,.096),...[-1,0,1].flatMap(side=>[oval(0xa6ab95,side*.043,.042,.102,.029,.04,.055,6,4),piece(new T.ConeGeometry(.010,.041,5),0x485047,side*.043,.035,.161,1,1,1,Math.PI/2)])]);
  // Broad roots lie along the coat, narrow tips break only cheeks and tail.
  // Merge into existing moving batches: no alpha cards or per-hair draw calls.
  p.head=joined([p.head,...[-1,1].flatMap(side=>Array.from({length:3},(_,i)=>rootlet(i%2?0x899487:0x7a877c,[[side*(.19-i*.012),-.04-i*.046,.075-i*.035],[side*(.25-i*.009),-.08-i*.045,.015-i*.041],[side*(.258-i*.008),-.13-i*.044,-.075-i*.039]],[.025,.021,.0015])))]);
  p.tail=joined([p.tail,...[-1,1].flatMap(side=>Array.from({length:3},(_,i)=>rootlet(i%2?0x829284:0x748679,[[side*.051,-.035-i*.015,-.065-i*.071],[side*.095,-.047-i*.027,-.12-i*.071],[side*.064,-.066-i*.031,-.205-i*.065]],[.028,.025,.0015])))]);
 }else if(kind==='golem'){
  p.body=joined([
   boulder(0x626958,0,.93,-.015,.67,.69,.70,.12,.2,-.07),boulder(0x8a8d75,-.15,1.36,.07,.43,.35,.40,.2,-.2,-.1),
   boulder(0x737b62,.23,1.23,.14,.40,.39,.37,-.1,.2,.2),
   rock(0x374b3e,.03,1.08,.48,.20,.25,.047),rock(0xa7d2a0,.01,1.11,.529,.075,.14,.023),
   ...[-1,1].flatMap(s=>[boulder(0x79816a,s*.45,s<0?1.46:1.40,-.03,s<0?.27:.26,s<0?.18:.19,.27,.1,0,s*.4),rock(0x627347,s*.39,s<0?1.50:1.46,.11,.25,.04,.19)]),
   branch(0x334737,[[-.30,1.51,.28],[-.21,1.24,.421],[-.11,1.15,.474]],.018),branch(0x334737,[[.30,1.34,.385],[.21,1.12,.476],[.28,.88,.411]],.018)
  ]);
  p.head=joined([
   boulder(0x91977c,0,0,0,.38,.35,.32,.04,.2,.08),rock(0xadb297,-.075,.19,-.04,.28,.12,.28,.1,0,-.1),
   ...[-1,1].flatMap(s=>[rock(0x344539,s*.14,.04,.29,.123,.075,.034),oval(0xe6d49b,s*.14,.045,.321,.068,.025,.014),rock(0x677c5b,s*.155,.117,.273,.15,.045,.07,0,0,s*.07)]),
   rock(0x596d51,0,-.16,.27,.18,.025,.025),rock(0x5f8147,-.15,.29,-.08,.22,.035,.20)
  ]);
  p.arm=joined([rock(0x414d3e,0,-.01,0,.24,.23,.23),boulder(0x6e7960,0,-.21,0,.34,.36,.31,.12,.2,.18),boulder(0x8b9478,.025,-.63,.075,.28,.31,.29,.2,.2,-.2),rock(0x5e7447,-.01,.02,.035,.25,.045,.23),rock(0x414c3e,0,-.42,.025,.21,.18,.22),...[-1,0,1].map(s=>rock(0x9da68e,s*.12,-.78,.26,.073,.14,.074,.18,0,s*.15))]);
  p.leg=joined([rock(0x424f3f,0,.045,0,.16,.16,.18),boulder(0x6a765d,0,-.10,0,.20,.25,.23,-.1,0,.15),boulder(0x8c947b,0,-.38,.07,.23,.19,.31,0,.15,0)]);
 }else{
  const spitter=kind==='spitter',cloth=spitter?0x695075:0x356c5d,trim=spitter?0xa18b81:0x9aaf7e,shade=spitter?0x48394e:0x214c43;
  p.body=joined([
   profile([[0,.27],[.28,.30],[.30,.43],[.277,.62],[.22,.82],[.242,.98],[.19,1.10],[.15,1.20],[0,1.24]],cloth,{depth:.77,bend:spitter?.05:-.015,flute:.09,segments:20}),
   profile([[.16,1.14],[.215,1.09],[.287,1.015],[.267,.985]],trim,{depth:.82,bend:.015,flute:.038,segments:20}),oval(shade,0,.99,.04,.245,.055,.22),
   branch(trim,[[-.14,.97,.175],[-.12,.78,.235],[-.04,.59,.25],[.15,.56,.24]],.024),
   oval(spitter?0x9b7561:0x86764a,-.245,.59,.11,.11,.15,.105)
  ]);
  p.hem=joined([profile([[0,.08],[.28,.10],[.39,.16],[.384,.22],[.345,.34],[.30,.54]],shade,{depth:.99,bend:.035,flute:.095,segments:20}),profile([[.386,.148],[.380,.177]],trim,{depth:.99,bend:.035,flute:.095,segments:20})]);
  p.head=joined([
   oval(0xc5c6a0,0,0,.018,.22,.22,.19),oval(shade,0,.075,-.045,.251,.214,.182),
   oval(0xc5c6a0,0,-.025,.158,.156,.142,.075),
   ...[-1,1].flatMap(s=>[oval(0x354238,s*.082,.022,.213,.050,.038,.021),oval(0xf6d895,s*.082,.021,.233,.022,.016,.008)]),
   oval(0xabae84,0,-.055,.228,.037,.046,.041),...[-1,1].map(s=>branch(0x858d70,[[s*.032,.058,.218],[s*.078,.069,.214],[s*.12,.050,.193]],.014,4)),
   profile(spitter?[[0,.11],[.25,.09],[.36,.12],[.39,.18],[.29,.22],[.23,.31],[.18,.45],[0,.50]]:[[0,.11],[.25,.09],[.34,.12],[.36,.18],[.27,.22],[.21,.31],[.16,.45],[0,.50]],cloth,{depth:.85,bend:spitter?-.04:.025}),
   profile([[.32,.137],[.387,.168],[.354,.20]],trim,{depth:.85})
  ]);
  p.hatTip=joined([profile([[spitter?.18:.16,0],[.125,.10],[.05,.22],[0,.23]],cloth,{depth:.85,bend:spitter?-.15:.12})]);
  p.staff=joined([branch(0x755e42,[[0,-.73,0],[-.028,-.20,.016],[.02,.23,0],[.015,.66,.02],[-.045,.88,.02]],.032),
   branch(0xa3a582,[[-.045,.65,.025],[-.13,.77,.025],[-.09,.88,.022]],.023),
   oval(0xc5c6a0,-.015,.20,.02,.065,.070,.072),...[-1,0,1].map(s=>branch(0xa8ad88,[[.022,.20+s*.032,.068],[-.02,.197+s*.032,.087],[-.060,.20+s*.032,.051]],.009,4))]);
  p.focus=joined(spitter?[oval(0xd99eca,0,0,0,.12,.155,.12)]:[oval(0xb4d2a0,0,0,0,.065,.13,.075),rock(0xd1dfb2,-.07,.025,0,.068,.12,.038,0,0,-.30),rock(0x97bb8b,.07,.025,0,.068,.12,.038,0,0,.30)]);
  p.arm=joined([oval(cloth,0,-.13,0,.115,.19,.12),oval(0xc5c6a0,0,-.32,.04,.065,.065,.08)]);
  p.castingUpper=joined([oval(cloth,0,-.105,0,.10,.15,.105)]);
  p.castingForearm=joined([oval(cloth,0,-.115,0,.078,.135,.081),oval(trim,0,-.209,0,.083,.032,.086)]);
  p.foot=joined([oval(0x493f34,0,0,.045,.091,.075,.14)]);
  // The poison beast and woodland priest used to be the same pointed-hat doll.
  // Keep the working grip rig; replace the visible anatomy and clothing.
  for(const key of ['body','head','hatTip','hem'])p[key].dispose();
  if(spitter){
   p.body=joined([profile([[0,.24],[.27,.27],[.36,.45],[.38,.66],[.32,.88],[.27,1.05],[.18,1.18],[0,1.21]],0x68614e,{depth:.85,bend:-.025,flute:.022,segments:20}),
    ...[-1,1].map(s=>frond(0x55475d,s*.16,1.16,.15,.19,.67,s*.07)),
    ...[-1,1].map(s=>rootlet(0x3e3d31,[[s*.29,1.01,-.03],[s*.34,.76,.19],[s*.28,.51,.23]],[.045,.038,.015])),
    ...[-1,1].flatMap(s=>[oval(0x7b735b,s*.26,.92,.11,.12,.14,.12,8,5),oval(0x947c8c,s*.29,.93,.16,.063,.087,.047,8,5)])]);
   p.head=joined([wolfCoat([[-.23,0,0,0],[-.18,.19,.15,.015],[-.06,.29,.21,.035],[.10,.30,.17,-.01],[.23,.24,.115,-.04],[.32,.18,.07,-.04],[.35,0,0,-.04]],true),
    ...[-1,1].flatMap(s=>[oval(0x454b36,s*.213,.097,.138,.089,.050,.047),oval(0xb9a15c,s*.216,.090,.176,.039,.022,.015),oval(0x283229,s*.217,.090,.19,.010,.022,.006),rootlet(0x788566,[[s*.11,.128,.10],[s*.21,.156,.12],[s*.285,.109,.07]],[.039,.043,.004])]),
    branch(0x30382c,[[-.24,-.085,.205],[-.15,-.118,.28],[0,-.13,.319],[.15,-.118,.28],[.24,-.085,.205]],.012,10),
    ...[-1,1].map(s=>oval(0x353c2e,s*.065,-.018,.332,.019,.013,.008))]);
   p.hem=joined([profile([[0,.10],[.26,.11],[.35,.24],[.33,.39],[.26,.53]],0x49404d,{depth:.91,flute:.13,segments:20}),...[-1,1].map(s=>frond(0x655568,s*.16,.52,.255,.12,.42,s*.025))]);
   p.hatTip=joined([frond(0x5c6750,0,.23,-.04,.17,.30,-.13),frond(0x777f56,.08,.11,.015,.13,.31,.11)]);
  }else{
   p.body=joined([profile([[0,.27],[.24,.29],[.26,.54],[.195,.80],[.245,1.04],[.16,1.22],[0,1.25]],0x566451,{depth:.86,bend:-.015,flute:.08,segments:20}),
    ...[-1,1].flatMap(s=>[frond(0x294b3d,s*.14,1.20,.08,.24,.63,s*.16),frond(0x50705b,s*.09,1.13,.20,.14,.43,s*.07)]),
    branch(0x88764f,[[-.17,1.14,.16],[-.19,.91,.22],[.02,.80,.22],[.19,.92,.20]],.018)]);
   p.head=joined([profile([[0,-.19],[.155,-.13],[.225,.02],[.213,.17],[.12,.29],[0,.34]],0x344b3c,{depth:.83,bend:-.04,flute:.045,segments:16}),
    // A long carved bark mask, narrow eye clefts and antler-like living shoots.
    profile([[0,-.21],[.065,-.15],[.12,.025],[.138,.13],[.08,.22],[0,.235]],0xa3a28a,{x:0,z:.145,depth:.25,flute:.16,segments:12}),
    ...[-1,1].flatMap(s=>[oval(0x29392c,s*.062,.076,.185,.053,.022,.01),oval(0xb8d396,s*.063,.076,.194,.030,.006,.004),rootlet(0x6b6645,[[s*.13,.18,-.01],[s*.21,.36,-.025],[s*.25,.50,-.10]],[.055,.037,.002])]),
    branch(0x64705a,[[0,.17,.19],[-.026,.0,.186],[0,-.17,.157]],.008,6)]);
   p.hem=joined([profile([[0,.07],[.27,.09],[.30,.19],[.28,.39],[.24,.54]],0x344c3d,{depth:1,flute:.17,segments:20}),...[-1,0,1].map(s=>frond(s?0x516049:0x698062,s*.16,.62,.235,.14,.52,s*.02))]);
   p.hatTip=joined([frond(0x587f58,-.06,.20,0,.12,.24,-.10),frond(0x9aab70,.045,.11,.035,.085,.20,.09)]);
  }
 }
 if(kind==='wolf'){p.lids=lids(0x66796b,.162,.059,.030);p.nose=joined([oval(0x26332e,0,0,0,.096,.056,.052),...[-1,1].map(side=>oval(0x101b18,side*.052,-.015,.041,.026,.013,.011,8,5)),oval(0x61706a,-.022,.019,.046,.032,.012,.005,8,4)]);}
 else if(kind==='mushroom')p.lids=lids(0xbeac88,.083,.039,.024);
 else if(kind==='spitter')p.lids=lids(0x778162,.213,.084,.038);
 for(const [part,geometry] of Object.entries(p))prepareCreatureSurface(geometry,kind,part);
 templates.set(kind,p);return p;
}
function group(parent,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
function add(parent,geometry,name,glow=false){prepareCreatureSurface(geometry,name,name);const m=new T.Mesh(geometry,glow?light:skin);m.name=name;m.castShadow=!glow;m.receiveShadow=!glow;parent.add(m);return m;}
export function polishEnemyAppearance(g){
 const d=g.userData,kind=d.kind;if(d.appearance||!['mushroom','wolf','golem','spitter','shaman'].includes(kind)||d.species)return g;
 const p=template(kind),rig=d.rig;rig.clear();d.appearance=true;d.combatHeight=combatHeights[kind];d.legs=[];d.arms=[];add(rig,p.body,'creature-body');
 if(kind==='mushroom'){
  d.cap=group(rig,0,1.01,0);add(d.cap,p.cap,'mushroom-cap');d.feet=[-1,1].map(s=>{const f=group(rig,s*.18,.12,.10);add(f,p.foot,'mushroom-foot');return f;});
 }else if(kind==='wolf'){
  d.head=group(rig,0,.80,.47);add(d.head,p.head,'wolf-head');d.jaw=group(d.head,0,-.21,0);add(d.jaw,p.jaw,'wolf-jaw');
  d.ears=[-1,1].map(s=>{const ear=group(d.head,s*.17,.25,-.06);add(ear,p.ear,'wolf-ear');return ear;});
  d.tail=group(rig,0,.75,-.46);add(d.tail,p.tail,'wolf-tail');d.tailTip=group(d.tail,0,-.09,-.26);add(d.tailTip,p.tailTip,'wolf-tail-tip');
  for(const x of[-.215,.215])for(const z of[-.32,.28]){
   const back=z<0,y=back?.65:.665,joint=group(rig,x,y,z),upper=group(joint),knee=group(joint),paw=group(joint),ankle=back?group(joint):null;
   add(upper,back?p.haunch:p.frontUpper,back?'wolf-haunch':'wolf-shoulder');add(knee,back?p.shin:p.frontLower,'wolf-lower-leg');add(paw,p.paw,'wolf-paw');if(ankle)add(ankle,p.hock,'wolf-hock');
   d.legs.push({joint,upper,knee,paw,ankle,phase:x*z>0?0:Math.PI,upperLength:back?.36:.35,lowerLength:back?.32:.35,restX:x,restY:y,restZ:z,back,drop:back?.14:0,reach:0});
  }
  prepareCreatureFeet(d);for(const leg of d.legs)plantCreatureFoot(leg,0,0);
 }else if(kind==='golem'){
  d.head=group(rig,0,1.80,.03);add(d.head,p.head,'golem-head');
  for(const s of[-1,1]){const arm=group(rig,s*.73,1.34,0);add(arm,p.arm,'golem-arm');d.arms.push(arm);const joint=group(rig,s*.30,.57,0);add(joint,p.leg,'golem-leg');d.legs.push({joint,phase:s<0?0:Math.PI});}
 }else{
  d.head=group(rig,0,1.26,0);add(d.head,p.head,'caster-head');d.hatTip=group(d.head,-.035,kind==='spitter'?.26:.40,-.035);add(d.hatTip,p.hatTip,'caster-hat-tip');d.hem=group(rig);add(d.hem,p.hem,'caster-hem');
  d.staff=group(rig,.48,.76,.1);add(d.staff,p.staff,'caster-staff');d.focus=add(group(d.staff,0,.82,0),p.focus,'caster-focus',true);
  const arm=group(rig,-.26,1.03,0);add(arm,p.arm,'caster-free-arm');d.arms=[arm];
  const upper=group(rig,.245,1.035,.005),forearm=group(rig);add(upper,p.castingUpper,'caster-upper-arm');add(forearm,p.castingForearm,'caster-forearm');
  d.castingArm={upper,forearm,upperLength:.23,lowerLength:.25};updateEnemyGrip(d);
  d.feet=[-1,1].map(s=>{const foot=group(rig,s*.15,.08,.07);add(foot,p.foot,'caster-foot');return foot;});
 }
 if(p.lids){const parent=kind==='mushroom'?rig:d.head,anchor=kind==='mushroom'?[0,.724,.211]:kind==='wolf'?[0,.113,.242]:[0,.129,.203];d.expressionLids=group(parent,...anchor);add(d.expressionLids,p.lids,kind+'-eyelids');d.expressionLids.scale.y=.08;}
 if(p.nose){d.expressionNose=group(d.head,0,-.031,.426);const nose=add(d.expressionNose,p.nose,kind+'-nose');nose.userData.creatureFinish='nose';d.expressionNose.userData.rest=[0,-.031,.426];}
 d.expressionSeed=(g.id*.61803398875)%1;
 return g;
}

const down=new T.Vector3(0,-1,0),grip=new T.Vector3(),direction=new T.Vector3(),bend=new T.Vector3(),elbow=new T.Vector3(),segment=new T.Vector3();
// The palm remains part of the staff. Solve two fixed sleeve bones to that live grip.
export function updateEnemyGrip(d){
 const arm=d.castingArm;if(!arm||!d.staff)return;
 d.staff.updateMatrix();grip.set(-.015,.20,.02).applyMatrix4(d.staff.matrix);
 direction.copy(grip).sub(arm.upper.position);const raw=direction.length();if(raw<.0001)return;
 direction.divideScalar(raw);const a=arm.upperLength,b=arm.lowerLength,reach=T.MathUtils.clamp(raw,Math.abs(a-b)+.0001,a+b-.0001);
 const along=(a*a-b*b+reach*reach)/(2*reach),lift=Math.sqrt(Math.max(0,a*a-along*along));
 // Elbow hangs below the hand; a small forward bias keeps it outside the tunic.
 bend.set(.22,-1,.32).addScaledVector(direction,-bend.dot(direction));
 if(bend.lengthSq()<.0001)bend.set(0,0,1).addScaledVector(direction,-direction.z);
 bend.normalize();elbow.copy(arm.upper.position).addScaledVector(direction,along).addScaledVector(bend,lift);
 arm.upper.quaternion.setFromUnitVectors(down,segment.copy(elbow).sub(arm.upper.position).normalize());
 arm.forearm.position.copy(elbow);arm.forearm.quaternion.setFromUnitVectors(down,segment.copy(grip).sub(elbow).normalize());
}


// A short event every few seconds, derived solely from game time. No timers or
// per-frame random calls; pausing/replaying the same time cannot advance a face.
const expressionPulse=(t,start,duration)=>{const q=(t-start)/duration;return q>0&&q<1?Math.sin(q*Math.PI)**2:0;};
export function animateEnemyExpression(d,t,stride,gather,drive,impact=0){
 const id=d.species||d.kind,seed=d.expressionSeed||0,hit=d.hitReaction,busy=d.previousAttack>0||(d.release||0)>0||gather>.0001||drive>.0001||!!hit;
 const dt=d.expressionTime===undefined?1/60:Math.max(0,Math.min(.1,t-d.expressionTime));d.expressionTime=t;
 const idle=busy?0:1-T.MathUtils.smoothstep(stride,.08,.35),period=4.8+seed*1.7,u=T.MathUtils.euclideanModulo(t+seed*3.7,period);
 const blink=idle*Math.max(expressionPulse(u,.8,.19),id==='snowhare'?expressionPulse(u,1.11,.16)*.78:0);
 // Real hits use the shared reaction clock; the old impact pose is intentionally
 // suppressed by animateActor to avoid applying recoil twice.
 // Recoil advances after this pose; sample its end-of-frame age so rendering
 // the same game time again cannot change the expression.
 const hurt=hit?Math.min(1,hit.strength/.14)*(1-T.MathUtils.smoothstep(hit.age+dt,.03,.18)):impact;
 if(d.expressionLids)d.expressionLids.scale.y=Math.min(1,.08+blink*.92+gather*(id==='mushroom'?.60:.34)+hurt*.70);
 const sniffTime=T.MathUtils.euclideanModulo(t+seed*5.1,6.7+seed),sniff=idle*(expressionPulse(sniffTime,2.0,.13)-expressionPulse(sniffTime,2.17,.12)+expressionPulse(sniffTime,2.35,.11)*.55);
 if(d.expressionNose){const n=d.expressionNose,r=n.userData.rest;n.position.set(r[0]+(id==='snowhare'?.003:0)*sniff,r[1]+sniff*(id==='snowhare'?.004:.002),r[2]+sniff*.002);n.scale.set(1+Math.abs(sniff)*.035,1,1);}
 // The locomotion driver has just written absolute ear/head poses. This small,
 // isolated alert twitch does not replace its gait or keep accumulating offsets.
 const earTime=T.MathUtils.euclideanModulo(t+seed*7,8.1+seed),alert=idle*expressionPulse(earTime,3.5,.42);
 if(d.ears&&(id==='snowhare'||id==='wolf'||id==='frostwolf'))d.ears.forEach((ear,i)=>{ear.rotation.x+=alert*(i?.035:-.10);ear.rotation.z+=alert*(i?-.04:.07);});
 if(d.head&&(id==='wolf'||id==='frostwolf'))d.head.rotation.x+=sniff*.018;
 d.expressionBlink=blink;d.expressionSniff=sniff;d.expressionAlert=alert;
}

// Shared articulated support used by forest and regional limb carriers.
const footDown=new T.Vector3(0,-1,0),footEnd=new T.Vector3(),footTarget=new T.Vector3(),footDirection=new T.Vector3(),footBend=new T.Vector3(),footElbowPoint=new T.Vector3(),footLinkDirection=new T.Vector3(),footInverse=new T.Matrix4(),footRigMatrix=new T.Matrix4(),footFlat=new T.Quaternion(),footFootOffset=new T.Vector3();
export function prepareCreatureFeet(d){d.rig.updateMatrix();footRigMatrix.copy(d.rig.matrix);if(d.regionalRoot){d.regionalRoot.updateMatrix();footRigMatrix.multiply(d.regionalRoot.matrix);}footInverse.copy(footRigMatrix).invert();footFlat.copy(d.rig.quaternion).invert();}
export function plantCreatureFoot(l,phase,stride,{air=0,reachZ=0,lift=.09,travel=.15,raise=0,toeRoll=0}={}){
 const u=((phase+l.phase)/(Math.PI*2)%1+1)%1,support=u<.64,q=support?0:(u-.64)/.36,step=(support?1-u/.64*2:-1+2*(q*q*(3-2*q)))*stride;
 l.planted=support&&stride>.001&&air<.001&&raise<.001;
 const fit=l.joint.parent.scale.x;
 footTarget.set((l.restX+Math.sign(l.restX)*l.reach)*fit,.006+Math.sin(q*Math.PI)*lift*stride+air+raise,(l.restZ+reachZ)*fit+step*travel).applyMatrix4(footInverse);
 l.paw.quaternion.copy(footFlat);if(toeRoll)l.paw.rotateX(-toeRoll*Math.sin(q*Math.PI)*stride);
 footEnd.copy(footTarget).add(footFootOffset.set(0,.055,0).applyQuaternion(l.paw.quaternion));if(l.drop)footEnd.add(footFootOffset.set(0,l.drop,-.095).applyQuaternion(footFlat));
 l.joint.position.set(l.restX,l.restY,l.restZ);l.joint.rotation.set(0,0,0);
 footDirection.copy(footEnd).sub(l.joint.position);const a=l.upperLength,b=l.lowerLength,raw=footDirection.length(),d=T.MathUtils.clamp(raw,Math.abs(a-b)+.001,a+b-.001);footDirection.normalize();
 // A few centimetres of shoulder/hip yield preserve fixed bone lengths and
 // the actual contact point during a long step or an interrupted wind-up.
 l.joint.position.addScaledVector(footDirection,raw-d);
 l.paw.position.copy(footTarget).sub(l.joint.position);footEnd.sub(l.joint.position);
 const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));footBend.set(l.reach?Math.sign(l.restX):0,0,l.back?1:-1).addScaledVector(footDirection,-footBend.dot(footDirection)).normalize();
 footElbowPoint.copy(footDirection).multiplyScalar(along).addScaledVector(footBend,height);l.upper.quaternion.setFromUnitVectors(footDown,footLinkDirection.copy(footElbowPoint).normalize());l.knee.position.copy(footElbowPoint);l.knee.quaternion.setFromUnitVectors(footDown,footLinkDirection.copy(footEnd).sub(footElbowPoint).normalize());
 if(l.ankle){l.ankle.position.copy(footEnd);l.ankle.quaternion.setFromUnitVectors(footDown,footLinkDirection.copy(l.paw.position).add(footFootOffset.set(0,.055,0).applyQuaternion(l.paw.quaternion)).sub(footEnd).normalize());}
}

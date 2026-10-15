import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {updateEnemyGrip,animateEnemyExpression,prepareCreatureFeet,plantCreatureFoot} from './enemy-appearance.js?v=203';

import {prepareCreatureSurface,installCreatureSurface} from './creature-surface.js?v=203';

// Bounded shared templates; every moving part is a batch, not a collection of
// decorative meshes. Only joints move after construction.
const kinds=new Set(['snowhare','frostwolf','yeti','icewitch','snowtotem','emberling','ashstalker','lavabrute','cinderwisp','ashseer']);
const templates=new Map(),fittings=new Map(),skin=new T.MeshStandardMaterial({vertexColors:true,roughness:.87,metalness:0}),glow=new T.MeshStandardMaterial({vertexColors:true,roughness:.48,emissive:0xff7933,emissiveIntensity:.07});
skin.name='M_Regional_Creature_A';glow.name='M_Regional_Core_A';installCreatureSurface(skin);
const clamp=T.MathUtils.clamp,smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function color(g,c){const base=new T.Color(c),p=g.attributes.position,n=g.attributes.normal,a=[];for(let i=0;i<p.count;i++){const grain=.94+.045*Math.sin(p.getX(i)*13+p.getY(i)*8+p.getZ(i)*11),shade=grain*(.93+.07*Math.max(0,n?.getY(i)||0));a.push(base.r*shade,base.g*shade,base.b*shade);}g.setAttribute('color',new T.Float32BufferAttribute(a,3));g.deleteAttribute('uv');return g;}
function piece(g,c,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){g.scale(sx,sy,sz);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);return color(g,c);}
const oval=(c,x,y,z,sx,sy,sz)=>piece(new T.SphereGeometry(1,10,6),c,x,y,z,sx,sy,sz);
const tube=(c,points,r=.03,segments=10)=>color(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,r,6,false),c);
function joined(parts){const flat=parts.map(g=>g.index?g.toNonIndexed():g),g=mergeGeometries(flat,false);for(const p of new Set([...parts,...flat]))p.dispose();g.computeBoundingBox();g.computeBoundingSphere();return g;}
// Smooth cross sections join ribcage, waist and neck into a single skin. Ends
// close to one vertex; normals are shared around the rings before batching.
function skinLoft(rings,c,axis='y',sides=14,steps=18,fold=0,coat=false){
 sides=Math.min(sides,coat?18:12);steps=Math.min(steps,coat?22:12);
 const curve=new T.CatmullRomCurve3(rings.map(r=>new T.Vector3(r[0],r[1],r[2]))),centers=rings.map(r=>r[3]||0),p=[],idx=[];
 for(let j=0;j<=steps;j++){
  const t=j/steps,q=curve.getPoint(t),k=t*(rings.length-1),i=Math.min(rings.length-2,Math.floor(k)),shift=T.MathUtils.lerp(centers[i],centers[i+1],k-i);
  for(let s=0;s<sides;s++){const a=s/sides*Math.PI*2,f=1+fold*Math.sin(a*7+.35)*Math.sin(t*Math.PI),x=Math.cos(a)*Math.max(.001,q.y)*f,z=Math.sin(a)*Math.max(.001,q.z)*f;if(axis==='z')p.push(x,shift+z,q.x);else p.push(x,q.x,z+shift);}
  if(j)for(let s=0;s<sides;s++){const a=(j-1)*sides+s,b=(j-1)*sides+(s+1)%sides;idx.push(a,a+sides,b,b,a+sides,b+sides);}
 }
 for(const end of [0,1]){const row=end?steps:0,base=row*sides,index=p.length/3,coord=rings[end?rings.length-1:0];p.push(0,axis==='z'?coord[3]||0:coord[0],axis==='z'?coord[0]:coord[3]||0);for(let i=0;i<sides;i++){const a=base+i,b=base+(i+1)%sides;idx.push(...(end?[index,b,a]:[index,a,b]));}}
 if((axis==='z')!==(rings.at(-1)[0]<rings[0][0]))for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return color(g,c);
}
// Short, overlapping locks follow the coat rather than radiating like spikes.
// They are sealed into the existing body batch: no transparent fur shell,
// additional material, per-frame vertex writes or per-lock draw calls.
function coatLoft(rings,c,axis='y',length=.016){
 const g=skinLoft(rings,c,axis,12,14,0,true),p=g.attributes.position,n=g.attributes.normal,parts=[g];
 const tangent=new T.Vector3(),normal=new T.Vector3(),root=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3();
 for(let row=3;row<13;row+=2)for(let side=0;side<12;side++){
  if((side+row)%3!==0)continue;
  const i=row*12+side;normal.fromBufferAttribute(n,i);if(axis==='z'&&normal.y<-.28)continue;
  root.fromBufferAttribute(p,i).addScaledVector(normal,-length*.18);tangent.set(0,axis==='z'?-.18:-1,axis==='z'?-1:-.18).addScaledVector(normal,-tangent.dot(normal)).normalize();
  a.copy(root).addScaledVector(tangent,length*.70).addScaledVector(normal,length*.40);
  b.copy(root).addScaledVector(tangent,length*2.5).addScaledVector(normal,length*.08);
  // Wide buried roots read as overlapping fur, rather than thin glued rods.
  const lock=horn(c,[root.toArray(),a.toArray(),b.toArray()],[length*.70,length*.45,.0007],2,3),lp=lock.attributes.position;
  for(let j=0;j<lp.count;j++){const depth=(lp.getX(j)-root.x)*normal.x+(lp.getY(j)-root.y)*normal.y+(lp.getZ(j)-root.z)*normal.z;lp.setXYZ(j,lp.getX(j)-normal.x*depth*.55,lp.getY(j)-normal.y*depth*.55,lp.getZ(j)-normal.z*depth*.55);}
  lock.computeVertexNormals();parts.push(lock);
 }
 const merged=joined(parts);merged.userData.shortCoat=true;return merged;
}
function hareEar(){
 const g=skinLoft([[0,.041,.026],[.09,.065,.032],[.24,.080,.023],[.42,.070,.018],[.57,.038,.012],[.63,.014,.007],[.65,.002,.002]],0xd5ddd1,'y',12,22,0,true);
 const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,inner=new T.Color(0xa6b0a8),shade=new T.Color();
 for(let i=0;i<p.count;i++){
  const y=p.getY(i);
  const margin=1-smooth(Math.abs(p.getX(i))/.052),inside=smooth((y-.055)/.08)*(1-smooth((y-.51)/.105))*Math.max(0,n.getZ(i));
  shade.setRGB(c.getX(i),c.getY(i),c.getZ(i)).lerp(inner,margin*inside*.86);c.setXYZ(i,shade.r,shade.g,shade.b);
 }
 return flexEar(g,[[.21,'MidFlex'],[.44,'TipFlex']]);
}
function flexEar(g,pivots){
 const p=g.attributes.position,n=g.attributes.normal;
 // Two shared smooth flex shapes keep the membrane continuous and participate
 // in Three's regular shadow pass. Individual ears own only two scalar weights;
 // unlike skeletons this creates no per-creature GPU bone texture to dispose.
 g.morphTargetsRelative=true;g.morphAttributes.position=[];g.morphAttributes.normal=[];
 for(const [pivot,name]of pivots){
  const next=g.clone(),q=next.attributes.position;
  for(let i=0;i<p.count;i++){
   const y=p.getY(i),z=p.getZ(i),angle=.50*smooth((y-pivot)/.20),s=Math.sin(angle),c=Math.cos(angle),dy=y-pivot;
   q.setXYZ(i,p.getX(i),pivot+dy*c-z*s,dy*s+z*c);
  }
  next.computeVertexNormals();const deltaP=new Float32Array(p.count*3),deltaN=new Float32Array(p.count*3),nn=next.attributes.normal;
  for(let i=0;i<deltaP.length;i++){deltaP[i]=q.array[i]-p.array[i];deltaN[i]=nn.array[i]-n.array[i];}
  const dp=new T.Float32BufferAttribute(deltaP,3),dn=new T.Float32BufferAttribute(deltaN,3);dp.name=dn.name=name;
  g.morphAttributes.position.push(dp);g.morphAttributes.normal.push(dn);next.dispose();
 }
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function addSoftEar(parent,geometry,id){
 prepareCreatureSurface(geometry,id,'Ear');const mesh=new T.Mesh(geometry,skin);
 mesh.name='SM_Enemy_'+id+'_SoftEar';mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);parent.userData.softEar={mesh};return mesh;
}
function tintFront(g,c,centerY,radiusY,zStart){const p=g.attributes.position,colors=g.attributes.color,target=new T.Color(c),shade=new T.Color();for(let i=0;i<p.count;i++){const front=smooth((p.getZ(i)-zStart)/.17),center=1-smooth(Math.abs(p.getX(i))/.40),height=1-smooth(Math.abs(p.getY(i)-centerY)/radiusY);shade.setRGB(colors.getX(i),colors.getY(i),colors.getZ(i)).lerp(target,front*center*height*.78);colors.setXYZ(i,shade.r,shade.g,shade.b);}return g;}
function faceted(g){const next=g.index?g.toNonIndexed():g;next.computeVertexNormals();if(next!==g)g.dispose();return next;}
function crystalShape(c,r,h,bend=0){const g=new T.OctahedronGeometry(1,0);g.scale(r,h,r*.72);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+p.getY(i)*bend);g.computeVertexNormals();return color(g,c);}
function horn(c,points,radii,steps=10,sides=6){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,steps,1,sides,false),p=g.attributes.position;for(let i=0;i<p.count;i++){const row=Math.floor(i/(sides+1)),t=row/steps,center=curve.getPointAt(t),k=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(k)),r=T.MathUtils.lerp(radii[j],radii[j+1],k-j);p.setXYZ(i,center.x+(p.getX(i)-center.x)*r,center.y+(p.getY(i)-center.y)*r,center.z+(p.getZ(i)-center.z)*r);}g.computeVertexNormals();return color(g,c);}

// Narrow, recessed eyes sit under the brow; no protruding iris/highlight balls.
function eyes(c,x,y,z,r=.025){return[-1,1].flatMap(side=>[oval(0x202a2d,side*x,y,z,r*1.5,r*.52,r*.38),oval(c,side*x,y,z+r*.29,r*.80,r*.20,r*.16),oval(0xd8dfcd,side*x-r*.20,y+r*.055,z+r*.45,r*.13,r*.11,r*.07)]);}
function lids(c,x,w,h){return joined([-1,1].map(side=>oval(c,side*x,-h,0,w,h,.008)));}
function link(c,length,width,end=width*.6,rock=false){const g=skinLoft([[width*.85,width*.40,width*.38],[width*.32,width*.91,width*.84],[0,width,width*.9],[-length*.30,width*.90,width*.81],[-length*.70,end*1.25,end*1.12],[-length,end,end]],c,'y',rock?7:10,8);return rock?faceted(g):g;}
function paw(c,w,l,claw=0x526064){const g=joined([oval(c,0,.054,.018,w,.054,l),...[-1,0,1].map(s=>horn(claw,[[s*w*.57,.043,l*.55],[s*w*.61,.033,l*.95],[s*w*.61,.018,l*1.13]],[w*.19,w*.15,.002],4,5))]);return g;}
function robe(c,ice){const g=skinLoft([[.10,.36,.28],[.29,.37,.28],[.67,.25,.20],[.94,.245,.185],[1.12,.31,.20],[1.25,.28,.185],[1.39,.16,.13]],c,'y',12,12,.08),p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),a=Math.atan2(p.getZ(i),p.getX(i)),low=1-smooth((y-.08)/.42);p.setY(i,y+low*(.055+.05*Math.sin(a*3+.6)+.022*Math.cos(a*5)));p.setZ(i,p.getZ(i)+(1-smooth((y-.25)/1.0))*(ice?-.10:-.035));}g.computeVertexNormals();return g;}
function template(id){
 if(templates.has(id))return templates.get(id);const p={};
 if(id==='snowhare'){
  // One horizontal back flows from powerful rear haunches into the small chest.
  p.body=coatLoft([[-.55,.07,.08,.43],[-.40,.29,.30,.46],[-.17,.335,.31,.47],[.08,.29,.265,.475],[.29,.22,.215,.50],[.43,.145,.17,.575],[.53,.09,.12,.64]],0xc7d6cf,'z',.021);
  p.head=joined([coatLoft([[-.18,.035,.07,.015],[-.10,.155,.19,.03],[.05,.185,.16,.015],[.18,.142,.105,-.035],[.30,.073,.060,-.052]],0xc5d5ce,'z',.018),...[-1,1].flatMap(s=>[
   oval(0x38565c,s*.142,.047,.118,.039,.023,.018),oval(0xc6b989,s*.145,.045,.130,.018,.012,.006),oval(0x1d3339,s*.147,.046,.135,.007,.013,.004),horn(0xb6cbc2,[[s*.113,.057,.137],[s*.151,.077,.096],[s*.174,.078,.042]],[.014,.020,.012],4,5)
  ])]);
  p.ear=hareEar();
  p.haunch=coatLoft([[.21,.054,.068,-.025],[.13,.12,.14,-.028],[.015,.165,.178,-.018],[-.10,.173,.16,-.005],[-.21,.122,.113,.018],[-.29,.078,.076],[-.31,.068,.064]],0xc2d0c8,'y',.015);
  p.shin=joined([skinLoft([[.03,.066,.067],[0,.078,.074],[-.075,.085,.066,-.015],[-.17,.052,.05,-.014],[-.255,.044,.04],[-.27,.043,.042]],0xb8cac5,'y',12,12)]);
  p.hock=joined([skinLoft([[.022,.043,.042],[0,.048,.044],[-.07,.041,.038],[-Math.hypot(.115,.095),.048,.040]],0xc2d2c9,'y',10,9)]);
  p.fore=coatLoft([[.14,.045,.052,-.005],[.06,.091,.096,-.01],[-.015,.094,.088,-.016],[-.085,.079,.070,-.018],[-.17,.059,.055,-.012],[-.245,.052,.050]],0xd1ded3,'y',.015);
  p.foreLower=joined([skinLoft([[.028,.044,.044],[0,.052,.048],[-.06,.055,.048,-.008],[-.14,.037,.035],[-.21,.039,.038],[-.235,.045,.042]],0xb9ceca,'y',12,12)]);
  // The heel stays beneath the hock; the long metatarsal/toes project forward.
  p.foot=joined([skinLoft([[-.078,.025,.020,.050],[-.040,.069,.047,.050],[.035,.093,.051,.051],[.18,.105,.039,.039],[.30,.078,.028,.032],[.33,.026,.018,.030]],0xc4d4c9,'z',12,12)]);
  p.frontFoot=paw(0xc1d4cd,.080,.115,0x879c98);p.tail=coatLoft([[-.11,.020,.022],[-.06,.095,.090],[.01,.125,.12],[.09,.064,.062],[.11,.008,.008]],0xd5dfd2,'z',.012);
 }else if(id==='emberling'){
  // Squat coal imp, forward shoulders and a narrow angular face, not a rabbit.
  p.body=joined([skinLoft([[.32,.16,.16,-.015],[.49,.235,.22,-.02],[.68,.27,.225,-.015],[.84,.30,.21,.005],[.95,.25,.175,.025],[1.08,.10,.11,.025]],0x62372e,'y',10,10),tube(0xb76332,[[-.12,.65,.20],[0,.78,.226],[.12,.66,.20]],.018,6)]);
  p.head=joined([skinLoft([[-.13,.02,.03],[0,.20,.20],[.13,.17,.13,-.05],[.25,.068,.053,-.075]],0x9b573a,'z',9,9),...eyes(0xf2b367,.096,.025,.15,.024),horn(0x512e2b,[[-.085,.105,.13],[0,.07,.20],[.085,.105,.13]],[.030,.027,.030],6,5)]);
  p.ear=joined([horn(0x302b2a,[[0,0,0],[.04,.15,-.015],[.105,.21,-.09],[.15,.13,-.15]],[.085,.065,.026,.002],8,6)]);
  p.upper=joined([link(0x763c30,.27,.11,.058)]);p.lower=joined([link(0x8e4934,.28,.065,.049),oval(0x392d2a,0,-.26,.02,.073,.086,.075)]);
  p.thigh=joined([link(0x63342c,.28,.13,.079)]);p.shin=joined([link(0x59342e,.26,.077,.052)]);p.foot=paw(0x3d302b,.10,.135,0xa7774c);
  p.tail=joined([horn(0x81432e,[[0,0,0],[0,-.12,-.18],[.06,-.08,-.40],[.13,.08,-.48]],[.09,.07,.035,.002],10,6)]);
 }else if(id==='frostwolf'){
  // Deep brisket / tucked flank / high withers, not a cylindrical dog torso.
  p.body=coatLoft([[-.71,.07,.10,.73],[-.54,.245,.26,.765],[-.31,.22,.23,.79],[-.07,.235,.27,.80],[.18,.29,.34,.835],[.38,.30,.355,.875],[.55,.235,.29,.945],[.68,.14,.19,1.025]],0x93abb6,'z',.024);
  p.head=joined([skinLoft([[-.23,.04,.06,.035],[-.13,.19,.22,.07],[.015,.219,.19,.04],[.16,.177,.125,-.005],[.34,.087,.067,-.04],[.47,.063,.05,-.035]],0xb6cbce,'z',12,12),...eyes(0xc2c0a1,.137,.044,.18,.027),...[-1,1].map(side=>tube(0x3c5360,[[side*.092,-.081,.16],[side*.088,-.077,.30],[side*.056,-.060,.45]],.008,6)),...[-1,1].map(side=>piece(new T.ConeGeometry(.020,.103,5),0xd4d7be,side*.075,-.112,.315,1,1,1,Math.PI)),...[-1,1].map(s=>horn(0xa4bdc2,[[s*.08,.043,.205],[s*.142,.072,.153],[s*.19,.084,.05]],[.021,.028,.022],5,5))]);
   p.ear=flexEar(joined([skinLoft([[-.035,.062,.046],[.025,.080,.053],[.125,.059,.033],[.225,.023,.013],[.27,.003,.003]],0xb7cccd,'y',8,10),horn(0x627f8c,[[0,.055,.044],[0,.13,.028],[0,.19,.013]],[.028,.024,.003],5,5)]),[[.07,'MidFlex'],[.17,'TipFlex']]);
  p.jaw=joined([skinLoft([[.05,.07,.027],[.23,.072,.036],[.42,.052,.02]],0x7d9ba7,'z',8,8),...[-1,1].map(side=>piece(new T.ConeGeometry(.013,.042,5),0xbac2af,side*.051,.038,.34))]);
  p.tail=joined([horn(0x90aeb8,[[0,0,0],[0,-.08,-.17],[0,-.20,-.34],[0,-.25,-.51]],[.12,.15,.13,.072],10,8)]);p.tailTip=joined([horn(0xc7d4cf,[[0,0,0],[0,-.025,-.14],[0,.025,-.26]],[.077,.047,.002],8,7)]);
  p.frontUpper=coatLoft([[.25,.035,.05,.015],[.15,.115,.14,.015],[.035,.137,.15,.020],[-.09,.115,.123,.01],[-.23,.086,.087,-.012],[-.35,.073,.069]],0x8daab6,'y',.014);
  p.frontLower=joined([skinLoft([[.035,.060,.061],[0,.078,.074],[-.07,.078,.063,-.016],[-.18,.058,.049,-.01],[-.29,.047,.043],[-.355,.059,.051],[-.37,.055,.048]],0x9eb9c3,'y',12,12)]);
  p.haunch=coatLoft([[.22,.042,.055,-.025],[.13,.115,.145,-.03],[.025,.165,.18,-.025],[-.105,.164,.16,-.005],[-.23,.125,.115,.012],[-.33,.086,.074,.008],[-.39,.069,.064]],0x88a3b0,'y',.015);
  p.shin=joined([skinLoft([[.028,.066,.061],[0,.082,.077],[-.07,.099,.080,-.018],[-.17,.074,.059,-.015],[-.28,.052,.049],[-.31,.058,.054]],0xa1b9c2,'y',12,12)]);
  p.hock=joined([skinLoft([[.025,.055,.052],[0,.061,.056],[-.08,.040,.038],[-.17,.047,.042],[-Math.hypot(.18,.095),.056,.047]],0x9ab1ba,'y',10,9)]);p.foot=paw(0xb0c8cd,.095,.14);
 }else if(id==='ashstalker'){
  p.body=joined([skinLoft([[-.79,.04,.035,.37],[-.62,.215,.14,.405],[-.40,.31,.18,.43],[-.08,.34,.19,.44],[.25,.32,.18,.445],[.45,.28,.155,.45],[.63,.215,.115,.455],[.77,.17,.085,.45]],0x514b46,'z',12,12),...Array.from({length:6},(_,i)=>horn(i%2?0x814d34:0xa2663c,[[0,.54,-.55+i*.19],[0,.82+Math.sin(i/5*Math.PI)*.28,-.62+i*.19],[0,.92+Math.sin(i/5*Math.PI)*.27,-.72+i*.19]],[.080,.046,.002],6,5))]);
  p.head=joined([skinLoft([[-.18,.12,.060],[.00,.26,.094],[.24,.275,.064,-.01],[.50,.21,.04,-.025],[.61,.15,.025,-.025]],0x77624d,'z',12,10),...[-1,1].map(s=>oval(0x292a26,s*.206,.041,.14,.050,.018,.037)),...[-1,1].map(s=>oval(0xd99b4e,s*.209,.055,.148,.022,.005,.025)),...[-1,1].map(s=>horn(0x9b774f,[[s*.15,.07,.04],[s*.30,.07,-.08],[s*.35,.025,-.28]],[.080,.062,.002],7,5)),...[-1,1].map(s=>oval(0x352c26,s*.095,.015,.597,.013,.008,.018))]);
  p.jaw=joined([skinLoft([[.02,.18,.015],[.23,.24,.024],[.55,.16,.009]],0x967d57,'z',8,8),...[-1,1].flatMap(side=>[.22,.36,.48].map((z,i)=>piece(new T.ConeGeometry(.017-i*.003,.065-i*.009,5),0xcbbd91,side*(.206-i*.024),.032,z)))]);
  p.tail=joined([horn(0x594b40,[[0,0,0],[0,-.01,-.28],[0,-.04,-.57],[0,-.06,-.81]],[.16,.125,.069,.027],10,8)]);p.tailTip=joined([horn(0x8c6641,[[0,0,0],[0,-.005,-.20],[.10,.04,-.41]],[.034,.019,.002],8,6)]);
  p.upper=joined([skinLoft([[.13,.055,.065],[.065,.11,.13],[0,.13,.125],[-.11,.105,.095,.015],[-.23,.078,.073,.012],[-.30,.071,.065]],0x645847,'y',10,10)]);p.lower=joined([skinLoft([[.035,.064,.060],[0,.080,.074],[-.09,.074,.066,-.012],[-.21,.052,.045],[-.30,.043,.039]],0x8a7053,'y',10,10)]);p.foot=paw(0x967d56,.10,.16,0xbaac86);
 }else if(id==='yeti'){
  p.body=joined([tintFront(coatLoft([[.40,.23,.21,-.17],[.65,.36,.31,-.18],[.95,.48,.41,-.13],[1.28,.67,.48,-.06],[1.51,.69,.46,-.025],[1.72,.48,.32,-.02],[1.84,.17,.14,-.04]],0xa6beba,'y',.045),0x627f82,1.06,.65,.17),...[-1,1].flatMap(side=>Array.from({length:3},(_,i)=>horn(i%2?0x8ba7a7:0xb8cbc4,[[side*(.27+i*.055),1.67-i*.022,.13],[side*(.30+i*.066),1.57-i*.015,.246],[side*(.31+i*.07),1.48-i*.025,.28]],[.039,.043,.003],6,5)))]);
  // Bare orbital mask and muzzle project out of the mane; the teeth belong to
  // the mouth, not a decorative row of spikes on the forehead or shoulders.
  p.head=joined([skinLoft([[-.17,.045,.10],[0,.265,.28,-.005],[.18,.255,.205,-.07],[.35,.15,.087,-.15]],0xa9c1b9,'z',12,12),oval(0x536f77,0,-.075,.300,.205,.175,.067),...eyes(0xd7bc7c,.115,.024,.343,.031),horn(0x536f77,[[-.19,.076,.262],[-.115,.069,.343],[0,.029,.358],[.115,.069,.343],[.19,.076,.262]],[.028,.036,.030,.036,.028],10,6),oval(0x344e58,0,-.075,.385,.078,.047,.036),oval(0x1c3038,0,-.175,.360,.137,.075,.035),...[-1,1].map(side=>oval(0x152b35,side*.035,-.080,.417,.018,.012,.005)),horn(0x738f92,[[-.13,-.210,.345],[0,-.246,.367],[.13,-.210,.345]],[.020,.031,.020],6,5),...[-1,1].map(side=>horn(0xd1d1b6,[[side*.097,-.115,.385],[side*.095,-.177,.403],[side*.074,-.225,.400]],[.028,.020,.001],4,5))]);
  p.upper=joined([coatLoft([[.23,.075,.085],[.13,.22,.24],[0,.26,.27],[-.19,.24,.25],[-.41,.19,.205],[-.62,.17,.17],[-.70,.155,.15]],0xb5cbc7,'y',.036)]);
  p.lower=joined([coatLoft([[.12,.11,.115],[.065,.16,.16],[.01,.17,.17],[-.24,.21,.19],[-.49,.225,.20],[-.72,.16,.15]],0xa0bab8,'y',.031)]);
  p.knuckle=joined([oval(0x607d82,0,.115,.06,.22,.115,.18),...[-1,0,1,2].map(s=>oval(0x829c9b,(s-.5)*.085,.065,.19,.056,.065,.079))]);
  p.thigh=joined([link(0xb1c7c0,.33,.20,.12)]);p.shin=joined([link(0x9bb6af,.32,.13,.105)]);p.foot=paw(0x708d8f,.17,.23,0x5c767a);
 }else if(id==='lavabrute'){
  // Sloping one-piece furnace shell; broad plate breaks follow the volume.
  const shell=faceted(skinLoft([[.43,.25,.23],[.73,.45,.36],[1.07,.59,.445,-.015],[1.42,.71,.47,-.065],[1.72,.71,.425,-.11],[1.94,.51,.30,-.12],[2.10,.28,.195,-.08]],0x46423b,'y',8,8,.065));
  p.body=joined([shell,tube(0xa96030,[[-.44,1.72,.32],[-.23,1.43,.453],[-.30,1.14,.42],[-.17,.87,.339]],.022,9),tube(0xca8336,[[.28,1.79,.29],[.18,1.48,.452],[.34,1.20,.406],[.19,.99,.373]],.019,9),horn(0x9b582b,[[-.18,1.47,.45],[0,1.36,.467],[.18,1.48,.45]],[.018,.035,.018],7,5)]);
  p.head=joined([faceted(skinLoft([[-.18,.04,.07],[0,.24,.21],[.16,.21,.16,-.045],[.28,.14,.07,-.085]],0x3a3733,'z',7,7)),tube(0xf1ad51,[[-.135,.011,.233],[0,-.012,.272],[.135,.011,.233]],.014,7),...[-1,1].map(s=>horn(0x6c5844,[[s*.18,.12,-.06],[s*.30,.31,-.10],[s*.24,.43,-.12]],[.11,.075,.004],6,5))]);
  p.upper=joined([faceted(skinLoft([[.22,.070,.080],[.12,.235,.255],[0,.29,.27],[-.16,.275,.245],[-.34,.205,.19],[-.51,.14,.14]],0x4d463c,'y',7,7))]);
  p.lower=joined([faceted(skinLoft([[.06,.13,.14],[-.05,.20,.20],[-.28,.32,.28],[-.51,.30,.28],[-.65,.18,.17]],0x635343,'y',7,7)),tube(0xcd8138,[[-.19,-.10,.16],[-.23,-.28,.21],[-.16,-.49,.268]],.016,6)]);
  p.thigh=joined([link(0x49443b,.35,.23,.13,true)]);p.shin=joined([link(0x685943,.37,.15,.12,true)]);p.foot=paw(0x52493a,.19,.235,0x957747);
 }else if(id==='icewitch'||id==='ashseer'){
  const ice=id==='icewitch',cloth=ice?0x7e9da9:0x574138,dark=ice?0x435e6b:0x302c2a,trim=ice?0xb4cbd0:0xa2764c;
  p.body=joined([robe(cloth,ice),...[-1,1].map(s=>horn(dark,[[s*.20,1.27,.14],[s*.14,.91,.183],[s*.17,.52,.23],[s*(ice?.30:.22),.15,.29]],[.045,.060,.074,.020],10,6)),tube(trim,[[-.14,1.30,.13],[0,1.23,.181],[.14,1.30,.13]],.010,6)]);
  p.head=joined([skinLoft([[-.20,.025,.03,.08],[-.12,.22,.27,.11],[.05,.225,.29,.06],[.17,.175,.225,0]],cloth,'z',10,10),oval(dark,0,-.01,.175,.154,.177,.029),...eyes(ice?0xaad8e0:0xd09a5e,.063,.024,.204,.019),...(!ice?[horn(0x282724,[[0,-.11,.208],[0,-.22,.226],[0,-.27,.21]],[.058,.045,.004],7,5)]:[]),horn(trim,ice?[[0,.23,-.01],[-.07,.41,-.05],[-.11,.56,-.17]]:[[0,.22,-.09],[0,.33,-.23],[0,.36,-.43]],ice?[.17,.08,.002]:[.11,.07,.002],8,7)]);
  p.staff=joined([tube(ice?0x6e8590:0x574532,[[0,-.72,0],[-.025,-.25,.01],[.01,.2,0],[.02,.56,0],[-.055,.81,0]],.032,12),...[-1,1].map(s=>horn(trim,[[0,.54,0],[s*.10,.66,0],[s*.11,.82,0],[s*.05,.90,0]],[.024,.032,.021,.003],8,6)),oval(ice?0xaec3c0:0x998369,-.015,.20,.02,.060,.067,.064)]);
  p.focus=joined([crystalShape(ice?0xb2dbe3:0xcf8c48,.075,.16,.2)]);
  p.upper=joined([link(cloth,.23,.12,.071)]);p.lower=joined([skinLoft([[.025,.077,.082],[-.10,.10,.09],[-.25,.060,.055]],cloth,'y',10,8,.04)]);
  p.arm=joined([skinLoft([[.13,.055,.065],[.045,.12,.115],[-.10,.15,.12],[-.29,.17,.10],[-.37,.11,.07]],cloth,'y',10,10,.09),oval(trim,0,-.37,.024,.052,.060,.045)]);p.foot=paw(dark,.075,.115,dark);
 }else if(id==='snowtotem'){
  p.cores=[joined([crystalShape(0x8cbdce,.29,.60,-.20),crystalShape(0xc5dce0,.105,.31,.35).translate(.18,-.17,.075)])];
  p.shard=joined([crystalShape(0x96c3ce,.085,.28,.28)]);
 }else{
  // A single tilted flame with a hollow charcoal cradle, not stacked blobs.
  p.cores=[joined([horn(0xc9752d,[[0,-.26,0],[0,-.06,.035],[.06,.18,0],[-.07,.44,-.05],[.02,.68,-.08]],[.018,.19,.13,.074,.002],12,9),horn(0xe5a647,[[.015,-.12,.11],[.04,.07,.13],[.09,.28,.05]],[.070,.074,.002],8,6)])];
  p.shard=joined([horn(0x3d3834,[[0,-.34,.01],[.13,-.15,.015],[.15,.09,0],[.07,.24,-.04]],[.015,.10,.070,.003],9,6)]);
 }
 if(id==='snowhare'){p.lids=lids(0xb6cbc2,.145,.024,.017);p.nose=joined([piece(new T.OctahedronGeometry(1,0),0x4a6468,0,0,0,.027,.016,.014),oval(0x334e53,0,-.032,-.003,.038,.025,.008),...[-1,1].map(side=>piece(new T.BoxGeometry(1,1,1),0xcdcdb5,side*.012,-.046,.007,.019,.042,.016,.10,0,side*.06))]);}
 else if(id==='frostwolf'){p.lids=lids(0x8faab5,.137,.034,.018);p.nose=joined([oval(0x293e4b,0,0,0,.065,.034,.025),...[-1,1].map(side=>oval(0x13252e,side*.036,-.004,.021,.015,.009,.006)),oval(0x6c848c,-.017,.010,.025,.025,.007,.003)]);}
 else if(id==='yeti')p.lids=lids(0x536f77,.115,.042,.020);
 else if(id==='emberling')p.lids=lids(0x8f5036,.096,.039,.019);
 templates.set(id,p);return p;
}
function group(parent,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
function add(parent,geometry,id,part,lit=false){prepareCreatureSurface(geometry,id,part);const m=new T.Mesh(geometry,lit?glow:skin);m.name='SM_Enemy_'+id+'_'+part;m.castShadow=!lit;m.receiveShadow=!lit;parent.add(m);return m;}
function makeLeg(root,p,id,{x,y,z,a,b,upper,lower,foot,phase=0,reach=0,back=false,drop=0,width=1}){
 // The legacy swim overlay turns `joint`. Keep the complete chain inside this
 // carrier, so paddling turns the knee/ankle/paw together without opening seams.
 const joint=group(root,x,y,z),upperJoint=group(joint),knee=group(joint),paw=group(joint);add(upperJoint,p[upper],id,upper);add(knee,p[lower],id,lower);add(paw,p[foot],id,'Paw');paw.scale.x=width;
 const ankle=drop?group(joint):null;if(ankle)add(ankle,p.hock,id,'Hock');
 return{joint,upper:upperJoint,knee,paw,ankle,upperLength:a,lowerLength:b,phase,restX:x,restY:y,restZ:z,reach,back,drop};
}
export function polishRegionalEnemy(g,id=g.userData.species){
 const d=g.userData;if(!kinds.has(id)||d.regionalAppearance)return g;
 const fitting=fittings.get(id),oldHeight=fitting?.height??(new T.Box3().setFromObject(g).max.y-g.position.y),p=template(id),rig=d.rig;rig.clear();
 for(const key of ['head','cap','jaw','tail','tailTip','smallTail','staff','focus','castingArm','satellites','cores','hem'])d[key]=null;
 d.legs=[];d.arms=[];d.feet=[];d.ears=[];d.regionalAppearance=true;d.regionalRoot=group(rig);const root=d.regionalRoot;
 if(p.body)add(root,p.body,id,'Body');
 if(id==='snowhare'){
  d.cap=group(root,0,.73,.45);add(d.cap,p.head,id,'Head');
  for(const s of [-1,1]){const ear=group(d.cap,s*.082,.14,-.025);addSoftEar(ear,p.ear,id);d.ears.push(ear);d.legs.push(makeLeg(root,p,id,{x:s*.18,y:.47,z:-.25,a:.31,b:.27,upper:'haunch',lower:'shin',foot:'foot',phase:0,back:true,drop:.115}));d.legs.push(makeLeg(root,p,id,{x:s*.125,y:.49,z:.30,a:.245,b:.235,upper:'fore',lower:'foreLower',foot:'frontFoot',phase:1.4}));}
  d.smallTail=group(root,0,.48,-.50);add(d.smallTail,p.tail,id,'Tail');
 }else if(id==='emberling'){
  d.cap=group(root,0,1.12,.04);add(d.cap,p.head,id,'Head');for(const s of [-1,1]){const ear=group(d.cap,s*.14,.13,-.045);add(ear,p.ear,id,'Horn');ear.scale.x=s;d.ears.push(ear);const arm=group(root,s*.235,.87,0),elbow=group(arm,0,-.27,0);add(arm,p.upper,id,'UpperArm');add(elbow,p.lower,id,'Forearm');arm.userData.elbow=elbow;d.arms.push(arm);d.legs.push(makeLeg(root,p,id,{x:s*.145,y:.52,z:0,a:.28,b:.26,upper:'thigh',lower:'shin',foot:'foot',phase:s<0?0:Math.PI}));}
  d.smallTail=group(root,0,.52,-.20);add(d.smallTail,p.tail,id,'Tail');
 }else if(id==='frostwolf'||id==='ashstalker'){
  const wolf=id==='frostwolf';d.head=group(root,0,wolf?1.01:.465,wolf?.57:.67);add(d.head,p.head,id,'Head');d.jaw=group(d.head,0,wolf?-.09:-.047,0);add(d.jaw,p.jaw,id,'Jaw');
  if(wolf)for(const s of [-1,1]){const ear=group(d.head,s*.136,.18,-.09);addSoftEar(ear,p.ear,id);d.ears.push(ear);}
  d.tail=group(root,0,wolf?.79:.40,wolf?-.56:-.67);add(d.tail,p.tail,id,'Tail');d.tailTip=group(d.tail,0,wolf?-.25:-.06,wolf?-.50:-.80);add(d.tailTip,p.tailTip,id,'TailTip');
  for(const s of [-1,1])for(const front of [false,true])d.legs.push(makeLeg(root,p,id,{x:s*(wolf?.19:.245),y:wolf?.72:.40,z:front?(wolf?.32:.40):(wolf?-.48:-.43),a:wolf?(front?.35:.39):.30,b:wolf?(front?.37:.31):.30,upper:wolf?(front?'frontUpper':'haunch'):'upper',lower:wolf?(front?'frontLower':'shin'):'lower',foot:'foot',phase:wolf?((s>0)===front?0:Math.PI):(s>0?Math.PI:0)+(front?Math.PI*.5:0),back:!front,drop:wolf&&!front?.18:0,reach:wolf?0:.31}));
 }else if(id==='yeti'||id==='lavabrute'){
  const ape=id==='yeti';d.head=group(root,0,ape?1.60:2.05,ape?.45:.19);add(d.head,p.head,id,'Head');d.knuckles=[];
  for(const s of [-1,1]){
   if(ape){const arm=makeLeg(root,p,id,{x:s*.52,y:1.44,z:.00,a:.68,b:.72,upper:'upper',lower:'lower',foot:'knuckle',phase:s<0?Math.PI:0,reach:.10});d.knuckles.push(arm);d.arms.push(arm.joint);arm.joint.userData.elbow=arm.knee;}
   else{const arm=group(root,s*.60,1.69,-.015),elbow=group(arm,0,-.51,0);add(arm,p.upper,id,'UpperArm');add(elbow,p.lower,id,'Forearm');arm.userData.elbow=elbow;arm.scale.setScalar(s>0?1.12:.94);d.arms.push(arm);}
   d.legs.push(makeLeg(root,p,id,{x:s*(ape?.255:.285),y:ape?.67:.75,z:ape?-.15:0,a:ape?.33:.35,b:ape?.32:.37,upper:'thigh',lower:'shin',foot:'foot',phase:s<0?0:Math.PI}));
  }
 }else if(id==='icewitch'||id==='ashseer'){
  d.head=group(root,0,1.50,.015);add(d.head,p.head,id,'Head');d.staff=group(root,.48,.76,.1);add(d.staff,p.staff,id,'Staff');d.focus=add(group(d.staff,0,.82,0),p.focus,id,'Focus',true);d.attackSocket=d.focus;
  const arm=group(root,-.235,1.075,0);add(arm,p.arm,id,'FreeArm');d.arms.push(arm);
  const upper=group(root,.225,1.055,.005),forearm=group(root);add(upper,p.upper,id,'CastingUpper');add(forearm,p.lower,id,'CastingForearm');d.castingArm={upper,forearm,upperLength:.23,lowerLength:.25};updateEnemyGrip(d);
  for(const s of [-1,1]){const foot=group(root,s*.15,.01,.045);add(foot,p.foot,id,'Foot');d.feet.push(foot);}
 }else{
  const crystal=id==='snowtotem';d.cores=[];d.satellites=group(root);for(const geo of p.cores){const core=group(root,0,crystal?.82:.71,0);add(core,geo,id,'Core',!crystal);d.cores.push(core);}
  for(const s of [-1,1]){const shard=group(d.satellites,s*(crystal?.38:.25),crystal?(s>0?.75:.97):.74,s*.07);add(shard,p.shard,id,'Satellite');shard.rotation.z=s*(crystal?-.18:-.44);if(!crystal)shard.scale.x=s;}
  d.attackSocket=d.cores[0];
 }
 if(p.lids){const parent=d.cap||d.head,anchor=id==='snowhare'?[0,.062,.140]:id==='frostwolf'?[0,.061,.196]:id==='yeti'?[0,.044,.360]:[0,.044,.169];d.expressionLids=group(parent,...anchor);add(d.expressionLids,p.lids,id,'Eyelids');d.expressionLids.scale.y=.08;}
 if(p.nose){const anchor=id==='snowhare'?[0,-.037,.293]:[0,-.028,.47];d.expressionNose=group(d.cap||d.head,...anchor);const nose=add(d.expressionNose,p.nose,id,'nose');nose.userData.creatureFinish='nose';d.expressionNose.userData.rest=anchor;}
 d.expressionSeed=(g.id*.61803398875)%1;
 // Calibrate the entire authored animal, never stretch its anatomy vertically.
 // The original projectile/collision height remains an explicit gameplay value.
 if(!fitting){const height=new T.Box3().setFromObject(g).max.y-g.position.y;fittings.set(id,{height:oldHeight,scale:oldHeight/height});}
 root.scale.setScalar(fittings.get(id).scale);root.name='SM_Enemy_'+id+'_Rig';d.regionalHeight=d.combatHeight=oldHeight;g.updateMatrixWorld(true);return g;
}
export function animateRegionalAppearance(d,t,stride,phase,wind,release,impact){
 if(!d.regionalAppearance)return;const id=d.species,rig=d.rig,active=d.previousAttack>0,drive=active?smooth((wind-.66)/.34):release,gather=active?smooth(wind/.6)*(1-.85*drive):release*.15,pounce=d.pounce||0,turn=d.motionTurn||0,look=d.motionLook||0,wave=Math.sin(phase),breath=Math.sin(t*1.9),air=Math.sin(Math.min(1,pounce)*Math.PI);rig.scale.set(1,1,1);
 if(id==='snowhare'){
  const hop=Math.max(0,wave),landing=Math.sin(clamp((d.landRecover||0)/.18,0,1)*Math.PI);rig.position.set(0,hop*.15*stride-gather*.045+air*.36-landing*.032,-impact*.08);rig.rotation.set(-hop*.11*stride+gather*.075-drive*.08,0,turn*.025);
  d.cap.rotation.set(.065+hop*.075*stride+gather*.13-drive*.20,look*.16,0);d.cap.scale.setScalar(1);
  d.ears.forEach((e,i)=>{
   const side=i?1:-1,lag=phase-.8-i*.13,soft=e.userData.softEar;
   e.rotation.set(-.24-Math.sin(phase-.35)*.105*stride-gather*.38+drive*.10,look*.045,-side*(.12+breath*.014));
   soft.mesh.morphTargetInfluences[0]=(.018-Math.sin(lag)*.18*stride-gather*.10+landing*.14+drive*.07)/.50;
   soft.mesh.morphTargetInfluences[1]=(.035-Math.sin(lag-.6)*.22*stride-gather*.09+landing*.19+drive*.10+Math.sin(t*1.6+i*.5)*.018)/.50;
  });d.smallTail.rotation.set(0,breath*.025,0);
  prepareCreatureFeet(d);for(const leg of d.legs)plantCreatureFoot(leg,phase,stride,{air:air*.36+hop*.085*stride,travel:leg.back?.23:.14,lift:leg.back?.145:.10,reachZ:leg.back?.075:0,toeRoll:leg.back?.36:.12});
 }else if(id==='emberling'){
   rig.position.set(wave*.018*stride,Math.abs(wave)*.022*stride-gather*.065+air*.25,-impact*.09);rig.rotation.set(gather*.13-drive*.22,-gather*.13+drive*.18,wave*.045*stride);d.cap.rotation.set(gather*.10-drive*.13,look*.25-rig.rotation.y*.4,-rig.rotation.z*.55);d.cap.scale.setScalar(1);d.ears.forEach((e,i)=>e.rotation.set(gather*.08,0,(i?1:-1)*.06));d.smallTail.rotation.set(-gather*.10+drive*.09,Math.sin(phase-.75)*.23*stride-rig.rotation.y*.6,0);
   d.arms.forEach((a,i)=>{a.rotation.set(Math.sin(phase+i*Math.PI-.15)*.32*stride-gather*(i?.62:.26)-drive*(i?.16:.48),0,(i?1:-1)*(.12+gather*.035));a.userData.elbow.rotation.x=-.28-gather*(i?.44:.28)+drive*.28;});prepareCreatureFeet(d);for(const leg of d.legs)plantCreatureFoot(leg,phase,stride,{air:air*.25,lift:.09,travel:.27,...d.motionGait});
 }else if(id==='frostwolf'||id==='ashstalker'){
   const wolf=id==='frostwolf';rig.position.set(wave*(wolf?.010:.018)*stride,Math.abs(wave)*(wolf?.013:.007)*stride-gather*(wolf?.055:.035)+air*.23,-impact*.10);rig.rotation.set(Math.sin(phase*2-.3)*(wolf?.009:.005)*stride+gather*.055+drive*.055,wolf?wave*.012*stride:Math.sin(phase-.35)*.052*stride,wave*(wolf?.014:.020)*stride-turn*.025);
   if(wolf)d.head.position.set(0,.97-gather*.035,.59-gather*.02+drive*.045);
   d.head.rotation.set((wolf?.055:0)-rig.rotation.x*.35+gather*.12-drive*(wolf?.21:.13),look*.25-rig.rotation.y*.7,-rig.rotation.z*.3);d.jaw.position.y=(wolf?-.125:-.072)-drive*.018;d.jaw.rotation.x=(wolf?.045:.018)+gather*(wolf?.24:.11)+drive*(wolf?.15:.21);
   d.tail.rotation.set(-gather*.04+drive*.05,Math.sin(phase*(wolf?.55:1)-.5)*(wolf?.10:.23)*stride-turn*.12,0);d.tailTip.rotation.set(0,Math.sin(phase*(wolf?.55:1)-1.05)*(wolf?.12:.26)*stride,0);d.ears.forEach((e,i)=>{e.rotation.set(-gather*.16,look*.10,(i?1:-1)*.09);const flex=e.userData.softEar.mesh.morphTargetInfluences;flex[0]=Math.sin(phase-.45-i*.1)*.075*stride-gather*.22+drive*.10;flex[1]=Math.sin(phase-.95-i*.1)*.10*stride-gather*.27+drive*.14;});
  prepareCreatureFeet(d);for(const leg of d.legs)plantCreatureFoot(leg,phase,stride*(pounce>0?.3:1),{air:air*.23,lift:wolf?.09:.055,travel:wolf?.37:.28,...d.motionGait});
 }else if(id==='yeti'||id==='lavabrute'){
   const ape=id==='yeti';rig.position.set(wave*(ape?.026:.032)*stride,Math.abs(wave)*(ape?.013:.008)*stride-gather*.065-drive*.025,-impact*.12);rig.rotation.set((ape?.075:0)+Math.sin(phase*2-.4)*(ape?.012:.006)*stride-gather*.12+drive*.16,ape?Math.sin(phase-.4)*.028*stride:Math.sin(phase-.3)*.022*stride-gather*.24+drive*.28,wave*(ape?.028:.035)*stride);
  d.head.rotation.set(-rig.rotation.x*.45+(ape?-gather*.16+drive*.11:0),look*.16-rig.rotation.y*.35,-rig.rotation.z*.3);prepareCreatureFeet(d);for(const leg of d.legs)plantCreatureFoot(leg,phase,stride,{lift:ape?.07:.045,travel:ape?.25:.30,...d.motionGait});
  if(ape)for(const arm of d.knuckles)plantCreatureFoot(arm,phase,stride,{lift:.07,travel:.25,...d.motionGait,reachZ:.31-gather*.35+drive*.35,raise:gather*(arm.restX<0?.78:.91)+drive*.09});
  else d.arms.forEach((a,i)=>{a.rotation.set(Math.sin(phase+i*Math.PI-.3)*.12*stride-gather*(i?1.6:.3)+drive*.40,0,(i?1:-1)*.075);a.userData.elbow.rotation.x=-.18-gather*(i?.40:.25)+drive*(i?.20:.12);});
 }else if(d.staff){
   const ice=id==='icewitch',walk=wave*stride;rig.position.set(walk*(ice?.006:.013),(ice?.085+breath*.015:.008+Math.abs(wave)*.013*stride)+gather*.04,-impact*.10);rig.rotation.set(gather*(ice?-.045:.045)-drive*.06,Math.sin(phase-.4)*.018*stride-gather*(ice?.035:.09)+drive*(ice?.025:.07),walk*.023);d.head.rotation.set(-rig.rotation.x*.65,look*.18-rig.rotation.y*.45,-rig.rotation.z*.6);
  d.staff.position.set(.48,.76+gather*(ice?.25:.31)-drive*.10,.1);d.staff.rotation.set(-gather*(ice?.65:.45)+drive*.47,0,(ice?.09:0)+Math.sin(phase-.55)*.025*stride);d.focus.scale.setScalar(1+gather*.18);d.arms[0].rotation.set(-Math.sin(phase-.5)*.10*stride-gather*.24+drive*.13,0,-.04-gather*.06);d.feet.forEach((f,i)=>{const step=Math.sin(phase+i*Math.PI);f.position.set((i?1:-1)*.15,.01+Math.max(0,-step)*.025*stride,.045+step*.055*stride);f.rotation.x=0;});updateEnemyGrip(d);
 }else{
   const crystal=id==='snowtotem';rig.position.set(0,.035+Math.sin(t*(crystal?1.4:2.2))*.022+gather*.075-drive*.035,-impact*.075);rig.rotation.set(-impact*.08-gather*(crystal?.035:.06)+drive*(crystal?.025:.09),0,Math.sin(t*1.3)*.020);d.satellites.position.y=-gather*(crystal?.025:.045)+drive*.035;d.satellites.rotation.y=(crystal?t*.35:Math.sin(t*1.7)*.18)-gather*.18+drive*.10;d.satellites.scale.setScalar(1+gather*(crystal?.18:-.16)+drive*.16);d.satellites.children.forEach((part,i)=>{part.rotation.x=Math.sin(t*(crystal?.9:1.5)-i*.65)*.035-gather*(i?.08:.13)+drive*(i?.11:.06);});
   d.cores[0].position.set(0,(crystal?.82:.71)+gather*.018-drive*.025,0);d.cores[0].rotation.set((crystal?Math.sin(t*1.1)*.05:Math.sin(t*2.4)*.07)-gather*.08+drive*.11,crystal?t*.12:Math.sin(t*.8)*.12,crystal?-.06:Math.sin(t*1.7)*.06);d.cores[0].scale.set(1-gather*.04,1+(crystal?0:Math.sin(t*2.9)*.035)+gather*.06,1-gather*.04);
 }
 animateEnemyExpression(d,t,stride,gather,drive,impact);
}

import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Five finite, shared sets of geometry. Articulation moves groups, never vertices.
const templates=new Map();
const skin=new T.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0});
const light=new T.MeshStandardMaterial({vertexColors:true,roughness:.6,emissive:0xffffff,emissiveIntensity:.35});
// One texture-free finish for the five shared templates. Detail fades before it
// becomes distant shimmer; positions stay local so markings follow each joint.
skin.onBeforeCompile=shader=>{
 shader.vertexShader='varying vec3 creaturePoint;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncreaturePoint=position;');
 shader.fragmentShader='varying vec3 creaturePoint;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float creaturePatch=.5+.25*sin(dot(creaturePoint,vec3(11.,7.,13.)))+.25*sin(dot(creaturePoint,vec3(-17.,19.,9.)));
  float creatureDetail=1.-smoothstep(.015,.055,max(length(dFdx(creaturePoint)),length(dFdy(creaturePoint))));
  diffuseColor.rgb*=1.-(.5-creaturePatch)*.16*creatureDetail;`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(creaturePatch-.5)*.10,.82,1.);');
};
skin.customProgramCacheKey=()=> 'forest-creature-surface';
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
function wolfTrunk(){
 const p=[],indices=[],rings=[[-.57,0,0,.68],[-.49,.18,.21,.66],[-.34,.245,.26,.68],[-.13,.215,.235,.71],[.06,.255,.30,.73],[.25,.275,.33,.75],[.39,.21,.265,.78],[.46,0,0,.80]],sides=16;
 for(const [z,rx,ry,y]of rings)for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;p.push(Math.cos(a)*rx,y+Math.sin(a)*ry,z);}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();colored(g,0x677574);
 const c=g.attributes.color,base=new T.Color(0x677574),belly=new T.Color(0xa7aca0),back=new T.Color(0x465653),shade=new T.Color();
 for(let i=0;i<c.count;i++){const x=p[i*3],y=p[i*3+1],low=1-T.MathUtils.smoothstep(y,.46,.70),ridge=T.MathUtils.smoothstep(y,.78,1.02)*(1-Math.min(1,Math.abs(x)/.25));shade.copy(base).lerp(belly,low*.70).lerp(back,ridge*.70);c.setXYZ(i,shade.r,shade.g,shade.b);}
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
function template(kind){
 if(templates.has(kind))return templates.get(kind);const p={};
 if(kind==='mushroom'){
  p.body=joined([
   profile([[0,.14],[.18,.155],[.265,.23],[.28,.35],[.225,.56],[.184,.79],[.19,.90],[0,.94]],0xc4b491,{depth:.87,bend:-.025,flute:.022,segments:20}),
   oval(0xe2d2a9,0,.60,.18,.21,.27,.10),
   ...[-1,1].flatMap(s=>[oval(0x423b32,s*.12,.70,.254,.073,.096,.025),oval(0xf5dfa0,s*.115,.714,.275,.026,.044,.013),oval(0xc3906b,s*.19,.60,.24,.045,.025,.015)]),
   oval(0x695342,0,.54,.269,.065,.018,.011),
   ...[-1,1].map(s=>oval(0xb3a37b,s*.265,.34,.02,.08,.18,.10))
  ]);
  const cap=[profile([[0,-.10],[.29,-.12],[.56,-.055],[.625,-.003],[.64,.03],[.625,.076],[.60,.14],[.44,.27],[.19,.34],[0,.35]],0x985239,{depth:.95,segments:28,lip:.018}),
   profile([[0,-.116],[.27,-.12],[.53,-.059],[.622,.008]],0xc6ad86,{depth:.95,segments:28,lip:.018}),capGills()];
  for(let i=0;i<11;i++){const a=i*2.399,r=.16+(i%4)*.089;cap.push(capPatch(Math.cos(a)*r,Math.sin(a)*r,.037+i%2*.022,.028+i%3*.009,i%2?0xe1cc9e:0xc3a478));}
  p.cap=joined(cap);p.foot=joined([oval(0xa88e65,0,0,.035,.13,.105,.20)]);
 }else if(kind==='wolf'){
  p.body=joined([
   wolfTrunk(),oval(0x9ea798,0,.65,.365,.19,.25,.12),
   oval(0x7f8b82,0,.88,.29,.215,.20,.20),
   ...[-1,1].map(s=>oval(0x697b73,s*.20,.70,.24,.085,.225,.18))
  ]);
  p.head=joined([
   oval(0x7e8d85,0,.03,.005,.225,.23,.255),oval(0xaab1a2,0,-.065,.275,.13,.105,.205),
   oval(0x283632,0,-.031,.426,.098,.060,.055),oval(0x354039,0,-.150,.32,.105,.025,.14),
   ...[-1,1].flatMap(s=>[oval(0x34463e,s*.155,.08,.180,.056,.045,.046),oval(0xdcc181,s*.163,.083,.215,.027,.021,.011),oval(0x334035,s*.166,.085,.225,.007,.020,.006,6,4),rock(0x667970,s*.18,.135,.17,.085,.038,.070,0,0,-s*.20),oval(0x8c9b8f,s*.185,-.10,-.035,.095,.13,.155),
    branch(0x45554c,[[s*.096,-.128,.23],[s*.117,-.133,.33],[s*.076,-.115,.429]],.007,6),piece(new T.ConeGeometry(.017,.057,6),0xd4ceb1,s*.09,-.173,.325,1,1,1,Math.PI)])
  ]);
  p.ear=joined([profile([[0,0],[.105,.02],[.075,.14],[.019,.29],[0,.30]],0x7d8e82,{depth:.48,bend:-.018}),oval(0x48584c,0,.12,.040,.048,.10,.008)]);
  p.jaw=joined([oval(0x7b8d80,0,0,.29,.12,.056,.18),oval(0x575447,0,.041,.34,.085,.008,.115),...[-1,1].map(s=>piece(new T.ConeGeometry(.012,.038,5),0xd4ceb1,s*.081,.053,.37))]);
  p.tail=joined([branch(0x677b70,[[0,0,0],[0,-.015,-.10],[0,-.055,-.21],[0,-.09,-.29]],.09)]);
  p.tailTip=joined([oval(0xa8b4af,0,-.025,-.065,.08,.075,.14)]);
  p.upper=joined([profile([[0,.025],[.075,.004],[.092,-.075],[.071,-.17],[.056,-.25],[0,-.265]],0x6b7e73,{depth:1.06,bend:.009,segments:12})]);
  p.lower=joined([oval(0x556d61,0,-.103,0,.052,.13,.057),oval(0x819486,0,-.231,.050,.075,.055,.105),...[-1,0,1].flatMap(s=>[oval(0x919e8b,s*.043,-.235,.120,.029,.045,.062,6,4),piece(new T.ConeGeometry(.010,.046,5),0x485047,s*.043,-.24,.181,1,1,1,Math.PI/2)])]);
 }else if(kind==='golem'){
  p.body=joined([
   boulder(0x626958,0,.93,-.015,.67,.69,.70,.12,.2,-.07),boulder(0x8a8d75,-.16,1.39,.07,.40,.33,.39,.2,-.2,-.1),
   boulder(0x737b62,.25,1.22,.14,.39,.38,.37,-.1,.2,.2),boulder(0x9b9f83,-.34,.81,.20,.25,.34,.30,.2,.2,-.3),
   rock(0x374b3e,.03,1.08,.48,.20,.25,.047),rock(0xa7d2a0,.01,1.11,.529,.075,.14,.023),
   ...[-1,1].flatMap(s=>[boulder(0x79816a,s*.46,1.44,-.03,.25,.17,.27,.1,0,s*.4),rock(0x627347,s*.39,1.48,.11,.25,.04,.19)]),
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
 }
 templates.set(kind,p);return p;
}
function group(parent,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
function add(parent,geometry,name,glow=false){const m=new T.Mesh(geometry,glow?light:skin);m.name=name;m.castShadow=!glow;m.receiveShadow=!glow;parent.add(m);return m;}
export function polishEnemyAppearance(g){
 const d=g.userData,kind=d.kind;if(d.appearance||!['mushroom','wolf','golem','spitter','shaman'].includes(kind)||d.species)return g;
 const p=template(kind),rig=d.rig;rig.clear();d.appearance=true;d.legs=[];d.arms=[];add(rig,p.body,'creature-body');
 if(kind==='mushroom'){
  d.cap=group(rig,0,1.01,0);add(d.cap,p.cap,'mushroom-cap');d.feet=[-1,1].map(s=>{const f=group(rig,s*.18,.12,.10);add(f,p.foot,'mushroom-foot');return f;});
 }else if(kind==='wolf'){
  d.head=group(rig,0,.80,.47);add(d.head,p.head,'wolf-head');d.jaw=group(d.head,0,-.21,0);add(d.jaw,p.jaw,'wolf-jaw');
  d.ears=[-1,1].map(s=>{const ear=group(d.head,s*.17,.25,-.06);add(ear,p.ear,'wolf-ear');return ear;});
  d.tail=group(rig,0,.75,-.46);add(d.tail,p.tail,'wolf-tail');d.tailTip=group(d.tail,0,-.09,-.26);add(d.tailTip,p.tailTip,'wolf-tail-tip');
  for(const x of[-.22,.22])for(const z of[-.28,.28]){const joint=group(rig,x,.49,z),knee=group(joint,0,-.24,0),paw=group(knee,0,-.24,.03);add(joint,p.upper,'wolf-upper-leg');add(knee,p.lower,'wolf-lower-leg');d.legs.push({joint,knee,paw,phase:x*z>0?0:Math.PI,upperLength:.24,lowerLength:.24,restY:.49});}
 }else if(kind==='golem'){
  d.head=group(rig,0,1.80,.03);add(d.head,p.head,'golem-head');
  for(const s of[-1,1]){const arm=group(rig,s*.73,1.34,0);add(arm,p.arm,'golem-arm');d.arms.push(arm);const joint=group(rig,s*.30,.57,0);add(joint,p.leg,'golem-leg');d.legs.push({joint,phase:s<0?0:Math.PI});}
 }else{
  d.head=group(rig,0,1.26,0);add(d.head,p.head,'caster-head');d.hatTip=group(d.head,-.035,.40,-.035);add(d.hatTip,p.hatTip,'caster-hat-tip');d.hem=group(rig);add(d.hem,p.hem,'caster-hem');
  d.staff=group(rig,.48,.76,.1);add(d.staff,p.staff,'caster-staff');d.focus=add(group(d.staff,0,.82,0),p.focus,'caster-focus',true);
  const arm=group(rig,-.26,1.03,0);add(arm,p.arm,'caster-free-arm');d.arms=[arm];
  const upper=group(rig,.245,1.035,.005),forearm=group(rig);add(upper,p.castingUpper,'caster-upper-arm');add(forearm,p.castingForearm,'caster-forearm');
  d.castingArm={upper,forearm,upperLength:.23,lowerLength:.25};updateEnemyGrip(d);
  d.feet=[-1,1].map(s=>{const foot=group(rig,s*.15,.08,.07);add(foot,p.foot,'caster-foot');return foot;});
 }
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

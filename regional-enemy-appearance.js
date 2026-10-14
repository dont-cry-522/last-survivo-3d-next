import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {updateEnemyGrip} from './enemy-appearance.js?v=190';

// Bounded shared templates; every moving part is a batch, not a collection of
// decorative meshes. Only joints move after construction.
const kinds=new Set(['snowhare','frostwolf','yeti','icewitch','snowtotem','emberling','ashstalker','lavabrute','cinderwisp','ashseer']);
const templates=new Map(),fittings=new Map(),skin=new T.MeshStandardMaterial({vertexColors:true,roughness:.87,metalness:0}),glow=new T.MeshStandardMaterial({vertexColors:true,roughness:.48,emissive:0xff7933,emissiveIntensity:.07});
skin.name='M_Regional_Creature_A';glow.name='M_Regional_Core_A';
const clamp=T.MathUtils.clamp,smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function color(g,c){const base=new T.Color(c),p=g.attributes.position,n=g.attributes.normal,a=[];for(let i=0;i<p.count;i++){const grain=.94+.045*Math.sin(p.getX(i)*13+p.getY(i)*8+p.getZ(i)*11),shade=grain*(.93+.07*Math.max(0,n?.getY(i)||0));a.push(base.r*shade,base.g*shade,base.b*shade);}g.setAttribute('color',new T.Float32BufferAttribute(a,3));g.deleteAttribute('uv');return g;}
function piece(g,c,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){g.scale(sx,sy,sz);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);return color(g,c);}
const oval=(c,x,y,z,sx,sy,sz)=>piece(new T.SphereGeometry(1,10,6),c,x,y,z,sx,sy,sz);
const tube=(c,points,r=.03,segments=10)=>color(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,r,6,false),c);
function joined(parts){const flat=parts.map(g=>g.index?g.toNonIndexed():g),g=mergeGeometries(flat,false);for(const p of new Set([...parts,...flat]))p.dispose();g.computeBoundingBox();g.computeBoundingSphere();return g;}
// Smooth cross sections join ribcage, waist and neck into a single skin. Ends
// close to one vertex; normals are shared around the rings before batching.
function skinLoft(rings,c,axis='y',sides=14,steps=18,fold=0){
 sides=Math.min(sides,12);steps=Math.min(steps,12);
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
function tintFront(g,c,centerY,radiusY,zStart){const p=g.attributes.position,colors=g.attributes.color,target=new T.Color(c),shade=new T.Color();for(let i=0;i<p.count;i++){const front=smooth((p.getZ(i)-zStart)/.17),center=1-smooth(Math.abs(p.getX(i))/.40),height=1-smooth(Math.abs(p.getY(i)-centerY)/radiusY);shade.setRGB(colors.getX(i),colors.getY(i),colors.getZ(i)).lerp(target,front*center*height*.78);colors.setXYZ(i,shade.r,shade.g,shade.b);}return g;}
function faceted(g){const next=g.index?g.toNonIndexed():g;next.computeVertexNormals();if(next!==g)g.dispose();return next;}
function crystalShape(c,r,h,bend=0){const g=new T.OctahedronGeometry(1,0);g.scale(r,h,r*.72);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+p.getY(i)*bend);g.computeVertexNormals();return color(g,c);}
function horn(c,points,radii,steps=10,sides=6){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,steps,1,sides,false),p=g.attributes.position;for(let i=0;i<p.count;i++){const row=Math.floor(i/(sides+1)),t=row/steps,center=curve.getPointAt(t),k=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(k)),r=T.MathUtils.lerp(radii[j],radii[j+1],k-j);p.setXYZ(i,center.x+(p.getX(i)-center.x)*r,center.y+(p.getY(i)-center.y)*r,center.z+(p.getZ(i)-center.z)*r);}g.computeVertexNormals();return color(g,c);}
function eyes(c,x,y,z,r=.035){return[-1,1].flatMap(s=>[oval(0x28333b,s*x,y,z,r*1.5,r,r*.6),oval(c,s*x,y+.005,z+r*.42,r*.64,r*.61,r*.27)]);}
function template(id){
 if(templates.has(id))return templates.get(id);const p={},snow=['snowhare','frostwolf','yeti','icewitch','snowtotem'].includes(id),coat=snow?0xc9dadd:0x473b3d,belly=snow?0xe5e8dc:0x87513e;
 if(id==='snowhare'||id==='emberling'){
  const hare=id==='snowhare';
  p.body=joined([skinLoft([[.14,.15,.15],[.28,.33,.30],[.47,.38,.30],[.68,.30,.25],[.89,.20,.18]],hare?0xd7e2dc:0x793e35),oval(belly,0,.48,.246,.25,.29,.09)]);
  p.head=joined([skinLoft([[-.21,.015,.015,0],[-.16,.17,.17,.01],[0,.25,.24,0],[.16,.18,.17,-.03],[.25,.10,.06,-.07]],hare?0xe1e8de:0xa25b43,'z',14,14),...eyes(hare?0x839daa:0xfab85c,.115,.035,.179,.032),oval(hare?0x987b77:0x412e30,0,-.072,.257,.052,.037,.034),tube(0x796660,[[-.052,-.124,.212],[0,-.135,.239],[.052,-.124,.212]],.008,5)]);
  p.ear=joined(hare?[skinLoft([[0,.066,.055],[.18,.076,.037],[.40,.062,.028],[.55,.012,.009]],0xdce7e0,'y',10,12),oval(0xaabcbc,0,.29,.027,.032,.18,.016)]:[horn(0x3b333a,[[0,0,0],[0,.16,-.025],[-.025,.28,-.1],[-.06,.32,-.18]],[.092,.075,.039,.003])]);
  p.arm=joined([skinLoft([[.04,.074,.075],[-.08,.085,.078],[-.22,.05,.07],[-.27,.04,.055]],coat,'y',10,10),oval(belly,0,-.23,.035,.073,.07,.11)]);
  p.foot=joined([oval(coat,0,.10,-.08,.14,.19,.16),oval(hare?0xb7cecb:0x4c3431,0,.02,.10,.14,.08,.24),...[-1,0,1].map(s=>oval(belly,s*.056,.035,.277,.034,.025,.027))]);
  p.tail=joined(hare?[oval(0xe0e6d9,0,0,0,.14,.14,.13)]:[horn(0x9d5140,[[0,0,0],[0,-.08,-.15],[.03,-.06,-.28],[.06,.08,-.34]],[.074,.061,.038,.004])]);
 }else if(id==='frostwolf'||id==='ashstalker'){
  const wolf=id==='frostwolf';
  p.body=joined([skinLoft(wolf?[[-.56,.06,.07,.62],[-.42,.20,.21,.65],[-.22,.19,.22,.69],[.04,.25,.28,.73],[.26,.24,.30,.77],[.49,.15,.20,.84],[.60,.10,.12,.86]]:[[-.64,.05,.05,.39],[-.49,.22,.15,.40],[-.23,.27,.18,.41],[.10,.27,.17,.43],[.33,.21,.14,.46],[.53,.16,.10,.48]],wolf?0xadc6ce:0x4a4245,'z',16,24),...Array.from({length:wolf?4:7},(_,i)=>{const z=-.43+i*(wolf?.19:.135),h=wolf?.12:.38*(.75+.25*Math.sin(i/6*Math.PI));return horn(wolf?0x94bdcf:0xbb6a42,[[0,wolf?.88:.53,z],[0,(wolf?.88:.53)+h*.6,z-.03],[0,(wolf?.88:.53)+h,z-.08]],[.071,.048,.003]);})]);
  p.head=joined([skinLoft(wolf?[[-.25,.05,.06,.03],[-.15,.19,.21,.04],[.02,.21,.20,.015],[.16,.17,.13,-.03],[.32,.11,.078,-.056],[.42,.079,.062,-.048]]:[[-.20,.08,.035,0],[-.10,.23,.072,0],[.08,.26,.070,0],[.27,.215,.058,-.025],[.45,.16,.040,-.035]],wolf?0xd1e0de:0x635051,'z',14,18),oval(wolf?0x374b59:0x302c30,0,-.042,wolf?.411:.449,wolf?.081:.125,wolf?.047:.027,.022),...eyes(wolf?0x90d5ef:0xecaa51,wolf?.155:.224,wolf?.06:.065,wolf?.19:.09,.026),...[-1,1].map(s=>tube(wolf?0x789aa9:0x9c684d,wolf?[[s*.13,.115,.20],[s*.18,.115,.12],[s*.19,.08,.04]]:[[s*.17,.084,.13],[s*.224,.094,.06],[s*.21,.075,-.01]],.022,5))]);
  p.ear=joined(wolf?[skinLoft([[0,.095,.057],[.11,.075,.047],[.27,.012,.007]],0xc6dcde,'y',10,10),oval(0x769aa8,0,.10,.044,.043,.075,.009)]:[skinLoft([[0,.063,.017],[.10,.085,.023],[.26,.008,.003]],0xa36b50,'z',6,6)]);
  p.jaw=joined([oval(wolf?0xb5cbd0:0x8b6854,0,0,.25,wolf?.11:.15,.042,.17),...[-1,1].map(s=>piece(new T.ConeGeometry(.014,.043,5),0xd7d4b9,s*.085,.045,.32))]);
  p.tail=joined([horn(wolf?0xa9c4cd:0x514245,[[0,0,0],[0,-.06,-.17],[0,-.09,-.32],[0,-.08,wolf?-.40:-.50]],wolf?[.105,.12,.09,.055]:[.115,.093,.055,.018])]);
  p.tailTip=joined([horn(wolf?0xdae1dc:0xb97a54,[[0,0,0],[0,.025,-.12],[0,.04,-.24]],[wolf?.064:.024,.038,.002])]);
  const upper=wolf?.245:.18,lower=wolf?.24:.19;p.lengths=[upper,lower];
  p.upper=joined([skinLoft([[.035,.081,.09],[-.065,.094,.10],[-upper*.72,.068,.06],[-upper,.055,.055]],coat,'y',10,10)]);
  p.lower=joined([skinLoft([[.025,.052,.055],[-lower*.52,.048,.055],[-lower,.055,.062]],wolf?0x87a8b7:0x735442,'y',10,10),oval(wolf?0xbad1d2:0x94725a,0,-lower+.025,.072,.082,.055,.12),...[-1,0,1].map(s=>horn(wolf?0x5c7886:0xcab389,[[s*.044,-lower+.02,.13],[s*.044,-lower+.015,.19],[s*.044,-lower-.005,.209]],[.013,.011,.002],5,5))]);
 }else if(id==='yeti'||id==='lavabrute'){
  const ape=id==='yeti',dark=ape?0x738d94:0x302d32;
  const torso=skinLoft(ape?[[.41,.22,.19],[.59,.39,.28],[.91,.52,.36],[1.26,.66,.42],[1.53,.59,.35],[1.69,.27,.21]]:[[.41,.24,.22],[.63,.42,.32],[1.02,.57,.39],[1.36,.65,.38],[1.62,.48,.28],[1.71,.24,.20]],ape?0xc6d6d4:0x4e4542,'y',ape?12:9,ape?12:7,ape?.025:.055);
  p.body=joined([ape?tintFront(torso,0x92afb2,1.0,.56,.16):faceted(tintFront(torso,0x312a28,1.07,.48,.17)),...(!ape?[tube(0xc77949,[[-.20,1.42,.35],[-.09,1.18,.389],[-.17,.94,.378]],.012),tube(0xe6a15a,[[.18,1.40,.36],[.07,1.20,.393],[.16,.91,.36]],.011),oval(0xcb8748,0,1.20,.392,.047,.115,.014)]:[])]);
  p.head=joined([skinLoft([[-.25,.09,.10,0],[-.13,.29,.31,0],[.05,.31,.29,.005],[.20,.235,.19,-.03],[.30,.16,.12,-.085]],ape?0xd7dfd6:0x4f4542,'z',14,16),oval(dark,0,-.035,.229,.22,.195,.09),oval(ape?0x9bb3b2:0x6b5446,0,-.11,.302,.14,.08,.06),...eyes(ape?0xc6e7e9:0xf4bd6a,.112,.08,.293,.035),oval(dark,0,-.035,.325,.081,.038,.026),...[-1,1].map(s=>tube(ape?0xa6bcbe:0x796052,[[s*.024,.142,.303],[s*.105,.156,.289],[s*.203,.108,.267]],.032,6)),...(!ape?[-1,1].map(s=>horn(0x2f2c32,[[s*.22,.17,-.06],[s*.34,.36,-.09],[s*.39,.56,-.02],[s*.31,.67,.055]],[.12,.09,.05,.003])):[])]);
  const upper=skinLoft([[.19,.024,.025],[.14,.16,.16],[.035,.245,.23],[-.13,.23,.21],[-.35,.19,.175],[-.50,.135,.14]],ape?0xc0d0d1:0x544844,'y',ape?12:8,12,ape?.04:0);p.upper=joined([ape?upper:faceted(upper)]);
  const fore=skinLoft([[.075,.115,.12],[.01,.17,.165],[-.16,ape?.19:.24,.18],[-.37,ape?.22:.27,ape?.19:.23],[-.53,.17,.15]],ape?0xa7c1c5:0x5c4e45,'y',ape?12:8,12);
  p.lower=joined([ape?fore:faceted(fore),oval(dark,0,-.43,.07,ape?.22:.28,.17,ape?.21:.27),...[-1,0,1].map(s=>oval(ape?0x748e95:0x8d7156,s*(ape?.102:.12),-.49,ape?.212:.265,.067,.09,.066))]);
  p.thigh=joined([skinLoft([[.08,.21,.21],[-.12,.22,.19],[-.29,.14,.145]],coat,'y',12,12)]);
  p.shin=joined([skinLoft([[.04,.135,.14],[-.16,.14,.14],[-.32,.14,.17]],coat,'y',12,12),oval(dark,0,-.28,.105,.18,.10,.245),...[-1,0,1].map(s=>oval(ape?0x90aaad:0x9c7958,s*.085,-.29,.295,.055,.055,.056))]);
 }else if(id==='icewitch'||id==='ashseer'){
  const ice=id==='icewitch',cloth=ice?0x819eae:0x713e36,trim=ice?0xc7dce1:0xbe8a57,dark=ice?0x4d6e82:0x342c32;
  p.body=joined([skinLoft([[.36,.25,.20],[.58,.28,.22],[.84,.23,.175],[1.06,.30,.19],[1.19,.19,.15]],cloth,'y',18,20,.055),tube(trim,[[-.17,1.16,.13],[-.18,1.10,.162],[0,1.055,.198],[.18,1.10,.162],[.17,1.16,.13]],.010,10)]);
  p.hem=joined([skinLoft([[.04,.24,.25],[.10,.35,.31],[.28,.34,.27],[.48,.26,.21]],dark,'y',18,16,.10)]);
  p.head=joined([skinLoft([[-.20,.02,.03,.02],[-.12,.235,.28,.06],[.04,.248,.285,.03],[.14,.21,.23,0]],cloth,'z',16,16),oval(dark,0,-.015,.139,.17,.17,.079),...eyes(ice?0xc3edf1:0xf9c06c,.073,.021,.207,.028),oval(ice?0xb8c9c8:0x967f6b,0,-.07,.219,.035,.055,.025),...[-1,1].map(s=>horn(ice?0xc0dce1:0x352c32,[[s*.16,.20,.025],[s*.23,.39,-.04],[s*.18,.57,-.06]],[.081,.054,.004]))]);
  p.staff=joined([tube(ice?0x718c98:0x685044,[[0,-.72,0],[-.025,-.25,.01],[.01,.2,0],[.02,.56,0],[-.055,.81,0]],.033,15),...[-1,1].map(s=>horn(trim,[[0,.54,0],[s*.10,.66,0],[s*.11,.82,0],[s*.05,.90,0]],[.027,.036,.023,.003])),oval(ice?0xc2d2d0:0x9c8a73,-.015,.20,.02,.065,.07,.072),...[-1,0,1].map(s=>tube(ice?0xaec5c7:0xba9c7a,[[.022,.20+s*.032,.068],[-.02,.197+s*.032,.087],[-.060,.20+s*.032,.051]],.009,4))]);
  p.focus=joined([skinLoft([[-.14,.006,.006],[-.075,.068,.068],[.06,.085,.07],[.17,.004,.004]],ice?0xb2e4ef:0xf1a45d,'y',7,8)]);
  p.upper=joined([skinLoft([[.035,.102,.115],[-.10,.125,.11],[-.23,.073,.083]],cloth,'y',10,10,.03)]);
  p.lower=joined([skinLoft([[.026,.078,.085],[-.12,.09,.082],[-.218,.072,.08],[-.25,.062,.06]],cloth,'y',10,10,.05)]);
  p.arm=joined([skinLoft([[.025,.11,.12],[-.15,.125,.105],[-.30,.064,.065]],cloth,'y',10,12,.04),oval(ice?0xc2d2d0:0x9c8a73,0,-.32,.035,.068,.082,.088)]);
  p.foot=joined([oval(dark,0,0,.05,.083,.07,.14)]);
 }else{
  const crystal=id==='snowtotem';p.cores=[];
  for(let i=0;i<3;i++)p.cores.push(joined(crystal?[crystalShape(i===1?0xc0dce1:0x749fae,.27-i*.045,.28-i*.025,i%2?.12:-.10)]:[skinLoft([[-.23,.010,.010],[-.08,.115-i*.020,.09],[.08,.095-i*.016,.070],[.25,.031,.023],[.40,.003,.003]],i===1?0xe78030:0x873817,'y',10,12,.07)]));
  p.shard=joined(crystal?[skinLoft([[-.22,.003,.003],[-.04,.095,.065],[.14,.064,.053],[.27,.003,.003]],0xb7d7dd,'y',7,7)]:[horn(0x44383b,[[0,-.20,0],[.065,-.09,.055],[.04,.08,.03],[0,.22,0]],[.09,.14,.12,.006])]);
 }
 templates.set(id,p);return p;
}
function group(parent,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
function add(parent,geometry,id,part,lit=false){const m=new T.Mesh(geometry,lit?glow:skin);m.name='SM_Enemy_'+id+'_'+part;m.castShadow=!lit;m.receiveShadow=!lit;parent.add(m);return m;}
export function polishRegionalEnemy(g,id=g.userData.species){
 const d=g.userData;if(!kinds.has(id)||d.regionalAppearance)return g;
 const fitting=fittings.get(id),oldHeight=fitting?.height??(new T.Box3().setFromObject(g).max.y-g.position.y),p=template(id),rig=d.rig;rig.clear();
 for(const key of ['head','cap','jaw','tail','tailTip','smallTail','staff','focus','castingArm','satellites','cores','hem'])d[key]=null;
 d.legs=[];d.arms=[];d.feet=[];d.ears=[];d.regionalAppearance=true;d.regionalRoot=group(rig);const root=d.regionalRoot;
 if(p.body)add(root,p.body,id,'Body');
 if(id==='snowhare'||id==='emberling'){
  d.cap=group(root,0,.93,.105);add(d.cap,p.head,id,'Head');
  for(const s of [-1,1]){const ear=group(d.cap,s*.142,.18,-.025);add(ear,p.ear,id,'Ear');d.ears.push(ear);const arm=group(root,s*.29,.75,.08);add(arm,p.arm,id,'Forepaw');d.arms.push(arm);const foot=group(root,s*.245,.095,.08);add(foot,p.foot,id,'Hindpaw');d.feet.push(foot);}
  d.smallTail=group(root,0,.43,-.30);add(d.smallTail,p.tail,id,'Tail');
 }else if(id==='frostwolf'||id==='ashstalker'){
  const wolf=id==='frostwolf';d.head=group(root,0,wolf?.83:.50,.48);add(d.head,p.head,id,'Head');d.jaw=group(d.head,0,wolf?-.15:-.12,0);add(d.jaw,p.jaw,id,'Jaw');
  for(const s of [-1,1]){const ear=group(d.head,s*(wolf?.15:.215),wolf?.19:.02,-.09);add(ear,p.ear,id,'Ear');d.ears.push(ear);if(!wolf)ear.rotation.y=Math.PI+s*.35;}
  d.tail=group(root,0,wolf?.71:.43,wolf?-.43:-.58);add(d.tail,p.tail,id,'Tail');d.tailTip=group(d.tail,0,-.08,wolf?-.39:-.47);add(d.tailTip,p.tailTip,id,'TailTip');
  for(const x of [-1,1])for(const z of [-1,1]){const hip=group(root,x*(wolf?.205:.285),wolf?.53:.415,z*(wolf?.28:.34)),knee=group(hip,0,-p.lengths[0],0);add(hip,p.upper,id,'UpperLeg');add(knee,p.lower,id,'LowerLeg');d.legs.push({joint:hip,knee,phase:x*z>0?0:Math.PI,upperLength:p.lengths[0],lowerLength:p.lengths[1],restY:hip.position.y,restX:hip.position.x,restZ:hip.position.z});}
 }else if(id==='yeti'||id==='lavabrute'){
  const ape=id==='yeti';d.head=group(root,0,1.86,.12);add(d.head,p.head,id,'Head');
  for(const s of [-1,1]){const arm=group(root,s*.66,1.47,0),elbow=group(arm,0,-.49,0);add(arm,p.upper,id,'UpperArm');add(elbow,p.lower,id,'Forearm');d.arms.push(arm);arm.userData.elbow=elbow;const hip=group(root,s*.26,.65,0),knee=group(hip,0,-.29,0);add(hip,p.thigh,id,'Thigh');add(knee,p.shin,id,'Shin');d.legs.push({joint:hip,knee,phase:s<0?0:Math.PI,upperLength:.29,lowerLength:.32,restY:.65,restX:s*.26,restZ:0});}
  d.regionalApe=ape;
 }else if(id==='icewitch'||id==='ashseer'){
  d.head=group(root,0,1.39,0);add(d.head,p.head,id,'Head');d.hem=group(root);add(d.hem,p.hem,id,'Hem');d.staff=group(root,.48,.76,.1);add(d.staff,p.staff,id,'Staff');d.focus=add(group(d.staff,0,.82,0),p.focus,id,'Focus',true);d.attackSocket=d.focus;
  const arm=group(root,-.275,1.04,0);add(arm,p.arm,id,'FreeArm');d.arms.push(arm);
  const upper=group(root,.245,1.035,.005),forearm=group(root);add(upper,p.upper,id,'CastingUpper');add(forearm,p.lower,id,'CastingForearm');d.castingArm={upper,forearm,upperLength:.23,lowerLength:.25};updateEnemyGrip(d);
  for(const s of [-1,1]){const foot=group(root,s*.15,.09,.05);add(foot,p.foot,id,'Foot');d.feet.push(foot);}
 }else{
  d.cores=[];d.satellites=group(root);p.cores.forEach((geometry,i)=>{const core=group(root,0,.58+i*.33,0);add(core,geometry,id,'Core'+i,id==='cinderwisp');d.cores.push(core);});
  for(const s of [-1,1]){const shard=group(d.satellites,s*.46,.94,0);add(shard,p.shard,id,'Satellite');}d.attackSocket=d.cores[1];
 }
 // Projectile height derives from the actor Box3 at spawn. Keep that existing
 // contract while remodelling the silhouette, without resizing the collision root.
 if(!fitting){const height=new T.Box3().setFromObject(g).max.y-g.position.y;fittings.set(id,{height:oldHeight,scale:oldHeight/height});}
 root.scale.y=fittings.get(id).scale;root.name='SM_Enemy_'+id+'_Rig';d.regionalHeight=d.combatHeight=oldHeight;g.updateMatrixWorld(true);return g;
}

const soleCache=new WeakMap(),soleMatrix=new T.Matrix4();
function solePoints(geometry){
 if(!soleCache.has(geometry)){
  const p=geometry.attributes.position,points=new Map(),bottom=geometry.boundingBox.min.y;
  for(let i=0;i<p.count;i++)if(p.getY(i)<bottom+.18){const point=[p.getX(i),p.getY(i),p.getZ(i)];points.set(point.map(v=>v.toFixed(5)).join(','),point);}
  soleCache.set(geometry,[...points.values()]);
 }
 return soleCache.get(geometry);
}
function plant(leg,phase,stride,rigY=0,crouch=0,lift=.10,spread=0,air=0){
 const u=((phase/(Math.PI*2))%1+1)%1,support=u<.62,swing=support?0:(u-.62)/.38,travel=support?1-2*u/.62:-1+2*smooth(swing),a=leg.upperLength,b=leg.lowerLength;
 const z=travel*.15*stride+crouch*.055,y=Math.max(.1,leg.restY-.035+rigY-Math.sin(swing*Math.PI)*lift*stride-crouch*.025),distance=clamp(Math.hypot(y,z),Math.abs(a-b)+.001,a+b-.002),knee=Math.PI-Math.acos(clamp((a*a+b*b-distance*distance)/(2*a*b),-1,1)),hip=-Math.atan2(z,y)-Math.acos(clamp((a*a+distance*distance-b*b)/(2*a*distance),-1,1));
 leg.joint.position.y=leg.restY;leg.joint.rotation.set(hip,0,Math.sign(leg.restX)*spread);leg.knee.rotation.set(knee,0,0);
 // Match the real batched sole, including long toes and the fitted template's
 // vertical scale. This bounded hip correction leaves bone lengths unchanged.
 const fit=leg.joint.parent,rig=fit.parent;rig.updateMatrix();fit.updateMatrix();leg.joint.updateMatrix();leg.knee.updateMatrix();
 soleMatrix.multiplyMatrices(rig.matrix,fit.matrix).multiply(leg.joint.matrix).multiply(leg.knee.matrix);const e=soleMatrix.elements;let bottom=Infinity;
 for(const p of solePoints(leg.knee.children[0].geometry))bottom=Math.min(bottom,e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13]);
 const up=rig.matrix.elements[5]*fit.scale.y,target=.006+Math.sin(swing*Math.PI)*lift*stride+air;
 leg.joint.position.y+=clamp((target-bottom)/up,-.12,.14);
}
export function animateRegionalAppearance(d,t,stride,phase,wind,release,impact){
 if(!d.regionalAppearance)return;const id=d.species,rig=d.rig,active=d.previousAttack>0,drive=active?smooth((wind-.66)/.34):release,gather=active?smooth(wind/.6)*(1-.85*drive):release*.15,pounce=d.pounce||0,turn=d.motionTurn||0,look=d.motionLook||0,wave=Math.sin(phase),lag=Math.sin(phase-.55),breath=Math.sin(t*1.9),air=Math.sin(Math.min(1,pounce)*Math.PI);
 rig.scale.set(1,1,1);
 if(id==='snowhare'||id==='emberling'){
  const hare=id==='snowhare',hop=hare?Math.max(0,wave):Math.abs(wave)*.22;
  rig.position.set(wave*(hare?.005:.016)*stride,hop*.15*stride-gather*.075+air*(hare?.40:.25),-impact*.10);
  rig.rotation.set(gather*.10-drive*.17,0,wave*(hare?.025:.07)*stride-turn*.03);
  d.cap.rotation.set(-hop*.075*stride+gather*.15-drive*.21,look*.18,-wave*.03*stride);d.cap.scale.setScalar(1);
  d.ears.forEach((e,i)=>e.rotation.set(-.08-Math.sin(phase-.65)*.12*stride-gather*.2+drive*.10,0,(i?1:-1)*(hare?.10:.05)));
  d.feet.forEach((f,i)=>{const step=hare?wave:Math.sin(phase+i*Math.PI);f.position.set((i?1:-1)*.245,.095+Math.max(0,-step)*.04*stride,.08+step*.075*stride);f.rotation.set(-hop*.25*stride+gather*.22-drive*.35,0,0);});
  d.arms.forEach((a,i)=>a.rotation.set((hare?-.15:Math.sin(phase+i*Math.PI-.5)*.25)*stride-gather*.18-drive*.18,0,(i?1:-1)*.10));
  d.smallTail.rotation.set(hare?0:Math.sin(phase-.8)*.10*stride,Math.sin(phase-.7)*.24*stride+breath*.035,0);
 }else if(id==='frostwolf'||id==='ashstalker'){
  const wolf=id==='frostwolf';rig.position.set(0,Math.abs(wave)*.012*stride-gather*.07+air*.23,-impact*.10);rig.rotation.set((wolf?.035:0)*stride+gather*.04+drive*.06,wolf?0:Math.sin(phase*.65)*.055*stride,wave*.018*stride-turn*.035);
  d.head.rotation.set((wolf?.05:0)*stride+gather*.16-drive*.22,look*.28-rig.rotation.y*.65-turn*.06,-wave*.014*stride);
  d.jaw.position.y=(wolf?-.15:-.12)-gather*.009-drive*.018;d.jaw.rotation.x=gather*.10+drive*.16;
  d.tail.rotation.set(-gather*.08,Math.sin(phase*(wolf?.55:.65)-.55)*(wolf?.13:.27)*stride-turn*.15,0);d.tailTip.rotation.set(0,Math.sin(phase*(wolf?.55:.65)-1.1)*(wolf?.16:.32)*stride,0);
  d.ears.forEach((e,i)=>e.rotation.set(gather*(wolf?-.17:.04)+breath*.02,(wolf?0:Math.PI+(i?1:-1)*.35)+look*.06,(i?1:-1)*(wolf?.06:0)));
  for(const leg of d.legs)plant(leg,phase+leg.phase,stride*(pounce>0?.25:1),rig.position.y-air*.23,gather,wolf?.10:.065,wolf?0:.16,air*.23);
 }else if(id==='yeti'||id==='lavabrute'){
  const ape=id==='yeti';rig.position.set(wave*.025*stride,Math.abs(wave)*.014*stride-gather*.06-drive*.04,-impact*.12);rig.rotation.set((ape?.085:.025)*stride-gather*.08+drive*.15,ape?Math.sin(phase-.4)*.025*stride:-gather*.22+drive*.26,wave*.035*stride);
  d.head.rotation.set(-rig.rotation.x*.45+gather*.03,look*.16-rig.rotation.y*.4,-rig.rotation.z*.35);
  d.arms.forEach((a,i)=>{a.rotation.set(Math.sin(phase+i*Math.PI-.4)*(ape?.30:.14)*stride-gather*(ape?1.8:i?1.9:.38)+drive*.35,0,(i?1:-1)*gather*.10);a.userData.elbow.rotation.x=-.12-gather*(ape?.24:.36)+drive*.15;});
  for(const leg of d.legs)plant(leg,phase+leg.phase,stride,rig.position.y,gather,ape?.085:.055);
 }else if(d.staff){
  const ice=id==='icewitch',walk=wave*stride;rig.position.set(walk*.012,(ice?.13+breath*.025:.012+Math.abs(wave)*.020*stride)+gather*.045,-impact*.12);rig.rotation.set(gather*(ice?-.055:.05)-drive*.07,Math.sin(phase-.4)*.02*stride,walk*.035);
  d.head.rotation.set(-rig.rotation.x*.65,look*.2,-rig.rotation.z*.55);d.hem.rotation.set(Math.sin(phase-.7)*.025*stride,0,-walk*.02);d.hem.position.y=Math.sin(t*1.7-.3)*.008;
  d.staff.position.set(.48,.76+gather*(ice?.25:.31)-drive*.10,.1);d.staff.rotation.set(-gather*(ice?.65:.45)+drive*.47,0,(ice?.09:0)+lag*.035*stride);d.focus.scale.setScalar(1+gather*.23);
  d.arms[0].rotation.set(-lag*.13*stride-gather*.25+drive*.16,0,-.04-gather*.08);d.feet.forEach((f,i)=>{const step=Math.sin(phase+i*Math.PI);f.position.set((i?1:-1)*.15,.09+Math.max(0,-step)*.035*stride,.05+step*.07*stride);f.rotation.x=step*.12*stride;});updateEnemyGrip(d);
 }else{
  const snow=id==='snowtotem';rig.position.set(0,.10+Math.sin(t*(snow?1.5:2.7))*(snow?.045:.06)+gather*.09-drive*.045,-impact*.09);rig.rotation.set(-impact*.10,0,Math.sin(t*1.6)*.025);
  d.satellites.position.y=0;d.satellites.rotation.y=t*(snow?.48:1.05);d.satellites.scale.setScalar(1+gather*(snow?.28:-.20)+drive*.25);
  d.cores.forEach((core,i)=>{core.position.y=.58+i*.33+gather*(i-1)*.07+Math.sin(t*1.7-i*.6)*.013;core.rotation.set(Math.sin(t*1.3-i)*.035,t*(i%2?-.22:.25)+(i-1)*gather*.18,0);core.scale.setScalar(1+(snow?0:Math.sin(t*3-i)*.035)-gather*.03);});
 }
}

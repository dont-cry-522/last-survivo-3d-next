import {creatureGait,gaitDistance,gaitStride} from './creature-gait.js?v=211';
import * as T from './vendor/three.module.js';
import {form,surface,tube,oval,tint,joint,smooth} from './creature-forms.js?v=211';
import {bossLeg,poseBossLeg} from './boss-appearance.js?v=211';
import {ADDITIONAL_BOSSES} from './boss-roster.js?v=211';

// Ten anatomical silhouettes, shared shaded geometry and the existing foot IK.
// No per-instance textures/materials, lights or independent animation timers.
const sides=[-1,1],fitted=new Map();
const skin=(color,rings,options={})=>surface(color,rings,{sides:24,...options});
const horn=(color,points,radii)=>tube(color,points,radii,{sides:9,steps:14});
const wing=(color,rings)=>skin(color,rings,{sides:16}).rotateZ(-Math.PI/2);
function mirror(g,side){if(side>0)return g;g.scale(-1,1,1);const ix=g.index;for(let i=0;i<ix.count;i+=3){const a=ix.getX(i);ix.setX(i,ix.getX(i+1));ix.setX(i+1,a);}return g;}
function part(d,parent,label,build,options){return form(parent,'Boss_'+d.kind+'_'+label,build,options);}
function eyes(d,parent,y,z,spread,color=0xd4c79c){
 part(d,parent,'Eyes',()=>sides.flatMap(s=>[oval(0x142326,s*spread,y,z,.13,.065,.037,14,8),oval(color,s*spread,y+.005,z+.032,.07,.024,.012,12,6),oval(0x141d1d,s*spread,y,z+.041,.018,.026,.006,8,5)]),{glow:true});
}
function feet(d,{height=1.3,width=.24,spread=.65,front=.9,back=-.85,color=0x72634a,foot=0x403f36,reach=0,sole='toes'}={}){
 for(const s of sides)for(const z of[front,back])d.legs.push(bossLeg(d.rig,'Boss_'+d.kind+'_Leg'+s+(z===front?'Front':'Rear'),{x:s*spread,y:height,z,side:s,reach,a:height*.57,b:height*.56,width,color,foot,phase:(s<0?0:Math.PI)+(z===front?0:Math.PI),style:sole}));
}
function tail(d,color,points,radii){d.tail=joint(d.rig);part(d,d.tail,'Tail',()=>[horn(color,points,radii)]);}
function buildStag(d){
 const r=d.rig;d.body=part(d,r,'DeerTorso',()=>[
  skin(0x675b43,[[-1.30,.12,.15,0,1.62],[-1.04,.47,.48,0,1.70],[-.55,.62,.55,0,1.77],[.15,.61,.60,0,1.79],[.72,.52,.70,0,1.94],[1.08,.28,.38,0,2.10]],{axis:'z',shade:(c,x,y)=>c.multiplyScalar(y<1.55?.72:1)}),
  ...Array.from({length:9},(_,i)=>horn(i%2?0x6e8051:0x8b8a5a,[[0,2.21,-1.05+i*.21],[.09,2.34,-.98+i*.21],[0,2.30,-.84+i*.21]],[.08,.075,.005]))
 ]);
 d.neck=joint(r,0,1.65,.66);
 part(d,d.neck,'DeerNeck',()=>[skin(0x776c4b,[[1.65,.39,.41,0,.66],[2.05,.34,.37,0,.90],[2.52,.25,.27,0,1.05],[2.91,.24,.23,0,1.18]],{sides:22}).translate(0,-1.65,-.66)]);
 d.head=joint(d.neck,0,1.17,.51);
 part(d,d.head,'DeerHead',()=>[skin(0x827352,[[-.28,.18,.24,0,.02],[-.09,.29,.29,0,.12],[.16,.25,.26,0,.07],[.32,.14,.16,0,-.06]],{sides:24}),horn(0x75684c,[[0,.03,.04],[0,-.04,.38],[0,-.16,.66]],[.25,.21,.12]),oval(0x2a3029,0,-.15,.65,.135,.08,.08),...sides.map(s=>skin(0x786b4c,[[0,.04,.04],[.18,.13,.05],[.45,.10,.025],[.64,.005,.004]],{sides:12}).rotateZ(-s*.8).translate(s*.20,.20,-.09))]);
 eyes(d,d.head,.09,.26,.23,0xd8bc75);
 for(const s of sides){const antler=joint(d.head,s*.16,.24,-.05);part(d,antler,'Antler'+s,()=>[
  horn(0x66543a,[[0,0,0],[s*.19,.38,-.11],[s*.46,.69,-.28],[s*.70,.96,-.50],[s*.79,1.26,-.62]],[.13,.11,.08,.05,.004]),
  ...[0,1,2].map(i=>horn(0xa49262,[[s*(.14+i*.20),.32+i*.23,-.09-i*.14],[s*(.33+i*.24),.58+i*.25,.06-i*.14],[s*(.39+i*.27),.91+i*.27,.10-i*.12]],[.065,.045,.003]))]);d.appendages.push(antler);}
 feet(d,{height:1.5,width:.18,spread:.40,front:.60,back:-.84,color:0x71634c,foot:0x30362c,sole:'hoof'});
 tail(d,0x564d3c,[[0,1.84,-1.10],[0,1.64,-1.42],[0,1.42,-1.36]],[.12,.10,.005]);
}
function buildSpider(d){
 const r=d.rig;d.body=part(d,r,'SpiderAbdomen',()=>[
  skin(0x493d50,[[-2.05,.08,.10,0,1.18],[-1.74,.62,.52,0,1.27],[-1.25,1.01,.73,0,1.37],[-.65,.98,.74,0,1.35],[-.18,.59,.44,0,1.19],[.20,.45,.29,0,1.03]],{axis:'z',sides:30,flute:.018}),
  ...sides.flatMap(s=>Array.from({length:5},(_,i)=>horn(0x938488,[[s*.30,1.98-i*.08,-1.42+i*.20],[s*.66,1.91-i*.075,-1.39+i*.20],[s*.91,1.61-i*.03,-1.34+i*.20]],[.036,.068,.012]))),
  skin(0x302b36,[[-.28,.39,.28,0,1.0],[.14,.61,.36,0,1.02],[.57,.52,.30,0,1.02],[.92,.26,.20,0,1.0]],{axis:'z'})]);
 d.head=joint(r,0,1.06,.69);
 part(d,d.head,'SpiderFace',()=>[oval(0x352e39,0,0,0,.40,.26,.30,24,12),...sides.map(s=>horn(0x9c9384,[[s*.22,-.07,.12],[s*.32,-.26,.35],[s*.19,-.47,.47],[s*.08,-.45,.38]],[.15,.13,.08,.005]))]);
 part(d,d.head,'SpiderEyes',()=>sides.flatMap(s=>[oval(0x181c25,s*.13,.075,.274,.095,.088,.043),oval(0xc9a0b1,s*.13,.08,.31,.035,.037,.014),...Array.from({length:2},(_,i)=>oval(0xb893a5,s*(.27+i*.035),.10+i*.10,.22-i*.05,.027,.026,.02,9,6))]),{glow:true});
 for(const s of sides)for(let i=0;i<4;i++){const l=bossLeg(r,'Boss_SpiderLeg'+s+i,{x:s*.53,y:1.16,z:.63-i*.48,side:s,reach:i===0||i===3?.88:1.42,a:1.15,b:1.10,width:.16,color:0x594a5c,foot:0x322f39,phase:(i%2)*Math.PI+(s>0?Math.PI:0),style:'shell'});l.rest.z+=(1.5-i)*.44;d.legs.push(l);}
}
function buildWolf(d){
 const r=d.rig;d.body=part(d,r,'WolfTorso',()=>[
  skin(0x869da5,[[-1.32,.12,.15,0,1.21],[-1.04,.46,.44,0,1.25],[-.50,.47,.40,0,1.35],[.10,.61,.59,0,1.44],[.61,.64,.69,0,1.56],[1.01,.40,.47,0,1.60]],{axis:'z',sides:28,shade:(c,x,y)=>c.lerp(new T.Color(y<1.25?0x4b6471:0xd6ded5),y<1.25?.35:.28)}),
  skin(0xa7bdc2,[[-.32,.43,.45,0,1.46],[-.12,.59,.58,0,1.48],[.14,.70,.72,0,1.50],[.38,.71,.75,0,1.56],[.60,.61,.68,0,1.61],[.78,.46,.51,0,1.64],[.96,.34,.39,0,1.65]],{axis:'z',sides:32,flute:.018,deform:(x,y,z,a)=>[x*(1+.024*Math.sin(a*11+z*9)),y+.018*Math.sin(a*13+z*11),z],shade:(c,x,y,z)=>c.lerp(new T.Color(0x526f81),.15+.20*(1-smooth((y-1.05)/1.25)))})
 ]);
 d.head=joint(r,0,1.66,1.0);
 part(d,d.head,'WolfHead',()=>[skin(0xc7d1cd,[[-.27,.25,.23,0,0],[.02,.37,.32,0,0],[.29,.30,.22,0,-.03],[.40,.14,.15,0,-.03]],{sides:26}),horn(0xaabcbf,[[0,.02,.17],[0,-.03,.52],[0,-.06,.79]],[.25,.21,.12]),oval(0x273842,0,-.03,.78,.14,.085,.07),...sides.flatMap(s=>[skin(0x8ca6af,[[0,.18,.10],[.19,.14,.08],[.52,.018,.014]],{sides:12}).rotateZ(-s*.2).translate(s*.23,.29,-.08),horn(0x5a7480,[[s*.06,.19,.29],[s*.24,.24,.30],[s*.36,.23,.13]],[.045,.085,.02]),horn(0xe7e4ce,[[s*.16,-.14,.48],[s*.16,-.29,.52],[s*.13,-.35,.49]],[.055,.035,.002])])]);
 d.jaw=joint(d.head,0,-.18,.15);part(d,d.jaw,'WolfJaw',()=>[horn(0x6c8998,[[0,0,0],[0,-.01,.35],[0,.03,.61]],[.17,.13,.055])]);eyes(d,d.head,.13,.29,.25,0xaac6ce);
 feet(d,{height:1.18,width:.22,spread:.43,front:.72,back:-.88,color:0x92aab1,foot:0x697f87});
 tail(d,0x8aa2ae,[[0,1.30,-1.05],[.12,1.08,-1.65],[.20,.67,-2.03],[.13,.51,-2.21]],[.23,.27,.19,.009]);
}
function buildPhoenix(d){
 const r=d.rig;d.body=part(d,r,'PhoenixBreast',()=>[skin(0x87b2c4,[[.65,.09,.12,0,-.55],[1.04,.26,.43,0,-.33],[1.45,.44,.61,0,-.05],[1.90,.38,.46,0,.14],[2.22,.20,.26,0,.28]],{sides:24,flute:.025}),...sides.flatMap(s=>Array.from({length:5},(_,i)=>horn(0xc3dedf,[[s*.17,1.93-i*.12,.45],[s*.28,1.82-i*.16,.53],[s*.10,1.53-i*.16,.46]],[.08,.12,.003])))]);
 d.head=joint(r,0,2.14,.34);part(d,d.head,'PhoenixHead',()=>[oval(0xb4d8dd,0,.14,.03,.26,.32,.28,22,12),horn(0x4d7b90,[[0,.16,.22],[0,.10,.48],[0,-.05,.63]],[.12,.09,.003]),...[-1,0,1].map(i=>horn(0x7eb7ce,[[i*.12,.29,-.04],[i*.23,.61,-.13],[i*.28,.87,-.34]],[.08,.08,.003]))]);eyes(d,d.head,.23,.20,.20,0xd5f0e9);
 for(const s of sides){const w=joint(r,s*.29,1.84,0);part(d,w,'CrystalWing'+s,()=>[
  mirror(wing(0x5f92a8,[[0,.12,.34],[.40,.16,.57,-.13],[.91,.13,.63,-.26],[1.49,.08,.40,-.21],[2.22,.005,.02,-.11]]),s),
  ...Array.from({length:9},(_,i)=>horn(i%2?0xb0d6de:0x86b9ce,[[s*(.28+i*.19),.15,-.13],[s*(.48+i*.22),-.16,-.48-i*.025],[s*(.47+i*.25),-.63+i*.035,-.91+i*.03]],[.065,.14,.003]))]);d.wings.push(w);}
 d.tail=joint(r,0,1.04,-.36);part(d,d.tail,'CrystalTail',()=>[-1,0,1].map(i=>horn(0x81b2cb,[[i*.12,0,0],[i*.32,-.38,-.73],[i*.43,-.72,-1.60],[i*.31,-.64,-2.04]],[.10,.18,.10,.004])));
 part(d,r,'PhoenixTalons',()=>sides.flatMap(s=>[horn(0x607e8a,[[s*.18,1.09,.14],[s*.17,.76,.30],[s*.23,.58,.14]],[.065,.05,.025]),...[-1,0,1].map(i=>horn(0x344f61,[[s*.23,.58,.14],[s*.23+i*.09,.51,.34],[s*.23+i*.11,.46,.38]],[.025,.02,.002]))]));
}
function buildRhino(d){
 const r=d.rig;d.body=part(d,r,'RhinoCarapace',()=>[
  skin(0x4e4140,[[-1.65,.15,.20,0,1.48],[-1.3,.72,.66,0,1.52],[-.68,.96,.78,0,1.61],[.05,1.02,.84,0,1.71],[.69,.90,.84,0,1.73],[1.19,.61,.58,0,1.55]],{axis:'z',sides:28,flute:.035}),
  ...Array.from({length:5},(_,i)=>horn(0x776258,[[-.72,1.77,-1.11+i*.40],[-.55,2.18,-1.12+i*.40],[0,2.42,-1.13+i*.40],[.55,2.18,-1.12+i*.40],[.72,1.77,-1.11+i*.40]],[.07,.12,.12,.12,.07]))]);
 d.head=joint(r,0,1.28,1.08);part(d,d.head,'RhinoHead',()=>[skin(0x69534b,[[-.30,.38,.27,0,.04],[-.08,.56,.48,0,.12],[.29,.51,.43,0,.04],[.56,.27,.24,0,-.05]],{sides:24,flute:.045}),horn(0x5d4b44,[[0,.02,.27],[0,-.06,.63],[0,-.10,.94]],[.43,.36,.24]),horn(0xb99c75,[[0,.12,.79],[0,.46,1.00],[0,.99,1.15],[0,1.28,1.23]],[.22,.18,.09,.004]),horn(0x897565,[[0,.38,.37],[0,.69,.43],[0,.88,.48]],[.16,.10,.003]),...sides.map(s=>oval(0x28292a,s*.20,-.08,.91,.08,.05,.045))]);eyes(d,d.head,.25,.37,.46,0xe09d5e);
 feet(d,{height:1.14,width:.34,spread:.68,front:.75,back:-1.05,color:0x66534a,foot:0x393538,sole:'rhino'});tail(d,0x59463f,[[0,1.47,-1.46],[.10,1.11,-1.79],[.13,.77,-1.75]],[.10,.075,.01]);
 part(d,r,'RhinoEmberFissures',()=>sides.flatMap(s=>[horn(0xb56732,[[s*.70,2.06,-.79],[s*.81,2.13,-.18],[s*.74,2.03,.55]],[.018,.027,.012])]),{glow:true});
}
function buildDrake(d){
 const r=d.rig;d.body=part(d,r,'DrakeTorso',()=>[skin(0x58443e,[[-.86,.12,.14,0,1.32],[-.48,.42,.45,0,1.45],[.07,.54,.65,0,1.54],[.57,.39,.51,0,1.64],[.89,.18,.26,0,1.84]],{axis:'z',sides:26}),horn(0x78594a,[[0,1.65,.57],[0,2.08,.83],[0,2.55,1.09]],[.33,.24,.17]),...Array.from({length:6},(_,i)=>horn(0xa0754b,[[0,2.07-i*.07,.40-i*.23],[0,2.39-i*.10,.30-i*.23],[0,2.40-i*.13,.08-i*.23]],[.07,.09,.003]))]);
 d.head=joint(r,0,2.46,1.08);part(d,d.head,'DrakeHead',()=>[oval(0x6f5144,0,.08,.08,.26,.26,.36,24,12),horn(0x755b49,[[0,.06,.24],[0,.02,.58],[0,-.12,.75]],[.22,.15,.008]),...sides.map(s=>horn(0xa58a67,[[s*.18,.22,-.05],[s*.30,.48,-.25],[s*.35,.50,-.55]],[.10,.065,.003]))]);d.jaw=joint(d.head,0,-.13,.08);part(d,d.jaw,'DrakeJaw',()=>[horn(0x362f30,[[0,0,0],[0,-.02,.39],[0,.02,.55]],[.18,.09,.004]),...sides.flatMap(s=>[0,1,2].map(i=>horn(0xbca68a,[[s*(.12-i*.025),.005,.22+i*.10],[s*(.12-i*.025),.075,.22+i*.1]],[.024,.001])))]);eyes(d,d.head,.12,.31,.21,0xe7b17c);
 for(const s of sides){const w=joint(r,s*.39,1.98,.16);part(d,w,'DrakeWing'+s,()=>[
  mirror(wing(0x614343,[[0,.08,.27],[.40,.10,.39,-.21],[.9,.08,.61,-.44],[1.48,.06,.82,-.29],[1.99,.04,.55,.04],[2.27,.004,.02,.23]]),s),
  horn(0x8a6953,[[0,0,.19],[s*.62,.31,.48],[s*1.40,.31,.70],[s*2.26,-.23,0]],[.13,.11,.07,.005]),
  ...[.65,1.12,1.62].map(x=>horn(0x9e7055,[[s*.47,.30,.35],[s*x,.22,-.23],[s*(x+.24),-.17,-.78]],[.05,.035,.004]))]);d.wings.push(w);}
 for(const s of sides)d.legs.push(bossLeg(r,'Boss_DrakeHind'+s,{x:s*.38,y:1.40,z:-.15,side:s,a:.81,b:.80,width:.24,color:0x6b5044,foot:0xb09872,phase:s>0?Math.PI:0,style:'toes'}));
 tail(d,0x58423c,[[0,1.46,-.70],[.15,1.18,-1.41],[.32,.77,-2.12],[.28,.68,-2.65]],[.31,.24,.13,.004]);
}
function buildWorm(d){
 const r=d.rig,curve=new T.CatmullRomCurve3([[0,.36,-2.05],[0,.49,-1.49],[0,.70,-.74],[0,1.24,-.14],[0,1.91,.15],[0,2.57,.32]].map(p=>new T.Vector3(...p))),radii=[.20,.49,.65,.74,.79,.74];d.body=part(d,r,'WormLongBody',()=>[
  horn(0x8e7853,[[0,.36,-2.05],[0,.49,-1.49],[0,.70,-.74],[0,1.24,-.14],[0,1.91,.15],[0,2.57,.32]],[.20,.49,.65,.74,.79,.74]),
  ...Array.from({length:10},(_,i)=>{const u=.12+i*.084,index=u*5,r=T.MathUtils.lerp(radii[Math.floor(index)],radii[Math.ceil(index)],index%1),center=curve.getPointAt(u),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),curve.getTangentAt(u));return tint(new T.TorusGeometry(r+.006,.047,6,28).applyQuaternion(q).translate(center.x,center.y,center.z),i%2?0xbaa276:0x645c43);})]);
 d.head=joint(r,0,2.59,.34);
 part(d,d.head,'WormRadialMaw',()=>[skin(0x514738,[[-.21,.69,.65],[0,.83,.77],[.16,.82,.77],[.29,.67,.63]],{sides:30,caps:false}),oval(0x222b2b,0,.10,0,.64,.035,.60,28,10),skin(0x252b2a,[[-.16,.42,.40],[.02,.64,.60],[.24,.61,.57]],{sides:28,caps:false,inside:true}),...Array.from({length:14},(_,i)=>{const a=i*Math.PI/7;return horn(0xd1bc8e,[[Math.cos(a)*.68,.15,Math.sin(a)*.64],[Math.cos(a)*.49,.31,Math.sin(a)*.46],[Math.cos(a)*.32,.22,Math.sin(a)*.30]],[.09,.065,.003]);})]);
 d.head.rotation.x=.85;
}
function buildObelisk(d){
 const r=d.rig;d.body=part(d,r,'BrokenObelisk',()=>[skin(0x7d705b,[[.65,.24,.19],[1.14,.44,.31],[2.06,.47,.33],[2.84,.37,.28],[3.48,.33,.23],[3.90,.07,.08]],{sides:4,deform:(x,y,z)=>[x+.05*Math.sin(y*2),y,z]}),...sides.map(s=>horn(0xb29f79,[[s*.24,1.29,.30],[s*.34,2.07,.33],[s*.24,2.83,.27],[s*.19,3.34,.23]],[.035,.04,.03,.005]))]);
 part(d,r,'ObeliskRunes',()=>[oval(0x313332,0,2.46,.35,.23,.39,.04,16,8),oval(0xd7bd79,0,2.47,.39,.055,.25,.014),...Array.from({length:4},(_,i)=>horn(0xc4a968,[[-.12,1.35+i*.17,.34],[.08,1.40+i*.17,.35],[.12,1.33+i*.17,.34]],[.018,.02,.008]))],{glow:true});
 for(const s of sides)for(let i=0;i<2;i++){const plate=joint(r,s*(.78+i*.39),2.13-i*.35,-i*.11);part(d,plate,'FloatingTablet'+s+i,()=>[skin(i?0x625d50:0x9f8c67,[[-.68,.15,.09],[-.42,.23,.12],[.54,.21,.13],[.91,.10,.07]],{sides:4}),horn(0x3a3b34,[[0,-.35,.12],[.04,.19,.145],[0,.62,.12]],[.018,.026,.012])]);plate.userData.side=s;plate.userData.row=i;d.appendages.push(plate);}
}
function buildRay(d){
 const r=d.rig;d.body=part(d,r,'RayBody',()=>[skin(0x3d686f,[[-1.39,.09,.06,0,1.24],[-.88,.30,.12,0,1.24],[-.21,.52,.23,0,1.29],[.43,.64,.27,0,1.32],[.92,.41,.18,0,1.26],[1.20,.13,.07,0,1.19]],{axis:'z',sides:28,shade:(c,x,y)=>c.lerp(new T.Color(y<1.28?0xb1c1ac:0x244451),y<1.28?.7:.25)}),...sides.flatMap(s=>Array.from({length:5},(_,i)=>horn(0xacc0b1,[[s*.15,1.10,.52-i*.18],[s*.36,1.10,.45-i*.18],[s*.44,1.14,.34-i*.18]],[.02,.035,.012])))]);
 eyes(d,r,1.48,.64,.35,0xb6d7c3);
 for(const s of sides){const w=joint(r,s*.39,1.29,.05);part(d,w,'RaySail'+s,()=>[mirror(wing(0x47717a,[[0,.14,.85],[.57,.17,.97],[1.24,.13,.76],[1.88,.07,.42],[2.39,.003,.015]]),s),...Array.from({length:5},(_,i)=>horn(0x73928e,[[s*.16,.12,.60-i*.33],[s*.9,.145,.45-i*.23],[s*1.71,.08,.20-i*.1]],[.016,.024,.003]))]);d.wings.push(w);}
 tail(d,0x42616a,[[0,1.26,-1.10],[.14,1.16,-1.95],[.36,1.33,-2.78],[.44,1.61,-3.36]],[.12,.09,.04,.002]);
 part(d,r,'RayCephalicFins',()=>sides.map(s=>horn(0x436872,[[s*.26,1.19,.85],[s*.31,1.10,1.29],[s*.51,1.25,1.47],[s*.57,1.32,1.28]],[.14,.12,.09,.005])));
}
function buildMedusa(d){
 const r=d.rig;
 d.body=part(d,r,'MedusaBell',()=>[skin(0x557e8a,[[2.62,1.28,1.12],[2.76,1.48,1.30],[2.99,1.46,1.27],[3.38,1.17,1.04],[3.73,.68,.61],[3.89,.10,.10]],{sides:36,flute:.03,caps:false,shade:(c,x,y)=>c.multiplyScalar(.7+.3*smooth((y-2.6)/1.3))})],{translucent:true});
 part(d,r,'MedusaInnerBell',()=>[skin(0x294c61,[[2.83,.65,.59],[3.01,1.16,1.03],[3.36,.91,.81],[3.59,.35,.31]],{sides:28,caps:false}),...Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return horn(0x83aeb4,[[Math.cos(a)*.14,3.78,Math.sin(a)*.14],[Math.cos(a)*.84,3.51,Math.sin(a)*.73],[Math.cos(a)*1.35,3.0,Math.sin(a)*1.18],[Math.cos(a)*1.28,2.68,Math.sin(a)*1.12]],[.024,.029,.026,.012]);})]);
 d.core=part(d,r,'MedusaLantern',()=>[oval(0x9bd3ce,0,3.13,0,.35,.39,.35,24,14),skin(0x6b9ea7,[[2.00,.10,.11],[2.40,.27,.25],[2.91,.36,.34]],{sides:20,flute:.12})],{glow:true});
 for(let i=0;i<10;i++){const a=i*Math.PI/5,s=joint(r,Math.cos(a)*.94,2.80,Math.sin(a)*.81),length=1.74+(i%3)*.28;
  part(d,s,'MedusaTentacle'+i,()=>[tube(i%2?0x638f9e:0x487282,[[0,0,0],[Math.cos(a)*.10,-length*.28,Math.sin(a)*.10],[Math.cos(a)*.23,-length*.65,Math.sin(a)*.23],[Math.cos(a)*.08,-length,Math.sin(a)*.12]],[.10,.11,.065,.006],{sides:10,steps:18,flexible:(x,y,z)=>[Math.max(0,-y)*.07,i*.64,Math.cos(a),Math.sin(a),.02]})]);s.userData.angle=a;d.appendages.push(s);}
}
const builders={thornstag:buildStag,webmatriarch:buildSpider,rimefang:buildWolf,icephoenix:buildPhoenix,moltenrhino:buildRhino,cinderdrake:buildDrake,dunedevourer:buildWorm,obeliskwarden:buildObelisk,sailreaper:buildRay,abyssmedusa:buildMedusa};
export function makeBossVariant(kind){
 const config=ADDITIONAL_BOSSES[kind];if(!config)return null;
 const g=new T.Group(),d=g.userData={kind,bossModel:true,bossVariant:true,organicModel:true,combatHeight:config.height,rig:joint(g),legs:[],wings:[],appendages:[],phase:0};g.name='SM_Boss_'+kind;
 builders[kind](d);animateBossVariant(g,0,0,0);
 if(!fitted.has(kind))fitted.set(kind,config.height/new T.Box3().setFromObject(g).max.y);
 g.scale.setScalar(fitted.get(kind));return g;
}
export function animateBossVariant(g,t,speed,dt){
 const d=g.userData,r=d.rig,kind=d.kind,cfg=ADDITIONAL_BOSSES[kind],stage=d.bossStage||'walk',second=d.bossMove===cfg.moves[1],s=stage==='strike'?Math.min(1,d.strikeProgress||0):0;
 const wind=stage==='wind'?smooth(d.windProgress||0):stage==='strike'?1-smooth(s/.32):0;
 const strike=stage==='strike'?smooth(s/.32)*(1-.7*smooth((s-.55)/.45)):stage==='recover'?.30*(1-smooth(d.recoverProgress||0)):0;
 const groundCharge=stage==='strike'&&['antlerrush','horncharge'].includes(d.bossMove),groundMove=stage==='walk'||groundCharge;
 const desired=groundMove?(d.legs.length>0&&!d.wings.length?gaitStride(speed,cfg.speed):Math.min(1,Math.max(0,speed)/cfg.speed)):0;d.walkStride=(d.walkStride||0)+(desired-(d.walkStride||0))*(1-Math.exp(-Math.max(0,dt)*10));const stride=d.walkStride;
 const gait=creatureGait(kind,speed);d.motionGait=gait;
 if(dt>0&&desired>0)d.phase+=gait?gaitDistance(speed*dt/g.scale.x,gait,desired):speed*dt*2.7;const p=d.phase;
 r.position.set(0,d.lift||0,0);r.rotation.set(0,0,0);r.scale.set(1,1,1);
 const breath=Math.sin(t*1.3)*.007;d.body.scale.set(1+breath,1+breath*.7,1+breath*.35);
 if(d.head)d.head.rotation.set(0,0,0);if(d.jaw)d.jaw.rotation.x=.06+wind*.18+strike*.22;
 if(d.tail)d.tail.rotation.set(0,Math.sin(t*.8+p*.7)*(.035+.09*stride),0);
 if(kind==='thornstag'){
  r.position.y+=Math.sin(p*2)*.035*stride-wind*.12;r.rotation.z=Math.sin(p)*.025*stride;
  d.neck.rotation.x=(second?-.06:.48)*wind+(second?.10:.55)*strike+Math.sin(p*2-.45)*.018*stride;
  d.head.rotation.x=(second?-.12:.18)*wind+(second?.28:.15)*strike;d.head.rotation.y=Math.sin(t*.35)*.035*(1-wind);
  for(let i=0;i<d.appendages.length;i++)d.appendages[i].rotation.z=(i?1:-1)*(Math.sin(t)*.008+wind*.025);
 }else if(kind==='rimefang'){
  r.position.y+=Math.sin(p*2)*.045*stride-wind*.18;r.rotation.x=wind*(second?-.08:.12)+strike*.10;
  d.head.position.set(0,1.66-wind*.055,1.0-wind*.08+strike*(second?.025:.13));d.head.rotation.x=wind*(second?-.48:.22)+strike*(second?-.20:.16);d.jaw.rotation.x=.07+(second?.50:.28)*(wind+strike*.5);
 }else if(kind==='webmatriarch'){
  r.position.y+=Math.sin(p*2)*.035*stride+wind*.10;r.rotation.x=-wind*(second?.16:.09)+strike*.12;d.head.rotation.x=-wind*.12+strike*.18;d.body.scale.y=1+Math.sin(t*1.5)*.009-wind*.025+strike*.018;
 }else if(kind==='moltenrhino'){
  r.position.y+=Math.abs(Math.sin(p))*.06*stride-wind*.08;r.rotation.z=Math.sin(p)*.035*stride;r.rotation.x=wind*.06+strike*(second?.14:0);d.head.rotation.x=wind*(second?-.20:.27)+strike*(second?.38:.06);
 }else if(kind==='icephoenix'||kind==='cinderdrake'||kind==='sailreaper'){
  const bird=kind==='icephoenix',ray=kind==='sailreaper';
  // Accumulate a speed-aware wing clock: changing speed cannot jump the wings
  // to an unrelated time*frequency pose. Breast/wing motion trails the power beat.
  d.flightPhase=(d.flightPhase||0)+dt*((bird?2.4:ray?1.5:1.9)+Math.min(1.5,speed/cfg.speed)*(ray?.35:.8));
  const flap=d.flightPhase,free=Math.max(0,1-.65*wind-.8*strike);
  r.position.y+=Math.sin(flap-.65)*(ray?.07:.09)*free;r.rotation.x=wind*(second?.12:-.12)+strike*(second?.22:.09);r.rotation.z=Math.sin(t*.9)*.018;
  for(let i=0;i<d.wings.length;i++){const side=i?1:-1;d.wings[i].rotation.set(wind*(second?.20:-.10)-strike*.15,side*((ray?0:.14)+wind*(second?.46:-.14)-strike*.20),side*((ray?0:bird?-.16:-.35)+Math.sin(flap+.2)*(ray?.13:.20)*free+wind*(second?.75:-.23)-strike*(second?.20:.55)));}
  if(d.head)d.head.rotation.x=wind*(second?.10:-.26)+strike*(second?.2:.32);if(d.jaw)d.jaw.rotation.x=wind*(second?.12:.52)+strike*.37;
 }else if(kind==='dunedevourer'){
  r.rotation.x=Math.sin(t*.8)*.045+wind*(second?.13:-.17)+strike*(second?-.09:.18);r.rotation.z=Math.sin(t*1.2)*.04;d.head.rotation.x=.85+wind*(second?-.30:.35)-strike*.25;d.body.scale.z=1+Math.sin(p-.6)*.025*stride;d.head.position.z=.34-wind*.10+strike*.16;
 }else if(kind==='obeliskwarden'){
  r.position.y+=Math.sin(t)*.07;r.rotation.x=-wind*.035+strike*.045;r.rotation.y=Math.sin(t*.4)*.035;
  d.appendages.forEach(a=>{const side=a.userData.side,row=a.userData.row;a.position.x=side*(.78+row*.39+wind*(second?.40:.15)-strike*.16);a.position.y=2.13-row*.35+Math.sin(t-row*.45+side)*.08+wind*.26-strike*.18;a.rotation.set(wind*(second?0:-.35)+strike*.18,side*(wind*.4-strike*.25),side*(.12+wind*(second?.55:.18)-strike*.20));});
 }else if(kind==='abyssmedusa'){
  const pulse=Math.sin(t*1.5);r.position.y+=pulse*.08;d.body.scale.set(1+pulse*.035-wind*.10+strike*.09,1-pulse*.025+wind*.05,1+pulse*.035-wind*.10+strike*.09);
  d.appendages.forEach((a,i)=>{const angle=a.userData.angle,open=.04*Math.sin(t*1.2-i*.4)+wind*(second?.18:.42)-strike*.16;a.rotation.set(Math.sin(angle)*open,0,-Math.cos(angle)*open);});d.core.scale.setScalar(1+wind*.07+strike*.04);
 }
 // Foot targets follow the visual rig during flight, then plant on the ground.
 const lift=d.lift||0,tuck=kind==='rimefang'?Math.max(0,Math.min(1,lift/1.6)):0;
 for(const l of d.legs){
  const fore=kind==='webmatriarch'&&l.hip.z>.5?wind*.22:0;
  // The wolf tucks its rear paws and reaches with its forelegs; a casting
  // spider braces on six legs while lifting its front pair.
  poseBossLeg(l,r,p,stride,gait.travel,gait.lift,lift+tuck*.12+fore,gait.support,tuck*(l.hip.z>0?.18:-.18));
 }
}

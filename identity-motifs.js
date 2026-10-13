import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// One small maker's mark per identity, echoed on functional weapon surfaces.
// These are relief fittings, not spell effects: no light, billboard or aura.
export const HERO_SIGNATURES=Object.freeze({
 scout:{primary:0x4c654c,accent:0xa79361,metal:0x726044,motif:'woodland-leaf',label:'林叶',description:'林绿叶裁领、棕皮护具与旧铜林叶扣，木质枪托呼应林地游侠。'},
 silver:{primary:0x304455,accent:0xc2d7df,metal:0x718c9a,motif:'frost-feather',label:'霜羽',description:'白短发与黑面具，深靛衣装用冰蓝灰翻领和渐淡霜边呼应霜影。'},
 wraith:{primary:0x24252a,accent:0xe7e4db,metal:0x999f9f,motif:'soul-rift',label:'魂痕',description:'墨黑兜帽、单侧骨白衣片与无面魂痕，黑刃白锋和黑封白页呼应影裔。'},
 tide:{primary:0x284b60,accent:0xbb9e67,metal:0x668e96,motif:'tidal-crest',label:'潮纹',description:'深海蓝猎装、青灰卷袖与浅浪衣摆，长叉与唯一浪扣呼应潮行者。'},
 lingya:{primary:0x6d8474,accent:0xc4a364,metal:0x60795d,motif:'sprout-bell',label:'芽铃',description:'栗棕短发、苔青短衣与一枚芽铃，木质弹弓和小挎包呼应林间御兽少女。'},
 wuling:{primary:0x352339,accent:0x9d7f4d,metal:0x806340,motif:'spore-gill',label:'菌褶',description:'哑光深葡紫采药袍与旧铜菌褶扣，菌盖孢灯呼应雾中采苓人。'},
 mirage:{primary:0x1e2331,accent:0xc0c8d5,metal:0x8e9eae,motif:'mirror-petal',label:'镜瓣',description:'柔顺长发、冷墨紫衣与镜瓣缝边，冷银蜃花灯呼应蜃影的替身幻象。'}
});

const marks=new Map();
function shape(draw){const s=new T.Shape();draw(s);return new T.ExtrudeGeometry(s,{depth:.025,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:1,curveSegments:12,steps:1});}
function stroke(points,radius=.026){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x,y,z=.045])=>new T.Vector3(x,y,z))),Math.max(8,points.length*4),radius,5,false);}
function relief(kind){
 const pieces=[[],[]],add=(g,tone=0)=>pieces[tone].push(g),line=(p,r=.026,tone=1)=>add(stroke(p,r),tone);
 if(kind==='scout'){
  add(shape(s=>{s.moveTo(0,-.8);s.bezierCurveTo(-.13,-.49,-.56,-.37,-.47,-.13);s.bezierCurveTo(-.78,.08,-.35,.22,-.40,.42);s.bezierCurveTo(-.23,.40,-.17,.66,0,.85);s.bezierCurveTo(.17,.66,.23,.40,.40,.42);s.bezierCurveTo(.35,.22,.78,.08,.47,-.13);s.bezierCurveTo(.56,-.37,.13,-.49,0,-.8);}));
  line([[0,-.88],[0,-.3],[0,.24],[0,.68]],.028);for(const sign of[-1,1]){line([[0,-.3],[sign*.22,-.2],[sign*.38,-.06]],.018);line([[0,.12],[sign*.16,.20],[sign*.30,.32]],.018);}
 }else if(kind==='silver'){
  add(shape(s=>{s.moveTo(-.39,-.77);s.bezierCurveTo(-.44,-.12,-.06,.60,.49,.86);s.bezierCurveTo(.46,.11,.28,-.57,-.39,-.77);}));
  line([[-.42,-.85],[-.20,-.30],[.10,.24],[.43,.73]],.026);for(let i=0;i<4;i++){const y=-.40+i*.23,x=-.20+i*.12;line([[x,y],[x+.20,y+.025],[x+.32,y+.12]],.018);}
 }else if(kind==='wraith'){
  line([[.13,.86],[-.09,.58],[-.09,.35],[.045,.16]],.042,0);
  line([[.018,.04],[-.04,-.21],[.065,-.39],[-.14,-.82]],.031,0);
 }else if(kind==='tide'){
  add(shape(s=>{s.moveTo(-.83,-.35);s.bezierCurveTo(-.38,-.51,-.39,.61,.20,.68);s.bezierCurveTo(.82,.78,.86,.21,.44,.12);s.bezierCurveTo(.51,.35,.32,.40,.19,.27);s.bezierCurveTo(-.10,-.04,.08,-.40,.83,-.31);s.bezierCurveTo(.35,-.69,-.43,-.66,-.83,-.35);}));
  line([[-.72,-.62],[-.22,-.76],[.33,-.70],[.72,-.55]],.026);
 }else if(kind==='lingya'){
  add(shape(s=>{s.moveTo(-.46,-.41);s.bezierCurveTo(-.22,-.13,-.42,.40,0,.41);s.bezierCurveTo(.42,.40,.22,-.13,.46,-.41);s.quadraticCurveTo(0,-.56,-.46,-.41);}));
  line([[-.38,-.40],[0,-.47],[.38,-.40]],.022);const bead=new T.SphereGeometry(.105,10,6);bead.translate(0,-.62,.06);add(bead);
  for(const side of[-1,1])add(shape(s=>{s.moveTo(0,.40);s.bezierCurveTo(side*.05,.76,side*.46,.80,side*.46,.78);s.bezierCurveTo(side*.39,.46,side*.16,.42,0,.40);}),1);
 }else if(kind==='wuling'){
  add(shape(s=>{s.moveTo(-.79,.13);s.bezierCurveTo(-.69,.90,.59,1.00,.78,.13);s.bezierCurveTo(.34,-.04,-.34,-.04,-.79,.13);}));
  add(shape(s=>{s.moveTo(-.085,.02);s.bezierCurveTo(-.045,-.20,-.19,-.42,-.18,-.62);s.quadraticCurveTo(.01,-.78,.22,-.58);s.bezierCurveTo(.06,-.40,.15,-.19,.09,.02);s.closePath();}),1);
  for(const x of[-.5,-.25,0,.25,.5])line([[x,.22],[x*.70,.09],[x*.20,-.015]],.018,1);
 }else{
  // One paired mirror-petal: negative space reads as a split, not a glowing eye.
  for(const side of[-1,1])add(shape(s=>{s.moveTo(side*.045,-.83);s.bezierCurveTo(side*.33,-.54,side*.59,-.13,side*.46,.18);s.bezierCurveTo(side*.36,.44,side*.11,.59,side*.045,.87);s.bezierCurveTo(side*.02,.28,side*.23,-.16,side*.045,-.83);}),side<0?0:1);
 }
 const root=new T.Group();root.name='SM_Identity_'+kind+'_A';root.userData.identityMotif=HERO_SIGNATURES[kind].motif;
 pieces.forEach((list,tone)=>{
  if(!list.length)return;const flat=list.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(flat,false);for(const g of new Set([...flat,...list]))g.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new T.MeshStandardMaterial({name:'M_Identity_'+kind+'_'+tone,color:HERO_SIGNATURES[kind][tone?'metal':'accent'],metalness:kind==='lingya'&&tone ? .1 : .58,roughness:.48,side:T.DoubleSide});
  const mesh=new T.Mesh(geometry,material);mesh.name='SM_Identity_'+kind+'_'+(tone?'Incision':'Relief');mesh.castShadow=mesh.receiveShadow=true;mesh.userData.identityDetail=true;mesh.userData.rebuiltPart='Identity';root.add(mesh);
 });return root;
}
export function makeIdentityMark(kind,size=.1){
 if(!Object.hasOwn(HERO_SIGNATURES,kind))throw new Error('Unknown hero identity: '+kind);
 if(!marks.has(kind))marks.set(kind,relief(kind));const mark=marks.get(kind).clone();mark.scale.setScalar(size);return mark;
}

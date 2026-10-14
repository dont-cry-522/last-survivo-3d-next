import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import{restoreEnemyHit,animateEnemyHit}from'./enemy-feedback.js?v=191';
import {segmentHitsBody} from './adventure-combat.js?v=191';

export const AIR_ROSTERS={forest:'duskbat',snow:'frostwing',ash:'cinderwing',sand:'sunscarab',coast:'skyray'};
export const AIR_ENEMIES={
 duskbat:{name:'暮翼蝠',color:0x8278a3,accent:0xd0bde2,voice:'wolf',hp:46,speed:3.4,damage:12,xp:5,altitude:2.7,pass:1.4,windTime:.85,strikeTime:1.0,span:1,shape:'bat',tip:'收拢双翼后高位俯冲，蹲下或横移；回升前可以近战反击。'},
 frostwing:{name:'霜羽蛾',color:0xaacbd2,accent:0xe4f4f4,voice:'snowtotem',hp:54,speed:2.8,damage:14,xp:6,altitude:3.1,pass:1.4,windTime:1.1,strikeTime:1.15,span:1.15,shape:'moth',tip:'展开冰蓝双翼蓄力，然后直线高位滑翔；蹲下避开。'},
 cinderwing:{name:'烬翼蝠',color:0x765554,accent:0xf5a467,voice:'emberling',hp:42,speed:4.2,damage:13,xp:5,altitude:3.4,pass:1.4,windTime:.8,strikeTime:.8,span:.9,shape:'bat',tip:'橙色翼尖亮起后快速掠过；锁定落点后横移或蹲下。'},
 sunscarab:{name:'沙金翼甲',color:0x9c7946,accent:0xdbbe74,voice:'sandguard',hp:65,speed:2.9,damage:15,xp:7,altitude:2.5,pass:.15,windTime:1.05,strikeTime:1.1,span:.85,shape:'beetle',tip:'打开甲壳后低空冲撞；可以跳过，也可侧移后趁低飞追击。'},
 skyray:{name:'潮风鳐',color:0x5a929e,accent:0xbddada,voice:'jellyseer',hp:58,speed:3.2,damage:14,xp:6,altitude:2.8,pass:.15,windTime:1.0,strikeTime:1.2,span:1.35,shape:'ray',tip:'翻起宽翼蓄力，然后贴地滑翔；跳跃避开腹部冲撞。'}
};
for(const cfg of Object.values(AIR_ENEMIES))Object.assign(cfg,{role:'flyer',size:.6});
export function airWaveEligible(time,enemies,random=Math.random){return time>=24&&enemies.filter(e=>e.alive&&e.role==='flyer').length<3&&random()<.22;}

// Shares the normal enemy lifecycle and reward path. No independent timers or projectiles.
export function tickAirborne(e,focus,dt,time,io){
 const cfg=AIR_ENEMIES[e.kind];if(!cfg||!e.alive||dt<=0)return;
 const floor=(x,z)=>io.groundHeight?.(x,z)||0;
 e.flight??={stage:'orbit',timer:1.6};const f=e.flight;f.timer-=dt;
 const ox=e.x,oy=e.y??cfg.altitude,oz=e.z;
 if(e.stagger>0){f.stage='recover';f.timer=Math.max(f.timer,.65);}
 if(f.stage==='orbit'){
  const dx=focus.x-e.x,dz=focus.z-e.z,d=Math.hypot(dx,dz)||1,orbit=d<8?1:0;
  const speed=e.speed*(e.slow>0?.45:1),side=e.id%2?1:-1;
  io.move(e,(dx/d*(d>6?1:0)+dz/d*orbit*side*.6)*speed*dt,(dz/d*(d>6?1:0)-dx/d*orbit*side*.6)*speed*dt);
  e.y=oy+(floor(e.x,e.z)+cfg.altitude+Math.sin(time*1.7+e.id)*.16-oy)*Math.min(1,dt*3);
  if(f.timer<=0&&d<11&&!e.targetLost&&io.visible(e)){f.stage='wind';f.timer=cfg.windTime;f.from={x:e.x,z:e.z,y:e.y};const len=Math.hypot(dx,dz)||1;f.to={x:focus.x+dx/len*2,z:focus.z+dz/len*2,y:cfg.pass>1?(io.player().standHeight||1.8)*.85-.3:cfg.pass};f.to.y+=floor(f.to.x,f.to.z);f.hit=false;io.sound(e,'wind');}
 }else if(f.stage==='wind'){
  e.y=Math.max(floor(e.x,e.z),oy+(f.to.y-oy)*Math.min(1,dt*6));
  if(f.timer<=0){f.stage='strike';f.timer=cfg.strikeTime;f.from={x:e.x,y:e.y,z:e.z};io.sound(e,'attack');}
 }else if(f.stage==='strike'){
  const t=Math.min(1,1-f.timer/cfg.strikeTime),ease=t*t*(3-2*t);
  const nx=f.from.x+(f.to.x-f.from.x)*ease,nz=f.from.z+(f.to.z-f.from.z)*ease;
  io.move(e,nx-e.x,nz-e.z);e.y=Math.max(floor(e.x,e.z),f.from.y+(f.to.y-f.from.y)*ease);
  const decoy=io.decoy?.();if(!f.hit&&decoy?.alive&&segmentHitsBody(ox,oy+.3,oz,e.x,e.y+.3,e.z,{...decoy,y:floor(decoy.x,decoy.z),height:1.8,radius:.4},.22)){f.hit=true;io.hitDecoy(e);}
  if(!f.hit&&segmentHitsBody(ox,oy+.3,oz,e.x,e.y+.3,e.z,io.player(),.22)){f.hit=true;io.hit(e);}
  if(f.timer<=0){f.stage='recover';f.timer=1.15;}
 }else{
  // Brief low recovery lets short weapons and ground poison punish a missed pass.
  e.y=oy+(floor(e.x,e.z)+.25-oy)*Math.min(1,dt*6);
  if(f.timer<=0){f.stage='orbit';f.timer=2.6+(e.id%3)*.4;}
 }
 const a=f.stage==='wind'?Math.atan2(f.to.x-e.x,f.to.z-e.z):Math.hypot(e.x-ox,e.z-oz)>.001?Math.atan2(e.x-ox,e.z-oz):e.mesh.rotation.y;
 e.mesh.rotation.y+=Math.atan2(Math.sin(a-e.mesh.rotation.y),Math.cos(a-e.mesh.rotation.y))*Math.min(1,dt*8);
 e.mesh.position.set(e.x,e.y,e.z);restoreEnemyHit(e.mesh);animateAirborne(e,time);animateEnemyHit(e.mesh,dt);
}

// Cached anatomical surfaces. Each actor owns only its joint transforms and
// morph weights; no material, mesh data or GPU texture is allocated per frame.
const templates=new Map(),materials=new Map(),hinge=.52,columns=12;
const mix=(a,b,t)=>a+(b-a)*t;
function painted(g,color){
 const p=g.attributes.position,c=[],out=new T.Color();
 for(let i=0;i<p.count;i++){typeof color==='function'?color(out,p.getX(i),p.getY(i),p.getZ(i)):out.set(color);c.push(out.r,out.g,out.b);}
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.deleteAttribute('uv');return g;
}
function batch(parts){
 const flat=parts.map(p=>p.index?p.toNonIndexed():p),g=mergeGeometries(flat,false);
 for(const p of new Set([...parts,...flat]))p.dispose();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function oval(c,x,y,z,sx,sy,sz){return painted(new T.SphereGeometry(1,8,6).scale(sx,sy,sz).translate(x,y,z),c);}
function tube(c,points,radii,steps=10,sides=5){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,steps,1,sides,false),p=g.attributes.position,n=g.attributes.normal;
 for(let i=0;i<=steps;i++){const t=i/steps,q=curve.getPointAt(t),ri=t*(radii.length-1),r=mix(radii[Math.floor(ri)],radii[Math.ceil(ri)],ri%1);for(let j=0;j<=sides;j++){const k=i*(sides+1)+j;p.setXYZ(k,q.x+n.getX(k)*r,q.y+n.getY(k)*r,q.z+n.getZ(k)*r);}}
 g.computeVertexNormals();return painted(g,c);
}
function bodySurface(profile,palette,{fur=0,segments=30}={}){
 const curve=new T.CatmullRomCurve3(profile.map(p=>new T.Vector3(p[0],p[1],p[2]))),v=[],idx=[],sides=16;
 for(let j=0;j<=segments;j++){
  const u=j/segments,q=curve.getPoint(u),k=Math.min(profile.length-2,Math.floor(u*(profile.length-1))),center=mix(profile[k][3],profile[k+1][3],u*(profile.length-1)-k);
  for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,rough=1+fur*Math.sin(i*2.4+j*1.9)*Math.sin(Math.PI*u);v.push(Math.cos(a)*Math.max(.002,q.y)*rough,center+Math.sin(a)*Math.max(.002,q.z)*rough,q.x);if(j){const n=j*sides+i,next=j*sides+(i+1)%sides;idx.push(n-sides,next-sides,n,n,next-sides,next);}}
 }
 for(const end of[0,1]){const row=end*segments,base=v.length/3,point=profile[end?profile.length-1:0];v.push(0,point[3],point[0]);for(let i=0;i<sides;i++){const a=row*sides+i,b=row*sides+(i+1)%sides;idx.push(...(end?[base,a,b]:[base,b,a]));}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();
 return painted(g,(c,x,y,z)=>{const belly=T.MathUtils.smoothstep(.36-y,-.035,.12),grain=.94+.06*Math.sin(z*37+x*17);c.set(palette[0]).lerp(new T.Color(palette[1]),belly).multiplyScalar(grain);});
}
function batEar(side,burnt){
 const s=new T.Shape();s.moveTo(-.04,0);s.quadraticCurveTo(-.032,.08,.004,.13);s.quadraticCurveTo(.053,.072,.045,.006);s.lineTo(-.04,0);
 const g=new T.ExtrudeGeometry(s,{depth:.009,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.004,bevelThickness:.003,curveSegments:5}),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,side*(.092+x),.437+y,.245-y*.53+z);}
 if(side<0){const ix=g.index;if(ix){for(let i=0;i<ix.count;i+=3){const a=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,a);}}else{for(const a of Object.values(g.attributes))for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){const n=(i+1)*a.itemSize+k,m=(i+2)*a.itemSize+k,tmp=a.array[n];a.array[n]=a.array[m];a.array[m]=tmp;}}}
 g.computeVertexNormals();return painted(g,(c,x,y,z)=>c.set(burnt?0x51413b:0x534b58).lerp(new T.Color(burnt?0x9d694c:0x81758a),Math.max(0,(y-.47)*3)));
}
function profileValue(points,x){for(let i=1;i<points.length;i++)if(x<=points[i][0])return mix(points[i-1][1],points[i][1],(x-points[i-1][0])/(points[i][0]-points[i-1][0]));return points.at(-1)[1];}
function wingEdges(kind,x){
 const u=x/1.25;
 if(kind==='frostwing'){const k=Math.sqrt(Math.max(0,1-u));return[.13+(.14+.58*Math.sin(u*Math.PI))*k,.13-(.27+.49*Math.sin(u*Math.PI))*k-.025*Math.sin(u*18)**2];}
 if(kind==='sunscarab'){const k=Math.sqrt(Math.max(0,1-u));return[.11+(.08+.25*Math.sin(u*Math.PI))*k,.11-(.18+.27*Math.sin(u*Math.PI))*k];}
 const lead=profileValue([[0,.18],[.25,.40],[.52,.47],[.8,.42],[1,.31],[1.25,.17]],x),back=profileValue([[0,-.31],[.28,-.42],[.4,-.20],[.61,-.53],[.78,-.23],[.94,-.37],[1.05,-.04],[1.25,.17]],x);
 return[lead,back+(kind==='cinderwing'?.028*Math.sin(x*39)**2:0)];
}
function wingGeometry(kind,outer){
 const rows=outer?20:12,p=[],c=[],idx=[],out=new T.Color(),burnt=kind==='cinderwing';
 for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
  const x=outer?hinge+(1.25-hinge)*i/rows:hinge*i/rows,u=x/1.25,v=j/columns,[front,back]=wingEdges(kind,x),ridge=Math.cos(v*Math.PI*3+x*2)**12;
  const y=i===0||i===rows?0:Math.sin(Math.PI*i/rows)*Math.sin(Math.PI*v)*(.018+ridge*.016),z=mix(front,back,v);
  p.push(x-(outer?hinge:0),y,z);
  if(kind==='frostwing'){
   const band=Math.exp(-(((v-(.39+.10*Math.sin(u*5)))/.065)**2)),edge=T.MathUtils.smoothstep(v,.77,.98),scales=.95+.05*Math.sin(i*2.3+j*4);
   out.set(0xc9dedd).lerp(new T.Color(0x597787),band*.55+edge*.32).multiplyScalar(scales);if(u>.56&&u<.72&&v>.59&&v<.73)out.lerp(new T.Color(0x73949a),.4);
  }else if(kind==='sunscarab')out.set(0xa8a991).lerp(new T.Color(0x657d72),v*.20+ridge*.10);
  else if(burnt)out.set(0x38363b).lerp(new T.Color(0xa36b46),T.MathUtils.smoothstep(ridge,.72,1)*.42+(u<.28?.17:0)).lerp(new T.Color(0x181c23),v*.18);
  else out.set(0x655666).lerp(new T.Color(0x302d3d),v*.35).lerp(new T.Color(0x8a7d85),ridge*.15);
  c.push(out.r,out.g,out.b);
  if(i<rows&&j<columns){
   // Frayed gaps are in the actual burnt membrane; the supporting fingers remain.
   const torn=burnt&&outer&&((i>=9&&i<=11&&j>=6&&j<=7)||(i>=14&&j>=10)||(i===4&&j===10));
   if(!torn){const a=i*(columns+1)+j,b=a+columns+1;idx.push(a,b,a+1,b,b+1,a+1);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();
 const ribs=[],bone=burnt?0x73614e:kind==='duskbat'?0x8c7c87:kind==='frostwing'?0x7b9aa3:0x767a61;
 const rib=points=>ribs.push(tube(bone,points.map(([x,z])=>[x-(outer?hinge:0),.005,z]),kind==='duskbat'||burnt?[.013,.011,.004]:[.008,.007,.003],8,5));
 if(outer){
  rib([[.52,wingEdges(kind,.52)[0]],[.88,wingEdges(kind,.88)[0]],[1.245,wingEdges(kind,1.245)[0]]]);
  if(kind==='duskbat'||burnt){rib([[.52,.44],[.75,-.02],[.94,-.36]]);rib([[.52,.42],[.57,-.10],[.61,-.52]]);}
  else{rib([[.52,.08],[.83,-.04],[1.1,wingEdges(kind,1.1)[1]+.03]]);}
 }else rib([[0,wingEdges(kind,0)[0]],[.26,wingEdges(kind,.26)[0]],[.52,wingEdges(kind,.52)[0]]]);
 const merged=batch([g,...ribs]);merged.userData.seamCount=columns+1;merged.userData.membraneRows=rows+1;merged.userData.membraneVertices=idx.length;return merged;
}
function shellGeometry(side){
 const p=[],idx=[],rows=15,cols=9;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=j/rows,z=-.46+t*.81,u=i/cols,width=.225*Math.sin(Math.PI*(.06+.90*t));
  p.push(side*width*u,.018+Math.sin(u*Math.PI)*.060*Math.sin(t*Math.PI),z);
  if(j<rows&&i<cols){const a=j*(cols+1)+i,b=a+cols+1;idx.push(...(side>0?[a,b,a+1,b,b+1,a+1]:[a,a+1,b,b,a+1,b+1]));}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
 return painted(g,(c,x,y,z)=>{const seam=.5+.5*Math.cos(x*90);c.set(0x9f824d).lerp(new T.Color(0x554e37),seam*.14).lerp(new T.Color(0xc6ae70),Math.max(0,y-.025)*5);});
}
function rayGeometry(){
 const p=[],idx=[],nx=34,nz=16;
 for(const lower of[false,true])for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
  const u=i/nx*2-1,v=j/nz,w=Math.abs(u),x=u*1.76,front=.59-.77*w,back=-.57+.39*w,z=mix(front,back,v),thick=(.006+.10*(1-w)**3)*Math.sin(v*Math.PI);
  p.push(x,.32+(lower?-1:1)*thick,z);
  if(i<nx&&j<nz){const a=(lower?(nx+1)*(nz+1):0)+i*(nz+1)+j,b=a+nz+1;idx.push(...(lower?[a,a+1,b,b,a+1,b+1]:[a,b,a+1,b,b+1,a+1]));}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
 painted(g,(c,x,y,z)=>c.set(y<.32?0x9fbfc0:0x416777).lerp(new T.Color(y<.32?0xd0d1bd:0x6a929a),Math.max(0,1-Math.abs(x)/1.5)*.35));
 const parts=[g,tube(0x496976,[[0,.32,-.49],[.018,.31,-.76],[-.024,.30,-1.06],[0,.29,-1.45]],[.040,.022,.012,.002],18,6)];
 for(const side of[-1,1]){
  parts.push(oval(0x17313b,side*.15,.398,.255,.021,.012,.018));
  for(let k=0;k<3;k++)parts.push(tube(0x698f97,[[side*.055,.224,-.02-k*.08],[side*.13,.227,-.01-k*.08],[side*.21,.236,.01-k*.08]],[.005,.005,.003],4,4));
 }
 parts.push(tube(0x667f80,[[-.085,.235,.27],[0,.223,.29],[.085,.235,.27]],[.005,.007,.005],8,4));
 const merged=batch(parts),base=merged.attributes.position,baseNormal=merged.attributes.normal;merged.morphTargetsRelative=true;merged.morphAttributes.position=[];merged.morphAttributes.normal=[];
 for(let k=0;k<3;k++){
  const delta=new Float32Array(base.array.length),absolute=new Float32Array(base.array),normalDelta=new Float32Array(base.array.length);
  for(let i=0;i<base.count;i++){
   const x=base.getX(i),z=base.getZ(i),w=T.MathUtils.smoothstep(Math.abs(x),.20,1.76),lag=w*1.4,tail=T.MathUtils.smoothstep(-z,.51,1.45);
   let dx=0,dy=0,dz=0;
   if(k<2){dy=.24*w*(k?Math.sin(lag):Math.cos(lag));dx=tail*tail*(k?.10:.055);}
   else{dx=-Math.sign(x)*w*.10;dy=w*.21;dz=-w*.07;}
   delta[i*3]=dx;delta[i*3+1]=dy;delta[i*3+2]=dz;absolute[i*3]+=dx;absolute[i*3+1]+=dy;absolute[i*3+2]+=dz;
  }
  const shape=merged.clone();shape.setAttribute('position',new T.BufferAttribute(absolute,3));shape.computeVertexNormals();for(let i=0;i<normalDelta.length;i++)normalDelta[i]=shape.attributes.normal.array[i]-baseNormal.array[i];shape.dispose();
  merged.morphAttributes.position.push(new T.BufferAttribute(delta,3));merged.morphAttributes.normal.push(new T.BufferAttribute(normalDelta,3));
 }
 merged.computeBoundingBox();merged.computeBoundingSphere();return merged;
}
function template(kind){
 if(templates.has(kind))return templates.get(kind);
 if(kind==='skyray'){const p={body:rayGeometry()};templates.set(kind,p);return p;}
 const burnt=kind==='cinderwing',bat=kind==='duskbat'||burnt,moth=kind==='frostwing',profile=bat?
 [[-.52,.006,.009,.30],[-.34,.092,.070,.29],[-.12,.158,.14,.31],[.03,.182,.16,.33],[.17,.132,.105,.37],[.30,.109,.093,.386],[.4,.071,.059,.367],[.515,.003,.010,.345]]:
 moth?[[-.56,.008,.01,.28],[-.40,.065,.070,.29],[-.19,.115,.115,.32],[.02,.165,.155,.35],[.18,.12,.103,.37],[.31,.076,.063,.375],[.37,.004,.013,.375]]:
 [[-.50,.015,.015,.29],[-.32,.205,.12,.29],[-.06,.258,.15,.31],[.14,.217,.12,.33],[.30,.145,.096,.342],[.43,.091,.062,.333],[.48,.007,.012,.327]];
 const parts=[bodySurface(profile,bat?(burnt?[0x34353a,0x885b43]:[0x413d49,0x837178]):moth?[0x81989e,0xc4d0c7]:[0x6e654c,0xbaa66e],{fur:moth?.065:0,segments:bat?32:28})];
 for(const side of[-1,1]){
  const eye=bat?[side*.080,.401,.357]:moth?[side*.075,.398,.293]:[side*.116,.373,.343];parts.push(oval(burnt?0xb09463:0x202b30,...eye,bat?.012:.016,.011,.013));
  if(bat){parts.push(batEar(side,burnt));parts.push(tube(burnt?0x6e5c49:0x766874,[[side*.087,.26,-.27],[side*.16,.23,-.38],[side*.195,.27,-.34]],[.025,.018,.007],5,5));}
  if(moth){
   parts.push(tube(0x748d98,[[side*.058,.415,.29],[side*.10,.485,.34],[side*.177,.554,.35]],[.010,.008,.003],10,5));
   for(let n=0;n<5;n++){const t=n/5,x=side*(.092+t*.067),y=.474+t*.064;parts.push(tube(0xa3b9bc,[[x,y,.342],[x+side*.032,y+.017,.325]],[.004,.001],2,4));}
  }
  if(!bat&&!moth){
   for(let i=0;i<3;i++)parts.push(tube(0x5d5c44,[[side*.20,.26,.18-i*.20],[side*.29,.16,.18-i*.20],[side*.17,.135,.29-i*.20]],[.021,.013,.004],5,5));
   parts.push(tube(0x6a684b,[[side*.055,.36,.42],[side*.10,.40,.49],[side*.14,.42,.52]],[.010,.008,.005],5,5));
  }
 }
 if(!bat&&!moth)for(let i=0;i<5;i++)parts.push(tube(0x413f32,[[-.14,.196,-.30+i*.084],[0,.159,-.32+i*.084],[.14,.196,-.30+i*.084]],[.006,.007,.006],8,5));
 const p={body:batch(parts),inner:wingGeometry(kind,false),outer:wingGeometry(kind,true)};
 if(!bat&&!moth)p.shells=[shellGeometry(-1),shellGeometry(1)];templates.set(kind,p);return p;
}
const AIR_POSES={
 duskbat:{rate:6.5,amp:.42,tip:.30,lag:.8,wind:.60,fold:.25,strike:.06},
 frostwing:{rate:4.3,amp:.32,tip:.16,lag:.55,wind:.43,fold:.10,strike:.04},
 cinderwing:{rate:8.8,amp:.38,tip:.34,lag:.95,wind:.69,fold:.33,strike:-.04},
 sunscarab:{rate:30,amp:.19,tip:.055,lag:.30,wind:.29,fold:.12,strike:.08},
 skyray:{rate:2.55,amp:.20,tip:.24,lag:1.2,wind:.32,fold:.07,strike:-.04}
};
const AIR_BLEND_KEYS=['wind','strike','recover'];
export function makeAirborne(kind){
 const cfg=AIR_ENEMIES[kind],p=template(kind),root=new T.Group(),rig=new T.Group();root.add(rig);root.name='SM_Enemy_'+kind;rig.name='Rig_'+kind;
 if(!materials.has(kind))materials.set(kind,[new T.MeshStandardMaterial({name:'M_'+kind+'_Anatomy',color:0xffffff,vertexColors:true,roughness:kind==='sunscarab'?.67:.88}),new T.MeshStandardMaterial({name:'M_'+kind+'_Wing',color:0xffffff,vertexColors:true,roughness:kind==='frostwing'?.88:.76,side:T.DoubleSide}),new T.MeshStandardMaterial({name:'M_'+kind+'_Elytra',color:0xffffff,vertexColors:true,roughness:.43,metalness:.08,side:T.DoubleSide})]);
 const [skin,membrane,shellMat]=materials.get(kind),part=(parent,name,g,mat)=>{const m=new T.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const body=part(rig,'SM_Enemy_'+kind+'_ContinuousBody',p.body,skin),wings=[],wingTips=[],shells=[];
 if(kind!=='skyray')for(const side of[-1,1]){
  const wing=new T.Group();wing.name='Joint_Wing_'+side;wing.position.set(side*.12,.345,0);wing.scale.set(side*cfg.span,1,cfg.span);rig.add(wing);wings.push(wing);part(wing,'SM_Enemy_Wing_Inner',p.inner,membrane);
  const tip=new T.Group();tip.name='Joint_WingTip_'+side;tip.position.x=hinge;wing.add(tip);wingTips.push(tip);part(tip,'SM_Enemy_Wing_Outer',p.outer,membrane);
  if(p.shells){const shell=new T.Group();shell.name='Joint_Elytron_'+side;shell.position.set(side*.055,.435,-.015);rig.add(shell);shells.push(shell);part(shell,'SM_Enemy_Elytron',p.shells[side<0?0:1],shellMat);}
 }
 // The continuous ray's morph envelope is deliberately larger than its rest
 // body. Preserve the old gameplay height instead of using its GPU cull bound.
 Object.assign(root.userData,{rig,body,head:body,wings,wingTips,shells,tail:null,combatHeight:.6});return root;
}
export function animateAirborne(e,time){
 const d=e.mesh.userData,cfg=AIR_POSES[e.kind],stage=e.flight?.stage||'orbit';
 const p=d.airPose??={time,wind:0,strike:0,recover:0},dt=Math.max(0,Math.min(.05,time-p.time)),blend=1-Math.exp(-dt*7);p.time=time;
 for(const key of AIR_BLEND_KEYS)p[key]+=((stage===key?1:0)-p[key])*blend;
 const phase=time*cfg.rate+e.id,hover=Math.max(0,1-p.wind-p.strike),amplitude=cfg.amp*(1-p.recover*.35);
 const flap=Math.sin(phase)*amplitude*hover+cfg.wind*p.wind+cfg.strike*p.strike,tip=Math.sin(phase-cfg.lag)*cfg.tip*hover-cfg.fold*p.wind+.035*p.strike;
 d.rig.rotation.z=Math.sin(time*1.8+e.id)*.035*(1-p.strike*.7);d.rig.rotation.x=Math.sin(time*2.3)*.022*(1-p.strike)-p.strike*.085;
 if(e.kind==='skyray'){
  d.body.morphTargetInfluences[0]=Math.sin(phase)*hover*.85;d.body.morphTargetInfluences[1]=Math.cos(phase)*hover*.85;d.body.morphTargetInfluences[2]=p.wind*.85+p.strike*.12;return;
 }
 for(let i=0;i<d.wings.length;i++){
  const side=i?1:-1;d.wings[i].rotation.set(0,side*cfg.fold*(p.wind+p.strike*.6),side*flap);d.wingTips[i].rotation.set(0,0,tip);
  if(d.shells[i])d.shells[i].rotation.z=side*(.34+p.wind*.32+p.strike*.52);
 }
}

import * as T from './vendor/three.module.js';
import {MIRAGE} from './mirage-config.js?v=114';

const clamp=n=>Math.max(0,Math.min(1,n));
const fogVertex=`varying vec2 fogUv;void main(){fogUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fogFragment=`uniform float clock;uniform float seed;uniform float opacity;uniform float strength;varying vec2 fogUv;
void main(){vec2 p=fogUv*2.0-1.0;float r=length(p);float edge=1.0-smoothstep(.58,1.0,r);
float curl=sin(p.x*7.0+p.y*4.0+clock*.65+seed)*sin(p.y*9.0-p.x*3.0-clock*.43);
float strands=.5+.5*sin(p.x*13.0+p.y*8.0+curl*2.0-clock*.8);
vec3 color=mix(vec3(.16,.085,.23),vec3(.47,.32,.60),strands);color=mix(color,vec3(.61,.46,.76),strength*.18);
gl_FragColor=vec4(color,edge*(.46+.54*strands)*opacity);}`;
const ghostVertex=`varying vec3 veilNormal;varying vec3 veilView;varying vec3 veilPos;
void main(){vec4 p=modelViewMatrix*vec4(position,1.0);veilView=-p.xyz;veilNormal=normalize(normalMatrix*normal);veilPos=position;gl_Position=projectionMatrix*p;}`;
const ghostFragment=`uniform float opacity;uniform float clock;uniform float hit;varying vec3 veilNormal;varying vec3 veilView;varying vec3 veilPos;
void main(){float rim=pow(1.0-abs(dot(normalize(veilNormal),normalize(veilView))),1.6);
float wisp=.88+.12*sin(veilPos.y*14.0-clock*2.2+veilPos.x*5.0);
vec3 color=mix(vec3(.28,.13,.41),vec3(.71,.57,.87),rim*.72+hit*.24);
float base=mix(.34,.78,rim)*smoothstep(-.03,.45,veilPos.y)*wisp;
gl_FragColor=vec4(color,base*opacity);}`;

// One pooled, frozen pose: no second animation mixer, skeleton or per-frame skin baking.
// Only the real hero's visible mesh geometry is copied, never its gameplay/userData.
export class MirageVFX {
 constructor(scene,vfx){
  this.vfx=vfx;this.group=new T.Group();this.group.name='Mirage_effects';scene.add(this.group);
  this.plane=new T.PlaneGeometry(2,2);this.petalGeometry=new T.SphereGeometry(1,8,5);
  this.fog=Array.from({length:MIRAGE.maxClouds},()=>{
   const material=new T.ShaderMaterial({vertexShader:fogVertex,fragmentShader:fogFragment,uniforms:{clock:{value:0},seed:{value:0},opacity:{value:0},strength:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide});
   const mesh=new T.Mesh(this.plane,material);mesh.rotation.x=-Math.PI/2;mesh.visible=false;mesh.renderOrder=1;mesh.frustumCulled=false;this.group.add(mesh);return mesh;
  });
  this.ghostMaterial=new T.ShaderMaterial({vertexShader:ghostVertex,fragmentShader:ghostFragment,uniforms:{opacity:{value:0},clock:{value:0},hit:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide});
  this.decoy=new T.Group();this.decoy.name='mirage-decoy';this.decoy.visible=false;this.group.add(this.decoy);this.snapshot=new Map();this.sourceHero=null;this.decoyId=null;this.hitAt=-100;
  const instances=(count,color)=>{const material=new T.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false}),mesh=new T.InstancedMesh(this.petalGeometry,material,count);mesh.count=0;mesh.frustumCulled=false;this.group.add(mesh);return mesh;};
  this.spores=instances(16,0xa78cc7);this.petals=instances(9,0x8b639f);this.guard=instances(5,0xcab6df);
  this.dummy=new T.Object3D();this.point=new T.Vector3();this.origin=new T.Vector3();this.local=new T.Matrix4();this.clouds=[];
 }
 capture(hero){
  if(!hero)return;
  if(hero!==this.sourceHero){this.clearSnapshot();this.sourceHero=hero;}
  hero.updateWorldMatrix(true,true);hero.getWorldPosition(this.origin);
  this.local.makeTranslation(-this.origin.x,-this.origin.y,-this.origin.z);
  for(const entry of this.snapshot.values())entry.visible=false;
  hero.traverseVisible(source=>{
   if(!source.isMesh||source.isInstancedMesh||!source.geometry?.attributes.position||source.userData.mirageEffect)return;
   let mesh=this.snapshot.get(source.uuid);
   if(!mesh){
    const geometry=source.geometry.clone();geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.morphAttributes={};
    mesh=new T.Mesh(geometry,this.ghostMaterial);mesh.frustumCulled=false;mesh.name='mirage-imprint-'+source.name;this.snapshot.set(source.uuid,mesh);this.decoy.add(mesh);
   }
   source.skeleton?.update();
   const out=mesh.geometry.attributes.position,matrix=new T.Matrix4().multiplyMatrices(this.local,source.matrixWorld);
   for(let i=0;i<out.count;i++){source.getVertexPosition(i,this.point);this.point.applyMatrix4(matrix);out.setXYZ(i,this.point.x,this.point.y,this.point.z);}
   out.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.visible=true;
  });
 }
 set(mesh,i,x,y,z,sx,sy,sz,angle=0){const d=this.dummy;d.position.set(x,y,z);d.scale.set(sx,sy,sz);d.rotation.set(.2,angle,.18);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);}
 update(combat,player,hero){
  if(!combat){this.clear();return;}this.group.visible=true;const now=combat.now||0;
  this.clouds=(combat.clouds||[]).filter(c=>c.expires>now).slice(0,MIRAGE.maxClouds);let spores=0;
  for(let i=0;i<this.fog.length;i++){
   const mesh=this.fog[i],c=this.clouds[i];mesh.visible=!!c;if(!c)continue;
   const fade=clamp((c.expires-now)/.45),grow=clamp((now-(c.born??now))/.15),u=mesh.material.uniforms;
   u.clock.value=now;u.seed.value=(Number(c.id)||i)*.87;u.strength.value=(c.lureRank||0)/3;u.opacity.value=.25*fade*grow;
   mesh.position.set(c.x,.068+i*.002,c.z);mesh.scale.set(c.r,c.r,1);
   for(let j=0;j<8;j++){const a=j*2.4+(c.id||0)+now*.18,r=c.r*(.22+.10*(j%5));this.set(this.spores,spores++,c.x+Math.sin(a)*r,.10+(1+Math.sin(now*1.7+j))*.07,c.z+Math.cos(a)*r,.028,.045,.018,a);}
  }
  this.spores.count=spores;this.spores.instanceMatrix.needsUpdate=true;
  const d=combat.decoy,alive=!!d&&d.alive!==false&&d.hp>0&&d.expires>now;
  this.decoy.visible=alive;this.petals.count=alive?9:0;
  if(alive){
   if(this.decoyId!==d.id){this.capture(hero);this.decoyId=d.id;this.hitAt=-100;}
   this.decoy.position.set(d.x,0,d.z);this.decoy.rotation.set(0,0,0);
   const life=Math.max(.01,d.expires-(d.born??now)),age=clamp((now-(d.born??now))/life),fade=clamp((d.expires-now)/.15),u=this.ghostMaterial.uniforms;
   u.clock.value=now;u.opacity.value=(.75+.20*age)*fade;u.hit.value=Math.max(0,1-(now-this.hitAt)/.22);
   for(let i=0;i<9;i++){const a=i*2.4+now*.9,r=.25+(1-age)*.18, y=.10+((i/9+now*.25)%1)*1.5;this.set(this.petals,i,d.x+Math.sin(a)*r,y,d.z+Math.cos(a)*r,.026,.06,.012,a);}
  }
  this.petals.instanceMatrix.needsUpdate=true;
  const shield=!!player&&combat.shield?.amount>0&&combat.shield.until>now;
  this.guard.count=shield?5:0;
  if(shield)for(let i=0;i<5;i++){const a=i*Math.PI*2/5+now*.4;this.set(this.guard,i,player.x+Math.sin(a)*.42,.75+Math.sin(a*2)*.10,player.z+Math.cos(a)*.42,.025,.13,.018,-a);}
  this.guard.instanceMatrix.needsUpdate=true;this.now=now;
 }
 event(e){
  if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.z))return;
  if(e.kind==='mirageDecoyHit')this.hitAt=this.now||0;
  const v=this.vfx;if(!v)return;
  const mist=(r=.55,opacity=.24,life=.35)=>v.particle('veil',0x4a2b63,e.x,.09,e.z,{life,size:[r,r*.8,1],opacity,additive:false,grow:true,priority:1});
  const petal=(a,s=.07,speed=1,life=.35,y=.55)=>{const m=v.particle('claw',0xa78cc7,e.x,y,e.z,{life,size:[s*2.3,s*1.6,1],velocity:[Math.sin(a)*speed,.45,Math.cos(a)*speed],opacity:.65,additive:false,spin:3,priority:1});if(m)m.rotation.z=.65;};
  if(e.kind==='mirageShot'){
   const a=e.angle||0;v.particle('smoke',0x4a2b63,e.x,.95,e.z,{life:.30,size:[.19,.16,.24],opacity:.28,additive:false,grow:true,velocity:[-Math.sin(a)*.5,.15,-Math.cos(a)*.5]});
   for(let i=-1;i<=1;i++)petal(a+i*.55,.035,.75,.28,.95);
  }else if(e.kind==='mirageBurst'){
   const r=Math.max(.1,e.r||2.2);v.particle('veil',0x4a2b63,e.x,.09,e.z,{life:.55,size:[r,r,1],opacity:.25,additive:false,grow:true,priority:1});
   // A short low pressure cloud, distinct from the decoy's symmetrical petal flower.
   for(let i=0;i<5;i++){
    const a=i*2.39996+(e.angle||0),d=r*(.13+.055*(i%3));
    v.particle('vapor',i%2?0x684180:0x453052,e.x+Math.sin(a)*d,.18+(i%2)*.07,e.z+Math.cos(a)*d,{life:.44+i*.02,size:[r*.23,r*.17,1],velocity:[Math.sin(a)*r*.50,.12,Math.cos(a)*r*.50],opacity:.27,additive:false,grow:true,priority:i===0?1:0});
    petal(a,.055,r*.75,.42,.28);
   }
  }else if(e.kind==='mirageHit'){
   const a=e.angle||0;for(let i=-1;i<=1;i++)petal(a+i*.9,.025,.6,.2,.70);
   v.particle('smoke',0x73528d,e.x,.67,e.z,{life:.28,size:[.12,.18,.10],velocity:[0,.18,0],opacity:.28,additive:false});
  }else if(e.kind==='mirageHide'||e.kind==='mirageDecoy'){
   mist(e.kind==='mirageHide'?.50:.65,.20,.40);
   for(let i=0;i<5;i++)petal(i*2.4,.035,e.kind==='mirageHide'?.6:.3,.43,.2+i*.22);
  }else if(e.kind==='mirageDecoyHit'){
   for(let i=0;i<3;i++)petal(i*2.4,.04,.85,.25,.75);
   v.particle('smoke',0x8a68a5,e.x,.9,e.z,{life:.20,size:[.20,.25,.13],opacity:.22,additive:false});
  }else if(e.kind==='mirageBreak'){
   // Break/replacement dissolve upward. They deliberately never share bloom's radial burst.
   for(let i=0;i<4;i++){const a=i*2.4;v.particle('smoke',0x4a2b63,e.x+Math.sin(a)*.16,.25+i*.28,e.z+Math.cos(a)*.16,{life:.28,size:[.12,.16,.10],velocity:[Math.sin(a)*.12,.45,Math.cos(a)*.12],opacity:.25,additive:false});}
  }else if(e.kind==='mirageBloom'){
   const r=Math.max(.1,e.r||1.7);mist(r,.20,.48);
   for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7, m=v.particle('sweep',i%2?0x6f4389:0xa48ac1,e.x,.13+i*.007,e.z,{life:.42,size:[r*.52,r*.45,1],opacity:.58,additive:false,motion:'lash',roll:i%2?.7:-.7,priority:1});
    if(m)m.rotation.set(-Math.PI/2,0,a);petal(a,.045,r*1.2,.38,.25);
   }
  }else if(e.kind==='mirageReveal'||e.kind==='mirageShield'){
   mist(.45,.15,.25);for(let i=0;i<(e.kind==='mirageShield'?5:3);i++)petal(i*2.4,.03,.35,.3,.5+i*.12);
  }else if(e.kind==='mirageStatus'){
   const size=Math.max(.25,e.size||.6);v.particle('smoke',0x7b5897,e.x+size*.28,.35,e.z,{life:.28,size:[.06,.15,.05],velocity:[.04,.27,0],opacity:.32,additive:false});
  }
 }
 clearSnapshot(){for(const mesh of this.snapshot.values()){mesh.removeFromParent();mesh.geometry.dispose();}this.snapshot.clear();this.sourceHero=null;}
 clear(){this.clouds=[];this.group.visible=false;this.decoy.visible=false;this.decoyId=null;this.hitAt=-100;for(const mesh of this.fog)mesh.visible=false;for(const mesh of[this.spores,this.petals,this.guard])mesh.count=0;this.clearSnapshot();}
 dispose(){this.clear();this.group.removeFromParent();this.plane.dispose();this.petalGeometry.dispose();this.ghostMaterial.dispose();for(const mesh of this.fog)mesh.material.dispose();for(const mesh of[this.spores,this.petals,this.guard]){mesh.dispose();mesh.material.dispose();}}
}

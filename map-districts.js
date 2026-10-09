import * as T from './vendor/three.module.js';
import{MAP_HALF}from'./map-layout.js?v=114';
import{bridgeContains}from'./coast.js?v=114';
import{wornStoneBlock}from'./environment-props.js?v=116';
const slabGeometry=new T.BoxGeometry(1,1,1),slabMaterials={sand:new T.MeshStandardMaterial({color:0xb3a184,roughness:1,vertexColors:true}),coast:new T.MeshStandardMaterial({color:0x697f76,roughness:1,vertexColors:true}),wood:new T.MeshStandardMaterial({color:0x8a7a60,roughness:1})};
// Districts leave a broad open center; solid pieces have matching collision footprints.
export function districtLayout(id,spawn){const scale=MAP_HALF/82;return id==='sand'?[{x:spawn.x+12,z:spawn.z+1,kind:'gate'},...[[-34,-31],[34,29],[42,-33],[-35,36],[12,57]].map(([x,z])=>({x:x*scale,z:z*scale,kind:'court'}))]:id==='coast'?[{x:-16,z:-9,kind:'warehouse'},{x:24,z:29,kind:'warehouse'},{x:-16,z:42,kind:'wreck'}]:[];}
export function buildDistricts(world,id,layouts,mesh,rnd){
 const {group,obstacles,sites}=world;world.districts=[];
 const stone=id==='sand'?0xa49173:0x718c89,edge=id==='sand'?0xd2bc94:0xa2b0a1,wood=0x76614c;
 const tileMatrices=[],boardMatrices=[],dummy=new T.Object3D(),half=world.half||MAP_HALF;
 // Keep solids and ground detail clear even when neighboring water is at high tide.
 const allowed=(x,z,r)=>Math.abs(x)+r<half-1&&Math.abs(z)+r<half-1&&(!world.contains||world.contains(x,z))&&Math.hypot(x-world.spawn.x,z-world.spawn.z)>5+r&&!sites.some(s=>Math.hypot(x-s.x,z-s.z)<8+r)&&!world.bridges?.some(b=>bridgeContains(b,x,z,r+1))&&!world.ponds.some(p=>{const a=p.angle||0,dx=x-p.x,dz=z-p.z,k=p.baseRx===undefined?1:1.19;return Math.hypot((Math.cos(a)*dx-Math.sin(a)*dz)/((p.baseRx||p.rx)*k+r+.25),(Math.sin(a)*dx+Math.cos(a)*dz)/((p.baseRz||p.rz)*k+r+.25))<1;});
 const tile=(x,z,sx,sz,angle,wooden=false)=>{if(!allowed(x,z,Math.max(sx,sz)*.52))return;
  // Position-derived wear leaves the world generator's random stream untouched.
  const shift=Math.sin(x*2.13+z*3.71),wear=Math.cos(x*4.39-z*1.87);
  if(!wooden){const dx=shift*.16,dz=wear*.16;if(allowed(x+dx,z+dz,Math.max(sx,sz)*.6)){x+=dx;z+=dz;}sx*=.77+wear*.17;sz*=.84+shift*.15;angle+=shift*.22;}
  dummy.position.set(x,wooden?.015:.010+wear*.009,z);dummy.rotation.set(0,angle,0);dummy.scale.set(sx,wooden?.05:.055,sz);dummy.updateMatrix();(wooden?boardMatrices:tileMatrices).push(dummy.matrix.clone());};
 for(const l of layouts){if(sites.some(s=>Math.hypot(s.x-l.x,s.z-l.z)<13))continue;world.districts.push(l);const a=l.angle||0,c=Math.cos(a),s=Math.sin(a),point=(x,z)=>({x:l.x+c*x+s*z,z:l.z-s*x+c*z});
  const place=(x,z,build,r=.7)=>{const p=point(x,z);if(!allowed(p.x,p.z,r))return;const g=new T.Group();g.position.set(p.x,0,p.z);g.rotation.y=a;g.userData.district=l.kind;group.add(g);build(g);obstacles.push({x:p.x,z:p.z,r,mesh:g});};
  const box=(g,color,x,y,z,w,h,d)=>{const m=mesh('BoxGeometry',[1,1,1],color,x,y,z,g);m.scale.set(w,h,d);return m;};
  const pier=(g,h=2.5)=>{mesh('CylinderGeometry',[.45,.6,h,10],stone,0,h/2,0,g);box(g,edge,0,.18,0,1.35,.35,1.35);box(g,edge,0,h+.1,0,1.16,.22,1.16);};
  if(id==='sand'){
   for(const side of[-1,1])place(side*3.6,0,g=>{pier(g,side<0?3.4:2.8);if(side<0){const top=box(g,edge,.7,3.55,0,2.4,.42,1.15);top.rotation.z=-.08;}},.96);
   for(const side of[-1,1])for(let i=0;i<4;i++)place(side*(4.7+i*1.05),i>1?-2:0,g=>{g.userData.fragile=true;const h=.65+rnd()*1.25;box(g,stone,0,h/2,0,.94,h,.85);box(g,edge,0,h+.07,0,1.04,.15,.95);},.62);
   for(let i=0;i<7;i++)place(-5+rnd()*10,4+rnd()*2,g=>{const rock=mesh('DodecahedronGeometry',[.45,0],stone,0,.25,0,g);rock.scale.set(1.5,.7,1);},.68);
  }else if(l.kind==='warehouse'){
   // Open-front storehouse: roof above a walkable cargo apron.
   for(const side of[-1,1])place(side*2.5,0,g=>{box(g,wood,0,1.65,0,.28,3.3,.28);box(g,stone,0,.25,0,.7,.5,.7);const roof=box(g,0x566f70,side*-1.1,3.12,0,2.65,.16,3.9);roof.rotation.z=side*.22;},.5);
   for(const side of[-1,1])place(side*2.5,1.4,g=>{for(let row=0;row<4;row++)box(g,row%2?0x806e54:wood,0,.25+row*.31,0,.13,.26,1.65);},.85);
   for(let i=0;i<3;i++)place(-2+i*2,2.1,g=>{box(g,wood,0,.48,0,1.25,.96,1.1);for(const y of[.18,.72])box(g,0xb0a17d,0,y,.565,1.3,.1,.055);},.85);
   for(const side of[-1,1])place(side*3.6,-2,g=>{pier(g,.75);mesh('TorusGeometry',[.26,.04,5,12],0x9f987f,0,.96,0,g).rotation.x=Math.PI/2;},.96);
  }else if(l.kind==='dock'){
   // Flush boards suggest a loading quay without an elevated collision surface.
   for(let x=-4.4;x<=4.4;x+=.48)for(const z of[-1.5,1.5]){const p=point(x,z);tile(p.x,p.z,.4,2.85,a,true);}
   for(const x of[-4.8,4.8])for(const z of[-2.6,2.6])place(x,z,g=>{mesh('CylinderGeometry',[.22,.30,.85,8],wood,0,.42,0,g);for(const y of[.55,.65])mesh('TorusGeometry',[.24,.045,5,10],0xaea27e,0,y,0,g).rotation.x=Math.PI/2;},.35);
   for(const [x,z]of[[-3,3.7],[1.9,3.5]])place(x,z,g=>{mesh('CylinderGeometry',[.48,.45,1,10],0x887454,0,.5,0,g);for(const y of[.17,.79])mesh('TorusGeometry',[.46,.055,5,10],0x506568,0,y,0,g).rotation.x=Math.PI/2;},.55);
  }else if(l.kind==='beacon'){
   place(0,0,g=>{mesh('CylinderGeometry',[.7,1.05,.55,8],stone,0,.27,0,g);mesh('CylinderGeometry',[.43,.66,2.1,8],edge,0,1.55,0,g);mesh('CylinderGeometry',[.76,.76,.14,8],0x526967,0,2.64,0,g);for(const side of[-1,1])box(g,wood,side*.4,3.04,0,.09,.75,.09);mesh('SphereGeometry',[.24,8,5],0xe8c98a,0,3.03,0,g);mesh('ConeGeometry',[.85,.65,8],0x587773,0,3.65,0,g);},1.08);
   for(let i=0;i<4;i++)place(Math.sin(i*2.2)*2.4,Math.cos(i*2.2)*2.1,g=>{const rock=mesh('DodecahedronGeometry',[.65,1],stone,0,.33,0,g);rock.scale.set(1,.65,1.2);},.79);
  }else if(l.kind==='wreck'){
   for(let i=0;i<6;i++){const width=.65+Math.sin((i+.5)/6*Math.PI)*1.1;place((i-2.5)*1.05,Math.sin(i*.6)*.35,g=>{box(g,0x998267,0,.12,0,.94,.18,width*1.5);for(const side of[-1,1]){const rib=box(g,wood,0,.47,side*width*.59,.16,.9,.17);rib.rotation.x=side*.38;}},Math.hypot(.47,width*.75));}
   place(-.6,2.1,g=>{const mast=mesh('CylinderGeometry',[.09,.16,3.2,8],wood,0,.28,0,g);mast.rotation.z=1.43;},1.6);
  }
  if(l.kind!=='dock')for(let x=-4;x<=4;x+=1.4)for(let z=-4;z<=3;z+=1.4){if(rnd()<.25)continue;const p=point(x,z);tile(p.x,p.z,1.2,1.2,a+(rnd()-.5)*.12);}
 }
 // Shoreline stones follow rotated banks, including new bays and islands.
 if(id==='coast')for(const p of world.ponds){const a=p.angle||0,c=Math.cos(a),s=Math.sin(a),rx=(p.baseRx||p.rx)*1.19,rz=(p.baseRz||p.rz)*1.19;for(let i=0;i<24;i++){if(rnd()<.36)continue;const t=i*Math.PI/12+(rnd()-.5)*.14,dx=Math.sin(t)*(rx+1.4),dz=Math.cos(t)*(rz+1.4),x=p.x+c*dx+s*dz,z=p.z-s*dx+c*dz;tile(x,z,.65+rnd()*.65,.75+rnd()*.6,a-t+(rnd()-.5)*.35);}}
 for(const [mat,matrices]of[[slabMaterials[id],tileMatrices],[slabMaterials.wood,boardMatrices]]){if(!matrices.length)continue;const wooden=mat===slabMaterials.wood,tiles=new T.InstancedMesh(wooden?slabGeometry:wornStoneBlock,mat,matrices.length),tint=new T.Color();matrices.forEach((m,i)=>{tiles.setMatrixAt(i,m);if(!wooden){const shade=.87+.10*Math.sin(m.elements[12]*1.7+m.elements[14]*2.3);tiles.setColorAt(i,tint.setRGB(shade,shade,shade));}});tiles.receiveShadow=true;tiles.userData.districtDetail=true;group.add(tiles);}
}

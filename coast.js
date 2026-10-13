import{dodgeTravel}from'./hero-dodge.js?v=183';
import * as T from './vendor/three.module.js';
const boardGeometry=new T.BoxGeometry(1,.12,.38),boardMaterial=new T.MeshStandardMaterial({color:0x86765b,roughness:.94}),postGeometry=new T.CylinderGeometry(.11,.14,1.1,7),postMaterial=new T.MeshStandardMaterial({color:0x635b49,roughness:1});
export function tideState(time){const p=((time%28)+28)%28,warning=p>=14&&p<17,high=p>=17&&p<25;const rise=p<17?0:p<19?(p-17)/2:p<25?1:(28-p)/3;return{warning,high,rise,label:warning?'涨潮将至':high?'涨潮 · 水流减速，沿栈桥通行':'退潮 · 探索滩地'};}
export function bridgeContains(b,x,z,padding=0){const c=Math.cos(b.angle||0),s=Math.sin(b.angle||0),dx=x-b.x,dz=z-b.z;return Math.abs(c*dx-s*dz)<=b.width/2+padding+1e-7&&Math.abs(s*dx+c*dz)<=b.length/2+padding+1e-7;}
export function onBridge(world,x,z){return(world.bridges||[]).some(b=>bridgeContains(b,x,z));}
export function installCoast(world){
 for(const p of world.ponds){p.baseRx=p.rx;p.baseRz=p.rz;}
 world.bridges=(world.coastLayout?.bridges||world.ponds.map(p=>({x:p.x,z:p.z,width:Math.min(p.rx,p.rz)*2.9+4,length:2.8,angle:(p.angle||0)+(p.rx<=p.rz?0:Math.PI/2)}))).map(b=>({...b}));const boards=[],posts=[];
 for(const b of world.bridges){
  const c=Math.cos(b.angle||0),s=Math.sin(b.angle||0),at=(x,z,y)=>[b.x+c*x+s*z,y,b.z-s*x+c*z],count=Math.ceil(b.width/.4),step=b.width/count;
  for(let i=0;i<count;i++)boards.push({position:at(-b.width/2+(i+.5)*step,0,.14),angle:(b.angle||0)+Math.PI/2,scale:[b.length,1,step/.38*.94]});
  const spans=Math.ceil(b.width/5);for(const side of[-1,1])for(let i=0;i<=spans;i++)posts.push({position:at(-b.width/2+i*b.width/spans,side*(b.length/2+.08),.26),angle:b.angle||0,scale:[1,1,1]});
 }
 for(const [placements,geometry,material]of[[boards,boardGeometry,boardMaterial],[posts,postGeometry,postMaterial]]){if(!placements.length)continue;const m=new T.InstancedMesh(geometry,material,placements.length),dummy=new T.Object3D();for(let i=0;i<placements.length;i++){const p=placements[i];dummy.position.set(...p.position);dummy.rotation.y=p.angle;dummy.scale.set(...p.scale);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.castShadow=m.receiveShadow=true;world.group.add(m);}
 world.obstacles=world.obstacles.filter(o=>{const blocked=world.bridges.some(b=>bridgeContains(b,o.x,o.z,o.r+1.25));if(blocked)o.mesh.removeFromParent();return !blocked;});
 world.tide=tideState(0);return world;
}
export function updateTide(world,time){if(world.weather.kind!=='coast'&&!world.regions)return;world.tide=tideState(time);for(const p of world.ponds){if(p.baseRx===undefined)continue;const k=1+.19*world.tide.rise;p.rx=p.baseRx*k;p.rz=p.baseRz*k;p.r=Math.max(p.rx,p.rz)*1.12;p.mesh.scale.set(p.rx,1,p.rz);if(p.bank)p.bank.scale.set(p.rx*1.12,1,p.rz*1.12);}}
export function harpoonHit(origin,target,angle,range,width){const x=target.x-origin.x,z=target.z-origin.z,along=x*Math.sin(angle)+z*Math.cos(angle),across=Math.abs(x*Math.cos(angle)-z*Math.sin(angle));return along>=0&&along<=range+(target.size||0)*.4&&across<width+(target.size||0)*.45;}
export function tideDashTravel(remaining){return dodgeTravel('tide',remaining);}

export const HARPOON_ATTACKS=[{name:'探潮直刺',reach:1,arc:0},{name:'分潮横扫',reach:.82,arc:Math.PI*.28},{name:'回钩牵引',reach:1,arc:0}];

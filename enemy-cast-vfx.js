import * as T from './vendor/three.module.js';

const source=new T.Vector3();
// Draw from the animated focus; landing time and area damage stay in main.js.
export function enemyCastOrigin(e,out=new T.Vector3()){
 const d=e.mesh?.userData||{},socket=d.attackSocket||d.focus||d.cores?.at(-1);
 if(socket){socket.getWorldPosition(out);return out;}
 return out.set(e.x,(e.y||0)+Math.min(1.4,(e.height||1.75)*.8),e.z);
}
export function enemyCastFlight(vfx,e,groundAt){
 const kind=e.zone||'poison',duration=.75,gravity=7;
 const color=kind==='tide'?0x8edee0:kind==='frost'?0xb9e9f4:kind==='ember'?0xffac50:kind==='sand'?0xc9b080:0xce8ddd;
 const shape=kind==='frost'?'crystal':kind==='ember'?'flame':kind==='sand'?'stone':'smoke';
 enemyCastOrigin(e,source);
 const count=kind==='frost'?3:1,sideX=Math.cos(e.attackAngle||0),sideZ=-Math.sin(e.attackAngle||0);
 for(let i=0;i<count;i++){
  const offset=(i-(count-1)/2)*.11,x=source.x+sideX*offset,z=source.z+sideZ*offset;
  vfx.particle(shape,color,x,source.y,z,{life:duration,size:kind==='frost'?[.07,.22,.07]:kind==='ember'?[.2,.32,1]:[.22,.22,.22],velocity:[(e.tx-x)/duration,(groundAt(e.tx,e.tz)+.15-source.y)/duration+gravity*duration/2,(e.tz-z)/duration],gravity,opacity:.85,additive:!['poison','sand'].includes(kind),priority:1});
 }
 // Short discharge at the focus, not a screen-filling circle at the monster's feet.
 for(let i=0;i<3;i++)vfx.particle(shape,color,source.x,source.y,source.z,{life:.12+i*.035,size:[.045,.075,.045],velocity:[Math.sin(i*2.4)*.3,.2,Math.cos(i*2.4)*.3],opacity:.55,additive:!['poison','sand'].includes(kind)});
}

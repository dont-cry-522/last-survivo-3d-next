import {ADDITIONAL_BOSSES} from './boss-roster.js?v=205';

// Only the listed moves translate their owner; all use the existing swept
// collision callback. Warning positions are locked once, before the windup.
export const BOSS_TRAVEL={antlerrush:[.75,0],frosthunt:[.70,1.6],glacialdive:[.85,1.8],horncharge:[.9,0],sinkhole:[1.05,-2.7],keelrush:[.8,.35]};
export function additionalBossPlan(kind,move,b,target){
 const cfg=ADDITIONAL_BOSSES[kind];if(!cfg)return null;
 const angle=Math.atan2(target.x-b.x,target.z-b.z),s=Math.sin(angle),c=Math.cos(angle),wind=cfg.wind,zones=[],r=b.phase===2?1.12:1;
 const at=(forward,side=0)=>({x:b.x+s*forward+c*side,z:b.z+c*forward-s*side});
 const relative=(forward,side=0)=>({x:target.x+s*forward+c*side,z:target.z+c*forward-s*side});
 const add=(p,radius,delay,damage,type)=>zones.push({...p,r:radius*r,delay:wind+delay,damage,kind:type,visual:move,angle});
 const lane=(side,count,step,type,damage,start=2.6)=>{for(let i=0;i<count;i++)add(at(start+i*step,side),.95,i*.17,damage,type);};
 // Charge warnings follow the locked swept path, including close targets.
 const charge=(type,damage)=>{const length=Math.hypot(target.x-b.x,target.z-b.z),duration=BOSS_TRAVEL[move][0];for(let i=1;i<=5;i++){const u=i/5,f=u*u*(3-2*u);add(at(length*f),1.15,u*duration,damage,type);}};
 const ring=(center,radius,type,damage)=>{for(let i=0;i<8;i++){const a=angle+i*Math.PI/4;add({x:center.x+Math.sin(a)*radius,z:center.z+Math.cos(a)*radius},1.1,.10+(i%2)*.18,damage,type);}};
 if(move==='antlerrush')charge('root',23);
 if(move==='thornhooves')for(const x of[-2.8,2.8])for(const z of[-2.8,2.8])add(at(z,x),1.3,.25,22,'root');
 if(move==='silkweave'){lane(-2.25,4,2.2,'hex',19);lane(2.25,4,2.2,'hex',19);}
 if(move==='venomspit')for(let i=0;i<3;i++)add(relative((i-1)*1.6,(i-1)*2.8),1.25,i*.32,18,'poison');
 if(move==='frosthunt')add(target,2.2,.7,27,'frost');
 if(move==='rimehowl')for(const o of[-.85,-.42,0,.42,.85])add({x:b.x+Math.sin(angle+o)*5.5,z:b.z+Math.cos(angle+o)*5.5},1.0,.1+Math.abs(o)*.35,20,'frost');
 if(move==='featherring')ring(target,4.4,'frost',22);
 if(move==='glacialdive')charge('frost',24);
 if(move==='horncharge')charge('ember',25);
 if(move==='basaltslam')for(let i=0;i<3;i++)add(at(2.8+i*2),1.65,i*.23,26,'ember');
 if(move==='cinderbreath')for(let i=0;i<7;i++){const a=angle-.84+i*.28;add({x:b.x+Math.sin(a)*5.5,z:b.z+Math.cos(a)*5.5},1.15,i*.15,23,'ember');}
 if(move==='ashwings'){lane(-2.65,4,2.2,'ember',22);lane(2.65,4,2.2,'ember',22);}
 if(move==='sinkhole')add(target,2.6,1.05,29,'sand');
 if(move==='sandspout')for(let i=0;i<3;i++)for(const side of[-2.4,2.4])add(relative((i-1)*2.5,side),1.1,i*.28,22,'sand');
 if(move==='stonepress')for(const side of[-2.7,2.7])for(let i=0;i<3;i++)add(relative((i-1)*2.5,side),1.2,i*.21,24,'sand');
 if(move==='glyphcross')for(const side of[-1,1])for(const dist of[3.3,5.6]){add(relative(dist*side,0),1.1,.25,23,'sand');add(relative(0,dist*side),1.1,.25,23,'sand');}
 if(move==='razortide')for(let i=0;i<4;i++){add(at(3+i*1.8,-3+i*.55),1.0,i*.18,22,'tide');add(at(3+i*1.8,3-i*.55),1.0,.38+i*.18,22,'tide');}
 if(move==='keelrush')charge('tide',24);
 if(move==='abysspulse')ring(b,4.4,'tide',23);
 if(move==='lurelights')for(let i=0;i<3;i++)add(relative((i-1)*2.4,Math.sin(i*2.4)*2.8),1.4,i*.4,24,'tide');
 if(!zones.length)throw new Error('Unknown boss move: '+kind+'/'+move);
 return{angle,zones,duration:Math.max(...zones.map(z=>z.delay))-wind+.35};
}

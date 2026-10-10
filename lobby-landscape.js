import{waterDepth}from'./water.js?v=140';

// Menu-only composition of the existing world. Never moves its spawn, rewards or colliders.
export function lobbyLandscape(world,id){
 const distance=p=>Math.hypot(p.x-world.spawn.x,p.z-world.spawn.z);
 const nearest=list=>[...list].sort((a,b)=>distance(a)-distance(b));
 const gate=world.forestVista?.gateCenter;
 let landmarks=[];
 if(gate)landmarks.push({...gate,kind:'ruin'});
 if(id==='sand'||id==='coast')landmarks.push(...nearest(world.districts||[]).sort((a,b)=>Number(b.kind===(id==='sand'?'gate':'beacon'))-Number(a.kind===(id==='sand'?'gate':'beacon'))).map(p=>({...p,kind:'landmark'})));
 landmarks.push(...nearest((world.ponds||[]).filter(p=>!world.regions||p.biome==='forest')).slice(0,2).map(p=>({...p,kind:'shore'})));
 if(id==='ash')landmarks.unshift(...nearest(world.patches.filter(p=>p.kind==='vent')).slice(0,2).map(p=>({...p,kind:'ember'})));
 const safe=(x,z,clearance)=>Math.abs(x)<world.half-6&&Math.abs(z)<world.half-6&&world.obstacles.every(o=>Math.hypot(o.x-x,o.z-z)>o.r+clearance)&&world.ponds.every(p=>waterDepth(p,x,z)===0)&&world.patches.every(p=>p.kind!=='vent'||Math.hypot(p.x-x,p.z-z)>p.r+clearance);
 for(const target of landmarks){
  for(const extra of[0,2,4])for(let i=0;i<16;i++){
   const angle=(id==='sand'?(target.angle||0):.66)+i*Math.PI/8,ux=Math.sin(angle),uz=Math.cos(angle);
   let radius=9+extra;
   if(target.kind==='shore'){
    const c=Math.cos(target.angle||0),s=Math.sin(target.angle||0),u=(c*ux-s*uz)/target.rx,v=(s*ux+c*uz)/target.rz;
    radius=1.16/Math.hypot(u,v)+2+extra;
   }
   const x=target.x+ux*radius,z=target.z+uz*radius;
   // Reserve a clear foreground for the full figure, pet and the camera approach.
   if(!safe(x,z,target.kind==='ember'?3.8:1.6)||![2,4,6].every(d=>safe(x+Math.sin(angle+.24)*d,z+Math.cos(angle+.24)*d,1.2)))continue;
   // Put the landmark to the side of the hero instead of directly behind their head.
   return{x,z,yaw:angle+.24,focus:{x:target.x,z:target.z,kind:target.kind}};
  }
 }
 return{...world.spawn,yaw:.66,focus:null};
}

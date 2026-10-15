// Called only for a real shot. Releasing aim, dodging or pausing must not reset
// this chamber position or queue the rest of a burst. A new player starts at 0.
export function shotInterval(player,w){
 if(w.id!=='rifle'||w.pathId!=='rifle_rapid'||!w.pathRank)return 1/w.rate;
 player.rifleBurst=((player.rifleBurst||0)+1)%3;
 return (player.rifleBurst===0?2:.5)/w.rate;
}

export const SHOTGUN_PUSH={range:3.5,pellets:3,distance:1.1,stagger:.18};
export function shotgunVolley(w,origin){
 return w.id==='shotgun'&&w.count>=SHOTGUN_PUSH.pellets&&w.pathId!=='shotgun_slug'?{x:origin.x,y:origin.y,z:origin.z,hits:new Map()}:null;
}
// The shared volley survives across frames. Keep its count after triggering so
// later pellets cannot push again. Resolve returned pushes after all collisions.
export function shotgunHit(volley,target,contact){
 if(!volley||!target.alive||target.boss||Math.hypot(contact.x-volley.x,contact.y-volley.y,contact.z-volley.z)>SHOTGUN_PUSH.range)return null;
 const hits=(volley.hits.get(target)||0)+1;volley.hits.set(target,hits);
 if(hits!==SHOTGUN_PUSH.pellets)return null;
 const dx=target.x-volley.x,dz=target.z-volley.z,distance=Math.hypot(dx,dz);
 if(distance<1e-6)return null;
 return{target,dx:dx/distance*SHOTGUN_PUSH.distance,dz:dz/distance*SHOTGUN_PUSH.distance};
}

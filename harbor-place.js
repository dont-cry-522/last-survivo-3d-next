import * as T from './vendor/three.module.js';

// Local, deterministic shipyard scenery. The centre lane stays empty; the kit
// owns batching, material finishes and the matching world-space solid records.
export function buildHarborPlace(kit){
 const timber=0x817b65,dark=0x4b5752,cut=0xa59b7d,rope=0x96937b,iron=0x4d6260;
 const add=(geometry,color,transform={},category='wood')=>kit.piece(category,geometry,color,transform);
 const plank=(color,x,y,z,w,h,d,ry=0,rz=0,overhead=false)=>add(new T.BoxGeometry(w,h,d),color,{x,y,z,ry,rz,overhead});
 const bar=(color,a,b,r=.06,category='wood',overhead=false)=>{
  const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from),g=new T.CylinderGeometry(r*.83,r,delta.length(),6);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
  const mid=from.add(to).multiplyScalar(.5);add(g,color,{x:mid.x,y:mid.y,z:mid.z,overhead},category);
 };
 const curve=(points,color,r=.045,category='wood',overhead=false)=>{
  for(let i=1;i<points.length;i++)bar(color,points[i-1],points[i],r,category,overhead);
 };
 const cx=-6.30,cz=-.35,half=6.65;
 const hull=(t,u,side)=>{
  const beam=.12+2.06*Math.max(0,1-t*t)**.58,keel=.08+t*t*.28,height=1.77+t*t*.84;
  return[cx+side*beam*u,keel+height*(Math.max(0,u-.43)/.57)**1.6,cz+t*half];
 };
 // Long curved strakes carry the whole silhouette. Closed, thin bands expose
 // the inner wood through the broken deck without depending on double-sided materials.
 for(const side of[-1,1])for(let row=0;row<5;row++){
  const p=[],indices=[],steps=24,low=row/5+.008,high=(row+1)/5-.008;
  for(let j=0;j<=steps;j++){
   const t=-1+2*j/steps;
   for(const lift of[-.038,.038])for(const u of[low,high]){
    const v=hull(t,u,side);v[1]+=lift;
    // A missing upper plank opens the port quarter instead of a uniform rim.
    if(side===1&&row===4&&j>10&&j<15)v[1]-=.38;
    p.push(...v);
   }
   if(j<steps){const n=j*4;for(const[a,b,c,d]of[[0,4,1,5],[2,3,6,7],[0,2,4,6],[1,5,3,7]])indices.push(n+a,n+b,n+c,n+c,n+b,n+d);}
  }
  indices.push(0,1,2,2,1,3);const end=steps*4;indices.push(end,end+2,end+1,end+1,end+2,end+3);
  if(side===1)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();add(g,row%2?timber:dark);
 }
 // Two side chains follow the taper; the flat middle remains open rather than
 // assigning a single solid to the boat's entire empty interior.
 for(let i=0;i<=11;i++){
  const t=-1+2*i/11,beam=.12+2.06*Math.max(0,1-t*t)**.58;
  for(const side of[-1,1])kit.solid(cx+side*beam*.78,cz+t*half,.95,3.25);
 }
 for(let rib=0;rib<9;rib++){
  const t=-.84+rib*.205;
  for(const side of[-1,1])curve([0,.25,.45,.60,.8,1].map(u=>{const p=hull(t,u,side);p[1]+=.09;return p;}),cut,.075);
 }
 for(const side of[-1,1])curve(Array.from({length:21},(_,i)=>hull(-1+i/10,1,side)),cut,.07);
 // Partial decking at either end leaves ribs visible amidships. Jagged lengths
 // stop well inside the hull rather than turning the wreck into a high platform.
 for(const end of[-1,1])for(let i=0;i<6;i++){
  const t=end*(.51+i*.055),width=(hull(t,.80,1)[0]-cx)*2;
  plank(i%2?0x969076:timber,cx-.09*Math.sin(i*1.7),1.04+i*.075,cz+t*half,width,.085,.28,.018*Math.sin(i));
 }
 for(const z of[-4.35,3.65])kit.solid(cx,z,1.35,1.62);
 bar(dark,[cx,.14,cz-half+.2],[cx,.13,cz+half-.2],.115);
 // One snapped, leaning mast and a fallen yard stay over the blocked hull.
 curve([[cx-.3,.25,-.6],[cx-.28,1.6,-.5],[cx-.83,2.65,-.2]],dark,.14);
 bar(timber,[cx-.84,2.63,-.2],[cx+.76,1.52,3.35],.105);
 bar(cut,[cx-1.37,1.81,1.17],[cx+1.35,1.92,1.90],.067);
 curve([[cx-.84,2.63,-.2],[cx-.68,1.22,1.57],[cx+.80,.82,3.9]],rope,.024,'cloth');
 kit.solid(cx-.42,-.45,.64,2.88);
 for(const [dx,z]of[[-.52,.53],[-.02,1.64],[.51,2.80],[.75,3.66]])kit.solid(cx+dx,z,.73,2.76);
 // Low boards are visual ground cover, not a raised walkable platform.
 for(let i=0;i<31;i++){
  const z=-7.1+i*.44,width=4.5+.18*Math.sin(i*.9),x=6.10+.025*Math.sin(i*2.1);
  plank(i%3?0x827e68:0x666d5b,x,.020,z,width,.105,.40,.009*Math.sin(i));
 }
 // Broad open-front net shed. Every roof beam clears 3.2m and is submitted as
 // overhead geometry; only post feet and the back wall obstruct ground travel.
 for(const x of[4.30,7.90])for(const z of[.05,5.85]){
  bar(dark,[x,-.03,z],[x,3.65,z],.12);kit.solid(x,z,.16,3.8);
  bar(timber,[x,2.9,z],[x+(x<6?.56:-.56),3.53,z],.06);
  // The small diagonal braces stay inside their registered post footprints
  // only below the head plane; the upper span joins the roof query.
 }
 // Register the brace wedges conservatively alongside each post, away from the lane.
 for(const x of[4.30,7.90])for(const z of[.05,5.85])kit.solidBox(x+(x<6?.25:-.25),z,.68,.18,3.8);
 for(const side of[-1,1]){
  const x=6.10+side*1.20;
  for(let row=0;row<13;row++){
   const z=-.52+row*.56,dy=.065*Math.sin(row*.8);
   plank(row%3?0x597777:0x6d8581,x,3.88+dy,z,2.48,.12,.59,0,-side*.27,true);
  }
 }
 for(const z of[-.50,6.23])bar(timber,[3.75,3.38,z],[8.45,3.38,z],.10,'wood',true);
 bar(dark,[6.10,4.28,-.6],[6.10,4.28,6.4],.10,'wood',true);
 for(let i=0;i<10;i++)plank(i%2?timber:dark,4.20+i*.425,1.02,6.0,.37,1.87,.11,0,.025*Math.sin(i));
 kit.solidBox(6.11,5.9,4.30,.62,2.30);
 // Sagging fishing net against the back wall: visible knots and open diamonds,
 // not a solid translucent sheet that competes with targets.
 for(let i=0;i<11;i++)curve([[4.40+i*.30,2.23,5.86],[4.37+i*.30,1.37,5.75],[4.40+i*.30,.56,5.81]],rope,.014,'cloth');
 for(let i=0;i<7;i++)curve([[4.40,.60+i*.26,5.81],[5.88,.52+i*.26,5.70],[7.40,.60+i*.26,5.81]],rope,.014,'cloth');
 const crate=(x,z,w=.98)=>{
  plank(dark,x,.50,z,w,.94,w*.84);
  for(const y of[.20,.78])for(const side of[-1,1])plank(cut,x,y,z+side*w*.43,w*1.04,.075,.06);
  for(const side of[-1,1])plank(timber,x+side*w*.38,.52,z,.10,1.01,w*.87);
  kit.solid(x,z,Math.hypot(w*.54,w*.46),1.06);
 };
 crate(4.92,-5.50,1.15);crate(6.50,-5.75,.90);crate(7.51,4.79,1.05);
 for(const [x,z]of[[7.82,-4.38],[4.8,4.65]]){
  add(new T.CylinderGeometry(.37,.32,.84,12),timber,{x,y:.46,z});
  for(const y of[.18,.74])add(new T.TorusGeometry(.365,.034,5,12),iron,{x,y,z,rx:Math.PI/2},'metal');
  kit.solid(x,z,.42,.92);
 }
 // Coiled lines lie below the step-free floor-detail limit.
 for(const [x,z]of[[7.47,-6.46],[4.91,-3.16]])for(let i=0;i<3;i++)add(new T.TorusGeometry(.22+i*.068,.023,4,18),rope,{x,y:.079,z,rx:Math.PI/2},'cloth');
 // A bundled net has its own low collider; it is not an invisible trip hazard.
 add(new T.SphereGeometry(.5,12,7),0x5f746a,{x:7.52,y:.25,z:-2.48,sx:1.5,sy:.47,sz:1.15},'cloth');
 for(let i=0;i<5;i++)bar(rope,[6.93+i*.29,.14,-2.92],[6.98+i*.25,.48,-2.13],.018,'cloth');
 kit.solid(7.52,-2.48,.79,.55);
 return{kind:'wreck-wharf',name:'搁浅船坞',focus:{x:cx,y:1.5,z:-.3}};
}

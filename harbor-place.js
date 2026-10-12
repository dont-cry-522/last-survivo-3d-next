import * as T from './vendor/three.module.js';

// Local, deterministic shipyard scenery. The centre lane stays empty; the kit
// owns batching, material finishes and the matching world-space solid records.
export function buildHarborPlace(kit,variant=0){
 const loading=variant===1;
 const timber=0x817b65,dark=0x4b5752,cut=0xa59b7d,rope=0x96937b,iron=0x4d6260;
 const add=(geometry,color,transform={},category='wood')=>kit.piece(category,geometry,color,transform);
 const plank=(color,x,y,z,w,h,d,ry=0,rz=0,overhead=false)=>add(new T.BoxGeometry(w,h,d),color,{x,y,z,ry,rz,overhead});
 const bar=(color,a,b,r=.06,category='wood',overhead=false,flex=null)=>{
  const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from),g=new T.CylinderGeometry(r*.83,r,delta.length(),6);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
  const mid=from.add(to).multiplyScalar(.5);
  if(flex){const p=g.attributes.position;g.name='SM_Harbor_DryingNet_A';g.setAttribute('harborFlex',new T.Float32BufferAttribute(Array.from({length:p.count},(_,i)=>flex(p.getX(i)+mid.x,p.getY(i)+mid.y,p.getZ(i)+mid.z)),1));}
  add(g,color,{x:mid.x,y:mid.y,z:mid.z,overhead},category);
 };
 const curve=(points,color,r=.045,category='wood',overhead=false,flex=null)=>{
  for(let i=1;i<points.length;i++)bar(color,points[i-1],points[i],r,category,overhead,flex);
 };
 const canvas=(name,color,point,flex)=>{
  const positions=[],indices=[],weights=[],cols=12,rows=5;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   positions.push(...point(i/cols,j/rows));weights.push(flex(i/cols,j/rows));
   if(i<cols&&j<rows){const n=j*(cols+1)+i;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
  }
  const g=new T.BufferGeometry();g.name=name;g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('harborFlex',new T.Float32BufferAttribute(weights,1));g.setIndex(indices);g.computeVertexNormals();add(g,color,{},'cloth');
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
    if(!loading&&side===1&&row===4&&j>10&&j<15)v[1]-=.38;
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
 // The bow's existing solid deck also carries the repair hoist; its ground
 // footprint is unchanged while the mast now has its real collision height.
 for(const z of[-4.35,3.65])kit.solid(cx,z,1.35,z<0?5.15:1.62);
 bar(dark,[cx,.14,cz-half+.2],[cx,.13,cz+half-.2],.115);
 // One snapped, leaning mast and a fallen yard stay over the blocked hull.
 curve([[cx-.3,.25,-.6],[cx-.28,1.6,-.5],[cx-.83,2.65,-.2]],dark,.14);
 bar(timber,[cx-.84,2.63,-.2],[cx+.76,1.52,3.35],.105);
 bar(cut,[cx-1.37,1.81,1.17],[cx+1.35,1.92,1.90],.067);
 curve([[cx-.84,2.63,-.2],[cx-.68,1.22,1.57],[cx+.80,.82,3.9]],rope,.024,'cloth');
 kit.solid(cx-.42,-.45,.64,2.88);
 for(const [dx,z]of[[-.52,.53],[-.02,1.64],[.51,2.80],[.75,3.66]])kit.solid(cx+dx,z,.73,2.76);
 // Timber shear-legs, a hand-cranked drum and an angled boom read as a repair
 // hoist rather than another row of posts. Both feet stay on the solid bow deck.
 for(const side of[-1,1])bar(timber,[cx+side*.90,1.16,-4.35-side*.38],[cx,4.80,-4.35],.145);
 bar(cut,[cx-.74,1.72,-4.04],[cx+.74,1.72,-4.66],.095);
 bar(dark,[cx-.25,4.84,-4.50],[-4.48,4.96,-2.93],.15,'wood',true);
 bar(timber,[cx,3.58,-4.35],[-4.62,4.77,-3.01],.095,'wood',true);
 const drum=new T.CylinderGeometry(.25,.25,1.16,12);drum.name='SM_Harbor_WinchDrum_A';add(drum,cut,{x:cx,y:1.53,z:-4.35,rz:Math.PI/2});
 for(let i=0;i<12;i++)add(new T.TorusGeometry(.263,.022,4,12),rope,{x:cx-.39+i*.071,y:1.53,z:-4.35,ry:Math.PI/2},'cloth');
 for(const side of[-1,1])add(new T.CylinderGeometry(.33,.33,.10,12),iron,{x:cx+side*.64,y:1.53,z:-4.35,rz:Math.PI/2},'metal');
 curve([[cx-.73,1.53,-4.35],[cx-.76,1.53,-4.84],[cx-.76,1.85,-4.84]],iron,.045,'metal');
 bar(rope,[cx,1.77,-4.35],[cx,4.61,-4.35],.025,'cloth');
 const wheel=new T.CylinderGeometry(.24,.24,.13,12);wheel.name='SM_Harbor_HoistSheave_A';add(wheel,cut,{x:-4.62,y:4.64,z:-3.04,rz:Math.PI/2,overhead:true});
 for(const x of[-4.72,-4.52])bar(rope,[x,4.62,-3.04],[x,3.26,-3.04],.023,'cloth',true);
 for(const x of[-4.72,-4.52])bar(rope,[x,3.26,-3.04],[-4.62,2.30,-3.04],.023,'cloth');
 const sling=new T.SphereGeometry(.5,12,8);sling.name='SM_Harbor_SuspendedSling_A';add(sling,0x7c897d,{x:-4.62,y:1.84,z:-3.04,sx:1.06,sy:.93,sz:.84},'cloth');
 for(const side of[-1,1])curve([[-4.62+side*.48,1.75,-3.04],[-4.62+side*.36,2.11,-3.04],[-4.62,2.33,-3.04]],rope,.034,'cloth');
 kit.solid(-4.62,-3.04,.61,3.30);
 // A folded sail and fitted repair planks break the broad empty bow deck.
 canvas('SM_Harbor_RepairSail_A',0x7b8b85,(u,v)=>[cx+(u-.5)*1.62,1.43+.20*Math.sin(u*Math.PI)+.07*Math.sin(u*19+v),-5.03+v*1.20],(u,v)=>Math.sin(u*Math.PI)**2*Math.sin(v*Math.PI)**2*.65);
 for(let i=0;i<4;i++)plank(i%2?cut:timber,cx-.54+i*.24,1.47,-4.62,.15,.065,1.44,.025*(i-1));
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
 kit.solidBox(6.11,5.9,4.30,.62,3.20);
 // Sagging fishing net against the back wall: visible knots and open diamonds,
 // not a solid translucent sheet that competes with targets.
 const netFlex=(x,y)=>(1-T.MathUtils.smoothstep(y,.80,2.19))*T.MathUtils.smoothstep(x,4.44,4.95)*(1-T.MathUtils.smoothstep(x,6.94,7.36))*.55;
 // In the loading berth the lower net has been lifted to clear sorted cargo.
 // Its original pinned top and wall footprint remain fixed.
 const netY=y=>loading?2.23-(2.23-y)*.76:y;
 for(let i=0;i<11;i++)curve([[4.40+i*.30,2.23,5.86],[4.37+i*.30,netY(1.37),5.75],[4.40+i*.30,netY(.56),5.81]],rope,.014,'cloth',false,netFlex);
 for(let i=0;i<7;i++)curve([[4.40,netY(.60+i*.26),5.81],[5.88,netY(.52+i*.26),5.70],[7.40,netY(.60+i*.26),5.81]],rope,.014,'cloth',false,netFlex);
 // Gathered sailcloth hangs above the drying net. Its uneven folds have depth
 // and an open lower edge rather than filling the shed with an opaque wall.
 canvas('SM_Harbor_GatheredSail_A',0x88968e,(u,v)=>[4.66+u*2.65,3.10-v*(loading?.40+.15*Math.sin(u*Math.PI):.54+.22*Math.sin(u*Math.PI))+.018*Math.sin(u*28),5.79-.066*Math.sin(u*31)*(v*.45+.55)],(u,v)=>Math.sin(u*Math.PI)**2*v*v);
 for(const x of[4.71,7.24])bar(rope,[x,3.15,5.81],[x,2.42,5.77],.024,'cloth');
 const roll=new T.CylinderGeometry(.135,.135,2.52,14,4);roll.name='SM_Harbor_FurledSail_A';
 const rollPoints=roll.attributes.position;for(let i=0;i<rollPoints.count;i++){const y=rollPoints.getY(i),r=1+.08*Math.sin(y*12);rollPoints.setX(i,rollPoints.getX(i)*r);rollPoints.setZ(i,rollPoints.getZ(i)*r);}roll.computeVertexNormals();
 add(roll,0xadb09a,{x:6.1,y:3.54,z:-.23,rz:Math.PI/2,overhead:true},'cloth');
 for(const x of[5.15,6.97])add(new T.TorusGeometry(.148,.022,4,12),rope,{x,y:3.54,z:-.23,ry:Math.PI/2,overhead:true},'cloth');
 const crate=(x,z,w=.98,tall=false)=>{
  // Separate side planks expose recessed seams instead of one painted box.
  for(let i=0;i<5;i++){
   const y=.14+i*.18;
   for(const side of[-1,1]){
    plank(i%2?dark:timber,x,y,z+side*w*.39,w,.165,.075);
    plank(i%2?timber:dark,x+side*(w*.5-.039),y,z,.075,.165,w*.72);
   }
   plank(i%2?cut:timber,x+(i-2)*w*.194,.982,z,w*.182,.055,w*.84);
  }
  for(const y of[.20,.78])for(const side of[-1,1])plank(cut,x,y,z+side*w*.43,w*1.04,.075,.06);
  for(const side of[-1,1])plank(timber,x+side*w*.38,.52,z,.10,1.01,w*.87);
  kit.solid(x,z,Math.hypot(w*.54,w*.46),tall?2.17:1.06);
  if(tall)for(let layer=0;layer<2;layer++){
   const y=1.29+layer*.48,size=w*(layer?.72:.91),g=new T.SphereGeometry(.5,10,7);g.name='SM_Harbor_TiedCargo_'+layer;
   add(g,layer?0x9a8d70:0x71867d,{x:x-layer*.06,y,z,sx:size,sy:.57,sz:w*.65},'cloth');
   for(const side of[-1,1])curve([[x+side*size*.44,y-.12,z],[x+side*size*.38,y+.20,z],[x,y+.29,z]],rope,.021,'cloth');
  }
 };
 const cargo=loading?[[5.08,-2.0,1.15,false],[7.37,-5.75,.90,true],[5.00,4.79,1.05,true]]:[[4.92,-5.50,1.15,true],[6.50,-5.75,.90,false],[7.51,4.79,1.05,true]];
 for(const [x,z,w,tall]of cargo)crate(x,z,w,tall);
 for(const [x,z]of loading?[[7.82,-4.38],[6.10,4.65]]:[[7.82,-4.38],[4.8,4.65]]){
  for(let level=0;level<(x>7?2:1);level++){
   const base=level*.90,body=new T.CylinderGeometry(.37,.37,.84,24,6),bp=body.attributes.position,bc=[];
   body.name='SM_Harbor_BarrelStaves_A';
   for(let i=0;i<bp.count;i++){
    const y=bp.getY(i),t=y/.84+.5,a=Math.atan2(bp.getZ(i),bp.getX(i)),bulge=.86+.14*Math.sin(Math.PI*t);
    bp.setX(i,bp.getX(i)*bulge);bp.setZ(i,bp.getZ(i)*bulge);
    const shade=.88+.12*(.5+.5*Math.sin(Math.floor((a+Math.PI)*12/Math.PI)*2.399));bc.push(shade,shade,shade);
   }
   body.setAttribute('color',new T.Float32BufferAttribute(bc,3));body.computeVertexNormals();add(body,timber,{x,y:base+.46,z});
   for(const y of[base+.18,base+.74])add(new T.TorusGeometry(.365,.034,5,12),iron,{x,y,z,rx:Math.PI/2},'metal');
   for(let i=0;i<5;i++)plank(i%2?dark:cut,x+(i-2)*.113,base+.884,z,.103,.022,Math.sqrt(Math.max(0,.31**2-((i-2)*.113)**2))*2);
  }
  kit.solid(x,z,.42,x>7?1.86:.92);
 }
 // The loading berth moves this whole station to the pier-facing edge. Its
 // tools, leaning oars and collider travel together; the shed opens for cargo.
 const benchZ=loading?-3.92:0;
 plank(cut,7.72,1.01,1.82+benchZ,1.06,.12,2.72);
 for(const z of[.72,2.92])for(const x of[7.35,8.09])plank(dark,x,.50,z+benchZ,.10,1,.13);
 bar(timber,[7.35,.27,.72+benchZ],[8.09,.85,2.92+benchZ],.065);
 for(const z of[.86,1.67,2.48]){
  bar(timber,[7.92,.12,z+benchZ],[8.06,2.64,z+.20+benchZ],.035);
  plank(cut,8.05,2.38,z+.18+benchZ,.24,.69,.042,0,-.055);
 }
 kit.solidBox(7.72,1.86+benchZ,1.14,2.90,2.86);
 plank(iron,7.63,1.10,1.24+benchZ,.40,.035,.24,.14);
 bar(timber,[7.53,1.12,1.53+benchZ],[7.92,1.15,1.89+benchZ],.037);
 bar(iron,[7.51,1.14,1.44+benchZ],[7.59,1.14,1.65+benchZ],.043,'metal');
 // Coiled lines lie below the step-free floor-detail limit.
 for(const [x,z]of[[7.47,-6.46],[4.91,-3.16]])for(let i=0;i<3;i++)add(new T.TorusGeometry(.22+i*.068,.023,4,18),rope,{x,y:.079,z,rx:Math.PI/2},'cloth');
 // A bundled net has its own low collider; it is not an invisible trip hazard.
 const netZ=loading?5.28:0;
 add(new T.SphereGeometry(.5,12,7),0x5f746a,{x:7.52,y:.25,z:-2.48+netZ,sx:1.5,sy:.47,sz:1.15},'cloth');
 for(let i=0;i<5;i++)bar(rope,[6.93+i*.29,.14,-2.92+netZ],[6.98+i*.25,.48,-2.13+netZ],.018,'cloth');
 kit.solid(7.52,-2.48+netZ,.79,.55);
 return loading?{kind:'loading-wharf',name:'整备装卸埠',focus:{x:6.1,y:1.5,z:-1.3}}:{kind:'wreck-wharf',name:'搁浅船坞',focus:{x:cx,y:1.5,z:-.3}};
}

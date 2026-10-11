import * as T from './vendor/three.module.js';
import{wornStoneBlock}from'./environment-props.js?v=157';
import{naturalRockGeometry}from'./biome-scenery.js?v=156';

// Continuous broken masonry, rather than a row of identical stacked blocks.
// The kit owns each new geometry; the two repository source shapes stay shared.
function wallGeometry(profile,depth){
 const positions=[],colors=[],indices=[];
 const quad=(a,b,c,d)=>{const first=positions.length/3;for(const p of[a,b,c,d]){positions.push(...p);const shade=.82+Math.min(1,Math.max(0,p[1])/2.5)*.16;colors.push(shade*1.02,shade,shade*.97);}indices.push(first,first+1,first+2,first,first+2,first+3);};
 const points=profile.map(([x,h])=>{const wear=.035*Math.sin(x*2.9);return{bf:[x,-.10,depth*.5],bb:[x,-.10,-depth*.5],tf:[x,h,depth*.46+wear],tb:[x,h,-depth*.46+wear]};});
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];quad(a.bf,b.bf,b.tf,a.tf);quad(b.bb,a.bb,a.tb,b.tb);quad(a.tf,b.tf,b.tb,a.tb);quad(a.bb,b.bb,b.bf,a.bf);}
 const a=points[0],b=points.at(-1);quad(a.bb,a.bf,a.tf,a.tb);quad(b.bf,b.bb,b.tb,b.tf);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function vaultGeometry(inner,thickness,depth,start=0,end=Math.PI){
 const points=[],steps=18;for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps,r=inner+thickness+.026*Math.sin(a*9);points.push(new T.Vector2(Math.cos(a)*r,Math.sin(a)*r));}
 for(let i=steps;i>=0;i--){const a=start+(end-start)*i/steps;points.push(new T.Vector2(Math.cos(a)*inner,Math.sin(a)*inner));}
 const geometry=new T.ExtrudeGeometry(new T.Shape(points),{depth,steps:1,bevelEnabled:false});geometry.translate(0,0,-depth*.5);geometry.clearGroups();return geometry;
}
function flowGeometry(points,width){
 const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,.026,z))),positions=[],indices=[];
 for(let i=0;i<=28;i++){const t=i/28,p=curve.getPoint(t),d=curve.getTangent(t),r=width*(.62+.28*Math.sin(t*13+1)**2);positions.push(p.x-d.z*r,p.y,p.z+d.x*r,p.x+d.z*r,p.y,p.z-d.x*r);if(i){const a=(i-1)*2;indices.push(a,a+3,a+1,a,a+2,a+3);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function buildRuinPlace(biome,kit){
 if(biome!=='ash'&&biome!=='sand')return null;
 const piece=(category,geometry,color,transform)=>kit.piece(category,geometry,color,transform);
 const box=(category,color,x,y,z,sx,sy,sz,ry=0,rz=0)=>piece(category,wornStoneBlock.clone(),color,{x,y,z,sx,sy,sz,ry,rz});
 const wall=(profile,depth,color,x,z,angle=0)=>{piece('stone',wallGeometry(profile,depth),color,{x,z,ry:angle});kit.solidBox(x,z,profile.at(-1)[0]-profile[0][0],depth,Math.max(...profile.map(p=>p[1])),angle);};
 const rock=(color,x,y,z,sx,sy,sz,angle=0)=>{piece('stone',naturalRockGeometry.clone(),color,{x,y,z,sx,sy,sz,ry:angle});if(y+sy>.3)kit.solid(x,z,Math.max(sx,sz)*1.2,y+sy*1.1);};
 const floor=(color,x,z,sx,sz,angle=0)=>piece('ground',naturalRockGeometry.clone(),color,{x,y:.012,z,sx,sy:.08,sz,ry:angle});
 if(biome==='ash'){
  // A broad barrel kiln lies across the left side. Its mouth opens onto the
  // six-metre street; walls and roof have separate physical representations.
  wall([[-2.30,.87],[-1.3,.90],[0,.82],[1.3,.88],[2.3,.82]],.44,0x5d5147,-5.98,-3.50);
  wall([[-2.30,.83],[-1.1,.89],[.4,.85],[2.3,.80]],.44,0x544b43,-5.98,-.50);
  wall([[-1.65,1.0],[-1.45,2.0],[-.6,2.45],[.55,2.30],[1.65,1.0]],.38,0x49433e,-8.10,-2,Math.PI/2);
  piece('stone',vaultGeometry(1.29,.33,2.2,.02,Math.PI-.025),0x5a5148,{x:-6.99,y:.85,z:-2,ry:Math.PI/2,overhead:true});
  // The missing crown opens a real hole in the front half of the roof.
  for(const[start,end,color]of[[.04,1.13,0x6a594a],[1.49,Math.PI-.035,0x504b45]])piece('stone',vaultGeometry(1.29,.31,2.18,start,end),color,{x:-4.86,y:.85,z:-2,ry:Math.PI/2,overhead:true});
  piece('stone',vaultGeometry(1.25,.44,.24,.015,Math.PI-.02),0x887059,{x:-3.76,y:.85,z:-2,ry:Math.PI/2,overhead:true});
  for(const z of[-3.5,-.5]){box('stone',0x8a7057,-3.77,.40,z,.44,.88,.48);kit.solidBox(-3.77,z,.44,.48,.88);}
  box('stone',0x373937,-7.88,.10,-2,.08,.17,2.27);
  // Firebrick joints and soot on the kiln's visible lower lip remain subdued.
  for(let i=0;i<7;i++)piece('stone',wornStoneBlock.clone(),i%2?0x78634d:0x66543f,{x:-3.61,y:.94+i*.105,z:-3.49+i*.047,sx:.025,sy:.045,sz:.15,rz:-.15,overhead:true});
  // Long low ruins establish a yard, broken in two rather than standing posts.
  wall([[-2.1,.55],[-1.8,1.38],[-1,1.53],[-.32,1.37],[.1,.83],[.85,.92],[1.58,.67],[2.1,.30]],.72,0x484743,7.69,-3.65,Math.PI/2);
  wall([[-2.0,.30],[-1.6,.90],[-.70,1.04],[.12,1.42],[.87,1.22],[1.65,.76],[2,.36]],.77,0x565047,7.52,2.60,Math.PI/2);
  wall([[-1.56,.48],[-.8,.77],[.10,.81],[.8,.39],[1.56,.24]],.62,0x4d4943,6.17,5.77);
  // Cold slag occupies a shallow trough. It is scenery, not a vent or hazard.
  for(const z of[1.85,3.21]){box('stone',0x675648,5.38,.16,z,3.04,.33,.28);kit.solidBox(5.38,z,3.04,.28,.33);}
  box('metal',0x343e3c,5.38,.034,2.53,2.91,.06,1.10);
  for(let i=0;i<4;i++)box('metal',0x70624e,4.17+i*.75,.055,2.53,.07,.07,1.17);
  // Old rail ends point toward the furnace, rather than forming a map-wide grid.
  for(const x of[-6.19,-4.63])box('metal',0x514b43,x,.065,-5.70,.105,.095,3.13);
  for(let i=0;i<6;i++)box('stone',i%2?0x574c42:0x686052,-5.41,.032,-7.08+i*.54,1.99,.065,.19,Math.sin(i)*.018);
  piece('ground',flowGeometry([[4.12,3.42],[4.24,4.27],[5.09,4.80],[5.14,5.81],[6.42,6.75]],.37),0x393d3b,{});
  piece('ground',flowGeometry([[4.48,3.52],[4.66,4.21],[5.59,4.72],[5.50,5.9],[6.5,6.67]],.065),0x646253,{});
  for(const[x,z,sx,sz]of[[-5.75,-1.72,2.23,1.58],[-5.55,-5.40,2.20,1.67],[5.3,2.8,2.1,1.62],[6.64,-2.5,1.1,2.17]])floor(0x47463f,x,z,sx,sz,.17);
  for(const[x,z,sx,sy,sz]of[[-7.22,4.98,1.03,.50,.85],[-5.48,5.62,.88,.28,.74],[6.21,-5.83,.85,.42,.80],[4.11,-4.72,.55,.19,.62]])rock(0x56514b,x,sy*.63,z,sx,sy,sz,x*.3);
  for(let i=0;i<13;i++){const side=i%2?-1:1,x=side*(4.0+(i*1.37)%3.6),z=-6.7+(i*2.17)%12.7;rock(i%3?0x5f5448:0x76634f,x,.04,z,.16+(i%3)*.045,.10,.16+(i%2)*.07,i*.78);}
  return{kind:'collapsed-kiln-yard',name:'熄火炉窑',focus:{x:-5.6,y:1.2,z:-2}};
 }
 // Half-buried courtyard: connected wall silhouettes, open corners and an
 // already fallen lintel tell a different story from the working kiln yard.
 wall([[-2.3,.51],[-1.88,2.15],[-.98,2.47],[-.35,2.34],[.21,1.61],[.94,1.55],[1.42,1.1],[2.3,.38]],.63,0xaa9575,-7.57,-3.65,Math.PI/2);
 wall([[-2.4,.42],[-1.72,1.42],[-.77,1.74],[.25,1.67],[1.18,1.13],[2.4,.47]],.63,0xb19c7c,-7.57,2.40,Math.PI/2);
 wall([[-1.72,.40],[-1.10,1.53],[-.15,1.67],[.57,1.25],[1.18,.61],[1.72,.32]],.67,0xb5a081,-6.20,5.0);
 wall([[-1.86,.29],[-1.4,1.1],[-.41,1.64],[.48,1.54],[1.16,.70],[1.86,.40]],.65,0xad9675,7.59,-4.28,Math.PI/2);
 wall([[-2.72,.50],[-1.91,1.28],[-1.35,2.0],[-.59,2.58],[.35,2.46],[.92,1.70],[1.75,1.30],[2.72,.37]],.69,0xb6a283,7.48,2.91,Math.PI/2);
 wall([[-1.72,.23],[-1.05,.82],[.04,1.12],[.90,.87],[1.72,.32]],.59,0xa38d70,6.18,-6.45);
 // The old doorway lies on its side with a worn turquoise inlay facing up.
 box('stone',0xc1ab87,-5.61,.50,-4.83,3.29,.79,1.02,.27,.17);kit.solidBox(-5.61,-4.83,3.45,1.20,1.18,.27);
 for(let i=0;i<6;i++)box('stone',i%2?0x738981:0x8b9a86,-6.68+i*.47,.79+(i-2.5)*.053,-4.55-i*.122,.28,.038,.44,.27,.17);
 box('stone',0xad9877,-4.70,.28,-5.89,1.13,.57,.81,-.42,-.13);kit.solidBox(-4.70,-5.89,1.20,.91,.68,-.42);
 // Shallow paving remains only inside each side court, leaving the street bare.
 for(const side of[-1,1])for(let i=0;i<12;i++){
  const x=side*(4.04+(i%3)*.91),z=-2.94+Math.floor(i/3)*1.47+(i%2)*.18;
  box('stone',i%3?0xab9677:0xbfac8c,x,.012,z,.72+(i%2)*.11,.065,1.03,Math.sin(i*4.2)*.13);
 }
 // Windward sand banks hug the masonry and taper into the courtyard floor.
 for(const[x,z,sx,sz,a]of[[-7.05,-3.45,1.1,2.31,.07],[-6.75,3.65,1.47,1.75,.17],[7.02,2.6,1.23,2.29,-.10],[5.3,-6.12,1.62,1.03,.28],[-5.36,-5.72,1.53,.77,.12]])floor(0xc7b38c,x,z,sx,sz,a);
 // Faded carved stripes sit on an actual wall surface, not floating UI glyphs.
 for(const z of[1.55,1.91,2.27,2.63])for(const y of[.77,1.16])box('stone',0x8c846b,7.12,y,z,.028,.07,.22,0,.05);
 for(const[x,z,size,a]of[[4.58,-4.31,.43,.3],[5.4,-3.93,.33,1.9],[-5.1,3.31,.45,.6],[-4.33,3.76,.29,2.7]]){
  const pot=new T.LatheGeometry([[.19,0],[.48,.11],[.53,.35],[.43,.58],[.32,.67]].map(([r,y])=>new T.Vector2(r*size,y*size)),10,a,Math.PI*1.62);
  piece('ceramic',pot,0x976e51,{x,y:.035,z});kit.solid(x,z,size*.6,.035+size*.67);
  for(let i=0;i<3;i++)box('ceramic',i%2?0xb78861:0x825f48,x+.23+i*.14,.042,z+.19-i*.12,.15,.067,.13,a+i*.7,.09);
 }
 for(let i=0;i<16;i++){const side=i%2?-1:1,x=side*(4.0+(i*1.29)%3.48),z=-6.94+(i*2.17)%13.03;rock(i%3?0xab9677:0xc2ad88,x,.033,z,.13+(i%3)*.04,.075,.18+(i%2)*.055,i*.61);}
 return{kind:'buried-courtyard',name:'风埋残院',focus:{x:5.7,y:1.0,z:2.7}};
}

import * as T from './vendor/three.module.js';
import{wornStoneBlock}from'./environment-props.js?v=201';
import{naturalRockGeometry}from'./biome-scenery.js?v=201';

// Inset mortar and shallow chipped stone faces share one closed wall volume.
// Every face stays inside the former profile; no new solids or draw calls.
function wallGeometry(profile,depth,biome){
 const positions=[],colors=[],indices=[],recess=Math.min(.028,depth*.075);
 const vertex=(p,tone=1)=>{positions.push(...p);const foot=1-T.MathUtils.smoothstep(p[1],.01,.35+.055*Math.sin(p[0]*2.2)),shade=(.82+Math.min(1,Math.max(0,p[1])/2.5)*.16+foot*(biome==='sand'?.11:-.085))*tone;colors.push(shade*1.025,shade,shade*.95);};
 const face=(points,tone=1)=>{const first=positions.length/3;for(const p of points)vertex(p,tone);for(let i=1;i<points.length-1;i++)indices.push(first,first+i,first+i+1);};
 const points=profile.map(([x,h])=>{const wear=.035*Math.sin(x*2.9),seam=Math.min(h*.44,.19+.055*Math.sin(x*2.3+.7)),inset=depth*(biome==='sand'?.465:.39);return{x,h,seam,front:[depth*.5,inset+wear*.2,depth*.46+wear],back:[-depth*.5,-inset+wear*.2,-depth*.46+wear]};});
 // A broad buried plinth and alternating quarry lifts give ash walls actual
 // stepped cross-sections. Sand keeps thicker, rounded windward buttresses.
 const erosion=(x,y)=>biome==='ash'?depth*(.16*T.MathUtils.smoothstep(y,.1,.48)+.07*(.5+.5*Math.sin(y*14.61))):depth*.15*T.MathUtils.smoothstep(y,.1,.52)*(.5+.5*Math.cos(x*3.4))**2;
 const skin=(p,y,side)=>{const values=side===1?p.front:p.back,t=y<p.seam?(y+.10)/(p.seam+.10):(y-p.seam)/(p.h-p.seam);return T.MathUtils.lerp(values[y<p.seam?0:1],values[y<p.seam?1:2],t)-side*(recess+erosion(p.x,y));};
 const neighbors=x=>{const next=points.findIndex((p,i)=>i&&x<=p.x+1e-7);return[points[Math.max(1,next)-1],points[Math.max(1,next)]];};
 const heightAt=x=>{const[a,b]=neighbors(x);return T.MathUtils.lerp(a.h,b.h,(x-a.x)/(b.x-a.x));};
 const at=(x,y,side)=>{const[a,b]=neighbors(x),t=(x-a.x)/(b.x-a.x),seam=T.MathUtils.lerp(a.seam,b.seam,t),values=(side===1?a.front:a.back).map((v,i)=>T.MathUtils.lerp(v,(side===1?b.front:b.back)[i],t)),below=y<seam;return T.MathUtils.lerp(values[below?0:1],values[below?1:2],below?(y+.1)/(seam+.1):(y-seam)/(heightAt(x)-seam))-side*(recess+erosion(x,y));};
 const peak=profile.reduce((a,b)=>a[1]>b[1]?a:b),niche=[];
 if(biome==='sand'&&peak[1]>1.45){
  const r=.36,bottom=.40,spring=Math.min(1.27,peak[1]-.58),cx=peak[0];
  niche.push([cx-r,bottom],[cx+r,bottom]);for(let i=0;i<=10;i++){const a=i*Math.PI/10;niche.push([cx+Math.cos(a)*r,spring+Math.sin(a)*r]);}
  if(niche.some(([x,y])=>y>heightAt(x)-.14))niche.length=0;
 }
 // Subtract the convex arched recess from each masonry tile. The socket has a
 // closed stone back and real reveal thickness; it never opens a walking path.
 const nicheTop=Math.max(0,...niche.map(p=>p[1]));
 const outsideNiche=polygon=>{
  if(!niche.length||polygon.every(p=>p[0]<=niche[0][0])||polygon.every(p=>p[0]>=niche[1][0])||polygon.every(p=>p[1]<=niche[0][1])||polygon.every(p=>p[1]>=nicheTop))return[polygon];let inside=polygon;const fragments=[];
  for(let i=0;i<niche.length&&inside.length;i++){
   const a=niche[i],b=niche[(i+1)%niche.length],value=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),front=[],back=[];
   for(let j=0;j<inside.length;j++){const p=inside[j],q=inside[(j+1)%inside.length],pv=value(p),qv=value(q);(pv>=0?front:back).push(p);if((pv>=0)!==(qv>=0)){const t=pv/(pv-qv),cut=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];front.push(cut);back.push(cut);}}
   if(back.length>=3)fragments.push(back);inside=front;
  }
  return fragments;
 };
 const clip=(polygon,y,above)=>{const out=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],inside=above?a[1]>=y:a[1]<=y,next=above?b[1]>=y:b[1]<=y;if(inside)out.push(a);if(inside!==next){const t=(y-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,y]);}}return out;};
 for(let segment=1;segment<points.length;segment++){
  const a=points[segment-1],b=points[segment],width=b.x-a.x,height=x=>T.MathUtils.lerp(a.h,b.h,(x-a.x)/width);
  // Staggered half-metre courses read as masonry instead of a smooth sheet.
  for(let row=0;row<Math.ceil((Math.max(a.h,b.h)+.1)/.43);row++){
   const low=-.10+row*.43,high=low+.43,offset=(row%2)*.38,first=Math.floor((a.x-offset)/.78),last=Math.ceil((b.x-offset)/.78);
   for(let column=first;column<last;column++){
    const left=Math.max(a.x,column*.78+offset),right=Math.min(b.x,(column+1)*.78+offset);if(right-left<.00001)continue;
    let polygon=clip([[left,-.1],[right,-.1],[right,height(right)],[left,height(left)]],low,true);polygon=clip(polygon,high,false);if(polygon.length<3)continue;
    // Keep the buried foot's existing crease along each tile boundary.
    const seamAt=x=>T.MathUtils.lerp(a.seam,b.seam,(x-a.x)/width),creased=[];for(let k=0;k<polygon.length;k++){const p=polygon[k],q=polygon[(k+1)%polygon.length],pa=p[1]-seamAt(p[0]),qa=q[1]-seamAt(q[0]);creased.push(p);if(pa*qa<0){const t=pa/(pa-qa);creased.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}polygon=creased;
    for(const side of[1,-1])for(const tile of outsideNiche(polygon)){
     const cx=tile.reduce((sum,p)=>sum+p[0],0)/tile.length,cy=tile.reduce((sum,p)=>sum+p[1],0)/tile.length,ys=tile.map(p=>p[1]),span=Math.max(...ys)-Math.min(...ys);if(span<.00001)continue;
     const edgeX=Math.min(.033,(right-left)*.13),edgeY=Math.min(.028,span*.13),tone=.96+.035*Math.sin(column*5.21+row*2.73+segment*.4);
     const rim=tile.map(([x,y])=>[x,y,at(x,y,side)]),inner=tile.map(([x,y])=>{const inset=1-Math.min(edgeX*2/(right-left),edgeY*2/span),px=cx+(x-cx)*inset,py=cy+(y-cy)*inset;return[px,py,at(px,py,side)+side*(recess-.004-.003*(1+Math.sin(column*2.2+row)))];});
     face(side===1?inner:[...inner].reverse(),tone);
     for(let i=0;i<rim.length;i++){const j=(i+1)%rim.length,quad=[rim[i],rim[j],inner[j],inner[i]];face(side===1?quad:quad.reverse(),tone*.90);}
    }
   }
  }
  // Close the original broken crown and buried bottom against the mortar skin.
  face([[a.x,a.h,skin(a,a.h,1)],[b.x,b.h,skin(b,b.h,1)],[b.x,b.h,skin(b,b.h,-1)],[a.x,a.h,skin(a,a.h,-1)]]);
  face([[a.x,-.1,skin(a,-.1,-1)],[b.x,-.1,skin(b,-.1,-1)],[b.x,-.1,skin(b,-.1,1)],[a.x,-.1,skin(a,-.1,1)]]);
 }
 if(niche.length)for(const side of[1,-1]){
  const surface=niche.map(([x,y])=>[x,y,at(x,y,side)]),back=surface.map(([x,y])=>[x,y,side*depth*.10]);
  face(side===1?back:[...back].reverse(),.64);
  for(let i=0;i<surface.length;i++){const j=(i+1)%surface.length,quad=[surface[i],surface[j],back[j],back[i]];face(side===1?quad:quad.reverse(),.79+.07*Math.sin(i*.9));}
 }
 for(const [p,reverse]of[[points[0],false],[points.at(-1),true]])for(const[low,high]of[[-.1,p.seam],[p.seam,p.h]]){const quad=[[p.x,low,skin(p,low,-1)],[p.x,low,skin(p,low,1)],[p.x,high,skin(p,high,1)],[p.x,high,skin(p,high,-1)]];face(reverse?quad.reverse():quad);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.name='SM_Ruin_Masonry_'+biome;geometry.userData.ruinWall={profile,depth,niche};return geometry;
}
// A continuous fired-clay section: outer belly, chipped lip, inner wall and
// closed base. The two fracture faces expose real thickness instead of paper.
function brokenPotGeometry(profile,size,start,span){
 const steps=18,positions=[],colors=[],indices=[],outer=profile.map(([r,y])=>[r,y]),section=[...outer,[outer.at(-1)[0]-.052,outer.at(-1)[1]-.018],...outer.slice(1,-1).reverse().map(([r,y])=>[r-.055,y]),[.10,.065],[0,.065],[0,0]],top=outer.at(-1)[1];
 const add=(p,tone)=>{positions.push(...p);colors.push(tone,tone*.985,tone*.955);return positions.length/3-1;},rings=[];
 for(let i=0;i<=steps;i++){
  const angle=start+span*i/steps,ring=[];
  for(let j=0;j<section.length;j++){const[r,y]=section[j],lip=T.MathUtils.smoothstep(y,top*.72,top),dip=lip*(.018+.010*Math.sin(angle*7+.4)+.006*Math.cos(angle*11)),a=angle+(i===0?.018*(1+Math.sin(j*1.8)):i===steps?-.018*(1+Math.sin(j*1.8)):0),tone=j>=outer.length?.76: .94+.04*Math.sin(angle*3+y*7);ring.push(add([Math.sin(a)*r*size,(y-dip)*size,Math.cos(a)*r*size],tone));}
  rings.push(ring);
 }
 for(let i=0;i<steps;i++)for(let j=0;j<section.length;j++){const next=(j+1)%section.length,a=rings[i][j],b=rings[i+1][j],c=rings[i+1][next],d=rings[i][next];indices.push(a,b,d,b,c,d);}
 const caps=T.ShapeUtils.triangulateShape(section.map(([r,y])=>new T.Vector2(r,y)),[]);
 for(const [i,reverse]of[[0,false],[steps,true]])for(const triangle of caps){const corners=triangle.map(j=>{const n=rings[i][j],p=positions.slice(n*3,n*3+3);return add(p,.88);});indices.push(...(reverse?corners.reverse():corners));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.name='SM_Ruin_BrokenPot_Clay';g.userData.ruinPot={size,height:top,thickness:.052*size};return g;
}
function vaultGeometry(inner,thickness,depth,start=0,end=Math.PI){
 const points=[],steps=36;for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps,seam=i%3===1?.055:0,r=inner+thickness+.026*Math.sin(a*9)-seam;points.push(new T.Vector2(Math.cos(a)*r,Math.sin(a)*r));}
 for(let i=steps;i>=0;i--){const a=start+(end-start)*i/steps,r=inner+(i%3===1?.035:0);points.push(new T.Vector2(Math.cos(a)*r,Math.sin(a)*r));}
 const geometry=new T.ExtrudeGeometry(new T.Shape(points),{depth,steps:1,bevelEnabled:false});geometry.translate(0,0,-depth*.5);geometry.clearGroups();
 const p=geometry.attributes.position,colors=[];for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getY(i)),shade=T.MathUtils.lerp(.61,1.02,T.MathUtils.smoothstep(r,inner,inner+thickness));colors.push(shade,shade*.985,shade*.95);}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.name='SM_Ruin_WeatheredVoussoirs';geometry.userData.ruinVault={inner,thickness,depth,start,end};return geometry;
}
function flowGeometry(points,width){
 const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,.026,z))),positions=[],indices=[];
 for(let i=0;i<=28;i++){const t=i/28,p=curve.getPoint(t),d=curve.getTangent(t),r=width*(.62+.28*Math.sin(t*13+1)**2);positions.push(p.x-d.z*r,p.y,p.z+d.x*r,p.x+d.z*r,p.y,p.z-d.x*r);if(i){const a=(i-1)*2;indices.push(a,a+3,a+1,a,a+2,a+3);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function groundLayerGeometry(biome,phase,ceiling=.029){
 const positions=[],colors=[],indices=[],steps=24;
 const vertex=(x,z,r)=>{
  const crack=Math.exp(-Math.abs(x+.34*z+.10*Math.sin(z*4+phase))*18),wave=Math.sin(x*3.2+z*1.1+phase);
  const crest=biome==='ash'?.018+.009*Math.cos(x*3.1+phase)*Math.sin(z*2.8+.4)-.008*crack:.014+.014*(.5+.5*wave);
  const y=r===1?-.035:Math.min(ceiling,crest),shade=biome==='ash'?.92-.09*crack+.03*Math.sin(x*2+z*3+phase):.93+.05*Math.sin(x*1.3-z*2.1+phase);
  positions.push(x,y,z);colors.push(shade,shade,shade);
 };
 vertex(.035*Math.sin(phase),.035*Math.cos(phase),0);
 // The same 120 triangles as the former flattened rock: a continuous thin
 // surface with an irregular buried perimeter, not a raised oval slab.
 for(const r of[.29,.62,1])for(let i=0;i<steps;i++){
  const a=i*Math.PI*2/steps,edge=.87+.055*Math.sin(a*3+phase)+.035*Math.cos(a*7-phase);
  vertex(Math.cos(a)*r*edge+.055*(1-r)*Math.sin(phase+r*3),Math.sin(a)*r*edge+.047*(1-r)*Math.cos(phase-r*2),r);
 }
 for(let i=0;i<steps;i++){const j=(i+1)%steps;indices.push(0,1+j,1+i);for(let ring=0;ring<2;ring++){const a=1+ring*steps+i,b=1+ring*steps+j,c=a+steps,d=b+steps;indices.push(a,b,d,a,d,c);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.userData.ruinGroundLayer={biome,ceiling};return g;
}

export function buildRuinPlace(biome,kit,variant=0){
 if(biome!=='ash'&&biome!=='sand')return null;
 const piece=(category,geometry,color,transform)=>kit.piece(category,geometry,color,transform);
 const box=(category,color,x,y,z,sx,sy,sz,ry=0,rz=0)=>piece(category,wornStoneBlock.clone(),color,{x,y,z,sx,sy,sz,ry,rz});
 const wall=(profile,depth,color,x,z,angle=0)=>{piece('stone',wallGeometry(profile,depth,biome),color,{x,z,ry:angle});kit.solidBox(x,z,profile.at(-1)[0]-profile[0][0],depth,Math.max(...profile.map(p=>p[1])),angle);};
 const rock=(color,x,y,z,sx,sy,sz,angle=0)=>{piece('stone',naturalRockGeometry.clone(),color,{x,y,z,sx,sy,sz,ry:angle});if(y+sy>.3)kit.solid(x,z,Math.max(sx,sz)*1.2,y+sy*1.1);};
 const floor=(color,x,z,sx,sz,angle=0,ceiling=.029)=>piece('ground',groundLayerGeometry(biome,x*.73+z*.41,ceiling),color,{x,z,sx,sz,ry:angle});
 if(biome==='ash'&&variant===1){
  // The second yard follows a cooled outcrop into an open, broken round furnace.
  // Long stepped beds replace the first yard's barrel roof and parallel walls.
  wall([[-2.55,.37],[-2.15,1.17],[-1.40,1.40],[-.42,1.62],[.31,1.46],[1.20,1.57],[2.03,.90],[2.55,.28]],.84,0x504e48,-7.53,-2.80,Math.PI/2);
  wall([[-2.25,.18],[-1.79,.49],[-.74,.65],[.18,.61],[1.34,.72],[2.25,.26]],.77,0x645c50,-6.52,-2.58,Math.PI/2);
  wall([[-1.72,.29],[-1.16,.81],[-.27,.94],[.64,.75],[1.72,.22]],.60,0x504841,-5.78,6.16);
  wall([[-2.10,.32],[-1.57,.90],[-.64,1.28],[.28,1.16],[1.34,.73],[2.10,.27]],.71,0x5b5147,7.55,3.95,Math.PI/2);
  // An actual missing sector faces the street. Each short curved wall has a
  // finite collider, so the open furnace is neither a solid cylinder nor a decal.
  const furnace={x:5.68,z:-3.30};
  for(let i=0;i<7;i++){
   const start=-2.42+i*4.84/7,end=start+4.84/7,a=(start+end)*.5,height=[.72,1.02,.86,1.17,.94,.78,.58][i];
   piece('stone',vaultGeometry(1.11,.30,height,start,end),i%2?0x6c5948:0x574a3e,{x:furnace.x,y:height*.5-.045,z:furnace.z,rx:Math.PI/2});
   kit.solid(furnace.x+Math.cos(a)*1.26,furnace.z+Math.sin(a)*1.26,.58,height+.025);
  }
  // Only this furnace's underlying layer is depressed. The visible hearth
  // stays within the existing foot clearance instead of becoming a platform.
  piece('metal',new T.CircleGeometry(1.07,22),0x343933,{x:furnace.x,y:.034,z:furnace.z,rx:-Math.PI/2});
  // The cold drain, rail ends, and low casting bed all point back to the broken
  // opening. These are passive scenery; they never add a vent or heat damage.
  piece('ground',flowGeometry([[4.38,-3.3],[4.06,-2.37],[4.34,-1.02],[5.02,.18],[5.15,1.30]],.29),0x383d38,{});
  for(const z of[1.14,2.49]){box('stone',0x625447,5.25,.165,z,2.81,.34,.25);kit.solidBox(5.25,z,2.81,.25,.34);}
  box('metal',0x383d38,5.25,.032,1.82,2.70,.06,1.06);
  for(let i=0;i<5;i++)box('metal',0x71604d,4.2+i*.53,.052,1.82,.055,.06,1.10);
  for(const x of[-5.43,-4.12])box('metal',0x544d43,x,.062,-5.59,.09,.10,3.22,.08);
  for(let i=0;i<6;i++)box('stone',i%2?0x564b42:0x6a5e4e,-4.78,.03,-7.12+i*.54,1.82,.06,.17,.08+Math.sin(i)*.026);
  for(const[x,z,sx,sz,a,ceiling]of[[-6.82,-2.78,1.45,2.31,.12],[-4.87,-5.45,1.36,1.80,.07],[5.69,-3.32,1.56,1.59,.18,.01],[5.74,4.36,1.64,1.84,-.16]])floor(0x48473f,x,z,sx,sz,a,ceiling);
  for(const[x,z,sx,sy,sz]of[[-7.16,3.87,.86,.46,1.21],[-5.65,4.70,.88,.30,.74],[6.65,6.49,.76,.32,.52]])rock(0x5d574d,x,sy*.61,z,sx,sy,sz,x*.18);
  for(let i=0;i<16;i++){
   const side=i%2?-1:1,x=side*(4.02+(i*1.37)%3.55),z=-6.69+(i*2.13)%13.50;
   rock(i%3?0x514b40:0x78634f,x,.035,z,.16+(i%3)*.044,.085,.14+(i%2)*.075,i*.69);
  }
  return{kind:'cooled-furnace-terraces',name:'冷渣断炉台',focus:{x:5.68,y:.7,z:-3.30}};
 }
 if(biome==='sand'&&variant===1){
  // A collapsed entrance on one side faces a single U-shaped store court on
  // the other. The first courtyard's two long parallel courts are not repeated.
  wall([[-1.62,.30],[-1.21,1.18],[-.65,1.85],[-.08,2.18],[.53,1.74],[1.12,.80],[1.62,.29]],.68,0xb09a77,-7.53,-4.48,Math.PI/2);
  wall([[-1.55,.24],[-.96,.67],[-.10,1.17],[.61,1.06],[1.55,.31]],.62,0xa99373,-6.22,-1.88);
  wall([[-2.81,.29],[-2.11,.86],[-1.26,1.31],[-.46,1.64],[.26,1.43],[1.30,1.01],[2.14,.78],[2.81,.25]],.67,0xb59f7d,7.53,1.72,Math.PI/2);
  wall([[-1.70,.28],[-.97,.83],[-.18,1.12],[.67,.89],[1.70,.27]],.63,0xaf9875,6.15,4.88);
  wall([[-1.63,.21],[-.92,.65],[-.14,.91],[.81,.72],[1.63,.25]],.60,0xab9372,6.16,-1.53);
  // The broken lintel rests on its fallen jamb. Inlay fragments remain part
  // of the same stone volume, with no unsupported low overhangs in the street.
  box('stone',0xc0a782,-5.43,.48,-4.88,3.06,.76,.87,.48,-.13);kit.solidBox(-5.43,-4.88,3.25,1.02,1.14,.48);
  box('stone',0xb29a78,-6.67,.29,-5.69,1.38,.59,.86,-.26,.12);kit.solidBox(-6.67,-5.69,1.48,1.00,.78,-.26);
  for(let i=0;i<5;i++)box('stone',i%2?0x7e8b78:0x829387,-6.32+i*.43,.74-(i-2)*.045,-4.50-i*.213,.28,.03,.37,.48,-.13);
  // Broken approach slabs lead toward the old doorway, then widen into the
  // court entrance. All of them remain low walkable ground cover.
  for(let i=0;i<12;i++){
   const x=-4.12-(i%2)*.89-Math.floor(i/4)*.17,z=5.81-Math.floor(i/2)*1.56+(i%2)*.20;
   box('stone',i%3?0xad9573:0xc0aa86,x,.012,z,.74+(i%3)*.07,.064,.98,Math.sin(i*2.1)*.18);
  }
  for(let i=0;i<10;i++){
   const x=4.22+(i%3)*.86,z=.01+Math.floor(i/3)*1.17+(i%2)*.16;
   box('stone',i%2?0xa9906d:0xbca682,x,.008,z,.66+(i%3)*.05,.061,.89,Math.cos(i*2.7)*.15);
  }
  for(const[x,z,sx,sz,a]of[[-7.08,-4.45,1.05,2.28,.04],[-6.34,-1.38,1.68,.94,-.13],[7.04,1.91,1.21,2.37,.02],[5.82,4.35,1.93,.92,.10],[-5.43,-6.49,1.73,.75,.22]])floor(0xc6b089,x,z,sx,sz,a);
  for(const[x,z,size,a]of[[6.42,3.74,.46,.4],[5.53,3.94,.36,2.1],[4.56,.82,.42,.8],[-6.07,-.76,.32,2.7]]){
   const pot=brokenPotGeometry([[.18,0],[.46,.10],[.54,.33],[.43,.61],[.30,.69]],size,a,Math.PI*1.54);
   piece('ceramic',pot,0x9c7251,{x,y:.032,z});kit.solid(x,z,size*.6,.032+size*.70);
   for(let i=0;i<3;i++)box('ceramic',i%2?0xb58a62:0x886249,x-.24-i*.12,.037,z+.15-i*.14,.15,.065,.12,a+i*.63,.08);
  }
  for(const[x,z,sx,sy,sz]of[[-7.23,5.64,.76,.26,.67],[6.45,-6.47,.79,.30,.57],[-4.41,-6.83,.61,.21,.57]])rock(0xb6a17f,x,sy*.58,z,sx,sy,sz,x*.23);
  for(let i=0;i<13;i++){
   const side=i%2?-1:1,x=side*(4.09+(i*1.29)%3.41),z=-6.78+(i*2.19)%13.55;
   rock(i%3?0xa99170:0xc3ae87,x,.032,z,.14+(i%3)*.039,.076,.17+(i%2)*.059,i*.71);
  }
  return{kind:'fallen-gate-waystation',name:'断门旧驿',focus:{x:-5.9,y:.9,z:-4.4}};
 }
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
  const pot=brokenPotGeometry([[.19,0],[.48,.11],[.53,.35],[.43,.58],[.32,.67]],size,a,Math.PI*1.62);
  piece('ceramic',pot,0x976e51,{x,y:.035,z});kit.solid(x,z,size*.6,.035+size*.67);
  for(let i=0;i<3;i++)box('ceramic',i%2?0xb78861:0x825f48,x+.23+i*.14,.042,z+.19-i*.12,.15,.067,.13,a+i*.7,.09);
 }
 for(let i=0;i<16;i++){const side=i%2?-1:1,x=side*(4.0+(i*1.29)%3.48),z=-6.94+(i*2.17)%13.03;rock(i%3?0xab9677:0xc2ad88,x,.033,z,.13+(i%3)*.04,.075,.18+(i%2)*.055,i*.61);}
 return{kind:'buried-courtyard',name:'风埋残院',focus:{x:5.7,y:1.0,z:2.7}};
}

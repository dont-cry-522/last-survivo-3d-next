import * as T from './vendor/three.module.js';
import {smoothSeams} from './hero-finish.js?v=189';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {tideHarness} from './tide-appearance.js?v=189';
import {SHADOW_PALETTE} from './shadow-appearance.js?v=189';

const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
const bell=(x,center,width)=>Math.exp(-(((x-center)/width)**2));
const color=new T.Color();

function fabric(source,kind,leather=false){
 const m=source.clone();m.name=`MAT_Hero_${kind}_${leather?'Leather':'WovenCloth'}`;
 m.color.set(0xffffff);m.vertexColors=true;m.roughness=leather?.70:.90;m.metalness=leather?.025:0;
 m.metalnessMap=null;m.roughnessMap=null;m.normalScale?.setScalar(leather?.32:.24);
 m.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   #ifdef USE_MAP
    float tailoringTone=dot(texture2D(map,vMapUv).rgb,vec3(.2126,.7152,.0722));
    // color_fragment applies the vertex palette once after map_fragment.
    diffuseColor.rgb=vec3(.76+.40*tailoringTone);
   #endif`);
 };
 m.customProgramCacheKey=()=>`rebuilt-${kind}-${leather?'leather':'woven'}`;
 return m;
}

function relaxSurface(geometry,influence){
 // Smooth a local fabric fold across duplicated UV seams while keeping all
 // source skin weights and UVs. The reverse pass limits volume shrinkage.
 const p=geometry.attributes.position,groups=new Map(),nodes=[],at=[];
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*100000)).join(',');if(!groups.has(key)){groups.set(key,nodes.length);nodes.push({p:new T.Vector3().fromBufferAttribute(p,i),ids:[],neighbors:new Set()});}const n=groups.get(key);nodes[n].ids.push(i);at[i]=n;}
 const ix=geometry.index.array;for(let i=0;i<ix.length;i+=3)for(let k=0;k<3;k++){const a=at[ix[i+k]],b=at[ix[i+(k+1)%3]];if(a!==b){nodes[a].neighbors.add(b);nodes[b].neighbors.add(a);}}
 for(const strength of[.45,-.31]){const next=nodes.map(n=>{const mean=new T.Vector3();for(const i of n.neighbors)mean.add(nodes[i].p);return n.neighbors.size?n.p.clone().lerp(mean.multiplyScalar(1/n.neighbors.size),strength*influence(n.p.x,n.p.y,n.p.z)):n.p;});nodes.forEach((n,i)=>n.p.copy(next[i]));}
 for(const n of nodes)for(const i of n.ids)p.setXYZ(i,n.p.x,n.p.y,n.p.z);
}
function reshape(mesh,kind,part,sculpt,tint,leather=false,relax){
 const source=mesh.geometry,g=source.clone(),p=g.attributes.position,colors=new Float32Array(p.count*3);let moved=0;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),q=sculpt(x,y,z);
  p.setXYZ(i,...q);if(Math.hypot(q[0]-x,q[1]-y,q[2]-z)>1e-5)moved++;
  color.setHex(tint(...q));colors.set(color.toArray(),i*3);
 }
 if(relax)relaxSurface(g,relax);
 g.setAttribute('color',new T.BufferAttribute(colors,3));g.computeVertexNormals();smoothSeams(g);g.computeBoundingBox();g.computeBoundingSphere();
 g.name=`SM_Hero_${kind}_${part}`;mesh.geometry=g;mesh.material=fabric(mesh.material,kind,leather);
 mesh.userData.rebuiltPart=part;mesh.userData.rebuiltVertices=moved;mesh.castShadow=mesh.receiveShadow=true;
 return mesh;
}

// Detail follows the existing bind-space surface. Source UVs/weights are never
// rewritten, and every added vertex receives the original four bone weights.
function transferSkin(geometry,source){
 const p=geometry.attributes.position,sp=source.geometry.attributes.position,si=source.geometry.attributes.skinIndex,sw=source.geometry.attributes.skinWeight;
 if(geometry.attributes.skinIndex?.count===p.count&&geometry.attributes.skinWeight?.count===p.count){geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;}
 const indices=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
 for(let i=0;i<p.count;i++){
  let nearest=0,distance=Infinity;
  for(let j=0;j<sp.count;j++){const d=(p.getX(i)-sp.getX(j))**2+(p.getY(i)-sp.getY(j))**2+(p.getZ(i)-sp.getZ(j))**2;if(d<distance){distance=d;nearest=j;}}
  for(let k=0;k<4;k++){indices[i*4+k]=si.array[nearest*4+k];weights[i*4+k]=sw.array[nearest*4+k];}
 }
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}
function skinnedDetail(root,source,geometries,name,hex,{roughness=.87,metalness=0}={}){
 if(!geometries.length)return;
 const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());transferSkin(geometry,source);geometry.name=name;
 const material=new T.MeshStandardMaterial({name:'MAT_'+name,color:hex,roughness,metalness,side:T.DoubleSide});
 const mesh=new T.SkinnedMesh(geometry,material);mesh.name=name;mesh.skeleton=source.skeleton;mesh.bindMode=source.bindMode;mesh.bindMatrix.copy(source.bindMatrix);mesh.bindMatrixInverse.copy(source.bindMatrixInverse);
 mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.rebuiltPart=name;root.add(mesh);return mesh;
}

function cord(points,radius=.004,segments=24){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,radius,6,false);}

function panel(points,rows=10,cols=12){
 const p=[],uv=[],ix=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols,v=j/rows;p.push(...points(u,v));uv.push(u,v);if(j<rows&&i<cols){const a=j*(cols+1)+i;ix.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}

const projectionMaterial=new T.MeshBasicMaterial({side:T.DoubleSide}),probes=new WeakMap();
function surfaceZ(mesh,x,y,fallback=true){
 // A sampled seam belongs on the actual garment, not on an ideal cylinder.
 let probe=probes.get(mesh);if(!probe){probe={mesh:new T.Mesh(mesh.geometry,projectionMaterial),ray:new T.Raycaster()};probe.mesh.updateMatrixWorld();probes.set(mesh,probe);}
 probe.ray.set(new T.Vector3(x,y,2),new T.Vector3(0,0,-1));const hit=probe.ray.intersectObject(probe.mesh,false)[0];if(hit)return hit.point.z+.004;
 if(!fallback)return null;
 const p=mesh.geometry.attributes.position;let best=Infinity,z=0;
 for(let i=0;i<p.count;i++){if(p.getZ(i)<-.015)continue;const d=(p.getX(i)-x)**2+(p.getY(i)-y)**2;if(d<best){best=d;z=p.getZ(i);}}
 return z+.005;
}

function frontLine(mesh,points,radius=.0035){return cord(points.map(([x,y])=>[x,y,surfaceZ(mesh,x,y)]),radius,Math.max(12,points.length*4));}

function roundedHood(mesh){
 const p=[],uv=[],c=[],ix=[],cols=36,rows=20;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const v=j/rows,u=i/cols,theta=.035+v*2.19,opening=.91*smooth(.22,.72,theta),a=opening+u*(Math.PI*2-opening*2),r=Math.sin(theta),edge=Math.pow(Math.abs(u-.5)*2,12),fold=Math.sin(a*7+v)*.0025*smooth(.45,1,v);
  p.push(Math.sin(a)*(.160*r+fold)*(1-.035*edge),1.65+.178*Math.cos(theta),-.025+Math.cos(a)*(.186*r+fold)+.012*edge*smooth(.45,.95,theta));uv.push(u,v);
  color.setHex(SHADOW_PALETTE.cloth).lerp(new T.Color(SHADOW_PALETTE.fold),.10*(1-v)).lerp(new T.Color(SHADOW_PALETTE.ivory),edge**3*.78);c.push(color.r,color.g,color.b);
  if(j<rows&&i<cols){const n=j*(cols+1)+i;ix.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
 }
 const crown=p.length/3;p.push(0,1.828,-.025);uv.push(.5,0);color.setHex(SHADOW_PALETTE.cloth);c.push(color.r,color.g,color.b);for(let i=0;i<cols;i++)ix.push(crown,i,i+1);
 // Turn the fabric inward along the face opening. This is a narrow lining of
 // the same hood, not a second shell or a bright cord hiding a paper-thin edge.
 for(const edge of[0,cols])for(let j=3;j<rows;j++){
  const a=j*(cols+1)+edge,b=(j+1)*(cols+1)+edge,start=p.length/3;
  for(const [source,inset]of[[a,0],[b,0],[a,1],[b,1]]){
   const x=p[source*3],y=p[source*3+1],z=p[source*3+2];p.push(x-Math.sign(x)*.0035*inset,y+.001*inset,z-.0045*inset);uv.push(edge/cols,j/rows);color.setHex(inset?SHADOW_PALETTE.lining:SHADOW_PALETTE.ivory);c.push(color.r,color.g,color.b);
  }ix.push(start,start+1,start+2,start+2,start+1,start+3);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(c,3));geometry.setIndex(ix);geometry.computeVertexNormals();transferSkin(geometry,mesh);
 geometry.name='SM_Hero_Wraith_RoundedHood';mesh.geometry=geometry;mesh.material=new T.MeshStandardMaterial({name:'MAT_Hero_Wraith_SoftHood',vertexColors:true,roughness:.94,metalness:0,side:T.DoubleSide});mesh.userData.rebuiltPart='RoundedHood';mesh.userData.rebuiltVertices=p.length/3;mesh.userData.retopologized=true;mesh.castShadow=mesh.receiveShadow=true;
}

function fittedVest(root,body){
 // Tailor a continuous curved edge, rather than cutting along the coarse
 // triangles of the underlying jacket (which makes a visibly jagged neckline).
 const g=panel((u,v)=>{
  const across=u*2-1,x=across*(.101-.005*v),top=1.396+.024*across*across,bottom=1.167+.009*(1-across*across),y=top+(bottom-top)*v;
  return[x,y,surfaceZ(body,x,y)+.0015];
 },18,18);
 return skinnedDetail(root,body,[g],'SM_Hero_Tide_WovenLeatherVest',0x426977,{roughness:.84});
}

function shadow(root){
 const parts=[];root.traverse(o=>{if(o.isSkinnedMesh&&/Male_Ranger/.test(o.name))parts.push(o);});
 const find=expression=>parts.find(o=>expression.test(o.name));
 const body=find(/_Body$/),hood=find(/_Head_Hood/),arms=find(/_Arms_1/),boots=find(/_Feet/),cloth=new T.Color(SHADOW_PALETTE.cloth),lining=new T.Color(SHADOW_PALETTE.lining),ivory=new T.Color(SHADOW_PALETTE.ivory),tint=new T.Color();
 for(const mesh of parts){
  const name=mesh.name;
  if(/Pauldron|Belt_1/.test(name)){mesh.visible=false;continue;}
  if(/Head_Hood/.test(name)){
   mesh.visible=true;roundedHood(mesh);
  }else if(/_Body$/.test(name)){
   reshape(mesh,'Wraith','SoftTailoredTunic',(x,y,z)=>{
    const chest=bell(y,1.40,.14),waist=bell(y,1.17,.09),hem=1-smooth(.90,1.10,y),side=Math.abs(x);
    let depth=(z+.025)*(1+.045*chest)+.007*Math.sin(x*46)*hem-.025;
    // The old Ranger chest has raised horizontal armour bars. Ease those same
    // vertices into one curved fabric front, retaining every authored weight.
    const front=smooth(.03,.065,z)*smooth(1.21,1.27,y)*(1-smooth(1.41,1.49,y))*(1-smooth(.10,.165,side));
    depth=T.MathUtils.lerp(depth,.108+.008*bell(y,1.34,.085)-.012*(x/.14)**2,front*.94);
    return[x*(1+.055*chest-.055*waist+.055*hem),y-.032*hem*(1-.48*Math.cos(x*19)),depth];
   },(x,y,z)=>{
    const inside=(1-smooth(.045,.135,Math.abs(x)))*smooth(.02,.085,z)*smooth(1.16,1.28,y);
    return tint.copy(cloth).lerp(lining,inside*.7).multiplyScalar(y<1.12?.84:1).getHex();
   },false,(x,y)=>bell(y,1.46,.12));
  }else if(/_Arms_1/.test(name)){
   reshape(mesh,'Wraith','SoftSleeves',(x,y,z)=>{
    const a=Math.abs(x),sleeve=1.0+.11*bell(a,.40,.13),fold=.003*Math.sin(a*77)*bell(a,.50,.15);
    return[x,1.435+(y-1.435)*sleeve+fold,-.047+(z+.047)*sleeve];
   },x=>{const a=Math.abs(x),cuff=smooth(.614,.625,a)*(1-smooth(.643,.653,a));return tint.copy(cloth).lerp(ivory,cuff*.78).getHex();},false,x=>bell(Math.abs(x),.40,.13));
  }else if(/_Arms_Bracer/.test(name)){
   reshape(mesh,'Wraith','WrappedForearm',(x,y,z)=>[x,1.443+(y-1.443)*.84,-.064+(z+.064)*.84],x=>Math.sin(Math.abs(x)*125)>.72?SHADOW_PALETTE.fold:SHADOW_PALETTE.leather,true);
  }else if(/_Arms_2/.test(name)){
   reshape(mesh,'Wraith','ClosedGlove',(x,y,z)=>[x,1.414+(y-1.414)*1.012,-.05+(z+.05)*1.012],()=>SHADOW_PALETTE.leather,true);
  }else if(/_Legs/.test(name)){
   reshape(mesh,'Wraith','GatheredTrousers',(x,y,z)=>{
    const center=Math.sign(x)*.105,volume=.045*bell(y,.82,.18),crease=.003*Math.sin(y*72)*bell(y,.52,.12);
    return[center+(x-center)*(1+volume),y,-.042+(z+.042)*(1+volume)+crease];
   },(x,y,z)=>z>.045?SHADOW_PALETTE.fold:SHADOW_PALETTE.cloth);
  }else if(/_Feet/.test(name)){
   reshape(mesh,'Wraith','QuietLeatherBoots',(x,y,z)=>{
    const center=Math.sign(x)*.11,ankle=bell(y,.22,.13),fold=.004*Math.sin(y*73)*bell(y,.43,.095);
    return[center+(x-center)*(1-.045*ankle),Math.max(-.003,y),z+fold];
   },(x,y,z)=>y<.045?SHADOW_PALETTE.lining:y>.38?SHADOW_PALETTE.fold:SHADOW_PALETTE.leather,true);
  }else if(/Belt_2/.test(name)){
   reshape(mesh,'Wraith','ClothWaistSash',(x,y,z)=>[x*1.025,1.157+(y-1.157)*1.38,z*1.022],()=>SHADOW_PALETTE.lining);
  }
 }
 if(body){
  const seams=[];for(const s of[-1,1])seams.push(frontLine(body,[[s*.082,1.48],[s*.102,1.40],[s*.095,1.29],[s*.086,1.20]],.0028));
  skinnedDetail(root,body,seams,'SM_Hero_Wraith_TunicSeams',SHADOW_PALETTE.fold);
  // The short split hem is an actual draped surface, with soft overlapping folds.
  const skirts=[-1,1].map(s=>panel((u,v)=>{
   const x=s*(.034+.132*u)*(1+.10*v),y=1.14-v*(.244-.055*u)+.015*Math.sin(u*Math.PI)*v;
   return[x,y,.110-.055*u*u+.009*Math.sin(u*Math.PI*3)*v];
  },10,10));
  skinnedDetail(root,body,skirts,'SM_Hero_Wraith_SplitTunicHem',SHADOW_PALETTE.cloth);
 }
 if(hood){
  // The edge is sampled from the rebuilt surface itself, never a floating arc.
  const p=hood.geometry.attributes.position,points=[];for(let j=20;j>=3;j--)points.push([p.getX(j*37),p.getY(j*37),p.getZ(j*37)]);for(let j=3;j<=20;j++)points.push([p.getX(j*37+36),p.getY(j*37+36),p.getZ(j*37+36)]);
  skinnedDetail(root,hood,[cord(points,.0018,48)],'SM_Hero_Wraith_SoftHoodLip',SHADOW_PALETTE.ivory);
 }
 if(arms){
  const seams=[];for(const s of[-1,1])seams.push(cord([[s*.43,1.431,-.115],[s*.49,1.431,-.114],[s*.57,1.432,-.111],[s*.65,1.432,-.104]],.0025,16));
  skinnedDetail(root,arms,seams,'SM_Hero_Wraith_SleeveSeams',SHADOW_PALETTE.fold);
 }
 if(boots){
  const seams=[];for(const s of[-1,1])seams.push(frontLine(boots,[[s*.12,.43],[s*.12,.34],[s*.12,.21],[s*.12,.13]],.003));
  skinnedDetail(root,boots,seams,'SM_Hero_Wraith_BootWelts',SHADOW_PALETTE.fold);
 }
}

function tide(root){
 const parts=[];root.traverse(o=>{if(o.isSkinnedMesh&&(/Female_Peasant/.test(o.name)||o.name==='Hair_Buns'))parts.push(o);});
 const find=expression=>parts.find(o=>expression.test(o.name));
 const body=find(/_Body$/),arms=find(/_Arms$/),boots=find(/_Feet$/),hair=find(/^Hair_Buns$/);
 for(const mesh of parts){
  const name=mesh.name;
  if(/_Body$/.test(name)){
   reshape(mesh,'Tide','OpenNeckHunterJacket',(x,y,z)=>{
    const waist=bell(y,1.17,.085),chest=bell(y,1.40,.12),hem=1-smooth(.99,1.10,y);
    const openNeck=.022*bell(x,0,.054)*smooth(1.406,1.442,y)*(1-smooth(1.452,1.49,y))*smooth(.022,.04,z);
    return[x*(1-.055*waist+.055*chest+.06*hem),y-.025*hem*(1+.2*Math.cos(x*24))-openNeck,z*(1-.04*waist)+.005*Math.sin(x*58)*hem];
   },(x,y,z)=>y<1.13?0x203f53:Math.abs(x)<.106&&y<1.34&&z>.065?0x365c70:0x2c536a,false,(x,y)=>bell(y,1.435,.075));
  }else if(/_Arms$/.test(name)){
   reshape(mesh,'Tide','RolledSleevesAndGloves',(x,y,z)=>{
    const a=Math.abs(x),sleeve=bell(a,.335,.085),bare=bell(a,.53,.10),fold=.0035*Math.sin(a*91)*sleeve;
    return[x,1.414+(y-1.414)*(1+.08*sleeve-.035*bare)+fold,-.042+(z+.042)*(1+.06*sleeve-.03*bare)];
   },x=>{const a=Math.abs(x);return a>.80?0xc6a187:a>.67?0x253c4c:a>.438?0xc5a085:0x4f7387;},false,x=>bell(Math.abs(x),.405,.07));
  }else if(/_Legs$/.test(name)){
   reshape(mesh,'Tide','FittedDeckTrousers',(x,y,z)=>{
    const center=Math.sign(x)*.104,taper=bell(y,.65,.18),thigh=bell(y,.88,.11);
    return[center+(x-center)*(1-.10*taper+.025*thigh),y,-.038+(z+.038)*(1-.08*taper)];
   },(x,y,z)=>z>.02?0x294254:0x1e3346);
  }else if(/_Feet$/.test(name)){
   reshape(mesh,'Tide','HighGripDeckBoots',(x,y,z)=>{
    const center=Math.sign(x)*.117,sole=1-smooth(.05,.10,y),calf=smooth(.14,.44,y);
    return[center+(x-center)*(1+.055*sole+.025*calf),Math.max(-.003,y+.064*calf),z+.009*sole*smooth(-.03,.12,z)];
   },(x,y,z)=>y<.055?0x202b34:y>.435?0x647e8b:y>.17?0x354c60:0x283b4a,true);
  }else if(name==='Hair_Buns'){
   mesh.userData.hairstyle=true;
   reshape(mesh,'Tide','TiedCoastalHair',(x,y,z)=>{
    const bun=smooth(.080,.13,Math.abs(x))*smooth(1.67,1.75,y),fringe=smooth(.025,.09,z)*(1-smooth(1.65,1.73,y));
    return[x*(1-.23*bun)+.010*fringe,1.69+(y-1.69)*(1-.25*bun),z-.012*bun+.004*fringe];
   },(x,y,z)=>z>.04?0x484348:0x272c34);
  }
 }
 if(body){
  const vest=fittedVest(root,body);
  const collar=[];
  for(const s of[-1,1])collar.push(panel((u,v)=>{
   const width=.006+.011*Math.sin(u*Math.PI),x=s*(.011+.088*u),y=1.404+.028*u-width*v;
   return[x,y,surfaceZ(body,x,y)+.0015+.002*Math.sin(v*Math.PI)*Math.sin(u*Math.PI)];
  },8,6));
  skinnedDetail(root,body,collar,'SM_Hero_Tide_FoldedOpenCollar',0x73919e);
  const panels=[-1,1].map(s=>panel((u,v)=>{
   const x=s*(.03+.117*u)*(1+.10*v),y=1.135-v*(.205-.051*u)+.009*Math.sin(u*Math.PI*2)*v**5;
   return[x,y,.124-.063*u*u+.009*Math.sin(u*Math.PI*3)*v];
  },10,10));
  skinnedDetail(root,body,panels,'SM_Hero_Tide_SplitDeckCoat',0x244658);
  const weave=[];
  for(let i=0;i<7;i++){const y=1.19+i*.019;weave.push(frontLine(body,[[-.083,y],[0,y-.012],[.083,y]],.0021));}
  for(const s of[-1,1])weave.push(frontLine(body,[[s*.102,1.34],[s*.107,1.27],[s*.097,1.18]],.0036));
  skinnedDetail(root,body,weave,'SM_Hero_Tide_WovenAbdomenGuard',0x728b97);
  const knots=[];
  for(let i=0;i<2;i++)knots.push(cord([[.119+i*.010,1.498,.043],[.158+i*.010,1.476,.064],[.156+i*.010,1.437,.092],[.130+i*.010,1.444,.108],[.119+i*.010,1.478,.066]],.005,20));
  skinnedDetail(root,body,knots,'SM_Hero_Tide_ShoulderRopeKnots',0x9b967d);
  const clasps=[new T.TorusGeometry(.012,.0035,6,12)];clasps[0].rotateX(.14);clasps[0].translate(-.074,1.38,surfaceZ(body,-.074,1.38)+.004);
  skinnedDetail(root,body,clasps,'SM_Hero_Tide_CopperClasp',0x92745a,{roughness:.52,metalness:.46});
  const fittings=tideHarness((x,y)=>Math.max(surfaceZ(body,x,y),surfaceZ(vest,x,y,false)??-Infinity)),harness=new T.Group();harness.name=fittings.name;root.add(harness);
  for(const part of fittings.children){const material=part.material;skinnedDetail(harness,body,[part.geometry],part.name,material.color.getHex(),{roughness:material.roughness,metalness:material.metalness});material.dispose();}
 }
 if(arms){
  const cuffs=[];for(const s of[-1,1]){
   // A rolled cuff overlaps the sleeve with a tapered cloth lip, rather than
   // the old thick torus that stood off the forearm like a bracelet.
   cuffs.push(panel((u,v)=>{const a=u*Math.PI*2,x=s*(.423+v*.020),r=.052+.005*Math.sin(v*Math.PI);return[x,1.414+Math.cos(a)*r,-.042+Math.sin(a)*r*.92];},8,24));
  }
  skinnedDetail(root,arms,cuffs,'SM_Hero_Tide_RolledSleeveCuffs',0x7c99a5);
 }
 if(boots){
  const welts=[];for(const s of[-1,1]){
   welts.push(frontLine(boots,[[s*.123,.46],[s*.123,.34],[s*.123,.20]],.004));
   const cuff=new T.TorusGeometry(.068,.005,6,20);cuff.rotateX(Math.PI/2);cuff.scale(.78,1,.87);cuff.translate(s*.123,.482,-.046);welts.push(cuff);
  }
  skinnedDetail(root,boots,welts,'SM_Hero_Tide_BootStitchAndCuff',0x7c929d);
 }
 if(hair){
  skinnedDetail(root,hair,[cord([[.090,1.726,-.075],[.108,1.68,-.09],[.096,1.615,-.102],[.075,1.566,-.088]],.011,20)],'SM_Hero_Tide_SweptTempleLock',0x38333d);
 }
}

export function rebuildShadowTide(root,kind){
 if(!['wraith','tide'].includes(kind)||root.userData.heroRebuild?.kind===kind)return;
 const before=[];root.traverse(o=>{if(o.isSkinnedMesh)before.push(o);});
 if(kind==='wraith')shadow(root);else tide(root);
 const rebuilt=[];root.traverse(o=>{if(o.userData.rebuiltPart)rebuilt.push(o);});
 root.userData.heroRebuild={kind,revision:1,parts:rebuilt.length,sculptedVertices:rebuilt.reduce((sum,o)=>sum+(o.userData.rebuiltVertices||0),0),addedMeshes:rebuilt.filter(o=>!before.includes(o)).length};
 // Projection helpers are build-only and must not pin pre-finish geometries.
 for(const mesh of new Set([...before,...rebuilt]))probes.delete(mesh);
 root.updateMatrixWorld(true);
}

import * as T from './vendor/three.module.js';
import{mergeGeometries}from'./vendor/BufferGeometryUtils.js';

// Six shared templates keep each tree independently removable without per-tree GPU assets.
const templates=new Map(),material=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
// Object-space detail stays attached during canopy sway and fades before it becomes subpixel noise.
material.onBeforeCompile=shader=>{
 shader.vertexShader='attribute float treeSurface; varying float treeKind; varying vec3 treePoint;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntreeKind=treeSurface;treePoint=position;');
 shader.fragmentShader=`varying float treeKind; varying vec3 treePoint;
  float treeHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float treeNoise(vec3 p){
   vec3 c=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
   return mix(mix(mix(treeHash(c),treeHash(c+vec3(1,0,0)),f.x),mix(treeHash(c+vec3(0,1,0)),treeHash(c+vec3(1,1,0)),f.x),f.y),
    mix(mix(treeHash(c+vec3(0,0,1)),treeHash(c+vec3(1,0,1)),f.x),mix(treeHash(c+vec3(0,1,1)),treeHash(c+vec3(1,1,1)),f.x),f.y),f.z);
  }
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float treeFootprint=max(length(dFdx(treePoint)),length(dFdy(treePoint)));
  float treeDetail=1.0-smoothstep(.035,.13,treeFootprint),treeRelief=0.0,treeScatter=0.0;
  if(treeKind>.5){
   float treeClump=treeNoise(treePoint*5.0),treeLeaf=smoothstep(.28,.72,treeNoise(treePoint*19.0+vec3(3.1,8.7,1.3)));
   float treeSnow=step(1.5,treeKind);
   treeScatter=(.35+.65*smoothstep(.38,.78,treeClump))*(1.0-treeSnow);
   vec3 treePigment=mix(vec3(.84,.89,.78),vec3(1.12,1.11,1.02),treeLeaf);
   treePigment=mix(treePigment,vec3(.89+treeLeaf*.18),treeSnow);
   diffuseColor.rgb*=mix(vec3(1.0),treePigment,treeDetail)*(.94+treeClump*.12);
   treeRelief=(treeClump*.010+treeLeaf*.004)*treeDetail*mix(1.0,.45,treeSnow);
  }else{
   float treeGrain=treeNoise(treePoint*vec3(27.0,1.15,27.0)),treeFissure=smoothstep(.30,.65,treeGrain);
   float treeBark=treeNoise(treePoint*vec3(53.0,5.0,53.0));
   diffuseColor.rgb*=mix(1.0,.64+treeFissure*.47+treeBark*.18,treeDetail);
   treeRelief=(treeFissure*.018+treeBark*.005)*treeDetail;
  }
 `);
 // A leaf crown scatters a little back-light; bark and snow keep opaque material response.
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
   if(treeKind>.5 && treeKind<1.5){
    float leafTransmission=pow(max(0.0,dot(-normal,directionalLights[0].direction)),2.0);
    reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*vec3(.035,.065,.018)*leafTransmission*treeScatter;
   }
  #endif
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  vec3 treeDx=dFdx(-vViewPosition),treeDy=dFdy(-vViewPosition),treeRx=cross(treeDy,normal),treeRy=cross(normal,treeDx);
  float treeDet=dot(treeDx,treeRx);
  normal=normalize(abs(treeDet)*normal-sign(treeDet)*(dFdx(treeRelief)*treeRx+dFdy(treeRelief)*treeRy));
 `);
};
material.customProgramCacheKey=()=> 'tree-soft-leaf-light';
function tint(geometry,color,canopy=false){
 const p=geometry.attributes.position,n=geometry.attributes.normal,c=new T.Color(color),colors=[];
 for(let i=0;i<p.count;i++){
  const light=canopy?Math.max(0,n.getY(i)):0,angle=Math.atan2(p.getZ(i),p.getX(i)),moss=canopy?0:Math.max(0,1-p.getY(i)/1.25)*.11;
  const grain=canopy?.04*Math.sin(p.getX(i)*2.3+p.getY(i)*1.7+p.getZ(i)*1.3):.11*Math.sin(angle*5+.18*Math.sin(p.getY(i)*2))+.055*Math.cos(angle*9-p.getY(i)*.8);
  const shade=(canopy?.77+light*.25:.82)+grain;colors.push(c.r*shade*(1+light*.045-moss),c.g*(shade+moss*.38),c.b*shade*(1-light*.06-moss*.3));
 }
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.deleteAttribute('uv');return geometry;
}
function merge(parts){const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;}
function surface(vertices,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function limb(points,radii,sides=7){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),up=new T.Vector3(0,1,0),q=new T.Quaternion(),v=new T.Vector3(),vertices=[],indices=[];
 for(let i=0;i<radii.length;i++){
  const t=i/(radii.length-1),center=curve.getPoint(t);q.setFromUnitVectors(up,curve.getTangent(t));
  for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,r=radii[i]*(1+.045*Math.cos(a*3+i*.4));v.set(Math.cos(a)*r,0,Math.sin(a)*r).applyQuaternion(q).add(center);vertices.push(v.x,v.y,v.z);}
 }
 for(let i=0;i<radii.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
 for(const end of[0,radii.length-1]){const p=curve.getPoint(end/(radii.length-1)),center=vertices.length/3;vertices.push(p.x,p.y,p.z);for(let j=0;j<sides;j++){const a=end*sides+j,b=end*sides+(j+1)%sides;indices.push(...(end?[center,b,a]:[center,a,b]));}}
 return surface(vertices,indices);
}
function broadFan(x,y,z,width,depth,height,phase){
 // Rounded, overlapping sprays retain open branch gaps at a human-height camera.
 const sides=12,vertices=[],indices=[],cos=Math.cos(phase),sin=Math.sin(phase);
 const point=(u,h,v)=>vertices.push(x+u*cos-v*sin,y+h*height,z+u*sin+v*cos);
 for(let ring=0;ring<3;ring++)for(let j=0;j<sides;j++){
  const a=j/sides*Math.PI*2,edge=.88+.09*Math.sin(a*5+phase)+.055*Math.sin(a*7-phase*.7)+.055*Math.sin(a*2+phase),r=[1,.72,.29][ring]*edge;
  const h=[.02,.71,.97][ring]+.08*Math.sin(a+phase)*Math.cos(a*2-phase)+(ring?.035:.07)*Math.sin(a*5+phase);
  point(Math.cos(a)*width*r+ring*.07*width,h,Math.sin(a)*depth*r);
 }
 const top=vertices.length/3;point(.14*width,1.02,-.05*depth);const bottom=vertices.length/3;point(.04*width,-.32,0);
 // Separate the lower normals so side-lit crowns retain leafy, irregular edges.
 const rim=vertices.length/3;vertices.push(...vertices.slice(0,sides*3));
 for(let j=0;j<sides;j++){
  const next=(j+1)%sides;
  for(let ring=0;ring<2;ring++){const a=ring*sides+j,b=ring*sides+next;indices.push(a,a+sides,b,b,a+sides,b+sides);}
  indices.push(top,next+sides*2,j+sides*2,bottom,rim+j,rim+next);
 }
 const warm=T.MathUtils.smoothstep(.5+.5*Math.sin(phase*2.7+y*.85),.58,.93);
 const g=surface(vertices,indices),p=g.attributes.position,n=g.attributes.normal,colors=[],shade=new T.Color(),low=new T.Color(0x203e37),middle=new T.Color(0x37674f).lerp(new T.Color(0x667845),warm*.64),topColor=new T.Color(0x79945b).lerp(new T.Color(0xa1a864),warm*.60);
 for(let i=0;i<p.count;i++){
  const rise=(p.getY(i)-y)/height,sun=Math.max(0,n.getY(i)),leaf=.5+.5*Math.sin(p.getX(i)*7.1+p.getY(i)*4.3+phase)*Math.cos(p.getZ(i)*6.2-phase);
  shade.copy(low).lerp(middle,T.MathUtils.smoothstep(rise,-.12,.65)).lerp(topColor,T.MathUtils.smoothstep(rise,.35,1)*(.46+y*.16)).multiplyScalar(.83+sun*.15+leaf*.15);
  colors.push(shade.r,shade.g,shade.b);
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
function rootFlare(angle,snow){
 const reach=snow?.61:.74,width=snow?.12:.16,height=snow?.43:.55,vertices=[0,.04,-width,0,.04,width,reach,.025,width*.16,reach,.025,-width*.16,.13,height,0],indices=[0,1,4,0,4,3,3,4,2,2,4,1,0,2,1,0,3,2];
 const g=surface(vertices,indices);g.rotateY(angle);return g;
}
function firFan(angle,height,reach,width,variant){
 const points=[[0,0,0],[.25,.015,-.78],[.64,-.035,-1],[1,-.18,-.06],[.66,-.075,.76],[.28,-.015,1],[0,.005,.12],[.44,.15,.01],[.40,-.12,0]],vertices=[];
 for(const [r,h,side]of points){const x=r*reach,z=side*width;vertices.push(Math.cos(angle)*x-Math.sin(angle)*z,height+h*reach,Math.sin(angle)*x+Math.cos(angle)*z);}
 const indices=[];for(let i=0;i<7;i++){indices.push(7,(i+1)%7,i,8,i,(i+1)%7);}
 const g=surface(vertices,indices),colors=[],c=new T.Color();
 for(let i=0;i<points.length;i++){
  // Snow collects on the upper ridge; blue needles remain visible on the low edges.
  c.setHex(i===7?0xd5e0d8:i===8?0x395e60:i===0||i===6?0x5b8381:i===3?0x789b95:((i+variant)%3?0xbacdc4:0x6f9890));colors.push(c.r,c.g,c.b);
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
function treeTemplate(id,variant){
 const key=id+variant;if(templates.has(key))return templates.get(key);const snow=id==='snow',wood=snow?0x687675:0x665b43;
 const trunkHeight=5,lean=(variant-1)*.16,branches=[tint(limb([[0,0,0],[.05,.42,-.015],[lean-.16,1.65,.085],[lean*.6+.10,3.35,-.075],[lean-.04,5,.09]],snow?[.35,.25,.18,.10,.035]:[.49,.31,.245,.15,.035],8),wood)];
 for(let i=0;i<4;i++)branches.push(tint(rootFlare(i*Math.PI*.5+variant*.67,snow),wood));
 for(let i=0;i<(snow?3:4);i++){
  const a=i*2.15+variant*.71,cos=Math.cos(a),sin=Math.sin(a),start=snow?2.8+i*.42:1.88+i*.48,reach=snow?.62:1.18-(i%2)*.12,tip=snow?start+.65:3.64+i*.31;
  branches.push(tint(limb([[lean*.7,start,0],[cos*reach*.38,start+.48,sin*reach*.30],[cos*reach*.78,tip-.12,sin*reach*.74],[cos*reach,tip,sin*reach]],snow?[.09,.052,.018]:[.19-i*.018,.105,.017],snow?4:6),wood));
  if(!snow){
   branches.push(tint(limb([[cos*reach*.42,start+.58,sin*reach*.34],[cos*reach*.68,tip-.18,sin*reach*.50],[Math.cos(a+.6)*reach*.86,tip+.32,Math.sin(a+.6)*reach*.86]],[.075,.035,.008],3),wood));
   branches.push(tint(limb([[cos*reach*.69,tip-.22,sin*reach*.64],[Math.cos(a-.35)*reach*.91,tip-.04,Math.sin(a-.35)*reach*.91],[Math.cos(a-.45)*reach*1.1,tip+.08,Math.sin(a-.45)*reach*1.1]],[.048,.025,.005],3),wood));
  }
 }
 const crowns=[];
 if(snow){
  for(let layer=0;layer<4;layer++)for(let j=0;j<4;j++){
   const a=j*Math.PI*.5+layer*.75+variant*.57,reach=(1.42-layer*.23)*(1+Math.sin(j*2.2+variant)*.09);
   crowns.push(firFan(a,.33+layer*.57,reach,.39-layer*.057,(j+variant)%3));
  }
  const leader=new T.LatheGeometry([[0,0],[.31,.08],[.22,.34],[.05,.65],[0,.74]].map(([r,h])=>new T.Vector2(r,h)),6);leader.translate(lean*.25,2.02,.025);crowns.push(tint(leader,0xb7cdc1,true));
 }else{
  // Each fork carries three uneven terminal sprays. Their offsets expose branches between them.
  for(let branch=0;branch<4;branch++){
   const a=branch*2.15+variant*.71,y=.08+branch*.32,r=.80+(branch%2)*.06;
   for(let twig=0;twig<3;twig++){
    const side=twig-1,angle=a+side*.53,reach=r+(twig===1?.18:-.06),rise=y+(twig===1?.17:side*.11);
    crowns.push(broadFan(Math.cos(angle)*reach,rise,Math.sin(angle)*reach,twig===1?.66:.57,twig===1?.45:.39,.51+(branch%2)*.06,angle+.16*side));
   }
  }
  for(let j=0;j<3;j++){
   const a=j*2.3+variant*.8,r=j===2?.14:.36;
   crowns.push(broadFan(Math.cos(a)*r,1.36+j*.22,Math.sin(a)*r,.59-j*.07,.42-j*.025,.49,a));
  }
 }
 const canopy=merge(crowns),bottom=canopy.boundingBox.min.y;canopy.translate(0,-bottom,0);canopy.computeBoundingBox();
 const trunk=merge(branches);
 for(const [geometry,kind]of[[trunk,0],[canopy,snow?2:1]])geometry.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(kind),1));
 const template={trunk,trunkHeight,canopy,canopyHeight:canopy.boundingBox.max.y};templates.set(key,template);return template;
}
export function addTree(parent,id,tall,{angle=0,variation=1,bend=0}={}){
 const variant=Math.abs(Math.floor(angle*1.7))%3,template=treeTemplate(id,variant),height=id==='snow'?5.2+tall*.52:5.6+tall*.26,canopyHeight=height*(id==='snow'?.46:.43),width=(.88+variation*.12)*(id==='snow'?1:1.34);
 parent.userData.treeBiome=id;parent.rotation.y=angle;
 const trunk=new T.Mesh(template.trunk,material);trunk.name='tree-trunk';trunk.scale.set(.94+variation*.06,(height-canopyHeight*.32)/template.trunkHeight,.94+variation*.06);trunk.rotation.z=bend*.10;
 const canopy=new T.Mesh(template.canopy,material);canopy.name='tree-canopy';canopy.userData.treeCanopy=true;canopy.position.set(bend*.5,height-canopyHeight,0);canopy.scale.set(width,canopyHeight/template.canopyHeight,width*(.94+variant*.035));
 for(const mesh of[trunk,canopy]){mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);}return canopy;
}

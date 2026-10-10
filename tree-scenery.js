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
   // Thin leaves carry their variation in vertices, rather than noisy swollen surfaces.
   treeScatter=1.0-step(1.5,treeKind);
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
material.customProgramCacheKey=()=> 'tree-open-leaf-sprays';
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
// One bounded, canvas-free atlas is shared by all forest crowns. Its real alpha gaps
// are also consumed by Three's standard shadow depth pass; there is no blended layer.
function leafAtlas(){
 const size=256,data=new Uint8Array(size*size*4),random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
 for(let i=0;i<data.length;i+=4){data[i]=66;data[i+1]=91;data[i+2]=46;}
 for(let leaf=0;leaf<240;leaf++){
  const angle=leaf*2.399963,rad=.398*Math.sqrt((leaf+.5)/240),cx=.5+Math.cos(angle)*rad,cy=.5+Math.sin(angle)*rad;
  const direction=angle*.47+random(leaf+100)*4,cos=Math.cos(direction),sin=Math.sin(direction),length=.085+random(leaf+200)*.060,half=.023+random(leaf+300)*.016,warm=random(leaf+400);
  const extent=(length*.5+half)*size,x0=Math.max(0,Math.floor(cx*size-extent)),x1=Math.min(size-1,Math.ceil(cx*size+extent)),y0=Math.max(0,Math.floor(cy*size-extent)),y1=Math.min(size-1,Math.ceil(cy*size+extent));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const dx=(x+.5)/size-cx,dy=(y+.5)/size-cy,t=(dx*cos+dy*sin)/length+.5,across=-dx*sin+dy*cos;
   if(t<=0||t>=1)continue;
   const outline=half*Math.pow(Math.sin(t*Math.PI),.80)*(1+.055*Math.sin(t*31+leaf)),distance=(outline-Math.abs(across))*size,alpha=Math.round(T.MathUtils.clamp(distance+.5,0,1)*255);
   if(!alpha)continue;
   const fold=across>0?.95:1.04,vein=Math.abs(across)<.0015?1.03:1,light=(.84+t*.21)*fold*vein,index=(y*size+x)*4;
   data[index]=Math.round((82+warm*27)*light);data[index+1]=Math.round((113+warm*26)*light);data[index+2]=Math.round((51+warm*16)*light);data[index+3]=Math.max(data[index+3],alpha);
  }
 }
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.name='shared-tree-leaf-atlas';texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}
const leafMaterial=new T.MeshStandardMaterial({name:'shared-cutout-leaves',map:leafAtlas(),vertexColors:true,roughness:.96,side:T.DoubleSide,alphaTest:.30,transparent:false});
const firMaterial=material.clone();firMaterial.side=T.DoubleSide;firMaterial.onBeforeCompile=material.onBeforeCompile;firMaterial.customProgramCacheKey=()=> 'tree-feathered-fir';
leafMaterial.onBeforeCompile=shader=>{
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=vec3(1.13,1.10,1.02);');
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
   float leafTransmission=pow(max(0.0,dot(-normal,directionalLights[0].direction)),2.0);
   reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*vec3(.085,.12,.045)*leafTransmission;
  #endif
 `);
};
leafMaterial.customProgramCacheKey=()=> 'tree-soft-transmitted-sprays';
function broadFan(x,y,z,width,depth,height,phase){
 // Five small curved sprays sit around a twig, rather than intersecting at one large card.
 // The six-triangle fans keep their alpha silhouette and use 25% fewer canopy triangles.
 const vertices=[],indices=[],colors=[],uvs=[],normal=new T.Vector3(),across=new T.Vector3(),along=new T.Vector3(),point=new T.Vector3(),up=new T.Vector3(0,1,0);
 for(let spray=0;spray<5;spray++){
  const angle=phase+spray*2.399,first=vertices.length/3,tilt=[.25,.82,-.18,.45,.65][spray],cx=x+Math.cos(angle)*width*.34,cy=y+height*(.24+.22*Math.sin(spray*1.9+phase)),cz=z+Math.sin(angle)*depth*.40;
  normal.set(Math.cos(angle)*.72,tilt,Math.sin(angle)*.72).normalize();across.crossVectors(up,normal).normalize();along.crossVectors(normal,across);
  const vertex=(u,v,bow)=>{
   point.set(cx,cy,cz).addScaledVector(across,u*width*.72).addScaledVector(along,v*depth*.96).addScaledVector(normal,bow*height);
   vertices.push(point.x,point.y,point.z);uvs.push(.5+u*.5,.5+v*.5);
   const shade=.83+(normal.y+1)*.075+spray*.012,warm=.5+.5*Math.sin(phase*2.7+spray);
   colors.push(Math.min(1,shade*(.97+warm*.06)),Math.min(1,shade),Math.min(1,shade*(.89-warm*.04)));
  };
  vertex(0,0,.14);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;vertex(Math.cos(a)*1.17,Math.sin(a)*1.17,-.025+.025*Math.sin(a*2+phase));}
  for(let i=0;i<6;i++)indices.push(first,first+1+i,first+1+(i+1)%6);
 }
 const g=surface(vertices,indices);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));return g;
}
function rootFlare(angle,snow){
 const reach=snow?.61:.74,width=snow?.12:.16,height=snow?.43:.55,vertices=[0,.04,-width,0,.04,width,reach,.025,width*.16,reach,.025,-width*.16,.13,height,0],indices=[0,1,4,0,4,3,3,4,2,2,4,1,0,2,1,0,3,2];
 const g=surface(vertices,indices);g.rotateY(angle);return g;
}
function firFan(angle,height,reach,width,variant){
 // Alternate needle sprays open real gaps along the bough; snow stays on their folded ridges.
 const vertices=[],indices=[],colors=[],c=new T.Color(),cos=Math.cos(angle),sin=Math.sin(angle);
 for(let leaf=0;leaf<7;leaf++){
  const start=.08+Math.floor(leaf/2)*.24,side=leaf%2?1:-1,tip=start+.34,spread=side*(1-start*.45),first=vertices.length/3;
  // The final narrow midrib joins all three leaflet pairs back to the trunk.
  const points=leaf===6?[[0,0,0],[.52,-.052,.025],[1,-.16,0],[.52,-.052,-.025]]:[[start,-start*.10,0],[start+.13,.075-start*.13,spread*.46-.16],[tip,-tip*.16,spread],[start+.20,-.055-start*.12,spread*.52+.16]];
  for(const [i,[r,h,z]]of points.entries()){
   const x=r*reach,depth=z*width;vertices.push(cos*x-sin*depth,height+h*reach,sin*x+cos*depth);
   c.setHex(leaf===6?0x58685b:i===0?0x486e6b:i===1?0xd5e0d8:i===2?((leaf+variant)%3?0xaec5bd:0x789b95):0x6d9491);colors.push(c.r,c.g,c.b);
  }
  indices.push(first,first+2,first+1,first,first+3,first+2);
 }
 const g=surface(vertices,indices);
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
function treeTemplate(id,variant){
 const key=id+variant;if(templates.has(key))return templates.get(key);const snow=id==='snow',wood=snow?0x687675:0x665b43;
 const trunkHeight=5,lean=(variant-1)*.16,branches=[tint(limb([[0,0,0],[.05,.42,-.015],[lean-.16,1.65,.085],[lean*.6+.10,3.35,-.075],[lean-.04,5,.09]],snow?[.35,.25,.18,.10,.035]:[.49,.31,.245,.15,.035],8),wood)];
 for(let i=0;i<4;i++)branches.push(tint(rootFlare(i*Math.PI*.5+variant*.67,snow),wood));
 for(let i=0;i<(snow?3:4);i++){
  const a=i*2.15+variant*.71,cos=Math.cos(a),sin=Math.sin(a),start=snow?2.8+i*.42:1.88+i*.48,reach=snow?.62:1.18-(i%2)*.12,tip=snow?start+.65:3.64+i*.31;
  branches.push(tint(limb([[lean*.7,start,0],[cos*reach*.38,start+.48,sin*reach*.30],[cos*reach*.78,tip-.12,sin*reach*.74],[cos*reach,tip,sin*reach]],snow?[.09,.052,.018]:[.19-i*.018,.105,.017],snow?4:6),wood));
 }
 const crowns=[],tips=[];
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
    const x=Math.cos(angle)*reach,z=Math.sin(angle)*reach,h=.51+(branch%2)*.06;
    crowns.push(broadFan(x,rise,z,twig===1?.66:.57,twig===1?.45:.39,h,angle+.16*side));tips.push({x,y:rise+h*.24,z,branch});
   }
  }
  for(let j=0;j<3;j++){
   const a=j*2.3+variant*.8,r=j===2?.14:.36;
   const x=Math.cos(a)*r,z=Math.sin(a)*r,y=1.36+j*.22;crowns.push(broadFan(x,y,z,.59-j*.07,.42-j*.025,.49,a));tips.push({x,y:y+.49*.24,z,branch:4});
  }
 }
 const canopy=merge(crowns),bottom=canopy.boundingBox.min.y;canopy.translate(0,-bottom,0);canopy.computeBoundingBox();
 // Match twig tips to the same normalized crown coordinates used by addTree.
 // Thus tall trees keep supported leaf groups without changing their overall height or collision radius.
 if(!snow)for(const tip of tips){
  const b=tip.branch,a=b*2.15+variant*.71,reach=1.18-b%2*.12,base=b===4?[lean*.6,4.5,0]:[Math.cos(a)*reach*.58,3.64+b*.31-.24,Math.sin(a)*reach*.58];
  const end=[tip.x*2.04,((tip.y-bottom)/canopy.boundingBox.max.y*.47+.53)*5/.8496,tip.z*2.04*(.94+variant*.035)],middle=base.map((v,i)=>T.MathUtils.lerp(v,end[i],.55)+(i===1?.10:0));
  branches.push(tint(limb([base,middle,end],[.044,.024,.006],3),wood));
 }
 const trunk=merge(branches);
 for(const [geometry,kind]of[[trunk,0],[canopy,snow?2:1]])geometry.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(kind),1));
 const template={trunk,trunkHeight,canopy,canopyHeight:canopy.boundingBox.max.y};templates.set(key,template);return template;
}
export function addTree(parent,id,tall,{angle=0,variation=1,bend=0}={}){
 const variant=Math.abs(Math.floor(angle*1.7))%3,template=treeTemplate(id,variant),height=id==='snow'?5.2+tall*.52:5.6+tall*.26,canopyHeight=height*(id==='snow'?.46:.47),width=(.88+variation*.12)*(id==='snow'?1:2.04);
 parent.userData.treeBiome=id;parent.rotation.y=angle;
 const trunk=new T.Mesh(template.trunk,material);trunk.name='tree-trunk';trunk.scale.set(.94+variation*.06,(height-canopyHeight*.32)/template.trunkHeight,.94+variation*.06);trunk.rotation.z=bend*.10;
 const canopy=new T.Mesh(template.canopy,id==='snow'?firMaterial:leafMaterial);canopy.name='tree-canopy';canopy.userData.treeCanopy=true;canopy.position.set(bend*.5,height-canopyHeight,0);canopy.scale.set(width,canopyHeight/template.canopyHeight,width*(.94+variant*.035));
 for(const mesh of[trunk,canopy]){mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);}return canopy;
}

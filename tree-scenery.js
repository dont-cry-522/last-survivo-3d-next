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
   data[index]=Math.round((91+warm*24)*light);data[index+1]=Math.round((118+warm*24)*light);data[index+2]=Math.round((68+warm*20)*light);data[index+3]=Math.max(data[index+3],alpha);
  }
 }
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.name='shared-tree-leaf-atlas';texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}
const leafMaterial=new T.MeshStandardMaterial({name:'shared-cutout-leaves',map:leafAtlas(),vertexColors:true,roughness:.96,side:T.DoubleSide,alphaTest:.30,transparent:false});
const firMaterial=material.clone();firMaterial.side=T.DoubleSide;
firMaterial.onBeforeCompile=shader=>{
 material.onBeforeCompile(shader);
 // The distant folded spray is double-sided; its underside stays needle-green.
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb*=vec3(.40,.56,.52);');
};
firMaterial.customProgramCacheKey=()=> 'tree-rounded-snow-sprays';
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
function sprayPose(x,y,z,width,depth,height,phase,spray){
 const angle=phase+spray*2.399,tilt=[.30,.92,-.32,.54,.14][spray],normal=new T.Vector3(Math.cos(angle)*.72,tilt,Math.sin(angle)*.72).normalize();
 const across=new T.Vector3().crossVectors(new T.Vector3(0,1,0),normal).normalize(),along=new T.Vector3().crossVectors(normal,across);
 const center=new T.Vector3(x+Math.cos(angle)*width*.30,y+height*(.19+.38*Math.sin(spray*1.9+phase)),z+Math.sin(angle)*depth*.36);
 return{center,normal,across,along};
}
const sprayBow=(u,v)=>.18-.20*(u*u+v*v)/(1.17*1.17);
function broadFan(x,y,z,width,depth,height,phase){
 // Five small curved sprays sit around a twig, rather than intersecting at one large card.
 // The six-triangle fans keep their alpha silhouette and use 25% fewer canopy triangles.
 const vertices=[],indices=[],colors=[],uvs=[],normals=[],point=new T.Vector3(),shading=new T.Vector3();
 for(let spray=0;spray<5;spray++){
  const first=vertices.length/3,{center,normal,across,along}=sprayPose(x,y,z,width,depth,height,phase,spray);
  const vertex=(u,v)=>{
   point.copy(center).addScaledVector(across,u*width*.72).addScaledVector(along,v*depth*.96).addScaledVector(normal,sprayBow(u,v)*height);
   vertices.push(point.x,point.y,point.z);uvs.push(.5+u*.5,.5+v*.5);
   // Continuous dome normals avoid six broad triangular highlights across one leaf cluster.
   shading.copy(normal).addScaledVector(across,.40*height*u/(1.17*1.17*width*.72)).addScaledVector(along,.40*height*v/(1.17*1.17*depth*.96)).normalize();normals.push(shading.x,shading.y,shading.z);
   const shade=.83+(normal.y+1)*.075+spray*.012,warm=.5+.5*Math.sin(phase*2.7+spray);
   colors.push(Math.min(1,shade*(.97+warm*.06)),Math.min(1,shade),Math.min(1,shade*(.89-warm*.04)));
  };
  vertex(0,0);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,r=1.17*(.95+.035*Math.sin(a*3+phase+spray*.6)+.015*Math.cos(a*2-phase));vertex(Math.cos(a)*r,Math.sin(a)*r);}
  for(let i=0;i<6;i++)indices.push(first,first+1+i,first+1+(i+1)%6);
 }
 const g=surface(vertices,indices);g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));return g;
}
function rootFlare(angle,snow){
 if(!snow){
  const g=limb([[0,.22,0],[.23,.13,.035],[.48,.06,-.025],[.74,.025,.015]],[.18,.14,.075,.004],5),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,Math.max(.018,p.getY(i)*.8));
  g.computeVertexNormals();g.rotateY(angle);return g;
 }

 const reach=snow?.61:.74,width=snow?.12:.16,height=snow?.43:.55,vertices=[0,.04,-width,0,.04,width,reach,.025,width*.16,reach,.025,-width*.16,.13,height,0],indices=[0,1,4,0,4,3,3,4,2,2,4,1,0,2,1,0,3,2];
 const g=surface(vertices,indices);g.rotateY(angle);return g;
}
function firFan(angle,height,reach,width,variant,level){
 // Unequal paired needle cushions carry a curved snow ridge. Close LODs include
 // the dark lower surface, so looking up sees foliage rather than white cards.
 const vertices=[],indices=[],colors=[],normals=[],c=new T.Color(),normal=new T.Vector3(),cos=Math.cos(angle),sin=Math.sin(angle),needles=new T.Color(0x55766b),snow=new T.Color(0xd0dfd9);
 const vertex=(x,y,z,nx,ny,nz,cover)=>{
  vertices.push(cos*x-sin*z,y,sin*x+cos*z);normal.set(nx,ny,nz).normalize();normals.push(cos*normal.x-sin*normal.z,normal.y,sin*normal.x+cos*normal.z);
  c.copy(needles).lerp(snow,cover);colors.push(c.r,c.g,c.b);return vertices.length/3-1;
 };
 for(let leaf=0;leaf<6;leaf++){
  const start=.08+Math.floor(leaf/2)*.24+Math.sin(angle+leaf*1.9+variant)*.026,side=leaf%2?1:-1,spread=1-start*.45;
  const x=(start+.19)*reach,z=side*spread*width*.43,y=height-(start+.17)*reach*.17,rx=reach*(.215+.015*Math.sin(angle+leaf)),rz=spread*width*.45,rise=reach*(.065+.02*Math.sin(angle*2+leaf+variant)),drop=reach*.035;
  const point=(u,v,depth=0,lower=false)=>{
   const q=u*u+v*v,edge=q>.99,py=y-u*rx*.20-side*v*rz*.15+(lower?-drop:rise)*(1-q);
   return vertex(x+u*rx,py,z+v*rz,edge?u/rx:.20+2*(lower?-drop:rise)*u/rx,edge?.10:lower?-1:1,edge?v/rz:side*.15+2*(lower?-drop:rise)*v/rz,level===2?.48+.045*Math.sin(leaf+u):lower?.06:edge?.22:.74-depth*.13);
  };
  if(level===2){
   const first=vertices.length/3;for(let i=0;i<4;i++){const a=i*Math.PI*.5;point(Math.cos(a),Math.sin(a));}
   indices.push(first,first+2,first+1,first,first+3,first+2);
  }else{
   const sides=level===0?8:4,center=point(0,0),rings=[];
   for(const radius of level===0?[.55,1]:[1]){
    const ring=[];for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;ring.push(point(Math.cos(a)*radius,Math.sin(a)*radius,radius));}rings.push(ring);
   }
   for(let i=0;i<sides;i++)indices.push(center,rings[0][(i+1)%sides],rings[0][i]);
   if(rings.length===2)for(let i=0;i<sides;i++){const j=(i+1)%sides,a=rings[0],b=rings[1];indices.push(a[i],a[j],b[i],a[j],b[j],b[i]);}
   const bottom=point(0,0,0,true),rim=rings.at(-1);
   for(let i=0;i<sides;i++)indices.push(bottom,rim[i],rim[(i+1)%sides]);
  }
 }
 // The fine curved midrib remains visible through the gaps between cushions.
 const first=vertices.length/3;
 for(const [r,h,z]of[[0,0,0],[.52,-.040,.028],[1,-.24,0],[.52,-.040,-.028]])vertex(r*reach,height+h*reach,z*width,0,1,0,.04);
 indices.push(first,first+1,first+2,first,first+2,first+3);
 const g=surface(vertices,indices);g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
function firCrown(variant,level){
 const parts=[];
 for(let layer=0;layer<4;layer++)for(let j=0;j<4;j++){
  const a=j*Math.PI*.5+layer*.75+variant*.57+Math.sin(j*2.8+layer+variant)*.10,reach=(1.42-layer*.23)*(1+Math.sin(j*2.2+variant+layer*.7)*.09),rise=Math.sin(j*1.8+variant+layer*2.4)*.105;
  parts.push(firFan(a,.38+layer*.56+rise,reach,(.42-layer*.061)*1.12*(1+Math.cos(j*1.7+layer)*.08),(j+variant)%3,level));
 }
 // Short, tapering sprays grow from one eccentric leader rather than carrying
 // detached snowballs. The sparse green tip continues the upper branch group.
 const lean=(variant-1)*.04,leader=limb([[lean+.01,1.94,0],[lean+.04,2.35,-.018],[lean+.065,2.76,0]],[.035,.020,.003],3),p=leader.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,Math.min(2.76,p.getY(i)));
 parts.push(tint(leader,0x577568));
 for(let j=0;j<3;j++){
  const y=[2.18,2.42,2.65][j],t=(y-1.94)/.82,g=firFan(j*2.399+variant*.71,y,[.38,.29,.18][j],[.15,.115,.085][j],(j+variant)%3,level);
  g.translate(lean+.01+t*.055,0,-Math.sin(t*Math.PI)*.018);parts.push(g);
 }
 return merge(parts);
}
function treeTemplate(id,variant){
 const key=id+variant;if(templates.has(key))return templates.get(key);const snow=id==='snow',wood=snow?0x687675:0x665b43;
 const trunkHeight=5,lean=(variant-1)*.16,branches=[tint(limb([[0,0,0],[.05,.42,-.015],[lean-.16,1.65,.085],[lean*.6+.10,3.35,-.075],[lean-.04,5,.09]],snow?[.35,.25,.18,.10,.035]:[.49,.31,.245,.15,.035],8),wood)];
 for(let i=0;i<4;i++)branches.push(tint(rootFlare(i*Math.PI*.5+variant*.67,snow),wood));
 for(let i=0;i<(snow?3:4);i++){
  const a=i*2.15+variant*.71,cos=Math.cos(a),sin=Math.sin(a),start=snow?2.8+i*.42:1.88+i*.48,reach=snow?.62:1.18-(i%2)*.12,tip=snow?start+.65:3.64+i*.31;
  branches.push(tint(limb([[lean*.7,start,0],[cos*reach*.38,start+.48,sin*reach*.30],[cos*reach*.78,tip-.12,sin*reach*.74],[cos*reach,tip,sin*reach]],snow?[.09,.052,.018]:[.19-i*.018,.105,.017],snow?4:6),wood));
 }
 const crowns=[],tips=[],sprays=[];
 if(snow){
  crowns.push(firCrown(variant,2));
 }else{
  // Each fork carries three uneven terminal sprays. Their offsets expose branches between them.
  for(let branch=0;branch<4;branch++){
   const a=branch*2.15+variant*.71,y=[.09,.57,.36,.94][branch]+Math.sin(a*1.7+variant)*.13,r=.77+(branch%2)*.09;
   for(let twig=0;twig<3;twig++){
    const side=twig-1,angle=a+side*(.48+variant*.07),reach=r+(twig===1?.16:-.09)+Math.sin(branch*2.7+twig+variant)*.045,rise=y+(twig===1?.25:side*.19)+Math.cos(twig*2.1+a)*.075;
    const spread=variant===1?.86:1,depth=variant===2?.81:1;
    const x=Math.cos(angle)*reach*spread,z=Math.sin(angle)*reach*depth,leafY=rise+(variant===2?Math.sin(a)*.19:0),h=(.64+(branch%2)*.09)*(variant===1?1.12:1);
    sprays.push([x,leafY,z,(twig===1?.66:.57)*spread,(twig===1?.45:.39)*depth,h,angle+.16*side]);crowns.push(broadFan(...sprays.at(-1)));tips.push({x,y:leafY+h*.24,z,branch});
   }
  }
  for(let j=0;j<3;j++){
   const a=j*2.3+variant*.8,r=j===2?.14:.36;
   const x=Math.cos(a)*r,z=Math.sin(a)*r,y=1.29+j*.23+Math.sin(a)*.12;sprays.push([x,y,z,.59-j*.07,.42-j*.025,.65,a]);crowns.push(broadFan(...sprays.at(-1)));tips.push({x,y:y+.65*.24,z,branch:4});
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
 const template={trunk,trunkHeight,canopy,canopyHeight:canopy.boundingBox.max.y,sprays,bottom,snow,variant,lods:[null,null,canopy]};templates.set(key,template);return template;
}
export function addTree(parent,id,tall,{angle=0,variation=1,bend=0}={}){
 const variant=Math.abs(Math.floor(angle*1.7))%3,template=treeTemplate(id,variant),height=id==='snow'?5.2+tall*.52:5.6+tall*.26,canopyHeight=height*(id==='snow'?.46:.47),width=(.88+variation*.12)*(id==='snow'?1:2.04);
 parent.userData.treeBiome=id;parent.rotation.y=angle;
 const trunk=new T.Mesh(template.trunk,material);trunk.name='tree-trunk';trunk.scale.set(.94+variation*.06,(height-canopyHeight*.32)/template.trunkHeight,.94+variation*.06);trunk.rotation.z=bend*.10;
 // Snow hangs slightly lower while its top and the independently scaled trunk stay fixed.
 const snowDrop=id==='snow'?.24:0,canopy=new T.Mesh(template.canopy,id==='snow'?firMaterial:leafMaterial);canopy.name='tree-canopy';canopy.userData.treeCanopy=true;canopy.userData.treeTemplate=template;canopy.userData.treeLOD=2;canopy.position.set(bend*.5,height-canopyHeight-snowDrop,0);canopy.scale.set(width,(canopyHeight+snowDrop)/template.canopyHeight,width*(.94+variant*.035));
 for(const mesh of[trunk,canopy]){mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);}return canopy;
}

// Add folded leaves to the existing silhouette, rather than swapping it for a
// different crown. All three variants share their LOD geometries and material.
// The constant UV samples one opaque leaf texel; vertex tint supplies leaf veins.
function detailedCrown(template,level){
 if(template.lods[level])return template.lods[level];
 if(template.snow){
  const g=firCrown(template.variant,level),p=g.attributes.position,bounds=template.canopy.boundingBox;g.translate(0,-template.bottom,0);
  // Snow detail cannot widen a walkable gap or change the overhead envelope.
  for(let i=0;i<p.count;i++)p.setXYZ(i,T.MathUtils.clamp(p.getX(i),bounds.min.x,bounds.max.x),T.MathUtils.clamp(p.getY(i),bounds.min.y,bounds.max.y),T.MathUtils.clamp(p.getZ(i),bounds.min.z,bounds.max.z));
  g.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(p.count).fill(2),1));g.computeBoundingBox();g.computeBoundingSphere();return template.lods[level]=g;
 }
 const p=[],ix=[],uv=[],colors=[],point=new T.Vector3();
 const image=leafMaterial.map.image;let pixel=0;
 for(let i=0;i<image.data.length;i+=4)if(image.data[i+3]===255){pixel=i/4;break;}
 const u=(pixel%image.width+.5)/image.width,v=(Math.floor(pixel/image.width)+.5)/image.height,count=level===0?16:6;
 for(const [x,y,z,width,depth,height,phase]of template.sprays)for(let spray=0;spray<5;spray++){
  const {center,normal,across,along}=sprayPose(x,y,z,width,depth,height,phase,spray);
  for(let leaf=0;leaf<count;leaf++){
   const a=leaf*2.399+phase,r=Math.sqrt((leaf+.5)/count),cx=Math.cos(a)*r*width*.68,cy=Math.sin(a)*r*depth*.91;
   const direction=a*.47+spray,co=Math.cos(direction),si=Math.sin(direction),length=.11+.055*(.5+.5*Math.sin(leaf*7+phase)),w=length*.24,first=p.length/3;
   const leafU=cx/(width*.72),leafV=cy/(depth*.96),leafCenter=center.clone().addScaledVector(across,cx).addScaledVector(along,cy).addScaledVector(normal,height*sprayBow(leafU,leafV));
   const leafNormal=normal.clone().addScaledVector(across,.40*height*leafU/(1.17*1.17*width*.72)).addScaledVector(along,.40*height*leafV/(1.17*1.17*depth*.96)).normalize();
   const leafAcross=across.clone().addScaledVector(leafNormal,-across.dot(leafNormal)).normalize(),leafAlong=new T.Vector3().crossVectors(leafNormal,leafAcross);
   // Six vertices, six triangles: raised midrib and drooping tip retain a smooth folded profile.
   const shape=[[0,-length*.5,length*.07],[0,0,length*.12],[-w,0,length*.025],[0,length*.55,-length*.04],[w,0,length*.025],[0,length*.25,length*.065]];
   for(const [i,[lx,ly,bow]]of shape.entries()){
    // The local tangent follows the curved spray without stretching individual leaves.
    point.copy(leafCenter).addScaledVector(leafAcross,lx*co-ly*si).addScaledVector(leafAlong,lx*si+ly*co).addScaledVector(leafNormal,bow);
    p.push(point.x,point.y-template.bottom,point.z);uv.push(u,v);
    const shade=(i===1||i===5?1:.83)+.08*Math.sin(a*3+spray);colors.push(Math.min(1,shade*.98),Math.min(1,shade),shade*.86);
   }
   ix.push(first,first+1,first+2,first+2,first+1,first+5,first+2,first+5,first+3,first,first+4,first+1,first+4,first+5,first+1,first+4,first+3,first+5);
  }
 }
 const detail=surface(p,ix);detail.setAttribute('uv',new T.Float32BufferAttribute(uv,2));detail.setAttribute('color',new T.Float32BufferAttribute(colors,3));detail.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(p.length/3).fill(1),1));
 // Keep extra leaves inside the existing crown envelope, preserving camera clearance.
 const bounds=template.canopy.boundingBox,a=detail.attributes.position;
 for(let i=0;i<a.count;i++)a.setXYZ(i,T.MathUtils.clamp(a.getX(i),bounds.min.x,bounds.max.x),T.MathUtils.clamp(a.getY(i),bounds.min.y,bounds.max.y),T.MathUtils.clamp(a.getZ(i),bounds.min.z,bounds.max.z));
 detail.computeVertexNormals();
 return template.lods[level]=merge([template.canopy.clone(),detail]);
}
export function updateTreeDetail(canopy,x,z){
 const template=canopy.userData.treeTemplate,parent=canopy.parent;if(!template||!parent)return;
 const distance=Math.hypot(parent.position.x-x,parent.position.z-z),previous=canopy.userData.treeLOD;
 // 10/30 metre bands with hysteresis prevent repeated swaps while standing at a boundary.
 const near=previous===0?11:9,far=previous===2?28:32,level=distance<near?0:distance<far?1:2;
 if(level===previous)return;
 canopy.geometry=level===2?template.canopy:detailedCrown(template,level);canopy.userData.treeLOD=level;
}

// Backdrop trees remain wholly outside the playable square, on its low foothills.
// Six batches, shared far geometry, no collision, no per-frame updates or lights.
export function installForestBackdrop(world,id,biomeAt=()=>id){
 if(id!=='forest'&&id!=='confluence')return null;
 if(world.forestBackdrop&&!world.forestBackdrop.userData.disposed)return world.forestBackdrop;
 const group=new T.Group(),records=[],dummy=new T.Object3D(),matrix=new T.Matrix4(),color=new T.Color();group.name='SM_Forest_Backdrop_A';group.userData={records,disposed:false};
 for(let i=0;i<240;i++){
  const base=i/240*Math.PI*2,angle=base+.07*Math.sin(base*7)+.025*Math.sin(base*13)+Math.sin(i*13.7)*.007,s=Math.sin(angle),c=Math.cos(angle),edge=world.half/Math.max(Math.abs(s),Math.abs(c));
  if(id==='confluence'&&biomeAt(s*edge,c*edge)!=='forest')continue;
  // Irregular thickets and openings replace three evenly spaced fence-like rows.
  const radius=edge+11+Math.sin(angle*9+.4)**2*8+Math.sin(i*5.7)*1.5;
  records.push({x:s*radius,z:c*radius,y:-.35,scale:1.25+.18*Math.sin(i*1.7)+.12*(i%3),angle,variant:i%3});
 }
 for(let variant=0;variant<3;variant++){
  const list=records.filter(p=>p.variant===variant);if(!list.length)continue;
  const source=new T.Group();addTree(source,'forest',4,{angle:variant===2?1.5:variant});
  const template=treeTemplate('forest',variant);
  if(!template.backdropTrunk){
   const lean=(variant-1)*.16,parts=[tint(limb([[0,0,0],[lean-.12,2.5,.06],[lean,5,0]],[.35,.20,.025],5),0x665b43)];
   for(const side of[-1,1])parts.push(tint(limb([[0,2.7,0],[side*.6,3.6,side*.2],[side,4.3,side*.4]],[.12,.065,.008],4),0x665b43));
   template.backdropTrunk=merge(parts);template.backdropTrunk.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(template.backdropTrunk.attributes.position.count),1));
  }
  source.children[0].geometry=template.backdropTrunk;
  for(const part of source.children){
   part.updateMatrix();const batch=new T.InstancedMesh(part.geometry,part.material,list.length);batch.name=part.name+'-backdrop';batch.receiveShadow=true;
   for(const [i,p]of list.entries()){
    dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();matrix.multiplyMatrices(dummy.matrix,part.matrix);batch.setMatrixAt(i,matrix);batch.setColorAt(i,color.setHex(0xb8c9b8).multiplyScalar(.88+.12*Math.sin(p.angle*5)**2));
   }
   batch.computeBoundingSphere();batch.addEventListener('dispose',()=>{batch.visible=false;group.userData.disposed=true;});group.add(batch);
  }
 }
 if(!records.length)return null;
 world.group.add(group);world.forestBackdrop=group;return group;
}

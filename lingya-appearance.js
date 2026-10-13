import * as T from './vendor/three.module.js';
const leather=new T.MeshStandardMaterial({color:0x806249,roughness:.84}),cloth=new T.MeshStandardMaterial({color:0x84977b,roughness:.96,side:T.DoubleSide}),lining=new T.MeshStandardMaterial({color:0xe6dac2,roughness:1,side:T.DoubleSide}),earLining=new T.MeshStandardMaterial({color:0xd7bba7,roughness:.98,side:T.DoubleSide}),gold=new T.MeshStandardMaterial({color:0xc5a467,metalness:.4,roughness:.56});
export function lingyaOutfit(root){root.traverse(o=>{if(!o.isMesh)return;const name=o.name;if(name.includes('Pauldrons')||name.includes('Belt_2')||name.includes('_Legs')||name.includes('Bracer'))o.visible=false;if(name.includes('_Feet')){const g=o.geometry.clone(),p=g.attributes.position,ix=g.index.array,keep=[];for(let i=0;i<ix.length;i+=3)if(Math.max(p.getY(ix[i]),p.getY(ix[i+1]),p.getY(ix[i+2]))<.31)keep.push(ix[i],ix[i+1],ix[i+2]);g.setIndex(keep);o.geometry=g;}if(!o.material.name.includes('Ranger'))return;o.material=o.material.clone();const m=o.material,hood=name.includes('Hood'),legs=name.includes('Legs'),boots=name.includes('Feet'),strap=/Belt|Bracer/.test(name);m.color.set(0xffffff);m.roughness=.9;
 const tint=hood?'.32,.41,.28':legs?'.060,.078,.057':boots||strap?'.16,.10,.051':'.62,.56,.43';
 m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float fiber=dot(diffuseColor.rgb,vec3(.21,.72,.07));diffuseColor.rgb=vec3(${tint})*(.58+fiber*1.45);`);};m.customProgramCacheKey=()=> 'lingya-'+tint;
 });}
const skirtMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.95,side:T.DoubleSide});
let earGeometry,innerGeometry,strapGeometry,pouchGeometry,skirtGeo,claspGeometry;
function softEarGeometry(inner=false){
 // A flattened, bent cloth shell replaces the old flat extruded ear badge.
 // The lining occupies only the front inset; it is never a second closed shell
 // crossing the same bevels, which produced dark patterned edges in close-ups.
 const g=inner?new T.RingGeometry(0,1,24,8):new T.SphereGeometry(1,24,18),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)*(inner?.70:1),y=inner?.05+p.getY(i)*.70:p.getY(i),t=(1-y)/2,z=inner?Math.sqrt(Math.max(0,1-x*x-y*y)):p.getZ(i);
  p.setXYZ(i,.037*x*(1-.14*t)+.022*t,.008-.088*t,.006+.025*t*t+.010*z+(inner?.0012:0));
 }
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function lingyaAccessories(){
 earGeometry??=softEarGeometry();innerGeometry??=softEarGeometry(true);
 const hood=new T.Group();hood.name='SM_Hero_Lingya_SoftEars';for(const side of[-1,1]){const ear=new T.Group();ear.name='SM_Hero_Lingya_Ear_'+(side<0?'L':'R');ear.position.set(side*.139,1.738,-.013);ear.scale.set(side,1,1);ear.rotation.z=-side*.10;const shell=new T.Mesh(earGeometry,cloth),inner=new T.Mesh(innerGeometry,earLining);shell.name=ear.name+'_Cloth';inner.name=ear.name+'_Lining';ear.add(shell,inner);hood.add(ear);}
 strapGeometry??=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.10,1.33,.135),new T.Vector3(-.04,1.27,.16),new T.Vector3(.10,1.16,.145),new T.Vector3(.20,1.04,.05)]),24,.010,8,false);
 const chest=new T.Group();chest.name='Lingya_crossbody_strap';chest.add(new T.Mesh(strapGeometry,leather));const strapClasp=new T.Mesh(claspGeometry??=new T.SphereGeometry(.024,12,8),gold);strapClasp.position.set(-.04,1.27,.172);strapClasp.scale.z=.35;chest.add(strapClasp);
 pouchGeometry??=new T.SphereGeometry(1,24,16);const bag=new T.Group(),pouch=new T.Mesh(pouchGeometry,leather);pouch.position.set(.24,1.0,-.10);pouch.scale.set(.115,.14,.065);bag.add(pouch);const flap=new T.Mesh(pouchGeometry,lining);flap.position.set(.24,1.065,-.059);flap.scale.set(.108,.075,.033);bag.add(flap);const clasp=new T.Mesh(pouchGeometry,gold);clasp.position.set(.24,1.026,-.026);clasp.scale.set(.016,.018,.009);bag.add(clasp);
 for(const g of[hood,chest,bag])g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});const skirt=new T.Group();const hemUniforms={time:{value:0},motion:{value:0},turn:{value:0},hop:{value:0}},material=skirtMaterial.clone();
 material.onBeforeCompile=s=>{s.uniforms.hemTime=hemUniforms.time;s.uniforms.hemMotion=hemUniforms.motion;s.uniforms.hemTurn=hemUniforms.turn;s.uniforms.hemHop=hemUniforms.hop;s.vertexShader='uniform float hemTime;uniform float hemMotion;uniform float hemTurn;uniform float hemHop;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float hem=clamp((1.06-position.y)/.31,0.0,1.0);
 transformed.z+=(sin(hemTime*5.0+position.x*10.0)*.012*hemMotion-.018*hemHop)*hem*hem;
 transformed.x+=(hemTurn*.08+sin(hemTime*3.0+position.z*12.0)*.005*hemMotion)*hem*hem;`);};material.customProgramCacheKey=()=> 'lingya-cloth-hem';
 const clothSkirt=new T.Mesh(skirtGeometry().clone(),material);clothSkirt.userData.cloth=hemUniforms;clothSkirt.castShadow=clothSkirt.receiveShadow=true;skirt.add(clothSkirt);return{hood,chest,bag,skirt};
}
function skirtGeometry(){
 if(skirtGeo)return skirtGeo;const pos=[],idx=[],colors=[];for(let j=0;j<=12;j++)for(let i=0;i<=48;i++){const t=j/12,a=i/48*Math.PI*2,r=.173+.059*Math.sin(t*Math.PI/2)+.006*Math.cos(a*6+.4)*t*t;pos.push(Math.sin(a)*r,1.06-.285*t-.010*Math.cos(a*2)*t*t,Math.cos(a)*r*.75);const c=new T.Color(j>10?0xece2cc:0x84977b);c.multiplyScalar(1+.035*Math.cos(a*6+.4)*t);colors.push(c.r,c.g,c.b);if(j<12&&i<48){const k=j*49+i;idx.push(k,k+49,k+1,k+1,k+49,k+50);}}skirtGeo=new T.BufferGeometry();skirtGeo.setAttribute('position',new T.Float32BufferAttribute(pos,3));skirtGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));skirtGeo.setIndex(idx);skirtGeo.computeVertexNormals();return skirtGeo;
}
export function lingyaLegs(root){let m;root.traverse(o=>{if(o.isSkinnedMesh&&o.material.name.includes('Superhero'))m=o;});const legs=m.clone(),g=m.geometry.clone(),p=g.attributes.position,ix=g.index.array,keep=[];for(let i=0;i<ix.length;i+=3)if(Math.max(p.getY(ix[i]),p.getY(ix[i+1]),p.getY(ix[i+2]))<1.03&&Math.min(p.getY(ix[i]),p.getY(ix[i+1]),p.getY(ix[i+2]))>.12)keep.push(ix[i],ix[i+1],ix[i+2]);g.setIndex(keep);legs.geometry=g;legs.material=new T.MeshStandardMaterial({color:0xffffff,roughness:.95});legs.material.onBeforeCompile=s=>{s.vertexShader='varying float restY;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrestY=position.y;');s.fragmentShader='varying float restY;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=restY<.49?vec3(.83,.76,.58):restY>.80?vec3(.17,.22,.13):vec3(.88,.67,.53);');};return legs;}

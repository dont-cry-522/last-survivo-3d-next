import * as T from './vendor/three.module.js';

const plane=new T.PlaneGeometry(2,2),textures=new Map();
const groundSurfaces=new WeakMap(),point=new T.Vector3(),inverse=new T.Matrix4();
export const flatGround=()=>0;
// Own only the small draped copy. Flat/shared source geometry is never changed.
// Height is sampled from the world's rendered triangles, after the final transform.
// Repeated calls reuse buffers and skip sampling when the transform is unchanged.
export function fitGroundSurface(mesh,groundHeight=flatGround,{centerHeight=false}={}){
 if(!mesh?.geometry?.attributes.position)return mesh;
 if(groundHeight===flatGround){disposeGroundSurface(mesh);return mesh;}
 mesh.updateWorldMatrix(true,false);
 let state=groundSurfaces.get(mesh),source=mesh.geometry;
 if(state&&source===state.geometry)source=state.source;
 if(state?.source!==source){disposeGroundSurface(mesh);state=null;}
 if(!state){const isPlane=source.type==='PlaneGeometry',base=isPlane?null:source.attributes.position.array.slice();
  state={source,geometry:null,base,fitted:isPlane?null:new Float32Array(base.length),segments:0,matrix:[],height:null,centerHeight:null,isPlane};groundSurfaces.set(mesh,state);
 }
 const matrix=mesh.matrixWorld.elements;
 if(state.height===groundHeight&&state.centerHeight===centerHeight&&state.matrix.every((v,i)=>v===matrix[i])&&state.matrix.length===16){mesh.geometry=state.draped?state.geometry:state.source;return mesh;}
 if(state.isPlane){
  const params=source.parameters,width=params.width*Math.hypot(matrix[0],matrix[1],matrix[2]),height=params.height*Math.hypot(matrix[4],matrix[5],matrix[6]);
  // Half-metre grid cells keep triangle edges within about .7 m until the cap.
  // Three retained tiers avoid rebuilding buffers for every animation frame.
  const segments=Math.max(state.segments,Math.min(24,Math.max(8,Math.ceil(Math.max(width,height)/4)*8)));
  if(segments!==state.segments){
   state.base=new Float32Array((segments+1)**2*3);state.fitted=new Float32Array(state.base.length);state.segments=segments;
   for(let z=0;z<=segments;z++)for(let x=0;x<=segments;x++){const i=(z*(segments+1)+x)*3;state.base[i]=(x/segments-.5)*params.width;state.base[i+1]=(.5-z/segments)*params.height;}
   state.geometry?.dispose();state.geometry=null;
  }
 }
 state.height=groundHeight;state.centerHeight=centerHeight;state.matrix=matrix.slice();
 const origin=centerHeight?groundHeight(matrix[12],matrix[14])||0:0;inverse.copy(mesh.matrixWorld).invert();let draped=false;
 for(let i=0;i<state.base.length/3;i++){point.fromArray(state.base,i*3).applyMatrix4(mesh.matrixWorld);const h=(groundHeight(point.x,point.z)||0)-origin;draped||=Math.abs(h)>.000001;point.y+=h;point.applyMatrix4(inverse);point.toArray(state.fitted,i*3);}
 state.draped=draped;
 // No extra GPU geometry on flat maps (including zero-returning world callbacks).
 if(draped){state.geometry||=state.isPlane?new T.PlaneGeometry(source.parameters.width,source.parameters.height,state.segments,state.segments):source.clone();const pos=state.geometry.attributes.position;pos.array.set(state.fitted);pos.needsUpdate=true;state.geometry.computeBoundingSphere();}
 mesh.geometry=draped?state.geometry:state.source;
 return mesh;
}
export function disposeGroundSurface(mesh){const state=groundSurfaces.get(mesh);if(!state)return;if(mesh.geometry===state.geometry)mesh.geometry=state.source;state.geometry?.dispose();groundSurfaces.delete(mesh);}
export function fitGroundCue(mesh,groundHeight=flatGround){return fitGroundSurface(mesh,groundHeight);}
function texture(style){
 if(textures.has(style))return textures.get(style);
 // Data textures also work in the headless map checks. Share them across every run.
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,r=Math.hypot(u,v);let alpha=0;
  if(style==='lane'){
   const edge=(1-T.MathUtils.smoothstep(Math.abs(u),.78,1))*(1-T.MathUtils.smoothstep(Math.abs(v),.88,1));
   const chevron=Math.abs(((v+.85+Math.abs(u)*.24)% .55+.55)% .55-.275)<.035;
   alpha=edge*(chevron?.6:.13);
  }else if(style==='pounce'){
   for(const offset of [-.42,0,.42])alpha=Math.max(alpha,(1-T.MathUtils.smoothstep(Math.abs(u-offset-v*.2),.025,.09))*(1-T.MathUtils.smoothstep(Math.abs(v),.5,.9))*.85);
  }else if(style==='danger')alpha=r<1?(.25+.22*T.MathUtils.smoothstep(r,.4,.85))*(1-T.MathUtils.smoothstep(r,.9,1)):0;
  else alpha=Math.pow(Math.max(0,1-r*r),2)*.7;
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(alpha*255);
 }
 const map=new T.DataTexture(data,size,size);map.magFilter=map.minFilter=T.LinearFilter;map.needsUpdate=true;textures.set(style,map);return map;
}
export function groundCue(color,r=1,style='danger',opacity=.58){
 const m=new T.Mesh(plane,new T.MeshBasicMaterial({map:texture(style),color,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
 m.rotation.x=-Math.PI/2;m.scale.set(r,r,1);m.userData.groundCue=style;m.userData.ownedMaterial=true;return m;
}
export function disposeCue(mesh){disposeGroundSurface(mesh);if(mesh?.userData.ownedMaterial)mesh.material.dispose();}

import * as T from './vendor/three.module.js';
// Built once on the template. The caller binds these surfaces to the jacket's
// skeleton so the lower strap follows the waist instead of the shoulder bone.
export function tideHarness(surfaceHeight){
 const g=new T.Group();g.name='Tide_coastal_harness';
 const cloth=new T.MeshStandardMaterial({color:0x476466,roughness:.79,side:T.DoubleSide}),copper=new T.MeshStandardMaterial({color:0x927757,metalness:.42,roughness:.55});
 const curve=new T.CatmullRomCurve3([[-.115,1.449,0],[-.083,1.374,0],[.013,1.256,0],[.069,1.191,0]].map(p=>new T.Vector3(...p))),pos=[],uv=[],indices=[],rows=32,cols=4;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const v=j/rows,u=i/cols,p=curve.getPoint(v),t=curve.getTangent(v),side=new T.Vector3(t.y,-t.x,0).normalize();p.addScaledVector(side,(u-.5)*(.026+.008*Math.sin(v*Math.PI)));
  // Sample both edges rather than bridging the chest with a flat ribbon.
  pos.push(p.x,p.y,surfaceHeight(p.x,p.y)+.0018+Math.sin(u*Math.PI)*.0008);uv.push(u,v);
  if(j<rows&&i<cols){const n=j*(cols+1)+i;indices.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const strap=new T.Mesh(geo,cloth);strap.name='SM_Hero_Tide_FittedHarness';g.add(strap);
 const buckleGeo=new T.TorusGeometry(.012,.0023,6,16);buckleGeo.scale(.72,1,1);buckleGeo.rotateZ(-.59);buckleGeo.translate(.052,1.212,surfaceHeight(.052,1.212)+.004);
 const buckle=new T.Mesh(buckleGeo,copper);buckle.name='SM_Hero_Tide_HarnessFastener';g.add(buckle);
 return g;
}

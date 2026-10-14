import * as T from './vendor/three.module.js';

// Creation-time fitting only: index the unchanged rest triangles in their XY
// projection. Every candidate still receives Three's exact triangle test; this
// is not a simplified mesh, a height approximation, or animated collision data.
const surfaces=new WeakMap();
export function restSurface(geometry,transform){
 let variants=surfaces.get(geometry);if(!variants){variants=new Map();surfaces.set(geometry,variants);}
 const key=transform?transform.elements.join(','):'';
 if(variants.has(key))return variants.get(key);
 const p=geometry.attributes.position,index=geometry.index,vertices=new Float64Array(p.count*3),point=new T.Vector3(),point2=new T.Vector2(),bounds=new T.Box2();
 for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);if(transform)point.applyMatrix4(transform);point.toArray(vertices,i*3);}
 const count=index?.count??p.count,start=Math.max(0,geometry.drawRange.start),end=Math.min(count,start+geometry.drawRange.count),ids=[];
 for(let i=start;i<end;i++){const id=index?index.getX(i):i;ids.push(id);bounds.expandByPoint(point2.set(vertices[id*3],vertices[id*3+1]));}
 const cells=32,width=bounds.max.x-bounds.min.x||1,height=bounds.max.y-bounds.min.y||1,buckets=Array.from({length:cells*cells},()=>[]);
 const column=x=>T.MathUtils.clamp(Math.floor((x-bounds.min.x)/width*cells),0,cells-1),row=y=>T.MathUtils.clamp(Math.floor((y-bounds.min.y)/height*cells),0,cells-1),epsilon=1e-9;
 for(let i=0;i<ids.length;i+=3){
  const a=ids[i]*3,b=ids[i+1]*3,c=ids[i+2]*3;
  const minX=column(Math.min(vertices[a],vertices[b],vertices[c])-epsilon),maxX=column(Math.max(vertices[a],vertices[b],vertices[c])+epsilon);
  const minY=row(Math.min(vertices[a+1],vertices[b+1],vertices[c+1])-epsilon),maxY=row(Math.max(vertices[a+1],vertices[b+1],vertices[c+1])+epsilon);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)buckets[y*cells+x].push(a,b,c);
 }
 const ray=new T.Ray(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3(),result={point:new T.Vector3()};
 // The result is a scratch value, consumed immediately by a mask/cape fitter.
 // No Object3D, geometry, material, skeleton or mutable pose is retained.
 const sample=(x,y,fromFront=true)=>{
  if(x<bounds.min.x-epsilon||x>bounds.max.x+epsilon||y<bounds.min.y-epsilon||y>bounds.max.y+epsilon)return null;
  ray.origin.set(x,y,fromFront?1:-1);ray.direction.set(0,0,fromFront?-1:1);
  const candidates=buckets[row(y)*cells+column(x)];let distance=Infinity;
  for(let i=0;i<candidates.length;i+=3){
   a.fromArray(vertices,candidates[i]);b.fromArray(vertices,candidates[i+1]);c.fromArray(vertices,candidates[i+2]);
   if(ray.intersectTriangle(a,b,c,false,hit)){
    const next=ray.origin.distanceToSquared(hit);if(next<distance){distance=next;result.point.copy(hit);}
   }
  }
  return distance<Infinity?result:null;
 };
 variants.set(key,sample);return sample;
}

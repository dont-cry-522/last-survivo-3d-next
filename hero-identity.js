import * as T from './vendor/three.module.js';
import {HERO_SIGNATURES,makeIdentityMark} from './identity-motifs.js?v=206';

// One identifying fitting per outfit. Measurements use the authored bind pose;
// the fitting is then attached to a real bone, never to a SkinnedMesh container.
const placements={
 scout:{bone:'pelvis',x:0,y:1.145,size:.042,roll:-.18,replace:'SM_Hero_Buckle_scout'},
 silver:{bone:'spine_03',x:-.110,y:1.415,size:.043,roll:-.48},
 wraith:{bone:'spine_03',x:.018,y:1.365,size:.039,roll:0},
 // Seat the wave on the upper vest, below the moving collar/shoulder seam.
 tide:{bone:'spine_03',x:.062,y:1.418,size:.038,roll:-.08,replace:'SM_Hero_Tide_ShoulderRopeKnots'},
 lingya:{bone:'spine_03',x:-.04,y:1.270,size:.035,roll:.10},
 wuling:{bone:'spine_03',x:-.105,y:1.397,size:.039,roll:-.18},
 mirage:{bone:'Head',x:-.063,y:1.739,size:.029,roll:-.27,hair:true}
};
const front=new T.Vector3(0,0,1),probeMaterial=new T.MeshBasicMaterial({side:T.DoubleSide});

function surfaceProbe(root,hair){
 const geometry=[];
 root.traverse(o=>{
  if(!o.isSkinnedMesh||!o.visible)return;
  if(hair?o.userData.mirageLongHair||o.userData.hairstyle:!o.userData.hairstyle&&(o.userData.rangerRebuild||o.userData.rebuiltPart||o.userData.wildMistPart||o.name.endsWith('_Body')))geometry.push(o.geometry);
 });
 const probes=geometry.map(g=>{const m=new T.Mesh(g,probeMaterial);m.updateMatrixWorld(true);return m;}),ray=new T.Raycaster();
 return(x,y)=>{ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));return ray.intersectObjects(probes,false)[0];};
}

export function applyHeroIdentity(root,kind){
 const placement=placements[kind],signature=HERO_SIGNATURES[kind];
 if(!placement||!signature||root.userData.heroIdentity===kind)return root;
 const bone=root.getObjectByName(placement.bone);if(!bone?.isBone)throw Error('Identity fitting requires the authored '+placement.bone+' bone');
 const sample=surfaceProbe(root,placement.hair);let hit=sample(placement.x,placement.y);
 // Individual hair locks leave small gaps; move the pin at most two centimetres
 // onto the actual crown rather than bridging an empty space over the face.
 if(!hit&&placement.hair){let distance=Infinity;for(const dx of[0,-.01,.01,-.02,.02])for(const dy of[0,-.01,.01,-.02,.02]){const d=dx*dx+dy*dy;if(d>=distance)continue;const candidate=sample(placement.x+dx,placement.y+dy);if(candidate){hit=candidate;distance=d;}}}
 if(!hit)throw Error('Identity fitting has no garment surface: '+kind);
 const mark=makeIdentityMark(kind,placement.size);mark.name='SM_Hero_Identity_'+kind;
 const normal=(hit.normal||hit.face.normal).clone().normalize();if(normal.z<0)normal.negate();
 // A lock's side normal can point almost sideways. A small flat hair fitting
 // faces mostly forward, rather than standing on edge and lifting off the head.
 if(placement.hair)normal.lerp(front,.75).normalize();
 // Tide's small clasp needs 2 mm of extra clearance for the jacket's blended
 // chest weights during running; it remains rigidly attached to spine_03.
 mark.position.copy(hit.point).addScaledVector(normal,kind==='tide'?.006:.004);mark.quaternion.setFromUnitVectors(front,normal);mark.rotateZ(placement.roll);
 mark.updateMatrixWorld(true);
 // Keep the back of the small rigid fitting above the curved fabric. The
 // source model, motif geometry and shared cached materials are never edited.
 const localBounds=new T.Box3().setFromObject(mark);
 let lift=0;
 for(const x of[localBounds.min.x,(localBounds.min.x+localBounds.max.x)/2,localBounds.max.x])for(const y of[localBounds.min.y,(localBounds.min.y+localBounds.max.y)/2,localBounds.max.y]){
  const contact=sample(x,y);if(!contact)continue;
  const planeZ=mark.position.z-(normal.x*(x-mark.position.x)+normal.y*(y-mark.position.y))/normal.z;
  lift=Math.max(lift,(contact.point.z+.002-planeZ)*normal.z);
 }
 mark.position.addScaledVector(normal,lift);
 Object.assign(mark.userData,{heroIdentity:true,identityKind:kind,identityRole:'primary',identityBone:placement.bone});
 let part=0;mark.traverse(o=>{if(o.isMesh){o.name='SM_Hero_Identity_'+kind+'_'+part++;o.userData.identityDetail=true;o.userData.rebuiltPart='Identity';o.castShadow=o.receiveShadow=true;}});
 root.updateMatrixWorld(true);mark.applyMatrix4(bone.matrixWorld.clone().invert().multiply(root.matrixWorld));bone.add(mark);
 if(placement.replace){const old=root.getObjectByName(placement.replace);if(old)old.visible=false;}
 if(kind==='tide'){const old=root.getObjectByName('SM_Hero_Tide_CopperClasp');if(old)old.visible=false;}
 root.userData.heroIdentity=kind;return root;
}

function fitOuterClothing(hero,mark){
 hero.updateMatrixWorld(true);const surfaces=[];
 hero.traverse(o=>{
  if(!o.isMesh||o.userData.identityDetail)return;
  let visible=true,strap=false;for(let parent=o;parent;parent=parent.parent){visible&&=parent.visible;strap||=/^(?:Wuling_gathering_harness|Lingya_crossbody_strap|Tide_coastal_harness|Shadow_traveller_scarf)$/.test(parent.name);}
  if(visible&&(o.isSkinnedMesh||o.userData.wind||strap))surfaces.push(o);
 });
 const normal=front.clone().applyQuaternion(mark.getWorldQuaternion(new T.Quaternion())),origin=mark.getWorldPosition(new T.Vector3()),ray=new T.Raycaster(),points=[];
 // Sample the actual relief vertices, including its tips, rather than the
 // empty corners of a rectangular plaque that the motif does not contain.
 mark.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,step=Math.max(1,Math.floor(p.count/16));for(let i=0;i<p.count;i+=step){const world=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);world.addScaledVector(normal,-world.clone().sub(origin).dot(normal));points.push(world);}});
 // Skin each garment vertex once for this fitting, instead of asking a skinned
 // raycast to reskin every triangle for every relief tip. These CPU-only probes
 // are local to creation and never enter the scene or own shared resources.
 const frame=new T.Matrix4().compose(origin,mark.getWorldQuaternion(new T.Quaternion()),new T.Vector3(1,1,1)),inverse=frame.clone().invert(),localPoints=points.map(p=>p.clone().applyMatrix4(inverse)),bounds=new T.Box3().setFromPoints(localPoints),probes=[],vertex=new T.Vector3();
 for(const source of surfaces){
  const geometry=source.geometry,positions=new Float32Array(geometry.attributes.position.count*3),transform=inverse.clone().multiply(source.matrixWorld),index=geometry.index?.array,indices=[];
  for(let i=0;i<positions.length/3;i++){source.getVertexPosition(i,vertex).applyMatrix4(transform);vertex.toArray(positions,i*3);}
  const count=index?.length||positions.length/3;
  for(let i=0;i<count;i+=3){const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
   if(Math.max(positions[a*3],positions[b*3],positions[c*3])<bounds.min.x||Math.min(positions[a*3],positions[b*3],positions[c*3])>bounds.max.x||Math.max(positions[a*3+1],positions[b*3+1],positions[c*3+1])<bounds.min.y||Math.min(positions[a*3+1],positions[b*3+1],positions[c*3+1])>bounds.max.y)continue;
   indices.push(a,b,c);
  }
  if(!indices.length)continue;
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setIndex(indices);const mesh=new T.Mesh(g,probeMaterial);mesh.updateMatrixWorld(true);probes.push(mesh);
 }
 let lift=0;
 for(const point of localPoints){ray.set(new T.Vector3(point.x,point.y,.20),new T.Vector3(0,0,-1));ray.far=.40;const hit=ray.intersectObjects(probes,false)[0];if(hit)lift=Math.max(lift,.202-hit.distance);}
 for(const probe of probes)probe.geometry.dispose();
 if(lift>0){origin.addScaledVector(normal,lift);mark.position.copy(mark.parent.worldToLocal(origin));}
 mark.userData.identityOuterFit=lift;
}

// These older generic clasps are created after template cloning. Replace them
// in their actual attachment frame so scarves and shoulder straps keep fitting.
export function settleHeroIdentity(hero,kind){
 const mark=hero.getObjectByName('SM_Hero_Identity_'+kind);if(!mark||mark.userData.identitySettled)return;
 let anchor,hidden=[];
 if(kind==='wraith'){anchor=hero.getObjectByName('Shadow_broken_clasp');if(anchor)hidden=[anchor];}
 if(kind==='lingya'){
  const strap=hero.getObjectByName('Lingya_crossbody_strap');anchor=strap?.children.find(o=>o.isMesh&&Math.abs(o.position.y-1.27)<1e-5);if(anchor)hidden=[anchor];
 }
 if(kind==='wuling'){
  const harness=hero.getObjectByName('Wuling_gathering_harness');hidden=harness?.children.filter(o=>o.isMesh&&Math.abs(o.position.x+.105)<1e-5&&o.position.y>1.39&&o.position.y<1.41)||[];anchor=hidden[0];
 }
 if(kind==='mirage'){
  const old=hero.getObjectByName('Mirage_flower_hairpin');if(old)hidden=[old];
  // Head scaling and the hair's authored bind matrix are applied on the live
  // instance. Seat the clip against that surface, not an empty bind-pose plane.
  hero.updateMatrixWorld(true);const hair=[];hero.traverse(o=>{if(o.userData.mirageLongHair)hair.push(o);});
  const normal=front.clone().applyQuaternion(mark.getWorldQuaternion(new T.Quaternion())),origin=mark.getWorldPosition(new T.Vector3()).addScaledVector(normal,.02),ray=new T.Raycaster(origin,normal.clone().negate(),0,.16),hit=ray.intersectObjects(hair,false)[0];
  if(hit){
   const points=[hit.face.a,hit.face.b,hit.face.c].map(i=>hit.object.getVertexPosition(i,new T.Vector3()).applyMatrix4(hit.object.matrixWorld)),surfaceNormal=points[1].sub(points[0]).cross(points[2].sub(points[0])).normalize();if(surfaceNormal.dot(normal)<0)surfaceNormal.negate();
   mark.position.copy(mark.parent.worldToLocal(hit.point.clone().addScaledVector(surfaceNormal,.003)));
   mark.quaternion.copy(mark.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(new T.Quaternion().setFromUnitVectors(front,surfaceNormal)));mark.rotateZ(placements[kind].roll);
  }
 }
 if(anchor){
  hero.updateMatrixWorld(true);
  const offset=kind==='wuling'?.012:kind==='lingya'?.006:.001,position=anchor.getWorldPosition(new T.Vector3()),rotation=anchor.getWorldQuaternion(new T.Quaternion()),out=front.clone().applyQuaternion(rotation);
  position.addScaledVector(out,offset);mark.position.copy(mark.parent.worldToLocal(position));
  mark.quaternion.copy(mark.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
 }
 for(const old of hidden)old.visible=false;
 if(['scout','silver','tide','wuling'].includes(kind))fitOuterClothing(hero,mark);
 mark.userData.identitySettled=true;
}

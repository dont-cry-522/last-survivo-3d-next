const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));

function sceneTextures(scene){
 const textures=new Set(),materials=new Set(),seen=new Set();
 const uniformTextures=value=>{
  if(!value||typeof value!=='object'||seen.has(value))return;
  seen.add(value);
  if(value.isTexture){textures.add(value);return;}
  // Uniform structs/arrays can contain samplers. Do not walk arbitrary scene
  // objects, typed arrays, or material userData looking for hidden resources.
  if(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)
   for(const child of Object.values(value))uniformTextures(child);
 };
 scene.traverse(object=>{
  const list=Array.isArray(object.material)?object.material:[object.material];
  for(const material of list){
   if(!material||materials.has(material))continue;
   materials.add(material);
   for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
   uniformTextures(material.uniforms);
  }
 });
 for(const value of [scene.background,scene.environment])if(value?.isTexture)textures.add(value);
 return [...textures];
}

// The caller owns the render target and the actual world -> weapon -> postprocess
// draw. No simulation update occurs here. Custom onBeforeCompile samplers and
// shadow/postprocess resources are also exercised by the two real draw passes.
export async function warmScene({renderer,scene,camera,render,report=()=>{},yieldWork=yieldTask}){
 const mask=camera.layers.mask;
 try{
  const textures=sceneTextures(scene);
  report('textures',0,textures.length);
  for(let i=0;i<textures.length;i++){
   renderer.initTexture(textures[i]);
   report('textures',i+1,textures.length);
   if((i+1)%8===0||i+1===textures.length)await yieldWork();
  }
  report('compile',0,2);
  await yieldWork();
  for(let layer=0;layer<2;layer++){
   try{
    camera.layers.set(layer);
    await renderer.compileAsync(scene,camera);
   }finally{camera.layers.mask=mask;}
   report('compile',layer+1,2);
   await yieldWork();
  }
  report('render',0,2);
  for(let pass=0;pass<2;pass++){
   await render(pass);
   report('render',pass+1,2);
   await yieldWork();
  }
 }finally{camera.layers.mask=mask;}
}

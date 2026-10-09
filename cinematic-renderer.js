import * as T from './vendor/three.module.js';

const vertexShader=`varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const blurShader=`varying vec2 vUv;
uniform sampler2D source;
uniform vec2 direction;
uniform float extract;
vec3 readLight(vec2 uv){
 vec3 c=texture2D(source,uv).rgb;
 float brightness=max(dot(c,vec3(.2126,.7152,.0722)),max(c.r,max(c.g,c.b))*.72);
 float gate=smoothstep(.70,1.25,brightness);
 return mix(c,c*gate,extract);
}
void main(){
 vec3 c=readLight(vUv)*.227027;
 c+=(readLight(vUv+direction*1.384615)+readLight(vUv-direction*1.384615))*.316216;
 c+=(readLight(vUv+direction*3.230769)+readLight(vUv-direction*3.230769))*.070270;
 gl_FragColor=vec4(c,1.);
}`;
const finishShader=`varying vec2 vUv;
uniform sampler2D sceneColor;
uniform sampler2D glowColor;
uniform float glowStrength;
void main(){
 vec3 color=texture2D(sceneColor,vUv).rgb;
 // Only bright highlights bloom; black smoke, silhouettes and danger markings stay crisp.
 color+=texture2D(glowColor,vUv).rgb*glowStrength;
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 // Very gentle shoulder contrast, without crushed blacks or a blurred combat field.
 gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*gl_FragColor.rgb*(3.-2.*gl_FragColor.rgb),.09);
 #include <colorspace_fragment>
}`;

// One scene capture and two quarter-size light filters, with the existing pixel budget.
// Unsupported float targets retain the normal renderer; no additional asset downloads.
export class CinematicRenderer{
 constructor(renderer,{mobile=false}={}){
  this.renderer=renderer;this.mobile=mobile;this.disposed=false;this.enabled=renderer.extensions.has('EXT_color_buffer_float');
  this.originalAutoReset=renderer.info.autoReset;renderer.info.autoReset=false;
  if(!this.enabled)return;
  const options={type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter};
  // Scene drawing needs depth; the color-only postprocess does not need it resolved from MSAA.
  this.sceneTarget=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:true,resolveDepthBuffer:false});
  this.sceneTarget.samples=mobile?0:Math.min(2,renderer.capabilities.maxSamples||0);
  this.glowA=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:false});
  this.glowB=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:false});
  this.blur=new T.ShaderMaterial({vertexShader,fragmentShader:blurShader,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{source:{value:null},direction:{value:new T.Vector2()},extract:{value:0}}});
  this.finish=new T.ShaderMaterial({vertexShader,fragmentShader:finishShader,depthTest:false,depthWrite:false,uniforms:{sceneColor:{value:this.sceneTarget.texture},glowColor:{value:this.glowB.texture},glowStrength:{value:0}}});
  this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.finish);this.quad.frustumCulled=false;
  this.screen=new T.Scene();this.screen.add(this.quad);this.camera=new T.Camera();this.size=new T.Vector2();
 }
 render(draw,quality=1){
  const r=this.renderer;r.info.reset();
  if(!this.enabled||this.disposed||quality<.8){
   // Release full-sized HDR buffers while the ordinary renderer handles a slow device.
   if(this.enabled&&!this.disposed&&this.sceneTarget.width>1)for(const target of [this.sceneTarget,this.glowA,this.glowB])target.setSize(1,1);
   draw();return;
  }
  r.getDrawingBufferSize(this.size);
  const width=Math.max(1,this.size.x),height=Math.max(1,this.size.y),smallW=Math.max(1,Math.ceil(width/4)),smallH=Math.max(1,Math.ceil(height/4));
  if(this.sceneTarget.width!==width||this.sceneTarget.height!==height){this.sceneTarget.setSize(width,height);this.glowA.setSize(smallW,smallH);this.glowB.setSize(smallW,smallH);}
  const previous=r.getRenderTarget();
  try{
   r.setRenderTarget(this.sceneTarget);draw();
   this.quad.material=this.blur;this.blur.uniforms.source.value=this.sceneTarget.texture;this.blur.uniforms.direction.value.set(1.35/smallW,0);this.blur.uniforms.extract.value=1;
   r.setRenderTarget(this.glowA);r.render(this.screen,this.camera);
   this.blur.uniforms.source.value=this.glowA.texture;this.blur.uniforms.direction.value.set(0,1.35/smallH);this.blur.uniforms.extract.value=0;
   r.setRenderTarget(this.glowB);r.render(this.screen,this.camera);
   this.finish.uniforms.glowStrength.value=this.mobile?.13:.19;this.quad.material=this.finish;
   r.setRenderTarget(previous);r.render(this.screen,this.camera);
  }finally{r.setRenderTarget(previous);}
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const resource of [this.sceneTarget,this.glowA,this.glowB,this.blur,this.finish,this.quad?.geometry])resource?.dispose();
  this.renderer.info.autoReset=this.originalAutoReset;
 }
}

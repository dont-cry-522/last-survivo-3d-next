# Rain Rig (CC) Blender Foundation | studio.blender.org — CC BY 4.0.
# Run from the repo: blender --background --factory-startup --disable-autoexec
# /path/to/rain_v3.2.blend --python scripts/prepare-lingya-head.py
import bpy,math
from mathutils import Vector
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'assets/characters'
names=['GEO-rain-head','GEO-rain-eyes_viewport','GEO-rain-eyebrows','GEO-rain-eyelashes','GEO-rain-eye_dots']
# Clear source drivers without enabling the embedded UI or shading scripts.
for o in bpy.data.objects:
 if o.animation_data:o.animation_data_clear()
 if o.type=='MESH' and o.data.shape_keys:
  o.data.shape_keys.animation_data_clear()
  for k in o.data.shape_keys.key_blocks:k.value=0
for n in ['LipsAdjust']:
 bpy.data.objects['GEO-rain-head'].data.shape_keys.key_blocks[n].value=1
for side in ['L','R']:
 bpy.data.objects['RIG-rain'].pose.bones['ACT-Lips_Corner.'+side].location.y=0
 bpy.data.objects['RIG-rain'].pose.bones['ACT-Eyelid_Upper.'+side].location.y=-.003
for o in bpy.data.objects:
 if o.type=='MESH':
  for m in o.modifiers:
   m.show_viewport=m.type in ('MIRROR','SUBSURF','ARMATURE')
   if m.type=='SUBSURF':m.levels=1;m.render_levels=m.levels
bpy.context.view_layer.update()
def mat(name,color,rough=.8):
 m=bpy.data.materials.new(name);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough
 return m
skin=mat('Lingya_face_skin',(.88,.51,.415));white=mat('Lingya_eye_white',(.93,.90,.83),.55);iris=mat('Lingya_eye_iris',(.25,.125,.045),.4);pupil=mat('Lingya_eye_pupil',(.009,.006,.004),.4);brow=mat('Lingya_face_brow',(.20,.095,.045));lash=mat('Lingya_face_lash',(.05,.025,.013));glint=mat('Lingya_eye_glint',(1,1,1),.6)

def smooth(a,b,value):
 t=max(0,min(1,(value-a)/(b-a)));return t*t*(3-2*t)
def fitted(name,src):
  x=src.x*.70;y=src.y*.70+.02;z=1.632+(src.z-1.475)*.73
  # Preserve the existing neck fitting before the shared proportion changes.
  # Every visible face component and both Blink endpoints use this same fit.
  if name=='GEO-rain-head':
   neck=max(0,min(1,(y+.052)/.031))
   if z<1.54:z-=.065*max(0,min(1,(1.54-z)/.05))*neck
  if name=='GEO-rain-eyebrows':
   z=1.669+(z-1.669)*.36+.005*math.exp(-((abs(x)-.028)/.028)**2)+.0006*(1-smooth(.010,.024,abs(x)))-.0032*smooth(.040,.070,abs(x))
  if name=='GEO-rain-eye_dots':
   # The viewport pupil is in front of Rain's original highlight plane.
   center=math.copysign(.03273,x)
   x=center+(x-center)*1.35-.002;y-=.002;z+=.003
  # A single eye-region cage includes the sockets, eyeballs, lashes, brows and
  # both Blink endpoints. Its broad falloff preserves the continuous cheek and
  # forehead instead of moving a detached eye pair inside the old sockets.
  eye=smooth(.003,.018,abs(x))*(1-smooth(.060,.090,abs(x)))*(1-smooth(.026,.066,abs(z-1.631)))*smooth(1.587,1.613,z-.006)*smooth(-.005,.020,-y)
  center=math.copysign(.03273,x)
  x=center+(x-center)*(1-.18*eye);z=1.631+(z-1.631)*(1-.24*eye)
  # One broad depth fit for the whole front face. Nose, lips and eye area share
  # it; the anchored lower neck and rear skull remain fixed.
  y+=(-.020-y)*.40*smooth(1.485,1.585,z-.006)*smooth(.020,.060,-y)
  # Shorten and round the lower face with one broad, continuous field. The neck
  # seam and rear skull remain fixed; the same fit is used for Blink endpoints.
  lower=smooth(1.485,1.525,z-.006)*(1-smooth(1.585,1.640,z-.006))*smooth(.020,.060,-y)
  x*=1+.080*lower;z+=(1.626-z)*.100*lower
  # Fit nose/mouth width and lip height as a broad connected region. Lip rims,
  # corners and inner mouth move together, with a smooth transition into the
  # cheeks; their depth still comes only from the whole-face fit above.
  h=z-.006
  muzzle=smooth(.018,.050,-y)*(1-smooth(.022,.065,abs(x)))*smooth(1.520,1.546,h)*(1-smooth(1.590,1.617,h))
  x*=1-.27*muzzle
  z+=(1.571-z)*.30*muzzle*(1-smooth(1.573,1.595,h))
  return Vector((x,y,z-.006))

created=[]
for name in names:
 o=bpy.data.objects[name];dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);data=bpy.data.meshes.new_from_object(ev,depsgraph=dg)
 tint_points=[Vector((p.x*.70,p.y*.70+.02,1.626+(p.z-1.475)*.73)) for p in (o.matrix_world@v.co for v in data.vertices)] if name=='GEO-rain-head' else []
 for v in data.vertices:v.co=fitted(name,o.matrix_world@v.co)
 ob=bpy.data.objects.new(name.replace('GEO-rain','Lingya'),data);bpy.context.scene.collection.objects.link(ob);created.append(ob)
 if name in ['GEO-rain-head','GEO-rain-eyelashes']:
  rig=bpy.data.objects['RIG-rain']
  for side in ['L','R']:bpy.data.objects['GEO-rain-head'].data.shape_keys.key_blocks['EyelidsClose.'+side].value=1
  for side in ['L','R']:
   rig.pose.bones['ACT-Eyelid_Upper.'+side].location.y=-.028
   rig.pose.bones['ACT-Eyelid_Lower.'+side].location.y=.008
  bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
  closed=bpy.data.meshes.new_from_object(o.evaluated_get(dg),depsgraph=dg)
  assert len(closed.vertices)==len(data.vertices)
  ob.shape_key_add(name='Basis');key=ob.shape_key_add(name='Blink')
  for end,k in zip(closed.vertices,key.data):k.co=fitted(name,o.matrix_world@end.co)
  for side in ['L','R']:
   rig.pose.bones['ACT-Eyelid_Upper.'+side].location.y=-.003
   rig.pose.bones['ACT-Eyelid_Lower.'+side].location.y=0
  for side in ['L','R']:bpy.data.objects['GEO-rain-head'].data.shape_keys.key_blocks['EyelidsClose.'+side].value=0
  bpy.context.view_layer.update();bpy.data.meshes.remove(closed)
 old=[m.name if m else '' for m in data.materials];slots=[p.material_index for p in data.polygons];data.materials.clear()
 if name=='GEO-rain-head':
  data.materials.append(skin)
  for old_color in list(data.color_attributes):data.color_attributes.remove(old_color)
  color=data.color_attributes.new(name='face_tint',type='FLOAT_COLOR',domain='POINT')
  # Colour stays on the same source lip/cheek vertices as proportions change.
  for point,c in zip(tint_points,color.data):
   x,y,z=point;front=max(0,min(1,(-y-.035)/.04))
   lip=math.exp(-((z-1.552)/.007)**2-(x/.024)**2)*front*.4
   cheek=math.exp(-((z-1.593)/.020)**2-((abs(x)-.048)/.019)**2)*front*.27
   c.color=(.88,.51*(1-lip*.45-cheek*.3),.415*(1-lip*.30-cheek*.14),1)
  nodes=skin.node_tree.nodes;attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='face_tint'
  skin.node_tree.links.new(attr.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
 elif name=='GEO-rain-eyes_viewport':
  for n in old:data.materials.append(white if 'white' in n else iris if 'blue' in n else pupil)
 elif 'eyebrows' in name:data.materials.append(brow)
 elif 'eyelashes' in name:data.materials.append(lash)
 elif 'dots' in name:data.materials.append(glint)
 for poly,slot in zip(data.polygons,slots):poly.material_index=slot;poly.use_smooth=True
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
for o in bpy.context.selected_objects:o.select_set(False)
for o in created:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'lingya-face.gltf'),export_format='GLTF_SEPARATE',use_selection=True,export_animations=False,export_skins=False,export_morph=True,export_yup=True)
print('EXPORTED_FACE',[(o.name,len(o.data.vertices)) for o in created])

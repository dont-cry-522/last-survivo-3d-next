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
for n in ['Smile.L','Smile.R']:
 bpy.data.objects['GEO-rain-head'].data.shape_keys.key_blocks[n].value=.10
for side in ['L','R']:
 bpy.data.objects['RIG-rain'].pose.bones['ACT-Lips_Corner.'+side].location.y=0
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
  # Preserve the authored continuous face. Only extend the neck behind it to
  # meet the existing body; nose, lips, sockets and Blink use the same affine fit.
  if name=='GEO-rain-head':
   neck=max(0,min(1,(y+.052)/.031))
   if z<1.54:z-=.065*max(0,min(1,(1.54-z)/.05))*neck
  if name=='GEO-rain-eyebrows':
   z=1.669+(z-1.669)*.52+.004*math.exp(-((abs(x)-.023)/.020)**2)-.003*max(0,min(1,(abs(x)-.045)/.025))
  if name=='GEO-rain-eye_dots':
   # The viewport pupil is in front of Rain's original highlight plane.
   center=math.copysign(.03273,x)
   x=center+(x-center)*1.35-.002;y-=.002;z+=.003
  # One broad depth fit for every component and both Blink endpoints. Keep the
  # lower neck and rear skull fixed; the whole front face is only 10% shallower.
  y+=(-.020-y)*.10*smooth(1.485,1.585,z-.006)*smooth(.020,.060,-y)
  return Vector((x,y,z-.006))

created=[]
for name in names:
 o=bpy.data.objects[name];dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);data=bpy.data.meshes.new_from_object(ev,depsgraph=dg)
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
   rig.pose.bones['ACT-Eyelid_Upper.'+side].location.y=0
   rig.pose.bones['ACT-Eyelid_Lower.'+side].location.y=0
  for side in ['L','R']:bpy.data.objects['GEO-rain-head'].data.shape_keys.key_blocks['EyelidsClose.'+side].value=0
  bpy.context.view_layer.update();bpy.data.meshes.remove(closed)
 old=[m.name if m else '' for m in data.materials];slots=[p.material_index for p in data.polygons];data.materials.clear()
 if name=='GEO-rain-head':
  data.materials.append(skin)
  for old_color in list(data.color_attributes):data.color_attributes.remove(old_color)
  color=data.color_attributes.new(name='face_tint',type='FLOAT_COLOR',domain='POINT')
  for v,c in zip(data.vertices,color.data):
   x,y,z=v.co;front=max(0,min(1,(-y-.035)/.04))
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

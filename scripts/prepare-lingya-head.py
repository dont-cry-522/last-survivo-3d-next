# Lingya's independent woodland head, derived from the project's CC0 universal
# female base (see assets/characters/universal-base-characters-LICENSE.txt).
# Run with Python 3; does not require Blender or modify any shared source asset.
import json, math, struct
from pathlib import Path

out=Path(__file__).resolve().parents[1]/'assets/characters'
source=json.loads((out/'silver-base.gltf').read_text())
binary=(out/source['buffers'][0]['uri']).read_bytes()
result={'asset':{'version':'2.0','generator':'Lingya independent woodland head, twin-plait redesign'},'scene':0,'scenes':[{'nodes':[0,1,2,3]}],'nodes':[], 'meshes':[], 'materials':[], 'accessors':[], 'bufferViews':[], 'buffers':[]}
data=bytearray()

def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def previous_upper_y(y):
 lower=smooth(1.535,1.555,y)*(1-smooth(1.60,1.66,y))
 q=y+(1.64-y)*.16*lower
 return q-.029*smooth(1.44,1.59,q)+(1.64-q)*.035*smooth(1.47,1.60,y)

# One monotone vertical cage moves whole horizontal sections together. Dense
# upper anchors preserve the accepted eyes, brows and nose; no local chin lift
# can overtake the mouth or fold the front surface through itself.
y_keys=[(1.40,1.40),(1.425,1.425),(1.48,1.475),(1.515,1.497),(1.535,1.528),(1.555,1.543),(1.575,1.559)]+[(1.59+i*.005,previous_upper_y(1.59+i*.005)) for i in range(43)]
secants=[(b[1]-a[1])/(b[0]-a[0]) for a,b in zip(y_keys,y_keys[1:])]
slopes=[secants[0]]+[2*a*b/(a+b) for a,b in zip(secants,secants[1:])]+[secants[-1]]
def fitted_y(y):
 if y<=y_keys[0][0]:return y
 for i,(a,b) in enumerate(zip(y_keys,y_keys[1:])):
  if y<=b[0]:
   span=b[0]-a[0];t=(y-a[0])/span
   return (2*t**3-3*t*t+1)*a[1]+(t**3-2*t*t+t)*span*slopes[i]+(-2*t**3+3*t*t)*b[1]+(t**3-t*t)*span*slopes[i+1]
 return y_keys[-1][1]+(y-y_keys[-1][0])*slopes[-1]
minimum_y_slope=min((fitted_y(1.4+(i+1)*.00001)-fitted_y(1.4+i*.00001))/.00001 for i in range(40000))
assert minimum_y_slope>0.25,'vertical face cage must remain strictly monotone'

def read(index):
 a=source['accessors'][index];v=source['bufferViews'][a['bufferView']]
 count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];fmt={5126:'f',5123:'H',5121:'B'}[a['componentType']]
 size=struct.calcsize(fmt)*count;offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*count,binary,offset+i*v.get('byteStride',size)) for i in range(a['count'])]

def accessor(values,kind='VEC3',component=5126):
 while len(data)%4:data.append(0)
 start=len(data);fmt='f' if component==5126 else 'I'
 for row in values:data.extend(struct.pack('<'+fmt*len(row),*row))
 view=len(result['bufferViews']);result['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(data)-start})
 a={'bufferView':view,'componentType':component,'count':len(values),'type':kind}
 if kind=='VEC3':a.update(min=[min(v[k] for v in values) for k in range(3)],max=[max(v[k] for v in values) for k in range(3)])
 result['accessors'].append(a);return len(result['accessors'])-1

def fit(p):
 x,y,z=p;w=smooth(1.47,1.60,y)
 # The extracted base's nape flares behind the collar. Compress only its
 # posterior depth with a broad, monotone field; the front neck, jaw and
 # accepted facial features remain untouched. The smooth half-space edge
 # keeps the lateral neck continuous instead of leaving a pressed-in seam.
 rear=max(0.,-.012-z)
 z+=.35*rear*smooth(0.,.016,rear)*(1-smooth(1.55,1.64,y))
 # A broad compact face cage, shared with the eye and brow components. The
 # entire front has one depth scale; no independent socket/nose depth dents.
 front=smooth(.012,.049,z)*smooth(1.50,1.57,y)
 muzzle=(1-smooth(.025,.068,abs(x)))*smooth(1.56,1.579,y)*(1-smooth(1.61,1.65,y))
 x*=1-.24*muzzle
 z+=(.035-z)*.42*front
 return (x*(1+.035*w),fitted_y(y),z)

def clean_neck(points,indices):
 # Clip at a real horizontal neck section and extend its single closed ring.
 # The old base's truncated shoulders never enter the independent head asset.
 plane=1.515;out=[];faces=[];lookup={}
 def vertex(p):
  key=tuple(round(v,7) for v in p)
  if key not in lookup:lookup[key]=len(out);out.append(tuple(p))
  return lookup[key]
 for i in range(0,len(indices),3):
  polygon=[points[k] for k in indices[i:i+3]];clipped=[]
  for j,a in enumerate(polygon):
   b=polygon[(j+1)%3];inside=a[1]>=plane
   if inside:clipped.append(a)
   if inside!=(b[1]>=plane):
    t=(plane-a[1])/(b[1]-a[1]);clipped.append(tuple(a[k]+t*(b[k]-a[k]) for k in range(3)))
  for j in range(1,len(clipped)-1):faces.extend(vertex(p) for p in (clipped[0],clipped[j],clipped[j+1]))
 ring=sorted([i for i,p in enumerate(out) if abs(p[1]-plane)<1e-6],key=lambda i:math.atan2(out[i][0],out[i][2]+.022))
 assert len(ring)>12,'neck cut did not produce a continuous ring'
 upper_normals=normals(out,faces)
 previous=ring
 for y in (1.505,1.49,1.47,1.45,1.425):
  t=(plane-y)/(plane-1.425);current=[]
  for i in ring:
   x,_,z=out[i];a=math.atan2(x,z+.022);normal=upper_normals[i];radial=normal[0]*math.sin(a)+normal[2]*math.cos(a)
   slope=max(-.75,min(.75,-normal[1]/radial)) if abs(radial)>.05 else 0
   h00=2*t**3-3*t*t+1;h10=t**3-2*t*t+t;h01=-2*t**3+3*t*t
   def neck_axis(start,end,tangent):
    # End tangent is zero. A same-direction initial tangent bounded by three
    # secants is monotone, so no interpolated ring can bulge past either end.
    delta=end-start
    tangent=0. if abs(delta)<1e-10 else delta*max(0.,min(3.,tangent/delta))
    return h00*start+h10*tangent+h01*end
   current.append(len(out));out.append((neck_axis(x,math.sin(a)*.043,(-.09)*slope*math.sin(a)),y,neck_axis(z,-.025+math.cos(a)*.041,(-.09)*slope*math.cos(a))))
  for i in range(len(ring)):
   j=(i+1)%len(ring);faces.extend((previous[i],current[i],previous[j],previous[j],current[i],current[j]))
  previous=current
 return out,faces

def subdivide(raw,indices):
 # One Loop subdivision on the welded skin (no UV map) rounds the cheek/jaw
 # plane changes. Preserve the lower boundary, which sits inside the collar.
 lookup={};points=[];mapping={}
 for i in set(indices):
  key=tuple(round(x,6) for x in raw[i])
  if key not in lookup:lookup[key]=len(points);points.append(raw[i])
  mapping[i]=lookup[key]
 triangles=[[mapping[i] for i in indices[j:j+3]] for j in range(0,len(indices),3)]
 edges={};neighbors=[set() for _ in points]
 for a,b,c in triangles:
  for x,y,z in [(a,b,c),(b,c,a),(c,a,b)]:
   edges.setdefault(tuple(sorted((x,y))),[]).append(z);neighbors[x].add(y);neighbors[y].add(x)
 refined=[]
 for i,p in enumerate(points):
  boundary=[n for n in neighbors[i] if len(edges[tuple(sorted((i,n)))])==1]
  if len(boundary)==2:refined.append(tuple(.75*p[k]+.125*sum(points[n][k] for n in boundary) for k in range(3)))
  else:
   n=len(neighbors[i]);beta=3/(8*n) if n>3 else 3/16
   refined.append(tuple((1-n*beta)*p[k]+beta*sum(points[v][k] for v in neighbors[i]) for k in range(3)))
 midpoint={}
 for (a,b),opposite in edges.items():
  midpoint[(a,b)]=len(refined)
  refined.append(tuple((points[a][k]+points[b][k])*.5 if len(opposite)!=2 else (points[a][k]+points[b][k])*.375+sum(points[o][k] for o in opposite)*.125 for k in range(3)))
 result=[]
 for a,b,c in triangles:
  ab=midpoint[tuple(sorted((a,b)))];bc=midpoint[tuple(sorted((b,c)))];ca=midpoint[tuple(sorted((c,a)))];result.extend([a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca])
 # Relax the adult base's pronounced nose/lip folds into one softer front
 # surface. Eye sockets and the outer skull/neck outline are left intact.
 adjacent=[set() for _ in refined]
 for i in range(0,len(result),3):
  tri=result[i:i+3]
  for a in tri:adjacent[a].update(b for b in tri if b!=a)
 for _ in range(12):
  next_points=[]
  for i,p in enumerate(refined):
   x,y,z=p;w=.23*(1-smooth(1.605,1.65,y))*smooth(-.01,.03,z)
   avg=[sum(refined[j][k] for j in adjacent[i])/len(adjacent[i]) for k in range(3)]
   next_points.append(tuple(p[k]*(1-w)+avg[k]*w for k in range(3)))
  refined=next_points
 return refined,result

def surface_z(points,indices,x,y):
 best=-math.inf
 for i in range(0,len(indices),3):
  a,b,c=[points[k] for k in indices[i:i+3]]
  if x<min(a[0],b[0],c[0]) or x>max(a[0],b[0],c[0]) or y<min(a[1],b[1],c[1]) or y>max(a[1],b[1],c[1]):continue
  denominator=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(denominator)<1e-12:continue
  u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/denominator;v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/denominator
  if u>=0 and v>=0 and u+v<=1:best=max(best,u*a[2]+v*b[2]+(1-u-v)*c[2])
 assert math.isfinite(best),'brow lies outside its skin surface';return best

def normals(p,indices):
 n=[[0.,0.,0.] for _ in p]
 for i in range(0,len(indices),3):
  a,b,c=indices[i:i+3];u=[p[b][k]-p[a][k] for k in range(3)];v=[p[c][k]-p[a][k] for k in range(3)];cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
  for vertex in (a,b,c):
   for k in range(3):n[vertex][k]+=cross[k]
 # Average the coincident UV seams, preserving the authored continuous surface.
 shared={}
 for i,point in enumerate(p):
  key=tuple(round(x,6) for x in point);shared.setdefault(key,[]).append(i)
 for group in shared.values():
  summed=[sum(n[i][k] for i in group) for k in range(3)];length=math.sqrt(sum(x*x for x in summed)) or 1
  for i in group:n[i]=tuple(x/length for x in summed)
 return n

def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
skin=[linear(v/255) for v in (246,202,174)]
result['materials']=[{'name':'Lingya_face_skin','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.86}},dict(source['materials'][1]),dict(source['materials'][0])]
result['materials'][1]['name']='Lingya_eye_brown';result['materials'][1].pop('normalTexture',None)
result['materials'][2]['name']='Lingya_face_brow';result['materials'][2].pop('normalTexture',None)
result['materials'][2]['pbrMetallicRoughness']['baseColorFactor']=[.31,.23,.17,1]
result['images']=source['images'];result['textures']=source['textures'];result['samplers']=source['samplers']

for source_name,name,material in [('Superhero_Female','Lingya-head',0),('Eyes','Lingya-eyes_viewport',1),('Eyebrows','Lingya-eyebrows',2)]:
 mesh=next(m for m in source['meshes'] if m['name']==source_name);primitive=mesh['primitives'][0];raw=read(primitive['attributes']['POSITION']);uv=read(primitive['attributes']['TEXCOORD_0']);indices=[v[0] for v in read(primitive['indices'])]
 if material==0:indices=[v for i in range(0,len(indices),3) if min(raw[k][1] for k in indices[i:i+3])>1.40 and max(abs(raw[k][0]) for k in indices[i:i+3])<.125 for v in indices[i:i+3]]
 if material==0:raw,indices=subdivide(raw,indices);raw,indices=clean_neck(raw,indices);uv=[(0,0)]*len(raw)
 if material==2:
  # Replace the source's thick upward outer brow with a quiet, fine arch.
  original=list(raw);brows=[]
  for x,y,z in original:
   near=[p[1] for p in original if abs(abs(p[0])-abs(x))<.003]
   center=(min(near)+max(near))/2;s=max(0,min(1,(abs(x)-.009)/.054))
   brows.append((x*.86,1.673+.003*math.sin(math.pi*s)-.0015*s+(y-center)*.34,z-.002))
  raw=brows
  # Keep the front ribbon only; projecting both sides of the old solid brow
  # onto the same face would create coincident, flickering triangles.
  indices=[k for i in range(0,len(indices),3) if (raw[indices[i+1]][0]-raw[indices[i]][0])*(raw[indices[i+2]][1]-raw[indices[i]][1])-(raw[indices[i+1]][1]-raw[indices[i]][1])*(raw[indices[i+2]][0]-raw[indices[i]][0])>1e-12 for k in indices[i:i+3]]
 used=sorted(set(indices));mapping={old:new for new,old in enumerate(used)};indices=[mapping[i] for i in indices];points=[fit(raw[i]) for i in used]
 if material==0:skin_points,skin_indices=points,indices
 if material==2:points=[(x,y,surface_z(skin_points,skin_indices,x,y)+.00085) for x,y,z in points]
 attrs={'POSITION':accessor(points),'NORMAL':accessor(normals(points,indices)),'TEXCOORD_0':accessor([uv[i] for i in used],'VEC2')}
 if material==0:
  colors=[]
  for i in used:
   x,y,z=raw[i];lip=(1-smooth(.009,.020,abs(y-1.579)))*(1-smooth(.015,.032,abs(x)))*smooth(.060,.082,z)
   blush=smooth(.024,.043,abs(x))*(1-smooth(.055,.079,abs(x)))*smooth(1.59,1.61,y)*(1-smooth(1.63,1.65,y))*smooth(.026,.053,z)
   tint=[skin[k]*(1-lip*.16)+(.54,.28,.23)[k]*lip*.16 for k in range(3)]
   colors.append(tuple(tint[k]*(1-blush*.055)+(.72,.34,.29)[k]*blush*.055 for k in range(3)))
  attrs['COLOR_0']=accessor(colors)
 item={'name':name,'primitives':[{'attributes':attrs,'indices':accessor([(i,) for i in indices],'SCALAR',5125),'material':material}]}
 if material<2:
  closed=[]
  for i,p in zip(used,points):
   x,y,z=raw[i]
   if material==0:
    # The original base has a complete socket surface behind the eye. Lift
    # that connected lid surface over its own eyeball, smoothly into the brow
    # and cheek; never translate the entire head or leave detached lid cards.
    r=math.sqrt(((abs(x)-.0320)/.0275)**2+((y-1.6555)/.0245)**2)
    w=(1-smooth(.74,1.28,r))*smooth(.025,.045,z)
    target=.0695-.003*((abs(x)-.032)/.0275)**2
    q=fit((x,y,max(z,z+(target-z)*w)))
   else:
    # Match the disappearing aperture while the real skin surface closes.
    q=fit((x,1.6555+(y-1.6555)*.025,z))
   closed.append(tuple(q[k]-p[k] for k in range(3)))
  closed_points=[tuple(p[k]+d[k] for k in range(3)) for p,d in zip(points,closed)]
  rest_normal=normals(points,indices);closed_normal=normals(closed_points,indices)
  item['primitives'][0]['targets']=[{'POSITION':accessor(closed),'NORMAL':accessor([tuple(b[k]-a[k] for k in range(3)) for a,b in zip(rest_normal,closed_normal)])}];item['weights']=[0];item['extras']={'targetNames':['Blink']}
 result['meshes'].append(item);result['nodes'].append({'name':name,'mesh':len(result['meshes'])-1})
result['nodes'].append({'name':'Lingya-eye_dots'})
# The new hairstyle follows this actual scalp. A guessed ellipsoid left broad
# forehead holes where the authored head is flatter/wider than an ellipsoid.
# Export only the crown skin, offset 2.8 mm; the runtime shares this light mesh.
hair_points=[];hair_indices=[];hair_lookup={};skin_normal=normals(skin_points,skin_indices)
def hairline(p):
 x,y,z=p;angle=abs(math.atan2(x,z+.023))
 # The hairline descends at the temple, curves above the real ear and then
 # gathers low behind it. A constant-height forehead cut reads as a bowl hat.
 keys=[(0,1.683),(.60,1.673),(1.00,1.636),(1.35,1.650),(1.60,1.647),(1.95,1.604),(math.pi,1.584)]
 for a,b in zip(keys,keys[1:]):
  if angle<=b[0]:return y-(a[1]+(b[1]-a[1])*smooth(a[0],b[0],angle))
 return y-keys[-1][1]
def hair_vertex(p,n):
 key=tuple(round(p[k]+n[k]*.0028,6) for k in range(3))
 if key not in hair_lookup:hair_lookup[key]=len(hair_points);hair_points.append(key)
 return hair_lookup[key]
for i in range(0,len(skin_indices),3):
 polygon=[(skin_points[k],skin_normal[k]) for k in skin_indices[i:i+3]];clipped=[]
 for j,(a,an) in enumerate(polygon):
  b,bn=polygon[(j+1)%3];da,db=hairline(a),hairline(b)
  if da>=0:clipped.append((a,an))
  if (da>=0)!=(db>=0):
   t=da/(da-db);clipped.append((tuple(a[k]+t*(b[k]-a[k]) for k in range(3)),tuple(an[k]+t*(bn[k]-an[k]) for k in range(3))))
 for j in range(1,len(clipped)-1):hair_indices.extend(hair_vertex(*p) for p in (clipped[0],clipped[j],clipped[j+1]))
(out.parents[1]/'lingya-hair-crown.js').write_text('// Generated from the independent Lingya scalp by scripts/prepare-lingya-head.py.\nexport const crownPositions='+json.dumps([v for p in hair_points for v in p],separators=(',',':'))+';\nexport const crownIndices='+json.dumps(hair_indices,separators=(',',':'))+';\n')
result['buffers']=[{'byteLength':len(data),'uri':'lingya-face.bin'}]
(out/'lingya-face.bin').write_bytes(data);(out/'lingya-face.gltf').write_text(json.dumps(result,separators=(',',':')))
print(json.dumps({'source':'CC0 universal-base silver-base','bytes':len(data),'minimumVerticalDerivative':minimum_y_slope,'vertices':{m['name']:result['accessors'][m['primitives'][0]['attributes']['POSITION']]['count'] for m in result['meshes']}}))

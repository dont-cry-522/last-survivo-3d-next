// Assets are already compressed. A stored ZIP avoids recompressing models/audio
// on the game thread, and permits one resource at a time on native file writers.
const encoder=new TextEncoder(),crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(data){let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
export class StoredZip{
 constructor(write){this.write=write;this.offset=0;this.directory=[];}
 async append(path,data){
  const name=encoder.encode(path),crc=crc32(data),offset=this.offset;if(name.length>65535||data.length>0xffffffff||offset+data.length>0xffffffff)throw Error('离线包超出 ZIP 大小限制');
  const header=new Uint8Array(30+name.length),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);header.set(name,30);
  await this.write(header);await this.write(data);this.offset+=header.length+data.length;this.directory.push({name,crc,size:data.length,offset});
 }
 async finish(){
  if(this.directory.length>65535)throw Error('离线包文件数量过多');const start=this.offset;
  for(const f of this.directory){const header=new Uint8Array(46+f.name.length),v=new DataView(header.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);v.setUint32(16,f.crc,true);v.setUint32(20,f.size,true);v.setUint32(24,f.size,true);v.setUint16(28,f.name.length,true);v.setUint32(42,f.offset,true);header.set(f.name,46);await this.write(header);this.offset+=header.length;}
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,this.directory.length,true);v.setUint16(10,this.directory.length,true);v.setUint32(12,this.offset-start,true);v.setUint32(16,start,true);await this.write(end);return this.offset+22;
 }
}
const textFile=path=>/\.(?:js|mjs|py|cmd|txt|css|html|webmanifest|json|gltf|md)$/.test(path);
export function validatePackage(manifest,release){
 if(manifest.version!==String(release)||!/^\d+-[a-f0-9]{12}$/.test(manifest.build)||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>5000)throw Error('下载清单与当前页面不同，请刷新到最新版后重试');
 const seen=new Set();let bytes=0;
 for(const f of manifest.files){if(typeof f.path!=='string'||!/^[\w./-]+$/.test(f.path)||f.path.startsWith('/')||f.path.split('/').some(p=>!p||p==='.'||p==='..')||seen.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^([a-f0-9]{64})$/.test(f.sha256))throw Error('离线资源清单无效');seen.add(f.path);bytes+=f.bytes;}
 if(bytes!==manifest.bytes||bytes>512*1048576)throw Error('离线包大小不正确');
 for(const required of ['index.html','play.html','main.js','sw.js','START_OFFLINE.cmd','start-offline.py','start-offline.mjs','OFFLINE_README.txt'])if(!seen.has(required))throw Error('离线包缺少启动文件');
 return manifest;
}
async function fetchFile(url,signal){
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(abort,60000);
 try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('资源下载失败：'+url.pathname.split('/').at(-1));return new Uint8Array(await response.arrayBuffer());}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function exportOfflinePackage({release,handle=null,signal,onProgress=()=>{},base=new URL('./',import.meta.url)}){
 let writer;const chunks=[];
 try{
  const raw=await fetchFile(new URL('offline-package.json',base),signal),manifest=validatePackage(JSON.parse(new TextDecoder().decode(raw)),release),prefix='realm-echoes-v'+release+'/';
  if(!crypto.subtle)throw Error('当前页面不支持资源校验，请从 HTTPS 游戏网址下载');
  if(handle)writer=await handle.createWritable();
  const zip=new StoredZip(data=>writer?writer.write(data):chunks.push(data));let bytes=0,done=0;
  // An already installed matching cache is safe to reuse. Never mix assets
  // from an older worker into a new package: every entry is hash checked.
  const cacheName='forest3d-offline:'+base.pathname+':'+manifest.build,cache=typeof caches!=='undefined'&&(await caches.keys()).includes(cacheName)?await caches.open(cacheName):null;
  for(const file of manifest.files){
   signal?.throwIfAborted();onProgress({done,total:manifest.files.length,bytes,totalBytes:manifest.bytes});
   const cached=await cache?.match(new URL(file.path,base)),url=new URL(file.path,base);url.searchParams.set('v',release);url.searchParams.set('offline-export',manifest.build);
   let data=cached?new Uint8Array(await cached.arrayBuffer()):await fetchFile(url,signal);if(textFile(file.path))data=encoder.encode(new TextDecoder().decode(data).replace(/\r\n/g,'\n'));
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
   if(data.length!==file.bytes||digest!==file.sha256)throw Error('资源版本未对齐，请先启用已下载的新版或刷新后重试：'+file.path);
   await zip.append(prefix+file.path,data);bytes+=data.length;done++;
  }
  signal?.throwIfAborted();await zip.append(prefix+'offline-package.json',raw);await zip.finish();signal?.throwIfAborted();if(writer)await writer.close();onProgress({done,total:done,bytes,totalBytes:manifest.bytes});
  return writer?null:new Blob(chunks,{type:'application/zip'});
 }catch(error){if(writer)await writer.abort().catch(()=>{});throw error;}finally{chunks.length=0;}
}

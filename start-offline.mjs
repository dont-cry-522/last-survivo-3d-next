import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {spawn} from 'node:child_process';
const root=await realpath(fileURLToPath(new URL('./',import.meta.url))),requested=process.argv.find(s=>s.startsWith('--port=')),port=requested?Number(requested.slice(7)):8897;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),candidate=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(candidate!==root&&!candidate.startsWith(root+sep))throw Error('Outside package');const file=await realpath(candidate);if(!file.startsWith(root+sep))throw Error('Outside package');const info=await stat(file);if(!info.isFile())throw Error('Not a file');
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404);res.end('File not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 8897 is in use. Close the previous local game server, then retry.':error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 const url='http://127.0.0.1:'+server.address().port+'/play.html';console.log('Realm Echoes: '+url+'\nKeep this window open. Press Ctrl+C to stop.');
 if(!process.argv.includes('--no-open')){const command=process.platform==='win32'?'rundll32':process.platform==='darwin'?'open':'xdg-open',args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];spawn(command,args,{stdio:'ignore',windowsHide:true}).on('error',()=>console.log('Open the address above in your browser.'));}
});

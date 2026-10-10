import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CHARACTER_ASSETS as assets} from '../character-assets.js';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root));
const html=(await read('index.html')).toString(),version=html.match(/main\.js\?v=(\d+)/)?.[1];
if(!version)throw Error('Missing release version');
// Older installed workers only intercept / and index.html. This new full-page
// entry can load the latest release without asking players to erase site data.
const play=new URL('play.html',root);
if(process.argv.includes('--check')){
 if((await readFile(play,'utf8')).replace(/\r\n/g,'\n')!==html.replace(/\r\n/g,'\n'))throw Error('Fresh online entry is stale. Run npm run offline:build.');
}else await writeFile(play,html);
const files=['index.html','play.html','style.css','manifest.webmanifest','THIRD_PARTY_ASSETS.md'];
for(const f of await readdir(root))if(f.endsWith('.js')&&f!=='sw.js')files.push(f);
for(const dir of ['vendor','assets/bestiary','assets/icons','assets/audio','assets/environment'])for(const f of await readdir(new URL(dir+'/',root)))if(/\.(js|png|jpg|ogg|mp3)$/.test(f))files.push(dir+'/'+f);
const characterFiles=[...assets.textures,assets.motion.file,assets.motionFallback.file];
for(const [name,model] of Object.entries(assets.models)){
 characterFiles.push(model.file,name+'.gltf');
 const gltf=JSON.parse(await read('assets/characters/'+name+'.gltf'));
 for(const item of [...gltf.buffers||[],...gltf.images||[]])if(item.uri&&!item.uri.startsWith('data:'))characterFiles.push(item.uri);
}
files.push(...new Set(characterFiles.map(f=>'assets/characters/'+f)));
files.sort();const hash=createHash('sha256');let bytes=0;
// Git normalizes text on Pages/Linux; the package must also be reproducible on Windows.
const normalize=text=>text.replace(/\r\n/g,'\n');
const template=normalize((await read('scripts/offline-worker.txt')).toString());hash.update(template);
for(const file of files){let content=await read(file);if(/\.(?:js|css|html|webmanifest|json|gltf|md)$/.test(file))content=Buffer.from(normalize(content.toString()));hash.update(file);hash.update(content);bytes+=content.length;}
const build=version+'-'+hash.digest('hex').slice(0,12);
const worker=template.toString().replace('__VERSION__',JSON.stringify(version)).replace('__BUILD__',JSON.stringify(build)).replace('__FILES__',JSON.stringify(files)).replace('__BYTES__',String(bytes));
const out=new URL('sw.js',root);
if(process.argv.includes('--check')){
 if(normalize(await readFile(out,'utf8'))!==worker)throw Error('Offline resource list is stale. Run npm run offline:build.');
}else await writeFile(out,worker);
console.log(`${build}: ${files.length} resources, ${(bytes/1048576).toFixed(1)} MiB${process.argv.includes('--check')?' verified':''}`);

import {readFileSync} from 'node:fs';

// Follow the production import edge so shared caches retain their module identity.
export function runtimeImport(file,dependency){
 const parent=new URL('../'+file,import.meta.url),source=readFileSync(parent,'utf8');
 const entry=[...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]).find(path=>path.split('?')[0]==='./'+dependency);
 if(!entry)throw new Error(file+' does not import '+dependency);
 return import(new URL(entry,parent));
}

import fs from 'node:fs/promises';
import path from 'node:path';
import {catalog} from './catalog.mjs';
import {createHash} from 'node:crypto';
import {systemPaths} from './system-paths.mjs';
export function librarySignature(library){const hash=createHash('sha256');for(const item of library.items)hash.update(JSON.stringify(item));hash.update(JSON.stringify(library.problems));hash.update(JSON.stringify(library.roots));hash.update(JSON.stringify(library.enginePath??null));return hash.digest('hex')}
export function steamLibraryPaths(text){
  return [...text.matchAll(/"path"\s*"((?:\\.|[^"\\])*)"/g)].map(m=>m[1].replace(/\\([\\"])/g,'$1')).filter(p=>path.isAbsolute(p));
}
export async function discoverRoots(config,detected={}){
  const roots=new Set((config.roots||[]).map(p=>path.resolve(p)));
  const steamRoots=new Set([...(config.steamRoots||[]),...(detected.steamRoots||[])].map(p=>path.resolve(p)));
  const installs=new Set([...(config.wallpaperEngineDirectories||[]),...(detected.wallpaperEngineDirectories||[])]);
  for(const install of installs)if(path.basename(path.dirname(install)).toLowerCase()==='common'&&path.basename(path.dirname(path.dirname(install))).toLowerCase()==='steamapps')steamRoots.add(path.dirname(path.dirname(path.dirname(install))));
  for(const steamRoot of [...steamRoots]){
    try{const file=path.join(steamRoot,'steamapps/libraryfolders.vdf');if((await fs.stat(file)).size>1024*1024)throw new Error('Steam library list too large');for(const p of steamLibraryPaths(await fs.readFile(file,'utf8')))steamRoots.add(p)}
    catch(e){if(e.code!=='ENOENT')throw e}
  }
  for(const steamRoot of steamRoots){roots.add(path.join(steamRoot,'steamapps/workshop/content/431960'));installs.add(path.join(steamRoot,'steamapps/common/wallpaper_engine'))}
  for(const install of installs)for(const name of ['defaultprojects','myprojects','431960'])roots.add(path.join(install,'projects',name));
  const available=[];
  for(const root of roots){try{const stat=await fs.lstat(root);if(stat.isDirectory()&&!stat.isSymbolicLink())available.push(root)}catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))throw e}}
  return [...new Map(available.map(p=>[p.toLowerCase(),p])).values()];
}
export async function findEngine(config,detected={}){
  const candidates=new Set([...(config.wallpaperEngineDirectories||[]),...(detected.wallpaperEngineDirectories||[])]);
  for(const steam of [...(config.steamRoots||[]),...(detected.steamRoots||[])]){
    candidates.add(path.join(steam,'steamapps/common/wallpaper_engine'));
    try{const file=path.join(steam,'steamapps/libraryfolders.vdf');if((await fs.stat(file)).size>1024*1024)throw new Error('Steam library list too large');for(const library of steamLibraryPaths(await fs.readFile(file,'utf8')))candidates.add(path.join(library,'steamapps/common/wallpaper_engine'))}catch(e){if(e.code!=='ENOENT')throw e}
  }
  for(const dir of candidates)for(const name of ['wallpaper64.exe','wallpaper32.exe']){
    try{const file=path.join(dir,name),stat=await fs.lstat(file);if(stat.isFile()&&!stat.isSymbolicLink())return file}catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))throw e}
  }
  return null;
}
export async function scanLibrary(config,cache=null,detected=null){const system=detected??(config.autoDiscover?await systemPaths():{});const roots=await discoverRoots(config,system);return {...await catalog(roots,{native:!!config.nativeRendering,cache,inlinePreview:false}),roots,enginePath:await findEngine(config,system)}}
export class LibraryMonitor{
  constructor(scan,onChange,intervalMs=5000){this.scan=scan;this.onChange=onChange;this.intervalMs=intervalMs;this.current=null;this.signature='';this.pending=null;this.lastScan=-Infinity}
  async refresh(force=false){
    if(this.pending)return this.pending;
    if(!force&&Date.now()-this.lastScan<this.intervalMs)return this.current;
    this.pending=(async()=>{const next=await this.scan();const signature=librarySignature(next);const changed=signature!==this.signature;this.current=next;this.signature=signature;this.lastScan=Date.now();if(changed)await this.onChange(next);return next})();
    try{return await this.pending}finally{this.pending=null}
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {catalog} from './catalog.mjs';
import {discoverRoots,scanLibrary,LibraryMonitor,steamLibraryPaths} from './library.mjs';
async function fixture(fn){const parent=path.resolve(os.tmpdir());const root=await fs.mkdtemp(path.join(parent,'codex-library-'));try{await fn(root)}finally{assert.equal(path.dirname(await fs.realpath(root)),await fs.realpath(parent));assert.ok(path.basename(root).startsWith('codex-library-'));await fs.rm(root,{recursive:true,force:true})}}
async function project(root,name,type='scene',file='scene.json'){const directory=path.join(root,name);await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'project.json'),JSON.stringify({title:name,type,file}));await fs.writeFile(path.join(directory,file),'{}');return directory}
test('includes named built-in and local projects, deduplicating overlapping roots',()=>fixture(async root=>{
 await project(root,'shimmering_particles');await project(root,'我的新壁纸');await project(root,'legacy',undefined);await project(root,'unsafe','application','a.exe');
 const result=await catalog([root,root],{native:true});assert.equal(result.items.length,4);assert.equal(result.items.filter(x=>x.mode==='native').length,3);assert.equal(result.items.find(x=>x.name==='unsafe').supported,false);
}));
test('discovers Workshop, defaults, local creations and backup collections across Steam libraries',()=>fixture(async root=>{
 const steam=path.join(root,'steam'),second=path.join(root,'second');await fs.mkdir(path.join(steam,'steamapps'),{recursive:true});
 await fs.writeFile(path.join(steam,'steamapps/libraryfolders.vdf'),`"libraryfolders" { "0" { "path" "${second.replaceAll('\\','\\\\')}" } }`);
 const install=path.join(second,'steamapps/common/wallpaper_engine');
 const expected=[path.join(second,'steamapps/workshop/content/431960'),...['defaultprojects','myprojects','431960'].map(x=>path.join(install,'projects',x))];
 for(const directory of expected)await fs.mkdir(directory,{recursive:true});
 const found=await discoverRoots({steamRoots:[steam]});assert.deepEqual(new Set(found),new Set(expected));assert.equal(steamLibraryPaths('"path" "relative/path"').length,0);
}));
test('automatically detects new projects, completed downloads and removals without duplicate notifications',()=>fixture(async root=>{
 const changes=[];const monitor=new LibraryMonitor(()=>scanLibrary({roots:[root],nativeRendering:true}),next=>changes.push(next.items.map(x=>x.name)),0);
 await monitor.refresh();await fs.mkdir(path.join(root,'incoming'));await monitor.refresh();
 await project(root,'incoming');await monitor.refresh();await monitor.refresh();
 await fs.unlink(path.join(root,'incoming/project.json'));await monitor.refresh();
 assert.deepEqual(changes,[[],[],['incoming'],[]]);
}));
test('large videos use the native renderer, and scene paths cannot escape the project',()=>fixture(async root=>{
 const directory=await project(root,'large','video','big.mp4');const file=await fs.open(path.join(directory,'big.mp4'),'w');await file.truncate(129*1024*1024);await file.close();
 const escaped=path.join(root,'escape');await fs.mkdir(escaped);await fs.writeFile(path.join(escaped,'project.json'),JSON.stringify({type:'scene',file:'../large/big.mp4'}));
 const result=await catalog([root],{native:true});assert.equal(result.items.length,1);assert.equal(result.items[0].mode,'native');assert.equal(result.problems.length,1);
}));
test('concurrent refresh requests share one scan',async()=>{
 let scans=0,resolve;const scan=new Promise(r=>{resolve=r});const monitor=new LibraryMonitor(async()=>{scans++;return scan},()=>{},0);
 const a=monitor.refresh(),b=monitor.refresh(true);resolve({items:[],problems:[],roots:[]});await Promise.all([a,b]);assert.equal(scans,1);
});
test('published scenes resolve packed scene.json through scene.pkg',()=>fixture(async root=>{
 const directory=await project(root,'published');await fs.rename(path.join(directory,'scene.json'),path.join(directory,'scene.pkg'));
 const item=(await catalog([root],{native:true})).items[0];assert.equal(item.mode,'native');assert.equal(path.basename(item.file),'scene.pkg');
}));
test('Wallpaper Engine type labels are case-insensitive',()=>fixture(async root=>{
 await project(root,'Scene project','Scene');await project(root,'Video project','Video','movie.mp4');
 const items=(await catalog([root],{native:true})).items;assert.equal(items.length,2);assert.ok(items.every(x=>x.supported));assert.deepEqual(new Set(items.map(x=>x.type)),new Set(['scene','video']));
}));

test('opening the library shortens an already scheduled idle interval',async t=>{
 let now=100000,scans=0;t.mock.method(Date,'now',()=>now);
 const monitor=new LibraryMonitor(async()=>{scans++;return {items:[],problems:[],roots:[]}},()=>{},30000);
 await monitor.refresh();now+=6000;await monitor.refresh();assert.equal(scans,1);
 monitor.intervalMs=5000;await monitor.refresh();assert.equal(scans,2);
 await monitor.refresh();assert.equal(scans,2);await monitor.refresh(true);assert.equal(scans,3);
});
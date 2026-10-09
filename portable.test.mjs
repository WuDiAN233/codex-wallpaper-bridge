import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {scanLibrary,findEngine,librarySignature} from './library.mjs';import {addLocation,validateConfig,readConfig,saveConfig} from './configuration.mjs';
const defaults={autoDiscover:true,roots:[],steamRoots:[],wallpaperEngineDirectories:[],nativeRendering:true,refreshIntervalMs:5000};
async function fixture(fn){const parent=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'portable-wallpaper-'));try{await fn(root)}finally{assert.equal(path.dirname(await fs.realpath(root)),parent);assert.ok(path.basename(root).startsWith('portable-wallpaper-'));await fs.rm(root,{recursive:true,force:true})}}
test('auto detection follows a custom Steam path to another library with spaces and Unicode',()=>fixture(async root=>{
 const steam=path.join(root,'Steam custom'),library=path.join(root,'游戏库 second'),install=path.join(library,'steamapps/common/wallpaper_engine'),project=path.join(library,'steamapps/workshop/content/431960/123');
 await fs.mkdir(path.join(steam,'steamapps'),{recursive:true});await fs.mkdir(install,{recursive:true});await fs.mkdir(project,{recursive:true});await fs.writeFile(path.join(install,'wallpaper64.exe'),'fixture');
 await fs.writeFile(path.join(steam,'steamapps/libraryfolders.vdf'),`"libraryfolders" {"0" {"path" "${library.replaceAll('\\','\\\\')}"}}`);
 await fs.writeFile(path.join(project,'project.json'),JSON.stringify({title:'Scene',type:'scene',file:'scene.pkg'}));await fs.writeFile(path.join(project,'scene.pkg'),'fixture');
 const found=await scanLibrary(defaults,null,{steamRoots:[steam]});assert.equal(found.items.length,1);assert.equal(found.enginePath,path.join(install,'wallpaper64.exe'));assert.equal(found.items[0].mode,'native');
}));
test('manual install, collection and single project selections are portable and deduplicated',()=>fixture(async root=>{
 const install=path.join(root,'custom engine'),collection=path.join(root,'wallpapers'),project=path.join(collection,'local scene');await fs.mkdir(install);await fs.mkdir(project,{recursive:true});await fs.writeFile(path.join(install,'wallpaper32.exe'),'fixture');await fs.writeFile(path.join(project,'project.json'),'{}');
 let config=await addLocation(defaults,install);assert.equal(await findEngine(config),path.join(install,'wallpaper32.exe'));config=await addLocation(config,collection);config=await addLocation(config,project);assert.deepEqual(config.roots,[collection]);
 await fs.writeFile(path.join(root,'config.example.json'),JSON.stringify(defaults));await saveConfig(root,config);assert.deepEqual(await readConfig(root),config);
 await assert.rejects(addLocation(config,root),/没有壁纸项目/);
}));
test('defaults and missing engine allow an empty library to start safely',()=>fixture(async root=>{
 await fs.writeFile(path.join(root,'config.example.json'),JSON.stringify(defaults));assert.deepEqual(await readConfig(root),defaults);const found=await scanLibrary(defaults,null,{});assert.equal(found.items.length,0);assert.equal(found.enginePath,null);
 assert.notEqual(librarySignature(found),librarySignature({...found,enginePath:'another-engine'}));assert.throws(()=>validateConfig({...defaults,roots:['relative']}),/完整路径/);
}));

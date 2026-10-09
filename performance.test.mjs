import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {FileCache} from './file-cache.mjs';
import {scanLibrary,librarySignature} from './library.mjs';
async function fixture(fn){const parent=await fs.realpath(os.tmpdir());const root=await fs.mkdtemp(path.join(parent,'wallpaper-cache-'));try{await fn(root)}finally{assert.equal(path.dirname(await fs.realpath(root)),parent);assert.ok(path.basename(root).startsWith('wallpaper-cache-'));await fs.rm(root,{recursive:true,force:true})}}
test('unchanged library reads no metadata or preview contents again',()=>fixture(async root=>{
 const dir=path.join(root,'project');await fs.mkdir(dir);
 await fs.writeFile(path.join(dir,'project.json'),JSON.stringify({title:'first',type:'image',file:'image.png',preview:'image.png'}));await fs.writeFile(path.join(dir,'image.png'),'fixture');
 const cache=new FileCache();const config={roots:[root]};const first=await scanLibrary(config,cache);assert.equal(cache.reads,1);
 const second=await scanLibrary(config,cache);assert.equal(cache.reads,1);assert.equal(cache.hits,1);assert.deepEqual(second,first);assert.equal(librarySignature(first),librarySignature(second));
 await fs.writeFile(path.join(dir,'project.json'),JSON.stringify({title:'renamed wallpaper',type:'image',file:'image.png',preview:'image.png'}));
 await fs.writeFile(path.join(dir,'image.png'),'new fixture pixels');
 const changed=await scanLibrary(config,cache);assert.equal(changed.items[0].name,'renamed wallpaper');assert.notEqual(changed.items[0].previewStamp,first.items[0].previewStamp);assert.notEqual(librarySignature(first),librarySignature(changed));
 await fs.unlink(path.join(dir,'project.json'));const removed=await scanLibrary(config,cache);assert.equal(removed.items.length,0);assert.equal(cache.entries.size,0);assert.equal(cache.bytes,0);
}));
test('preview cache stays bounded and oversized entries remain readable',()=>fixture(async root=>{
 const cache=new FileCache(20);cache.begin();
 for(let i=0;i<10;i++){const file=path.join(root,String(i));await fs.writeFile(file,'123456');assert.equal(await cache.read(file,await fs.stat(file),'utf8'),'123456');assert.ok(cache.bytes<=20)}
 assert.equal(cache.entries.size,1);
 const big=path.join(root,'big');await fs.writeFile(big,'a'.repeat(40));assert.equal((await cache.read(big,await fs.stat(big),'utf8')).length,40);assert.ok(cache.bytes<=20);
 cache.begin();cache.end();assert.equal(cache.bytes,0);
}));
test('incomplete downloads are retried and appear after files arrive',()=>fixture(async root=>{
 const dir=path.join(root,'incoming');await fs.mkdir(dir);await fs.writeFile(path.join(dir,'project.json'),'{');const cache=new FileCache();const config={roots:[root]};
 assert.equal((await scanLibrary(config,cache)).items.length,0);
 await fs.writeFile(path.join(dir,'project.json'),JSON.stringify({type:'image',file:'image.png'}));assert.equal((await scanLibrary(config,cache)).items.length,0);
 await fs.writeFile(path.join(dir,'image.png'),'complete');assert.equal((await scanLibrary(config,cache)).items.length,1);
}));
test('cached file paths are revalidated when a file is replaced by a link',()=>fixture(async root=>{
 const dir=path.join(root,'project');await fs.mkdir(dir);await fs.writeFile(path.join(dir,'project.json'),JSON.stringify({type:'image',file:'image.png'}));
 const media=path.join(dir,'image.png');await fs.writeFile(media,'local');const cache=new FileCache();const config={roots:[root]};assert.equal((await scanLibrary(config,cache)).items.length,1);
 const external=path.join(root,'external.png');await fs.writeFile(external,'external');await fs.unlink(media);await fs.symlink(external,media,'file');
 const changed=await scanLibrary(config,cache);assert.equal(changed.items.length,0);assert.match(changed.problems[0].reason,/Linked wallpaper paths/);
}));

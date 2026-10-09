import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {SnapshotCache,snapshotKey} from './snapshot-cache.mjs';
const colors=Object.fromEntries(['background','panel','panelAlt','accent','accentAlt','secondary','highlight','text','muted','line'].map(k=>[k,'#123456']));
const png=Buffer.alloc(64);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(1868,16);png.writeUInt32BE(1080,20);
const frame='data:image/png;base64,'+png.toString('base64'),key=n=>String(n).repeat(64);
async function fixture(fn){const parent=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'codex-static-test-'));try{await fn(root)}finally{assert.equal(path.dirname(await fs.realpath(root)),parent);assert.ok(path.basename(root).startsWith('codex-static-test-'));await fs.rm(root,{recursive:true,force:true})}}
test('snapshot survives restart with original dimensions and palette',()=>fixture(async root=>{
 const cache=new SnapshotCache(root);assert.equal(await cache.get(key(1)),null);
 const saved=await cache.put(key(1),frame,colors),loaded=await new SnapshotCache(root).get(key(1));
 assert.deepEqual(loaded,saved);assert.deepEqual(await fs.readFile(saved.file),png);
}));
test('changed or removed source invalidates snapshots, unchanged files retain the key',()=>fixture(async root=>{
 const item={directory:root,project:path.join(root,'project.json'),file:path.join(root,'scene.pkg')};
 await fs.writeFile(item.project,'{}');await fs.writeFile(item.file,'first');const before=await snapshotKey(item);
 assert.equal(await snapshotKey(item),before);await fs.writeFile(item.file,'second version');assert.notEqual(await snapshotKey(item),before);
 await fs.unlink(item.file);await assert.rejects(snapshotKey(item),{code:'ENOENT'});
}));
test('bounded cache evicts older snapshots while preserving unrelated files',()=>fixture(async root=>{
 const cache=new SnapshotCache(root,{maxBytes:128,maxEntries:2});await fs.writeFile(path.join(root,'personal.png'),'keep');
 const a=await cache.put(key(1),frame,colors);await fs.utimes(a.file,new Date(1000),new Date(1000));
 await cache.put(key(2),frame,colors);await cache.put(key(3),frame,colors);
 assert.equal(await cache.get(key(1)),null);assert.ok(await cache.get(key(2)));assert.ok(await cache.get(key(3)));
 assert.equal(await fs.readFile(path.join(root,'personal.png'),'utf8'),'keep');
}));
test('truncated images and corrupt metadata become cache misses',()=>fixture(async root=>{
 const cache=new SnapshotCache(root);const entry=await cache.put(key(1),frame,colors);
 await fs.writeFile(entry.file,'broken');assert.equal(await cache.get(key(1)),null);
 await cache.put(key(1),frame,colors);await fs.writeFile(cache.paths(key(1)).metadata,'{');assert.equal(await cache.get(key(1)),null);
}));
test('invalid inputs cannot escape the cache or overwrite a saved snapshot',()=>fixture(async root=>{
 const cache=new SnapshotCache(root);const entry=await cache.put(key(1),frame,colors);
 await assert.rejects(cache.get('../outside'),/Invalid snapshot key/);
 await assert.rejects(cache.put(key(1),'data:image/png;base64,AAAA',colors),/Invalid snapshot PNG/);
 await assert.rejects(cache.put(key(2),frame,{}),/Invalid static snapshot/);
 assert.deepEqual(await fs.readFile(entry.file),png);
 assert.equal((await fs.readdir(root)).filter(n=>n.endsWith('.tmp')).length,0);
}));

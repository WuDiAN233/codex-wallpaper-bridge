import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {FileCache} from './file-cache.mjs';
import {catalog,safeFile} from './catalog.mjs';
async function fixture(fn){const root=await fs.mkdtemp(path.join(process.env.TEMP||os.tmpdir(),'codex-wallpaper-test-'));try{await fn(root)}finally{await fs.rm(root,{recursive:true,force:true})}}
async function project(root,id,metadata){const folder=path.join(root,id);await fs.mkdir(folder);await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(metadata));return folder}

test('thumbnail pipeline does not read or retain original preview bytes',()=>fixture(async root=>{
  const dir=await project(root,'123',{type:'video',file:'a.mp4',preview:'preview.gif'});
  await fs.writeFile(path.join(dir,'a.mp4'),'ftyp');await fs.writeFile(path.join(dir,'preview.gif'),Buffer.alloc(120*1024,1));
  const cache=new FileCache();
  const legacy=await catalog([root],{cache});assert.ok(legacy.items[0].preview);const originalBytes=cache.bytes;
  const result=await catalog([root],{cache,inlinePreview:false});
  assert.equal(result.items[0].preview,null);assert.equal(result.items[0].previewFile,path.join(dir,'preview.gif'));
  assert.ok(result.items[0].previewStamp);assert.ok(originalBytes-cache.bytes>=320*1024);
  assert.equal(cache.entries.size,1);
}));
test('lists videos and rejects scene animations as unsupported',()=>fixture(async root=>{
  const video=await project(root,'123',{type:'video',file:'loop.mp4',title:'Video'});await fs.writeFile(path.join(video,'loop.mp4'),'ftyp');
  await project(root,'456',{type:'scene',file:'scene.pkg',title:'Scene'});
  const result=await catalog([root]);assert.equal(result.items.length,2);assert.equal(result.items[0].supported,true);assert.equal(result.items[1].supported,false);assert.equal(result.items[1].type,'scene');
}));
test('rejects metadata escaping its workshop folder',()=>fixture(async root=>{
  await fs.writeFile(path.join(root,'outside.mp4'),'ftyp');await project(root,'123',{type:'video',file:'../outside.mp4'});
  const result=await catalog([root]);assert.equal(result.items.length,0);assert.equal(result.problems.length,1);
}));
test('does not read an external preview',()=>fixture(async root=>{
  await fs.writeFile(path.join(root,'outside.png'),'private');const dir=await project(root,'123',{type:'video',file:'a.mp4',preview:'../outside.png'});await fs.writeFile(path.join(dir,'a.mp4'),'ftyp');
  assert.equal((await catalog([root])).items[0].preview,null);
}));
test('rejects oversized video without copying it',()=>fixture(async root=>{
  const dir=await project(root,'123',{type:'video',file:'big.mp4'});const file=await fs.open(path.join(dir,'big.mp4'),'w');await file.truncate(129*1024*1024);await file.close();
  assert.equal((await catalog([root])).items[0].supported,false);
}));
test('safeFile rejects linked files',()=>fixture(async root=>{
  await fs.mkdir(path.join(root,'actual'));await fs.writeFile(path.join(root,'actual','a.mp4'),'data');await fs.symlink(path.join(root,'actual'),path.join(root,'link'),'junction');
  await assert.rejects(safeFile(root,path.join('link','a.mp4')),/Linked/);
}));
test('oversized project metadata is reported, not parsed',()=>fixture(async root=>{
  const dir=await project(root,'123',{});await fs.writeFile(path.join(dir,'project.json'),' '.repeat(256*1024+1));
  const result=await catalog([root]);assert.equal(result.items.length,0);assert.match(result.problems[0].reason,/Oversized/);
}));

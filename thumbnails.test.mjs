import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {Thumbnails} from './thumbnails.mjs';
test('large previews become cached small JPEGs and corrupt images do not block valid thumbnails',{skip:process.platform!=='win32'},async()=>{
 const parent=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'wallpaper-thumbs-'));
 try{
  // Uncompressed 512x256 BMP fixture: >128 KiB, no external image assets.
  const width=512,height=256,stride=width*3,bitmap=Buffer.alloc(54+stride*height,180);bitmap.write('BM');bitmap.writeUInt32LE(bitmap.length,2);bitmap.fill(0,6,54);bitmap.writeUInt32LE(54,10);bitmap.writeUInt32LE(40,14);bitmap.writeInt32LE(width,18);bitmap.writeInt32LE(height,22);bitmap.writeUInt16LE(1,26);bitmap.writeUInt16LE(24,28);
  const source=path.join(root,'预览 image.bmp'),bad=path.join(root,'broken.gif');await fs.writeFile(source,bitmap);await fs.writeFile(bad,'invalid');const cache=new Thumbnails(root),items=[{previewFile:source,previewStamp:'1'},{previewFile:bad,previewStamp:'1'}];
  await cache.fill(items);assert.match(items[0].preview,/^data:image\/jpeg;base64,/);assert.ok(items[0].preview.length<128*1024);assert.equal(items[1].preview,undefined);assert.equal(cache.failed.size,1);
  const file=path.join(root,'thumbnails',items[0].thumbnailKey+'.jpg'),before=(await fs.stat(file)).mtimeMs;await cache.fill(items);assert.equal((await fs.stat(file)).mtimeMs,before);await cache.fill([]);assert.equal(cache.values.size,0);assert.equal(cache.failed.size,0);
 }finally{assert.equal(path.dirname(await fs.realpath(root)),parent);assert.ok(path.basename(root).startsWith('wallpaper-thumbs-'));await fs.rm(root,{recursive:true,force:true})}
});

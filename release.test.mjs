import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
test('shipped compatibility files exactly match installer checksums',async()=>{
 const manifest=JSON.parse(await fs.readFile(path.join(root,'compat-manifest.json'),'utf8'));
 for(const file of manifest.files){const bytes=await fs.readFile(path.join(root,'compat-runtime',...file.path.split('\\')));assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(),file.patchedHash)}
});
test('default package configuration contains no personal paths',async()=>{
 const config=JSON.parse(await fs.readFile(path.join(root,'config.example.json'),'utf8'));assert.equal(config.autoDiscover,true);for(const key of ['roots','steamRoots','wallpaperEngineDirectories'])assert.deepEqual(config[key],[]);
});

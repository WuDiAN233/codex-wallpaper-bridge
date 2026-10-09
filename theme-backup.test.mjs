import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {backupTheme} from './theme-backup.mjs';
async function fixture(fn){const parent=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'codex-backup-test-'));try{const source=path.join(root,'active'),destination=path.join(root,'history','new');await fs.mkdir(source);await fs.writeFile(path.join(source,'theme.json'),JSON.stringify({id:'codex-wallpaper-library',schemaVersion:1,image:'current.png',media:{type:'image'}}));await fs.writeFile(path.join(source,'current.png'),'current');await fs.writeFile(path.join(source,'old.png'),'unused');await fn(source,destination)}finally{assert.equal(path.dirname(await fs.realpath(root)),parent);assert.ok(path.basename(root).startsWith('codex-backup-test-'));await fs.rm(root,{recursive:true,force:true})}}
test('static backup copies only referenced media, theme and optional CSS; rollback restores them',()=>fixture(async(source,destination)=>{
 await fs.writeFile(path.join(source,'theme.css'),'/* custom */');await backupTheme(source,destination);
 assert.deepEqual((await fs.readdir(destination)).sort(),['current.png','theme.css','theme.json']);
 await fs.writeFile(path.join(source,'current.png'),'changed');await fs.cp(destination,source,{recursive:true,force:true});
 assert.equal(await fs.readFile(path.join(source,'current.png'),'utf8'),'current');assert.equal(await fs.readFile(path.join(source,'old.png'),'utf8'),'unused');
}));
test('unfamiliar themes retain all their assets',()=>fixture(async(source,destination)=>{
 await fs.writeFile(path.join(source,'theme.json'),JSON.stringify({id:'other',image:'current.png'}));await backupTheme(source,destination);
 assert.ok((await fs.readdir(destination)).includes('old.png'));
}));
test('missing or escaping images cannot create a completed rollback backup',()=>fixture(async(source,destination)=>{
 await fs.unlink(path.join(source,'current.png'));await assert.rejects(backupTheme(source,destination),{code:'ENOENT'});
 await assert.rejects(fs.stat(destination),{code:'ENOENT'});
 await fs.writeFile(path.join(source,'theme.json'),JSON.stringify({id:'codex-wallpaper-library',schemaVersion:1,image:'../outside.png',media:{type:'image'}}));
 await assert.rejects(backupTheme(source,destination),/escaped/);await assert.rejects(fs.stat(destination),{code:'ENOENT'});
}));

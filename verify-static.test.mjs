import test from 'node:test';
import assert from 'node:assert/strict';
import {staticStateReady,verifyStatic} from './verify-static.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const expected={themeId:'theme',revision:'new'};
const valid=()=>({installed:true,version:'1',expectedVersion:'1',stylePresent:true,businessClassPollution:0,mediaType:'image',themeId:'theme',revision:'new',documentOverflow:{x:false},documentVisibility:'visible',documentHidden:false,pass:true,readiness:{viewportPass:true,structurePass:true,conversationPass:true}});
test('visible pages must pass upstream visual checks',()=>{assert.ok(staticStateReady(valid(),expected));assert.equal(staticStateReady({...valid(),pass:false},expected),false)});
test('a background page can confirm the new image without pretending it is visible',()=>{assert.ok(staticStateReady({...valid(),pass:false,documentHidden:true,documentVisibility:'hidden'},expected))});
test('background confirmation rejects stale payloads, missing styles and broken conversations',()=>{
 const hidden={...valid(),pass:false,documentHidden:true,documentVisibility:'hidden'};
 for(const patch of [{revision:'old'},{themeId:'other'},{stylePresent:false},{mediaType:'video'},{installed:false},{version:'old'},{businessClassPollution:1},{documentOverflow:{x:true}},{readiness:{viewportPass:true,structurePass:false,conversationPass:false}}])assert.equal(staticStateReady({...hidden,...patch},expected),false);
});
async function fixture(fn){const parent=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'codex-verify-static-'));try{await fs.mkdir(path.join(root,'scripts'));await fs.writeFile(path.join(root,'scripts','injector.mjs'),`export async function loadPayload(){return {mediaType:'image',theme:{id:'theme'},revision:'new'}};export async function verifySession(session){return session.next()}`);await fn(root)}finally{assert.equal(path.dirname(await fs.realpath(root)),parent);assert.ok(path.basename(root).startsWith('codex-verify-static-'));await fs.rm(root,{recursive:true,force:true})}}
test('confirmation waits for the new revision and decodes its actual image',()=>fixture(async root=>{
 let probes=0,decodes=0;const session={id:'page',next:async()=>({...valid(),revision:++probes===1?'old':'new'}),evaluate:async()=>{decodes++;return {revision:'new',width:1868,height:1080}}};
 assert.deepEqual(await verifyStatic(session,root,root),{background:false,width:1868,height:1080});assert.equal(probes,2);assert.equal(decodes,1);
}));
test('decode failure and revision changes cannot produce successful confirmation',()=>fixture(async root=>{
 const session={id:'page',next:async()=>valid(),evaluate:async()=>{throw new Error('decode failed')}};
 await assert.rejects(verifyStatic(session,root,root),/decode failed/);
 session.evaluate=async()=>({revision:'old',width:1868,height:1080});await assert.rejects(verifyStatic(session,root,root,{timeoutMs:1}),/限定时间/);
}));

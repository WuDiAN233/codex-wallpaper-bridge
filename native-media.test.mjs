import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {NativeRenderer,prepareNativeExpression,discardNativeExpression} from './native-media.mjs';
async function fixture(fn){const parent=await fs.realpath(os.tmpdir());const root=await fs.mkdtemp(path.join(parent,'codex-native-test-'));try{await fn(root)}finally{assert.equal(path.dirname(await fs.realpath(root)),parent);assert.ok(path.basename(root).startsWith('codex-native-test-'));await fs.rm(root,{recursive:true,force:true})}}
test('failed native launch closes only its generated render window',()=>fixture(async root=>{
 const calls=[];const run=async(_,args)=>{calls.push(args);if(args[args.indexOf('-Action')+1]==='Open')throw new Error('Renderer unavailable');return '{"closed":true}'};
 const renderer=new NativeRenderer(root,'wallpaper64.exe',run,'powershell.exe');
 await assert.rejects(renderer.begin({id:'item',name:'Scene',project:'project.json'}),/Renderer unavailable/);
 assert.equal(calls.length,2);const names=calls.map(a=>a[a.indexOf('-WindowName')+1]);assert.equal(names[0],names[1]);assert.match(names[0],/^CodexWallpaper-[a-f0-9]{24}$/);
}));
test('native commits preserve previous identity for cleanup and persist recoverable state',()=>fixture(async root=>{
 const calls=[];const renderer=new NativeRenderer(root,'wallpaper64.exe',async(_,args)=>{calls.push(args);return '{"closed":true}'},'powershell.exe');
 const first={id:'a'.repeat(24),windowName:'CodexWallpaper-'+ 'a'.repeat(24)},second={id:'b'.repeat(24),windowName:'CodexWallpaper-'+ 'b'.repeat(24)};
 assert.equal(await renderer.commit(first),null);assert.deepEqual(await renderer.commit(second),first);
 assert.deepEqual(JSON.parse(await fs.readFile(renderer.recordFile,'utf8')),second);
 await renderer.clear();assert.equal(renderer.record,null);assert.equal(calls[0][calls[0].indexOf('-WindowName')+1],second.windowName);await assert.rejects(fs.stat(renderer.recordFile),{code:'ENOENT'});
}));
test('recovery rejects another window identity before issuing any command',()=>fixture(async root=>{
 let calls=0;const renderer=new NativeRenderer(root,'wallpaper64.exe',()=>{calls++;throw new Error('Unexpected call')},'powershell.exe');
 await fs.writeFile(renderer.recordFile,JSON.stringify({id:'a'.repeat(24),windowName:'Another app',itemId:'item'}));
 await assert.rejects(renderer.recover([{id:'item',mode:'native'}]),/Invalid saved/);assert.equal(calls,0);
}));
test('recovery does not reopen a removed or unsupported project',()=>fixture(async root=>{
 let calls=0;const renderer=new NativeRenderer(root,'wallpaper64.exe',()=>{calls++;throw new Error('Unexpected call')},'powershell.exe');
 await fs.writeFile(renderer.recordFile,JSON.stringify({id:'a'.repeat(24),windowName:'CodexWallpaper-'+ 'a'.repeat(24),itemId:'removed'}));
 await assert.rejects(renderer.recover([]),/已移除/);assert.equal(calls,0);
}));
test('static startup cleans the previous renderer without opening or requiring its project',()=>fixture(async root=>{
 const calls=[];const renderer=new NativeRenderer(root,'wallpaper64.exe',async(_,args)=>{calls.push(args[args.indexOf('-Action')+1]);return '{"closed":true}'},'powershell.exe');
 await fs.writeFile(renderer.recordFile,JSON.stringify({id:'c'.repeat(24),windowName:'CodexWallpaper-'+ 'c'.repeat(24),itemId:'removed'}));
 await renderer.recover([],{open:false});assert.deepEqual(calls,[]);
 await renderer.clear();assert.deepEqual(calls,['Close']);assert.equal(renderer.record,null);
 await assert.rejects(fs.stat(renderer.recordFile),{code:'ENOENT'});
}));
test('static snapshots retain decoded resolution and disposing releases every capture track',async()=>{
 let stopped=0,removed=false,paused=false;
 const stream={getTracks:()=>[{stop(){stopped++}},{stop(){stopped++}}]};
 const video={readyState:4,addEventListener(){},removeEventListener(){},videoWidth:1868,videoHeight:1080,play:async()=>{},pause(){paused=true},remove(){removed=true},requestVideoFrameCallback(){throw new Error('Presentation callback must not be required')},cancelVideoFrameCallback(){}};
 const context=vm.createContext({window:{},navigator:{mediaDevices:{getUserMedia:async()=>stream}},setTimeout,clearTimeout,setInterval,clearInterval,
  document:{createElement(tag){if(tag==='video')return video;return {width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:[100,100,100,255]})}),toDataURL(){return `data:image/png;base64,${this.width}x${this.height}`}}}}});
 const result=await vm.runInContext(prepareNativeExpression('snapshot',123),context);
 assert.equal(result.frame,'data:image/png;base64,1868x1080');assert.equal(stopped,0);
 vm.runInContext(discardNativeExpression,context);
 assert.equal(stopped,2);assert.ok(paused&&removed);assert.equal(video.srcObject,null);assert.equal(context.window.__CODEX_WALLPAPER_PENDING__,undefined);
});

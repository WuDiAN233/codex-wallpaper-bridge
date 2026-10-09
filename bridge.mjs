import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {catalog,safeFile} from './catalog.mjs';
import {paletteFromPixels,sampleWallpaperExpression} from './palette.mjs';
import {readAppearanceExpression,applyAppearanceExpression,restoreAppearanceExpression} from './native-appearance.mjs';
import {scanLibrary,LibraryMonitor,librarySignature} from './library.mjs';
import {FileCache} from './file-cache.mjs';
import {readConfig,addLocation,saveConfig} from './configuration.mjs';
import {Thumbnails} from './thumbnails.mjs';
import {NativeRenderer,prepareNativeExpression,commitNativeExpression,clearNativeExpression,discardNativeExpression} from './native-media.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const stateRoot=path.join(process.env.LOCALAPPDATA,'CodexDreamSkin');
const engine=path.join(stateRoot,'engine');
const node=path.join(engine,'runtime','node','node.exe');
const powershell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
const config=await readConfig(here);
const fileCache=new FileCache();
let library=await scanLibrary(config,fileCache);
const thumbnails=new Thumbnails(here);
await thumbnails.fill(library.items);
if(process.argv.includes('--catalog')) {
  console.log(JSON.stringify({total:library.items.length,supported:library.items.filter(x=>x.supported).length,
    videos:library.items.filter(x=>x.supported&&x.type==='video').length,images:library.items.filter(x=>x.supported&&x.type==='image').length,
    native:library.items.filter(x=>x.mode==='native').length,roots:library.roots,unsupported:library.items.filter(x=>!x.supported).length,unsupportedItems:library.items.filter(x=>!x.supported).map(({name,type,reason})=>({name,type,reason})),problems:library.problems},null,2));
  process.exit(0);
}
function run(exe,args,timeout=120000) {
  return new Promise((resolve,reject)=>{
    const child=spawn(exe,args,{windowsHide:true,shell:false,env:process.env});let output='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('操作超时，切换未确认'))},timeout);
    child.stdout.on('data',chunk=>{if(output.length<1024*1024)output+=chunk.toString()});
    child.stderr.on('data',chunk=>{if(output.length<1024*1024)output+=chunk.toString()});
    child.once('error',error=>{clearTimeout(timer);reject(error)});
    child.once('exit',code=>{clearTimeout(timer);code===0?resolve(output):reject(new Error(output.trim().slice(-1000)||`Operation exited ${code}`))});
  });
}
const state=JSON.parse((await fs.readFile(path.join(stateRoot,'state.json'),'utf8')).replace(/^\uFEFF/,''));
if(!Number.isInteger(state.port)||state.port<1024||state.port>65535||!/^[A-Za-z0-9._-]{1,200}$/.test(state.browserId))throw new Error('Invalid managed CDP identity');
const base=`http://127.0.0.1:${state.port}`;
function websocket(url,kind,id){const u=new URL(url);if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||u.port!==String(state.port)||u.pathname!==`/devtools/${kind}/${id}`||u.search||u.hash)throw new Error('Rejected debugger endpoint');return u.href}
async function get(route){const response=await fetch(base+route,{signal:AbortSignal.timeout(4000),redirect:'error'});if(!response.ok)throw new Error('CDP unavailable');const text=await response.text();if(text.length>1024*1024)throw new Error('Oversized CDP response');return JSON.parse(text)}
async function identity(){const version=await get('/json/version');websocket(version.webSocketDebuggerUrl,'browser',state.browserId)}
await identity();
const token=randomBytes(24).toString('hex');
const pidPath=path.join(here,'picker.pid');
try {const pid=Number(await fs.readFile(pidPath,'utf8'));if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);throw new Error('Wallpaper picker is already running')}catch(e){if(e.code!=='ESRCH')throw e}}}catch(e){if(e.code!=='ENOENT')throw e}
await fs.writeFile(pidPath,String(process.pid));
const sessions=new Map();let changing=false,closed=false;
const nativeRenderer=new NativeRenderer(here,library.enginePath,run,powershell);
let nativeRecoveryError=null;
try{await nativeRenderer.recover(library.items)}catch(e){nativeRecoveryError=e.message;console.error('场景恢复失败：'+e.message)}
const monitor=new LibraryMonitor(async()=>{const next=await scanLibrary(await readConfig(here),fileCache);await thumbnails.fill(next.items);return next},async next=>{
  library=next;
  nativeRenderer.enginePath=next.enginePath;
  for(const session of sessions.values())await reply(session,{items:publicItems(),libraryInfo:libraryInfo()}).catch(e=>console.error('图库刷新通知失败：'+e.message));
},config.refreshIntervalMs||5000);
monitor.current=library;monitor.signature=librarySignature(library);
const ui=await fs.readFile(path.join(here,'picker-ui.js'),'utf8');
const uiExpression=`(${ui})(${JSON.stringify(token)},${process.pid})`;
class Session {
  constructor(target){this.id=target.id;this.counter=0;this.pending=new Map();this.ws=new WebSocket(websocket(target.webSocketDebuggerUrl,'page',target.id));
    this.ready=new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',()=>reject(new Error('CDP connection failed')),{once:true})});
    this.ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const pending=this.pending.get(msg.id);if(pending){clearTimeout(pending.timer);this.pending.delete(msg.id);msg.error?pending.reject(new Error(msg.error.message)):pending.resolve(msg.result)}}else if(msg.method==='Runtime.bindingCalled'&&msg.params.name==='codexWallpaperAction'){handle(this,msg.params).catch(e=>reply(this,{message:e.message}))}});
    this.ws.addEventListener('close',()=>{sessions.delete(this.id);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Codex connection closed'))}this.pending.clear()});
  }
  async send(method,params={}){await this.ready;return new Promise((resolve,reject)=>{const id=++this.counter;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP command timed out'))},15000);this.pending.set(id,{resolve,reject,timer});try{this.ws.send(JSON.stringify({id,method,params}))}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e)}})}
  async evaluate(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value}
}
async function reply(session,result){await session.evaluate(`document.getElementById('codex-wallpaper-picker')?.update(${JSON.stringify(result)})`)}
function publicItems(){return library.items.map(({id,name,type,supported,preview,reason,mode})=>({id,name,type,supported,preview,reason,mode}))}
function libraryInfo(){return {total:library.items.length,available:library.items.filter(x=>x.supported).length,pending:library.problems.length,roots:library.roots.length,automatic:true,revision:monitor.signature}}
async function handle(session,event){
  if(typeof event.payload!=='string'||event.payload.length>1024)return;
  let request;try{request=JSON.parse(event.payload)}catch{return}
  if(request.token!==token||!['list','apply','opacity','restore','choose-library'].includes(request.op))return;
  const allowed=new Set(['token','op','id','reveal']);if(Object.keys(request).some(key=>!allowed.has(key)))return;
  const probe=await session.evaluate(`location.protocol==='app:' && !!document.querySelector('main,aside.app-shell-left-panel,[data-testid="composer"]')`);if(!probe)throw new Error('当前页面不是 Codex 工作区');
  if(request.op==='list'){
    // Show the last verified catalog immediately; publish changes after scanning.
    await reply(session,{items:publicItems(),libraryInfo:libraryInfo(),message:nativeRecoveryError||`图库自动更新中。${library.problems.length?`${library.problems.length} 个目录尚未下载完整或无法读取。`:''}`});
    await monitor.refresh(true);return;
  }
  if(changing)throw new Error('上一项操作尚未结束，请稍候');
  if(request.op==='choose-library'){
    changing=true;
    try{
      const choice=JSON.parse((await run(powershell,['-NoProfile','-STA','-ExecutionPolicy','RemoteSigned','-File',path.join(here,'choose-library.ps1')],120000)).trim());
      if(choice.cancelled)return reply(session,{message:'已取消选择。'});
      await saveConfig(here,await addLocation(await readConfig(here),choice.path));await monitor.refresh(true);
      return reply(session,{message:'图库目录已加入，之后会自动同步新增壁纸。'});
    }finally{changing=false}
  }
  if(request.op!=='restore'&&(!Number.isInteger(request.reveal)||request.reveal<0||request.reveal>100))throw new Error('背景可见度必须在 0–100% 之间');
  await identity();changing=true;
  let backup=null,nativeBefore=null,pendingNative=null,preparedNative=null,activeMediaPath=null,colors=null;
  const previousNative=nativeRenderer.record;
  try {
    const args=['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',path.join(here,'theme-action.ps1'),'-Action'];
    if(request.op==='apply'){
      await monitor.refresh(true);
      const item=library.items.find(x=>x.id===request.id);if(!item?.supported)throw new Error('壁纸不可用，请刷新图库');
      nativeBefore=await session.evaluate(readAppearanceExpression);
      const nativeBackup=path.join(here,'native-appearance-original.json');
      try {await fs.writeFile(nativeBackup,JSON.stringify(nativeBefore,null,2),{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
      const validated=await safeFile(item.directory,path.relative(item.directory,item.file));
      backup=path.join(here,'history',Date.now()+'-'+randomBytes(4).toString('hex'));
      await fs.cp(path.join(stateRoot,'active-theme'),backup,{recursive:true,dereference:false});
      activeMediaPath=validated;
      if(item.mode==='native'){
        pendingNative=await nativeRenderer.begin(item);
        preparedNative=await session.evaluate(prepareNativeExpression(pendingNative.id,pendingNative.handle));
        const frames=path.join(here,'native-frames');await fs.mkdir(frames,{recursive:true});
        activeMediaPath=path.join(frames,pendingNative.id+'.png');
        if(!preparedNative.frame?.startsWith('data:image/png;base64,')||preparedNative.frame.length>2*1024*1024)throw new Error('Invalid rendered wallpaper frame');
        await fs.writeFile(activeMediaPath,Buffer.from(preparedNative.frame.split(',')[1],'base64'));
        colors=paletteFromPixels(preparedNative.pixels);
      }
      args.push('Apply','-MediaPath',activeMediaPath,'-Title',item.name,'-Reveal',String(request.reveal));
      if(colors)args.push('-PaletteJson',JSON.stringify(colors));
    }else if(request.op==='opacity')args.push('Opacity','-Reveal',String(request.reveal));else args.push('Restore');
    await run(powershell,args);
    if(request.op==='opacity'){
      const saved=JSON.parse((await fs.readFile(path.join(stateRoot,'active-theme/theme.json'),'utf8')).replace(/^\uFEFF/,''));
      if(Math.abs(Number(saved.media?.opacity)-request.reveal/100)>.001)throw new Error('背景可见度尚未保存。');
      const actual=await session.evaluate(`(()=>{const runtime=window.__CODEX_DREAM_SKIN_STATE__;if(!runtime?.setWallpaperReveal)throw new Error('壁纸尚未加载');runtime.setWallpaperReveal(${request.reveal/100});return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dream-wallpaper-reveal'))})()`);
      if(Math.abs(actual-request.reveal/100)>.001)throw new Error('背景可见度尚未生效。');
      await reply(session,{message:'背景可见度已更新。'});return;
    }
    // Only the watcher writes renderer media. A second --once injection can
    // overwrite its in-progress chunk transfer; verify the watcher's revision.
    await run(node,[path.join(engine,'scripts','injector.mjs'),'--port',String(state.port),'--browser-id',state.browserId,
      request.op==='restore'?'--remove':'--verify','--timeout-ms','25000','--theme-dir',path.join(stateRoot,'active-theme'),'--pause-file',state.pauseFile]);
    if(request.op==='apply'){
      const item=library.items.find(x=>x.id===request.id);
      if(!colors){
        colors=paletteFromPixels(await session.evaluate(sampleWallpaperExpression));
        await run(powershell,['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',path.join(here,'theme-action.ps1'),'-Action','Palette',
          '-MediaPath',activeMediaPath,'-Title',item.name,'-PaletteJson',JSON.stringify(colors)]);
        await run(node,[path.join(engine,'scripts','injector.mjs'),'--port',String(state.port),'--browser-id',state.browserId,
          '--verify','--timeout-ms','25000','--theme-dir',path.join(stateRoot,'active-theme')]);
      }
      const variant=nativeBefore.mode==='light'?'light':nativeBefore.mode==='dark'?'dark':await session.evaluate(`window.electronBridge.getSystemThemeVariant()`);
      await session.evaluate(applyAppearanceExpression(colors,variant));
      const nativeAfter=await session.evaluate(readAppearanceExpression);
      const actual=nativeAfter.themes[variant].chromeTheme;
      if(actual.accent.toLowerCase()!==colors.accent||actual.surface.toLowerCase()!==colors.background||actual.ink.toLowerCase()!==colors.text)throw new Error('Codex 原生主题颜色尚未同步');
      await fs.writeFile(path.join(here,'native-appearance-current.json'),JSON.stringify({wallpaper:item.name,variant,accent:actual.accent,surface:actual.surface,ink:actual.ink,fonts:actual.fonts,updatedAt:new Date().toISOString()},null,2));
      if(pendingNative){
        await session.evaluate(commitNativeExpression(pendingNative.id));
        await nativeRenderer.commit(pendingNative);
        await nativeRenderer.close(previousNative);
      }else{
        for(const target of sessions.values())await target.evaluate(clearNativeExpression);
        await nativeRenderer.clear();
      }
      nativeRecoveryError=null;session.nativeFailure=null;
    }
    if(request.op==='restore'){
      for(const target of sessions.values())await target.evaluate(clearNativeExpression);
      await nativeRenderer.clear();nativeRecoveryError=null;
      const original=await fs.readFile(path.join(here,'native-appearance-original.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e});
      if(original)await session.evaluate(restoreAppearanceExpression(JSON.parse(original)));
    }
    await reply(session,{message:request.op==='restore'?'已隐藏壁纸并恢复原生界面。':request.op==='opacity'?'背景可见度已更新。':'壁纸已应用，主题色已跟随壁纸调整。'});
  } catch(e){
    if(pendingNative){
      await session.evaluate(discardNativeExpression);
      if(nativeRenderer.record?.id===pendingNative.id){
        await session.evaluate(clearNativeExpression);
        if(previousNative){await session.evaluate(prepareNativeExpression(previousNative.id,previousNative.handle));await session.evaluate(commitNativeExpression(previousNative.id));await nativeRenderer.commit(previousNative)}
        else await nativeRenderer.clear();
      }
      await nativeRenderer.close(pendingNative);
    }
    if(backup){
      try {await fs.cp(backup,path.join(stateRoot,'active-theme'),{recursive:true,force:true});await run(node,[path.join(engine,'scripts','injector.mjs'),'--port',String(state.port),'--browser-id',state.browserId,'--verify','--timeout-ms','25000','--theme-dir',path.join(stateRoot,'active-theme')]);}
      catch(rollbackError){throw new Error(`切换失败，恢复也未确认：${rollbackError.message}。备份已保留。`)}
      if(nativeBefore)await session.evaluate(restoreAppearanceExpression(nativeBefore));
    }
    throw e;
  } finally {changing=false}
}
let lastStatus='',lastStatusAt=0;
async function attach(){
  await identity();
  await monitor.refresh();
  const targets=await get('/json/list');
  for(const target of targets){
    if(target.type!=='page'||!target.url?.startsWith('app://')||!/^[A-Za-z0-9._-]{1,200}$/.test(target.id))continue;
    let session=sessions.get(target.id);
    if(!session){session=new Session(target);sessions.set(target.id,session);await session.send('Runtime.enable');await session.send('Runtime.addBinding',{name:'codexWallpaperAction'});}
    const page=await session.evaluate(`({valid:location.protocol==='app:' && !!document.querySelector('main,aside.app-shell-left-panel,[data-testid="composer"]'),installed:document.getElementById('codex-wallpaper-picker')?._bridgePid===${process.pid},native:{id:window.__CODEX_WALLPAPER_NATIVE__?.id,handle:window.__CODEX_WALLPAPER_NATIVE__?.handle,failed:window.__CODEX_WALLPAPER_NATIVE__?.failed===true}})`);
    if(page.valid){
      if(!page.installed)await session.evaluate(uiExpression);
      if(!changing&&target.url==='app://-/index.html'&&nativeRenderer.record){
        const record=nativeRenderer.record;
        const nativeState=page.native;
        if((nativeState.id!==record.id||nativeState.handle!==record.handle||nativeState.failed)&&session.nativeFailure!==record.id){
          try{await session.evaluate(prepareNativeExpression(record.id,record.handle));await session.evaluate(commitNativeExpression(record.id))}
          catch(e){session.nativeFailure=record.id;console.error('动态场景连接失败：'+e.message);await reply(session,{message:'动态场景连接失败，请重新应用：'+e.message})}
        }
      }
    }
  }
  const liveIds=new Set(targets.map(target=>target.id));
  for(const [id,session] of sessions)if(!liveIds.has(id)){session.ws.close();sessions.delete(id)}
  const status={phase:'Running',pid:process.pid,targets:sessions.size,...libraryInfo(),nativeWallpaper:nativeRenderer.record?.name||null};
  const signature=JSON.stringify(status);
  if(signature!==lastStatus||Date.now()-lastStatusAt>=30000){
    await fs.writeFile(path.join(here,'status.json'),JSON.stringify({...status,updatedAt:new Date().toISOString()},null,2));
    lastStatus=signature;lastStatusAt=Date.now();
  }
}
async function stop(){if(closed)return;closed=true;for(const session of sessions.values()){await session.evaluate(clearNativeExpression+`;document.getElementById('codex-wallpaper-picker')?.remove()`).catch(()=>{});session.ws.close()}try{await nativeRenderer.close(nativeRenderer.record)}catch(e){console.error('场景窗口关闭失败：'+e.message)}if((await fs.readFile(pidPath,'utf8').catch(()=>''))===String(process.pid))await fs.unlink(pidPath);process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
try {while(!closed){await attach();await new Promise(resolve=>setTimeout(resolve,3000))}}
catch(e){await fs.writeFile(path.join(here,'status.json'),JSON.stringify({phase:'Stopped',reason:e.message,updatedAt:new Date().toISOString()},null,2));console.error(e.message);await stop()}

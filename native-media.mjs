import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
async function prepareNative(id,handle){
  if(!Number.isSafeInteger(handle)||handle<1)throw new Error('Invalid wallpaper window handle');
  window.__CODEX_WALLPAPER_PENDING__?.dispose();
  const video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;
  let stream,expired=false,timer;
  const dispose=()=>{expired=true;clearTimeout(timer);video.pause();stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;video.remove()};
  try{
    const request=navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:`window:${handle}:0`,maxWidth:1920,maxHeight:1080,maxFrameRate:15}}});
    request.then(s=>{if(expired)s.getTracks().forEach(t=>t.stop())},()=>{});
    stream=await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('动态场景连接超时')),8000)})]);
    clearTimeout(timer);video.srcObject=stream;
    // Opening the native window can precede texture loading. Require a decoded,
    // usable frame within a bounded interval instead of committing a black loader.
    await new Promise((resolve,reject)=>{
      const probe=document.createElement('canvas');probe.width=40;probe.height=24;const context=probe.getContext('2d',{willReadFrequently:true});let done=false,poll;
      const finish=error=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);video.removeEventListener('loadeddata',check);video.removeEventListener('loadedmetadata',check);error?reject(error):resolve()};
      function check(){
        if(done||video.readyState<2||!video.videoWidth||!video.videoHeight)return;
        try{context.drawImage(video,0,0,40,24);const pixels=context.getImageData(0,0,40,24).data;
          for(let i=0;i<pixels.length;i+=4){const sum=Math.max(pixels[i],pixels[i+1],pixels[i+2])+Math.min(pixels[i],pixels[i+1],pixels[i+2]);if(pixels[i+3]>=128&&sum>=41&&sum<=479){finish();return}}
        }catch(error){finish(error)}
      }
      // Presentation callbacks can be suppressed in background windows. Inspect
      // decoded frames directly; retain the same timeout and nonblank check.
      timer=setTimeout(()=>finish(new Error('高清场景尚未输出可用画面；解码状态 '+video.readyState)),5000);
      poll=setInterval(check,150);
      video.addEventListener('loadeddata',check);video.addEventListener('loadedmetadata',check);
      video.play().then(check,finish);check();
    });
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const frame=canvas.toDataURL('image/png');canvas.width=40;canvas.height=24;ctx.drawImage(video,0,0,40,24);
    window.__CODEX_WALLPAPER_PENDING__={id,handle,video,dispose};
    return {frame,pixels:Array.from(ctx.getImageData(0,0,40,24).data),width:video.videoWidth,height:video.videoHeight};
  }catch(e){dispose();throw e}
}
function clearNative(){
  window.__CODEX_WALLPAPER_PENDING__?.dispose();delete window.__CODEX_WALLPAPER_PENDING__;
  window.__CODEX_WALLPAPER_NATIVE__?.dispose();delete window.__CODEX_WALLPAPER_NATIVE__;
  document.getElementById('codex-wallpaper-native-style')?.remove();
  document.documentElement.removeAttribute('data-native-wallpaper');
}
function commitNative(id){
  const pending=window.__CODEX_WALLPAPER_PENDING__;
  if(!pending||pending.id!==id||pending.video.readyState<2)throw new Error('动态场景还没有准备好');
  window.__CODEX_WALLPAPER_NATIVE__?.dispose();
  delete window.__CODEX_WALLPAPER_PENDING__;
  const {video}=pending;video.id='codex-wallpaper-native-media';
  document.body.prepend(video);
  let style=document.getElementById('codex-wallpaper-native-style');if(!style){style=document.createElement('style');style.id='codex-wallpaper-native-style';document.head.append(style)}
  style.textContent=`html[data-native-wallpaper="active"]{--dream-skin-art:none!important}
    html[data-native-wallpaper="active"] body{background-image:none!important;background-color:transparent!important}
    #codex-wallpaper-native-media{position:fixed;inset:0;width:100vw;height:100vh;object-fit:cover;z-index:-1;pointer-events:none;opacity:var(--dream-wallpaper-reveal,1)}`;
  document.documentElement.setAttribute('data-native-wallpaper','active');
  window.__CODEX_WALLPAPER_NATIVE__=pending;
  video.srcObject.getVideoTracks()[0].addEventListener('ended',()=>{
    pending.failed=true;video.remove();style.remove();document.documentElement.removeAttribute('data-native-wallpaper');
    document.getElementById('codex-wallpaper-picker')?.update({message:'动态场景连接已中断，请重新应用壁纸。'});
  },{once:true});
  return {readyState:video.readyState,width:video.videoWidth,height:video.videoHeight};
}
export const prepareNativeExpression=(id,handle)=>`(${prepareNative.toString()})(${JSON.stringify(id)},${handle})`;
export const commitNativeExpression=id=>`(${commitNative.toString()})(${JSON.stringify(id)})`;
export const clearNativeExpression=`(${clearNative.toString()})()`;
export const discardNativeExpression=`window.__CODEX_WALLPAPER_PENDING__?.dispose();delete window.__CODEX_WALLPAPER_PENDING__;true`;
export class NativeRenderer{
  constructor(root,enginePath,run,powershell){this.root=root;this.enginePath=enginePath;this.run=run;this.powershell=powershell;this.record=null;this.recordFile=path.join(root,'active-native.json')}
  async command(action,record){
    if(!this.enginePath)throw new Error('未找到 Wallpaper Engine，请先启动它或通过“选择图库目录”选择安装位置。');
    const args=['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',path.join(this.root,'native-window.ps1'),'-Action',action,'-EnginePath',this.enginePath,'-WindowName',record.windowName];
    if(record.project)args.push('-ProjectPath',record.project);
    return JSON.parse((await this.run(this.powershell,args,25000)).trim().replace(/^\uFEFF/,''));
  }
  async begin(item){
    const record={id:randomBytes(12).toString('hex'),itemId:item.id,project:item.project,name:item.name};record.windowName='CodexWallpaper-'+record.id;
    try{Object.assign(record,await this.command('Open',record));return record}catch(e){await this.command('Close',record).catch(closeError=>{e.message+='；关闭场景窗口失败：'+closeError.message});throw e}
  }
  async commit(record){const previous=this.record;const stage=this.recordFile+'.tmp';await fs.writeFile(stage,JSON.stringify(record,null,2));await fs.rename(stage,this.recordFile);this.record=record;return previous}
  async close(record){if(record)await this.command('Close',record)}
  async clear(){const previous=this.record;await this.close(previous);await fs.unlink(this.recordFile).catch(e=>{if(e.code!=='ENOENT')throw e});this.record=null}
  async recover(items,{open=true}={}){
    let record;try{record=JSON.parse(await fs.readFile(this.recordFile,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}
    if(!/^[a-f0-9]{24}$/.test(record.id)||record.windowName!=='CodexWallpaper-'+record.id)throw new Error('Invalid saved wallpaper renderer identity');
    if(!open){this.record=record;return record}
    const item=items.find(x=>x.id===record.itemId&&x.mode==='native');if(!item)throw new Error('原动态壁纸已移除或尚未下载完成，请重新选择。');
    record.project=item.project;
    Object.assign(record,await this.command('Open',record));this.record=record;return record;
  }
}

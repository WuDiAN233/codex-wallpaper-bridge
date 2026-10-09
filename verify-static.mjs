import {pathToFileURL} from 'node:url';
import path from 'node:path';
export function staticStateReady(result,expected){
  if(!result?.installed||result.version!==result.expectedVersion||!result.stylePresent||result.businessClassPollution!==0||result.mediaType!=='image'||result.themeId!==expected.themeId||result.revision!==expected.revision||result.documentOverflow?.x)return false;
  if(result.documentVisibility==='visible'&&!result.documentHidden)return result.pass===true;
  // Background completion confirms delivery and intact layout, not on-screen
  // visibility. Never report an old revision or a broken conversation as ready.
  return result.documentVisibility==='hidden'&&result.documentHidden===true
    &&result.readiness?.viewportPass===true&&result.readiness?.structurePass===true&&result.readiness?.conversationPass===true;
}
export async function verifyStatic(session,engine,themeDirectory,{timeoutMs=20000}={}){
  const upstream=await import(pathToFileURL(path.join(engine,'scripts','injector.mjs')).href);
  const payload=await upstream.loadPayload(themeDirectory);
  if(payload.mediaType!=='image')throw new Error('静态壁纸类型不匹配。');
  const expected={themeId:payload.theme.id,revision:payload.revision};
  const deadline=Date.now()+timeoutMs;
  do{
    const result=await upstream.verifySession(session,session.id,expected.themeId,expected.revision);
    if(staticStateReady(result,expected)){
      const image=await session.evaluate(`(async()=>{const runtime=window.__CODEX_DREAM_SKIN_STATE__;if(runtime?.revision!==${JSON.stringify(expected.revision)}||!runtime.artUrl)return null;const image=new Image();image.src=runtime.artUrl;await image.decode();return {revision:window.__CODEX_DREAM_SKIN_STATE__?.revision,width:image.naturalWidth,height:image.naturalHeight}})()`);
      if(image?.revision===expected.revision&&image.width>0&&image.height>0)return {background:result.documentHidden,width:image.width,height:image.height};
    }
    await new Promise(resolve=>setTimeout(resolve,150));
  }while(Date.now()<deadline);
  throw new Error('静态壁纸未在限定时间内完成加载，已停止确认。');
}

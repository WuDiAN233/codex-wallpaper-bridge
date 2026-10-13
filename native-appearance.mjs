// Resolve the active bundle rather than retaining an asset hash from an older app.
export async function resolveAppearanceRegistry({doc=document,fetchAsset=fetch,loadModule=url=>import(url)}={}){
  const asset=url=>{try{const u=new URL(url,'app://-/index.html');return u.protocol==='app:'&&u.hostname==='-'&&/^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(u.pathname)&&!u.search&&!u.hash?u.href:null}catch{return null}};
  const entries=[...doc.scripts].map(x=>asset(x.src)).filter(x=>x&&/\/index-[A-Za-z0-9_-]+\.js$/.test(x));
  if(!entries.length)throw new Error('未找到当前 Codex 的入口模块，请重新打开应用。');
  const queue=entries.slice(0,2),seen=new Set();
  while(queue.length&&seen.size<4){
    const url=queue.shift();if(seen.has(url))continue;seen.add(url);
    const response=await fetchAsset(url);if(!response.ok)throw new Error('读取 Codex 外观模块失败：'+response.status);
    const code=await response.text();if(code.length>16*1024*1024)throw new Error('Codex 外观模块超出读取限制');
    const match=code.match(/(?:\.\/)?(register-app-actions-[A-Za-z0-9_-]+\.js)/);
    if(match){
      const module=await loadModule(new URL(match[1],url).href),registry=module.appActionRegistry;
      if(!registry||typeof registry.get!=='function'||typeof registry.get('app.appearance.get')!=='function'||typeof registry.get('app.appearance.set_theme')!=='function')throw new Error('当前 Codex 外观接口不兼容，未更改主题。');
      return registry;
    }
    for(const name of new Set(code.match(/app-shared-[A-Za-z0-9_-]+\.js/g)||[])){const next=asset(new URL(name,url).href);if(next&&!seen.has(next)&&queue.length<4)queue.push(next)}
  }
  throw new Error('未找到当前版本的外观接口，未更改主题。');
}
const registryExpression=`await (window.__CODEX_WALLPAPER_APPEARANCE__??=((${resolveAppearanceRegistry.toString()})().catch(error=>{delete window.__CODEX_WALLPAPER_APPEARANCE__;throw error})))`;
export const restoreOfficialFontExpression=`(async()=>{const r=${registryExpression};for(const variant of ['dark','light'])await r.get('app.appearance.set_theme')({type:'app.appearance.set_theme',variant,theme:{kind:'custom',patch:{fonts:{ui:null}}}},{});return r.get('app.appearance.get')({type:'app.appearance.get'},{})})()`;
export const readAppearanceExpression=`(async()=>{const r=${registryExpression};return r.get('app.appearance.get')({type:'app.appearance.get'}, {})})()`;
export function appearancePatch(colors){
  for(const key of ['accent','background','text'])if(!/^#[0-9a-fA-F]{6}$/.test(colors[key]||''))throw new Error('Invalid native theme color');
  return {accent:colors.accent,accentSource:'custom',surface:colors.background,ink:colors.text,semanticColors:{skill:colors.accent}};
}
export function applyAppearanceExpression(colors,variant='dark'){
  if(!['dark','light'].includes(variant))throw new Error('Invalid appearance variant');
  const action={type:'app.appearance.set_theme',variant,theme:{kind:'custom',patch:appearancePatch(colors)}};
  return `(async()=>{const r=${registryExpression};return r.get('app.appearance.set_theme')(${JSON.stringify(action)}, {})})()`;
}
export function restoreAppearanceExpression(before){
  const actions=[];
  for(const variant of ['dark','light']){
    const original=before?.themes?.[variant]?.chromeTheme;
    if(!original)continue;
    const patch={accent:original.accent,surface:original.surface,ink:original.ink};
    if(original.accentSource)patch.accentSource=original.accentSource;
    if(original.semanticColors?.skill)patch.semanticColors={skill:original.semanticColors.skill};
    actions.push({type:'app.appearance.set_theme',variant,theme:{kind:'custom',patch}});
  }
  if(!actions.length)throw new Error('Original native appearance unavailable');
  return `(async()=>{const r=${registryExpression};for(const action of ${JSON.stringify(actions)})await r.get('app.appearance.set_theme')(action, {});return true})()`;
}

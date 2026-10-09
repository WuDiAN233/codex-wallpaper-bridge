const moduleUrl='app://-/assets/register-app-actions-3683119912d7.js';
export const restoreOfficialFontExpression=`(async()=>{const {appActionRegistry:r}=await import(${JSON.stringify(moduleUrl)});for(const variant of ['dark','light'])await r.get('app.appearance.set_theme')({type:'app.appearance.set_theme',variant,theme:{kind:'custom',patch:{fonts:{ui:null}}}},{});return r.get('app.appearance.get')({type:'app.appearance.get'},{})})()`;
export const readAppearanceExpression=`(async()=>{const {appActionRegistry:r}=await import(${JSON.stringify(moduleUrl)});return r.get('app.appearance.get')({type:'app.appearance.get'}, {})})()`;
export function appearancePatch(colors){
  for(const key of ['accent','background','text'])if(!/^#[0-9a-fA-F]{6}$/.test(colors[key]||''))throw new Error('Invalid native theme color');
  return {accent:colors.accent,accentSource:'custom',surface:colors.background,ink:colors.text,semanticColors:{skill:colors.accent}};
}
export function applyAppearanceExpression(colors,variant='dark'){
  if(!['dark','light'].includes(variant))throw new Error('Invalid appearance variant');
  const action={type:'app.appearance.set_theme',variant,theme:{kind:'custom',patch:appearancePatch(colors)}};
  return `(async()=>{const {appActionRegistry:r}=await import(${JSON.stringify(moduleUrl)});return r.get('app.appearance.set_theme')(${JSON.stringify(action)}, {})})()`;
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
  return `(async()=>{const {appActionRegistry:r}=await import(${JSON.stringify(moduleUrl)});for(const action of ${JSON.stringify(actions)})await r.get('app.appearance.set_theme')(action, {});return true})()`;
}

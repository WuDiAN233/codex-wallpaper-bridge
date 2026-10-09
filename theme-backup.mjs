import fs from 'node:fs/promises';
import path from 'node:path';
import {safeFile} from './catalog.mjs';
// New static themes need only their referenced image and optional safe CSS.
// Preserve unfamiliar theme formats using the original complete backup behavior.
export async function backupTheme(source,destination){
  const text=await fs.readFile(await safeFile(source,'theme.json'),'utf8');
  const theme=JSON.parse(text.replace(/^\uFEFF/,''));
  if(theme.id!=='codex-wallpaper-library'||theme.schemaVersion!==1||theme.media?.type!=='image'){
    await fs.cp(source,destination,{recursive:true,dereference:false});return destination;
  }
  const image=await safeFile(source,theme.image);
  let css=null;try{css=await safeFile(source,'theme.css')}catch(e){if(e.code!=='ENOENT')throw e}
  await fs.mkdir(path.dirname(destination),{recursive:true});await fs.mkdir(destination);
  const target=path.join(destination,path.relative(source,image));
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(image,target);
  if(css)await fs.copyFile(css,path.join(destination,'theme.css'));
  if(await fs.readFile(path.join(source,'theme.json'),'utf8')!==text)throw new Error('主题在备份期间发生变化，请稍后重试。');
  await fs.writeFile(path.join(destination,'theme.json'),text,{flag:'wx'});
  return destination;
}

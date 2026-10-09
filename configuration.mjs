import fs from 'node:fs/promises';
import path from 'node:path';
export function validateConfig(config){
  for(const key of ['roots','steamRoots','wallpaperEngineDirectories'])if(!Array.isArray(config[key])||config[key].length>64||config[key].some(p=>typeof p!=='string'||!path.isAbsolute(p)))throw new Error('图库目录必须是完整路径，每类最多 64 个。');
  if(typeof config.autoDiscover!=='boolean'||typeof config.nativeRendering!=='boolean')throw new Error('Invalid discovery settings');
  if(!Number.isInteger(config.refreshIntervalMs)||config.refreshIntervalMs<5000||config.refreshIntervalMs>60000)throw new Error('刷新间隔应在 5–60 秒之间。');
  return config;
}
export async function readConfig(root){
  const defaults=JSON.parse(await fs.readFile(path.join(root,'config.example.json'),'utf8'));
  let saved={};try{saved=JSON.parse((await fs.readFile(path.join(root,'config.json'),'utf8')).replace(/^\uFEFF/,''))}catch(e){if(e.code!=='ENOENT')throw e}
  return validateConfig({...defaults,...saved});
}
export async function addLocation(config,selected){
  if(typeof selected!=='string'||!path.isAbsolute(selected))throw new Error('请选择完整目录。');
  const directory=path.resolve(selected),stat=await fs.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('请选择实际文件夹。');
  const entries=await fs.readdir(directory,{withFileTypes:true});let key='roots',value=directory;
  if(entries.some(e=>e.isFile()&&/^wallpaper(32|64)\.exe$/i.test(e.name)))key='wallpaperEngineDirectories';
  else if(entries.some(e=>e.isDirectory()&&e.name.toLowerCase()==='steamapps'))key='steamRoots';
  else if(entries.some(e=>e.isFile()&&e.name.toLowerCase()==='project.json'))value=path.dirname(directory);
  else{
    let projects=false;
    for(const entry of entries){if(!entry.isDirectory()||entry.isSymbolicLink())continue;try{if((await fs.lstat(path.join(directory,entry.name,'project.json'))).isFile()){projects=true;break}}catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))throw e}}
    if(!projects)throw new Error('此目录没有壁纸项目，请选择 Steam 库、Wallpaper Engine 安装目录或包含 project.json 项目的图库。');
  }
  return validateConfig({...config,[key]:[...new Map([...config[key],value].map(p=>[p.toLowerCase(),p])).values()]});
}
export async function saveConfig(root,config){validateConfig(config);const target=path.join(root,'config.json'),stage=target+'.tmp';await fs.writeFile(stage,JSON.stringify(config,null,2));await fs.rename(stage,target)}

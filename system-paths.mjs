import {execFile} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
let cached=null,expires=0,pending=null;
export async function systemPaths(){
  if(process.platform!=='win32')return {};
  if(cached&&Date.now()<expires)return cached;
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>execFile(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',fileURLToPath(new URL('./discover-windows.ps1',import.meta.url))],
    {windowsHide:true,timeout:10000,maxBuffer:128*1024,encoding:'utf8'},(error,stdout)=>{
      if(error)return reject(new Error('无法读取 Steam 安装位置，请通过“选择图库目录”指定。'));
      try{cached=JSON.parse(stdout.replace(/^\uFEFF/,''));expires=Date.now()+60000;resolve(cached)}catch{reject(new Error('Steam 位置检测返回无效数据'))}
    }));
  try{return await pending}finally{pending=null}
}

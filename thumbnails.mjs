import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {fileURLToPath} from 'node:url';
export class Thumbnails{
 constructor(root){this.root=root;this.directory=path.join(root,'thumbnails');this.failed=new Set();this.values=new Map()}
 async fill(items){
  await fs.mkdir(this.directory,{recursive:true});const jobs=[],needed=new Set();
  for(const item of items){
   if(!item.previewFile)continue;
   const key=createHash('sha256').update(item.previewFile+'\0'+item.previewStamp).digest('hex');needed.add(key);item.thumbnailKey=key;
   if(this.values.has(key)||this.failed.has(key))continue;
   try{const data=await fs.readFile(path.join(this.directory,key+'.jpg'));if(data.length>128*1024)throw new Error('Oversized thumbnail');this.values.set(key,'data:image/jpeg;base64,'+data.toString('base64'))}
   catch(e){if(e.code!=='ENOENT')throw e;if(jobs.length<64)jobs.push({source:item.previewFile,key})}
  }
  if(jobs.length){
   const input=path.join(this.directory,'pending.json');await fs.writeFile(input,JSON.stringify(jobs));
   try{
    const output=await new Promise((resolve,reject)=>execFile(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',fileURLToPath(new URL('./thumbnails.ps1',import.meta.url)),'-InputFile',input,'-OutputDirectory',this.directory],{windowsHide:true,timeout:30000,maxBuffer:128*1024,encoding:'utf8'},(e,stdout)=>e?reject(new Error('缩略图生成失败，请刷新重试。')):resolve(stdout)));
    for(const key of JSON.parse(output).failed)this.failed.add(key);
    for(const job of jobs)if(!this.failed.has(job.key)){const data=await fs.readFile(path.join(this.directory,job.key+'.jpg'));if(data.length<=128*1024)this.values.set(job.key,'data:image/jpeg;base64,'+data.toString('base64'))}
   }finally{await fs.unlink(input).catch(e=>{if(e.code!=='ENOENT')throw e})}
  }
  for(const item of items)if(this.values.has(item.thumbnailKey))item.preview=this.values.get(item.thumbnailKey);
  for(const key of this.values.keys())if(!needed.has(key))this.values.delete(key);
  for(const key of this.failed)if(!needed.has(key))this.failed.delete(key);
 }
}

import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {safeFile} from './catalog.mjs';
const pngSignature=Buffer.from('89504e470d0a1a0a','hex');
const maxImageBytes=24*1024*1024;
export async function snapshotKey(item){
  const signature=[];
  for(const file of new Set([item.project,item.file])){
    const validated=await safeFile(item.directory,path.relative(item.directory,file));
    const stat=await fs.stat(validated);
    signature.push([validated.toLowerCase(),stat.size,stat.mtimeMs,stat.ctimeMs,stat.ino]);
  }
  const dir=await fs.lstat(item.directory);signature.push(dir.mtimeMs);
  return createHash('sha256').update(JSON.stringify(['static-1080-v1',signature])).digest('hex');
}
function dimensions(bytes){
  if(bytes.length<24||!bytes.subarray(0,8).equals(pngSignature))throw new Error('Invalid snapshot PNG');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width>4096||height>4096)throw new Error('Invalid snapshot dimensions');
  return {width,height};
}
function validColors(colors){return colors&&['background','panel','panelAlt','accent','accentAlt','secondary','highlight','text','muted','line'].every(k=>/^#[0-9a-f]{6}$/i.test(colors[k]))}
export class SnapshotCache{
  constructor(root,{maxBytes=128*1024*1024,maxEntries=24}={}){this.root=path.resolve(root);this.maxBytes=maxBytes;this.maxEntries=maxEntries}
  paths(key){if(!/^[a-f0-9]{64}$/.test(key))throw new Error('Invalid snapshot key');return {file:path.join(this.root,key+'.png'),metadata:path.join(this.root,key+'.json')}}
  async ready(){await fs.mkdir(this.root,{recursive:true});if((await fs.lstat(this.root)).isSymbolicLink())throw new Error('Linked snapshot cache is not allowed')}
  async get(key){
    await this.ready();const {file,metadata}=this.paths(key);
    try{
      const [a,b]=await Promise.all([fs.lstat(file),fs.lstat(metadata)]);
      if(!a.isFile()||!b.isFile()||a.isSymbolicLink()||b.isSymbolicLink()||a.size>maxImageBytes||b.size>65536)return null;
      const info=JSON.parse(await fs.readFile(metadata,'utf8'));
      if(info.bytes!==a.size||!validColors(info.colors))return null;
      const handle=await fs.open(file,'r');let header;try{header=Buffer.alloc(24);await handle.read(header,0,24,0)}finally{await handle.close()}
      const size=dimensions(header);if(size.width!==info.width||size.height!==info.height)return null;
      const now=new Date();await fs.utimes(file,now,now);
      return {file,colors:info.colors,...size};
    }catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError||e.message.startsWith('Invalid snapshot'))return null;throw e}
  }
  async put(key,frame,colors){
    await this.ready();if(typeof frame!=='string'||!frame.startsWith('data:image/png;base64,')||frame.length>32*1024*1024||!validColors(colors))throw new Error('Invalid static snapshot');
    const data=Buffer.from(frame.split(',')[1],'base64'),size=dimensions(data);
    if(data.length>maxImageBytes||data.length>this.maxBytes)throw new Error('Static snapshot exceeds cache budget');
    const {file,metadata}=this.paths(key),suffix='.'+randomBytes(8).toString('hex')+'.tmp';
    try{
      await fs.writeFile(file+suffix,data,{flag:'wx'});
      await fs.writeFile(metadata+suffix,JSON.stringify({...size,bytes:data.length,colors}),{flag:'wx'});
      await fs.rename(file+suffix,file);await fs.rename(metadata+suffix,metadata);
    }finally{for(const stage of [file+suffix,metadata+suffix])await fs.unlink(stage).catch(e=>{if(e.code!=='ENOENT')throw e})}
    await this.prune(key);return {file,colors,...size};
  }
  async prune(keep){
    const files=[];
    for(const name of await fs.readdir(this.root))if(/^[a-f0-9]{64}\.png$/.test(name)){
      const stat=await fs.lstat(path.join(this.root,name));if(stat.isFile()&&!stat.isSymbolicLink())files.push({key:name.slice(0,64),bytes:stat.size,time:stat.mtimeMs});
    }
    let bytes=files.reduce((sum,f)=>sum+f.bytes,0),count=files.length;
    for(const entry of files.sort((a,b)=>a.time-b.time)){
      if(bytes<=this.maxBytes&&count<=this.maxEntries)break;if(entry.key===keep)continue;
      const pair=this.paths(entry.key);for(const file of [pair.file,pair.metadata])await fs.unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e});
      bytes-=entry.bytes;count--;
    }
  }
}

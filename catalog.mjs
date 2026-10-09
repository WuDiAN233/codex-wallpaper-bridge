import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export async function safeFile(root, relative, scanStats=null) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Invalid relative path');
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw new Error('Path escaped wallpaper folder');
  let current = path.parse(absolute).root;
  let stat;
  for (const component of absolute.slice(current.length).split(path.sep)) {
    current = path.join(current, component);
    stat=scanStats?.get(current);
    if(!stat){stat=await fs.lstat(current);scanStats?.set(current,stat)}
    if (stat.isSymbolicLink()) throw new Error('Linked wallpaper paths are not allowed');
  }
  if (!stat.isFile()) throw new Error('Wallpaper file is missing');
  return absolute;
}
export async function catalog(roots,{native=false,cache=null}={}) {
  cache?.begin();
  // Share ancestor checks only within this single scan, never across polls.
  // Apply revalidates its selected file independently immediately before use.
  const scanStats=new Map();
  const items = [], problems = [],seen=new Set();
  for (const root of roots) {
    let entries;
    try { entries = await fs.readdir(root, {withFileTypes:true}); }
    catch (e) { problems.push({reason:e.code || 'Unreadable library'}); continue; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const directory = path.join(root,entry.name);
      const key=path.resolve(directory).toLowerCase();if(seen.has(key))continue;seen.add(key);
      try {
        const metadataPath = await safeFile(directory,'project.json',scanStats);
        const metadataStat=scanStats.get(metadataPath);
        if (metadataStat.size > 256*1024) throw new Error('Oversized metadata');
        const metadata = JSON.parse((cache?await cache.read(metadataPath,metadataStat,'utf8'):await fs.readFile(metadataPath,'utf8')).replace(/^\uFEFF/,''));
        const declaredExtension=path.extname(String(metadata.file||'')).toLowerCase();
        const type = typeof metadata.type==='string'&&metadata.type.trim()?metadata.type.trim().toLowerCase():(['.json','.pkg'].includes(declaredExtension)?'scene':['.htm','.html'].includes(declaredExtension)?'web':declaredExtension==='.exe'?'application':'unknown');
        const supportedType = ['video','image'].includes(type);
        let file = null, size = 0;
        if (supportedType || native&&['scene','web'].includes(type)) {
          try{file = await safeFile(directory,metadata.file,scanStats)}
          catch(e){if(type!=='scene'||e.code!=='ENOENT')throw e;file=await safeFile(directory,'scene.pkg',scanStats)}
          size = scanStats.get(file).size;
        }
        const extension = file ? path.extname(file).toLowerCase() : '';
        const direct = type === 'video' ? ['.mp4','.webm'].includes(extension) && size>0 && size<=128*1024*1024
          : type === 'image' && ['.png','.jpg','.jpeg','.webp'].includes(extension) && size>0 && size<=10*1024*1024;
        const nativeCapable=native&&size>0&&(type==='scene'||type==='video'&&['.mp4','.webm','.mkv','.avi','.mov','.wmv'].includes(extension));
        const supported=direct||nativeCapable;
        let preview = null,previewFile=null,previewStamp=null;
        if (typeof metadata.preview === 'string') {
          try {
            const candidate = await safeFile(directory,metadata.preview,scanStats);
            const previewFileLocal=candidate;
            const mime = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'}[path.extname(previewFileLocal).toLowerCase()];
            const previewStat=scanStats.get(previewFileLocal);
            if(mime&&previewStat.size<=12*1024*1024){previewFile=candidate;previewStamp=[previewStat.size,previewStat.mtimeMs,previewStat.ctimeMs].join(':')}
            if (mime && previewStat.size <= 128*1024) preview = `data:${mime};base64,${cache?await cache.read(candidate,previewStat,'base64'):(await fs.readFile(candidate)).toString('base64')}`;
          } catch { /* Optional thumbnail: the item remains visible without it. */ }
        }
        items.push({id:createHash('sha256').update(directory.toLowerCase()).digest('hex').slice(0,24),
          name:String(metadata.title || entry.name).slice(0,150),type,supported,preview,previewFile,previewStamp,directory,file,size,project:metadataPath,mode:direct?'direct':nativeCapable?'native':null,
          reason:supported?'':type==='scene'?'场景壁纸需要 Wallpaper Engine 动态连接':type==='web'?'已识别；网页动画后台兼容性未通过':type==='application'?'应用程序壁纸暂不接入':'文件格式或大小不符合要求'});
      } catch (e) { problems.push({id:entry.name,reason:e.message}); }
    }
  }
  items.sort((a,b)=>Number(b.supported)-Number(a.supported)||a.name.localeCompare(b.name,'zh-CN'));
  cache?.end();
  return {items,problems};
}

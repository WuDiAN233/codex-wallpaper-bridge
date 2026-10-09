import fs from 'node:fs/promises';
// Cache small metadata/previews only. Callers still validate paths and stat files
// on each scan; replacement, edits, removals and download completion stay visible.
export class FileCache {
  constructor(limit=4*1024*1024){this.limit=limit;this.bytes=0;this.entries=new Map();this.reads=0;this.hits=0;this.seen=new Set()}
  begin(){this.seen.clear()}
  drop(file){const entry=this.entries.get(file);if(entry){this.bytes-=entry.bytes;this.entries.delete(file)}}
  async read(file,stat,encoding){
    this.seen.add(file);
    const signature=[stat.size,stat.mtimeMs,stat.ctimeMs,stat.ino].join(':');
    const key=file+'\0'+encoding;this.seen.add(key);
    const previous=this.entries.get(key);
    if(previous?.signature===signature){this.hits++;return previous.value}
    this.drop(key);this.reads++;
    const value=(await fs.readFile(file)).toString(encoding);
    const bytes=Buffer.byteLength(value,'utf16le');
    if(bytes<=this.limit){
      while(this.bytes+bytes>this.limit&&this.entries.size)this.drop(this.entries.keys().next().value);
      this.entries.set(key,{signature,value,bytes});this.bytes+=bytes;
    }
    return value;
  }
  end(){for(const key of this.entries.keys())if(!this.seen.has(key))this.drop(key);this.seen.clear()}
}

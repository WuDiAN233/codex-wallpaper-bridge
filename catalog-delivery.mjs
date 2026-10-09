export function catalogUpdate(previousRevision,items,libraryInfo,message){
  const result={catalog:true,libraryInfo};
  if(message)result.message=message;
  if(!previousRevision||previousRevision!==libraryInfo.revision)result.items=items();
  return result;
}
export function isWallpaperPage(target){
  if(target.type!=='page')return false;
  try{
    const url=new URL(target.url);
    return url.protocol==='app:'&&url.hostname==='-'&&['/index.html','/detached-window.html'].includes(url.pathname)
      &&!url.searchParams.get('initialRoute')?.startsWith('/avatar-overlay');
  }catch{return false}
}

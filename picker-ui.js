(function installPicker(token,bridgePid) {
  const existing=document.getElementById('codex-wallpaper-picker');
  if(existing?._bridgeToken===token&&existing?._uiVersion===12) return;
  existing?._dispose?.();
  existing?.remove();
  const host=document.createElement('div'); host.id='codex-wallpaper-picker';
  host._bridgeToken=token;
  host._bridgePid=bridgePid;
  host._uiVersion=12;
  const events=new AbortController();host._dispose=()=>events.abort();
  host.style.cssText='position:fixed;right:20px;bottom:94px;z-index:2147483000;font-family:inherit;';
  const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>
  :host{color:var(--text-primary,#eee);font-size:13px}*{box-sizing:border-box}button,input,select{font:inherit;color:inherit}button{cursor:pointer;background:var(--surface-secondary,#292929);border:1px solid var(--border-light,#555);border-radius:8px;padding:8px 12px}button:hover{filter:brightness(1.15)}button:disabled{opacity:.45;cursor:default}
  #panel{position:fixed;right:24px;top:70px;width:min(620px,calc(100vw - 48px));max-height:calc(100vh - 105px);background:var(--surface-primary,#202020);border:1px solid var(--border-light,#555);border-radius:16px;box-shadow:0 16px 65px #0006;overflow:auto;padding:20px;color:var(--text-primary,#eee)}[hidden]{display:none!important}.row{display:flex;align-items:center;gap:10px;margin-bottom:14px}.row strong{font-size:17px}.grow{flex:1}.sub{color:var(--text-secondary,#aaa);line-height:1.6}input[type=search],select{background:var(--surface-secondary,#292929);border:1px solid #7775;border-radius:8px;padding:9px;min-width:0}#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:14px 0}.card{padding:0;text-align:left;overflow:hidden;background:var(--surface-secondary,#292929)}.card img,.placeholder{width:100%;height:94px;object-fit:cover;display:block}.placeholder{display:grid;place-items:center;color:#aaa}.name{display:block;padding:10px 10px 4px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.kind{display:block;padding:0 10px 10px;color:var(--text-secondary,#aaa);font-size:11px}.card.selected{outline:2px solid #339cff}.preview{width:100%;max-height:210px;object-fit:contain;border-radius:10px}#status{min-height:24px;margin-top:12px;line-height:1.5;white-space:pre-wrap}#reveal{min-width:0;flex:1;accent-color:#339cff}.footer{position:sticky;bottom:-20px;background:var(--surface-primary,#202020);padding:12px 0 0}#dismiss{border:0;background:none;font-size:20px;padding:0 6px}
  :host{color:var(--ds-text,#eee)}
  #panel,.footer{background:var(--ds-panel,#202020);color:var(--ds-text,#eee)}
  button,input[type=search],select,.card{background:var(--ds-panel-2,#292929)}
  .card.selected{outline-color:var(--ds-accent,#339cff)}
  #reveal{accent-color:var(--ds-accent,#339cff)}
  </style><button id="toggle" title="从 Wallpaper Engine 本地库选择背景">壁纸</button>
  <section id="panel" hidden role="dialog" aria-label="Codex 壁纸"><div class="row"><strong>壁纸</strong><span class="grow"></span><button id="refresh">刷新图库</button><button id="dismiss" aria-label="关闭">×</button></div>
  <div class="sub">自动识别 Wallpaper Engine 图库与新增壁纸，主题色跟随画面。所有壁纸应用为静态图片；场景和视频仅在选择时取景，完成后停止后台渲染。</div>
  <div class="row" style="margin-top:16px"><input class="grow" id="search" type="search" placeholder="搜索壁纸" aria-label="搜索壁纸"><select id="filter" aria-label="壁纸类型"><option value="all">全部壁纸</option><option value="supported">可用壁纸</option><option value="scene">场景静帧</option><option value="web">网页壁纸</option><option value="video">视频</option><option value="image">图片</option></select></div>
  <div class="row"><div id="library-info" class="sub grow">正在检查图库…</div><button id="official-font">默认字体</button><button id="choose-library">选择图库目录</button></div><div id="count" class="sub"></div><div id="grid"></div><div id="selection" hidden><img id="preview" class="preview" alt="所选壁纸预览"><div id="selected-name" class="sub"></div></div>
  <div class="footer"><div class="row"><label for="glass">消息框</label><select id="glass" aria-label="消息框效果"><option value="solid">实色 · 更省资源</option><option value="light">轻度毛玻璃</option></select></div><div class="row"><label for="reveal">背景可见度</label><input id="reveal" type="range" min="0" max="100" value="65"><output id="percent">65%</output></div><div class="row"><button id="apply" disabled>应用静态壁纸</button><button id="retake" disabled title="重新获取所选场景或视频的画面">重新取景</button><button id="opacity">调整当前背景</button><span class="grow"></span><button id="restore">恢复原生外观</button></div><div id="status" role="status"></div></div></section>`;
  document.body.append(host);
  let brightness=document.getElementById('codex-wallpaper-brightness');
  if(!brightness){brightness=document.createElement('style');brightness.id='codex-wallpaper-brightness';document.head.append(brightness)}
  brightness.textContent=`
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) main[class*="_MainContentSurface_"]{background:rgb(var(--ds-bg-rgb) / calc((1 - var(--dream-wallpaper-reveal,1)) * .7))!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) main[class*="_MainContentSurface_"]::before,
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) main[class*="_MainContentSurface_"]::after{opacity:calc(1 - var(--dream-wallpaper-reveal,1))!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) aside.app-shell-left-panel{background:rgb(var(--ds-panel-rgb) / calc(.1 + (1 - var(--dream-wallpaper-reveal,1)) * .8))!important}
    html[data-dream-skin="active"][data-native-wallpaper="active"]:has(#codex-wallpaper-picker) body{background-color:transparent!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) main [class~="pointer-events-none"][class~="absolute"][class~="inset-x-0"][class~="bottom-0"][class~="bg-surface"]{background:transparent!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) main [class~="pointer-events-none"][class~="absolute"][class~="inset-x-0"][class~="h-8"][class~="bg-gradient-to-t"][class~="from-surface"]{background:transparent!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) :is(.thread-scroll-container,.thread-scroll-container *,aside.app-shell-left-panel,.composer-surface-chrome,[data-composer-surface-variant]){backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) .thread-scroll-container :is([data-response-annotation-conversation][data-response-annotation-target],[data-local-conversation-item-target-ids],[data-local-conversation-final-assistant]){background:var(--ds-panel,#1b2733)!important;color:var(--ds-text,#f3f3f3)!important;box-shadow:none!important;border-color:var(--ds-line)!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) .thread-scroll-container [data-markdown-text-style]:not([data-response-annotation-conversation] *):not([data-local-conversation-final-assistant] *){background:var(--ds-panel,#1b2733)!important;color:var(--ds-text,#f3f3f3)!important;border-radius:12px;padding:12px 16px}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) .thread-scroll-container [data-local-conversation-final-assistant] [data-response-annotation-conversation]{background:transparent!important;border:0!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) .thread-scroll-container :is(p,li,td,th){text-shadow:none!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) [data-user-message-bubble]{background:var(--ds-panel-2,#233448)!important;color:var(--ds-text,#f3f3f3)!important;border:1px solid var(--ds-line)!important}
    html[data-dream-skin="active"]:has(#codex-wallpaper-picker) :is(.composer-surface-chrome,[data-composer-surface-variant]){background:var(--ds-panel,#1b2733)!important;box-shadow:none!important}
  `;
  // Keep blur on a single message surface, never nested blocks or the whole page.
  brightness.textContent+=`
    html[data-dream-skin="active"][data-wallpaper-glass="light"]:has(#codex-wallpaper-picker) :is(
      [data-user-message-bubble],
      .thread-scroll-container [data-local-conversation-final-assistant],
      .thread-scroll-container [data-response-annotation-conversation][data-response-annotation-target]:not([data-local-conversation-final-assistant] *),
      .thread-scroll-container [data-markdown-text-style]:not([data-response-annotation-conversation] *):not([data-local-conversation-final-assistant] *)
    ){background:rgb(var(--ds-panel-rgb) / .84)!important;backdrop-filter:blur(6px)!important;-webkit-backdrop-filter:blur(6px)!important}
  `;
  const $=id=>shadow.getElementById(id); let items=[],selected=null,busy=false,revision=null;
  const glassKey='codex-wallpaper-bridge:message-glass';
  try{$('glass').value=localStorage.getItem(glassKey)==='light'?'light':'solid'}catch{$('glass').value='solid'}
  const applyGlass=()=>document.documentElement.setAttribute('data-wallpaper-glass',$('glass').value);
  applyGlass();
  $('glass').onchange=()=>{applyGlass();try{localStorage.setItem(glassKey,$('glass').value)}catch{$('status').textContent='当前效果已生效，但保存失败；重启后需重新选择。'}};

  const request=(op,extra={})=>window.codexWallpaperAction(JSON.stringify({token,op,...extra}));
  function controls(){
    $('apply').disabled=busy||!selected?.supported;
    $('retake').disabled=busy||!selected?.supported||selected.type==='image';
    for(const id of ['opacity','restore','reveal','choose-library','official-font'])$(id).disabled=busy;
    for(const card of $('grid').querySelectorAll('.card')){card.disabled=busy||card.dataset.supported!=='true';card.classList.toggle('selected',card.dataset.id===selected?.id)}
  }
  function preview(){
    $('selection').hidden=!selected;
    $('preview').hidden=!selected?.preview;
    if(selected?.preview&&!$('panel').hidden)$('preview').src=selected.preview;else $('preview').removeAttribute('src');
    $('selected-name').textContent=selected?.name||'';
  }
  function render(){
    if($('panel').hidden)return;
    const query=$('search').value.toLocaleLowerCase(),filter=$('filter').value;
    const visible=items.filter(x=>(filter==='all'||filter==='supported'&&x.supported||x.type===filter)&&x.name.toLocaleLowerCase().includes(query));
    $('count').textContent=`${visible.length} 个项目 · ${items.filter(x=>x.supported).length} 个可用`;
    $('grid').replaceChildren();
    const fragment=document.createDocumentFragment();
    for(const item of visible){const card=document.createElement('button');card.className='card'+(selected?.id===item.id?' selected':'');card.disabled=!item.supported||busy;card.title=item.reason||item.name;card.dataset.id=item.id;card.dataset.supported=String(item.supported);
      const typeName={scene:'场景静帧',web:'网页壁纸',video:'视频',image:'图片',application:'应用程序'}[item.type]||'其他';
      if(item.preview){const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.src=item.preview;img.alt='';card.append(img)}else{const empty=document.createElement('div');empty.className='placeholder';empty.textContent=typeName;card.append(empty)}
      const name=document.createElement('span');name.className='name';name.textContent=item.name;const kind=document.createElement('span');kind.className='kind';kind.textContent=item.supported?(item.type==='image'?'静态图片':typeName+' · 高清静帧'):item.reason;card.append(name,kind);
      card.onclick=()=>{selected=item;preview();controls()};fragment.append(card);
    }
    $('grid').append(fragment);preview();controls();
    if(!visible.length){const message=document.createElement('p');message.className='sub';message.textContent='没有符合条件的壁纸。新壁纸下载完成后会自动出现在这里。';$('grid').append(message)}
  }
  const close=()=>{$('panel').hidden=true;$('grid').replaceChildren();$('preview').removeAttribute('src')};$('toggle').onclick=()=>{if(!$('panel').hidden){close();return}$('panel').hidden=false;render();request('list')};$('dismiss').onclick=close;
  document.addEventListener('pointerdown',event=>{
    if(!host.isConnected){events.abort();return}
    if(!$('panel').hidden&&!event.composedPath().includes(host))close();
  },{capture:true,signal:events.signal});
  // Codex may consume Escape keydown in its window capture handler.
  for(const type of ['keydown','keyup'])document.addEventListener(type,event=>{if(event.key==='Escape'&&!$('panel').hidden)close()},{capture:true,signal:events.signal});
  shadow.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();close()}});
  $('search').oninput=render;$('filter').onchange=render;$('refresh').onclick=()=>request('list');
  const initialReveal=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dream-wallpaper-reveal'));
  if(Number.isFinite(initialReveal))$('reveal').value=String(Math.round(initialReveal*100));
  $('percent').textContent=$('reveal').value+'%';
  $('reveal').oninput=()=>{
    $('percent').textContent=$('reveal').value+'%';
    window.__CODEX_DREAM_SKIN_STATE__?.setWallpaperReveal?.(Number($('reveal').value)/100);
  };
  $('reveal').onchange=()=>mutate('opacity');
  function mutate(op,extra={}){if(busy)return;busy=true;$('status').textContent='正在处理…';controls();request(op,{...extra,reveal:Number($('reveal').value)})}
  $('apply').onclick=()=>{if(selected?.supported)mutate('apply',{id:selected.id})};$('opacity').onclick=()=>mutate('opacity');$('restore').onclick=()=>mutate('restore');
  $('choose-library').onclick=()=>mutate('choose-library');
  $('official-font').onclick=()=>mutate('official-font');
  $('retake').onclick=()=>{if(selected?.supported)mutate('apply',{id:selected.id,retake:true})};
  host.update=function(result){
    if(result.libraryInfo){const info=result.libraryInfo;$('library-info').textContent=`自动同步中 · ${info.roots} 个图库来源${info.pending?' · '+info.pending+' 个目录等待下载完整或修复':''}`}
    if(result.items&&(!result.libraryInfo?.revision||result.libraryInfo.revision!==revision)){revision=result.libraryInfo?.revision;items=result.items;if(selected)selected=items.find(x=>x.id===selected.id)||null;preview();render();controls()}
    // A refresh response can arrive after Apply starts. It updates the list,
    // but must not complete the unrelated mutation or replace its progress.
    if(result.message&&!(result.items&&busy)){$('status').textContent=result.message;busy=false;controls()}
  };
  request('list');
})

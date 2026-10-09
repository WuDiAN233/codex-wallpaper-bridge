export function paletteFromPixels(pixels){
  if(!Array.isArray(pixels)||pixels.length<4||pixels.length>64*64*4||pixels.length%4)throw new Error('Invalid wallpaper sample');
  const bins=new Map();
  for(let i=0;i<pixels.length;i+=4){
    const [r,g,b,a]=pixels.slice(i,i+4);
    if([r,g,b,a].some(x=>!Number.isInteger(x)||x<0||x>255))throw new Error('Invalid sample channel');
    if(a<128)continue;
    const high=Math.max(r,g,b),low=Math.min(r,g,b),light=(high+low)/510;
    if(light<.08||light>.94)continue;
    const key=`${r>>5},${g>>5},${b>>5}`;
    const bin=bins.get(key)||{r:0,g:0,b:0,count:0};bin.r+=r;bin.g+=g;bin.b+=b;bin.count++;bins.set(key,bin);
  }
  let best=null,chromatic=null;
  for(const bin of bins.values()){
    const rgb=[bin.r,bin.g,bin.b].map(x=>x/bin.count/255),high=Math.max(...rgb),low=Math.min(...rgb),d=high-low,l=(high+low)/2;
    const s=d===0?0:d/(1-Math.abs(2*l-1));const score=bin.count*(.35+s);
    const candidate={rgb,s,l,d,high,score};
    if(!best||score>best.score)best=candidate;
    if(s>=.22&&bin.count>=3&&(!chromatic||score>chromatic.score))chromatic=candidate;
  }
  if(!best)throw new Error('壁纸画面没有可用颜色，请等画面加载后重试。');
  best=chromatic||best;
  const {rgb:[r,g,b],d,high}=best;
  let h=d===0?0:high===r?((g-b)/d+6)%6:high===g?(b-r)/d+2:(r-g)/d+4;h/=6;
  const color=(s,l)=>{
    const chroma=(1-Math.abs(2*l-1))*s,x=chroma*(1-Math.abs((h*6)%2-1)),m=l-chroma/2;
    const sectors=[[chroma,x,0],[x,chroma,0],[0,chroma,x],[0,x,chroma],[x,0,chroma],[chroma,0,x]];
    return '#'+sectors[Math.min(5,Math.floor(h*6))].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
  };
  const tint=Math.min(.28,best.s),accentS=best.s<.08?0:Math.max(.35,Math.min(.68,best.s));
  return {background:color(tint,.09),panel:color(tint,.13),panelAlt:color(tint,.17),accent:color(accentS,.66),accentAlt:color(accentS,.77),
    secondary:color(tint,.50),highlight:color(accentS,.66),text:'#f3f3f3',muted:'#b5b5b5',line:color(tint,.30)};
}
export const sampleWallpaperExpression=`(async()=>{
  let source=document.getElementById('codex-dream-skin-media');
  if(source){if(source.readyState<2){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{source.removeEventListener('loadeddata',ready);reject(new Error('视频画面尚未加载'))},8000);function ready(){clearTimeout(timer);resolve()}source.addEventListener('loadeddata',ready,{once:true})})}}
  else {const url=window.__CODEX_DREAM_SKIN_STATE__?.artUrl;if(typeof url!=='string'||!(/^(blob:|data:image\\/)/.test(url)))throw new Error('图片背景不可读取');source=new Image();source.src=url;await source.decode()}
  const canvas=document.createElement('canvas');canvas.width=40;canvas.height=24;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0,40,24);return Array.from(context.getImageData(0,0,40,24).data);
})()`;

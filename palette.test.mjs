import test from 'node:test';
import assert from 'node:assert/strict';
import {paletteFromPixels,sampleWallpaperExpression} from './palette.mjs';
import vm from 'node:vm';
const fill=rgb=>Array.from({length:40},()=>[...rgb,255]).flat();
const luminance=hex=>{const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
test('green and red wallpaper produce distinct matching accents with readable contrast',()=>{
  const green=paletteFromPixels(fill([60,150,50])),red=paletteFromPixels(fill([190,55,60]));
  assert.notEqual(green.accent,red.accent);
  const g=green.accent.slice(1).match(/../g).map(x=>parseInt(x,16));assert.ok(g[1]>g[0]&&g[1]>g[2]);
  for(const p of [green,red])assert.ok((luminance(p.accent)+.05)/(luminance(p.panel)+.05)>=4.5);
});
test('transparent, black, white and malformed samples do not invent a theme color',()=>{
  for(const rgb of [[0,0,0],[255,255,255]])assert.throws(()=>paletteFromPixels(fill(rgb)));
  assert.throws(()=>paletteFromPixels([400,0,0,255]));assert.throws(()=>paletteFromPixels([0,0,0]));
});
test('colored wallpaper details retain a green accent when neutral pixels dominate',()=>{
  const pixels=[...fill([90,90,90]),...Array.from({length:4},()=>[60,150,50,255]).flat()];
  const channels=paletteFromPixels(pixels).accent.slice(1).match(/../g).map(x=>parseInt(x,16));
  assert.ok(channels[1]>channels[0]&&channels[1]>channels[2]);
});
test('image sampling reads the renderer blob URL used by installed image themes',async()=>{
 let drawnSource;
 const pixels=[40,90,130,255];
 const context={window:{__CODEX_DREAM_SKIN_STATE__:{artUrl:'blob:app://-/local-image'}},Image:class{async decode(){}},document:{getElementById:()=>null,createElement:()=>({getContext:()=>({drawImage:source=>{drawnSource=source.src},getImageData:()=>({data:pixels})})})}};
 const sampled=await vm.runInNewContext(sampleWallpaperExpression,context);assert.equal(drawnSource,'blob:app://-/local-image');assert.deepEqual(Array.from(sampled),pixels);
 context.window.__CODEX_DREAM_SKIN_STATE__.artUrl='https://example.invalid/image.png';await assert.rejects(vm.runInNewContext(sampleWallpaperExpression,context),/不可读取/);
});

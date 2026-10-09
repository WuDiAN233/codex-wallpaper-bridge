import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('./picker-ui.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  function installScrollGlass('),source.indexOf('  const stopScrollGlass='));
function fixture(){
 const attrs=new Map([['data-wallpaper-glass','light']]),listeners=new Map(),timers=new Map();let seq=0;
 const controller=new AbortController();const doc={documentElement:{getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},addEventListener:(k,f,o)=>{assert.equal(o.passive,true);assert.equal(o.capture,true);listeners.set(k,f)}};
 const install=vm.runInNewContext('('+body.trim()+')',{clearTimeout:id=>timers.delete(id),setTimeout:(f,ms)=>{assert.equal(ms,160);timers.set(++seq,f);return seq}});
 install(doc,controller.signal);
 return {attrs,timers,controller,fire:(type,thread=true)=>listeners.get(type)({target:{closest:()=>thread?{}:null}})};
}
test('scroll glass pauses before wheel paint and restores after the final scroll',()=>{
 const f=fixture();f.fire('wheel');assert.ok(f.attrs.has('data-wallpaper-scrolling'));f.fire('scroll');f.fire('touchmove');assert.equal(f.timers.size,1);[...f.timers.values()][0]();assert.equal(f.attrs.has('data-wallpaper-scrolling'),false);
});
test('solid mode and unrelated scrolling do not allocate glass work',()=>{
 const f=fixture();f.fire('scroll',false);assert.equal(f.timers.size,0);f.attrs.set('data-wallpaper-glass','solid');f.fire('wheel');assert.equal(f.timers.size,0);
});
test('disposing a picker clears the pending timer and scrolling state',()=>{
 const f=fixture();f.fire('scroll');f.controller.abort();assert.equal(f.timers.size,0);assert.equal(f.attrs.has('data-wallpaper-scrolling'),false);
});
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=process.env.CODEX_SKIN_TEST_INJECTOR||path.join(here,'compat-runtime/scripts/injector.mjs');
const {verifySession,SKIN_VERSION}=await import(pathToFileURL(file));
const source=await fs.readFile(file,'utf8');
const contract=JSON.parse(await fs.readFile(path.join(path.dirname(file),'../assets/selectors.json'),'utf8'));
const selector=key=>contract.selectors.find(x=>x.key===key).selector;
const node=(width=900,height=650,x=320,y=50)=>({
  isConnected:true,getBoundingClientRect:()=>({x,y,width,height,right:x+width,bottom:y+height}),
  checkVisibility:()=>width>0&&height>0,querySelector:()=>null,
  querySelectorAll:()=>[],children:[],_style:{display:'flex',visibility:'visible',opacity:'1'},
});
function fixture({hiddenThread=false,allHidden=false,staleHome=false}={}){
  const hidden=node(0,0,0,0),shell=allHidden?hidden:node(),composer=allHidden?hidden:node(810,108,410,800);
  const thread=hiddenThread?hidden:node(900,650,320,107);shell.querySelector=s=>s==='.thread-scroll-container'?thread:null;
  const selectors=new Map([
    [selector('shell-main'),[hidden,shell]],
    [selector('left-panel'),[node(319,884,0,48)]],[selector('composer-chrome'),[hidden,composer]],
    ['[data-ds-part="main"], [data-ds-part="home"]',[hidden,shell]],['[data-ds-part="composer"]',[hidden,composer]],
    [selector('home-route'),staleHome?[hidden]:[]],
  ]);
  const styleNode={};
  const document={documentElement:{scrollWidth:1320,clientWidth:1320,scrollHeight:937,clientHeight:937,getAttribute:()=> 'active'},
    visibilityState:'visible',hidden:false,adoptedStyleSheets:[],getElementById:id=>id==='codex-dream-skin-style'?styleNode:null,
    querySelector:s=>selectors.get(s)?.[0]??null,querySelectorAll:s=>selectors.get(s)??[]};
  const dom={document,window:{__CODEX_DREAM_SKIN_STATE__:{version:SKIN_VERSION,styleMode:'style',styleNode,scope:{level:'L1',baseState:'thread',missingL1:[]}}},
    innerWidth:1320,innerHeight:937,getComputedStyle:n=>n._style};
  return {send:async(method)=>method==='Browser.getWindowForTarget'?{windowId:1,bounds:{width:1320,height:937,windowState:'normal'}}:{bounds:{width:1320,height:937,windowState:'normal'}},evaluate:async expression=>vm.runInNewContext(expression,dom)};
}
test('retained hidden route precedes the active conversation',async()=>{
  const result=await verifySession(fixture({staleHome:true}),'main');
  assert.equal(result.pass,true);assert.equal(result.shell.visible,true);assert.equal(result.homePresent,false);assert.equal(result.composer.visible,true);
});
test('a hidden conversation cannot pass because its shell and sidebar are visible',async()=>{
  const result=await verifySession(fixture({hiddenThread:true}),'main');
  assert.equal(result.pass,false);assert.equal(result.readiness.conversationPass,false);
});
test('all hidden surfaces fail closed',async()=>{
  assert.equal((await verifySession(fixture({allHidden:true}),'main')).pass,false);
});
test('one-shot video apply and reload pass the complete media payload',async()=>{
  const apply=source.slice(source.indexOf('const sessionApplications =')>=0?source.indexOf('const sessionApplications ='):source.indexOf('async function applyToSession('),source.indexOf('export function earlyPayloadFor('));
  const once=source.slice(source.indexOf('async function runOneShot('),source.indexOf('async function runWatch('));
  for(const reload of [false,true]){
    let evaluated=0,transferred=0;
    const loaded={payload:'compiled theme',mediaType:'video',theme:{id:'fixture',name:'Fixture'},revision:'revision'};
    const session={closed:false,evaluate:async value=>{assert.equal(value,loaded.payload);evaluated++;},send:async()=>{},close:()=>{}};
    const process={exitCode:0};
    const context={process,console:{log:()=>{}},setTimeout:fn=>{fn()},connectCodexTargets:async()=>[{session,target:{id:'main'},probe:{markers:{}}}],
      nextOperationToken:()=> 'fixture',bestEffortOperationUi:async()=>true,presentOperationUi:async()=>true,
      loadPayload:async()=>loaded,setStreamCspBypass:async()=>{},transferVideoToSession:async(s,p)=>{assert.equal(p,loaded);transferred++},
      waitForVerifiedSession:async()=>({pass:true})};
    await vm.runInNewContext(`${apply}\n${once}\nrunOneShot({mode:'once',port:1,browserId:'fixture',themeDir:'fixture',reload:${reload}})`,context);
    assert.equal(process.exitCode,0);assert.equal(evaluated,reload?2:1);assert.equal(transferred,reload?2:1);
  }
});
test('reload and live-update media transfers do not overlap on one session',async()=>{
  const start=source.indexOf('const sessionApplications =');
  const apply=source.slice(start>=0?start:source.indexOf('async function applyToSession('),source.indexOf('export function earlyPayloadFor('));
  let release,started;const gate=new Promise(r=>release=r);const entered=new Promise(r=>started=r);
  let active=0,maxActive=0,evaluations=0;
  const session={evaluate:async()=>{evaluations++;active++;maxActive=Math.max(maxActive,active);started();await gate},send:async()=>{}};
  const context={setStreamCspBypass:async()=>{},transferVideoToSession:async()=>{active--}};
  const run=vm.runInNewContext(`${apply}\napplyToSession`,context);
  const first=run(session,{payload:'first',mediaType:'video'});await entered;
  const second=run(session,{payload:'second',mediaType:'video'});
  await Promise.resolve();await Promise.resolve();release();
  await Promise.all([first,second]);assert.equal(maxActive,1);assert.equal(evaluations,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {PreparedThemeAction} from './theme-worker.mjs';
test('prepared worker receives exact unicode input once and exits',async()=>{
 const worker=new PreparedThemeAction(process.execPath,['-e',`process.stdin.setEncoding('utf8');process.stdin.once('data',s=>{const r=JSON.parse(s);process.exit(r.Title==='壁纸 "test"'&&r.Reveal===100?0:1)})`]);
 await worker.apply({Title:'壁纸 "test"',Reveal:100});assert.ok(worker.closed);await assert.rejects(worker.apply({}),/already sent/);
});
test('prepared worker cancellation releases the idle process',async()=>{
 const worker=new PreparedThemeAction(process.execPath,['-e',`process.stdin.resume()`]);await worker.cancel();assert.ok(worker.closed);
 await assert.rejects(worker.apply({}));
});
test('prepared worker errors and timeouts never report successful application',async()=>{
 const failed=new PreparedThemeAction(process.execPath,['-e',`process.stdin.once('data',()=>{console.error('rejected fixture');process.exit(2)})`]);await assert.rejects(failed.apply({}),/rejected fixture/);
 const timeout=new PreparedThemeAction(process.execPath,['-e',`process.stdin.resume();setInterval(()=>{},1000)`],{timeoutMs:100});await assert.rejects(timeout.apply({}),/超时/);assert.ok(timeout.closed);
});

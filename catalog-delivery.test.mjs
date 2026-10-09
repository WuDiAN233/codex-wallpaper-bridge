import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogUpdate,isWallpaperPage,libraryPollInterval} from './catalog-delivery.mjs';
test('unchanged catalog replies omit thumbnails without losing their update identity',()=>{
 let calls=0;const items=()=>{calls++;return [{id:'a',preview:'image'}]},info={revision:'a'.repeat(64)};
 const first=catalogUpdate(null,items,info,'ready'),repeat=catalogUpdate(info.revision,items,info,'ready');
 assert.equal(calls,1);assert.equal(first.items.length,1);assert.equal(repeat.items,undefined);assert.equal(repeat.catalog,true);assert.equal(repeat.message,'ready');
});
test('changed catalogs and freshly recreated panels receive a complete list',()=>{
 const info={revision:'b'.repeat(64)},items=()=>[{id:'new'}];
 for(const previous of ['a'.repeat(64),null,undefined])assert.deepEqual(catalogUpdate(previous,items,info).items,items());
});
test('only supported conversation pages are watched, never avatar overlays or web pages',()=>{
 for(const url of ['app://-/index.html','app://-/index.html?initialRoute=%2Fconversation','app://-/detached-window.html?initialRoute=%2Fdetached-window'])assert.ok(isWallpaperPage({type:'page',url}));
 for(const url of ['app://-/index.html?initialRoute=%2Favatar-overlay','https://example.com/index.html','app://other/index.html','invalid','app://-/prewarm.html'])assert.equal(isWallpaperPage({type:'page',url}),false);
 assert.equal(isWallpaperPage({type:'worker',url:'app://-/index.html'}),false);
});

test('idle libraries poll less often without slowing visible catalogs or overriding slower preferences',()=>{assert.equal(libraryPollInterval(false,5000),30000);assert.equal(libraryPollInterval(true,5000),5000);assert.equal(libraryPollInterval(false,60000),60000);assert.equal(libraryPollInterval(true,60000),60000)});

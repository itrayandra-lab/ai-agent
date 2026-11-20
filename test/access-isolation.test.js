import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ray-isolation-'));
process.env.DATA_DIR=dir;
const store=await import('../server/store.js');
const {starterDb}=await import('../server/workspace.js');
const brain=await import('../server/brain.js');
const collab=await import('../server/collab.js');
const gov=await import('../server/governor.js');
store.load({reset:true});
store.createWorkspace('test-b',starterDb());
test('workspace reset never replaces the main database',()=>{
 const main=store.get(); store.run('test-b',()=>store.load({reset:true}));assert.equal(store.get(),main);assert.notEqual(store.run('test-b',store.get),main);
});
test('training files and research caches are isolated',async()=>{
 assert.notEqual(collab.trainingFile('aria'),store.run('test-b',()=>collab.trainingFile('aria')));
 await gov.cached('web','same query',99999,async()=> 'main evidence');
 const other=await store.run('test-b',()=>gov.cached('web','same query',99999,async()=> 'other evidence'));assert.equal(other,'other evidence');
 assert.throws(()=>collab.trainingFile('../auth'));
});
test('private notes are available only to their human author',()=>{
 const n={visibility:'private',authorId:'owner'};
 assert.equal(brain.canRead(n),false);assert.equal(brain.canRead(n,{employeeId:'owner'}),true);
 assert.equal(brain.canRead(n,{employeeId:'aria'}),false);
 assert.equal(brain.canRead({visibility:'internal'},{audience:'public'}),false);
});
test('agent cannot overwrite a verified note',()=>{
 brain.writeNote({title:'Protected fact',content:'truth',authorId:'owner'});
 assert.throws(()=>brain.writeNote({title:'Protected fact',content:'guess',authorId:'aria'}));
 assert.equal(brain.findNote('Protected fact').content,'truth');
});
test('exports strip every supported connector credential without mutating settings',()=>{
 Object.assign(store.get().settings,{apiKey:'secret-a',groqApiKey:'secret-b',googleAppsScript:{secret:'secret-c'},mcpServers:[{id:'m',url:'https://secret.example/?token=secret-d',headers:{Authorization:'secret-e'}}]});
 assert.ok(!JSON.stringify(store.exportSettings()).match(/secret-[a-e]/));
 assert.equal(store.get().settings.groqApiKey,'secret-b');
 assert.deepEqual(store.publicSettings().mcpServers[0].headers,{});
});
test.after(async()=>{store.saveAll();await new Promise(r=>setTimeout(r,500));fs.rmSync(dir,{recursive:true,force:true});});

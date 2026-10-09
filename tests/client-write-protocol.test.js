import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { supabaseKeyHeaders } from '../src/sync/supabase-headers.js';
const require = createRequire(import.meta.url);
const { startBackupServer } = require('../sync-server.js');
const root = path.resolve(import.meta.dirname, '..');
test('all packaged sources declare the same write protocol and cache version', () => {
  for (const p of ['src/sync/supabase-headers.js', 'src/sync/cloud.js', 'service-worker.js']) {
    assert.equal(fs.readFileSync(path.join(root,p),'utf8'), fs.readFileSync(path.join(root,'www',p),'utf8'), p);
  }
  for (const key of ['sb_publishable_x','legacy-key']) {
    assert.equal(supabaseKeyHeaders(key, {bearer:'staff-token',json:false})['x-smile-write-protocol'], '048-v1');
  }
  assert.match(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'), /smile-trust-susu-offline-048-v1/);
});
test('backup server refuses stale uploads without changing saved data; reads and current clients work', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smile-protocol-'));
  const file=path.join(dir,'backup.json');
  fs.writeFileSync(file,'{"preserved":true}');
  const server=startBackupServer({port: 0,backupFile:file,host:'127.0.0.1'});
  try {
    if(!server.listening) await new Promise(resolve=>server.once('listening',resolve));
    const url='http://127.0.0.1:'+server.address().port+'/backup';
    for(const version of ['', '047', '999']) {
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-smile-write-protocol':version},body:'{"stale":true}'});
      assert.equal(response.status,409);
      assert.equal(fs.readFileSync(file,'utf8'),'{"preserved":true}');
    }
    assert.equal((await fetch(url)).status,200);
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-smile-write-protocol':'048-v1'},body:'{"current":true}'});
    assert.equal(response.status,200);
    assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{current:true});
  } finally {
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

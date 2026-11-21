import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {buildRoster} from './build-ksk-roster.mjs';
import {normalizeMssv,recordId,decryptStudent} from '../ksk/roster-crypto.mjs';

test('MSSV accepts dotted and compact input; rejects malformed input',()=>{
 assert.equal(normalizeMssv(' 5201104040 '),'52.01.104.040');
 assert.equal(normalizeMssv('52.01.104.040'),'52.01.104.040');
 for(const input of ['', '52.01.104.04', '52-01-104-040', '52011040400', '<script>'])assert.equal(normalizeMssv(input),null);
});

test('encrypted build round-trips in Web Crypto; rejects tampering and duplicate IDs',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'ksk-test-'));
 try{
  const manifest=await buildRoster([
   ['1','52.01.104.040','Sinh viên thử nghiệm','2008-01-02'],
   ['2','52.01.104.041','Trùng A','3/4/2008'],
   ['3','5201104041','Trùng B','3/4/2008'],
   ['4','','Thiếu MSSV',''],
  ],directory);
  assert.equal(manifest.count,1);assert.equal(manifest.excludedDuplicateMssv,1);assert.equal(manifest.invalidRows,1);
  const mssv='52.01.104.040',id=await recordId(mssv);
  const json=await readFile(path.join(directory,manifest.generation,id.slice(0,2)+'.json'),'utf8');
  assert.ok(!json.includes(mssv));assert.ok(!json.includes('Sinh viên'));
  const record=JSON.parse(json)[id];
  assert.deepEqual(await decryptStudent(mssv,record,manifest),{order:'1',mssv,name:'Sinh viên thử nghiệm',birthDate:'02/01/2008'});
  await assert.rejects(decryptStudent('52.01.104.042',record,manifest));
  const data=Buffer.from(record.data,'base64');data[0]^=1;
  await assert.rejects(decryptStudent(mssv,{...record,data:data.toString('base64')},manifest));
  const duplicate=await recordId('52.01.104.041');
  assert.ok(!JSON.parse(await readFile(path.join(directory,manifest.generation,duplicate.slice(0,2)+'.json'),'utf8'))[duplicate]);
 }finally{await rm(directory,{recursive:true,force:true});}
});

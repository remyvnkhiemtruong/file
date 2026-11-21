import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,pbkdf2,createCipheriv,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeMssv} from '../ksk/roster-crypto.mjs';
const derive=promisify(pbkdf2);
export async function buildRoster(rows,output) {
 const byId=new Map(),duplicates=new Set();
 let invalid=0;
 for(const row of rows){
  const [order,raw,name,birth]=row.map(v=>String(v??'').trim());
  const mssv=normalizeMssv(raw);
  if(!mssv||!name){invalid++;continue;}
  if(byId.has(mssv)){duplicates.add(mssv);continue;}
  let birthDate=birth;
  const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  const local=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(birth);
  if(iso)birthDate=[iso[3],iso[2],iso[1]].join('/');
  else if(local)birthDate=[local[1].padStart(2,'0'),local[2].padStart(2,'0'),local[3]].join('/');
  else if(birth)throw Error('Invalid birth date at source order '+order);
  byId.set(mssv,{order,mssv,name,birthDate});
 }
 // Match the original portal: accept only MSSV appearing exactly once.
 for(const mssv of duplicates)byId.delete(mssv);
 const salt=randomBytes(16),generation=randomBytes(12).toString('hex'),iterations=100000;
 const shards=Array.from({length:256},()=>({})),students=[...byId.values()];
 let next=0,completed=0;
 await Promise.all(Array.from({length:8},async()=>{
  while(next<students.length){
   const student=students[next++],mssv=student.mssv;
   const id=createHash('sha256').update('HCMUE-KSK-v1:'+mssv).digest('hex');
   const key=await derive(mssv,salt,iterations,32,'sha256'),iv=randomBytes(12);
   const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(mssv));
   const data=Buffer.concat([cipher.update(JSON.stringify(student),'utf8'),cipher.final(),cipher.getAuthTag()]);
   shards[parseInt(id.slice(0,2),16)][id]={iv:iv.toString('base64'),data:data.toString('base64')};
   completed++;if(completed%4000===0)console.log('Encrypted '+completed+' records');
  }
 }));
 const directory=path.join(output,generation);await mkdir(directory,{recursive:true});
 for(let i=0;i<256;i++)await writeFile(path.join(directory,i.toString(16).padStart(2,'0')+'.json'),JSON.stringify(shards[i]));
 const manifest={version:1,algorithm:'AES-256-GCM/PBKDF2-SHA256',iterations,salt:salt.toString('base64'),generation,generatedAt:new Date().toISOString(),count:students.length,excludedDuplicateMssv:duplicates.size,invalidRows:invalid,source:{book:'11rvrUbvA9HIjhEhs_99O95sVxoC7omdqi9QeypmvBgE',tab:1077009534}};
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Usage: node scripts/build-ksk-roster.mjs PRIVATE_SOURCE.json [OUTPUT_DIR]');
 const rows=JSON.parse(await readFile(process.argv[2],'utf8'));
 const output=path.resolve(process.argv[3]||fileURLToPath(new URL('../ksk/data',import.meta.url)));
 console.log(JSON.stringify(await buildRoster(rows,output),null,2));
}

const encoder = new TextEncoder();
export function normalizeMssv(raw) {
 const value=String(raw).trim();
 if(!/^(\d{10}|\d{2}\.\d{2}\.\d{3}\.\d{3})$/.test(value))return null;
 const d=value.replaceAll('.','');
 return [d.slice(0,2),d.slice(2,4),d.slice(4,7),d.slice(7)].join('.');
}
export async function recordId(mssv) {
 const bytes=await crypto.subtle.digest('SHA-256',encoder.encode('HCMUE-KSK-v1:'+mssv));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function deriveKey(mssv,salt,iterations) {
 const material=await crypto.subtle.importKey('raw',encoder.encode(mssv),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function decodeBase64(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export async function decryptStudent(mssv,record,manifest) {
 const key=await deriveKey(mssv,decodeBase64(manifest.salt),manifest.iterations);
 const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decodeBase64(record.iv),additionalData:encoder.encode(mssv)},key,decodeBase64(record.data));
 const student=JSON.parse(new TextDecoder().decode(bytes));
 if(student.mssv!==mssv||!student.name||typeof student.order!=='string'||typeof student.birthDate!=='string')throw Error('Invalid record');
 return student;
}

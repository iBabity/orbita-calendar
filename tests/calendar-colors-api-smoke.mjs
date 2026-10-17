// Local D1 only; preferences do not write to Google or hosted data.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.get('set-cookie').split(';')[0];
const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json'};
const read=async()=>await(await fetch(base+'/api/events',{headers})).json();
const send=async(body,h=headers)=>{const r=await fetch(base+'/api/calendar-colors',{method:'POST',headers:h,body:JSON.stringify(body)});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw}}return {status:r.status,data}};
const before=await read();
for(const id of ['local:projetos','google:color-test@invalid.test']){
 let version=before.colors[id]?.version||0;const original=before.colors[id]?.color??null;
 try{
  const saved=await send({id,color:'#ABCDEF',version});assert.equal(saved.status,200);version++;assert.deepEqual(saved.data.colors[id],{color:'#abcdef',version});
  assert.deepEqual((await read()).colors[id],{color:'#abcdef',version});
  assert.equal((await send({id,color:'#ff0000',version:version-1})).status,409);
  assert.equal((await send({id,color:'red',version})).status,400);
  const reset=await send({id,color:null,version});assert.equal(reset.status,200);version++;assert.deepEqual(reset.data.colors[id],{color:null,version});
  assert.equal((await send({id,color:'#ff0000',version:0})).status,409);
 }finally{const restored=await send({id,color:original,version});assert.equal(restored.status,200)}
}
assert.equal((await send({id:'local:bad',color:'#abcdef',version:0})).status,400);
assert.equal((await send({}, {'Content-Type':'application/json',Origin:base})).status,401);
assert.equal((await send({}, {...headers,Origin:'https://other.test'})).status,403);
const after=await read();assert.deepEqual(after.events,before.events);assert.deepEqual(after.calendars,before.calendars);
console.log('PASS: local/Google colors, persistence, reset, version conflicts, validation, auth/Origin, events and calendar names preserved.');

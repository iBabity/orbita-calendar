// Local D1 only. Deleting an agenda preserves its events for restoration.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const headers={Cookie:login.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
const read=async()=>await(await fetch(base+'/api/events',{headers})).json();
const send=async(path,body,h=headers)=>{const r=await fetch(base+path,{method:'POST',headers:h,body:JSON.stringify(body)});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw}}return {status:r.status,data}};
const before=await read(),versions=new Map(),deleted=[];
const original={id:crypto.randomUUID(),title:'Agenda deletion local fixture',start:'2026-10-19T12:00:00.000Z',end:'2026-10-19T13:00:00.000Z',calendar:'projetos',description:'Preservar',location:'',allDay:false,version:0};
try{
 assert.equal((await send('/api/events',original)).status,200);
 for(const c of before.calendars){
  const r=await send('/api/calendar-state',{id:c.id,deleted:true,version:c.deletionVersion});assert.equal(r.status,200);deleted.push(c);versions.set(c.id,c.deletionVersion+1);
  assert.ok(!r.data.calendars.some(x=>x.id===c.id));assert.ok(r.data.deletedCalendars.some(x=>x.id===c.id));
  assert.equal((await send('/api/calendar-state',{id:c.id,deleted:true,version:c.deletionVersion})).status,409);
 }
 const hidden=await read();assert.equal(hidden.calendars.length,0);assert.equal(hidden.events.length,0);assert.equal(hidden.deletedCalendars.length,3);
 assert.equal((await send('/api/events',{...original,version:1,title:'Blocked edit'})).status,409);
 assert.equal((await send('/api/events',{...original,id:crypto.randomUUID()})).status,409);
 const transfer=await send('/api/event-transfers',{id:crypto.randomUUID(),source:{id:original.id,calendar:original.calendar,external:false,version:1},destination:'local:pessoal',data:{...original,timezone:'America/Sao_Paulo',addGoogleMeet:false}});
 assert.equal(transfer.data.run.outcome.state,'blocked');
 for(const c of deleted){const r=await send('/api/calendar-state',{id:c.id,deleted:false,version:versions.get(c.id)});assert.equal(r.status,200);versions.set(c.id,versions.get(c.id)+1)}
 const restored=await read();assert.equal(restored.calendars.length,3);assert.equal(restored.deletedCalendars.length,0);assert.deepEqual(restored.events.find(e=>e.id===original.id),{...original,version:1,owner:restored.events.find(e=>e.id===original.id).owner,contactName:'',companyName:'',phone:'',timezone:''});
 assert.deepEqual(restored.colors,before.colors);assert.deepEqual(restored.calendars.map(c=>[c.id,c.name,c.version]),before.calendars.map(c=>[c.id,c.name,c.version]));
 assert.equal((await send('/api/calendar-state',{id:'google:other',deleted:true,version:0})).status,400);
 assert.equal((await send('/api/calendar-state',{}, {'Content-Type':'application/json',Origin:base})).status,401);
 assert.equal((await send('/api/calendar-state',{}, {...headers,Origin:'https://other.test'})).status,403);
 console.log('PASS: delete/restore all agendas, hidden events preserved, stale conflicts, blocked creation/edit/transfer, names/colors preserved, auth/Origin.');
}finally{
 const state=await read();for(const c of state.deletedCalendars.filter(c=>deleted.some(d=>d.id===c.id)))await send('/api/calendar-state',{id:c.id,deleted:false,version:c.deletionVersion});
 await fetch(base+'/api/events',{method:'DELETE',headers,body:JSON.stringify({id:original.id,version:1})});
}

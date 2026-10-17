// Local D1 only. Never calls Google or touches the hosted calendar.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.get('set-cookie').split(';')[0];
const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json'};
const send=async(path,body,h=headers)=>{const r=await fetch(base+path,{method:'POST',headers:h,body:JSON.stringify(body)});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw}}return {status:r.status,data}};
const original={id:crypto.randomUUID(),version:0,title:'Transfer smoke local',start:'2026-10-19T12:00:00.000Z',end:'2026-10-19T13:30:00.000Z',calendar:'trabalho',description:'Notas preservadas',location:'Sala',allDay:false,timezone:'America/Sao_Paulo',contactName:'Contato teste',companyName:'Empresa teste',phone:''};
const payload={title:original.title,start:original.start,end:original.end,description:original.description,location:original.location,allDay:false,timezone:original.timezone,contactName:original.contactName,companyName:original.companyName,phone:'',addGoogleMeet:false};
const ids=[];
try{
 assert.equal((await fetch(base+'/api/event-transfers?id='+crypto.randomUUID())).status,401);
 assert.equal((await send('/api/event-transfers',{}, {'Content-Type':'application/json',Origin:base})).status,401);
 assert.equal((await send('/api/event-transfers',{}, {...headers,Origin:'https://other.test'})).status,403);
 const created=await send('/api/events',original);assert.equal(created.status,200);ids.push(created.data.event);
 const request={id:crypto.randomUUID(),source:{id:original.id,calendar:'trabalho',external:false,version:1},destination:'local:projetos',data:payload};
 const moved=await send('/api/event-transfers',request);assert.equal(moved.data.run.outcome.state,'moved');const target=moved.data.run.outcome.event;ids.push(target);assert.equal(target.calendar,'projetos');assert.equal(target.contactName,original.contactName);assert.equal(target.id,request.id);
 const duplicate=await send('/api/event-transfers',request);assert.deepEqual(duplicate.data,moved.data);
 assert.equal((await send('/api/event-transfers',{...request,destination:'local:pessoal'})).status,409);
 const items=await(await fetch(base+'/api/events',{headers})).json();assert.ok(!items.events.some(e=>e.id===original.id));assert.equal(items.events.filter(e=>e.id===target.id).length,1);
 const receipt=await(await fetch(base+'/api/event-transfers?id='+request.id,{headers})).json();assert.equal(receipt.run.outcome.state,'moved');
 const stale=await send('/api/event-transfers',{...request,id:crypto.randomUUID(),source:{id:target.id,calendar:'projetos',external:false,version:0},destination:'local:pessoal'});assert.equal(stale.data.run.outcome.state,'blocked');
 const google=await send('/api/event-transfers',{...request,id:crypto.randomUUID(),source:{id:target.id,calendar:'projetos',external:false,version:1},destination:'google:fixture@invalid.test'});assert.equal(google.data.run.outcome.state,'blocked');
 const after=await(await fetch(base+'/api/events',{headers})).json();assert.ok(after.events.some(e=>e.id===target.id));
 console.log('PASS: local transfer, durable idempotency, payload conflict, stale source, auth/Origin, unavailable Google preserves original.');
}finally{for(const item of ids){await fetch(base+'/api/events',{method:'DELETE',headers,body:JSON.stringify({id:item.id,version:item.version})})}}

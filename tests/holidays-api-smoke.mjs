// Only run against the local preview. This fixture never calls Google.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const auth=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const headers={Cookie:auth.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
const payload={title:'Local holiday fixture',start:'2026-11-02T12:00:00.000Z',end:'2026-11-02T13:00:00.000Z',description:'',location:'',timezone:'America/Sao_Paulo',allDay:false,contactName:'',companyName:'',phone:''};
for(const [path,body] of [
 ['/api/events',{...payload,id:crypto.randomUUID(),calendar:'pessoal',version:0}],
 ['/api/trainings',{action:'create',id:crypto.randomUUID(),payload,expectedTargets:['holiday-fixture@calendar.test']}],
 ['/api/event-transfers',{id:crypto.randomUUID(),source:{id:crypto.randomUUID(),calendar:'pessoal',external:false,version:1},destination:'local:trabalho',data:{...payload,addGoogleMeet:false}}],
]){const result=await post(path,body);assert.equal(result.status,409);assert.equal(result.data.code,'holiday_closed')}
const fixture={...payload,id:crypto.randomUUID(),calendar:'pessoal',version:0,start:'2026-11-03T12:00:00.000Z',end:'2026-11-03T13:00:00.000Z'};
let saved;
try{
 const result=await post('/api/events',fixture);assert.equal(result.status,200);saved=result.data.event;
 const blocked=await post('/api/events',{...saved,start:payload.start,end:payload.end});assert.equal(blocked.status,409);assert.equal(blocked.data.code,'holiday_closed');
 const own=await (await fetch(base+'/api/events',{headers})).json();const unchanged=own.events.find(e=>e.id===fixture.id);assert.equal(unchanged.start,fixture.start);assert.equal(unchanged.version,saved.version);
 const updated=await post('/api/events',{...saved,contactName:'Local fixture contact'});assert.equal(updated.status,200);saved=updated.data.event;
}finally{
 if(saved){const removed=await fetch(base+'/api/events',{method:'DELETE',headers,body:JSON.stringify({id:saved.id,version:saved.version})});assert.equal(removed.status,200)}
}
console.log('PASS: holiday creation/Google dispatch/transfer blocked; rescheduling preserves original; ordinary contact update works; only local fixture cleaned.');

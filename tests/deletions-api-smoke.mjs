import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const headers={Cookie:login.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
const request=async body=>{const r=await fetch(base+'/api/event-deletions',{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,...await r.json()}};
assert.equal((await fetch(base+'/api/event-deletions')).status,401);
assert.equal((await fetch(base+'/api/event-deletions',{method:'POST',headers:{Origin:base},body:'{}'})).status,401);
assert.equal((await fetch(base+'/api/event-deletions',{method:'POST',headers:{Cookie:headers.Cookie},body:'{}'})).status,403);
assert.equal((await request({action:'delete',id:'bad',targets:[]})).status,400);
const fixtures=[];
for(let i=0;i<4;i++){const body={id:crypto.randomUUID(),title:'TESTE LOCAL — exclusão '+i,start:'2026-10-16T12:00:00.000Z',end:'2026-10-16T13:00:00.000Z',calendar:'projetos',allDay:false,description:'',location:'',version:0};const r=await fetch(base+'/api/events',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,200);fixtures.push((await r.json()).event)}
try{
 const selected=fixtures.slice(0,3).map(e=>({kind:'local',id:e.id,title:e.title,start:e.start,end:e.end,agenda:'Projetos',version:e.version}));
 const changed=await fetch(base+'/api/events',{method:'POST',headers,body:JSON.stringify({...fixtures[2],title:'Alterado em outro dispositivo'})});assert.equal(changed.status,200);fixtures[2]=(await changed.json()).event;
 const id=crypto.randomUUID(),body={action:'delete',id,targets:selected};
 assert.equal((await request({...body,targets:[selected[0],selected[0]]})).status,400);
 const runs=await Promise.all([request(body),request(body)]);for(const r of runs)assert.equal(r.status,200);
 const receipt=await(await fetch(base+'/api/event-deletions?id='+id,{headers})).json();const run=receipt.runs[0];assert.equal(run.state,'finished');assert.deepEqual(run.outcomes.map(o=>o.state),['deleted','deleted','changed']);
 assert.equal((await request({...body,targets:[selected[0]]})).status,409);
 const repeated=await request(body);assert.deepEqual(repeated.run.outcomes,run.outcomes);
 const retried=await request({action:'retry',id});assert.deepEqual(retried.run.outcomes,run.outcomes);
 const all=await(await fetch(base+'/api/events',{headers})).json();assert.ok(!all.events.some(e=>e.id===fixtures[0].id||e.id===fixtures[1].id));assert.ok(all.events.some(e=>e.id===fixtures[2].id));assert.ok(all.events.some(e=>e.id===fixtures[3].id));
 assert.equal((await request({action:'retry',id:crypto.randomUUID()})).status,404);
 console.log('PASS: autenticação, Origin, seleção única, exclusão de só dois selecionados, proteção de evento alterado, concorrência, idempotência e preservação do evento não marcado.');
}finally{const all=await(await fetch(base+'/api/events',{headers})).json();for(const e of all.events.filter(e=>fixtures.some(f=>f.id===e.id)))await fetch(base+'/api/events',{method:'DELETE',headers,body:JSON.stringify({id:e.id,version:e.version})})}

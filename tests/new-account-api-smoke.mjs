// Run against a fresh, disposable LOCAL database only.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const headers={Cookie:login.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
const read=async path=>{const r=await fetch(base+path,{headers});return {status:r.status,data:await r.json()}};
const before=await read('/api/events');assert.equal(before.status,200);assert.equal(before.data.events.length,0);assert.equal(before.data.hasGoogleConnection,false);assert.ok(before.data.userId);assert.deepEqual(before.data.calendars.map(c=>c.name),['Pessoal','Trabalho','Projetos']);assert.deepEqual(before.data.colors,{});assert.deepEqual(before.data.deletedCalendars,[]);
const connection=await read('/api/google-auth');assert.equal(connection.data.connected,false);assert.equal(connection.data.email,'');
for(const path of ['/api/trainings','/api/event-deletions']){const result=await read(path);assert.equal(result.status,200);assert.deepEqual(result.data.runs,[])}
const google=await fetch(base+'/api/google',{method:'POST',headers,body:JSON.stringify({action:'calendars'})});const result=await google.json();assert.equal(result.status,'reauthentication_required');assert.match(result.message,/própria conta/);
assert.equal((await fetch(base+'/api/events')).status,401);
for(const [path,id] of [['/api/trainings','22222222-2222-4222-8222-222222222222'],['/api/event-deletions','33333333-3333-4333-8333-333333333333']])assert.deepEqual((await read(path+'?id='+id)).data.runs,[]);
const foreign={id:'11111111-1111-4111-8111-111111111111',title:'Unauthorized change',start:'2030-01-01T12:00:00.000Z',end:'2030-01-01T13:00:00.000Z',calendar:'pessoal',description:'',location:'',allDay:false,version:1};
for(const method of ['POST','DELETE'])assert.equal((await fetch(base+'/api/events',{method,headers,body:JSON.stringify(foreign)})).status,409);
const spoof=await fetch(base+'/api/events',{headers:{'oai-authenticated-user-id':'foreign-fixture','oai-authenticated-user-email':'foreign@example.test'}});assert.equal(spoof.status,401);
console.log('PASS: fresh user starts with zero events, default empty agendas, no Google account, no history; own OAuth required and spoofed auth rejected.');

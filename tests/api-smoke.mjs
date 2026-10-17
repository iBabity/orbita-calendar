import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie,'Login local precisa retornar cookie');
const headers={'Content-Type':'application/json',Origin:base,Cookie:cookie};
assert.equal((await fetch(base+'/api/events')).status,401);
assert.equal((await fetch(base+'/api/events',{method:'POST',body:'{}'})).status,403);
const event={id:crypto.randomUUID(),title:'Teste isolado API',start:'2026-10-15T12:00:00.000Z',end:'2026-10-15T13:00:00.000Z',calendar:'pessoal',description:'',location:'',allDay:false,version:0};
const post=async(value)=>{const res=await fetch(base+'/api/events',{method:'POST',headers,body:JSON.stringify(value)});return [res.status,await res.json()]};
let saved;
try{
 const [status,data]=await post(event);assert.equal(status,200);saved=data.event;assert.equal(saved.version,1);
 const [retryStatus,retry]=await post(event);assert.equal(retryStatus,200);assert.equal(retry.event.id,saved.id);assert.equal(retry.event.version,1);
 const invalid=await post({...saved,end:saved.start});assert.equal(invalid[0],400);
 const updated=await post({...saved,title:'Teste editado API'});assert.equal(updated[0],200);const old=saved;saved=updated[1].event;assert.equal(saved.version,2);
 const stale=await post({...old,title:'Edição antiga'});assert.equal(stale[0],409);
 const loaded=await(await fetch(base+'/api/events',{headers:{Cookie:cookie}})).json();assert.ok(loaded.events.some(e=>e.id===saved.id&&e.title==='Teste editado API'));
 console.log('PASS: login, proteção anônima, Origin, criação, repetição idempotente, datas inválidas, edição, conflito e leitura persistente.');
}finally{if(saved){const res=await fetch(base+'/api/events',{method:'DELETE',headers,body:JSON.stringify({id:saved.id,version:saved.version})});assert.equal(res.status,200);console.log('PASS: exclusão do evento descartável local.')}}

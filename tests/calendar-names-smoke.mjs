import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json'};
assert.equal((await fetch(base+'/api/calendars')).status,401);
assert.equal((await fetch(base+'/api/calendars',{method:'POST',headers:{Origin:base},body:'{}'})).status,401);
assert.equal((await fetch(base+'/api/calendars',{method:'POST',headers:{Cookie:cookie},body:'{}'})).status,403);
const get=async()=>await(await fetch(base+'/api/calendars',{headers})).json();
const initial=await get();const original=initial.calendars.find(c=>c.id==='pessoal');
const eventsBefore=(await(await fetch(base+'/api/events',{headers})).json()).events;
const post=async body=>{const r=await fetch(base+'/api/calendars',{method:'POST',headers,body:JSON.stringify(body)});return [r.status,await r.json()]};
try{
 for(const name of ['', '   ', 'x'.repeat(61)])assert.equal((await post({...original,name}))[0],400);
 assert.equal((await post({...original,id:'agenda-de-outro-usuario',name:'Teste'}))[0],400);
 const [status,result]=await post({...original,name:'  Família & estudos  '});assert.equal(status,200);
 const updated=result.calendars.find(c=>c.id==='pessoal');assert.equal(updated.name,'Família & estudos');assert.equal(updated.version,original.version+1);
 assert.equal((await post({...original,name:'Edição antiga'}))[0],409);
 assert.equal((await get()).calendars.find(c=>c.id==='pessoal').name,'Família & estudos');
 const resultEvents=await(await fetch(base+'/api/events',{headers})).json();assert.deepEqual(resultEvents.events,eventsBefore);assert.equal(resultEvents.calendars.find(c=>c.id==='pessoal').name,'Família & estudos');
 console.log('PASS: autenticação, Origin, nome vazio/longo, ID inválido, espaços, acentos, persistência, sincronização na leitura de eventos, conflito e preservação de eventos.');
}finally{const current=(await get()).calendars.find(c=>c.id==='pessoal');if(current.name!==original.name){assert.equal((await post({...current,name:original.name}))[0],200);console.log('Nome original restaurado na base local.')}}

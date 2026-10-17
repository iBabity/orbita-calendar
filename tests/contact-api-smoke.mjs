import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const headers={Cookie:login.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
const body={id:crypto.randomUUID(),title:'TESTE LOCAL — contato e fuso',start:'2026-10-16T14:00:00.000Z',end:'2026-10-16T15:00:00.000Z',calendar:'projetos',description:'Observações',location:'',allDay:false,version:0,contactName:'Ana Teste',companyName:'Empresa Teste',phone:'(68) 99999-1234',timezone:'America/Rio_Branco'};
const post=async data=>{const r=await fetch(base+'/api/events',{method:'POST',headers,body:JSON.stringify(data)});return {status:r.status,...await r.json()}};
const created=await post(body);assert.equal(created.status,200);
let version=created.event.version;
try{
 for(const key of ['contactName','companyName','phone','timezone','start','end'])assert.equal(created.event[key],body[key]);
 const items=await(await fetch(base+'/api/events',{headers})).json();assert.equal(items.events.find(e=>e.id===body.id).phone,body.phone);
 const {contactName,companyName,phone,timezone,...legacy}=body;
 const changed=await post({...legacy,version,title:body.title+' atualizado'});assert.equal(changed.status,200);version=changed.event.version;
 for(const key of ['contactName','companyName','phone','timezone'])assert.equal(changed.event[key],body[key]);
 for(const patch of [{phone:'123'},{phone:'+1 2345678901'},{phone:'(00) 99999-1234'},{phone:'(97) 99999-1234',timezone:'America/Sao_Paulo'},{companyName:'A'.repeat(201)},{timezone:'Europe/London'}])assert.equal((await post({...body,...patch,id:crypto.randomUUID()})).status,400);
 const remote=await fetch(base+'/api/trainings',{method:'POST',headers,body:JSON.stringify({action:'create',id:crypto.randomUUID(),expectedTargets:['test'],payload:{title:'inválido',start:body.start,end:body.end,description:'',location:'',timezone:'America/Sao_Paulo',phone:'(97) 99999-1234'}})});assert.equal(remote.status,400);
 console.log('PASS: contato opcional persistido, leitura sincronizada, atualização legada preserva dados, telefone/DDD e região inválidos rejeitados antes de qualquer escrita externa.');
}finally{assert.equal((await fetch(base+'/api/events',{method:'DELETE',headers,body:JSON.stringify({id:body.id,version})})).status,200)}

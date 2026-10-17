import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoogleEvent} from '../lib/google-events.ts';
import {googleMeetDetails} from '../lib/google-meet.mjs';
const cal={id:'bitrix-test',summary:'Bitrix24'};
test('contato de evento antigo volta aos campos e não duplica ao salvar novamente',async()=>{
 const {contactDescription}=await import('../lib/brazil-time.mjs');
 const notes='Orientações do treinamento';
 const description=contactDescription({description:notes,contactName:'Ana',companyName:'Loja',phone:'(11) 99999-1234'});
 const raw={id:'contact',description,start:{dateTime:'2026-10-16T15:00:00-03:00',timeZone:'America/Sao_Paulo'},end:{dateTime:'2026-10-16T16:00:00-03:00'}};
 const event=normalizeGoogleEvent(raw,cal);
 assert.equal(event.contactName,'Ana');assert.equal(event.companyName,'Loja');assert.equal(event.phone,'(11) 99999-1234');assert.equal(event.description,notes);assert.equal(event.timezone,'America/Sao_Paulo');
 assert.equal(contactDescription(event),description);
 const cleared=normalizeGoogleEvent({...raw,description:contactDescription({...event,contactName:'',companyName:'',phone:''})},cal);
 assert.equal(cleared.description,notes);assert.equal(cleared.contactName,'');
 const unrelated=normalizeGoogleEvent({...raw,description:'Contato\nFalar com a recepção'},cal);
 assert.equal(unrelated.description,'Contato\nFalar com a recepção');assert.equal(unrelated.contactName,'');
});
test('preserva evento do conector com datas ISO em texto e fuso brasileiro',()=>{
 const result=normalizeGoogleEvent({id:'tomorrow',summary:'Compromisso de exemplo',start:'2026-10-16T15:00:00-03:00',end:'2026-10-16T16:30:00-03:00',url:'https://www.google.com/calendar/event?eid=test'},cal);
 assert.ok(result);assert.equal(result.start,'2026-10-16T18:00:00.000Z');assert.equal(result.end,'2026-10-16T19:30:00.000Z');assert.equal(result.calendar,cal.id);assert.equal(result.external,true);assert.equal(result.allDay,false);assert.equal(result.url,'https://www.google.com/calendar/event?eid=test');
});
test('continua aceitando objetos dateTime da API Google',()=>{const r=normalizeGoogleEvent({id:'rest',start:{dateTime:'2026-10-16T15:00:00-03:00'},end:{dateTime:'2026-10-16T16:00:00-03:00'}},cal);assert.equal(r?.start,'2026-10-16T18:00:00.000Z')});
test('dia inteiro funciona tanto com texto quanto com objetos date e fim exclusivo',()=>{for(const object of [true,false]){const s='2026-10-16',e='2026-10-17';const r=normalizeGoogleEvent({id:'all-day',start:object?{date:s}:s,end:object?{date:e}:e},cal);assert.ok(r?.allDay);assert.equal(new Date(r.start).getDate(),16);assert.equal(new Date(r.end).getDate(),17)}});
test('aceita campos alternativos do conector',()=>{assert.ok(normalizeGoogleEvent({id:'alternate',start_time:'2026-10-16T15:00:00Z',end_time:'2026-10-16T16:00:00Z'},cal))});
test('ignora registro cancelado, inválido ou sem horário sem quebrar as demais agendas',()=>{for(const raw of [{id:'c',status:'cancelled'},{id:'bad',start:'data inválida',end:'outra'}, {id:'missing'}, {id:'inverted',start:'2026-10-16T16:00:00Z',end:'2026-10-16T15:00:00Z'}])assert.equal(normalizeGoogleEvent(raw,cal),null)});
test('lê o link de Meet em respostas REST e do conector, rejeitando endereços falsos',()=>{for(const event of [{hangoutLink:'https://meet.google.com/abc-defg-hij'},{hangout_link:'https://meet.google.com/abc-defg-hij'},{conference_data:{entry_points:[{uri:'https://meet.google.com/abc-defg-hij'}]}}])assert.equal(googleMeetDetails(event).meetUrl,'https://meet.google.com/abc-defg-hij');for(const url of ['javascript:alert(1)','https://meet.google.com.evil.test/abc','https://meet.google.com@evil.test/abc','https://meet.google.com/'])assert.equal(googleMeetDetails({hangoutLink:url}).meetUrl,undefined)});

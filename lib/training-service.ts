import type {Event} from './calendar';
import type {ConnectorResult,Json} from './connector-contract.mjs';
import {googleMeetDetails} from './google-meet.mjs';
import {contactDescription} from './brazil-time.mjs';
export const GOOGLE_CONNECTOR='connector_947e0d954944416db111db556030eea6';
export type TrainingPayload={title:string;start:string;end:string;description:string;location:string;timezone:string;addGoogleMeet?:boolean;allDay?:boolean;startDate?:string;endDate?:string;contactName?:string;companyName?:string;phone?:string};
export type TrainingTarget={id:string;summary:string;kind:'bitrix'|'personal'|'google';background_color?:string};
export type TrainingOutcome={calendarId:string;deletedAt?:number;state:'ready'|'pending'|'created'|'blocked'|'unknown';message:string;eventId?:string;url?:string;meetUrl?:string;meetStatus?:string;retryAt?:number;connector?:ConnectorResult;meetConnector?:ConnectorResult};
export {connectorPayload} from './connector-payload.mjs';
import {connectorPayload} from './connector-payload.mjs';
export function resolveWritableTargets(data:any):TrainingTarget[]{
 const calendars=data?.calendars||data?.items;
 if(!Array.isArray(calendars))throw Error('Não foi possível identificar suas agendas do Google.');
 return calendars.filter(c=>typeof c.id==='string'&&['owner','writer'].includes(c.access_role||c.accessRole)).map(c=>({id:c.id,summary:c.summary||c.id,kind:c.primary?'personal':'google',background_color:c.background_color||c.backgroundColor}));
}
const noWriteStatuses=new Set(['reauthentication_required','tool_not_allowed','connector_access_disabled','binding_unavailable','request_context_expired','rate_limited','invalid_request','tool_not_found']);
export function outcomeFromResult(result:ConnectorResult,target:TrainingTarget,meetRequested=false):TrainingOutcome{
 if(result.status==='success'){
  let event:any;try{const data=connectorPayload(result);event=data?.event||data}catch{}
  const eventId=event?.id||event?.event_id;
  if(typeof eventId==='string'&&eventId)return {calendarId:target.id,state:'created',eventId,message:'Evento criado nesta agenda.',url:event.htmlLink||event.html_link||event.url,...googleMeetDetails(event,meetRequested),connector:result};
  return {calendarId:target.id,state:'unknown',message:'O Google respondeu sem o identificador do evento. Confira esta agenda antes de criar novamente.',connector:result};
 }
 const blocked=noWriteStatuses.has(result.status);
 return {calendarId:target.id,state:blocked?'blocked':'unknown',message:blocked?(result.status==='reauthentication_required'?'Autorize a criação de eventos na conexão Google.':result.status==='rate_limited'?'O Google pediu uma pausa antes de tentar novamente.':'A criação não foi autorizada ou está indisponível nesta agenda.'):'O resultado não foi confirmado. Confira esta agenda antes de criar novamente.',...(result.retryAfterMs!==undefined?{retryAt:Date.now()+result.retryAfterMs}:{}),connector:result};
}
export async function executeTraining(payload:TrainingPayload,targets:TrainingTarget[],outcomes:TrainingOutcome[],invoke:(args:Record<string,Json>)=>Promise<ConnectorResult>,save:(outcomes:TrainingOutcome[])=>Promise<void>){
 const next=outcomes.map(o=>({...o}));
 for(let i=0;i<targets.length;i++){
  if(next[i].state!=='ready')continue;
  next[i]={calendarId:targets[i].id,state:'pending',message:'Criação enviada; aguardando confirmação.'};await save(next);
  let result:ConnectorResult;try{result=await invoke({calendar_id:targets[i].id,title:payload.title,...(payload.allDay?{start_date:payload.startDate!,end_date:payload.endDate!}:{start_time:payload.start,end_time:payload.end,timezone_str:payload.timezone}),...(payload.addGoogleMeet?{add_google_meet:true}:{}),description:contactDescription(payload),location:payload.location,attendees:[],event_type:'default'});}catch{result={status:'upstream_error',message:'Resultado não confirmado.'}}
  next[i]=outcomeFromResult(result,targets[i],payload.addGoogleMeet);await save(next);
 }
 return next;
}
export type TrainingReceipt={id:string;title:string;start:string;end:string;allDay?:boolean;timezone?:string;state:string;targets:TrainingTarget[];outcomes:TrainingOutcome[];events:Event[];createdAt:number};
export async function refreshPendingMeets(outcomes:TrainingOutcome[],read:(args:Record<string,Json>)=>Promise<ConnectorResult>){
 const next=outcomes.map(o=>({...o}));
 for(const outcome of next){
  if(outcome.deletedAt||outcome.state!=='created'||!outcome.eventId||outcome.meetStatus!=='pending')continue;
  if(outcome.meetConnector&&'retryAfterMs' in outcome.meetConnector&&outcome.retryAt&&outcome.retryAt>Date.now())continue;
  const result=await read({calendar_id:outcome.calendarId,event_id:outcome.eventId});outcome.meetConnector=result;
  if('retryAfterMs' in result&&result.retryAfterMs!==undefined)outcome.retryAt=Date.now()+result.retryAfterMs;
  if(result.status==='success'){const data=connectorPayload(result);const event=data?.event||data;const id=event?.id||event?.event_id;if(id===outcome.eventId)Object.assign(outcome,googleMeetDetails(event,true));}
 }
 return next;
}

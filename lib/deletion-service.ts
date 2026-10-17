import type {ConnectorResult,Json} from './connector-contract.mjs';
import {connectorPayload} from './connector-payload.mjs';
export type DeletionTarget={kind:'local'|'google';id:string;title:string;start:string;end:string;agenda:string;version?:number;calendarId?:string;eventId?:string;allDay?:boolean;startDate?:string;endDate?:string};
export type DeletionOutcome={id:string;state:'ready'|'pending'|'deleted'|'blocked'|'unknown'|'changed'|'refused';message:string;connector?:ConnectorResult;retryAt?:number};
export type DeletionReceipt={id:string;state:string;targets:DeletionTarget[];outcomes:DeletionOutcome[];createdAt:number};
const noWrite=new Set(['reauthentication_required','tool_not_allowed','connector_access_disabled','binding_unavailable','request_context_expired','rate_limited','invalid_request','tool_not_found']);
export function canRetryDeletion(outcome:DeletionOutcome){return outcome.state==='blocked'&&!['tool_not_found','invalid_request'].includes(outcome.connector?.status||'')}
export function deletionMessage(outcome:DeletionOutcome){
 switch(outcome.connector?.status){
  case 'tool_not_found':return 'A integração do site não disponibiliza a ação necessária para excluir este evento. Ele continua na agenda. Abra o Google Calendar para excluí-lo.';
  case 'invalid_request':return 'A integração recusou os dados da exclusão. O site precisa de uma correção antes de tentar novamente.';
  case 'tool_not_allowed':return 'A integração não permitiu a exclusão. O evento continua na agenda; você pode excluí-lo pelo Google Calendar.';
  case 'connector_access_disabled':return 'O acesso à integração está desativado. O evento continua na agenda.';
  case 'rate_limited':return 'O Google limitou as solicitações. Aguarde antes de tentar novamente.';
  default:return outcome.message;
 }
}
export function deleteOutcome(result:ConnectorResult,id:string,beforeWrite=false):DeletionOutcome{
 if(result.status==='success')return {id,state:'deleted',message:'Evento excluído.',connector:result};
 const outcome:DeletionOutcome={id,state:beforeWrite||noWrite.has(result.status)?'blocked':'unknown',message:result.status==='reauthentication_required'?'Autorize o acesso de escrita no Google.':beforeWrite?'Não foi possível conferir o evento. Nenhuma exclusão foi enviada.':noWrite.has(result.status)?'Exclusão não autorizada ou temporariamente indisponível.':'O resultado da exclusão não foi confirmado. Confira a agenda antes de tentar outra operação.',connector:result,...(result.retryAfterMs!==undefined?{retryAt:Date.now()+result.retryAfterMs}:{})};
 return {...outcome,message:deletionMessage(outcome)};
}
export function checkGoogleTarget(target:DeletionTarget,raw:any):DeletionOutcome|null{
 const id=raw?.id||raw?.event_id;
 if(id!==target.eventId)return {id:target.id,state:'changed',message:'O Google retornou outro registro. Atualize a agenda antes de excluir.'};
 if(raw?.status==='cancelled')return {id:target.id,state:'deleted',message:'Este evento já está excluído.'};
 if(Array.isArray(raw?.recurrence)&&raw.recurrence.length)return {id:target.id,state:'refused',message:'Este registro representa uma série recorrente. Abra no Google para escolher a ocorrência ou a série.'};
 const start=typeof raw?.start==='string'?raw.start:raw?.start?.dateTime||raw?.start?.date_time||raw?.start?.date||raw?.start_time||raw?.start_date;
 const end=typeof raw?.end==='string'?raw.end:raw?.end?.dateTime||raw?.end?.date_time||raw?.end?.date||raw?.end_time||raw?.end_date;
 const sameTime=target.allDay?start===target.startDate&&end===target.endDate:Date.parse(start)===Date.parse(target.start)&&Date.parse(end)===Date.parse(target.end);
 if(id!==target.eventId||(raw?.summary||raw?.title||'Sem título')!==target.title||!sameTime)return {id:target.id,state:'changed',message:'O evento mudou desde a seleção. Atualize a agenda e selecione-o novamente.'};
 return null;
}
type Invoke=(action:'list_calendars'|'read_event'|'delete_event',args:Record<string,Json>)=>Promise<ConnectorResult>;
export async function executeDeletions(targets:DeletionTarget[],outcomes:DeletionOutcome[],invoke:Invoke,removeLocal:(target:DeletionTarget)=>Promise<DeletionOutcome>,save:(outcomes:DeletionOutcome[])=>Promise<void>){
 const next=outcomes.map(o=>({...o}));let calendars:ConnectorResult|undefined;
 for(let i=0;i<targets.length;i++){
  if(next[i].state!=='ready')continue;const target=targets[i];
  if(target.kind==='google'){
   try{
    calendars??=await invoke('list_calendars',{max_results:100});
    if(calendars.status!=='success'){next[i]=deleteOutcome(calendars,target.id,true);await save(next);continue;}
    const data=connectorPayload(calendars);const cal=(data?.calendars||data?.items||[]).find((c:any)=>c.id===target.calendarId);
    if(!cal||!['owner','writer'].includes(cal.access_role||cal.accessRole)){next[i]={id:target.id,state:'refused',message:'Esta agenda é somente leitura ou não está disponível nesta conta.'};await save(next);continue;}
    const read=await invoke('read_event',{calendar_id:target.calendarId!,event_id:target.eventId!});
    if(read.status!=='success'){next[i]=deleteOutcome(read,target.id,true);await save(next);continue;}
    const dataEvent=connectorPayload(read);const checked=checkGoogleTarget(target,dataEvent?.event||dataEvent);
    if(checked){next[i]=checked;await save(next);continue;}
   }catch{next[i]={id:target.id,state:'blocked',message:'Não foi possível conferir o evento. Nenhuma exclusão foi enviada.'};await save(next);continue;}
  }
  next[i]={id:target.id,state:'pending',message:'Exclusão enviada; aguardando confirmação.'};await save(next);
  try{next[i]=target.kind==='local'?await removeLocal(target):deleteOutcome(await invoke('delete_event',{calendar_id:target.calendarId!,event_id:target.eventId!}),target.id)}catch{next[i]={id:target.id,state:'unknown',message:'O resultado não foi confirmado. Consulte a agenda antes de enviar outra exclusão.'};}
  await save(next);
 }
 return next;
}

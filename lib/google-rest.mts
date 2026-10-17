import type {ConnectorResult,Json} from './connector-contract.mjs';
export type GoogleAction='list_calendars'|'search_events'|'read_event'|'create_event'|'delete_event'|'update_event';
// Optional Google fields must be absent rather than undefined in the JSON envelope.
const ok=(data:any):ConnectorResult=>({status:'success',result:{content:[],structuredContent:JSON.parse(JSON.stringify(data))}});
export function googleHttpFailure(status:number,retryAfter:string|null=null):ConnectorResult{
 const retrySeconds=Number(retryAfter);const delay=retryAfter?(Number.isFinite(retrySeconds)?Math.max(0,retrySeconds*1000):Math.max(0,Date.parse(retryAfter)-Date.now())):30000;
 if(status===401)return {status:'reauthentication_required',message:'Reconecte sua conta Google para continuar.'};
 if(status===403)return {status:'tool_not_allowed',message:'O Google não permitiu esta operação nesta agenda.'};
 if(status===429)return {status:'rate_limited',message:'O Google pediu uma pausa.',retryAfterMs:Number.isFinite(delay)?Math.min(delay,3600000):30000};
 if(status===400)return {status:'invalid_request',message:'O Google recusou os dados da operação.'};
 if(status===412)return {status:'tool_error',message:'O evento foi alterado em outro dispositivo. Atualize antes de salvar.'};
 return {status:status>=500?'upstream_error':'tool_error',message:'O Google não confirmou a operação. Confira a agenda antes de repetir.'};
}
/** Explicit mapping to documented Calendar API routes. No arbitrary URL/action proxy. */
export function createGoogleRest(request:(path:string,init?:RequestInit)=>Promise<Response>){
 const etags=new Map<string,string>();
 return async function invoke(action:GoogleAction,args:Record<string,Json>):Promise<ConnectorResult>{
  const cal=typeof args.calendar_id==='string'?args.calendar_id:'';const event=typeof args.event_id==='string'?args.event_id:'';
  const base='/calendars/'+encodeURIComponent(cal)+'/events';const key=cal+':'+event;
  const get=async(path:string,init?:RequestInit)=>{const response=await request(path,init);if(!response.ok)return {failure:googleHttpFailure(response.status,response.headers.get('Retry-After')),response};const data=response.status===204?null:await response.json();return {response,data};};
  try{
   if(action==='list_calendars'){
    const calendars:any[]=[];let page='';for(let i=0;i<10;i++){const r=await get('/users/me/calendarList?'+new URLSearchParams({maxResults:'100',...(page?{pageToken:page}:{})}));if(r.failure)return r.failure;calendars.push(...((r.data as any).items||[]));page=(r.data as any).nextPageToken||'';if(!page)return ok({calendars:calendars.map(c=>({...c,background_color:c.backgroundColor,access_role:c.accessRole}))});}
    return {status:'tool_error',message:'Há muitas agendas nesta conta. Reduza as agendas inscritas para continuar.'};
   }
   if(!cal)return {status:'invalid_request',message:'Escolha uma agenda.'};
   if(action==='search_events'){
    const q=new URLSearchParams({timeMin:String(args.time_min),timeMax:String(args.time_max),singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:'100',timeZone:String(args.timezone_str||'America/Sao_Paulo'),...(args.next_page_token?{pageToken:String(args.next_page_token)}:{})});const r=await get(base+'?'+q);return r.failure||ok({events:(r.data as any).items||[],next_page_token:(r.data as any).nextPageToken});
   }
   if(action==='read_event'){
    const r=await get(base+'/'+encodeURIComponent(event));if(r.failure)return r.failure;const data=r.data as any;if(typeof data.etag==='string')etags.set(key,data.etag);return ok(data);
   }
   if(action==='delete_event'){
    // executeDeletions must read/check this exact event first. If-Match closes
    // the race between that check and deletion; never silently repeat a write.
    const etag=etags.get(key);if(!event||!etag)return {status:'invalid_request',message:'Atualize o evento antes de excluir.'};
    const r=await get(base+'/'+encodeURIComponent(event)+'?sendUpdates=all',{method:'DELETE',headers:{'If-Match':etag}});return r.failure||ok(null);
   }
   const allDay=typeof args.start_date==='string';
   const body:any={summary:args.title,description:args.description||'',location:args.location||'',start:allDay?{date:args.start_date}:{dateTime:args.start_time,timeZone:args.timezone_str},end:allDay?{date:args.end_date}:{dateTime:args.end_time,timeZone:args.timezone_str}};
   if(args.add_google_meet)body.conferenceData={createRequest:{requestId:crypto.randomUUID(),conferenceSolutionKey:{type:'hangoutsMeet'}}};
   let path=base+'?conferenceDataVersion=1&sendUpdates=all';let method='POST';let headers:Record<string,string>={'Content-Type':'application/json'};
   if(action==='create_event')body.attendees=[];
   else if(action==='update_event'&&event&&typeof args.etag==='string'){
    path=base+'/'+encodeURIComponent(event)+'?conferenceDataVersion=1&sendUpdates=all';method='PATCH';headers['If-Match']=args.etag;
    // Clear the mutually exclusive representation when switching day/time.
    if(allDay){body.start.dateTime=null;body.end.dateTime=null;body.start.timeZone=null;body.end.timeZone=null;}else{body.start.date=null;body.end.date=null;}
   }
   else return {status:'invalid_request',message:'Operação inválida.'};
   const r=await get(path,{method,headers,body:JSON.stringify(body)});return r.failure||ok(r.data);
  }catch{return {status:'upstream_error',message:'O resultado não foi confirmado. Confira a agenda antes de tentar outra operação.'};}
 };
}

import {getChatGPTUser,chatGPTSignInPath} from '../../chatgpt-auth';
import {googleForRequest} from '@/lib/google-client';
import {connectorResponse} from '@/lib/connector-errors.mjs';
import {z} from 'zod';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('calendars')}),
 z.object({action:z.literal('detail'),calendarId:z.string().min(1).max(512),eventId:z.string().min(1).max(1024)}),
 z.object({action:z.literal('events'),calendarId:z.string().min(1).max(512),start:z.string().datetime(),end:z.string().datetime(),page:z.string().max(4000).optional()})
]);
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({status:'invalid_request',message:'Origem inválida.'},{status:403});
 const user=await getChatGPTUser();if(!user)return Response.json({status:'reauthentication_required',message:'Entre para conectar sua agenda.',signin:chatGPTSignInPath('/')},{status:401});
 try{
  const b=schema.parse(await req.json());
  if(b.action==='events'&&(Date.parse(b.end)<=Date.parse(b.start)||Date.parse(b.end)-Date.parse(b.start)>43*86400000))throw Error();
  const c=await googleForRequest(user.userId);
  if(b.action==='detail')return connectorResponse(await c.invoke('read_event',{calendar_id:b.calendarId,event_id:b.eventId}));
  const args=b.action==='calendars'?{max_results:100}:{calendar_id:b.calendarId,time_min:b.start,time_max:b.end,timezone_str:'America/Sao_Paulo',max_results:100,...(b.page?{next_page_token:b.page}:{})};
  return connectorResponse(await c.invoke(b.action==='calendars'?'list_calendars':'search_events',args));
 }catch{return Response.json({status:'invalid_request',message:'Não foi possível consultar esses dados.'},{status:400})}
}

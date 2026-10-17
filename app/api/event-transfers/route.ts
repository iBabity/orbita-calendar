import {and,eq} from 'drizzle-orm';
import {z} from 'zod';
import {getDb} from '@/db';
import {events,eventTransferRuns,trainingRuns} from '@/db/schema';
import {getChatGPTUser} from '../../chatgpt-auth';
import {googleForRequest} from '@/lib/google-client';
import {connectorPayload} from '@/lib/connector-payload.mjs';
import {contactFields,validContactZone,brazilTimezone} from '@/lib/event-validation';
import {contactDescription} from '@/lib/brazil-time.mjs';
import {normalizeGoogleEvent} from '@/lib/google-events';
import {userCalendars} from '@/lib/user-calendars';
import {executeEventTransfer} from '@/lib/event-transfer.mts';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
const localIds=['pessoal','trabalho','projetos'];
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{try{return new Date(v).toISOString().slice(0,10)===v}catch{return false}});
const dataSchema=z.object({title:z.string().trim().min(1).max(200),start:z.string().datetime(),end:z.string().datetime(),description:z.string().max(5000),location:z.string().max(500),allDay:z.boolean(),timezone:brazilTimezone,...contactFields,startDate:date.optional(),endDate:date.optional(),addGoogleMeet:z.boolean()}).refine(validContactZone).refine(v=>v.end>v.start&&Date.parse(v.end)-Date.parse(v.start)<=366*86400000&&(!v.allDay||(!!v.startDate&&!!v.endDate&&v.endDate>v.startDate)));
const schema=z.object({id:z.string().uuid(),source:z.object({id:z.string().min(1).max(1700),calendar:z.string().min(1).max(512),external:z.boolean(),version:z.number().int().nonnegative(),googleEventId:z.string().max(1024).optional(),googleEtag:z.string().max(512).optional()}),destination:z.string().min(7).max(520),data:dataSchema});
const receipt=(row:typeof eventTransferRuns.$inferSelect)=>({id:row.id,state:row.state,outcome:JSON.parse(row.outcome)});
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre para consultar a mudança.'},401);
 const id=new URL(req.url).searchParams.get('id');if(!z.string().uuid().safeParse(id).success)return json({error:'Mudança inválida.'},400);
 const [row]=await getDb().select().from(eventTransferRuns).where(and(eq(eventTransferRuns.owner,user.userId),eq(eventTransferRuns.id,id!)));
 return row?json({run:receipt(row)}):json({error:'Mudança não encontrada.'},404);
}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'Entre para mudar a agenda.'},401);
 let parsed;try{parsed=schema.safeParse(await req.json())}catch{return json({error:'Dados inválidos.'},400)}if(!parsed.success)return json({error:'Confira os dados do evento e a agenda de destino.'},400);
 const body=parsed.data,db=getDb(),s=body.source,p=body.data;
 const destinationGoogle=body.destination.startsWith('google:'),destination=body.destination.slice(destinationGoogle?7:6);
 if((!destinationGoogle&&(!body.destination.startsWith('local:')||!localIds.includes(destination)))||body.destination===(s.external?'google:':'local:')+s.calendar)return json({error:'Escolha outra agenda.'},400);
 const owned=and(eq(eventTransferRuns.id,body.id),eq(eventTransferRuns.owner,user.userId));
 try{
  const [existing]=await db.select().from(eventTransferRuns).where(owned);
  if(existing)return existing.payload===JSON.stringify(body)?json({run:receipt(existing)}):json({error:'Esta mudança já foi enviada com outros dados.'},409);
  const [claimed]=await db.insert(eventTransferRuns).values({id:body.id,owner:user.userId,payload:JSON.stringify(body),outcome:JSON.stringify({state:'checking',message:'Conferindo origem e destino.'}),state:'running',createdAt:Date.now()}).onConflictDoNothing().returning();
  if(!claimed){const [row]=await db.select().from(eventTransferRuns).where(owned);return row?.payload===JSON.stringify(body)?json({run:receipt(row)}):json({error:'Este envio já está em uso.'},409)}
  let client:Awaited<ReturnType<typeof googleForRequest>>|undefined;
  const sourceOwned=and(eq(events.id,s.id),eq(events.owner,user.userId),eq(events.version,s.version));
  const outcome=await executeEventTransfer({
   persist:async outcome=>{await db.update(eventTransferRuns).set({outcome:JSON.stringify(outcome),state:['moved','copied','blocked','unknown'].includes(outcome.state)?'finished':'running'}).where(owned)},
   prepare:async()=>{
    const active=await userCalendars(user.userId);if((!destinationGoogle&&!active.some(c=>c.id===destination))||(!s.external&&!active.some(c=>c.id===s.calendar)))return 'Uma das agendas foi excluída. Atualize a página ou restaure a agenda.';
    if(s.external||destinationGoogle){client=await googleForRequest(user.userId);if(!client.direct)return 'Conecte diretamente sua conta Google para mudar a agenda.';
     const listed=await client.invoke('list_calendars',{});if(listed.status!=='success')return 'Não foi possível conferir as permissões das agendas Google.';
     const calendars=connectorPayload(listed)?.calendars||[];
     for(const id of [s.external?s.calendar:null,destinationGoogle?destination:null].filter(Boolean))if(!calendars.some((c:any)=>c.id===id&&['owner','writer'].includes(c.access_role||c.accessRole)))return 'Uma das agendas é somente leitura ou não está disponível nesta conta.';
    }
    if(s.external){if(!s.googleEventId||!s.googleEtag||s.id!=='google:'+s.calendar+':'+s.googleEventId)return 'Atualize o evento antes de mudar a agenda.';
     const read=await client!.invoke('read_event',{calendar_id:s.calendar,event_id:s.googleEventId});if(read.status!=='success')return 'Não foi possível conferir o original.';
     const raw=connectorPayload(read);if(raw?.id!==s.googleEventId||raw.etag!==s.googleEtag||raw.status==='cancelled')return 'O original mudou em outro dispositivo. Atualize antes de mover.';
     if(raw.locked||raw.recurrence?.length||raw.attendees?.length)return 'Este evento tem convidados, uma série ou proteção. Para preservar esses vínculos, altere a agenda pelo Google ou use Duplicar.';
    }else{const [original]=await db.select().from(events).where(sourceOwned);if(!original||original.calendar!==s.calendar)return 'O original mudou em outro dispositivo. Atualize antes de mover.';}
    return null;
   },
   create:async()=>{
    if(!destinationGoogle){const event={id:body.id,owner:user.userId,title:p.title,start:p.start,end:p.end,calendar:destination,description:p.description,location:p.location,allDay:p.allDay,timezone:p.timezone,contactName:p.contactName||'',companyName:p.companyName||'',phone:p.phone||'',version:1};const [saved]=await db.insert(events).values(event).returning();return {event:saved};}
    const result=await client!.invoke('create_event',{calendar_id:destination,title:p.title,description:contactDescription(p),location:p.location,...(p.allDay?{start_date:p.startDate!,end_date:p.endDate!}:{start_time:p.start,end_time:p.end,timezone_str:p.timezone}),...(p.addGoogleMeet?{add_google_meet:true}:{})});
    if(result.status!=='success')return {error:'O Google não confirmou o destino. O original foi preservado.',uncertain:!['reauthentication_required','invalid_request','tool_not_allowed','rate_limited'].includes(result.status)};
    const event=normalizeGoogleEvent(connectorPayload(result),{id:destination,summary:'',access_role:'writer'});return event?{event}:{uncertain:true};
   },
   remove:async()=>{if(s.external){const result=await client!.invoke('delete_event',{calendar_id:s.calendar,event_id:s.googleEventId!});return result.status==='success';}const removed=await db.delete(events).where(sourceOwned).returning({id:events.id});return removed.length===1;}
  });
  if(outcome.state==='moved'&&s.external){const creations=await db.select().from(trainingRuns).where(eq(trainingRuns.owner,user.userId));for(const creation of creations){const outcomes=JSON.parse(creation.outcomes);let changed=false;for(const item of outcomes){if(item.calendarId===s.calendar&&item.eventId===s.googleEventId&&!item.deletedAt){item.deletedAt=Date.now();item.message='Evento movido para outra agenda.';changed=true}}if(changed)await db.update(trainingRuns).set({outcomes:JSON.stringify(outcomes)}).where(and(eq(trainingRuns.id,creation.id),eq(trainingRuns.owner,user.userId),eq(trainingRuns.outcomes,creation.outcomes)))}}
  return json({run:{id:body.id,state:['moved','copied','blocked','unknown'].includes(outcome.state)?'finished':'running',outcome}});
 }catch{return json({error:'Não foi possível confirmar a mudança. Consulte o resultado antes de repetir.'},503)}
}

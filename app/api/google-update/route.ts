import {and,eq} from 'drizzle-orm';
import {z} from 'zod';
import {getDb} from '@/db';
import {googleUpdateRuns} from '@/db/schema';
import {getChatGPTUser} from '../../chatgpt-auth';
import {googleForRequest} from '@/lib/google-client';
import {connectorPayload} from '@/lib/connector-payload.mjs';
import {contactFields,validContactZone} from '@/lib/event-validation';
import {contactDescription} from '@/lib/brazil-time.mjs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{try{return new Date(v).toISOString().slice(0,10)===v}catch{return false}});
const schema=z.object({id:z.string().uuid(),calendarId:z.string().min(1).max(512),eventId:z.string().min(1).max(1024),etag:z.string().min(1).max(512),title:z.string().trim().min(1).max(200),start:z.string().datetime(),end:z.string().datetime(),description:z.string().max(5000),location:z.string().max(500),timezone:z.string().max(100).refine(v=>{try{new Intl.DateTimeFormat('pt',{timeZone:v});return true}catch{return false}}),allDay:z.boolean(),startDate:date.optional(),endDate:date.optional(),addGoogleMeet:z.boolean(),...contactFields}).refine(validContactZone).refine(v=>Date.parse(v.end)>Date.parse(v.start)&&Date.parse(v.end)-Date.parse(v.start)<=366*86400000&&(!v.allDay||(!!v.startDate&&!!v.endDate&&v.endDate>v.startDate&&Date.parse(v.endDate)-Date.parse(v.startDate)<=366*86400000)));
function receipt(row:typeof googleUpdateRuns.$inferSelect){return {id:row.id,state:row.state,outcome:JSON.parse(row.outcome)}}
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre para consultar a alteração.'},401);
 const id=new URL(req.url).searchParams.get('id');if(!z.string().uuid().safeParse(id).success)return json({error:'Alteração inválida.'},400);
 const [row]=await getDb().select().from(googleUpdateRuns).where(and(eq(googleUpdateRuns.owner,user.userId),eq(googleUpdateRuns.id,id!)));
 return row?json({run:receipt(row)}):json({error:'Alteração não encontrada.'},404);
}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'Entre para alterar eventos.'},401);
 let parsed;try{parsed=schema.safeParse(await req.json())}catch{return json({error:'Dados inválidos.'},400)}if(!parsed.success)return json({error:'Confira os dados e atualize o evento antes de salvar.'},400);
 const payload=parsed.data,db=getDb(),owned=and(eq(googleUpdateRuns.id,payload.id),eq(googleUpdateRuns.owner,user.userId));
 try{
  const [existing]=await db.select().from(googleUpdateRuns).where(owned);
  if(existing)return existing.payload===JSON.stringify(payload)?json({run:receipt(existing)}):json({error:'Esta alteração já foi enviada com outros dados.'},409);
  const client=await googleForRequest(user.userId);if(!client.direct)return json({error:'Conecte diretamente sua conta Google antes de editar eventos.'},409);
  const [row]=await db.insert(googleUpdateRuns).values({id:payload.id,owner:user.userId,payload:JSON.stringify(payload),outcome:JSON.stringify({state:'pending',message:'Conferindo o evento antes de salvar.'}),state:'running',createdAt:Date.now()}).onConflictDoNothing().returning();
  if(!row){const [current]=await db.select().from(googleUpdateRuns).where(owned);return current&&current.payload===JSON.stringify(payload)?json({run:receipt(current)}):json({error:'Este envio já está em uso.'},409)}
  const finish=async(outcome:unknown)=>{const [saved]=await db.update(googleUpdateRuns).set({state:'finished',outcome:JSON.stringify(outcome)}).where(owned).returning();return json({run:receipt(saved)})};
  const calendars=await client.invoke('list_calendars',{max_results:100});
  if(calendars.status!=='success')return finish({state:'blocked',message:'Não foi possível conferir sua agenda. Nenhuma alteração foi enviada.',connector:calendars});
  const calendar=connectorPayload(calendars)?.calendars?.find((c:any)=>c.id===payload.calendarId);
  if(!calendar||!['owner','writer'].includes(calendar.access_role||calendar.accessRole))return finish({state:'blocked',message:'Esta conta não tem permissão para editar a agenda.'});
  const read=await client.invoke('read_event',{calendar_id:payload.calendarId,event_id:payload.eventId});
  if(read.status!=='success')return finish({state:'blocked',message:'Não foi possível conferir o evento. Nenhuma alteração foi enviada.',connector:read});
  const event=connectorPayload(read);
  if(event.id!==payload.eventId||event.etag!==payload.etag||event.status==='cancelled')return finish({state:'changed',message:'O evento mudou em outro dispositivo. Atualize a agenda antes de editar novamente.'});
  if(event.locked||event.recurrence?.length)return finish({state:'blocked',message:'Abra este evento no Google para alterar a série recorrente ou o registro protegido.'});
  // Persist the pending write before sending it. GET and duplicate POST only
  // consult this receipt; an uncertain PATCH is never automatically repeated.
  await db.update(googleUpdateRuns).set({outcome:JSON.stringify({state:'pending',message:'Alteração enviada; aguardando confirmação.'})}).where(owned);
  const result=await client.invoke('update_event',{calendar_id:payload.calendarId,event_id:payload.eventId,etag:event.etag,title:payload.title,...(payload.allDay?{start_date:payload.startDate!,end_date:payload.endDate!}:{start_time:payload.start,end_time:payload.end,timezone_str:payload.timezone}),description:contactDescription(payload),location:payload.location,...(payload.addGoogleMeet&&!event.hangoutLink&&!event.conferenceData?{add_google_meet:true}:{})});
  if(result.status==='success'){const saved=connectorPayload(result);if(saved?.id===payload.eventId)return finish({state:'updated',message:'Evento atualizado na sua agenda Google.',event:saved});}
  const blocked=['reauthentication_required','tool_not_allowed','invalid_request','rate_limited'].includes(result.status);
  return finish({state:blocked?'blocked':'unknown',message:blocked?'O Google recusou a alteração. Confira a conexão e as permissões.':'O resultado não foi confirmado. Confira a agenda antes de fazer outra alteração.',connector:result});
 }catch{return json({error:'Não foi possível confirmar. Consulte o resultado antes de salvar outra vez.'},503)}
}

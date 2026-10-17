import {contactFields,validContactZone} from '@/lib/event-validation';
import {contactDescription} from '@/lib/brazil-time.mjs';
import {and,desc,eq} from 'drizzle-orm';
import {z} from 'zod';
import {getDb} from '@/db';
import {trainingRuns} from '@/db/schema';
import {getChatGPTUser,chatGPTSignInPath} from '../../chatgpt-auth';
import {googleForRequest,googleReconnectPath} from '@/lib/google-client';
import {connectorResponse} from '@/lib/connector-errors.mjs';
import {connectorPayload,resolveWritableTargets,executeTraining,refreshPendingMeets,type TrainingPayload,type TrainingTarget,type TrainingOutcome} from '@/lib/training-service';
import {normalizeGoogleEvent} from '@/lib/google-events';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v});
const payloadSchema=z.object({title:z.string().trim().min(1).max(200),start:z.string().datetime(),end:z.string().datetime(),description:z.string().max(5000),location:z.string().max(500),timezone:z.string().max(100).refine(v=>{try{new Intl.DateTimeFormat('pt-BR',{timeZone:v});return true}catch{return false}}),addGoogleMeet:z.boolean().optional(),allDay:z.boolean().optional(),startDate:dateSchema.optional(),endDate:dateSchema.optional(),...contactFields}).refine(validContactZone).refine(v=>Date.parse(v.end)>Date.parse(v.start)&&Date.parse(v.end)-Date.parse(v.start)<=366*86400000&&(!v.allDay||(!!v.startDate&&!!v.endDate&&v.endDate>v.startDate&&Date.parse(v.endDate)-Date.parse(v.startDate)<=366*86400000)));
// Two destinations are accepted only to look up an unchanged legacy submission.
const createSchema=z.object({action:z.literal('create'),id:z.string().uuid(),payload:payloadSchema,expectedTargets:z.array(z.string().min(1).max(512)).min(1).max(2)});
const requestSchema=z.discriminatedUnion('action',[createSchema,z.object({action:z.literal('retry'),id:z.string().uuid()}),z.object({action:z.literal('refresh_meet'),id:z.string().uuid()})]);
function receipt(row:typeof trainingRuns.$inferSelect){
 const payload=JSON.parse(row.payload) as TrainingPayload;const targets=JSON.parse(row.targets) as TrainingTarget[];const outcomes=JSON.parse(row.outcomes) as TrainingOutcome[];
 // Preserve the visitor's midnight instants; the Worker itself uses UTC.
 const events=outcomes.flatMap((o,i)=>{if(o.deletedAt||o.state!=='created'||!o.eventId)return [];const event=normalizeGoogleEvent({id:o.eventId,summary:payload.title,start:payload.start,end:payload.end,description:contactDescription(payload),location:payload.location,url:o.url},targets[i]);return event?[{...event,allDay:!!payload.allDay,contactName:payload.contactName,companyName:payload.companyName,phone:payload.phone,timezone:payload.timezone,meetUrl:o.meetUrl,meetStatus:o.meetStatus}]:[]});
 return {id:row.id,title:payload.title,start:payload.start,end:payload.end,allDay:!!payload.allDay,timezone:payload.timezone,state:row.state,targets,outcomes,events,createdAt:row.createdAt};
}
async function targetsForRequest(owner:string){const client=await googleForRequest(owner);const result=await client.invoke('list_calendars',{max_results:100});if(result.status!=='success'){const response=connectorResponse(result);const data=await response.json() as Record<string,unknown>;return {response:json({...data,...(result.status==='reauthentication_required'?{signin:client.direct?'/google-connection':chatGPTSignInPath('/')}:{})},response.status)}}try{return {targets:resolveWritableTargets(connectorPayload(result))}}catch(e:any){return {response:json({error:e.message},409)}}}
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta para agendar.',status:'reauthentication_required',signin:chatGPTSignInPath('/')},401);
 try{const url=new URL(req.url);if(url.searchParams.has('targets')){const found=await targetsForRequest(user.userId);return found.response||json({targets:found.targets,signin:await googleReconnectPath(user.userId,chatGPTSignInPath('/'))})}const id=url.searchParams.get('id');if(id&&!z.string().uuid().safeParse(id).success)return json({error:'Agendamento inválido.'},400);const rows=await getDb().select().from(trainingRuns).where(id?and(eq(trainingRuns.owner,user.userId),eq(trainingRuns.id,id)):eq(trainingRuns.owner,user.userId)).orderBy(desc(trainingRuns.createdAt)).limit(id?1:10);return json({runs:rows.map(receipt),signin:await googleReconnectPath(user.userId,chatGPTSignInPath('/'))})}catch{return json({error:'Não foi possível consultar os agendamentos.'},503)}
}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta para criar o evento.',status:'reauthentication_required',signin:chatGPTSignInPath('/')},401);
 let parsed;try{parsed=requestSchema.safeParse(await req.json())}catch{return json({error:'Dados inválidos.'},400)}if(!parsed.success)return json({error:'Confira o título, o período, os horários e os destinos.'},400);
 const body=parsed.data;const db=getDb();const owned=and(eq(trainingRuns.id,body.id),eq(trainingRuns.owner,user.userId));
 try{
  let [row]=await db.select().from(trainingRuns).where(owned);
  if(body.action==='create'&&row){if(row.payload!==JSON.stringify(body.payload)||JSON.stringify((JSON.parse(row.targets) as TrainingTarget[]).map(t=>t.id))!==JSON.stringify(body.expectedTargets))return json({error:'Este agendamento já foi enviado com outros dados ou outra agenda. Consulte o resultado.'},409);return json({run:receipt(row)})}
  if(body.action!=='create'&&!row)return json({error:'Agendamento não encontrado.'},404);
  if(body.action==='refresh_meet'){
   const client=await googleForRequest(user.userId);const outcomes=await refreshPendingMeets(JSON.parse(row.outcomes),args=>client.invoke('read_event',args));
   await db.update(trainingRuns).set({outcomes:JSON.stringify(outcomes)}).where(and(owned,eq(trainingRuns.outcomes,row.outcomes)));
   const [saved]=await db.select().from(trainingRuns).where(owned);return json({run:receipt(saved),signin:await googleReconnectPath(user.userId,chatGPTSignInPath('/'))});
  }
  if(body.action==='create'&&body.expectedTargets.length!==1)return json({error:'Escolha apenas uma agenda para o evento.'},400);
  const found=await targetsForRequest(user.userId);if(found.response)return found.response;const available=found.targets!;
  const selectedIds=body.action==='create'?body.expectedTargets:(JSON.parse(row.targets) as TrainingTarget[]).map(t=>t.id);
  const targets=selectedIds.map(id=>available.find(t=>t.id===id));
  if(targets.some(t=>!t))return json({error:'A agenda selecionada não está disponível para criação nesta conta. Confira a conexão Google.'},409);
  const selectedTargets=targets as TrainingTarget[];
  let payload:TrainingPayload;let outcomes:TrainingOutcome[];
  if(body.action==='create'){
   payload=body.payload;outcomes=selectedTargets.map(t=>({calendarId:t.id,state:'ready',message:'Aguardando criação.'}));
   const inserted=await db.insert(trainingRuns).values({id:body.id,owner:user.userId,payload:JSON.stringify(payload),targets:JSON.stringify(selectedTargets),outcomes:JSON.stringify(outcomes),state:'running',createdAt:Date.now()}).onConflictDoNothing().returning();
   if(!inserted.length){const [current]=await db.select().from(trainingRuns).where(owned);if(!current||current.payload!==JSON.stringify(payload)||JSON.stringify((JSON.parse(current.targets) as TrainingTarget[]).map(t=>t.id))!==JSON.stringify(body.expectedTargets))return json({error:'Este envio já foi reservado com outros dados ou outra agenda.'},409);return json({run:receipt(current)})}row=inserted[0];
  }else{
   payload=JSON.parse(row.payload);outcomes=JSON.parse(row.outcomes);const storedTargets=JSON.parse(row.targets) as TrainingTarget[];
   if(selectedTargets.some((t,i)=>t.id!==storedTargets[i]?.id))return json({error:'As agendas conectadas mudaram. Confira os eventos existentes antes de agendar novamente.'},409);
   if(row.state!=='finished'||!outcomes.some(o=>o.state==='blocked'))return json({run:receipt(row)});
   if(outcomes.some(o=>o.state==='blocked'&&o.retryAt&&o.retryAt>Date.now()))return json({error:'Aguarde o prazo informado pelo Google antes de tentar novamente.'},429);
   outcomes=outcomes.map(o=>o.state==='blocked'?{calendarId:o.calendarId,state:'ready',message:'Nova tentativa solicitada.'}:o);
   const locked=await db.update(trainingRuns).set({state:'running',outcomes:JSON.stringify(outcomes)}).where(and(owned,eq(trainingRuns.state,'finished'),eq(trainingRuns.outcomes,row.outcomes))).returning();
   if(!locked.length){const [current]=await db.select().from(trainingRuns).where(owned);return json({run:receipt(current)})}
  }
  const client=await googleForRequest(user.userId);
  await executeTraining(payload,selectedTargets,outcomes,args=>client.invoke('create_event',args),async next=>{await db.update(trainingRuns).set({outcomes:JSON.stringify(next)}).where(owned)});
  await db.update(trainingRuns).set({state:'finished'}).where(owned);const [saved]=await db.select().from(trainingRuns).where(owned);return json({run:receipt(saved)});
 }catch{return json({error:'Não foi possível confirmar o resultado. Consulte o histórico deste formulário antes de criar novamente.'},503)}
}


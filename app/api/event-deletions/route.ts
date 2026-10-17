import {and,desc,eq} from 'drizzle-orm';
import {z} from 'zod';
import {getDb} from '@/db';
import {deletionRuns,events,trainingRuns} from '@/db/schema';
import {getChatGPTUser,chatGPTSignInPath} from '../../chatgpt-auth';
import {googleForRequest,googleReconnectPath} from '@/lib/google-client';
import {executeDeletions,canRetryDeletion,type DeletionTarget,type DeletionOutcome} from '@/lib/deletion-service';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const base={id:z.string().min(1).max(1700),title:z.string().min(1).max(2000),start:z.string().datetime(),end:z.string().datetime(),agenda:z.string().min(1).max(512)};
const target=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('local'),id:z.string().uuid(),version:z.number().int().positive()}),
 z.object({...base,kind:z.literal('google'),calendarId:z.string().min(1).max(512),eventId:z.string().min(1).max(1024),allDay:z.boolean(),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()})
]).refine(t=>t.kind==='local'||t.id==='google:'+t.calendarId+':'+t.eventId).refine(t=>t.kind!=='google'||!t.allDay||!!t.startDate&&!!t.endDate&&t.endDate>t.startDate);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('delete'),id:z.string().uuid(),targets:z.array(target).min(1).max(50).refine(v=>new Set(v.map(t=>t.id)).size===v.length)}),
 z.object({action:z.literal('retry'),id:z.string().uuid()})
]);
function receipt(row:typeof deletionRuns.$inferSelect){return {id:row.id,state:row.state,targets:JSON.parse(row.targets),outcomes:JSON.parse(row.outcomes),createdAt:row.createdAt}}
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre para consultar suas exclusões.',signin:chatGPTSignInPath('/')},401);
 const id=new URL(req.url).searchParams.get('id');if(id&&!z.string().uuid().safeParse(id).success)return json({error:'Exclusão inválida.'},400);
 try{const rows=await getDb().select().from(deletionRuns).where(id?and(eq(deletionRuns.owner,user.userId),eq(deletionRuns.id,id)):eq(deletionRuns.owner,user.userId)).orderBy(desc(deletionRuns.createdAt)).limit(id?1:20);return json({runs:rows.map(receipt),signin:await googleReconnectPath(user.userId,chatGPTSignInPath('/'))})}catch{return json({error:'Não foi possível consultar o resultado.'},503)}
}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'Entre para excluir seus eventos.',signin:chatGPTSignInPath('/')},401);
 let parsed;try{parsed=schema.safeParse(await req.json())}catch{return json({error:'Dados inválidos.'},400)}if(!parsed.success)return json({error:'Selecione de 1 a 50 eventos válidos, sem repetições.'},400);
 const body=parsed.data,db=getDb(),owned=and(eq(deletionRuns.id,body.id),eq(deletionRuns.owner,user.userId));
 try{
  let [row]=await db.select().from(deletionRuns).where(owned);let targets:DeletionTarget[],outcomes:DeletionOutcome[];
  if(body.action==='delete'){
   targets=body.targets;
   if(row)return row.targets===JSON.stringify(targets)?json({run:receipt(row)}):json({error:'Esta exclusão já foi enviada com outros eventos. Consulte o resultado.'},409);
   outcomes=targets.map(t=>({id:t.id,state:'ready',message:'Aguardando exclusão.'}));
   const [inserted]=await db.insert(deletionRuns).values({id:body.id,owner:user.userId,targets:JSON.stringify(targets),outcomes:JSON.stringify(outcomes),state:'running',createdAt:Date.now()}).onConflictDoNothing().returning();
   if(!inserted){const [existing]=await db.select().from(deletionRuns).where(owned);return existing&&existing.targets===JSON.stringify(targets)?json({run:receipt(existing)}):json({error:'Não foi possível reservar esta exclusão.'},409)}row=inserted;
  }else{
   if(!row)return json({error:'Exclusão não encontrada.'},404);
   targets=JSON.parse(row.targets);outcomes=JSON.parse(row.outcomes);
   if(row.state!=='finished'||!outcomes.some(canRetryDeletion))return json({run:receipt(row)});
   if(outcomes.some(o=>canRetryDeletion(o)&&o.retryAt&&o.retryAt>Date.now()))return json({error:'Aguarde o prazo informado pelo Google.'},429);
   outcomes=outcomes.map(o=>canRetryDeletion(o)?{id:o.id,state:'ready',message:'Nova tentativa solicitada.'}:o);
   const [locked]=await db.update(deletionRuns).set({state:'running',outcomes:JSON.stringify(outcomes)}).where(and(owned,eq(deletionRuns.state,'finished'),eq(deletionRuns.outcomes,row.outcomes))).returning();
   if(!locked){const [current]=await db.select().from(deletionRuns).where(owned);return json({run:receipt(current)})}
  }
  const client=targets.some(t=>t.kind==='google')?await googleForRequest(user.userId):null;
  const result=await executeDeletions(targets,outcomes,(action,args)=>client!.invoke(action,args),async target=>{
   const condition=and(eq(events.id,target.id),eq(events.owner,user.userId));
   const deleted=await db.delete(events).where(and(condition,eq(events.version,target.version!))).returning();
   if(deleted.length)return {id:target.id,state:'deleted',message:'Evento excluído do Órbita.'};
   const [exists]=await db.select({id:events.id}).from(events).where(condition);
   return exists?{id:target.id,state:'changed',message:'Este evento mudou em outro dispositivo. Atualize e selecione-o novamente.'}:{id:target.id,state:'deleted',message:'Este evento já não está na sua agenda.'};
  },async next=>{await db.update(deletionRuns).set({outcomes:JSON.stringify(next)}).where(owned)});
  // Keep historical creation receipts from restoring events that this app removed.
  const removed=targets.filter((t,i)=>t.kind==='google'&&result[i].state==='deleted');
  if(removed.length){const rows=await db.select().from(trainingRuns).where(eq(trainingRuns.owner,user.userId));for(const creation of rows){const outcomes=JSON.parse(creation.outcomes);let changed=false;for(const o of outcomes){if(removed.some(t=>t.calendarId===o.calendarId&&t.eventId===o.eventId)&&!o.deletedAt){o.deletedAt=Date.now();o.message='Evento excluído desta agenda.';changed=true}}if(changed)await db.update(trainingRuns).set({outcomes:JSON.stringify(outcomes)}).where(and(eq(trainingRuns.id,creation.id),eq(trainingRuns.owner,user.userId),eq(trainingRuns.outcomes,creation.outcomes)))}}
  await db.update(deletionRuns).set({state:'finished'}).where(owned);const [saved]=await db.select().from(deletionRuns).where(owned);return json({run:receipt(saved),signin:await googleReconnectPath(user.userId,chatGPTSignInPath('/'))});
 }catch{return json({error:'Não foi possível confirmar a exclusão. Consulte o resultado antes de enviar outra operação.'},503)}
}

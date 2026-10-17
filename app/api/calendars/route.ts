import {and,eq} from 'drizzle-orm';
import {z} from 'zod';
import {getChatGPTUser,chatGPTSignInPath} from '../../chatgpt-auth';
import {getDb} from '@/db';
import {calendarNames} from '@/db/schema';
import {userCalendars} from '@/lib/user-calendars';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
const schema=z.object({id:z.enum(['pessoal','trabalho','projetos']),name:z.string().trim().min(1).max(60),version:z.number().int().nonnegative()});
export async function GET(){const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.',signin:chatGPTSignInPath('/')},401);try{return json({calendars:await userCalendars(user.userId)})}catch{return json({error:'Não foi possível carregar os nomes das agendas.'},503)}}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta para renomear a agenda.',signin:chatGPTSignInPath('/')},401);
 let value;try{value=schema.safeParse(await req.json())}catch{return json({error:'Nome inválido.'},400)}
 if(!value.success)return json({error:'Informe um nome de 1 a 60 caracteres.'},400);
 const {id,name,version}=value.data;
 try{
  const db=getDb();const rows=version===0
   ?await db.insert(calendarNames).values({owner:user.userId,id,name,version:1}).onConflictDoNothing().returning()
   :await db.update(calendarNames).set({name,version:version+1}).where(and(eq(calendarNames.owner,user.userId),eq(calendarNames.id,id),eq(calendarNames.version,version))).returning();
  if(!rows.length)return json({error:'O nome desta agenda mudou em outro dispositivo. Feche esta janela e tente novamente.'},409);
  return json({calendars:await userCalendars(user.userId)});
 }catch{return json({error:'Não foi possível salvar o nome. Confira sua conexão e tente novamente.'},503)}
}

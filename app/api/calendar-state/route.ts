import {and,eq} from 'drizzle-orm';
import {z} from 'zod';
import {getDb} from '@/db';
import {calendarStates} from '@/db/schema';
import {getChatGPTUser} from '../../chatgpt-auth';
import {userCalendars} from '@/lib/user-calendars';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const schema=z.object({id:z.enum(['pessoal','trabalho','projetos']),deleted:z.boolean(),version:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER-1)});
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.'},401);
 let parsed;try{parsed=schema.safeParse(await req.json())}catch{return json({error:'Agenda inválida.'},400)}
 if(!parsed.success)return json({error:'Agenda inválida.'},400);
 const {id,deleted,version}=parsed.data;
 try{const db=getDb();const values={deleted,version:version+1};const rows=version===0?await db.insert(calendarStates).values({owner:user.userId,id,...values}).onConflictDoNothing().returning():await db.update(calendarStates).set(values).where(and(eq(calendarStates.owner,user.userId),eq(calendarStates.id,id),eq(calendarStates.version,version))).returning();
  if(!rows.length)return json({error:'Esta agenda mudou em outro dispositivo. Feche a janela e tente novamente.'},409);
  const all=await userCalendars(user.userId,true);return json({calendars:all.filter(c=>!c.deleted),deletedCalendars:all.filter(c=>c.deleted)});
 }catch{return json({error:'Não foi possível atualizar a agenda. Tente novamente.'},503)}
}

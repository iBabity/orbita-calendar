import {and,eq} from 'drizzle-orm';
import {z} from 'zod';
import {getChatGPTUser,chatGPTSignInPath} from '../../chatgpt-auth';
import {getDb} from '@/db';
import {calendarColors} from '@/db/schema';
import {userCalendarColors} from '@/lib/calendar-colors';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
const schema=z.object({id:z.string().max(1100).refine(id=>/^local:(pessoal|trabalho|projetos)$/.test(id)||(/^google:.+/.test(id)&&!/[\x00-\x1f]/.test(id))),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),version:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER-1)});
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.',signin:chatGPTSignInPath('/')},401);
 let value;try{value=schema.safeParse(await req.json())}catch{return json({error:'Cor inválida.'},400)}
 if(!value.success)return json({error:'Escolha uma cor válida para a agenda.'},400);
 const {id,color,version}=value.data;
 try{
  const db=getDb();const values={color:color?.toLowerCase()??null,version:version+1};
  const saved=version===0?await db.insert(calendarColors).values({owner:user.userId,id,...values}).onConflictDoNothing().returning():await db.update(calendarColors).set(values).where(and(eq(calendarColors.owner,user.userId),eq(calendarColors.id,id),eq(calendarColors.version,version))).returning();
  if(!saved.length)return json({error:'Esta cor mudou em outro dispositivo. Feche a janela e tente novamente.'},409);
  return json({colors:await userCalendarColors(user.userId)});
 }catch{return json({error:'Não foi possível salvar a cor. Tente novamente.'},503)}
}

import {eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {googleConnections,googleOauthStates} from '@/db/schema';
import {getChatGPTUser} from '../../../chatgpt-auth';
export async function POST(req:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403,headers});
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Entre na sua conta.'},{status:401,headers});
 try{
  // Remove this site's stored authorization only; do not revoke grants that may
  // be shared with another signed-in site user on the same Google account.
  await getDb().delete(googleConnections).where(eq(googleConnections.owner,user.userId));
  await getDb().delete(googleOauthStates).where(eq(googleOauthStates.owner,user.userId));
  return new Response(null,{status:303,headers:{...headers,Location:'/?google_connection=disconnected'}});
 }catch{return Response.json({error:'Não foi possível desconectar.'},{status:503,headers})}
}

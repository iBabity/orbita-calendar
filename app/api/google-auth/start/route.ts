import {lt} from 'drizzle-orm';
import {getDb} from '@/db';
import {googleOauthStates} from '@/db/schema';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {getGoogleConfig} from '@/lib/google-client';
import {randomToken,hashToken,seal,stateCookie,authorizationUrl} from '@/lib/google-oauth.mjs';
export async function POST(req:Request){
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403,headers});
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Entre na sua conta antes de conectar o Google.'},{status:401,headers});
 const config=getGoogleConfig();if(!config||new URL(config.redirectUri).origin!==new URL(req.url).origin)return Response.json({error:'A conexão direta ainda está sendo configurada.'},{status:503,headers});
 try{
  const state=randomToken(),verifier=randomToken(),db=getDb();
  await db.delete(googleOauthStates).where(lt(googleOauthStates.expiresAt,Date.now()));
  await db.insert(googleOauthStates).values({hash:await hashToken(state),owner:user.userId,verifier:await seal(config.encryptionKey,user.userId,verifier),expiresAt:Date.now()+600000});
  return new Response(null,{status:303,headers:{...headers,Location:await authorizationUrl(config,state,verifier),'Set-Cookie':stateCookie(state,new URL(req.url).protocol==='https:')}});
 }catch{return Response.json({error:'Não foi possível iniciar a conexão. Tente novamente.'},{status:503,headers})}
}

import {and,eq,gt} from 'drizzle-orm';
import {getDb} from '@/db';
import {googleOauthStates,googleConnections} from '@/db/schema';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {getGoogleConfig} from '@/lib/google-client';
import {hashToken,unseal,seal,cookieState,stateCookie,hasCalendarScopes,tokenRequest} from '@/lib/google-oauth.mjs';
export async function GET(req:Request){
 const url=new URL(req.url),secure=url.protocol==='https:';
 const finish=(status:string)=>new Response(null,{status:303,headers:{Location:'/?google_connection='+status,'Set-Cookie':stateCookie('',secure,0),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 const config=getGoogleConfig(),user=await getChatGPTUser();
 if(!config||!user||new URL(config.redirectUri).origin!==url.origin)return finish('failed');
 const state=url.searchParams.get('state')||'',cookie=cookieState(req.headers.get('cookie'),secure);
 if(!/^[\w-]{43}$/.test(state)||state!==cookie)return finish('invalid_state');
 let stage='state';
 const fail=(reason:string)=>{console.warn('google_oauth_callback_failed',reason);return finish(reason)};
 try{
  const db=getDb();
  // One-time use, bound to this signed-in site's owner, browser and expiry.
  const [pending]=await db.delete(googleOauthStates).where(and(eq(googleOauthStates.hash,await hashToken(state)),eq(googleOauthStates.owner,user.userId),gt(googleOauthStates.expiresAt,Date.now()))).returning();
  if(!pending)return finish('invalid_state');
  if(url.searchParams.has('error'))return finish('cancelled');
  const code=url.searchParams.get('code');if(!code||code.length>8192)return finish('failed');
  stage='verifier';const verifier=await unseal<string>(config.encryptionKey,user.userId,pending.verifier);
  stage='token_exchange';const exchanged=await tokenRequest(config,{grant_type:'authorization_code',code,redirect_uri:config.redirectUri,code_verifier:verifier});
  if(!exchanged.ok)return fail(exchanged.reason);
  const data=exchanged.data;if(!hasCalendarScopes(data.scope||'')||!data.refresh_token)return finish('missing_permission');
  stage='account_lookup';const info=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+data.access_token},redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!info.ok)return fail('account_lookup');const account=await info.json() as any;
  if(typeof account.sub!=='string'||typeof account.email!=='string'||!account.email_verified)return fail('account_identity');
  stage='save_connection';
  const tokens=await seal(config.encryptionKey,user.userId,{accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+Math.min(Number(data.expires_in)||3600,86400)*1000,scope:data.scope});
  await db.insert(googleConnections).values({owner:user.userId,email:account.email,subject:account.sub,tokens,status:'active',updatedAt:Date.now()}).onConflictDoUpdate({target:googleConnections.owner,set:{email:account.email,subject:account.sub,tokens,status:'active',updatedAt:Date.now()}});
  return finish('connected');
 }catch{return fail(stage)}
}

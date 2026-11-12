import {createGoogleRest,type GoogleAction} from './google-rest.mts';
import {unseal,seal,tokenRequest,type GoogleConfig,type GoogleTokens} from './google-oauth.mts';
import type {ConnectorResult,Json} from './connector-contract.mjs';

type SavedConnection={subject:string;status:string;tokens:string};
type Store={read:()=>Promise<SavedConnection|undefined>;replaceTokens:(previous:string,next:string)=>Promise<boolean>;markReconnect:(previous:string)=>Promise<void>};
type Access={record:SavedConnection;tokens:GoogleTokens};
export async function createGoogleSession(config:GoogleConfig,owner:string,initial:SavedConnection,store:Store,request:typeof fetch=fetch){
 const authError:ConnectorResult={status:'reauthentication_required',message:'O Google revogou ou expirou a autorização. Reconecte sua conta para continuar.'};
 let authFailure=false,unreadable=false,writeRejected=false,access:Promise<Access>|undefined;
 const fresh=(state:Access)=>state.record.status==='active'&&state.tokens.expiresAt>Date.now()+60000;
 async function current():Promise<Access>{
  const record=await store.read();
  if(!record||!['active','reconnect'].includes(record.status)||record.subject!==initial.subject){authFailure=true;throw Error('Connection changed')}
  try{return {record,tokens:await unseal<GoogleTokens>(config.encryptionKey,owner,record.tokens)}}catch{unreadable=true;throw Error('Unreadable connection')}
 }
 async function markRevoked(previous:string){
  const before=await current();
  if(before.record.tokens!==previous)return;
  await store.markReconnect(previous);
  const after=await current();
  // A late rejection for an old token cannot invalidate a newer grant.
  if(after.record.tokens!==previous&&fresh(after))return;
  authFailure=true;
 }
 async function acquire(force=false,rejectedToken?:string):Promise<Access>{
  const previous=await current();
  if(fresh(previous)&&(!force||previous.tokens.accessToken!==rejectedToken))return previous;
  const refreshed=await tokenRequest(config,{grant_type:'refresh_token',refresh_token:previous.tokens.refreshToken},request);
  if(!refreshed.ok){
   const winner=await current();
   if(winner.record.tokens!==previous.record.tokens&&fresh(winner))return winner;
   if(refreshed.reauthorize){
    await markRevoked(previous.record.tokens);
    if(!authFailure){const latest=await current();if(fresh(latest))return latest}
   }
   throw Error('Refresh unavailable');
  }
  const data=refreshed.data;
  const tokens:GoogleTokens={...previous.tokens,accessToken:data.access_token,refreshToken:data.refresh_token||previous.tokens.refreshToken,expiresAt:Date.now()+Math.min(Number(data.expires_in)||3600,86400)*1000};
  const encrypted=await seal(config.encryptionKey,owner,tokens);
  if(await store.replaceTokens(previous.record.tokens,encrypted))return {record:{...previous.record,status:'active',tokens:encrypted},tokens};
  // Losing an optimistic concurrency race is not revoked authorization.
  const winner=await current();if(fresh(winner))return winner;
  throw Error('Refresh still pending');
 }
 async function liveAccess(force=false,rejectedToken?:string){
  if(force)access=acquire(true,rejectedToken);else access??=acquire();
  const selected=await access;
  const latest=await current();
  if(latest.record.tokens!==selected.record.tokens){
   if(!fresh(latest))throw Error('Connection renewing');
   access=Promise.resolve(latest);return latest;
  }
  if(latest.record.status!=='active'){authFailure=true;throw Error('Authorization revoked')}
  return selected;
 }
 const rest=createGoogleRest(async(path,init)=>{
  const send=(state:Access)=>request('https://www.googleapis.com/calendar/v3'+path,{...init,headers:{...Object.fromEntries(new Headers(init?.headers).entries()),Authorization:'Bearer '+state.tokens.accessToken},signal:AbortSignal.timeout(20000),redirect:'manual'});
  const selected=await liveAccess();
  const response=await send(selected);
  if(response.status!==401)return response;
  // Refresh once for a rejected access token. Only reads can be replayed;
  // event creation, editing and deletion are never automatically repeated.
  const renewed=await liveAccess(true,selected.tokens.accessToken);
  if(init?.method&&init.method!=='GET'){writeRejected=true;return response}
  const retried=await send(renewed);
  // A Calendar API 401 alone does not revoke a successfully refreshed grant.
  // Only a definitive rejection at the token endpoint requires consent again.
  return retried;
 });
 return async(action:GoogleAction,args:Record<string,Json>):Promise<ConnectorResult>=>{
  const result=await rest(action,args);
  if(unreadable)return {status:'internal_error',message:'Não foi possível ler a conexão salva. A configuração do servidor precisa ser conferida.'};
  if(authFailure)return authError;
  if(result.status==='reauthentication_required')return {status:'upstream_error',message:writeRejected?'A conexão foi renovada. Confira o resultado na agenda antes de tentar a operação novamente.':'A conexão está sendo renovada. Tente atualizar a agenda novamente.'};
  return result;
 };
}

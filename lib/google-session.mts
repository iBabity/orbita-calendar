import {createGoogleRest,type GoogleAction} from './google-rest.mts';
import {unseal,seal,tokenRequest,type GoogleConfig,type GoogleTokens} from './google-oauth.mts';
import type {ConnectorResult,Json} from './connector-contract.mjs';
type SavedConnection={subject:string;status:string;tokens:string};
type Store={read:()=>Promise<SavedConnection|undefined>;replaceTokens:(previous:string,next:string)=>Promise<boolean>;markReconnect:(previous:string)=>Promise<void>};
export async function createGoogleSession(config:GoogleConfig,owner:string,initial:SavedConnection,store:Store,request:typeof fetch=fetch){
 const authError:ConnectorResult={status:'reauthentication_required',message:'Reconecte a conexão direta do Google no menu da agenda.'};
 let tokens:GoogleTokens;
 try{tokens=await unseal(config.encryptionKey,owner,initial.tokens)}catch{return async()=>({status:'internal_error',message:'A conexão direta precisa ser configurada novamente.'} as ConnectorResult)}
 let persistedTokens=initial.tokens,authFailure=false,access:Promise<string>|undefined;
 const reconnect=async()=>{authFailure=true;await store.markReconnect(persistedTokens)};
 async function getAccess(){
  if(tokens.expiresAt>Date.now()+60000)return tokens.accessToken;
  const refreshed=await tokenRequest(config,{grant_type:'refresh_token',refresh_token:tokens.refreshToken},request);
  if(!refreshed.ok){if(refreshed.reauthorize)await reconnect();throw Error('No access token')}
  const data=refreshed.data;tokens={...tokens,accessToken:data.access_token,refreshToken:data.refresh_token||tokens.refreshToken,expiresAt:Date.now()+Math.min(Number(data.expires_in)||3600,86400)*1000};
  const encrypted=await seal(config.encryptionKey,owner,tokens);
  if(!await store.replaceTokens(persistedTokens,encrypted)){authFailure=true;throw Error('Connection changed')}
  persistedTokens=encrypted;return tokens.accessToken;
 }
 const rest=createGoogleRest(async(path,init)=>{
  const current=await store.read();
  if(!current||current.status!=='active'||current.subject!==initial.subject){authFailure=true;throw Error('Connection changed')}
  if(current.tokens!==persistedTokens){if(access){authFailure=true;throw Error('Connection changed')}tokens=await unseal(config.encryptionKey,owner,current.tokens);persistedTokens=current.tokens;}
  access??=getAccess();const token=await access;
  const response=await request('https://www.googleapis.com/calendar/v3'+path,{...init,headers:{...Object.fromEntries(new Headers(init?.headers).entries()),Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000),redirect:'manual'});
  if(response.status===401)await reconnect();return response;
 });
 return async(action:GoogleAction,args:Record<string,Json>):Promise<ConnectorResult>=>{const result=await rest(action,args);return authFailure?authError:result};
}

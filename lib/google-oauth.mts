// Google Calendar authorization is independent of the site's ChatGPT sign-in.
// No provider token or client secret is ever sent to browser code.
export const CALENDAR_SCOPES=['https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events'];
export type GoogleConfig={clientId:string;clientSecret:string;redirectUri:string;encryptionKey:string};
export function googleConfig(values:Record<string,unknown>):GoogleConfig|null{
 const {GOOGLE_CLIENT_ID:id,GOOGLE_CLIENT_SECRET:secret,GOOGLE_REDIRECT_URI:uri,GOOGLE_TOKEN_ENCRYPTION_KEY:key}=values;
 if(![id,secret,uri,key].every(v=>typeof v==='string'&&v.length>0))return null;
 try{const u=new URL(uri as string);if(u.pathname!=='/api/google-auth/callback'||u.search||u.hash||u.username||u.password||!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname))))return null;if(unbase64(key as string).length!==32)return null;}catch{return null;}
 return {clientId:id as string,clientSecret:secret as string,redirectUri:uri as string,encryptionKey:key as string};
}
function base64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes))}
function unbase64(value:string){return Uint8Array.from(atob(value),c=>c.charCodeAt(0))}
export function randomToken(){return base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export async function hashToken(value:string){return base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
async function encryptionKey(secret:string){return crypto.subtle.importKey('raw',unbase64(secret),{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function seal(secret:string,owner:string,value:unknown){
 const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},await encryptionKey(secret),new TextEncoder().encode(JSON.stringify(value)));
 return 'v1.'+base64(iv)+'.'+base64(new Uint8Array(bytes));
}
export async function unseal<T>(secret:string,owner:string,value:string):Promise<T>{
 const [version,iv,body,...extra]=value.split('.');if(version!=='v1'||extra.length)throw Error('Invalid encrypted record');
 const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(iv),additionalData:new TextEncoder().encode(owner)},await encryptionKey(secret),unbase64(body));return JSON.parse(new TextDecoder().decode(data));
}
export async function authorizationUrl(config:GoogleConfig,state:string,verifier:string){
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:['openid','email',...CALENDAR_SCOPES].join(' '),access_type:'offline',prompt:'consent select_account',include_granted_scopes:'true',state,code_challenge:await hashToken(verifier),code_challenge_method:'S256'}).toString();return url.toString();
}
export function hasCalendarScopes(scope:string){const granted=new Set(scope.split(/\s+/));return CALENDAR_SCOPES.every(s=>granted.has(s))||granted.has('https://www.googleapis.com/auth/calendar')}
export type GoogleTokens={accessToken:string;refreshToken:string;expiresAt:number;scope:string};
export function oauthTransportReason(error:unknown){
 const name=error instanceof Error?error.name:'';
 const message=error instanceof Error?error.message:'';
 if(name==='TimeoutError'||name==='AbortError')return 'token_timeout';
 if(/illegal invocation/i.test(message))return 'token_invocation';
 if(/redirect/i.test(message))return 'token_redirect';
 if(/URLSearchParams|body|stream/i.test(message))return 'token_body';
 if(name==='SyntaxError')return 'token_response';
 return name==='TypeError'?'token_transport':'token_exchange';
}
export async function tokenRequest(config:GoogleConfig,params:Record<string,string>,request:typeof fetch=fetch){
 try{
 const response=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...params}),signal:AbortSignal.timeout(15000),redirect:'manual'});
 if(response.status>=300&&response.status<400)return {ok:false as const,reauthorize:false,reason:'token_redirect'};
 const data=await response.json() as any;
 // Never put provider response text or request bodies in errors/logs.
 if(!response.ok||typeof data.access_token!=='string'){
  const reason=['invalid_client','invalid_grant','invalid_token','redirect_uri_mismatch','unauthorized_client'].includes(data.error)?data.error as string:'token_rejected';
  return {ok:false as const,reauthorize:data.error==='invalid_grant'||data.error==='invalid_token',reason};
 }
 return {ok:true as const,data};
 }catch(error){return {ok:false as const,reauthorize:false,reason:oauthTransportReason(error)}}
}
export function stateCookieName(secure:boolean){return secure?'__Host-orbita-google-state':'orbita-google-state'}
export function stateCookie(state:string,secure:boolean,maxAge=600){return stateCookieName(secure)+'='+state+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+maxAge+(secure?'; Secure':'')}
export function cookieState(header:string|null,secure:boolean){return (header||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(stateCookieName(secure)+'='))?.slice(stateCookieName(secure).length+1)||''}

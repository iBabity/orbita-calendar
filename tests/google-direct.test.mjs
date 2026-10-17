import test from 'node:test';
import assert from 'node:assert/strict';
import {googleConfig,seal,unseal,randomToken,hashToken,authorizationUrl,hasCalendarScopes,CALENDAR_SCOPES,stateCookie,cookieState,tokenRequest} from '../lib/google-oauth.mts';
import {connectorResponse} from '../lib/connector-errors.mts';
test('agendas sem cor e última página de eventos passam pelo envelope público',async()=>{
 const invoke=createGoogleRest(async path=>Response.json(path.startsWith('/users/')?{items:[{id:'work',accessRole:'owner'}]}:{items:[{id:'event'}]}));
 for(const [action,args] of [['list_calendars',{}],['search_events',{calendar_id:'work',time_min:'2026-10-15T00:00:00Z',time_max:'2026-10-16T00:00:00Z'}]]){
  const result=await invoke(action,args);const response=connectorResponse(result);
  assert.equal(response.status,200);assert.equal((await response.json()).status,'success');
  if(action==='search_events')assert.equal(Object.hasOwn(result.result.structuredContent,'next_page_token'),false);
 }
});
test('falha de transporte OAuth é classificada sem expor mensagem ou segredo',async()=>{
 for(const [error,reason] of [[new TypeError('Illegal invocation'),'token_invocation'],[new SyntaxError('private provider text'),'token_response'],[new TypeError('private secret text'),'token_transport']]){
  const result=await tokenRequest({clientId:'test',clientSecret:'private',redirectUri:'https://example.test/callback',encryptionKey:''},{},async()=>{throw error});
  assert.deepEqual(result,{ok:false,reauthorize:false,reason});
 }
});
test('redirecionamento OAuth é recusado sem seguir o destino nem ler o corpo',async()=>{
 let calls=0;const result=await tokenRequest({clientId:'test',clientSecret:'private',redirectUri:'https://example.test/callback',encryptionKey:''},{},async(url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response('private non-JSON body',{status:302,headers:{Location:'https://other.test'}})});
 assert.equal(calls,1);assert.deepEqual(result,{ok:false,reauthorize:false,reason:'token_redirect'});
});
import {createGoogleRest,googleHttpFailure} from '../lib/google-rest.mts';
import {createGoogleSession} from '../lib/google-session.mts';
const key=Buffer.alloc(32,7).toString('base64');
const config={clientId:'test-client',clientSecret:'not-a-real-secret',redirectUri:'https://example.test/api/google-auth/callback',encryptionKey:key};
async function sessionFixture({expired=false,replace=true,request}={}){
 const saved={subject:'google-one',status:'active',tokens:await seal(key,'owner',{accessToken:'old-access',refreshToken:'refresh-one',expiresAt:expired?0:Date.now()+3600000,scope:CALENDAR_SCOPES.join(' ')})};let row={...saved};let marks=0;
 const invoke=await createGoogleSession(config,'owner',saved,{read:async()=>row,replaceTokens:async(previous,next)=>{if(!replace||!row||row.tokens!==previous)return false;row={...row,tokens:next};return true},markReconnect:async previous=>{marks++;if(row?.tokens===previous)row.status='reconnect'}},request);
 return {invoke,get row(){return row},set row(v){row=v},get marks(){return marks}};
}
test('renova token expirado uma vez por requisição e persiste criptografado antes de usar',async()=>{
 let refresh=0,reads=0;const f=await sessionFixture({expired:true,request:async(url,init)=>{if(url==='https://oauth2.googleapis.com/token'){refresh++;assert.equal(init.body.get('grant_type'),'refresh_token');return Response.json({access_token:'new-access',expires_in:3600})}reads++;assert.equal(new Headers(init.headers).get('Authorization'),'Bearer new-access');return Response.json({items:[]})}});
 await Promise.all([f.invoke('list_calendars',{}),f.invoke('list_calendars',{})]);assert.equal(refresh,1);assert.equal(reads,2);assert.ok(!f.row.tokens.includes('new-access'));assert.equal((await unseal(key,'owner',f.row.tokens)).refreshToken,'refresh-one');
});
test('refresh concorrente não sobrescreve conexão nova nem envia operação com credencial antiga',async()=>{
 let reads=0;const f=await sessionFixture({expired:true,replace:false,request:async(url)=>{if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'new-access',expires_in:3600});reads++;return Response.json({items:[]})}});const r=await f.invoke('list_calendars',{});assert.equal(r.status,'reauthentication_required');assert.equal(reads,0);
});
test('desconexão ou troca de conta impede chamadas e nunca troca de provedor',async()=>{
 let calls=0;const f=await sessionFixture({request:async()=>{calls++;return Response.json({items:[]})}});f.row={...f.row,subject:'another-account'};assert.equal((await f.invoke('create_event',{calendar_id:'work',title:'Test'})).status,'reauthentication_required');assert.equal(calls,0);
 f.row=undefined;assert.equal((await f.invoke('list_calendars',{})).status,'reauthentication_required');assert.equal(calls,0);
});
test('invalid_grant pede reconexão sem chamar a API; 401 marca o token atual após refresh',async()=>{
 const invalid=await sessionFixture({expired:true,request:async url=>{assert.equal(url,'https://oauth2.googleapis.com/token');return Response.json({error:'invalid_grant'},{status:400})}});assert.equal((await invalid.invoke('list_calendars',{})).status,'reauthentication_required');assert.equal(invalid.row.status,'reconnect');
 const revoked=await sessionFixture({expired:true,request:async url=>url==='https://oauth2.googleapis.com/token'?Response.json({access_token:'new-access',expires_in:3600}):new Response(null,{status:401})});assert.equal((await revoked.invoke('list_calendars',{})).status,'reauthentication_required');assert.equal(revoked.row.status,'reconnect');assert.equal(revoked.marks,1);
});
test('configuração OAuth exige chave AES de 32 bytes e callback seguro e exato',()=>{
 const env={GOOGLE_CLIENT_ID:config.clientId,GOOGLE_CLIENT_SECRET:config.clientSecret,GOOGLE_REDIRECT_URI:config.redirectUri,GOOGLE_TOKEN_ENCRYPTION_KEY:key};assert.deepEqual(googleConfig(env),config);
 for(const patch of [{GOOGLE_CLIENT_SECRET:''},{GOOGLE_TOKEN_ENCRYPTION_KEY:'invalid'},{GOOGLE_REDIRECT_URI:'http://example.test/api/google-auth/callback'},{GOOGLE_REDIRECT_URI:'https://example.test/callback'},{GOOGLE_REDIRECT_URI:config.redirectUri+'?target=other'}])assert.equal(googleConfig({...env,...patch}),null);
 assert.ok(googleConfig({...env,GOOGLE_REDIRECT_URI:'http://127.0.0.1:5173/api/google-auth/callback'}));
});
test('tokens e verificadores criptografados só abrem para o usuário correto; alteração é rejeitada',async()=>{
 const value={refreshToken:'private-refresh',accessToken:'private-access'};const encrypted=await seal(key,'owner-one',value);assert.ok(!encrypted.includes('private'));assert.deepEqual(await unseal(key,'owner-one',encrypted),value);await assert.rejects(()=>unseal(key,'owner-two',encrypted));await assert.rejects(()=>unseal(key,'owner-one',encrypted.slice(0,-5)+'AAAAA'));assert.notEqual(await seal(key,'owner-one',value),encrypted);
});
test('OAuth usa estado aleatório, PKCE S256 e cookie HttpOnly com escopos limitados',async()=>{
 const state=randomToken(),verifier=randomToken(),url=new URL(await authorizationUrl(config,state,verifier));assert.match(state,/^[\w-]{43}$/);assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('state'),state);assert.equal(url.searchParams.get('code_challenge'),await hashToken(verifier));assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('access_type'),'offline');assert.ok(!url.toString().includes(config.clientSecret));assert.ok(!url.toString().includes(verifier));assert.ok(hasCalendarScopes(url.searchParams.get('scope')));assert.equal(hasCalendarScopes(CALENDAR_SCOPES[1]),false);const cookie=stateCookie(state,true);assert.match(cookie,/__Host-.*HttpOnly.*SameSite=Lax.*Secure/);assert.equal(cookieState('other=x; '+cookie,true),state);
});
test('troca de código envia segredo e PKCE somente ao endpoint Google e não refaz requisição',async()=>{
 let calls=0;const result=await tokenRequest(config,{grant_type:'authorization_code',code:'single-code',code_verifier:'verifier'},async(url,init)=>{calls++;assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(init.redirect,'manual');assert.equal(init.body.get('code_verifier'),'verifier');assert.equal(init.body.get('client_secret'),config.clientSecret);return Response.json({error:'invalid_grant'},{status:400})});assert.equal(calls,1);assert.deepEqual(result,{ok:false,reauthorize:true,reason:'invalid_grant'});
});
test('REST lista agendas com paginação e normaliza campos usados pelo calendário',async()=>{
 let calls=0;const invoke=createGoogleRest(async path=>{calls++;return Response.json(calls===1?{items:[{id:'work',backgroundColor:'#123456',accessRole:'writer'}],nextPageToken:'page 2'}:{items:[{id:'personal',accessRole:'owner'}]})});const r=await invoke('list_calendars',{});assert.equal(calls,2);assert.equal(r.status,'success');assert.equal(r.result.structuredContent.calendars[0].access_role,'writer');assert.equal(r.result.structuredContent.calendars[0].background_color,'#123456');
});
test('REST leitura mantém intervalo limitado e expande recorrências para ocorrências',async()=>{
 const invoke=createGoogleRest(async path=>{const url=new URL(path,'https://example.test');assert.equal(url.searchParams.get('singleEvents'),'true');assert.equal(url.searchParams.get('timeMin'),'2026-10-15T00:00:00Z');assert.equal(url.searchParams.get('maxResults'),'100');return Response.json({items:[{id:'instance'}],nextPageToken:'next'})});const r=await invoke('search_events',{calendar_id:'a@group.calendar.google.com',time_min:'2026-10-15T00:00:00Z',time_max:'2026-10-16T00:00:00Z'});assert.equal(r.result.structuredContent.events[0].id,'instance');assert.equal(r.result.structuredContent.next_page_token,'next');
});
test('REST só exclui após leitura do mesmo registro e envia If-Match sem repetir',async()=>{
 const calls=[];const invoke=createGoogleRest(async(path,init)=>{calls.push({path,init});return init?.method==='DELETE'?new Response(null,{status:204}):Response.json({id:'one',etag:'"version-one"'})});assert.equal((await invoke('delete_event',{calendar_id:'work',event_id:'one'})).status,'invalid_request');assert.equal(calls.length,0);await invoke('read_event',{calendar_id:'work',event_id:'one'});const deleted=await invoke('delete_event',{calendar_id:'work',event_id:'one'});assert.equal(calls[1].init.headers['If-Match'],'"version-one"');assert.match(calls[1].path,/sendUpdates=all/);assert.equal(deleted.status,'success');assert.equal(deleted.result.structuredContent,null);
});
test('REST cria um evento na agenda escolhida e pede Meet na mesma criação',async()=>{
 const calls=[];const invoke=createGoogleRest(async(path,init)=>{calls.push({path,init});return Response.json({id:'created'})});await invoke('create_event',{calendar_id:'work',title:'Treinamento',start_time:'2026-10-15T12:00:00Z',end_time:'2026-10-15T13:00:00Z',timezone_str:'America/Sao_Paulo',add_google_meet:true});assert.equal(calls.length,1);const body=JSON.parse(calls[0].init.body);assert.deepEqual(body.attendees,[]);assert.equal(body.conferenceData.createRequest.conferenceSolutionKey.type,'hangoutsMeet');assert.equal(body.start.timeZone,'America/Sao_Paulo');assert.match(calls[0].path,/^\/calendars\/work\/events\?/);assert.match(calls[0].path,/conferenceDataVersion=1/);
});
test('PATCH preserva convidados e recorrência, e protege versão com If-Match',async()=>{
 let calls=0;const invoke=createGoogleRest(async(path,init)=>{calls++;assert.equal(init.method,'PATCH');assert.equal(init.headers['If-Match'],'"original"');const body=JSON.parse(init.body);assert.ok(!('attendees' in body));assert.ok(!('recurrence' in body));assert.deepEqual(body.start,{date:'2026-10-15',dateTime:null,timeZone:null});return new Response(null,{status:412})});const r=await invoke('update_event',{calendar_id:'work',event_id:'one',etag:'"original"',title:'Novo título',start_date:'2026-10-15',end_date:'2026-10-16'});assert.equal(calls,1);assert.equal(r.status,'tool_error');
});
test('falhas e timeouts não viram sucesso nem repetem escrita e respeitam pausa',async()=>{
 let calls=0;const invoke=createGoogleRest(async()=>{calls++;throw Error('secret-provider-details')});const r=await invoke('create_event',{calendar_id:'work',title:'Test'});assert.equal(r.status,'upstream_error');assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('secret-provider-details'));assert.equal(googleHttpFailure(401).status,'reauthentication_required');assert.equal(googleHttpFailure(403).status,'tool_not_allowed');assert.equal(googleHttpFailure(429,'45').retryAfterMs,45000);
});

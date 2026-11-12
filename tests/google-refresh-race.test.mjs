import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleSession} from '../lib/google-session.mts';
import {seal,unseal,CALENDAR_SCOPES} from '../lib/google-oauth.mts';
const key=Buffer.alloc(32,19).toString('base64');
const config={clientId:'race-client',clientSecret:'fixture-only',redirectUri:'https://example.test/api/google-auth/callback',encryptionKey:key};
async function fixture(){
 let row={subject:'same-google-account',status:'active',tokens:await seal(key,'fixture-owner',{accessToken:'expired-access',refreshToken:'fixture-refresh',expiresAt:0,scope:CALENDAR_SCOPES.join(' ')})};let marks=0;
 const store={read:async()=>row,replaceTokens:async(previous,next)=>{if(row?.tokens!==previous)return false;row={...row,tokens:next,status:'active'};return true},markReconnect:async previous=>{marks++;if(row?.tokens===previous)row={...row,status:'reconnect'}}};
 return {store,get row(){return row},set row(v){row=v},get marks(){return marks},session:request=>createGoogleSession(config,'fixture-owner',{...row},store,request)};
}
test('two requests renewing the same expired connection both use the persisted winner',async()=>{
 const f=await fixture();let refreshes=0;let release;const barrier=new Promise(r=>release=r);const sent=[];
 const request=async(url,init)=>{if(url==='https://oauth2.googleapis.com/token'){const n=++refreshes;if(n===2)release();await barrier;return Response.json({access_token:'renewed-'+n,expires_in:3600})}sent.push(new Headers(init.headers).get('Authorization'));return Response.json({items:[]})};
 const a=await f.session(request),b=await f.session(request);
 const results=await Promise.all([a('list_calendars',{}),b('list_calendars',{})]);
 assert.deepEqual(results.map(r=>r.status),['success','success']);assert.equal(f.marks,0);
 const saved=await unseal(key,'fixture-owner',f.row.tokens);assert.deepEqual(sent,['Bearer '+saved.accessToken,'Bearer '+saved.accessToken]);
});
test('a late invalid_grant cannot revoke a connection already renewed by another request',async()=>{
 const f=await fixture();let complete;const saved=new Promise(r=>complete=r);
 const original=f.store.replaceTokens;f.store.replaceTokens=async(...args)=>{const result=await original(...args);complete();return result};
 const good=await f.session(async url=>url==='https://oauth2.googleapis.com/token'?Response.json({access_token:'winning-access',expires_in:3600}):Response.json({items:[]}));
 const late=await f.session(async url=>{if(url==='https://oauth2.googleapis.com/token'){await saved;return Response.json({error:'invalid_grant'},{status:400})}return Response.json({items:[]})});
 const results=await Promise.all([good('list_calendars',{}),late('list_calendars',{})]);
 assert.deepEqual(results.map(r=>r.status),['success','success']);assert.equal(f.marks,0);assert.equal(f.row.status,'active');
});
test('stale access rejected with 401 renews silently and retries only the read once',async()=>{
 const f=await fixture();const tokens=await unseal(key,'fixture-owner',f.row.tokens);f.row={...f.row,tokens:await seal(key,'fixture-owner',{...tokens,expiresAt:Date.now()+3600000})};
 let reads=0,refreshes=0;
 const invoke=await f.session(async(url,init)=>{if(url==='https://oauth2.googleapis.com/token'){refreshes++;return Response.json({access_token:'recovered-access',expires_in:3600})}reads++;return reads===1?new Response(null,{status:401}):Response.json({items:[]})});
 assert.equal((await invoke('list_calendars',{})).status,'success');assert.equal(refreshes,1);assert.equal(reads,2);assert.equal(f.marks,0);assert.equal(f.row.status,'active');
});
test('temporary refresh failure preserves the grant and never asks for consent',async()=>{
 const f=await fixture();const before=f.row.tokens;
 const invoke=await f.session(async()=>Response.json({error:'temporarily_unavailable'},{status:503}));
 assert.equal((await invoke('list_calendars',{})).status,'upstream_error');assert.equal(f.row.tokens,before);assert.equal(f.row.status,'active');assert.equal(f.marks,0);
});
test('401 on a write prepares a renewed grant without repeating the write',async()=>{
 const f=await fixture();let writes=0,refreshes=0;
 const invoke=await f.session(async(url,init)=>{if(url==='https://oauth2.googleapis.com/token'){refreshes++;return Response.json({access_token:'renewed-'+refreshes,expires_in:3600})}assert.equal(init.method,'POST');writes++;return new Response(null,{status:401})});
 const result=await invoke('create_event',{calendar_id:'work',title:'Fixture'});
 assert.equal(result.status,'upstream_error');assert.equal(writes,1);assert.equal(f.marks,0);assert.equal(f.row.status,'active');
});
test('an old reconnect flag is repaired only after a successful refresh is saved',async()=>{
 const f=await fixture();f.row={...f.row,status:'reconnect'};let calls=0;
 const invoke=await f.session(async url=>{calls++;return Response.json(url==='https://oauth2.googleapis.com/token'?{access_token:'legacy-recovered',expires_in:3600}:{items:[]})});
 assert.equal((await invoke('list_calendars',{})).status,'success');assert.equal(calls,2);assert.equal(f.row.status,'active');assert.equal(f.marks,0);
});
test('a newer valid grant between operations in the same request is reused',async()=>{
 const f=await fixture();const used=[];
 const invoke=await f.session(async(url,init)=>{if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'first-access',expires_in:3600});used.push(new Headers(init.headers).get('Authorization'));return Response.json({items:[]})});
 assert.equal((await invoke('list_calendars',{})).status,'success');
 const saved=await unseal(key,'fixture-owner',f.row.tokens);f.row={...f.row,tokens:await seal(key,'fixture-owner',{...saved,accessToken:'newer-access'})};
 assert.equal((await invoke('list_calendars',{})).status,'success');assert.deepEqual(used,['Bearer first-access','Bearer newer-access']);assert.equal(f.marks,0);
});
test('opening the calendar on seven successive days renews access without consent',async t=>{
 let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 const f=await fixture();let refreshes=0;
 const request=async url=>url==='https://oauth2.googleapis.com/token'?(refreshes++,Response.json({access_token:'day-'+refreshes,expires_in:3600})):Response.json({items:[]});
 for(let day=0;day<7;day++){
  const a=await f.session(request),b=await f.session(request);
  const results=await Promise.all([a('list_calendars',{}),b('list_calendars',{})]);
  assert.ok(results.every(r=>r.status==='success'));assert.equal(f.row.status,'active');assert.equal(f.marks,0);
  assert.equal((await unseal(key,'fixture-owner',f.row.tokens)).refreshToken,'fixture-refresh');
  clock+=86400000;
 }
 assert.ok(refreshes>=7);
});

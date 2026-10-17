// Runs only with dummy local OAuth configuration; never follows Google's URL.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const session=login.headers.get('set-cookie').split(';')[0];const headers={Cookie:session,Origin:base,'Content-Type':'application/json'};
for(const path of ['/api/google-auth','/api/google-update?id='+crypto.randomUUID()])assert.equal((await fetch(base+path)).status,401);
for(const path of ['/api/google-auth/start','/api/google-auth/disconnect','/api/google-update']){
 assert.equal((await fetch(base+path,{method:'POST',headers:{Origin:base},body:'{}'})).status,401);
 assert.equal((await fetch(base+path,{method:'POST',headers:{Cookie:session,Origin:'https://other.test'},body:'{}'})).status,403);
}
const status=await(await fetch(base+'/api/google-auth',{headers})).json();assert.equal(status.configured,true,'Requires local dummy .dev.vars');assert.equal(status.connected,false);assert.ok(!JSON.stringify(status).includes('placeholder'));
const started=await fetch(base+'/api/google-auth/start',{method:'POST',headers,redirect:'manual'});assert.equal(started.status,303);const url=new URL(started.headers.get('location'));assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('client_id'),'local-test-client');assert.equal(url.searchParams.get('code_challenge_method'),'S256');const state=url.searchParams.get('state');const cookie=started.headers.get('set-cookie').split(';')[0];assert.match(started.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
const callback='/api/google-auth/callback?error=access_denied&state='+state;
const wrongCookie=await fetch(base+callback,{headers,redirect:'manual'});assert.equal(wrongCookie.headers.get('location'),'/?google_connection=invalid_state');
const cancelled=await fetch(base+callback,{headers:{...headers,Cookie:session+'; '+cookie},redirect:'manual'});assert.equal(cancelled.headers.get('location'),'/?google_connection=cancelled');
const reused=await fetch(base+callback,{headers:{...headers,Cookie:session+'; '+cookie},redirect:'manual'});assert.equal(reused.headers.get('location'),'/?google_connection=invalid_state');
const invalid=await fetch(base+'/api/google-update',{method:'POST',headers,body:'{}'});assert.equal(invalid.status,400);
const disconnect=await fetch(base+'/api/google-auth/disconnect',{method:'POST',headers,redirect:'manual'});assert.equal(disconnect.status,303);assert.equal(disconnect.headers.get('location'),'/?google_connection=disconnected');
console.log('PASS: conexão por usuário, Origin, estado vinculado ao navegador, PKCE, cancelamento, uso único do callback, validação e desconexão. Nenhuma autorização ou escrita externa executada.');

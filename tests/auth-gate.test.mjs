import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

// Exercise the actual server authentication helper with runtime bindings and
// platform-validated identity headers supplied by an isolated test adapter.
const runtime={env:{ORBITA_ALLOWED_EMAILS:'invited@example.test'},headers:new Headers()};
globalThis.__orbitaAuthTest=runtime;
const modules={
  'cloudflare:workers':'export const env=globalThis.__orbitaAuthTest.env;',
  'next/headers':'export async function headers(){return globalThis.__orbitaAuthTest.headers;}',
  'next/navigation':'export function redirect(path){throw new Error("REDIRECT:"+path)}',
};
registerHooks({resolve(specifier,context,next){return Object.hasOwn(modules,specifier)?{url:'data:text/javascript,'+encodeURIComponent(modules[specifier]),shortCircuit:true}:next(specifier,context)}});
const {getChatGPTUser,getChatGPTIdentity,requireChatGPTUser}=await import('../app/chatgpt-auth.ts');
const identify=email=>{runtime.headers=new Headers({'oai-authenticated-user-id':'fixture-user','oai-authenticated-user-email':email})};
test('invited identity is admitted with its original stable owner ID',async()=>{
  identify('INVITED@example.test');
  assert.equal((await getChatGPTUser()).userId,'fixture-user');
  assert.equal((await requireChatGPTUser('/google-connection')).email,'INVITED@example.test');
});
test('authenticated outsider is denied data and sent to the invitation screen',async()=>{
  identify('outsider@example.test');
  assert.ok(await getChatGPTIdentity());
  assert.equal(await getChatGPTUser(),null);
  await assert.rejects(requireChatGPTUser('/google-connection'),/REDIRECT:\/access-denied/);
});
test('missing allowlist locks calendar access rather than opening it',async()=>{
  identify('invited@example.test');
  delete runtime.env.ORBITA_ALLOWED_EMAILS;
  assert.equal(await getChatGPTUser(),null);
  runtime.env.ORBITA_ALLOWED_EMAILS='invited@example.test';
});
test('anonymous visitors must sign in and cannot use email without identity',async()=>{
  runtime.headers=new Headers({'oai-authenticated-user-email':'invited@example.test'});
  assert.equal(await getChatGPTUser(),null);
  await assert.rejects(requireChatGPTUser('/google-connection'),/REDIRECT:\/signin-with-chatgpt\?return_to=%2Fgoogle-connection/);
});

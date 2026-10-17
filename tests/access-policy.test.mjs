import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedEmail} from '../lib/access-policy.mts';
test('access fails closed without an explicit allowlist and authenticated email',()=>{
  for(const list of [undefined,null,'','  ',42]) assert.equal(isAllowedEmail('person@example.test',list),false);
  for(const email of [undefined,null,'',' ',42]) assert.equal(isAllowedEmail(email,'person@example.test'),false);
});
test('only exact approved email addresses are accepted, ignoring case and whitespace',()=>{
  const list=' Person@Example.test , second@example.test;third@example.test\nfourth@example.test';
  for(const email of ['person@example.test','SECOND@example.test','third@example.test',' fourth@example.test ']) assert.equal(isAllowedEmail(email,list),true);
  for(const email of ['outsider@example.test','person@example.test.attacker.test','xperson@example.test','person+alias@example.test','@example.test']) assert.equal(isAllowedEmail(email,list),false);
});

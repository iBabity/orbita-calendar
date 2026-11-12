import {env} from 'cloudflare:workers';
import {and,eq,or} from 'drizzle-orm';
import {getDb} from '@/db';
import {googleConnections} from '@/db/schema';
import {googleConfig} from './google-oauth.mjs';
import {createGoogleSession} from './google-session.mjs';
import type {GoogleAction} from './google-rest.mjs';
import type {ConnectorResult,Json} from './connector-contract.mjs';
export function getGoogleConfig(){return googleConfig(env as unknown as Record<string,unknown>)}
export async function googleReconnectPath(owner:string,fallback:string){const [row]=await getDb().select({owner:googleConnections.owner}).from(googleConnections).where(eq(googleConnections.owner,owner));return row?'/google-connection':fallback}
export async function googleConnectionStatus(owner:string){
 const [row]=await getDb().select({email:googleConnections.email,status:googleConnections.status}).from(googleConnections).where(eq(googleConnections.owner,owner));
 const configured=!!getGoogleConfig();return {configured,connected:configured&&!!row&&row.status==='active',email:row?.email||'',needsReconnect:row?.status==='reconnect'};
}
/** Request-scoped selection; no automatic fallback to a different account or
 * provider after a direct connection fails. Tokens stay entirely server-side. */
export async function googleForRequest(owner:string,recoverNow=false){
 const db=getDb();const [row]=await db.select().from(googleConnections).where(eq(googleConnections.owner,owner));
 if(!row)return {direct:true,invoke:async():Promise<ConnectorResult>=>({status:'reauthentication_required',message:'Conecte sua própria conta Google para acessar suas agendas.'})};
 const config=getGoogleConfig();
 if(!config)return {direct:true,invoke:async():Promise<ConnectorResult>=>({status:'binding_unavailable',message:'A configuração Google do servidor está indisponível. Sua autorização foi preservada.'})};
 // Repair legacy false reconnect flags using the saved grant. Real invalid
 // grants have a cooldown so background refresh does not keep calling Google.
 if(row.status!=='active'&&!(row.status==='reconnect'&&(recoverNow||row.updatedAt<Date.now()-300000)))return {direct:true,invoke:async():Promise<ConnectorResult>=>({status:'reauthentication_required',message:'O Google revogou ou expirou a autorização. Reconecte sua conta para continuar.'})};
 const invoke=await createGoogleSession(config,owner,row,{
  async read(){const [current]=await db.select().from(googleConnections).where(eq(googleConnections.owner,owner));return current},
  async replaceTokens(previous,next){const changed=await db.update(googleConnections).set({tokens:next,status:'active',updatedAt:Date.now()}).where(and(eq(googleConnections.owner,owner),eq(googleConnections.subject,row.subject),eq(googleConnections.tokens,previous),or(eq(googleConnections.status,'active'),eq(googleConnections.status,'reconnect')))).returning({owner:googleConnections.owner});return changed.length>0},
  async markReconnect(previous){await db.update(googleConnections).set({status:'reconnect',updatedAt:Date.now()}).where(and(eq(googleConnections.owner,owner),eq(googleConnections.subject,row.subject),eq(googleConnections.tokens,previous)))}
 });
 return {direct:true,invoke};
}

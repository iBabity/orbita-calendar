import {env} from 'cloudflare:workers';
import {and,eq} from 'drizzle-orm';
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
export async function googleForRequest(owner:string){
 const db=getDb();const [row]=await db.select().from(googleConnections).where(eq(googleConnections.owner,owner));
 if(!row)return {direct:true,invoke:async():Promise<ConnectorResult>=>({status:'reauthentication_required',message:'Conecte sua própria conta Google para acessar suas agendas.'})};
 const config=getGoogleConfig();
 if(!config||row.status!=='active')return {direct:true,invoke:async():Promise<ConnectorResult>=>({status:'reauthentication_required',message:'Reconecte a conexão direta do Google no menu da agenda.'})};
 const invoke=await createGoogleSession(config,owner,row,{
  async read(){const [current]=await db.select().from(googleConnections).where(eq(googleConnections.owner,owner));return current},
  async replaceTokens(previous,next){const changed=await db.update(googleConnections).set({tokens:next,updatedAt:Date.now()}).where(and(eq(googleConnections.owner,owner),eq(googleConnections.tokens,previous),eq(googleConnections.status,'active'))).returning({owner:googleConnections.owner});return changed.length>0},
  async markReconnect(previous){await db.update(googleConnections).set({status:'reconnect'}).where(and(eq(googleConnections.owner,owner),eq(googleConnections.tokens,previous)))}
 });
 return {direct:true,invoke};
}

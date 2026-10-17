import {getChatGPTUser,chatGPTSignInPath} from '../../chatgpt-auth';
import {googleConnectionStatus} from '@/lib/google-client';
import {getGoogleConfig} from '@/lib/google-client';
import {tokenRequest} from '@/lib/google-oauth.mjs';
export async function GET(){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Entre para conectar sua agenda.',signin:chatGPTSignInPath('/')},{status:401,headers:{'Cache-Control':'private, no-store'}});
 try{return Response.json(await googleConnectionStatus(user.userId),{headers:{'Cache-Control':'private, no-store'}})}catch{return Response.json({error:'Não foi possível conferir a conexão.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}
}
// A failed exchange with a dummy code checks server connectivity/configuration.
// It cannot grant access, change events or replace the visitor's saved connection.
export async function POST(req:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403,headers});
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Entre para conferir a conexão.'},{status:401,headers});
 const config=getGoogleConfig();if(!config)return Response.json({reason:'not_configured'},{status:503,headers});
 const result=await tokenRequest(config,{grant_type:'authorization_code',code:'orbita-diagnostic-invalid-code',redirect_uri:config.redirectUri,code_verifier:'orbita-diagnostic-invalid-verifier'});
 return Response.json({reason:result.ok?'unexpected_response':result.reason},{headers});
}

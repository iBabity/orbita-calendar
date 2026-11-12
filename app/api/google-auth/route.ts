import {getChatGPTUser,chatGPTSignInPath} from '../../chatgpt-auth';
import {googleConnectionStatus} from '@/lib/google-client';
import {getGoogleConfig} from '@/lib/google-client';
import {googleForRequest} from '@/lib/google-client';
export async function GET(){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Entre para conectar sua agenda.',signin:chatGPTSignInPath('/')},{status:401,headers:{'Cache-Control':'private, no-store'}});
 try{return Response.json(await googleConnectionStatus(user.userId),{headers:{'Cache-Control':'private, no-store'}})}catch{return Response.json({error:'Não foi possível conferir a conexão.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}
}
// Verify the user's saved grant with a read-only call and attempt renewal before
// asking for consent again. Never create or modify calendar events here.
export async function POST(req:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403,headers});
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Entre para conferir a conexão.'},{status:401,headers});
 const config=getGoogleConfig();if(!config)return Response.json({reason:'not_configured'},{status:503,headers});
 try{
  const client=await googleForRequest(user.userId,true);const result=await client.invoke('list_calendars',{});
  const status=await googleConnectionStatus(user.userId);
  return Response.json({...status,message:result.status==='success'?'Conexão Google ativa. A renovação acontece automaticamente.':result.message,status:result.status},{headers});
 }catch{return Response.json({message:'Não foi possível verificar agora. Sua conexão salva foi preservada.'},{status:503,headers})}
}

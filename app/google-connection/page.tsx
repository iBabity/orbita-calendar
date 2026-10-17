import {requireChatGPTUser} from '../chatgpt-auth';
import {googleConnectionStatus} from '@/lib/google-client';
export const dynamic='force-dynamic';
export default async function ConnectGoogle(){
 const user=await requireChatGPTUser('/google-connection');const status=await googleConnectionStatus(user.userId);
 return <main className="google-connect-page"><section className="event-modal"><span className="eyebrow">ÓRBITA CALENDAR</span><h1>Conectar sua agenda Google</h1>{status.email&&<p>Conta atual: <strong>{status.email}</strong></p>}<p>Você escolhe a conta e autoriza o Órbita na próxima tela do Google.</p><p>O aplicativo poderá consultar suas agendas e criar, editar ou excluir eventos nas agendas em que você já tem permissão. Você também poderá criar links do Google Meet.</p>{status.configured?<form method="post" action="/api/google-auth/start"><button className="save-button" type="submit">Continuar no Google</button></form>:<p role="status">A conexão direta ainda está sendo configurada. Sua integração atual continua disponível.</p>}<a className="training-connect" href="/">Voltar ao calendário</a></section></main>;
}

import PublicLayout from '../public-layout';
import {chatGPTSignOutPath} from '../chatgpt-auth';
import {SUPPORT_EMAIL} from '@/lib/site-info';
export const dynamic = 'force-dynamic';
export default function AccessDenied(){return <PublicLayout><span className="eyebrow">ACESSO POR CONVITE</span><h1>O calendário está disponível para pessoas autorizadas.</h1><p className="public-lead">A apresentação do Órbita é pública. Para usar as agendas, entre com o e-mail que recebeu autorização.</p><p>Se você já foi autorizado, confira se entrou com a conta correta. Cada pessoa tem suas próprias agendas e conecta sua própria conta Google.</p><div className="public-actions"><a className="save-button" href={chatGPTSignOutPath('/')} target="_top">Sair e trocar de conta</a><a href={'mailto:'+SUPPORT_EMAIL}>Solicitar acesso</a></div></PublicLayout>}

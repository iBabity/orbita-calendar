import type { Metadata } from 'next';
import './globals.css';
import AppearanceProvider from './appearance';
export const metadata: Metadata = { title:'Órbita Calendar', description:'Sua agenda, no seu ritmo.', manifest:'/manifest.webmanifest', icons:{icon:'/favicon.svg',apple:'/icon-192.png'}, appleWebApp:{capable:true,title:'Órbita',statusBarStyle:'default'} };
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="pt-BR"><body><AppearanceProvider>{children}</AppearanceProvider></body></html>}

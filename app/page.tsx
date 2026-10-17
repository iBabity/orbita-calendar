import Calendar from './calendar';
import About from './about/page';
import {getChatGPTIdentity,canUseCalendar} from './chatgpt-auth';
import AccessDenied from './access-denied/page';
export const dynamic = 'force-dynamic';
export default async function Home() { const user=await getChatGPTIdentity();return user?(canUseCalendar(user)?<Calendar/>:<AccessDenied/>):<About/>; }

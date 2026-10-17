import Calendar from './calendar';
import About from './about/page';
import {getChatGPTUser} from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() { return await getChatGPTUser()?<Calendar/>:<About/>; }

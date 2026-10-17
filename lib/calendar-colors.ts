import {eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {calendarColors} from '@/db/schema';
export async function userCalendarColors(owner:string){
 const rows=await getDb().select({id:calendarColors.id,color:calendarColors.color,version:calendarColors.version}).from(calendarColors).where(eq(calendarColors.owner,owner));
 return Object.fromEntries(rows.map(row=>[row.id,{color:row.color,version:row.version}]));
}

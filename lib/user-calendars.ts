import {eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {calendarNames,calendarStates} from '@/db/schema';
import {calendars} from './calendar';
export async function userCalendars(owner:string,includeDeleted=false){
 const db=getDb();const [saved,states]=await Promise.all([db.select().from(calendarNames).where(eq(calendarNames.owner,owner)),db.select().from(calendarStates).where(eq(calendarStates.owner,owner))]);
 return calendars.map(c=>{const row=saved.find(r=>r.id===c.id),state=states.find(r=>r.id===c.id);return {...c,...(row?{name:row.name,version:row.version}:{}),deleted:state?.deleted||false,deletionVersion:state?.version||0}}).filter(c=>includeDeleted||!c.deleted);
}

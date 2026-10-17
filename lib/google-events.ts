import type {Event} from './calendar';
import {readContactDescription} from './brazil-time.mjs';
import {googleMeetDetails} from './google-meet.mjs';
export type GoogleCalendar={id:string;summary:string;background_color?:string;access_role?:string;accessRole?:string};
/** The connector returns ISO strings; Google REST also uses date/dateTime objects. */
export function normalizeGoogleEvent(raw:any,cal:GoogleCalendar):Event|null{
 if(!raw||raw.status==='cancelled')return null;
 const startValue=raw.start;const endValue=raw.end;
 const s=typeof startValue==='string'?startValue:startValue?.dateTime||startValue?.date_time||startValue?.date||raw.start_time;
 const e=typeof endValue==='string'?endValue:endValue?.dateTime||endValue?.date_time||endValue?.date||raw.end_time;
 if(typeof s!=='string'||typeof e!=='string'||!raw.id)return null;
 const dateOnly=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v);
 const allDay=dateOnly(s);
 const start=new Date(allDay?s+'T00:00:00':s);
 const end=new Date(dateOnly(e)?e+'T00:00:00':e);
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||+end<=+start)return null;
 const role=cal.access_role||cal.accessRole;
 return {id:'google:'+cal.id+':'+raw.id,googleEventId:String(raw.id),googleEtag:typeof raw.etag==='string'?raw.etag:undefined,...(allDay?{googleStartDate:s,googleEndDate:e}:{}),canDelete:role?['owner','writer'].includes(role):undefined,recurringSeries:Array.isArray(raw.recurrence)&&raw.recurrence.length>0,title:raw.summary||raw.title||'Sem título',start:start.toISOString(),end:end.toISOString(),calendar:cal.id,allDay,...readContactDescription(typeof raw.description==='string'?raw.description:''),timezone:startValue?.timeZone||startValue?.time_zone||undefined,location:typeof raw.location==='string'?raw.location:'',version:0,external:true,url:raw.htmlLink||raw.html_link||raw.url,...googleMeetDetails(raw)};
}

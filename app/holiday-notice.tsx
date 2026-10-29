import {closedHoliday,holidayOnDate,holidayMessage,type Schedule} from '@/lib/holidays.mts';
import {wallToIso} from '@/lib/brazil-time.mjs';
export function fieldHoliday(v:{start:string;end:string;timezone:string;allDay:boolean},previous?:Schedule){
 try{return closedHoliday({start:wallToIso(v.start,v.timezone),end:wallToIso(v.end,v.timezone),timezone:v.timezone,allDay:v.allDay,...(v.allDay?{startDate:v.start.slice(0,10),endDate:v.end.slice(0,10)}:{})},previous)}catch{return undefined}
}
export function HolidayBadge({date}:{date:string}){const holiday=holidayOnDate(date);return holiday?<span className="holiday-badge" title={`${holiday.scope} · Campinas/SP · ${holiday.name}`}><strong>Dia fechado</strong><span>{holiday.name}</span></span>:null}
export function HolidayNotice({value}:{value:{start:string;end:string;timezone:string;allDay:boolean}}){const holiday=fieldHoliday(value);return holiday?<p className="holiday-notice" role="status">{holidayMessage(holiday)} Compromissos já existentes são mantidos.</p>:null}

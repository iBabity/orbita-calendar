import type {Event} from './calendar';
export function eventDestination(event:Event){return (event.external?'google:':'local:')+event.calendar}
export function duplicateEvent(event:Event,id:string):Event{
 return {id,title:event.title.slice(0,192)+' (cópia)',start:event.start,end:event.end,calendar:event.calendar,description:event.description,location:event.location,allDay:event.allDay,version:0,contactName:event.contactName||'',companyName:event.companyName||'',phone:event.phone||'',timezone:event.timezone,timezoneConfirmed:event.timezoneConfirmed,googleStartDate:event.googleStartDate,googleEndDate:event.googleEndDate};
}

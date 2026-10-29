export const HOLIDAY_LOCATION = 'Campinas/SP';
export const HOLIDAY_TIMEZONE = 'America/Sao_Paulo';
export type Holiday = {date:string;name:string;scope:'Nacional'|'Estadual'|'Municipal'};
export type Schedule = {start:string;end:string;allDay?:boolean;timezone?:string;startDate?:string;endDate?:string};
const cache=new Map<number,Holiday[]>();
const dateKey=(d:Date)=>d.toISOString().slice(0,10);
function easter(year:number){
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
 return new Date(Date.UTC(year,month-1,day));
}
// Recurring holidays established by law, checked against Campinas Decree
// 24.240/2026. Points facultativos and proposed holidays are not included.
export function holidaysForYear(year:number):Holiday[]{
 if(cache.has(year))return cache.get(year)!;
 if(!Number.isInteger(year)||year<1900||year>9999)return [];
 const result:Holiday[]=[];
 const add=(date:string,name:string,scope:Holiday['scope'])=>result.push({date,name,scope});
 for(const [date,name] of [['01-01','Confraternização Universal'],['04-21','Tiradentes'],['05-01','Dia do Trabalho'],['09-07','Independência do Brasil'],['10-12','Nossa Senhora Aparecida'],['11-02','Finados'],['11-15','Proclamação da República'],['12-25','Natal']])add(`${year}-${date}`,name,'Nacional');
 if(year>=2024)add(`${year}-11-20`,'Dia Nacional de Zumbi e da Consciência Negra','Nacional');
 if(year>=1997)add(`${year}-07-09`,'Revolução Constitucionalista','Estadual');
 const sunday=easter(year);
 for(const [offset,name] of [[-2,'Paixão de Cristo'],[60,'Corpus Christi']] as const){const d=new Date(sunday);d.setUTCDate(d.getUTCDate()+offset);add(dateKey(d),name,'Municipal')}
 if(year>=2026)add(`${year}-08-12`,'Dia do Evangélico','Municipal');
 add(`${year}-12-08`,'Nossa Senhora da Conceição','Municipal');
 result.sort((a,b)=>a.date.localeCompare(b.date));
 cache.set(year,result);return result;
}
export function holidayOnDate(date:string):Holiday|undefined{return holidaysForYear(Number(date.slice(0,4))).find(h=>h.date===date)}
function zonedDate(iso:string,zone=HOLIDAY_TIMEZONE){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso))}
function allDayDates(s:Schedule){return {start:s.startDate||zonedDate(s.start,s.timezone||HOLIDAY_TIMEZONE),end:s.endDate||zonedDate(s.end,s.timezone||HOLIDAY_TIMEZONE)}}
export function sameSchedule(a:Schedule,b:Schedule):boolean{
 if(!!a.allDay!==!!b.allDay)return false;
 if(a.allDay){const x=allDayDates(a),y=allDayDates(b);return x.start===y.start&&x.end===y.end}
 return Date.parse(a.start)===Date.parse(b.start)&&Date.parse(a.end)===Date.parse(b.end);
}
export function closedHoliday(schedule:Schedule,previous?:Schedule):Holiday|undefined{
 if(!Number.isFinite(Date.parse(schedule.start))||!Number.isFinite(Date.parse(schedule.end))||Date.parse(schedule.end)<=Date.parse(schedule.start))return;
 if(previous&&sameSchedule(schedule,previous))return;
 const dates=schedule.allDay?allDayDates(schedule):{start:zonedDate(schedule.start),end:zonedDate(new Date(Date.parse(schedule.end)-1).toISOString())};
 for(let year=Number(dates.start.slice(0,4));year<=Number(dates.end.slice(0,4));year++){
  const found=holidaysForYear(year).find(h=>h.date>=dates.start&&(schedule.allDay?h.date<dates.end:h.date<=dates.end));if(found)return found;
 }
}
export function holidayMessage(holiday:Holiday){return `Dia fechado em ${HOLIDAY_LOCATION}: ${holiday.name} (${holiday.date.split('-').reverse().join('/')}). Escolha um período sem feriados.`}

import test from 'node:test';
import assert from 'node:assert/strict';
import {holidaysForYear,holidayOnDate,closedHoliday} from '../lib/holidays.mts';
const timed=(start,end)=>({start,end,allDay:false});
test('Campinas official 2026 dates, including state and movable municipal holidays',()=>{
 assert.deepEqual(holidaysForYear(2026).map(h=>h.date),['2026-01-01','2026-04-03','2026-04-21','2026-05-01','2026-06-04','2026-07-09','2026-08-12','2026-09-07','2026-10-12','2026-11-02','2026-11-15','2026-11-20','2026-12-08','2026-12-25']);
 assert.equal(holidayOnDate('2026-07-09').scope,'Estadual');
 for(const date of ['2026-02-16','2026-02-17','2026-04-20','2026-07-14','2026-10-28','2026-12-07'])assert.equal(holidayOnDate(date),undefined);
 assert.ok(holidayOnDate('2027-03-26'));assert.ok(holidayOnDate('2027-05-27'));
});
test('timed intervals use Campinas time, include overnight intersections and exclude the end instant',()=>{
 assert.equal(closedHoliday(timed('2026-11-02T01:00:00Z','2026-11-02T02:00:00Z')),undefined);
 assert.equal(closedHoliday(timed('2026-11-02T02:00:00Z','2026-11-02T03:00:00Z')),undefined);
 assert.equal(closedHoliday(timed('2026-11-02T02:00:00Z','2026-11-02T03:01:00Z')).name,'Finados');
 assert.equal(closedHoliday(timed('2026-11-02T12:00:00Z','2026-11-02T13:00:00Z')).date,'2026-11-02');
 assert.equal(closedHoliday(timed('2026-12-31T22:00:00Z','2027-01-01T13:00:00Z')).date,'2027-01-01');
});
test('all-day events use calendar dates and exclusive end, regardless of contact timezone',()=>{
 const allDay={start:'2026-11-01T04:00:00Z',end:'2026-11-02T04:00:00Z',timezone:'America/Manaus',allDay:true,startDate:'2026-11-01',endDate:'2026-11-02'};
 assert.equal(closedHoliday(allDay),undefined);
 assert.equal(closedHoliday({...allDay,end:'2026-11-03T04:00:00Z',endDate:'2026-11-03'}).date,'2026-11-02');
});
test('existing holiday event can retain its schedule; duplicating or rescheduling into it is blocked',()=>{
 const existing=timed('2026-11-02T12:00:00Z','2026-11-02T13:00:00Z');
 assert.equal(closedHoliday({...existing,title:'Updated contact'},existing),undefined);
 assert.ok(closedHoliday(existing));
 assert.ok(closedHoliday({...existing,end:'2026-11-02T14:00:00Z'},existing));
 assert.equal(closedHoliday(timed('2026-11-03T12:00:00Z','2026-11-03T13:00:00Z'),existing),undefined);
});

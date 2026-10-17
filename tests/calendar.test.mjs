import test from 'node:test';
import assert from 'node:assert/strict';
import {weekStart,addDays,dayKey,rangeFor,inputDate} from '../lib/calendar.ts';
test('domingo pertence à semana iniciada na segunda anterior',()=>{assert.equal(dayKey(weekStart(new Date(2026,9,18))),'2026-10-12')});
test('semana cruza ano sem perder os dias',()=>{const [s,e]=rangeFor(new Date(2026,11,31),'week');assert.equal(dayKey(s),'2026-12-28');assert.equal(dayKey(e),'2027-01-04')});
test('mês tem 42 células e inclui o começo do mês',()=>{const [s,e]=rangeFor(new Date(2026,9,15),'month');assert.equal(dayKey(s),'2026-09-28');assert.equal(dayKey(e),'2026-11-09')});
test('dia e navegação preservam calendário em ano bissexto',()=>{assert.equal(dayKey(addDays(new Date(2028,1,28),1)),'2028-02-29');const [s,e]=rangeFor(new Date(2028,1,29,13),'day');assert.equal(dayKey(e),'2028-03-01');assert.equal(s.getHours(),0)});
test('editor apresenta hora local correspondente ao instante salvo',()=>{const d=new Date(2026,9,15,14,45);assert.equal(inputDate(d.toISOString()),'2026-10-15T14:45')});

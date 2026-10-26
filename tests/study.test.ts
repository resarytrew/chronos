import {test} from "node:test";
import assert from "node:assert/strict";
import {buildStudyPlan,orderStudyItems} from "../src/lib/utils";
import {DEFAULT_SETTINGS,type EventItem} from "../src/lib/types";
const events:EventItem[]=[
  {id:"late",dateText:"17 октября 1905",title:"Манифест",yearSort:1905,era:null},
  {id:"old",dateText:"988 г.",title:"Крещение Руси",yearSort:988,era:null},
  {id:"early",dateText:"9 января 1905",title:"Кровавое воскресенье",yearSort:1905,era:null},
];
test("date study starts chronologically with hidden dates and preserves dictation settings",()=>{
  const settings={...DEFAULT_SETTINGS,direction:"date-to-event" as const,shuffle:true};
  const original=structuredClone({events,settings});
  const plan=buildStudyPlan({scenarioId:"s",title:"Изучение",events,settings,selection:{type:"all"}},"chronological");
  assert.deepEqual(plan.items.map(it=>it.id),["old","early","late"]);
  assert.ok(plan.items.every(it=>it.ask==="date"));
  assert.equal(plan.items[0].dateText,"988 г.");
  assert.deepEqual({events,settings},original);
});
test("shuffled study cannot keep the same order and still honors the date selection",()=>{
  const plan=buildStudyPlan({scenarioId:"s",title:"Выборка",events,settings:DEFAULT_SETTINGS,selection:{type:"range",from:1905,to:1905}},"chronological");
  assert.deepEqual(plan.items.map(it=>it.id),["early","late"]);
  for(let i=0;i<20;i++)assert.notDeepEqual(orderStudyItems(plan.items,"shuffled").map(it=>it.id),["early","late"]);
  assert.deepEqual(orderStudyItems([],"shuffled"),[]);
  assert.equal(orderStudyItems(plan.items.slice(0,1),"shuffled").length,1);
});

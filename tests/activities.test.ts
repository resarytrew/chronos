import {test} from "node:test";
import assert from "node:assert/strict";
import {initialOrder,newTask,taskError,scenarioPlan} from "../src/lib/activities";
import {DEFAULT_SETTINGS} from "../src/lib/types";
test("sequence validation and shuffled order never disclose the teacher order initially",()=>{
  const t=newTask("sequence");assert.equal(t.type,"sequence");if(t.type!=="sequence")return;
  assert.ok(taskError(t));
  t.cards.forEach((c,i)=>c.text="Карточка "+i);
  assert.equal(taskError(t),null);
  for(let i=0;i<20;i++)assert.notDeepEqual(initialOrder(t),t.cards.map(c=>c.id));
  const plan=scenarioPlan({id:"s",title:"Урок",kind:"user",description:null,createdAt:"",updatedAt:"",settings:DEFAULT_SETTINGS,events:[],activityType:"sequence",tasks:[t]});
  t.cards[0].text="Изменено";
  assert.notEqual(plan.items[0].task?.type==="sequence"&&plan.items[0].task.cards[0].text,"Изменено");
  assert.equal(plan.settings.mode,"manual");
});

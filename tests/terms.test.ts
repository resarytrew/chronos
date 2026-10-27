import "fake-indexeddb/auto";
import {test} from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_SETTINGS,type ScenarioFull} from "../src/lib/types";
import {buildTermsPlan,buildTermsStudyPlan,parseTerms} from "../src/lib/terms";
import {questionText,answerText,orderStudyItems} from "../src/lib/utils";
import {storage} from "../src/lib/storage";
import {taskError} from "../src/lib/activities";
const tasks=parseTerms("Вече\tНародное собрание.\nПолюдье — Сбор дани.\nЛетопись\tЗапись событий по годам.");
const scenario:ScenarioFull={id:"terms-source",title:"Понятия",kind:"user",activityType:"terms",description:null,settings:{...DEFAULT_SETTINGS,direction:"term-to-definition"},tasks,events:[],createdAt:"",updatedAt:""};
test("term dictation supports both directions and mixed prompts without treating definitions as dates",()=>{
  const direct=buildTermsPlan(scenario);
  assert.equal(questionText(direct.items[0]),"Вече");assert.equal(answerText(direct.items[0]),"Народное собрание.");
  assert.equal(direct.items[0].dateText,"");assert.equal(direct.settings.mode,"auto");
  const reverse=buildTermsPlan({...scenario,settings:{...scenario.settings,direction:"definition-to-term"}});
  assert.equal(questionText(reverse.items[0]),"Народное собрание.");assert.equal(answerText(reverse.items[0]),"Вече");
  const mixed=buildTermsPlan({...scenario,settings:{...scenario.settings,direction:"mixed"}});
  assert.ok(mixed.items.some(it=>it.ask==="term"));assert.ok(mixed.items.some(it=>it.ask==="definition"));
  tasks[0].answer="Изменено";assert.equal(answerText(direct.items[0]),"Народное собрание.");tasks[0].answer="Народное собрание.";
});
test("term study always puts concepts first and restores editor order after shuffling",()=>{
  const original=structuredClone(scenario);
  const plan=buildTermsStudyPlan({...scenario,settings:{...scenario.settings,direction:"definition-to-term"}},"shuffled");
  assert.deepEqual(orderStudyItems(plan.items,"sequential").map(questionText),["Вече","Полюдье","Летопись"]);
  assert.ok(plan.items.every(it=>it.ask==="definition"));assert.equal(plan.settings.mode,"manual");
  assert.deepEqual(scenario,original);
});
test("term paste preserves definitions with dashes and keeps incomplete pairs editable",()=>{
  const parsed=parseTerms("Монархия — Форма правления — дополнительное пояснение.\nПонятие без определения\n\tТолько определение");
  assert.equal(parsed[0].answer,"Форма правления — дополнительное пояснение.");
  assert.equal(parsed[1].answer,"");assert.equal(parsed[2].prompt,"");assert.ok(taskError(parsed[1]));
  assert.throws(()=>buildTermsPlan({...scenario,tasks:[parsed[1]]}));
});
test("term package and full backup round trip preserve tasks, direction, history and checkpoint",async()=>{
  const s=await storage.createScenario({...scenario,title:"Перенос понятий"});
  const plan=buildTermsPlan({...s,settings:{...s.settings,direction:"definition-to-term"}});
  await storage.createSession({scenarioId:s.id,scenarioTitle:s.title,items:plan.items,direction:plan.settings.direction,mode:"auto",intervalSec:7,durationSec:10,startedAt:new Date().toISOString()});
  await storage.saveActiveRun({id:"current",plan,index:1,mode:"auto",elapsedMs:7000,questionMs:0,startedAt:new Date().toISOString()});
  const pkg=await storage.exportPackage([s.id]);assert.equal(pkg.version,4);
  await storage.importAll(pkg,"merge");
  const backup=await storage.exportAll();assert.equal(storage.inspectTransfer(backup).version,4);
  await storage.importAll(backup,"replace");
  assert.equal((await storage.getActiveRun())?.plan.items[0].ask,"term");
  assert.equal(questionText((await storage.listSessions())[0].items[0]),"Народное собрание.");
  assert.equal((await storage.listScenariosFull()).filter(x=>x.activityType==="terms").length,2);
});

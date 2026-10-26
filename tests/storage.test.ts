import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage } from "../src/lib/storage";
import { DEFAULT_SETTINGS } from "../src/lib/types";

test("completed history atomically replaces the recovery checkpoint", async () => {
  const scenario = await storage.createScenario({ title: "Тест", events: [{ dateText: "988", title: "Крещение Руси" }] });
  const items = [{ ...scenario.events[0], ask: "date" as const }];
  await storage.saveActiveRun({ id: "current", plan: { scenarioId: scenario.id, title: scenario.title, items, settings: DEFAULT_SETTINGS }, index: 0, mode: "manual", elapsedMs: 2000, questionMs: 1000, startedAt: new Date().toISOString() });
  assert.equal((await storage.getActiveRun())?.index, 0);
  const session = await storage.createSession({ scenarioId: scenario.id, scenarioTitle: scenario.title, items, mode: "manual", direction: "event-to-date", intervalSec: 7, durationSec: 2, startedAt: new Date().toISOString(), status: "interrupted", shownCount: 1 });
  assert.equal(session.status, "interrupted");
  assert.equal(await storage.getActiveRun(), undefined);
  await storage.updateScenario(scenario.id, { title: "Изменено", events: [] });
  assert.equal((await storage.listSessions()).find(s => s.id === session.id)?.items.length, 1);
});

test("unknown backup version is rejected before replacing existing data", async () => {
  const before = await storage.listScenarios();
  await assert.rejects(storage.importAll({ format: "chronos-backup", version: 99, scenarios: [], sessions: [] }, "replace"));
  assert.deepEqual(await storage.listScenarios(), before);
});

test("portable package preserves media and legacy imports; damaged replacement is atomic", async () => {
  const image={id:"test-image",dataUrl:"data:image/png;base64,aGVsbG8="};
  await storage.putImage(image);
  const s=await storage.createScenario({title:"Портрет",activityType:"image",className:"7А",section:"Россия",tasks:[{id:"task-image",type:"image",prompt:"Кто изображён?",answer:"Пётр I",imageId:image.id,alt:"Портрет"}]});
  const file=await storage.exportPackage([s.id]);
  assert.equal(file.images.length,1);
  const count=(await storage.listScenarios()).length;
  await assert.rejects(storage.importAll({...file,images:[]},"replace"));
  assert.equal((await storage.listScenarios()).length,count);
  await storage.importAll(file,"merge");
  assert.equal((await storage.listScenarios()).filter(x=>x.title==="Портрет").length,2);
  await storage.importAll([{title:"Старый формат",events:[{date:"1380 г.",title:"Куликовская битва"}]}],"merge");
  const legacy=(await storage.listScenariosFull()).find(x=>x.title==="Старый формат");
  assert.equal(legacy?.events[0].dateText,"1380 г.");
  assert.equal(legacy?.activityType,"dictation");
});

test("image collection keeps assets referenced by history and removes only unused ones",async()=>{
  await storage.putImage({id:"history-asset",dataUrl:"data:image/png;base64,aGVsbG8="});
  const task={id:"image-task",type:"image" as const,prompt:"Вопрос",answer:"Ответ",imageId:"history-asset",alt:"Карта"};
  const session=await storage.createSession({scenarioId:null,scenarioTitle:"История",items:[{id:task.id,title:task.prompt,dateText:task.answer,ask:"date",era:null,task}],mode:"manual",direction:"event-to-date",intervalSec:7,durationSec:5,startedAt:new Date().toISOString()});
  await storage.collectUnusedImages();
  assert.ok(await storage.getImage("history-asset"));
  await storage.deleteSession(session.id);
  await storage.collectUnusedImages();
  assert.equal(await storage.getImage("history-asset"),undefined);
});

test("full backup merge remaps scenario and image collisions consistently",async()=>{
  const image={id:"colliding",dataUrl:"data:image/png;base64,aGVsbG8="};
  await storage.putImage(image);
  const task={id:"task-collision",type:"image" as const,prompt:"Портрет",answer:"Пётр",imageId:image.id,alt:"Портрет"};
  const scenario=await storage.createScenario({title:"Связи копии",activityType:"image",tasks:[task]});
  await storage.createSession({scenarioId:scenario.id,scenarioTitle:scenario.title,items:[{id:task.id,title:task.prompt,dateText:task.answer,era:null,ask:"date",task}],direction:"event-to-date",mode:"manual",intervalSec:7,durationSec:5,startedAt:new Date().toISOString()});
  const backup=await storage.exportAll();
  await storage.putImage({...image,dataUrl:"data:image/png;base64,YWJj"});
  await storage.importAll(backup,"merge");
  const copy=(await storage.listScenariosFull()).find(s=>s.title===scenario.title&&s.id!==scenario.id)!;
  const session=(await storage.listSessions()).find(s=>s.scenarioId===copy.id)!;
  assert.ok(copy);assert.ok(session);
  assert.equal(copy.tasks?.[0].type==="image"&&copy.tasks[0].imageId,session.items[0].task?.type==="image"&&session.items[0].task.imageId);
  const imageId=copy.tasks?.[0].type==="image"?copy.tasks[0].imageId:"";
  assert.notEqual(imageId,image.id);
  assert.equal((await storage.getImage(imageId))?.dataUrl,image.dataUrl);
});

import "fake-indexeddb/auto";
import {test} from "node:test";
import assert from "node:assert/strict";
import {storage} from "../src/lib/storage";
import {DEFAULT_SETTINGS,type Direction} from "../src/lib/types";
import {buildRunPlan,buildStudyPlan,itemsToText} from "../src/lib/utils";
import {buildTermsPlan,buildTermsStudyPlan} from "../src/lib/terms";
import {printWorksheet} from "../src/lib/client";

const image={id:"dictation-image",dataUrl:"data:image/png;base64,aGVsbG8="};
const illustration={imageId:image.id,alt:"Учебная схема",source:"https://example.com/map"};

test("both dictations snapshot image choices in all directions and study",async()=>{
  const s=await storage.createScenario({title:"Дата с картой",events:[{dateText:"988",title:"Крещение Руси",illustration,questionDisplay:"image"}]});
  for(const direction of ["event-to-date","date-to-event","mixed"] as Direction[]) {
    const p=buildRunPlan({scenarioId:s.id,title:s.title,events:s.events,settings:{...DEFAULT_SETTINGS,direction},selection:{type:"all"}});
    assert.equal(p.items[0].questionDisplay,"image");
    assert.deepEqual(p.items[0].illustration,illustration);
    p.items[0].illustration!.alt="Изменено";
    assert.equal(s.events[0].illustration!.alt,illustration.alt);
    assert.equal(itemsToText(p.items,false),"1. [Изображение]");
  }
  assert.equal(buildStudyPlan({scenarioId:s.id,title:s.title,events:s.events,settings:s.settings,selection:{type:"all"}},"chronological").items[0].questionDisplay,"image");
  const t=await storage.createScenario({title:"Понятие с картой",activityType:"terms",tasks:[{id:"term",type:"terms",prompt:"Полюдье",answer:"Сбор дани",illustration,questionDisplay:"image"}]});
  for(const direction of ["term-to-definition","definition-to-term","mixed"] as Direction[]) {
    const p=buildTermsPlan({...t,settings:{...t.settings,direction}});
    assert.equal(p.items[0].questionDisplay,"image");
    assert.deepEqual(p.items[0].illustration,illustration);
  }
  assert.equal(buildTermsStudyPlan(t,"sequential").items[0].questionDisplay,"image");
});

test("format v4 remaps illustrations in dates, terms, history and recovery; missing assets reject atomically",async()=>{
  await storage.putImage(image);
  const s=await storage.createScenario({title:"Связи иллюстраций",events:[{dateText:"988",title:"Крещение Руси",illustration,questionDisplay:"image"}]});
  const t=await storage.createScenario({title:"Связи понятий",activityType:"terms",tasks:[{id:"term",type:"terms",prompt:"Вече",answer:"Собрание",illustration,questionDisplay:"image"}]});
  const plan=buildRunPlan({scenarioId:s.id,title:s.title,events:s.events,settings:s.settings,selection:{type:"all"}});
  await storage.createSession({scenarioId:s.id,scenarioTitle:s.title,items:plan.items,mode:"manual",direction:"event-to-date",intervalSec:7,durationSec:3,startedAt:new Date().toISOString()});
  await storage.saveActiveRun({id:"current",plan:buildTermsPlan(t),index:0,elapsedMs:0,questionMs:0,mode:"manual",startedAt:new Date().toISOString()});
  const file=await storage.exportAll();assert.equal(file.version,4);
  const pkg=await storage.exportPackage([s.id,t.id]);assert.equal(pkg.images.length,1);
  const before=await storage.listScenarios();
  await assert.rejects(storage.importAll({...pkg,images:[]},"replace"));
  await assert.rejects(storage.importAll({...pkg,scenarios:[{...s,events:[{...s.events[0],questionDisplay:"unknown"}]}]},"replace"));
  assert.deepEqual(await storage.listScenarios(),before);
  await storage.putImage({...image,dataUrl:"data:image/png;base64,YWJj"});
  await storage.clearActiveRun();
  await storage.importAll(file,"merge");
  const copies=(await storage.listScenariosFull()).filter(x=>!before.some(b=>b.id===x.id));
  const date=copies.find(x=>x.title===s.title)!;const term=copies.find(x=>x.title===t.title)!;
  const newId=date.events[0].illustration!.imageId;
  assert.notEqual(newId,image.id);
  assert.equal(term.tasks?.[0].type==="terms"&&term.tasks[0].illustration?.imageId,newId);
  assert.equal((await storage.listSessions()).find(x=>x.scenarioId===date.id)?.items[0].illustration?.imageId,newId);
  assert.equal((await storage.getActiveRun())?.plan.items[0].illustration?.imageId,newId);
  assert.equal((await storage.getImage(newId))?.dataUrl,image.dataUrl);
  for(const version of [1,2,3])assert.equal(storage.inspectTransfer({format:"chronos-package",version,scenarios:[{title:"Старый набор",events:[{dateText:"988",title:"Крещение Руси"}]}]}).scenarios.length,1);
});

test("image and reference save roll back together on scenario write failure",async()=>{
  const s=await storage.createScenario({title:"Атомарная замена",events:[{dateText:"988",title:"Крещение Руси"}]});
  const original=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(this.name==="scenarios")throw new DOMException("Test","QuotaExceededError");return key===undefined?original.call(this,value):original.call(this,value,key);};
  const replacement={...image,id:"failed-asset"};
  try{await assert.rejects(storage.updateScenario(s.id,{events:[{...s.events[0],illustration:{...illustration,imageId:replacement.id}}]},replacement));}
  finally{IDBObjectStore.prototype.put=original;}
  assert.equal(await storage.getImage(replacement.id),undefined);
  assert.equal((await storage.getScenario(s.id))?.events[0].illustration,undefined);
});

test("image questions print the picture without the hidden text, with answer only in the key",()=>{
  const items=buildRunPlan({scenarioId:null,title:"Печать",events:[{id:"print",dateText:"988",title:"Скрытое название",yearSort:988,era:null,illustration,questionDisplay:"image"}],settings:DEFAULT_SETTINGS,selection:{type:"all"}}).items;
  let html="";
  const previous=globalThis.window;
  globalThis.window={open:()=>({document:{open(){},write(value:string){html=value;},close(){}}})} as unknown as Window&typeof globalThis;
  try {
    printWorksheet("Печать",items,false,{[image.id]:image.dataUrl});
    assert.match(html,/<img /);assert.doesNotMatch(html,/Скрытое название|988/);
    printWorksheet("Печать",items,true,{[image.id]:image.dataUrl});
    assert.match(html,/988/);assert.doesNotMatch(html,/Скрытое название/);
  }finally{if(previous)globalThis.window=previous;else Reflect.deleteProperty(globalThis,"window");}
});

test("image collection retains date and term illustrations in history and recovery",async()=>{
  const asset={...image,id:"retained-illustration"};await storage.putImage(asset);
  const ref={...illustration,imageId:asset.id};
  const s=await storage.createScenario({title:"Удаляемый набор",events:[{dateText:"988",title:"Крещение Руси",illustration:ref,questionDisplay:"image"}]});
  const plan=buildRunPlan({scenarioId:s.id,title:s.title,events:s.events,settings:s.settings,selection:{type:"all"}});
  const session=await storage.createSession({scenarioId:s.id,scenarioTitle:s.title,items:plan.items,mode:"manual",direction:"event-to-date",intervalSec:7,durationSec:3,startedAt:new Date().toISOString()});
  await storage.saveActiveRun({id:"current",plan,index:0,elapsedMs:0,questionMs:0,mode:"manual",startedAt:new Date().toISOString()});
  await storage.deleteScenario(s.id);assert.ok(await storage.getImage(asset.id));
  await storage.deleteSession(session.id);assert.ok(await storage.getImage(asset.id));
  await storage.clearActiveRun();assert.equal(await storage.getImage(asset.id),undefined);
});

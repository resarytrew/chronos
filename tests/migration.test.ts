import "fake-indexeddb/auto";
import Dexie from "dexie";
import {test} from "node:test";
import assert from "node:assert/strict";
test("version one IndexedDB migrates without losing teacher events",async()=>{
  const old=new Dexie("chronos");
  old.version(1).stores({scenarios:"id, updatedAt, createdAt, kind",sessions:"id, finishedAt, startedAt, scenarioId"});
  await old.open();
  await old.table("scenarios").add({id:"old",title:"Старый диктант",description:null,kind:"user",events:[{id:"event",title:"Куликовская битва",dateText:"1380 г.",yearSort:1380,era:null}],settings:{},createdAt:"2025-01-01",updatedAt:"2025-01-01"});
  old.close();
  const {storage}=await import("../src/lib/storage");
  const migrated=await storage.getScenario("old");
  assert.equal(migrated?.activityType,"dictation");
  assert.equal(migrated?.events[0].dateText,"1380 г.");
  assert.equal(await storage.getActiveRun(),undefined);
});

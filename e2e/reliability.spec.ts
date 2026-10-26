import {test,expect} from "@playwright/test";
import {importLesson} from "./helpers";
import {DEFAULT_SETTINGS} from "../src/lib/types";
test("failed history write is visible and can be retried without a duplicate",async({page})=>{
  await importLesson(page,{title:"Сохранение при ошибке",events:[{id:"e",dateText:"988",title:"Крещение Руси",yearSort:988,era:null}]});
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add=function(value:unknown,key?:IDBValidKey){
      if(this.name==="sessions")throw new DOMException("Storage quota","QuotaExceededError");
      return key===undefined?original.call(this,value):original.call(this,value,key);
    };
    (window as Window & {restoreWrite?:()=>void}).restoreWrite=()=>{IDBObjectStore.prototype.add=original;};
  });
  await page.getByRole("button",{name:"Завершить",exact:true}).click();
  await expect(page.getByText("Не удалось сохранить историю.",{exact:false})).toBeVisible();
  await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toHaveCount(0);
  await page.evaluate(()=>(window as Window & {restoreWrite?:()=>void}).restoreWrite?.());
  await page.getByRole("button",{name:"Повторить сохранение",exact:true}).click();
  await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
  const count=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("chronos");r.onsuccess=()=>resolve(r.result);});return new Promise<number>(resolve=>{const r=db.transaction("sessions").objectStore("sessions").count();r.onsuccess=()=>{resolve(r.result);db.close();};});});
  expect(count).toBe(1);
});

test("teacher interruption is recorded as interrupted rather than completed",async({page})=>{
  await importLesson(page,{title:"Прерывание",events:[{id:"one",dateText:"988",title:"Крещение Руси",yearSort:988,era:null},{id:"two",dateText:"1380",title:"Куликовская битва",yearSort:1380,era:null}]});
  await page.getByRole("button",{name:"Выйти",exact:true}).click();
  await page.getByRole("button",{name:"Завершить сейчас",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Занятие прервано",exact:true})).toBeVisible();
  await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
  await page.getByRole("button",{name:"Выйти",exact:true}).last().click();
  await page.goto("history/");
  await expect(page.getByText("Прервано · показано 1 из 2",{exact:true})).toBeVisible();
});

test("hiding the tab pauses automatic presentation until explicit resume",async({page})=>{
  await page.clock.install();
  await importLesson(page,{title:"Пауза",settings:{...DEFAULT_SETTINGS,mode:"auto",intervalSec:3,countdown:false},events:[{id:"one",dateText:"988",title:"Крещение Руси",yearSort:988,era:null},{id:"two",dateText:"1380",title:"Куликовская битва",yearSort:1380,era:null}]});
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
  await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeVisible();
  await page.clock.fastForward(10000);
  await expect(page.locator(".b-question")).toHaveText("Крещение Руси");
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
  await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await page.clock.fastForward(3500);
  await expect(page.locator(".b-question")).toHaveText("Куликовская битва");
});
test("an update waits during the lesson and teacher applies it after closing",async({page})=>{
  await page.goto("./");
  await expect(page.getByText("Готово к работе без интернета",{exact:true})).toBeVisible();
  await importLesson(page,{title:"Обновление",activityType:"qa",tasks:[{id:"q",type:"qa",prompt:"Назовите событие 988 года",answer:"Крещение Руси"}]});
  await page.evaluate(async()=>{
    const r=await navigator.serviceWorker.register("/chronos/sw.js?test-update=2",{scope:"/chronos/"});
    if(r.waiting)return;
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error("Update did not install")),15000);
      const check=()=>{if(r.waiting){clearTimeout(timer);resolve();}};
      r.installing?.addEventListener("statechange",check);
      r.addEventListener("updatefound",()=>r.installing?.addEventListener("statechange",check));
      check();
    });
  });
  await expect(page.locator(".board")).toBeVisible();
  await expect(page.getByRole("button",{name:"Установить обновление",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Завершить",exact:true}).click();
  await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
  await page.getByRole("button",{name:"Выйти",exact:true}).last().click();
  await expect(page.getByRole("button",{name:"Установить обновление",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Установить обновление",exact:true}).click();
  await expect(page.getByText("Обновление",{exact:true})).toBeVisible();
});

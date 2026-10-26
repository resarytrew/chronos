import {test,expect} from "@playwright/test";
import {importLesson} from "./helpers";
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

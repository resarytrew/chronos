import {test,expect,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {DEFAULT_SETTINGS,type Direction} from "../src/lib/types";

async function picture(page:Page) {
  return page.evaluate(()=>{const c=document.createElement("canvas");c.width=640;c.height=360;const x=c.getContext("2d")!;x.fillStyle="#ddd";x.fillRect(0,0,640,360);x.fillStyle="#222";x.fillRect(50,50,100,100);return c.toDataURL("image/png");});
}
async function importSet(page:Page,terms:boolean,direction:Direction,auto=false) {
  await page.goto("./");
  const dataUrl=await picture(page);
  const illustration={imageId:"picture",alt:"Учебная иллюстрация",source:"https://example.com/map"};
  const events=terms?[]:[{id:"one",title:"Крещение Руси",dateText:"988",illustration,questionDisplay:"image"},{id:"two",title:"Куликовская битва",dateText:"1380"}];
  const tasks=terms?[{id:"one",type:"terms",prompt:"Вече",answer:"Народное собрание",illustration,questionDisplay:"image"},{id:"two",type:"terms",prompt:"Летопись",answer:"Запись событий по годам"}]:[];
  const file={format:"chronos-package",version:4,scenarios:[{id:"fixture",title:"Иллюстрации на уроке",activityType:terms?"terms":"dictation",events,tasks,settings:{...DEFAULT_SETTINGS,direction,mode:auto?"auto":"manual",intervalSec:3,countdown:false,voice:true}}],sessions:[],images:[{id:"picture",dataUrl}],preferences:[],activeRuns:[]};
  await page.locator('input[type="file"]').first().setInputFiles({name:"lesson.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(file))});
  await page.getByRole("button",{name:"Объединить",exact:true}).click();
  await expect(page.getByText("Добавлено наборов: 1, показов: 0",{exact:true})).toBeVisible();
}

for(const [terms,directions] of [[false,["event-to-date","date-to-event","mixed"]],[true,["term-to-definition","definition-to-term","mixed"]]] as const) {
  for(const direction of directions) {
    test("image question, preview and answer snapshot in "+direction+(terms?" terms":" dates"),async({page})=>{
      await importSet(page,terms,direction);
      await page.getByRole("button",{name:"Провести",exact:true}).click();
      await page.getByRole("button",{name:"Предпросмотр доски",exact:true}).click();
      const board=page.locator(".board");
      await expect(board.getByRole("img",{name:"Учебная иллюстрация",exact:true})).toBeVisible();
      for(const text of terms?["Вече","Народное собрание"]:["Крещение Руси","988"])await expect(board.getByText(text,{exact:true})).toHaveCount(0);
      await page.getByRole("button",{name:"Начать",exact:true}).click();
      await expect(board.getByRole("img",{name:"Учебная иллюстрация",exact:true})).toBeVisible();
      await expect(board.getByRole("button",{name:"Повторить голосом",exact:true})).toBeDisabled();
      await expect(board.getByRole("link",{name:"Источник изображения",exact:true})).toHaveCount(0);
      await page.getByRole("button",{name:"Далее",exact:true}).click();
      await expect(board.locator(".b-question")).not.toBeEmpty();
      await expect(board.getByRole("img")).toHaveCount(0);
      await page.getByRole("button",{name:"Завершить",exact:true}).click();
      await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
      await page.getByRole("button",{name:"Показать ответы",exact:true}).click();
      await expect(board.getByRole("img",{name:"Учебная иллюстрация",exact:true})).toBeVisible();
      await expect(board.getByRole("link",{name:"Источник изображения",exact:true})).toHaveCount(0);
      await page.getByRole("button",{name:"Открыть следующий",exact:true}).click();
      await expect(board.getByRole("link",{name:"Источник изображения",exact:true})).toHaveAttribute("href","https://example.com/map");
      await expect(board.locator(".rv-answer").first()).not.toBeEmpty();
    });
  }
}

test("viewer pauses automatic image dictation and offline reload restores the same image from a pause",async({page})=>{
  await importSet(page,false,"event-to-date",true);
  await expect(page.getByText("Готово к работе без интернета",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Провести",exact:true}).click();
  await page.clock.install();
  await page.getByRole("button",{name:"Начать",exact:true}).click();
  await page.getByRole("button",{name:"Увеличить изображение",exact:true}).click();
  await page.clock.fastForward(10000);await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog",{name:"Просмотр изображения",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");
  await page.clock.fastForward(10000);
  await expect(page.getByRole("img",{name:"Учебная иллюстрация",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeVisible();
  await page.context().setOffline(true);await page.reload();
  await page.getByRole("button",{name:"Продолжить с паузы",exact:true}).click();
  await expect(page.getByRole("img",{name:"Учебная иллюстрация",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();await page.clock.fastForward(3500);
  await expect(page.locator(".b-question")).toHaveText("Куликовская битва");
});

for(const terms of [false,true]) {
  test("teacher edits, prints and transfers an illustrated "+(terms?"concept":"date")+" into an offline clean profile",async({page,browser})=>{
    await page.goto("./");
    await page.getByRole("combobox",{name:"Тип нового занятия"}).selectOption(terms?"terms":"dictation");
    await page.getByRole("button",{name:"Новая тема"}).click();
    await page.getByRole("textbox",{name:"Название сценария",exact:true}).fill("Набор для переноса");
    await page.getByRole("button",{name:terms?"Добавить понятие":"Добавить событие",exact:true}).click();
    await page.getByRole("textbox",{name:terms?"Понятие 1":"Событие",exact:true}).fill(terms?"Вече":"Крещение Руси");
    await page.getByRole("textbox",{name:terms?"Определение 1":"Дата",exact:true}).fill(terms?"Народное собрание":"988");
    const editor=page.locator(".illustration-editor");
    await editor.locator("summary").click();
    const dataUrl=await picture(page);
    await editor.getByLabel("Изображение",{exact:true}).setInputFiles({name:"hidden-file-name.png",mimeType:"image/png",buffer:Buffer.from(dataUrl.split(",")[1],"base64")});
    await page.getByRole("button",{name:"Сохранить изображение",exact:true}).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await editor.getByRole("textbox",{name:"Описание иллюстрации",exact:true}).fill("Учебная иллюстрация");
    await editor.getByRole("radio",{name:"Изображение",exact:true}).click();
    await expect(page.getByText("изменения сохранены",{exact:true})).toBeVisible();
    if(!terms)await page.getByRole("button",{name:"Действия со сценарием",exact:true}).click();
    const popup=page.waitForEvent("popup");
    await page.getByRole("button",{name:terms?"Печать заданий / PDF":"Печать листа заданий",exact:true}).click();
    const sheet=await popup;await expect(sheet.locator("img")).toHaveCount(1);
    expect(await sheet.locator("body").innerText()).not.toContain(terms?"Вече":"Крещение Руси");
    expect(await sheet.locator("body").innerText()).not.toContain(terms?"Народное собрание":"988");
    await sheet.close();
    if(!terms)await page.getByRole("button",{name:"Действия со сценарием",exact:true}).click();
    const downloaded=page.waitForEvent("download");
    await page.getByRole("button",{name:terms?"Экспорт набора":"Экспорт в JSON",exact:true}).click();
    const file=await readFile((await(await downloaded).path())!);
    const context=await browser.newContext();
    try {
      const second=await context.newPage();await second.goto("http://127.0.0.1:4173/chronos/");
      await expect(second.getByText("Готово к работе без интернета",{exact:true})).toBeVisible();
      await second.locator('input[type="file"]').first().setInputFiles({name:"illustrations.json",mimeType:"application/json",buffer:file});
      await second.getByRole("button",{name:"Объединить",exact:true}).click();
      await expect(second.getByText("Добавлено наборов: 1, показов: 0",{exact:true})).toBeVisible();
      await context.setOffline(true);await second.reload();
      await second.getByRole("button",{name:"Действия",exact:true}).click();
      await second.getByRole("button",{name:terms?"Изучать понятия":"Изучать даты",exact:true}).click();
      await expect(second.locator(".rv-question").getByRole("img",{name:"Учебная иллюстрация",exact:true})).toBeVisible();
      await expect(second.locator(".rv-mask")).toHaveCount(1);
      await second.getByRole("button",{name:"Увеличить изображение",exact:true}).click();
      await second.keyboard.press("Escape");await expect(second.locator(".rv-mask")).toHaveCount(1);
      await second.getByRole("button",{name:"Открыть ответ",exact:true}).click();
      await expect(second.locator(".rv-answer")).toHaveText(terms?"Народное собрание":"988");
    }finally{await context.close();}
  });
}

test("missing picture is reported before start with an editor link and explicit text fallback",async({page})=>{
  await importSet(page,false,"event-to-date");
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("chronos");r.onsuccess=()=>resolve(r.result);});
    await new Promise<void>((resolve,reject)=>{const t=db.transaction("images","readwrite");t.objectStore("images").delete("picture");t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});db.close();
  });
  await page.getByRole("button",{name:"Провести",exact:true}).click();
  await expect(page.getByRole("button",{name:"Начать",exact:true})).toBeDisabled();
  await expect(page.locator(".image-problems")).toContainText("Задание 1");
  await expect(page.getByRole("link",{name:"Открыть задание",exact:true})).toHaveAttribute("href",/focus=one/);
  await page.getByRole("button",{name:"Показать текст",exact:true}).click();
  await page.getByRole("button",{name:"Начать",exact:true}).click();
  await expect(page.locator(".b-question")).toHaveText("Крещение Руси");
});

test("a picture that fails during the lesson pauses until the teacher chooses text",async({page})=>{
  await importSet(page,false,"event-to-date",true);
  await page.getByRole("button",{name:"Провести",exact:true}).click();
  await expect(page.getByRole("button",{name:"Начать",exact:true})).toBeEnabled();
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("chronos");r.onsuccess=()=>resolve(r.result);});
    await new Promise<void>((resolve,reject)=>{const t=db.transaction("images","readwrite");t.objectStore("images").put({id:"picture",dataUrl:"data:image/png;base64,aW52YWxpZA=="});t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});db.close();
  });
  await page.clock.install();await page.getByRole("button",{name:"Начать",exact:true}).click();
  await expect(page.getByRole("button",{name:"Показать текст",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeDisabled();
  await page.clock.fastForward(10000);
  await expect(page.locator(".board").getByText("Крещение Руси",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Показать текст",exact:true}).click();
  await expect(page.locator(".b-question")).toHaveText("Крещение Руси");
  await page.clock.fastForward(10000);
  await expect(page.locator(".b-question")).toHaveText("Крещение Руси");
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();await page.clock.fastForward(3500);
  await expect(page.locator(".b-question")).toHaveText("Куликовская битва");
});

test("editing the original concept image does not change history or its repeat",async({page})=>{
  await importSet(page,true,"term-to-definition");
  await page.getByRole("button",{name:"Провести",exact:true}).click();await page.getByRole("button",{name:"Начать",exact:true}).click();
  await page.getByRole("button",{name:"Далее",exact:true}).click();await page.getByRole("button",{name:"Завершить",exact:true}).click();
  await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
  await page.getByRole("button",{name:"Выйти",exact:true}).last().click();
  await page.getByRole("link").filter({hasText:"Иллюстрации на уроке"}).click();
  const editor=page.locator(".illustration-editor").first();await editor.locator("summary").click();
  await editor.getByRole("button",{name:"Удалить иллюстрацию",exact:true}).click();
  await expect(page.getByText("изменения сохранены",{exact:true})).toBeVisible();
  await page.goto("history/");await page.getByRole("button",{name:"Ответы",exact:true}).click();
  await expect(page.locator(".board").getByRole("img",{name:"Учебная иллюстрация",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Выйти",exact:true}).last().click();
  await page.getByRole("button",{name:"Повторить тот же порядок",exact:true}).click();await page.getByRole("button",{name:"Начать",exact:true}).click();
  await expect(page.locator(".board").getByRole("img",{name:"Учебная иллюстрация",exact:true})).toBeVisible();
  await expect(page.locator(".board").getByText("Вече",{exact:true})).toHaveCount(0);
});

for(const size of [{width:1024,height:768},{width:1366,height:768},{width:1920,height:1080}]) {
  test("illustrated dictation and study keep controls visible at "+size.width,async({page},info)=>{
    await page.setViewportSize(size);
    for(const terms of [false,true]) {
      await importSet(page,terms,terms?"term-to-definition":"event-to-date");
      await page.getByRole("button",{name:"Провести",exact:true}).first().click();
      await page.getByRole("button",{name:"Начать",exact:true}).click();
      const board=page.locator(".board");await expect(board.getByRole("img")).toBeVisible();
      expect(await board.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      const next=await board.getByRole("button",{name:"Далее",exact:true}).boundingBox();
      expect(next!.y+next!.height).toBeLessThanOrEqual(size.height);
      await page.screenshot({path:info.outputPath((terms?"terms":"dates")+"-question-"+size.width+".png"),animations:"disabled"});
      await page.getByRole("button",{name:"Далее",exact:true}).click();await page.getByRole("button",{name:"Завершить",exact:true}).click();
      await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
      await page.getByRole("button",{name:"Выйти",exact:true}).last().click();
      await page.getByRole("button",{name:"Действия",exact:true}).first().click();
      await page.getByRole("button",{name:terms?"Изучать понятия":"Изучать даты",exact:true}).click();
      await expect(board.getByRole("img")).toBeVisible();
      await page.getByRole("button",{name:"Открыть ответ",exact:true}).click();
      expect(await board.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      const done=await board.getByRole("button",{name:"Готово",exact:true}).boundingBox();
      expect(done!.y+done!.height).toBeLessThanOrEqual(size.height);
      await page.screenshot({path:info.outputPath((terms?"terms":"dates")+"-study-"+size.width+".png"),animations:"disabled"});
      await page.getByRole("button",{name:"Готово",exact:true}).click();
    }
  });
}

test("image readiness problem opens the specific editor row",async({page})=>{
  await importSet(page,true,"term-to-definition");
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("chronos");r.onsuccess=()=>resolve(r.result);});
    await new Promise<void>(resolve=>{const t=db.transaction("images","readwrite");t.objectStore("images").delete("picture");t.oncomplete=()=>resolve();});db.close();
  });
  await page.getByRole("button",{name:"Провести",exact:true}).click();
  await page.getByRole("link",{name:"Открыть задание",exact:true}).click();
  await expect(page.locator('[data-question-editor="one"] details')).toHaveAttribute("open","");
  await expect(page.getByRole("textbox",{name:"Описание иллюстрации",exact:true})).toBeFocused();
});

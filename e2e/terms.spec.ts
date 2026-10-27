import {test,expect,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {importLesson} from "./helpers";
import {DEFAULT_SETTINGS} from "../src/lib/types";
const concepts=["Вече","Полюдье","Летопись"];
const definitions=["Народное собрание в Древней Руси.","Объезд князем подвластных земель для сбора дани.","Запись исторических событий по годам."];
async function createTerms(page:Page) {
  await page.goto("./");
  await page.getByRole("combobox",{name:"Тип нового занятия"}).selectOption("terms");
  await page.getByRole("button",{name:"Новая тема"}).click();
  await page.getByRole("textbox",{name:"Название сценария",exact:true}).fill("Исторические понятия");
  await page.getByRole("button",{name:"Вставить список понятий",exact:true}).click();
  await page.getByRole("textbox",{name:"Список понятий",exact:true}).fill(concepts.map((t,i)=>t+"\t"+definitions[i]).join("\n"));
  await page.getByRole("button",{name:"Добавить 3",exact:true}).click();
  await page.getByRole("switch",{name:"Обратный отсчёт 3–2–1",exact:true}).click();
}
test("term dictation displays a concept and reveals the definition after completion",async({page})=>{
  await createTerms(page);
  await page.getByRole("button",{name:"Начать показ",exact:true}).click();
  await expect(page.locator(".board").getByText("Терминологический диктант",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Начать",exact:true}).click();
  await expect(page.locator(".b-question")).toHaveText(concepts[0]);
  await expect(page.getByText("Запишите определение",{exact:true})).toBeVisible();
  await expect(page.locator(".board").getByText(definitions[0],{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Далее",exact:true}).click();
  await page.getByRole("button",{name:"Далее",exact:true}).click();
  await page.getByRole("button",{name:"Завершить",exact:true}).click();
  await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
  await page.getByRole("button",{name:"Показать ответы",exact:true}).click();
  await page.getByRole("button",{name:"Открыть следующий",exact:true}).click();
  await expect(page.locator(".rv-answer").first()).toHaveText(definitions[0]);
});

for(const size of [{width:1024,height:768},{width:1920,height:1080}]) {
  test("long definitions remain readable in dictation and study at "+size.width,async({page},testInfo)=>{
    await page.setViewportSize(size);
    const definition="Определение исторического понятия может включать несколько предложений: характерные признаки явления, время его существования и роль в общественной жизни. В этом примере проверяется, что длинный текст переносится по строкам, полностью доступен для чтения и не закрывает кнопки управления на электронной доске.";
    await importLesson(page,{title:"Длинные определения",activityType:"terms",settings:{...DEFAULT_SETTINGS,mode:"manual",direction:"definition-to-term",countdown:false},tasks:[{id:"long",type:"terms",prompt:"Историческое понятие",answer:definition}]});
    await expect(page.locator(".b-question")).toHaveText(definition);
    let done=await page.getByRole("button",{name:"Завершить",exact:true}).boundingBox();
    expect(done!.y+done!.height).toBeLessThanOrEqual(size.height);
    await page.getByRole("button",{name:"Завершить",exact:true}).click();
    await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
    await page.getByRole("button",{name:"Выйти",exact:true}).last().click();
    await page.getByRole("button",{name:"Действия",exact:true}).click();
    await page.getByRole("button",{name:"Изучать понятия",exact:true}).click();
    await page.getByRole("button",{name:"Открыть определение: Историческое понятие",exact:true}).click();
    await expect(page.locator(".rv-answer")).toHaveText(definition);
    expect(await page.locator(".board").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    done=await page.getByRole("button",{name:"Готово",exact:true}).boundingBox();
    expect(done!.y+done!.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({path:testInfo.outputPath("terms-"+size.width+".png"),animations:"disabled"});
  });
}
test("reverse terminology dictation and history repeat keep the original definition",async({page})=>{
  await createTerms(page);
  await page.getByRole("radio",{name:"Определение → понятие",exact:true}).click();
  await page.getByRole("button",{name:"Начать показ",exact:true}).click();
  await page.getByRole("button",{name:"Начать",exact:true}).click();
  await expect(page.locator(".b-question")).toHaveText(definitions[0]);
  await expect(page.getByText("Запишите понятие",{exact:true})).toBeVisible();
  await expect(page.locator(".board").getByText(concepts[0],{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Далее",exact:true}).click();
  await page.getByRole("button",{name:"Далее",exact:true}).click();
  await page.getByRole("button",{name:"Завершить",exact:true}).click();
  await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
  await page.getByRole("button",{name:"Выйти",exact:true}).last().click();
  await page.getByRole("textbox",{name:"Определение 1",exact:true}).fill("Изменено после урока.");
  await expect(page.getByText("изменения сохранены",{exact:true})).toBeVisible();
  await page.goto("history/");
  await page.getByRole("button",{name:"Повторить тот же порядок",exact:true}).click();
  await page.getByRole("button",{name:"Начать",exact:true}).click();
  await expect(page.locator(".b-question")).toHaveText(definitions[0]);
});
test("term dictation supports automatic timing and manual override",async({page})=>{
  await createTerms(page);
  await page.getByRole("radio",{name:"Автоматически",exact:true}).click();
  await page.getByRole("button",{name:"Начать показ",exact:true}).click();
  await page.clock.install();
  await page.getByRole("button",{name:"Начать",exact:true}).click();
  await expect(page.locator(".b-question")).toHaveText(concepts[0]);
  await page.clock.fastForward(7500);
  await expect(page.locator(".b-question")).toHaveText(concepts[1]);
  await page.keyboard.press("a");
  await expect(page.locator(".board").getByText("Вручную",{exact:true})).toBeVisible();
  await page.clock.fastForward(15000);
  await expect(page.locator(".b-question")).toHaveText(concepts[1]);
});
test("concept study reveals definitions, restores sequential order and works offline after transfer",async({page,browser},testInfo)=>{
  await createTerms(page);
  await page.getByRole("radio",{name:"Определение → понятие",exact:true}).click();
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Экспорт набора",exact:true}).click();
  const data=await readFile((await(await download).path())!);
  await page.getByRole("button",{name:"Изучать понятия",exact:true}).click();
  const board=page.locator(".board");
  await expect(board.getByRole("heading",{name:"Изучение понятий",exact:true})).toBeVisible();
  await expect(board.locator(".rv-question")).toHaveText(concepts);
  await expect(board.locator(".rv-mask")).toHaveCount(3);
  await board.getByRole("button",{name:"Открыть определение: "+concepts[0],exact:true}).click();
  await expect(board.locator(".rv-answer").first()).toHaveText(definitions[0]);
  await board.getByRole("button",{name:"Скрыть определение: "+concepts[0],exact:true}).click();
  await board.getByRole("button",{name:"Перемешать",exact:true}).click();
  expect(await board.locator(".rv-question").allTextContents()).not.toEqual(concepts);
  await board.getByRole("button",{name:"Открыть все",exact:true}).click();
  for(const row of await board.locator(".rv-row").all()) {
    const title=await row.locator(".rv-question").innerText();
    await expect(row.locator(".rv-answer")).toHaveText(definitions[concepts.indexOf(title)]);
  }
  await board.getByRole("button",{name:"Последовательно",exact:true}).click();
  await expect(board.locator(".rv-question")).toHaveText(concepts);
  await board.getByRole("button",{name:"Открыть следующий",exact:true}).click();
  await page.screenshot({path:testInfo.outputPath("concept-study.png"),animations:"disabled"});
  await page.keyboard.press("Escape");
  await expect(page.getByRole("radio",{name:"Определение → понятие",exact:true})).toHaveAttribute("aria-checked","true");
  await page.goto("history/");await expect(page.getByText("Пока пусто",{exact:true})).toBeVisible();
  const context=await browser.newContext();
  try {
    const second=await context.newPage();await second.goto("http://127.0.0.1:4173/chronos/");
    await expect(second.getByText("Готово к работе без интернета",{exact:true})).toBeVisible();
    await second.locator('input[type="file"]').first().setInputFiles({name:"terms.json",mimeType:"application/json",buffer:data});
    await second.getByRole("button",{name:"Объединить",exact:true}).click();
    await context.setOffline(true);await second.reload();
    await second.getByRole("button",{name:"Действия",exact:true}).click();
    await second.getByRole("button",{name:"Изучать понятия",exact:true}).click();
    await expect(second.locator(".rv-question")).toHaveText(concepts);
    await second.getByRole("button",{name:"Открыть определение: "+concepts[0],exact:true}).click();
    await expect(second.locator(".rv-answer").first()).toHaveText(definitions[0]);
  } finally {await context.close();}
});

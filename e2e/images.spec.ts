import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
test("local image, answer and metadata transfer to a clean browser and work offline",async({page,browser})=>{
  await page.goto("./");
  await page.getByRole("combobox",{name:"Тип нового занятия"}).selectOption("image");
  await page.getByRole("button",{name:"Новая тема"}).click();
  await page.getByRole("button",{name:"Добавить задание",exact:true}).click();
  await page.getByRole("textbox",{name:"Вопрос 1",exact:true}).fill("Что изображено на схеме?");
  await page.getByRole("textbox",{name:"Ответ 1",exact:true}).fill("Учебная карта");
  const png=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=2000;c.height=1000;const x=c.getContext("2d")!;x.fillStyle="#f4f4f1";x.fillRect(0,0,2000,1000);x.fillStyle="#111";x.font="80px sans-serif";x.fillText("Карта",800,500);return c.toDataURL("image/png").split(",")[1];});
  await page.getByLabel("Изображение",{exact:true}).setInputFiles({name:"map.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  await page.getByRole("textbox",{name:"Описание изображения",exact:true}).fill("Учебная схема");
  await page.getByRole("textbox",{name:"Подпись изображения",exact:true}).fill("Материал для обсуждения");
  await page.getByRole("textbox",{name:"Источник изображения",exact:true}).fill("https://example.com/source");
  await expect(page.getByRole("img",{name:"Учебная схема",exact:true})).toBeVisible();
  await expect.poll(()=>page.getByRole("img",{name:"Учебная схема",exact:true}).evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(1600);
  await expect(page.getByText("изменения сохранены",{exact:true})).toBeVisible();
  const downloaded=page.waitForEvent("download");
  await page.getByRole("button",{name:"Экспорт набора",exact:true}).click();
  const data=await readFile((await(await downloaded).path())!);
  const context=await browser.newContext();
  try{
    const second=await context.newPage();await second.goto("http://127.0.0.1:4173/chronos/");
    await expect(second.getByText("Готово к работе без интернета",{exact:true})).toBeVisible();
    await second.locator('input[type="file"]').first().setInputFiles({name:"lesson.json",mimeType:"application/json",buffer:data});
    await expect(second.getByText(/изображений: 1/)).toBeVisible();
    await second.getByRole("button",{name:"Объединить",exact:true}).click();
    await second.getByRole("button",{name:"Провести",exact:true}).click();
    await second.getByRole("button",{name:"Начать",exact:true}).click();
    await expect(second.locator(".board").getByRole("img",{name:"Учебная схема",exact:true})).toBeVisible();
    await expect(second.locator(".board").getByText("Учебная карта",{exact:true})).toHaveCount(0);
    await context.setOffline(true);
    await second.getByRole("button",{name:"Показать ответ",exact:true}).click();
    await expect(second.locator(".board").getByText("Учебная карта",{exact:true})).toBeVisible();
    await second.reload();
    await second.getByRole("button",{name:"Продолжить с паузы",exact:true}).click();
    await expect(second.locator(".board").getByRole("img",{name:"Учебная схема",exact:true})).toBeVisible();
  }finally{await context.close();}
});

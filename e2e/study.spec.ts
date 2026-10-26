import {test,expect} from "@playwright/test";
test("date study opens directly from the editor, switches order and creates no lesson history",async({page},testInfo)=>{
  await page.setViewportSize({width:1366,height:768});
  await page.goto("./");
  await page.getByRole("button",{name:"Быстрый диктант"}).click();
  await page.getByRole("dialog").locator("textarea").fill("1613 — Воцарение Михаила Романова\n988 — Крещение Руси\n1380 — Куликовская битва");
  await page.getByRole("button",{name:"Добавить 3",exact:true}).click();
  await page.getByRole("radio",{name:"Дата → событие",exact:true}).click();
  await page.getByRole("button",{name:"Изучать даты",exact:true}).click();
  const board=page.locator(".board");
  await expect(board.getByRole("heading",{name:"Изучение дат",exact:true})).toBeVisible();
  await expect(board.getByRole("button",{name:"Начать",exact:true})).toHaveCount(0);
  const chronological=["Крещение Руси","Куликовская битва","Воцарение Михаила Романова"];
  await expect(board.locator(".rv-question")).toHaveText(chronological);
  await expect(board.locator(".rv-mask")).toHaveCount(3);
  await expect(board.getByText("Событие",{exact:true})).toHaveCount(0);
  await board.getByRole("button",{name:"Открыть дату: Крещение Руси",exact:true}).click();
  await expect(board.locator(".rv-answer").first()).toHaveText("988");
  await board.getByRole("button",{name:"Скрыть дату: Крещение Руси",exact:true}).click();
  await expect(board.locator(".rv-mask")).toHaveCount(3);
  await board.getByRole("button",{name:"Перемешать",exact:true}).click();
  const mixed=await board.locator(".rv-question").allTextContents();
  expect(mixed).not.toEqual(chronological);
  await board.getByRole("button",{name:"Открыть все",exact:true}).click();
  for(const row of await board.locator(".rv-row").all()){
    const title=await row.locator(".rv-question").innerText();
    await expect(row.locator(".rv-answer")).toHaveText({"Крещение Руси":"988","Куликовская битва":"1380","Воцарение Михаила Романова":"1613"}[title]!);
  }
  await board.getByRole("button",{name:"Скрыть все даты",exact:true}).click();
  await expect(board.locator(".rv-mask")).toHaveCount(3);
  await board.getByRole("button",{name:"По хронологии",exact:true}).click();
  await expect(board.locator(".rv-question")).toHaveText(chronological);
  const font=await board.locator(".rv-question").first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(font).toBeGreaterThan(22);
  await page.screenshot({path:testInfo.outputPath("study-1366.png")});
  await page.keyboard.press("Escape");
  await expect(page.locator(".board")).toHaveCount(0);
  await expect(page.getByRole("radio",{name:"Дата → событие",exact:true})).toHaveAttribute("aria-checked","true");
  await page.getByRole("radio",{name:"Вперемешку",exact:true}).click();
  await page.getByRole("button",{name:"Изучать даты",exact:true}).click();
  await expect(page.locator(".board").getByRole("button",{name:"Перемешать",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Готово",exact:true}).click();
  await page.goto("history/");
  await expect(page.getByText("Пока пусто",{exact:true})).toBeVisible();
});

for(const size of [{width:1024,height:768},{width:1920,height:1080}]){
  test("large date study fits the board at "+size.width,async({page},testInfo)=>{
    await page.setViewportSize(size);
    await page.goto("library/");
    await page.getByRole("button",{name:"Изучать даты",exact:true}).first().click();
    const board=page.locator(".board");
    await expect(board.locator(".rv-question").first()).toBeVisible();
    expect(await board.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    const done=await board.getByRole("button",{name:"Готово",exact:true}).boundingBox();
    expect(done!.y+done!.height).toBeLessThanOrEqual(size.height);
    await board.getByRole("button",{name:"Открыть следующий",exact:true}).click();
    await expect(board.locator(".rv-answer").first()).not.toBeEmpty();
    await page.screenshot({path:testInfo.outputPath("study-"+size.width+".png")});
  });
}
test("date study can also start from the built in library",async({page})=>{
  await page.goto("library/");
  await page.getByRole("button",{name:"Изучать даты",exact:true}).first().click();
  await expect(page.getByRole("heading",{name:"Изучение дат",exact:true})).toBeVisible();
  await expect(page.locator(".rv-mask").first()).toBeVisible();
});

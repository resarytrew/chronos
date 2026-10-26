import {test,expect} from "@playwright/test";
test("teacher sets sequence order; pupils reorder before explicit checking",async({page})=>{
  await page.goto("./");
  await page.getByRole("combobox",{name:"Тип нового занятия"}).selectOption("sequence");
  await page.getByRole("button",{name:"Новая тема"}).click();
  await page.getByRole("button",{name:"Добавить задание",exact:true}).click();
  const cards=["Крещение Руси","Куликовская битва","Начало правления Петра I"];
  for(let i=0;i<3;i++)await page.getByRole("textbox",{name:"Карточка "+(i+1),exact:true}).fill(cards[i]);
  await page.getByRole("textbox",{name:"Пояснение 1",exact:true}).fill("События расположены по времени.");
  await expect(page.getByText("изменения сохранены",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Начать показ",exact:true}).click();
  await page.getByRole("button",{name:"Начать",exact:true}).click();
  await expect(page.locator(".task-card")).toHaveCount(3);
  await expect(page.locator(".board").getByText("События расположены по времени.",{exact:true})).toHaveCount(0);
  for(let i=0;i<3;i++){
    let position=await page.locator(".task-card").filter({hasText:cards[i]}).evaluate(el=>Array.from(el.parentElement!.children).indexOf(el));
    while(position>i){await page.getByRole("button",{name:"Поднять карточку "+(position+1),exact:true}).click();position--;}
  }
  await page.getByRole("button",{name:"Проверить",exact:true}).click();
  await expect(page.getByText("Верно",{exact:true})).toBeVisible();
  await expect(page.locator(".board").getByText("События расположены по времени.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Завершить",exact:true}).click();
  await expect(page.getByText("Результат сохранён в «Истории» — порядок можно повторить позже.")).toBeVisible();
  await page.getByRole("button",{name:"Выйти",exact:true}).last().click();
  await page.goto("history/");
  await expect(page.getByRole("button",{name:"Повторить",exact:false}).first()).toBeVisible();
});

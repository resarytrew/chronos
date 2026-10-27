import {test,expect} from "@playwright/test";

test("cold start waits for handlers before accepting the lesson type or create action",async({page})=>{
  let release!:()=>void;
  const scripts=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/_next/static/**/*.js",async route=>{await scripts;await route.continue();});
  try{
    await page.goto("./",{waitUntil:"commit"});
    await expect(page.getByRole("combobox",{name:"Тип нового занятия",exact:true})).toBeDisabled();
    await expect(page.getByRole("button",{name:"Новая тема"})).toBeDisabled();
    release();
    await page.getByRole("combobox",{name:"Тип нового занятия",exact:true}).selectOption("image");
    await expect(page.getByRole("button",{name:"Новая тема"})).toContainText("Историческое изображение");
    await page.getByRole("button",{name:"Новая тема"}).click();
    await expect(page.getByRole("button",{name:"Добавить задание",exact:true})).toBeVisible();
  }finally{release();}
});

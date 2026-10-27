import {test,expect,type Page} from "@playwright/test";

async function prepare(page:Page) {
  await page.goto("./");
  await page.getByRole("combobox",{name:"Тип нового занятия"}).selectOption("image");
  await page.getByRole("button",{name:"Новая тема"}).click();
  await page.getByRole("button",{name:"Добавить задание",exact:true}).click();
  await page.getByRole("textbox",{name:"Вопрос 1",exact:true}).fill("Рассмотрите карту");
  await page.getByRole("textbox",{name:"Ответ 1",exact:true}).fill("Ответ учителя");
  await page.getByRole("textbox",{name:"Описание изображения",exact:true}).fill("Историческая карта");
  const buffer=Buffer.from(await page.evaluate(()=>{
    const c=document.createElement("canvas");c.width=3400;c.height=2000;
    const ctx=c.getContext("2d")!;ctx.fillStyle="#f4f4f1";ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle="#111";ctx.font="80px sans-serif";ctx.fillText("Карта с деталями",200,600);
    return c.toDataURL("image/png").split(",")[1];
  }),"base64");
  await page.getByLabel("Изображение",{exact:true}).setInputFiles({name:"map.png",mimeType:"image/png",buffer});
  return buffer;
}

for(const size of [{width:1024,height:768},{width:1366,height:768},{width:1920,height:1080}]) {
  test("map preparation and viewer controls fit at "+size.width,async({page},info)=>{
    await page.setViewportSize(size);
    await prepare(page);
    await page.getByRole("radio",{name:"Карта / мелкие детали",exact:true}).click();
    await expect(page.getByRole("status").filter({hasText:"3200 ×"})).toBeVisible();
    await page.getByRole("button",{name:"Сохранить изображение",exact:true}).click();
    const img=page.getByRole("img",{name:"Историческая карта",exact:true});
    await expect(img).toBeVisible();
    expect(await img.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(3200);
    await page.getByRole("button",{name:"Начать показ",exact:true}).click();
    await page.getByRole("button",{name:"Начать",exact:true}).click();
    await page.locator(".board").getByRole("button",{name:"Увеличить изображение",exact:true}).click();
    const viewer=page.getByRole("dialog",{name:"Просмотр изображения",exact:true});
    await expect(viewer).toBeVisible();
    for(const button of await viewer.getByRole("button").all()) {
      const b=await button.boundingBox();expect(b!.width).toBeGreaterThanOrEqual(56);expect(b!.height).toBeGreaterThanOrEqual(56);
      expect(b!.y+b!.height).toBeLessThanOrEqual(size.height);
    }
    await viewer.getByRole("button",{name:"Увеличить",exact:true}).click();
    await expect(viewer.getByText("125%",{exact:true})).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".board").getByText("Ответ учителя",{exact:true})).toHaveCount(0);
    await page.keyboard.press("0");
    await expect(viewer.getByText("100%",{exact:true})).toBeVisible();
    if(size.width===1366) {
      const cdp=await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:500,y:400,id:1},{x:700,y:400,id:2}]});
      await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:400,y:400,id:1},{x:800,y:400,id:2}]});
      await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await expect(viewer.getByText("100%",{exact:true})).toHaveCount(0);
      const before=await viewer.locator("img").getAttribute("style");
      await page.mouse.move(650,400);await page.mouse.down();await page.mouse.move(720,450);await page.mouse.up();
      await expect(viewer.locator("img")).not.toHaveAttribute("style",before!);
      await viewer.getByRole("button",{name:"Вписать",exact:true}).click();
    }
    await page.screenshot({path:info.outputPath("map-"+size.width+".png")});
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeVisible();
  });
}

test("cancelled and failed replacement keep the previous saved image; retry succeeds",async({page})=>{
  const buffer=await prepare(page);
  await page.getByRole("button",{name:"Сохранить изображение",exact:true}).click();
  const img=page.getByRole("img",{name:"Историческая карта",exact:true});
  await expect(img).toBeVisible();const old=await img.getAttribute("src");
  await page.getByLabel("Изображение",{exact:true}).setInputFiles({name:"map.png",mimeType:"image/png",buffer});
  await page.getByRole("button",{name:"Отмена",exact:true}).click();
  expect(await img.getAttribute("src")).toBe(old);
  await page.getByLabel("Изображение",{exact:true}).setInputFiles({name:"broken.png",mimeType:"image/png",buffer:Buffer.from("invalid")});
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button",{name:"Отмена",exact:true}).click();
  await page.getByLabel("Изображение",{exact:true}).setInputFiles({name:"map.png",mimeType:"image/png",buffer});
  await page.getByRole("radio",{name:"Карта / мелкие детали",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"3200 ×"})).toBeVisible();
  await page.evaluate(()=>{
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(this.name==="scenarios")throw new DOMException("Test write failure","QuotaExceededError");return key===undefined?put.call(this,value):put.call(this,value,key);};
    (window as Window&{restore?:()=>void}).restore=()=>{IDBObjectStore.prototype.put=put;};
  });
  await page.getByRole("button",{name:"Сохранить изображение",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(await img.getAttribute("src")).toBe(old);
  await page.evaluate(()=>(window as Window&{restore?:()=>void}).restore?.());
  await page.getByRole("button",{name:"Сохранить изображение",exact:true}).click();
  await expect(img).not.toHaveAttribute("src",old!);
});

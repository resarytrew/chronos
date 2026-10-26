import {test,expect} from "@playwright/test";
import {importLesson} from "./helpers";
test.use({hasTouch:true});
for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:1024,height:768}]) {
  test("readable question and reachable touch controls at "+size.width+"x"+size.height,async({page},testInfo)=>{
    await page.setViewportSize(size);
    await importLesson(page,{title:"Читаемость на доске",activityType:"qa",tasks:[{id:"question",type:"qa",prompt:"Объясните, какие изменения в управлении государством произошли в годы правления Петра I, и приведите примеры реформ, повлиявших на дальнейшую историю России.",answer:"Обсудите реформы управления с классом."}]});
    const board=page.locator(".board");
    await expect(board.getByRole("heading")).toBeVisible();
    for(const name of ["Назад","Пауза","Завершить","Шторка","Выйти"]){
      const box=await board.getByRole("button",{name,exact:true}).boundingBox();
      expect(box).not.toBeNull();expect(box!.width).toBeGreaterThanOrEqual(56);expect(box!.height).toBeGreaterThanOrEqual(56);
      expect(box!.y+box!.height).toBeLessThanOrEqual(size.height);
    }
    expect(await board.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath("board-"+size.width+".png")});
  });
}
test("eight cards scroll while navigation stays in the board",async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await importLesson(page,{title:"Восемь карточек",activityType:"sequence",tasks:[{id:"order",type:"sequence",prompt:"Расположите события по времени",cards:Array.from({length:8},(_,i)=>({id:"c"+i,text:"Событие "+(i+1)}))}]});
  const end=await page.getByRole("button",{name:"Завершить",exact:true}).boundingBox();
  expect(end!.y+end!.height).toBeLessThanOrEqual(768);
  await expect(page.locator(".task-card")).toHaveCount(8);
});

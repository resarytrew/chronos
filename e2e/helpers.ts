import type {Page} from "@playwright/test";
import {DEFAULT_SETTINGS,type ScenarioFull} from "../src/lib/types";
export async function importLesson(page:Page,scenario:Partial<ScenarioFull>&{title:string}) {
  await page.goto("./");
  const data={format:"chronos-package",version:2,scenarios:[{id:"fixture",events:[],settings:{...DEFAULT_SETTINGS,mode:"manual",countdown:false},...scenario}],sessions:[],images:[],preferences:[],activeRuns:[]};
  await page.locator('input[type="file"]').first().setInputFiles({name:"lesson.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data))});
  await page.getByRole("button",{name:"Объединить",exact:true}).click();
  await page.getByRole("button",{name:"Провести",exact:true}).click();
  await page.getByRole("button",{name:"Начать",exact:true}).click();
}

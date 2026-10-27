import type {ActivityTask, Ask, RunItem, RunPlan, ScenarioFull, StudyOrder} from "./types";
import {orderStudyItems, shuffle, uid} from "./utils";

export type TermTask=Extract<ActivityTask,{type:"terms"}>;

/** Term pairs stay in their own task fields; dateText remains unused. */
export function buildTermsPlan(s:ScenarioFull):RunPlan {
  const tasks=s.tasks??[];
  if(!tasks.length||tasks.some(t=>t.type!=="terms"||!t.prompt.trim()||!t.answer.trim())) throw new Error("Заполните понятия и определения перед показом");
  const direction=["term-to-definition","definition-to-term","mixed"].includes(s.settings.direction)?s.settings.direction:"term-to-definition";
  let items:RunItem[]=tasks.map((t,i)=>{
    const task=t as TermTask;
    const ask:Ask=direction==="definition-to-term"?"term":direction==="mixed"&&Math.random()<0.5?"term":"definition";
    return {id:task.id,title:task.prompt,dateText:"",era:null,ask,task:structuredClone(task),studyIndex:i};
  });
  if(direction==="mixed"&&items.length>1) {
    if(items.every(it=>it.ask==="term"))items[0]={...items[0],ask:"definition"};
    if(items.every(it=>it.ask==="definition"))items[items.length-1]={...items[items.length-1],ask:"term"};
  }
  if(s.settings.shuffle)items=shuffle(items);
  return {scenarioId:s.id,title:s.title,settings:{...s.settings,direction},items};
}

export function buildTermsStudyPlan(s:ScenarioFull,order:StudyOrder):RunPlan {
  const plan=buildTermsPlan({...s,settings:{...s.settings,shuffle:false,direction:"term-to-definition",mode:"manual",countdown:false,voice:false,beep:false}});
  return {...plan,items:orderStudyItems(plan.items,order==="shuffled"?"shuffled":"sequential")};
}

/** Spreadsheet columns take priority over spaced dashes; incomplete pairs stay visible. */
export function parseTerms(text:string):TermTask[] {
  return text.split(/\r?\n/).filter(line=>line.trim()).map(line=>{
    const tab=line.indexOf("\t");
    const separator=tab>=0?null:/\s+[—–-]\s+/.exec(line);
    const start=tab>=0?tab:separator?.index??-1;
    const size=tab>=0?1:separator?.[0].length??0;
    const prompt=(start>=0?line.slice(0,start):line).trim();
    const answer=start>=0?line.slice(start+size).trim():"";
    return {id:uid(),type:"terms",prompt,answer};
  });
}

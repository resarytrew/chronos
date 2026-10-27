"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityTask, ScenarioFull, StudyOrder } from "@/lib/types";
import { api, printWorksheet } from "@/lib/client";
import { ACTIVITY_LABELS, newTask, scenarioPlan, taskError } from "@/lib/activities";
import {buildTermsStudyPlan,parseTerms} from "@/lib/terms";
import { downloadJson, uid } from "@/lib/utils";
import { useApp } from "../AppProvider";
import { Dialog, Icons, Seg, Toggle } from "../ui";
import LocalImage, { prepareImage, useImageSources } from "../LocalImage";
import MetadataFields from "./MetadataFields";

export default function ActivityEditor({initial}:{initial:ScenarioFull}) {
  const {toast,startRun,openStudy}=useApp();
  const [draft,setDraft]=useState(initial);
  const [state,setState]=useState("saved");
  const [uploading,setUploading]=useState(false);
  const [termStudyOrder,setTermStudyOrder]=useState<StudyOrder>("sequential");
  const [pasteOpen,setPasteOpen]=useState(false);
  const [pasteText,setPasteText]=useState("");
  const pastedTerms=useMemo(()=>parseTerms(pasteText),[pasteText]);
  const first=useRef(true);
  const seq=useRef(0);
  const tasks=draft.tasks??[];
  const sources=useImageSources(tasks);
  const type=draft.activityType??"qa";
  const terms=type==="terms";
  const errors=tasks.map(taskError);
  const save=async()=>{
    const n=++seq.current;setState("saving");
    try{const saved=await api.updateScenario(initial.id,draft);if(!saved)throw new Error("Набор был удалён");if(n===seq.current)setState("saved");return saved;}
    catch(e){setState("error");throw e;}
  };
  useEffect(()=>{
    if(first.current){first.current=false;return;}
    setState("dirty");
    const n=++seq.current;
    const timer=window.setTimeout(()=>{setState("saving");void api.updateScenario(initial.id,draft).then(saved=>{if(!saved)throw new Error("Набор удалён");if(n===seq.current)setState("saved");}).catch(()=>{if(n===seq.current)setState("error");});},700);
    return()=>window.clearTimeout(timer);
  },[draft,initial.id]);
  useEffect(()=>{
    const leave=(e:BeforeUnloadEvent)=>{if(state!=="saved")e.preventDefault();};
    window.addEventListener("beforeunload",leave);return()=>window.removeEventListener("beforeunload",leave);
  },[state]);
  const patch=(v:Partial<ScenarioFull>)=>setDraft(s=>({...s,...v}));
  const update=(task:ActivityTask)=>{
    const before=tasks.find(t=>t.id===task.id) as unknown as Record<string,unknown>;
    const changes=Object.fromEntries(Object.entries(task).filter(([key,value])=>before?.[key]!==value));
    setDraft(s=>({...s,tasks:s.tasks?.map(t=>t.id===task.id?{...t,...changes} as ActivityTask:t)}));
  };
  const moveTask=(i:number,d:number)=>{const a=[...tasks];if(i+d<0||i+d>=a.length)return;[a[i],a[i+d]]=[a[i+d],a[i]];patch({tasks:a});};
  const image=async(task:Extract<ActivityTask,{type:"image"}>,file:File)=>{
    setUploading(true);
    try{const asset=await prepareImage(file);setDraft(s=>({...s,tasks:s.tasks?.map(t=>t.id===task.id&&t.type==="image"?{...t,imageId:asset.id}:t)}));}
    catch(e){toast(e instanceof Error?e.message:"Не удалось прочитать изображение");}
    finally{setUploading(false);}
  };
  const run=async()=>{try{const saved=await save();const plan=scenarioPlan(saved);await api.markOpened(saved.id);startRun(plan);}catch(e){toast(e instanceof Error?e.message:"Не удалось начать показ");}};
  const study=async()=>{try{const saved=await save();const plan=buildTermsStudyPlan(saved,termStudyOrder);await api.markOpened(saved.id);openStudy(plan,termStudyOrder);}catch(e){toast(e instanceof Error?e.message:"Не удалось открыть понятия");}};
  const exportSet=async()=>{try{await save();downloadJson(draft.title+".json",await api.exportPackage([initial.id]));}catch{toast("Не удалось экспортировать набор");}};
  const print=(answers:boolean)=>{
    try{const plan=scenarioPlan(draft);if(!printWorksheet(draft.title,plan.items,answers,sources))toast("Разрешите всплывающие окна для печати");}
    catch(e){toast(e instanceof Error?e.message:"Проверьте задания");}
  };
  return <div className="mx-auto grid max-w-[1500px] gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10">
    <section className="min-w-0">
      <input className="w-full bg-transparent text-[2rem] font-bold leading-tight tracking-tight outline-none sm:text-[2.6rem]" aria-label="Название сценария" value={draft.title} onChange={e=>patch({title:e.target.value})}/>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-mute"><span>{ACTIVITY_LABELS[type]}</span><span>{state==="saved"?"изменения сохранены":state==="error"?"ошибка сохранения":state==="saving"?"сохранение…":"есть несохранённые изменения"}</span>{state==="error"&&<button className="btn" onClick={()=>void save().catch(()=>toast("Не удалось сохранить"))}>Повторить сохранение</button>}</div>
      <MetadataFields value={draft} onChange={patch}/>
      <div className="mt-5 flex flex-col gap-4">
        {!tasks.length&&<div className="card p-8 text-center text-mute">Добавьте первое задание.</div>}
        {tasks.map((task,i)=><div className="card space-y-3 p-5" key={task.id} data-task-editor={task.id}>
          <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">{terms?"Понятие":"Задание"} {i+1}</h2><div className="flex gap-2"><button className="btn btn-icon" aria-label="Задание выше" disabled={!i} onClick={()=>moveTask(i,-1)}>↑</button><button className="btn btn-icon" aria-label="Задание ниже" disabled={i===tasks.length-1} onClick={()=>moveTask(i,1)}>↓</button><button className="btn btn-icon" aria-label="Удалить задание" onClick={()=>patch({tasks:tasks.filter(t=>t.id!==task.id)})}><Icons.Trash size={20}/></button></div></div>
          <label className="block text-sm text-mute">{terms?"Понятие":"Вопрос или инструкция"}<textarea className="field mt-1" rows={terms?1:2} aria-label={(terms?"Понятие ":"Вопрос ")+(i+1)} value={task.prompt} onChange={e=>update({...task,prompt:e.target.value})}/></label>
          {task.type==="sequence"&&<>
            <p className="text-sm text-mute">Расположите карточки в правильном порядке. На доске они перемешаются; даты можно оставить в тексте.</p>
            {task.cards.map((card,j)=><div key={card.id} className="flex items-center gap-2"><span>{j+1}.</span><input className="field" aria-label={"Карточка "+(j+1)} value={card.text} onChange={e=>update({...task,cards:task.cards.map(c=>c.id===card.id?{...c,text:e.target.value}:c)})}/><button className="btn btn-icon" aria-label={"Карточка "+(j+1)+" выше"} disabled={j===0} onClick={()=>{const cards=[...task.cards];[cards[j-1],cards[j]]=[cards[j],cards[j-1]];update({...task,cards});}}>↑</button><button className="btn btn-icon" aria-label={"Карточка "+(j+1)+" ниже"} disabled={j===task.cards.length-1} onClick={()=>{const cards=[...task.cards];[cards[j+1],cards[j]]=[cards[j],cards[j+1]];update({...task,cards});}}>↓</button><button className="btn btn-icon" aria-label={"Удалить карточку "+(j+1)} disabled={task.cards.length<=3} onClick={()=>update({...task,cards:task.cards.filter(c=>c.id!==card.id)})}>×</button></div>)}
            <button className="btn" disabled={task.cards.length>=8} onClick={()=>update({...task,cards:[...task.cards,{id:uid(),text:""}]})}>Добавить карточку</button>
          </>}
          {task.type==="choice"&&<>
            <p className="text-sm text-mute">Отметьте один правильный вариант.</p>
            {task.options.map((option,j)=><div className="flex items-center gap-3" key={j}><input type="radio" className="h-6 w-6" name={task.id} aria-label={"Правильный вариант "+(j+1)} checked={task.correctIndex===j} onChange={()=>update({...task,correctIndex:j})}/><input className="field" aria-label={"Вариант "+(j+1)} value={option} onChange={e=>update({...task,options:task.options.map((o,k)=>k===j?e.target.value:o)})}/><button className="btn btn-icon" aria-label={"Удалить вариант "+(j+1)} disabled={task.options.length<=2} onClick={()=>update({...task,options:task.options.filter((_,k)=>k!==j),correctIndex:task.correctIndex===j?0:task.correctIndex>j?task.correctIndex-1:task.correctIndex})}>×</button></div>)}
            <button className="btn" disabled={task.options.length>=4} onClick={()=>update({...task,options:[...task.options,""]})}>Добавить вариант</button>
          </>}
          {task.type==="image"&&<>
            <label className="block">Изображение JPEG, PNG или WebP<input type="file" aria-label="Изображение" accept="image/jpeg,image/png,image/webp" className="field mt-1" disabled={uploading} onChange={e=>{if(e.target.files?.[0])void image(task,e.target.files[0]);e.target.value="";}}/></label>
            {uploading&&<p role="status">Подготовка изображения…</p>}
            {task.imageId&&<LocalImage id={task.imageId} alt={task.alt} caption={task.caption}/>}
            <label className="block text-sm text-mute">Описание изображения<input className="field mt-1" aria-label="Описание изображения" value={task.alt} onChange={e=>update({...task,alt:e.target.value})}/></label>
            <label className="block text-sm text-mute">Подпись (видна ученикам)<input className="field mt-1" aria-label="Подпись изображения" value={task.caption??""} onChange={e=>update({...task,caption:e.target.value})}/></label>
            <label className="block text-sm text-mute">Источник (необязательно)<input className="field mt-1" aria-label="Источник изображения" value={task.source??""} onChange={e=>update({...task,source:e.target.value})}/></label>
          </>}
          {(task.type==="qa"||task.type==="image"||task.type==="terms")&&<label className="block text-sm text-mute">{terms?"Определение":"Эталонный ответ"}<textarea className="field mt-1" rows={terms?3:2} aria-label={(terms?"Определение ":"Ответ ")+(i+1)} value={task.answer} onChange={e=>update({...task,answer:e.target.value})}/></label>}
          {!terms&&<label className="block text-sm text-mute">Пояснение после проверки<textarea className="field mt-1" rows={2} aria-label={"Пояснение "+(i+1)} value={task.explanation??""} onChange={e=>update({...task,explanation:e.target.value})}/></label>}
          {errors[i]&&<p className="text-sm text-[#8c3f3f]">{errors[i]}</p>}
        </div>)}
      </div>
      <button className="btn btn-primary btn-lg mt-5" onClick={()=>{if(type!=="dictation")patch({tasks:[...tasks,newTask(type)]});}}><Icons.Plus/>{terms?"Добавить понятие":"Добавить задание"}</button>
      {terms&&<button className="btn btn-lg mt-5 ml-3" onClick={()=>{setPasteText("");setPasteOpen(true);}}><Icons.Paste/>Вставить список понятий</button>}
    </section>
    <aside className="card flex flex-col gap-4 p-5 lg:sticky lg:top-6 lg:self-start">
      <h2 className="text-2xl font-semibold">{terms?"Терминологический диктант":"Настройки показа"}</h2>
      {terms?<>
        <div><p className="label-mute mb-2">Что показывать</p><Seg value={["term-to-definition","definition-to-term","mixed"].includes(draft.settings.direction)?draft.settings.direction:"term-to-definition"} onChange={direction=>patch({settings:{...draft.settings,direction}})} options={[{value:"term-to-definition",label:"Понятие → определение"},{value:"definition-to-term",label:"Определение → понятие"},{value:"mixed",label:"Смешанный"}]} className="flex-col"/></div>
        <div><p className="label-mute mb-2">Смена экрана</p><Seg value={draft.settings.mode} onChange={mode=>patch({settings:{...draft.settings,mode}})} options={[{value:"auto",label:"Автоматически"},{value:"manual",label:"Вручную"}]}/></div>
        {draft.settings.mode==="auto"&&<label>Интервал: {draft.settings.intervalSec} сек<input className="range mt-2" type="range" aria-label="Интервал смены" min={3} max={30} value={draft.settings.intervalSec} onChange={e=>patch({settings:{...draft.settings,intervalSec:Number(e.target.value)}})}/></label>}
      </>:<p className="text-mute">Переключение вручную: ученики работают с доской в своём темпе.</p>}
      <Seg value={draft.settings.theme} onChange={theme=>patch({settings:{...draft.settings,theme}})} options={[{value:"light",label:"Светлая"},{value:"dark",label:"Тёмная"}]}/>
      <Seg value={draft.settings.fontScale} onChange={fontScale=>patch({settings:{...draft.settings,fontScale}})} options={[{value:"m",label:"Текст M"},{value:"l",label:"L"},{value:"xl",label:"XL"}]}/>
      <Toggle on={draft.settings.shuffle} onChange={shuffle=>patch({settings:{...draft.settings,shuffle}})} label="Случайный порядок заданий"/>
      <Toggle on={draft.settings.countdown} onChange={countdown=>patch({settings:{...draft.settings,countdown}})} label="Обратный отсчёт 3–2–1"/>
      <button className="btn btn-primary btn-lg" disabled={!tasks.length||errors.some(Boolean)||uploading} onClick={run}><Icons.Play/>Начать показ</button>
      <p className="text-sm text-mute">Предпросмотр доступен перед началом показа.</p>
      {terms&&<div className="rounded-2xl border border-line p-4">
        <h3 className="text-lg font-semibold">Изучать понятия</h3>
        <p className="mt-1 mb-3 text-sm text-mute">Понятие слева, определение открывается справа по нажатию.</p>
        <Seg value={termStudyOrder} onChange={setTermStudyOrder} options={[{value:"sequential",label:"Последовательно"},{value:"shuffled",label:"Вперемешку"}]}/>
        <button className="btn btn-lg w-full mt-3" disabled={!tasks.length||errors.some(Boolean)} onClick={study}><Icons.Eye size={22}/>Изучать понятия</button>
      </div>}
      <button className="btn" onClick={exportSet} disabled={uploading}>Экспорт набора</button>
      <button className="btn" onClick={()=>print(false)}>Печать заданий / PDF</button>
      <button className="btn" onClick={()=>print(true)}>Печать ответов / PDF</button>
    </aside>
    {terms&&<Dialog open={pasteOpen} onClose={()=>setPasteOpen(false)} title="Вставить список понятий" wide footer={<><button className="btn" onClick={()=>setPasteOpen(false)}>Отмена</button><button className="btn btn-primary" disabled={!pastedTerms.length} onClick={()=>{patch({tasks:[...tasks,...pastedTerms]});setPasteOpen(false);}}>Добавить {pastedTerms.length||""}</button></>}>
      <p className="mb-3 text-mute">Одна пара в строке: понятие и определение разделены табуляцией (из таблицы) или тире с пробелами. Неполные строки сохранятся для редактирования.</p>
      <textarea className="field" rows={7} aria-label="Список понятий" placeholder={"Понятие\tЕго определение"} value={pasteText} onChange={e=>setPasteText(e.target.value)}/>
      <div className="mt-4 max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Понятие</th><th className="p-2">Определение</th></tr></thead><tbody>{pastedTerms.map(t=><tr key={t.id} className="border-t border-line"><td className="p-2">{t.prompt||"— нет понятия"}</td><td className="p-2">{t.answer||"— нет определения"}</td></tr>)}</tbody></table></div>
    </Dialog>}
  </div>;
}

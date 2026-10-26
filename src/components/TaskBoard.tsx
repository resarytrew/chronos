"use client";
import { useState } from "react";
import type { ActivityTask, TaskResponse } from "@/lib/types";
import { taskAnswer } from "@/lib/activities";
import LocalImage from "./LocalImage";

export default function TaskBoard({task,response,onChange,disabled=false}:{task:ActivityTask;response:TaskResponse;onChange:(r:TaskResponse)=>void;disabled?:boolean}) {
  const [drag,setDrag]=useState<string|null>(null);
  const order=response.order??[];
  const checked=Boolean(response.checked);
  const move=(id:string,position:number)=>{
    if(disabled)return;
    const from=order.indexOf(id);if(from<0||position<0||position>=order.length)return;
    const next=[...order];next.splice(from,1);next.splice(position,0,id);
    onChange({...response,order:next,checked:false});
  };
  const correct=task.type==="sequence"?task.cards.every((c,i)=>order[i]===c.id):task.type==="choice"?response.selected===task.correctIndex:true;
  return <div className="mx-auto w-full max-w-5xl space-y-4 py-4 text-left">
    <h2 className="task-prompt text-center text-[clamp(1.6rem,3.3vw,3rem)] font-semibold leading-tight break-words">{task.prompt}</h2>
    {task.type==="image"&&<LocalImage id={task.imageId} alt={task.alt} caption={task.caption}/>}
    {task.type==="sequence"&&<ol className="space-y-2">{order.map((id,i)=>{
      const card=task.cards.find(c=>c.id===id);
      return <li key={id} draggable={!disabled} onDragStart={()=>setDrag(id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag)move(drag,i);setDrag(null);}} onDragEnd={()=>setDrag(null)} className="task-card flex items-center gap-3 rounded-2xl border p-3">
        <span className="text-xl tabular-nums">{i+1}.</span><span className="flex-1 text-[clamp(1.1rem,2vw,1.8rem)]">{card?.text}</span>
        <button className="b-btn" disabled={disabled||i===0} aria-label={"Поднять карточку "+(i+1)} onClick={()=>move(id,i-1)}>↑</button>
        <button className="b-btn" disabled={disabled||i===order.length-1} aria-label={"Опустить карточку "+(i+1)} onClick={()=>move(id,i+1)}>↓</button>
      </li>;
    })}</ol>}
    {task.type==="choice"&&<div className="grid gap-3 sm:grid-cols-2">{task.options.map((option,i)=><button key={i} disabled={disabled} aria-pressed={response.selected===i} className="task-option rounded-2xl border p-5 text-left text-[clamp(1.2rem,2.4vw,2rem)]" data-selected={response.selected===i} onClick={()=>onChange({...response,selected:i,checked:false})}>{i+1}. {option}</button>)}</div>}
    <div className="text-center"><button className="b-btn b-outline" disabled={disabled||(task.type==="choice"&&response.selected===undefined)} onClick={()=>onChange({...response,checked:!checked})}>{checked?"Скрыть ответ":task.type==="choice"||task.type==="sequence"?"Проверить":"Показать ответ"}</button></div>
    {checked&&<div className="rounded-2xl border p-5 text-xl" role="status">
      {(task.type==="sequence"||task.type==="choice")&&<p className="mb-2 font-semibold">{correct?"Верно":"Проверьте ответ ещё раз"}</p>}
      <p className="whitespace-pre-line">{taskAnswer(task)}</p>
      {task.explanation&&<p className="mt-3">{task.explanation}</p>}
      {task.type==="image"&&task.source&&/^https?:\/\//i.test(task.source)&&<a className="mt-3 block text-base underline" href={task.source} target="_blank" rel="noreferrer">Источник изображения</a>}
    </div>}
  </div>;
}

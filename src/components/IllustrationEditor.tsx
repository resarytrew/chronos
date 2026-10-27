"use client";
import type {IllustratedQuestion,ImageAsset} from "@/lib/types";
import ImageUpload from "./ImageUpload";
import LocalImage from "./LocalImage";
import {Seg} from "./ui";
import {useEffect} from "react";

export function useQuestionFocus(scenarioId:string) {
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("focus");if(!id)return;
    const el=document.querySelector<HTMLElement>('[data-question-editor="'+CSS.escape(id)+'"]');
    el?.querySelectorAll("details").forEach(d=>{d.open=true;});
    el?.scrollIntoView({block:"center"});
    el?.querySelector<HTMLInputElement>('input[aria-label="Описание иллюстрации"]')?.focus({preventScroll:true});
  },[scenarioId]);
}

export default function IllustrationEditor({value,onChange,onSave}:{value:IllustratedQuestion;onChange:(v:IllustratedQuestion)=>void;onSave:(asset:ImageAsset)=>Promise<void>}) {
  const i=value.illustration;
  return <details className="rounded-xl border border-line p-3 illustration-editor">
    <summary className="cursor-pointer py-2">Иллюстрация · {value.questionDisplay==="image"?"Изображение":"Текст"}</summary>
    <div className="mt-3 space-y-3">
      <Seg value={value.questionDisplay??"text"} onChange={questionDisplay=>onChange({questionDisplay})} options={[{value:"text",label:"Текст"},{value:"image",label:"Изображение"}]}/>
      <p className="text-sm text-mute">Изображение заменит вопрос при любом направлении диктанта. Текстовые поля нужны для ответов.</p>
      <ImageUpload onSave={onSave}/>
      {i&&<>
        <LocalImage id={i.imageId} alt={i.alt}/>
        <label className="block text-sm text-mute">Альтернативное описание<input className="field mt-1" aria-label="Описание иллюстрации" value={i.alt} onChange={e=>onChange({illustration:{...i,alt:e.target.value}})}/></label>
        <label className="block text-sm text-mute">Источник (после раскрытия ответа)<input className="field mt-1" aria-label="Источник иллюстрации" value={i.source??""} onChange={e=>onChange({illustration:{...i,source:e.target.value}})}/></label>
        <button className="btn" type="button" onClick={()=>onChange({illustration:undefined,questionDisplay:"text"})}>Удалить иллюстрацию</button>
      </>}
      {value.questionDisplay==="image"&&!i&&<p className="text-sm text-[#8c3f3f]">Прикрепите изображение перед показом.</p>}
    </div>
  </details>;
}

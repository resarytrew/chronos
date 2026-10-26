"use client";
import type { ScenarioMeta } from "@/lib/types";
export default function MetadataFields({value,onChange}:{value:ScenarioMeta & {description?:string|null};onChange:(v:ScenarioMeta & {description?:string|null})=>void}) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="text-sm text-mute">Класс (необязательно)<input className="field mt-1" aria-label="Класс" placeholder="Например, 7А" value={value.className??""} onChange={e=>onChange({className:e.target.value})}/></label>
    <label className="text-sm text-mute">Раздел истории<input className="field mt-1" aria-label="Раздел истории" placeholder="Например, История России" value={value.section??""} onChange={e=>onChange({section:e.target.value})}/></label>
    <label className="text-sm text-mute sm:col-span-2">Описание<textarea className="field mt-1" rows={2} aria-label="Описание набора" value={value.description??""} onChange={e=>onChange({description:e.target.value})}/></label>
  </div>;
}

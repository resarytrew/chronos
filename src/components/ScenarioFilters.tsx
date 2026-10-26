"use client";
import type { ScenarioMeta, ScenarioSummary } from "@/lib/types";
import { ACTIVITY_LABELS } from "@/lib/activities";

export interface Filters { query: string; activityType: string; className: string; section: string; view: string }
export const EMPTY_FILTERS: Filters = {query:"",activityType:"",className:"",section:"",view:"all"};
export function filterScenarios<T extends ScenarioMeta & { title:string; description?:string|null; searchText?:string; events?:unknown[]; tasks?:unknown[] }>(items:T[],f:Filters):T[] {
  const q=f.query.trim().toLowerCase();
  const selected=items.filter(s=>
    (!q || [s.title,s.description,s.searchText,JSON.stringify([s.events,s.tasks])].join(" ").toLowerCase().includes(q)) &&
    (!f.activityType || (s.activityType ?? "dictation")===f.activityType) &&
    (!f.className || s.className===f.className) && (!f.section || s.section===f.section) &&
    (f.view!=="favorites" || s.favorite) && (f.view!=="recent" || s.lastOpenedAt));
  return f.view==="recent" ? selected.sort((a,b)=>(b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? "")) : selected;
}
export default function ScenarioFilters({items,value,onChange}:{items:(ScenarioMeta | ScenarioSummary)[];value:Filters;onChange:(f:Filters)=>void}) {
  const field=(key:keyof Filters,v:string)=>onChange({...value,[key]:v});
  const classes=[...new Set(items.map(s=>s.className).filter((v):v is string=>Boolean(v)))].sort();
  const sections=[...new Set(items.map(s=>s.section).filter((v):v is string=>Boolean(v)))].sort();
  return <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
    <input className="field" aria-label="Поиск по названию и содержимому" placeholder="Поиск по содержимому…" value={value.query} onChange={e=>field("query",e.target.value)}/>
    <select className="field" aria-label="Тип занятия" value={value.activityType} onChange={e=>field("activityType",e.target.value)}><option value="">Все типы</option>{Object.entries(ACTIVITY_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
    <select className="field" aria-label="Фильтр по классу" value={value.className} onChange={e=>field("className",e.target.value)}><option value="">Все классы</option>{classes.map(v=><option key={v}>{v}</option>)}</select>
    <select className="field" aria-label="Фильтр по разделу" value={value.section} onChange={e=>field("section",e.target.value)}><option value="">Все разделы</option>{sections.map(v=><option key={v}>{v}</option>)}</select>
    <select className="field" aria-label="Порядок наборов" value={value.view} onChange={e=>field("view",e.target.value)}><option value="all">Все наборы</option><option value="favorites">Избранное</option><option value="recent">Недавно открытые</option></select>
  </div>;
}

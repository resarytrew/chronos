"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ActivityType, ScenarioSummary } from "@/lib/types";
import { downloadJson, fmtDate } from "@/lib/utils";
import { api } from "@/lib/client";
import { scenarioPlan, ACTIVITY_LABELS, ENABLED_ACTIVITIES } from "@/lib/activities";
import type { TransferFile } from "@/lib/transfer";
import { useApp } from "./AppProvider";
import { Confirm, Icons, Menu } from "./ui";
import ScenarioFilters, { EMPTY_FILTERS, filterScenarios } from "./ScenarioFilters";

export default function ScenarioList({ initial }: { initial: ScenarioSummary[] }) {
  const router = useRouter();
  const { toast, startRun } = useApp();
  const [items,setItems] = useState(initial);
  const [busy,setBusy] = useState(false);
  const [toDelete,setToDelete] = useState<ScenarioSummary|null>(null);
  const [filters,setFilters] = useState(EMPTY_FILTERS);
  const [activityType,setActivityType] = useState<ActivityType>("dictation");
  const fileRef=useRef<HTMLInputElement>(null);
  const backupRef=useRef<HTMLInputElement>(null);
  const [pending,setPending]=useState<TransferFile|null>(null);
  const [backup,setBackup]=useState<{exportedAt:string|null;changed:boolean}>({exportedAt:null,changed:false});
  useEffect(()=>setItems(initial),[initial]);
  useEffect(()=>{void api.backupStatus().then(setBackup).catch(()=>{});},[items]);
  const reload=async()=>setItems(await api.listScenarios());
  const fail=(e:unknown)=>toast(e instanceof Error ? e.message : "Не удалось выполнить действие");
  const create=async(quick:boolean)=>{
    setBusy(true);
    try {
      const s=await api.createScenario({title:quick?"Новый диктант":"Новая тема",activityType:quick?"dictation":activityType,settings:activityType==="dictation"?undefined:{mode:"manual",voice:false}});
      router.push("/scenarios/editor/?id="+s.id+(quick?"&paste=1":""));
    } catch(e) { fail(e); } finally {setBusy(false);}
  };
  const run=async(id:string)=>{
    try {
      const s=await api.getScenario(id); if(!s) throw new Error("Набор не найден");
      const plan=scenarioPlan(s); if(!plan.items.length) throw new Error("В наборе нет заполненных заданий");
      await api.markOpened(id); startRun(plan,()=>{void reload();});
    } catch(e) {fail(e);}
  };
  const favorite=async(s:ScenarioSummary)=>{
    try {await api.updateScenario(s.id,{favorite:!s.favorite});await reload();}catch(e){fail(e);}
  };
  const duplicate=async(id:string)=>{
    try {const s=await api.getScenario(id);if(!s)return;await api.createScenario({...s,title:s.title+" (копия)",favorite:false});await reload();toast("Набор скопирован");}catch(e){fail(e);}
  };
  const remove=async(id:string)=>{try{await api.deleteScenario(id);await reload();toast("Набор удалён");}catch(e){fail(e);}};
  const exportSets=async()=>{try{downloadJson("chronos-sets.json",await api.exportPackage());}catch(e){fail(e);}};
  const exportBackup=async()=>{
    try {downloadJson("chronos-backup-"+new Date().toISOString().slice(0,10)+".json",await api.exportAll());await api.noteBackupExport();setBackup(await api.backupStatus());toast("Копия подготовлена. Сохраните скачанный файл.");}catch(e){fail(e);}
  };
  const read=async(file:File,full=false)=>{
    try {if(file.size>60_000_000) throw new Error("Файл слишком большой (максимум 60 МБ)");
      setPending(api.inspectTransfer(JSON.parse(await file.text()),full?"chronos-backup":undefined));
    }catch(e){fail(e);}
  };
  const restore=async(mode:"merge"|"replace")=>{
    if(!pending)return;
    setBusy(true);
    try {const result=await api.importAll(pending,mode);await reload();setPending(null);toast("Добавлено наборов: "+result.scenarios+", показов: "+result.sessions);if(pending.activeRuns.length) window.location.reload();}
    catch(e){fail(e);}finally{setBusy(false);}
  };
  const filtered=filterScenarios(items,filters);
  return <div className="mx-auto max-w-[1100px] px-5 py-6 sm:px-8 lg:px-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-[2.2rem] font-bold tracking-tight sm:text-[2.6rem]">Сценарии</h1><p className="mt-1 text-mute">Ваши занятия. Подготовьте набор или сразу начните показ.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={()=>fileRef.current?.click()}><Icons.Upload size={20}/>Импорт</button>
        <button className="btn" onClick={exportSets} disabled={!items.length}><Icons.Download size={20}/>Экспорт</button>
        <button className="btn" onClick={exportBackup}><Icons.Download size={20}/>Резервная копия</button>
        <button className="btn" onClick={()=>backupRef.current?.click()}><Icons.Upload size={20}/>Восстановить</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>{if(e.target.files?.[0])void read(e.target.files[0]);e.target.value="";}}/>
        <input ref={backupRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>{if(e.target.files?.[0])void read(e.target.files[0],true);e.target.value="";}}/>
      </div>
    </div>
    <p className="mt-3 text-sm text-mute">{backup.exportedAt?"Последняя копия: "+fmtDate(backup.exportedAt):"Резервная копия ещё не создана."}{backup.changed?" Есть изменения — сохраните копию перед переносом на другой компьютер.":""}</p>
    {ENABLED_ACTIVITIES.length>1 && <label className="mt-5 block max-w-md">Тип нового занятия<select aria-label="Тип нового занятия" className="field mt-2" value={activityType} onChange={e=>setActivityType(e.target.value as ActivityType)}>{ENABLED_ACTIVITIES.map(t=><option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>)}</select></label>}
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <button className="card flex items-center gap-4 p-5 text-left transition hover:border-ink" onClick={()=>create(true)} disabled={busy}>
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-ink text-white"><Icons.Paste size={26}/></span>
        <span><span className="block text-[1.25rem] font-semibold">Быстрый диктант</span><span className="block text-mute">Вставить список из документа и сразу провести</span></span>
      </button>
      <button className="card flex items-center gap-4 p-5 text-left transition hover:border-ink" onClick={()=>create(false)} disabled={busy}>
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-line"><Icons.Plus size={26}/></span>
        <span><span className="block text-[1.25rem] font-semibold">Новая тема</span><span className="block text-mute">{ACTIVITY_LABELS[activityType]}</span></span>
      </button>
    </div>
    <ScenarioFilters items={items} value={filters} onChange={setFilters}/>
    <div className="mt-6 flex flex-col gap-2.5">
      {!filtered.length && <div className="card px-6 py-12 text-center"><div className="text-[1.3rem] font-semibold">{items.length?"Ничего не найдено":"Сценариев пока нет"}</div><p className="mt-1 text-mute">{items.length?"Измените поиск или фильтры.":"Создайте занятие или возьмите готовый набор в библиотеке."} <Link href="/library/" className="underline">Библиотека</Link></p></div>}
      {filtered.map(s=><div key={s.id} className="card flex flex-wrap items-center gap-3 p-3 pl-5 transition hover:border-ink sm:gap-4">
        <button className="btn btn-ghost btn-icon" aria-label={s.favorite?"Убрать из избранного":"В избранное"} onClick={()=>favorite(s)}>{s.favorite?"★":"☆"}</button>
        <Link href={"/scenarios/editor/?id="+s.id} className="min-w-0 flex-1 py-2">
          <div className="truncate text-[1.25rem] font-semibold">{s.title}</div>
          <div className="mt-0.5 text-[0.95rem] text-mute">{ACTIVITY_LABELS[s.activityType??"dictation"]} · {s.eventCount} заданий{s.className?" · "+s.className+" класс":""}{s.section?" · "+s.section:""} · {fmtDate(s.updatedAt)}</div>
        </Link>
        <button className="btn btn-primary" onClick={()=>run(s.id)}><Icons.Play size={20}/>Провести</button>
        <Menu trigger={<button className="btn btn-ghost btn-icon" aria-label="Действия"><Icons.More/></button>} items={[
          {label:"Открыть",onClick:()=>router.push("/scenarios/editor/?id="+s.id)},
          {label:"Дублировать",onClick:()=>duplicate(s.id)},
          {label:"Экспорт набора",onClick:async()=>{try{downloadJson(s.title+".json",await api.exportPackage([s.id]));}catch(e){fail(e);}}},
          {label:"Удалить",onClick:()=>setToDelete(s),danger:true},
        ]}/>
      </div>)}
    </div>
    <Confirm open={Boolean(toDelete)} onClose={()=>setToDelete(null)} title="Удалить набор?" text={toDelete?.title} onConfirm={()=>toDelete&&remove(toDelete.id)}/>
    <Confirm open={Boolean(pending)} onClose={()=>{if(!busy)setPending(null);}} title={pending?.format==="chronos-backup"?"Восстановить резервную копию?":"Импортировать наборы?"}
      text={pending?"Наборов: "+pending.scenarios.length+", показов: "+pending.sessions.length+", изображений: "+pending.images.length+". "+(pending.format==="chronos-backup"?"«Объединить» сохранит текущие данные; «Заменить» удалит их.":"Текущие данные сохранятся."):""}
      onConfirm={()=>!busy&&void restore("merge")} confirmLabel={busy?"Сохранение…":"Объединить"}
      extraAction={pending?.format==="chronos-backup"?{label:"Заменить данные",onClick:()=>{if(!busy)void restore("replace");},danger:true}:undefined}/>
  </div>;
}

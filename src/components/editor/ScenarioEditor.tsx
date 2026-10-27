"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventItem, ImageAsset, ScenarioFull, ScenarioSettings, Selection, StudyOrder } from "@/lib/types";
import {
  analyzeEvents,
  buildRunPlan,
  buildStudyPlan,
  copyText,
  eventsToText,
  eventsWord,
  parseYear,
  parseDateSort,
  shuffle,
  sortByDate,
  uid,
  usableEvents,
  downloadJson,
  type ParsedLine,
} from "@/lib/utils";
import { eraByYear } from "@/lib/eras";
import { api, printEventList, printWorksheet, speechSupported } from "@/lib/client";
import MetadataFields from "./MetadataFields";
import { useApp } from "@/components/AppProvider";
import { Confirm, Icons, Menu } from "@/components/ui";
import EventRow from "./EventRow";
import SettingsPanel from "./SettingsPanel";
import IllustrationEditor,{useQuestionFocus} from "../IllustrationEditor";
import {useImageSources} from "../LocalImage";
import { QuickPasteDialog, VariantsDialog } from "./Dialogs";

type SaveState = "saved" | "dirty" | "saving" | "error";

function newEvent(partial?: Partial<EventItem>): EventItem {
  const dateText = partial?.dateText ?? "";
  const yearSort = parseYear(dateText);
  return {
    id: uid(),
    dateText,
    title: partial?.title ?? "",
    yearSort,
    sortKey: parseDateSort(dateText),
    era: partial?.era ?? eraByYear(yearSort),
  };
}

export default function ScenarioEditor({ initial, autoPaste }: { initial: ScenarioFull; autoPaste?: boolean }) {
  useQuestionFocus(initial.id);
  const router = useRouter();
  const { startRun, openStudy, toast } = useApp();

  const [title, setTitle] = useState(initial.title);
  const [meta,setMeta]=useState({className:initial.className,section:initial.section,description:initial.description});
  const [events, setEvents] = useState<EventItem[]>(initial.events);
  const [settings, setSettings] = useState<ScenarioSettings>(initial.settings);
  const [selection, setSelection] = useState<Selection>({ type: "all" });
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [pasteOpen, setPasteOpen] = useState(Boolean(autoPaste));
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [voiceOk, setVoiceOk] = useState(false);

  const firstRender = useRef(true);
  const saveSeq = useRef(0);
  const focusId = useRef<string | null>(null);

  useEffect(() => setVoiceOk(speechSupported()), []);
  useEffect(() => {
    if (!autoPaste) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("paste");
    window.history.replaceState(window.history.state, "", url);
  }, [autoPaste]);

  /* ---------- autosave ---------- */
  const saveTimer=useRef<number|undefined>(undefined);
  const sources=useImageSources(events);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("dirty");
    const seq = ++saveSeq.current;
    const t = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const saved=await api.updateScenario(initial.id, { title, settings, events, ...meta });
        if(!saved) throw new Error("Набор удалён");
        if (seq === saveSeq.current) setSaveState("saved");
      } catch {
        if (seq === saveSeq.current) setSaveState("error");
      }
    }, 800);
    saveTimer.current=t;
    return () => window.clearTimeout(t);
  }, [title, settings, events, initial.id, meta]);

  const saveNow=async()=>{
    const seq=++saveSeq.current;setSaveState("saving");
    try{const saved=await api.updateScenario(initial.id,{title,settings,events,...meta});if(!saved)throw new Error("Набор удалён");if(seq===saveSeq.current)setSaveState("saved");return saved;}
    catch(e){setSaveState("error");throw e;}
  };

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [saveState]);

  /* ---------- focus newly added rows ---------- */

  useEffect(() => {
    if (!focusId.current) return;
    const el = document.querySelector<HTMLInputElement>(`[data-event-id="${focusId.current}"] input[data-field="date"]`);
    focusId.current = null;
    el?.focus();
  }, [events]);

  /* ---------- event operations ---------- */

  const updateEvent = useCallback((id: string, patch: Partial<EventItem>) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...patch };
        if (patch.dateText !== undefined) {
          const oldAuto = eraByYear(e.yearSort);
          next.yearSort = parseYear(patch.dateText);
          next.sortKey = parseDateSort(patch.dateText);
          if (e.era === null || e.era === oldAuto) next.era = eraByYear(next.yearSort);
        }
        return next;
      }),
    );
  }, []);

  const deleteEvent = useCallback((id: string) => setEvents((prev) => prev.filter((e) => e.id !== id)), []);
  const saveIllustration=async(id:string,asset:ImageAsset)=>{
    window.clearTimeout(saveTimer.current);++saveSeq.current;
    const attach=(e:EventItem)=>e.id===id?{...e,illustration:{alt:"",...e.illustration,imageId:asset.id}}:e;
    const saved=await api.updateScenario(initial.id,{title,settings,events:events.map(attach),...meta},asset);
    if(!saved)throw new Error("Набор был удалён");
    setEvents(p=>p.map(attach));
  };

  const moveEvent = useCallback((id: string, dir: -1 | 1) => {
    setEvents((prev) => {
      const i = prev.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const a = [...prev];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  }, []);

  const addEvent = useCallback((afterId?: string) => {
    const ev = newEvent();
    focusId.current = ev.id;
    setEvents((prev) => {
      if (!afterId) return [...prev, ev];
      const i = prev.findIndex((e) => e.id === afterId);
      const a = [...prev];
      a.splice(i + 1, 0, ev);
      return a;
    });
  }, []);

  const onEnter = useCallback(
    (id: string) => {
      const i = events.findIndex((e) => e.id === id);
      const isLast = i === events.length - 1;
      if (isLast && events[i] && !events[i].title.trim() && !events[i].dateText.trim()) return;
      addEvent(id);
    },
    [events, addEvent],
  );

  const applyPaste = (rows: ParsedLine[], mode: "append" | "replace") => {
    const fresh = rows.map((r) => newEvent({ dateText: r.dateText, title: r.title }));
    setEvents((prev) => (mode === "replace" ? fresh : [...prev.filter((e) => e.title.trim() || e.dateText.trim()), ...fresh]));
    toast(`Добавлено: ${eventsWord(fresh.length)}`);
  };

  /* ---------- drag & drop ---------- */

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    setEvents((prev) => {
      const from = prev.findIndex((e) => e.id === dragId);
      const to = prev.findIndex((e) => e.id === targetId);
      if (from < 0 || to < 0) return prev;
      const a = [...prev];
      const [moved] = a.splice(from, 1);
      a.splice(to, 0, moved);
      return a;
    });
    setDragId(null);
    setOverId(null);
  };

  /* ---------- derived ---------- */

  const warnings = useMemo(() => analyzeEvents(events), [events]);
  const warnIds = useMemo(() => new Set(warnings.flatMap((w) => w.ids)), [warnings]);
  const usable = usableEvents(events);
  const hasEmpty = warnings.some((w) => w.kind === "empty");

  const planForVariants = useMemo(
    () => (variantsOpen ? buildRunPlan({ scenarioId: initial.id, title, events, settings: { ...settings, shuffle: false }, selection }).items : []),
    [variantsOpen, initial.id, title, events, settings, selection],
  );

  const saveLabel =
    saveState === "saved" ? "изменения сохранены" : saveState === "saving" ? "сохранение…" : saveState === "dirty" ? "есть несохранённые изменения" : "ошибка сохранения";

  /* ---------- actions ---------- */

  const start = async () => {
    const plan = buildRunPlan({ scenarioId: initial.id, title, events, settings, selection });
    if (!plan.items.length) {
      toast("Нет событий для показа");
      return;
    }
    try{await saveNow();await api.markOpened(initial.id);startRun(plan);}catch{toast("Не удалось сохранить набор. Повторите сохранение перед показом.");}
  };

  const duplicate = async () => {
    const copy = await api.createScenario({
      title: `${title} (копия)`,
      settings,
      ...meta,
      events: events.map((e) => ({ dateText: e.dateText, title: e.title, era: e.era,illustration:e.illustration,questionDisplay:e.questionDisplay })),
    });
    toast("Сценарий скопирован");
    router.push(`/scenarios/editor/?id=${copy.id}`);
  };

  const study=async(order:StudyOrder)=>{
    const plan=buildStudyPlan({scenarioId:initial.id,title,events,settings,selection},order);
    if(!plan.items.length){toast("Нет заполненных дат для изучения");return;}
    try{await saveNow();await api.markOpened(initial.id);openStudy(plan,order);}
    catch{toast("Не удалось сохранить набор. Повторите сохранение.");}
  };

  const remove = async () => {
    await api.deleteScenario(initial.id);
    toast("Сценарий удалён");
    router.push("/");
  };

  const menuItems = [
    { label: "Дублировать сценарий", icon: <Icons.Duplicate size={20} />, onClick: duplicate },
    {
      label: "Копировать список",
      icon: <Icons.Copy size={20} />,
      onClick: async () => toast((await copyText(`${title}\n${eventsToText(usable)}`)) ? "Список скопирован" : "Не удалось скопировать"),
    },
    { label: "Печать списка дат", icon: <Icons.Print size={20} />, onClick: () => printEventList(title, usable) || toast("Разрешите всплывающие окна") },
    { label: "Печать листа заданий", icon: <Icons.Print size={20} />, onClick: () => printWorksheet(title, buildRunPlan({scenarioId:initial.id,title,events,settings,selection}).items, false,sources) || toast("Разрешите всплывающие окна") },
    { label: "Печать ключа ответов", icon: <Icons.Print size={20} />, onClick: () => printWorksheet(title, buildRunPlan({scenarioId:initial.id,title,events,settings,selection}).items, true,sources) || toast("Разрешите всплывающие окна") },
    {
      label: "Экспорт в JSON",
      icon: <Icons.Download size={20} />,
      onClick: async () => {try{await saveNow();downloadJson(title+".json",await api.exportPackage([initial.id]));}catch{toast("Не удалось экспортировать набор");}},
    },
    { label: "Удалить сценарий", icon: <Icons.Trash size={20} />, onClick: () => setDeleteOpen(true), danger: true },
  ];

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-10">
      <section className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              className="w-full bg-transparent text-[2rem] font-bold leading-tight tracking-tight outline-none sm:text-[2.6rem]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название темы"
              aria-label="Название сценария"
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[1rem] text-mute">
              <span>{eventsWord(events.length)}</span>
              <span>·</span>
              <span className={saveState === "error" ? "text-[#8c3f3f]" : ""}>{saveLabel}</span>
              {saveState === "error" && <button className="btn btn-sm" onClick={()=>void saveNow().catch(()=>toast("Не удалось сохранить набор"))}>Повторить сохранение</button>}
              {warnings.map((w) => (
                <span key={w.kind} className="inline-flex items-center gap-1 rounded-full border border-[#c9a86a] px-2.5 py-0.5 text-sm text-[#7a5a14]">
                  <Icons.Alert size={14} />
                  {w.message}
                </span>
              ))}
            </div>
          </div>
          <Menu
            trigger={
              <button type="button" className="btn btn-icon" aria-label="Действия со сценарием">
                <Icons.More />
              </button>
            }
            items={menuItems}
          />
        </div>

        <MetadataFields value={meta} onChange={patch=>setMeta(m=>({...m,...patch}))}/>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => setEvents((p) => sortByDate(p))} disabled={events.length < 2}>
            <Icons.Sort size={18} />
            По дате
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setEvents((p) => shuffle(p))} disabled={events.length < 2}>
            <Icons.Shuffle size={18} />
            Перемешать
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setEvents((p) => p.map((e) => ({ ...e, era: eraByYear(e.yearSort) })))}
            disabled={events.length === 0}
            title="Назначить эпохи по датам"
          >
            <Icons.Sparkle size={18} />
            Эпохи по датам
          </button>
          {hasEmpty && (
            <button type="button" className="btn btn-sm" onClick={() => setEvents((p) => p.filter((e) => e.title.trim() || e.dateText.trim()))}>
              <Icons.Trash size={18} />
              Убрать пустые
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {events.length === 0 && (
            <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
              <Icons.Paste size={40} className="text-mute" />
              <div>
                <div className="text-[1.3rem] font-semibold">Список пока пуст</div>
                <p className="mt-1 max-w-md text-mute">
                  Самый быстрый путь — скопировать 10–15 строк из документа и вставить их одним списком.
                </p>
              </div>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setPasteOpen(true)}>
                <Icons.Paste />
                Быстрая вставка списка
              </button>
            </div>
          )}
          {events.map((e, i) => (
            <div key={e.id} data-question-editor={e.id}>
            <EventRow
              key={e.id}
              item={e}
              index={i}
              total={events.length}
              warn={warnIds.has(e.id)}
              dragging={dragId === e.id}
              over={overId === e.id && dragId !== e.id}
              onChange={updateEvent}
              onDelete={deleteEvent}
              onMove={moveEvent}
              onEnter={onEnter}
              onDragStart={setDragId}
              onDragOver={setOverId}
              onDrop={onDrop}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            />
            <IllustrationEditor value={e} onChange={v=>updateEvent(e.id,v)} onSave={asset=>saveIllustration(e.id,asset)}/>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => addEvent()}>
            <Icons.Plus />
            Добавить событие
          </button>
          <button type="button" className="btn btn-lg" onClick={() => setPasteOpen(true)}>
            <Icons.Paste />
            Быстрая вставка списка
          </button>
        </div>
        <p className="mt-3 text-sm text-mute">
          Подсказка: <kbd>Enter</kbd> в строке добавляет следующую. Цветная полоска слева — эпоха события.
        </p>
      </section>

      <SettingsPanel
        settings={settings}
        onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        selection={selection}
        onSelection={setSelection}
        events={events}
        onStart={start}
        onStudy={study}
        onVariants={() => setVariantsOpen(true)}
        voiceSupported={voiceOk}
      />

      <QuickPasteDialog open={pasteOpen} onClose={() => setPasteOpen(false)} hasEvents={usable.length > 0} onApply={applyPaste} />
      <VariantsDialog open={variantsOpen} onClose={() => setVariantsOpen(false)} title={title} baseItems={planForVariants} toast={toast} />
      <Confirm
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Удалить сценарий?"
        text={`«${title}» и все его события будут удалены. История проведённых диктантов сохранится.`}
        onConfirm={remove}
      />
    </div>
  );
}

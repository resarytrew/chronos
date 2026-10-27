"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { withDefaults, type RunPlan, type SessionRecord } from "@/lib/types";
import { DIRECTION_LABEL, MODE_LABEL, copyText, fmtClock, fmtDateTime, itemsToText } from "@/lib/utils";
import { api, printAnswers } from "@/lib/client";
import { useApp } from "./AppProvider";
import { Confirm, Icons, Menu } from "./ui";
import {useImageSources} from "./LocalImage";

export default function HistoryList({ initial }: { initial: SessionRecord[] }) {
  const router = useRouter();
  const { startRun, openReview, toast } = useApp();
  const [items, setItems] = useState(initial);
  const sources=useImageSources(items.flatMap(s=>s.items.map(it=>it.task?.type==="image"?it.task:it)));
  useEffect(() => setItems(initial), [initial]);
  const [toDelete, setToDelete] = useState<SessionRecord | null>(null);

  const reload = async () => {
    try {
      setItems(await api.listSessions());
    } catch {
      /* ignore */
    }
  };

  const repeat = async (s: SessionRecord) => {
    let base = withDefaults(null);
    if (s.scenarioId) {
      try {
        const scenario = await api.getScenario(s.scenarioId);
        if (scenario) base = scenario.settings;
      } catch {
        /* scenario deleted — use defaults */
      }
    }
    const plan: RunPlan = {
      scenarioId: s.scenarioId,
      title: s.scenarioTitle,
      items: s.items,
      settings: { ...base, mode: s.mode, intervalSec: s.intervalSec, direction: s.direction, shuffle: false },
      repeat: true,
    };
    startRun(plan, reload);
  };

  const workOnMistakes = async (s: SessionRecord) => {
    const hard = s.items.filter((it) => s.hardIds.includes(it.id));
    if (!hard.length) return;
    const created = await api.createScenario({
      title: `${s.scenarioTitle} — работа над ошибками`,
      activityType:hard[0]?.task?.type ?? "dictation",
      tasks:hard.flatMap(it=>it.task?[it.task]:[]),
      settings:hard[0]?.task?{mode:"manual",voice:false}:undefined,
      events: hard[0]?.task?[]:hard.map((it) => ({ dateText: it.dateText, title: it.title, era: it.era,illustration:it.illustration,questionDisplay:it.questionDisplay })),
    });
    toast(`Создан сценарий из ${hard.length} трудных ${hard[0]?.task?.type==="terms"?"понятий":"заданий"}`);
    router.push(`/scenarios/editor/?id=${created.id}`);
  };

  const saveClass = async (s: SessionRecord, value: string) => {
    const className = value.trim() || null;
    if ((s.className ?? null) === className) return;
    setItems((p) => p.map((x) => (x.id === s.id ? { ...x, className } : x)));
    api.updateSession(s.id, { className }).catch(() => toast("Не удалось сохранить класс"));
  };

  const remove = async (id: string) => {
    await api.deleteSession(id);
    setItems((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6 sm:px-8 lg:px-10">
      <h1 className="text-[2.2rem] font-bold tracking-tight sm:text-[2.6rem]">История</h1>
      <p className="mt-1 text-mute">Проведённые диктанты. Можно повторить именно тот порядок, который видели ученики, открыть ответы или собрать работу над ошибками.</p>

      <div className="mt-6 flex flex-col gap-2.5">
        {items.length === 0 && (
          <div className="card px-6 py-12 text-center">
            <div className="text-[1.3rem] font-semibold">Пока пусто</div>
            <p className="mt-1 text-mute">После первого показа здесь появится запись с точным порядком вопросов.</p>
          </div>
        )}
        {items.map((s) => {
          const hardCount = s.hardIds.length;
          return (
            <div key={s.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[1.25rem] font-semibold leading-snug">{s.scenarioTitle}</div>
                  {s.status === "interrupted" && <p className="text-mute">Прервано · показано {s.shownCount ?? 0} из {s.items.length}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] text-mute">
                    <span suppressHydrationWarning>{fmtDateTime(s.finishedAt)}</span>
                    <span>·</span>
                    <span>{s.items.length} вопр.</span>
                    <span>·</span>
                    <span>{DIRECTION_LABEL[s.direction]}</span>
                    <span>·</span>
                    <span>{s.mode === "auto" ? `${MODE_LABEL.auto}, ${s.intervalSec} сек` : MODE_LABEL.manual}</span>
                    {s.durationSec > 0 && (
                      <>
                        <span>·</span>
                        <span>{fmtClock(s.durationSec)}</span>
                      </>
                    )}
                    {hardCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-ink">
                          <Icons.Flag size={14} /> трудных: {hardCount}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <input
                  className="field field-sm w-32"
                  placeholder="Класс"
                  defaultValue={s.className ?? ""}
                  aria-label="Класс"
                  onBlur={(e) => saveClass(s, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => repeat(s)}>
                  <Icons.Repeat size={18} />
                  Повторить тот же порядок
                </button>
                <button type="button" className="btn btn-sm" onClick={() => openReview(s, reload)}>
                  <Icons.Eye size={18} />
                  Ответы
                </button>
                {hardCount > 0 && (
                  <button type="button" className="btn btn-sm" onClick={() => workOnMistakes(s)}>
                    <Icons.Flag size={18} />
                    Работа над ошибками
                  </button>
                )}
                <Menu
                  trigger={
                    <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label="Ещё">
                      <Icons.More size={20} />
                    </button>
                  }
                  align="left"
                  items={[
                    {
                      label: "Печать ответов",
                      icon: <Icons.Print size={20} />,
                      onClick: () => printAnswers(s.scenarioTitle, s.items, `${fmtDateTime(s.finishedAt)}${s.className ? ", " + s.className : ""}`,sources) || toast("Разрешите всплывающие окна"),
                    },
                    {
                      label: "Копировать ответы",
                      icon: <Icons.Copy size={20} />,
                      onClick: async () => toast((await copyText(`${s.scenarioTitle}\n${itemsToText(s.items, true)}`)) ? "Скопировано" : "Не удалось скопировать"),
                    },
                    {
                      label: "Копировать вопросы",
                      icon: <Icons.Copy size={20} />,
                      onClick: async () => toast((await copyText(`${s.scenarioTitle}\n${itemsToText(s.items, false)}`)) ? "Скопировано" : "Не удалось скопировать"),
                    },
                    { label: "Удалить запись", icon: <Icons.Trash size={20} />, onClick: () => setToDelete(s), danger: true },
                  ]}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Confirm
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Удалить запись?"
        text="Порядок вопросов этого показа будет потерян."
        onConfirm={() => toDelete && remove(toDelete.id)}
      />
    </div>
  );
}

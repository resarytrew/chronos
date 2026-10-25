"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScenarioFull } from "@/lib/types";
import { buildRunPlan, eventsWord } from "@/lib/utils";
import { ERA_MAP } from "@/lib/eras";
import { api } from "@/lib/client";
import { useApp } from "./AppProvider";
import { Dialog, Icons } from "./ui";

export default function LibraryList({ items }: { items: ScenarioFull[] }) {
  const router = useRouter();
  const { toast, startRun } = useApp();
  const [preview, setPreview] = useState<ScenarioFull | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const addToMine = async (s: ScenarioFull) => {
    setBusyId(s.id);
    try {
      const copy = await api.createScenario({
        title: s.title,
        description: s.description,
        settings: s.settings,
        events: s.events.map((e) => ({ dateText: e.dateText, title: e.title, era: e.era })),
      });
      toast("Добавлено в ваши сценарии");
      router.push(`/scenarios/editor/?id=${copy.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const runNow = (s: ScenarioFull) => {
    startRun(buildRunPlan({ scenarioId: null, title: s.title, events: s.events, settings: s.settings, selection: { type: "all" } }));
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6 sm:px-8 lg:px-10">
      <h1 className="text-[2.2rem] font-bold tracking-tight sm:text-[2.6rem]">Библиотека</h1>
      <p className="mt-1 text-mute">Готовые наборы дат. Добавьте набор к себе, чтобы редактировать, или проведите сразу с настройками по умолчанию.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((s) => {
          const eras = Array.from(new Set(s.events.map((e) => e.era).filter(Boolean))) as string[];
          return (
            <div key={s.id} className="card flex flex-col p-5">
              <div className="flex-1">
                <div className="text-[1.25rem] font-semibold leading-snug">{s.title}</div>
                <div className="mt-1 text-[0.95rem] text-mute">{s.description}</div>
                <div className="mt-3 flex items-center gap-3 text-[0.95rem] text-mute">
                  <span>{eventsWord(s.events.length)}</span>
                  <span className="flex items-center gap-1">
                    {eras.map((k) => (
                      <span key={k} className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ERA_MAP[k]?.color }} title={ERA_MAP[k]?.label} />
                    ))}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => addToMine(s)} disabled={busyId === s.id}>
                  <Icons.Plus size={20} />
                  В мои сценарии
                </button>
                <button type="button" className="btn" onClick={() => runNow(s)}>
                  <Icons.Play size={18} />
                  Провести
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setPreview(s)}>
                  <Icons.Eye size={20} />
                  Список
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title ?? ""}>
        {preview && (
          <table className="w-full text-[1rem]">
            <tbody>
              {preview.events.map((e, i) => (
                <tr key={e.id} className="border-t border-line-2">
                  <td className="w-8 py-2 pr-2 text-mute tabular-nums">{i + 1}</td>
                  <td className="w-40 py-2 pr-3 font-semibold tabular-nums">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: e.era ? ERA_MAP[e.era]?.color : "transparent" }} />
                    {e.dateText}
                  </td>
                  <td className="py-2">{e.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Dialog>
    </div>
  );
}

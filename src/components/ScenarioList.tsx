"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ScenarioSummary } from "@/lib/types";
import { downloadJson, eventsWord, fmtDate } from "@/lib/utils";
import { ERA_MAP } from "@/lib/eras";
import { api } from "@/lib/client";
import { storage, type BackupFile } from "@/lib/storage";
import { useApp } from "./AppProvider";
import { Confirm, Icons, Menu } from "./ui";

export default function ScenarioList({ initial }: { initial: ScenarioSummary[] }) {
  const router = useRouter();
  const { toast } = useApp();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<ScenarioSummary | null>(null);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);

  useEffect(() => setItems(initial), [initial]);

  const create = async (quick: boolean) => {
    setBusy(true);
    try {
      const s = await api.createScenario({ title: quick ? "Новый диктант" : "Новая тема", events: [] });
      router.push(`/scenarios/editor/?id=${s.id}${quick ? "&paste=1" : ""}`);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id: string) => {
    const full = await api.getScenario(id);
    if (!full) {
      toast("Сценарий не найден");
      return;
    }
    const copy = await api.createScenario({
      title: `${full.title} (копия)`,
      settings: full.settings,
      events: full.events.map((e) => ({ dateText: e.dateText, title: e.title, era: e.era })),
    });
    setItems((p) => [{ id: copy.id, title: copy.title, description: copy.description, kind: "user", eventCount: full.events.length, eras: [], updatedAt: copy.updatedAt, createdAt: copy.createdAt }, ...p]);
    toast("Сценарий скопирован");
  };

  const remove = async (id: string) => {
    await api.deleteScenario(id);
    setItems((p) => p.filter((s) => s.id !== id));
    toast("Сценарий удалён");
  };

  const exportAll = async () => {
    const full = await api.listScenariosFull("user");
    downloadJson(`chronos-scenarios-${new Date().toISOString().slice(0, 10)}.json`, full.map((s) => ({ title: s.title, description: s.description, settings: s.settings, events: s.events.map((e) => ({ dateText: e.dateText, title: e.title, era: e.era })) })));
  };

  const exportBackup = async () => {
    downloadJson(`chronos-backup-${new Date().toISOString().slice(0, 10)}.json`, await storage.exportAll());
    toast("Резервная копия создана");
  };

  const readBackup = async (file: File) => {
    try {
      const value = JSON.parse(await file.text()) as BackupFile;
      if (value.format !== "chronos-backup" || value.version !== 1 || !Array.isArray(value.scenarios) || !Array.isArray(value.sessions)) throw new Error();
      setPendingBackup(value);
    } catch {
      toast("Это не резервная копия «Хроноса»");
    }
  };

  const restoreBackup = async (mode: "merge" | "replace") => {
    if (!pendingBackup) return;
    try {
      const result = await storage.importAll(pendingBackup, mode);
      setItems(await api.listScenarios("user"));
      setPendingBackup(null);
      toast(`Восстановлено: ${result.scenarios} сценариев, ${result.sessions} показов`);
    } catch {
      toast("Не удалось восстановить резервную копию");
    }
  };

  const importFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const list = Array.isArray(raw) ? raw : [raw];
      let n = 0;
      for (const s of list) {
        if (!s || typeof s !== "object" || !Array.isArray(s.events)) continue;
        await api.createScenario({
          title: typeof s.title === "string" ? s.title : "Импорт",
          description: typeof s.description === "string" ? s.description : null,
          settings: s.settings && typeof s.settings === "object" ? s.settings : undefined,
          events: s.events.map((e: { dateText?: string; date?: string; title?: string; era?: string | null }) => ({
            dateText: String(e.dateText ?? e.date ?? ""),
            title: String(e.title ?? ""),
            era: e.era ?? null,
          })),
        });
        n++;
      }
      setItems(await api.listScenarios("user"));
      toast(n ? `Импортировано сценариев: ${n}` : "В файле нет сценариев");
    } catch {
      toast("Не удалось прочитать файл");
    }
  };

  const filtered = query.trim() ? items.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase())) : items;

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.2rem] font-bold tracking-tight sm:text-[2.6rem]">Сценарии</h1>
          <p className="mt-1 text-mute">Ваши диктанты. Откройте тему и нажмите «Начать показ».</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Icons.Upload size={20} />
            Импорт
          </button>
          <button type="button" className="btn" onClick={exportAll} disabled={items.length === 0}>
            <Icons.Download size={20} />
            Экспорт
          </button>
          <button type="button" className="btn" onClick={exportBackup}>
            <Icons.Download size={20} />
            Резервная копия
          </button>
          <button type="button" className="btn" onClick={() => backupRef.current?.click()}>
            <Icons.Upload size={20} />
            Восстановить
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
          <input ref={backupRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readBackup(f); e.target.value = ""; }} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" className="card flex items-center gap-4 p-5 text-left transition hover:border-ink" onClick={() => create(true)} disabled={busy}>
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
            <Icons.Paste size={26} />
          </span>
          <span>
            <span className="block text-[1.25rem] font-semibold">Быстрый диктант</span>
            <span className="block text-mute">Вставить список из документа и сразу провести</span>
          </span>
        </button>
        <button type="button" className="card flex items-center gap-4 p-5 text-left transition hover:border-ink" onClick={() => create(false)} disabled={busy}>
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-line">
            <Icons.Plus size={26} />
          </span>
          <span>
            <span className="block text-[1.25rem] font-semibold">Новая тема</span>
            <span className="block text-mute">Пустой сценарий, заполнить вручную</span>
          </span>
        </button>
      </div>

      {items.length > 5 && (
        <input className="field mt-6" placeholder="Поиск по названию…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск" />
      )}

      <div className="mt-6 flex flex-col gap-2.5">
        {items.length === 0 && (
          <div className="card px-6 py-12 text-center">
            <div className="text-[1.3rem] font-semibold">Сценариев пока нет</div>
            <p className="mt-1 text-mute">
              Создайте первый диктант или возьмите готовый набор в{" "}
              <Link href="/library" className="underline">
                Библиотеке
              </Link>
              .
            </p>
          </div>
        )}
        {filtered.map((s) => (
          <div key={s.id} className="card flex items-center gap-3 p-3 pl-5 transition hover:border-ink sm:gap-4">
            <Link href={`/scenarios/editor/?id=${s.id}`} className="min-w-0 flex-1 py-2">
              <div className="truncate text-[1.25rem] font-semibold">{s.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] text-mute">
                <span>{eventsWord(s.eventCount)}</span>
                <span>·</span>
                <span suppressHydrationWarning>{fmtDate(s.updatedAt)}</span>
                {s.eras.length > 0 && (
                  <span className="flex items-center gap-1">
                    {s.eras.map((k) =>
                      ERA_MAP[k] ? <span key={k} className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ERA_MAP[k].color }} title={ERA_MAP[k].label} /> : null,
                    )}
                  </span>
                )}
              </div>
            </Link>
            <Link href={`/scenarios/editor/?id=${s.id}`} className="btn btn-sm hidden sm:inline-flex">
              Открыть
            </Link>
            <Menu
              trigger={
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Действия">
                  <Icons.More />
                </button>
              }
              items={[
                { label: "Открыть", icon: <Icons.Doc size={20} />, onClick: () => router.push(`/scenarios/editor/?id=${s.id}`) },
                { label: "Дублировать", icon: <Icons.Duplicate size={20} />, onClick: () => duplicate(s.id) },
                { label: "Удалить", icon: <Icons.Trash size={20} />, onClick: () => setToDelete(s), danger: true },
              ]}
            />
          </div>
        ))}
      </div>

      <Confirm
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Удалить сценарий?"
        text={toDelete ? `«${toDelete.title}» будет удалён без возможности восстановления.` : undefined}
        onConfirm={() => toDelete && remove(toDelete.id)}
      />
      <Confirm
        open={Boolean(pendingBackup)}
        onClose={() => setPendingBackup(null)}
        title="Восстановить резервную копию?"
        text={pendingBackup ? `Файл от ${new Date(pendingBackup.exportedAt).toLocaleDateString("ru-RU")}: ${pendingBackup.scenarios.length} сценариев и ${pendingBackup.sessions.length} показов. «Объединить» сохранит текущие данные; «Заменить» удалит их.` : undefined}
        onConfirm={() => void restoreBackup("merge")}
        confirmLabel="Объединить"
        extraAction={{ label: "Заменить данные", onClick: () => void restoreBackup("replace"), danger: true }}
      />
    </div>
  );
}

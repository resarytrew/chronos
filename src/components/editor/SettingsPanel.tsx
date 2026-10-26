"use client";

import { useState } from "react";
import type { EventItem, ScenarioSettings, Selection, StudyOrder } from "@/lib/types";
import { applySelection, estimateDuration, fmtDuration, usableEvents } from "@/lib/utils";
import { Icons, Seg, Toggle } from "@/components/ui";

interface Props {
  settings: ScenarioSettings;
  onSettings: (patch: Partial<ScenarioSettings>) => void;
  selection: Selection;
  onSelection: (s: Selection) => void;
  events: EventItem[];
  onStart: () => void;
  onVariants: () => void;
  onStudy: (order:StudyOrder) => void;
  voiceSupported: boolean;
}

export default function SettingsPanel({ settings, onSettings, selection, onSelection, events, onStart, onVariants, onStudy, voiceSupported }: Props) {
  const [studyOrder,setStudyOrder]=useState<StudyOrder>("chronological");
  const usable = usableEvents(events);
  const selectedCount =
    selection.type === "all"
      ? usable.length
      : selection.type === "random"
        ? Math.min(Math.max(1, selection.count || 1), usable.length)
        : applySelection(usable, selection).length;
  const withYears = usable.filter((e) => e.yearSort !== null);
  const minYear = withYears.length ? Math.min(...withYears.map((e) => e.yearSort!)) : null;
  const maxYear = withYears.length ? Math.max(...withYears.map((e) => e.yearSort!)) : null;
  const estimate = estimateDuration(selectedCount, settings.mode, settings.intervalSec, settings.countdown);

  return (
    <aside className="card flex flex-col gap-5 p-5 lg:sticky lg:top-6 lg:self-start">
      <h2 className="text-[1.5rem] font-semibold tracking-tight">Настройки показа</h2>

      <div>
        <div className="label-mute mb-2">Смена экрана</div>
        <Seg
          value={settings.mode}
          onChange={(mode) => onSettings({ mode })}
          options={[
            { value: "auto", label: "Автоматически" },
            { value: "manual", label: "Вручную" },
          ]}
        />
        <div className={`mt-3 transition-opacity ${settings.mode === "auto" ? "" : "opacity-40"}`}>
          <div className="flex items-baseline justify-between">
            <span>Интервал</span>
            <span className="text-[1.15rem] font-semibold tabular-nums">{settings.intervalSec} сек</span>
          </div>
          <input
            type="range"
            className="range"
            min={3}
            max={30}
            step={1}
            value={settings.intervalSec}
            onChange={(e) => onSettings({ intervalSec: Number(e.target.value) })}
            aria-label="Интервал смены"
          />
          <div className="flex justify-between text-sm text-mute">
            <span>3 сек</span>
            <span>30 сек</span>
          </div>
        </div>
      </div>

      <div>
        <div className="label-mute mb-2">Направление</div>
        <Seg
          value={settings.direction}
          onChange={(direction) => onSettings({ direction })}
          options={[
            { value: "event-to-date", label: "Событие → дата" },
            { value: "date-to-event", label: "Дата → событие" },
            { value: "mixed", label: "Смешанный" },
          ]}
          className="flex-col sm:flex-row lg:flex-col"
        />
      </div>

      <div className="hr" />

      <div className="flex flex-col gap-1">
        <Toggle on={settings.shuffle} onChange={(shuffle) => onSettings({ shuffle })} label="Случайный порядок" />
        <Toggle
          on={settings.voice}
          onChange={(voice) => onSettings({ voice })}
          label="Голос диктора"
          hint={voiceSupported ? "Озвучка каждого вопроса" : "Браузер не поддерживает озвучку"}
        />
        <Toggle on={settings.beep} onChange={(beep) => onSettings({ beep })} label="Звуковой сигнал" hint="Короткий сигнал при смене" />
        <Toggle on={settings.countdown} onChange={(countdown) => onSettings({ countdown })} label="Обратный отсчёт 3–2–1" />
      </div>

      <div className="hr" />

      <div>
        <div className="label-mute mb-2">Выборка на этот урок</div>
        <Seg
          value={selection.type}
          onChange={(type) => {
            if (type === "all") onSelection({ type: "all" });
            else if (type === "random") onSelection({ type: "random", count: Math.min(10, usable.length || 10) });
            else onSelection({ type: "range", from: minYear, to: maxYear });
          }}
          options={[
            { value: "all", label: "Все" },
            { value: "random", label: "N случайных" },
            { value: "range", label: "Годы с–по" },
          ]}
        />
        {selection.type === "random" && (
          <div className="mt-3 flex items-center gap-3">
            <input
              type="number"
              className="field field-sm w-28"
              min={1}
              max={Math.max(1, usable.length)}
              value={selection.count}
              onChange={(e) => onSelection({ type: "random", count: Number(e.target.value) })}
              aria-label="Количество"
            />
            <span className="text-mute">из {usable.length}</span>
          </div>
        )}
        {selection.type === "range" && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              className="field field-sm"
              placeholder="с"
              value={selection.from ?? ""}
              onChange={(e) => onSelection({ ...selection, from: e.target.value === "" ? null : Number(e.target.value) })}
              aria-label="С года"
            />
            <span className="text-mute">—</span>
            <input
              type="number"
              className="field field-sm"
              placeholder="по"
              value={selection.to ?? ""}
              onChange={(e) => onSelection({ ...selection, to: e.target.value === "" ? null : Number(e.target.value) })}
              aria-label="По год"
            />
          </div>
        )}
        <p className="mt-2 text-sm text-mute">
          Будет показано: <b className="text-ink">{selectedCount}</b> из {usable.length}. Сценарий не меняется.
        </p>
      </div>

      <div className="hr" />

      <div>
        <button type="button" className="btn btn-primary btn-lg w-full" onClick={onStart} disabled={selectedCount === 0}>
          <Icons.Play size={22} />
          Начать показ
        </button>
        <p className="mt-2 text-center text-sm text-mute">
          ≈ {fmtDuration(estimate)} · во весь экран
        </p>
      </div>

      <div className="rounded-2xl border border-line p-4">
        <h3 className="text-[1.1rem] font-semibold">Изучение дат</h3>
        <p className="mt-1 mb-3 text-sm text-mute">Список с закрытыми датами. Открывайте ответы по одному или нажатием на строку.</p>
        <Seg value={studyOrder} onChange={setStudyOrder} options={[{value:"chronological",label:"По хронологии"},{value:"shuffled",label:"Вперемешку"}]}/>
        <button type="button" className="btn btn-lg w-full mt-3" onClick={()=>onStudy(studyOrder)} disabled={selectedCount===0}><Icons.Eye size={22}/>Изучать даты</button>
      </div>

      <button type="button" className="btn w-full" onClick={onVariants} disabled={selectedCount === 0}>
        <Icons.Columns size={20} />
        Варианты А и Б
      </button>

      <div className="rounded-2xl border border-line p-4">
        <div className="flex items-start gap-3">
          <Icons.Monitor className="mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[1.1rem] font-semibold">Режим доски</div>
            <div className="text-sm text-mute">Крупный текст, таймер, ответы по одному.</div>
            <div className="mt-3 grid gap-2">
              <Seg
                value={settings.theme}
                onChange={(theme) => onSettings({ theme })}
                options={[
                  { value: "light", label: "Светлая" },
                  { value: "dark", label: "Тёмная" },
                ]}
              />
              <Seg
                value={settings.fontScale}
                onChange={(fontScale) => onSettings({ fontScale })}
                options={[
                  { value: "m", label: "Текст M" },
                  { value: "l", label: "L" },
                  { value: "xl", label: "XL" },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

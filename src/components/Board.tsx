"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Mode, RunPlan, SessionRecord } from "@/lib/types";
import {
  DIRECTION_LABEL,
  answerText,
  copyText,
  fmtBand,
  fmtClock,
  gradingScale,
  itemsToText,
  questionText,
} from "@/lib/utils";
import {
  api,
  beep,
  enterFullscreen,
  exitFullscreen,
  printAnswers,
  releaseWakeLock,
  requestWakeLock,
  speakItem,
  speechSupported,
  stopSpeaking,
} from "@/lib/client";
import { ERA_MAP } from "@/lib/eras";
import { Icons } from "./ui";

type Phase = "start" | "countdown" | "question" | "finished" | "review";

export interface BoardProps {
  plan: RunPlan;
  initialPhase?: "start" | "review";
  /** existing session when the review is opened from history */
  session?: SessionRecord | null;
  onClose: () => void;
  toast: (message: string) => void;
}

export default function Board({ plan, initialPhase = "start", session = null, onClose, toast }: BoardProps) {
  const items = plan.items;
  const total = items.length;
  const s = plan.settings;

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>(s.mode);
  const [paused, setPaused] = useState(false);
  const [shade, setShade] = useState(false);
  const [exitAsk, setExitAsk] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [questionMs, setQuestionMs] = useState(0);
  const [countdownN, setCountdownN] = useState(3);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [hardIds, setHardIds] = useState<Set<string>>(() => new Set(session?.hardIds ?? []));
  const [sessionId, setSessionId] = useState<string | null>(session?.id ?? null);
  const [speaking, setSpeaking] = useState(false);

  const startedAtRef = useRef<string>(new Date().toISOString());
  const savedRef = useRef(Boolean(session));
  const voiceOk = speechSupported();

  const running = phase === "question" && !paused && !shade && !exitAsk;
  const current = items[index];

  /* ---------- navigation ---------- */

  const finish = useCallback(() => {
    stopSpeaking();
    if (s.beep) beep("end");
    setPhase("finished");
  }, [s.beep]);

  const goNext = useCallback(() => {
    if (phase !== "question") return;
    if (index >= total - 1) {
      finish();
      return;
    }
    if (s.beep) beep("next");
    setIndex((i) => i + 1);
    setQuestionMs(0);
  }, [phase, index, total, finish, s.beep]);

  const goPrev = useCallback(() => {
    if (phase !== "question" || index === 0) return;
    setIndex((i) => i - 1);
    setQuestionMs(0);
  }, [phase, index]);

  const start = useCallback(() => {
    enterFullscreen();
    void requestWakeLock();
    if (s.beep) beep("tick");
    startedAtRef.current = new Date().toISOString();
    setElapsedMs(0);
    setQuestionMs(0);
    setIndex(0);
    setPaused(false);
    setPhase(s.countdown ? "countdown" : "question");
  }, [s.beep, s.countdown]);

  const restart = useCallback(() => {
    savedRef.current = false;
    setSessionId(null);
    setRevealed(new Set());
    setHardIds(new Set());
    setElapsedMs(0);
    setQuestionMs(0);
    setIndex(0);
    setPaused(false);
    setPhase("start");
  }, []);

  const close = useCallback(() => {
    stopSpeaking();
    void releaseWakeLock();
    exitFullscreen();
    onClose();
  }, [onClose]);

  const repeatVoice = useCallback(() => {
    if (!current || !voiceOk) return;
    speakItem(current);
    setSpeaking(true);
    window.setTimeout(() => setSpeaking(false), 1200);
  }, [current, voiceOk]);

  /* ---------- review ---------- */

  const revealNext = useCallback(() => {
    setRevealed((prev) => {
      for (let i = 0; i < total; i++) {
        if (!prev.has(i)) {
          const n = new Set(prev);
          n.add(i);
          return n;
        }
      }
      return prev;
    });
  }, [total]);

  const revealAll = useCallback(() => {
    setRevealed(new Set(items.map((_, i) => i)));
  }, [items]);

  const toggleHard = useCallback(
    (id: string) => {
      const n = new Set(hardIds);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      setHardIds(n);
      if (sessionId) api.updateSession(sessionId, { hardIds: Array.from(n) }).catch(() => {});
    },
    [hardIds, sessionId],
  );

  /* ---------- timers ---------- */

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      setElapsedMs((v) => v + dt);
      setQuestionMs((v) => v + dt);
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || mode !== "auto") return;
    if (questionMs >= s.intervalSec * 1000) goNext();
  }, [questionMs, running, mode, s.intervalSec, goNext]);

  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdownN(3);
    let n = 3;
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(id);
        setPhase("question");
      } else {
        setCountdownN(n);
        if (s.beep) beep("tick");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, s.beep]);

  useEffect(() => {
    if (phase !== "question" || !s.voice || !current) return;
    speakItem(current);
    return () => stopSpeaking();
  }, [phase, index, s.voice, current]);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;
    api
      .createSession({
        scenarioId: plan.scenarioId,
        scenarioTitle: plan.title,
        direction: s.direction,
        mode,
        intervalSec: s.intervalSec,
        durationSec: Math.round(elapsedMs / 1000),
        items,
        startedAt: startedAtRef.current,
      })
      .then((rec) => setSessionId(rec.id))
      .catch(() => toast("Не удалось сохранить результат в историю"));
  }, [phase, plan.scenarioId, plan.title, s.direction, s.intervalSec, mode, elapsedMs, items, toast]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      void releaseWakeLock();
    };
  }, []);

  /* ---------- hotkeys ---------- */

  const handlersRef = useRef<(e: KeyboardEvent) => void>(() => {});
  handlersRef.current = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = e.key;
    const code = e.code;
    if (k === "Escape") {
      e.preventDefault();
      if (shade) setShade(false);
      else if (exitAsk) setExitAsk(false);
      else if (phase === "question") setExitAsk(true);
      else if (phase === "review") setPhase("finished");
      else close();
      return;
    }
    if (shade) {
      if (code === "KeyB" || k === " ") {
        e.preventDefault();
        setShade(false);
      }
      return;
    }
    if (exitAsk) return;
    if (code === "KeyB" && (phase === "question" || phase === "finished")) {
      e.preventDefault();
      setShade(true);
      return;
    }
    if (code === "KeyA" && phase === "question") {
      e.preventDefault();
      setMode((m) => (m === "auto" ? "manual" : "auto"));
      setQuestionMs(0);
      return;
    }
    if (code === "KeyR" && phase === "question") {
      e.preventDefault();
      repeatVoice();
      return;
    }
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown") {
      e.preventDefault();
      if (phase === "question") goNext();
      else if (phase === "review") revealNext();
      else if (phase === "start") start();
      return;
    }
    if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") {
      e.preventDefault();
      if (phase === "question") goPrev();
      return;
    }
    if (k === " " || k === "Enter") {
      e.preventDefault();
      if (phase === "start") start();
      else if (phase === "question") {
        if (mode === "auto") setPaused((p) => !p);
        else goNext();
      } else if (phase === "finished") setPhase("review");
      else if (phase === "review") revealNext();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handlersRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- derived ---------- */

  const intervalMs = s.intervalSec * 1000;
  const remainingMs = Math.max(0, intervalMs - questionMs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const openedCount = revealed.size;
  const bands = gradingScale(total);

  const closeBtn = (
    <button type="button" className="b-btn" onClick={() => (phase === "question" ? setExitAsk(true) : close())} aria-label="Выйти">
      <Icons.Close />
    </button>
  );

  /* ---------- render ---------- */

  return (
    <div className="board" data-theme={s.theme} data-scale={s.fontScale} role="application" aria-label="Показ диктанта">
      {shade && (
        <div className="b-shade" onClick={() => setShade(false)}>
          Шторка · нажмите, чтобы продолжить
        </div>
      )}

      {/* ---------- start ---------- */}
      {phase === "start" && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 pt-4">
            <span className="label-mute" style={{ color: "var(--b-mute)" }}>
              Хронологический диктант
            </span>
            {closeBtn}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <h1
              className="font-semibold tracking-tight"
              style={{ fontSize: "clamp(2.4rem, 6.5vw, 6rem)", lineHeight: 1.08, maxWidth: "22ch", textWrap: "balance" }}
            >
              {plan.title}
            </h1>
            <p className="mt-6 text-[1.25rem] sm:text-[1.5rem]" style={{ color: "var(--b-mute)" }}>
              {total} {total === 1 ? "вопрос" : total < 5 ? "вопроса" : "вопросов"} · {DIRECTION_LABEL[s.direction]} ·{" "}
              {s.mode === "auto" ? `${s.intervalSec} сек на ответ` : "смена вручную"}
              {plan.repeat ? " · повтор порядка" : ""}
            </p>
            <button type="button" className="b-btn b-primary mt-12" onClick={start} disabled={total === 0}>
              <Icons.Play size={26} />
              Начать
            </button>
            {total === 0 && (
              <p className="mt-4" style={{ color: "var(--b-mute)" }}>
                В выборке нет событий с датой и названием.
              </p>
            )}
          </div>
          <div className="px-6 pb-5 text-center text-[0.95rem]" style={{ color: "var(--b-mute)" }}>
            <kbd>Пробел</kbd> — начать · <kbd>←</kbd> <kbd>→</kbd> — шаги · <kbd>A</kbd> — авто/вручную · <kbd>B</kbd> — шторка ·{" "}
            <kbd>Esc</kbd> — выход
          </div>
        </div>
      )}

      {/* ---------- countdown ---------- */}
      {phase === "countdown" && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="b-big-num" key={countdownN}>
            {countdownN}
          </div>
          <p className="mt-4 text-[1.3rem]" style={{ color: "var(--b-mute)" }}>
            Приготовьтесь
          </p>
        </div>
      )}

      {/* ---------- question ---------- */}
      {phase === "question" && current && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <div className="text-[1.5rem] font-semibold tabular-nums">
              {index + 1}
              <span style={{ color: "var(--b-mute)" }}> / {total}</span>
            </div>
            <div className="text-[1.1rem] font-medium" style={{ color: "var(--b-mute)" }}>
              {paused ? "Пауза" : mode === "auto" ? "Автоматически" : "Вручную"}
            </div>
            <div className="font-mono text-[1.5rem] tabular-nums" style={{ color: "var(--b-mute)" }}>
              {fmtClock(elapsedMs / 1000)}
            </div>
          </div>
          <div className="b-progress">
            <div style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>

          <div
            className="flex flex-1 flex-col items-center justify-center px-8 text-center"
            onClick={() => (mode === "manual" ? goNext() : setPaused((p) => !p))}
          >
            <div className="mb-6 text-[1.1rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--b-mute)" }}>
              {current.ask === "date" ? "Запишите дату" : "Запишите событие"}
            </div>
            <div key={index} className={`b-question ${current.ask === "event" ? "is-date" : ""}`}>
              {questionText(current)}
            </div>
            {paused && (
              <div className="mt-10 flex items-center gap-3 text-[1.2rem]" style={{ color: "var(--b-mute)" }}>
                <Icons.Pause /> Пауза — нажмите, чтобы продолжить
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-3xl px-8 pb-2">
            {mode === "auto" ? (
              <div className="flex items-center gap-5">
                <div className="b-countdown-bar flex-1">
                  <div style={{ width: `${(remainingMs / intervalMs) * 100}%` }} />
                </div>
                <div className="w-[2.2em] text-right text-[2rem] font-semibold tabular-nums">{remainingSec}</div>
              </div>
            ) : (
              <div className="text-center text-[1rem]" style={{ color: "var(--b-mute)" }}>
                {index === 0 ? "Нажмите на экран или → для следующего вопроса" : "\u00a0"}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-2">
            <div className="flex items-center gap-1">
              <button type="button" className="b-btn" onClick={goPrev} disabled={index === 0} aria-label="Назад">
                <Icons.Prev size={26} />
              </button>
              {mode === "auto" ? (
                <button type="button" className="b-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Продолжить" : "Пауза"}>
                  {paused ? <Icons.Play size={26} /> : <Icons.Pause size={26} />}
                </button>
              ) : null}
              <button type="button" className="b-btn" onClick={goNext} aria-label={index === total - 1 ? "Завершить" : "Далее"}>
                {index === total - 1 ? <Icons.Check size={26} /> : <Icons.Next size={26} />}
              </button>
            </div>
            <div className="flex items-center gap-1">
              {voiceOk && (
                <button type="button" className="b-btn" onClick={repeatVoice} data-active={speaking} aria-label="Повторить голосом">
                  <Icons.Speaker size={24} />
                  <span className="hidden sm:inline">Повторить</span>
                </button>
              )}
              <button
                type="button"
                className="b-btn"
                onClick={() => {
                  setMode((m) => (m === "auto" ? "manual" : "auto"));
                  setQuestionMs(0);
                }}
                aria-label="Переключить режим"
              >
                <Icons.Repeat size={22} />
                <span className="hidden sm:inline">{mode === "auto" ? "Вручную" : "Авто"}</span>
              </button>
              <button type="button" className="b-btn" onClick={() => setShade(true)} aria-label="Шторка">
                <Icons.Shade size={24} />
              </button>
              {closeBtn}
            </div>
          </div>
        </div>
      )}

      {/* ---------- finished ---------- */}
      {phase === "finished" && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-end px-6 pt-4">{closeBtn}</div>
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="text-[1.1rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--b-mute)" }}>
              {plan.title}
            </div>
            <h1 className="mt-4 font-semibold tracking-tight" style={{ fontSize: "clamp(2.4rem, 6.5vw, 6rem)", lineHeight: 1.08 }}>
              Диктант завершён
            </h1>
            <p className="mt-5 text-[1.3rem]" style={{ color: "var(--b-mute)" }}>
              {total} {total === 1 ? "вопрос" : total < 5 ? "вопроса" : "вопросов"}
              {elapsedMs > 0 ? ` · ${fmtClock(elapsedMs / 1000)}` : ""}
            </p>
            {bands.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[1.15rem]" style={{ color: "var(--b-mute)" }}>
                <span>Шкала:</span>
                {bands.map((b) => (
                  <span key={b.grade} className="tabular-nums">
                    <b style={{ color: "var(--b-fg)" }}>«{b.grade}»</b> {fmtBand(b)}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <button type="button" className="b-btn b-primary" onClick={() => setPhase("review")}>
                <Icons.Eye size={26} />
                Показать ответы
              </button>
              <button type="button" className="b-btn b-outline" onClick={restart}>
                <Icons.Repeat size={22} />
                Повторить в том же порядке
              </button>
              <button type="button" className="b-btn b-outline" onClick={close}>
                Выйти
              </button>
            </div>
          </div>
          <div className="px-6 pb-5 text-center text-[0.95rem]" style={{ color: "var(--b-mute)" }}>
            Результат сохранён в «Истории» — порядок можно повторить позже.
          </div>
        </div>
      )}

      {/* ---------- review ---------- */}
      {phase === "review" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4 pb-3">
            <div className="flex items-baseline gap-4">
              <h2 className="text-[1.7rem] font-semibold tracking-tight">Ответы</h2>
              <span className="text-[1.1rem] tabular-nums" style={{ color: "var(--b-mute)" }}>
                {openedCount} / {total} открыто
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" className="b-btn" onClick={revealNext} disabled={openedCount >= total} data-active="true">
                <Icons.Next size={22} />
                Открыть следующий
              </button>
              <button type="button" className="b-btn" onClick={revealAll} disabled={openedCount >= total}>
                <Icons.Eye size={22} />
                <span className="hidden md:inline">Открыть все</span>
              </button>
              <button
                type="button"
                className="b-btn"
                onClick={async () => {
                  const ok = await copyText(itemsToText(items, true));
                  toast(ok ? "Ответы скопированы" : "Не удалось скопировать");
                }}
                aria-label="Копировать"
              >
                <Icons.Copy size={22} />
              </button>
              <button
                type="button"
                className="b-btn"
                onClick={() => {
                  if (!printAnswers(plan.title, items, `${DIRECTION_LABEL[s.direction]}`)) toast("Разрешите всплывающие окна для печати");
                }}
                aria-label="Печать"
              >
                <Icons.Print size={22} />
              </button>
              <button type="button" className="b-btn" onClick={() => setShade(true)} aria-label="Шторка">
                <Icons.Shade size={22} />
              </button>
              {closeBtn}
            </div>
          </div>
          <div className="b-progress">
            <div style={{ width: `${total ? (openedCount / total) * 100 : 0}%` }} />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mx-auto flex max-w-5xl flex-col gap-3">
              {items.map((it, i) => {
                const open = revealed.has(i);
                const hard = hardIds.has(it.id);
                const era = it.era ? ERA_MAP[it.era] : null;
                return (
                  <div
                    key={`${it.id}-${i}`}
                    className="rv-row"
                    data-open={open}
                    data-hard={hard}
                    onClick={() => {
                      if (!open) setRevealed((prev) => new Set(prev).add(i));
                    }}
                  >
                    <div className="flex items-center gap-2 text-[1.2rem] tabular-nums" style={{ color: "var(--b-mute)" }}>
                      {i + 1}
                    </div>
                    <div className="text-[1.25rem] leading-snug">
                      <span className="mr-2 text-[0.8rem] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--b-mute)" }}>
                        {it.ask === "date" ? "Событие" : "Дата"}
                      </span>
                      {questionText(it)}
                    </div>
                    <div className="rv-answer text-[1.35rem] leading-snug">
                      {open ? (
                        <span className="rv-reveal inline-flex items-center gap-3">
                          {era && (
                            <span
                              className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                              style={{ background: era.color }}
                              title={era.label}
                            />
                          )}
                          {answerText(it)}
                        </span>
                      ) : (
                        <span className="rv-mask" aria-label="Скрыто" />
                      )}
                    </div>
                    <div>
                      {open ? (
                        <button
                          type="button"
                          className="b-btn"
                          data-active={hard}
                          style={{ minHeight: 48, minWidth: 48 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHard(it.id);
                          }}
                          aria-label="Отметить как трудное"
                          title="Отметить как трудное — для работы над ошибками"
                        >
                          <Icons.Flag size={22} />
                          <span className="hidden lg:inline">{hard ? "Трудное" : "Отметить"}</span>
                        </button>
                      ) : (
                        <span className="text-[0.9rem]" style={{ color: "var(--b-mute)" }}>
                          нажмите
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3" style={{ borderColor: "var(--b-line)" }}>
            <span className="text-[1rem]" style={{ color: "var(--b-mute)" }}>
              {hardIds.size > 0
                ? `Отмечено трудных: ${hardIds.size} — из них можно собрать «Работу над ошибками» в Истории`
                : "Отмечайте трудные события флажком — потом соберёте из них новый диктант"}
            </span>
            <div className="flex gap-2">
              <button type="button" className="b-btn" onClick={() => setPhase("finished")}>
                Назад
              </button>
              <button type="button" className="b-btn b-outline" style={{ minHeight: 52 }} onClick={close}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- exit confirm ---------- */}
      {exitAsk && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40" onClick={() => setExitAsk(false)}>
          <div
            className="rounded-3xl p-8 text-center shadow-2xl"
            style={{ background: s.theme === "dark" ? "#1c1c1b" : "#fff", minWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[1.5rem] font-semibold">Прервать показ?</div>
            <p className="mt-2" style={{ color: "var(--b-mute)" }}>
              Диктант остановлен на вопросе {index + 1} из {total}.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" className="b-btn b-outline" onClick={() => setExitAsk(false)}>
                Продолжить
              </button>
              <button
                type="button"
                className="b-btn b-outline"
                onClick={() => {
                  setExitAsk(false);
                  finish();
                }}
              >
                Завершить сейчас
              </button>
              <button type="button" className="b-btn b-primary" style={{ minHeight: 64, fontSize: "1.1rem", padding: "0 1.6rem" }} onClick={close}>
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

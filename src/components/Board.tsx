"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveRun, Mode, RunPlan, SessionRecord, TaskResponse, StudyOrder } from "@/lib/types";
import { ACTIVITY_LABELS, initialOrder } from "@/lib/activities";
import TaskBoard from "./TaskBoard";
import LocalImage, { useImageSources } from "./LocalImage";
import {
  DIRECTION_LABEL,
  answerText,
  copyText,
  fmtBand,
  fmtClock,
  gradingScale,
  itemsToText,
  questionText,
  orderStudyItems,
} from "@/lib/utils";
import {
  api,
  beep,
  enterFullscreen,
  exitFullscreen,
  printAnswers,
  printWorksheet,
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
  studyOrder?: StudyOrder;
  resume?: ActiveRun;
  plan: RunPlan;
  initialPhase?: "start" | "review";
  /** existing session when the review is opened from history */
  session?: SessionRecord | null;
  onClose: () => void;
  toast: (message: string) => void;
}

export default function Board({ plan, initialPhase = "start", session = null, resume, studyOrder, onClose, toast }: BoardProps) {
  const studying=studyOrder!==undefined;
  const [items,setItems]=useState(plan.items);
  const [studyOrderValue,setStudyOrderValue]=useState<StudyOrder>(studyOrder??"chronological");
  const total = items.length;
  const s = plan.settings;
  const activity = items[0]?.task?.type;
  const terminology=activity==="terms";
  const interactive=Boolean(activity&&!terminology);
  const studyLabel=terminology?"Изучение понятий":"Изучение дат";
  const answerNoun=terminology?"определение":"дату";
  const orderedStudy=terminology?"sequential":"chronological";
  const makeResponses = () => Object.fromEntries(items.filter(it=>it.task).map(it=>[it.id,{order:it.presentationOrder ?? initialOrder(it.task!)}]));
  const [responses,setResponses] = useState<Record<string,TaskResponse>>(()=>resume?.responses ?? makeResponses());
  const sources=useImageSources(items.flatMap(it=>it.task?[it.task]:[]));

  const [phase, setPhase] = useState<Phase>(resume ? "question" : initialPhase);
  const [index, setIndex] = useState(resume?.index ?? 0);
  const [mode, setMode] = useState<Mode>(resume?.mode ?? s.mode);
  const [paused, setPaused] = useState(Boolean(resume));
  const [shade, setShade] = useState(false);
  const [exitAsk, setExitAsk] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(resume?.elapsedMs ?? 0);
  const [questionMs, setQuestionMs] = useState(resume?.questionMs ?? 0);
  const [countdownN, setCountdownN] = useState(3);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [hardIds, setHardIds] = useState<Set<string>>(() => new Set(session?.hardIds ?? []));
  const [sessionId, setSessionId] = useState<string | null>(session?.id ?? null);
  const [speaking, setSpeaking] = useState(false);

  const [saveStatus, setSaveStatus] = useState(session ? "saved" : "idle");
  const [retry, setRetry] = useState(0);
  const [interrupted, setInterrupted] = useState(false);
  const [preview, setPreview] = useState(false);
  const startedAtRef = useRef<string>(resume?.startedAt ?? new Date().toISOString());
  const studyScroll=useRef<HTMLDivElement>(null);
  const savedRef = useRef(Boolean(session));
  const voiceOk = speechSupported();

  const running = phase === "question" && !paused && !shade && !exitAsk;
  const current = items[index];

  useEffect(() => {
    const hide = () => { if (document.hidden) { setPaused(true); stopSpeaking(); } };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  const snapshot = useRef<ActiveRun | null>(null);
  snapshot.current = phase === "question" ? { id: "current", plan, index, mode, elapsedMs, questionMs, responses, startedAt: startedAtRef.current } : null;
  useEffect(() => {
    if (phase !== "question") return;
    let warned = false;
    const save = () => { if (snapshot.current) void api.saveActiveRun(snapshot.current).catch(() => { if (!warned) toast("Не удалось сохранить позицию показа"); warned = true; }); };
    save();
    const timer = window.setInterval(save, 1000);
    window.addEventListener("pagehide", save);
    return () => { window.clearInterval(timer); window.removeEventListener("pagehide", save); };
  }, [phase, index, mode, toast, responses]);

  /* ---------- navigation ---------- */

  const finish = useCallback(() => {
    stopSpeaking();
    if (s.beep) beep("end");
    setPhase("finished");
  }, [s.beep]);

  const goNext = useCallback(() => {
    if (phase !== "question" || paused) return;
    if (index >= total - 1) {
      finish();
      return;
    }
    if (s.beep) beep("next");
    setIndex((i) => i + 1);
    setQuestionMs(0);
  }, [phase, index, total, finish, s.beep, paused]);

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
    setResponses(makeResponses());
    setPhase(s.countdown ? "countdown" : "question");
  // The plan is immutable for the lifetime of one board.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.beep, s.countdown, items]);

  const restart = useCallback(() => {
    setInterrupted(false);
    setSaveStatus("idle");
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
      if (sessionId) api.updateSession(sessionId, { hardIds: Array.from(n) }).catch(() => toast("Не удалось сохранить отметку. Повторите действие."));
    },
    [hardIds, sessionId, toast],
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
    if (!running || !s.voice || !current) return;
    speakItem(current);
    return () => stopSpeaking();
  }, [running, index, s.voice, current]);

  useEffect(() => {
    if (studying || phase !== "finished" || savedRef.current) return;
    savedRef.current = true;
    setSaveStatus("saving");
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
        status: interrupted ? "interrupted" : "completed",
        shownCount: index + 1,
      })
      .then((rec) => { setSessionId(rec.id); setSaveStatus("saved"); })
      .catch(() => { savedRef.current = false; setSaveStatus("error"); });
  }, [phase, plan.scenarioId, plan.title, s.direction, s.intervalSec, mode, elapsedMs, items, toast, interrupted, index, retry, studying]);

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
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.repeat) { e.preventDefault(); return; }
    if(tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
    const k = e.key;
    const code = e.code;
    if (k === "Escape") {
      e.preventDefault();
      if (shade) setShade(false);
      else if (exitAsk) setExitAsk(false);
      else if (phase === "question") setExitAsk(true);
      else if (phase === "review") { if(studying) close(); else setPhase("finished"); }
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
    if (code === "KeyB" && (phase === "question" || phase === "finished" || phase === "review")) {
      e.preventDefault();
      setShade(true);
      return;
    }
    if (code === "KeyA" && phase === "question" && !interactive) {
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
        else if (paused) setPaused(false);
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
  const bands = interactive ? [] : gradingScale(total);
  const changeStudyOrder=(order:StudyOrder)=>{
    setStudyOrderValue(order);
    setItems(orderStudyItems(items,order));
    setRevealed(new Set());
    studyScroll.current?.scrollTo({top:0});
  };

  const closeBtn = (
    <button type="button" className="b-btn" onClick={() => (phase === "question" ? setExitAsk(true) : close())} aria-label="Выйти">
      <Icons.Close />
    </button>
  );

  /* ---------- render ---------- */

  return (
    <div className="board" data-theme={s.theme} data-scale={s.fontScale} data-subject={terminology?"terms":"dates"} role="application" aria-label={studying?studyLabel:terminology?"Терминологический диктант":"Показ диктанта"}>
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
              {ACTIVITY_LABELS[activity??"dictation"]}
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
              {total} {total === 1 ? "вопрос" : total < 5 ? "вопроса" : "вопросов"} · {interactive ? ACTIVITY_LABELS[activity!] : DIRECTION_LABEL[s.direction]} ·{" "}
              {s.mode === "auto" ? `${s.intervalSec} сек на ответ` : "смена вручную"}
              {plan.repeat ? " · повтор порядка" : ""}
            </p>
            <button type="button" className="b-btn b-primary mt-12" onClick={start} disabled={total === 0}>
              <Icons.Play size={26} />
              Начать
            </button>
            <button type="button" className="b-btn mt-3" onClick={() => setPreview(!preview)}>Предпросмотр доски</button>
            {preview && current && (current.task&&current.task.type!=="terms" ? <TaskBoard task={current.task} response={responses[current.id]??{}} onChange={r=>setResponses(p=>({...p,[current.id]:r}))}/> : <div className="b-question mt-4">{questionText(current)}</div>)}
            {total === 0 && (
              <p className="mt-4" style={{ color: "var(--b-mute)" }}>
                В наборе нет заполненных заданий для показа.
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
          >
            {current.task&&current.task.type!=="terms" ? <TaskBoard key={current.id} task={current.task} response={responses[current.id]??{}} disabled={paused||exitAsk} onChange={r=>setResponses(p=>({...p,[current.id]:r}))}/> : <>
            <div className="mb-6 text-[1.1rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--b-mute)" }}>
              {terminology?(current.ask==="term"?"Запишите понятие":"Запишите определение"):current.ask === "date" ? "Запишите дату" : "Запишите событие"}
            </div>
            <div key={index} className={`b-question ${current.ask === "event" ? "is-date" : ""}`} style={questionText(current).length > 100 ? { fontSize: "clamp(1.8rem, 4vw, 4rem)", maxWidth: "38ch" } : undefined}>
              {questionText(current)}
            </div>
            </>}
            {paused && (
              <div className="mt-10 flex items-center gap-3 text-[1.2rem]" style={{ color: "var(--b-mute)" }}>
                <Icons.Pause /> Пауза — нажмите кнопку «Продолжить»
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
                {index === 0 ? "Нажмите «Далее» или → для следующего вопроса" : "\u00a0"}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-2">
            <div className="flex items-center gap-1">
              <button type="button" className="b-btn" onClick={goPrev} disabled={index === 0} aria-label="Назад">
                <Icons.Prev size={26} />
              </button>
              {(
                <button type="button" className="b-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Продолжить" : "Пауза"}>
                  {paused ? <Icons.Play size={26} /> : <Icons.Pause size={26} />}
                </button>
              )}
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
                disabled={interactive}
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
              {interrupted ? "Занятие прервано" : "Занятие завершено"}
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
            {saveStatus === "saved" ? "Результат сохранён в «Истории» — порядок можно повторить позже." : saveStatus === "error" ? "Не удалось сохранить историю." : "Сохранение…"}
            {saveStatus === "error" && <button className="b-btn" onClick={() => setRetry((v) => v + 1)}>Повторить сохранение</button>}
          </div>
        </div>
      )}

      {/* ---------- review ---------- */}
      {phase === "review" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4 pb-3">
            <div className="flex items-baseline gap-4">
              <h2 className="text-[1.7rem] font-semibold tracking-tight">{studying?studyLabel:"Ответы"}</h2>
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
                  if (!(activity ? printWorksheet(plan.title,items,true,sources) : printAnswers(plan.title, items, `${DIRECTION_LABEL[s.direction]}`))) toast("Разрешите всплывающие окна для печати");
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
          {studying&&<div className="flex flex-wrap items-center gap-2 px-6 pb-3">
            <span className="mr-auto truncate text-lg" title={plan.title}>{plan.title}</span>
            <button className="b-btn" data-active={studyOrderValue===orderedStudy} aria-pressed={studyOrderValue===orderedStudy} onClick={()=>changeStudyOrder(orderedStudy)}>{terminology?"Последовательно":"По хронологии"}</button>
            <button className="b-btn" data-active={studyOrderValue==="shuffled"} aria-pressed={studyOrderValue==="shuffled"} onClick={()=>changeStudyOrder("shuffled")}>Перемешать</button>
            <button className="b-btn" disabled={!openedCount} onClick={()=>setRevealed(new Set())}>{terminology?"Скрыть все определения":"Скрыть все даты"}</button>
          </div>}
          <div className="b-progress">
            <div style={{ width: `${total ? (openedCount / total) * 100 : 0}%` }} />
          </div>
          <div ref={studyScroll} className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mx-auto flex max-w-[1440px] flex-col gap-3">
              {items.map((it, i) => {
                const open = revealed.has(i);
                const hard = hardIds.has(it.id);
                const era = it.era ? ERA_MAP[it.era] : null;
                return (
                  <div
                    key={`${it.id}-${i}`}
                    className="rv-row"
                    data-study={studying}
                    data-open={open}
                    data-hard={hard}
                    onClick={() => {
                      if(studying) setRevealed(prev=>{const next=new Set(prev);if(next.has(i))next.delete(i);else next.add(i);return next;});
                      else if (!open) setRevealed((prev) => new Set(prev).add(i));
                    }}
                  >
                    <div className="flex items-center gap-2 text-[1.2rem] tabular-nums" style={{ color: "var(--b-mute)" }}>
                      {i + 1}
                    </div>
                    <div className="rv-question leading-snug">
                      {studying?<button type="button" className="rv-toggle" aria-label={(open?"Скрыть ":"Открыть ")+answerNoun+": "+questionText(it)} aria-expanded={open} onClick={e=>{e.stopPropagation();setRevealed(prev=>{const next=new Set(prev);if(next.has(i))next.delete(i);else next.add(i);return next;});}}>{questionText(it)}</button>:questionText(it)}
                      {it.task?.type==="image" && <LocalImage id={it.task.imageId} alt={it.task.alt}/>}
                    </div>
                    <div className="rv-answer leading-snug">
                      {open ? (
                        <span className="rv-reveal inline-flex items-center gap-3">
                          {era && (
                            <span
                              className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                              style={{ background: era.color }}
                              title={era.label}
                            />
                          )}
                          <span>{answerText(it)}{it.task?.explanation&&<span className="mt-2 block text-base">{it.task.explanation}</span>}</span>
                        </span>
                      ) : (
                        <span className="rv-mask" aria-label="Скрыто" />
                      )}
                    </div>
                    <div>
                      {open && !studying ? (
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
                          {studying&&open?"скрыть":"нажмите"}
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
              {studying ? terminology?"Нажмите на понятие, чтобы открыть или скрыть определение. Пробел или → — открыть следующее.":"Нажмите на строку, чтобы открыть или скрыть дату. Пробел или → — открыть следующую." : hardIds.size > 0
                ? `Отмечено трудных: ${hardIds.size} — из них можно собрать «Работу над ошибками» в Истории`
                : terminology?"Отмечайте трудные понятия флажком — потом соберёте из них новый диктант":"Отмечайте трудные события флажком — потом соберёте из них новый диктант"}
            </span>
            <div className="flex gap-2">
              {!studying&&<button type="button" className="b-btn" onClick={() => setPhase("finished")}>
                Назад
              </button>}
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
                  setInterrupted(true);
                  finish();
                }}
              >
                Завершить сейчас
              </button>
              <button type="button" className="b-btn b-primary" style={{ minHeight: 64, fontSize: "1.1rem", padding: "0 1.6rem" }} onClick={() => { setInterrupted(true); setExitAsk(false); finish(); }}>
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import type { EventItem, RunItem } from "./types";
import { answerText, escapeHtml, fmtBand, gradingScale, questionText } from "./utils";
import { storage } from "./storage";

/** Compatibility facade for UI components; all data stays in browser IndexedDB. */
export const api = storage;

/* ---------- speech ---------- */

let voiceCache: SpeechSynthesisVoice | null = null;

function pickRussianVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (voiceCache) return voiceCache;
  const voices = window.speechSynthesis.getVoices();
  const ru = voices.filter((v) => v.lang.toLowerCase().startsWith("ru"));
  voiceCache =
    ru.find((v) => /google|yandex|milena|irina|premium|natural/i.test(v.name)) ?? ru[0] ?? null;
  return voiceCache;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voiceCache = null;
    pickRussianVoice();
  };
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string) {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ru-RU";
  u.rate = 0.92;
  u.pitch = 1;
  const v = pickRussianVoice();
  if (v) u.voice = v;
  synth.speak(u);
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Makes dates sound natural: "1670–1671" → "с 1670 по 1671 год". */
export function speakableDate(dateText: string): string {
  const t = dateText.trim();
  const range = t.match(/^(\d{1,4})\s*[–—-]\s*(\d{1,4})(.*)$/);
  if (range) return `с ${range[1]} по ${range[2]} год${range[3] ?? ""}`;
  if (/^\d{1,4}$/.test(t)) return `${t} год`;
  return t.replace(/\bдо н\. ?э\./i, "до нашей эры").replace(/\bв\./i, "век").replace(/\bг\./i, "год");
}

export function speakItem(item: RunItem) {
  speak(item.ask === "date" ? item.title : speakableDate(item.dateText));
}

/* ---------- sound ---------- */

let audioCtx: AudioContext | null = null;

export function beep(kind: "tick" | "next" | "end" = "next") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const ctx = audioCtx;
    const play = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    };
    if (kind === "tick") play(880, 0, 0.08, 0.08);
    else if (kind === "next") play(660, 0, 0.12, 0.12);
    else {
      play(523, 0, 0.14, 0.12);
      play(659, 0.15, 0.14, 0.12);
      play(784, 0.3, 0.25, 0.12);
    }
  } catch {
    /* ignore */
  }
}

/* ---------- wake lock & fullscreen ---------- */

type WakeLockSentinelLike = { release: () => Promise<void> };
let wakeLock: WakeLockSentinelLike | null = null;

export async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
    if (nav.wakeLock) wakeLock = await nav.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

export async function releaseWakeLock() {
  try {
    await wakeLock?.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

export function enterFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  }
}

export function exitFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

/* ---------- printing ---------- */

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; color: #000; margin: 0; padding: 18mm 16mm; font-size: 13pt; line-height: 1.35; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 1px solid #000; padding-bottom: 3pt; }
  .meta { color: #333; font-size: 11pt; margin-bottom: 12pt; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
  ol { margin: 0; padding-left: 22pt; }
  li { margin: 0 0 7pt; break-inside: avoid; }
  .blank { display: inline-block; border-bottom: 1px solid #000; min-width: 38mm; height: 1em; vertical-align: bottom; margin-left: 6pt; }
  .key { page-break-before: always; }
  .key li { margin-bottom: 3pt; }
  table { border-collapse: collapse; width: 100%; font-size: 12pt; }
  td, th { border: 1px solid #000; padding: 3pt 6pt; text-align: left; vertical-align: top; }
  th { background: #eee; }
  .small { font-size: 10.5pt; color: #333; }
  .scale { margin-top: 10pt; font-size: 11pt; }
  .cut { border-top: 1px dashed #666; margin: 10mm 0; text-align: center; font-size: 9pt; color: #666; }
  @page { margin: 0; }
`;

export function openPrintWindow(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.open();
  w.document.write(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},150);});</script></body></html>`,
  );
  w.document.close();
  return true;
}

function scaleHtml(total: number) {
  const bands = gradingScale(total);
  if (!bands.length) return "";
  return `<p class="scale"><b>Шкала оценок (из ${total}):</b> ${bands
    .map((b) => `«${b.grade}» — ${fmtBand(b)}`)
    .join("; ")}</p>`;
}

function questionsList(items: RunItem[], blanks: boolean) {
  return `<ol>${items
    .map((it) => `<li>${escapeHtml(questionText(it))}${blanks ? '<span class="blank"></span>' : ""}</li>`)
    .join("")}</ol>`;
}

function keyTable(items: RunItem[]) {
  return `<table><tr><th style="width:8%">№</th><th>Вопрос</th><th>Ответ</th></tr>${items
    .map(
      (it, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(questionText(it))}</td><td><b>${escapeHtml(answerText(it))}</b></td></tr>`,
    )
    .join("")}</table>`;
}

/** Handout with variants А and Б, teacher's key on a separate page. */
export function printVariants(title: string, a: RunItem[], b: RunItem[]) {
  const sheet = (label: string, items: RunItem[]) =>
    `<div><h1>${escapeHtml(title)}</h1><div class="meta">Хронологический диктант · Вариант ${label} · Фамилия: ______________ Класс: ______</div>${questionsList(items, true)}</div>`;
  const html = `
    <div class="cols">${sheet("А", a)}${sheet("Б", b)}</div>
    <div class="cut">✂ линия отреза</div>
    <div class="cols">${sheet("А", a)}${sheet("Б", b)}</div>
    <div class="key">
      <h1>${escapeHtml(title)} — ключ для учителя</h1>
      <div class="meta">Не раздавать ученикам</div>
      <h2>Вариант А</h2>${keyTable(a)}
      <h2>Вариант Б</h2>${keyTable(b)}
      ${scaleHtml(a.length)}
    </div>`;
  return openPrintWindow(`${title} — варианты`, html);
}

/** Answer key for one dictation run. */
export function printAnswers(title: string, items: RunItem[], meta?: string) {
  const html = `<h1>${escapeHtml(title)}</h1><div class="meta">Ответы хронологического диктанта${meta ? " · " + escapeHtml(meta) : ""}</div>${keyTable(items)}${scaleHtml(items.length)}`;
  return openPrintWindow(`${title} — ответы`, html);
}

/** Plain list of a scenario (date — event), useful as a cheat-sheet or a handout to learn. */
export function printEventList(title: string, items: EventItem[]) {
  const html = `<h1>${escapeHtml(title)}</h1><div class="meta">Список дат для запоминания</div><table><tr><th style="width:28%">Дата</th><th>Событие</th></tr>${items
    .map((e) => `<tr><td><b>${escapeHtml(e.dateText)}</b></td><td>${escapeHtml(e.title)}</td></tr>`)
    .join("")}</table>`;
  return openPrintWindow(title, html);
}

/* ---------- local prefs ---------- */

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`chronos:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function savePref<T>(key: string, value: T) {
  try {
    localStorage.setItem(`chronos:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

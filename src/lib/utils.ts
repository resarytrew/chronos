import type {
  Ask,
  Direction,
  EventItem,
  Mode,
  RunItem,
  RunPlan,
  ScenarioSettings,
  Selection,
} from "./types";

/* ---------- ids ---------- */

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---------- dates ---------- */

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function romanToInt(s: string): number {
  let total = 0;
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const cur = ROMAN[up[i]] ?? 0;
    const next = ROMAN[up[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

/** Extracts a sortable year from a free-form date string ("1670–1671", "IX век", "988 г.", "480 до н. э."). */
export function parseYear(dateText: string): number | null {
  const t = dateText.trim();
  if (!t) return null;
  const bc = /до\s*н\.?\s*э/i.test(t);
  const nums = t.match(/\d{1,4}/g) ?? [];
  // "14 декабря 1825" → prefer the 3–4 digit token (the year) over the day
  const pick = nums.find((n) => n.length >= 3) ?? nums[0];
  if (pick) {
    const y = parseInt(pick, 10);
    if (!Number.isNaN(y)) return bc ? -y : y;
  }
  const roman = t.match(/\b([IVXLCDM]{1,6})\b/i);
  if (roman && /век|в\./i.test(t)) {
    const c = romanToInt(roman[1]);
    if (c > 0 && c < 30) {
      const y = (c - 1) * 100 + 50;
      return bc ? -y : y;
    }
  }
  return null;
}

const MONTHS: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

/**
 * A stable chronological key separate from the visible date text. A full date
 * is ordered by day and month; a range and an approximate date use its first
 * reliable year. null means that the wording is intentionally left unsorted.
 */
export function parseDateSort(dateText: string): number | null {
  const text = dateText.trim().toLowerCase();
  if (!text) return null;
  const bc = /до\s*н\.?\s*э\.?/i.test(text);
  const full = text.match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{1,4})\b/i);
  let year = parseYear(text);
  let month = 1;
  let day = 1;
  if (full) {
    year = Number(full[3]) * (bc ? -1 : 1);
    month = MONTHS[full[2]];
    day = Number(full[1]);
    if (day < 1 || day > 31) return null;
  }
  if (year === null) return null;
  // Offset makes BCE dates grow in the same direction as CE dates.
  return (year + 10_000) * 10_000 + month * 100 + day;
}

/** Normalises dashes and whitespace in a date string. */
export function normalizeDate(s: string): string {
  return s
    .replace(/\s*[-—–]\s*/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

const DATE_WORD = "(?:гг?\\.|годы?|года|в\\.|век[а-я]*|до\\s*н\\.?\\s*э\\.?|н\\.?\\s*э\\.?)";
const LEADING_DATE = new RegExp(
  `^\\(?\\s*((?:\\d{1,2}\\s+[а-яё]+\\s+)?(?:\\d{1,4}|[IVXLCDM]{1,6})(?:\\s*[-—–]\\s*(?:\\d{1,4}|[IVXLCDM]{1,6}))?(?:\\s*${DATE_WORD})*(?:\\s*${DATE_WORD})*)\\s*\\)?\\s*[-—–:.;|\\t]?\\s*(.+)$`,
  "i",
);
const TRAILING_DATE = new RegExp(
  `^(.+?)\\s*[-—–:;|\\t(]\\s*((?:\\d{1,4}|[IVXLCDM]{1,6})(?:\\s*[-—–]\\s*(?:\\d{1,4}|[IVXLCDM]{1,6}))?(?:\\s*${DATE_WORD})*)\\s*\\)?\\.?$`,
  "i",
);

export interface ParsedLine {
  dateText: string;
  title: string;
}

/** Parses one pasted line into date + title. Returns null for lines that don't look like an event. */
export function parseLine(raw: string): ParsedLine | null {
  let line = raw.replace(/^\s*(?:\d{1,3}[.)]\s+|[•\-*–—]\s+)/, "").trim();
  if (!line) return null;
  line = line.replace(/\s+/g, " ");
  const tab = line.split("\t");
  if (tab.length >= 2) {
    const a = tab[0].trim();
    const b = tab.slice(1).join(" ").trim();
    if (parseYear(a) !== null) return { dateText: normalizeDate(a), title: b };
    if (parseYear(b) !== null) return { dateText: normalizeDate(b), title: a };
  }
  const lead = line.match(LEADING_DATE);
  if (lead && parseYear(lead[1]) !== null && lead[2].trim()) {
    return { dateText: normalizeDate(lead[1]), title: lead[2].trim().replace(/^[-—–:.]\s*/, "") };
  }
  const trail = line.match(TRAILING_DATE);
  if (trail && parseYear(trail[2]) !== null && trail[1].trim()) {
    return { dateText: normalizeDate(trail[2]), title: trail[1].trim() };
  }
  return { dateText: "", title: line };
}

export function parsePasted(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map(parseLine)
    .filter((p): p is ParsedLine => p !== null && (p.title !== "" || p.dateText !== ""));
}

/* ---------- editor helpers ---------- */

export function sortByDate(items: EventItem[]): EventItem[] {
  return [...items].sort((a, b) => {
    const ya = a.sortKey ?? parseDateSort(a.dateText) ?? Number.POSITIVE_INFINITY;
    const yb = b.sortKey ?? parseDateSort(b.dateText) ?? Number.POSITIVE_INFINITY;
    if (ya !== yb) return ya - yb;
    return a.dateText.localeCompare(b.dateText, "ru");
  });
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface EditorWarning {
  kind: "empty" | "duplicate" | "no-date";
  message: string;
  ids: string[];
}

export function analyzeEvents(items: EventItem[]): EditorWarning[] {
  const warnings: EditorWarning[] = [];
  const empty = items.filter((e) => !e.title.trim() && !e.dateText.trim());
  if (empty.length) {
    warnings.push({ kind: "empty", message: `Пустых строк: ${empty.length}`, ids: empty.map((e) => e.id) });
  }
  const noDate = items.filter((e) => e.title.trim() && !e.dateText.trim());
  if (noDate.length) {
    warnings.push({ kind: "no-date", message: `Без даты: ${noDate.length}`, ids: noDate.map((e) => e.id) });
  }
  const seen = new Map<string, string>();
  const dup: string[] = [];
  for (const e of items) {
    const key = e.title.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) dup.push(e.id, seen.get(key)!);
    else seen.set(key, e.id);
  }
  if (dup.length) {
    const unique = Array.from(new Set(dup));
    warnings.push({ kind: "duplicate", message: `Повторы: ${unique.length}`, ids: unique });
  }
  return warnings;
}

export function usableEvents(items: EventItem[]): EventItem[] {
  return items.filter((e) => e.title.trim() && e.dateText.trim());
}

/* ---------- selection and run plan ---------- */

export function applySelection(items: EventItem[], sel: Selection): EventItem[] {
  if (sel.type === "all") return items;
  if (sel.type === "random") {
    const n = Math.max(1, Math.min(sel.count || 1, items.length));
    return shuffle(items).slice(0, n);
  }
  return items.filter((e) => {
    if (e.yearSort === null) return false;
    if (sel.from !== null && e.yearSort < sel.from) return false;
    if (sel.to !== null && e.yearSort > sel.to) return false;
    return true;
  });
}

function askFor(direction: Direction, index: number, rnd: () => number): Ask {
  if (direction === "event-to-date") return "date";
  if (direction === "date-to-event") return "event";
  // mixed: alternate-ish but random, keep both represented
  void index;
  return rnd() < 0.5 ? "date" : "event";
}

export function buildRunPlan(opts: {
  scenarioId: string | null;
  title: string;
  events: EventItem[];
  settings: ScenarioSettings;
  selection: Selection;
}): RunPlan {
  const base = usableEvents(opts.events);
  let picked = applySelection(base, opts.selection);
  if (opts.settings.shuffle) picked = shuffle(picked);
  let items: RunItem[] = picked.map((e, i) => ({
    id: e.id,
    dateText: e.dateText,
    title: e.title,
    era: e.era,
    ask: askFor(opts.settings.direction, i, Math.random),
  }));
  if (opts.settings.direction === "mixed" && items.length > 1) {
    // guarantee that both kinds appear
    const dates = items.filter((i) => i.ask === "date").length;
    if (dates === 0) items[0] = { ...items[0], ask: "date" };
    if (dates === items.length) items[items.length - 1] = { ...items[items.length - 1], ask: "event" };
  }
  items = items.map((it) => ({ ...it }));
  return { scenarioId: opts.scenarioId, title: opts.title, items, settings: { ...opts.settings } };
}

/** Prompt shown on the board for a card. */
export function questionText(item: RunItem): string {
  return item.ask === "date" ? item.title : item.dateText;
}
export function answerText(item: RunItem): string {
  return item.ask === "date" ? item.dateText : item.title;
}

/* ---------- variants А / Б ---------- */

export interface Variants {
  a: RunItem[];
  b: RunItem[];
}

export function makeVariants(items: RunItem[]): Variants {
  const a = shuffle(items);
  let b = shuffle(items);
  // avoid identical ordering for short sets
  if (items.length > 1 && a.every((x, i) => x.id === b[i].id)) b = [...b].reverse();
  return { a, b };
}

/* ---------- formatting ---------- */

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} сек`;
  if (r === 0) return `${m} мин`;
  return `${m} мин ${r} сек`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

export function eventsWord(n: number): string {
  return `${n} ${plural(n, "событие", "события", "событий")}`;
}

export function estimateDuration(count: number, mode: Mode, intervalSec: number, countdown: boolean): number {
  const per = mode === "auto" ? intervalSec + 0.6 : 10;
  return count * per + (countdown ? 4 : 1);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const DIRECTION_LABEL: Record<Direction, string> = {
  "event-to-date": "Событие → дата",
  "date-to-event": "Дата → событие",
  mixed: "Смешанный",
};
export const MODE_LABEL: Record<Mode, string> = { auto: "Автоматически", manual: "Вручную" };

/* ---------- grading scale ---------- */

export interface GradeBand {
  grade: string;
  from: number;
  to: number;
}

export function gradingScale(total: number): GradeBand[] {
  if (total <= 0) return [];
  const min5 = Math.ceil(total * 0.9);
  const min4 = Math.ceil(total * 0.7);
  const min3 = Math.ceil(total * 0.5);
  const bands: GradeBand[] = [
    { grade: "5", from: min5, to: total },
    { grade: "4", from: min4, to: min5 - 1 },
    { grade: "3", from: min3, to: min4 - 1 },
    { grade: "2", from: 0, to: min3 - 1 },
  ];
  return bands.filter((b) => b.to >= b.from);
}

export function fmtBand(b: GradeBand): string {
  return b.from === b.to ? `${b.from}` : `${b.from}–${b.to}`;
}

/* ---------- text export ---------- */

export function itemsToText(items: RunItem[], withAnswers: boolean): string {
  return items
    .map((it, i) => {
      const q = questionText(it);
      return withAnswers ? `${i + 1}. ${q} — ${answerText(it)}` : `${i + 1}. ${q}`;
    })
    .join("\n");
}

export function eventsToText(items: EventItem[]): string {
  return items.map((e) => `${e.dateText} — ${e.title}`).join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

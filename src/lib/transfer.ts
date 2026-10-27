import type { ActiveRun, ActivityTask, ImageAsset, LocalPreference, RunItem, ScenarioFull, SessionRecord } from "./types";

export interface TransferFile {
  format: "chronos-backup" | "chronos-package";
  version: 1 | 2 | 3;
  exportedAt: string;
  scenarios: ScenarioFull[];
  sessions: SessionRecord[];
  images: ImageAsset[];
  preferences: LocalPreference[];
  activeRuns: ActiveRun[];
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function text(value: unknown): value is string { return typeof value === "string"; }
function optionalText(value: unknown) { return value === undefined || value === null || text(value); }
function preference(value:unknown):boolean {
  if(!object(value)||!text(value.id))return false;
  if(value.id.endsWith(":opened")||["modifiedAt","backupExportedAt"].includes(value.id))return text(value.value);
  if(value.id.endsWith(":favorite"))return typeof value.value==="boolean";
  return true;
}
function tasks(value: unknown): value is ActivityTask[] {
  return Array.isArray(value) && value.every(t => {
    if (!object(t) || !text(t.id) || !text(t.prompt) || !optionalText(t.explanation)) return false;
    if (t.type === "qa" || t.type === "terms") return text(t.answer);
    if (t.type === "image") return text(t.answer) && text(t.imageId) && text(t.alt) && optionalText(t.caption) && optionalText(t.source);
    if (t.type === "choice") return Array.isArray(t.options) && t.options.length >= 2 && t.options.length <= 4 && t.options.every(text) && Number.isInteger(t.correctIndex) && Number(t.correctIndex) >= 0 && Number(t.correctIndex) < t.options.length;
    if (t.type === "sequence") return Array.isArray(t.cards) && t.cards.length >= 3 && t.cards.length <= 8 && t.cards.every(c => object(c) && text(c.id) && text(c.text)) && new Set(t.cards.map(c=>c.id)).size === t.cards.length;
    return false;
  }) && new Set(value.map(t=>t.id)).size === value.length;
}
function scenario(value: unknown): boolean {
  if (!object(value) || !text(value.title) || !Array.isArray(value.events)) return false;
  const type = value.activityType ?? "dictation";
  return ["dictation","terms","sequence","qa","choice","image"].includes(String(type))
    && optionalText(value.className) && optionalText(value.section) && optionalText(value.description)
    && optionalText(value.lastOpenedAt) && optionalText(value.updatedAt) && optionalText(value.createdAt)
    && (value.favorite === undefined || typeof value.favorite === "boolean")
    && (!value.tasks || tasks(value.tasks))
    && (type === "dictation" || (Array.isArray(value.tasks) && value.tasks.every(t => t.type === type)))
    && value.events.every(e => object(e) && text(e.dateText ?? e.date ?? "") && text(e.title));
}
function runItems(value: unknown): value is RunItem[] {
  return Array.isArray(value) && value.every(it => object(it) && text(it.id) && text(it.title) && text(it.dateText) && ["date","event","term","definition"].includes(String(it.ask)) && (!it.task || tasks([it.task])) && (["term","definition"].includes(String(it.ask)) ? object(it.task)&&it.task.type==="terms" : !(object(it.task)&&it.task.type==="terms")) && (it.studyIndex===undefined || Number.isInteger(it.studyIndex)&&Number(it.studyIndex)>=0) && (it.presentationOrder===undefined || (Array.isArray(it.presentationOrder) && it.presentationOrder.every(text) && object(it.task) && it.task.type==="sequence" && Array.isArray(it.task.cards) && it.presentationOrder.length===it.task.cards.length && new Set(it.presentationOrder).size===it.presentationOrder.length && it.task.cards.every(c=>it.presentationOrder instanceof Array && it.presentationOrder.includes(c.id)))));
}
function session(value: unknown): boolean {
  return object(value) && text(value.id) && text(value.scenarioTitle) && text(value.startedAt) && text(value.finishedAt)
    && optionalText(value.scenarioId) && optionalText(value.className) && optionalText(value.notes)
    && (value.status===undefined || ["completed","interrupted"].includes(String(value.status)))
    && ["auto","manual"].includes(String(value.mode)) && ["event-to-date","date-to-event","term-to-definition","definition-to-term","mixed"].includes(String(value.direction))
    && Number.isFinite(value.durationSec) && Number.isFinite(value.intervalSec)
    && runItems(value.items) && Array.isArray(value.hardIds) && value.hardIds.every(text);
}
function active(value: unknown): boolean {
  if (!object(value) || !object(value.plan) || !runItems(value.plan.items) || !text(value.plan.title) || !object(value.plan.settings)) return false;
  const responses=value.responses;
  if(responses!==undefined && (!object(responses) || !Object.values(responses).every(r=>object(r) && (r.checked===undefined || typeof r.checked==="boolean") && (r.selected===undefined || Number.isInteger(r.selected)) && (r.order===undefined || Array.isArray(r.order)&&r.order.every(text)))))return false;
  return optionalText(value.plan.scenarioId) && value.id === "current" && Number.isInteger(value.index) && Number(value.index) >= 0 && Number(value.index) < value.plan.items.length
    && Number.isFinite(value.elapsedMs) && Number.isFinite(value.questionMs) && text(value.startedAt) && ["auto","manual"].includes(String(value.mode));
}
export function imageIds(data: Pick<TransferFile,"scenarios"|"sessions"|"activeRuns">): Set<string> {
  const ids = new Set<string>();
  const collect = (t?: ActivityTask) => { if (t?.type === "image" && t.imageId) ids.add(t.imageId); };
  data.scenarios.forEach(s=>s.tasks?.forEach(collect));
  data.sessions.forEach(s=>s.items.forEach(it=>collect(it.task)));
  data.activeRuns.forEach(r=>r.plan.items.forEach(it=>collect(it.task)));
  return ids;
}
/** Validate the entire file before opening a write transaction; drafts remain editable. */
export function inspectTransfer(value: unknown, expected?: "chronos-backup"): TransferFile {
  let raw: Record<string, unknown>;
  if (object(value) && value.format) {
    if (!["chronos-backup","chronos-package"].includes(String(value.format))) throw new Error("Неизвестный формат файла");
    if (![1,2,3].includes(Number(value.version)) || typeof value.version !== "number") throw new Error("Эта версия файла пока не поддерживается. Обновите приложение.");
    raw = value;
  } else {
    if (expected) throw new Error("Выберите полную резервную копию");
    raw = {format:"chronos-package",version:1,scenarios:Array.isArray(value)?value:[value]};
  }
  if (expected && raw.format !== expected) throw new Error("Это файл набора, а не полная резервная копия");
  const scenarios = raw.scenarios;
  const sessions = raw.sessions ?? [];
  const images = raw.images ?? [];
  const preferences = raw.preferences ?? [];
  const activeRuns = raw.activeRuns ?? [];
  if (!Array.isArray(scenarios) || !scenarios.every(scenario)
    || !Array.isArray(sessions) || !sessions.every(session)
    || !Array.isArray(images) || !images.every(i=>object(i) && text(i.id) && text(i.dataUrl) && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(i.dataUrl) && i.dataUrl.length < 12_000_000)
    || !Array.isArray(preferences) || !preferences.every(preference)
    || !Array.isArray(activeRuns) || activeRuns.length > 1 || !activeRuns.every(active)) throw new Error("Файл повреждён: проверьте структуру наборов, истории и изображений");
  for (const list of [scenarios,sessions,images]) {
    const ids = list.map(x=>x.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw new Error("В файле повторяются идентификаторы записей");
  }
  const result = { ...raw, scenarios, sessions, images, preferences, activeRuns } as unknown as TransferFile;
  const available = new Set(result.images.map(i=>i.id));
  if ([...imageIds(result)].some(id=>!available.has(id))) throw new Error("В файле отсутствует изображение, используемое в задании");
  return result;
}

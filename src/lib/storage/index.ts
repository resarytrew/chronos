"use client";

import Dexie, { type Table } from "dexie";
import { eraByYear } from "@/lib/eras";
import { LIBRARY } from "@/lib/library-data";
import { parseDateSort, parseYear, uid } from "@/lib/utils";
import { imageIds, inspectTransfer, type TransferFile } from "@/lib/transfer";
import {
  withDefaults,
  type Direction,
  type EventItem,
  type Mode,
  type RunItem,
  type ScenarioFull,
  type ScenarioSettings,
  type ScenarioSummary,
  type SessionRecord,
  type ActiveRun,
  type ScenarioMeta,
  type ActivityTask,
  type ImageAsset,
  type LocalPreference,
} from "@/lib/types";

type StoredScenario = ScenarioFull & { kind: "user" };
type StoredSession = SessionRecord;

class ChronosDatabase extends Dexie {
  scenarios!: Table<StoredScenario, string>;
  sessions!: Table<StoredSession, string>;
  activeRuns!: Table<ActiveRun, string>;
  images!: Table<ImageAsset, string>;
  preferences!: Table<LocalPreference, string>;

  constructor() {
    super("chronos");
    // Versioned schema: future releases can add .version(2).upgrade(...) here.
    this.version(1).stores({
      scenarios: "id, updatedAt, createdAt, kind",
      sessions: "id, finishedAt, startedAt, scenarioId",
    });
    this.version(2).stores({ activeRuns: "id" });
    this.version(3).stores({ images: "id", preferences: "id" }).upgrade(tx => tx.table("scenarios").toCollection().modify(s => { s.activityType ??= "dictation"; }));
  }
}

const db = new ChronosDatabase();
const saveQueues = new Map<string, Promise<unknown>>();

export interface EventInput {
  id?: string;
  dateText: string;
  title: string;
  era?: string | null;
}

export type BackupFile = TransferFile;

function now() {
  return new Date().toISOString();
}

function cleanEvents(events: EventInput[] = []): EventItem[] {
  return events.map((event) => {
    const dateText = String(event.dateText ?? "").trim();
    const yearSort = parseYear(dateText);
    return {
      id: event.id && typeof event.id === "string" ? event.id : uid(),
      dateText,
      title: String(event.title ?? "").trim(),
      yearSort,
      sortKey: parseDateSort(dateText),
      era: event.era ?? eraByYear(yearSort),
    };
  });
}

function toSummary(s: ScenarioFull): ScenarioSummary {
  return {
    activityType: s.activityType ?? "dictation",
    className: s.className, section: s.section, favorite: s.favorite, lastOpenedAt: s.lastOpenedAt,
    searchText: JSON.stringify([s.description, s.events, s.tasks]).toLowerCase(),
    id: s.id,
    title: s.title,
    description: s.description,
    kind: s.kind,
    eventCount: s.activityType && s.activityType !== "dictation" ? (s.tasks?.length ?? 0) : s.events.length,
    eras: Array.from(new Set(s.events.map((event) => event.era).filter((era): era is string => Boolean(era)))),
    updatedAt: s.updatedAt,
    createdAt: s.createdAt,
  };
}

function libraryScenarios(): ScenarioFull[] {
  return LIBRARY.map((item, index) => {
    const createdAt = "2024-01-01T00:00:00.000Z";
    return {
      id: `library-${index}`,
      title: item.title,
      description: item.description,
      kind: "library",
      activityType: "dictation",
      section: index < 7 ? "История России" : "Всеобщая история",
      settings: withDefaults(),
      events: item.events.map(([dateText, title], eventIndex) => {
        const yearSort = parseYear(dateText);
        return { id: `library-${index}-${eventIndex}`, dateText, title, yearSort, sortKey: parseDateSort(dateText), era: eraByYear(yearSort) };
      }),
      createdAt,
      updatedAt: createdAt,
    };
  });
}

function normalizeScenario(value: Partial<ScenarioFull> & { events: unknown[] }, preserveId = false): StoredScenario {
  const stamp = now();
  const events = value.events
    .filter((event) => Boolean(event && typeof event === "object"))
    .map((event) => ({
      id: preserveId ? event.id : undefined,
      dateText: String(event.dateText ?? (event as unknown as {date?:string}).date ?? ""),
      title: String(event.title ?? ""),
      era: event.era ?? null,
    }));
  return {
    id: preserveId && typeof value.id === "string" ? value.id : uid(),
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : "Импортированный сценарий",
    description: typeof value.description === "string" ? value.description : null,
    kind: "user",
    activityType: value.activityType ?? "dictation",
    className: value.className, section: value.section, favorite: value.favorite, lastOpenedAt: value.lastOpenedAt,
    tasks: value.tasks ? structuredClone(value.tasks) : [],
    settings: withDefaults(value.settings),
    events: cleanEvents(events),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : stamp,
    updatedAt: stamp,
  };
}

function enqueue<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const previous = saveQueues.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  saveQueues.set(id, next);
  return next.finally(() => {
    if (saveQueues.get(id) === next) saveQueues.delete(id);
  });
}

export const storage = {
  async getPreference<T>(id: string, fallback: T): Promise<T> { return (await db.preferences.get(id))?.value as T ?? fallback; },
  async setPreference(id: string, value: unknown) { await db.transaction("rw",db.preferences,async()=>{await db.preferences.put({id,value});await db.preferences.put({id:"modifiedAt",value:now()});}); },
  async getImage(id: string) { return db.images.get(id); },
  async putImage(image: ImageAsset) { await db.images.put(image); },
  async markOpened(id: string) {
    if (id.startsWith("library-")) { await db.preferences.put({ id: id + ":opened", value: now() }); return; }
    await db.scenarios.update(id, {lastOpenedAt: now()});
  },
  async getActiveRun() { return db.activeRuns.get("current"); },
  async saveActiveRun(run: ActiveRun) { await enqueue("active", () => db.activeRuns.put(run)); },
  async clearActiveRun() { await enqueue("active", () => db.activeRuns.delete("current")); },
  async listScenarios(kind: "user" | "library" = "user"): Promise<ScenarioSummary[]> {
    if (kind === "library") return (await this.listScenariosFull("library")).map(toSummary);
    const records = await db.scenarios.orderBy("updatedAt").reverse().toArray();
    return records.map(toSummary);
  },

  async listScenariosFull(kind: "user" | "library" = "user"): Promise<ScenarioFull[]> {
    if (kind === "library") return Promise.all(libraryScenarios().map(async s=>({
      ...s, favorite: await this.getPreference(s.id + ":favorite",false), lastOpenedAt: await this.getPreference<string | undefined>(s.id + ":opened",undefined),
    })));
    return db.scenarios.orderBy("updatedAt").reverse().toArray();
  },

  async getScenario(id: string): Promise<ScenarioFull | null> {
    const builtIn = libraryScenarios().find((scenario) => scenario.id === id);
    if (builtIn) return (await this.listScenariosFull("library")).find(s=>s.id === id) ?? null;
    return (await db.scenarios.get(id)) ?? null;
  },

  async createScenario(input: ScenarioMeta & {
    title: string;
    description?: string | null;
    settings?: Partial<ScenarioSettings>;
    events?: EventInput[];
    tasks?: ActivityTask[];
  }): Promise<ScenarioFull> {
    const stamp = now();
    const scenario: StoredScenario = {
      id: uid(),
      title: input.title?.trim() || "Новый диктант",
      description: input.description ?? null,
      kind: "user",
      activityType: input.activityType ?? "dictation",
      className: input.className, section: input.section, favorite: input.favorite,
      tasks: input.tasks ? structuredClone(input.tasks) : [],
      settings: withDefaults(input.settings),
      events: cleanEvents(input.events),
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.transaction("rw",db.scenarios,db.preferences,async()=>{await db.scenarios.add(scenario);await db.preferences.put({id:"modifiedAt",value:now()});});
    return scenario;
  },

  async updateScenario(
    id: string,
    input: ScenarioMeta & { title?: string; description?: string | null; settings?: ScenarioSettings; events?: EventItem[]; tasks?: ActivityTask[] },
    image?: ImageAsset,
  ): Promise<ScenarioFull | null> {
    return enqueue(id, async () => {
      const current = await db.scenarios.get(id);
      if (!current) return null;
      const updated: StoredScenario = {
        ...current,
        ...input,
        title: input.title === undefined ? current.title : input.title.trim() || "Без названия",
        description: input.description === undefined ? current.description : input.description,
        settings: input.settings === undefined ? current.settings : withDefaults(input.settings),
        events: input.events === undefined ? current.events : cleanEvents(input.events),
        updatedAt: now(),
      };
      await db.transaction("rw", [db.scenarios, db.preferences, db.images], async () => {if(image)await db.images.put(image);await db.scenarios.put(updated);await db.preferences.put({id:"modifiedAt",value:now()});});
      return updated;
    });
  },

  async deleteScenario(id: string): Promise<boolean> {
    const exists = await db.scenarios.get(id);
    if (!exists) return false;
    await db.transaction("rw", db.scenarios, db.preferences, async () => {await db.scenarios.delete(id);await db.preferences.put({id:"modifiedAt",value:now()});});
    return true;
  },

  async listSessions(): Promise<SessionRecord[]> {
    return db.sessions.orderBy("finishedAt").reverse().limit(200).toArray();
  },

  async createSession(input: Omit<SessionRecord, "id" | "hardIds" | "notes" | "finishedAt" | "className"> & { className?: string | null }): Promise<SessionRecord> {
    const stamp = now();
    const record: StoredSession = {
      id: uid(),
      scenarioId: input.scenarioId,
      scenarioTitle: input.scenarioTitle,
      className: input.className ?? null,
      direction: input.direction as Direction,
      mode: input.mode as Mode,
      intervalSec: input.intervalSec,
      durationSec: Math.max(0, Math.round(input.durationSec)),
      items: input.items as RunItem[],
      hardIds: [],
      notes: null,
      startedAt: input.startedAt ?? stamp,
      finishedAt: stamp,
      status: input.status ?? "completed",
      shownCount: input.shownCount ?? input.items.length,
    };
    await enqueue("active", () => db.transaction("rw", db.sessions, db.activeRuns, db.preferences, async () => {
      await db.sessions.add(record);
      await db.activeRuns.delete("current");
      await db.preferences.put({id:"modifiedAt",value:now()});
    }));
    return record;
  },

  async updateSession(id: string, input: { className?: string | null; hardIds?: string[]; notes?: string | null }): Promise<SessionRecord | null> {
    return enqueue(`session:${id}`, async () => {
      const current = await db.sessions.get(id);
      if (!current) return null;
      const updated = { ...current, ...input };
      await db.transaction("rw",db.sessions,db.preferences,async()=>{await db.sessions.put(updated);await db.preferences.put({id:"modifiedAt",value:now()});});
      return updated;
    });
  },

  async deleteSession(id: string): Promise<boolean> {
    const exists = await db.sessions.get(id);
    if (!exists) return false;
    await db.transaction("rw",db.sessions,db.preferences,async()=>{await db.sessions.delete(id);await db.preferences.put({id:"modifiedAt",value:now()});});
    return true;
  },

  async exportPackage(ids?: string[]): Promise<TransferFile> {
    await Promise.all([...saveQueues.values()]);
    const scenarios = ids ? (await db.scenarios.bulkGet(ids)).filter((s): s is StoredScenario => Boolean(s)) : await db.scenarios.toArray();
    const referenced = imageIds({scenarios,sessions:[],activeRuns:[]});
    const images = (await db.images.bulkGet([...referenced])).filter((i): i is ImageAsset=>Boolean(i));
    return {format:"chronos-package",version:3,exportedAt:now(),scenarios,sessions:[],images,preferences:[],activeRuns:[]};
  },
  async noteBackupExport() { await db.preferences.put({id:"backupExportedAt",value:now()}); },
  async backupStatus(): Promise<{exportedAt: string | null; changed: boolean}> {
    const exportedAt = (await db.preferences.get("backupExportedAt"))?.value as string | undefined;
    const modified = await db.scenarios.orderBy("updatedAt").last();
    const history = await db.sessions.orderBy("finishedAt").last();
    const changedAt=(await db.preferences.get("modifiedAt"))?.value as string | undefined;
    return {exportedAt:exportedAt ?? null,changed: Boolean((changedAt&&(!exportedAt||changedAt>exportedAt)) || (modified && (!exportedAt || modified.updatedAt > exportedAt)) || (history && (!exportedAt || history.finishedAt > exportedAt)))};
  },
  async exportAll(): Promise<BackupFile> {
    await Promise.all([...saveQueues.values()]);
    return db.transaction("r", [db.scenarios,db.sessions,db.images,db.preferences,db.activeRuns], async () => ({
      format:"chronos-backup" as const,version:3 as const,exportedAt:now(),
      scenarios:await db.scenarios.toArray(),sessions:await db.sessions.toArray(),
      images:await db.images.toArray(),preferences:await db.preferences.toArray(),activeRuns:await db.activeRuns.toArray(),
    }));
  },
  inspectTransfer,
  async importAll(value: unknown, mode: "merge" | "replace"): Promise<{scenarios:number;sessions:number}> {
    const file = inspectTransfer(value);
    const scenarios = file.scenarios.map(s=>normalizeScenario(s,true));
    await Promise.all([...saveQueues.values()]);
    await db.transaction("rw", [db.scenarios,db.sessions,db.images,db.preferences,db.activeRuns], async () => {
      if (mode === "replace") {
        await Promise.all([db.scenarios.clear(),db.sessions.clear(),db.images.clear(),db.preferences.clear(),db.activeRuns.clear()]);
      }
      const assetMap = new Map<string,string>();
      for (const image of file.images) {
        const existing = await db.images.get(image.id);
        const id = existing && existing.dataUrl !== image.dataUrl ? uid() : image.id;
        assetMap.set(image.id,id);
        await db.images.put({...image,id});
      }
      const remapTask = (task: ActivityTask): ActivityTask => task.type === "image" ? {...task,imageId:assetMap.get(task.imageId) ?? task.imageId} : task;
      const remapItem = (it:RunItem): RunItem => ({...it,task:it.task ? remapTask(it.task) : undefined});
      const scenarioMap = new Map<string,string>();
      for (const s of scenarios) {
        const id = await db.scenarios.get(s.id) ? uid() : s.id;
        scenarioMap.set(s.id,id);
        await db.scenarios.add({...s,id,tasks:s.tasks?.map(remapTask)});
      }
      for (const s of file.sessions) {
        const id = await db.sessions.get(s.id) ? uid() : s.id;
        await db.sessions.add({...s,id,scenarioId:s.scenarioId ? scenarioMap.get(s.scenarioId) ?? s.scenarioId : null,items:s.items.map(remapItem)});
      }
      for (const p of file.preferences) {
        if (mode === "replace" || !(await db.preferences.get(p.id))) await db.preferences.put(p);
      }
      if (mode === "replace" || !(await db.activeRuns.get("current"))) {
        for (const r of file.activeRuns) await db.activeRuns.put({...r,plan:{...r.plan,scenarioId:r.plan.scenarioId ? scenarioMap.get(r.plan.scenarioId) ?? r.plan.scenarioId : null,items:r.plan.items.map(remapItem)}});
      }
      await db.preferences.put({id:"modifiedAt",value:now()});
    });
    return {scenarios:scenarios.length,sessions:file.sessions.length};
  },
  async collectUnusedImages() {
    await db.transaction("rw",[db.scenarios,db.sessions,db.activeRuns,db.images],async()=>{
      const ids = imageIds({scenarios:await db.scenarios.toArray(),sessions:await db.sessions.toArray(),activeRuns:await db.activeRuns.toArray()});
      const unused = (await db.images.toArray()).filter(i=>!ids.has(i.id)).map(i=>i.id);
      await db.images.bulkDelete(unused);
    });
  },
};

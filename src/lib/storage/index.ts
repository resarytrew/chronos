"use client";

import Dexie, { type Table } from "dexie";
import { eraByYear } from "@/lib/eras";
import { LIBRARY } from "@/lib/library-data";
import { parseDateSort, parseYear, uid } from "@/lib/utils";
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
} from "@/lib/types";

type StoredScenario = ScenarioFull & { kind: "user" };
type StoredSession = SessionRecord;

class ChronosDatabase extends Dexie {
  scenarios!: Table<StoredScenario, string>;
  sessions!: Table<StoredSession, string>;

  constructor() {
    super("chronos");
    // Versioned schema: future releases can add .version(2).upgrade(...) here.
    this.version(1).stores({
      scenarios: "id, updatedAt, createdAt, kind",
      sessions: "id, finishedAt, startedAt, scenarioId",
    });
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

export interface BackupFile {
  format: "chronos-backup";
  version: 1;
  exportedAt: string;
  scenarios: ScenarioFull[];
  sessions: SessionRecord[];
}

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
    id: s.id,
    title: s.title,
    description: s.description,
    kind: s.kind,
    eventCount: s.events.length,
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

function validScenario(value: unknown): value is Partial<ScenarioFull> & { events: unknown[] } {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { events?: unknown }).events));
}

function normalizeScenario(value: Partial<ScenarioFull> & { events: unknown[] }, preserveId = false): StoredScenario {
  const stamp = now();
  const events = value.events
    .filter((event) => Boolean(event && typeof event === "object"))
    .map((event) => ({
      id: preserveId ? event.id : undefined,
      dateText: String(event.dateText ?? ""),
      title: String(event.title ?? ""),
      era: event.era ?? null,
    }));
  return {
    id: preserveId && typeof value.id === "string" ? value.id : uid(),
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : "Импортированный сценарий",
    description: typeof value.description === "string" ? value.description : null,
    kind: "user",
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
  async listScenarios(kind: "user" | "library" = "user"): Promise<ScenarioSummary[]> {
    if (kind === "library") return libraryScenarios().map(toSummary);
    const records = await db.scenarios.orderBy("updatedAt").reverse().toArray();
    return records.map(toSummary);
  },

  async listScenariosFull(kind: "user" | "library" = "user"): Promise<ScenarioFull[]> {
    if (kind === "library") return libraryScenarios();
    return db.scenarios.orderBy("updatedAt").reverse().toArray();
  },

  async getScenario(id: string): Promise<ScenarioFull | null> {
    const builtIn = libraryScenarios().find((scenario) => scenario.id === id);
    if (builtIn) return builtIn;
    return (await db.scenarios.get(id)) ?? null;
  },

  async createScenario(input: {
    title: string;
    description?: string | null;
    settings?: Partial<ScenarioSettings>;
    events?: EventInput[];
  }): Promise<ScenarioFull> {
    const stamp = now();
    const scenario: StoredScenario = {
      id: uid(),
      title: input.title?.trim() || "Новый диктант",
      description: input.description ?? null,
      kind: "user",
      settings: withDefaults(input.settings),
      events: cleanEvents(input.events),
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.scenarios.add(scenario);
    return scenario;
  },

  async updateScenario(
    id: string,
    input: { title?: string; description?: string | null; settings?: ScenarioSettings; events?: EventItem[] },
  ): Promise<ScenarioFull | null> {
    return enqueue(id, async () => {
      const current = await db.scenarios.get(id);
      if (!current) return null;
      const updated: StoredScenario = {
        ...current,
        title: input.title === undefined ? current.title : input.title.trim() || "Без названия",
        description: input.description === undefined ? current.description : input.description,
        settings: input.settings === undefined ? current.settings : withDefaults(input.settings),
        events: input.events === undefined ? current.events : cleanEvents(input.events),
        updatedAt: now(),
      };
      await db.transaction("rw", db.scenarios, async () => db.scenarios.put(updated));
      return updated;
    });
  },

  async deleteScenario(id: string): Promise<boolean> {
    const exists = await db.scenarios.get(id);
    if (!exists) return false;
    await db.transaction("rw", db.scenarios, async () => db.scenarios.delete(id));
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
    };
    await db.sessions.add(record);
    return record;
  },

  async updateSession(id: string, input: { className?: string | null; hardIds?: string[]; notes?: string | null }): Promise<SessionRecord | null> {
    return enqueue(`session:${id}`, async () => {
      const current = await db.sessions.get(id);
      if (!current) return null;
      const updated = { ...current, ...input };
      await db.sessions.put(updated);
      return updated;
    });
  },

  async deleteSession(id: string): Promise<boolean> {
    const exists = await db.sessions.get(id);
    if (!exists) return false;
    await db.sessions.delete(id);
    return true;
  },

  async exportAll(): Promise<BackupFile> {
    const [scenarios, sessions] = await Promise.all([db.scenarios.toArray(), db.sessions.toArray()]);
    return { format: "chronos-backup", version: 1, exportedAt: now(), scenarios, sessions };
  },

  async importAll(value: unknown, mode: "merge" | "replace"): Promise<{ scenarios: number; sessions: number }> {
    if (!value || typeof value !== "object") throw new Error("Некорректный файл резервной копии");
    const backup = value as Partial<BackupFile>;
    if (backup.format !== "chronos-backup" || backup.version !== 1 || !Array.isArray(backup.scenarios) || !Array.isArray(backup.sessions)) {
      throw new Error("Файл не является резервной копией «Хроноса»");
    }
    const scenarios = backup.scenarios.filter(validScenario).map((scenario) => normalizeScenario(scenario, true));
    const sessions = backup.sessions.filter((session): session is SessionRecord => Boolean(session && typeof session === "object" && Array.isArray((session as SessionRecord).items))).map((session) => ({ ...session, id: typeof session.id === "string" ? session.id : uid() }));
    await db.transaction("rw", db.scenarios, db.sessions, async () => {
      if (mode === "replace") {
        await db.scenarios.clear();
        await db.sessions.clear();
      }
      // On collision, a new id preserves both the current and imported teacher data.
      for (const scenario of scenarios) {
        const id = (await db.scenarios.get(scenario.id)) ? uid() : scenario.id;
        await db.scenarios.put({ ...scenario, id });
      }
      for (const session of sessions) {
        const id = (await db.sessions.get(session.id)) ? uid() : session.id;
        await db.sessions.put({ ...session, id });
      }
    });
    return { scenarios: scenarios.length, sessions: sessions.length };
  },
};

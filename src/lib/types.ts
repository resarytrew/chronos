export type Direction = "event-to-date" | "date-to-event" | "mixed";
export type Mode = "auto" | "manual";
export type BoardTheme = "light" | "dark";
export type FontScale = "m" | "l" | "xl";

export interface ScenarioSettings {
  intervalSec: number;
  mode: Mode;
  direction: Direction;
  shuffle: boolean;
  countdown: boolean;
  voice: boolean;
  beep: boolean;
  theme: BoardTheme;
  fontScale: FontScale;
}

export const DEFAULT_SETTINGS: ScenarioSettings = {
  intervalSec: 7,
  mode: "auto",
  direction: "event-to-date",
  shuffle: false,
  countdown: true,
  voice: false,
  beep: true,
  theme: "light",
  fontScale: "l",
};

export function withDefaults(s?: Partial<ScenarioSettings> | null): ScenarioSettings {
  const v = { ...DEFAULT_SETTINGS, ...(s && typeof s === "object" ? s : {}) };
  return {
    ...v,
    intervalSec: Number.isFinite(v.intervalSec) ? Math.max(3,Math.min(30,Math.round(v.intervalSec))) : 7,
    mode: v.mode === "manual" ? "manual" : "auto",
    direction: ["event-to-date","date-to-event","mixed"].includes(v.direction) ? v.direction : "event-to-date",
    theme: v.theme === "dark" ? "dark" : "light",
    fontScale: ["m","l","xl"].includes(v.fontScale) ? v.fontScale : "l",
    shuffle:Boolean(v.shuffle),countdown:Boolean(v.countdown),voice:Boolean(v.voice),beep:Boolean(v.beep),
  };
}

export interface EventItem {
  id: string;
  dateText: string;
  title: string;
  yearSort: number | null;
  /** Normalized chronological sort value; keeps the teacher's dateText untouched. */
  sortKey?: number | null;
  era: string | null;
}

export interface ScenarioMeta {
  activityType?: ActivityType;
  className?: string;
  section?: string;
  favorite?: boolean;
  lastOpenedAt?: string;
}

export interface ScenarioSummary extends ScenarioMeta {
  searchText?: string;
  id: string;
  title: string;
  description: string | null;
  kind: string;
  eventCount: number;
  eras: string[];
  updatedAt: string;
  createdAt: string;
}

export interface ScenarioFull extends ScenarioMeta {
  tasks?: ActivityTask[];
  id: string;
  title: string;
  description: string | null;
  kind: string;
  settings: ScenarioSettings;
  events: EventItem[];
  updatedAt: string;
  createdAt: string;
}

/** What students have to write down for this card. */
export type Ask = "date" | "event";

export interface RunItem {
  task?: ActivityTask;
  id: string;
  dateText: string;
  title: string;
  era: string | null;
  ask: Ask;
}

export type Selection =
  | { type: "all" }
  | { type: "random"; count: number }
  | { type: "range"; from: number | null; to: number | null };

export interface RunPlan {
  scenarioId: string | null;
  title: string;
  items: RunItem[];
  settings: ScenarioSettings;
  /** true when the plan reproduces a previously shown order */
  repeat?: boolean;
}

export interface SessionRecord {
  status?: "completed" | "interrupted";
  shownCount?: number;
  id: string;
  scenarioId: string | null;
  scenarioTitle: string;
  className: string | null;
  direction: Direction;
  mode: Mode;
  intervalSec: number;
  durationSec: number;
  items: RunItem[];
  hardIds: string[];
  notes: string | null;
  startedAt: string;
  finishedAt: string;
}

export interface ActiveRun {
  responses?: Record<string, TaskResponse>;
  id: "current";
  plan: RunPlan;
  index: number;
  elapsedMs: number;
  questionMs: number;
  mode: Mode;
  startedAt: string;
}

export type ActivityType = "dictation" | "sequence" | "qa" | "choice" | "image";
interface TaskBase { id: string; prompt: string; explanation?: string }
export type ActivityTask =
  | (TaskBase & { type: "sequence"; cards: { id: string; text: string }[] })
  | (TaskBase & { type: "qa"; answer: string })
  | (TaskBase & { type: "choice"; options: string[]; correctIndex: number })
  | (TaskBase & { type: "image"; answer: string; imageId: string; alt: string; caption?: string; source?: string });
export interface TaskResponse { order?: string[]; selected?: number; checked?: boolean }
export interface ImageAsset { id: string; dataUrl: string }
export interface LocalPreference { id: string; value: unknown }

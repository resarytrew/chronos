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
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
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

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  eventCount: number;
  eras: string[];
  updatedAt: string;
  createdAt: string;
}

export interface ScenarioFull {
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
  id: "current";
  plan: RunPlan;
  index: number;
  elapsedMs: number;
  questionMs: number;
  mode: Mode;
  startedAt: string;
}

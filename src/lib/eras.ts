export interface Era {
  key: string;
  label: string;
  short: string;
  color: string;
  from: number; // inclusive
  to: number; // exclusive
}

/** Muted palette: the only colour accent in an otherwise monochrome UI. */
export const ERAS: Era[] = [
  { key: "ancient", label: "Древний мир", short: "Древность", color: "#b08968", from: -100000, to: 476 },
  { key: "medieval", label: "Средние века", short: "Средневековье", color: "#6c8e5a", from: 476, to: 1500 },
  { key: "early-modern", label: "Раннее Новое время", short: "XVI–XVII вв.", color: "#4e8c8a", from: 1500, to: 1700 },
  { key: "c18", label: "XVIII век", short: "XVIII в.", color: "#4f7cac", from: 1700, to: 1800 },
  { key: "c19", label: "XIX век", short: "XIX в.", color: "#7a6cae", from: 1800, to: 1900 },
  { key: "c20a", label: "Первая половина XX века", short: "1900–1945", color: "#b05e5e", from: 1900, to: 1946 },
  { key: "c20b", label: "Вторая половина XX века", short: "1946–1991", color: "#c08a3e", from: 1946, to: 1992 },
  { key: "contemporary", label: "Современность", short: "с 1992", color: "#5f6b73", from: 1992, to: 100000 },
];

export const ERA_MAP: Record<string, Era> = Object.fromEntries(ERAS.map((e) => [e.key, e]));

export function eraByYear(year: number | null | undefined): string | null {
  if (year === null || year === undefined || Number.isNaN(year)) return null;
  const era = ERAS.find((e) => year >= e.from && year < e.to);
  return era ? era.key : null;
}

export function eraColor(key: string | null | undefined): string | null {
  if (!key) return null;
  return ERA_MAP[key]?.color ?? null;
}

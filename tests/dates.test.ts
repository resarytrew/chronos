import assert from "node:assert/strict";
import test from "node:test";
import { parseDateSort, parseYear, sortByDate } from "../src/lib/utils";
import type { EventItem } from "../src/lib/types";

test("full Russian dates are ordered by day and month", () => {
  const dates: EventItem[] = [
    { id: "october", dateText: "17 октября 1905 года", title: "Манифест", yearSort: parseYear("17 октября 1905 года"), era: null },
    { id: "january", dateText: "9 января 1905 года", title: "Кровавое воскресенье", yearSort: parseYear("9 января 1905 года"), era: null },
  ];
  assert.deepEqual(sortByDate(dates).map((event) => event.id), ["january", "october"]);
});

test("years, ranges, centuries and BCE dates receive deterministic keys", () => {
  assert.ok((parseDateSort("1670–1671") ?? 0) < (parseDateSort("1700") ?? 0));
  assert.ok((parseDateSort("V век") ?? 0) < (parseDateSort("IX век") ?? 0));
  assert.ok((parseDateSort("776 до н. э.") ?? 0) < (parseDateSort("1 год н. э.") ?? 0));
  assert.equal(parseDateSort("неизвестно"), null);
});

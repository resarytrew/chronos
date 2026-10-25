import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage } from "../src/lib/storage";
import { DEFAULT_SETTINGS } from "../src/lib/types";

test("completed history atomically replaces the recovery checkpoint", async () => {
  const scenario = await storage.createScenario({ title: "Тест", events: [{ dateText: "988", title: "Крещение Руси" }] });
  const items = [{ ...scenario.events[0], ask: "date" as const }];
  await storage.saveActiveRun({ id: "current", plan: { scenarioId: scenario.id, title: scenario.title, items, settings: DEFAULT_SETTINGS }, index: 0, mode: "manual", elapsedMs: 2000, questionMs: 1000, startedAt: new Date().toISOString() });
  assert.equal((await storage.getActiveRun())?.index, 0);
  const session = await storage.createSession({ scenarioId: scenario.id, scenarioTitle: scenario.title, items, mode: "manual", direction: "event-to-date", intervalSec: 7, durationSec: 2, startedAt: new Date().toISOString(), status: "interrupted", shownCount: 1 });
  assert.equal(session.status, "interrupted");
  assert.equal(await storage.getActiveRun(), undefined);
  await storage.updateScenario(scenario.id, { title: "Изменено", events: [] });
  assert.equal((await storage.listSessions()).find(s => s.id === session.id)?.items.length, 1);
});

test("unknown backup version is rejected before replacing existing data", async () => {
  const before = await storage.listScenarios();
  await assert.rejects(storage.importAll({ format: "chronos-backup", version: 99, scenarios: [], sessions: [] }, "replace"));
  assert.deepEqual(await storage.listScenarios(), before);
});

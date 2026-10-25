"use client";

import { useEffect, useState } from "react";
import ScenarioList from "@/components/ScenarioList";
import { api } from "@/lib/client";
import type { ScenarioSummary } from "@/lib/types";

export default function HomePage() {
  const [items, setItems] = useState<ScenarioSummary[]>([]);
  useEffect(() => {
    void api.listScenarios("user").then(setItems);
  }, []);
  return <ScenarioList initial={items} />;
}

"use client";

import { useEffect, useState } from "react";
import LibraryList from "@/components/LibraryList";
import { api } from "@/lib/client";
import type { ScenarioFull } from "@/lib/types";

export default function LibraryPage() {
  const [items, setItems] = useState<ScenarioFull[]>([]);
  useEffect(() => {
    void api.listScenariosFull("library").then(setItems);
  }, []);
  return <LibraryList items={items} />;
}

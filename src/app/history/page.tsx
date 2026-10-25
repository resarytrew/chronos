"use client";

import { useEffect, useState } from "react";
import HistoryList from "@/components/HistoryList";
import { api } from "@/lib/client";
import type { SessionRecord } from "@/lib/types";

export default function HistoryPage() {
  const [items, setItems] = useState<SessionRecord[]>([]);
  useEffect(() => {
    void api.listSessions().then(setItems);
  }, []);
  return <HistoryList initial={items} />;
}

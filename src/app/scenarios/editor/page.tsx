"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ScenarioEditor from "@/components/editor/ScenarioEditor";
import { api } from "@/lib/client";
import type { ScenarioFull } from "@/lib/types";

function EditorContent() {
  const params = useSearchParams();
  const id = params.get("id");
  const [scenario, setScenario] = useState<ScenarioFull | null | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setScenario(null);
      return;
    }
    void api.getScenario(id).then(s=>{setScenario(s);if(s)void api.markOpened(id).catch(()=>{});}).catch(() => setScenario(null));
  }, [id]);

  if (scenario === undefined) return <div className="p-8 text-mute">Открываем сценарий…</div>;
  if (!scenario || scenario.kind !== "user") return <div className="p-8">Сценарий не найден или был удалён.</div>;
  return <ScenarioEditor key={scenario.id} initial={scenario} autoPaste={params.get("paste") === "1"} />;
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-mute">Открываем сценарий…</div>}>
      <EditorContent />
    </Suspense>
  );
}

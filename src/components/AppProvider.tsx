"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ActiveRun, RunPlan, SessionRecord } from "@/lib/types";
import { api } from "@/lib/client";
import PwaRegistration from "./PwaRegistration";

const Board = dynamic(() => import("./Board"), { ssr: false });

interface PlayerState {
  resume?: ActiveRun;
  plan: RunPlan;
  initialPhase: "start" | "review";
  session: SessionRecord | null;
  onClosed?: () => void;
}

interface AppContextValue {
  startRun: (plan: RunPlan, onClosed?: () => void) => void;
  openReview: (session: SessionRecord, onClosed?: () => void) => void;
  toast: (message: string) => void;
  openHelp: () => void;
  helpOpen: boolean;
  closeHelp: () => void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

export default function AppProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, setPending] = useState<ActiveRun | null>(null);
  useEffect(() => { void api.getActiveRun().then((r) => setPending(r ?? null)).catch(() => {}); }, []);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const startRun = useCallback((plan: RunPlan, onClosed?: () => void) => {
    setPlayer({ plan, initialPhase: "start", session: null, onClosed });
  }, []);

  const openReview = useCallback((session: SessionRecord, onClosed?: () => void) => {
    const plan: RunPlan = {
      scenarioId: session.scenarioId,
      title: session.scenarioTitle,
      items: session.items,
      settings: {
        intervalSec: session.intervalSec,
        mode: session.mode,
        direction: session.direction,
        shuffle: false,
        countdown: false,
        voice: false,
        beep: false,
        theme: "light",
        fontScale: "l",
      },
      repeat: true,
    };
    setPlayer({ plan, initialPhase: "review", session, onClosed });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      startRun,
      openReview,
      toast,
      openHelp: () => setHelpOpen(true),
      closeHelp: () => setHelpOpen(false),
      helpOpen,
    }),
    [startRun, openReview, toast, helpOpen],
  );

  return (
    <Ctx.Provider value={value}>
      <div inert={Boolean(player)}>{children}</div>
      <PwaRegistration active={Boolean(player)} />
      {pending && !player && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="card max-w-lg p-8"><h2 className="text-2xl font-semibold">Продолжить занятие?</h2><p className="my-4">{pending.plan.title} · задание {pending.index + 1} из {pending.plan.items.length}</p><div className="flex flex-wrap gap-3"><button className="btn btn-primary" onClick={() => { setPlayer({ plan: pending.plan, initialPhase: "start", session: null, resume: pending }); setPending(null); }}>Продолжить с паузы</button><button className="btn" onClick={() => { void api.clearActiveRun().then(() => { setPlayer({ plan: pending.plan, initialPhase: "start", session: null }); setPending(null); }).catch(() => toast("Не удалось сбросить позицию")); }}>Начать заново</button><button className="btn" onClick={() => setPending(null)}>Позже</button></div></div></div>}
      {player && (
        <Board
          plan={player.plan}
          resume={player.resume}
          initialPhase={player.initialPhase}
          session={player.session}
          toast={toast}
          onClose={() => {
            const cb = player.onClosed;
            setPlayer(null);
            cb?.();
          }}
        />
      )}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

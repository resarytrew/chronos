"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { RunPlan, SessionRecord } from "@/lib/types";

const Board = dynamic(() => import("./Board"), { ssr: false });

interface PlayerState {
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
      {children}
      {player && (
        <Board
          plan={player.plan}
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

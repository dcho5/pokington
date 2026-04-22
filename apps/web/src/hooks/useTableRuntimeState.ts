"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getShowdownCountdownSeconds,
  hasCompletedShowdownPresentation,
} from "lib/showdownUi.mjs";
import type { Player } from "types/player";

interface UseTableRuntimeStateArgs {
  phase: string;
  handNumber: number;
  runCount: 1 | 2 | 3;
  settledRunCount: number;
  publicShowdownRevealComplete: boolean;
  nextHandStartsAt: number | null;
  viewingPlayer: Player | null;
  viewerStack: number;
  viewingSeat: number;
}

export function useTableRuntimeState({
  phase,
  handNumber,
  runCount,
  settledRunCount,
  publicShowdownRevealComplete,
  nextHandStartsAt,
  viewingPlayer,
  viewerStack,
  viewingSeat,
}: UseTableRuntimeStateArgs) {
  const [showdownCountdown, setShowdownCountdown] = useState<number | null>(null);
  const [showRebuySheet, setShowRebuySheet] = useState(false);
  const [rebuyInfo, setRebuyInfo] = useState<{ name: string; seat: number } | null>(null);

  useEffect(() => {
    const allSettled = hasCompletedShowdownPresentation({
      settledRunCount,
      runCount,
      publicShowdownRevealComplete,
    });
    if (phase === "showdown" && viewerStack === 0 && viewingPlayer !== null && allSettled) {
      setRebuyInfo({ name: viewingPlayer.name, seat: viewingSeat });
      setShowRebuySheet(true);
    }

    if (showRebuySheet && viewerStack > 0) {
      setShowRebuySheet(false);
      setRebuyInfo(null);
    }
  }, [phase, viewerStack, viewingPlayer, viewingSeat, settledRunCount, runCount, publicShowdownRevealComplete, showRebuySheet]);

  useEffect(() => {
    if (phase !== "showdown" || !publicShowdownRevealComplete || nextHandStartsAt == null) {
      setShowdownCountdown(null);
      return;
    }

    const syncCountdown = () => {
      setShowdownCountdown(
        getShowdownCountdownSeconds({
          phase,
          nextHandStartsAt,
        }),
      );
    };
    syncCountdown();
    const interval = setInterval(syncCountdown, 250);

    return () => {
      clearInterval(interval);
    };
  }, [
    phase,
    handNumber,
    publicShowdownRevealComplete,
    nextHandStartsAt,
  ]);

  const dismissRebuy = useCallback(() => {
    setShowRebuySheet(false);
    setRebuyInfo(null);
  }, []);

  return {
    showdownCountdown,
    showRebuySheet,
    rebuyInfo,
    dismissRebuy,
  };
}

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
  viewerPendingBoundaryUpdate?: { chipDelta: number; leaveSeat: boolean } | null;
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
  viewerPendingBoundaryUpdate = null,
}: UseTableRuntimeStateArgs) {
  const [showdownCountdown, setShowdownCountdown] = useState<number | null>(null);
  const [showSeatManager, setShowSeatManager] = useState(false);
  const [dismissedSeatManagerHand, setDismissedSeatManagerHand] = useState<number | null>(null);

  useEffect(() => {
    const allSettled = hasCompletedShowdownPresentation({
      settledRunCount,
      runCount,
      publicShowdownRevealComplete,
    });
    const hasQueuedReload = !!viewerPendingBoundaryUpdate && viewerPendingBoundaryUpdate.chipDelta > 0;
    const boundaryPhase = phase === "showdown" || phase === "waiting";
    if (
      boundaryPhase &&
      viewerStack === 0 &&
      viewingPlayer !== null &&
      allSettled &&
      !hasQueuedReload &&
      dismissedSeatManagerHand !== handNumber
    ) {
      setShowSeatManager(true);
    }
  }, [phase, viewerStack, viewingPlayer, viewingSeat, settledRunCount, runCount, publicShowdownRevealComplete, viewerPendingBoundaryUpdate, dismissedSeatManagerHand, handNumber]);

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

  const openSeatManager = useCallback(() => {
    setShowSeatManager(true);
  }, []);

  const dismissSeatManager = useCallback(() => {
    setShowSeatManager(false);
    setDismissedSeatManagerHand(handNumber);
  }, [handNumber]);

  return {
    showdownCountdown,
    showSeatManager,
    openSeatManager,
    dismissSeatManager,
  };
}

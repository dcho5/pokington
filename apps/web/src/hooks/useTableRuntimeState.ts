"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getShowdownCountdownDelayMs,
  hasCompletedShowdownPresentation,
} from "lib/showdownUi.mjs";
import type { Player } from "types/player";
import { useGameStore } from "store/useGameStore";

interface UseTableRuntimeStateArgs {
  phase: string;
  handNumber: number;
  runCount: 1 | 2 | 3;
  animatedShowdownReveal: boolean;
  revealRunsConcurrently: boolean;
  knownCardCount: number;
  settledRunCount: number;
  publicShowdownRevealComplete: boolean;
  showdownStartedAt: number | null;
  viewingPlayer: Player | null;
  viewerStack: number;
  viewingSeat: number;
}

export function useTableRuntimeState({
  phase,
  handNumber,
  runCount,
  animatedShowdownReveal,
  revealRunsConcurrently,
  knownCardCount,
  settledRunCount,
  publicShowdownRevealComplete,
  showdownStartedAt,
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
    if (phase !== "showdown" || !publicShowdownRevealComplete) {
      setShowdownCountdown(null);
      return;
    }

    const delayUntilCountdown = getShowdownCountdownDelayMs({
      phase,
      animatedShowdownReveal,
      revealRunsConcurrently,
      knownCardCount,
      runCount,
      publicShowdownRevealComplete,
      showdownStartedAt,
    });
    if (delayUntilCountdown == null) {
      setShowdownCountdown(null);
      return;
    }

    const countdownSeconds = 10;
    let startDelay: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    startDelay = setTimeout(() => {
      setShowdownCountdown(countdownSeconds);
      interval = setInterval(() => {
        setShowdownCountdown((previous) => {
          if (previous === null || previous <= 1) {
            clearInterval(interval!);
            useGameStore.getState().startHand();
            return null;
          }
          return previous - 1;
        });
      }, 1000);
    }, delayUntilCountdown);

    return () => {
      if (startDelay) clearTimeout(startDelay);
      if (interval) clearInterval(interval);
    };
  }, [
    phase,
    handNumber,
    runCount,
    animatedShowdownReveal,
    revealRunsConcurrently,
    knownCardCount,
    publicShowdownRevealComplete,
    showdownStartedAt,
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

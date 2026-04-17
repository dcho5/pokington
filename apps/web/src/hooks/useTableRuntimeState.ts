"use client";

import { useCallback, useEffect, useState } from "react";
import { getRunTimings, ANNOUNCE_DELAY_S } from "lib/showdownTiming";
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
  viewingPlayer,
  viewerStack,
  viewingSeat,
}: UseTableRuntimeStateArgs) {
  const [showdownCountdown, setShowdownCountdown] = useState<number | null>(null);
  const [showRebuySheet, setShowRebuySheet] = useState(false);
  const [rebuyInfo, setRebuyInfo] = useState<{ name: string; seat: number } | null>(null);

  useEffect(() => {
    const allSettled = settledRunCount >= runCount;
    if (phase === "showdown" && viewerStack === 0 && viewingPlayer !== null && allSettled) {
      setRebuyInfo({ name: viewingPlayer.name, seat: viewingSeat });
      setShowRebuySheet(true);
    }

    if (showRebuySheet && viewerStack > 0) {
      setShowRebuySheet(false);
      setRebuyInfo(null);
    }
  }, [phase, viewerStack, viewingPlayer, viewingSeat, settledRunCount, runCount, showRebuySheet]);

  useEffect(() => {
    if (phase !== "showdown") {
      setShowdownCountdown(null);
      return;
    }

    const { chipStartS, runIntervalS } = getRunTimings(knownCardCount, { revealRunsConcurrently });
    const chipDurationS = 2.4;
    const animDoneMs = animatedShowdownReveal
      ? (ANNOUNCE_DELAY_S + (runCount - 1) * runIntervalS + chipStartS + chipDurationS + 1.5) * 1000
      : 0;

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
    }, animDoneMs);

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

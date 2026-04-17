import { useState, useEffect } from "react";
import {
  ANNOUNCE_DELAY_S,
  CHIP_DURATION_S,
  getRunTimings,
  NORMAL_LAND_MS,
  WINNER_STAGGER_BUFFER_S,
} from "lib/showdownTiming";
import { deriveVisibleRunState } from "lib/runAnimation";
import type { RunResult } from "@pokington/engine";

/**
 * Returns how many runs have "settled" (winning chips have landed).
 *
 * For non-run-it showdowns: returns 0 or 1.
 * For run-it showdowns:     returns 0..runCount.
 */
export function useSettledRunsCount(
  phase: string,
  hasAnimatedShowdown: boolean,
  showdownStartedAt: number | null,
  knownCardCount: number,
  runCount: number,
  revealRunsConcurrently = false,
): number {
  const [settled, setSettled] = useState(0);

  useEffect(() => {
    if (phase !== "showdown" || showdownStartedAt == null) {
      setSettled(0);
      return;
    }

    const elapsed = Date.now() - showdownStartedAt;

    if (!hasAnimatedShowdown) {
      // Single-run: one transition at NORMAL_LAND_MS
      if (elapsed >= NORMAL_LAND_MS) {
        setSettled(1);
        return;
      }
      const delay = NORMAL_LAND_MS - elapsed;
      const id = setTimeout(() => setSettled(1), delay);
      return () => clearTimeout(id);
    }

    // Multi-run: compute all landing times, schedule timeouts for future ones
    const { chipStartS, runIntervalS } = getRunTimings(knownCardCount, { revealRunsConcurrently });
    const landTimes: number[] = [];
    for (let r = 0; r < runCount; r++) {
      landTimes.push(
        (ANNOUNCE_DELAY_S + r * runIntervalS + chipStartS + CHIP_DURATION_S + WINNER_STAGGER_BUFFER_S) * 1000
      );
    }

    // Count already-settled runs
    let alreadySettled = 0;
    for (const t of landTimes) {
      if (elapsed >= t) alreadySettled++;
    }
    setSettled(alreadySettled);

    // Schedule timeouts for future transitions
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    for (let r = alreadySettled; r < runCount; r++) {
      const delay = landTimes[r] - elapsed;
      timeoutIds.push(setTimeout(() => setSettled(r + 1), delay));
    }

    return () => timeoutIds.forEach(clearTimeout);
  }, [phase, showdownStartedAt, hasAnimatedShowdown, knownCardCount, runCount, revealRunsConcurrently]);

  return settled;
}

/**
 * Returns the run index and revealed card count currently visible on the RunItBoard.
 */
export function useCurrentRun(
  phase: string,
  isRunItBoard: boolean,
  knownCardCount: number,
  runResults: RunResult[],
): { currentRun: number; revealedCount: number } {
  if (phase !== "showdown" || !isRunItBoard) {
    return { currentRun: 0, revealedCount: knownCardCount };
  }
  return deriveVisibleRunState(runResults, knownCardCount);
}

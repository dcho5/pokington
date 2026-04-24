import { useState, useEffect } from "react";
import {
  ANNOUNCE_DELAY_S,
  getRunTimings,
  NORMAL_SETTLE_MS,
} from "lib/showdownTiming";
import { deriveVisibleRunState } from "lib/runAnimation";
import type { RunResult } from "@pokington/engine";

/**
 * Returns how many runs have settled enough to award the pot and trigger winner UI.
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
      if (elapsed >= NORMAL_SETTLE_MS) {
        setSettled(1);
        return;
      }
      const delay = NORMAL_SETTLE_MS - elapsed;
      const id = setTimeout(() => setSettled(1), delay);
      return () => clearTimeout(id);
    }

    const { settleDelayS, runIntervalS } = getRunTimings(knownCardCount, { revealRunsConcurrently });
    const settleTimes: number[] = [];
    for (let r = 0; r < runCount; r++) {
      settleTimes.push(
        (ANNOUNCE_DELAY_S + r * runIntervalS + settleDelayS) * 1000,
      );
    }

    let alreadySettled = 0;
    for (const t of settleTimes) {
      if (elapsed >= t) alreadySettled++;
    }
    setSettled(alreadySettled);

    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    for (let r = alreadySettled; r < runCount; r++) {
      const delay = settleTimes[r] - elapsed;
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

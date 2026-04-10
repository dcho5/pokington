import { useState, useEffect } from "react";
import { ANNOUNCE_DELAY_S, getRunTimings } from "components/Table/desktop/WinnerChipsAnimation";
import { deriveRunAnimation } from "lib/runAnimation";
import { useRunAnimationTicker } from "hooks/useRunAnimationTicker";

const CHIP_DURATION_S = 2.4;
// Buffer to account for per-winner chip stagger (0.35s each in WinnerChipsAnimation)
// plus the 0.8s tier1 (side-pot) chip delay. Ensures settledRunCount doesn't fire
// before the last chip (main pot OR side pot) visually lands.
const WINNER_STAGGER_BUFFER_S = 0.9;
// Normal showdown (no all-in board): first chip delay + duration + stagger buffer
const NORMAL_LAND_MS = (0.4 + CHIP_DURATION_S + WINNER_STAGGER_BUFFER_S) * 1000;

/**
 * Returns how many runs have "settled" (winning chips have landed).
 *
 * For non-run-it showdowns: returns 0 or 1.
 * For run-it showdowns:     returns 0..runCount.
 */
export function useSettledRunsCount(
  phase: string,
  isRunItBoard: boolean,
  showdownStartedAt: number | null,
  knownCardCount: number,
  runCount: number,
): number {
  const [settled, setSettled] = useState(0);

  useEffect(() => {
    if (phase !== "showdown" || showdownStartedAt == null) {
      setSettled(0);
      return;
    }

    const elapsed = Date.now() - showdownStartedAt;

    if (!isRunItBoard) {
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
    const { chipStartS, runIntervalS } = getRunTimings(knownCardCount);
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
  }, [phase, showdownStartedAt, isRunItBoard, knownCardCount, runCount]);

  return settled;
}

/**
 * Returns the run index and revealed card count currently visible on the RunItBoard.
 */
export function useCurrentRun(
  phase: string,
  isRunItBoard: boolean,
  runDealStartedAt: number | null,
  knownCardCount: number,
  runCount: number,
): { currentRun: number; revealedCount: number } {
  const enabled = phase === "showdown" && isRunItBoard && runDealStartedAt != null;
  useRunAnimationTicker(runDealStartedAt, knownCardCount, runCount, enabled);

  if (!enabled || runDealStartedAt == null) {
    return { currentRun: 0, revealedCount: knownCardCount };
  }
  return deriveRunAnimation(runDealStartedAt, knownCardCount, runCount);
}

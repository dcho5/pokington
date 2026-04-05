import { useState, useEffect } from "react";
import { ANNOUNCE_DELAY_S, getRunTimings } from "components/Table/desktop/WinnerChipsAnimation";
import { deriveRunAnimation } from "lib/runAnimation";

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
 *
 * Timing is derived from `showdownStartedAt` (when the phase entered "showdown"),
 * which matches the WinnerChipsAnimation component's mount time. This makes the
 * formula uniform across both the direct all-in path and the voting path:
 *   Run r lands at: showdownStartedAt + (ANNOUNCE_DELAY_S + r * runIntervalS + chipStartS + CHIP_DURATION_S) * 1000
 */
export function useSettledRunsCount(
  phase: string,
  isRunItBoard: boolean,
  showdownStartedAt: number | null,
  knownCardCount: number,
  runCount: number,
): number {
  const [, tick] = useState(0);

  useEffect(() => {
    if (phase !== "showdown") return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [phase]);

  if (phase !== "showdown" || showdownStartedAt == null) return 0;

  const elapsed = Date.now() - showdownStartedAt;

  if (!isRunItBoard) {
    return elapsed >= NORMAL_LAND_MS ? 1 : 0;
  }

  const { chipStartS, runIntervalS } = getRunTimings(knownCardCount);
  let settled = 0;
  for (let r = 0; r < runCount; r++) {
    const landMs = (ANNOUNCE_DELAY_S + r * runIntervalS + chipStartS + CHIP_DURATION_S + WINNER_STAGGER_BUFFER_S) * 1000;
    if (elapsed >= landMs) settled = r + 1;
  }
  return settled;
}

/**
 * Returns the run index and revealed card count currently visible on the RunItBoard.
 * Ticks every 100ms so React re-renders stay in sync with the card-deal animation.
 */
export function useCurrentRun(
  phase: string,
  isRunItBoard: boolean,
  runDealStartedAt: number | null,
  knownCardCount: number,
  runCount: number,
): { currentRun: number; revealedCount: number } {
  const [, tick] = useState(0);

  useEffect(() => {
    if (phase !== "showdown" || !isRunItBoard || runDealStartedAt == null) return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [phase, isRunItBoard, runDealStartedAt]);

  if (phase !== "showdown" || !isRunItBoard || runDealStartedAt == null) {
    return { currentRun: 0, revealedCount: knownCardCount };
  }
  return deriveRunAnimation(runDealStartedAt, knownCardCount, runCount);
}

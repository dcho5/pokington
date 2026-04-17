import { computeRunTransitions, deriveRunAnimationAt, getRevealSteps } from "@pokington/engine";
import type { RunResult } from "@pokington/engine";

const CARD_COUNT = 5;

export { computeRunTransitions, getRevealSteps };

export function deriveRunAnimation(
  runDealStartedAt: number,
  knownCardCount: number,
  runCount: number,
): { currentRun: number; revealedCount: number } {
  return deriveRunAnimationAt(Date.now(), runDealStartedAt, knownCardCount, runCount);
}

export function deriveVisibleRunState(
  runResults: RunResult[],
  knownCardCount: number,
): { currentRun: number; revealedCount: number } {
  if (runResults.length === 0) {
    return { currentRun: 0, revealedCount: knownCardCount };
  }

  const visibleCounts = runResults.map((run) => Math.max(0, Math.min(CARD_COUNT, run.board.length)));
  const currentRun = visibleCounts.findIndex((count) => count < CARD_COUNT);
  const activeRun = currentRun === -1 ? runResults.length - 1 : currentRun;

  return {
    currentRun: Math.max(0, activeRun),
    revealedCount: visibleCounts[activeRun] ?? knownCardCount,
  };
}

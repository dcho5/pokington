import { computeRunTransitions, deriveRunAnimationAt, getRevealSteps } from "@pokington/engine";
import type { RunResult } from "@pokington/engine";
import { deriveObservedRunState } from "./showdownRevealState.mjs";

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
  totalRuns = Math.max(1, runResults.length),
): { currentRun: number; revealedCount: number } {
  if (runResults.length === 0) {
    return { currentRun: 0, revealedCount: knownCardCount };
  }
  return deriveObservedRunState(runResults, knownCardCount, totalRuns);
}

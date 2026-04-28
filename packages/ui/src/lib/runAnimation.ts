import type { RunResult } from "@pokington/engine";

const CARD_COUNT = 5;

function clampCardCount(count: number | null | undefined) {
  return Math.max(0, Math.min(CARD_COUNT, count ?? 0));
}

export function deriveVisibleRunState(
  runResults: RunResult[],
  knownCardCount: number,
  totalRuns = Math.max(1, runResults.length),
): { currentRun: number; revealedCount: number } {
  if (runResults.length === 0) {
    return { currentRun: 0, revealedCount: knownCardCount };
  }

  const clampedKnownCardCount = clampCardCount(knownCardCount);
  const counts = Array.from({ length: Math.max(1, totalRuns) }, (_, runIndex) => {
    const runBoardLength = runResults[runIndex]?.board?.length;
    return clampCardCount(runBoardLength ?? clampedKnownCardCount);
  });
  const activeRun = counts.reduce((current, count, runIndex) => (
    count > clampedKnownCardCount ? runIndex : current
  ), -1);
  const currentRun = activeRun === -1 ? 0 : activeRun;

  return {
    currentRun,
    revealedCount: counts[currentRun] ?? clampedKnownCardCount,
  };
}

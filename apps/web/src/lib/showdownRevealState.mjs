import { computeRunTransitions, deriveRunAnimationAt } from "@pokington/engine";

const CARD_COUNT = 5;
const SEQUENTIAL_FINAL_REVEAL_HOLD_MS = 2400;

function clampCardCount(count) {
  return Math.max(0, Math.min(CARD_COUNT, count ?? 0));
}

/**
 * @param {{
 *   knownCardCount?: number;
 *   runCount?: number;
 *   runDealStartedAt?: number | null;
 *   now?: number;
 *   revealRunsConcurrently?: boolean;
 * }} [options]
 */
export function getTimedVisibleRunCounts({
  knownCardCount = 0,
  runCount = 1,
  runDealStartedAt = null,
  now = Date.now(),
  revealRunsConcurrently = false,
} = {}) {
  const totalRuns = Math.max(1, runCount);
  const clampedKnownCardCount = clampCardCount(knownCardCount);
  const counts = Array.from({ length: totalRuns }, () => clampedKnownCardCount);

  if (runDealStartedAt == null) {
    return counts;
  }

  const { currentRun, revealedCount } = deriveRunAnimationAt(
    now,
    runDealStartedAt,
    clampedKnownCardCount,
    totalRuns,
    { revealRunsConcurrently },
  );

  if (revealRunsConcurrently) {
    return counts.map(() => revealedCount);
  }

  for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
    if (runIndex < currentRun) counts[runIndex] = CARD_COUNT;
    else if (runIndex === currentRun) counts[runIndex] = revealedCount;
  }

  return counts;
}

/**
 * @param {{
 *   knownCardCount?: number;
 *   runCount?: number;
 *   runDealStartedAt?: number | null;
 *   now?: number;
 *   revealRunsConcurrently?: boolean;
 * }} [options]
 */
export function getNextTimedRevealAt({
  knownCardCount = 0,
  runCount = 1,
  runDealStartedAt = null,
  now = Date.now(),
  revealRunsConcurrently = false,
} = {}) {
  if (runDealStartedAt == null) return null;

  const transitions = computeRunTransitions(
    clampCardCount(knownCardCount),
    Math.max(1, runCount),
    { revealRunsConcurrently },
  );

  for (const transitionMs of transitions) {
    const absoluteAt = runDealStartedAt + transitionMs;
    if (absoluteAt > now) return absoluteAt;
  }

  return null;
}

/**
 * @param {{
 *   knownCardCount?: number;
 *   runCount?: number;
 *   runDealStartedAt?: number | null;
 *   now?: number;
 *   revealRunsConcurrently?: boolean;
 * }} [options]
 */
export function isTimedShowdownRevealComplete(options = {}) {
  const {
    knownCardCount = 0,
    runCount = 1,
    runDealStartedAt = null,
    now = Date.now(),
    revealRunsConcurrently = false,
  } = options;

  if (runDealStartedAt == null) return false;

  const transitions = computeRunTransitions(
    clampCardCount(knownCardCount),
    Math.max(1, runCount),
    { revealRunsConcurrently },
  );
  const finalTransition = transitions.at(-1);
  if (finalTransition == null) return true;

  const completionAt = runDealStartedAt + finalTransition + (
    !revealRunsConcurrently && runCount > 1 ? SEQUENTIAL_FINAL_REVEAL_HOLD_MS : 0
  );
  return now >= completionAt;
}

/**
 * @param {import("@pokington/engine").RunResult[]} [runResults]
 * @param {number} [knownCardCount]
 * @param {number} [totalRuns]
 */
export function getObservedVisibleRunCounts(
  runResults = [],
  knownCardCount = 0,
  totalRuns = Math.max(1, runResults.length),
) {
  const clampedKnownCardCount = clampCardCount(knownCardCount);
  return Array.from({ length: Math.max(1, totalRuns) }, (_, runIndex) => {
    const runBoardLength = runResults[runIndex]?.board?.length;
    return clampCardCount(runBoardLength ?? clampedKnownCardCount);
  });
}

/**
 * @param {import("@pokington/engine").RunResult[]} [runResults]
 * @param {number} [knownCardCount]
 * @param {number} [totalRuns]
 */
export function deriveObservedRunState(
  runResults = [],
  knownCardCount = 0,
  totalRuns = Math.max(1, runResults.length),
) {
  const counts = getObservedVisibleRunCounts(runResults, knownCardCount, totalRuns);
  const activeRun = counts.reduce((current, count, runIndex) => (
    count > knownCardCount ? runIndex : current
  ), -1);
  const currentRun = activeRun === -1 ? 0 : activeRun;

  return {
    currentRun,
    revealedCount: counts[currentRun] ?? clampCardCount(knownCardCount),
  };
}

/**
 * @param {import("@pokington/engine").RunResult[]} [runResults]
 * @param {number} [knownCardCount]
 * @param {number} [totalRuns]
 */
export function isObservedShowdownRevealComplete(
  runResults = [],
  knownCardCount = 0,
  totalRuns = Math.max(1, runResults.length),
) {
  return getObservedVisibleRunCounts(runResults, knownCardCount, totalRuns)
    .every((count) => count >= CARD_COUNT);
}

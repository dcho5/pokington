export const ANNOUNCE_DELAY_MS = 3500;
export const ANNOUNCE_DELAY_S = ANNOUNCE_DELAY_MS / 1000;
export const CHIP_DURATION_S = 2.4;
export const WINNER_STAGGER_BUFFER_S = 0.9;
export const NORMAL_LAND_MS = (0.4 + CHIP_DURATION_S + WINNER_STAGGER_BUFFER_S) * 1000;

const STREET_REVEAL_MS: { revealTo: number; absoluteMs: number }[] = [
  { revealTo: 3, absoluteMs: 400 },
  { revealTo: 4, absoluteMs: 2900 },
  { revealTo: 5, absoluteMs: 5400 },
];

interface RunTimingOptions {
  revealRunsConcurrently?: boolean;
}

export function hasAnimatedRunout(knownCardCount: number, runCount: number): boolean {
  return knownCardCount < 5 || runCount > 1;
}

export function shouldRevealRunsConcurrently(isBombPotHand: boolean, runCount: number): boolean {
  return isBombPotHand && runCount > 1;
}

export function getRunTimings(knownCardCount: number): {
  chipStartS: number;
  runIntervalS: number;
};
export function getRunTimings(knownCardCount: number, options: RunTimingOptions): {
  chipStartS: number;
  runIntervalS: number;
};
export function getRunTimings(knownCardCount: number, options: RunTimingOptions = {}): {
  chipStartS: number;
  runIntervalS: number;
} {
  const lastCardMs = knownCardCount >= 4 ? 400 : knownCardCount >= 3 ? 2900 : 5400;
  const chipStartS = lastCardMs / 1000 + 0.5;
  const runIntervalS = options.revealRunsConcurrently ? 0 : chipStartS + CHIP_DURATION_S + 0.7;
  return { chipStartS, runIntervalS };
}

export function getRevealSteps(knownCardCount: number): { revealTo: number; delayMs: number }[] {
  const remaining = STREET_REVEAL_MS.filter((step) => step.revealTo > knownCardCount);
  if (remaining.length === 0) return [];
  const rebaseMs = remaining[0].absoluteMs - STREET_REVEAL_MS[0].absoluteMs;
  return remaining.map((step) => ({ revealTo: step.revealTo, delayMs: step.absoluteMs - rebaseMs }));
}

export function computeRunTransitions(knownCardCount: number, totalRuns: number): number[];
export function computeRunTransitions(
  knownCardCount: number,
  totalRuns: number,
  options: RunTimingOptions,
): number[];
export function computeRunTransitions(
  knownCardCount: number,
  totalRuns: number,
  options: RunTimingOptions = {},
): number[] {
  const { runIntervalS } = getRunTimings(knownCardCount, options);
  const runIntervalMs = runIntervalS * 1000;
  const steps = getRevealSteps(knownCardCount);

  if (options.revealRunsConcurrently) {
    return steps.map((step) => step.delayMs);
  }

  const transitions: number[] = [];

  for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
    const runStart = runIndex * runIntervalMs;
    if (runIndex > 0) transitions.push(runStart);
    for (const step of steps) transitions.push(runStart + step.delayMs);
  }

  return transitions;
}

export function deriveRunAnimationAt(
  now: number,
  runDealStartedAt: number,
  knownCardCount: number,
  runCount: number,
): { currentRun: number; revealedCount: number };
export function deriveRunAnimationAt(
  now: number,
  runDealStartedAt: number,
  knownCardCount: number,
  runCount: number,
  options: RunTimingOptions,
): { currentRun: number; revealedCount: number };
export function deriveRunAnimationAt(
  now: number,
  runDealStartedAt: number,
  knownCardCount: number,
  runCount: number,
  options: RunTimingOptions = {},
): { currentRun: number; revealedCount: number } {
  const elapsed = now - runDealStartedAt;
  if (elapsed < 0) return { currentRun: 0, revealedCount: knownCardCount };

  const { runIntervalS } = getRunTimings(knownCardCount, options);
  const steps = getRevealSteps(knownCardCount);

  if (options.revealRunsConcurrently) {
    let revealedCount = knownCardCount;
    for (const step of steps) {
      if (elapsed >= step.delayMs) revealedCount = step.revealTo;
    }
    return { currentRun: 0, revealedCount };
  }

  const runIntervalMs = runIntervalS * 1000;

  const rawRun = Math.floor(elapsed / runIntervalMs);
  const currentRun = Math.min(rawRun, runCount - 1);

  const withinRun = elapsed - currentRun * runIntervalMs;
  let revealedCount = knownCardCount;
  for (const step of steps) {
    if (withinRun >= step.delayMs) revealedCount = step.revealTo;
  }

  return { currentRun, revealedCount };
}

export function getAllInShowdownRevealDelayMs(knownCardCount: number, runCount: number): number;
export function getAllInShowdownRevealDelayMs(
  knownCardCount: number,
  runCount: number,
  options: RunTimingOptions,
): number;
export function getAllInShowdownRevealDelayMs(
  knownCardCount: number,
  runCount: number,
  options: RunTimingOptions = {},
): number {
  const { chipStartS, runIntervalS } = getRunTimings(knownCardCount, options);
  return (
    ANNOUNCE_DELAY_S +
    Math.max(0, runCount - 1) * runIntervalS +
    chipStartS +
    CHIP_DURATION_S +
    WINNER_STAGGER_BUFFER_S
  ) * 1000;
}

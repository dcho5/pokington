import { getRunTimings } from "lib/showdownTiming";

// Unified community-card reveal timeline.
// absoluteMs values are from the start of the run's deal clock.
const STREET_REVEAL_MS: { revealTo: number; absoluteMs: number }[] = [
  { revealTo: 3, absoluteMs: 400 },   // flop  (3 cards at 0.4 s)
  { revealTo: 4, absoluteMs: 2900 },  // turn  (1 card  at 2.9 s)
  { revealTo: 5, absoluteMs: 5400 },  // river (1 card  at 5.4 s)
];

/**
 * Returns the reveal steps for cards not yet known before the all-in.
 * The first remaining step is always re-based to fire at the flop delay (400ms)
 * so the interval between streets (2500ms) stays constant regardless of entry point.
 */
export function getRevealSteps(knownCardCount: number): { revealTo: number; delayMs: number }[] {
  const remaining = STREET_REVEAL_MS.filter(s => s.revealTo > knownCardCount);
  if (remaining.length === 0) return [];
  const rebaseMs = remaining[0].absoluteMs - STREET_REVEAL_MS[0].absoluteMs;
  return remaining.map(s => ({ revealTo: s.revealTo, delayMs: s.absoluteMs - rebaseMs }));
}

/**
 * All animation-frame transition times (ms from run deal start) for a multi-run
 * reveal: run boundaries + card-reveal steps within each run. Used by hooks that
 * schedule one setTimeout per transition so components re-render only at visible
 * frame boundaries.
 */
export function computeRunTransitions(knownCardCount: number, totalRuns: number): number[] {
  const { runIntervalS } = getRunTimings(knownCardCount);
  const runIntervalMs = runIntervalS * 1000;
  const steps = getRevealSteps(knownCardCount);
  const transitions: number[] = [];
  for (let r = 0; r < totalRuns; r++) {
    const runStart = r * runIntervalMs;
    if (r > 0) transitions.push(runStart);
    for (const step of steps) transitions.push(runStart + step.delayMs);
  }
  return transitions;
}

/** Derive current animation frame from an absolute timestamp — survives layout switches. */
export function deriveRunAnimation(
  runDealStartedAt: number,
  knownCardCount: number,
  runCount: number,
): { currentRun: number; revealedCount: number } {
  const elapsed = Date.now() - runDealStartedAt;
  if (elapsed < 0) return { currentRun: 0, revealedCount: knownCardCount };

  const { runIntervalS } = getRunTimings(knownCardCount);
  const runIntervalMs = runIntervalS * 1000;
  const steps = getRevealSteps(knownCardCount);

  const rawRun = Math.floor(elapsed / runIntervalMs);
  const currentRun = Math.min(rawRun, runCount - 1);

  const withinRun = elapsed - currentRun * runIntervalMs;
  let revealedCount = knownCardCount;
  for (const step of steps) {
    if (withinRun >= step.delayMs) revealedCount = step.revealTo;
  }

  return { currentRun, revealedCount };
}

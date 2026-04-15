export const ANNOUNCE_DELAY_S = 3.5;
export const CHIP_DURATION_S = 2.4;
export const WINNER_STAGGER_BUFFER_S = 0.9;
export const NORMAL_LAND_MS = (0.4 + CHIP_DURATION_S + WINNER_STAGGER_BUFFER_S) * 1000;

export function getRunTimings(knownCardCount: number): {
  chipStartS: number;
  runIntervalS: number;
} {
  const lastCardMs = knownCardCount >= 4 ? 400 : knownCardCount >= 3 ? 2900 : 5400;
  const chipStartS = lastCardMs / 1000 + 0.5;
  const runIntervalS = chipStartS + CHIP_DURATION_S + 0.7;
  return { chipStartS, runIntervalS };
}

export function getAllInShowdownRevealDelayMs(knownCardCount: number, runCount: number): number {
  const { chipStartS, runIntervalS } = getRunTimings(knownCardCount);
  return (
    ANNOUNCE_DELAY_S +
    Math.max(0, runCount - 1) * runIntervalS +
    chipStartS +
    CHIP_DURATION_S +
    WINNER_STAGGER_BUFFER_S
  ) * 1000;
}

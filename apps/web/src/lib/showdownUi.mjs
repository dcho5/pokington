import { ANNOUNCE_DELAY_S, getRunTimings } from "@pokington/engine";

/**
 * @param {{
 *   settledRunCount?: number;
 *   runCount?: number;
 *   publicShowdownRevealComplete?: boolean;
 * }} [options]
 */
export function hasCompletedShowdownPresentation({
  settledRunCount = 0,
  runCount = 1,
  publicShowdownRevealComplete = false,
} = {}) {
  return settledRunCount >= runCount && publicShowdownRevealComplete;
}

/**
 * @param {{
 *   phase?: string;
 *   animatedShowdownReveal?: boolean;
 *   revealRunsConcurrently?: boolean;
 *   knownCardCount?: number;
 *   runCount?: number;
 *   publicShowdownRevealComplete?: boolean;
 *   showdownStartedAt?: number | null;
 *   now?: number;
 * }} [options]
 */
export function getShowdownCountdownDelayMs({
  phase,
  animatedShowdownReveal = false,
  revealRunsConcurrently = false,
  knownCardCount = 0,
  runCount = 1,
  publicShowdownRevealComplete = false,
  showdownStartedAt = null,
  now = Date.now(),
} = {}) {
  if (phase !== "showdown" || !publicShowdownRevealComplete) return null;

  const { chipStartS, runIntervalS } = getRunTimings(knownCardCount, { revealRunsConcurrently });
  const chipDurationS = 2.4;
  const animDoneMs = animatedShowdownReveal
    ? (ANNOUNCE_DELAY_S + (runCount - 1) * runIntervalS + chipStartS + chipDurationS + 1.5) * 1000
    : 0;
  const elapsed = showdownStartedAt == null ? 0 : Math.max(0, now - showdownStartedAt);
  return Math.max(0, animDoneMs - elapsed);
}

export function getShowdownCountdownStartAt({
  phase,
  animatedShowdownReveal = false,
  revealRunsConcurrently = false,
  knownCardCount = 0,
  runCount = 1,
  showdownStartedAt = null,
} = {}) {
  if (phase !== "showdown" || showdownStartedAt == null) return null;

  const delayMs = getShowdownCountdownDelayMs({
    phase,
    animatedShowdownReveal,
    revealRunsConcurrently,
    knownCardCount,
    runCount,
    publicShowdownRevealComplete: true,
    showdownStartedAt,
    now: showdownStartedAt,
  });
  if (delayMs == null) return null;
  return showdownStartedAt + delayMs;
}

export function getNextHandAutoStartAt({
  phase,
  animatedShowdownReveal = false,
  revealRunsConcurrently = false,
  knownCardCount = 0,
  runCount = 1,
  showdownStartedAt = null,
  countdownSeconds = 10,
} = {}) {
  const countdownStartAt = getShowdownCountdownStartAt({
    phase,
    animatedShowdownReveal,
    revealRunsConcurrently,
    knownCardCount,
    runCount,
    showdownStartedAt,
  });
  if (countdownStartAt == null) return null;
  return countdownStartAt + Math.max(0, countdownSeconds) * 1000;
}

/**
 * @param {{
 *   phase?: string;
 *   nextHandStartsAt?: number | null;
 *   now?: number;
 * }} [options]
 */
export function getShowdownCountdownSeconds({
  phase,
  nextHandStartsAt = null,
  now = Date.now(),
} = {}) {
  if (phase !== "showdown" || nextHandStartsAt == null) return null;

  const remainingMs = nextHandStartsAt - now;
  if (remainingMs <= 0) return null;
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

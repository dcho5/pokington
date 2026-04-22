export function hasCompletedShowdownPresentation(options?: {
  settledRunCount?: number;
  runCount?: number;
  publicShowdownRevealComplete?: boolean;
}): boolean;

export function getShowdownCountdownDelayMs(options?: {
  phase?: string;
  animatedShowdownReveal?: boolean;
  revealRunsConcurrently?: boolean;
  knownCardCount?: number;
  runCount?: number;
  publicShowdownRevealComplete?: boolean;
  showdownStartedAt?: number | null;
  now?: number;
}): number | null;

export function getShowdownCountdownStartAt(options?: {
  phase?: string;
  animatedShowdownReveal?: boolean;
  revealRunsConcurrently?: boolean;
  knownCardCount?: number;
  runCount?: number;
  showdownStartedAt?: number | null;
}): number | null;

export function getNextHandAutoStartAt(options?: {
  phase?: string;
  animatedShowdownReveal?: boolean;
  revealRunsConcurrently?: boolean;
  knownCardCount?: number;
  runCount?: number;
  showdownStartedAt?: number | null;
  countdownSeconds?: number;
}): number | null;

export function getShowdownCountdownSeconds(options?: {
  phase?: string;
  nextHandStartsAt?: number | null;
  now?: number;
}): number | null;

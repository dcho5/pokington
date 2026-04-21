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

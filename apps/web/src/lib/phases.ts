import type { GamePhase } from "@pokington/engine";

const ACTIVE_PHASES: ReadonlySet<string> = new Set([
  "pre-flop",
  "flop",
  "turn",
  "river",
  "voting",
]);

export function isActivePhase(phase: GamePhase | string | null | undefined): boolean {
  return phase != null && ACTIVE_PHASES.has(phase);
}

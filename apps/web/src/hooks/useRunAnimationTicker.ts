import { useEffect, useState } from "react";
import { computeRunTransitions } from "lib/runAnimation";

/**
 * Forces a re-render at every multi-run animation transition (run boundaries
 * and card-reveal steps) between now and the end of the animation. Returns
 * nothing — the caller re-reads its own derived state on each tick.
 */
export function useRunAnimationTicker(
  runDealStartedAt: number | null,
  knownCardCount: number,
  totalRuns: number,
  enabled: boolean,
): void {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!enabled || runDealStartedAt == null) return;
    const transitions = computeRunTransitions(knownCardCount, totalRuns);
    const elapsed = Date.now() - runDealStartedAt;
    const ids: ReturnType<typeof setTimeout>[] = [];
    for (const t of transitions) {
      const delay = t - elapsed;
      if (delay > 0) ids.push(setTimeout(() => tick((n) => n + 1), delay));
    }
    return () => ids.forEach(clearTimeout);
  }, [enabled, runDealStartedAt, knownCardCount, totalRuns]);
}

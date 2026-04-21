export function deriveKnownCardCountAtShowdown(prev, next) {
  const prevKnownCount = Math.max(prev?.communityCards?.length ?? 0, prev?.communityCards2?.length ?? 0);
  if (prevKnownCount > 0) return prevKnownCount;

  // Bomb pots can jump from waiting directly to showdown on hand start if all
  // entrants are all-in after posting the ante. In that path, both flops were
  // effectively visible before the showdown animation begins, so preserve the
  // shared three-card starting point for the public reveal timeline.
  if ((prev?.phase ?? null) === "waiting" && next?.isBombPot) {
    return Math.min(3, Math.max(next?.communityCards?.length ?? 0, next?.communityCards2?.length ?? 0));
  }

  return 0;
}

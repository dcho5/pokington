import enginePkg from "@pokington/engine";

const { hasAnimatedRunout, shouldAnnounceRunIt } = enginePkg;

export function deriveServerRunTiming(next = {}) {
  const runCount = Math.max(1, next.runCount ?? next.runResults?.length ?? 0);
  const knownCardCountAtRunIt = next.knownCardCountAtRunIt ?? 0;
  const isVotingReveal = next.phase === "voting";
  const hasAnimatedShowdownReveal =
    next.phase === "showdown" &&
    (next.showdownStartedAt != null || next.runDealStartedAt != null) &&
    hasAnimatedRunout(knownCardCountAtRunIt, runCount);

  return {
    runAnnouncement: shouldAnnounceRunIt({
      isBombPotHand: next.isBombPot,
      knownCardCount: knownCardCountAtRunIt,
      runCount,
      showdownStartedAt: next.showdownStartedAt,
      runDealStartedAt: next.runDealStartedAt,
    })
      ? runCount
      : null,
    isRunItBoard: isVotingReveal || next.isBombPot || hasAnimatedShowdownReveal,
    knownCardCountAtRunIt: isVotingReveal ? next.communityCards.length : knownCardCountAtRunIt,
    runDealStartedAt: next.runDealStartedAt ?? null,
    showdownStartedAt: next.showdownStartedAt ?? null,
  };
}

import {
  deriveRunAnimationAt,
  hasAnimatedRunout,
  shouldRevealRunsConcurrently,
} from "@pokington/engine";

const CARD_COUNT = 5;

function shouldRedactAnimatedShowdown(state) {
  if (!state || state.phase !== "showdown") return false;
  if (state.showdownStartedAt == null && state.runDealStartedAt == null) return false;
  const runCount = Math.max(1, state.runResults?.length ?? 0);
  return runCount > 0 && hasAnimatedRunout(state.knownCardCountAtRunIt ?? 0, runCount);
}

function getRunVisibleCounts(state, now) {
  const runCount = Math.max(1, state.runResults?.length ?? 0);
  const knownCardCount = Math.max(0, Math.min(CARD_COUNT, state.knownCardCountAtRunIt ?? 0));
  const counts = Array.from({ length: runCount }, () => knownCardCount);
  const revealRunsConcurrently = shouldRevealRunsConcurrently(state.isBombPot ?? false, runCount);

  if (state.runDealStartedAt == null) return counts;

  const { currentRun, revealedCount } = deriveRunAnimationAt(
    now,
    state.runDealStartedAt,
    knownCardCount,
    runCount,
    { revealRunsConcurrently },
  );

  if (revealRunsConcurrently) {
    return counts.map(() => revealedCount);
  }

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    if (runIndex < currentRun) counts[runIndex] = CARD_COUNT;
    else if (runIndex === currentRun) counts[runIndex] = revealedCount;
  }

  return counts;
}

export function buildPublicGameState(state, now = Date.now()) {
  const { deck, players, ...rest } = state;
  const publicPlayers = {};
  for (const [id, player] of Object.entries(players)) {
    publicPlayers[id] = { ...player, holeCards: null, hasCards: player.holeCards !== null };
  }

  const publicState = {
    ...rest,
    deckSize: deck.length,
    players: publicPlayers,
  };

  if (!shouldRedactAnimatedShowdown(state)) return publicState;

  const visibleCounts = getRunVisibleCounts(state, now);
  const visibleRunResults = (state.runResults ?? []).map((run, runIndex) => ({
    ...run,
    board: run.board.slice(0, visibleCounts[runIndex] ?? 0),
  }));
  const visibleCommunityCards = visibleRunResults[0]?.board ?? state.communityCards ?? [];
  const visibleCommunityCards2 = visibleRunResults[1]?.board ?? state.communityCards2 ?? [];

  return {
    ...publicState,
    communityCards: visibleCommunityCards,
    communityCards2: visibleCommunityCards2,
    runResults: visibleRunResults,
  };
}

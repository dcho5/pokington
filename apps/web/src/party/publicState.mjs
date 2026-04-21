import {
  hasAnimatedRunout,
  shouldRevealRunsConcurrently,
} from "@pokington/engine";
import { getTimedVisibleRunCounts } from "../lib/showdownRevealState.mjs";

function shouldRedactAnimatedShowdown(state) {
  if (!state || state.phase !== "showdown") return false;
  if (state.showdownStartedAt == null && state.runDealStartedAt == null) return false;
  const runCount = Math.max(1, state.runResults?.length ?? 0);
  return runCount > 0 && hasAnimatedRunout(state.knownCardCountAtRunIt ?? 0, runCount);
}

function getRunVisibleCounts(state, now) {
  const runCount = Math.max(1, state.runResults?.length ?? 0);
  const revealRunsConcurrently = shouldRevealRunsConcurrently(state.isBombPot ?? false, runCount);
  return getTimedVisibleRunCounts({
    knownCardCount: state.knownCardCountAtRunIt ?? 0,
    runCount,
    runDealStartedAt: state.runDealStartedAt,
    now,
    revealRunsConcurrently,
  });
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
  const visibleCommunityCards2 = state.isBombPot
    ? (visibleRunResults[1]?.board ?? state.communityCards2 ?? [])
    : (state.communityCards2 ?? []);

  return {
    ...publicState,
    communityCards: visibleCommunityCards,
    communityCards2: visibleCommunityCards2,
    runResults: visibleRunResults,
  };
}

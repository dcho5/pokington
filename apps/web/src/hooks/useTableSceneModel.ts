"use client";

// No side effects. If you are adding a socket call or timer here, it belongs in useTableActions or TablePageClient instead.

import { useMemo } from "react";
import { isAnimatedRunItShowdown, isAnimatedShowdownReveal } from "lib/tableVisualState";
import { deriveTableScene, type TableSceneModel } from "components/Table/tableScene";
import { useGameStore } from "store/useGameStore";
import { useCurrentRun, useSettledRunsCount } from "hooks/useSettledRunsCount";
import { useTableRuntimeState } from "hooks/useTableRuntimeState";
import { shouldRevealRunsConcurrently } from "lib/showdownTiming";
import { isObservedShowdownRevealComplete } from "lib/showdownRevealState.mjs";

export function useTableSceneModel(code: string): TableSceneModel {
  const gameState = useGameStore((state) => state.gameState);

  const sessionContext = {
    code,
    myPlayerId: useGameStore((state) => state.myPlayerId),
    myUserId: useGameStore((state) => state.myUserId),
    connectionStatus: useGameStore((state) => state.connectionStatus),
    tableNotFound: useGameStore((state) => state.tableNotFound),
    isFirstStateReceived: useGameStore((state) => state.isFirstStateReceived),
    isCreator: useGameStore((state) => state.isCreator),
  };

  const timingFlags = {
    votingStartedAt: useGameStore((state) => state.votingStartedAt),
    streetPauseChips: useGameStore((state) => state.streetPauseChips),
    streetSweeping: useGameStore((state) => state.streetSweeping),
    runAnnouncement: useGameStore((state) => state.runAnnouncement),
    isRunItBoard: useGameStore((state) => state.isRunItBoard),
    knownCardCountAtRunIt: useGameStore((state) => state.knownCardCountAtRunIt),
    runDealStartedAt: useGameStore((state) => state.runDealStartedAt),
    showdownStartedAt: useGameStore((state) => state.showdownStartedAt),
    sevenTwoAnnouncement: useGameStore((state) => state.sevenTwoAnnouncement),
    bombPotAnnouncement: useGameStore((state) => state.bombPotAnnouncement),
    actionError: useGameStore((state) => state.actionError),
  };

  const animatedRunItShowdown = isAnimatedRunItShowdown({
    phase: gameState.phase,
    isRunItBoard: timingFlags.isRunItBoard,
    isBombPotHand: gameState.isBombPot,
    runResults: gameState.runResults,
  });
  const animatedShowdownReveal = isAnimatedShowdownReveal({
    phase: gameState.phase,
    knownCardCount: timingFlags.knownCardCountAtRunIt,
    runResults: gameState.runResults,
    runAnnouncement: timingFlags.runAnnouncement,
    runDealStartedAt: timingFlags.runDealStartedAt,
    showdownStartedAt: timingFlags.showdownStartedAt,
  });
  const revealRunsConcurrently = shouldRevealRunsConcurrently(
    gameState.isBombPot,
    gameState.runResults.length,
  );

  const settledRunCount = useSettledRunsCount(
    gameState.phase,
    animatedShowdownReveal,
    timingFlags.showdownStartedAt,
    timingFlags.knownCardCountAtRunIt,
    gameState.runCount as 1 | 2 | 3,
    revealRunsConcurrently,
  );
  const { currentRun, revealedCount } = useCurrentRun(
    gameState.phase,
    animatedRunItShowdown,
    timingFlags.knownCardCountAtRunIt,
    gameState.runResults,
  );
  const publicShowdownRevealComplete = !animatedShowdownReveal || isObservedShowdownRevealComplete(
    gameState.runResults,
    timingFlags.knownCardCountAtRunIt,
    gameState.runCount as 1 | 2 | 3,
  );

  const clientUiState = {
    viewingSeat: useGameStore((state) => state.viewingSeat),
    revealedHoleCards: useGameStore((state) => state.revealedHoleCards),
    myHoleCards: useGameStore((state) => state.myHoleCards),
    myRevealedCardIndices: useGameStore((state) => state.myRevealedCardIndices),
    peekedCounts: useGameStore((state) => state.peekedCounts),
    showdownPlayerSnapshot: useGameStore((state) => state.showdownPlayerSnapshot),
    leaveQueued: useGameStore((state) => state.leaveQueued),
    awayPlayerIds: useGameStore((state) => state.awayPlayerIds),
    currentRun,
    revealedCount,
    settledRunCount,
    publicShowdownRevealComplete,
  };

  const baseScene = useMemo(
    () => deriveTableScene({
      gameState,
      timingFlags,
      sessionContext,
      clientUiState,
    }),
    [gameState, timingFlags, sessionContext, clientUiState],
  );

  const runtimeState = useTableRuntimeState({
    phase: gameState.phase,
    handNumber: gameState.handNumber,
    runCount: gameState.runCount as 1 | 2 | 3,
    animatedShowdownReveal,
    revealRunsConcurrently,
    knownCardCount: timingFlags.knownCardCountAtRunIt,
    settledRunCount,
    publicShowdownRevealComplete,
    showdownStartedAt: timingFlags.showdownStartedAt,
    viewingPlayer: baseScene.viewingPlayer,
    viewerStack: baseScene.layout.viewerStack,
    viewingSeat: clientUiState.viewingSeat,
  });

  return useMemo(
    () => ({
      ...baseScene,
      showRebuySheet: runtimeState.showRebuySheet,
      rebuyInfo: runtimeState.rebuyInfo,
      dismissRebuy: runtimeState.dismissRebuy,
      layout: {
        ...baseScene.layout,
        showdownCountdown: runtimeState.showdownCountdown,
        showNextHand: runtimeState.showdownCountdown !== null,
      },
    }),
    [baseScene, runtimeState],
  ) as TableSceneModel;
}

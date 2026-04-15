"use client";

// Callbacks only. If you are deriving display state here, it belongs in deriveTableScene instead.

import { useCallback } from "react";
import { useGameStore } from "store/useGameStore";
import type { TableActions } from "components/Table/tableScene";

export function useTableActions(_code: string): TableActions {
  const onSitDown = useCallback<TableActions["onSitDown"]>((seatIndex, name, buyInCents) => {
    const store = useGameStore.getState();
    const currentPhase = store.gameState.phase;
    const isWaiting = !currentPhase || currentPhase === "waiting";
    const isSeated = !!(store.myPlayerId && store.gameState.players[store.myPlayerId]);

    if (isSeated && !isWaiting) {
      return;
    }

    if (name != null && buyInCents != null) {
      store.sitDown(seatIndex, name, buyInCents);
      return;
    }

    if (isSeated && isWaiting) {
      store.changeSeat(seatIndex);
      return;
    }

    // New-seat dialogs are owned by the caller (desktop page or mobile sheet flow).
  }, []);

  const onRaise = useCallback<TableActions["onRaise"]>((totalAmount) => {
    const { gameState } = useGameStore.getState();
    const actorId = gameState.needsToAct[0];
    const actor = actorId ? gameState.players[actorId] : null;
    if (!actor || actor.stack === 0) return;

    const threshold = gameState.roundBet + gameState.lastLegalRaiseIncrement;
    if (gameState.isBlindIncomplete && totalAmount <= gameState.blinds.big) {
      useGameStore.getState().raise(totalAmount);
      return;
    }

    if (totalAmount >= threshold) {
      useGameStore.getState().raise(totalAmount);
      return;
    }

    useGameStore.getState().allIn();
  }, []);

  const onDebugDealSevenTwo = useCallback(() => {
    const store = useGameStore.getState();
    const viewingPlayer = Object.values(store.gameState.players).find(
      (player) => player.seatIndex === store.viewingSeat,
    );
    if (!store.isCreator || !viewingPlayer?.id || store.gameState.phase !== "pre-flop") return;
    store.debugSetHoleCards(viewingPlayer.id, [
      { rank: "7", suit: "clubs" },
      { rank: "2", suit: "hearts" },
    ]);
  }, []);

  return {
    onSitDown,
    onStandUp: () => useGameStore.getState().standUp(),
    onQueueLeave: () => useGameStore.getState().queueLeave(),
    onFold: () => useGameStore.getState().fold(),
    onCheck: () => useGameStore.getState().check(),
    onCall: () => useGameStore.getState().call(),
    onRaise,
    onAllIn: () => useGameStore.getState().allIn(),
    onStartHand: () => useGameStore.getState().startHand(),
    onVoteRun: (count) => useGameStore.getState().voteRun(count),
    onRevealCard: (cardIndex) => useGameStore.getState().revealCard(cardIndex),
    onPeekCard: (cardIndex) => useGameStore.getState().peekCard(cardIndex),
    onProposeBombPot: (anteBB) => useGameStore.getState().proposeBombPot(anteBB),
    onVoteBombPot: (approve) => useGameStore.getState().voteBombPot(approve),
    onDebugDealSevenTwo,
  };
}

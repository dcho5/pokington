"use client";

// Callbacks only. If you are deriving display state here, it belongs in deriveTableScene instead.

import { useCallback } from "react";
import { useGameStore } from "store/useGameStore";
import type { TableActions } from "components/Table/tableScene";
import { classifySitDownRequest } from "lib/sitDownEligibility.mjs";

export function useTableActions(_code: string): TableActions {
  const onSitDown = useCallback<TableActions["onSitDown"]>((seatIndex, name, buyInCents) => {
    const store = useGameStore.getState();
    const mode = classifySitDownRequest({
      phase: store.gameState.phase,
      myPlayerId: store.myPlayerId,
      players: store.gameState.players,
      seatIndex,
    });

    if (name != null && buyInCents != null) {
      if (mode === "blocked" || mode === "change-seat") return;
      store.sitDown(seatIndex, name, buyInCents);
      return;
    }

    if (mode === "change-seat") {
      store.changeSeat(seatIndex);
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

  return {
    onSitDown,
    onStandUp: () => useGameStore.getState().standUp(),
    onQueueLeave: () => useGameStore.getState().queueLeave(),
    onCancelQueuedLeave: () => useGameStore.getState().cancelQueuedLeave(),
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
  };
}

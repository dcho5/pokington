"use client";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import TableLayout from "components/Table/TableLayout";
import SitDownForm from "components/Table/SitDownForm";
import RebuySheet from "components/Table/mobile/RebuySheet";
import { useGameStore } from "store/useGameStore";
import { useIsPortrait } from "hooks/useIsPortrait";
import { evaluateBest } from "@pokington/engine";
import { getRunTimings, ANNOUNCE_DELAY_S } from "components/Table/desktop/WinnerChipsAnimation";
import { useSettledRunsCount, useCurrentRun } from "hooks/useSettledRunsCount";
import DebugPanel from "./DebugPanel";

export default function TablePageClient({ code }: { code: string }) {
  const store = useGameStore();
  const isPortrait = useIsPortrait();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [showdownCountdown, setShowdownCountdown] = useState<number | null>(null);
  const [showRebuySheet, setShowRebuySheet] = useState(false);

  // Connect to the PartyKit room for this table code
  useEffect(() => {
    store.connect(code);
    return () => store.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Auto next hand: 5-second countdown at showdown.
  // For multi-run, delay the countdown until all chip animations finish landing.
  // Single run chips land at ~2.8s; multi-run last chip = (runCount-1)*4.0 + 3.6s.
  // We wait for that, then show the 5s countdown.
  const phase = store.getPhase();
  const handNumber = store.getHandNumber();
  const runCount = store.getRunCount();

  // Show rebuy prompt when the viewing player runs out of chips — but only after
  // all runs have fully settled (chips landed), not at the moment they go all-in.
  const viewerStack = store.getViewerStack();
  const viewingPlayer = store.getViewingPlayer();
  const viewingSeat = store.viewingSeat;
  // Hoist these early so the rebuy effect can gate on them.
  const isRunItBoardEarly = store.isRunItBoard;
  const showdownStartedAtEarly = store.showdownStartedAt;
  const knownCardCountEarly = store.knownCardCountAtRunIt;
  const settledRunCountEarly = useSettledRunsCount(
    phase,
    isRunItBoardEarly,
    showdownStartedAtEarly,
    knownCardCountEarly,
    runCount,
  );
  useEffect(() => {
    const allSettled = settledRunCountEarly >= runCount;
    if (phase === "showdown" && viewerStack === 0 && viewingPlayer !== null && allSettled) {
      setShowRebuySheet(true);
    }
    if (phase !== "showdown") {
      setShowRebuySheet(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, viewerStack, viewingPlayer?.id, settledRunCountEarly]);

  const handleRebuy = useCallback(
    (buyInCents: number) => {
      if (!viewingPlayer) return;
      store.sitDown(viewingSeat, viewingPlayer.name, buyInCents);
      setShowRebuySheet(false);
    },
    [store, viewingSeat, viewingPlayer]
  );

  const handleLeave = useCallback(() => {
    store.standUp();
    setShowRebuySheet(false);
  }, [store]);
  useEffect(() => {
    if (phase !== "showdown") {
      setShowdownCountdown(null);
      return;
    }

    // Timing depends on how many cards were already known before the all-in
    const gs = useGameStore.getState();
    const runResults = gs.getRunResults();
    const knownCardCount = gs.knownCardCountAtRunIt;
    const isRunItBoardNow = gs.isRunItBoard;
    const { chipStartS, runIntervalS } = getRunTimings(knownCardCount);
    const CHIP_DURATION_S = 2.4;
    // All run-it showdowns show announcement first, then deal new streets, then chips fly
    const animDoneMs = isRunItBoardNow
      ? (ANNOUNCE_DELAY_S + (runCount - 1) * runIntervalS + chipStartS + CHIP_DURATION_S + 1.5) * 1000
      : 0;

    const COUNTDOWN_S = 5;
    let startDelay: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    startDelay = setTimeout(() => {
      setShowdownCountdown(COUNTDOWN_S);
      interval = setInterval(() => {
        setShowdownCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval!);
            useGameStore.getState().startHand();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }, animDoneMs);

    return () => {
      if (startDelay) clearTimeout(startDelay);
      if (interval) clearInterval(interval);
    };
  }, [phase, handNumber, runCount]);

  const players = store.getPlayers();
  const holeCards = store.getHoleCards();
  const communityCards = store.getCommunityCards();
  const pot = store.getTotalPotWithBets();
  const winners = store.getWinners();
  const isYourTurn = store.isViewerTurn();
  const callAmount = store.getCallAmount();
  const minRaise = store.getMinRaise();
  const checkable = store.canCheck();
  const raiseable = store.canRaise();
  const canAllIn = store.canAllIn();
  const turnStartedAt = store.turnStartedAt;
  const votingStartedAt = store.votingStartedAt;

  const tableNotFound = store.tableNotFound;
  const isAdmin = store.isCreator;
  const connectionStatus = store.connectionStatus;
  const timerEnabled = store.turnTimerEnabled;
  const viewerIsFolded = store.getViewingPlayer()?.isFolded ?? true;
  const isRunItBoard = isRunItBoardEarly;
  const knownCardCount = knownCardCountEarly;
  const runItVotes = store.getRunItVotes();
  const runResults = store.getRunResults();
  const runAnnouncement = store.runAnnouncement;
  const runDealStartedAt = store.runDealStartedAt;
  const sevenTwoBountyBB = store.getSevenTwoBountyBB();
  const sevenTwoAnnouncement = store.sevenTwoAnnouncement;
  const sevenTwoBountyTrigger = store.getSevenTwoBountyTrigger();
  const voluntaryShownPlayerIds = store.getVoluntaryShownPlayerIds();
  const bombPotVote = store.getBombPotVote();
  const bombPotNextHand = store.getBombPotNextHand();
  const isBombPotHand = store.isBombPotHand();
  const communityCards2 = store.getCommunityCards2();
  const bombPotCooldown = store.getBombPotCooldown();
  const bombPotAnnouncement = store.bombPotAnnouncement;
  const gs = store.gameState;
  const currentActorId = gs.needsToAct[0] ?? null;
  const currentActorName = currentActorId ? gs.players[currentActorId]?.name : undefined;

  const handleSitDown = useCallback(
    (seatIndex: number, name?: string, buyInCents?: number) => {
      if (name && buyInCents) {
        store.sitDown(seatIndex, name, buyInCents);
      } else {
        setSelectedSeat(seatIndex);
      }
    },
    [store]
  );

  const confirmSitDown = useCallback(
    (name: string, buyInCents: number) => {
      if (selectedSeat === null) return;
      store.sitDown(selectedSeat, name, buyInCents);
      setSelectedSeat(null);
    },
    [selectedSeat, store]
  );

  // Route raise through allIn() when the amount is below the legal raise threshold.
  // The raise dialog's "All-in" preset sends the remaining stack (not currentBet+stack),
  // which is below minRaise when the actor can't meet the full raise — the only valid
  // action in that case is an all-in shove, dispatched via the dedicated all-in action.
  const handleRaise = useCallback(
    (totalAmount: number) => {
      const { gameState } = store;
      const actorId = gameState.needsToAct[0];
      const actor = actorId ? gameState.players[actorId] : null;
      if (!actor || actor.stack === 0) return;
      const threshold = gameState.roundBet + gameState.lastLegalRaiseIncrement;
      if (gameState.isBlindIncomplete && totalAmount <= gameState.blinds.big) {
        store.raise(totalAmount); // completion — engine handles it
      } else if (totalAmount >= threshold) {
        store.raise(totalAmount);
      } else {
        // Amount is under the legal raise threshold — treat as all-in shove
        store.allIn();
      }
    },
    [store]
  );

  // Show cards mechanic + 7-2 eligibility (computed before displayPlayers map)
  const isUncontestedHand =
    winners?.length === 1 &&
    (winners[0].hand === "Uncontested" || winners[0].hand === "Last standing");
  const canShowCards =
    phase === "showdown" &&
    viewingPlayer !== null &&
    !voluntaryShownPlayerIds.includes(viewingPlayer.id) &&
    (viewerIsFolded || isUncontestedHand);
  const isSoleUncontestedWinner =
    isUncontestedHand &&
    winners?.length === 1 &&
    winners[0].playerId === viewingPlayer?.id;
  const sevenTwoEligible =
    sevenTwoBountyBB > 0 &&
    phase === "showdown" &&
    isSoleUncontestedWinner &&
    canShowCards &&
    holeCards !== null &&
    (
      (holeCards[0].rank === "7" && holeCards[1].rank === "2") ||
      (holeCards[0].rank === "2" && holeCards[1].rank === "7")
    ) &&
    holeCards[0].suit !== holeCards[1].suit;

  // Deferred stack display: stacks stay at $0 for all-in players until their winning chips land
  const { currentRun, revealedCount } = useCurrentRun(phase, isRunItBoard, runDealStartedAt, knownCardCount, runCount);
  const settledRunCount = settledRunCountEarly;
  const displayPlayers = phase === "showdown"
    ? players.map((p) => {
        if (!p) return p;
        let pending = 0;
        if (isRunItBoard) {
          for (let r = settledRunCount; r < runResults.length; r++) {
            // A player can appear multiple times in runResults[r].winners (once per side pot).
            // Sum ALL their entries — find() would silently miss the second and beyond.
            const runWin = runResults[r].winners
              .filter((w) => w.playerId === p.id)
              .reduce((sum, w) => sum + w.amount, 0);
            pending += runWin;
          }
        } else if (settledRunCount === 0) {
          const win = winners?.find((w) => w.playerId === p.id);
          pending = win?.amount ?? 0;
        }
        // Compute hand label from currently visible cards only.
        // For run-it all-ins: evaluate the best hand from hole cards + however
        // many board cards have actually been dealt so far (revealedCount).
        // This means a flush draw after the flop correctly shows "High Card" until
        // the flush completes. For normal showdowns all 5 cards are always visible.
        let handLabel: string | undefined;
        // Own cards are not in UIPlayer.holeCards — they live in the hand panel only.
        const evalCards = p.isYou ? holeCards : (p.holeCards?.filter((c): c is NonNullable<typeof c> => c != null) ?? null);
        if (isRunItBoard && runResults.length > 0 && evalCards && evalCards.length === 2) {
          const board = runResults[currentRun]?.board ?? [];
          const visibleBoard = board.slice(0, revealedCount);
          const allVisible = [...evalCards, ...visibleBoard];
          handLabel = allVisible.length >= 5 ? evaluateBest(allVisible).label : undefined;
        } else {
          handLabel = winners?.find((w) => w.playerId === p.id)?.hand;
        }
        // Determine win animation for the most recently settled run.
        // "full" = sole winner of the entire pot; "partial" = split/side-pot/multi-run.
        // winAnimationKey changes per settled run so the animation re-fires each time.
        let winType: "full" | "partial" | null = null;
        let winAnimationKey: string | null = null;
        if (settledRunCount > 0) {
          if (isRunItBoard && runResults.length > 0) {
            const justSettled = settledRunCount - 1;
            const wonThisRun = runResults[justSettled]?.winners.some((w) => w.playerId === p.id);
            if (wonThisRun) {
              // Count unique players (not raw entries) — a sole winner can have multiple
              // entries in runResults[r].winners if they won multiple side pots in one run.
              const uniqueWinnersThisRun = new Set(
                runResults[justSettled].winners.map((w) => w.playerId)
              );
              winType = (runCount === 1 && uniqueWinnersThisRun.size === 1) ? "full" : "partial";
              winAnimationKey = `win-${settledRunCount}`;
            }
          } else if (!isRunItBoard && settledRunCount === 1) {
            const isWinner = winners?.some((w) => w.playerId === p.id);
            if (isWinner) {
              winType = (winners?.length ?? 0) === 1 ? "full" : "partial";
              winAnimationKey = "win-1";
            }
          }
        }

        const base = pending > 0 ? { ...p, stack: p.stack - pending } : p;
        const withLabel = handLabel ? { ...base, handLabel } : base;
        const withWin = winType ? { ...withLabel, winType, winAnimationKey } : withLabel;
        // Tag 7-2 eligible indicator on the viewing player's entry
        if (p.isYou && sevenTwoEligible) return { ...withWin, sevenTwoEligible: true };
        return withWin;
      })
    : players;

  // Progressive pot: during showdown, start at the original total and decrease by 1/N per settled run.
  // state.pot is zeroed by the engine at showdown entry, so we reconstruct from runResults/winners.
  const displayPot = useMemo(() => {
    if (phase !== "showdown") return pot;
    let totalPot: number;
    if (isRunItBoard && runResults.length > 0) {
      totalPot = runResults.reduce(
        (sum, run) => sum + run.winners.reduce((s, w) => s + w.amount, 0),
        0,
      );
    } else if (winners && winners.length > 0) {
      totalPot = winners.reduce((sum, w) => sum + w.amount, 0);
    } else {
      return 0;
    }
    let settledAmount = 0;
    if (isRunItBoard) {
      for (let r = 0; r < settledRunCount; r++) {
        settledAmount += runResults[r].winners.reduce((s, w) => s + w.amount, 0);
      }
    } else if (settledRunCount > 0) {
      settledAmount = totalPot;
    }
    return totalPot - settledAmount;
  }, [phase, pot, isRunItBoard, runResults, winners, settledRunCount]);

  // Compute hand strength at showdown
  let handStrength: string | null = null;
  if (phase === "showdown" && winners && viewingPlayer) {
    const win = winners.find((w) => w.playerId === viewingPlayer.id);
    if (win) handStrength = win.hand;
  }

  if (tableNotFound) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-6 px-6 text-center">
        <div className="text-6xl">🃏</div>
        <h1 className="text-2xl font-black">Table not found</h1>
        <p className="text-gray-400 text-sm">This table code doesn't exist or hasn't been created yet.</p>
        <a
          href="/"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-sm shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
        >
          Go Home
        </a>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden relative">
      {connectionStatus === "disconnected" && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center py-1.5 bg-red-900/90 backdrop-blur-sm text-red-200 text-xs font-semibold tracking-wide">
          Reconnecting…
        </div>
      )}
      <TableLayout
        onSitDown={handleSitDown}
        players={displayPlayers as any}
        dealerIndex={gs.dealerSeatIndex}
        tableName={gs.tableName}
        blinds={gs.blinds}
        pot={displayPot}
        smallBlindIndex={gs.smallBlindSeatIndex}
        bigBlindIndex={gs.bigBlindSeatIndex}
        communityCards={communityCards}
        holeCards={holeCards}
        handStrength={handStrength}
        phase={phase}
        winners={winners}
        onFold={store.fold}
        onCheck={store.check}
        onCall={store.call}
        onRaise={handleRaise}
        onAllIn={store.allIn}
        canAllIn={canAllIn}
        onStartHand={store.startHand}
        callAmount={callAmount}
        minRaise={minRaise}
        canCheck={checkable}
        canRaise={raiseable}
        isYourTurn={isYourTurn}
        currentActorName={currentActorName}
        isFirstBet={store.isFirstBet()}
        handNumber={store.getHandNumber()}
        viewerStack={viewerStack}
        showdownCountdown={showdownCountdown}
        turnStartedAt={turnStartedAt}
        isAdmin={isAdmin}
        streetSweeping={store.streetSweeping}
        timerEnabled={timerEnabled}
        onToggleTimer={store.setTurnTimerEnabled}
        runItVotes={runItVotes}
        onVoteRun={store.voteRun}
        runResults={runResults}
        runCount={runCount}
        runAnnouncement={runAnnouncement}
        votingStartedAt={votingStartedAt}
        viewerCanVote={!viewerIsFolded}
        isRunItBoard={isRunItBoard}
        knownCardCount={knownCardCount}
        runDealStartedAt={runDealStartedAt}
        showNextHand={showdownCountdown !== null}
        sevenTwoBountyBB={sevenTwoBountyBB}
        sevenTwoAnnouncement={sevenTwoAnnouncement}
        sevenTwoBountyTrigger={sevenTwoBountyTrigger}
        canShowCards={canShowCards}
        onRevealCard={store.revealCard}
        myRevealedCardIndices={store.myRevealedCardIndices}
        voluntaryShownPlayerIds={voluntaryShownPlayerIds}
        onSetSevenTwoBounty={store.setSevenTwoBounty}
        bombPotVote={bombPotVote}
        bombPotNextHand={bombPotNextHand}
        isBombPotHand={isBombPotHand}
        communityCards2={communityCards2}
        bombPotCooldown={bombPotCooldown}
        bombPotAnnouncement={bombPotAnnouncement}
        onProposeBombPot={store.proposeBombPot}
        onVoteBombPot={store.voteBombPot}
      />

      {/* Sit-down dialog (desktop — uses dialog variant) */}
      <AnimatePresence>
        {selectedSeat !== null && (
          <SitDownForm
            seatIndex={selectedSeat}
            bigBlindCents={gs.blinds.big}
            onConfirm={confirmSitDown}
            onDismiss={() => setSelectedSeat(null)}
            variant="dialog"
          />
        )}
      </AnimatePresence>

      {/* Rebuy prompt — shown when viewing player hits $0 at showdown */}
      <AnimatePresence>
        {showRebuySheet && viewingPlayer && (
          <RebuySheet
            playerName={viewingPlayer.name}
            bigBlindCents={gs.blinds.big}
            onRebuy={handleRebuy}
            onLeave={handleLeave}
            variant={isPortrait ? "sheet" : "dialog"}
          />
        )}
      </AnimatePresence>

      {/* ── Debug Panel (dev only) ── */}
      {process.env.NEXT_PUBLIC_DEBUG === "true" && <DebugPanel />}
    </div>
  );
}

"use client";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import TableLayout from "components/Table/TableLayout";
import SitDownForm from "components/Table/SitDownForm";
import RebuySheet from "components/Table/mobile/RebuySheet";
import { useGameStore } from "store/useGameStore";
import { useIsMobileLayout } from "hooks/useIsMobileLayout";
import { evaluateBest } from "@pokington/engine";
import type { Card as PokerCard } from "@pokington/shared";
import { buildViewerHandIndicators, evaluateVisibleHandLabel } from "lib/handIndicators";
import { getRunTimings, ANNOUNCE_DELAY_S } from "lib/showdownTiming";
import { isAnimatedRunItShowdown } from "lib/tableVisualState";
import { useSettledRunsCount, useCurrentRun } from "hooks/useSettledRunsCount";

export default function TablePageClient({ code }: { code: string }) {
  const isMobileLayout = useIsMobileLayout();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [showdownCountdown, setShowdownCountdown] = useState<number | null>(null);
  const [showRebuySheet, setShowRebuySheet] = useState(false);

  // Connect to the PartyKit room for this table code
  useEffect(() => {
    useGameStore.getState().connect(code);
    return () => useGameStore.getState().disconnect();
  }, [code]);

  const phase = useGameStore((s) => s.gameState.phase);
  const handNumber = useGameStore((s) => s.gameState.handNumber);
  const runCount = useGameStore((s) => s.gameState.runCount) as 1 | 2 | 3;
  const isBombPotHand = useGameStore((s) => s.gameState.isBombPot);
  const runResultsEarly = useGameStore((s) => s.gameState.runResults);

  const viewingSeat = useGameStore((s) => s.viewingSeat);
  const isRunItBoardEarly = useGameStore((s) => s.isRunItBoard);
  const showdownStartedAtEarly = useGameStore((s) => s.showdownStartedAt);
  const knownCardCountEarly = useGameStore((s) => s.knownCardCountAtRunIt);
  const animatedRunItShowdown = isAnimatedRunItShowdown({
    phase,
    isRunItBoard: isRunItBoardEarly,
    isBombPotHand,
    runResults: runResultsEarly,
  });

  // Show rebuy prompt when the viewing player runs out of chips — but only after
  // all runs have fully settled (chips landed), not at the moment they go all-in.
  const viewerStack = useGameStore((s) => s.getViewerStack());
  const viewingPlayer = useGameStore((s) => s.getViewingPlayer());
  const viewerCurrentBet = viewingPlayer?.currentBet ?? 0;
  const settledRunCountEarly = useSettledRunsCount(
    phase,
    animatedRunItShowdown,
    showdownStartedAtEarly,
    knownCardCountEarly,
    runCount,
  );
  // Cache player info when rebuy sheet opens so it survives the auto-kick on next hand start.
  const [rebuyInfo, setRebuyInfo] = useState<{ name: string; seat: number } | null>(null);
  useEffect(() => {
    const allSettled = settledRunCountEarly >= runCount;
    if (phase === "showdown" && viewerStack === 0 && viewingPlayer !== null && allSettled) {
      setRebuyInfo({ name: viewingPlayer.name, seat: viewingSeat });
      setShowRebuySheet(true);
    }
    // Close the sheet when the player successfully buys back in (stack > 0).
    if (showRebuySheet && viewerStack > 0) {
      setShowRebuySheet(false);
      setRebuyInfo(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, viewerStack, viewingPlayer?.id, settledRunCountEarly]);

  const handleRebuy = useCallback(
    (buyInCents: number) => {
      // Use cached info if the player was auto-kicked (viewingPlayer is null).
      const name = viewingPlayer?.name ?? rebuyInfo?.name;
      const seat = viewingPlayer ? viewingSeat : rebuyInfo?.seat ?? viewingSeat;
      if (!name) return;
      useGameStore.getState().sitDown(seat, name, buyInCents);
      setShowRebuySheet(false);
      setRebuyInfo(null);
    },
    [viewingSeat, viewingPlayer, rebuyInfo]
  );

  const handleLeave = useCallback(() => {
    // If already auto-kicked, just close the sheet — no need to stand up again.
    if (viewingPlayer) useGameStore.getState().standUp();
    setShowRebuySheet(false);
    setRebuyInfo(null);
  }, [viewingPlayer]);
  useEffect(() => {
    if (phase !== "showdown") {
      setShowdownCountdown(null);
      return;
    }

    // Timing depends on how many cards were already known before the all-in
    const gs = useGameStore.getState();
    const knownCardCount = gs.knownCardCountAtRunIt;
    const shouldDelayForRunIt = isAnimatedRunItShowdown({
      phase,
      isRunItBoard: gs.isRunItBoard,
      isBombPotHand: gs.gameState.isBombPot,
      runResults: gs.getRunResults(),
    });
    const { chipStartS, runIntervalS } = getRunTimings(knownCardCount);
    const CHIP_DURATION_S = 2.4;
    // All run-it showdowns show announcement first, then deal new streets, then chips fly
    const animDoneMs = shouldDelayForRunIt
      ? (ANNOUNCE_DELAY_S + (runCount - 1) * runIntervalS + chipStartS + CHIP_DURATION_S + 1.5) * 1000
      : 0;

    const COUNTDOWN_S = 10;
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

  const players = useGameStore((s) => s.getPlayers());
  const holeCards = useGameStore((s) => s.myHoleCards);
  const myUserId = useGameStore((s) => s.myUserId);
  const communityCards = useGameStore((s) => s.gameState.communityCards);
  const pot = useGameStore((s) => s.getTotalPotWithBets());
  const winners = useGameStore((s) => s.gameState.winners);
  const showdownKind = useGameStore((s) => s.gameState.showdownKind);
  const autoRevealWinningHands = useGameStore((s) => s.gameState.autoRevealWinningHands);
  const revealedHoleCards = useGameStore((s) => s.revealedHoleCards);
  const isYourTurn = useGameStore((s) => s.isViewerTurn());
  const callAmount = useGameStore((s) => s.getCallAmount());
  const minRaise = useGameStore((s) => s.getMinRaise());
  const checkable = useGameStore((s) => s.canCheck());
  const raiseable = useGameStore((s) => s.canRaise());
  const canAllIn = useGameStore((s) => s.canAllIn());
  const votingStartedAt = useGameStore((s) => s.votingStartedAt);

  const tableNotFound = useGameStore((s) => s.tableNotFound);
  const isAdmin = useGameStore((s) => s.isCreator);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const hasReceivedInitialState = useGameStore((s) => s.isFirstStateReceived);
  const showBlockingConnectionOverlay = !hasReceivedInitialState;
  const blockingConnectionTitle =
    connectionStatus === "disconnected" ? "Reconnecting table" : "Loading table";
  const blockingConnectionMessage =
    connectionStatus === "disconnected"
      ? "Your connection dropped before the table finished syncing. Restoring the latest hand now."
      : `Joining ${code.toUpperCase()} and syncing the current table state...`;

  const viewerIsFolded = viewingPlayer?.isFolded ?? true;
  const isRunItBoard = isRunItBoardEarly;
  const knownCardCount = knownCardCountEarly;
  const runItVotes = useGameStore((s) => s.gameState.runItVotes);
  const runResults = useGameStore((s) => s.gameState.runResults);
  const runAnnouncement = useGameStore((s) => s.runAnnouncement);
  const runDealStartedAt = useGameStore((s) => s.runDealStartedAt);
  const sevenTwoBountyBB = useGameStore((s) => s.gameState.sevenTwoBountyBB);
  const sevenTwoAnnouncement = useGameStore((s) => s.sevenTwoAnnouncement);
  const sevenTwoBountyTrigger = useGameStore((s) => s.gameState.sevenTwoBountyTrigger);
  const bombPotVote = useGameStore((s) => s.gameState.bombPotVote);
  const bombPotNextHand = useGameStore((s) => s.gameState.bombPotNextHand);
  const communityCards2 = useGameStore((s) => s.gameState.communityCards2);
  const bombPotCooldown = useGameStore((s) => s.gameState.bombPotCooldown);
  const bombPotAnnouncement = useGameStore((s) => s.bombPotAnnouncement);
  const streetSweeping = useGameStore((s) => s.streetSweeping);
  const myRevealedCardIndices = useGameStore((s) => s.myRevealedCardIndices);
  const dealerSeatIndex = useGameStore((s) => s.gameState.dealerSeatIndex);
  const tableName = useGameStore((s) => s.gameState.tableName);
  const blinds = useGameStore((s) => s.gameState.blinds);
  const smallBlindIndex = useGameStore((s) => s.gameState.smallBlindSeatIndex);
  const bigBlindIndex = useGameStore((s) => s.gameState.bigBlindSeatIndex);
  const isFirstBet = useGameStore((s) => s.isFirstBet());
  const currentActorId = useGameStore((s) => s.gameState.needsToAct[0] ?? null);
  const currentActorName = useGameStore((s) => {
    const id = s.gameState.needsToAct[0];
    return id ? s.gameState.players[id]?.name : undefined;
  });
  const leaveQueued = useGameStore((s) => s.leaveQueued);
  const viewerIsSeated = viewingPlayer !== null;
  const seatSelectionLocked = viewerIsSeated && !!phase && phase !== "waiting";

  const handleSitDown = useCallback(
    (seatIndex: number, name?: string, buyInCents?: number) => {
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

      // If the player is already seated and the game hasn't started,
      // move them to the new seat without reopening the sit-down dialog.
      if (isSeated && isWaiting) {
        store.changeSeat(seatIndex);
      } else {
        setSelectedSeat(seatIndex);
      }
    },
    []
  );

  const confirmSitDown = useCallback(
    (name: string, buyInCents: number) => {
      if (selectedSeat === null) return;
      useGameStore.getState().sitDown(selectedSeat, name, buyInCents);
      setSelectedSeat(null);
    },
    [selectedSeat]
  );

  // Route raise through allIn() when the amount is below the legal raise threshold.
  // The raise dialog's "All-in" preset sends the remaining stack (not currentBet+stack),
  // which is below minRaise when the actor can't meet the full raise — the only valid
  // action in that case is an all-in shove, dispatched via the dedicated all-in action.
  const handleRaise = useCallback(
    (totalAmount: number) => {
      const { gameState } = useGameStore.getState();
      const actorId = gameState.needsToAct[0];
      const actor = actorId ? gameState.players[actorId] : null;
      if (!actor || actor.stack === 0) return;
      const threshold = gameState.roundBet + gameState.lastLegalRaiseIncrement;
      if (gameState.isBlindIncomplete && totalAmount <= gameState.blinds.big) {
        useGameStore.getState().raise(totalAmount); // completion — engine handles it
      } else if (totalAmount >= threshold) {
        useGameStore.getState().raise(totalAmount);
      } else {
        // Amount is under the legal raise threshold — treat as all-in shove
        useGameStore.getState().allIn();
      }
    },
    []
  );

  const handleDebugDealSevenTwo = useCallback(() => {
    if (!isAdmin || !viewingPlayer?.id || phase !== "pre-flop") return;
    useGameStore.getState().debugSetHoleCards(viewingPlayer.id, [
      { rank: "7", suit: "clubs" },
      { rank: "2", suit: "hearts" },
    ]);
  }, [isAdmin, phase, viewingPlayer?.id]);

  // Show cards mechanic + 7-2 eligibility (computed before displayPlayers map)
  const isUncontestedHand = showdownKind === "uncontested";
  const canRevealDuringAction = ["pre-flop", "flop", "turn", "river"].includes(phase);
  const canShowCards =
    viewingPlayer !== null &&
    holeCards !== null &&
    myRevealedCardIndices.size < 2 &&
    (
      phase === "showdown" ||
      (canRevealDuringAction && isYourTurn && !viewerIsFolded)
    );
  const isSoleUncontestedWinner =
    isUncontestedHand &&
    !autoRevealWinningHands &&
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
  const { currentRun, revealedCount } = useCurrentRun(phase, animatedRunItShowdown, runDealStartedAt, knownCardCount, runCount);
  const settledRunCount = settledRunCountEarly;
  const getTableVisibleHoleCards = useCallback((
    playerId: string | undefined,
    playerHoleCards: [PokerCard | null, PokerCard | null] | null | undefined,
  ): [PokerCard, PokerCard] | null => {
    if (!playerId) return null;
    const publicCards = revealedHoleCards[playerId] ?? playerHoleCards;
    if (!publicCards?.[0] || !publicCards?.[1]) return null;
    return [publicCards[0], publicCards[1]];
  }, [revealedHoleCards]);

  const getVisibleHandLabel = useCallback((
    playerHoleCards: readonly PokerCard[] | null | undefined,
  ): string | undefined => {
    if (!playerHoleCards || playerHoleCards.length !== 2) return undefined;
    const visibleBoard = animatedRunItShowdown && runResults.length > 0
      ? (runResults[currentRun]?.board ?? []).slice(0, revealedCount)
      : communityCards;
    return evaluateVisibleHandLabel(playerHoleCards, visibleBoard) ?? undefined;
  }, [animatedRunItShowdown, communityCards, currentRun, revealedCount, runResults]);

  const displayPlayers = useMemo(() => phase === "showdown"
    ? players.map((p) => {
        if (!p) return p;
        let pending = 0;
        if (animatedRunItShowdown) {
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
        const evalCards = getTableVisibleHoleCards(p.id, p.holeCards);
        const handLabel = getVisibleHandLabel(evalCards);
        // Determine win animation for the most recently settled run.
        // "full" = sole winner of the entire pot; "partial" = split/side-pot/multi-run.
        // winAnimationKey changes per settled run so the animation re-fires each time.
        let winType: "full" | "partial" | null = null;
        let winAnimationKey: string | null = null;
        if (settledRunCount > 0) {
          if (animatedRunItShowdown && runResults.length > 0) {
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
          } else if (!animatedRunItShowdown && settledRunCount === 1) {
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
    : players,
  [animatedRunItShowdown, phase, players, settledRunCount, runResults, winners, sevenTwoEligible, runCount, getVisibleHandLabel, getTableVisibleHoleCards]);

  // Progressive pot: during showdown, start at the original total and decrease by 1/N per settled run.
  // state.pot is zeroed by the engine at showdown entry, so we reconstruct from runResults/winners.
  const displayPot = useMemo(() => {
    if (phase !== "showdown") return pot;
    let totalPot: number;
    if (animatedRunItShowdown && runResults.length > 0) {
      totalPot = runResults.reduce(
        (sum, run) => sum + (run.winners ?? []).reduce((s, w) => s + w.amount, 0),
        0,
      );
    } else if (winners && winners.length > 0) {
      totalPot = winners.reduce((sum, w) => sum + w.amount, 0);
    } else {
      return 0;
    }
    let settledAmount = 0;
    if (animatedRunItShowdown && runResults.length > 0) {
      for (let r = 0; r < settledRunCount && r < runResults.length; r++) {
        settledAmount += (runResults[r]?.winners ?? []).reduce((s, w) => s + w.amount, 0);
      }
    } else if (settledRunCount > 0) {
      settledAmount = totalPot;
    }
    return totalPot - settledAmount;
  }, [animatedRunItShowdown, phase, pot, runResults, winners, settledRunCount]);

  const handIndicators = useMemo(() => {
    if (phase === "showdown") {
      return buildViewerHandIndicators({
        holeCards,
        communityCards,
        communityCards2,
        runResults,
        animatedRunItShowdown,
        currentRun,
        revealedCount,
        knownCardCount,
        isBombPotHand,
      });
    }

    const liveLabel = holeCards && holeCards.length === 2 && communityCards.length >= 3
      ? evaluateBest([...holeCards, ...communityCards]).label
      : null;
    return liveLabel ? [{ id: "single", title: "Hand", label: liveLabel }] : [];
  }, [
    animatedRunItShowdown,
    communityCards,
    communityCards2,
    currentRun,
    holeCards,
    isBombPotHand,
    knownCardCount,
    phase,
    revealedCount,
    runResults,
  ]);

  const cardPeelPersistenceKey = useMemo(() => {
    if (!myUserId || !holeCards) return null;
    return `${code.toUpperCase()}:${myUserId}:hand:${handNumber}`;
  }, [code, handNumber, holeCards, myUserId]);

  if (tableNotFound) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-6 px-6 text-center">
        <div className="text-6xl">🃏</div>
        <h1 className="text-2xl font-black">Table not found</h1>
        <p className="text-gray-400 text-sm">
          <code className="font-mono text-gray-200">{code.toUpperCase()}</code> doesn&apos;t exist or hasn&apos;t been created yet.
        </p>
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
    <div className="relative h-screen overflow-hidden bg-gray-950">
      {connectionStatus === "disconnected" && hasReceivedInitialState && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-red-200/15 bg-red-500/10 px-4 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300/65" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-200" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-50/95">
              Reconnecting
            </span>
          </div>
        </div>
      )}
      {isAdmin && viewingPlayer?.id && (
        <div className="fixed top-3 left-3 z-40 flex flex-col gap-1">
          <button
            type="button"
            onClick={handleDebugDealSevenTwo}
            disabled={phase !== "pre-flop"}
            className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg backdrop-blur-sm transition ${
              phase === "pre-flop"
                ? "bg-amber-400/95 text-black hover:bg-amber-300"
                : "bg-gray-900/80 text-gray-400 cursor-not-allowed"
            }`}
            title={phase === "pre-flop" ? "Force your current hand to 7-2 offsuit" : "Available during pre-flop only"}
          >
            Debug: Deal Me 7-2o
          </button>
          <div className="px-2 text-[10px] font-semibold text-white/75">
            {phase === "pre-flop" ? "Pre-flop debug hand injector" : "Pre-flop only"}
          </div>
        </div>
      )}
      <TableLayout
        onSitDown={handleSitDown}
        seatSelectionLocked={seatSelectionLocked}
        players={displayPlayers as any}
        dealerIndex={dealerSeatIndex}
        tableName={tableName}
        blinds={blinds}
        pot={displayPot}
        smallBlindIndex={smallBlindIndex}
        bigBlindIndex={bigBlindIndex}
        communityCards={communityCards}
        holeCards={holeCards}
        handIndicators={handIndicators}
        phase={phase}
        winners={winners}
        onFold={useGameStore.getState().fold}
        onCheck={useGameStore.getState().check}
        onCall={useGameStore.getState().call}
        onRaise={handleRaise}
        onAllIn={useGameStore.getState().allIn}
        canAllIn={canAllIn}
        onStartHand={useGameStore.getState().startHand}
        callAmount={callAmount}
        minRaise={minRaise}
        canCheck={checkable}
        canRaise={raiseable}
        isYourTurn={isYourTurn}
        currentActorName={currentActorName}
        isFirstBet={isFirstBet}
        handNumber={handNumber}
        viewerStack={viewerStack}
        viewerCurrentBet={viewerCurrentBet}
        showdownCountdown={showdownCountdown}
        isAdmin={isAdmin}
        streetSweeping={streetSweeping}
        runItVotes={runItVotes}
        onVoteRun={useGameStore.getState().voteRun}
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
        sevenTwoEligible={sevenTwoEligible}
        onRevealCard={useGameStore.getState().revealCard}
        onPeekCard={useGameStore.getState().peekCard}
        myRevealedCardIndices={myRevealedCardIndices}
        bombPotVote={bombPotVote}
        bombPotNextHand={bombPotNextHand}
        isBombPotHand={isBombPotHand}
        communityCards2={communityCards2}
        bombPotCooldown={bombPotCooldown}
        bombPotAnnouncement={bombPotAnnouncement}
        onProposeBombPot={useGameStore.getState().proposeBombPot}
        onVoteBombPot={useGameStore.getState().voteBombPot}
        onStandUp={viewingPlayer ? useGameStore.getState().standUp : undefined}
        onQueueLeave={viewingPlayer ? useGameStore.getState().queueLeave : undefined}
        leaveQueued={leaveQueued}
        cardPeelPersistenceKey={cardPeelPersistenceKey}
      />

      {showBlockingConnectionOverlay && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center overflow-hidden bg-slate-950/20 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.18),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.12),_transparent_42%)]" />
          <div className="relative mx-6 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-6 text-white shadow-[0_25px_90px_rgba(0,0,0,0.48)]">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <div className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300/60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-200 shadow-[0_0_20px_rgba(254,202,202,0.6)]" />
              </span>
              Live Table Sync
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  {blockingConnectionTitle}
                </h1>
                <div className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {code.toUpperCase()}
                </div>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/72">
                {blockingConnectionMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sit-down dialog (desktop — uses dialog variant) */}
      <AnimatePresence>
        {selectedSeat !== null && (
          <SitDownForm
            seatIndex={selectedSeat}
            bigBlindCents={blinds.big}
            onConfirm={confirmSitDown}
            onDismiss={() => setSelectedSeat(null)}
            variant="dialog"
          />
        )}
      </AnimatePresence>

      {/* Rebuy prompt — shown when viewing player hits $0 at showdown */}
      <AnimatePresence>
        {showRebuySheet && (viewingPlayer ?? rebuyInfo) && (
          <RebuySheet
            playerName={viewingPlayer?.name ?? rebuyInfo?.name ?? ""}
            bigBlindCents={blinds.big}
            onRebuy={handleRebuy}
            onLeave={handleLeave}
            variant={isMobileLayout ? "sheet" : "dialog"}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

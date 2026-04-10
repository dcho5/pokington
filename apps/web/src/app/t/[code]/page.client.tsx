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

export default function TablePageClient({ code }: { code: string }) {
  const isPortrait = useIsPortrait();
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

  const viewingSeat = useGameStore((s) => s.viewingSeat);
  const isRunItBoardEarly = useGameStore((s) => s.isRunItBoard);
  const showdownStartedAtEarly = useGameStore((s) => s.showdownStartedAt);
  const knownCardCountEarly = useGameStore((s) => s.knownCardCountAtRunIt);

  // Show rebuy prompt when the viewing player runs out of chips — but only after
  // all runs have fully settled (chips landed), not at the moment they go all-in.
  const viewerStack = useGameStore((s) => s.getViewerStack());
  const viewingPlayer = useGameStore((s) => s.getViewingPlayer());
  const viewerCurrentBet = viewingPlayer?.currentBet ?? 0;
  const settledRunCountEarly = useSettledRunsCount(
    phase,
    isRunItBoardEarly,
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

  const players = useGameStore((s) => s.getPlayers());
  const holeCards = useGameStore((s) => s.myHoleCards);
  const communityCards = useGameStore((s) => s.gameState.communityCards);
  const pot = useGameStore((s) => s.getTotalPotWithBets());
  const winners = useGameStore((s) => s.gameState.winners);
  const isYourTurn = useGameStore((s) => s.isViewerTurn());
  const callAmount = useGameStore((s) => s.getCallAmount());
  const minRaise = useGameStore((s) => s.getMinRaise());
  const checkable = useGameStore((s) => s.canCheck());
  const raiseable = useGameStore((s) => s.canRaise());
  const canAllIn = useGameStore((s) => s.canAllIn());
  const turnStartedAt = useGameStore((s) => s.turnStartedAt);
  const votingStartedAt = useGameStore((s) => s.votingStartedAt);

  const tableNotFound = useGameStore((s) => s.tableNotFound);
  const isAdmin = useGameStore((s) => s.isCreator);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const timerEnabled = useGameStore((s) => s.turnTimerEnabled);
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
  const voluntaryShownPlayerIds = useGameStore((s) => s.gameState.voluntaryShownPlayerIds);
  const bombPotVote = useGameStore((s) => s.gameState.bombPotVote);
  const bombPotNextHand = useGameStore((s) => s.gameState.bombPotNextHand);
  const isBombPotHand = useGameStore((s) => s.gameState.isBombPot);
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

  const handleSitDown = useCallback(
    (seatIndex: number, name?: string, buyInCents?: number) => {
      if (name && buyInCents) {
        useGameStore.getState().sitDown(seatIndex, name, buyInCents);
      } else {
        // If the player is already seated and the game hasn't started,
        // move them to the new seat without reopening the sit-down dialog.
        const store = useGameStore.getState();
        const phase = store.gameState.phase;
        const isSeated = store.myPlayerId && store.gameState.players[store.myPlayerId];
        const isWaiting = !phase || phase === "waiting";
        if (isSeated && isWaiting) {
          store.changeSeat(seatIndex);
        } else {
          setSelectedSeat(seatIndex);
        }
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

  // Show cards mechanic + 7-2 eligibility (computed before displayPlayers map)
  const isUncontestedHand =
    winners?.length === 1 &&
    (winners[0].hand === "Uncontested" || winners[0].hand === "Last standing");
  const canShowCards =
    phase === "showdown" &&
    viewingPlayer !== null &&
    !voluntaryShownPlayerIds.includes(viewingPlayer.id);
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
  const displayPlayers = useMemo(() => phase === "showdown"
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
    : players,
  [phase, players, settledRunCount, isRunItBoard, runResults, winners, currentRun, revealedCount, holeCards, sevenTwoEligible, runCount]);

  // Progressive pot: during showdown, start at the original total and decrease by 1/N per settled run.
  // state.pot is zeroed by the engine at showdown entry, so we reconstruct from runResults/winners.
  const displayPot = useMemo(() => {
    if (phase !== "showdown") return pot;
    let totalPot: number;
    if (isRunItBoard && runResults.length > 0) {
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
    if (isRunItBoard && runResults.length > 0) {
      for (let r = 0; r < settledRunCount && r < runResults.length; r++) {
        settledAmount += (runResults[r]?.winners ?? []).reduce((s, w) => s + w.amount, 0);
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
        dealerIndex={dealerSeatIndex}
        tableName={tableName}
        blinds={blinds}
        pot={displayPot}
        smallBlindIndex={smallBlindIndex}
        bigBlindIndex={bigBlindIndex}
        communityCards={communityCards}
        holeCards={holeCards}
        handStrength={handStrength}
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
        turnStartedAt={turnStartedAt}
        isAdmin={isAdmin}
        streetSweeping={streetSweeping}
        timerEnabled={timerEnabled}
        onToggleTimer={useGameStore.getState().toggleTimer}
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
        voluntaryShownPlayerIds={voluntaryShownPlayerIds}
        onSetSevenTwoBounty={useGameStore.getState().setSevenTwoBounty}
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
        leaveQueued={useGameStore((s) => s.leaveQueued)}
      />

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
        {showRebuySheet && viewingPlayer && (
          <RebuySheet
            playerName={viewingPlayer.name}
            bigBlindCents={blinds.big}
            onRebuy={handleRebuy}
            onLeave={handleLeave}
            variant={isPortrait ? "sheet" : "dialog"}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

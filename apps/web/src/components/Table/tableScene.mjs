import { evaluateBest } from "@pokington/engine";
import {
  getCenterBoardMode,
  isAnimatedRunItShowdown,
  isAnimatedShowdownReveal,
} from "../../lib/tableVisualState.mjs";
import { canPlayerTableOwnHand } from "../../lib/tableHandRules.mjs";

const TOTAL_SEATS = 10;

function hasNoFurtherActionAgainstAllIn(gameState) {
  const activePlayers = Object.values(gameState.players ?? {}).filter(
    (player) => player?.hasCards && !player.isFolded && !player.isAllIn,
  );
  return activePlayers.length === 1 && activePlayers[0].currentBet >= gameState.roundBet;
}

function getActionableActor(gameState) {
  const actorId = gameState.needsToAct?.[0];
  if (!actorId) return null;
  const actor = gameState.players?.[actorId];
  if (!actor || actor.isFolded || actor.isAllIn || !actor.hasCards || actor.sitOutUntilBB) {
    return null;
  }
  if (hasNoFurtherActionAgainstAllIn(gameState)) return null;
  return actor;
}

function evaluateVisibleHandLabel(holeCards, boardCards) {
  if (!holeCards || holeCards.length !== 2) return null;
  const board = boardCards ?? [];
  const allVisible = [...holeCards, ...board];
  return allVisible.length >= 5 ? evaluateBest(allVisible).label : null;
}

function buildViewerHandIndicators({
  holeCards,
  communityCards,
  communityCards2,
  runResults,
  animatedRunItShowdown,
  currentRun,
  revealedCount,
  knownCardCount,
  isBombPotHand,
}) {
  if (!holeCards || holeCards.length !== 2) return [];

  if (animatedRunItShowdown && (runResults?.length ?? 0) > 1) {
    return (runResults ?? []).map((run, runIndex) => {
      const visibleCount =
        runIndex < currentRun
          ? run.board.length
          : runIndex === currentRun
            ? Math.min(run.board.length, revealedCount)
            : Math.min(run.board.length, knownCardCount);
      const visibleBoard = run.board.slice(0, visibleCount);
      return {
        id: `run-${runIndex}`,
        title: `Run ${runIndex + 1}`,
        label: evaluateVisibleHandLabel(holeCards, visibleBoard),
      };
    });
  }

  if (isBombPotHand || (communityCards2?.length ?? 0) > 0) {
    const boards = [communityCards ?? [], communityCards2 ?? []];
    return boards.map((board, boardIndex) => ({
      id: `board-${boardIndex}`,
      title: `Board ${boardIndex + 1}`,
      label: evaluateVisibleHandLabel(holeCards, board),
    }));
  }

  return [
    {
      id: "single",
      title: "Hand",
      label: evaluateVisibleHandLabel(holeCards, communityCards),
    },
  ];
}

function getTableVisibleHoleCards(playerId, playerHoleCards, revealedHoleCards) {
  if (!playerId) return null;
  const publicCards = revealedHoleCards[playerId] ?? playerHoleCards;
  if (!publicCards?.[0] || !publicCards?.[1]) return null;
  return [publicCards[0], publicCards[1]];
}

function buildScenePlayers({
  gameState,
  sessionContext,
  clientUiState,
  timingFlags,
}) {
  const {
    viewingSeat = -1,
    revealedHoleCards = {},
    awayPlayerIds = [],
    peekedCounts = {},
    showdownPlayerSnapshot = {},
  } = clientUiState;
  const { myPlayerId = null, isCreator = false } = sessionContext;
  const streetPauseChips = timingFlags.streetPauseChips ?? null;
  const actorId = getActionableActor(gameState)?.id ?? null;
  const sourcePlayers = gameState.phase === "showdown"
    ? { ...showdownPlayerSnapshot, ...gameState.players }
    : gameState.players;

  const result = Array(TOTAL_SEATS).fill(null);
  for (const player of Object.values(sourcePlayers ?? {})) {
    const pauseBet = streetPauseChips?.find((chip) => chip.id === player.id)?.amount;
    result[player.seatIndex] = {
      id: player.id,
      name: player.name,
      stack: player.stack,
      seatIndex: player.seatIndex,
      isAdmin: isCreator && player.id === myPlayerId,
      isYou: myPlayerId ? player.id === myPlayerId : player.seatIndex === viewingSeat,
      isCurrentActor: player.id === actorId,
      currentBet: pauseBet ?? player.currentBet,
      isFolded: player.isFolded,
      isAllIn: player.isAllIn,
      lastAction: player.lastAction,
      hasCards: player.hasCards && !player.isFolded,
      isSittingOut: player.sitOutUntilBB,
      peekedCount: peekedCounts[player.id] ?? 0,
      isAway: awayPlayerIds.includes(player.id),
      holeCards: revealedHoleCards[player.id] ?? null,
    };
  }

  return result;
}

function buildDisplayPlayers({
  phase,
  players,
  winners,
  runResults,
  runCount,
  communityCards,
  revealedHoleCards,
  animatedShowdownReveal,
  animatedRunItShowdown,
  currentRun,
  revealedCount,
  settledRunCount,
  sevenTwoEligible,
}) {
  if (phase !== "showdown") return players;

  return players.map((player) => {
    if (!player) return player;

    let pending = 0;
    if (animatedShowdownReveal) {
      for (let runIndex = settledRunCount; runIndex < runResults.length; runIndex += 1) {
        pending += runResults[runIndex].winners
          .filter((winner) => winner.playerId === player.id)
          .reduce((sum, winner) => sum + winner.amount, 0);
      }
    } else if (settledRunCount === 0) {
      pending = winners?.find((winner) => winner.playerId === player.id)?.amount ?? 0;
    }

    const evalCards = getTableVisibleHoleCards(player.id, player.holeCards, revealedHoleCards);
    const visibleBoard = animatedRunItShowdown && runResults.length > 0
      ? (runResults[currentRun]?.board ?? []).slice(0, revealedCount)
      : communityCards;
    const handLabel = evaluateVisibleHandLabel(evalCards, visibleBoard) ?? undefined;

    let winType = null;
    let winAnimationKey = null;
    if (settledRunCount > 0) {
      if (animatedShowdownReveal && runResults.length > 0) {
        const justSettled = settledRunCount - 1;
        const wonThisRun = runResults[justSettled]?.winners.some(
          (winner) => winner.playerId === player.id,
        );
        if (wonThisRun) {
          const uniqueWinnersThisRun = new Set(
            runResults[justSettled].winners.map((winner) => winner.playerId),
          );
          winType = runCount === 1 && uniqueWinnersThisRun.size === 1 ? "full" : "partial";
          winAnimationKey = `win-${settledRunCount}`;
        }
      } else if (!animatedRunItShowdown && settledRunCount === 1) {
        const isWinner = winners?.some((winner) => winner.playerId === player.id);
        if (isWinner) {
          winType = (winners?.length ?? 0) === 1 ? "full" : "partial";
          winAnimationKey = "win-1";
        }
      }
    }

    const base = pending > 0 ? { ...player, stack: player.stack - pending } : player;
    const withLabel = handLabel ? { ...base, handLabel } : base;
    const withWin = winType ? { ...withLabel, winType, winAnimationKey } : withLabel;
    return player.isYou && sevenTwoEligible ? { ...withWin, sevenTwoEligible: true } : withWin;
  });
}

function buildDisplayPot({
  phase,
  pot,
  winners,
  runResults,
  animatedShowdownReveal,
  settledRunCount,
}) {
  if (phase !== "showdown") return pot;

  let totalPot = 0;
  if (animatedShowdownReveal && runResults.length > 0) {
    totalPot = runResults.reduce(
      (sum, run) => sum + (run.winners ?? []).reduce((winnerSum, winner) => winnerSum + winner.amount, 0),
      0,
    );
  } else if (winners && winners.length > 0) {
    totalPot = winners.reduce((sum, winner) => sum + winner.amount, 0);
  }

  if (totalPot === 0) return 0;

  let settledAmount = 0;
  if (animatedShowdownReveal && runResults.length > 0) {
    for (let runIndex = 0; runIndex < settledRunCount && runIndex < runResults.length; runIndex += 1) {
      settledAmount += (runResults[runIndex]?.winners ?? []).reduce(
        (sum, winner) => sum + winner.amount,
        0,
      );
    }
  } else if (settledRunCount > 0) {
    settledAmount = totalPot;
  }

  return totalPot - settledAmount;
}

export function deriveTableScene({
  gameState,
  timingFlags = {},
  sessionContext = {},
  clientUiState = {},
} = {}) {
  const {
    code = "",
    myUserId = null,
    connectionStatus = "connecting",
    tableNotFound = false,
    isFirstStateReceived = false,
    isCreator = false,
  } = sessionContext;
  const {
    viewingSeat = -1,
    revealedHoleCards = {},
    myHoleCards = null,
    myRevealedCardIndices = new Set(),
    currentRun = 0,
    revealedCount = 0,
    settledRunCount = 0,
    publicShowdownRevealComplete = false,
    leaveQueued = false,
  } = clientUiState;
  const {
    votingStartedAt = null,
    streetSweeping = false,
    runAnnouncement = null,
    isRunItBoard = false,
    knownCardCountAtRunIt = 0,
    runDealStartedAt = null,
    showdownStartedAt = null,
    sevenTwoAnnouncement = null,
    bombPotAnnouncement = null,
    actionError = null,
  } = timingFlags;

  const phase = gameState.phase;
  const winners = gameState.winners ?? null;
  const runResults = gameState.runResults ?? [];
  const runCount = gameState.runCount ?? 1;
  const isBombPotHand = gameState.isBombPot ?? false;
  const communityCards = gameState.communityCards ?? [];
  const communityCards2 = gameState.communityCards2 ?? [];
  const animatedRunItShowdown = isAnimatedRunItShowdown({
    phase,
    isRunItBoard,
    isBombPotHand,
    runResults,
  });
  const animatedShowdownReveal = isAnimatedShowdownReveal({
    phase,
    knownCardCount: knownCardCountAtRunIt,
    runResults,
    runAnnouncement,
    runDealStartedAt,
    showdownStartedAt,
  });
  const players = buildScenePlayers({
    gameState,
    sessionContext,
    clientUiState,
    timingFlags,
  });

  const viewingPlayer = players.find((player) => player?.isYou) ?? null;
  const viewerIsSeated = viewingPlayer !== null;
  const viewerIsFolded = viewingPlayer?.isFolded ?? true;
  const actionableActor = getActionableActor(gameState);
  const isYourTurn = viewingPlayer ? actionableActor?.id === viewingPlayer.id : false;
  const currentActorName = actionableActor?.name ?? (
    gameState.needsToAct?.[0] ? gameState.players?.[gameState.needsToAct[0]]?.name : undefined
  );

  const callAmount = actionableActor
    ? Math.min(gameState.roundBet - actionableActor.currentBet, actionableActor.stack)
    : 0;
  const minRaise = gameState.isBlindIncomplete
    ? gameState.blinds.big
    : gameState.roundBet + Math.max(gameState.lastLegalRaiseIncrement, gameState.blinds.big);
  const canCheck = actionableActor ? actionableActor.currentBet === gameState.roundBet : false;
  const canRaise = actionableActor ? !gameState.closedActors.includes(actionableActor.id) : false;
  const canAllIn = !!actionableActor && actionableActor.stack > 0 && !actionableActor.isAllIn;
  const isFirstBet = gameState.roundBet === 0 && gameState.phase !== "pre-flop";

  const canShowCards =
    viewingPlayer !== null &&
    myHoleCards !== null &&
    myRevealedCardIndices.size < 2 &&
    canPlayerTableOwnHand({ gameState, playerId: viewingPlayer.id });
  const isSoleUncontestedWinner =
    gameState.showdownKind === "uncontested" &&
    !gameState.autoRevealWinningHands &&
    winners?.length === 1 &&
    winners[0].playerId === viewingPlayer?.id;
  const sevenTwoEligible =
    gameState.sevenTwoBountyBB > 0 &&
    phase === "showdown" &&
    isSoleUncontestedWinner &&
    canShowCards &&
    myHoleCards !== null &&
    ((myHoleCards[0].rank === "7" && myHoleCards[1].rank === "2") ||
      (myHoleCards[0].rank === "2" && myHoleCards[1].rank === "7")) &&
    myHoleCards[0].suit !== myHoleCards[1].suit;

  const displayPlayers = buildDisplayPlayers({
    phase,
    players,
    winners,
    runResults,
    runCount,
    communityCards,
    revealedHoleCards,
    animatedShowdownReveal,
    animatedRunItShowdown,
    currentRun,
    revealedCount,
    settledRunCount,
    sevenTwoEligible,
  });
  const displayViewingPlayer = displayPlayers.find((player) => player?.isYou) ?? null;
  const displayPot = buildDisplayPot({
    phase,
    pot: gameState.pot + Object.values(gameState.players ?? {}).reduce(
      (sum, player) => sum + (player?.currentBet ?? 0),
      0,
    ),
    winners,
    runResults,
    animatedShowdownReveal,
    settledRunCount,
  });
  const showWinnerBanner = phase === "showdown" &&
    (winners?.length ?? 0) > 0 &&
    (!animatedShowdownReveal || (settledRunCount >= runCount && publicShowdownRevealComplete));

  const handIndicators = phase === "showdown"
    ? buildViewerHandIndicators({
        holeCards: myHoleCards,
        communityCards,
        communityCards2,
        runResults,
        animatedRunItShowdown,
        currentRun,
        revealedCount,
        knownCardCount: knownCardCountAtRunIt,
        isBombPotHand,
      })
    : (() => {
        const liveLabel = myHoleCards && myHoleCards.length === 2 && communityCards.length >= 3
          ? evaluateBest([...myHoleCards, ...communityCards]).label
          : null;
        return liveLabel ? [{ id: "single", title: "Hand", label: liveLabel }] : [];
      })();

  const seatSelectionLocked = viewerIsSeated && !!phase && phase !== "waiting";
  const showBlockingConnectionOverlay = !isFirstStateReceived;
  const blockingConnectionTitle =
    connectionStatus === "disconnected" ? "Reconnecting table" : "Loading table";
  const blockingConnectionMessage =
    connectionStatus === "disconnected"
      ? "Your connection dropped before the table finished syncing. Restoring the latest hand now."
      : `Joining ${code.toUpperCase()} and syncing the current table state...`;
  const cardPeelPersistenceKey =
    myUserId && myHoleCards ? `${code.toUpperCase()}:${myUserId}:hand:${gameState.handNumber}` : null;

  return {
    code,
    tableNotFound,
    showReconnectIndicator: connectionStatus === "disconnected" && isFirstStateReceived,
    showBlockingConnectionOverlay,
    blockingConnectionTitle,
    blockingConnectionMessage,
    viewingPlayer: displayViewingPlayer,
    layout: {
      seatSelectionLocked,
      players: displayPlayers,
      dealerIndex: gameState.dealerSeatIndex,
      tableName: gameState.tableName,
      blinds: gameState.blinds,
      pot: displayPot,
      smallBlindIndex: gameState.smallBlindSeatIndex,
      bigBlindIndex: gameState.bigBlindSeatIndex,
      communityCards,
      holeCards: myHoleCards,
      handIndicators,
      phase,
      winners,
      callAmount,
      minRaise,
      canCheck,
      canRaise,
      canAllIn,
      isYourTurn,
      currentActorName,
      isFirstBet,
      handNumber: gameState.handNumber,
      viewerStack: displayViewingPlayer?.stack ?? 0,
      viewerCurrentBet: displayViewingPlayer?.currentBet ?? 0,
      isAdmin: isCreator,
      streetSweeping,
      runItVotes: gameState.runItVotes ?? {},
      runResults,
      runCount,
      runAnnouncement,
      votingStartedAt,
      viewerCanVote: !viewerIsFolded,
      isRunItBoard,
      animatedShowdownReveal,
      publicShowdownRevealComplete,
      showWinnerBanner,
      knownCardCount: knownCardCountAtRunIt,
      runDealStartedAt,
      showdownStartedAt,
      sevenTwoBountyBB: gameState.sevenTwoBountyBB,
      sevenTwoAnnouncement,
      sevenTwoBountyTrigger: gameState.sevenTwoBountyTrigger,
      canShowCards,
      myRevealedCardIndices,
      sevenTwoEligible,
      bombPotVote: gameState.bombPotVote,
      bombPotNextHand: gameState.bombPotNextHand,
      isBombPotHand,
      communityCards2,
      bombPotCooldown: gameState.bombPotCooldown ?? [],
      bombPotAnnouncement,
      actionError,
      leaveQueued,
      cardPeelPersistenceKey,
    },
  };
}

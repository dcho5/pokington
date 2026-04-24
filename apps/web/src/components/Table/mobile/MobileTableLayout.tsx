"use client";
import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BOMB_POT_VOTING_TIMEOUT_MS,
  RUN_IT_VOTING_TIMEOUT_MS,
} from "@pokington/engine";
import TableHeader from "./TableHeader";
import OpponentStrip from "./OpponentStrip";
import CommunityCards from "./CommunityCards";
import HandPanel from "./HandPanel";
import ActionBar from "./ActionBar";
import SitDownForm from "../SitDownForm";
import SeatManager from "../SeatManager";
import BombPotVotingPanel from "../BombPotVotingPanel";
import VotingPanel from "../VotingPanel";
import BombPotSheet from "./BombPotSheet";
import LedgerSheet from "./LedgerSheet";
import PokerChip from "components/poker/PokerChip";
import { formatCents } from "lib/formatCents";
import {
  isAnimatedRunItShowdown,
  shouldRenderRunItBoard,
} from "lib/tableVisualState";
import { deriveVisibleRunState } from "lib/runAnimation";
import { shouldRevealRunsConcurrently } from "lib/showdownTiming";
import { MobileWinnerChips } from "./MobileWinnerChips";
import { MobileSevenTwoBountyChips } from "./MobileSevenTwoBountyChips";
import AnnouncementBanner from "../AnnouncementBanner";
import SevenTwoAnnouncement from "../SevenTwoAnnouncement";
import WinnerBanner from "../WinnerBanner";
import type { TableLayoutProps } from "../TableLayout";
import type { Player } from "types/player";
import type { Card as PlayingCard } from "@pokington/shared";
import { computeMobileChipAngle } from "lib/chipOrientation";
import { useTimedPanelVisibility } from "hooks/useTimedPanelVisibility";
import { useRunItOddsPanelModel } from "hooks/useRunItOddsPanelModel";
import {
  buildShowdownSpotlight,
  isFullyTabled,
  mergeEmphasisArrays,
  resolveSpotlightPlayer,
} from "lib/showdownSpotlight";
import type { ResolvedSpotlightPlayer, ShowdownSpotlightModel } from "lib/showdownSpotlight";
import {
  getMinPlayerStack,
  getRunAnnouncementContent,
  getViewerPlayer,
  getWaitingForName,
  isCanceledBombPotAnnouncement,
} from "../tableLayoutUtils";
import {
  MOBILE_OVERLAY_Z,
  MOBILE_SHELL,
  getMobileHeaderHeight,
  getMobileSafeAreaBottom,
  getMobileSheetPaddingBottom,
  getMobileWinnerBannerBottom,
} from "lib/mobileShell.mjs";
import MobileBottomSheet from "./MobileBottomSheet";

type MobileTableLayoutProps = TableLayoutProps & {
  totalSeats?: number;
  showSeatManager?: boolean;
  onDismissSeatManager?: () => void;
};
type CardEmphasis = "neutral" | "highlighted" | "dimmed";

function getSelectedTabledPlayer(
  players: Array<Player | null>,
  selectedPlayerId: string | null,
): ResolvedSpotlightPlayer | null {
  if (!selectedPlayerId) return null;
  const selectedPlayer = players.find((player) => player?.id === selectedPlayerId);
  const holeCards = selectedPlayer?.holeCards;
  if (!selectedPlayer || !holeCards || !isFullyTabled(holeCards)) return null;
  const tabledHoleCards = holeCards as [PlayingCard, PlayingCard];
  return {
    source: "selected",
    playerId: selectedPlayer.id ?? null,
    playerName: selectedPlayer.name,
    holeCards: tabledHoleCards,
  };
}

function holeCardEmphasisFromSpotlight(spotlight: ShowdownSpotlightModel | null): CardEmphasis[] {
  return spotlight?.holeCards.map((entry) => entry.emphasis) ?? ["neutral", "neutral"];
}

function boardCardEmphasisFromSpotlight(spotlight: ShowdownSpotlightModel | null): CardEmphasis[] | null {
  return spotlight?.boardCards.map((entry) => entry.emphasis) ?? null;
}

function spotlightHasActiveEmphasis(spotlight: ShowdownSpotlightModel | null) {
  if (!spotlight) return false;
  return [...spotlight.holeCards, ...spotlight.boardCards].some((entry) => entry.emphasis !== "neutral");
}

const MobileTableLayout: React.FC<MobileTableLayoutProps> = ({
  scene,
  actions,
  totalSeats = 10,
  showSeatManager = false,
  onDismissSeatManager,
}) => {
  const {
    seatSelectionLocked = false,
    openSeatMode = "sit-down",
    players = [],
    dealerIndex = 0,
    tableName = "Table",
    blinds = { small: 1, big: 2 },
    pot = 0,
    committedPot = 0,
    currentStreetBets = 0,
    smallBlindIndex,
    bigBlindIndex,
    communityCards,
    holeCards,
    handIndicators = [],
    phase,
    winners,
    callAmount = 0,
    minRaise = 0,
    canCheck = false,
    canRaise = true,
    canAllIn = false,
    isYourTurn: isYourTurnProp,
    currentActorName,
    isFirstBet = false,
    handNumber = 0,
    showdownCountdown = null,
    isAdmin = false,
    runItVotes = {},
    runAnnouncement = null,
    votingStartedAt = null,
    bombPotVotingStartedAt = null,
    viewerCanVote = false,
    showNextHand = true,
    isRunItBoard = false,
    animatedShowdownReveal = false,
    publicShowdownRevealComplete = false,
    showWinnerBanner = false,
    runResults = [],
    knownCardCount = 0,
    runDealStartedAt = null,
    runCount = 1,
    sevenTwoBountyBB = 0,
    sevenTwoAnnouncement = null,
    sevenTwoBountyTrigger = null,
    canShowCards = false,
    myRevealedCardIndices,
    sevenTwoEligible = false,
    bombPotVote = null,
    bombPotNextHand: _bombPotNextHand = null,
    isBombPotHand = false,
    communityCards2,
    bombPotCooldown = [],
    bombPotAnnouncement = null,
    actionError = null,
    mustQueueLeave,
    leaveQueued,
    cardPeelPersistenceKey,
  } = scene;
  const {
    onSitDown,
    onChangeSeat,
    onFold,
    onCheck,
    onCall,
    onRaise,
    onStartHand,
    onAllIn,
    onOpenSeatManager,
    onVoteRun,
    onRevealCard,
    onProposeBombPot,
    onPeekCard,
    onVoteBombPot,
    onStandUp,
    onQueueLeave,
    onCancelQueuedLeave,
  } = actions;
  const [selectedEmptySeat, setSelectedEmptySeat] = useState<number | null>(null);
  const [bombPotSheetOpen, setBombPotSheetOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [previewedOpponentSeatIndex, setPreviewedOpponentSeatIndex] = useState<number | null>(null);
  const [selectedSpotlightPlayerId, setSelectedSpotlightPlayerId] = useState<string | null>(null);
  const [viewingBombPotBoardIndex, setViewingBombPotBoardIndex] = useState(0);
  const [selectedBombPotBoardIndex, setSelectedBombPotBoardIndex] = useState<number | null>(null);
  const [viewingRunIndex, setViewingRunIndex] = useState(0);
  const [selectedRunIndex, setSelectedRunIndex] = useState<number | null>(null);
  const runItOddsPanel = useRunItOddsPanelModel(scene);
  const previewHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPreviewHoldTimer() {
    if (previewHoldTimerRef.current) {
      clearTimeout(previewHoldTimerRef.current);
      previewHoldTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (selectedEmptySeat === null) {
      window.scrollTo(0, 0);
    }
  }, [selectedEmptySeat]);

  useEffect(() => {
    if (openSeatMode !== "sit-down" && selectedEmptySeat !== null) {
      setSelectedEmptySeat(null);
    }
  }, [openSeatMode, selectedEmptySeat]);

  useEffect(() => {
    setSelectedSpotlightPlayerId(null);
    setPreviewedOpponentSeatIndex(null);
    setViewingBombPotBoardIndex(0);
    setSelectedBombPotBoardIndex(null);
    setViewingRunIndex(0);
    setSelectedRunIndex(null);
  }, [handNumber]);

  useEffect(() => {
    if (previewedOpponentSeatIndex == null) return;
    if (!players[previewedOpponentSeatIndex]) {
      setPreviewedOpponentSeatIndex(null);
      setSelectedSpotlightPlayerId(null);
    }
  }, [players, previewedOpponentSeatIndex]);

  useEffect(() => () => {
    clearPreviewHoldTimer();
  }, []);

  useEffect(() => {
    if (!selectedSpotlightPlayerId) return;
    const selectedPlayer = players.find((player) => player?.id === selectedSpotlightPlayerId);
    if (!selectedPlayer || !isFullyTabled(selectedPlayer.holeCards)) {
      setSelectedSpotlightPlayerId(null);
    }
  }, [players, selectedSpotlightPlayerId]);

  const youPlayer = getViewerPlayer(players);
  const handleOpenSeat = (seatIndex: number) => {
    clearPreviewHoldTimer();
    setPreviewedOpponentSeatIndex(null);
    setSelectedSpotlightPlayerId(null);
    if (openSeatMode === "blocked") return;
    if (openSeatMode === "change-seat") {
      onChangeSeat?.(seatIndex);
      return;
    }
    setSelectedEmptySeat(seatIndex);
  };
  const handleOpponentPressStart = (seatIndex: number) => {
    clearPreviewHoldTimer();
    previewHoldTimerRef.current = setTimeout(() => {
      const player = players[seatIndex];
      setPreviewedOpponentSeatIndex(seatIndex);
      if (player?.id && isFullyTabled(player.holeCards)) {
        setSelectedSpotlightPlayerId(player.id);
      } else {
        setSelectedSpotlightPlayerId(null);
      }
    }, 170);
  };
  const handleOpponentPressEnd = (seatIndex: number) => {
    clearPreviewHoldTimer();
    setPreviewedOpponentSeatIndex((current) => current === seatIndex ? null : current);
    setSelectedSpotlightPlayerId((current) => {
      const player = players[seatIndex];
      return current != null && current === player?.id ? null : current;
    });
  };
  const showRunItVotingPanel = useTimedPanelVisibility({
    visible: phase === "voting",
    startedAt: votingStartedAt,
    durationMs: RUN_IT_VOTING_TIMEOUT_MS,
  });
  const showBombPotVotingPanel = useTimedPanelVisibility({
    visible: bombPotVote != null,
    startedAt: bombPotVotingStartedAt,
    durationMs: BOMB_POT_VOTING_TIMEOUT_MS,
  });
  const isRunItDealing = shouldRenderRunItBoard({
    phase,
    isRunItBoard,
    isBombPotHand,
    runDealStartedAt,
    runAnnouncement,
  });
  const animatedRunIt = isAnimatedRunItShowdown({
    phase,
    isRunItBoard,
    isBombPotHand,
    runResults,
  });
  const revealRunsConcurrently = shouldRevealRunsConcurrently(isBombPotHand, runResults.length);
  const runAnimationState = deriveVisibleRunState(
    runResults,
    knownCardCount,
    Math.max(runCount, runResults.length, 1),
  );

  const seatedPlayerCount = players.filter((player) => player != null).length;

  const isYourTurn = isYourTurnProp ?? (youPlayer?.isCurrentActor ?? false);
  const viewerSeatIndex = players.findIndex((player) => player?.isYou);
  const activeSeatIndex = players.findIndex((player) => player?.isCurrentActor);
  const waitingFor = getWaitingForName(players, currentActorName);
  const bombPotAnnouncementIsCanceled = isCanceledBombPotAnnouncement(bombPotAnnouncement);
  const mobileBannerHaloClass =
    "pointer-events-none absolute inset-2 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.56),rgba(15,23,42,0.22)_60%,transparent_88%)] blur-2xl";

  const chipGlowAngle = computeMobileChipAngle(
    {
      actorSeatIndex: activeSeatIndex >= 0 ? activeSeatIndex : null,
      viewerSeatIndex: viewerSeatIndex >= 0 ? viewerSeatIndex : null,
      totalSeats,
    }
  );
  useEffect(() => {
    if (!animatedRunIt || selectedRunIndex != null) return;
    setViewingRunIndex(runAnimationState.currentRun);
  }, [animatedRunIt, runAnimationState.currentRun, selectedRunIndex]);

  const canInteractWithSpotlight = phase != null && phase !== "waiting" && phase !== "voting";
  const selectedSpotlightPlayer = canInteractWithSpotlight
    ? getSelectedTabledPlayer(players, selectedSpotlightPlayerId)
    : null;
  const defaultSpotlightPlayer = canInteractWithSpotlight
    ? resolveSpotlightPlayer({
        players,
        viewerHoleCards: holeCards,
      })
    : null;
  const bombPotBoards = [communityCards ?? [], communityCards2 ?? []];
  const bombPotSpotlights = bombPotBoards.map((boardCards, index) => {
    if (!isBombPotHand) return null;
    if (selectedSpotlightPlayer) {
      return buildShowdownSpotlight({
        playerId: selectedSpotlightPlayer.playerId,
        playerName: selectedSpotlightPlayer.playerName,
        holeCards: selectedSpotlightPlayer.holeCards,
        boardCards,
        contextLabel: `Board ${index + 1}`,
      });
    }
    if (selectedBombPotBoardIndex !== index || !defaultSpotlightPlayer) return null;
    return buildShowdownSpotlight({
      playerId: defaultSpotlightPlayer.playerId,
      playerName: defaultSpotlightPlayer.playerName,
      holeCards: defaultSpotlightPlayer.holeCards,
      boardCards,
      contextLabel: `Board ${index + 1}`,
    });
  });
  const runSpotlights = runResults.map((run, index) => {
    if (!animatedRunIt) return null;
    if (selectedSpotlightPlayer) {
      return buildShowdownSpotlight({
        playerId: selectedSpotlightPlayer.playerId,
        playerName: selectedSpotlightPlayer.playerName,
        holeCards: selectedSpotlightPlayer.holeCards,
        boardCards: run.board ?? [],
        contextLabel: `Run ${index + 1}`,
      });
    }
    const defaultRunIndex = !publicShowdownRevealComplete ? runAnimationState.currentRun : null;
    const focusedRunIndex = selectedRunIndex ?? defaultRunIndex;
    if (focusedRunIndex !== index || !defaultSpotlightPlayer) return null;
    return buildShowdownSpotlight({
      playerId: defaultSpotlightPlayer.playerId,
      playerName: defaultSpotlightPlayer.playerName,
      holeCards: defaultSpotlightPlayer.holeCards,
      boardCards: run.board ?? [],
      contextLabel: `Run ${index + 1}`,
    });
  });
  const singleBoardPlayer = selectedSpotlightPlayer ?? defaultSpotlightPlayer;
  const singleBoardSpotlight = !isBombPotHand && !animatedRunIt && singleBoardPlayer
    ? buildShowdownSpotlight({
        playerId: singleBoardPlayer.playerId,
        playerName: singleBoardPlayer.playerName,
        holeCards: singleBoardPlayer.holeCards,
        boardCards: communityCards,
        contextLabel: null,
      })
    : null;
  const activeSpotlightPlayer = (() => {
    if (selectedSpotlightPlayer) {
      const hasSelectedEmphasis = isBombPotHand
        ? bombPotSpotlights.some(spotlightHasActiveEmphasis)
        : animatedRunIt
          ? runSpotlights.some(spotlightHasActiveEmphasis)
          : spotlightHasActiveEmphasis(singleBoardSpotlight);
      return hasSelectedEmphasis ? selectedSpotlightPlayer : null;
    }
    if (isBombPotHand) {
      return bombPotSpotlights.some(spotlightHasActiveEmphasis) ? defaultSpotlightPlayer : null;
    }
    if (animatedRunIt) {
      return runSpotlights.some(spotlightHasActiveEmphasis) ? defaultSpotlightPlayer : null;
    }
    return spotlightHasActiveEmphasis(singleBoardSpotlight) ? defaultSpotlightPlayer : null;
  })();
  const spotlightHoleCardEmphasis = isBombPotHand
    ? mergeEmphasisArrays(bombPotSpotlights.map(holeCardEmphasisFromSpotlight), 2)
    : animatedRunIt
      ? mergeEmphasisArrays(runSpotlights.map(holeCardEmphasisFromSpotlight), 2)
      : holeCardEmphasisFromSpotlight(singleBoardSpotlight);
  const spotlightBoardCardEmphasis = boardCardEmphasisFromSpotlight(singleBoardSpotlight);
  const spotlightBombPotCardEmphasis: [
    CardEmphasis[] | null,
    CardEmphasis[] | null,
  ] = [
    boardCardEmphasisFromSpotlight(bombPotSpotlights[0]),
    boardCardEmphasisFromSpotlight(bombPotSpotlights[1]),
  ];
  const spotlightRunCardEmphasisByRun = runSpotlights.map(boardCardEmphasisFromSpotlight);
  const spotlightPlayerId = activeSpotlightPlayer?.playerId ?? null;
  const isViewerSpotlight = spotlightPlayerId != null && spotlightPlayerId === youPlayer?.id;
  const runItOddsPercentagesByPlayerId = Object.fromEntries(
    runItOddsPanel.rows
      .filter((row) => row.currentPercentage != null)
      .map((row) => [row.playerId, row.currentPercentage]),
  ) as Record<string, number | null>;
  const activeHandIndicatorId = animatedRunIt && runResults.length > 0
    ? `run-${viewingRunIndex}`
    : isBombPotHand
      ? `board-${viewingBombPotBoardIndex}`
      : handIndicators[0]?.id ?? null;
  const footerStatus = phase === "showdown" && showNextHand
    ? (showdownCountdown != null ? `Next hand in ${showdownCountdown}s...` : "Hand complete")
    : (!isYourTurn && waitingFor && phase !== "waiting" && phase !== "showdown"
        ? `Waiting for ${waitingFor}...`
        : null);
  const footerStatusTone = phase === "showdown" ? "amber" : "neutral";

  return (
    <div
      className="absolute inset-0 overflow-hidden overscroll-none bg-gray-100 dark:bg-gray-950 transition-colors duration-500"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[40%] bg-red-500/5 dark:bg-red-600/10 blur-[80px] rounded-full" style={{ willChange: "auto" }} />
        {isYourTurnProp && (
          <>
            <div
              className="animate-turn-perimeter-wash-layer absolute inset-0"
              style={{
                background: [
                  "linear-gradient(180deg, rgba(239, 68, 68, 0.32), transparent 16%)",
                  "linear-gradient(0deg, rgba(239, 68, 68, 0.24), transparent 18%)",
                  "linear-gradient(90deg, rgba(239, 68, 68, 0.16), transparent 12%)",
                  "linear-gradient(270deg, rgba(239, 68, 68, 0.16), transparent 12%)",
                ].join(","),
              }}
            />
            <div
              className="animate-turn-perimeter-glow-layer absolute inset-[10px] rounded-[28px]"
              style={{
                background: [
                  "radial-gradient(circle at 50% 0%, rgba(248, 113, 113, 0.32), transparent 52%)",
                  "radial-gradient(circle at 50% 100%, rgba(239, 68, 68, 0.22), transparent 56%)",
                  "radial-gradient(circle at 0% 50%, rgba(239, 68, 68, 0.18), transparent 40%)",
                  "radial-gradient(circle at 100% 50%, rgba(239, 68, 68, 0.18), transparent 40%)",
                ].join(","),
              }}
            />
          </>
        )}
      </div>

      {phase === "showdown" && winners && winners.length > 0 && (
        <MobileWinnerChips
          key={`${handNumber}-mobile-chips`}
          winners={winners}
          runResults={animatedShowdownReveal ? runResults : undefined}
          knownCardCount={animatedShowdownReveal ? knownCardCount : undefined}
          revealRunsConcurrently={revealRunsConcurrently}
          players={players.map((p, i) => p ? { id: p.id, seatIndex: i, isYou: p.isYou } : null)}
          handNumber={handNumber}
        />
      )}

      {sevenTwoBountyTrigger && (
        <MobileSevenTwoBountyChips
          winnerId={sevenTwoBountyTrigger.winnerId}
          perPlayer={sevenTwoBountyTrigger.perPlayer}
          players={players.map((p, i) => p ? { id: p.id, seatIndex: i, isYou: p.isYou } : null)}
          handNumber={handNumber}
        />
      )}

      <TableHeader
        tableName={tableName}
        smallBlind={blinds.small}
        bigBlind={blinds.big}
        sevenTwoBountyBB={sevenTwoBountyBB}
        showLeaveButton={Boolean(onStandUp && youPlayer)}
        leaveQueued={leaveQueued}
        mustQueueLeave={mustQueueLeave}
        onLeavePress={() => {
          if (!leaveQueued) {
            setLeaveConfirm(true);
          }
        }}
        onCancelLeavePress={() => {
          onCancelQueuedLeave?.();
        }}
      />

      <div
        className="absolute inset-0 flex flex-col min-h-0"
        style={{
          paddingTop: getMobileHeaderHeight(),
          paddingBottom: getMobileSafeAreaBottom(),
        }}
      >
        <div className="flex-shrink-0 pt-5">
          <OpponentStrip
            players={players}
            playerCount={seatedPlayerCount}
            dealerIndex={dealerIndex}
            smallBlindIndex={smallBlindIndex}
            bigBlindIndex={bigBlindIndex}
            seatSelectionLocked={seatSelectionLocked}
            selectedDetailSeatIndex={previewedOpponentSeatIndex}
            onPlayerPressStart={handleOpponentPressStart}
            onPlayerPressEnd={handleOpponentPressEnd}
            previewedSeatIndex={previewedOpponentSeatIndex}
            selectedSpotlightPlayerId={spotlightPlayerId}
            spotlightHoleCardEmphasisByIndex={spotlightHoleCardEmphasis}
            runItOddsPercentagesByPlayerId={runItOddsPercentagesByPlayerId}
            onEmptySeatTap={handleOpenSeat}
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col items-center justify-start gap-0.5 pt-2">
          <CommunityCards
            phase={phase}
            communityCards={communityCards}
            communityCards2={communityCards2}
            isBombPot={isBombPotHand}
            isRunItBoard={isRunItBoard}
            runResults={runResults}
            knownCardCount={knownCardCount}
            runDealStartedAt={runDealStartedAt}
            runAnnouncement={runAnnouncement}
            handNumber={handNumber}
            activeBombPotBoardIndex={viewingBombPotBoardIndex}
            onActiveBoardChange={(boardIndex) => {
              setViewingBombPotBoardIndex(boardIndex);
              setSelectedBombPotBoardIndex((current) => current === boardIndex ? null : boardIndex);
            }}
            viewingRunIndex={viewingRunIndex}
            onViewingRunChange={(runIndex) => {
              setViewingRunIndex(runIndex);
              setSelectedRunIndex((current) => current === runIndex ? null : runIndex);
            }}
            cardEmphasis={!isBombPotHand && !animatedRunIt ? spotlightBoardCardEmphasis : null}
            bombPotCardEmphasis={spotlightBombPotCardEmphasis}
            highlightedRunIndex={null}
            runCardEmphasisByRun={animatedRunIt ? spotlightRunCardEmphasisByRun : null}
          />

        </div>

        {pot > 0 && (
          <div className="flex-shrink-0 flex justify-center py-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-1 rounded-xl bg-gradient-to-r from-red-500 to-red-700 px-3 py-1.5 shadow-lg"
            >
              {currentStreetBets > 0 ? (
                <>
                  <div className="font-mono text-sm font-black text-white">
                    {formatCents(committedPot)}
                  </div>
                  <div className="border-t border-white/15 pt-1 text-[8px] font-semibold uppercase tracking-[0.24em] text-red-100/80">
                    Total {formatCents(pot)}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[8px] font-black text-red-200 uppercase tracking-widest">Pot</span>
                  <span className="text-white font-mono font-black text-xs">{formatCents(pot)}</span>
                </>
              )}
            </motion.div>
          </div>
        )}

        <div className="flex-shrink-0">
          <div className="flex min-h-[44px] items-center justify-center pb-1">
            <AnimatePresence>
              {!isRunItDealing && (
                <motion.div
                  className="flex items-center justify-center gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="w-10 flex justify-end">
                    <AnimatePresence>
                      {!bombPotVote && !_bombPotNextHand && youPlayer?.id && !bombPotCooldown.includes(youPlayer.id) && (
                        <motion.button
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 24 }}
                          whileTap={{ scale: 0.88 }}
                          onClick={() => setBombPotSheetOpen(true)}
                          className="flex items-center justify-center rounded-[1rem] text-lg shadow-xl"
                          style={{
                            width: MOBILE_SHELL.floatingUtilityButtonSizePx,
                            height: MOBILE_SHELL.floatingUtilityButtonSizePx,
                            background: "rgba(99,102,241,0.22)",
                            border: "1px solid rgba(99,102,241,0.4)",
                            backdropFilter: "blur(8px)",
                          }}
                        >
                          💣
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <PokerChip size={38} glowAngle={chipGlowAngle} />

                  <div className="w-10 flex justify-start">
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setLedgerOpen(true)}
                      className="flex items-center justify-center rounded-[1rem] text-sm shadow-xl"
                      style={{
                        width: MOBILE_SHELL.floatingUtilityButtonSizePx,
                        height: MOBILE_SHELL.floatingUtilityButtonSizePx,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      💰
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <HandPanel
            player={youPlayer}
            holeCards={holeCards}
            handIndicators={handIndicators}
            activeHandIndicatorId={activeHandIndicatorId}
            handNumber={handNumber}
            canRevealToOthers={canShowCards}
            revealedToOthersIndices={myRevealedCardIndices}
            onRevealToOthers={onRevealCard}
            sevenTwoEligible={sevenTwoEligible}
            onPeekCard={onPeekCard}
            currentBet={youPlayer?.currentBet ?? 0}
            cardPeelPersistenceKey={cardPeelPersistenceKey}
            holeCardEmphasisByIndex={isViewerSpotlight ? spotlightHoleCardEmphasis : undefined}
            runItOddsPercentage={youPlayer?.id ? (runItOddsPercentagesByPlayerId[youPlayer.id] ?? null) : null}
            onOpenSeatManager={onOpenSeatManager}
          />
        </div>

        {phase !== "voting" && (
          <div
            className={`relative flex-shrink-0 border-t border-gray-200/50 bg-white/95 backdrop-blur-md dark:border-white/[0.06] dark:bg-[rgba(3,7,18,0.96)] ${
              isYourTurn
                ? "shadow-[0_-20px_38px_rgba(239,68,68,0.12)]"
                : "shadow-[0_-14px_30px_rgba(15,23,42,0.08)]"
            }`}
          >
            <AnimatePresence>
              {footerStatus && (
                <motion.div
                  className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4"
                  style={{ top: -MOBILE_SHELL.footerStatusLiftPx }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                >
                  <div
                    className={`max-w-full truncate rounded-full border px-3 py-1 text-[11px] font-semibold shadow-lg backdrop-blur-md ${
                      footerStatusTone === "amber"
                        ? "border-amber-300/70 bg-amber-50/96 text-amber-700 dark:border-amber-400/30 dark:bg-[rgba(69,26,3,0.92)] dark:text-amber-200"
                        : "border-gray-200/80 bg-white/96 text-gray-500 dark:border-white/[0.08] dark:bg-[rgba(3,7,18,0.94)] dark:text-gray-300"
                    }`}
                  >
                    {footerStatusTone === "amber" ? (
                      <span className="font-black">{footerStatus}</span>
                    ) : (
                      <>
                        Waiting for <span className="font-black text-gray-700 dark:text-white">{waitingFor}</span>
                        ...
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <ActionBar
              isYourTurn={isYourTurn}
              callAmount={callAmount}
              pot={pot}
              stack={youPlayer?.stack ?? 0}
              currentBet={youPlayer?.currentBet ?? 0}
              minRaise={minRaise}
              bigBlind={blinds?.big ?? 25}
              canCheck={canCheck}
              canRaise={canRaise}
              canAllIn={canAllIn}
              onAllIn={onAllIn}
              phase={phase}
              isFirstBet={isFirstBet}
              isAdmin={isAdmin}
              onFold={onFold}
              onCall={onCall}
              onCheck={onCheck}
              onRaise={onRaise}
              onStartHand={onStartHand}
              showdownCountdown={showdownCountdown}
              showNextHand={showNextHand}
              players={players}
              handNumber={handNumber}
              isBombPotHand={isBombPotHand}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showRunItVotingPanel && (
          <motion.div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              zIndex: MOBILE_OVERLAY_Z.runItVote,
              paddingBottom: `max(env(safe-area-inset-bottom), ${MOBILE_SHELL.defaultSheetInsetBottomPx - 4}px)`,
            }}
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <div className="pointer-events-auto mx-auto w-full max-w-lg px-3">
              <VotingPanel
                votes={runItVotes}
                players={players}
                viewingPlayerId={youPlayer?.id}
                onVote={onVoteRun}
                votingStartedAt={votingStartedAt}
                canVote={viewerCanVote}
                variant="mobile"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {leaveConfirm && youPlayer && onStandUp && (
          <MobileBottomSheet
            onDismiss={() => setLeaveConfirm(false)}
            className="elevated-surface-light border-t px-4 pt-4"
            sheetZIndex={MOBILE_OVERLAY_Z.prioritySheet}
            scrimZIndex={MOBILE_OVERLAY_Z.prioritySheetScrim}
            bottomPaddingExtraPx={MOBILE_SHELL.raisedSheetInsetBottomPx}
            draggable={false}
          >
            <div className="surface-content">
              <p className="text-sm font-black text-gray-900 dark:text-white text-center mb-1">
                {mustQueueLeave ? "Leave next hand?" : "Leave seat?"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                {mustQueueLeave
                  ? "You'll leave after this hand finishes. Your chips will be cashed out."
                  : "Your chips will be cashed out."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setLeaveConfirm(false)}
                  className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold h-12 text-sm"
                >
                  Stay
                </button>
                <button
                  onClick={() => {
                    setLeaveConfirm(false);
                    if (mustQueueLeave) {
                      onQueueLeave?.();
                    } else {
                      onStandUp();
                    }
                  }}
                  className="flex-1 rounded-xl font-bold bg-red-500 text-white h-12 text-sm"
                >
                  {mustQueueLeave ? "Leave Next Hand" : "Leave"}
                </button>
              </div>
            </div>
          </MobileBottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sevenTwoAnnouncement && (
          <div
            className="absolute inset-0 flex items-start justify-center pt-[30%] pointer-events-none"
            style={{ zIndex: MOBILE_OVERLAY_Z.sevenTwoAnnouncement }}
          >
            <div className="relative isolate px-4">
              <div className={mobileBannerHaloClass} />
              <div className="relative z-10">
                <SevenTwoAnnouncement
                  winnerName={sevenTwoAnnouncement.winnerName}
                  perPlayer={sevenTwoAnnouncement.perPlayer}
                  total={sevenTwoAnnouncement.total}
                  variant="mobile"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {runAnnouncement != null && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: MOBILE_OVERLAY_Z.runAnnouncement }}
          >
            <div className="relative isolate px-4 w-full max-w-sm">
              <div className={mobileBannerHaloClass} />
              <div className="relative z-10">
                <AnnouncementBanner
                  {...getRunAnnouncementContent(runAnnouncement)}
                  variant="mobile"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBombPotVotingPanel && bombPotVote && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: MOBILE_OVERLAY_Z.bombPotVote }}
          >
            <div className="pointer-events-auto relative isolate px-4 w-full max-w-xs">
              <div className={mobileBannerHaloClass} />
              <div className="relative z-10">
                <BombPotVotingPanel
                  vote={bombPotVote}
                  votingStartedAt={bombPotVotingStartedAt}
                  players={players}
                  viewingPlayerId={youPlayer?.id}
                  bigBlind={blinds.big}
                  onApprove={() => onVoteBombPot?.(true)}
                  onReject={() => onVoteBombPot?.(false)}
                  variant="mobile"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionError && (
          <div
            className="absolute inset-0 flex items-center justify-center pt-[12%] pointer-events-none"
            style={{ zIndex: MOBILE_OVERLAY_Z.actionError }}
          >
            <div className="relative isolate px-4 w-full max-w-sm">
              <div className={mobileBannerHaloClass} />
              <div className="relative z-10">
                <AnnouncementBanner
                  eyebrow="Action Blocked"
                  title="That move didn't go through"
                  detail={actionError.message}
                  badge="Retry"
                  tone="amber"
                  variant="mobile"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bombPotAnnouncement && (
          <div
            className="absolute inset-0 flex items-center justify-center pt-[20%] pointer-events-none"
            style={{ zIndex: MOBILE_OVERLAY_Z.bombPotAnnouncement }}
          >
            <div className="relative isolate px-4 w-full max-w-sm">
              <div className={mobileBannerHaloClass} />
              <div className="relative z-10">
                <AnnouncementBanner
                  eyebrow={bombPotAnnouncementIsCanceled ? "Table Update" : "Special Hand"}
                  title={bombPotAnnouncement.title}
                  detail={bombPotAnnouncement.detail}
                  badge={bombPotAnnouncementIsCanceled ? "Canceled" : "Bomb Pot"}
                  tone={bombPotAnnouncementIsCanceled ? "amber" : "sky"}
                  variant="mobile"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ledgerOpen && <LedgerSheet onDismiss={() => setLedgerOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {bombPotSheetOpen && (
          <BombPotSheet
            bigBlind={blinds?.big ?? 25}
            minPlayerStack={getMinPlayerStack(players)}
            onConfirm={(anteBB) => { onProposeBombPot?.(anteBB); setBombPotSheetOpen(false); }}
            onDismiss={() => setBombPotSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSeatManager && youPlayer && (
          <SeatManager
            playerName={youPlayer.name}
            currentSeatIndex={youPlayer.seatIndex ?? 0}
            currentStackCents={youPlayer.stack ?? 0}
            bigBlindCents={blinds.big}
            applyImmediately={phase === "waiting" || phase === "showdown"}
            pendingUpdate={scene.viewerPendingBoundaryUpdate}
            onSubmit={(update) => {
              actions.onRequestBoundaryUpdate?.(update);
              onDismissSeatManager?.();
            }}
            onCancelPending={actions.onCancelBoundaryUpdate}
            onDismiss={onDismissSeatManager ?? (() => {})}
            variant="sheet"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "showdown" && !animatedRunIt && showWinnerBanner && winners && winners.length > 0 && (
          <motion.div
            className="absolute left-4 right-4 pointer-events-none"
            style={{ zIndex: MOBILE_OVERLAY_Z.winnerBanner, bottom: getMobileWinnerBannerBottom() }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
          >
            <div className="relative isolate">
              <div className={mobileBannerHaloClass} />
              <div className="relative z-10">
                <WinnerBanner winners={winners} players={players} variant="mobile" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEmptySeat !== null && (
          <SitDownForm
            seatIndex={selectedEmptySeat}
            bigBlindCents={blinds.big}
            onConfirm={(name, buyInCents) => {
              onSitDown(selectedEmptySeat, name, buyInCents);
              setSelectedEmptySeat(null);
            }}
            onDismiss={() => setSelectedEmptySeat(null)}
            variant="sheet"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileTableLayout;

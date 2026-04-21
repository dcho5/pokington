"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { type TableGeometry } from "lib/seatLayout";
import { useColorScheme } from "hooks/useColorScheme";
import PokerChip from "components/poker/PokerChip";
import Card from "components/poker/Card";
import HoleCards from "components/poker/HoleCards";
import { BetChipsLayer } from "./BetChips";
import { WinnerChipsAnimation } from "./WinnerChipsAnimation";
import DesktopBombPotMenu from "./DesktopBombPotMenu";
import DesktopHandIndicatorFan from "./DesktopHandIndicatorFan";
import DesktopLedgerMenu from "./DesktopLedgerMenu";
import DesktopRaisePopover from "./DesktopRaisePopover";
import RunItBoard from "../RunItBoard";

import AnnouncementBanner from "../AnnouncementBanner";
import WinnerBanner from "../WinnerBanner";
import VotingPanel from "../VotingPanel";
import SevenTwoAnnouncement from "../SevenTwoAnnouncement";
import BombPotVotingPanel from "../BombPotVotingPanel";
import { SevenTwoBountyChips } from "./SevenTwoBountyChips";
import { formatCents } from "lib/formatCents";
import type { TableLayoutProps } from "../TableLayout";
import {
  getMinPlayerStack,
  getRunAnnouncementContent,
  RUN_LABELS,
  getViewerPlayer,
  getViewingPlayerId,
  isCanceledBombPotAnnouncement,
} from "../tableLayoutUtils";
import { isActivePhase } from "lib/phases";
import {
  getCenterBoardMode,
  isRunItAnnouncementPhase,
  isRunItShowdownSequence,
  shouldRenderRunItBoard,
} from "lib/tableVisualState";
import {
  getDesktopTableLayoutProfile,
  type DesktopBombPotCenterStage,
  type DesktopRunItCenterStage,
  type DesktopStandardCenterStage,
} from "lib/desktopTableLayout";
import { computeDesktopChipAngle } from "lib/chipOrientation";
import { useGameStore } from "store/useGameStore";
import { shouldRevealRunsConcurrently } from "lib/showdownTiming";

const Seat = dynamic(() => import("./Seat"), { ssr: false });

const TOTAL_SEATS = 10;

type DesktopTableLayoutProps = TableLayoutProps & { desktopScale?: number };

const DesktopTableLayout: React.FC<DesktopTableLayoutProps> = ({
  scene,
  actions,
  desktopScale = 1,
}) => {
  const {
    seatSelectionLocked = false,
    players = [],
    dealerIndex = 0,
    tableName,
    blinds,
    pot,
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
    isYourTurn = false,
    currentActorName,
    isFirstBet = false,
    handNumber = 0,
    viewerStack = 0,
    viewerCurrentBet = 0,
    showdownCountdown = null,
    isAdmin = false,
    streetSweeping = false,
    runItVotes = {},
    runResults = [],
    runCount = 1,
    runAnnouncement = null,
    votingStartedAt = null,
    viewerCanVote = false,
    isRunItBoard = false,
    animatedShowdownReveal = false,
    showWinnerBanner = false,
    knownCardCount = 0,
    runDealStartedAt = null,
    sevenTwoBountyBB = 0,
    sevenTwoAnnouncement = null,
    sevenTwoBountyTrigger = null,
    canShowCards = false,
    myRevealedCardIndices,
    sevenTwoEligible = false,
    bombPotVote = null,
    bombPotNextHand: _bombPotNextHand = null,
    isBombPotHand = false,
    communityCards2 = [],
    bombPotCooldown = [],
    bombPotAnnouncement = null,
    actionError = null,
    leaveQueued,
    cardPeelPersistenceKey,
  } = scene;
  const {
    onSitDown,
    onFold,
    onCheck,
    onCall,
    onRaise,
    onAllIn,
    onStartHand,
    onVoteRun,
    onRevealCard,
    onPeekCard,
    onProposeBombPot,
    onVoteBombPot,
    onStandUp,
    onQueueLeave,
  } = actions;
  const isDark = useColorScheme() === "dark";
  const router = useRouter();
  const isShowdown = phase === "showdown";
  const isWaiting = !phase || phase === "waiting";
  const centerBoardMode = getCenterBoardMode({
    phase,
    isBombPotHand,
    isRunItBoard,
    runDealStartedAt,
    runAnnouncement,
    runResults,
    communityCards2,
  });
  const isRunItCenterStage = centerBoardMode === "runIt";
  const isRunItShowdown = isRunItShowdownSequence({
    phase,
    isBombPotHand,
    isRunItBoard,
    runResults,
  });
  const revealRunsConcurrently = shouldRevealRunsConcurrently(isBombPotHand, runResults.length);
  const isRunItAnnouncing = isRunItAnnouncementPhase({
    phase,
    isBombPotHand,
    isRunItBoard,
    runAnnouncement,
    runResults,
  });
  const isShowingBombPotCenterStage = centerBoardMode === "bombPot";
  const isRunItDealing = shouldRenderRunItBoard({
    phase,
    isRunItBoard,
    isBombPotHand,
    runDealStartedAt,
    runAnnouncement,
  });
  const resolvedRunCount = Math.max(runCount, runResults.length, 1);
  const desktopLayout = getDesktopTableLayoutProfile({
    isBombPotHand: isShowingBombPotCenterStage,
    isRunItBoard: isRunItCenterStage,
    runCount: resolvedRunCount,
  });
  const centerStage = desktopLayout.centerStage;
  const standardCenterStage =
    centerStage.kind === "standard"
      ? centerStage as DesktopStandardCenterStage
      : null;
  const bombPotCenterStage =
    centerStage.kind === "bombPot"
      ? centerStage as DesktopBombPotCenterStage
      : null;
  const runItCenterStage =
    centerStage.kind === "runIt"
      ? centerStage as DesktopRunItCenterStage
      : null;
  const g: TableGeometry = desktopLayout.seat.geometry;
  const stageInset = Math.max(0, (1 - desktopScale) * 22);
  const overlayLift = -Math.round(desktopLayout.overlays.lift + stageInset * 0.75);
  const seatSize = desktopLayout.seat.size;
  const infoClusterStyle = {
    left: Math.round(desktopLayout.infoCluster.left + stageInset),
    bottom: Math.round(desktopLayout.infoCluster.bottom + stageInset * 0.5),
  };

  const [bothRevealed, setBothRevealed] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [foldConfirm, setFoldConfirm] = useState(false);
  const autoPeelEnabled = useGameStore((state) => state.autoPeelEnabled);
  const setAutoPeelEnabled = useGameStore((state) => state.setAutoPeelEnabled);
  // Container width for winner chip animation pixel math
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    obs.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => obs.disconnect();
  }, []);

  const youPlayer = getViewerPlayer(players);
  const viewingPlayerId = getViewingPlayerId(players);
  const minPlayerStack = getMinPlayerStack(players);
  const seatedPlayerCount = players.filter((player) => player != null).length;

  const activeIdx = players.findIndex((p) => p?.isCurrentActor);
  const chipGlowAngle = computeDesktopChipAngle({
    chipLeftPct: centerStage.chipLeftPct,
    chipTopPct: centerStage.chipTopPct,
    seatIndex: activeIdx >= 0 ? activeIdx : null,
    totalSeats: TOTAL_SEATS,
    geometry: g,
    tableWidth: desktopLayout.tableReferenceSize.width,
    tableHeight: desktopLayout.tableReferenceSize.height,
  });

  const CARD_COUNT = 5;
  const isVoting = phase === "voting";
  const isPlaying = phase && phase !== "waiting" && phase !== "showdown" && phase !== "voting";
  const hasHoleCards = holeCards != null;
  const betOrRaiseLabel = isFirstBet ? "Bet" : "Raise";
  const bombPotAnnouncementIsCanceled = isCanceledBombPotAnnouncement(bombPotAnnouncement);
  const centerStageTransition = {
    type: "spring" as const,
    stiffness: 280,
    damping: 30,
    mass: 0.9,
  };

  useEffect(() => {
    if (!isYourTurn || !canRaise) {
      setRaiseOpen(false);
    }
  }, [canRaise, isYourTurn]);

  return (
    <div className={`relative flex flex-col h-full w-full overflow-hidden bg-gray-100 dark:bg-gray-950 transition-colors duration-500 ${isYourTurn ? "animate-turn-perimeter" : ""}`}>

      {/* Home / Exit button — top-left */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-6 left-8 z-30 flex items-center gap-2 px-4 py-2 rounded-xl
          bg-white/10 hover:bg-white/20 border border-white/10
          text-gray-400 hover:text-white text-sm font-semibold transition-all"
        aria-label="Leave table"
      >
        <span className="text-lg leading-none">&larr;</span>
        <span className="max-w-[180px] truncate">{tableName ?? "Menu"}</span>
      </button>

      {/* Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[70%] bg-red-500/5 blur-[120px] rounded-full dark:bg-red-600/10" />
      </div>

      {/* Table area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden z-10">
        <div
          ref={tableContainerRef}
          className="relative mx-auto"
          style={{
            width: `${desktopLayout.table.maxWidthPct}%`,
            aspectRatio: `${desktopLayout.table.aspectRatio}`,
          }}
        >
          {/* Rail */}
          <div
            className="absolute inset-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] dark:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]"
            style={{ borderRadius: desktopLayout.table.railRadius }}
          />

          {/* Table Surface */}
          <div
            className="absolute shadow-inner overflow-hidden"
            style={{
              inset: desktopLayout.table.feltInset,
              borderRadius: desktopLayout.table.feltRadius,
              background: isDark
                ? "radial-gradient(ellipse at 50% 38%, #2c1f1f 0%, #1a1212 55%, #0d0808 100%)"
                : "radial-gradient(ellipse at 50% 38%, #1e2a3a 0%, #111a26 58%, #070c14 100%)",
            }}
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />

            {/* Floating chip */}
            <motion.div
              className="absolute z-10 pointer-events-none"
              initial={false}
              animate={{
                left: `${centerStage.chipLeftPct}%`,
                top: `${centerStage.chipTopPct}%`,
              }}
              transition={centerStageTransition}
            >
              <div className="-translate-x-1/2 -translate-y-1/2">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isRunItDealing ? 0.94 : 1,
                    rotate: isRunItDealing ? -12 : 0,
                    opacity: 1,
                  }}
                  transition={centerStageTransition}
                >
                  <PokerChip size={30} glowAngle={chipGlowAngle} />
                </motion.div>
              </div>
            </motion.div>

            {/* ── Community Cards (normal, non-run-it showdown) ── */}
            {centerBoardMode === "single" && (
              <div
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex"
                style={{
                  top: `${standardCenterStage?.topPct ?? 43.6}%`,
                  gap: standardCenterStage?.gap ?? 20,
                }}
              >
                {Array.from({ length: CARD_COUNT }, (_, i) => {
                  const card = isRunItAnnouncing && i >= knownCardCount
                    ? undefined
                    : communityCards?.[i];
                  const isRevealed = card != null;
                  const cardKey = `${handNumber}-card-${i}-${isRevealed ? "shown" : "hidden"}`;
                  const dealDelay = isRevealed ? `${(i % 3) * 0.08}s` : "0s";
                  return (
                    <div
                      key={cardKey}
                      className={`transition-transform hover:-translate-y-1${isRevealed ? " animate-card-deal-in" : ""}`}
                      style={{ animationDelay: dealDelay }}
                    >
                      <Card
                        card={card}
                        className="rounded-2xl shadow-2xl"
                        style={{
                          width: standardCenterStage?.cardWidth,
                          height: standardCenterStage?.cardHeight,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Bomb Pot: two boards ── */}
            {isShowingBombPotCenterStage && (
              <div
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{
                  top: `${bombPotCenterStage?.topPct ?? 41.6}%`,
                  gap: bombPotCenterStage?.stackGap ?? 12,
                }}
              >
                <div
                  className="font-black text-gray-400 uppercase"
                  style={{
                    fontSize: bombPotCenterStage?.labelFontSize,
                    letterSpacing: `${bombPotCenterStage?.labelTrackingEm ?? 0.28}em`,
                  }}
                >
                  Board 1
                </div>
                <div className="flex" style={{ gap: bombPotCenterStage?.gap ?? 14 }}>
                  {Array.from({ length: CARD_COUNT }, (_, i) => {
                    const isRevealed = communityCards?.[i] != null;
                    const cardKey = `${handNumber}-b1-card-${i}-${isRevealed ? "shown" : "hidden"}`;
                    return (
                      <div key={cardKey} className={isRevealed ? "animate-card-deal-in" : ""} style={{ animationDelay: isRevealed ? `${i * 0.08}s` : "0s" }}>
                        <Card
                          card={communityCards?.[i]}
                          className="rounded-xl shadow-xl"
                          style={{
                            width: bombPotCenterStage?.cardWidth,
                            height: bombPotCenterStage?.cardHeight,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="mt-1 font-black text-gray-400 uppercase"
                  style={{
                    fontSize: bombPotCenterStage?.labelFontSize,
                    letterSpacing: `${bombPotCenterStage?.labelTrackingEm ?? 0.28}em`,
                  }}
                >
                  Board 2
                </div>
                <div className="flex" style={{ gap: bombPotCenterStage?.gap ?? 14 }}>
                  {Array.from({ length: CARD_COUNT }, (_, i) => {
                    const isRevealed = communityCards2?.[i] != null;
                    const cardKey = `${handNumber}-b2-card-${i}-${isRevealed ? "shown" : "hidden"}`;
                    return (
                      <div key={cardKey} className={isRevealed ? "animate-card-deal-in" : ""} style={{ animationDelay: isRevealed ? `${i * 0.08}s` : "0s" }}>
                        <Card
                          card={communityCards2?.[i]}
                          className="rounded-xl shadow-xl"
                          style={{
                            width: bombPotCenterStage?.cardWidth,
                            height: bombPotCenterStage?.cardHeight,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Run-it board — all runs stacked along Y axis ── */}
            {isRunItDealing && (
              <div
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                style={{
                  top: `${runItCenterStage?.topPct ?? 38.2}%`,
                  width: runItCenterStage?.rowWidth,
                }}
              >
                <RunItBoard
                  runResults={runResults}
                  handNumber={handNumber}
                  runDealStartedAt={runDealStartedAt!}
                  knownCardCount={knownCardCount}
                  desktopLayout={runItCenterStage ?? undefined}
                />
              </div>
            )}

            {/* Pot Display — visible whenever pot > 0 (voting, active play, and throughout showdown) */}
            {(pot ?? 0) > 0 && (
              <motion.div
                className="absolute z-20"
                initial={false}
                animate={{
                  left: `${centerStage.potLeftPct}%`,
                  top: `${centerStage.potTopPct}%`,
                }}
                transition={centerStageTransition}
              >
                <div className="-translate-x-1/2 -translate-y-1/2 text-center group">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-gray-400 font-black mb-1.5 opacity-80">Total Pot</div>
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: isRunItDealing ? 0.96 : 1, opacity: 1 }}
                    transition={centerStageTransition}
                    className="min-w-[170px] px-7 py-3.5 rounded-[22px] bg-gradient-to-r from-red-500 to-red-700 shadow-lg text-white font-mono font-black text-[28px] transition-all group-hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] group-hover:-translate-y-0.5"
                    style={{
                      boxShadow: "0 16px 32px rgba(239,68,68,0.26), 0 0 0 1px rgba(255,255,255,0.08) inset",
                    }}
                  >
                    {formatCents(pot ?? 0)}
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Winner celebration banner — normal showdown only (no run-it board) */}
            <AnimatePresence>
              {isShowdown && !isRunItShowdown && showWinnerBanner && winners && winners.length > 0 && (
                <div className="absolute inset-x-0 top-[15%] flex justify-center z-[160] pointer-events-none">
                  <WinnerBanner winners={winners} players={players} variant="desktop" />
                </div>
              )}
            </AnimatePresence>

            {/* 7-2 Offsuit announcement banner */}
            <AnimatePresence>
              {sevenTwoAnnouncement && (
                <div className="absolute inset-x-0 top-[5%] flex justify-center z-[170] pointer-events-none">
                  <SevenTwoAnnouncement
                    winnerName={sevenTwoAnnouncement.winnerName}
                    perPlayer={sevenTwoAnnouncement.perPlayer}
                    total={sevenTwoAnnouncement.total}
                    variant="desktop"
                  />
                </div>
              )}
            </AnimatePresence>


            {/* Run announcement banner */}
            <AnimatePresence>
              {runAnnouncement != null && (
                <div className="absolute inset-0 flex items-center justify-center z-[175] pointer-events-none" style={{ transform: `translateY(${overlayLift}px)` }}>
                  <AnnouncementBanner
                    {...getRunAnnouncementContent(runAnnouncement)}
                    variant="desktop"
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Bomb pot voting panel */}
            <AnimatePresence>
              {bombPotVote && (
                <div className="overlay-scrim-strong absolute inset-0 flex items-center justify-center z-[180] rounded-[94px] pointer-events-none" style={{ transform: `translateY(${overlayLift}px)` }}>
                  <div className="pointer-events-auto">
                    <BombPotVotingPanel
                      vote={bombPotVote}
                      players={players}
                      viewingPlayerId={viewingPlayerId}
                      bigBlind={blinds?.big ?? 25}
                      onApprove={() => onVoteBombPot?.(true)}
                      onReject={() => onVoteBombPot?.(false)}
                      variant="desktop"
                      desktopMetrics={desktopLayout.bombPotVotingPanel}
                    />
                  </div>
                </div>
              )}
            </AnimatePresence>

            {/* Bomb pot announcement banner */}
            <AnimatePresence>
              {actionError && (
                <div className="absolute inset-0 flex items-center justify-center z-[179] pointer-events-none" style={{ transform: `translateY(${overlayLift}px)` }}>
                  <AnnouncementBanner
                    eyebrow="Action Blocked"
                    title="That move didn't go through"
                    detail={actionError.message}
                    badge="Retry"
                    tone="amber"
                    variant="desktop"
                  />
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {bombPotAnnouncement && (
                <div className="absolute inset-0 flex items-center justify-center z-[178] pointer-events-none" style={{ transform: `translateY(${overlayLift}px)` }}>
                  <AnnouncementBanner
                    eyebrow={bombPotAnnouncementIsCanceled ? "Table Update" : "Special Hand"}
                    title={bombPotAnnouncement.title}
                    detail={bombPotAnnouncement.detail}
                    badge={bombPotAnnouncementIsCanceled ? "Canceled" : "Bomb Pot"}
                    tone={bombPotAnnouncementIsCanceled ? "amber" : "sky"}
                    variant="desktop"
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Voting overlay */}
            <AnimatePresence>
              {isVoting && (
                <div className="overlay-scrim-strong absolute inset-0 flex items-center justify-center z-[165] rounded-[94px]">
                  <VotingPanel
                    votes={runItVotes}
                    players={players}
                    viewingPlayerId={viewingPlayerId}
                    onVote={onVoteRun}
                    votingStartedAt={votingStartedAt}
                    canVote={viewerCanVote}
                    desktopMetrics={desktopLayout.votingPanel}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Seats */}
          {[...Array(TOTAL_SEATS)].map((_, i) => (
            <Seat
              key={i}
              seatIndex={i}
              totalSeats={TOTAL_SEATS}
              geometry={g}
              player={players[i] ?? null}
              playerCount={seatedPlayerCount}
              isYou={players[i]?.isYou ?? false}
              isDealer={i === dealerIndex}
              isSmallBlind={i === smallBlindIndex}
              isBigBlind={i === bigBlindIndex}
              isCurrentActor={players[i]?.isCurrentActor ?? false}
              onSitDown={onSitDown}
              seatSelectionLocked={seatSelectionLocked}
              seatSize={seatSize}
              handNumber={handNumber}
            />
          ))}

          {/* Bet chip stacks */}
          <BetChipsLayer
            players={players as any}
            totalSeats={TOTAL_SEATS}
            geometry={g}
            seatSize={seatSize}
            sweepMode={streetSweeping}
            tableWidth={desktopLayout.tableReferenceSize.width}
            tableHeight={desktopLayout.tableReferenceSize.height}
            potLeftPct={centerStage.potLeftPct}
            potTopPct={centerStage.potTopPct}
          />

          {/* Winner chips — animate from pot to winner seat(s), per run if multi-run */}
          <AnimatePresence>
            {isShowdown && winners && winners.length > 0 && containerWidth > 0 && (
              <WinnerChipsAnimation
                key={`${handNumber}-winner-chips`}
                winners={winners}
                runResults={animatedShowdownReveal ? runResults : undefined}
                knownCardCount={animatedShowdownReveal ? knownCardCount : undefined}
                revealRunsConcurrently={revealRunsConcurrently}
                players={players as any}
                totalSeats={TOTAL_SEATS}
                geometry={g}
                containerWidth={containerWidth}
                handNumber={handNumber}
                tableAspectRatio={desktopLayout.table.aspectRatio}
                potTopPct={centerStage.potTopPct}
                potLeftPct={centerStage.potLeftPct}
              />
            )}
          </AnimatePresence>

          {/* 7-2 Bounty chips — fly from each opponent to winner */}
          {sevenTwoBountyTrigger && containerWidth > 0 && (
            <SevenTwoBountyChips
              key={`${handNumber}-72chips`}
              winnerId={sevenTwoBountyTrigger.winnerId}
              perPlayer={sevenTwoBountyTrigger.perPlayer}
              players={players as any}
              totalSeats={TOTAL_SEATS}
              geometry={g}
              containerWidth={containerWidth}
              handNumber={handNumber}
            />
          )}
        </div>

        <div className="absolute flex items-end gap-3 z-[55] animate-slide-up" style={infoClusterStyle}>
          {/* Table Info Bar */}
          <div className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/85 dark:bg-[rgba(3,7,18,0.85)] border border-gray-200/50 dark:border-white/[0.06] backdrop-blur-md shadow-xl">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-lg">
              ♠
            </div>
            <div>
              <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none">
                {tableName ?? "Pokington Main"}
              </h4>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Blinds: {formatCents(blinds?.small ?? 100)} / {formatCents(blinds?.big ?? 200)}
              </p>
            </div>
            {sevenTwoBountyBB > 0 && (
              <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30">
                7-2: ON • {sevenTwoBountyBB}x BB
              </div>
            )}
            {isBombPotHand && (
              <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                BOMB POT
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-white/78 dark:bg-[rgba(3,7,18,0.78)] border border-gray-200/50 dark:border-white/[0.06] backdrop-blur-md shadow-xl px-3 py-2">
            <DesktopLedgerMenu />

            {!bombPotVote && !_bombPotNextHand && viewingPlayerId && !bombPotCooldown.includes(viewingPlayerId) && (
              <DesktopBombPotMenu
                bigBlind={blinds?.big ?? 25}
                minPlayerStack={minPlayerStack}
                onPropose={onProposeBombPot}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom hand panel + actions */}
      {youPlayer && (
        <div className={`flex-shrink-0 relative overflow-visible backdrop-blur-xl border-t shadow-[0_-20px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_-20px_40px_rgba(0,0,0,0.4)] z-20 transition-all duration-300 ${
          isYourTurn
            ? "animate-action-pulse bg-white dark:bg-[rgba(3,7,18,0.97)] border-red-500/50"
            : "bg-white/95 dark:bg-[rgba(3,7,18,0.95)] border-gray-200/50 dark:border-white/[0.06]"
        }`}>
          <div
            className="flex items-center mx-auto"
            style={{
              gap: desktopLayout.actionBar.gap,
              maxWidth: desktopLayout.actionBar.maxWidth,
              padding: `${desktopLayout.actionBar.paddingY}px ${desktopLayout.actionBar.paddingX}px`,
            }}
          >

            {/* Hole cards area */}
            <div
              className="flex-1 flex flex-col items-center relative z-10"
              style={{ marginTop: hasHoleCards ? desktopLayout.actionBar.holeCardsLift : 0 }}
            >
              {hasHoleCards ? (
                <>
                  <HoleCards
                    key={handNumber}
                    cards={holeCards}
                    cardHeight={desktopLayout.actionBar.holeCardHeight}
                    persistenceKey={cardPeelPersistenceKey}
                    autoReveal={autoPeelEnabled}
                    onRevealChange={setBothRevealed}
                    canRevealToOthers={canShowCards}
                    revealedToOthersIndices={myRevealedCardIndices}
                    onRevealToOthers={onRevealCard}
                    sevenTwoEligible={sevenTwoEligible}
                    onPeekCard={onPeekCard}
                  />
                  <button
                    onClick={() => setAutoPeelEnabled(!autoPeelEnabled)}
                    className={`mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors ${
                      autoPeelEnabled
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 dark:bg-white/[0.07] text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12]"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoPeelEnabled ? "bg-white" : "bg-gray-300 dark:bg-gray-600"}`} />
                    auto peel
                  </button>
                </>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-600 font-bold uppercase tracking-widest py-8">
                  Waiting for deal...
                </div>
              )}
            </div>

            <div
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
              style={{ minWidth: handIndicators.length > 1 ? 288 : 120 }}
            >
              <div className={bothRevealed ? "" : "opacity-60"}>
                <DesktopHandIndicatorFan
                  indicators={bothRevealed ? handIndicators : []}
                />
              </div>
              <span
                className="font-mono font-black text-gray-900 dark:text-white"
                style={{ fontSize: desktopLayout.actionBar.metaStackFontSize }}
              >
                {formatCents(youPlayer.stack)}
              </span>
              <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-md font-black uppercase">You</span>
              {onStandUp && (() => {
                const midHand = isActivePhase(phase) && !(youPlayer?.isFolded ?? false);
                if (leaveQueued) {
                  return (
                    <span
                      className="font-bold text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10"
                      style={{ fontSize: desktopLayout.actionBar.leaveFontSize }}
                    >
                      Leaving...
                    </span>
                  );
                }
                return (
                  <button
                    onClick={midHand ? onQueueLeave : onStandUp}
                    className="font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 transition-colors"
                    style={{ fontSize: desktopLayout.actionBar.leaveFontSize }}
                  >
                    {midHand ? "Leave Next Hand" : "Leave"}
                  </button>
                );
              })()}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 flex-shrink-0 relative">
              {(isWaiting || isShowdown) && isAdmin && (() => {
                const eligibleCount = players.filter((p) => p != null && (p.stack ?? 0) > 0).length;
                return (
                <>
                  {isShowdown && showdownCountdown != null && (
                    <p className="text-xs text-amber-500 text-center font-bold">
                      Next hand in {showdownCountdown}s...
                    </p>
                  )}
                  {(isWaiting || isShowdown) && (
                    <>
                      {eligibleCount < 2 ? (
                        <div
                          className="px-12 rounded-xl flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 font-semibold"
                          style={{
                            height: desktopLayout.actionBar.buttonHeight,
                            fontSize: desktopLayout.actionBar.secondaryButtonFontSize,
                          }}
                        >
                          Waiting for more players…
                        </div>
                      ) : (
                        <button
                          onClick={onStartHand}
                          className="px-12 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
                          style={{
                            height: desktopLayout.actionBar.buttonHeight,
                            fontSize: desktopLayout.actionBar.primaryButtonFontSize,
                          }}
                        >
                          {isShowdown ? "Next Hand" : "Start Game"}
                        </button>
                      )}
                    </>
                  )}
                </>
                );
              })()}

              {/* Voting: show your vote status / prompt in action area */}
              {isVoting && (
                <div className="text-xs text-gray-400 text-center font-semibold px-4">
                  {viewingPlayerId && runItVotes[viewingPlayerId]
                    ? `You voted: ${RUN_LABELS[(runItVotes[viewingPlayerId] ?? 1) - 1]}`
                    : "Vote on the table..."}
                </div>
              )}

              {isPlaying && (
                <>
                  {!isYourTurn && currentActorName && (
                    <p className="text-xs text-gray-500 text-center">
                      Waiting for {currentActorName}...
                    </p>
                  )}



                  <div
                    className={`flex transition-opacity duration-200 ${!isYourTurn ? "opacity-40 pointer-events-none" : ""}`}
                    style={{ gap: 12 }}
                  >
                    {/* Fold button with confirmation when not facing a bet */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (canCheck) { setFoldConfirm(true); }
                          else { onFold?.(); }
                        }}
                        className="px-8 rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                        style={{
                          height: desktopLayout.actionBar.buttonHeight,
                          fontSize: desktopLayout.actionBar.secondaryButtonFontSize,
                        }}
                      >
                        Fold
                      </button>
                      <AnimatePresence>
                        {foldConfirm && (
                          <>
                            <div className="absolute inset-0 z-40" onClick={() => setFoldConfirm(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              className="absolute bottom-full left-0 mb-2 z-50 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3"
                            >
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                You can check for free. Fold anyway?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setFoldConfirm(false)}
                                  className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => { setFoldConfirm(false); onFold?.(); }}
                                  className="flex-1 py-1.5 rounded-lg bg-red-500 text-xs font-bold text-white hover:bg-red-600 transition-colors"
                                >
                                  Fold
                                </button>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    {canCheck ? (
                      <button
                        onClick={() => {
                          setRaiseOpen(false);
                          onCheck?.();
                        }}
                        className="px-8 rounded-xl bg-gray-200 dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-bold transition-colors hover:bg-gray-300 dark:hover:bg-gray-600"
                        style={{
                          height: desktopLayout.actionBar.buttonHeight,
                          fontSize: desktopLayout.actionBar.secondaryButtonFontSize,
                        }}
                      >
                        Check
                      </button>
                    ) : (
                      <button
                        onClick={onCall}
                        className="px-8 rounded-xl bg-gray-200 dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-bold transition-colors hover:bg-gray-300 dark:hover:bg-gray-600"
                        style={{
                          height: desktopLayout.actionBar.buttonHeight,
                          fontSize: desktopLayout.actionBar.secondaryButtonFontSize,
                        }}
                      >
                        Call {formatCents(callAmount)}
                      </button>
                    )}

                    {canRaise && (
                      <div className="relative">
                        <button
                          onClick={() => setRaiseOpen((o) => !o)}
                          className="px-8 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
                          style={{
                            height: desktopLayout.actionBar.buttonHeight,
                            fontSize: desktopLayout.actionBar.primaryButtonFontSize,
                          }}
                        >
                          {betOrRaiseLabel}
                        </button>
                        <AnimatePresence>
                          {raiseOpen && (
                            <DesktopRaisePopover
                              pot={pot ?? 0}
                              stack={viewerStack}
                              currentBet={viewerCurrentBet}
                              minRaise={minRaise}
                              bigBlind={blinds?.big ?? 25}
                              isFirstBet={isFirstBet}
                              onConfirm={(amt) => onRaise?.(amt)}
                              onDismiss={() => setRaiseOpen(false)}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {!canRaise && canAllIn && (
                      <button
                        onClick={onAllIn}
                        className="px-8 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
                        style={{
                          height: desktopLayout.actionBar.buttonHeight,
                          fontSize: desktopLayout.actionBar.primaryButtonFontSize,
                        }}
                      >
                        All-in
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopTableLayout;

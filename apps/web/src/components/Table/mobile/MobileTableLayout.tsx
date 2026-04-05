"use client";
import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TableHeader from "./TableHeader";
import OpponentStrip from "./OpponentStrip";
import CommunityCards from "./CommunityCards";
import HandPanel from "./HandPanel";
import ActionBar from "./ActionBar";
import SitDownForm from "../SitDownForm";
import BombPotVotingPanel from "../BombPotVotingPanel";
import BombPotSheet from "./BombPotSheet";
import PokerChip from "components/poker/PokerChip";
import { formatCents } from "lib/formatCents";
import { MobileWinnerChips } from "./MobileWinnerChips";
import { MobileSevenTwoBountyChips } from "./MobileSevenTwoBountyChips";
import SevenTwoAnnouncement from "../SevenTwoAnnouncement";
import WinnerBanner from "../WinnerBanner";
import type { Player } from "types/player";
import type { Card } from "@pokington/shared";
import type { RunResult, GameState } from "@pokington/engine";

interface MobileTableLayoutProps {
  onSitDown: (seatIndex: number, name?: string, buyInCents?: number) => void;
  players?: Player[];
  dealerIndex?: number;
  tableName?: string;
  blinds?: { small: number; big: number };
  pot?: number;
  smallBlindIndex?: number;
  bigBlindIndex?: number;
  communityCards?: Card[];
  holeCards?: [Card, Card] | null;
  handStrength?: string | null;
  totalSeats?: number;
  phase?: string;
  winners?: { playerId: string; amount: number; hand: string }[] | null;
  onFold?: () => void;
  onCheck?: () => void;
  onCall?: () => void;
  onRaise?: (amount: number) => void;
  onStartHand?: () => void;
  callAmount?: number;
  minRaise?: number;
  canCheck?: boolean;
  canRaise?: boolean;
  canAllIn?: boolean;
  onAllIn?: () => void;
  isYourTurn?: boolean;
  currentActorName?: string;
  isFirstBet?: boolean;
  handNumber?: number;
  viewerStack?: number;
  showdownCountdown?: number | null;
  turnStartedAt?: number | null;
  isAdmin?: boolean;
  timerEnabled?: boolean;
  onToggleTimer?: (enabled: boolean) => void;
  runItVotes?: Record<string, 1 | 2 | 3>;
  onVoteRun?: (count: 1 | 2 | 3) => void;
  runAnnouncement?: 1 | 2 | 3 | null;
  votingStartedAt?: number | null;
  viewerCanVote?: boolean;
  showNextHand?: boolean;
  // Run-it
  isRunItBoard?: boolean;
  runResults?: RunResult[];
  knownCardCount?: number;
  runDealStartedAt?: number | null;
  runCount?: 1 | 2 | 3;
  // 7-2 Offsuit side game
  sevenTwoBountyBB?: 0 | 1 | 2 | 3;
  sevenTwoAnnouncement?: { winnerName: string; perPlayer: number; total: number } | null;
  sevenTwoBountyTrigger?: { winnerId: string; perPlayer: number; totalCollected: number } | null;
  canShowCards?: boolean;
  onRevealCard?: (cardIndex: 0 | 1) => void;
  myRevealedCardIndices?: Set<0 | 1>;
  voluntaryShownPlayerIds?: string[];
  onSetSevenTwoBounty?: (bountyBB: 0 | 1 | 2 | 3) => void;
  // Bomb pot
  bombPotVote?: GameState["bombPotVote"];
  bombPotNextHand?: GameState["bombPotNextHand"];
  isBombPotHand?: boolean;
  communityCards2?: Card[];
  bombPotCooldown?: string[];
  bombPotAnnouncement?: { anteBB: number; anteCents: number } | null;
  onProposeBombPot?: (anteBB: 1 | 2 | 3 | 4 | 5) => void;
  onVoteBombPot?: (approve: boolean) => void;
}

function computeMobileChipAngle(
  isYourTurn: boolean,
  activeOpponentIdx: number,
  totalOpponents: number
): number {
  if (isYourTurn) return 90;
  const ratio =
    totalOpponents <= 1 ? 0 : (activeOpponentIdx / (totalOpponents - 1)) * 2 - 1;
  return Math.atan2(-200, ratio * 130) * (180 / Math.PI);
}

const MobileTableLayout: React.FC<MobileTableLayoutProps> = ({
  onSitDown,
  players = [],
  dealerIndex = 0,
  tableName = "Table",
  blinds = { small: 1, big: 2 },
  pot = 0,
  smallBlindIndex,
  bigBlindIndex,
  communityCards,
  holeCards,
  handStrength,
  totalSeats = 10,
  phase,
  winners,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onStartHand,
  callAmount = 0,
  minRaise = 0,
  canCheck = false,
  canRaise = true,
  canAllIn = false,
  onAllIn,
  isYourTurn: isYourTurnProp,
  currentActorName,
  isFirstBet = false,
  handNumber = 0,
  showdownCountdown = null,
  turnStartedAt = null,
  isAdmin = false,
  timerEnabled = true,
  onToggleTimer,
  runItVotes = {},
  onVoteRun,
  runAnnouncement = null,
  votingStartedAt = null,
  viewerCanVote = false,
  showNextHand = true,
  isRunItBoard = false,
  runResults = [],
  knownCardCount = 0,
  runDealStartedAt = null,
  runCount = 1,
  sevenTwoBountyBB = 0,
  sevenTwoAnnouncement = null,
  sevenTwoBountyTrigger = null,
  canShowCards = false,
  onRevealCard,
  myRevealedCardIndices,
  onSetSevenTwoBounty,
  bombPotVote = null,
  bombPotNextHand: _bombPotNextHand = null,
  isBombPotHand = false,
  communityCards2,
  bombPotCooldown = [],
  bombPotAnnouncement = null,
  onProposeBombPot,
  onVoteBombPot,
}) => {
  const [selectedEmptySeat, setSelectedEmptySeat] = useState<number | null>(null);
  const [bombPotSheetOpen, setBombPotSheetOpen] = useState(false);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, []);

  const youPlayer = players.find((p) => p != null && p.isYou) ?? null;
  const isRunItDealing = isRunItBoard && runDealStartedAt != null && runAnnouncement == null;

  const opponents = players
    .map((p, i) => ({ player: p, seatIndex: i }))
    .filter(
      (entry): entry is { player: Player; seatIndex: number } =>
        entry.player != null && !entry.player.isYou
    );

  const occupiedSeats = new Set(
    players.map((_, i) => i).filter((i) => players[i] != null)
  );

  const emptySeats: number[] = [];
  for (let i = 0; i < totalSeats; i++) {
    if (!occupiedSeats.has(i)) emptySeats.push(i);
  }

  const isYourTurn = isYourTurnProp ?? (youPlayer?.isCurrentActor ?? false);
  const activeOpponentIdx = opponents.findIndex((o) => o.player.isCurrentActor);
  const waitingFor = currentActorName ?? players.find(
    (p) => p != null && p.isCurrentActor && !p.isYou
  )?.name;

  const chipGlowAngle = computeMobileChipAngle(
    isYourTurn,
    activeOpponentIdx,
    opponents.length
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden overscroll-none bg-gray-100 dark:bg-gray-950 transition-colors duration-500">
      {/*
       * Z-INDEX MANIFEST — MobileTableLayout
       * z-[80]  Run-it announcement (fixed, pointer-events-none)
       * z-[76]  Bomb pot announcement (fixed, pointer-events-none)
       * z-[75]  7-2 announcement (fixed, pointer-events-none)
       * z-[70]  Show/Muck buttons + Bomb pot voting panel
       * z-[65]  Winner banner (fixed, pointer-events-none)
       * z-[55]  Floating bomb pot button (bottom-right)
       * z-50    Sheets: RaiseSheet / FoldConfirmSheet / SitDownForm / BombPotSheet
       * z-40    Sheet backdrops
       * z-30    TableHeader
       * z-10    Active-player OpponentStrip cell (showdown card stacking)
       * Rule: do not insert new overlays between z-55 and z-65.
       * Rule: z-50 is reserved exclusively for sheets/dialogs.
       */}
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[40dvh] bg-red-500/5 dark:bg-red-600/10 blur-[80px] rounded-full" style={{ willChange: "auto" }} />
      </div>

      {/* Winner chips animation overlay */}
      {phase === "showdown" && winners && winners.length > 0 && (
        <MobileWinnerChips
          key={`${handNumber}-mobile-chips`}
          winners={winners}
          runResults={isRunItBoard ? runResults : undefined}
          knownCardCount={isRunItBoard ? knownCardCount : undefined}
          players={players.map((p, i) => p ? { id: p.id, seatIndex: i, isYou: p.isYou } : null)}
          handNumber={handNumber}
        />
      )}

      {/* 7-2 bounty chips animation overlay */}
      {sevenTwoBountyTrigger && (
        <MobileSevenTwoBountyChips
          winnerId={sevenTwoBountyTrigger.winnerId}
          perPlayer={sevenTwoBountyTrigger.perPlayer}
          players={players.map((p, i) => p ? { id: p.id, seatIndex: i, isYou: p.isYou } : null)}
          handNumber={handNumber}
        />
      )}

      {/* Header */}
      <TableHeader
        tableName={tableName}
        smallBlind={blinds.small}
        bigBlind={blinds.big}
        sevenTwoBountyBB={sevenTwoBountyBB}
      />

      {/* Content */}
      <div
        className="absolute inset-0 flex flex-col min-h-0"
        style={{
          paddingTop: "calc(52px + env(safe-area-inset-top))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Zone 1: Opponents */}
        <div className="flex-shrink-0">
          <OpponentStrip
            players={opponents}
            dealerIndex={dealerIndex}
            smallBlindIndex={smallBlindIndex}
            bigBlindIndex={bigBlindIndex}
            emptySeats={emptySeats}
            onEmptySeatTap={(seatIndex) => setSelectedEmptySeat(seatIndex)}
          />
        </div>

        {/* Zone 2: Community cards */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-start gap-1 pt-4">
          <CommunityCards
            communityCards={communityCards}
            communityCards2={communityCards2}
            isBombPot={isBombPotHand}
            isRunItBoard={isRunItBoard}
            runResults={runResults}
            knownCardCount={knownCardCount}
            runDealStartedAt={runDealStartedAt}
            runAnnouncement={runAnnouncement}
            handNumber={handNumber}
          />
        </div>

        {/* Pot pill — between cards and hand panel */}
        {pot > 0 && (
          <div className="flex-shrink-0 flex justify-center py-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-red-500 to-red-700 shadow-lg"
            >
              <span className="text-[8px] font-black text-red-200 uppercase tracking-widest">Pot</span>
              <span className="text-white font-mono font-black text-xs">{formatCents(pot)}</span>
            </motion.div>
          </div>
        )}

        {/* Zone 3: Chip + Hand */}
        <div className="flex-shrink-0">
          <AnimatePresence>
            {!isRunItDealing && (
              <motion.div
                className="flex justify-center pb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <PokerChip size={38} glowAngle={chipGlowAngle} />
              </motion.div>
            )}
          </AnimatePresence>
          <HandPanel
            player={youPlayer}
            holeCards={holeCards}
            handStrength={handStrength}
            handNumber={handNumber}
            canRevealToOthers={canShowCards}
            revealedToOthersIndices={myRevealedCardIndices}
            onRevealToOthers={onRevealCard}
          />
        </div>

        {/* Zone 4: Action bar */}
        <div className="flex-shrink-0 bg-white dark:bg-[rgb(3,7,18)] border-t border-gray-200/50 dark:border-white/[0.06]">
          <ActionBar
            isYourTurn={isYourTurn}
            waitingFor={waitingFor}
            callAmount={callAmount}
            pot={pot}
            stack={youPlayer?.stack ?? 0}
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
            turnStartedAt={turnStartedAt}
            timerEnabled={timerEnabled}
            onToggleTimer={onToggleTimer}
            runItVotes={runItVotes}
            onVoteRun={onVoteRun}
            runAnnouncement={runAnnouncement}
            votingStartedAt={votingStartedAt}
            viewerCanVote={viewerCanVote}
            showNextHand={showNextHand}
            viewerPlayerId={youPlayer?.id}
            players={players}
            sevenTwoBountyBB={sevenTwoBountyBB}
            onSetSevenTwoBounty={onSetSevenTwoBounty}
            handNumber={handNumber}
            isBombPotHand={isBombPotHand}
          />
        </div>
      </div>

      {/* 7-2 announcement overlay */}
      <AnimatePresence>
        {sevenTwoAnnouncement && (
          <div className="fixed inset-0 flex items-start justify-center z-[75] pointer-events-none pt-[30%]">
            <SevenTwoAnnouncement
              winnerName={sevenTwoAnnouncement.winnerName}
              perPlayer={sevenTwoAnnouncement.perPlayer}
              total={sevenTwoAnnouncement.total}
              variant="mobile"
            />
          </div>
        )}
      </AnimatePresence>


      {/* Run-it announcement overlay */}
      <AnimatePresence>
        {runAnnouncement != null && (
          <div className="fixed inset-0 flex items-center justify-center z-[80] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
              className="px-8 py-5 rounded-3xl text-white font-black text-xl shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: "0 0 50px rgba(124,58,237,0.5), 0 20px 40px rgba(0,0,0,0.5)",
              }}
            >
              Running it {["once", "twice", "three times"][runAnnouncement - 1]}!
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bomb pot voting panel overlay */}
      <AnimatePresence>
        {bombPotVote && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none">
            <div className="pointer-events-auto px-4 w-full max-w-xs">
              <BombPotVotingPanel
                vote={bombPotVote}
                players={players}
                viewingPlayerId={youPlayer?.id}
                bigBlind={blinds.big}
                onApprove={() => onVoteBombPot?.(true)}
                onReject={() => onVoteBombPot?.(false)}
                variant="mobile"
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Bomb pot announcement overlay */}
      <AnimatePresence>
        {bombPotAnnouncement && (
          <div className="fixed inset-0 flex items-center justify-center z-[76] pointer-events-none pt-[20%]">
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="px-6 py-4 rounded-2xl text-center"
              style={{
                background: "linear-gradient(135deg, #1e1b4b, #312e81)",
                border: "1px solid rgba(165,180,252,0.3)",
                boxShadow: "0 0 40px rgba(99,102,241,0.5)",
              }}
            >
              <div className="text-xl font-black text-yellow-300">BOMB POT!</div>
              <div className="text-sm text-indigo-200 mt-1">
                {bombPotAnnouncement.anteBB}x BB ante next hand
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating bomb pot button — bottom-right, above ActionBar */}
      <AnimatePresence>
        {!bombPotVote && !_bombPotNextHand && youPlayer?.id && !bombPotCooldown.includes(youPlayer.id) && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            whileTap={{ scale: 0.88 }}
            onClick={() => setBombPotSheetOpen(true)}
            className="fixed z-[55] w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-xl"
            style={{
              top: "40%",
              right: "12px",
              transform: "translateY(-50%)",
              background: "rgba(99,102,241,0.22)",
              border: "1px solid rgba(99,102,241,0.4)",
              backdropFilter: "blur(8px)",
            }}
          >
            💣
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bombPotSheetOpen && (
          <BombPotSheet
            bigBlind={blinds?.big ?? 25}
            onConfirm={(anteBB) => { onProposeBombPot?.(anteBB); setBombPotSheetOpen(false); }}
            onDismiss={() => setBombPotSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Winner banner — floats above HandPanel, does not push layout */}
      <AnimatePresence>
        {phase === "showdown" && !isRunItBoard && winners && winners.length > 0 && (
          <motion.div
            className="fixed z-[65] left-4 right-4 pointer-events-none"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 180px)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
          >
            <WinnerBanner winners={winners} players={players} variant="mobile" />
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

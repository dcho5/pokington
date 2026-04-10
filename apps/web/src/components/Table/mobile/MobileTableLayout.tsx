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
import LedgerSheet from "./LedgerSheet";
import PokerChip from "components/poker/PokerChip";
import { formatCents } from "lib/formatCents";
import { MobileWinnerChips } from "./MobileWinnerChips";
import { MobileSevenTwoBountyChips } from "./MobileSevenTwoBountyChips";
import SevenTwoAnnouncement from "../SevenTwoAnnouncement";
import WinnerBanner from "../WinnerBanner";
import type { Player } from "types/player";
import type { TableLayoutProps } from "../TableLayout";

type MobileTableLayoutProps = TableLayoutProps & { totalSeats?: number };

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
  sevenTwoEligible = false,
  onSetSevenTwoBounty,
  bombPotVote = null,
  bombPotNextHand: _bombPotNextHand = null,
  isBombPotHand = false,
  communityCards2,
  bombPotCooldown = [],
  bombPotAnnouncement = null,
  onProposeBombPot,
  onPeekCard,
  onVoteBombPot,
  onStandUp,
  onQueueLeave,
  leaveQueued,
}) => {
  const [selectedEmptySeat, setSelectedEmptySeat] = useState<number | null>(null);
  const [bombPotSheetOpen, setBombPotSheetOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  // Reset scroll position after keyboard dismisses (e.g. after SitDownForm).
  // On mobile, the virtual keyboard shifts the viewport upward; when it
  // closes the scroll offset can stick, causing the y-axis shift bug.
  useEffect(() => {
    if (selectedEmptySeat === null) {
      window.scrollTo(0, 0);
    }
  }, [selectedEmptySeat]);

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
    <div className="absolute inset-0 overflow-hidden overscroll-none bg-gray-100 dark:bg-gray-950 transition-colors duration-500">
      {/*
       * Z-INDEX MANIFEST — MobileTableLayout
       * z-[80]  Run-it announcement (absolute, pointer-events-none)
       * z-[76]  Bomb pot announcement (absolute, pointer-events-none)
       * z-[75]  7-2 announcement (absolute, pointer-events-none)
       * z-[70]  Show/Muck buttons + Bomb pot voting panel
       * z-[65]  Winner banner (absolute, pointer-events-none)
       * z-[55]  Floating bomb pot button (right) + ledger button (left)
       * z-50    Sheets: RaiseSheet / FoldConfirmSheet / SitDownForm / BombPotSheet / LedgerSheet
       * z-40    Sheet backdrops
       * z-30    TableHeader
       * z-10    Active-player OpponentStrip cell (showdown card stacking)
       * Rule: do not insert new overlays between z-55 and z-65.
       * Rule: z-50 is reserved exclusively for sheets/dialogs.
       */}
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[40%] bg-red-500/5 dark:bg-red-600/10 blur-[80px] rounded-full" style={{ willChange: "auto" }} />
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
        {/* Zone 1: Opponents — pt-7 gives showdown cards room above bubbles without clipping under nav bar */}
        <div className="flex-shrink-0 pt-7">
          <OpponentStrip
            players={opponents}
            dealerIndex={dealerIndex}
            smallBlindIndex={smallBlindIndex}
            bigBlindIndex={bigBlindIndex}
            emptySeats={emptySeats}
            onEmptySeatTap={(seatIndex) => {
              // If already seated during waiting phase, move seat via onSitDown
              // (which triggers changeSeat). Otherwise open the SitDownForm.
              const isWaiting = !phase || phase === "waiting";
              if (youPlayer && isWaiting) {
                onSitDown(seatIndex);
              } else {
                setSelectedEmptySeat(seatIndex);
              }
            }}
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

        {/* Zone 3: Chip (flanked by bomb pot + ledger buttons) + Hand */}
        <div className="flex-shrink-0">
          <AnimatePresence>
            {!isRunItDealing && (
              <motion.div
                className="flex items-center justify-center gap-4 pb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Bomb pot button (left of chip) */}
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
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-xl"
                        style={{
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

                {/* Ledger button (right of chip) */}
                <div className="w-10 flex justify-start">
                  <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => setLedgerOpen(true)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm shadow-xl"
                    style={{
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
          <HandPanel
            player={youPlayer}
            holeCards={holeCards}
            handStrength={handStrength}
            handNumber={handNumber}
            canRevealToOthers={canShowCards}
            revealedToOthersIndices={myRevealedCardIndices}
            onRevealToOthers={onRevealCard}
            sevenTwoEligible={sevenTwoEligible}
            onPeekCard={onPeekCard}
            onStandUp={onStandUp}
            onQueueLeave={onQueueLeave}
            leaveQueued={leaveQueued}
            phase={phase}
            currentBet={youPlayer?.currentBet ?? 0}
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
          <div className="absolute inset-0 flex items-start justify-center z-[75] pointer-events-none pt-[30%]">
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
          <div className="absolute inset-0 flex items-center justify-center z-[80] pointer-events-none">
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
          <div className="absolute inset-0 flex items-center justify-center z-[70] pointer-events-none">
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
          <div className="absolute inset-0 flex items-center justify-center z-[76] pointer-events-none pt-[20%]">
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

      <AnimatePresence>
        {ledgerOpen && <LedgerSheet onDismiss={() => setLedgerOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {bombPotSheetOpen && (
          <BombPotSheet
            bigBlind={blinds?.big ?? 25}
            minPlayerStack={players.reduce((min, p) => {
              if (p == null || (p.stack ?? 0) <= 0) return min;
              return min === undefined ? p.stack : Math.min(min, p.stack);
            }, undefined as number | undefined)}
            onConfirm={(anteBB) => { onProposeBombPot?.(anteBB); setBombPotSheetOpen(false); }}
            onDismiss={() => setBombPotSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Winner banner — floats above HandPanel, does not push layout */}
      <AnimatePresence>
        {phase === "showdown" && !isRunItBoard && winners && winners.length > 0 && (
          <motion.div
            className="absolute z-[65] left-4 right-4 pointer-events-none"
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

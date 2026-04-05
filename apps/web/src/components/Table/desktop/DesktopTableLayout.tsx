"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { LANDSCAPE, computeSeatCoords, type TableGeometry } from "lib/seatLayout";
import { useColorScheme } from "hooks/useColorScheme";
import { useRaiseAmount } from "hooks/useRaiseAmount";
import PokerChip from "components/poker/PokerChip";
import Card from "components/poker/Card";
import HoleCards from "components/poker/HoleCards";
import DealerButton from "./DealerButton";
import { BetChipsLayer } from "./BetChips";
import { WinnerChipsAnimation, getRunTimings, ANNOUNCE_DELAY_S } from "./WinnerChipsAnimation";
import RunItBoard from "../RunItBoard";
import TimerBar from "../TimerBar";
import WinnerBanner from "../WinnerBanner";
import VotingPanel, { RUN_LABELS } from "../VotingPanel";
import SevenTwoAnnouncement from "../SevenTwoAnnouncement";
import BombPotVotingPanel from "../BombPotVotingPanel";
import { SevenTwoBountyChips } from "./SevenTwoBountyChips";
import { formatCents } from "lib/formatCents";
import type { Card as CardType } from "@pokington/shared";
import type { RunResult, WinnerInfo } from "@pokington/engine";
import type { Player } from "types/player";
import type { TableLayoutProps } from "../TableLayout";

const Seat = dynamic(() => import("./Seat"), { ssr: false });

const TOTAL_SEATS = 10;

// ── Desktop Raise Popover (text input + presets + ±, live validation) ──
function DesktopRaisePopover({
  pot,
  stack,
  minRaise,
  bigBlind,
  isFirstBet,
  onConfirm,
  onDismiss,
}: {
  pot: number;
  stack: number;
  minRaise: number;
  bigBlind: number;
  isFirstBet: boolean;
  onConfirm: (amount: number) => void;
  onDismiss: () => void;
}) {
  const { amount, setAmount, increment: bbIncrement, lowerBound, presets, clamp } = useRaiseAmount({ minRaise, stack, pot, bigBlind });
  const [rawInput, setRawInput] = useState((lowerBound / 100).toFixed(2));
  const [inputError, setInputError] = useState(false);

  const applyAmount = (cents: number) => {
    const c = clamp(cents);
    setAmount(c);
    setRawInput((c / 100).toFixed(2));
    setInputError(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const dotIdx = cleaned.indexOf(".");
    if (dotIdx !== -1 && cleaned.length - dotIdx > 3) return;
    setRawInput(cleaned);
    if (cleaned === "" || cleaned === ".") { setInputError(true); return; }
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      const cents = Math.round(parsed * 100);
      if (cents >= lowerBound && cents <= stack) {
        setAmount(cents);
        setInputError(false);
      } else {
        setInputError(true);
      }
    }
  };

  const label = isFirstBet ? "Bet" : "Raise to";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onDismiss} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute bottom-full right-0 mb-2 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4"
      >
        <div className="flex items-center justify-center gap-3 mb-1">
          <button
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-lg font-bold flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            onClick={() => applyAmount(amount - bbIncrement)}
          >−</button>
          <input
            type="text"
            inputMode="decimal"
            value={rawInput}
            onChange={handleInputChange}
            onBlur={() => { if (!inputError) setRawInput((amount / 100).toFixed(2)); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !inputError) { onConfirm(amount); onDismiss(); }
              if (e.key === "Escape") onDismiss();
            }}
            className={`w-full text-center text-xl font-mono font-black rounded-xl px-3 py-2 outline-none transition-colors ${
              inputError
                ? "bg-red-50 dark:bg-red-950/30 border-2 border-red-500 text-red-600 dark:text-red-400 ring-1 ring-red-500"
                : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
            }`}
          />
          <button
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-lg font-bold flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            onClick={() => applyAmount(amount + bbIncrement)}
          >+</button>
        </div>

        <div className="h-4 mb-2 text-center">
          {inputError && (
            <span className="text-[10px] text-red-500 font-bold">
              {formatCents(lowerBound)} – {formatCents(stack)}
            </span>
          )}
        </div>

        <div className="flex gap-1 mb-3">
          {presets.map((p) => (
            <button
              key={p.label}
              className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              onClick={() => applyAmount(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          disabled={inputError}
          className={`w-full h-11 rounded-xl text-white font-black text-sm transition-all ${
            inputError
              ? "bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-red-500 to-red-700 shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)]"
          }`}
          onClick={() => { if (!inputError) { onConfirm(amount); onDismiss(); } }}
        >
          {label} {inputError ? "—" : formatCents(amount)}
        </button>
      </motion.div>
    </>
  );
}

const DesktopTableLayout: React.FC<TableLayoutProps> = ({
  onSitDown,
  players = [],
  dealerIndex = 0,
  tableName,
  blinds,
  pot,
  communityCards,
  holeCards,
  handStrength,
  phase,
  winners,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onAllIn,
  onStartHand,
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
  showdownCountdown = null,
  turnStartedAt = null,
  isAdmin = false,
  streetSweeping = false,
  timerEnabled = true,
  onToggleTimer,
  runItVotes = {},
  onVoteRun,
  runResults = [],
  runCount = 1,
  runAnnouncement = null,
  votingStartedAt = null,
  viewerCanVote = false,
  isRunItBoard = false,
  knownCardCount = 0,
  runDealStartedAt = null,
  showNextHand = true,
  sevenTwoBountyBB = 0,
  sevenTwoAnnouncement = null,
  sevenTwoBountyTrigger = null,
  canShowCards = false,
  onRevealCard,
  myRevealedCardIndices,
  voluntaryShownPlayerIds = [],
  onSetSevenTwoBounty,
  bombPotVote = null,
  bombPotNextHand: _bombPotNextHand = null,
  isBombPotHand = false,
  communityCards2 = [],
  bombPotCooldown = [],
  bombPotAnnouncement = null,
  onProposeBombPot,
  onVoteBombPot,
}) => {
  const isDark = useColorScheme() === "dark";
  const g: TableGeometry = LANDSCAPE;

  const [bothRevealed, setBothRevealed] = useState(false);
  const [autoFlip, setAutoFlip] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [foldConfirm, setFoldConfirm] = useState(false);
  const [bombProposePanelOpen, setBombProposePanelOpen] = useState(false);
  const bombProposePanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bombProposePanelOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (bombProposePanelRef.current && !bombProposePanelRef.current.contains(e.target as Node)) {
        setBombProposePanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [bombProposePanelOpen]);
  const handleRevealChange = useCallback((revealed: boolean) => setBothRevealed(revealed), []);

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

  const youPlayer = players.find((p) => p != null && p.isYou) ?? null;
  const viewingPlayerId = players.find((p) => p?.isYou)?.id;

  const activeIdx = players.findIndex((p) => p?.isCurrentActor);
  const { x: ax, y: ay } =
    activeIdx >= 0
      ? computeSeatCoords(activeIdx, TOTAL_SEATS, g)
      : { x: 0, y: -1 };
  const chipGlowAngle = Math.atan2(ay, ax) * (180 / Math.PI);

  const CARD_COUNT = 5;
  const isVoting = phase === "voting";
  const isPlaying = phase && phase !== "waiting" && phase !== "showdown" && phase !== "voting";
  const isShowdown = phase === "showdown";
  const isWaiting = !phase || phase === "waiting";
  const isRunItShowdown = isRunItBoard;
  const isRunItDealing = isRunItShowdown && runDealStartedAt != null && runAnnouncement == null;
  const hasHoleCards = holeCards != null;
  const betOrRaiseLabel = isFirstBet ? "Bet" : "Raise";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-gray-100 dark:bg-gray-950 transition-colors duration-500">

      {/* Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[70vh] bg-red-500/5 blur-[120px] rounded-full dark:bg-red-600/10" />
      </div>

      {/* Table area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden z-10">
        <div ref={tableContainerRef} className="relative w-full max-w-[90vw] mx-auto aspect-[21/9]">
          {/* Rail */}
          <div className="absolute inset-0 rounded-[100px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] dark:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]" />

          {/* Table Surface */}
          <div
            className="absolute inset-[3px] rounded-[97px] shadow-inner overflow-hidden"
            style={{
              background: isDark
                ? "radial-gradient(ellipse at 50% 38%, #2c1f1f 0%, #1a1212 55%, #0d0808 100%)"
                : "radial-gradient(ellipse at 50% 38%, #1e2a3a 0%, #111a26 58%, #070c14 100%)",
            }}
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />

            {/* Floating chip — hidden during run-it card deal to free up center space */}
            <AnimatePresence>
              {!isRunItDealing && (
                <motion.div
                  className="absolute left-1/2 top-[27%] -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <PokerChip size={34} glowAngle={chipGlowAngle} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Community Cards (normal, non-run-it showdown) ── */}
            {!isRunItShowdown && !isBombPotHand && (
              <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 flex gap-3 lg:gap-5">
                {Array.from({ length: CARD_COUNT }, (_, i) => {
                  const isRevealed = communityCards?.[i] != null;
                  const cardKey = `${handNumber}-card-${i}-${isRevealed ? "shown" : "hidden"}`;
                  const dealDelay = isRevealed ? `${(i % 3) * 0.08}s` : "0s";
                  return (
                    <div
                      key={cardKey}
                      className={`transition-transform hover:-translate-y-1${isRevealed ? " animate-card-deal-in" : ""}`}
                      style={{ animationDelay: dealDelay }}
                    >
                      <Card
                        card={communityCards?.[i]}
                        className="w-[72px] h-[100px] lg:w-[96px] lg:h-[136px] rounded-xl shadow-2xl"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Bomb Pot: two boards ── */}
            {isBombPotHand && !isRunItShowdown && (
              <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1.5 items-center">
                <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Board 1</div>
                <div className="flex gap-2 lg:gap-4">
                  {Array.from({ length: CARD_COUNT }, (_, i) => {
                    const isRevealed = communityCards?.[i] != null;
                    const cardKey = `${handNumber}-b1-card-${i}-${isRevealed ? "shown" : "hidden"}`;
                    return (
                      <div key={cardKey} className={isRevealed ? "animate-card-deal-in" : ""} style={{ animationDelay: isRevealed ? `${i * 0.08}s` : "0s" }}>
                        <Card
                          card={communityCards?.[i]}
                          className="w-[60px] h-[84px] lg:w-[80px] lg:h-[112px] rounded-xl shadow-xl"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Board 2</div>
                <div className="flex gap-2 lg:gap-4">
                  {Array.from({ length: CARD_COUNT }, (_, i) => {
                    const isRevealed = communityCards2?.[i] != null;
                    const cardKey = `${handNumber}-b2-card-${i}-${isRevealed ? "shown" : "hidden"}`;
                    return (
                      <div key={cardKey} className={isRevealed ? "animate-card-deal-in" : ""} style={{ animationDelay: isRevealed ? `${i * 0.08}s` : "0s" }}>
                        <Card
                          card={communityCards2?.[i]}
                          className="w-[60px] h-[84px] lg:w-[80px] lg:h-[112px] rounded-xl shadow-xl"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Run-it board — all runs stacked along Y axis ── */}
            {isRunItDealing && (
              <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 z-10 w-[420px] lg:w-[560px]">
                <RunItBoard
                  runResults={runResults}
                  handNumber={handNumber}
                  runDealStartedAt={runDealStartedAt!}
                  knownCardCount={knownCardCount}
                />
              </div>
            )}

            {/* Pot Display — visible whenever pot > 0 (voting, active play, and throughout showdown) */}
            {(pot ?? 0) > 0 && (
              <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center group">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-black mb-1.5 opacity-80">Total Pot</div>
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="px-10 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 shadow-lg text-white font-mono font-black text-xl lg:text-2xl transition-all group-hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] group-hover:-translate-y-0.5"
                >
                  {formatCents(pot ?? 0)}
                </motion.div>
              </div>
            )}

            {/* Winner celebration banner — normal showdown only (no run-it board) */}
            <AnimatePresence>
              {isShowdown && !isRunItShowdown && winners && winners.length > 0 && (
                <div className="absolute inset-x-0 top-[15%] flex justify-center z-30 pointer-events-none">
                  <WinnerBanner winners={winners} players={players} variant="desktop" />
                </div>
              )}
            </AnimatePresence>

            {/* 7-2 Offsuit announcement banner */}
            <AnimatePresence>
              {sevenTwoAnnouncement && (
                <div className="absolute inset-x-0 top-[5%] flex justify-center z-[55] pointer-events-none">
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
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7, y: -16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                    className="px-10 py-5 rounded-3xl text-white font-black text-xl lg:text-2xl shadow-2xl"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                      boxShadow: "0 0 50px rgba(124,58,237,0.5), 0 20px 40px rgba(0,0,0,0.5)",
                    }}
                  >
                    Running it {RUN_LABELS[runAnnouncement - 1]}!
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Bomb pot voting panel */}
            <AnimatePresence>
              {bombPotVote && (
                <div className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none">
                  <div className="pointer-events-auto">
                    <BombPotVotingPanel
                      vote={bombPotVote}
                      players={players}
                      viewingPlayerId={viewingPlayerId}
                      bigBlind={blinds?.big ?? 25}
                      onApprove={() => onVoteBombPot?.(true)}
                      onReject={() => onVoteBombPot?.(false)}
                      variant="desktop"
                    />
                  </div>
                </div>
              )}
            </AnimatePresence>

            {/* Bomb pot announcement banner */}
            <AnimatePresence>
              {bombPotAnnouncement && (
                <div className="absolute inset-0 flex items-center justify-center z-[76] pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7, y: -16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className="px-10 py-5 rounded-3xl text-white font-black text-xl lg:text-2xl shadow-2xl"
                    style={{
                      background: "linear-gradient(135deg, #1e1b4b, #312e81)",
                      boxShadow: "0 0 50px rgba(99,102,241,0.5), 0 20px 40px rgba(0,0,0,0.5)",
                    }}
                  >
                    <div className="text-center">BOMB POT!</div>
                    <div className="text-sm text-indigo-200 text-center mt-1 font-normal">
                      {bombPotAnnouncement.anteBB}x BB ante next hand
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Voting overlay */}
            <AnimatePresence>
              {isVoting && (
                <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/50 backdrop-blur-sm rounded-[94px]">
                  <VotingPanel
                    votes={runItVotes}
                    players={players}
                    viewingPlayerId={viewingPlayerId}
                    onVote={onVoteRun}
                    votingStartedAt={votingStartedAt}
                    canVote={viewerCanVote}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Dealer Button */}
          {dealerIndex >= 0 && (
            <DealerButton seatIndex={dealerIndex} totalSeats={TOTAL_SEATS} geometry={g} />
          )}

          {/* Seats */}
          {[...Array(TOTAL_SEATS)].map((_, i) => (
            <Seat
              key={i}
              seatIndex={i}
              totalSeats={TOTAL_SEATS}
              geometry={g}
              player={players[i] ?? null}
              isYou={players[i]?.isYou ?? false}
              isDealer={i === dealerIndex}
              isCurrentActor={players[i]?.isCurrentActor ?? false}
              onSitDown={onSitDown}
              seatSize={110}
              handNumber={handNumber}
            />
          ))}

          {/* Bet chip stacks */}
          <BetChipsLayer
            players={players as any}
            totalSeats={TOTAL_SEATS}
            geometry={g}
            bigBlind={blinds?.big}
            sweepMode={streetSweeping}
          />

          {/* Winner chips — animate from pot to winner seat(s), per run if multi-run */}
          <AnimatePresence>
            {isShowdown && winners && winners.length > 0 && containerWidth > 0 && (
              <WinnerChipsAnimation
                key={`${handNumber}-winner-chips`}
                winners={winners}
                runResults={isRunItShowdown ? runResults : undefined}
                knownCardCount={isRunItShowdown ? knownCardCount : undefined}
                players={players as any}
                totalSeats={TOTAL_SEATS}
                geometry={g}
                containerWidth={containerWidth}
                handNumber={handNumber}
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

        {/* Table Info Bar */}
        <div className="absolute bottom-4 left-6 hidden lg:flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/85 dark:bg-[rgba(3,7,18,0.85)] border border-gray-200/50 dark:border-white/[0.06] backdrop-blur-md shadow-xl animate-slide-up">
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
            <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30">
              7-2: ON • {sevenTwoBountyBB}x BB
            </div>
          )}
          {isBombPotHand && (
            <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              BOMB POT
            </div>
          )}
          {/* Propose bomb pot — 💣 icon button + popover */}
          {!bombPotVote && !_bombPotNextHand && viewingPlayerId && !bombPotCooldown.includes(viewingPlayerId) && (
            <div className="relative" ref={bombProposePanelRef}>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setBombProposePanelOpen((o) => !o)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                style={{
                  background: bombProposePanelOpen ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.22)",
                  border: "1px solid rgba(99,102,241,0.45)",
                  backdropFilter: "blur(8px)",
                }}
              >
                💣
              </motion.button>

              <AnimatePresence>
                {bombProposePanelOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 400, damping: 26 }}
                    className="absolute bottom-full mb-2 left-0 flex flex-col gap-1.5 p-2 rounded-2xl z-10"
                    style={{
                      background: "rgba(15,17,30,0.97)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 -8px 32px rgba(99,102,241,0.25)",
                    }}
                  >
                    <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest px-1">
                      Bomb Pot
                    </div>
                    <div className="flex gap-1">
                      {([1, 2, 3, 4, 5] as const).map((n) => (
                        <button
                          key={n}
                          onClick={() => { onProposeBombPot?.(n); setBombProposePanelOpen(false); }}
                          className="px-2 py-1 rounded-lg text-[10px] font-black transition-colors hover:bg-indigo-500/30"
                          style={{
                            background: "rgba(99,102,241,0.18)",
                            color: "#a5b4fc",
                            border: "1px solid rgba(99,102,241,0.3)",
                          }}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Bottom hand panel + actions */}
      {youPlayer && (
        <div className={`flex-shrink-0 relative overflow-visible backdrop-blur-xl border-t shadow-[0_-20px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_-20px_40px_rgba(0,0,0,0.4)] z-20 transition-all duration-300 ${
          isYourTurn
            ? "animate-action-pulse bg-white dark:bg-[rgba(3,7,18,0.97)] border-red-500/50"
            : "bg-white/95 dark:bg-[rgba(3,7,18,0.95)] border-gray-200/50 dark:border-white/[0.06]"
        }`}>
          <div className="flex items-center gap-8 px-8 py-5 max-w-6xl mx-auto">

            {/* Hole cards area */}
            <div className="flex-1 flex flex-col items-center relative z-10" style={{ marginTop: hasHoleCards ? -32 : 0 }}>
              {hasHoleCards ? (
                <>
                  <HoleCards
                    key={handNumber}
                    cards={holeCards}
                    cardHeight={168}
                    autoReveal={autoFlip}
                    onRevealChange={handleRevealChange}
                    canRevealToOthers={canShowCards}
                    revealedToOthersIndices={myRevealedCardIndices}
                    onRevealToOthers={onRevealCard}
                  />
                  <button
                    onClick={() => setAutoFlip((a) => !a)}
                    className={`mt-2 flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors ${
                      autoFlip
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 dark:bg-white/[0.07] text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12]"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoFlip ? "bg-white" : "bg-gray-300 dark:bg-gray-600"}`} />
                    auto peel
                  </button>
                </>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-600 font-bold uppercase tracking-widest py-8">
                  Waiting for deal...
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Hand</span>
              <span className="text-base font-black text-gray-900 dark:text-white">
                {bothRevealed ? (handStrength ?? "—") : "—"}
              </span>
              <span className="font-mono font-black text-gray-900 dark:text-white text-xl">
                {formatCents(youPlayer.stack)}
              </span>
              {(youPlayer.currentBet ?? 0) > 0 && (
                <span className="text-xs font-mono text-yellow-600 dark:text-yellow-400">
                  Bet: {formatCents(youPlayer.currentBet!)}
                </span>
              )}
              <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-md font-black uppercase">You</span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 flex-shrink-0 relative">
              {(isWaiting || (isShowdown && showNextHand)) && isAdmin && (
                <>
                  {isShowdown && showdownCountdown != null && (
                    <p className="text-xs text-amber-500 text-center font-bold">
                      Next hand in {showdownCountdown}s...
                    </p>
                  )}
                  {isWaiting && (
                    <>
                      <div className="flex items-center justify-between gap-4 px-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">⏱ Turn timer</span>
                        <button
                          onClick={() => onToggleTimer?.(!timerEnabled)}
                          className={`relative w-10 h-5 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none ${
                            timerEnabled ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700"
                          }`}
                          aria-label={timerEnabled ? "Disable turn timer" : "Enable turn timer"}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                            style={{ left: timerEnabled ? "calc(100% - 18px)" : "2px" }}
                          />
                        </button>
                      </div>
                      {handNumber === 0 && (
                        <div className="flex items-center justify-between gap-2 px-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">🃏 7-2 bounty</span>
                          <div className="flex gap-1">
                            {([0, 1, 2, 3] as const).map((n) => (
                              <button
                                key={n}
                                onClick={() => onSetSevenTwoBounty?.(n)}
                                className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors ${
                                  sevenTwoBountyBB === n
                                    ? "bg-red-600 text-white"
                                    : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700"
                                }`}
                              >
                                {n === 0 ? "Off" : `${n}×`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <button
                    onClick={onStartHand}
                    className="h-12 px-10 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-sm shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
                  >
                    {isShowdown ? "Next Hand" : "Start Game"}
                  </button>
                </>
              )}

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

                  {/* Timer bar */}
                  {isYourTurn && timerEnabled && (
                    <TimerBar startedAt={turnStartedAt} variant="turn" />
                  )}

                  <div className={`flex gap-3 transition-opacity duration-200 ${!isYourTurn ? "opacity-40 pointer-events-none" : ""}`}>
                    {/* Fold button with confirmation when not facing a bet */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (canCheck) { setFoldConfirm(true); }
                          else { onFold?.(); }
                        }}
                        className="h-12 px-7 rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold text-sm transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Fold
                      </button>
                      <AnimatePresence>
                        {foldConfirm && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setFoldConfirm(false)} />
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
                        onClick={onCheck}
                        className="h-12 px-7 rounded-xl bg-gray-200 dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-bold text-sm transition-colors hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Check
                      </button>
                    ) : (
                      <button
                        onClick={onCall}
                        className="h-12 px-7 rounded-xl bg-gray-200 dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-bold text-sm transition-colors hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Call {formatCents(callAmount)}
                      </button>
                    )}

                    {canRaise && (
                      <div className="relative">
                        <button
                          onClick={() => setRaiseOpen((o) => !o)}
                          className="h-12 px-7 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-sm shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
                        >
                          {betOrRaiseLabel}
                        </button>
                        <AnimatePresence>
                          {raiseOpen && (
                            <DesktopRaisePopover
                              pot={pot ?? 0}
                              stack={viewerStack}
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
                        className="h-12 px-7 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-sm shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
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

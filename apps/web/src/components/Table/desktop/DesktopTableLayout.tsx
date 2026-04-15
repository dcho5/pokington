"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { computeSeatCoords, type TableGeometry } from "lib/seatLayout";
import { useColorScheme } from "hooks/useColorScheme";
import { useRaiseAmount } from "hooks/useRaiseAmount";
import PokerChip from "components/poker/PokerChip";
import Card from "components/poker/Card";
import HoleCards from "components/poker/HoleCards";
import DealerButton from "./DealerButton";
import { BetChipsLayer } from "./BetChips";
import { WinnerChipsAnimation } from "./WinnerChipsAnimation";
import RunItBoard from "../RunItBoard";

import AnnouncementBanner from "../AnnouncementBanner";
import WinnerBanner from "../WinnerBanner";
import VotingPanel, { RUN_LABELS } from "../VotingPanel";
import SevenTwoAnnouncement from "../SevenTwoAnnouncement";
import BombPotVotingPanel from "../BombPotVotingPanel";
import { SevenTwoBountyChips } from "./SevenTwoBountyChips";
import { formatCents } from "lib/formatCents";
import type { HandIndicator } from "lib/handIndicators";
import { useGameStore } from "store/useGameStore";
import type { TableLayoutProps } from "../TableLayout";
import { isActivePhase } from "lib/phases";
import {
  getCenterBoardMode,
  isRunItShowdownSequence,
  shouldRenderRunItBoard,
} from "lib/tableVisualState";
import { BOMB_POT_ANTE_BB_VALUES } from "constants/game";
import {
  getDesktopTableLayoutProfile,
  type DesktopBombPotCenterStage,
  type DesktopRunItCenterStage,
  type DesktopStandardCenterStage,
} from "lib/desktopTableLayout";

const Seat = dynamic(() => import("./Seat"), { ssr: false });

const TOTAL_SEATS = 10;

function DesktopHandIndicatorFan({ indicators }: { indicators: HandIndicator[] }) {
  if (indicators.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Hand</span>
        <span className="font-black text-gray-500 dark:text-gray-400 text-[18px]">--</span>
      </div>
    );
  }

  if (indicators.length === 1) {
    const indicator = indicators[0];
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">{indicator.title}</span>
        <span className="font-black text-gray-900 dark:text-white text-[18px]">
          {indicator.label ?? "--"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">
        Hands
      </span>
      <div className="relative h-[92px] w-[220px]">
        {indicators.map((indicator, index) => {
          const center = (indicators.length - 1) / 2;
          const offset = (index - center) * 32;
          const rotate = (index - center) * 7;
          return (
            <div
              key={indicator.id}
              className="absolute left-1/2 top-0 w-[148px] rounded-[20px] border px-3 py-2 text-center shadow-[0_16px_30px_rgba(15,23,42,0.16)] backdrop-blur-md bg-white/95 dark:bg-slate-900/92"
              style={{
                transform: `translateX(calc(-50% + ${offset}px)) rotate(${rotate}deg)`,
                transformOrigin: "bottom center",
                borderColor: "rgba(148,163,184,0.22)",
                zIndex: index + 1,
              }}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-gray-400">
                {indicator.title}
              </div>
              <div className="mt-1 text-[16px] font-black text-gray-900 dark:text-white">
                {indicator.label ?? "--"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Desktop Raise Popover (text input + presets + ±, live validation) ──
function DesktopRaisePopover({
  pot,
  stack,
  currentBet = 0,
  minRaise,
  bigBlind,
  isFirstBet,
  onConfirm,
  onDismiss,
}: {
  pot: number;
  stack: number;
  currentBet?: number;
  minRaise: number;
  bigBlind: number;
  isFirstBet: boolean;
  onConfirm: (amount: number) => void;
  onDismiss: () => void;
}) {
  const { amount, setAmount, increment: bbIncrement, lowerBound, presets, clamp, allInTotal } = useRaiseAmount({ minRaise, stack, pot, bigBlind, currentBet });
  const [rawInput, setRawInput] = useState((lowerBound / 100).toFixed(2));
  const [inputError, setInputError] = useState(false);
  const incrementLabel = formatCents(bbIncrement);

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
      if (cents >= lowerBound && cents <= allInTotal) {
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
      <div className="absolute inset-0 z-40" onClick={onDismiss} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute bottom-full right-0 mb-2 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4"
      >
        <div className="flex items-start justify-center gap-3 mb-1">
          <div className="w-12 flex flex-col items-center gap-1 flex-shrink-0">
            <button
              aria-label={`Decrease by ${incrementLabel}`}
              title={`Decrease by ${incrementLabel}`}
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-lg font-bold flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              onClick={() => applyAmount(amount - bbIncrement)}
            >−</button>
            <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">
              -{incrementLabel}
            </span>
          </div>
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
          <div className="w-12 flex flex-col items-center gap-1 flex-shrink-0">
            <button
              aria-label={`Increase by ${incrementLabel}`}
              title={`Increase by ${incrementLabel}`}
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-lg font-bold flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              onClick={() => applyAmount(amount + bbIncrement)}
            >+</button>
            <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">
              +{incrementLabel}
            </span>
          </div>
        </div>

        <div className="h-4 mb-2 text-center">
          {inputError && (
            <span className="text-[10px] text-red-500 font-bold">
              {formatCents(lowerBound)} – {formatCents(allInTotal)}
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

// ── Desktop Ledger Panel ──
function DesktopLedgerPanel({ onClose }: { onClose: () => void }) {
  const rows = useGameStore((s) => s.getLedgerRows());
  const payouts = useGameStore((s) => s.getPayoutInstructions());

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="absolute bottom-full mb-4 left-0 z-[90] w-[1170px] rounded-[36px] p-[30px] max-h-[1100px] overflow-y-auto"
      style={{
        background: "rgba(8,10,20,0.97)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 24px 72px rgba(0,0,0,0.58)",
      }}
    >
      <div className="flex items-center justify-between mb-6 px-1">
        <span className="text-[19px] font-black text-gray-400 uppercase tracking-[0.28em]">Session Ledger</span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xl font-bold">✕</button>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-600 text-xl text-center py-9">No players seated yet.</p>
      ) : (
        <>
          <div className="flex text-[16px] font-bold text-gray-600 uppercase tracking-[0.22em] mb-3 px-1">
            <span className="flex-1">Player</span>
            <span className="w-40 text-right">Buy-in</span>
            <span className="w-40 text-right">Cash-out</span>
            <span className="w-36 text-right">Net</span>
          </div>

          <div className="flex flex-col gap-2.5 mb-6">
            {rows.map((row) => {
              const netColor = row.net > 0 ? "#4ade80" : row.net < 0 ? "#f87171" : "#6b7280";
              const netPrefix = row.net > 0 ? "+" : "";
              return (
                <div
                  key={row.playerId}
                  className="flex items-center px-5 py-4 rounded-[26px]"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-white text-[23px] font-semibold truncate">{row.name}</span>
                    {row.isSeated && (
                      <span className="text-[15px] font-bold px-3 py-1 rounded-full flex-shrink-0"
                        style={{ background: "rgba(34,197,94,0.12)", color: "#86efac", border: "1px solid rgba(34,197,94,0.2)" }}>
                        in
                      </span>
                    )}
                  </div>
                  <span className="w-40 text-right text-[22px] text-gray-500 font-mono">{formatCents(row.totalBuyIn)}</span>
                  <span className="w-40 text-right text-[22px] text-gray-400 font-mono">{formatCents(row.totalCashOut)}</span>
                  <span className="w-36 text-right text-[27px] font-black font-mono" style={{ color: netColor }}>
                    {netPrefix}{formatCents(Math.abs(row.net))}
                  </span>
                </div>
              );
            })}
          </div>

          {payouts.length > 0 && (
            <>
              <div className="h-px mb-5" style={{ background: "rgba(255,255,255,0.07)" }} />
              <div className="text-[16px] font-bold text-gray-600 uppercase tracking-[0.22em] mb-3 px-1">Payouts</div>
              <div className="flex flex-col gap-3">
                {payouts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4 rounded-[26px]"
                    style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                    <span className="text-[22px] text-gray-300">
                      <span className="font-bold text-red-400">{p.fromName}</span>
                      <span className="text-gray-600"> → </span>
                      <span className="font-bold text-green-400">{p.toName}</span>
                    </span>
                    <span className="text-[27px] font-black text-white font-mono ml-4">{formatCents(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}

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
  const [autoFlip, setAutoFlip] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [foldConfirm, setFoldConfirm] = useState(false);
  const [bombProposePanelOpen, setBombProposePanelOpen] = useState(false);
  const bombProposePanelRef = useRef<HTMLDivElement>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const ledgerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!ledgerOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (ledgerRef.current && !ledgerRef.current.contains(e.target as Node)) {
        setLedgerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [ledgerOpen]);
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
  const minPlayerStack = players.reduce((min, p) => {
    if (p == null || (p.stack ?? 0) <= 0) return min;
    return min === undefined ? p.stack : Math.min(min, p.stack);
  }, undefined as number | undefined);

  const activeIdx = players.findIndex((p) => p?.isCurrentActor);
  const { x: ax, y: ay } =
    activeIdx >= 0
      ? computeSeatCoords(activeIdx, TOTAL_SEATS, g)
      : { x: 0, y: -1 };
  const chipGlowAngle = Math.atan2(ay, ax) * (180 / Math.PI);

  const CARD_COUNT = 5;
  const isVoting = phase === "voting";
  const isPlaying = phase && phase !== "waiting" && phase !== "showdown" && phase !== "voting";
  const hasHoleCards = holeCards != null;
  const betOrRaiseLabel = isFirstBet ? "Bet" : "Raise";
  const bombPotAnnouncementIsCanceled = bombPotAnnouncement?.kind === "canceled";
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
    <div className="flex flex-col h-full w-full overflow-hidden bg-gray-100 dark:bg-gray-950 transition-colors duration-500">

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
              {isShowdown && !isRunItShowdown && winners && winners.length > 0 && (
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
                    eyebrow="All-in Showdown"
                    title={`Running it ${RUN_LABELS[runAnnouncement - 1]}`}
                    detail={
                      runAnnouncement === 1
                        ? "A single board will settle the pot."
                        : `${runAnnouncement} boards will decide this hand.`
                    }
                    badge={`${runAnnouncement} ${runAnnouncement === 1 ? "board" : "boards"}`}
                    tone="violet"
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

          {/* Dealer Button */}
          {dealerIndex >= 0 && (
            <DealerButton
              seatIndex={dealerIndex}
              totalSeats={TOTAL_SEATS}
              geometry={g}
              orbitFactor={desktopLayout.seat.dealerOrbitFactor}
            />
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
                runResults={isRunItShowdown ? runResults : undefined}
                knownCardCount={isRunItShowdown ? knownCardCount : undefined}
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
            <div className="relative" ref={ledgerRef}>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setLedgerOpen((o) => !o)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-lg"
                style={{
                  background: ledgerOpen ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                }}
                aria-label="Open session ledger"
              >
                💰
              </motion.button>
              <AnimatePresence>
                {ledgerOpen && <DesktopLedgerPanel onClose={() => setLedgerOpen(false)} />}
              </AnimatePresence>
            </div>

            {!bombPotVote && !_bombPotNextHand && viewingPlayerId && !bombPotCooldown.includes(viewingPlayerId) && (
              <div className="relative" ref={bombProposePanelRef}>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setBombProposePanelOpen((o) => !o)}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
                  style={{
                    background: bombProposePanelOpen ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.22)",
                    border: "1px solid rgba(99,102,241,0.45)",
                    backdropFilter: "blur(8px)",
                  }}
                  aria-label="Propose bomb pot"
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
                      className="absolute bottom-full mb-4 left-0 flex flex-col gap-6 p-[30px] rounded-[36px] z-[80] w-[678px]"
                      style={{
                        background: "rgba(15,17,30,0.97)",
                        border: "1px solid rgba(99,102,241,0.3)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 -8px 32px rgba(99,102,241,0.25)",
                      }}
                    >
                      <div className="px-1">
                        <div className="text-[16px] font-black text-indigo-400 uppercase tracking-[0.22em]">
                          Bomb Pot
                        </div>
                        <div className="mt-1 text-[21px] font-semibold text-indigo-100">
                          Players ante in and two boards are dealt.
                        </div>
                        <div className="mt-1 text-[16px] text-indigo-200/70">
                          Choose the blind multiple for next hand.
                        </div>
                      </div>
                      <div className="flex gap-3">
                        {BOMB_POT_ANTE_BB_VALUES.map((n) => {
                          const anteCents = n * (blinds?.big ?? 25);
                          const disabled = minPlayerStack !== undefined && anteCents > minPlayerStack;

                          return (
                            <motion.button
                              key={n}
                              whileTap={disabled ? undefined : { scale: 0.94 }}
                              disabled={disabled}
                              onClick={() => {
                                if (!disabled) {
                                  onProposeBombPot?.(n);
                                  setBombProposePanelOpen(false);
                                }
                              }}
                              className="flex-1 h-[162px] rounded-[32px] flex flex-col items-center justify-center gap-3"
                              style={{
                                background: disabled ? "rgba(99,102,241,0.04)" : "rgba(99,102,241,0.12)",
                                border: `1px solid ${disabled ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.3)"}`,
                                opacity: disabled ? 0.35 : 1,
                              }}
                            >
                              <span className="text-[38px] leading-none font-black text-indigo-200">{n}× BB</span>
                              <span className="text-[21px] font-bold text-indigo-400">{formatCents(anteCents)}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                      <div className="px-1 text-[16px] text-indigo-200/70">
                        Sizes are unavailable if any next-hand stack cannot fully cover the ante.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                    autoReveal={autoFlip}
                    onRevealChange={setBothRevealed}
                    canRevealToOthers={canShowCards}
                    revealedToOthersIndices={myRevealedCardIndices}
                    onRevealToOthers={onRevealCard}
                    sevenTwoEligible={sevenTwoEligible}
                    onPeekCard={onPeekCard}
                  />
                  <button
                    onClick={() => setAutoFlip((a) => !a)}
                    className={`mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors ${
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

            <div
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
              style={{ minWidth: handIndicators.length > 1 ? 240 : 120 }}
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

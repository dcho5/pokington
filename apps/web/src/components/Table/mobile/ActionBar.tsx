"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "lib/formatCents";
import {
  MOBILE_OVERLAY_Z,
  MOBILE_SHELL,
  getMobileSheetPaddingBottom,
} from "lib/mobileShell.mjs";
import { useRaiseAmount } from "hooks/useRaiseAmount";

interface RaiseSheetProps {
  pot: number;
  stack: number;
  currentBet?: number;
  minRaise: number;
  bigBlind: number;
  isFirstBet: boolean;
  onConfirm: (amount: number) => void;
  onDismiss: () => void;
}

const RaiseSheet: React.FC<RaiseSheetProps> = ({
  pot,
  stack,
  currentBet = 0,
  minRaise,
  bigBlind,
  isFirstBet,
  onConfirm,
  onDismiss,
}) => {
  const { amount, setAmount, increment, lowerBound, presets, clamp, allInTotal } = useRaiseAmount({ minRaise, stack, pot, bigBlind, currentBet });
  const label = isFirstBet ? "Bet" : "Raise to";
  const isAllInOnly = lowerBound >= allInTotal;
  const incrementLabel = formatCents(increment);

  return (
    <>
      <motion.div
        className="overlay-scrim-strong absolute inset-0"
        style={{ zIndex: MOBILE_OVERLAY_Z.sheetScrim }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />

      <motion.div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl
          elevated-surface-light border-t
          px-4 pt-4"
        style={{
          zIndex: MOBILE_OVERLAY_Z.sheet,
          paddingBottom: getMobileSheetPaddingBottom(),
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        onDragEnd={(_event: unknown, info: { offset: { y: number } }) => {
          if (info.offset.y > MOBILE_SHELL.sheetDismissOffsetPx) onDismiss();
        }}
      >
        <div className="surface-content">
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />

        <div className="flex items-start justify-center gap-3 mb-4">
          <div className="w-14 flex flex-col items-center gap-1">
            <button
              disabled={isAllInOnly}
              aria-label={`Decrease by ${incrementLabel}`}
              title={`Decrease by ${incrementLabel}`}
              className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-2xl font-bold flex items-center justify-center disabled:opacity-30"
              onClick={() => setAmount(clamp(amount - increment))}
            >
              −
            </button>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">
              -{incrementLabel}
            </span>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-mono font-black text-gray-900 dark:text-white">
              {formatCents(amount)}
            </p>
            {isAllInOnly && (
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest mt-0.5">All-in</p>
            )}
          </div>
          <div className="w-14 flex flex-col items-center gap-1">
            <button
              disabled={isAllInOnly}
              aria-label={`Increase by ${incrementLabel}`}
              title={`Increase by ${incrementLabel}`}
              className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-2xl font-bold flex items-center justify-center disabled:opacity-30"
              onClick={() => setAmount(clamp(amount + increment))}
            >
              +
            </button>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">
              +{incrementLabel}
            </span>
          </div>
        </div>

        <div className="px-2 mb-4">
          {isAllInOnly ? (
            <div className="h-2 rounded-full bg-red-500" />
          ) : (
            <input
              type="range"
              min={lowerBound}
              max={allInTotal}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-red-500 h-2"
            />
          )}
        </div>

        {!isAllInOnly && (
          <div className="flex gap-1.5 mb-4">
            {presets.map((p) => (
              <button
                key={p.label}
                className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[11px] font-bold text-gray-700 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
                onClick={() => setAmount(clamp(p.value))}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <button
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-base shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-shadow"
          onClick={() => { onConfirm(amount); onDismiss(); }}
        >
          {label} {formatCents(amount)}
        </button>
        </div>
      </motion.div>
    </>
  );
};

function FoldConfirmSheet({ onConfirm, onDismiss }: { onConfirm: () => void; onDismiss: () => void }) {
  return (
    <>
      <motion.div
        className="overlay-scrim-strong absolute inset-0"
        style={{ zIndex: MOBILE_OVERLAY_Z.sheetScrim }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />
      <motion.div
        className="elevated-surface-light absolute bottom-0 left-0 right-0 rounded-t-2xl border-t px-4 pt-4 pb-6"
        style={{ zIndex: MOBILE_OVERLAY_Z.sheet }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className="surface-content">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            You can check for free. Fold anyway?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => { onConfirm(); onDismiss(); }}
              className="flex-1 h-12 rounded-xl bg-red-500 text-white font-bold text-sm"
            >
              Fold
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

interface ActionBarProps {
  isYourTurn?: boolean;
  callAmount?: number;
  pot?: number;
  stack?: number;
  currentBet?: number;
  minRaise?: number;
  bigBlind?: number;
  canCheck?: boolean;
  canRaise?: boolean;
  canAllIn?: boolean;
  onAllIn?: () => void;
  phase?: string;
  isFirstBet?: boolean;
  isAdmin?: boolean;
  onFold?: () => void;
  onCall?: () => void;
  onCheck?: () => void;
  onRaise?: (amount: number) => void;
  onStartHand?: () => void;
  showdownCountdown?: number | null;
  showNextHand?: boolean;
  players?: Array<{ id?: string; name: string; isFolded?: boolean; stack?: number } | null>;
  handNumber?: number;
  isBombPotHand?: boolean;
}

const ActionBar: React.FC<ActionBarProps> = ({
  isYourTurn = false,
  callAmount = 0,
  pot = 0,
  stack = 0,
  currentBet = 0,
  minRaise = 0,
  bigBlind = 25,
  canCheck = false,
  canRaise = true,
  canAllIn = false,
  onAllIn,
  phase,
  isFirstBet = false,
  isAdmin = false,
  showNextHand = true,
  players = [],
  handNumber = 0,
  isBombPotHand: _isBombPotHand = false,
  onFold,
  onCall,
  onCheck,
  onRaise,
  onStartHand,
  showdownCountdown,
}) => {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [foldConfirm, setFoldConfirm] = useState(false);

  useEffect(() => {
    if (!isYourTurn || !canRaise) {
      setRaiseOpen(false);
    }
  }, [canRaise, isYourTurn]);

  const isWaiting = !phase || phase === "waiting";
  const isShowdown = phase === "showdown";
  const betOrRaiseLabel = isFirstBet ? "Bet" : "Raise";
  const eligiblePlayerCount = players.filter((p) => p != null && (p.stack ?? 1) > 0).length;

  if (isWaiting || isShowdown) {
    return (
      <div className="w-full z-30" style={{ padding: "10px 16px" }}>
        {isAdmin && (isWaiting || isShowdown) && (
          <>
            {eligiblePlayerCount < 2 ? (
              <div className="w-full h-[52px] xs:h-[56px] rounded-2xl flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-sm font-semibold">
                Waiting for more players…
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onStartHand}
                className="w-full h-[52px] xs:h-[56px] rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-lg shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
              >
                {isShowdown ? "Next Hand" : "Start Game"}
              </motion.button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={`w-full z-30 transition-all duration-300 ${isYourTurn ? "animate-action-pulse rounded-t-xl" : ""}`}
        style={{
          paddingTop: "10px",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingBottom: "10px",
        }}
      >
        <div className={`flex gap-2 transition-opacity duration-200 ${!isYourTurn ? "opacity-40 pointer-events-none" : ""}`}>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (canCheck) {
                setFoldConfirm(true);
              } else {
                onFold?.();
              }
            }}
            className="flex-1 h-[52px] xs:h-[56px] rounded-2xl bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold text-sm xs:text-lg whitespace-nowrap"
          >
            Fold
          </motion.button>

          {canCheck ? (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setRaiseOpen(false);
                onCheck?.();
              }}
              className="flex-1 h-[52px] xs:h-[56px] rounded-2xl bg-gray-200 dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-bold text-sm xs:text-lg whitespace-nowrap"
            >
              Check
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onCall}
              className="flex-1 h-[52px] xs:h-[56px] rounded-2xl bg-gray-200 dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-bold text-sm xs:text-lg whitespace-nowrap"
            >
              Call {formatCents(callAmount)}
            </motion.button>
          )}

          {canRaise && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setRaiseOpen(true)}
              className="flex-1 h-[52px] xs:h-[56px] rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-sm xs:text-lg whitespace-nowrap shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
            >
              {betOrRaiseLabel}
            </motion.button>
          )}

          {!canRaise && canAllIn && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onAllIn}
              className="flex-1 h-[52px] xs:h-[56px] rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-sm xs:text-lg whitespace-nowrap shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
            >
              All-in
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {raiseOpen && (
          <RaiseSheet
            pot={pot}
            stack={stack}
            currentBet={currentBet}
            minRaise={minRaise}
            bigBlind={bigBlind}
            isFirstBet={isFirstBet}
            onConfirm={(amount) => onRaise?.(amount)}
            onDismiss={() => setRaiseOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {foldConfirm && (
          <FoldConfirmSheet
            onConfirm={() => onFold?.()}
            onDismiss={() => setFoldConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default ActionBar;

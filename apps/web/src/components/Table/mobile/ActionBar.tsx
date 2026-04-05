"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "lib/formatCents";
import TimerBar from "../TimerBar";
import VotingPanel from "../VotingPanel";
import { useRaiseAmount } from "hooks/useRaiseAmount";

interface RaiseSheetProps {
  pot: number;
  stack: number;
  minRaise: number;
  bigBlind: number;
  isFirstBet: boolean;
  onConfirm: (amount: number) => void;
  onDismiss: () => void;
}

const RaiseSheet: React.FC<RaiseSheetProps> = ({
  pot,
  stack,
  minRaise,
  bigBlind,
  isFirstBet,
  onConfirm,
  onDismiss,
}) => {
  const { amount, setAmount, increment, lowerBound, presets, clamp } = useRaiseAmount({ minRaise, stack, pot, bigBlind });
  const label = isFirstBet ? "Bet" : "Raise to";
  // When lowerBound === stack the player's only legal move is to go all-in
  const isAllInOnly = lowerBound >= stack;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />

      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl
          bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl
          border-t border-gray-200/50 dark:border-white/[0.06]
          px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80) onDismiss();
        }}
      >
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />

        {/* Amount display with ± nudge buttons */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            disabled={isAllInOnly}
            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-2xl font-bold flex items-center justify-center disabled:opacity-30"
            onClick={() => setAmount(clamp(amount - increment))}
          >
            −
          </button>
          <div className="flex-1 text-center">
            <p className="text-2xl font-mono font-black text-gray-900 dark:text-white">
              {formatCents(amount)}
            </p>
            {isAllInOnly && (
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest mt-0.5">All-in</p>
            )}
          </div>
          <button
            disabled={isAllInOnly}
            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-2xl font-bold flex items-center justify-center disabled:opacity-30"
            onClick={() => setAmount(clamp(amount + increment))}
          >
            +
          </button>
        </div>

        {/* Slider — fully filled static bar when all-in only */}
        <div className="px-2 mb-4">
          {isAllInOnly ? (
            <div className="h-2 rounded-full bg-red-500" />
          ) : (
            <input
              type="range"
              min={lowerBound}
              max={stack}
              step={increment}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-red-500 h-2"
            />
          )}
        </div>

        {/* Presets — hidden when all-in is the only option */}
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
      </motion.div>
    </>
  );
};

// ── Fold confirmation sheet (mobile) ──
function FoldConfirmSheet({ onConfirm, onDismiss }: { onConfirm: () => void; onDismiss: () => void }) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-white/[0.06] px-4 pt-4 pb-6"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
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
      </motion.div>
    </>
  );
}

interface ActionBarProps {
  isYourTurn?: boolean;
  waitingFor?: string;
  callAmount?: number;
  pot?: number;
  stack?: number;
  minRaise?: number;
  bigBlind?: number;
  canCheck?: boolean;
  canRaise?: boolean;
  canAllIn?: boolean;
  onAllIn?: () => void;
  phase?: string;
  isFirstBet?: boolean;
  isAdmin?: boolean;
  timerEnabled?: boolean;
  onToggleTimer?: (enabled: boolean) => void;
  onFold?: () => void;
  onCall?: () => void;
  onCheck?: () => void;
  onRaise?: (amount: number) => void;
  onStartHand?: () => void;
  showdownCountdown?: number | null;
  turnStartedAt?: number | null;
  // Run-it-multiple-times
  runItVotes?: Record<string, 1 | 2 | 3>;
  onVoteRun?: (count: 1 | 2 | 3) => void;
  runAnnouncement?: 1 | 2 | 3 | null;
  votingStartedAt?: number | null;
  viewerCanVote?: boolean;
  showNextHand?: boolean;
  viewerPlayerId?: string; // id of the viewing player (to show their vote highlight)
  players?: Array<{ id?: string; name: string; isFolded?: boolean } | null>;
  sevenTwoBountyBB?: 0 | 1 | 2 | 3;
  onSetSevenTwoBounty?: (bountyBB: 0 | 1 | 2 | 3) => void;
  handNumber?: number;
  isBombPotHand?: boolean;
}

const ActionBar: React.FC<ActionBarProps> = ({
  isYourTurn = false,
  waitingFor,
  callAmount = 0,
  pot = 0,
  stack = 0,
  minRaise = 0,
  bigBlind = 25,
  canCheck = false,
  canRaise = true,
  canAllIn = false,
  onAllIn,
  phase,
  isFirstBet = false,
  isAdmin = false,
  timerEnabled = true,
  onToggleTimer,
  runItVotes = {},
  onVoteRun,
  runAnnouncement = null,
  votingStartedAt = null,
  viewerCanVote = false,
  showNextHand = true,
  viewerPlayerId,
  players = [],
  sevenTwoBountyBB = 0,
  onSetSevenTwoBounty,
  handNumber = 0,
  isBombPotHand: _isBombPotHand = false,
  onFold,
  onCall,
  onCheck,
  onRaise,
  onStartHand,
  showdownCountdown,
  turnStartedAt = null,
}) => {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [foldConfirm, setFoldConfirm] = useState(false);

  const isWaiting = !phase || phase === "waiting";
  const isShowdown = phase === "showdown";
  const isVoting = phase === "voting";
  const betOrRaiseLabel = isFirstBet ? "Bet" : "Raise";

  if (isVoting) {
    return (
      <VotingPanel
        votes={runItVotes}
        players={players}
        viewingPlayerId={viewerPlayerId}
        onVote={onVoteRun}
        votingStartedAt={votingStartedAt}
        canVote={viewerCanVote}
        variant="mobile"
      />
    );
  }

  if (isWaiting || isShowdown) {
    return (
      <div className="w-full z-30" style={{ padding: "10px 16px" }}>
        {isShowdown && showNextHand && (
          <p className="text-xs text-amber-500 text-center mb-2 font-bold">
            {showdownCountdown != null
              ? `Next hand in ${showdownCountdown}s...`
              : "Hand complete"}
          </p>
        )}

        {isAdmin && (isWaiting || showNextHand) && (
          <>
            {isWaiting && (
              <>
                <div className="flex items-center justify-between gap-4 px-1 mb-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">⏱ Turn timer</span>
                  <button
                    onClick={() => onToggleTimer?.(!timerEnabled)}
                    className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none ${
                      timerEnabled ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                    aria-label={timerEnabled ? "Disable turn timer" : "Enable turn timer"}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                      style={{ left: timerEnabled ? "calc(100% - 18px)" : "4px" }}
                    />
                  </button>
                </div>
                {handNumber === 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">🃏 7-2 bounty</span>
                      <div className="flex gap-1">
                        {([0, 1, 2, 3] as const).map((n) => (
                          <button
                            key={n}
                            onClick={() => onSetSevenTwoBounty?.(n)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-colors ${
                              sevenTwoBountyBB === n
                                ? "bg-red-600 text-white"
                                : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {n === 0 ? "Off" : `${n}×`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onStartHand}
              className="w-full h-[52px] xs:h-[56px] rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-lg shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
            >
              {isShowdown ? "Next Hand" : "Start Game"}
            </motion.button>
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
        {!isYourTurn && waitingFor && (
          <p className="text-xs text-gray-500 text-center mb-2">
            Waiting for {waitingFor}...
          </p>
        )}

        {isYourTurn && timerEnabled && (
          <TimerBar startedAt={turnStartedAt} variant="turn" className="mb-3" />
        )}

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
              onClick={onCheck}
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

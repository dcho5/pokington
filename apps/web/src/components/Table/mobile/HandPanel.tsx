"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HoleCards from "components/poker/HoleCards";
import { getAvatarColor, getInitials } from "lib/avatarColor";
import { formatCents } from "lib/formatCents";
import { isActivePhase } from "lib/phases";
import type { Player } from "types/player";
import type { Card as CardType } from "@pokington/shared";

interface HandPanelProps {
  player: Player | null;
  holeCards?: [CardType, CardType] | null;
  handStrength?: string | null;
  handNumber?: number;
  canRevealToOthers?: boolean;
  revealedToOthersIndices?: Set<0 | 1>;
  onRevealToOthers?: (index: 0 | 1) => void;
  sevenTwoEligible?: boolean;
  onPeekCard?: (index: 0 | 1) => void;
  onStandUp?: () => void;
  onQueueLeave?: () => void;
  leaveQueued?: boolean;
  phase?: string;
  currentBet?: number;
}

const HandPanel: React.FC<HandPanelProps> = ({
  player,
  holeCards,
  handStrength,
  handNumber = 0,
  canRevealToOthers = false,
  revealedToOthersIndices,
  onRevealToOthers,
  sevenTwoEligible = false,
  onPeekCard,
  onStandUp,
  onQueueLeave,
  leaveQueued,
  phase,
  currentBet = 0,
}) => {
  const [bothRevealed, setBothRevealed] = useState(false);
  const [autoFlip, setAutoFlip] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  if (!player) return null;

  const avatarColor = getAvatarColor(player.name);
  const initials = getInitials(player.name);

  return (
    <div className="px-3 pb-1">
      {/*
        Three-column row: [player info] [hole cards] [hand/stack]
        items-stretch makes the side panels fill the cards' height automatically.
      */}
      <div className="flex items-stretch gap-2">

        {/* Left: player identity + auto-flip toggle */}
        <div className="flex-1 min-w-0 flex flex-col justify-between bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/50 dark:border-white/[0.08] shadow-lg px-2 py-2">
          {/* Top: avatar + YOU + name */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              <span className="font-black text-white text-[9px] select-none">{initials}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[8px] bg-red-100 dark:bg-red-900/30 text-red-600 px-1 py-0.5 rounded font-black uppercase">
                You
              </span>
              <div className="text-[10px] font-bold text-gray-900 dark:text-white truncate mt-0.5">
                {player.name}
              </div>
            </div>
          </div>

          {/* Bottom: auto-flip toggle + leave seat */}
          <div className="flex gap-1">
            <button
              onClick={() => setAutoFlip((a) => !a)}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-colors ${
                autoFlip
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 dark:bg-white/[0.07] text-gray-400 dark:text-gray-500"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoFlip ? "bg-white" : "bg-gray-300 dark:bg-gray-600"}`} />
              peel
            </button>
            {onStandUp && (
              <button
                onClick={() => !leaveQueued && setLeaveConfirm(true)}
                className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-colors ${
                  leaveQueued
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-gray-100 dark:bg-white/[0.07] text-gray-400 dark:text-gray-500"
                }`}
                title={leaveQueued ? "Leaving after this hand" : "Leave seat"}
              >
                {leaveQueued ? "Leaving..." : "Leave"}
              </button>
            )}
          </div>
        </div>

        {/* Center: hole cards — taller than the side panels; gated before deal */}
        <div className="flex-shrink-0 flex items-center">
          {holeCards ? (
            <HoleCards
              key={handNumber}
              cards={holeCards}
              cardHeight={100}
              autoReveal={autoFlip}
              onRevealChange={setBothRevealed}
              canRevealToOthers={canRevealToOthers}
              revealedToOthersIndices={revealedToOthersIndices}
              onRevealToOthers={onRevealToOthers}
              sevenTwoEligible={sevenTwoEligible}
              onPeekCard={onPeekCard}
            />
          ) : (
            <div className="flex items-center justify-center" style={{ width: Math.round((100 * 5) / 7) * 2 + 10, height: 100 }}>
              <span className="text-[10px] text-gray-500 dark:text-gray-600 font-bold uppercase tracking-widest">
                No cards
              </span>
            </div>
          )}
        </div>

        {/* Right: hand strength + bet + stack */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/50 dark:border-white/[0.08] shadow-lg px-2 py-2.5 gap-1.5">
          {bothRevealed && handStrength && (
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Hand</div>
              <div className="text-[11px] font-black text-gray-900 dark:text-white">{handStrength}</div>
            </div>
          )}
          {currentBet > 0 && (
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Bet</div>
              <div className="font-mono font-black text-xs px-1.5 py-[1px] rounded-full bg-yellow-400 text-black">
                {formatCents(currentBet)}
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Stack</div>
            <div className="font-mono font-black text-gray-900 dark:text-white text-xs">
              {formatCents(player.stack)}
            </div>
          </div>
        </div>

      </div>

      {/* Leave confirmation sheet */}
      <AnimatePresence>
        {leaveConfirm && (() => {
          const blocked = isActivePhase(phase) && !(player.isFolded ?? false);
          return (
            <>
              <motion.div
                className="absolute inset-0 z-40 bg-black/30 dark:bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLeaveConfirm(false)}
              />
              <motion.div
                className="absolute bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-white/[0.06] px-4 pt-4"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                <p className="text-sm font-black text-gray-900 dark:text-white text-center mb-1">
                  {blocked ? "Leave next hand?" : "Leave seat?"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                  {blocked
                    ? "You'll leave after this hand finishes. Your chips will be cashed out."
                    : "Your chips will be cashed out."}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setLeaveConfirm(false)}
                    className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold text-sm"
                  >
                    Stay
                  </button>
                  <button
                    onClick={() => {
                      setLeaveConfirm(false);
                      if (blocked) { onQueueLeave?.(); } else { onStandUp!(); }
                    }}
                    className="flex-1 h-12 rounded-xl font-bold text-sm bg-red-500 text-white"
                  >
                    {blocked ? "Leave Next Hand" : "Leave"}
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default HandPanel;

"use client";
import React, { useState } from "react";
import HoleCards from "components/poker/HoleCards";
import { getAvatarColor, getInitials } from "lib/avatarColor";
import { formatCents } from "lib/formatCents";
import RunItOddsBadge from "../RunItOddsBadge";
import type { HandIndicator } from "lib/handIndicators";
import type { Player } from "types/player";
import type { Card as CardType } from "@pokington/shared";
import { useGameStore } from "store/useGameStore";

type CardEmphasis = "neutral" | "highlighted" | "dimmed";

interface HandPanelProps {
  player: Player | null;
  holeCards?: [CardType, CardType] | null;
  handIndicators?: HandIndicator[];
  activeHandIndicatorId?: string | null;
  handNumber?: number;
  canRevealToOthers?: boolean;
  revealedToOthersIndices?: Set<0 | 1>;
  onRevealToOthers?: (index: 0 | 1) => void;
  sevenTwoEligible?: boolean;
  onPeekCard?: (index: 0 | 1) => void;
  currentBet?: number;
  cardPeelPersistenceKey?: string | null;
  onViewerCardsRevealedChange?: (revealed: boolean) => void;
  holeCardEmphasisByIndex?: CardEmphasis[];
  runItOddsPercentage?: number | null;
}

const HandPanel: React.FC<HandPanelProps> = ({
  player,
  holeCards,
  handIndicators = [],
  activeHandIndicatorId,
  handNumber = 0,
  canRevealToOthers = false,
  revealedToOthersIndices,
  onRevealToOthers,
  sevenTwoEligible = false,
  onPeekCard,
  currentBet = 0,
  cardPeelPersistenceKey,
  onViewerCardsRevealedChange,
  holeCardEmphasisByIndex = ["neutral", "neutral"],
  runItOddsPercentage = null,
}) => {
  const [bothRevealed, setBothRevealed] = useState(false);
  const cardHeight = 100;
  const autoPeelEnabled = useGameStore((state) => state.autoPeelEnabled);
  const setAutoPeelEnabled = useGameStore((state) => state.setAutoPeelEnabled);

  if (!player) return null;

  const avatarColor = getAvatarColor(player.name);
  const initials = getInitials(player.name);
  const activeHandIndicator =
    handIndicators.find((indicator) => indicator.id === activeHandIndicatorId) ??
    handIndicators[0] ??
    null;

  return (
    <div className="pb-1 px-3">
      {/*
        Three-column row: [player info] [hole cards] [hand/stack]
        items-stretch makes the side panels fill the cards' height automatically.
      */}
      <div className="flex items-stretch gap-2">

        {/* Left: player identity + auto-flip toggle */}
        <div className="flex-1 min-w-0 flex flex-col justify-between bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/50 dark:border-white/[0.08] shadow-lg px-2 py-2">
          {/* Top: avatar + YOU + name */}
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0 w-7 h-7"
                style={{ backgroundColor: avatarColor }}
              >
                <span className="font-black text-white select-none text-[9px]">{initials}</span>
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
            {runItOddsPercentage != null && (
              <RunItOddsBadge percentage={runItOddsPercentage} compact className="flex-shrink-0" />
            )}
          </div>

          {/* Bottom: auto-flip toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setAutoPeelEnabled(!autoPeelEnabled)}
              className={`flex-1 flex items-center justify-center gap-1 rounded-lg font-black uppercase tracking-wide transition-colors py-1 text-[8px] ${
                autoPeelEnabled
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 dark:bg-white/[0.07] text-gray-500 dark:text-gray-300"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoPeelEnabled ? "bg-white" : "bg-gray-300 dark:bg-gray-600"}`} />
              auto peel
            </button>
          </div>
        </div>

        {/* Center: hole cards — taller than the side panels; gated before deal */}
        <div className="flex-shrink-0 flex items-center">
          {holeCards ? (
            <HoleCards
              key={handNumber}
              cards={holeCards}
              cardHeight={cardHeight}
              autoReveal={autoPeelEnabled}
              onRevealChange={(revealed) => {
                setBothRevealed(revealed);
                onViewerCardsRevealedChange?.(revealed);
              }}
              canRevealToOthers={canRevealToOthers}
              revealedToOthersIndices={revealedToOthersIndices}
              onRevealToOthers={onRevealToOthers}
              sevenTwoEligible={sevenTwoEligible}
              onPeekCard={onPeekCard}
              persistenceKey={cardPeelPersistenceKey}
              emphasisByIndex={holeCardEmphasisByIndex}
            />
          ) : (
            <div className="flex items-center justify-center" style={{ width: Math.round((cardHeight * 5) / 7) * 2 + 10, height: cardHeight }}>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                No cards
              </span>
            </div>
          )}
        </div>

        {/* Right: hand strength + bet + stack */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/50 dark:border-white/[0.08] shadow-lg px-2 py-2.5 gap-1.5">
          {holeCards && (
            <div className="text-center max-w-full">
              <div className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">
                {activeHandIndicator?.title ?? "Hand"}
              </div>
              <div className={`text-[11px] font-black ${bothRevealed ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                {bothRevealed ? (activeHandIndicator?.label ?? "--") : "--"}
              </div>
            </div>
          )}
          {currentBet > 0 && (
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Bet</div>
              <div className="font-mono font-black px-1.5 py-[1px] rounded-full bg-yellow-400 text-black text-xs">
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
    </div>
  );
};

export default HandPanel;

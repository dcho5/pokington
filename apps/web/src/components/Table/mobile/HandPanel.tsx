"use client";
import React, { useState } from "react";
import HoleCards from "@pokington/ui/web/HoleCards";
import { getAvatarColor, getInitials } from "lib/avatarColor";
import { formatCents } from "@pokington/shared";
import AutoPeelToggle from "@pokington/ui/web/AutoPeelToggle";
import type { HandIndicator } from "lib/handIndicators";
import type { Player } from "types/player";
import type { Card as CardType } from "@pokington/shared";
import { useGameStore } from "store/useGameStore";
import { MOBILE_SHELL } from "lib/mobileShell.mjs";

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
  holeCardEmphasisByIndex?: CardEmphasis[];
  onOpenSeatManager?: () => void;
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
  holeCardEmphasisByIndex = ["neutral", "neutral"],
  onOpenSeatManager,
}) => {
  const [bothRevealed, setBothRevealed] = useState(false);
  const cardHeight = MOBILE_SHELL.handPanelCardHeightPx;
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
    <div
      className="px-3"
      data-testid="mobile-hand-panel"
      style={{ height: MOBILE_SHELL.handPanelHeightPx }}
    >
      {/*
        Three-column row: [player info] [hole cards] [hand/stack]
        items-stretch makes the side panels fill the cards' height automatically.
      */}
      <div className="flex items-stretch gap-2" style={{ height: MOBILE_SHELL.handPanelHeightPx }}>

        {/* Left: player identity + auto-flip toggle */}
        <div
          className={`flex-1 min-w-0 flex flex-col justify-between bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/50 dark:border-white/[0.08] shadow-lg px-2.5 py-3 ${
            onOpenSeatManager ? "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/90" : ""
          }`}
          onClick={onOpenSeatManager}
          role={onOpenSeatManager ? "button" : undefined}
          tabIndex={onOpenSeatManager ? 0 : undefined}
          aria-label={onOpenSeatManager ? `Open seat manager for ${player.name}` : undefined}
          onKeyDown={onOpenSeatManager
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenSeatManager();
                }
              }
            : undefined}
        >
          <div className="flex justify-center">
            <span className="inline-flex w-fit text-[9px] bg-red-100 dark:bg-red-900/30 text-red-600 px-1.5 py-0.5 rounded font-black uppercase tracking-wide">
              You
            </span>
          </div>

          <div className="flex items-center justify-center min-w-0 flex-1 py-1">
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0 w-9 h-9"
              style={{ backgroundColor: avatarColor }}
            >
              <span className="font-black text-white select-none text-[11px]">{initials}</span>
            </div>
          </div>

          <div className="min-w-0 pb-1.5 text-center">
            <div className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight">
              {player.name}
            </div>
          </div>

          {/* Bottom: auto-flip toggle */}
          <div className="flex gap-1 pb-0.5">
            <AutoPeelToggle
              size="compact"
              enabled={autoPeelEnabled}
              onClick={(event) => {
                event.stopPropagation();
                setAutoPeelEnabled(!autoPeelEnabled);
              }}
              className="flex-1"
            />
          </div>
        </div>

        {/* Center: hole cards — taller than the side panels; gated before deal */}
        <div className="flex h-full flex-shrink-0 items-center">
          {holeCards ? (
            <HoleCards
              key={handNumber}
              cards={holeCards}
              cardHeight={cardHeight}
              autoReveal={autoPeelEnabled}
              onRevealChange={setBothRevealed}
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
        <div className={`flex-1 min-w-0 flex flex-col items-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/50 dark:border-white/[0.08] shadow-lg px-2.5 ${currentBet > 0 ? "justify-between py-3 gap-1.5" : "justify-center py-3.5 gap-2"}`}>
          {holeCards && (
            <div className="text-center max-w-full">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">
                {activeHandIndicator?.title ?? "Hand"}
              </div>
              <div className={`text-xs font-black ${bothRevealed ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                {bothRevealed ? (activeHandIndicator?.label ?? "--") : "--"}
              </div>
            </div>
          )}
          {currentBet > 0 && (
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Bet</div>
              <div className="font-mono font-black px-1.5 py-[1px] rounded-full bg-yellow-400 text-black text-xs">
                {formatCents(currentBet)}
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Stack</div>
            <div className="font-mono font-black text-gray-900 dark:text-white text-sm">
              {formatCents(player.stack)}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HandPanel;

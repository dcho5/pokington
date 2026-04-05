"use client";
import React, { useState } from "react";
import HoleCards from "components/poker/HoleCards";
import { getAvatarColor, getInitials } from "lib/avatarColor";
import { formatCents } from "lib/formatCents";
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
}

const HandPanel: React.FC<HandPanelProps> = ({
  player,
  holeCards,
  handStrength,
  handNumber = 0,
  canRevealToOthers = false,
  revealedToOthersIndices,
  onRevealToOthers,
}) => {
  const [bothRevealed, setBothRevealed] = useState(false);
  const [autoFlip, setAutoFlip] = useState(false);

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

          {/* Bottom: auto-flip toggle — full width, pinned to bottom */}
          <button
            onClick={() => setAutoFlip((a) => !a)}
            className={`w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-colors ${
              autoFlip
                ? "bg-red-500 text-white"
                : "bg-gray-100 dark:bg-white/[0.07] text-gray-400 dark:text-gray-500"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${autoFlip ? "bg-white" : "bg-gray-300 dark:bg-gray-600"}`} />
            auto peel
          </button>
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
            />
          ) : (
            <div className="flex items-center justify-center" style={{ width: Math.round((100 * 5) / 7) * 2 + 10, height: 100 }}>
              <span className="text-[10px] text-gray-500 dark:text-gray-600 font-bold uppercase tracking-widest">
                No cards
              </span>
            </div>
          )}
        </div>

        {/* Right: hand strength + stack */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/50 dark:border-white/[0.08] shadow-lg px-2 py-2.5 gap-1.5">
          {bothRevealed && handStrength && (
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-black">Hand</div>
              <div className="text-[11px] font-black text-gray-900 dark:text-white">{handStrength}</div>
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

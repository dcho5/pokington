"use client";
import React from "react";
import Card from "components/poker/Card";
import { formatCents } from "lib/formatCents";
import { getPlayerPositionMarkers } from "lib/playerPositionMarkers.mjs";
import MobileBottomSheet from "./MobileBottomSheet";
import type { Player } from "types/player";

interface OpponentDetailSheetProps {
  player: Player;
  seatIndex: number;
  playerCount?: number;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  runItOddsPercentage?: number | null;
  spotlightSelected?: boolean;
  onToggleSpotlight?: () => void;
  onDismiss: () => void;
}

const POSITION_MARKER_LABELS = {
  dealer: "Dealer",
  smallBlind: "Small Blind",
  bigBlind: "Big Blind",
} as const;

function labelizeAction(action?: string | null) {
  if (!action) return null;
  if (action === "all-in") return "All-in";
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export default function OpponentDetailSheet({
  player,
  seatIndex,
  playerCount,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  runItOddsPercentage = null,
  spotlightSelected = false,
  onToggleSpotlight,
  onDismiss,
}: OpponentDetailSheetProps) {
  const markers = getPlayerPositionMarkers({
    isDealer,
    isSmallBlind,
    isBigBlind,
    playerCount,
  }) as Array<keyof typeof POSITION_MARKER_LABELS>;
  const actionLabel = labelizeAction(player.lastAction);
  const publicCards = player.holeCards ?? null;
  const hasVisibleCards = Array.isArray(publicCards) && publicCards.some(Boolean);

  return (
    <MobileBottomSheet
      onDismiss={onDismiss}
      className="elevated-surface-light border-t px-4 pt-4 max-h-[78dvh] overflow-y-auto overscroll-contain"
    >
      <div className="surface-content">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
              Seat {seatIndex + 1}
            </p>
            <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">
              {player.name}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {player.isYou && (
              <span className="rounded-full border border-rose-300/60 bg-rose-100/95 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-600 dark:border-rose-300/20 dark:bg-rose-400/12 dark:text-rose-200">
                You
              </span>
            )}
            {markers.map((marker) => (
              <span
                key={marker}
                className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-gray-700 dark:text-gray-100"
              >
                {POSITION_MARKER_LABELS[marker]}
              </span>
            ))}
            {player.isAway && (
              <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-600 dark:text-amber-200">
                Away
              </span>
            )}
            {player.isFolded && (
              <span className="rounded-full border border-gray-300/35 bg-gray-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-gray-600 dark:text-gray-300">
                Folded
              </span>
            )}
            {player.isAllIn && (
              <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-600 dark:text-amber-200">
                All-in
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl border border-gray-200/80 bg-white/75 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Stack</p>
            <p className="mt-1 text-lg font-mono font-black text-gray-900 dark:text-white">{formatCents(player.stack)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-white/75 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Live Bet</p>
            <p className="mt-1 text-lg font-mono font-black text-gray-900 dark:text-white">
              {(player.currentBet ?? 0) > 0 ? formatCents(player.currentBet ?? 0) : "—"}
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-gray-200/80 bg-white/75 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">State</p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                {actionLabel ?? "Waiting"}
              </p>
            </div>
            {runItOddsPercentage != null && (
              <div className="rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-sm font-black tabular-nums text-red-500 dark:text-red-200">
                {runItOddsPercentage.toFixed(1)}%
              </div>
            )}
          </div>
          {player.handLabel && (
            <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-amber-600 dark:text-amber-200">
              {player.handLabel}
            </p>
          )}
        </div>

        {hasVisibleCards && (
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              Visible Cards
            </p>
            <div className="flex gap-2">
              {publicCards!.map((card, index) => (
                <Card
                  key={card ? `${card.rank}${card.suit}` : `hidden-${index}`}
                  card={card ?? undefined}
                  size="compact"
                  className="rounded-[8px] shadow-xl"
                  style={{ width: 42, height: 58 }}
                />
              ))}
            </div>
          </div>
        )}

        {onToggleSpotlight && (
          <button
            onClick={onToggleSpotlight}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-sm shadow-[0_0_18px_rgba(239,68,68,0.32)]"
          >
            {spotlightSelected ? "Hide Spotlight" : "Spotlight Hand"}
          </button>
        )}
      </div>
    </MobileBottomSheet>
  );
}

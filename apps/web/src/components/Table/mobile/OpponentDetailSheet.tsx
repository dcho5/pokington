"use client";
import React from "react";
import Card from "@pokington/ui/web/Card";
import { formatCents } from "@pokington/shared";
import { getPlayerPositionMarkers } from "lib/playerPositionMarkers.mjs";
import MobileBottomSheet from "@pokington/ui/web/MobileBottomSheet";
import type { Player } from "types/player";

interface OpponentDetailSheetProps {
  player: Player;
  seatIndex: number;
  playerCount?: number;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  runItOddsPercentage?: number | null;
  holeCardEmphasisByIndex?: Array<"neutral" | "highlighted" | "dimmed">;
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
  holeCardEmphasisByIndex = ["neutral", "neutral"],
  onDismiss,
}: OpponentDetailSheetProps) {
  const markers = getPlayerPositionMarkers({
    isDealer,
    isSmallBlind,
    isBigBlind,
    playerCount,
  }) as Array<keyof typeof POSITION_MARKER_LABELS>;
  const actionLabel = labelizeAction(player.lastAction);
  const statusLabel = player.handLabel ?? actionLabel ?? (player.isCurrentActor ? "ACTION" : "In Hand");
  const previewCards = player.holeCards ?? [null, null];

  return (
    <MobileBottomSheet
      onDismiss={onDismiss}
      className="elevated-surface-light border-t px-4 pt-4 max-h-[48dvh] overflow-y-auto overscroll-contain"
      scrimClassName="absolute inset-0 bg-slate-950/10 dark:bg-slate-950/20"
    >
      <div className="surface-content">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
              Seat {seatIndex + 1}
            </p>
            <p className="mt-1 truncate text-xl font-black text-gray-900 dark:text-white">
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

        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="rounded-2xl border border-gray-200/80 bg-white/75 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Stack</p>
            <p className="mt-1 text-lg font-mono font-black text-gray-900 dark:text-white">{formatCents(player.stack)}</p>
          </div>
          <div className="flex justify-end gap-2">
            {previewCards.map((card, index) => (
              <Card
                key={card ? `${card.rank}${card.suit}` : `hidden-${index}`}
                card={card ?? undefined}
                emphasis={holeCardEmphasisByIndex[index] ?? "neutral"}
                size="compact"
                className="rounded-[8px] shadow-xl"
                style={{ width: 42, height: 58 }}
              />
            ))}
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white/75 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">State</p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                {statusLabel}
              </p>
            </div>
            {runItOddsPercentage != null && (
              <div className="rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-sm font-black tabular-nums text-red-500 dark:text-red-200">
                {runItOddsPercentage.toFixed(1)}%
              </div>
            )}
          </div>
          {(player.currentBet ?? 0) > 0 && (
            <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-amber-600 dark:text-amber-200">
              Live bet {formatCents(player.currentBet ?? 0)}
            </p>
          )}
        </div>
      </div>
    </MobileBottomSheet>
  );
}

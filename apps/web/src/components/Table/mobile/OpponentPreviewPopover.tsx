"use client";
import React from "react";
import { motion } from "framer-motion";
import { formatCents } from "lib/formatCents";
import { getPlayerPositionMarkers } from "lib/playerPositionMarkers.mjs";
import { useColorScheme } from "hooks/useColorScheme";
import type { Player } from "types/player";

interface OpponentPreviewPopoverProps {
  player: Player;
  seatIndex: number;
  playerCount?: number;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  runItOddsPercentage?: number | null;
}

const POSITION_MARKER_LABELS = {
  dealer: "Dealer",
  smallBlind: "Small Blind",
  bigBlind: "Big Blind",
} as const;

const SUIT_SYMBOLS = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
} as const;

function isRedSuit(suit?: string | null) {
  return suit === "hearts" || suit === "diamonds";
}

function displayRank(rank?: string | null) {
  return rank === "T" ? "10" : rank ?? "?";
}

function labelizeAction(action?: string | null) {
  if (!action) return null;
  if (action === "all-in") return "All-in";
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export default function OpponentPreviewPopover({
  player,
  seatIndex,
  playerCount,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  runItOddsPercentage = null,
}: OpponentPreviewPopoverProps) {
  const isDark = useColorScheme() === "dark";
  const feltInsetTopPx = 6;
  const feltInsetBottomPx = 16;
  const railInsetBottomPx = feltInsetBottomPx - feltInsetTopPx;
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
    <motion.div
      className="pointer-events-none absolute inset-x-1 top-0 bottom-4 z-[60]"
      initial={{ opacity: 0, scale: 0.98, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985, y: -2 }}
      transition={{ type: "spring", stiffness: 340, damping: 28, mass: 0.9 }}
    >
      {/* Keep this layout as simple layered blocks so it ports cleanly to React Native iOS later. */}
      <div
        className="absolute inset-x-0 top-0 rounded-[34px] border border-white/10 shadow-[0_24px_52px_rgba(2,6,23,0.36)] backdrop-blur-md"
        style={{
          bottom: railInsetBottomPx,
          background: isDark
            ? "linear-gradient(180deg, rgba(54,38,38,0.92), rgba(20,12,12,0.97))"
            : "linear-gradient(180deg, rgba(19,31,44,0.92), rgba(7,12,20,0.97))",
        }}
      />
      <div
        className="absolute left-[10px] right-[10px] overflow-hidden rounded-[28px] border border-white/10 shadow-inner"
        style={{
          top: feltInsetTopPx,
          bottom: feltInsetBottomPx,
          background: isDark
            ? "radial-gradient(ellipse at top, rgba(52,34,34,0.94), rgba(24,14,14,0.98) 58%, rgba(11,7,7,1) 100%)"
            : "radial-gradient(ellipse at top, rgba(38,57,74,0.94), rgba(16,24,36,0.98) 58%, rgba(8,12,20,1) 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_34%)]" />
        <div className="absolute inset-x-[12px] top-[11px] bottom-[14px] flex flex-col gap-2 rounded-[22px] border border-white/10 bg-slate-950/34 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {/* Keep the overlay in simple horizontal/vertical stacks so the same structure ports cleanly to RN iOS. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 pt-[1px]">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/45">Seat {seatIndex + 1}</p>
                  <p className="truncate pt-[1px] text-[15px] font-black leading-[1.08] text-white">{player.name}</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {player.isYou && (
                  <span className="rounded-full border border-rose-300/25 bg-rose-400/14 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-rose-100">
                    You
                  </span>
                )}
                {markers.map((marker) => (
                  <span
                    key={marker}
                    className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[9px] font-black text-white/90"
                  >
                    {POSITION_MARKER_LABELS[marker]}
                  </span>
                ))}
                {player.isAway && (
                  <span className="rounded-full border border-amber-300/20 bg-amber-500/12 px-2 py-1 text-[9px] font-black text-amber-100">
                    Away
                  </span>
                )}
                {player.isFolded && (
                  <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[9px] font-black text-white/75">
                    Folded
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center justify-center gap-2 self-center">
              <p className="max-w-[72px] truncate text-center text-[8px] font-black uppercase tracking-[0.16em] text-amber-100">
                {statusLabel}
              </p>
              <div className="rounded-[16px] border border-white/10 bg-slate-950/34 px-3 py-2 text-center shadow-[0_10px_24px_rgba(2,6,23,0.18)]">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/45">Stack</p>
                <p className="mt-1 text-[13px] font-mono font-black leading-none text-white">{formatCents(player.stack)}</p>
              </div>
            </div>

            <div className="flex shrink-0 gap-2 self-center">
              {previewCards.map((card, index) => {
                const symbol = card ? SUIT_SYMBOLS[card.suit] : "•";
                const red = isRedSuit(card?.suit);
                return (
                  card ? (
                    <div
                      key={`${card.rank}${card.suit}`}
                      className={`flex h-11 w-11 flex-col items-center justify-center rounded-2xl border text-[11px] font-black shadow-lg ${
                        red
                          ? "border-red-300/35 bg-red-500/12 text-red-100"
                          : "border-white/12 bg-white/10 text-white"
                      }`}
                    >
                      <span className="leading-none">{displayRank(card?.rank)}</span>
                      <span className="mt-0.5 leading-none">{symbol}</span>
                    </div>
                  ) : (
                    <div
                      key={`preview-${index}`}
                      className="h-11 w-11 rounded-2xl border border-sky-100/18 p-[3px] shadow-lg"
                    >
                      <div
                        className="relative h-full w-full overflow-hidden rounded-[13px]"
                        style={{
                          background: "linear-gradient(145deg, #1e3a5f 0%, #0f2040 50%, #1a3356 100%)",
                        }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 10px), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 10px)",
                          }}
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 14px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 14px)",
                          }}
                        />
                      </div>
                    </div>
                  )
                );
              })}
            </div>
          </div>

          {runItOddsPercentage != null && (
            <div className="absolute bottom-3 right-3.5 shrink-0 rounded-full border border-red-200/25 bg-red-500/22 px-2.5 py-[5px] text-[10px] font-black tabular-nums leading-none text-red-50">
              {runItOddsPercentage.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

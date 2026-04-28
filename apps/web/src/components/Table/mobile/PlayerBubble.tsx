"use client";
import React, { useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { getAvatarColor, getInitials } from "lib/avatarColor";
import { formatCents } from "lib/formatCents";
import {
  MOBILE_SEAT_STRIP_METRICS,
  resolveMobileSeatStripPrimaryBadge,
} from "lib/mobileSeatStripLayout.mjs";
import { isFullyTabled } from "lib/showdownSpotlight";
import { getPlayerPositionMarkers } from "lib/playerPositionMarkers.mjs";
import { PeekEyeIcon } from "components/poker/PeekEyeIcon";
import type { Player } from "types/player";

type SeatSlotLayout = {
  occupiedFootprintWidthPx?: number;
  occupiedFootprintHeightPx?: number;
} | null;

interface PlayerBubbleProps {
  player: Player | null;
  seatSlot?: SeatSlotLayout;
  playerCount?: number;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  seatIndex?: number;
  emptySeatIndex?: number;
  seatSelectionLocked?: boolean;
  onEmptyTap?: () => void;
  onPlayerTap?: () => void;
  onPlayerPressStart?: () => void;
  onPlayerPressEnd?: () => void;
  detailSelected?: boolean;
  previewActive?: boolean;
  showdownSpotlightSelected?: boolean;
  showdownCardEmphasisByIndex?: Array<"neutral" | "highlighted" | "dimmed">;
  runItOddsPercentage?: number | null;
}

const POSITION_MARKER_LABELS = {
  dealer: "D",
  smallBlind: "SB",
  bigBlind: "BB",
} as const;

const POSITION_MARKER_STYLES = {
  dealer: "bg-white text-red-600 border-red-500/80",
  smallBlind: "bg-slate-950 text-amber-100 border-amber-300/90",
  bigBlind: "bg-slate-950 text-yellow-200 border-yellow-400",
} as const;

const PRIMARY_BADGE_STYLES = {
  bet: "border border-yellow-100/60 bg-yellow-300/95 text-black",
  action: "border border-slate-300/25 bg-slate-800 text-white",
  "all-in": "border border-amber-100/40 bg-amber-400/95 text-black",
} as const;

const SUIT_SYMBOLS = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
} as const;

function getPrimaryBadgeClass(kind: string) {
  return PRIMARY_BADGE_STYLES[kind as keyof typeof PRIMARY_BADGE_STYLES] ?? PRIMARY_BADGE_STYLES.action;
}

function isRedSuit(suit?: string | null) {
  return suit === "hearts" || suit === "diamonds";
}

function displayRank(rank?: string | null) {
  return rank ?? "?";
}

export default function PlayerBubble({
  player,
  seatSlot: _seatSlot = null,
  playerCount,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  emptySeatIndex,
  seatSelectionLocked = false,
  onEmptyTap,
  onPlayerTap,
  onPlayerPressStart,
  onPlayerPressEnd,
  detailSelected = false,
  previewActive = false,
  showdownCardEmphasisByIndex = ["neutral", "neutral"],
  runItOddsPercentage = null,
}: PlayerBubbleProps) {
  const avatarSize = MOBILE_SEAT_STRIP_METRICS.avatarSizePx;
  const avatarRadius = avatarSize / 2;
  const cardWidth = MOBILE_SEAT_STRIP_METRICS.showdownCardWidthPx;
  const cardHeight = MOBILE_SEAT_STRIP_METRICS.showdownCardHeightPx;
  const badgeOrbitOffset = MOBILE_SEAT_STRIP_METRICS.badgeOrbitOffsetPx;
  const cornerInset = MOBILE_SEAT_STRIP_METRICS.roleBadgeInsetPx;
  const cornerBadgeSize = MOBILE_SEAT_STRIP_METRICS.cornerBadgeSizePx;
  const peekBadgeSize = MOBILE_SEAT_STRIP_METRICS.cornerBadgeSizePx;
  const avatarBounce = useAnimation();

  useEffect(() => {
    if (!player?.winAnimationKey) return;
    if (player.winType === "full") {
      avatarBounce.start({ scale: [1, 1.22, 0.9, 1.1, 1], transition: { duration: 0.55 } });
      return;
    }
    avatarBounce.start({ scale: [1, 1.12, 0.95, 1.04, 1], transition: { duration: 0.45 } });
  }, [avatarBounce, player?.winAnimationKey, player?.winType]);

  if (!player) {
    return (
      <div className="relative" style={{ width: 0, height: 0 }}>
        <motion.button
          type="button"
          disabled={seatSelectionLocked}
          className={seatSelectionLocked ? "opacity-55" : ""}
          style={{
            position: "absolute",
            left: -avatarRadius,
            top: -avatarRadius,
            width: avatarSize,
            height: avatarSize,
          }}
          initial={false}
          animate={{ opacity: seatSelectionLocked ? 0.55 : 1 }}
          transition={{ duration: 0.16 }}
          whileTap={seatSelectionLocked ? undefined : { scale: 0.95 }}
          onClick={seatSelectionLocked ? undefined : onEmptyTap}
          aria-disabled={seatSelectionLocked}
          aria-label={seatSelectionLocked
            ? `Seat ${(emptySeatIndex ?? 0) + 1} unavailable after the game starts`
            : `Empty seat ${(emptySeatIndex ?? 0) + 1}, tap to sit`}
        >
          <div
            className={`rounded-full border-2 border-dashed flex flex-col items-center justify-center ${
              seatSelectionLocked
                ? "border-gray-400/60 dark:border-gray-600/60 bg-gray-200/25 dark:bg-gray-900/30"
                : "border-gray-400 dark:border-gray-600"
            }`}
            style={{ width: avatarSize, height: avatarSize }}
          >
            <span className="text-[6px] font-black uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
              Seat
            </span>
            <span className="mt-[1px] text-sm font-black leading-none text-gray-500 dark:text-gray-400">
              {(emptySeatIndex ?? 0) + 1}
            </span>
          </div>
        </motion.button>
      </div>
    );
  }

  const avatarColor = getAvatarColor(player.name);
  const initials = getInitials(player.name);
  const isFolded = player.isFolded ?? false;
  const isAway = player.isAway ?? false;
  const markers = getPlayerPositionMarkers({
    isDealer,
    isSmallBlind,
    isBigBlind,
    playerCount,
  }) as Array<keyof typeof POSITION_MARKER_LABELS>;
  const primaryBadge = resolveMobileSeatStripPrimaryBadge({
    currentBet: player.currentBet ?? 0,
    lastAction: player.lastAction ?? undefined,
    isAllIn: player.isAllIn ?? false,
    stack: player.stack,
    isFolded,
  });
  const publicCards = player.holeCards ?? [null, null];
  const hasVisibleCards = Array.isArray(publicCards) && publicCards.some(Boolean);
  const hasBothPublicCards = isFullyTabled(player.holeCards);

  return (
    <motion.div
      className="relative"
      style={{
        width: 0,
        height: 0,
        opacity: isFolded ? 0.38 : isAway ? 0.58 : 1,
      }}
      initial={false}
      animate={{ opacity: isFolded ? 0.38 : isAway ? 0.58 : 1 }}
      transition={{ duration: 0.18 }}
    >
      {hasVisibleCards && (
        <>
          {publicCards.map((card, index) => {
            const left = (index === 0 ? -1 : 1) * MOBILE_SEAT_STRIP_METRICS.showdownCardSpreadXPx - (cardWidth / 2);
            const symbol = card ? SUIT_SYMBOLS[card.suit] : "•";
            const red = isRedSuit(card?.suit);
            return (
              <motion.div
                key={card ? `${card.rank}${card.suit}` : `hidden-${index}`}
                className="absolute z-20"
                initial={{ scale: 0.7, opacity: 0, y: 6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.05,
                  duration: 0.2,
                  type: "spring",
                  stiffness: 280,
                  damping: 22,
                }}
                style={{
                  left,
                  top: MOBILE_SEAT_STRIP_METRICS.showdownCardOffsetYPx,
                }}
              >
                {card ? (
                  <div
                    className={`flex items-center justify-center rounded-[6px] border text-[8px] font-black shadow-[0_6px_12px_rgba(15,23,42,0.22)] ${
                      red
                        ? "border-red-300 bg-white text-red-600"
                        : "border-slate-400 bg-white text-slate-900"
                    } ${showdownCardEmphasisByIndex[index] === "dimmed" ? "opacity-45 saturate-[0.72] brightness-[0.92]" : ""}`}
                    style={{ width: cardWidth, height: cardHeight }}
                  >
                    <span className="leading-none tracking-[-0.03em]">
                      {displayRank(card?.rank)}{symbol}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`rounded-[5px] border border-sky-100/18 shadow-[0_6px_12px_rgba(15,23,42,0.22)] ${showdownCardEmphasisByIndex[index] === "dimmed" ? "opacity-45 saturate-[0.72] brightness-[0.92]" : ""}`}
                    style={{ width: cardWidth, height: cardHeight }}
                  >
                    <div
                      className="relative h-full w-full overflow-hidden rounded-[4px]"
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
                )}
              </motion.div>
            );
          })}
        </>
      )}

      {markers.length > 0 && (
        <div
          className="absolute z-30 flex flex-col items-start gap-[2px]"
          style={{
            left: avatarRadius - cornerBadgeSize - cornerInset - badgeOrbitOffset,
            top: -avatarRadius + cornerInset + badgeOrbitOffset,
          }}
        >
          {markers.map((marker) => (
            <span
              key={marker}
              className={[
                "inline-flex min-w-[18px] items-center justify-center rounded-full border px-1 py-[1px] text-[6px] font-black uppercase leading-none shadow-sm",
                POSITION_MARKER_STYLES[marker],
              ].join(" ")}
              style={{ minHeight: cornerBadgeSize }}
            >
              {POSITION_MARKER_LABELS[marker]}
            </span>
          ))}
        </div>
      )}

      {(player.hasCards ?? false) && !isFolded && !hasBothPublicCards && (
        <div
          className="absolute z-30"
          style={{
            left: -avatarRadius + MOBILE_SEAT_STRIP_METRICS.peekBadgeInsetPx + badgeOrbitOffset,
            top: -avatarRadius + MOBILE_SEAT_STRIP_METRICS.peekBadgeInsetPx + badgeOrbitOffset,
          }}
        >
          {(() => {
            const pc = player.peekedCount ?? 0;
            const bgClass =
              pc === 0 ? "bg-gray-700/80 border-gray-500/40" :
              pc === 1 ? "bg-yellow-600/90 border-yellow-400/50" :
              "bg-emerald-600/90 border-emerald-400/50";
            return (
              <div
                className={`rounded-full border flex items-center justify-center shadow-lg ${bgClass}`}
                style={{ width: peekBadgeSize, height: peekBadgeSize }}
              >
                <PeekEyeIcon count={pc} size={10} strokeWidth={2.5} className={pc === 0 ? "text-white opacity-50" : "text-white"} />
              </div>
            );
          })()}
        </div>
      )}

      <motion.button
        type="button"
        className="absolute border-0 bg-transparent p-0"
        style={{
          left: -avatarRadius,
          top: -avatarRadius,
          width: avatarSize,
          height: avatarSize,
        }}
        animate={{ scale: previewActive ? 0.94 : 1 }}
        transition={{ duration: 0.14 }}
        whileTap={{ scale: 0.94 }}
        onClick={onPlayerTap}
        onPointerDown={onPlayerPressStart}
        onPointerUp={onPlayerPressEnd}
        onPointerLeave={onPlayerPressEnd}
        onPointerCancel={onPlayerPressEnd}
        aria-label={`${player.name}, stack ${formatCents(player.stack)}`}
        aria-pressed={detailSelected}
      >
        <div className="relative h-full w-full">
          {detailSelected && (
            <span className="absolute inset-[-4px] rounded-full pointer-events-none z-20 ring-2 ring-sky-300/85 shadow-[0_0_18px_rgba(56,189,248,0.26)]" />
          )}
          {player.isYou && (
            <span className="absolute inset-[-3px] rounded-full border border-rose-300/65 shadow-[0_0_18px_rgba(244,114,182,0.18)] pointer-events-none z-10 dark:border-rose-300/28" />
          )}
          {player.isCurrentActor && (
            <span className="absolute inset-[-3px] rounded-full pointer-events-none z-0 animate-pulse-ring" />
          )}
          {player.winType === "full" && (
            <motion.span
              className="absolute inset-[-6px] rounded-full pointer-events-none z-10"
              animate={{ opacity: [0.38, 0.92, 0.38], scale: [1, 1.05, 1] }}
              transition={{ duration: 1.45, repeat: Infinity, ease: "easeInOut" }}
              style={{
                border: "2px solid rgba(245,158,11,0.82)",
                boxShadow: "0 0 18px rgba(245,158,11,0.72), 0 0 34px rgba(245,158,11,0.5)",
              }}
            />
          )}
          {player.winType === "partial" && (
            <motion.span
              className="absolute inset-[-6px] rounded-full pointer-events-none z-10"
              animate={{ opacity: [0.34, 0.82, 0.34], scale: [1, 1.04, 1] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
              style={{
                border: "2px solid rgba(34,197,94,0.78)",
                boxShadow: "0 0 16px rgba(34,197,94,0.54), 0 0 30px rgba(34,197,94,0.38)",
              }}
            />
          )}

          <AnimatePresence>
            {player.winAnimationKey && player.winType === "full" && (
              <motion.span
                key={`${player.winAnimationKey}-r1`}
                className="absolute inset-[-4px] rounded-full pointer-events-none z-20"
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 1.9 }}
                transition={{ duration: 1.15, ease: "easeOut" }}
                style={{
                  border: "3px solid rgba(245,158,11,0.98)",
                  boxShadow: "0 0 18px rgba(245,158,11,0.72), 0 0 34px rgba(245,158,11,0.5)",
                }}
              />
            )}
            {player.winAnimationKey && player.winType === "full" && (
              <motion.span
                key={`${player.winAnimationKey}-r2`}
                className="absolute inset-[-4px] rounded-full pointer-events-none z-20"
                initial={{ opacity: 0.72, scale: 1 }}
                animate={{ opacity: 0, scale: 2.35 }}
                transition={{ duration: 1.65, ease: "easeOut", delay: 0.18 }}
                style={{
                  border: "2px solid rgba(245,158,11,0.72)",
                  boxShadow: "0 0 14px rgba(245,158,11,0.48), 0 0 28px rgba(245,158,11,0.32)",
                }}
              />
            )}
            {player.winAnimationKey && player.winType === "partial" && (
              <motion.span
                key={`${player.winAnimationKey}-r3`}
                className="absolute inset-[-4px] rounded-full pointer-events-none z-20"
                initial={{ opacity: 0.92, scale: 1 }}
                animate={{ opacity: 0, scale: 1.72 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                style={{
                  border: "2.5px solid rgba(34,197,94,0.96)",
                  boxShadow: "0 0 14px rgba(34,197,94,0.44), 0 0 26px rgba(34,197,94,0.26)",
                }}
              />
            )}
          </AnimatePresence>

          <motion.div animate={avatarBounce} className="relative h-full w-full">
            {runItOddsPercentage != null ? (
              <div
                className={[
                  "h-full w-full rounded-full flex items-center justify-center relative z-10 border text-white shadow-lg",
                  player.isCurrentActor ? "ring-2 ring-red-500" : "",
                ].join(" ")}
                style={{
                  background: "linear-gradient(135deg, rgba(239,68,68,0.96), rgba(185,28,28,0.94))",
                  borderColor: "rgba(254,226,226,0.42)",
                  boxShadow: "0 8px 20px rgba(127,29,29,0.34)",
                }}
              >
                <span
                  className="font-black tabular-nums select-none leading-none tracking-[-0.02em]"
                  style={{ fontSize: runItOddsPercentage >= 100 ? 10 : 11 }}
                >
                  {runItOddsPercentage.toFixed(1)}%
                </span>
              </div>
            ) : (
              <div
                className={[
                  "h-full w-full rounded-full flex items-center justify-center relative z-10",
                  player.isCurrentActor ? "ring-2 ring-red-500" : "",
                  isFolded ? "grayscale" : "",
                ].join(" ")}
                style={{ backgroundColor: player.isYou ? 'black' : avatarColor }}
              >
                <span className="font-black text-white text-xs select-none">{player.isYou ? "YOU" : initials}</span>
              </div>
            )}
          </motion.div>
        </div>
      </motion.button>

      {primaryBadge && (
        <motion.div
          className="absolute z-40 flex justify-center"
          style={{
            left: -avatarRadius,
            top: MOBILE_SEAT_STRIP_METRICS.primaryBadgeOffsetYPx,
            width: avatarSize,
          }}
          initial={false}
          animate={{ opacity: previewActive ? 0 : 1, y: previewActive ? -2 : 0 }}
          transition={{ duration: 0.14 }}
        >
          <span
            className={`inline-flex items-center justify-center rounded-full px-1.5 text-[7px] font-black leading-none shadow-[0_10px_18px_rgba(2,6,23,0.28)] ${getPrimaryBadgeClass(primaryBadge.kind)}`}
            style={{
              height: MOBILE_SEAT_STRIP_METRICS.primaryBadgeHeightPx,
              maxWidth: MOBILE_SEAT_STRIP_METRICS.primaryBadgeMaxWidthPx,
            }}
          >
            <span className="truncate">{primaryBadge.label}</span>
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

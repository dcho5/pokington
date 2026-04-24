"use client";
import React, { useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { getAvatarColor, getInitials } from "lib/avatarColor";
import { formatCents } from "lib/formatCents";
import {
  MOBILE_SEAT_STRIP_METRICS,
  resolveMobileSeatStripRailContent,
} from "lib/mobileSeatStripLayout.mjs";
import { ACTION_COLORS_MOBILE as ACTION_BADGE } from "lib/actionColors";
import { isFullyTabled } from "lib/showdownSpotlight";
import { getPlayerPositionMarkers } from "lib/playerPositionMarkers.mjs";
import { PeekEyeIcon } from "components/poker/PeekEyeIcon";
import Card from "components/poker/Card";
import type { Player } from "types/player";

type SeatSlotLayout = {
  railDirection?: string;
  railAlign?: string;
  avatarAnchorX?: number;
  railInsetPx?: number;
  railWidthPx?: number;
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
  emptySeatIndex?: number;
  seatSelectionLocked?: boolean;
  onEmptyTap?: () => void;
  showdownSpotlightSelected?: boolean;
  onShowdownPlayerTap?: (playerId: string) => void;
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

const DEFAULT_LAYOUT: Required<NonNullable<SeatSlotLayout>> = {
  railDirection: "right",
  railAlign: "start",
  avatarAnchorX: MOBILE_SEAT_STRIP_METRICS.avatarSizePx / 2,
  railInsetPx: MOBILE_SEAT_STRIP_METRICS.avatarSizePx + MOBILE_SEAT_STRIP_METRICS.railGapPx,
  railWidthPx: MOBILE_SEAT_STRIP_METRICS.railMaxWidthPx,
  occupiedFootprintWidthPx: MOBILE_SEAT_STRIP_METRICS.occupiedFootprintWidthPx,
  occupiedFootprintHeightPx: MOBILE_SEAT_STRIP_METRICS.occupiedFootprintHeightPx,
};

function getPrimaryRailLabel(kind: string, player: Player, actionLabel?: string | null) {
  if (kind === "bet") {
    return formatCents(player.currentBet ?? 0);
  }
  if (kind === "action") {
    return actionLabel;
  }
  return formatCents(player.stack);
}

function getLayout(slot?: SeatSlotLayout) {
  return {
    ...DEFAULT_LAYOUT,
    ...(slot ?? {}),
  };
}

const PlayerBubble: React.FC<PlayerBubbleProps> = ({
  player,
  seatSlot = null,
  playerCount,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  emptySeatIndex,
  seatSelectionLocked = false,
  onEmptyTap,
  showdownSpotlightSelected = false,
  onShowdownPlayerTap,
  showdownCardEmphasisByIndex = ["neutral", "neutral"],
  runItOddsPercentage = null,
}) => {
  const minWidth = MOBILE_SEAT_STRIP_METRICS.emptyFootprintWidthPx;
  const avatarSize = MOBILE_SEAT_STRIP_METRICS.avatarSizePx;
  const avatarRadius = avatarSize / 2;
  const publicCardWidth = MOBILE_SEAT_STRIP_METRICS.showdownCardWidthPx;
  const publicCardHeight = MOBILE_SEAT_STRIP_METRICS.showdownCardHeightPx;
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
      <motion.button
        type="button"
        disabled={seatSelectionLocked}
        className={`flex flex-col items-center gap-0.5 px-0.5 ${seatSelectionLocked ? "opacity-55" : ""}`}
        style={{ minWidth }}
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
          className={`rounded-full border-2 border-dashed flex items-center justify-center ${
            seatSelectionLocked
              ? "border-gray-400/60 dark:border-gray-600/60 bg-gray-200/25 dark:bg-gray-900/30"
              : "border-gray-400 dark:border-gray-600"
          }`}
          style={{ width: avatarSize, height: avatarSize }}
        >
          <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
            {seatSelectionLocked ? "-" : "+"}
          </span>
        </div>
        <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 leading-tight">
          Seat {(emptySeatIndex ?? 0) + 1}
        </span>
        <div className="h-2" />
      </motion.button>
    );
  }

  const layout = getLayout(seatSlot);
  const railDirection = layout.railDirection;
  const railJustify = railDirection === "left" ? "justify-end" : "justify-start";
  const railItems = railDirection === "left" ? "items-end text-right" : "items-start text-left";
  const railStyle: React.CSSProperties = railDirection === "left"
    ? { left: 0, width: layout.railWidthPx }
    : { left: layout.railInsetPx, width: layout.railWidthPx };
  const avatarLeft = layout.avatarAnchorX - avatarRadius;

  const avatarColor = getAvatarColor(player.name);
  const initials = getInitials(player.name);
  const isViewerSeat = player.isYou === true;
  const isFolded = player.isFolded ?? false;
  const isAway = player.isAway ?? false;
  const action = player.lastAction;
  const badge = action ? ACTION_BADGE[action] : null;
  const publicCards = player.holeCards ?? [null, null];
  const showCards = !!player.holeCards;
  const hasBothPublicCards = isFullyTabled(player.holeCards);
  const canFocusShowdownPlayer = hasBothPublicCards && !!player.id && !!onShowdownPlayerTap;
  const handleShowdownPlayerTap = canFocusShowdownPlayer
    ? () => onShowdownPlayerTap(player.id!)
    : undefined;
  const markers = getPlayerPositionMarkers({
    isDealer,
    isSmallBlind,
    isBigBlind,
    playerCount,
  }) as Array<keyof typeof POSITION_MARKER_LABELS>;
  const railContent = resolveMobileSeatStripRailContent({
    currentBet: player.currentBet ?? 0,
    lastAction: action,
    isFolded,
  });
  const primaryRailLabel = getPrimaryRailLabel(railContent.primary, player, badge?.label ?? null);
  const secondaryRailLabel = railContent.secondary === "stack" ? formatCents(player.stack) : null;
  const showdownHandLabelNode = showCards && player.handLabel ? (
    <span
      key={`hand-${player.handLabel}`}
      className="inline-flex max-w-full items-center rounded-full px-1.5 py-[2px] text-[7px] font-black leading-none"
      style={{
        background: "rgba(0,0,0,0.72)",
        color: "#fde68a",
        border: "1px solid rgba(234,179,8,0.3)",
      }}
    >
      <span className="truncate">{player.handLabel}</span>
    </span>
  ) : null;

  const primaryNode = railContent.primary === "stack" ? (
    <span
      key="primary-stack"
      className={`font-mono text-[10px] font-black leading-none ${
        isFolded ? "text-gray-500 dark:text-gray-600" : "text-gray-900 dark:text-white"
      }`}
    >
      {primaryRailLabel}
    </span>
  ) : (
    <span
      key={`primary-${railContent.primary}`}
      className={[
        "inline-flex max-w-full items-center rounded-full px-1.5 py-[2px] text-[8px] font-black leading-none",
        railContent.primary === "bet"
          ? "bg-yellow-400 text-black"
          : badge
            ? `${badge.bg} ${badge.text}`
            : "bg-amber-500 text-black",
      ].join(" ")}
    >
      <span className="truncate">{primaryRailLabel}</span>
    </span>
  );

  const secondaryNode = secondaryRailLabel ? (
    <span
      key="secondary-stack"
      className={`font-mono text-[9px] font-bold leading-none ${
        isFolded ? "text-gray-500 dark:text-gray-600" : "text-gray-700 dark:text-gray-200"
      }`}
    >
      {secondaryRailLabel}
    </span>
  ) : null;

  const detailNodes = showdownHandLabelNode
    ? [showdownHandLabelNode]
    : railDirection === "left" && secondaryNode
      ? [secondaryNode, primaryNode]
      : [primaryNode, secondaryNode];

  return (
    <motion.div
      className={`relative ${showdownSpotlightSelected ? "z-20" : ""}`}
      style={{
        width: layout.occupiedFootprintWidthPx,
        height: layout.occupiedFootprintHeightPx,
      }}
      initial={false}
      animate={{ scale: 1, opacity: isFolded ? 0.35 : isAway ? 0.55 : 1 }}
      transition={{ duration: 0.18 }}
      aria-label={`${player.name}, stack ${formatCents(player.stack)}`}
    >
      {showCards && (
        <div
          className={canFocusShowdownPlayer ? "absolute z-0 cursor-pointer" : "absolute z-0 pointer-events-none"}
          style={{
            left: layout.avatarAnchorX - (MOBILE_SEAT_STRIP_METRICS.showdownPeekWidthPx / 2),
            top: -4,
            width: MOBILE_SEAT_STRIP_METRICS.showdownPeekWidthPx,
            height: publicCardHeight + 12,
            overflow: "hidden",
          }}
          data-mobile-interactive={canFocusShowdownPlayer ? "true" : undefined}
          onClick={handleShowdownPlayerTap}
        >
          {player.sevenTwoEligible && (
            <motion.div
              className="absolute inset-x-1 bottom-0 top-1 rounded-full pointer-events-none"
              animate={{ opacity: [0.35, 0.8, 0.35], scale: [1, 1.04, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "radial-gradient(ellipse, rgba(234,179,8,0.45) 0%, transparent 72%)" }}
            />
          )}

          <div
            className="absolute left-1/2 top-1 flex"
            style={{
              transform: "translateX(-50%)",
              gap: 1,
            }}
          >
            {publicCards.map((card, i) => (
              <motion.div
                key={card ? `${card.rank}${card.suit}` : `back-${i}`}
                initial={{ scale: 0.3, opacity: 0, y: 8 }}
                animate={player.sevenTwoEligible
                  ? {
                      scale: 1,
                      opacity: 1,
                      y: 0,
                      filter: [
                        "drop-shadow(0 0 4px rgba(234,179,8,0.6))",
                        "drop-shadow(0 0 8px rgba(234,179,8,0.9))",
                        "drop-shadow(0 0 4px rgba(234,179,8,0.6))",
                      ],
                    }
                  : { scale: 1, opacity: 1, y: 0 }
                }
                transition={player.sevenTwoEligible
                  ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                  : {
                      delay: i * 0.12,
                      duration: 0.28,
                      type: "spring",
                      stiffness: 240,
                      damping: 20,
                    }
                }
                style={{
                  rotate: i === 0 ? -7 : 7,
                  transformOrigin: "bottom center",
                }}
              >
                {card ? (
                  <Card
                    card={card}
                    emphasis={showdownCardEmphasisByIndex[i] ?? "neutral"}
                    size="compact"
                    className="rounded-[5px] shadow-xl"
                    style={{ width: publicCardWidth, height: publicCardHeight }}
                  />
                ) : (
                  <div
                    className="rounded-[5px] shadow-xl"
                    style={{
                      width: publicCardWidth,
                      height: publicCardHeight,
                      background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                      border: "1.5px solid rgba(255,255,255,0.1)",
                    }}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div
        className="absolute top-1 z-10"
        style={{ left: avatarLeft, width: avatarSize, height: avatarSize }}
      >
        <div className="relative h-full w-full">
          {showdownSpotlightSelected && (
            <span className="absolute inset-[-6px] rounded-full pointer-events-none z-20 ring-2 ring-red-400/80 shadow-[0_0_20px_rgba(248,113,113,0.3)]" />
          )}
          {isViewerSeat && (
            <span className="absolute inset-[-3px] rounded-full border border-rose-300/65 shadow-[0_0_18px_rgba(244,114,182,0.18)] pointer-events-none z-10 dark:border-rose-300/28" />
          )}
          {player.isCurrentActor && (
            <span className="absolute inset-[-3px] rounded-full pointer-events-none z-0 animate-pulse-ring" />
          )}

          <AnimatePresence>
            {player.winAnimationKey && player.winType === "full" && (
              <motion.span
                key={`${player.winAnimationKey}-r1`}
                className="absolute inset-[-4px] rounded-full pointer-events-none z-20"
                initial={{ opacity: 0.95, scale: 1 }}
                animate={{ opacity: 0, scale: 1.7 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                style={{ border: "2.5px solid rgba(234,179,8,0.95)" }}
              />
            )}
            {player.winAnimationKey && player.winType === "full" && (
              <motion.span
                key={`${player.winAnimationKey}-r2`}
                className="absolute inset-[-4px] rounded-full pointer-events-none z-20"
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 2.1 }}
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
                style={{ border: "1.5px solid rgba(234,179,8,0.5)" }}
              />
            )}
            {player.winAnimationKey && player.winType === "full" && (
              <motion.span
                key={`${player.winAnimationKey}-glow`}
                className="absolute inset-0 rounded-full pointer-events-none z-0"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.75 }}
                style={{ background: "radial-gradient(circle, rgba(234,179,8,0.45) 0%, transparent 70%)" }}
              />
            )}
            {player.winAnimationKey && player.winType === "partial" && (
              <motion.span
                key={`${player.winAnimationKey}-r1`}
                className="absolute inset-[-4px] rounded-full pointer-events-none z-20"
                initial={{ opacity: 0.85, scale: 1 }}
                animate={{ opacity: 0, scale: 1.55 }}
                transition={{ duration: 0.85, ease: "easeOut" }}
                style={{ border: "2px solid rgba(34,197,94,0.9)" }}
              />
            )}
          </AnimatePresence>

          <motion.div animate={avatarBounce} className="relative h-full w-full">
            {runItOddsPercentage != null ? (
              <motion.button
                type="button"
                key={runItOddsPercentage.toFixed(1)}
                initial={{ opacity: 0, scale: 0.82, y: 6 }}
                animate={{ opacity: 1, scale: [1, 1.05, 1], y: 0 }}
                transition={{
                  opacity: { duration: 0.18 },
                  y: { type: "spring", stiffness: 320, damping: 26 },
                  scale: { duration: 0.34 },
                }}
                className={`h-full w-full rounded-full border-0 bg-transparent p-0 ${canFocusShowdownPlayer ? "cursor-pointer" : ""}`}
                data-mobile-interactive={canFocusShowdownPlayer ? "true" : undefined}
                onClick={handleShowdownPlayerTap}
                disabled={!canFocusShowdownPlayer}
                aria-label={canFocusShowdownPlayer ? `Select ${player.name}` : undefined}
              >
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
              </motion.button>
            ) : (
              <button
                type="button"
                className={[
                  "h-full w-full rounded-full flex items-center justify-center relative z-10 border-0 bg-transparent p-0",
                  canFocusShowdownPlayer ? "cursor-pointer" : "",
                  player.isCurrentActor ? "ring-2 ring-red-500" : "",
                  isFolded ? "grayscale" : "",
                ].join(" ")}
                data-mobile-interactive={canFocusShowdownPlayer ? "true" : undefined}
                onClick={handleShowdownPlayerTap}
                disabled={!canFocusShowdownPlayer}
                aria-label={canFocusShowdownPlayer ? `Select ${player.name}` : undefined}
                style={{ backgroundColor: avatarColor }}
              >
                <span className="font-black text-white text-xs select-none">{initials}</span>
              </button>
            )}
          </motion.div>

          {isViewerSeat && (
            <span className="absolute -bottom-1 -left-1 z-20 rounded-full border border-rose-300/60 bg-rose-100/95 px-1 py-[1px] text-[6px] font-black uppercase tracking-[0.12em] text-rose-600 shadow-[0_6px_14px_rgba(244,114,182,0.18)] dark:border-rose-300/20 dark:bg-rose-400/12 dark:text-rose-200">
              You
            </span>
          )}

          {(player.hasCards ?? false) && !isFolded && !hasBothPublicCards && (() => {
            const pc = player.peekedCount ?? 0;
            const bgClass =
              pc === 0 ? "bg-gray-700/80 border-gray-500/40" :
              pc === 1 ? "bg-yellow-600/90 border-yellow-400/50" :
              "bg-emerald-600/90 border-emerald-400/50";
            return (
              <div className={`absolute -top-1 -left-1 h-[18px] w-[18px] rounded-full border flex items-center justify-center z-20 shadow-lg ${bgClass}`}>
                <PeekEyeIcon count={pc} size={10} strokeWidth={2.5} className={pc === 0 ? "text-white opacity-50" : "text-white"} />
              </div>
            );
          })()}
        </div>
      </div>

      <div className={`absolute top-[3px] flex flex-col gap-1 ${railItems}`} style={railStyle}>
        <div className={`flex w-full min-w-0 items-center gap-1 ${railJustify}`}>
          <span
            className={`min-w-0 flex-1 truncate text-[10px] font-semibold leading-tight ${
              isFolded ? "text-gray-500 dark:text-gray-600" : "text-gray-700 dark:text-gray-200"
            }`}
          >
            {player.name}
          </span>

          {markers.length > 0 && (
            <div className={`flex shrink-0 items-center gap-1 ${railJustify}`}>
              {markers.map((marker) => (
                <span
                  key={marker}
                  className={[
                    "inline-flex min-w-[20px] items-center justify-center rounded-full border px-1.5 py-[2px] text-[7px] font-black uppercase leading-none shadow-sm",
                    POSITION_MARKER_STYLES[marker],
                  ].join(" ")}
                >
                  {POSITION_MARKER_LABELS[marker]}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={`flex w-full min-w-0 items-center gap-1 ${railJustify}`} style={{ minHeight: MOBILE_SEAT_STRIP_METRICS.metadataLineHeightPx }}>
          {detailNodes}
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(PlayerBubble);

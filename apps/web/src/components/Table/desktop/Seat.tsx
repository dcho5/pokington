"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { computeSeatPosition, type TableGeometry } from "lib/seatLayout";
import { getDesktopSeatBadgeMetrics } from "lib/desktopSeatBadgeLayout.mjs";
import { formatCents } from "lib/formatCents";
import { ACTION_COLORS_DESKTOP as ACTION_COLORS } from "lib/actionColors";
import { isFullyTabled } from "lib/showdownSpotlight";
import type { Player } from "types/player";
import Card from "components/poker/Card";
import { PeekEyeIcon } from "components/poker/PeekEyeIcon";
import PlayerPositionMarkers from "../PlayerPositionMarkers";
import RunItOddsBadge from "../RunItOddsBadge";

const DESKTOP_SEAT_CONTENT_SCALE = 1.15;

function PeekEye({ count, size = 14 }: { count: number; size?: number }) {
  const bgClass =
    count === 0 ? "bg-gray-700/80 border-gray-500/40" :
    count === 1 ? "bg-yellow-600/90 border-yellow-400/50" :
    "bg-emerald-600/90 border-emerald-400/50";
  const iconSize = Math.max(10, Math.round(size * 0.56));

  return (
    <div
      className={`rounded-full border flex items-center justify-center shadow-lg ${bgClass}`}
      style={{ width: size, height: size }}
    >
      <PeekEyeIcon
        count={count}
        size={iconSize}
        strokeWidth={2.5}
        className={count === 0 ? "text-white opacity-50" : "text-white"}
      />
    </div>
  );
}

function SeatBadge({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-black uppercase tracking-[0.18em] shadow-lg backdrop-blur-md ${className}`}
      style={{
        textShadow: "0 1px 2px rgba(2,6,23,0.92)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function SeatPulseOutlines({
  color,
  cardWidth,
  cardHeight,
  clusterWidth,
  duration = 1.8,
  repeat = Infinity,
  delay = 0,
  scaleKeyframes = [1, 1.02, 1],
  opacityKeyframes = [0.28, 0.95, 0.28],
}: {
  color: string;
  cardWidth: number;
  cardHeight: number;
  clusterWidth: number;
  duration?: number;
  repeat?: number;
  delay?: number;
  scaleKeyframes?: number[];
  opacityKeyframes?: number[];
}) {
  const outlines = [
    { left: 0, rotate: -7 },
    { left: clusterWidth - cardWidth, rotate: 7 },
  ] as const;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {outlines.map((outline, index) => (
        <motion.span
          key={index}
          className="absolute rounded-[22px]"
          animate={{
            scale: scaleKeyframes,
            opacity: opacityKeyframes,
            boxShadow: [
              `0 0 0 1px ${color}, 0 0 16px ${color}, 0 0 28px ${color}`,
              `0 0 0 2px ${color}, 0 0 34px ${color}, 0 0 54px ${color}`,
              `0 0 0 1px ${color}, 0 0 16px ${color}, 0 0 28px ${color}`,
            ],
          }}
          transition={{ duration, repeat, delay, ease: "easeInOut" }}
          style={{
            left: outline.left,
            top: 0,
            width: cardWidth,
            height: cardHeight,
            rotate: `${outline.rotate}deg`,
            transformOrigin: "50% 88%",
          }}
        />
      ))}
    </div>
  );
}

interface SeatProps {
  seatIndex: number;
  totalSeats: number;
  geometry: TableGeometry;
  player: Player | null;
  playerCount?: number;
  isYou: boolean;
  isDealer: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  isCurrentActor: boolean;
  onSitDown: (seatIndex: number) => void;
  onOpenSeatManager?: () => void;
  seatSelectionLocked?: boolean;
  seatSize?: number;
  handNumber?: number;
  onShowdownHoverChange?: (playerId: string | null) => void;
  showdownSpotlightSelected?: boolean;
  showdownCardEmphasisByIndex?: Array<"neutral" | "highlighted" | "dimmed">;
  runItOddsPercentage?: number | null;
}

const Seat: React.FC<SeatProps> = ({
  seatIndex,
  totalSeats,
  geometry,
  player,
  playerCount,
  isYou,
  isDealer,
  isSmallBlind = false,
  isBigBlind = false,
  isCurrentActor,
  onSitDown,
  onOpenSeatManager,
  seatSelectionLocked = false,
  seatSize = 100,
  handNumber = 0,
  onShowdownHoverChange,
  showdownSpotlightSelected = false,
  showdownCardEmphasisByIndex = ["neutral", "neutral"],
  runItOddsPercentage = null,
}) => {
  const pos = computeSeatPosition(seatIndex, totalSeats, geometry);
  const action = player?.lastAction ?? null;
  const actionStyle = action ? ACTION_COLORS[action] ?? ACTION_COLORS.check : null;
  const bounceControls = useAnimation();

  useEffect(() => {
    if (!player?.winAnimationKey) return;
    if (player.winType === "full") {
      bounceControls.start({
        scale: [1, 1.11, 0.95, 1.04, 1],
        transition: { duration: 0.55, ease: "easeOut" },
      });
    } else {
      bounceControls.start({
        scale: [1, 1.07, 0.97, 1.02, 1],
        transition: { duration: 0.45, ease: "easeOut" },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.winAnimationKey]);

  if (!player) {
    return (
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
        style={pos}
        initial={false}
      >
        <div
          style={{
            transform: `scale(${DESKTOP_SEAT_CONTENT_SCALE})`,
            transformOrigin: "center center",
          }}
        >
          <motion.button
            key="empty"
            type="button"
            disabled={seatSelectionLocked}
            whileHover={seatSelectionLocked ? undefined : { scale: 1.05, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
            whileTap={seatSelectionLocked ? undefined : { scale: 0.95 }}
            onClick={seatSelectionLocked ? undefined : () => onSitDown(seatIndex)}
            aria-disabled={seatSelectionLocked}
            aria-label={seatSelectionLocked ? `Seat ${seatIndex + 1} unavailable after the game starts` : `Seat ${seatIndex + 1}, click to sit`}
            className={`
              group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200
              ${seatSelectionLocked
                ? "cursor-default border-gray-300/50 dark:border-gray-700/50 bg-gray-200/20 dark:bg-gray-900/30 opacity-60"
                : "cursor-pointer border-gray-300 dark:border-gray-700 bg-transparent"}
            `}
            style={{ width: seatSize, height: seatSize }}
          >
            <span
              className={`
                flex flex-col items-center leading-none transition-colors
                ${seatSelectionLocked
                  ? "text-gray-400/80 dark:text-gray-500/80"
                  : "text-gray-400 dark:text-gray-500 group-hover:text-red-500"}
              `}
            >
              <span className="text-xs font-bold uppercase tracking-widest">Seat</span>
              <span className="mt-1 text-[10px] font-mono">{seatIndex + 1}</span>
            </span>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  const publicCards = player.holeCards ?? [null, null];
  const hasBothPublicCards = isFullyTabled(player.holeCards);
  const cardWidth = Math.round(seatSize * 0.68);
  const cardHeight = Math.round(cardWidth * 1.4);
  const overlap = Math.round(cardWidth * 0.38);
  const clusterWidth = cardWidth * 2 - overlap;
  const clusterHeight = cardHeight + Math.round(seatSize * 0.18);
  const nameFontSize = seatSize >= 146 ? 14 : seatSize >= 136 ? 13 : 12;
  const {
    outerWidth,
    stackFontSize,
    badgeFontSize,
    statusBadgeRightPx,
    statusBadgeBottomPx,
  } = getDesktopSeatBadgeMetrics(seatSize);
  const peekEyeSize = seatSize >= 136 ? 36 : 32;
  const seatOpacity = player.isFolded ? 0.42 : player.isAway ? 0.72 : 1;
  const statusBadges: Array<{
    label: string;
    className: string;
    borderColor?: string;
  }> = [];
  const canOpenSeatManager = isYou && !!onOpenSeatManager;

  if (isYou) {
    statusBadges.push({
      label: "You",
      className: "bg-red-700 text-white border-red-200/55",
    });
  }
  if (player.isAllIn) {
    statusBadges.push({
      label: "All In",
      className: "bg-gradient-to-r from-amber-400 to-yellow-400 text-black border-amber-200/80",
    });
  }
  if (player.isAway) {
    statusBadges.push({
      label: "Away",
      className: "bg-amber-950 text-amber-100 border-amber-300/38",
    });
  }
  if (player.isAdmin) {
    statusBadges.push({
      label: "Admin",
      className: "bg-slate-950 text-slate-50 border-white/22",
    });
  }
  if (action && actionStyle) {
    statusBadges.push({
      label: action,
      className: `bg-slate-950 ${actionStyle.text}`,
      borderColor:
        action === "fold" ? "rgba(148,163,184,0.28)" :
        action === "check" ? "rgba(74,222,128,0.42)" :
        action === "call" ? "rgba(96,165,250,0.42)" :
        action === "raise" ? "rgba(248,113,113,0.42)" :
        "rgba(251,191,36,0.46)",
    });
  }
  if (player.handLabel) {
    statusBadges.push({
      label: player.handLabel,
      className: "bg-slate-950 text-amber-100 border-amber-300/28",
    });
  }

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
      style={pos}
      initial={false}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="occupied"
          animate={bounceControls}
          className="relative"
          style={{ width: outerWidth, opacity: seatOpacity }}
        >
          <div
            style={{
              transform: `scale(${DESKTOP_SEAT_CONTENT_SCALE})`,
              transformOrigin: "center center",
            }}
          >
          <div
            className="relative mx-auto"
            style={{ width: clusterWidth, height: clusterHeight }}
          >
            <PlayerPositionMarkers
              isDealer={isDealer}
              isSmallBlind={isSmallBlind}
              isBigBlind={isBigBlind}
              playerCount={playerCount}
              variant="desktop"
              fontSize={badgeFontSize}
            />

            <AnimatePresence>
              {player.winType === "full" && (
                <SeatPulseOutlines
                  color="rgba(245,158,11,0.78)"
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  clusterWidth={clusterWidth}
                  duration={1.45}
                  opacityKeyframes={[0.34, 0.82, 0.34]}
                  scaleKeyframes={[1, 1.03, 1]}
                />
              )}
              {player.winType === "partial" && (
                <SeatPulseOutlines
                  color="rgba(34,197,94,0.74)"
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  clusterWidth={clusterWidth}
                  duration={1.35}
                  opacityKeyframes={[0.3, 0.72, 0.3]}
                  scaleKeyframes={[1, 1.025, 1]}
                />
              )}
              {player.winAnimationKey && player.winType === "full" && (
                <motion.div
                  key={`${player.winAnimationKey}-r1`}
                  initial={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.58 }}
                  transition={{ duration: 1.25, ease: "easeOut" }}
                  className="absolute inset-0 pointer-events-none"
                >
                  <SeatPulseOutlines
                    color="rgba(245,158,11,1)"
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    clusterWidth={clusterWidth}
                    repeat={0}
                    duration={1.25}
                    scaleKeyframes={[1, 1.06, 1.16]}
                    opacityKeyframes={[0.78, 1, 0]}
                  />
                </motion.div>
              )}
              {player.winAnimationKey && player.winType === "full" && (
                <motion.div
                  key={`${player.winAnimationKey}-r2`}
                  initial={{ opacity: 0.72, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.94 }}
                  transition={{ duration: 1.7, ease: "easeOut", delay: 0.18 }}
                  className="absolute inset-0 pointer-events-none"
                >
                  <SeatPulseOutlines
                    color="rgba(245,158,11,0.76)"
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    clusterWidth={clusterWidth}
                    repeat={0}
                    duration={1.7}
                    delay={0.18}
                    scaleKeyframes={[1, 1.08, 1.22]}
                    opacityKeyframes={[0.56, 0.84, 0]}
                  />
                </motion.div>
              )}
              {player.winAnimationKey && player.winType === "partial" && (
                <motion.div
                  key={`${player.winAnimationKey}-partial`}
                  initial={{ opacity: 0.92, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.5 }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                  className="absolute inset-0 pointer-events-none"
                >
                  <SeatPulseOutlines
                    color="rgba(34,197,94,0.96)"
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    clusterWidth={clusterWidth}
                    repeat={0}
                    duration={1.1}
                    scaleKeyframes={[1, 1.05, 1.15]}
                    opacityKeyframes={[0.7, 0.92, 0]}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {isCurrentActor && (
              <SeatPulseOutlines
                color="rgba(248,113,113,0.92)"
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                clusterWidth={clusterWidth}
              />
            )}

            {player.sevenTwoEligible && (
              <SeatPulseOutlines
                color="rgba(250,204,21,0.82)"
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                clusterWidth={clusterWidth}
                duration={2}
                opacityKeyframes={[0.22, 0.65, 0.22]}
              />
            )}

            {(player.hasCards ?? true) && !player.isFolded && !isYou && !hasBothPublicCards && (
              <div className="absolute left-1/2 top-[38%] z-20 -translate-x-1/2 -translate-y-1/2">
                <PeekEye count={player.peekedCount ?? 0} size={peekEyeSize} />
              </div>
            )}

            <div
              className={`absolute inset-0 ${hasBothPublicCards ? "cursor-pointer" : ""}`}
              onPointerEnter={hasBothPublicCards && player.id ? () => onShowdownHoverChange?.(player.id ?? null) : undefined}
              onPointerLeave={hasBothPublicCards ? () => onShowdownHoverChange?.(null) : undefined}
            >
              {publicCards.map((card, i) => (
                <motion.div
                  key={card ? `${player.id ?? seatIndex}-${card.rank}${card.suit}-${handNumber}-${i}` : `${player.id ?? seatIndex}-back-${handNumber}-${i}`}
                  className="absolute top-0"
                  initial={{ scale: 0.86, opacity: 0, y: 14, rotateY: 90 }}
                  animate={{ scale: 1, opacity: 1, y: 0, rotateY: 0 }}
                  transition={{
                    delay: i * 0.06,
                    duration: 0.34,
                    type: "spring",
                    stiffness: 260,
                    damping: 22,
                  }}
                  style={{
                    left: i === 0 ? 0 : clusterWidth - cardWidth,
                    rotate: i === 0 ? -7 : 7,
                    transformOrigin: "50% 88%",
                    perspective: 700,
                    zIndex: i === 0 ? 1 : 2,
                  }}
                >
                  <motion.div
                    animate={player.sevenTwoEligible
                      ? {
                          filter: [
                            "drop-shadow(0 0 10px rgba(234,179,8,0.7))",
                            "drop-shadow(0 0 18px rgba(234,179,8,1))",
                            "drop-shadow(0 0 10px rgba(234,179,8,0.7))",
                          ],
                        }
                      : { filter: "none" }
                    }
                    transition={player.sevenTwoEligible
                      ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.2, ease: "easeOut" }
                    }
                  >
                    <Card
                      card={card ?? undefined}
                      size="desktop"
                      emphasis={showdownCardEmphasisByIndex[i] ?? "neutral"}
                      className={`
                        rounded-[18px] shadow-2xl transition-opacity duration-300
                        ${player.isFolded ? "opacity-75" : ""}
                        ${showdownSpotlightSelected ? "ring-2 ring-red-400/85 ring-offset-2 ring-offset-transparent" : ""}
                      `}
                      style={{
                        width: cardWidth,
                        height: cardHeight,
                        boxShadow: card
                          ? "0 20px 28px rgba(2,6,23,0.38)"
                          : "0 18px 24px rgba(2,6,23,0.34)",
                      }}
                    />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>

          {player.sevenTwoEligible && (
            <motion.div
              className="absolute left-1/2 top-[-18px] -translate-x-1/2 z-20 pointer-events-none"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <SeatBadge
                className="bg-black/95 text-yellow-200 border-yellow-400/55 whitespace-nowrap"
                style={{ fontSize: badgeFontSize }}
              >
                Show for 7-2 bounty
              </SeatBadge>
            </motion.div>
          )}

          {runItOddsPercentage != null && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                left: 0,
                top: -18,
              }}
            >
              <RunItOddsBadge percentage={runItOddsPercentage} />
            </div>
          )}

          {statusBadges.length > 0 && (
            <div
              className="absolute z-20 flex flex-col items-end gap-1.5"
              style={{
                right: statusBadgeRightPx,
                bottom: statusBadgeBottomPx,
              }}
            >
              {statusBadges.map((badge) => (
                <SeatBadge
                  key={badge.label}
                  className={badge.className}
                  style={{
                    fontSize: badgeFontSize,
                    borderColor: badge.borderColor,
                  }}
                >
                  {badge.label}
                </SeatBadge>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col items-center gap-2">
            <div
              onClick={canOpenSeatManager ? onOpenSeatManager : undefined}
              className={`
                flex flex-col items-center gap-2 rounded-[26px] border px-4 py-3 shadow-xl backdrop-blur-md
                ${isYou
                  ? "bg-slate-950/92 border-red-400/34"
                  : "bg-slate-950/88 border-white/12"}
                ${canOpenSeatManager ? "cursor-pointer transition-colors hover:border-red-300/55 hover:bg-slate-900/96" : ""}
              `}
              role={canOpenSeatManager ? "button" : undefined}
              tabIndex={canOpenSeatManager ? 0 : undefined}
              onKeyDown={canOpenSeatManager
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenSeatManager?.();
                    }
                  }
                : undefined}
              style={{ minWidth: clusterWidth + 24, maxWidth: clusterWidth + 44 }}
            >
              <div className="flex w-full items-center gap-3">
                <span
                  className={`min-w-0 flex-1 truncate font-black ${
                    player.isFolded
                      ? "text-slate-400 line-through"
                      : isYou
                        ? "text-red-200"
                        : "text-white"
                  }`}
                  style={{ fontSize: nameFontSize }}
                >
                  {player.name}
                </span>
                <span
                  className={`font-mono font-black tabular-nums ${
                    player.isFolded ? "text-slate-400" : "text-slate-100"
                  }`}
                  style={{ fontSize: stackFontSize }}
                >
                  {formatCents(player.stack)}
                </span>
              </div>
            </div>
          </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default React.memo(Seat);

"use client";
import React, { useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { getAvatarColor, getInitials } from "lib/avatarColor";
import { formatCents } from "lib/formatCents";
import { ACTION_COLORS_MOBILE as ACTION_BADGE } from "lib/actionColors";
import { PeekEyeIcon } from "components/poker/PeekEyeIcon";
import PlayerPositionMarkers from "../PlayerPositionMarkers";
import type { Player } from "types/player";
import type { Card } from "@pokington/shared";

const SUIT_SYMBOLS: Record<string, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };

/** Face-up card sized to peek prominently over the player avatar */
function ShowdownCard({ card }: { card: Card }) {
  const symbol = SUIT_SYMBOLS[card.suit] ?? "?";
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div
      className="rounded-[5px] flex flex-col items-start justify-start shadow-xl w-[34px] h-[50px]"
      style={{
        background: "white",
        border: "1.5px solid #d1d5db",
        color: isRed ? "#dc2626" : "#111827",
        padding: "3px 4px",
      }}
    >
      <span className="text-[11px] font-black leading-none">{card.rank}</span>
      <span className="text-[12px] leading-none mt-0.5">{symbol}</span>
    </div>
  );
}

interface PlayerBubbleProps {
  player: Player | null;
  playerCount?: number;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  emptySeatIndex?: number;
  seatSelectionLocked?: boolean;
  onEmptyTap?: () => void;
}

const PlayerBubble: React.FC<PlayerBubbleProps> = ({
  player,
  playerCount,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  emptySeatIndex,
  seatSelectionLocked = false,
  onEmptyTap,
}) => {
  const minWidth = 58;
  const avatarSize = 42;

  if (!player) {
    return (
      <motion.button
        type="button"
        disabled={seatSelectionLocked}
        className={`flex flex-col items-center gap-0.5 px-0.5 ${seatSelectionLocked ? "opacity-55" : ""}`}
        style={{ minWidth }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.25 } }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
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

  const avatarColor = getAvatarColor(player.name);
  const initials = getInitials(player.name);
  const isFolded = player.isFolded ?? false;
  const isAway = player.isAway ?? false;
  const action = player.lastAction;
  const badge = action ? ACTION_BADGE[action] : null;
  const publicCards = player.holeCards ?? [null, null];
  const showCards = !!player.holeCards;
  const hasBothPublicCards = publicCards[0] != null && publicCards[1] != null;

  // Win animation: bounce the avatar when a win event fires
  const avatarBounce = useAnimation();
  useEffect(() => {
    if (!player.winAnimationKey) return;
    if (player.winType === "full") {
      avatarBounce.start({ scale: [1, 1.22, 0.9, 1.1, 1], transition: { duration: 0.55 } });
    } else {
      avatarBounce.start({ scale: [1, 1.12, 0.95, 1.04, 1], transition: { duration: 0.45 } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.winAnimationKey]);

  return (
    <motion.div
      className="flex flex-col items-center gap-0.5 px-0.5 relative"
      style={{ minWidth }}
      initial={{ scale: 0 }}
      animate={{ scale: 1, opacity: isFolded ? 0.35 : isAway ? 0.55 : 1 }}
      exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      aria-label={`${player.name}, stack ${formatCents(player.stack)}`}
    >
      {/* Showdown: face-up cards peek over the avatar from behind (z-0) */}
      {showCards && (
        <div
          className="absolute z-0 flex pointer-events-none"
          style={{
            top: 0,
            left: "50%",
            transform: "translate(-50%, -50%)",
            gap: 4,
          }}
        >
          {/* 7-2 eligible glow overlay */}
          {player.sevenTwoEligible && (
            <motion.div
              className="absolute inset-[-8px] rounded-lg pointer-events-none"
              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.07, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "radial-gradient(ellipse, rgba(234,179,8,0.55) 0%, transparent 70%)" }}
            />
          )}

          {/* Floating badge */}
          {player.sevenTwoEligible && (
            <motion.div
              className="absolute z-20 text-[7px] font-black text-yellow-300 bg-black/80 px-1.5 py-0.5 rounded-full border border-yellow-400/50 whitespace-nowrap pointer-events-none"
              style={{ top: "-20px", left: "50%", transform: "translateX(-50%)" }}
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              💰 7-2!
            </motion.div>
          )}

          {player.holeCards!.map((card, i) => (
            <motion.div
              key={card ? `${card.rank}${card.suit}` : `back-${i}`}
              initial={{ scale: 0.3, opacity: 0, y: 12 }}
              animate={player.sevenTwoEligible
                ? {
                    scale: 1, opacity: 1, y: 0,
                    filter: [
                      "drop-shadow(0 0 6px rgba(234,179,8,0.8))",
                      "drop-shadow(0 0 12px rgba(234,179,8,1))",
                      "drop-shadow(0 0 6px rgba(234,179,8,0.8))",
                    ],
                  }
                : { scale: 1, opacity: 1, y: 0 }
              }
              transition={player.sevenTwoEligible
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : {
                    delay: i * 0.12,
                    duration: 0.4,
                    type: "spring",
                    stiffness: 240,
                    damping: 20,
                  }
              }
              style={{
                rotate: i === 0 ? -9 : 9,
                transformOrigin: "bottom center",
              }}
            >
              {card ? <ShowdownCard card={card} /> : (
                <div
                  className="w-[34px] h-[50px] rounded-[5px] shadow-xl"
                  style={{
                    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                    border: "1.5px solid rgba(255,255,255,0.1)",
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Avatar + info rendered in front of cards */}
      <div className="relative z-10 flex flex-col items-center gap-0.5 w-full">
        <div className="relative">
          {player.isCurrentActor && (
            <span className="absolute inset-[-3px] rounded-full pointer-events-none z-0 animate-pulse-ring" />
          )}

          {/* Win animation rings around avatar */}
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

          <motion.div animate={avatarBounce}>
          <div
            className={[
              "rounded-full flex items-center justify-center relative z-10",
              player.isCurrentActor ? "ring-2 ring-red-500" : "",
              isFolded ? "grayscale" : "",
            ].join(" ")}
            style={{ backgroundColor: avatarColor, width: avatarSize, height: avatarSize }}
          >
            <span className="font-black text-white text-xs select-none">{initials}</span>
          </div>
          </motion.div>

          {/* Peek indicator */}
          {(player.hasCards ?? false) && !isFolded && !hasBothPublicCards && (() => {
            const pc = player.peekedCount ?? 0;
            const bgClass =
              pc === 0 ? "bg-gray-700/80 border-gray-500/40" :
              pc === 1 ? "bg-yellow-600/90 border-yellow-400/50" :
              "bg-emerald-600/90 border-emerald-400/50";
            return (
              <div className={`absolute -top-1 -left-1 w-[18px] h-[18px] rounded-full border flex items-center justify-center z-20 shadow-lg ${bgClass}`}>
                <PeekEyeIcon count={pc} size={10} strokeWidth={2.5} className={pc === 0 ? "text-white opacity-50" : "text-white"} />
              </div>
            );
          })()}

          <PlayerPositionMarkers
            isDealer={isDealer}
            isSmallBlind={isSmallBlind}
            isBigBlind={isBigBlind}
            playerCount={playerCount}
            variant="mobile"
          />
        </div>

        <span
          className={`text-[9px] font-semibold max-w-[52px] truncate text-center block leading-tight ${
            isFolded
              ? "text-gray-500 dark:text-gray-600"
              : "text-gray-600 dark:text-gray-300"
          }`}
        >
          {player.name}
        </span>

        {player.isAllIn ? (
          <span className="font-mono font-black text-[9px] leading-tight text-amber-500 bg-amber-500/20 px-1.5 rounded">
            ALL IN
          </span>
        ) : (
          <span
            className={`font-mono font-bold text-[9px] leading-tight ${
              isFolded
                ? "text-gray-500 dark:text-gray-600"
                : "text-gray-900 dark:text-white"
            }`}
          >
            {formatCents(player.stack)}
          </span>
        )}

        {/* Showdown: hand label. During play: bet amount or action badge. */}
        <div className="h-[14px] hidden xs:flex items-center justify-center w-full">
          {showCards ? (
            <AnimatePresence mode="wait">
              {player.handLabel ? (
                <motion.span
                  key={player.handLabel}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="text-[7px] font-black text-center truncate max-w-[58px] px-1.5 py-[1px] rounded-full"
                  style={{
                    background: "rgba(0,0,0,0.72)",
                    color: "#fde68a",
                    border: "1px solid rgba(234,179,8,0.3)",
                  }}
                >
                  {player.handLabel}
                </motion.span>
              ) : null}
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              {(player.currentBet ?? 0) > 0 && !isFolded ? (
                <motion.span
                  key="bet"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="px-1.5 py-[1px] rounded-full text-[8px] font-black bg-yellow-400 text-black"
                >
                  {formatCents(player.currentBet!)}
                </motion.span>
              ) : badge ? (
                <motion.span
                  key="action"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className={`px-1.5 py-[1px] rounded text-[7px] font-black ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </motion.span>
              ) : null}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(PlayerBubble);

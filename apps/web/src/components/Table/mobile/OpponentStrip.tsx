"use client";
import React from "react";
import PlayerBubble from "./PlayerBubble";
import type { Player } from "types/player";
import { useColorScheme } from "hooks/useColorScheme";
import {
  MOBILE_SEAT_STRIP_HEIGHT_PX,
  MOBILE_SEAT_STRIP_TOTAL_SEATS,
  getMobileSeatStripSlot,
} from "lib/mobileSeatStripLayout.mjs";

interface OpponentStripProps {
  players: Array<Player | null>;
  playerCount?: number;
  dealerIndex?: number;
  smallBlindIndex?: number;
  bigBlindIndex?: number;
  seatSelectionLocked?: boolean;
  onEmptySeatTap?: (seatIndex: number) => void;
  selectedDetailSeatIndex?: number | null;
  onPlayerTap?: (seatIndex: number) => void;
  selectedSpotlightPlayerId?: string | null;
  spotlightHoleCardEmphasisByIndex?: Array<"neutral" | "highlighted" | "dimmed">;
  runItOddsPercentagesByPlayerId?: Record<string, number | null>;
}

const OpponentStrip: React.FC<OpponentStripProps> = ({
  players,
  playerCount,
  dealerIndex,
  smallBlindIndex,
  bigBlindIndex,
  seatSelectionLocked = false,
  onEmptySeatTap,
  selectedDetailSeatIndex = null,
  onPlayerTap,
  selectedSpotlightPlayerId = null,
  spotlightHoleCardEmphasisByIndex = ["neutral", "neutral"],
  runItOddsPercentagesByPlayerId = {},
}) => {
  const isDark = useColorScheme() === "dark";
  const seats = Array.from({ length: MOBILE_SEAT_STRIP_TOTAL_SEATS }, (_, seatIndex) => {
    const slot = getMobileSeatStripSlot(seatIndex);
    return {
      seatIndex,
      slot,
      player: players[seatIndex] ?? null,
    };
  }).filter((seat): seat is { seatIndex: number; slot: NonNullable<ReturnType<typeof getMobileSeatStripSlot>>; player: Player | null } => seat.slot != null);
  const stripInsetXPx = 4;
  const stripBottomInsetPx = 4;
  const feltInsetXPx = 10;
  const feltInsetTopPx = 6;
  const feltInsetBottomPx = 16;
  const railInsetBottomPx = feltInsetBottomPx - feltInsetTopPx;

  return (
    <div className="relative w-full px-1.5" style={{ height: MOBILE_SEAT_STRIP_HEIGHT_PX }}>
      <div
        className="absolute inset-y-0 z-0"
        style={{
          left: stripInsetXPx,
          right: stripInsetXPx,
          bottom: stripBottomInsetPx,
        }}
      >
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 rounded-[34px] shadow-[0_18px_36px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_40px_rgba(2,6,23,0.24)]"
          style={{
            bottom: railInsetBottomPx,
            background: isDark
              ? "linear-gradient(180deg, rgba(50,36,36,0.94), rgba(26,18,18,0.98))"
              : "linear-gradient(180deg, rgba(43,58,78,0.94), rgba(17,25,39,0.98))",
          }}
        />
        {seats.map(({ seatIndex, slot, player }) => {
          const isActive = player?.isCurrentActor === true;
          const contentKey = player?.id
            ? `player-${player.id}`
            : `empty-${seatIndex}`;
          const baseZIndex = player
            ? (slot.row === 0 ? 24 : 16)
            : 8;
          const seatZIndex = isActive ? baseZIndex + 10 : baseZIndex;

          return (
            <div
              key={`seat-slot-${seatIndex}`}
              className="absolute"
              style={{
                left: `${slot.leftPct}%`,
                top: `${slot.topPct}%`,
                zIndex: seatZIndex,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div key={contentKey}>
                {player ? (
                  <PlayerBubble
                    player={player}
                    seatSlot={slot}
                    seatIndex={seatIndex}
                    detailSelected={selectedDetailSeatIndex === seatIndex}
                    onPlayerTap={() => onPlayerTap?.(seatIndex)}
                    playerCount={playerCount}
                    isDealer={seatIndex === dealerIndex}
                    isSmallBlind={seatIndex === smallBlindIndex}
                    isBigBlind={seatIndex === bigBlindIndex}
                    showdownSpotlightSelected={player.id === selectedSpotlightPlayerId}
                    showdownCardEmphasisByIndex={player.id === selectedSpotlightPlayerId ? spotlightHoleCardEmphasisByIndex : undefined}
                    runItOddsPercentage={player.id ? (runItOddsPercentagesByPlayerId[player.id] ?? null) : null}
                  />
                ) : (
                  <PlayerBubble
                    player={null}
                    seatIndex={seatIndex}
                    emptySeatIndex={seatIndex}
                    seatSelectionLocked={seatSelectionLocked}
                    onEmptyTap={seatSelectionLocked ? undefined : () => onEmptySeatTap?.(seatIndex)}
                  />
                )}
              </div>
            </div>
          );
        })}
        <div
          className="pointer-events-none absolute overflow-hidden rounded-[28px] shadow-inner"
          style={{
            left: feltInsetXPx,
            right: feltInsetXPx,
            top: feltInsetTopPx,
            bottom: feltInsetBottomPx,
            background: isDark
              ? "radial-gradient(ellipse at 50% 38%, #2c1f1f 0%, #1a1212 55%, #0d0808 100%)"
              : "radial-gradient(ellipse at 50% 38%, #1e2a3a 0%, #111a26 58%, #070c14 100%)",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_34%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_36%)]" />
        </div>
      </div>
    </div>
  );
};

export default OpponentStrip;

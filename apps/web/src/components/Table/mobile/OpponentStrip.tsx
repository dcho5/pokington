"use client";
import React from "react";
import PlayerBubble from "./PlayerBubble";
import type { Player } from "types/player";
import {
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
  selectedSpotlightPlayerId?: string | null;
  onShowdownPlayerTap?: (playerId: string) => void;
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
  selectedSpotlightPlayerId = null,
  onShowdownPlayerTap,
  spotlightHoleCardEmphasisByIndex = ["neutral", "neutral"],
  runItOddsPercentagesByPlayerId = {},
}) => {
  const seats = Array.from({ length: MOBILE_SEAT_STRIP_TOTAL_SEATS }, (_, seatIndex) => {
    const slot = getMobileSeatStripSlot(seatIndex);
    return {
      seatIndex,
      slot,
      player: players[seatIndex] ?? null,
    };
  }).filter((seat): seat is { seatIndex: number; slot: NonNullable<ReturnType<typeof getMobileSeatStripSlot>>; player: Player | null } => seat.slot != null);

  return (
    <div className="relative h-[172px] w-full px-2">
      {seats.map(({ seatIndex, slot, player }) => {
        const isActive = player?.isCurrentActor === true;
        const isViewerSeat = player?.isYou === true;
        const contentKey = isViewerSeat
          ? `viewer-${seatIndex}`
          : player?.id
            ? `player-${player.id}`
            : `empty-${seatIndex}`;

        return (
          <div
            key={`seat-slot-${seatIndex}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${isActive ? "z-10" : "z-0"}`}
            style={{
              left: `${slot.leftPct}%`,
              top: `${slot.topPct}%`,
            }}
          >
            <div key={contentKey}>
              {isViewerSeat ? (
                <PlayerBubble
                  player={null}
                  playerCount={playerCount}
                  isDealer={seatIndex === dealerIndex}
                  isSmallBlind={seatIndex === smallBlindIndex}
                  isBigBlind={seatIndex === bigBlindIndex}
                  emptySeatIndex={seatIndex}
                  isViewerSeatPlaceholder
                />
              ) : player ? (
                <PlayerBubble
                  player={player}
                  playerCount={playerCount}
                  isDealer={seatIndex === dealerIndex}
                  isSmallBlind={seatIndex === smallBlindIndex}
                  isBigBlind={seatIndex === bigBlindIndex}
                  showdownSpotlightSelected={player.id === selectedSpotlightPlayerId}
                  onShowdownPlayerTap={onShowdownPlayerTap}
                  showdownCardEmphasisByIndex={player.id === selectedSpotlightPlayerId ? spotlightHoleCardEmphasisByIndex : undefined}
                  runItOddsPercentage={player.id ? (runItOddsPercentagesByPlayerId[player.id] ?? null) : null}
                />
              ) : (
                <PlayerBubble
                  player={null}
                  emptySeatIndex={seatIndex}
                  seatSelectionLocked={seatSelectionLocked}
                  onEmptyTap={seatSelectionLocked ? undefined : () => onEmptySeatTap?.(seatIndex)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OpponentStrip;

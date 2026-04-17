"use client";
import React from "react";
import { AnimatePresence } from "framer-motion";
import PlayerBubble from "./PlayerBubble";
import type { Player } from "types/player";

interface OpponentStripProps {
  players: Array<{ player: Player; seatIndex: number }>;
  playerCount?: number;
  dealerIndex?: number;
  smallBlindIndex?: number;
  bigBlindIndex?: number;
  emptySeats?: number[];
  seatSelectionLocked?: boolean;
  onEmptySeatTap?: (seatIndex: number) => void;
}

/** Merge occupied + empty into a single clockwise-ordered list */
type SeatItem =
  | { type: "player"; player: Player; seatIndex: number }
  | { type: "empty"; seatIndex: number };

const OpponentStrip: React.FC<OpponentStripProps> = ({
  players,
  playerCount,
  dealerIndex,
  smallBlindIndex,
  bigBlindIndex,
  emptySeats = [],
  seatSelectionLocked = false,
  onEmptySeatTap,
}) => {
  const items: SeatItem[] = [
    ...players.map(({ player, seatIndex }) => ({
      type: "player" as const,
      player,
      seatIndex,
    })),
    ...emptySeats.map((seatIndex) => ({
      type: "empty" as const,
      seatIndex,
    })),
  ].sort((a, b) => a.seatIndex - b.seatIndex);

  if (items.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-gray-600 text-center italic">
        No opponents seated
      </div>
    );
  }

  const row1 = items.slice(0, 5);
  const row2 = items.slice(5);
  const row2Left  = row2.slice(0, Math.ceil(row2.length / 2));
  const row2Right = row2.slice(Math.ceil(row2.length / 2));

  const renderItem = (item: SeatItem) => {
    if (item.type === "player") {
      return (
      <PlayerBubble
        player={item.player}
        playerCount={playerCount}
        isDealer={item.seatIndex === dealerIndex}
        isSmallBlind={item.seatIndex === smallBlindIndex}
        isBigBlind={item.seatIndex === bigBlindIndex}
      />
    );
  }
  return (
    <PlayerBubble
      player={null}
      emptySeatIndex={item.seatIndex}
      seatSelectionLocked={seatSelectionLocked}
      onEmptyTap={seatSelectionLocked ? undefined : () => onEmptySeatTap?.(item.seatIndex)}
    />
    );
  };

  return (
    <div className="flex flex-col gap-0 px-2 py-0.5">
      {/* Row 1 — 5 equal columns */}
      <div className="flex">
        <AnimatePresence>
          {Array.from({ length: 5 }, (_, i) => {
            const item = row1[i];
            const isActive = item?.type === "player" && item.player.isCurrentActor;
            return (
              <div
                key={item?.seatIndex ?? `empty-${i}`}
                className={`flex-1 flex justify-center relative ${isActive ? "z-10" : "z-0"}`}
              >
                {i < row1.length ? renderItem(row1[i]) : null}
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Row 2 — same 5 equal columns; column 2 (center) is the "your seat" gap */}
      {row2.length > 0 && (
        <div className="flex">
          <AnimatePresence>
            {/* Columns 0 & 1: left half of row 2 */}
            {[0, 1].map((i) => {
              const item = row2Left[i];
              const isActive = item?.type === "player" && item.player.isCurrentActor;
              return (
                <div
                  key={item?.seatIndex ?? `el-${i}`}
                  className={`flex-1 flex justify-center relative ${isActive ? "z-10" : "z-0"}`}
                >
                  {i < row2Left.length ? renderItem(row2Left[i]) : null}
                </div>
              );
            })}
            {/* Column 2: your seat gap */}
            <div key="gap" className="flex-1" />
            {/* Columns 3 & 4: right half of row 2 */}
            {[0, 1].map((i) => {
              const item = row2Right[i];
              const isActive = item?.type === "player" && item.player.isCurrentActor;
              return (
                <div
                  key={item?.seatIndex ?? `er-${i}`}
                  className={`flex-1 flex justify-center relative ${isActive ? "z-10" : "z-0"}`}
                >
                  {i < row2Right.length ? renderItem(row2Right[i]) : null}
                </div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default OpponentStrip;

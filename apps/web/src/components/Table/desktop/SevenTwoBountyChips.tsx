"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { computeSeatCoords, type TableGeometry } from "lib/seatLayout";
import { formatCents } from "@pokington/shared";

const CHIP_DURATION_S = 1.8;
// Table aspect ratio (height / width)
const AR = 9 / 21;
const POT_TOP_FRAC = 0.62;

interface SevenTwoBountyChipsProps {
  winnerId: string;
  perPlayer: number;         // cents per player
  players: Array<{ id?: string; seatIndex: number } | null>;
  totalSeats: number;
  geometry: TableGeometry;
  containerWidth: number;
  handNumber: number;
}

export const SevenTwoBountyChips: React.FC<SevenTwoBountyChipsProps> = ({
  winnerId,
  perPlayer,
  players,
  totalSeats,
  geometry,
  containerWidth,
  handNumber,
}) => {
  if (containerWidth === 0) return null;

  const containerHeight = containerWidth * AR;

  const winnerPlayer = players.find((p) => p?.id === winnerId);
  if (!winnerPlayer) return null;

  const { x: wx, y: wy } = computeSeatCoords(winnerPlayer.seatIndex, totalSeats, geometry);
  const winnerPxX = containerWidth * (0.5 + wx / 100);
  const winnerPxY = containerHeight * (0.5 + wy / 100);

  // Chips fly FROM each non-winner seat TO winner seat
  const chips = players
    .filter((p): p is NonNullable<typeof p> => p != null && p.id !== winnerId)
    .map((p, i) => {
      const { x: sx, y: sy } = computeSeatCoords(p.seatIndex, totalSeats, geometry);
      const startPxX = containerWidth * (0.5 + sx / 100);
      const startPxY = containerHeight * (0.5 + sy / 100);
      return {
        id: p.id,
        startPxX,
        startPxY,
        delay: 1.2 + i * 0.15,
        chipKey: `${handNumber}-72bounty-${p.id}`,
      };
    });

  if (chips.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40" aria-hidden>
      <AnimatePresence>
        {chips.map(({ id, startPxX, startPxY, delay, chipKey }) => {
          const dx = winnerPxX - startPxX;
          const dy = winnerPxY - startPxY;

          return (
            <motion.div
              key={chipKey}
              className="absolute"
              style={{
                left: startPxX,
                top: startPxY,
                translateX: "-50%",
                translateY: "-50%",
              }}
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
              animate={{
                x: dx,
                y: dy,
                scale: [0.3, 1.4, 0.9, 1],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                delay,
                duration: CHIP_DURATION_S,
                ease: [0.34, 1.56, 0.64, 1],
                opacity: { times: [0, 0.06, 0.55, 1], duration: CHIP_DURATION_S },
              }}
            >
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className="relative w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      "radial-gradient(circle at 36% 30%, #fca5a5 0%, #dc2626 55%, #7f1d1d 100%)",
                    border: "2px solid rgba(252,165,165,0.7)",
                    boxShadow:
                      "0 0 28px rgba(239,68,68,0.9), 0 0 40px 12px rgba(239,68,68,0.4), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.2)",
                  }}
                >
                  <div
                    className="absolute rounded-full"
                    style={{
                      inset: 5,
                      border: "1.5px solid rgba(252,165,165,0.35)",
                      background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.1), transparent)",
                    }}
                  />
                  <span className="relative text-[11px] font-black text-red-100 select-none">$</span>
                </div>
                <span
                  className="text-xs font-mono font-black whitespace-nowrap px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(0,0,0,0.75)",
                    color: "#fca5a5",
                    textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                    border: "1px solid rgba(239,68,68,0.3)",
                  }}
                >
                  -{formatCents(perPlayer)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

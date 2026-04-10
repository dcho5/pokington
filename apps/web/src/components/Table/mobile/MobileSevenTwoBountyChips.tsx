"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "lib/formatCents";

const CHIP_DURATION_S = 1.8;

const POT_X_FRAC = 0.50;
const POT_Y_FRAC = 0.38;
const OPP_Y_FRAC = 0.12;
const YOU_Y_FRAC = 0.76;

interface MobileSevenTwoBountyChipsProps {
  winnerId: string;
  perPlayer: number;
  players: Array<{ id?: string; seatIndex: number; isYou?: boolean } | null>;
  handNumber: number;
}

export const MobileSevenTwoBountyChips: React.FC<MobileSevenTwoBountyChipsProps> = ({
  winnerId,
  perPlayer,
  players,
  handNumber,
}) => {
  const vpW = typeof window !== "undefined" ? window.innerWidth : 390;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 844;

  const seated = players.filter((p): p is NonNullable<typeof p> => p != null);
  const opponents = seated.filter((p) => !p.isYou).sort((a, b) => a.seatIndex - b.seatIndex);

  function getPlayerPx(playerId: string): { x: number; y: number } | null {
    const p = seated.find((s) => s.id === playerId);
    if (!p) return null;
    if (p.isYou) return { x: vpW * 0.5, y: vpH * YOU_Y_FRAC };
    const idx = opponents.findIndex((o) => o.id === playerId);
    if (idx < 0) return null;
    const col = idx % 5;
    const x = vpW * ((col + 0.5) / 5);
    return { x, y: vpH * OPP_Y_FRAC };
  }

  const winnerPos = getPlayerPx(winnerId);
  if (!winnerPos) return null;

  const chips = seated
    .filter((p) => p.id !== winnerId)
    .map((p, i) => {
      const src = getPlayerPx(p.id!);
      if (!src) return null;
      return {
        id: p.id,
        src,
        delay: 1.2 + i * 0.15,
        chipKey: `${handNumber}-72mob-${p.id}`,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (chips.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40" aria-hidden>
      <AnimatePresence>
        {chips.map(({ id, src, delay, chipKey }) => {
          const dx = winnerPos.x - src.x;
          const dy = winnerPos.y - src.y;

          return (
            <motion.div
              key={chipKey}
              className="absolute"
              style={{
                left: src.x,
                top: src.y,
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
                  className="relative w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      "radial-gradient(circle at 36% 30%, #fca5a5 0%, #dc2626 55%, #7f1d1d 100%)",
                    border: "1.5px solid rgba(252,165,165,0.7)",
                    boxShadow: "0 0 22px rgba(239,68,68,0.9), 0 0 30px 10px rgba(239,68,68,0.35), 0 2px 6px rgba(0,0,0,0.6)",
                  }}
                >
                  <span className="relative text-[10px] font-black text-red-100 select-none">$</span>
                </div>
                <span
                  className="text-[11px] font-mono font-black whitespace-nowrap px-1.5 py-[1px] rounded-full"
                  style={{
                    background: "rgba(0,0,0,0.75)",
                    color: "#fca5a5",
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

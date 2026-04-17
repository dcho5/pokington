"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { computeSeatCoords, type TableGeometry } from "lib/seatLayout";
import { formatCents } from "lib/formatCents";
import { ANNOUNCE_DELAY_S, CHIP_DURATION_S, getRunTimings } from "lib/showdownTiming";
import type { WinnerInfo } from "@pokington/engine";

interface WinnerChipsAnimationProps {
  winners: WinnerInfo[];
  players: Array<{ id?: string; seatIndex: number } | null>;
  totalSeats: number;
  geometry: TableGeometry;
  containerWidth: number;  // actual pixel width of the table container div
  handNumber: number;      // key — resets animation on new hand
  // Optional: per-run results for multi-run payout. When provided, chips fire per run.
  runResults?: { winners: WinnerInfo[] }[];
  // How many community cards were already visible before the all-in board was run
  knownCardCount?: number;
  revealRunsConcurrently?: boolean;
  tableAspectRatio?: number;
  potTopPct?: number;
  potLeftPct?: number;
}

export const WinnerChipsAnimation: React.FC<WinnerChipsAnimationProps> = ({
  winners,
  runResults,
  players,
  totalSeats,
  geometry,
  containerWidth,
  handNumber,
  knownCardCount = 0,
  revealRunsConcurrently = false,
  tableAspectRatio = 21 / 9,
  potTopPct = 62,
  potLeftPct = 50,
}) => {
  if (containerWidth === 0) return null;

  const containerHeight = containerWidth / tableAspectRatio;
  const potPxX = containerWidth * (potLeftPct / 100);
  const potPxY = containerHeight * (potTopPct / 100);

  const { chipStartS, runIntervalS } = getRunTimings(knownCardCount, { revealRunsConcurrently });

  // Build a flat list of chips with individual delays.
  // For all-in showdowns, split winners into pot tiers: tier0 = first occurrence per player
  // (main pot), tier1 = repeated occurrences (side pots). Tier1 chips fly 0.8s after tier0
  // so the viewer can distinguish main-pot from side-pot payouts visually.
  function buildRunChips(
    runWinners: WinnerInfo[],
    baseDelay: number,
    runIdx: number,
  ): { winner: WinnerInfo; delay: number; chipKey: string }[] {
    const seen = new Set<string>();
    const tier0: WinnerInfo[] = [];
    const tier1: WinnerInfo[] = [];
    for (const w of runWinners) {
      if (seen.has(w.playerId)) tier1.push(w);
      else { seen.add(w.playerId); tier0.push(w); }
    }
    return [
      ...tier0.map((w, i) => ({
        winner: w,
        delay: baseDelay + i * 0.35,
        chipKey: `${handNumber}-r${runIdx}-t0-${w.playerId}`,
      })),
      ...tier1.map((w, i) => ({
        winner: w,
        delay: baseDelay + 0.8 + i * 0.35,
        chipKey: `${handNumber}-r${runIdx}-t1-${w.playerId}`,
      })),
    ];
  }

  const chips: { winner: WinnerInfo; delay: number; chipKey: string }[] =
    runResults && runResults.length > 1
      ? // Multi-run: stagger by run, offset by announcement banner delay
        runResults.flatMap((run, runIdx) =>
          buildRunChips(run.winners, ANNOUNCE_DELAY_S + runIdx * runIntervalS + chipStartS, runIdx)
        )
      : runResults && runResults.length === 1
      ? // Single-run all-in: announcement plays first, then chips after cards dealt
        buildRunChips(runResults[0].winners, ANNOUNCE_DELAY_S + chipStartS, 0)
      : // Normal showdown (no all-in board run)
        winners.map((winner, idx) => ({
          winner,
          delay: 0.4 + idx * 0.35,
          chipKey: `${handNumber}-winner-${winner.playerId}`,
        }));

  if (chips.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40" aria-hidden>
      <AnimatePresence>
        {chips.map(({ winner, delay, chipKey }) => {
          const player = players.find((p) => p?.id === winner.playerId);
          if (!player) return null;

          const { x: sx, y: sy } = computeSeatCoords(player.seatIndex, totalSeats, geometry);

          const seatPxX = containerWidth * (0.5 + sx / 100);
          const seatPxY = containerHeight * (0.5 + sy / 100);
          const dx = seatPxX - potPxX;
          const dy = seatPxY - potPxY;

          return (
            <motion.div
              key={chipKey}
              className="absolute"
              style={{
                left: potPxX,
                top: potPxY,
                translateX: "-50%",
                translateY: "-50%",
              }}
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
              animate={{
                x: dx,
                y: dy,
                scale: [0.4, 1.25, 1],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                delay,
                duration: CHIP_DURATION_S,
                ease: [0.34, 1.56, 0.64, 1],
                opacity: { times: [0, 0.05, 0.58, 1], duration: CHIP_DURATION_S },
              }}
            >
              <div className="flex flex-col items-center gap-0.5">
                <div className="relative w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      "radial-gradient(circle at 36% 30%, #fde68a 0%, #d97706 55%, #92400e 100%)",
                    border: "2.5px solid rgba(253,230,138,0.7)",
                    boxShadow:
                      "0 0 18px rgba(234,179,8,0.7), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.25)",
                  }}
                >
                  <div
                    className="absolute rounded-full"
                    style={{
                      inset: 4,
                      border: "1.5px solid rgba(253,230,138,0.4)",
                      background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.12), transparent)",
                    }}
                  />
                  <span className="relative text-[9px] font-black text-yellow-900 select-none">$</span>
                </div>
                <span
                  className="text-[10px] font-mono font-black whitespace-nowrap px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(0,0,0,0.75)",
                    color: "#fde68a",
                    textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                    border: "1px solid rgba(253,230,138,0.25)",
                  }}
                >
                  +{formatCents(winner.amount)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

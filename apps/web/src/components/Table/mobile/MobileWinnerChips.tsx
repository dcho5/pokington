"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "lib/formatCents";
import { getRunTimings, ANNOUNCE_DELAY_S } from "components/Table/desktop/WinnerChipsAnimation";
import type { WinnerInfo } from "@pokington/engine";

const CHIP_DURATION_S = 2.4;

// Approximate viewport fractions for each layout zone
const POT_X_FRAC = 0.50;   // center of screen horizontally
const POT_Y_FRAC = 0.38;   // roughly center of the CommunityCards zone
const OPP_Y_FRAC = 0.14;   // OpponentStrip row 1 center (accounts for extra pt-7 padding)
const OPP_ROW2_Y_FRAC = 0.24; // OpponentStrip row 2 center
const YOU_Y_FRAC = 0.76;   // HandPanel / viewer area

interface MobileWinnerChipsProps {
  winners: WinnerInfo[];
  runResults?: { winners: WinnerInfo[] }[];
  players: Array<{ id?: string; seatIndex: number; isYou?: boolean } | null>;
  knownCardCount?: number;
  handNumber: number;
}

export const MobileWinnerChips: React.FC<MobileWinnerChipsProps> = ({
  winners,
  runResults,
  players,
  knownCardCount = 0,
  handNumber,
}) => {
  const vpW = typeof window !== "undefined" ? window.innerWidth : 390;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 844;

  const potPxX = vpW * POT_X_FRAC;
  const potPxY = vpH * POT_Y_FRAC;

  const { chipStartS, runIntervalS } = getRunTimings(knownCardCount);

  // Seated non-null players
  const seated = players.filter((p): p is NonNullable<typeof p> => p != null);

  // Build all non-viewer columns (occupied + empty) sorted by seatIndex —
  // mirrors the merged items list that OpponentStrip uses for column assignment.
  const allNonViewerCols = players
    .map((p, i) => ({ seatIndex: i, id: p?.id ?? null, isViewer: p?.isYou ?? false }))
    .filter((item) => !item.isViewer)
    .sort((a, b) => a.seatIndex - b.seatIndex);

  function getPlayerPx(playerId: string): { x: number; y: number } | null {
    const p = seated.find((s) => s.id === playerId);
    if (!p) return null;
    if (p.isYou) return { x: vpW * 0.5, y: vpH * YOU_Y_FRAC };

    // Row 1: first 5 columns
    const row1 = allNonViewerCols.slice(0, 5);
    const col = row1.findIndex((item) => item.id === playerId);
    if (col >= 0) {
      return { x: vpW * ((col + 0.5) / 5), y: vpH * OPP_Y_FRAC };
    }

    // Row 2: left half (cols 0–1), gap (col 2 = viewer gap), right half (cols 3–4)
    const row2 = allNonViewerCols.slice(5);
    const row2Left = row2.slice(0, Math.ceil(row2.length / 2));
    const row2Right = row2.slice(Math.ceil(row2.length / 2));
    const colLeft = row2Left.findIndex((item) => item.id === playerId);
    if (colLeft >= 0) {
      return { x: vpW * ((colLeft + 0.5) / 5), y: vpH * OPP_ROW2_Y_FRAC };
    }
    const colRight = row2Right.findIndex((item) => item.id === playerId);
    if (colRight >= 0) {
      return { x: vpW * ((colRight + 3 + 0.5) / 5), y: vpH * OPP_ROW2_Y_FRAC };
    }

    return null;
  }

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
      ? runResults.flatMap((run, runIdx) =>
          buildRunChips(run.winners, ANNOUNCE_DELAY_S + runIdx * runIntervalS + chipStartS, runIdx)
        )
      : runResults && runResults.length === 1
      ? buildRunChips(runResults[0].winners, ANNOUNCE_DELAY_S + chipStartS, 0)
      : winners.map((winner, idx) => ({
          winner,
          delay: 0.4 + idx * 0.35,
          chipKey: `${handNumber}-winner-${winner.playerId}`,
        }));

  if (chips.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40" aria-hidden>
      <AnimatePresence>
        {chips.map(({ winner, delay, chipKey }) => {
          const dest = getPlayerPx(winner.playerId);
          if (!dest) return null;

          const dx = dest.x - potPxX;
          const dy = dest.y - potPxY;

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
                scale: [0.4, 1.2, 1],
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
                <div
                  className="relative w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 36% 30%, #fde68a 0%, #d97706 55%, #92400e 100%)",
                    border: "2px solid rgba(253,230,138,0.7)",
                    boxShadow: "0 0 14px rgba(234,179,8,0.7), 0 2px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.25)",
                  }}
                >
                  <div
                    className="absolute rounded-full"
                    style={{
                      inset: 3,
                      border: "1.5px solid rgba(253,230,138,0.4)",
                      background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.12), transparent)",
                    }}
                  />
                  <span className="relative text-[8px] font-black text-yellow-900 select-none">$</span>
                </div>
                <span
                  className="text-[9px] font-mono font-black whitespace-nowrap px-1.5 py-[1px] rounded-full"
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

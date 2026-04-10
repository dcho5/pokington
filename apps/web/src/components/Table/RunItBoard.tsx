"use client";
import React from "react";
import { motion } from "framer-motion";
import Card from "components/poker/Card";
import { deriveRunAnimation } from "lib/runAnimation";
import { useRunAnimationTicker } from "hooks/useRunAnimationTicker";
import type { RunResult } from "@pokington/engine";

const CARD_COUNT = 5;

interface RunItBoardProps {
  runResults: RunResult[];
  knownCardCount: number;
  runDealStartedAt: number;
  handNumber: number;
  /** true = mobile (flex-based sizing), false = desktop (fixed px sizing) */
  compact?: boolean;
}

const DESKTOP_CARD = "w-[72px] h-[100px] lg:w-[96px] lg:h-[136px]";
const DESKTOP_GAP = "gap-3 lg:gap-5";
const MOBILE_CARD = "flex-1";
const MOBILE_GAP = "gap-[2%]";

export default function RunItBoard({
  runResults,
  knownCardCount,
  runDealStartedAt,
  handNumber,
  compact = false,
}: RunItBoardProps) {
  const { currentRun, revealedCount } = deriveRunAnimation(
    runDealStartedAt,
    knownCardCount,
    runResults.length,
  );
  const totalRuns = runResults.length;
  const animationComplete = currentRun === totalRuns - 1 && revealedCount === CARD_COUNT;
  useRunAnimationTicker(runDealStartedAt, knownCardCount, totalRuns, !animationComplete);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {Array.from({ length: totalRuns }, (_, r) => {
        const isPast = r < currentRun;
        const isCurrent = r === currentRun;
        const isFuture = r > currentRun;
        const rowOpacity = isPast ? 0.45 : 1;

        return (
          <div key={`run-${handNumber}-${r}`} className="flex flex-col items-center gap-1 w-full">
            <motion.div
              animate={{ opacity: isFuture ? 0.25 : isCurrent ? 1 : 0.45 }}
              transition={{ duration: 0.3 }}
              className={
                compact
                  ? "text-[9px] font-black uppercase tracking-[0.2em] text-white/60 select-none"
                  : "text-[10px] font-black uppercase tracking-[0.25em] text-white/60 select-none"
              }
            >
              Run {r + 1}
            </motion.div>

            <motion.div
              animate={{ opacity: rowOpacity }}
              transition={{ duration: 0.4 }}
              className={`flex justify-center ${compact ? MOBILE_GAP : DESKTOP_GAP} w-full`}
            >
              {Array.from({ length: CARD_COUNT }, (_, i) => {
                const isKnown = i < knownCardCount;

                if (isKnown) {
                  return (
                    <div key={i} className={compact ? MOBILE_CARD : DESKTOP_CARD}>
                      <Card
                        card={runResults[r]?.board[i]}
                        className="w-full aspect-[5/7] rounded-xl shadow-xl"
                      />
                    </div>
                  );
                }

                const newCardIdx = i - knownCardCount;
                const isRevealed =
                  isPast ||
                  (isCurrent && i < revealedCount);

                return (
                  <div key={i} className={`${compact ? MOBILE_CARD : DESKTOP_CARD} relative aspect-[5/7]`} style={{ perspective: 600 }}>
                    {isRevealed ? (
                      <motion.div
                        className="absolute inset-0"
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 25,
                          delay: newCardIdx * 0.08,
                        }}
                      >
                        <Card
                          card={runResults[r]?.board[i]}
                          className="w-full h-full rounded-xl shadow-xl"
                        />
                      </motion.div>
                    ) : (
                      <div className="absolute inset-0">
                        <Card
                          card={undefined}
                          className="w-full h-full rounded-xl shadow-xl"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

"use client";
import React from "react";
import { motion } from "framer-motion";
import Card from "components/poker/Card";
import { deriveVisibleRunState } from "lib/runAnimation";
import type { RunResult } from "@pokington/engine";
import type { DesktopRunItCenterStage } from "lib/desktopTableLayout";

const CARD_COUNT = 5;

interface RunItBoardProps {
  runResults: RunResult[];
  knownCardCount: number;
  runDealStartedAt: number;
  handNumber: number;
  /** true = mobile (flex-based sizing), false = desktop (fixed px sizing) */
  compact?: boolean;
  desktopLayout?: DesktopRunItCenterStage;
}

const MOBILE_CARD = "flex-1";
const MOBILE_GAP = "gap-[2%]";

export default function RunItBoard({
  runResults,
  knownCardCount,
  runDealStartedAt,
  handNumber,
  compact = false,
  desktopLayout,
}: RunItBoardProps) {
  const { currentRun, revealedCount } = deriveVisibleRunState(runResults, knownCardCount);
  const totalRuns = runResults.length;

  const desktopCardStyle = compact || !desktopLayout
    ? undefined
    : {
        width: desktopLayout.cardWidth,
        height: desktopLayout.cardHeight,
      };

  return (
    <div
      className="flex flex-col items-center w-full"
      style={compact || !desktopLayout ? { gap: 8 } : { gap: desktopLayout.rowGap }}
    >
      {Array.from({ length: totalRuns }, (_, r) => {
        const isPast = r < currentRun;
        const isCurrent = r === currentRun;
        const isFuture = r > currentRun;
        const rowOpacity = isPast ? 0.45 : 1;

        return (
          <div
            key={`run-${handNumber}-${r}`}
            className="flex flex-col items-center w-full"
            style={compact || !desktopLayout ? { gap: 4 } : { gap: desktopLayout.labelGap }}
          >
            <motion.div
              animate={{ opacity: isFuture ? 0.25 : isCurrent ? 1 : 0.45 }}
              transition={{ duration: 0.3 }}
              className="font-black uppercase text-white/60 select-none"
              style={
                compact || !desktopLayout
                  ? { fontSize: 9, letterSpacing: "0.2em" }
                  : { fontSize: desktopLayout.labelFontSize, letterSpacing: "0.24em" }
              }
            >
              Run {r + 1}
            </motion.div>

            <motion.div
              animate={{ opacity: rowOpacity }}
              transition={{ duration: 0.4 }}
              className={`flex justify-center ${compact ? MOBILE_GAP : ""} w-full`}
              style={compact || !desktopLayout ? undefined : { gap: desktopLayout.gap }}
            >
              {Array.from({ length: CARD_COUNT }, (_, i) => {
                const isKnown = i < knownCardCount;

                if (isKnown) {
                  return (
                    <div
                      key={i}
                      className={compact ? MOBILE_CARD : ""}
                      style={desktopCardStyle}
                    >
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
                  <div
                    key={i}
                    className={`${compact ? MOBILE_CARD : ""} relative aspect-[5/7]`}
                    style={{
                      perspective: 600,
                      ...desktopCardStyle,
                    }}
                  >
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

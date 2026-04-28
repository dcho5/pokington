"use client";
import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Card from "components/poker/Card";
import { useTableVisualFeedback } from "components/Table/FeedbackCoordinator";
import type { TableVisualFeedbackEvent } from "lib/feedbackPlatform";
import { deriveVisibleRunState } from "lib/runAnimation";
import { collectBoardRevealEvents } from "lib/tableFeedback.mjs";
import type { RunResult } from "@pokington/engine";
import type { DesktopRunItCenterStage } from "lib/desktopTableLayout";

const CARD_COUNT = 5;
const collectBoardRevealEventsTyped = collectBoardRevealEvents as (options: {
  previousCounts: number[];
  nextCounts: number[];
  handNumber: number;
  mode: "single" | "bombPot" | "runIt";
}) => TableVisualFeedbackEvent[];

interface RunItBoardProps {
  runResults: RunResult[];
  knownCardCount: number;
  runDealStartedAt: number;
  handNumber: number;
  /** true = mobile (flex-based sizing), false = desktop (fixed px sizing) */
  compact?: boolean;
  desktopLayout?: DesktopRunItCenterStage;
  onHoverRunChange?: (runIndex: number | null) => void;
  highlightedRunIndex?: number | null;
  highlightedCardEmphasis?: Array<"neutral" | "highlighted" | "dimmed"> | null;
  highlightedCardEmphasisByRun?: Array<Array<"neutral" | "highlighted" | "dimmed"> | null> | null;
}

const MOBILE_CARD = "flex-1";
const MOBILE_GAP = "gap-[2%]";

function BoardSlotPlaceholder({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={`pointer-events-none opacity-0 ${className}`} style={style} />;
}

export default function RunItBoard({
  runResults,
  knownCardCount,
  runDealStartedAt,
  handNumber,
  compact = false,
  desktopLayout,
  onHoverRunChange,
  highlightedRunIndex = null,
  highlightedCardEmphasis = null,
  highlightedCardEmphasisByRun = null,
}: RunItBoardProps) {
  const { currentRun, revealedCount } = deriveVisibleRunState(runResults, knownCardCount);
  const totalRuns = runResults.length;
  const emitVisualFeedback = useTableVisualFeedback();
  const previousCountsRef = useRef<number[]>([]);

  const desktopCardStyle = compact || !desktopLayout
    ? undefined
    : {
        width: desktopLayout.cardWidth,
        height: desktopLayout.cardHeight,
      };
  const emphasisForRun = (runIndex: number) =>
    highlightedCardEmphasisByRun?.[runIndex] ??
    (runIndex === highlightedRunIndex ? highlightedCardEmphasis : null);

  useEffect(() => {
    previousCountsRef.current = [];
  }, [handNumber]);

  useEffect(() => {
    const nextCounts = runResults.map((run) => run.board.length);
    if (
      previousCountsRef.current.length === 0 ||
      previousCountsRef.current.length !== nextCounts.length
    ) {
      previousCountsRef.current = nextCounts;
      return;
    }
    const events = collectBoardRevealEventsTyped({
      previousCounts: previousCountsRef.current,
      nextCounts,
      handNumber,
      mode: "runIt",
    });
    for (const event of events) {
      emitVisualFeedback(event);
    }
    previousCountsRef.current = nextCounts;
  }, [emitVisualFeedback, handNumber, knownCardCount, runResults]);

  return (
    <div
      className="flex flex-col items-center w-full"
      style={compact || !desktopLayout ? { gap: 8 } : { gap: desktopLayout.rowGap }}
      onPointerLeave={onHoverRunChange ? () => onHoverRunChange(null) : undefined}
    >
      {Array.from({ length: totalRuns }, (_, r) => {
        const isPast = r < currentRun;
        const isCurrent = r === currentRun;
        const isFuture = r > currentRun;
        const rowOpacity = isPast ? 0.45 : 1;

        return (
          <div
            key={`run-${handNumber}-${r}`}
            className={`flex flex-col items-center w-full ${onHoverRunChange ? "cursor-pointer" : ""}`}
            style={compact || !desktopLayout ? { gap: 4 } : { gap: desktopLayout.labelGap }}
            onPointerEnter={onHoverRunChange ? () => onHoverRunChange(r) : undefined}
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
                        size={compact ? "default" : "desktop"}
                        emphasis={emphasisForRun(r)?.[i] ?? "neutral"}
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
                    style={desktopCardStyle}
                  >
                    {isRevealed ? (
                      <div
                        className="absolute inset-0 animate-card-deal-in"
                        style={{ animationDelay: `${newCardIdx * 0.08}s` }}
                      >
                        <Card
                          card={runResults[r]?.board[i]}
                          size={compact ? "default" : "desktop"}
                          emphasis={emphasisForRun(r)?.[i] ?? "neutral"}
                          className="w-full h-full rounded-xl shadow-xl"
                        />
                      </div>
                    ) : (
                      <BoardSlotPlaceholder className="absolute inset-0 rounded-xl" />
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

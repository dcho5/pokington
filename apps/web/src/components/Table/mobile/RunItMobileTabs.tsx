"use client";
import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Card from "components/poker/Card";
import { deriveRunAnimation } from "lib/runAnimation";
import type { RunResult } from "@pokington/engine";

const CARD_COUNT = 5;

interface RunItMobileTabsProps {
  runResults: RunResult[];
  knownCardCount: number;
  runDealStartedAt: number;
  handNumber: number;
}

export default function RunItMobileTabs({
  runResults,
  knownCardCount,
  runDealStartedAt,
  handNumber,
}: RunItMobileTabsProps) {
  const [, tick] = useState(0);
  const { currentRun, revealedCount } = deriveRunAnimation(
    runDealStartedAt,
    knownCardCount,
    runResults.length,
  );
  const totalRuns = runResults.length;
  const animationComplete = currentRun === totalRuns - 1 && revealedCount === CARD_COUNT;

  useEffect(() => {
    if (animationComplete) return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [animationComplete]);

  const [viewingRun, setViewingRun] = useState(0);
  const prevViewingRun = useRef(0);

  // Auto-advance to the newest active run
  useEffect(() => {
    if (currentRun > viewingRun) {
      prevViewingRun.current = viewingRun;
      setViewingRun(currentRun);
    }
  }, [currentRun]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchTo(r: number) {
    prevViewingRun.current = viewingRun;
    setViewingRun(r);
  }

  const direction = viewingRun >= prevViewingRun.current ? 1 : -1;

  // Ghost run: the most recently settled run that isn't the active view
  const ghostRun = viewingRun > 0 ? viewingRun - 1 : null;

  function cardVariants(i: number) {
    const delay = i * 0.05;
    return {
      initial: {
        opacity: 0,
        y: direction > 0 ? -16 : 16,
        rotateZ: direction > 0 ? -3 + i * 0.6 : 3 - i * 0.6,
        scale: 0.88,
      },
      animate: {
        opacity: 1,
        y: 0,
        rotateZ: 0,
        scale: 1,
        transition: {
          type: "spring" as const,
          stiffness: 380,
          damping: 26,
          delay,
        },
      },
      exit: {
        opacity: 0,
        y: direction > 0 ? 12 : -12,
        rotateZ: direction > 0 ? 2 : -2,
        scale: 0.92,
        transition: { duration: 0.15, delay: (CARD_COUNT - 1 - i) * 0.03 },
      },
    };
  }

  return (
    <div className="flex flex-col items-center gap-2.5 w-full">

      <div
        className="flex gap-1 p-[3px] rounded-full"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}
      >
        {Array.from({ length: totalRuns }, (_, r) => {
          const isActive = r === viewingRun;
          const isSettled = r <= currentRun;
          return (
            <motion.button
              key={r}
              onClick={() => switchTo(r)}
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="relative px-3.5 py-1 rounded-full text-[11px] font-black tracking-wide transition-colors duration-200"
              style={{
                color: isActive ? "#fff" : isSettled ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)",
                background: isActive
                  ? "linear-gradient(135deg, #ef4444, #b91c1c)"
                  : "transparent",
                boxShadow: isActive ? "0 0 14px rgba(239,68,68,0.45)" : "none",
              }}
            >
              <span className="relative z-10">Run {r + 1}</span>
              {isSettled && !isActive && (
                <span
                  className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-white/30"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── Board area ── */}
      <div className="relative w-full max-w-[300px] flex flex-col items-center">

        {/* Ghost layer — previous run peeking behind */}
        {ghostRun !== null && (
          <div
            className="absolute inset-0 pointer-events-none flex gap-[2%]"
            style={{
              transform: "scale(0.93) translateY(14px)",
              opacity: 0.18,
              filter: "blur(0.5px)",
              transformOrigin: "top center",
              zIndex: 0,
            }}
          >
            {Array.from({ length: CARD_COUNT }, (_, i) => (
              <div key={i} className="flex-1 aspect-[5/7]">
                <Card
                  card={runResults[ghostRun]?.board[i]}
                  className="w-full h-full rounded-xl"
                />
              </div>
            ))}
          </div>
        )}

        <div className="relative w-full" style={{ zIndex: 1 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`board-${handNumber}-${viewingRun}`}
              className="flex gap-[2%] w-full"
              style={{
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.55))",
              }}
            >
              {Array.from({ length: CARD_COUNT }, (_, i) => {
                const isKnown = i < knownCardCount;
                const isPast = viewingRun < currentRun;
                const isCurrent = viewingRun === currentRun;
                const isRevealed =
                  isKnown ||
                  isPast ||
                  (isCurrent && i < revealedCount);

                if (!isRevealed) {
                  return (
                    <div key={i} className="flex-1 aspect-[5/7]">
                      <Card card={undefined} className="w-full h-full rounded-xl shadow-xl" />
                    </div>
                  );
                }

                return (
                  <motion.div
                    key={`${handNumber}-${viewingRun}-${i}-revealed`}
                    className="flex-1 aspect-[5/7]"
                    variants={cardVariants(i)}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <Card
                      card={runResults[viewingRun]?.board[i]}
                      className="w-full h-full rounded-xl shadow-xl"
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

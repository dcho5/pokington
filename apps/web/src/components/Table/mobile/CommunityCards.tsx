"use client";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Card from "components/poker/Card";
import RunItMobileTabs from "./RunItMobileTabs";
import { getCenterBoardMode } from "lib/tableVisualState";
import type { Card as CardType } from "@pokington/shared";
import type { RunResult } from "@pokington/engine";

const CARD_COUNT = 5;

interface CommunityCardsProps {
  phase?: string;
  communityCards?: CardType[];
  communityCards2?: CardType[];
  isBombPot?: boolean;
  // Run-it props
  isRunItBoard?: boolean;
  runResults?: RunResult[];
  knownCardCount?: number;
  runDealStartedAt?: number | null;
  runAnnouncement?: 1 | 2 | 3 | null;
  handNumber?: number;
  onActiveBoardChange?: (boardIndex: number) => void;
  onViewingRunChange?: (runIndex: number) => void;
}

function BombPotBoards({ communityCards, communityCards2, handNumber, onActiveBoardChange }: {
  communityCards?: CardType[];
  communityCards2?: CardType[];
  handNumber: number;
  onActiveBoardChange?: (boardIndex: number) => void;
}) {
  const [activeBoard, setActiveBoard] = useState(0);
  const boards = [communityCards ?? [], communityCards2 ?? []];

  useEffect(() => {
    setActiveBoard(0);
  }, [handNumber]);

  useEffect(() => {
    onActiveBoardChange?.(activeBoard);
  }, [activeBoard, onActiveBoardChange]);

  return (
    <div className="flex flex-col items-center gap-2.5 w-full">
      {boards.length > 1 && (
        <div
          className="flex gap-1 p-[3px] rounded-full"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(8px)",
          }}
        >
          {boards.map((_, b) => {
            const isActive = b === activeBoard;
            return (
              <motion.button
                key={b}
                onClick={() => setActiveBoard(b)}
                whileTap={{ scale: 0.93 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="relative px-3.5 py-1 rounded-full text-[11px] font-black tracking-wide transition-colors duration-200"
                style={{
                  color: isActive ? "#fff" : "rgba(255,255,255,0.35)",
                  background: isActive ? "linear-gradient(135deg, #ef4444, #b91c1c)" : "transparent",
                  boxShadow: isActive ? "0 0 14px rgba(239,68,68,0.45)" : "none",
                }}
              >
                Board {b + 1}
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="relative w-full">
        {/* Ghost layer — inactive board peeking behind */}
        {boards.length > 1 && (
          <div
            className="absolute inset-0 pointer-events-none flex gap-[2%]"
            style={{
              transform: "scale(0.93) translateY(14px)",
              opacity: 0.15,
              filter: "blur(0.5px)",
              transformOrigin: "top center",
              zIndex: 0,
            }}
          >
            {Array.from({ length: CARD_COUNT }, (_, i) => (
              <div key={i} className="flex-1 aspect-[5/7]">
                <Card card={boards[1 - activeBoard]?.[i]} className="w-full h-full rounded-xl" />
              </div>
            ))}
          </div>
        )}

        <div className="relative flex gap-[2%] w-full" style={{ zIndex: 1, filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.55))" }}>
          {Array.from({ length: CARD_COUNT }, (_, i) => (
            <div
              key={`${handNumber}-bomb-b${activeBoard}-${i}`}
              className="flex-1 aspect-[5/7] animate-card-deal-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <Card card={boards[activeBoard]?.[i]} className="w-full h-full rounded-xl shadow-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CommunityCards: React.FC<CommunityCardsProps> = ({
  phase,
  communityCards,
  communityCards2,
  isBombPot = false,
  isRunItBoard = false,
  runResults = [],
  knownCardCount = 0,
  runDealStartedAt = null,
  runAnnouncement = null,
  handNumber = 0,
  onActiveBoardChange,
  onViewingRunChange,
}) => {
  const boardMode = getCenterBoardMode({
    phase,
    isBombPotHand: isBombPot,
    isRunItBoard,
    runDealStartedAt,
    runAnnouncement,
    runResults,
    communityCards2,
  });
  const showRunItBoard = boardMode === "runIt";
  // During the "Running it N times!" announcement the engine has already dealt
  // the full board, but we should only show the cards that were known before
  // the all-in — the rest stay face-down until RunItMobileTabs takes over.
  const isRunItAnnouncing = isRunItBoard && runAnnouncement != null;

  return (
    <div className="relative flex flex-col items-center w-full px-2 min-h-0">
      {/* Cards row(s) */}
      {showRunItBoard ? (
        <RunItMobileTabs
          runResults={runResults}
          knownCardCount={knownCardCount}
          runDealStartedAt={runDealStartedAt!}
          handNumber={handNumber}
          onViewingRunChange={onViewingRunChange}
        />
      ) : boardMode === "bombPot" ? (
        <BombPotBoards
          communityCards={communityCards}
          communityCards2={communityCards2}
          handNumber={handNumber}
          onActiveBoardChange={onActiveBoardChange}
        />
      ) : (
        <div className="flex justify-center gap-[2%] w-full">
          {Array.from({ length: CARD_COUNT }, (_, i) => {
            const card = isRunItAnnouncing && i >= knownCardCount
              ? undefined
              : communityCards?.[i];
            return (
              <div
                key={card ? `${handNumber}-card-${i}-shown` : `${handNumber}-card-${i}`}
                className="flex-1 animate-card-deal-in"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <Card
                  card={card}
                  className="w-full aspect-[5/7] rounded-xl shadow-2xl"
                />
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default CommunityCards;

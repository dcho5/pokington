"use client";
import React from "react";
import Card from "components/poker/Card";
import RunItMobileTabs from "./RunItMobileTabs";
import type { Card as CardType } from "@pokington/shared";
import type { RunResult } from "@pokington/engine";

const CARD_COUNT = 5;

interface CommunityCardsProps {
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
}

const CommunityCards: React.FC<CommunityCardsProps> = ({
  communityCards,
  communityCards2,
  isBombPot = false,
  isRunItBoard = false,
  runResults = [],
  knownCardCount = 0,
  runDealStartedAt = null,
  runAnnouncement = null,
  handNumber = 0,
}) => {
  const showRunItBoard = isRunItBoard && runDealStartedAt != null && runAnnouncement == null;

  return (
    <div className="relative flex flex-col items-center w-full px-2 min-h-0">
      {/* Cards row(s) */}
      {showRunItBoard ? (
        <RunItMobileTabs
          runResults={runResults}
          knownCardCount={knownCardCount}
          runDealStartedAt={runDealStartedAt!}
          handNumber={handNumber}
        />
      ) : isBombPot ? (
        <div className="flex flex-col items-center gap-1 w-full px-2">
          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Board 1</div>
          <div className="flex justify-center gap-1.5 w-full max-w-[320px]">
            {Array.from({ length: CARD_COUNT }, (_, i) => (
              <div
                key={i}
                className="flex-1 animate-card-deal-in"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <Card
                  card={communityCards?.[i]}
                  className="w-full aspect-[5/7] rounded-xl shadow-2xl"
                />
              </div>
            ))}
          </div>
          {communityCards2 && communityCards2.length > 0 && (
            <>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Board 2</div>
              <div className="flex justify-center gap-1.5 w-full max-w-[320px]">
                {Array.from({ length: CARD_COUNT }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 animate-card-deal-in"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <Card
                      card={communityCards2?.[i]}
                      className="w-full aspect-[5/7] rounded-xl shadow-2xl"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex justify-center gap-[2%] w-full">
          {Array.from({ length: CARD_COUNT }, (_, i) => (
            <div
              key={communityCards?.[i] ? `${handNumber}-card-${i}-shown` : `${handNumber}-card-${i}`}
              className="flex-1 animate-card-deal-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <Card
                card={communityCards?.[i]}
                className="w-full aspect-[5/7] rounded-xl shadow-2xl"
              />
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default CommunityCards;

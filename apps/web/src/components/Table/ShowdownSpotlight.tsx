"use client";

import React from "react";
import Card from "components/poker/Card";
import type { ShowdownSpotlightModel } from "lib/showdownSpotlight";

interface ShowdownSpotlightProps {
  spotlight: ShowdownSpotlightModel;
  variant?: "desktop" | "mobile";
}

const ShowdownSpotlight: React.FC<ShowdownSpotlightProps> = ({
  spotlight,
  variant = "desktop",
}) => {
  const compact = variant === "mobile";
  const cardClassName = compact ? "w-[34px] h-[48px] rounded-[10px]" : "w-[52px] h-[74px] rounded-[14px]";
  const cardSize = compact ? "compact" : "desktop";
  const sectionLabelClassName = compact
    ? "text-[9px] tracking-[0.22em]"
    : "text-[10px] tracking-[0.28em]";
  const titleClassName = compact ? "text-[11px]" : "text-xs";
  const handLabelClassName = compact ? "text-[10px]" : "text-[11px]";

  return (
    <div
      className={`rounded-[22px] border backdrop-blur-md shadow-xl ${
        compact
          ? "px-3 py-2 bg-white/92 dark:bg-slate-950/92 border-white/40 dark:border-white/10"
          : "px-4 py-3 bg-white/90 dark:bg-slate-950/90 border-white/40 dark:border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className={`font-black uppercase text-gray-500 dark:text-gray-400 ${sectionLabelClassName}`}>
            Showdown Spotlight
          </div>
          <div className={`font-black text-gray-900 dark:text-white truncate ${titleClassName}`}>
            {spotlight.playerName}
            {spotlight.contextLabel ? ` • ${spotlight.contextLabel}` : ""}
          </div>
        </div>
        <div className={`font-black text-right text-gray-700 dark:text-slate-200 ${handLabelClassName}`}>
          {spotlight.handLabel ?? "Reading board"}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <div className={`font-black uppercase text-gray-500 dark:text-gray-400 ${sectionLabelClassName}`}>
            Hole
          </div>
          <div className="flex items-center gap-2">
            {spotlight.holeCards.map((entry) => (
              <Card
                key={entry.key}
                card={entry.card ?? undefined}
                emphasis={entry.emphasis}
                size={cardSize}
                className={`${cardClassName} shadow-lg`}
              />
            ))}
          </div>
        </div>

        <div className="w-px self-stretch bg-gray-300/80 dark:bg-white/10" />

        <div className="flex flex-col items-center gap-1.5">
          <div className={`font-black uppercase text-gray-500 dark:text-gray-400 ${sectionLabelClassName}`}>
            Board
          </div>
          <div className="flex items-center gap-2">
            {spotlight.boardCards.map((entry) => (
              <Card
                key={entry.key}
                card={entry.card ?? undefined}
                emphasis={entry.emphasis}
                size={cardSize}
                className={`${cardClassName} shadow-lg`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShowdownSpotlight;

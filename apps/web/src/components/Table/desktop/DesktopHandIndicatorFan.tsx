"use client";

import React from "react";
import type { HandIndicator } from "lib/handIndicators";

interface DesktopHandIndicatorFanProps {
  indicators: HandIndicator[];
}

function getGroupLabel(indicators: HandIndicator[]) {
  if (indicators.every((indicator) => indicator.title.startsWith("Run "))) return "Runs";
  if (indicators.every((indicator) => indicator.title.startsWith("Board "))) return "Boards";
  return "Hands";
}

const DesktopHandIndicatorFan: React.FC<DesktopHandIndicatorFanProps> = ({ indicators }) => {
  if (indicators.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Hand
        </span>
        <span className="text-[18px] font-black text-gray-500 dark:text-gray-400">--</span>
      </div>
    );
  }

  if (indicators.length === 1) {
    const indicator = indicators[0];
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {indicator.title}
        </span>
        <span className="text-[18px] font-black text-gray-900 dark:text-white">
          {indicator.label ?? "--"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-[272px] flex-col items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {getGroupLabel(indicators)}
      </span>
      <div className="w-full rounded-[24px] border border-gray-200/70 bg-white/88 p-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-white/[0.08] dark:bg-[rgba(3,7,18,0.82)]">
        {indicators.map((indicator, index) => {
          const hasLabel = indicator.label != null;
          const isLatestResolved =
            hasLabel &&
            indicators.findLastIndex((candidate) => candidate.label != null) === index;

          return (
            <div
              key={indicator.id}
              className={`flex items-center justify-between gap-3 rounded-[18px] border px-3 py-2 text-left transition-colors ${
                isLatestResolved
                  ? "border-red-200 bg-red-50/85 dark:border-red-500/20 dark:bg-red-500/10"
                  : "border-gray-200/80 bg-white/78 dark:border-white/[0.06] dark:bg-white/[0.03]"
              } ${index > 0 ? "mt-2" : ""}`}
            >
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-gray-400 dark:text-gray-500">
                  {indicator.title}
                </div>
                <div
                  className={`mt-1 text-[15px] font-black leading-none ${
                    hasLabel
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {indicator.label ?? "Pending"}
                </div>
              </div>
              <div
                className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[10px] font-black uppercase tracking-wide ${
                  hasLabel
                    ? "bg-gray-900 text-white dark:bg-white dark:text-slate-950"
                    : "bg-gray-100 text-gray-500 dark:bg-white/[0.08] dark:text-gray-400"
                }`}
              >
                {index + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DesktopHandIndicatorFan;

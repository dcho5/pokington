"use client";

import React, { useState } from "react";
import type { HandIndicator } from "lib/handIndicators";
import { getDesktopHandIndicatorLayout } from "lib/desktopHandIndicatorLayout.mjs";

interface DesktopHandIndicatorFanProps {
  indicators: HandIndicator[];
  activeIndicatorId?: string | null;
}

function getGroupLabel(indicators: HandIndicator[]) {
  if (indicators.every((indicator) => indicator.title.startsWith("Run "))) return "Runs";
  if (indicators.every((indicator) => indicator.title.startsWith("Board "))) return "Boards";
  return "Hands";
}

function getLatestResolvedIndex(indicators: HandIndicator[]) {
  return indicators.findLastIndex((indicator) => indicator.label != null);
}

function IndicatorTile({
  indicator,
  index,
  emphasized,
  compact = false,
  className = "",
  style,
}: {
  indicator: HandIndicator;
  index: number;
  emphasized: boolean;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hasLabel = indicator.label != null;

  return (
    <div
      className={`relative rounded-[20px] border px-3 py-2.5 text-left shadow-[0_14px_32px_rgba(15,23,42,0.1)] transition-colors ${
        emphasized
          ? "border-red-200 bg-red-50/92 dark:border-red-500/20 dark:bg-red-500/10"
          : "border-gray-200/80 bg-white/88 dark:border-white/[0.06] dark:bg-white/[0.04]"
      } ${className}`}
      style={style}
    >
      <div className="pr-8">
        <div className="text-[9px] font-black uppercase tracking-[0.24em] text-gray-400 dark:text-gray-500">
          {indicator.title}
        </div>
        <div
          className={`mt-2 font-black ${
            compact ? "text-[14px] leading-tight" : "text-[15px] leading-tight"
          } ${
            hasLabel
              ? "text-gray-900 dark:text-white"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {indicator.label ?? "Pending"}
        </div>
      </div>
      <div
        className={`absolute right-3 top-3 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[10px] font-black uppercase tracking-wide ${
          hasLabel
            ? "bg-gray-900 text-white dark:bg-white dark:text-slate-950"
            : "bg-gray-100 text-gray-500 dark:bg-white/[0.08] dark:text-gray-400"
        }`}
      >
        {index + 1}
      </div>
    </div>
  );
}

const DesktopHandIndicatorFan: React.FC<DesktopHandIndicatorFanProps> = ({
  indicators,
  activeIndicatorId = null,
}) => {
  const layout = getDesktopHandIndicatorLayout(indicators.length);
  const [expanded, setExpanded] = useState(false);

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

  const latestResolvedIndex = getLatestResolvedIndex(indicators);
  const activeIndicatorIndex = activeIndicatorId == null
    ? -1
    : indicators.findIndex((indicator) => indicator.id === activeIndicatorId);
  const previewIndex = activeIndicatorIndex >= 0
    ? activeIndicatorIndex
    : latestResolvedIndex >= 0
      ? latestResolvedIndex
      : indicators.length - 1;

  if (layout.mode === "row") {
    return (
      <div className="flex w-[292px] flex-col items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {getGroupLabel(indicators)}
        </span>
        <div className="flex w-full items-stretch gap-2">
          {indicators.map((indicator, index) => (
            <IndicatorTile
              key={indicator.id}
              indicator={indicator}
              index={index}
              emphasized={index === latestResolvedIndex}
              className="flex-1"
            />
          ))}
        </div>
      </div>
    );
  }

  const previewIndicator = indicators[previewIndex];

  return (
    <div
      className="relative flex w-[152px] flex-col items-center gap-2 overflow-visible"
    >
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {getGroupLabel(indicators)}
      </span>
      <div className="relative h-[92px] w-full overflow-visible">
        <div
          className="absolute left-1/2 top-0 z-30 h-[92px] w-[444px] -translate-x-1/2 outline-none"
          role="button"
          tabIndex={0}
          aria-label={`Show all ${indicators.length} ${getGroupLabel(indicators).toLowerCase()}`}
          aria-expanded={expanded}
          onPointerEnter={() => setExpanded(true)}
          onPointerLeave={() => setExpanded(false)}
          onFocus={() => setExpanded(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setExpanded(false);
            }
          }}
        >
          <div
            className={`absolute left-1/2 top-0 w-[152px] -translate-x-1/2 rounded-[20px] text-left transition-all duration-150 ${
              expanded
                ? "pointer-events-none opacity-0 translate-y-1"
                : "opacity-100"
            }`}
          >
            <IndicatorTile
              indicator={previewIndicator}
              index={previewIndex}
              emphasized={previewIndex === latestResolvedIndex}
              compact
              className="min-h-[82px] w-full backdrop-blur-md"
            />
          </div>

          <div
            className={`absolute left-1/2 top-0 flex w-[444px] -translate-x-1/2 gap-2 transition-all duration-150 ${
              expanded
                ? "pointer-events-auto opacity-100 translate-y-0"
                : "pointer-events-none opacity-0 translate-y-1"
            }`}
          >
            {indicators.map((indicator, index) => (
              <IndicatorTile
                key={indicator.id}
                indicator={indicator}
                index={index}
                emphasized={index === latestResolvedIndex}
                className="min-h-[82px] flex-1 backdrop-blur-md"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopHandIndicatorFan;

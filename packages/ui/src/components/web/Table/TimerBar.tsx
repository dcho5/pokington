"use client";

import React from "react";

interface TimerBarProps {
  startedAt: number | null | undefined;
  durationMs: number;
  variant: "voting";
  className?: string;
}

const VARIANT_CONFIG = {
  voting: {
    gradient: "from-violet-500 to-indigo-500",
    animation: "animate-voting-timer-shrink",
  },
} as const;

export default function TimerBar({
  startedAt,
  durationMs,
  variant,
  className,
}: TimerBarProps): React.ReactElement {
  const { gradient, animation } = VARIANT_CONFIG[variant];
  return (
    <div className={`w-full h-1.5 rounded-full overflow-hidden border border-white/8 bg-white/6 ${className ?? ""}`}>
      <div
        key={startedAt ?? "no-timer"}
        className={`h-full w-full bg-gradient-to-r ${gradient} rounded-full origin-left shadow-[0_0_18px_rgba(129,140,248,0.45)] ${animation}`}
        style={{
          animationDelay: startedAt ? `-${Date.now() - startedAt}ms` : "0ms",
          animationDuration: `${durationMs}ms`,
        }}
      />
    </div>
  );
}

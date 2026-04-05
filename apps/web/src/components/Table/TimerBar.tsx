"use client";
import React from "react";

interface TimerBarProps {
  startedAt: number | null | undefined;
  variant: "turn" | "voting";
  className?: string;
}

const VARIANT_CONFIG = {
  turn: {
    gradient: "from-red-500 to-red-700",
    animation: "animate-timer-shrink",
  },
  voting: {
    gradient: "from-violet-500 to-indigo-500",
    animation: "animate-voting-timer-shrink",
  },
} as const;

export default function TimerBar({ startedAt, variant, className }: TimerBarProps) {
  const { gradient, animation } = VARIANT_CONFIG[variant];
  return (
    <div className={`w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden ${className ?? ""}`}>
      <div
        key={startedAt ?? "no-timer"}
        className={`h-full w-full bg-gradient-to-r ${gradient} rounded-full origin-left ${animation}`}
        style={{ animationDelay: startedAt ? `-${Date.now() - startedAt}ms` : "0ms" }}
      />
    </div>
  );
}

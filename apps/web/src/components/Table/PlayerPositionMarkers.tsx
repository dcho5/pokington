"use client";

import React from "react";
import { getPlayerPositionMarkers } from "lib/playerPositionMarkers.mjs";

type PlayerPositionMarkersProps = {
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  playerCount?: number;
  variant?: "desktop" | "mobile";
  fontSize?: number;
};

type MarkerKind = "dealer" | "smallBlind" | "bigBlind";

const MARKER_LABELS = {
  dealer: "D",
  smallBlind: "SB",
  bigBlind: "BB",
} as const;

const MARKER_STYLES = {
  dealer: {
    desktop: "bg-white text-red-600 border-red-500 shadow-[0_3px_10px_rgba(255,255,255,0.35)]",
    mobile: "bg-white text-red-600 border-red-500 shadow-[0_3px_10px_rgba(255,255,255,0.35)]",
  },
  smallBlind: {
    desktop: "bg-slate-950 text-amber-100 border-amber-300/90 shadow-[0_4px_12px_rgba(15,23,42,0.45)]",
    mobile: "bg-slate-950 text-amber-100 border-amber-300/90 shadow-[0_4px_12px_rgba(15,23,42,0.45)]",
  },
  bigBlind: {
    desktop: "bg-slate-950 text-yellow-200 border-yellow-400 shadow-[0_4px_12px_rgba(15,23,42,0.45)]",
    mobile: "bg-slate-950 text-yellow-200 border-yellow-400 shadow-[0_4px_12px_rgba(15,23,42,0.45)]",
  },
} as const;

const VARIANT_STYLES = {
  desktop: {
    container: "absolute -right-5 -top-2 z-20 flex flex-col items-end gap-1.5",
    badge: "min-w-[46px] px-3 py-1 text-[12px] tracking-[0.14em] shadow-lg",
  },
  mobile: {
    container: "absolute -right-1 -top-1 z-20 flex flex-col items-end gap-1",
    badge: "min-w-[28px] px-1.5 py-[2px] text-[8px] tracking-[0.08em] shadow-md backdrop-blur-sm",
  },
} as const;

export default function PlayerPositionMarkers({
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  playerCount,
  variant = "desktop",
  fontSize,
}: PlayerPositionMarkersProps) {
  const markers = getPlayerPositionMarkers({
    isDealer,
    isSmallBlind,
    isBigBlind,
    playerCount,
  }) as MarkerKind[];
  const resolvedFontSize =
    variant === "desktop"
      ? Math.max((fontSize ?? 0) + 3, 13)
      : fontSize;

  if (!markers.length) {
    return null;
  }

  const styles = VARIANT_STYLES[variant];

  return (
    <div className={styles.container}>
      {markers.map((marker) => (
        <span
          key={marker}
          className={[
            "inline-flex items-center justify-center rounded-full border font-black uppercase leading-none",
            styles.badge,
            MARKER_STYLES[marker][variant],
          ].join(" ")}
          style={resolvedFontSize ? { fontSize: resolvedFontSize } : undefined}
        >
          {MARKER_LABELS[marker]}
        </span>
      ))}
    </div>
  );
}

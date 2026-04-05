"use client";
import React from "react";
import { motion } from "framer-motion";
import { formatCents } from "lib/formatCents";

interface WinnerEntry {
  playerId: string;
  amount: number;
  hand: string;
}

interface WinnerBannerProps {
  winners: WinnerEntry[];
  players: Array<{ id?: string; name: string } | null>;
  /** "desktop" = ornate shimmer banner, "mobile" = compact inline pill */
  variant?: "desktop" | "mobile";
}

function formatWinnerText(
  winners: WinnerEntry[],
  players: Array<{ id?: string; name: string } | null>,
): string {
  return winners
    .map((w) => {
      const p = players.find((pl) => pl?.id === w.playerId);
      return `${p?.name ?? "?"} wins ${formatCents(w.amount)} — ${w.hand}`;
    })
    .join(" | ");
}

export default function WinnerBanner({ winners, players, variant = "desktop" }: WinnerBannerProps) {
  const text = formatWinnerText(winners, players);

  if (variant === "mobile") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.4)] text-black font-black text-xs text-center"
      >
        {text}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 30 }}
      animate={{ opacity: 1, scale: [0.5, 1.08, 1], y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ duration: 0.6, scale: { times: [0, 0.6, 1], duration: 0.7 } }}
    >
      <div className="relative px-8 py-4 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 shadow-[0_0_40px_rgba(245,158,11,0.6),0_0_80px_rgba(245,158,11,0.2)] text-black font-black text-base lg:text-lg whitespace-nowrap">
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
        <span className="relative z-10">{text}</span>
      </div>
    </motion.div>
  );
}

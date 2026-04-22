"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RunItOddsPanelModel } from "hooks/useRunItOddsPanelModel";

const STREET_LABELS: Array<{ key: keyof RunItOddsPanelModel["rows"][number]["streetPercentages"]; label: string }> = [
  { key: "pre", label: "Pre" },
  { key: "flop", label: "Flop" },
  { key: "turn", label: "Turn" },
  { key: "river", label: "River" },
];

function suitSymbol(suit: string) {
  if (suit === "spades") return "♠";
  if (suit === "hearts") return "♥";
  if (suit === "diamonds") return "♦";
  return "♣";
}

function displayRank(rank: string) {
  return rank === "T" ? "10" : rank;
}

function formatPercentage(value: number | null) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "--";
}

function MiniCard({ card }: { card: { rank: string; suit: string } }) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div
      className={`flex h-9 w-7 flex-col justify-between rounded-lg border px-1 py-0.5 text-[9px] font-black shadow-md ${
        isRed ? "text-red-500" : "text-slate-900"
      }`}
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,245,249,0.94))",
        borderColor: "rgba(148,163,184,0.45)",
      }}
    >
      <span>{displayRank(card.rank)}{suitSymbol(card.suit)}</span>
      <span className="self-center text-sm leading-none">{suitSymbol(card.suit)}</span>
      <span className="self-end rotate-180">{displayRank(card.rank)}{suitSymbol(card.suit)}</span>
    </div>
  );
}

interface RunItOddsPanelProps {
  model: RunItOddsPanelModel;
  compact?: boolean;
  className?: string;
}

export default function RunItOddsPanel({
  model,
  compact = false,
  className = "",
}: RunItOddsPanelProps) {
  if (!model.visible || model.rows.length === 0) return null;

  return (
    <motion.div
      key={`run-it-odds-${model.currentRun}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: [1, 1.012, 1],
        boxShadow: [
          "0 20px 60px rgba(15,23,42,0.34)",
          "0 24px 72px rgba(244,63,94,0.24)",
          "0 20px 60px rgba(15,23,42,0.34)",
        ],
      }}
      transition={{
        opacity: { duration: 0.22 },
        y: { type: "spring", stiffness: 320, damping: 28 },
        scale: { duration: 0.46, delay: 0.02 },
        boxShadow: { duration: 0.5 },
      }}
      className={`relative overflow-hidden rounded-[28px] border border-white/10 ${className}`}
      style={{
        background:
          "linear-gradient(160deg, rgba(15,23,42,0.94), rgba(30,41,59,0.9) 50%, rgba(69,26,3,0.78) 120%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(251,191,36,0.2), transparent 34%), radial-gradient(circle at right center, rgba(244,63,94,0.16), transparent 36%)",
        }}
      />
      <div className={`relative z-10 ${compact ? "px-3 py-3" : "px-4 py-4"}`}>
        <div className={`mb-3 flex items-start justify-between ${compact ? "gap-3" : "gap-4"}`}>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200/80">
              Run {model.currentRun + 1} Odds
            </div>
            <div className={`${compact ? "text-[12px]" : "text-[13px]"} font-semibold text-white/78`}>
              Live win share as the board reveals
            </div>
          </div>
          <div
            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${
              model.status === "computing" ? "text-amber-200" : "text-emerald-200"
            }`}
            style={{
              borderColor: model.status === "computing" ? "rgba(251,191,36,0.28)" : "rgba(110,231,183,0.26)",
              background: model.status === "computing" ? "rgba(251,191,36,0.12)" : "rgba(16,185,129,0.12)",
            }}
          >
            {model.status === "computing" ? "Computing" : model.status === "final" ? "Final" : "Live"}
          </div>
        </div>

        <div className={`mb-4 grid ${compact ? "gap-2" : "gap-2.5"}`}>
          {STREET_LABELS.map((street, index) => {
            const currentIndex = STREET_LABELS.findIndex((entry) => entry.key === model.currentStreet);
            const isPast = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={street.key} className="flex items-center gap-2">
                <div className="h-px flex-1 bg-white/10" />
                <motion.div
                  className="relative min-w-[54px] rounded-full px-2.5 py-1 text-center text-[10px] font-black uppercase tracking-[0.18em]"
                  animate={{
                    color: isCurrent ? "#fff7ed" : isPast ? "#fde68a" : "rgba(255,255,255,0.45)",
                    backgroundColor: isCurrent
                      ? "rgba(244,63,94,0.22)"
                      : isPast
                        ? "rgba(245,158,11,0.16)"
                        : "rgba(255,255,255,0.06)",
                    borderColor: isCurrent
                      ? "rgba(251,146,60,0.44)"
                      : isPast
                        ? "rgba(245,158,11,0.28)"
                        : "rgba(255,255,255,0.08)",
                    scale: isCurrent ? 1.04 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  style={{ borderWidth: 1, borderStyle: "solid" }}
                >
                  <AnimatePresence mode="wait">
                    {isCurrent && (
                      <motion.div
                        key={`${street.key}-${model.pulseKey}`}
                        className="absolute inset-0 rounded-full"
                        initial={{ opacity: 0.4, scale: 0.92 }}
                        animate={{ opacity: 0, scale: 1.16 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.42 }}
                        style={{ background: "rgba(251,113,133,0.22)" }}
                      />
                    )}
                  </AnimatePresence>
                  <span className="relative z-10">{street.label}</span>
                </motion.div>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            );
          })}
        </div>

        <div className="grid gap-2.5">
          {model.rows.map((row) => (
            <div
              key={row.playerId}
              className={`rounded-[22px] border border-white/8 ${compact ? "px-3 py-2.5" : "px-3.5 py-3"}`}
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <div className={`flex ${compact ? "items-start gap-2.5" : "items-center gap-3"}`}>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-black text-white ${compact ? "text-[13px]" : "text-[14px]"}`}>
                        {row.playerName}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <MiniCard card={row.holeCards[0]} />
                      <MiniCard card={row.holeCards[1]} />
                    </div>
                  </div>

                  <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      animate={{ width: `${Math.max(0, Math.min(100, row.currentPercentage ?? 0))}%` }}
                      transition={{ type: "spring", stiffness: 220, damping: 26 }}
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(251,191,36,0.92), rgba(244,63,94,0.9) 65%, rgba(251,113,133,0.88))",
                      }}
                    />
                  </div>

                  <div className={`mt-2 grid grid-cols-4 gap-1.5 ${compact ? "text-[10px]" : "text-[11px]"}`}>
                    {STREET_LABELS.map((street) => (
                      <div
                        key={street.key}
                        className="rounded-xl border border-white/8 px-1.5 py-1 text-center"
                        style={{ background: "rgba(15,23,42,0.26)" }}
                      >
                        <div className="font-black uppercase tracking-[0.18em] text-white/42">
                          {street.label}
                        </div>
                        <motion.div
                          key={`${row.playerId}-${street.key}-${row.streetPercentages[street.key] ?? "empty"}`}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-1 font-black text-white/92"
                        >
                          {formatPercentage(row.streetPercentages[street.key])}
                        </motion.div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <motion.div
                    key={`${row.playerId}-${row.currentPercentage?.toFixed(1) ?? "empty"}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className={`font-black text-white ${compact ? "text-[18px]" : "text-[22px]"}`}
                  >
                    {formatPercentage(row.currentPercentage)}
                  </motion.div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
                    Win Share
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

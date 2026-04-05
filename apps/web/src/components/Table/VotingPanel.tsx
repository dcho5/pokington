"use client";
import React from "react";
import { motion } from "framer-motion";
import TimerBar from "./TimerBar";

export const RUN_LABELS = ["once", "twice", "three times"] as const;

const VOTE_OPTIONS: Array<{ count: 1 | 2 | 3; label: string }> = [
  { count: 1, label: "Once" },
  { count: 2, label: "Twice" },
  { count: 3, label: "3×" },
];

interface VotingPanelProps {
  votes: Record<string, 1 | 2 | 3>;
  players: Array<{ id?: string; name: string; isFolded?: boolean } | null>;
  viewingPlayerId?: string;
  onVote?: (count: 1 | 2 | 3) => void;
  votingStartedAt?: number | null;
  canVote?: boolean;
  /** "desktop" = centered card overlay, "mobile" = inline in action bar */
  variant?: "desktop" | "mobile";
}

export default function VotingPanel({
  votes,
  players,
  viewingPlayerId,
  onVote,
  votingStartedAt,
  canVote = false,
  variant = "desktop",
}: VotingPanelProps) {
  const myVote = viewingPlayerId ? votes[viewingPlayerId] : undefined;
  const nonFolded = players.filter((p) => p && !p.isFolded);

  if (variant === "mobile") {
    return (
      <div className="w-full z-30">
        <TimerBar startedAt={votingStartedAt} variant="voting" />
        <div style={{ padding: "10px 16px" }}>
          <p className="text-xs text-gray-400 text-center mb-2 font-semibold">
            All-in! Run it how many times?
          </p>
          {canVote ? (
            <div className="flex gap-2 mb-2">
              {VOTE_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.count}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onVote?.(opt.count)}
                  className={`flex-1 h-[52px] rounded-2xl font-black text-sm transition-all ${
                    myVote === opt.count
                      ? "bg-gradient-to-r from-red-500 to-red-700 text-white shadow-[0_0_14px_rgba(239,68,68,0.4)]"
                      : "bg-gray-800 dark:bg-gray-800 text-gray-300 border border-white/10"
                  }`}
                >
                  {opt.label}
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500 py-3 mb-2">
              Waiting for all-in players to vote…
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 justify-center">
            {nonFolded.map((p) => {
              if (!p) return null;
              const vote = p.id ? votes[p.id] : undefined;
              return (
                <span key={p.id ?? p.name} className="text-[10px]">
                  <span className="text-gray-500">{p.name}</span>
                  <span className={`ml-1 ${vote ? "text-white font-bold" : "text-gray-600"}`}>
                    {vote ? RUN_LABELS[vote - 1] : "···"}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Desktop variant — ornate centered card
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 16 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="bg-gray-950/98 rounded-3xl shadow-2xl border border-white/10 overflow-hidden"
      style={{ width: 300 }}
    >
      <TimerBar startedAt={votingStartedAt} variant="voting" />

      <div className="p-6">
        <div className="text-center mb-4">
          <div className="text-xl mb-1">🃏</div>
          <h3 className="text-sm font-black text-white tracking-wide">All-in — Run it how many times?</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Unanimous vote wins · otherwise runs once</p>
        </div>

        {canVote ? (
          <div className="flex gap-2 mb-4">
            {VOTE_OPTIONS.map((opt) => (
              <button
                key={opt.count}
                onClick={() => onVote?.(opt.count)}
                className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${
                  myVote === opt.count
                    ? "bg-gradient-to-r from-red-500 to-red-700 text-white shadow-[0_0_14px_rgba(239,68,68,0.5)]"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-white/8"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-xs text-gray-500 py-3 mb-4">
            Waiting for all-in players to vote…
          </div>
        )}

        <div className="space-y-1 border-t border-white/8 pt-3">
          {nonFolded.map((p) => {
            if (!p) return null;
            const vote = p.id ? votes[p.id] : undefined;
            return (
              <div key={p.id ?? p.name} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-semibold">{p.name}</span>
                <span className={vote ? "text-white font-bold" : "text-gray-600"}>
                  {vote ? RUN_LABELS[vote - 1] : "···"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

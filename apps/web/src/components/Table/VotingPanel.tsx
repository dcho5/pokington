"use client";
import React from "react";
import { motion } from "framer-motion";
import TimerBar from "./TimerBar";
import type { DesktopVotingPanelMetrics } from "lib/desktopTableLayout";

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
  desktopMetrics?: DesktopVotingPanelMetrics;
}

export default function VotingPanel({
  votes,
  players,
  viewingPlayerId,
  onVote,
  votingStartedAt,
  canVote = false,
  variant = "desktop",
  desktopMetrics,
}: VotingPanelProps) {
  const myVote = viewingPlayerId ? votes[viewingPlayerId] : undefined;
  const nonFolded = players.filter((p) => p && !p.isFolded);
  const isMobile = variant === "mobile";
  const wrapperClass =
    isMobile
      ? "elevated-surface-dark relative w-full max-h-[min(72dvh,34rem)] overflow-y-auto overscroll-contain rounded-[1.7rem] border p-4"
      : "elevated-surface-dark relative w-full rounded-[2rem] border";
  const title = isMobile ? "Run it vote" : "How many boards?";
  const subtitle = canVote
    ? "Unanimous vote changes the number of runs."
    : "Waiting for all-in players to submit their choice.";

  if (variant === "mobile") {
    return (
      <div className={`w-full ${wrapperClass}`}>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,0.94))]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.018)_42%,rgba(255,255,255,0.01))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.22),_transparent_36%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.08),_transparent_52%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.04),rgba(2,6,23,0.18)_52%,rgba(2,6,23,0.3))]" />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <div className="surface-content mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              {!isMobile && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-200/55" />}
              <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-200 shadow-[0_0_18px_rgba(199,210,254,0.65)]" />
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-50">
              All-in Showdown
            </span>
          </div>
          <div className="rounded-full border border-indigo-100/25 bg-indigo-300/14 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
            Vote
          </div>
        </div>

        <div className="surface-content mb-3 space-y-1 text-center">
          <p className="text-[1.2rem] font-black tracking-tight text-white">{title}</p>
          <p className="text-[13px] leading-5 text-slate-100">{subtitle}</p>
        </div>

        <TimerBar startedAt={votingStartedAt} variant="voting" className="mb-4" />

        <div className="surface-content">
          {canVote ? (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {VOTE_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.count}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onVote?.(opt.count)}
                  className={`h-[56px] rounded-2xl border font-black text-sm transition-all ${
                    myVote === opt.count
                      ? "border-indigo-200/28 bg-indigo-400/18 text-white shadow-[0_10px_28px_rgba(99,102,241,0.32)]"
                      : "border-white/16 bg-slate-900/88 text-slate-50"
                  }`}
                >
                  {opt.label}
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="mb-3 rounded-2xl border border-white/14 bg-slate-900/82 py-3 text-center text-xs text-slate-100">
              Waiting for all-in players to vote…
            </div>
          )}

          <div className="grid gap-2">
            {nonFolded.map((p) => {
              if (!p) return null;
              const vote = p.id ? votes[p.id] : undefined;
              return (
                <div
                  key={p.id ?? p.name}
                  className="flex items-center justify-between rounded-2xl border border-white/14 bg-slate-900/82 px-3 py-2 text-[11px]"
                >
                  <span className="truncate pr-3 font-semibold text-slate-50">{p.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      vote
                        ? "border border-indigo-200/24 bg-indigo-300/14 text-white"
                        : "border border-white/14 bg-slate-800/95 text-slate-200"
                    }`}
                  >
                    {vote ? RUN_LABELS[vote - 1] : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const metrics = desktopMetrics ?? {
    width: 360,
    padding: 28,
    iconFontSize: 24,
    titleFontSize: 18,
    subtitleFontSize: 13,
    buttonHeight: 56,
    buttonFontSize: 15,
    rowFontSize: 14,
    waitingFontSize: 14,
  };
  const desktopEyebrowFontSize = Math.max(11, Math.round(metrics.titleFontSize * 0.5));
  const desktopBadgeFontSize = Math.max(11, Math.round(metrics.titleFontSize * 0.48));
  const desktopStatusFontSize = Math.max(11, Math.round(metrics.rowFontSize * 0.8));

  // Desktop variant — ornate centered card
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 16 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={wrapperClass}
      style={{ width: metrics.width }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,0.95))]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02)_42%,rgba(255,255,255,0.01))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.16),_transparent_36%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.08),_transparent_54%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.14)_52%,rgba(2,6,23,0.24))]" />
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

      <div className="surface-content" style={{ padding: metrics.padding }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-200 shadow-[0_0_18px_rgba(199,210,254,0.65)]" />
            </span>
            <span
              className="truncate font-semibold uppercase tracking-[0.26em] text-indigo-50"
              style={{ fontSize: desktopEyebrowFontSize }}
            >
              All-in Showdown
            </span>
          </div>
          <div
            className="rounded-full border border-indigo-100/25 bg-indigo-300/14 px-3 py-1.5 font-semibold uppercase tracking-[0.18em] text-white"
            style={{ fontSize: desktopBadgeFontSize }}
          >
            Vote
          </div>
        </div>

        <div className="text-center mb-4">
          <h3 className="font-black tracking-tight text-white" style={{ fontSize: metrics.titleFontSize }}>
            {title}
          </h3>
          <p className="mt-1 text-slate-100" style={{ fontSize: metrics.subtitleFontSize }}>
            {subtitle}
          </p>
        </div>

        <TimerBar startedAt={votingStartedAt} variant="voting" className="mb-4" />

        {canVote ? (
          <div className="flex gap-2 mb-4">
            {VOTE_OPTIONS.map((opt) => (
              <button
                key={opt.count}
                onClick={() => onVote?.(opt.count)}
                className={`flex-1 rounded-2xl border font-black transition-all ${
                  myVote === opt.count
                    ? "border-indigo-200/25 bg-indigo-400/16 text-white shadow-[0_12px_32px_rgba(99,102,241,0.3)]"
                    : "border-white/14 bg-white/8 text-slate-50 hover:bg-white/12"
                }`}
                style={{
                  height: metrics.buttonHeight,
                  fontSize: metrics.buttonFontSize,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div
            className="mb-4 rounded-2xl border border-white/14 bg-white/8 py-3 text-center text-slate-100"
            style={{ fontSize: metrics.waitingFontSize }}
          >
            Waiting for all-in players to vote…
          </div>
        )}

        <div className="space-y-2 border-t border-white/8 pt-4">
          {nonFolded.map((p) => {
            if (!p) return null;
            const vote = p.id ? votes[p.id] : undefined;
            return (
              <div
                key={p.id ?? p.name}
                className="flex items-center justify-between rounded-2xl border border-white/14 bg-white/8 px-3 py-2.5"
                style={{ fontSize: metrics.rowFontSize }}
              >
                <span className="truncate pr-3 font-semibold text-slate-50">{p.name}</span>
                <span
                  className={`rounded-full px-3 py-1.5 font-bold uppercase tracking-[0.16em] ${
                    vote
                      ? "border border-indigo-200/24 bg-indigo-300/14 text-white"
                      : "border border-white/14 bg-slate-800/90 text-slate-200"
                  }`}
                  style={{ fontSize: desktopStatusFontSize }}
                >
                  {vote ? RUN_LABELS[vote - 1] : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

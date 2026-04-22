"use client";
import React from "react";
import { motion } from "framer-motion";
import { BOMB_POT_VOTING_TIMEOUT_MS } from "@pokington/engine";
import { formatCents } from "lib/formatCents";
import TimerBar from "./TimerBar";
import type { DesktopBombPotVotingPanelMetrics } from "lib/desktopTableLayout";

interface BombPotVotingPanelProps {
  vote: { anteBB: number; proposedBy: string; votes: Record<string, boolean> };
  votingStartedAt?: number | null;
  players: Array<{ id?: string; name: string } | null>;
  viewingPlayerId?: string;
  bigBlind: number;
  onApprove: () => void;
  onReject: () => void;
  variant?: "desktop" | "mobile";
  desktopMetrics?: DesktopBombPotVotingPanelMetrics;
}

export default function BombPotVotingPanel({
  vote,
  votingStartedAt,
  players,
  viewingPlayerId,
  bigBlind,
  onApprove,
  onReject,
  variant = "desktop",
  desktopMetrics,
}: BombPotVotingPanelProps) {
  const anteCents = vote.anteBB * bigBlind;
  const hasVoted = viewingPlayerId ? vote.votes[viewingPlayerId] !== undefined : true;
  const isDesktop = variant === "desktop";
  const metrics = desktopMetrics ?? {
    width: 360,
    padding: 20,
    titleFontSize: 18,
    descriptionFontSize: 14,
    voteBadgeFontSize: 12,
    buttonHeight: 56,
    buttonFontSize: 16,
    waitingFontSize: 14,
  };
  const desktopEyebrowFontSize = Math.max(11, Math.round(metrics.voteBadgeFontSize * 0.62));
  const desktopHeaderBadgeFontSize = Math.max(11, Math.round(metrics.voteBadgeFontSize * 0.72));
  const desktopPlayerVoteFontSize = Math.max(12, Math.round(metrics.voteBadgeFontSize * 0.82));

  const proposer = players.find((p) => p?.id === vote.proposedBy);
  const proposerName = proposer?.name ?? "Someone";
  const shellClass = isDesktop
    ? "elevated-surface-dark relative rounded-[2rem] border"
    : "elevated-surface-dark relative rounded-[1.7rem] border p-4";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
      className={shellClass}
      style={{
        width: isDesktop ? metrics.width : undefined,
        padding: isDesktop ? metrics.padding : undefined,
      }}
    >
      <div className={`absolute inset-0 ${isDesktop ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_48%,rgba(255,255,255,0.02))]" : "bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,0.94))]"}`} />
      <div className={`absolute inset-0 ${isDesktop ? "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(34,197,94,0.08),_transparent_46%)]" : "bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.018)_42%,rgba(255,255,255,0.01))]"}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(34,197,94,0.08),_transparent_46%)]" />
      <div className={`${isDesktop ? "hidden" : "absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.04),rgba(2,6,23,0.18)_52%,rgba(2,6,23,0.3))]"}`} />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

      <div className="surface-content">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-200 shadow-[0_0_18px_rgba(186,230,253,0.65)]" />
            </span>
            <span
              className={`truncate font-semibold uppercase text-sky-100/80 ${isDesktop ? "tracking-[0.26em]" : "text-[10px] tracking-[0.22em]"}`}
              style={isDesktop ? { fontSize: desktopEyebrowFontSize } : undefined}
            >
              Special Hand
            </span>
          </div>
          <div
            className={`rounded-full border border-sky-100/15 bg-sky-300/10 font-semibold uppercase text-sky-50/90 ${isDesktop ? "px-3 py-1.5 tracking-[0.18em]" : "px-3 py-1 text-[10px] tracking-[0.16em]"}`}
            style={isDesktop ? { fontSize: desktopHeaderBadgeFontSize } : undefined}
          >
            Vote
          </div>
        </div>

        <div className="mb-4 text-center">
          <div className="font-black tracking-tight text-white" style={{ fontSize: isDesktop ? metrics.titleFontSize : 22 }}>
            Bomb Pot Vote
          </div>
          <div className="mt-1 text-white/80" style={{ fontSize: isDesktop ? metrics.descriptionFontSize : 13 }}>
            <span className="font-semibold text-sky-100">{proposerName}</span> proposed{" "}
            <span className="font-black text-white">{vote.anteBB}x BB ante</span>{" "}
            for <span className="font-semibold text-sky-100">{formatCents(anteCents)}</span>.
          </div>
        </div>

        <TimerBar
          startedAt={votingStartedAt}
          durationMs={BOMB_POT_VOTING_TIMEOUT_MS}
          variant="voting"
          className="mb-4"
        />

        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {players.filter(Boolean).map((p) => {
            if (!p?.id) return null;
            const v = vote.votes[p.id];
            return (
              <span
                key={p.id}
                className={`${isDesktop ? "px-3 py-1.5" : "px-2.5 py-1 text-[10px]"} max-w-full truncate rounded-full border font-bold`}
                style={{
                  fontSize: isDesktop ? desktopPlayerVoteFontSize : undefined,
                  background:
                    v === true
                      ? "rgba(34,197,94,0.14)"
                      : v === false
                      ? "rgba(239,68,68,0.12)"
                      : isDesktop ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.82)",
                  color:
                    v === true ? "#bbf7d0" : v === false ? "#fecaca" : "rgba(255,255,255,0.56)",
                  border: `1px solid ${
                    v === true
                      ? "rgba(34,197,94,0.24)"
                      : v === false
                      ? "rgba(239,68,68,0.24)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                }}
              >
                {v === true ? "In" : v === false ? "Out" : "Pending"} {p.name}
              </span>
            );
          })}
        </div>

        {!hasVoted && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onApprove}
              className={`rounded-2xl border font-black transition-colors ${isDesktop ? "" : "py-3 text-sm"}`}
              style={{
                height: isDesktop ? metrics.buttonHeight : undefined,
                fontSize: isDesktop ? metrics.buttonFontSize : undefined,
                background: "rgba(34,197,94,0.14)",
                color: "#dcfce7",
                borderColor: "rgba(34,197,94,0.24)",
                boxShadow: isDesktop ? undefined : "0 10px 26px rgba(34,197,94,0.12)",
              }}
            >
              Let's Gooooo
            </button>
            <button
              onClick={onReject}
              className={`rounded-2xl border font-bold transition-colors ${isDesktop ? "" : "py-3 text-sm"}`}
              style={{
                height: isDesktop ? metrics.buttonHeight : undefined,
                fontSize: isDesktop ? metrics.buttonFontSize : undefined,
                background: "rgba(239,68,68,0.12)",
                color: "#fee2e2",
                borderColor: "rgba(239,68,68,0.24)",
                boxShadow: isDesktop ? undefined : "0 10px 26px rgba(239,68,68,0.12)",
              }}
            >
              Not Feeling It
            </button>
          </div>
        )}
        {hasVoted && (
          <div
            className={`rounded-2xl border ${isDesktop ? "border-white/8 bg-white/5" : "border-white/10 bg-slate-900/78"} py-3 text-center ${isDesktop ? "" : "text-xs"}`}
            style={{
              color: isDesktop ? "rgba(255,255,255,0.56)" : "rgba(255,255,255,0.68)",
              fontSize: isDesktop ? metrics.waitingFontSize : undefined,
            }}
          >
            Vote locked in. Waiting for the rest of the table…
          </div>
        )}
      </div>
    </motion.div>
  );
}

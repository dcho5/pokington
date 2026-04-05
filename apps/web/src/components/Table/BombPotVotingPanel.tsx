"use client";
import React from "react";
import { motion } from "framer-motion";
import { formatCents } from "lib/formatCents";

interface BombPotVotingPanelProps {
  vote: { anteBB: number; proposedBy: string; votes: Record<string, boolean> };
  players: Array<{ id?: string; name: string } | null>;
  viewingPlayerId?: string;
  bigBlind: number;
  onApprove: () => void;
  onReject: () => void;
  variant?: "desktop" | "mobile";
}

export default function BombPotVotingPanel({
  vote,
  players,
  viewingPlayerId,
  bigBlind,
  onApprove,
  onReject,
  variant = "desktop",
}: BombPotVotingPanelProps) {
  const anteCents = vote.anteBB * bigBlind;
  const hasVoted = viewingPlayerId ? vote.votes[viewingPlayerId] !== undefined : true;
  const isDesktop = variant === "desktop";

  const proposer = players.find((p) => p?.id === vote.proposedBy);
  const proposerName = proposer?.name ?? "Someone";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
      className={`relative overflow-hidden rounded-2xl ${isDesktop ? "p-4 w-64" : "p-3 w-full"}`}
      style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a8a 100%)",
        border: "1px solid rgba(165,180,252,0.25)",
        boxShadow: "0 0 30px rgba(99,102,241,0.4), 0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className={`font-black text-center mb-1 ${isDesktop ? "text-sm" : "text-xs"}`}
        style={{ color: "#fde68a" }}
      >
        Bomb Pot Vote!
      </div>
      <div
        className={`text-center mb-3 ${isDesktop ? "text-xs" : "text-[10px]"}`}
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        <span className="font-bold" style={{ color: "#a5b4fc" }}>{proposerName}</span>
        {" proposed "}
        <span className="font-black" style={{ color: "#fde68a" }}>{vote.anteBB}x BB ante</span>
        {" ("}
        <span style={{ color: "#a5b4fc" }}>{formatCents(anteCents)}</span>
        {")"}
      </div>

      {/* Vote status */}
      <div className="flex flex-wrap gap-1 mb-3 justify-center">
        {players.filter(Boolean).map((p) => {
          if (!p?.id) return null;
          const v = vote.votes[p.id];
          return (
            <span
              key={p.id}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background:
                  v === true
                    ? "rgba(34,197,94,0.25)"
                    : v === false
                    ? "rgba(239,68,68,0.25)"
                    : "rgba(255,255,255,0.08)",
                color:
                  v === true ? "#86efac" : v === false ? "#fca5a5" : "rgba(255,255,255,0.5)",
                border: `1px solid ${
                  v === true
                    ? "rgba(34,197,94,0.4)"
                    : v === false
                    ? "rgba(239,68,68,0.4)"
                    : "rgba(255,255,255,0.12)"
                }`,
              }}
            >
              {v === true ? "v" : v === false ? "x" : "..."} {p.name}
            </span>
          );
        })}
      </div>

      {!hasVoted && (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 py-2 rounded-xl text-sm font-black transition-colors"
            style={{
              background: "rgba(34,197,94,0.25)",
              color: "#86efac",
              border: "1px solid rgba(34,197,94,0.4)",
            }}
          >
            In
          </button>
          <button
            onClick={onReject}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors"
            style={{
              background: "rgba(239,68,68,0.15)",
              color: "#fca5a5",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            Out
          </button>
        </div>
      )}
      {hasVoted && (
        <div className="text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          Waiting for others...
        </div>
      )}
    </motion.div>
  );
}

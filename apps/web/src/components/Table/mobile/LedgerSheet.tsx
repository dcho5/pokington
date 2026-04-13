"use client";
import React from "react";
import { motion } from "framer-motion";
import { useGameStore } from "store/useGameStore";
import { formatCents } from "lib/formatCents";
import { deriveLedgerRows, derivePayoutInstructions } from "lib/ledger";

interface LedgerSheetProps {
  onDismiss: () => void;
}

export default function LedgerSheet({ onDismiss }: LedgerSheetProps) {
  // Subscribe to raw state directly to preserve Zustand reactivity
  const ledger = useGameStore((s) => s.ledger);
  const rows = deriveLedgerRows(ledger);
  const payouts = derivePayoutInstructions(rows);

  return (
    <>
      <motion.div
        className="overlay-scrim-strong absolute inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />

      <motion.div
        className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl
          elevated-surface-dark border-t
          px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        onDragEnd={(_event: unknown, info: { offset: { y: number } }) => { if (info.offset.y > 80) onDismiss(); }}
      >
        <div className="surface-content">
          <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-4" />

          <h2 className="text-white font-black text-base mb-3">Session Ledger</h2>

          {rows.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No players have sat down yet.</p>
          ) : (
            <>
            {/* Header row */}
            <div className="flex text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 px-1">
              <span className="flex-1">Player</span>
              <span className="w-16 text-right">Buy-in</span>
              <span className="w-16 text-right">Cash-out</span>
              <span className="w-14 text-right">Net</span>
            </div>

            {/* Player rows */}
            <div className="flex flex-col gap-1 mb-4">
              {rows.map((row) => {
                const netColor = row.net > 0 ? "#4ade80" : row.net < 0 ? "#f87171" : "#9ca3af";
                const netPrefix = row.net > 0 ? "+" : "";
                return (
                  <div
                    key={row.playerId}
                    className="flex items-center px-2 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      <span className="text-white font-semibold text-sm truncate">{row.name}</span>
                      {row.isSeated && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)" }}
                        >
                          seated
                        </span>
                      )}
                    </div>
                    <span className="w-16 text-right text-xs text-gray-400 font-mono">{formatCents(row.totalBuyIn)}</span>
                    <span className="w-16 text-right text-xs text-gray-300 font-mono">{formatCents(row.totalCashOut)}</span>
                    <span className="w-14 text-right text-sm font-black font-mono" style={{ color: netColor }}>
                      {netPrefix}{formatCents(Math.abs(row.net))}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Payout instructions */}
            {payouts.length > 0 && (
              <>
                <div
                  className="h-px mb-3"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />
                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Payouts</h3>
                <div className="flex flex-col gap-1.5">
                  {payouts.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-xl"
                      style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}
                    >
                      <span className="text-sm text-gray-200">
                        <span className="font-bold text-red-400">{p.fromName}</span>
                        <span className="text-gray-500"> pays </span>
                        <span className="font-bold text-green-400">{p.toName}</span>
                      </span>
                      <span className="text-sm font-black text-white font-mono ml-3">{formatCents(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        </div>
      </motion.div>
    </>
  );
}

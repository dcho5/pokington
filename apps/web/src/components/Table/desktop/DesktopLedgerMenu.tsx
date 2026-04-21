"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatCents } from "lib/formatCents";
import { useGameStore } from "store/useGameStore";

function DesktopLedgerPanel({ onClose }: { onClose: () => void }) {
  const rows = useGameStore((state) => state.getLedgerRows());
  const payouts = useGameStore((state) => state.getPayoutInstructions());

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="absolute bottom-full left-0 z-[90] mb-4 max-h-[1100px] w-[1170px] overflow-y-auto rounded-[36px] p-[30px]"
      style={{
        background: "rgba(8,10,20,0.97)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 24px 72px rgba(0,0,0,0.58)",
      }}
    >
      <div className="mb-6 flex items-center justify-between px-1">
        <span className="text-[19px] font-black uppercase tracking-[0.28em] text-gray-300">
          Session Ledger
        </span>
        <button
          onClick={onClose}
          className="text-xl font-bold text-gray-400 transition-colors hover:text-white"
        >
          X
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-9 text-center text-xl text-gray-400">No players seated yet.</p>
      ) : (
        <>
          <div className="mb-3 flex px-1 text-[16px] font-bold uppercase tracking-[0.22em] text-gray-400">
            <span className="flex-1">Player</span>
            <span className="w-40 text-right">Buy-in</span>
            <span className="w-40 text-right">Cash-out</span>
            <span className="w-36 text-right">Net</span>
          </div>

          <div className="mb-6 flex flex-col gap-2.5">
            {rows.map((row) => {
              const netColor = row.net > 0 ? "#4ade80" : row.net < 0 ? "#f87171" : "#6b7280";
              const netPrefix = row.net > 0 ? "+" : "";

              return (
                <div
                  key={row.playerId}
                  className="flex items-center rounded-[26px] px-5 py-4"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-[23px] font-semibold text-white">{row.name}</span>
                    {row.isSeated && (
                      <span
                        className="flex-shrink-0 rounded-full px-3 py-1 text-[15px] font-bold"
                        style={{
                          background: "rgba(34,197,94,0.12)",
                          color: "#86efac",
                          border: "1px solid rgba(34,197,94,0.2)",
                        }}
                      >
                        in
                      </span>
                    )}
                  </div>
                  <span className="w-40 text-right font-mono text-[22px] text-gray-300">
                    {formatCents(row.totalBuyIn)}
                  </span>
                  <span className="w-40 text-right font-mono text-[22px] text-gray-200">
                    {formatCents(row.totalCashOut)}
                  </span>
                  <span
                    className="w-36 text-right font-mono text-[27px] font-black"
                    style={{ color: netColor }}
                  >
                    {netPrefix}
                    {formatCents(Math.abs(row.net))}
                  </span>
                </div>
              );
            })}
          </div>

          {payouts.length > 0 && (
            <>
              <div className="mb-5 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
              <div className="mb-3 px-1 text-[16px] font-bold uppercase tracking-[0.22em] text-gray-400">
                Payouts
              </div>
              <div className="flex flex-col gap-3">
                {payouts.map((payout, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-[26px] px-5 py-4"
                    style={{
                      background: "rgba(239,68,68,0.06)",
                      border: "1px solid rgba(239,68,68,0.12)",
                    }}
                  >
                    <span className="text-[22px] text-gray-300">
                      <span className="font-bold text-red-400">{payout.fromName}</span>
                      <span className="text-gray-500"> -&gt; </span>
                      <span className="font-bold text-green-400">{payout.toName}</span>
                    </span>
                    <span className="ml-4 font-mono text-[27px] font-black text-white">
                      {formatCents(payout.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}

const DesktopLedgerMenu: React.FC<{ prominent?: boolean }> = ({ prominent = false }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center justify-center ${
          prominent
            ? "min-h-[56px] min-w-[72px] rounded-[20px] px-4 text-[22px]"
            : "h-11 w-11 rounded-full text-lg"
        }`}
        style={{
          background: open ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.28)",
          backdropFilter: "blur(8px)",
        }}
        aria-label="Open session ledger"
      >
        <span aria-hidden="true">💰</span>
      </motion.button>
      <AnimatePresence>
        {open && <DesktopLedgerPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default DesktopLedgerMenu;

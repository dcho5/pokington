"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "store/useGameStore";
import DesktopLedgerPanel from "./DesktopLedgerPanel";

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
        {open && (
          <DesktopLedgerPanel
            rows={useGameStore.getState().getLedgerRows()}
            payouts={useGameStore.getState().getPayoutInstructions()}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DesktopLedgerMenu;

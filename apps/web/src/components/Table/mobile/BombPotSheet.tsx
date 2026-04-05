"use client";
import React from "react";
import { motion } from "framer-motion";
import { formatCents } from "lib/formatCents";

interface BombPotSheetProps {
  onConfirm: (anteBB: 1 | 2 | 3 | 4 | 5) => void;
  onDismiss: () => void;
  bigBlind: number;
}

const MULTIPLIERS = [1, 2, 3, 4, 5] as const;

const BombPotSheet: React.FC<BombPotSheetProps> = ({ onConfirm, onDismiss, bigBlind }) => {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />

      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl backdrop-blur-xl border-t border-white/[0.06] px-4 pt-4"
        style={{
          background: "rgba(3,7,18,0.97)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80) onDismiss();
        }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="text-center mb-1">
          <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">💣 Bomb Pot</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Players ante in · two boards dealt</p>
        </div>

        {/* Multiplier buttons */}
        <div className="flex gap-2 mt-4">
          {MULTIPLIERS.map((n) => (
            <motion.button
              key={n}
              whileTap={{ scale: 0.94 }}
              onClick={() => { onConfirm(n); onDismiss(); }}
              className="flex-1 h-[76px] rounded-2xl flex flex-col items-center justify-center gap-1"
              style={{
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            >
              <span className="text-2xl font-black text-indigo-200">{n}×</span>
              <span className="text-[10px] text-indigo-400 font-bold">{formatCents(n * bigBlind)}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </>
  );
};

export default BombPotSheet;

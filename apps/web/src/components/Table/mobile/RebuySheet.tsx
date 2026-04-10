"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { getBuyInPresets } from "constants/game";

interface RebuySheetProps {
  playerName: string;
  bigBlindCents: number;
  onRebuy: (buyInCents: number) => void;
  onLeave: () => void;
  /** "dialog" = centered desktop popup, "sheet" = mobile bottom slide */
  variant?: "dialog" | "sheet";
}

export default function RebuySheet({ playerName, bigBlindCents, onRebuy, onLeave, variant = "sheet" }: RebuySheetProps) {
  const presets = getBuyInPresets(bigBlindCents);
  const [selected, setSelected] = useState(presets[1].dollars.toFixed(2));
  const cents = Math.round(parseFloat(selected || "0") * 100);

  const presetButtons = (
    <div className="flex gap-2 mb-6">
      {presets.map((preset) => {
        const val = preset.dollars.toFixed(2);
        const label = preset.dollars % 1 === 0 ? `$${preset.dollars.toFixed(0)}` : `$${val}`;
        return (
          <button
            key={preset.label}
            onClick={() => setSelected(val)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
              selected === val
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : "bg-gray-800 text-gray-400 border border-gray-700 active:bg-gray-700"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  if (variant === "dialog") {
    return (
      <>
        <motion.div
          className="absolute inset-0 z-40 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-gray-950/98 backdrop-blur-xl border border-white/[0.08] shadow-2xl p-6 pointer-events-auto"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="text-center mb-6">
              <p className="text-lg font-black text-white mb-1">Out of chips</p>
              <p className="text-sm text-gray-400">
                {playerName} — buy back in to keep playing.
              </p>
            </div>

            <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">
              Buy-in
            </label>
            {presetButtons}

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onLeave}
                className="flex-1 h-14 rounded-2xl bg-gray-800 border border-gray-700 text-gray-300 font-bold text-base hover:bg-gray-700 transition-colors"
              >
                Leave
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                disabled={cents <= 0}
                onClick={() => onRebuy(cents)}
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-base shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_28px_rgba(239,68,68,0.6)] transition-shadow disabled:opacity-40 disabled:shadow-none"
              >
                Buy In
              </motion.button>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // ── Mobile: bottom sheet ──
  return (
    <>
      <motion.div
        className="absolute inset-0 z-40 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl
          bg-gray-950/98 backdrop-blur-xl
          border-t border-white/[0.06]
          px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

        <div className="text-center mb-6">
          <p className="text-lg font-black text-white mb-1">Out of chips</p>
          <p className="text-sm text-gray-400">
            {playerName} — buy back in to keep playing.
          </p>
        </div>

        <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">
          Buy-in
        </label>
        {presetButtons}

        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onLeave}
            className="flex-1 h-14 rounded-2xl bg-gray-800 border border-gray-700 text-gray-300 font-bold text-base"
          >
            Leave
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            disabled={cents <= 0}
            onClick={() => onRebuy(cents)}
            className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-base shadow-[0_0_20px_rgba(239,68,68,0.4)] disabled:opacity-40 disabled:shadow-none"
          >
            Buy In
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

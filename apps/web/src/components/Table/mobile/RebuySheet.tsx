"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { getBuyInPresets } from "constants/game";
import MobileBottomSheet from "./MobileBottomSheet";
import DesktopTableDialog from "../DesktopTableDialog";

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
  const isDesktopDialog = variant === "dialog";
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
            className={`flex-1 rounded-xl font-bold transition-colors ${
              selected === val
                ? "bg-red-500/10 text-red-500 border border-red-500/30 dark:text-red-300"
                : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            } ${isDesktopDialog ? "py-3 text-base" : "py-3 text-sm"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  if (variant === "dialog") {
    return (
      <DesktopTableDialog onDismiss={() => {}}>
        <div className="surface-content">
          <div className="mb-7 text-center">
            <p className="text-[13px] font-black uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
              Rebuy
            </p>
            <p className="mt-3 text-[2rem] font-black text-gray-900 dark:text-white">Out of chips</p>
            <p className="mt-2 text-[17px] leading-7 text-gray-600 dark:text-gray-300">
              {playerName} — buy back in to keep playing.
            </p>
          </div>

          <label className="mb-2 block text-[13px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Buy-in
          </label>
          <div className="mb-7">{presetButtons}</div>

          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onLeave}
              className="flex-1 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-lg border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Leave
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={cents <= 0}
              onClick={() => onRebuy(cents)}
              className="flex-1 h-16 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-lg shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_28px_rgba(239,68,68,0.6)] transition-shadow disabled:opacity-40 disabled:shadow-none"
            >
              Buy In
            </motion.button>
          </div>
        </div>
      </DesktopTableDialog>
    );
  }

  // ── Mobile: bottom sheet ──
  return (
    <MobileBottomSheet
      onDismiss={() => {}}
      className="elevated-surface-light border-t px-4 pt-4 max-h-[85dvh] overflow-y-auto overscroll-contain"
      draggable={false}
    >
      <div className="surface-content">
        <div className="text-center mb-6">
          <p className="text-lg font-black text-gray-900 dark:text-white mb-1">Out of chips</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
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
            className="flex-1 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-base border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
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
      </div>
    </MobileBottomSheet>
  );
}

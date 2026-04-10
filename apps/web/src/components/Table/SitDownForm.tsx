"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { getBuyInPresets } from "constants/game";

interface SitDownFormProps {
  seatIndex: number;
  bigBlindCents: number;
  onConfirm: (name: string, buyInCents: number) => void;
  onDismiss: () => void;
  /** "dialog" = centered desktop modal, "sheet" = mobile bottom sheet */
  variant?: "dialog" | "sheet";
}

export default function SitDownForm({
  seatIndex,
  bigBlindCents,
  onConfirm,
  onDismiss,
  variant = "dialog",
}: SitDownFormProps) {
  const presets = getBuyInPresets(bigBlindCents);
  const [name, setName] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("pokington_player_name") ?? "";
  });
  const [buyIn, setBuyIn] = useState(presets[1].dollars.toFixed(2));

  const canConfirm = name.trim().length > 0 && parseFloat(buyIn || "0") > 0;

  const handleConfirm = () => {
    const cents = Math.round(parseFloat(buyIn || "0") * 100);
    if (name.trim() && cents > 0) {
      localStorage.setItem("pokington_player_name", name.trim());
      onConfirm(name.trim(), cents);
    }
  };

  // ── Shared form body ──
  const formBody = (
    <>
      <div className="text-center mb-5">
        <span className="text-lg font-black text-gray-900 dark:text-white">
          Seat {seatIndex + 1}
        </span>
      </div>

      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canConfirm) handleConfirm();
        }}
        maxLength={20}
        autoFocus
        className="w-full h-14 px-4 rounded-2xl
          bg-gray-100 dark:bg-gray-800
          border border-gray-300 dark:border-gray-700
          text-gray-900 dark:text-white text-base font-medium
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          outline-none focus:ring-2 focus:ring-red-500/50 mb-4"
      />

      <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block">
        Buy-in
      </label>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500 dark:text-gray-400 font-bold">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={buyIn}
          onChange={(e) => {
            const v = e.target.value;
            if (/^\d*\.?\d{0,2}$/.test(v)) setBuyIn(v);
          }}
          className="flex-1 h-12 px-4 rounded-xl
            bg-gray-100 dark:bg-gray-800
            border border-gray-300 dark:border-gray-700
            text-gray-900 dark:text-white text-lg font-mono font-bold
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            outline-none focus:ring-2 focus:ring-red-500/50"
        />
      </div>
      <div className="flex gap-2 mb-5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setBuyIn(preset.dollars.toFixed(2))}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
              buyIn === preset.dollars.toFixed(2)
                ? "bg-red-500/10 text-red-500 border border-red-500/30"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            ${preset.dollars % 1 === 0 ? preset.dollars.toFixed(0) : preset.dollars.toFixed(2)}
          </button>
        ))}
      </div>
    </>
  );

  // ── Desktop: centered dialog ──
  if (variant === "dialog") {
    return (
      <>
        <motion.div
          className="absolute inset-0 z-40 bg-black/20 dark:bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
        />
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-white/[0.06] shadow-2xl p-6 pointer-events-auto"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {formBody}
            <div className="flex gap-3">
              <button
                onClick={onDismiss}
                className="flex-1 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-base border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                disabled={!canConfirm}
                onClick={handleConfirm}
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-base shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-shadow disabled:opacity-40 disabled:shadow-none"
              >
                Sit Down
              </button>
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
        className="absolute inset-0 z-40 bg-black/20 dark:bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl
          bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl
          border-t border-gray-200/50 dark:border-white/[0.06]
          px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        onDragEnd={(_, info) => { if (info.offset.y > 80) onDismiss(); }}
      >
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-5" />
        {formBody}
        <button
          disabled={!canConfirm}
          onClick={handleConfirm}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-base shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-shadow disabled:opacity-40 disabled:shadow-none"
        >
          Sit Down
        </button>
      </motion.div>
    </>
  );
}

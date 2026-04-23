"use client";
import React, { useEffect, useRef, useState } from "react";
import { getBuyInPresets } from "constants/game";
import MobileBottomSheet from "./mobile/MobileBottomSheet";
import DesktopTableDialog from "./DesktopTableDialog";

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
  const isDesktopDialog = variant === "dialog";
  const nameInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const focusDelayMs = variant === "sheet" ? 260 : 0;
    const timer = window.setTimeout(() => {
      const input = nameInputRef.current;
      if (!input) return;
      try {
        input.focus(variant === "sheet" ? { preventScroll: true } : undefined);
      } catch {
        input.focus();
      }
    }, focusDelayMs);
    return () => window.clearTimeout(timer);
  }, [variant]);

  // ── Shared form body ──
  const formBody = (
    <>
      <div className={`text-center ${isDesktopDialog ? "mb-7" : "mb-5"}`}>
        {isDesktopDialog && (
          <p className="text-[13px] font-black uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
            Sit Down
          </p>
        )}
        <span className={`${isDesktopDialog ? "mt-3 block text-[2rem]" : "text-lg"} font-black text-gray-900 dark:text-white`}>
          Seat {seatIndex + 1}
        </span>
        {isDesktopDialog && (
          <p className="mt-2 text-[17px] leading-7 text-gray-600 dark:text-gray-300">
            Choose your name and buy-in to join the table.
          </p>
        )}
      </div>

      <input
        ref={nameInputRef}
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canConfirm) handleConfirm();
        }}
        maxLength={20}
        className={`w-full rounded-2xl
          bg-gray-100 dark:bg-gray-800
          border border-gray-300 dark:border-gray-700
          text-gray-900 dark:text-white font-medium
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          outline-none focus:ring-2 focus:ring-red-500/50 ${
            isDesktopDialog ? "mb-5 h-16 px-5 text-lg" : "mb-4 h-14 px-4 text-base"
          }`}
      />

      <label className={`font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block ${isDesktopDialog ? "text-[13px]" : "text-xs"}`}>
        Buy-in
      </label>
      <div className={`flex items-center gap-2 ${isDesktopDialog ? "mb-4" : "mb-3"}`}>
        <span className="text-gray-500 dark:text-gray-400 font-bold">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={buyIn}
          onChange={(e) => {
            const v = e.target.value;
            if (/^\d*\.?\d{0,2}$/.test(v)) setBuyIn(v);
          }}
          className={`flex-1 rounded-xl
            bg-gray-100 dark:bg-gray-800
            border border-gray-300 dark:border-gray-700
            text-gray-900 dark:text-white font-mono font-bold
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            outline-none focus:ring-2 focus:ring-red-500/50 ${
              isDesktopDialog ? "h-16 px-5 text-[1.45rem]" : "h-12 px-4 text-lg"
            }`}
        />
      </div>
      <div className={`flex gap-2 ${isDesktopDialog ? "mb-7" : "mb-5"}`}>
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setBuyIn(preset.dollars.toFixed(2))}
            className={`flex-1 rounded-xl font-bold transition-colors ${
              buyIn === preset.dollars.toFixed(2)
                ? "bg-red-500/10 text-red-500 border border-red-500/30"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
            } ${isDesktopDialog ? "py-3 text-base" : "py-2 text-sm"}`}
          >
            ${preset.dollars % 1 === 0 ? preset.dollars.toFixed(0) : preset.dollars.toFixed(2)}
          </button>
        ))}
      </div>
    </>
  );

  const actionRow = (
    <div className={`flex gap-3 ${isDesktopDialog ? "" : ""}`}>
      <button
        onClick={onDismiss}
        className={`flex-1 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isDesktopDialog ? "h-16 text-lg" : "h-14 text-base"
        }`}
      >
        Cancel
      </button>
      <button
        disabled={!canConfirm}
        onClick={handleConfirm}
        className={`flex-1 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-shadow disabled:opacity-40 disabled:shadow-none ${
          isDesktopDialog ? "h-16 text-lg" : "h-14 text-base"
        }`}
      >
        Sit Down
      </button>
    </div>
  );

  // ── Desktop: centered dialog ──
  if (variant === "dialog") {
    return (
      <DesktopTableDialog onDismiss={onDismiss}>
        <div className="surface-content">
          {formBody}
          {actionRow}
        </div>
      </DesktopTableDialog>
    );
  }

  // ── Mobile: bottom sheet ──
  return (
    <MobileBottomSheet
      onDismiss={onDismiss}
      className="elevated-surface-light border-t px-4 pt-4"
    >
      <div className="surface-content">
        {formBody}
        <button
          disabled={!canConfirm}
          onClick={handleConfirm}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-base shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-shadow disabled:opacity-40 disabled:shadow-none"
        >
          Sit Down
        </button>
      </div>
    </MobileBottomSheet>
  );
}

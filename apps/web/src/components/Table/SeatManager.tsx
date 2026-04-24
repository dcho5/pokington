"use client";

import React, { useState } from "react";
import { getBuyInPresets } from "constants/game";
import { formatCents } from "lib/formatCents";
import MobileBottomSheet from "./mobile/MobileBottomSheet";
import DesktopTableDialog from "./DesktopTableDialog";

interface SeatManagerProps {
  playerName: string;
  currentSeatIndex: number;
  currentStackCents: number;
  bigBlindCents: number;
  applyImmediately: boolean;
  pendingUpdate: {
    leaveSeat: boolean;
    moveToSeatIndex: number | null;
    chipDelta: number;
  } | null;
  onSubmit: (update: {
    leaveSeat?: boolean;
    moveToSeatIndex?: number | null;
    chipDelta?: number;
  }) => void;
  onCancelPending?: () => void;
  onDismiss: () => void;
  variant?: "dialog" | "sheet";
}

function describePendingUpdate(update: SeatManagerProps["pendingUpdate"]) {
  if (!update) return null;
  if (update.leaveSeat) return "Leaving seat at the next boundary.";
  if (update.moveToSeatIndex != null) return `Seat change queued for Seat ${update.moveToSeatIndex + 1}.`;
  if (update.chipDelta > 0) return `Adding ${formatCents(update.chipDelta)}.`;
  if (update.chipDelta < 0) return `Cashing out ${formatCents(Math.abs(update.chipDelta))}.`;
  return null;
}

export default function SeatManager({
  playerName,
  currentSeatIndex,
  currentStackCents,
  bigBlindCents,
  applyImmediately,
  pendingUpdate,
  onSubmit,
  onCancelPending,
  onDismiss,
  variant = "dialog",
}: SeatManagerProps) {
  const presets = getBuyInPresets(bigBlindCents);
  const isDesktopDialog = variant === "dialog";
  const [amount, setAmount] = useState(presets[1]?.dollars.toFixed(2) ?? "0.00");

  const parsedCents = Math.round((Number.parseFloat(amount || "0") || 0) * 100);
  const chipDelta = parsedCents;
  const hasChange = chipDelta !== 0;
  const canSubmit = hasChange && parsedCents >= 0;
  const pendingCopy = describePendingUpdate(pendingUpdate);
  const submitLabel = applyImmediately ? "Add Chips" : "Add Next Hand";

  const body = (
    <div className="surface-content">
      <div className={`text-center ${isDesktopDialog ? "mb-7" : "mb-5"}`}>
        {isDesktopDialog && (
          <p className="text-[13px] font-black uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
            Add Chips
          </p>
        )}
        <p className={`${isDesktopDialog ? "mt-3 text-[2rem]" : "text-lg"} font-black text-gray-900 dark:text-white`}>
          {playerName}
        </p>
        <p className={`${isDesktopDialog ? "mt-2 text-[17px] leading-7" : "text-sm"} text-gray-600 dark:text-gray-400`}>
          Seat {currentSeatIndex + 1} · Stack {formatCents(currentStackCents)}
        </p>
      </div>

      {pendingCopy && (
        <div className={`mb-5 rounded-[24px] border border-amber-500/30 bg-amber-500/10 ${isDesktopDialog ? "px-5 py-4 text-base" : "px-4 py-3 text-sm"} text-amber-900 dark:text-amber-100`}>
          <p className={`font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300 ${isDesktopDialog ? "text-[11px]" : "text-[10px]"}`}>Queued Update</p>
          <p className="mt-1">{pendingCopy}</p>
          {onCancelPending && (
            <button
              type="button"
              onClick={onCancelPending}
              className={`mt-3 rounded-xl border border-amber-400/30 px-3 py-2 font-bold text-amber-700 hover:bg-amber-500/10 dark:text-amber-200 ${isDesktopDialog ? "text-sm" : "text-xs"}`}
            >
              Cancel Pending Update
            </button>
          )}
        </div>
      )}

      <label className={`mb-2 block font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 ${isDesktopDialog ? "text-[13px]" : "text-xs"}`}>
        Buy-In Amount
      </label>
      <div className={`flex items-center gap-2 ${isDesktopDialog ? "mb-4" : "mb-3"}`}>
        <span className="font-bold text-gray-500">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            const next = event.target.value;
            if (/^\d*\.?\d{0,2}$/.test(next)) setAmount(next);
          }}
          className={`flex-1 rounded-xl border border-gray-300 bg-gray-100 px-4 font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-red-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${
            isDesktopDialog ? "h-16 px-5 text-[1.45rem]" : "h-12 text-lg"
          }`}
        />
      </div>
      <div className={`flex gap-2 ${isDesktopDialog ? "mb-7" : "mb-4"}`}>
        {presets.map((preset) => {
          const presetValue = preset.dollars.toFixed(2);
          const selected = amount === presetValue;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setAmount(presetValue)}
              className={`flex-1 rounded-xl border font-bold transition-colors ${
                selected
                  ? "border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-300"
                  : "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              } ${isDesktopDialog ? "px-2 py-3 text-base" : "px-2 py-2 text-sm"}`}
            >
              ${preset.dollars % 1 === 0 ? preset.dollars.toFixed(0) : preset.dollars.toFixed(2)}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDismiss}
          className={`flex-1 rounded-2xl border border-gray-200 bg-gray-100 font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${
            isDesktopDialog ? "px-4 py-4 text-lg" : "px-4 py-4 text-sm"
          }`}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ chipDelta })}
          className={`flex-1 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 font-black text-white disabled:opacity-40 ${
            isDesktopDialog ? "px-4 py-4 text-lg shadow-[0_0_20px_rgba(239,68,68,0.35)]" : "px-4 py-4 text-sm"
          }`}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );

  if (variant === "sheet") {
    return (
      <MobileBottomSheet
        onDismiss={onDismiss}
        className="elevated-surface-light border-t px-4 pt-4"
      >
        {body}
      </MobileBottomSheet>
    );
  }

  return (
    <DesktopTableDialog onDismiss={onDismiss}>
      {body}
    </DesktopTableDialog>
  );
}

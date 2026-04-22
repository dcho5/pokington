"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getBuyInPresets } from "constants/game";
import { formatCents } from "lib/formatCents";

interface SeatManagerProps {
  playerName: string;
  currentSeatIndex: number;
  currentStackCents: number;
  bigBlindCents: number;
  emptySeatIndices: number[];
  applyImmediately: boolean;
  pendingUpdate: {
    leaveSeat: boolean;
    moveToSeatIndex: number | null;
    chipDelta: number;
  } | null;
  prefillSeatIndex?: number | null;
  onSubmit: (update: {
    leaveSeat?: boolean;
    moveToSeatIndex?: number | null;
    chipDelta?: number;
  }) => void;
  onCancelPending?: () => void;
  onDismiss: () => void;
  variant?: "dialog" | "sheet";
}

type ChipMode = "add" | "remove";

function describePendingUpdate(update: SeatManagerProps["pendingUpdate"]) {
  if (!update) return null;
  if (update.leaveSeat) return "Leaving seat at the next boundary.";
  if (update.moveToSeatIndex != null && update.chipDelta > 0) {
    return `Moving to Seat ${update.moveToSeatIndex + 1} and adding ${formatCents(update.chipDelta)}.`;
  }
  if (update.moveToSeatIndex != null && update.chipDelta < 0) {
    return `Moving to Seat ${update.moveToSeatIndex + 1} and cashing out ${formatCents(Math.abs(update.chipDelta))}.`;
  }
  if (update.moveToSeatIndex != null) return `Moving to Seat ${update.moveToSeatIndex + 1}.`;
  if (update.chipDelta > 0) return `Adding ${formatCents(update.chipDelta)}.`;
  if (update.chipDelta < 0) return `Cashing out ${formatCents(Math.abs(update.chipDelta))}.`;
  return null;
}

export default function SeatManager({
  playerName,
  currentSeatIndex,
  currentStackCents,
  bigBlindCents,
  emptySeatIndices,
  applyImmediately,
  pendingUpdate,
  prefillSeatIndex = null,
  onSubmit,
  onCancelPending,
  onDismiss,
  variant = "dialog",
}: SeatManagerProps) {
  const presets = getBuyInPresets(bigBlindCents);
  const [chipMode, setChipMode] = useState<ChipMode>(currentStackCents > 0 ? "add" : "add");
  const [amount, setAmount] = useState(presets[1]?.dollars.toFixed(2) ?? "0.00");
  const [seatIndex, setSeatIndex] = useState(prefillSeatIndex ?? currentSeatIndex);

  useEffect(() => {
    setSeatIndex(prefillSeatIndex ?? currentSeatIndex);
  }, [currentSeatIndex, prefillSeatIndex]);

  useEffect(() => {
    if (currentStackCents === 0) {
      setChipMode("add");
    }
  }, [currentStackCents]);

  const seatOptions = useMemo(
    () => [currentSeatIndex, ...emptySeatIndices.filter((seat) => seat !== currentSeatIndex)].sort((a, b) => a - b),
    [currentSeatIndex, emptySeatIndices],
  );

  const parsedCents = Math.round((Number.parseFloat(amount || "0") || 0) * 100);
  const chipDelta = chipMode === "remove" ? -parsedCents : parsedCents;
  const moveToSeatIndex = seatIndex === currentSeatIndex ? null : seatIndex;
  const nextStack = currentStackCents + chipDelta;
  const canRemove = currentStackCents > 0;
  const hasChange = moveToSeatIndex != null || chipDelta !== 0;
  const cashOutInvalid = chipMode === "remove" && parsedCents > 0 && nextStack <= 0;
  const canSubmit = hasChange && parsedCents >= 0 && !cashOutInvalid;
  const pendingCopy = describePendingUpdate(pendingUpdate);
  const submitLabel = applyImmediately ? "Apply Now" : "Save For Next Hand";
  const leaveLabel = applyImmediately ? "Leave Seat" : "Leave Next Hand";

  const body = (
    <div className="surface-content">
      <div className="mb-5 text-center">
        <p className="text-lg font-black text-white">{playerName}</p>
        <p className="text-sm text-gray-400">
          Seat {currentSeatIndex + 1} · Stack {formatCents(currentStackCents)}
        </p>
      </div>

      {pendingCopy && (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-bold uppercase tracking-[0.18em] text-[10px] text-amber-300">Queued Update</p>
          <p className="mt-1">{pendingCopy}</p>
          {onCancelPending && (
            <button
              type="button"
              onClick={onCancelPending}
              className="mt-3 rounded-xl border border-amber-400/30 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/10"
            >
              Cancel Pending Update
            </button>
          )}
        </div>
      )}

      <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">
        Seat Target
      </label>
      <div className="mb-5 flex flex-wrap gap-2">
        {seatOptions.map((seat) => (
          <button
            key={seat}
            type="button"
            onClick={() => setSeatIndex(seat)}
            className={`rounded-xl border px-3 py-2 text-sm font-bold ${
              seatIndex === seat
                ? "border-red-500/40 bg-red-500/20 text-red-300"
                : "border-gray-700 bg-gray-800 text-gray-300"
            }`}
          >
            Seat {seat + 1}
          </button>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setChipMode("add")}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold ${
            chipMode === "add"
              ? "border-red-500/40 bg-red-500/20 text-red-300"
              : "border-gray-700 bg-gray-800 text-gray-300"
          }`}
        >
          Add Chips
        </button>
        <button
          type="button"
          disabled={!canRemove}
          onClick={() => setChipMode("remove")}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold ${
            chipMode === "remove"
              ? "border-red-500/40 bg-red-500/20 text-red-300"
              : "border-gray-700 bg-gray-800 text-gray-300"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Cash Out
        </button>
      </div>

      <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">
        Amount
      </label>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-bold text-gray-500">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            const next = event.target.value;
            if (/^\d*\.?\d{0,2}$/.test(next)) setAmount(next);
          }}
          className="h-12 flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 text-lg font-mono font-bold text-white outline-none focus:ring-2 focus:ring-red-500/40"
        />
      </div>
      <div className="mb-4 flex gap-2">
        {presets.map((preset) => (
          <button
            key={`${chipMode}-${preset.label}`}
            type="button"
            onClick={() => setAmount(preset.dollars.toFixed(2))}
            className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-2 py-2 text-sm font-bold text-gray-300"
          >
            ${preset.dollars % 1 === 0 ? preset.dollars.toFixed(0) : preset.dollars.toFixed(2)}
          </button>
        ))}
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
        <p>
          {moveToSeatIndex != null ? `Next seat: ${moveToSeatIndex + 1}` : `Staying in Seat ${currentSeatIndex + 1}`}
        </p>
        <p>
          {chipDelta === 0
            ? `Next stack: ${formatCents(currentStackCents)}`
            : `Next stack: ${formatCents(Math.max(0, nextStack))}`}
        </p>
        {cashOutInvalid && (
          <p className="mt-2 text-amber-300">
            Cash-outs must leave chips behind unless you choose {leaveLabel.toLowerCase()}.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onSubmit({ leaveSeat: true })}
          className="flex-1 rounded-2xl border border-gray-700 bg-gray-800 px-4 py-4 text-sm font-bold text-gray-100"
        >
          {leaveLabel}
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit({ moveToSeatIndex, chipDelta })}
          className="flex-1 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 px-4 py-4 text-sm font-black text-white disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );

  if (variant === "sheet") {
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
          className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/10 bg-[rgba(3,7,18,0.96)] px-4 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <div className="mb-5 h-1 w-10 rounded-full bg-gray-700 mx-auto" />
          {body}
        </motion.div>
      </>
    );
  }

  return (
    <>
      <motion.div
        className="overlay-scrim-strong absolute inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />
      <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
        <motion.div
          className="elevated-surface-dark w-full max-w-lg rounded-2xl border p-6 pointer-events-auto"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {body}
        </motion.div>
      </div>
    </>
  );
}

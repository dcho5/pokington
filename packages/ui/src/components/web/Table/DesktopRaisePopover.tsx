"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRaiseAmount } from "../../../hooks/useRaiseAmount";
import { formatCents } from "@pokington/shared";

const RAISE_POPOVER_SCALE = 1.5;
const BASE_POPOVER_WIDTH = 288;

function scaleSize(value: number) {
  return Math.round(value * RAISE_POPOVER_SCALE);
}

interface DesktopRaisePopoverProps {
  pot: number;
  stack: number;
  currentBet?: number;
  minRaise: number;
  bigBlind: number;
  isFirstBet: boolean;
  onConfirm: (amount: number) => void;
  onDismiss: () => void;
}

const DesktopRaisePopover: React.FC<DesktopRaisePopoverProps> = ({
  pot,
  stack,
  currentBet = 0,
  minRaise,
  bigBlind,
  isFirstBet,
  onConfirm,
  onDismiss,
}) => {
  const { amount, setAmount, increment: bbIncrement, lowerBound, presets, clamp, allInTotal } =
    useRaiseAmount({ minRaise, stack, pot, bigBlind, currentBet });
  const [rawInput, setRawInput] = useState((lowerBound / 100).toFixed(2));
  const [inputError, setInputError] = useState(false);
  const enterScale = 0.95;
  const popoverWidth = scaleSize(BASE_POPOVER_WIDTH);
  const incrementLabel = formatCents(bbIncrement);
  const label = isFirstBet ? "Bet" : "Raise to";

  const applyAmount = (cents: number) => {
    const clampedAmount = clamp(cents);
    setAmount(clampedAmount);
    setRawInput((clampedAmount / 100).toFixed(2));
    setInputError(false);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const dotIndex = cleaned.indexOf(".");

    if (dotIndex !== -1 && cleaned.length - dotIndex > 3) {
      return;
    }

    setRawInput(cleaned);

    if (cleaned === "" || cleaned === ".") {
      setInputError(true);
      return;
    }

    const parsed = parseFloat(cleaned);

    if (!Number.isNaN(parsed)) {
      const cents = Math.round(parsed * 100);
      if (cents >= lowerBound && cents <= allInTotal) {
        setAmount(cents);
        setInputError(false);
      } else {
        setInputError(true);
      }
    }
  };

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40" onClick={onDismiss} />
      <div
        className="absolute bottom-full left-1/2 z-50 mb-2"
        style={{ marginLeft: -(popoverWidth / 2) }}
      >
        <motion.div
          initial={{ opacity: 0, y: scaleSize(10), scale: enterScale }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: scaleSize(10), scale: enterScale }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
          style={{
            width: popoverWidth,
            padding: scaleSize(16),
            borderRadius: scaleSize(16),
            transformOrigin: "bottom center",
          }}
        >
          <div
            className="mb-1 flex items-start justify-center gap-3"
            style={{ marginBottom: scaleSize(4), gap: scaleSize(12) }}
          >
            <div className="flex w-12 flex-shrink-0 flex-col items-center gap-1">
              <button
                aria-label={`Decrease by ${incrementLabel}`}
                title={`Decrease by ${incrementLabel}`}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-lg font-bold text-gray-900 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                style={{
                  width: scaleSize(36),
                  height: scaleSize(36),
                  fontSize: scaleSize(18),
                }}
                onClick={() => applyAmount(amount - bbIncrement)}
              >
                -
              </button>
              <span
                className="font-bold tabular-nums text-gray-500 dark:text-gray-400"
                style={{ fontSize: scaleSize(9) }}
              >
                -{incrementLabel}
              </span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={rawInput}
              onChange={handleInputChange}
              onBlur={() => {
                if (!inputError) {
                  setRawInput((amount / 100).toFixed(2));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !inputError) {
                  onConfirm(amount);
                  onDismiss();
                }
                if (event.key === "Escape") {
                  onDismiss();
                }
              }}
              className={`w-full rounded-xl px-3 py-2 text-center font-mono text-xl font-black outline-none transition-colors ${
                inputError
                  ? "border-2 border-red-500 bg-red-50 text-red-600 ring-1 ring-red-500 dark:bg-red-950/30 dark:text-red-400"
                  : "border border-gray-200 bg-gray-50 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              }`}
              style={{
                borderRadius: scaleSize(12),
                padding: `${scaleSize(8)}px ${scaleSize(12)}px`,
                fontSize: scaleSize(20),
              }}
            />
            <div className="flex w-12 flex-shrink-0 flex-col items-center gap-1">
              <button
                aria-label={`Increase by ${incrementLabel}`}
                title={`Increase by ${incrementLabel}`}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-lg font-bold text-gray-900 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                style={{
                  width: scaleSize(36),
                  height: scaleSize(36),
                  fontSize: scaleSize(18),
                }}
                onClick={() => applyAmount(amount + bbIncrement)}
              >
                +
              </button>
              <span
                className="font-bold tabular-nums text-gray-500 dark:text-gray-400"
                style={{ fontSize: scaleSize(9) }}
              >
                +{incrementLabel}
              </span>
            </div>
          </div>

          <div className="mb-2 h-4 text-center" style={{ marginBottom: scaleSize(8), height: scaleSize(16) }}>
            {inputError && (
              <span className="font-bold text-red-500" style={{ fontSize: scaleSize(10) }}>
                {formatCents(lowerBound)} - {formatCents(allInTotal)}
              </span>
            )}
          </div>

          <div className="mb-3 flex gap-1" style={{ marginBottom: scaleSize(12), gap: scaleSize(4) }}>
            {presets.map((preset) => (
              <button
                key={preset.label}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-100 py-1.5 font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                style={{
                  borderRadius: scaleSize(8),
                  paddingTop: scaleSize(7),
                  paddingBottom: scaleSize(7),
                  fontSize: scaleSize(12),
                }}
                onClick={() => applyAmount(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            disabled={inputError}
            className={`h-11 w-full rounded-xl text-sm font-black text-white transition-all ${
              inputError
                ? "cursor-not-allowed bg-gray-400 opacity-50 dark:bg-gray-700"
                : "bg-gradient-to-r from-red-500 to-red-700 shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)]"
            }`}
            style={{
              height: scaleSize(44),
              borderRadius: scaleSize(12),
              fontSize: scaleSize(14),
            }}
            onClick={() => {
              if (!inputError) {
                onConfirm(amount);
                onDismiss();
              }
            }}
          >
            {label} {inputError ? "-" : formatCents(amount)}
          </button>
        </motion.div>
      </div>
    </>
  );
};

export default DesktopRaisePopover;

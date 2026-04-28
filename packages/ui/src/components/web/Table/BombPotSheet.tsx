"use client";
import React from "react";
import { motion } from "framer-motion";
import { BOMB_POT_ANTE_BB_VALUES, formatCents } from "@pokington/shared";
import { MOBILE_OVERLAY_Z, MOBILE_SHELL } from "../../../lib/mobileShell";
import type { BombPotAnteBB } from "@pokington/engine";
import MobileBottomSheet from "./MobileBottomSheet";

interface BombPotSheetProps {
  onConfirm: (anteBB: BombPotAnteBB) => void;
  onDismiss: () => void;
  bigBlind: number;
  minPlayerStack?: number;
}

const BombPotSheet: React.FC<BombPotSheetProps> = ({ onConfirm, onDismiss, bigBlind, minPlayerStack }) => {
  return (
    <MobileBottomSheet
      onDismiss={onDismiss}
      className="elevated-surface-dark border-t px-4 pt-4"
      handleClassName="bg-white/18"
      sheetZIndex={MOBILE_OVERLAY_Z.prioritySheet}
      scrimZIndex={MOBILE_OVERLAY_Z.prioritySheetScrim}
      bottomPaddingExtraPx={MOBILE_SHELL.wideSheetInsetBottomPx}
    >
      <div className="surface-content">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-200 shadow-[0_0_18px_rgba(186,230,253,0.65)]" />
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">
              Special Hand
            </span>
          </div>
          <div className="rounded-full border border-sky-100/15 bg-sky-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-50/90">
            Bomb Pot
          </div>
        </div>

        <div className="text-center mb-4">
          <p className="text-[1.35rem] font-black tracking-tight text-white">Choose the ante</p>
          <p className="mt-1 text-[13px] leading-5 text-white/65">
            Everyone antes in and two boards are dealt next hand.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {BOMB_POT_ANTE_BB_VALUES.map((n) => {
            const anteCents = n * bigBlind;
            const disabled = minPlayerStack !== undefined && anteCents > minPlayerStack;
            return (
              <motion.button
                key={n}
                whileTap={disabled ? undefined : { scale: 0.94 }}
                disabled={disabled}
                onClick={() => { if (!disabled) { onConfirm(n); onDismiss(); } }}
                className="h-[92px] rounded-[1.4rem] flex flex-col items-center justify-center gap-1.5 border"
                style={{
                  background: disabled ? "rgba(255,255,255,0.03)" : "rgba(56,189,248,0.1)",
                  borderColor: disabled ? "rgba(255,255,255,0.08)" : "rgba(56,189,248,0.22)",
                  opacity: disabled ? 0.35 : 1,
                }}
              >
                <span className="text-[1.45rem] font-black text-white">{n}× BB</span>
                <span className="rounded-full bg-slate-950/55 px-2 py-0.5 text-[11px] font-black text-white shadow-[0_1px_8px_rgba(0,0,0,0.22)]">
                  {formatCents(anteCents)}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-center text-[12px] leading-5 text-white/55">
          Ante sizes are disabled if any eligible stack cannot fully cover the cost.
        </div>
      </div>
    </MobileBottomSheet>
  );
};

export default BombPotSheet;

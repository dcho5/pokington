"use client";
import React from "react";
import { motion } from "framer-motion";
import { formatCents } from "lib/formatCents";
import type { BombPotAnteBB } from "@pokington/engine";
import { BOMB_POT_ANTE_BB_VALUES } from "constants/game";

interface BombPotSheetProps {
  onConfirm: (anteBB: BombPotAnteBB) => void;
  onDismiss: () => void;
  bigBlind: number;
  minPlayerStack?: number;
}

const BombPotSheet: React.FC<BombPotSheetProps> = ({ onConfirm, onDismiss, bigBlind, minPlayerStack }) => {
  return (
    <>
      <motion.div
        className="overlay-scrim-strong absolute inset-0 z-[180]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />

      <motion.div
        className="elevated-surface-dark absolute bottom-0 left-0 right-0 z-[190] rounded-t-[2rem] border-t px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        onDragEnd={(_event: unknown, info: { offset: { y: number } }) => {
          if (info.offset.y > 80) onDismiss();
        }}
      >
        <div className="surface-content">
          <div className="mb-5 w-10 h-1 rounded-full mx-auto bg-white/18" />

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
                  <span className="text-[11px] text-sky-100/78 font-bold">{formatCents(anteCents)}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-center text-[12px] leading-5 text-white/55">
            Ante sizes are disabled if any eligible stack cannot fully cover the cost.
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default BombPotSheet;

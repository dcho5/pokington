"use client";

import React, { useEffect, useRef, useState } from "react";
import type { BombPotAnteBB } from "@pokington/engine";
import { AnimatePresence, motion } from "framer-motion";
import { BOMB_POT_ANTE_BB_VALUES, formatCents } from "@pokington/shared";

interface DesktopBombPotMenuProps {
  bigBlind: number;
  minPlayerStack?: number;
  onPropose?: (anteBb: BombPotAnteBB) => void;
  prominent?: boolean;
}

const DesktopBombPotMenu: React.FC<DesktopBombPotMenuProps> = ({
  bigBlind,
  minPlayerStack,
  onPropose,
  prominent = false,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center justify-center ${
          prominent
            ? "min-h-[56px] min-w-[72px] rounded-[20px] px-4 text-[24px]"
            : "h-11 w-11 rounded-full text-xl"
        }`}
        style={{
          background: open ? "rgba(99,102,241,0.46)" : "rgba(99,102,241,0.34)",
          border: "1px solid rgba(99,102,241,0.58)",
          backdropFilter: "blur(8px)",
        }}
        aria-label="Propose bomb pot"
      >
        <span aria-hidden="true">💣</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="absolute bottom-full left-0 z-[80] mb-4 flex w-[678px] flex-col gap-6 rounded-[36px] p-[30px]"
            style={{
              background: "rgba(15,17,30,0.97)",
              border: "1px solid rgba(99,102,241,0.3)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 -8px 32px rgba(99,102,241,0.25)",
            }}
          >
            <div className="px-1">
              <div className="text-[16px] font-black uppercase tracking-[0.22em] text-indigo-400">
                Bomb Pot
              </div>
              <div className="mt-1 text-[21px] font-semibold text-indigo-100">
                Players ante in and two boards are dealt.
              </div>
              <div className="mt-1 text-[16px] text-indigo-200/70">
                Choose the blind multiple for next hand.
              </div>
            </div>
            <div className="flex gap-3">
              {BOMB_POT_ANTE_BB_VALUES.map((value) => {
                const anteCents = value * bigBlind;
                const disabled =
                  minPlayerStack !== undefined && anteCents > minPlayerStack;

                return (
                  <motion.button
                    key={value}
                    whileTap={disabled ? undefined : { scale: 0.94 }}
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) {
                        onPropose?.(value);
                        setOpen(false);
                      }
                    }}
                    className="flex h-[162px] flex-1 flex-col items-center justify-center gap-3 rounded-[32px]"
                    style={{
                      background: disabled ? "rgba(99,102,241,0.04)" : "rgba(99,102,241,0.12)",
                      border: `1px solid ${
                        disabled ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.3)"
                      }`,
                      opacity: disabled ? 0.35 : 1,
                    }}
                  >
                    <span className="text-[38px] font-black leading-none text-indigo-200">
                      {value}x BB
                    </span>
                    <span className="text-[21px] font-bold text-indigo-400">
                      {formatCents(anteCents)}
                    </span>
                  </motion.button>
                );
              })}
            </div>
            <div className="px-1 text-[16px] text-indigo-200/70">
              Sizes are unavailable if any next-hand stack cannot fully cover the ante.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DesktopBombPotMenu;

"use client";

import React from "react";
import { motion } from "framer-motion";

interface DesktopTableDialogProps {
  children: React.ReactNode;
  onDismiss: () => void;
  panelClassName?: string;
  tone?: "light" | "dark";
}

export default function DesktopTableDialog({
  children,
  onDismiss,
  panelClassName = "",
  tone = "light",
}: DesktopTableDialogProps) {
  const surfaceClass = tone === "dark" ? "elevated-surface-dark" : "elevated-surface-light";

  return (
    <div className="absolute inset-0 z-[240] isolate">
      {/* Keep desktop dialogs above the info cluster, ledger, and bomb-pot controls. */}
      <motion.div
        className="overlay-scrim-strong absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />
      <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
        <motion.div
          className={`${surfaceClass} pointer-events-auto w-full max-w-[760px] rounded-[34px] border px-9 py-8 shadow-[0_42px_120px_rgba(2,6,23,0.24)] sm:px-11 sm:py-10 ${panelClassName}`.trim()}
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

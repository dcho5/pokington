"use client";

import React from "react";
import { motion } from "framer-motion";

interface RunItOddsBadgeProps {
  percentage?: number | null;
  compact?: boolean;
  className?: string;
}

export default function RunItOddsBadge({
  percentage = null,
  compact = false,
  className = "",
}: RunItOddsBadgeProps) {
  if (percentage == null || !Number.isFinite(percentage)) return null;

  return (
    <motion.div
      key={percentage.toFixed(1)}
      initial={{ opacity: 0, scale: 0.82, y: 6 }}
      animate={{ opacity: 1, scale: [1, 1.05, 1], y: 0 }}
      transition={{
        opacity: { duration: 0.18 },
        y: { type: "spring", stiffness: 320, damping: 26 },
        scale: { duration: 0.34 },
      }}
      className={`inline-flex items-center rounded-full border font-black tabular-nums text-white ${className}`}
      style={{
        padding: compact ? "2px 6px" : "5px 10px",
        fontSize: compact ? 8 : 11,
        letterSpacing: "0.08em",
        background: "linear-gradient(135deg, rgba(239,68,68,0.96), rgba(185,28,28,0.94))",
        borderColor: "rgba(254,226,226,0.42)",
        textShadow: "0 1px 2px rgba(2,6,23,0.8)",
        boxShadow: compact
          ? "0 4px 12px rgba(127,29,29,0.28)"
          : "0 10px 24px rgba(127,29,29,0.28)",
      }}
    >
      {percentage.toFixed(1)}%
    </motion.div>
  );
}

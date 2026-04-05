"use client";
import React from "react";
import { useRouter } from "next/navigation";
import PokerChip from "components/poker/PokerChip";

interface TableHeaderProps {
  tableName?: string;
  smallBlind?: number;
  bigBlind?: number;
  sevenTwoBountyBB?: 0 | 1 | 2 | 3;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  tableName = "Table",
  smallBlind = 1,
  bigBlind = 2,
  sevenTwoBountyBB = 0,
}) => {
  const router = useRouter();

  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4
        bg-white/85 dark:bg-[rgba(3,7,18,0.85)]
        border-b border-gray-200/50 dark:border-white/[0.06]
        backdrop-blur-md"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        height: "calc(52px + env(safe-area-inset-top))",
      }}
    >
      {/* Left: back + table name */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 min-w-[44px] min-h-[44px] -ml-2 px-2 rounded-xl"
        aria-label="Go back"
      >
        <span className="text-xl leading-none text-gray-900 dark:text-white">←</span>
        <span className="font-bold text-sm text-gray-900 dark:text-white">{tableName}</span>
      </button>

      {/* Center: chip logo — absolutely centered so left/right elements don't shift it */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <PokerChip size={22} glowAngle={-45} />
      </div>

      {/* Right: 7-2 badge (when active) + blinds */}
      <div className="flex items-center gap-1.5">
        {sevenTwoBountyBB > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30">
            7-2 {sevenTwoBountyBB}×
          </span>
        )}
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          ${smallBlind} / ${bigBlind}
        </span>
      </div>
    </div>
  );
};

export default TableHeader;

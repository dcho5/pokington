"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCopyCurrentUrl } from "hooks/useCopyCurrentUrl";
import { formatCents } from "lib/formatCents";
import { getMobileHeaderHeight, getMobileSafeAreaTop } from "lib/mobileShell.mjs";
import type { SevenTwoBountyBB } from "@pokington/engine";

interface TableHeaderProps {
  tableName?: string;
  smallBlind?: number;
  bigBlind?: number;
  sevenTwoBountyBB?: SevenTwoBountyBB;
  showLeaveButton?: boolean;
  leaveQueued?: boolean;
  mustQueueLeave?: boolean;
  onLeavePress?: () => void;
  onCancelLeavePress?: () => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  tableName = "Table",
  smallBlind = 1,
  bigBlind = 2,
  sevenTwoBountyBB = 0,
  showLeaveButton = false,
  leaveQueued = false,
  mustQueueLeave = false,
  onLeavePress,
  onCancelLeavePress,
}) => {
  const router = useRouter();
  const { copied, copyLink } = useCopyCurrentUrl();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [leaveQueued]);

  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4
        bg-white/85 dark:bg-[rgba(3,7,18,0.85)]
        border-b border-gray-200/50 dark:border-white/[0.06]
        backdrop-blur-md"
      style={{
        paddingTop: getMobileSafeAreaTop(),
        height: getMobileHeaderHeight(),
      }}
    >
      {/* Left: back + table name */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 min-w-[44px] min-h-[44px] -ml-2 px-2 rounded-xl"
        aria-label="Go back"
      >
        <span className="text-xl leading-none text-gray-900 dark:text-white">←</span>
        <span className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[120px]">{tableName}</span>
      </button>
      {/* Right: 7-2 badge (when active) + blinds + overflow menu */}
      <div className="flex items-center justify-end gap-1.5 min-w-0 max-w-[48%]">
        {sevenTwoBountyBB > 0 && (
          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30">
            7-2 {sevenTwoBountyBB}×
          </span>
        )}
        <span className="shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">
          {formatCents(smallBlind)} / {formatCents(bigBlind)}
        </span>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className={`flex h-8 w-6 items-center justify-center transition-colors ${
              leaveQueued
                ? "text-amber-500"
                : "text-gray-700 dark:text-gray-200"
            }`}
            aria-label="Table menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-full flex-col items-center justify-center gap-0.5">
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="h-1 w-1 rounded-full bg-current" />
            </span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] min-w-[170px] overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 p-1 shadow-xl backdrop-blur-md dark:border-white/[0.08] dark:bg-[rgba(3,7,18,0.96)]">
              <button
                type="button"
                onClick={async () => {
                  await copyLink();
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-colors ${
                  copied
                    ? "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-300"
                    : "text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-white/[0.06]"
                }`}
              >
                <span>{copied ? "Link Copied" : "Copy Link"}</span>
              </button>
              {showLeaveButton && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (leaveQueued) {
                      onCancelLeavePress?.();
                    } else {
                      onLeavePress?.();
                    }
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-colors ${
                    leaveQueued
                      ? "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                      : "text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <span>{leaveQueued ? "Cancel Leave" : mustQueueLeave ? "Leave Next Hand" : "Leave Table"}</span>
                  {leaveQueued && (
                    <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[9px] uppercase tracking-wide">
                      queued
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableHeader;

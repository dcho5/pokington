"use client";
import React from "react";
import { formatCents } from "@pokington/shared";
import AnnouncementBanner from "./AnnouncementBanner";

interface SevenTwoAnnouncementProps {
  winnerName: string;
  perPlayer: number;
  total: number;
  variant?: "desktop" | "mobile";
}

export default function SevenTwoAnnouncement({
  winnerName,
  perPlayer,
  total,
  variant = "desktop",
}: SevenTwoAnnouncementProps) {
  const isDesktop = variant === "desktop";

  return (
    <AnnouncementBanner
      eyebrow="Bounty Collected"
      title="7-2 Offsuit"
      detail={
        <>
          {winnerName} collects{" "}
          <span className="font-semibold text-white">{formatCents(total)}</span>{" "}
          from the table.
        </>
      }
      badge={perPlayer > 0 ? `${formatCents(perPlayer)} each` : "Table Bounty"}
      tone="rose"
      variant={variant}
    >
      <div className="flex justify-center gap-2">
        {[
          { rank: "7", suit: "♦", tone: "text-rose-600" },
          { rank: "2", suit: "♣", tone: "text-slate-800" },
        ].map(({ rank, suit, tone }) => (
          <div
            key={rank}
            className={`flex flex-col items-center justify-center rounded-xl border border-white/70 bg-white/95 shadow-[0_16px_32px_rgba(0,0,0,0.22)] ${
              isDesktop ? "h-14 w-11" : "h-12 w-10"
            }`}
          >
            <span className={`font-black leading-none ${isDesktop ? "text-[17px]" : "text-[15px]"} ${tone}`}>
              {rank}
            </span>
            <span className={`leading-none ${isDesktop ? "text-[13px]" : "text-[11px]"} ${tone}`}>
              {suit}
            </span>
          </div>
        ))}
      </div>
    </AnnouncementBanner>
  );
}

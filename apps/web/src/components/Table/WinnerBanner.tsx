"use client";
import React from "react";
import { formatCents } from "lib/formatCents";
import AnnouncementBanner from "./AnnouncementBanner";

interface WinnerEntry {
  playerId: string;
  amount: number;
  hand: string | null;
}

interface WinnerBannerProps {
  winners: WinnerEntry[];
  players: Array<{ id?: string; name: string; isYou?: boolean } | null>;
  /** "desktop" = ornate shimmer banner, "mobile" = compact inline pill */
  variant?: "desktop" | "mobile";
}

function getPlayerName(
  playerId: string,
  players: Array<{ id?: string; name: string } | null>,
): string {
  return players.find((pl) => pl?.id === playerId)?.name ?? "?";
}

function formatWinnerText(
  winners: WinnerEntry[],
  players: Array<{ id?: string; name: string } | null>,
): string {
  return winners
    .map((w) => {
      const handText = w.hand ? ` ${w.hand}` : "";
      return `${getPlayerName(w.playerId, players)} ${formatCents(w.amount)}${handText}`;
    })
    .join(" • ");
}

export default function WinnerBanner({ winners, players, variant = "desktop" }: WinnerBannerProps) {
  const total = winners.reduce((sum, winner) => sum + winner.amount, 0);
  const text = formatWinnerText(winners, players);
  const singleWinner = winners.length === 1 ? winners[0] : null;
  const singleWinnerPlayer = singleWinner ? players.find((p) => p?.id === singleWinner.playerId) ?? null : null;
  const isYou = singleWinnerPlayer?.isYou ?? false;

  return (
    <AnnouncementBanner
      eyebrow={winners.length === 1 ? "Pot Awarded" : "Split Pot"}
  title={
        singleWinner
          ? isYou
            ? `You win ${formatCents(singleWinner.amount)}`
            : `${singleWinnerPlayer?.name ?? "?"} wins ${formatCents(singleWinner.amount)}`
          : `${winners.length} players split ${formatCents(total)}`
      }
      detail={singleWinner ? (singleWinner.hand ?? undefined) : text}
      badge={formatCents(total)}
      tone="gold"
      variant={variant}
    />
  );
}

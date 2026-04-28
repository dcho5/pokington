"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TableGeometry } from "lib/seatLayout";
import { formatCents } from "@pokington/shared";
import { computeDesktopBetBeaconLayout } from "lib/desktopBetLayout";

type BetBeaconPlayer = {
  id?: string;
  seatIndex: number;
  currentBet?: number;
  lastAction?: string | null;
  isCurrentActor?: boolean;
  isAllIn?: boolean;
  isYou?: boolean;
};

function getPillColors(player: Omit<BetBeaconPlayer, "seatIndex">) {
  if (player.isAllIn || player.lastAction === "all-in") {
    return {
      background: "rgba(120,53,15,0.94)",
      border: "rgba(253,224,71,0.6)",
      text: "#fef3c7",
      shadow: "0 14px 28px rgba(120,53,15,0.28)",
    };
  }

  if (player.isCurrentActor) {
    return {
      background: "rgba(127,29,29,0.94)",
      border: "rgba(252,165,165,0.68)",
      text: "#fff1f2",
      shadow: "0 14px 28px rgba(127,29,29,0.28)",
    };
  }

  return {
    background: player.isYou ? "rgba(127,29,29,0.92)" : "rgba(15,23,42,0.9)",
    border: player.isYou ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.22)",
    text: "#f8fafc",
    shadow: "0 12px 24px rgba(2,6,23,0.28)",
  };
}

interface BetChipsProps extends BetBeaconPlayer {
  amount: number;
  totalSeats: number;
  geometry: TableGeometry;
  seatSize: number;
  sweepMode?: boolean;
  tableWidth: number;
  tableHeight: number;
  potLeftPct: number;
  potTopPct: number;
}

const BetChips: React.FC<BetChipsProps> = ({
  amount,
  seatIndex,
  totalSeats,
  geometry,
  seatSize,
  sweepMode = false,
  tableWidth,
  tableHeight,
  potLeftPct,
  potTopPct,
  ...player
}) => {
  const layout = computeDesktopBetBeaconLayout({
    seatIndex,
    totalSeats,
    geometry,
    seatSize,
    tableWidth,
    tableHeight,
    potLeftPct,
    potTopPct,
  });
  const colors = getPillColors(player);

  return (
    <motion.div
      className="absolute z-[26] pointer-events-none"
      style={{
        left: `${layout.leftPct}%`,
        top: `${layout.topPct}%`,
        transform: "translate(-50%, -50%)",
      }}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        sweepMode
          ? {
              x: layout.sweepOffsetX,
              y: layout.sweepOffsetY,
              opacity: 0,
              scale: 0.72,
              transition: { duration: 0.42, ease: "easeIn" as const },
            }
          : {
              opacity: 0,
              scale: 0.92,
              transition: { duration: 0.18 },
            }
      }
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      aria-hidden="true"
    >
      <div
        className="inline-flex items-center rounded-full border px-5 py-2 font-black shadow-lg backdrop-blur-md"
        style={{
          minWidth: 108,
          justifyContent: "center",
          background: colors.background,
          borderColor: colors.border,
          color: colors.text,
          boxShadow: `${colors.shadow}, 0 0 0 1px rgba(255,255,255,0.05) inset`,
        }}
      >
        <span
          className="font-mono tabular-nums whitespace-nowrap"
          style={{
            fontSize: 18,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            textShadow: "0 1px 2px rgba(2,6,23,0.7)",
          }}
        >
          {formatCents(amount)}
        </span>
      </div>
    </motion.div>
  );
};

interface BetChipsLayerProps {
  players: Array<BetBeaconPlayer | null | undefined>;
  totalSeats: number;
  geometry: TableGeometry;
  seatSize: number;
  sweepMode?: boolean;
  tableWidth: number;
  tableHeight: number;
  potLeftPct: number;
  potTopPct: number;
}

export const BetChipsLayer: React.FC<BetChipsLayerProps> = ({
  players,
  totalSeats,
  geometry,
  seatSize,
  sweepMode = false,
  tableWidth,
  tableHeight,
  potLeftPct,
  potTopPct,
}) => {
  return (
    <AnimatePresence>
      {players.map((player) => {
        if (!player || !player.id || (player.currentBet ?? 0) === 0) return null;

        return (
          <BetChips
            key={player.id}
            amount={player.currentBet ?? 0}
            seatIndex={player.seatIndex}
            totalSeats={totalSeats}
            geometry={geometry}
            seatSize={seatSize}
            sweepMode={sweepMode}
            tableWidth={tableWidth}
            tableHeight={tableHeight}
            potLeftPct={potLeftPct}
            potTopPct={potTopPct}
            id={player.id}
            currentBet={player.currentBet}
            lastAction={player.lastAction}
            isCurrentActor={player.isCurrentActor}
            isAllIn={player.isAllIn}
            isYou={player.isYou}
          />
        );
      })}
    </AnimatePresence>
  );
};

export default BetChips;

"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { computeSeatCoords, type TableGeometry } from "lib/seatLayout";
import { formatCents } from "lib/formatCents";

// Table aspect ratio: the container is aspect-[21/9], so height = width * (9/21)
// This means 1% of height = (9/21) × 1% of width in screen pixels.
// To achieve equal pixel distance from all seats we must compensate.
const AR_H = 9 / 21;

// How many x-percentage-units to move the chip inward from the seat.
// With AR_H correction this translates to ~96px for a 1200px-wide table.
const CHIP_INSET_W = 8;

// How far (px) chips push in from the seat direction on initial entrance
const PUSH_PX = 16;

function chipPosition(sx: number, sy: number) {
  // Pixel-space magnitude (corrects for aspect ratio so all chips are equidistant)
  const pixMag = Math.hypot(sx, sy * AR_H) || 1;
  return {
    x: sx - CHIP_INSET_W * (sx / pixMag),
    y: sy - CHIP_INSET_W * (sy / pixMag),
    // Unit vector in pixel space (for the push entrance animation)
    dx: sx / pixMag,
    dy: (sy * AR_H) / pixMag,
  };
}

function chipCount(amount: number, bigBlind: number): number {
  if (amount < bigBlind * 3) return 1;
  if (amount < bigBlind * 10) return 2;
  return 3;
}

function Chip({ layer, total }: { layer: number; total: number }) {
  const lightness = layer / Math.max(total - 1, 1);
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        delay: (total - 1 - layer) * 0.055,
        type: "spring",
        stiffness: 480,
        damping: 26,
      }}
      className="absolute left-1/2 -translate-x-1/2 rounded-full"
      style={{
        width: 22,
        height: 22,
        top: (total - 1 - layer) * 4,
        background: `radial-gradient(circle at 38% 32%, ${
          lightness > 0.5 ? "#ef4444" : "#be1c1c"
        } 0%, #7f1d1d 100%)`,
        border: "1.5px solid rgba(255,255,255,0.22)",
        boxShadow:
          layer === total - 1
            ? "0 3px 8px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.15)"
            : "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          inset: 3,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.08), transparent)",
        }}
      />
    </motion.div>
  );
}

interface BetChipsProps {
  playerId: string;
  amount: number;
  seatIndex: number;
  totalSeats: number;
  geometry: TableGeometry;
  bigBlind?: number;
  sweepMode?: boolean;
}

const BetChips: React.FC<BetChipsProps> = ({
  amount,
  seatIndex,
  totalSeats,
  geometry,
  bigBlind = 25,
  sweepMode = false,
}) => {
  const { x: sx, y: sy } = computeSeatCoords(seatIndex, totalSeats, geometry);
  const { x: bx, y: by, dx, dy } = chipPosition(sx, sy);

  const chips = chipCount(amount, bigBlind);
  const stackHeight = 22 + (chips - 1) * 4;

  // Sweep exit: chips fly toward pot (center), otherwise subtle inward fade
  const exitVariant = sweepMode
    ? { x: -dx * 180, y: -dy * 180, scale: 0, opacity: 0, transition: { duration: 0.45, ease: "easeIn" as const } }
    : { x: -dx * 14, y: -dy * 14, scale: 0, opacity: 0, transition: { duration: 0.25 } };

  return (
    <motion.div
      className="absolute z-20 flex flex-col items-center pointer-events-none"
      style={{
        left: `calc(50% + ${bx.toFixed(3)}%)`,
        top: `calc(50% + ${by.toFixed(3)}%)`,
        transform: "translate(-50%, -50%)",
      }}
      initial={{ x: dx * PUSH_PX, y: dy * PUSH_PX, opacity: 0, scale: 0.65 }}
      animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      exit={exitVariant}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
    >
      <div className="relative" style={{ width: 22, height: stackHeight }}>
        {Array.from({ length: chips }, (_, i) => (
          <Chip key={i} layer={i} total={chips} />
        ))}
      </div>

      <motion.span
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: chips * 0.055 + 0.06, type: "spring", stiffness: 400, damping: 25 }}
        className="mt-1 text-[10px] font-mono font-black whitespace-nowrap px-2 py-[3px] rounded-full"
        style={{
          background: "rgba(0,0,0,0.65)",
          color: "#fde68a",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        }}
      >
        {formatCents(amount)}
      </motion.span>
    </motion.div>
  );
};

interface BetChipsLayerProps {
  players: Array<{ id?: string; seatIndex: number; currentBet?: number } | null | undefined>;
  totalSeats: number;
  geometry: TableGeometry;
  bigBlind?: number;
  sweepMode?: boolean;
}

export const BetChipsLayer: React.FC<BetChipsLayerProps> = ({
  players,
  totalSeats,
  geometry,
  bigBlind,
  sweepMode = false,
}) => {
  return (
    <AnimatePresence>
      {players.map((p) => {
        if (!p || !p.id || (p.currentBet ?? 0) === 0) return null;
        return (
          <BetChips
            key={p.id}
            playerId={p.id}
            amount={p.currentBet!}
            seatIndex={p.seatIndex}
            totalSeats={totalSeats}
            geometry={geometry}
            bigBlind={bigBlind}
            sweepMode={sweepMode}
          />
        );
      })}
    </AnimatePresence>
  );
};

export default BetChips;

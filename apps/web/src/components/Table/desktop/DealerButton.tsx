"use client";
import React from "react";
import { motion } from "framer-motion";
import { computeSeatCoords, type TableGeometry } from "lib/seatLayout";

interface DealerButtonProps {
  seatIndex: number;
  totalSeats: number;
  geometry: TableGeometry;
}

const DealerButton: React.FC<DealerButtonProps> = ({ seatIndex, totalSeats, geometry }) => {
  const { x, y } = computeSeatCoords(seatIndex, totalSeats, geometry);
  const orbitFactor = 0.82;

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
      initial={false}
      animate={{
        left: `calc(50% + ${(x * orbitFactor).toFixed(3)}%)`,
        top: `calc(50% + ${(y * orbitFactor).toFixed(3)}%)`,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)] flex items-center justify-center">
        <span className="text-[10px] font-black text-red-600">D</span>
      </div>
    </motion.div>
  );
};

export default DealerButton;

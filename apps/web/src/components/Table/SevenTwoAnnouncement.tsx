"use client";
import React from "react";
import { motion } from "framer-motion";
import { formatCents } from "lib/formatCents";

interface SevenTwoAnnouncementProps {
  winnerName: string;
  perPlayer: number;
  total: number;
  variant?: "desktop" | "mobile";
}

const PARTICLES = [
  { emoji: "💰", x: -55, delay: 0.10 },
  { emoji: "💸", x:  50, delay: 0.22 },
  { emoji: "🃏", x: -25, delay: 0.38 },
  { emoji: "💰", x:  70, delay: 0.05 },
  { emoji: "✨", x: -70, delay: 0.30 },
];

export default function SevenTwoAnnouncement({
  winnerName,
  perPlayer,
  total,
  variant = "desktop",
}: SevenTwoAnnouncementProps) {
  const isDesktop = variant === "desktop";

  return (
    // Outer wrapper: entrance animation, no overflow-hidden (lets particles escape)
    <motion.div
      className="relative"
      initial={{ opacity: 0, scale: 0.15, y: 40, rotate: -10 }}
      animate={{ opacity: 1, scale: [0.15, 1.4, 0.82, 1.1, 1], y: 0, rotate: [-10, 6, -4, 2, 0] }}
      exit={{ opacity: 0, scale: 0.75, y: -24 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
    >
      {/* Pulsing ambient glow ring — large spread illuminates surrounding screen */}
      <motion.div
        className="absolute -inset-2 rounded-3xl pointer-events-none"
        animate={{
          boxShadow: [
            "0 0 40px 8px rgba(239,68,68,0.4)",
            "0 0 120px 40px rgba(239,68,68,0.75), 0 0 220px 80px rgba(239,68,68,0.25)",
            "0 0 40px 8px rgba(239,68,68,0.4)",
          ],
        }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      />

      {/* Inner content box — overflow-hidden for shimmer clipping */}
      <div
        className={`relative overflow-hidden rounded-2xl text-center select-none ${
          isDesktop ? "px-10 py-5 min-w-[340px]" : "px-6 py-4 min-w-[280px]"
        }`}
        style={{
          background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 45%, #be185d 100%)",
          border: "1px solid rgba(252,165,165,0.3)",
        }}
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 pointer-events-none animate-shimmer"
          style={{
            background:
              "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
            backgroundSize: "200% 100%",
          }}
        />

        {/* BOUNTY COLLECTED label */}
        <div
          className={`relative font-black uppercase tracking-[0.3em] mb-2 ${
            isDesktop ? "text-[10px]" : "text-[9px]"
          }`}
          style={{ color: "rgba(252,165,165,0.7)" }}
        >
          Bounty Collected
        </div>

        {/* Card pair: 7♦ and 2♣ */}
        <div className="relative flex justify-center gap-2 mb-3">
          {[
            { rank: "7", suit: "♦", suitColor: "#f87171" },
            { rank: "2", suit: "♣", suitColor: "rgba(255,255,255,0.9)" },
          ].map(({ rank, suit, suitColor }) => (
            <div
              key={rank}
              className={`flex flex-col items-center justify-center rounded-lg shadow-xl ${
                isDesktop ? "w-9 h-12" : "w-8 h-11"
              }`}
              style={{ background: "rgba(255,255,255,0.95)" }}
            >
              <span
                className="font-black leading-none"
                style={{
                  fontSize: isDesktop ? 16 : 14,
                  color: suitColor === "rgba(255,255,255,0.9)" ? "#1f2937" : "#dc2626",
                }}
              >
                {rank}
              </span>
              <span
                className="leading-none"
                style={{
                  fontSize: isDesktop ? 13 : 11,
                  color: suitColor === "rgba(255,255,255,0.9)" ? "#1f2937" : "#dc2626",
                }}
              >
                {suit}
              </span>
            </div>
          ))}
        </div>

        {/* Headline */}
        <div
          className={`relative font-black text-center ${isDesktop ? "text-xl" : "text-lg"}`}
          style={{ color: "#fde68a" }}
        >
          💸 7-2 Offsuit! 💸
        </div>

        {/* Winner + total */}
        <div
          className={`relative font-bold mt-1 ${isDesktop ? "text-sm" : "text-xs"}`}
          style={{ color: "rgba(255,255,255,0.95)" }}
        >
          {winnerName} collects{" "}
          <span className="font-black" style={{ color: "#fde68a" }}>
            {formatCents(total)}
          </span>{" "}
          from the table!
        </div>

        {perPlayer > 0 && (
          <div
            className={`relative mt-1 ${isDesktop ? "text-xs" : "text-[10px]"}`}
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {formatCents(perPlayer)} per player
          </div>
        )}
      </div>

      {/* Floating particles — escape the overflow-hidden box */}
      {PARTICLES.map(({ emoji, x, delay }) => (
        <motion.div
          key={`${emoji}-${delay}`}
          className="absolute top-0 left-1/2 text-xl pointer-events-none select-none"
          style={{ translateX: "-50%" }}
          initial={{ opacity: 0, y: 0, x, scale: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: -90, x, scale: [0, 1.5, 1, 0.6] }}
          transition={{ delay, duration: 1.4, ease: "easeOut" }}
        >
          {emoji}
        </motion.div>
      ))}
    </motion.div>
  );
}

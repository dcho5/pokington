"use client";
import React from "react";
import type { Card as CardType } from "@pokington/shared";

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

function displayRank(rank: string): string {
  return rank === "T" ? "10" : rank;
}

function isRed(suit: string): boolean {
  return suit === "hearts" || suit === "diamonds";
}

interface CardProps {
  card?: CardType;
  className?: string;
  style?: React.CSSProperties;
  emphasis?: "neutral" | "highlighted" | "dimmed";
  size?: "default" | "compact";
}

function emphasisClassName(emphasis: CardProps["emphasis"]): string {
  if (emphasis === "highlighted") {
    return "";
  }
  if (emphasis === "dimmed") {
    return "opacity-45 saturate-[0.72] brightness-[0.92]";
  }
  return "";
}

const CARD_SIZE_CLASSES = {
  default: {
    facePadding: "p-1.5",
    corner: "gap-0.5 text-sm",
    center: "text-2xl",
    backInset: "inset-[4px] rounded-[8px]",
  },
  compact: {
    facePadding: "p-1",
    corner: "gap-px text-[10px]",
    center: "text-[18px]",
    backInset: "inset-[3px] rounded-[6px]",
  },
} as const;

const Card: React.FC<CardProps> = ({
  card,
  className = "",
  style,
  emphasis = "neutral",
  size = "default",
}) => {
  const emphasisClasses = emphasisClassName(emphasis);
  const metrics = CARD_SIZE_CLASSES[size];
  if (!card) {
    // Face-down back — white card frame with dark blue gradient inner
    return (
      <div
        className={`relative bg-white overflow-hidden transition-[opacity,filter,transform,box-shadow] duration-200 ${emphasisClasses} ${className}`}
        style={style}
      >
        {/* Inner back area */}
        <div
          className={`absolute overflow-hidden ${metrics.backInset}`}
          style={{
            background: "linear-gradient(145deg, #1e3a5f 0%, #0f2040 50%, #1a3356 100%)",
          }}
        >
          {/* Crosshatch grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 10px), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 10px)",
            }}
          />
          {/* Diagonal overlay for depth */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 14px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 14px)",
            }}
          />
        </div>
      </div>
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit];
  const rank = displayRank(card.rank);
  const red = isRed(card.suit);

  return (
    <div
      className={`card-face relative flex flex-col justify-between transition-[opacity,filter,transform,box-shadow] duration-200 ${metrics.facePadding} ${red ? "red" : ""} ${emphasisClasses} ${className}`}
      style={style}
    >
      {/* Top-left: rank + suit */}
      <div className={`flex items-center leading-none font-bold ${metrics.corner}`}>
        <span>{rank}</span>
        <span>{symbol}</span>
      </div>

      {/* Center suit */}
      <div className={`flex flex-1 items-center justify-center leading-none ${metrics.center}`}>
        {symbol}
      </div>

      {/* Bottom-right: rotated 180° */}
      <div className={`flex items-center leading-none font-bold self-end rotate-180 ${metrics.corner}`}>
        <span>{rank}</span>
        <span>{symbol}</span>
      </div>
    </div>
  );
};

export default Card;

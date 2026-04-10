"use client";
import React, { useRef, useState, useEffect } from "react";
import Card from "components/poker/Card";
import type { Card as CardType } from "@pokington/shared";

/**
 * PeelCard — zero JS-framework overhead during drag.
 *
 * Instead of Framer Motion useMotionValue → useTransform (which runs JS on every
 * pointer event and forces a React render pipeline), we mutate DOM styles directly
 * via refs. CSS transitions are only enabled during the snap phase, so the GPU
 * handles the spring. This is the only reliable way to get 60 fps on iOS Safari.
 *
 * Visual: back face scaleY 1→0 (collapses upward from bottom),
 *         front face scaleY 0→1 (grows upward from bottom).
 *         transform-origin: bottom — so the card appears to peel from the bottom up.
 *
 * Three states:
 *   face-down → peeked (private) → revealed (public, shown to others)
 * When canRevealToOthers is true and card is face-up, tapping reveals to others.
 */
function PeelCard({
  card,
  height,
  autoReveal,
  onRevealChange,
  canRevealToOthers,
  isRevealedToOthers,
  onRevealToOthers,
  sevenTwoEligible,
  onPeekCard,
}: {
  card?: CardType;
  height: number;
  autoReveal?: boolean;
  onRevealChange?: (revealed: boolean) => void;
  canRevealToOthers?: boolean;
  isRevealedToOthers?: boolean;
  onRevealToOthers?: () => void;
  sevenTwoEligible?: boolean;
  onPeekCard?: () => void;
}) {
  const width = Math.round((height * 5) / 7);

  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const revealHintRef = useRef<HTMLDivElement>(null);
  const revealGlowRef = useRef<HTMLDivElement>(null);

  // All mutable state lives in refs — no React re-renders during drag.
  const progressRef = useRef(0);       // 0 = face-down, 1 = face-up
  const startYRef = useRef(0);
  const startProgressRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const hasRevealedRef = useRef(false); // ratchet — never fire onRevealChange twice

  /** Apply progress to DOM directly. withTransition=false during drag, true for snap. */
  function applyProgress(p: number, withTransition: boolean) {
    progressRef.current = p;
    const tr = withTransition
      ? "transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)"
      : "none";
    if (backRef.current) {
      backRef.current.style.transition = tr;
      backRef.current.style.transform = `scaleY(${1 - p})`;
    }
    if (frontRef.current) {
      frontRef.current.style.transition = tr;
      frontRef.current.style.transform = `scaleY(${p})`;
    }
    if (hintRef.current) {
      hintRef.current.style.opacity = p > 0.12 ? "0" : String(1 - p / 0.12);
    }
    if (revealHintRef.current) {
      // Show "tap to show" hint when face-up, can reveal, not yet revealed
      revealHintRef.current.style.opacity = (p >= 0.95 && !isRevealedToOthers) ? "1" : "0";
    }
  }

  function snapTo(target: number) {
    applyProgress(target, true);
    if (target === 1 && !hasRevealedRef.current) {
      hasRevealedRef.current = true;
      onRevealChange?.(true);
      onPeekCard?.();
    }
  }

  // Auto-reveal when prop flips on
  useEffect(() => {
    if (autoReveal) snapTo(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReveal]);

  // Keep reveal hint in sync with isRevealedToOthers prop changes
  useEffect(() => {
    if (revealHintRef.current) {
      revealHintRef.current.style.opacity =
        (progressRef.current >= 0.95 && !isRevealedToOthers) ? "1" : "0";
    }
    if (revealGlowRef.current) {
      revealGlowRef.current.style.opacity = isRevealedToOthers ? "1" : "0";
    }
  }, [isRevealedToOthers]);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startProgressRef.current = progressRef.current;
    dragDistanceRef.current = 0;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDraggingRef.current) return;
    const dy = startYRef.current - e.clientY; // positive = dragged up
    dragDistanceRef.current = Math.abs(dy);
    const delta = dy / (height * 0.85);
    const next = Math.max(0, Math.min(1, startProgressRef.current + delta));
    applyProgress(next, false);

    // Auto-snap once past 50%
    if (next >= 0.5 && startProgressRef.current < 0.5) {
      isDraggingRef.current = false;
      snapTo(1);
    }
  }

  function onPointerUp() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const wasTap = dragDistanceRef.current < 6;
    dragDistanceRef.current = 0;

    // Tap on a face-up card when reveal is available → reveal to others
    if (wasTap && progressRef.current >= 0.95 && canRevealToOthers && !isRevealedToOthers) {
      onRevealToOthers?.();
      return;
    }

    snapTo(progressRef.current > 0.4 ? 1 : 0);
  }

  const showBountyGlow = sevenTwoEligible && canRevealToOthers && !isRevealedToOthers;

  return (
    <div style={{ width, height, position: "relative", flexShrink: 0 }} className="rounded-xl shadow-2xl">
      {/* 7-2 bounty glow — pulsing gold ring encouraging reveal */}
      {showBountyGlow && (
        <div
          className="absolute inset-[-3px] rounded-xl pointer-events-none z-20"
          style={{
            boxShadow: "0 0 0 2px rgba(234,179,8,0.9), 0 0 18px rgba(234,179,8,0.6), 0 0 40px rgba(234,179,8,0.25)",
            animation: "bounty-glow-pulse 1.2s ease-in-out infinite",
          }}
        />
      )}

      {/* "Can reveal" subtle glow ring — at showdown with reveal available */}
      {canRevealToOthers && !isRevealedToOthers && !showBountyGlow && (
        <div
          className="absolute inset-[-2px] rounded-xl pointer-events-none z-20"
          style={{
            boxShadow: "0 0 0 1.5px rgba(99,102,241,0.6), 0 0 10px rgba(99,102,241,0.25)",
            animation: "reveal-hint-pulse 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Revealed-to-others glow ring */}
      <div
        ref={revealGlowRef}
        className="absolute inset-[-2px] rounded-xl pointer-events-none z-20 transition-opacity duration-300"
        style={{
          opacity: isRevealedToOthers ? 1 : 0,
          boxShadow: "0 0 0 2px rgba(34,197,94,0.9), 0 0 12px rgba(34,197,94,0.5)",
        }}
      />

      <div
        className="absolute inset-0 rounded-xl overflow-hidden touch-none select-none cursor-pointer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Back face — collapses toward bottom as card is revealed */}
        <div
          ref={backRef}
          className="absolute inset-0"
          style={{ transformOrigin: "50% 100%", willChange: "transform" }}
        >
          <Card className="w-full h-full rounded-xl" />
        </div>

        {/* Front face — grows up from bottom as card is revealed */}
        <div
          ref={frontRef}
          className="absolute inset-0"
          style={{ transform: "scaleY(0)", transformOrigin: "50% 100%", willChange: "transform" }}
        >
          <Card card={card} className="w-full h-full rounded-xl" />
        </div>
      </div>

      {/* Peek hint — fades out as drag begins */}
      <div
        ref={hintRef}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none z-10 transition-none"
      >
        <span className="text-[9px] text-white/60 font-bold tracking-widest uppercase">
          peek ↑
        </span>
      </div>

      {/* "Tap to show" / "Tap to claim" hint — appears when face-up and reveal is available */}
      {canRevealToOthers && !isRevealedToOthers && (
        <div
          ref={revealHintRef}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none z-10 transition-opacity duration-200"
          style={{ opacity: 0 }}
        >
          <span className={`text-[8px] font-black tracking-widest uppercase whitespace-nowrap ${
            sevenTwoEligible ? "text-yellow-400" : "text-green-400/90"
          }`}>
            {sevenTwoEligible ? "claim bounty" : "tap to show"}
          </span>
        </div>
      )}
    </div>
  );
}

interface HoleCardsProps {
  cards?: [CardType, CardType] | null;
  /** Card height in px. Width is derived at 5:7 ratio. */
  cardHeight?: number;
  className?: string;
  onRevealChange?: (bothRevealed: boolean) => void;
  autoReveal?: boolean;
  /** When true (at showdown), tapping a face-up card reveals it to others */
  canRevealToOthers?: boolean;
  /** Which card indices have already been revealed to others */
  revealedToOthersIndices?: Set<0 | 1>;
  /** Called when player taps a face-up card to reveal it to others */
  onRevealToOthers?: (index: 0 | 1) => void;
  /** True when player holds 7-2 offsuit and can claim bounty by revealing */
  sevenTwoEligible?: boolean;
  /** Called when player peeks at a card (card fully revealed locally) */
  onPeekCard?: (index: 0 | 1) => void;
}

const HoleCards: React.FC<HoleCardsProps> = ({
  cards,
  cardHeight = 150,
  className = "",
  onRevealChange,
  autoReveal = false,
  canRevealToOthers = false,
  revealedToOthersIndices,
  onRevealToOthers,
  sevenTwoEligible = false,
  onPeekCard,
}) => {
  const [card0Revealed, setCard0Revealed] = useState(false);
  const [card1Revealed, setCard1Revealed] = useState(false);

  // Ratchet — once seen, stays seen
  const handleCard0Reveal = (r: boolean) => { if (r) setCard0Revealed(true); };
  const handleCard1Reveal = (r: boolean) => { if (r) setCard1Revealed(true); };

  useEffect(() => {
    onRevealChange?.(card0Revealed && card1Revealed);
  }, [card0Revealed, card1Revealed, onRevealChange]);

  return (
    <div className={`flex items-end justify-center gap-2.5 ${className}`}>
      <div className="animate-card-deal-in" style={{ animationDelay: "0s" }}>
        <PeelCard
          card={cards?.[0]}
          height={cardHeight}
          autoReveal={autoReveal}
          onRevealChange={handleCard0Reveal}
          canRevealToOthers={canRevealToOthers}
          isRevealedToOthers={revealedToOthersIndices?.has(0) ?? false}
          onRevealToOthers={() => onRevealToOthers?.(0)}
          sevenTwoEligible={sevenTwoEligible}
          onPeekCard={() => onPeekCard?.(0)}
        />
      </div>
      <div className="animate-card-deal-in" style={{ animationDelay: "0.1s" }}>
        <PeelCard
          card={cards?.[1]}
          height={cardHeight}
          autoReveal={autoReveal}
          onRevealChange={handleCard1Reveal}
          canRevealToOthers={canRevealToOthers}
          isRevealedToOthers={revealedToOthersIndices?.has(1) ?? false}
          onRevealToOthers={() => onRevealToOthers?.(1)}
          sevenTwoEligible={sevenTwoEligible}
          onPeekCard={() => onPeekCard?.(1)}
        />
      </div>
    </div>
  );
};

export default HoleCards;

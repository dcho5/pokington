"use client";
import React, { useRef, useState, useEffect } from "react";
import Card from "./Card";
import type { CardDisplaySize } from "./Card";
import {
  canStartPublicReveal,
  createInitialPeelCardState,
  getInitialPrivateRevealState,
  writePersistedPeelState,
} from "../../../lib/holeCardReveal";
import type { Card as CardType } from "@pokington/shared";

const HOLD_TO_REVEAL_MS = 550;
const HOLD_CANCEL_DISTANCE_PX = 14;

function RevealSignalIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path
        d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

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
 * Normally public reveal starts from a face-up card. During a 7-2 claim window we
 * also allow a single hold to both flip and show so the bounty isn't gated on an
 * extra private-peek gesture.
 */
function PeelCard({
  card,
  height,
  revealed = false,
  emphasis = "neutral",
  autoReveal,
  onRevealChange,
  canRevealToOthers,
  isRevealedToOthers,
  onRevealToOthers,
  sevenTwoEligible,
  onPeekCard,
  cardSize = "default",
}: {
  card?: CardType;
  height: number;
  revealed?: boolean;
  emphasis?: "neutral" | "highlighted" | "dimmed";
  autoReveal?: boolean;
  onRevealChange?: (revealed: boolean) => void;
  canRevealToOthers?: boolean;
  isRevealedToOthers?: boolean;
  onRevealToOthers?: () => void;
  sevenTwoEligible?: boolean;
  onPeekCard?: () => void;
  cardSize?: CardDisplaySize;
}) {
  const width = Math.round((height * 5) / 7);
  const initialPeelCardState = createInitialPeelCardState({ revealed });
  const initialProgress = initialPeelCardState.initialProgress;

  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const revealFillRef = useRef<HTMLDivElement>(null);
  const revealCenterIconRef = useRef<HTMLDivElement>(null);

  // All mutable state lives in refs — no React re-renders during drag.
  const progressRef = useRef(initialProgress);       // 0 = face-down, 1 = face-up
  const startYRef = useRef(0);
  const startProgressRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const hasRevealedRef = useRef(initialPeelCardState.hasRevealed); // ratchet — never fire onRevealChange twice
  const hasPeekedEnoughRef = useRef(initialPeelCardState.hasPeekedEnough); // ratchet — report the first peek even if the card starts open
  const holdStartRef = useRef(0);
  const holdStartXRef = useRef(0);
  const holdStartYRef = useRef(0);
  const holdAnimationFrameRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);

  const canArmReveal = canStartPublicReveal({
    isPrivatelyRevealed: revealed,
    canRevealToOthers,
    isRevealedToOthers,
    sevenTwoEligible,
  });

  function updatePeekedEnough(p: number) {
    if (p <= 0 || hasPeekedEnoughRef.current) return;
    hasPeekedEnoughRef.current = true;
    onPeekCard?.();
  }

  function setRevealProgress(progress: number, visible: boolean) {
    if (revealFillRef.current) {
      revealFillRef.current.style.opacity = visible ? "1" : "0";
      revealFillRef.current.style.transform = `scaleY(${progress})`;
    }
    if (revealCenterIconRef.current) {
      const centerOpacity = visible && progress >= 0.5 ? Math.min(1, (progress - 0.5) / 0.2) : 0;
      revealCenterIconRef.current.style.opacity = String(centerOpacity);
      revealCenterIconRef.current.style.transform = `translate(-50%, -50%) scale(${0.92 + centerOpacity * 0.08})`;
    }
  }

  function clearHoldAnimation() {
    if (holdAnimationFrameRef.current != null) {
      window.cancelAnimationFrame(holdAnimationFrameRef.current);
      holdAnimationFrameRef.current = null;
    }
  }

  function cancelRevealHold() {
    holdActiveRef.current = false;
    clearHoldAnimation();
    setRevealProgress(0, false);
  }

  function finishRevealHold() {
    holdActiveRef.current = false;
    clearHoldAnimation();
    setRevealProgress(1, true);
    snapTo(1);
    onRevealToOthers?.();
  }

  function tickRevealHold(now: number) {
    if (!holdActiveRef.current) return;
    const elapsed = now - holdStartRef.current;
    const progress = Math.min(1, elapsed / HOLD_TO_REVEAL_MS);
    setRevealProgress(progress, true);
    if (progress >= 1) {
      finishRevealHold();
      return;
    }
    holdAnimationFrameRef.current = window.requestAnimationFrame(tickRevealHold);
  }

  /** Apply progress to DOM directly. withTransition=false during drag, true for snap. */
  function applyProgress(p: number, withTransition: boolean) {
    progressRef.current = p;
    updatePeekedEnough(p);
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
  }

  function snapTo(target: number) {
    applyProgress(target, true);
    if (target === 1 && !hasRevealedRef.current) {
      hasRevealedRef.current = true;
      onRevealChange?.(true);
    }
  }

  useEffect(() => {
    cancelRevealHold();
    if (revealed) {
      snapTo(1);
      return;
    }
    hasRevealedRef.current = false;
    hasPeekedEnoughRef.current = false;
    applyProgress(0, false);
  }, [revealed]);

  // Auto-reveal when prop flips on
  useEffect(() => {
    if (autoReveal) snapTo(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReveal]);

  // Cancel any in-progress hold if the server has already made this card public.
  useEffect(() => {
    if (isRevealedToOthers) {
      cancelRevealHold();
    }
  }, [isRevealedToOthers]);

  useEffect(() => () => clearHoldAnimation(), []);

  function onPointerDown(e: React.PointerEvent) {
    if (canArmReveal) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      holdActiveRef.current = true;
      holdStartRef.current = performance.now();
      holdStartXRef.current = e.clientX;
      holdStartYRef.current = e.clientY;
      setRevealProgress(0, true);
      holdAnimationFrameRef.current = window.requestAnimationFrame(tickRevealHold);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startProgressRef.current = progressRef.current;
    dragDistanceRef.current = 0;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (holdActiveRef.current) {
      const dx = e.clientX - holdStartXRef.current;
      const dy = e.clientY - holdStartYRef.current;
      if (Math.hypot(dx, dy) > HOLD_CANCEL_DISTANCE_PX) {
        cancelRevealHold();
      }
      return;
    }
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
    if (holdActiveRef.current) {
      cancelRevealHold();
      return;
    }
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    dragDistanceRef.current = 0;

    snapTo(progressRef.current > 0.4 ? 1 : 0);
  }

  return (
    <div
      style={{ width, height, position: "relative", flexShrink: 0 }}
      className="rounded-xl shadow-2xl"
    >
      <div
        className="absolute inset-[-2px] rounded-xl pointer-events-none z-20 transition-opacity duration-300"
        style={{
          opacity: isRevealedToOthers ? 1 : 0,
          boxShadow: "0 0 0 2px rgba(248,113,113,0.88), 0 0 12px rgba(239,68,68,0.38)",
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
          style={{ transform: `scaleY(${1 - initialProgress})`, transformOrigin: "50% 100%", willChange: "transform" }}
        >
          <Card size={cardSize} className="w-full h-full rounded-xl" />
        </div>

        {/* Front face — grows up from bottom as card is revealed */}
        <div
          ref={frontRef}
          className="absolute inset-0"
          style={{ transform: `scaleY(${initialProgress})`, transformOrigin: "50% 100%", willChange: "transform" }}
        >
          <Card card={card} emphasis={emphasis} size={cardSize} className="w-full h-full rounded-xl" />
        </div>

        {canArmReveal && (
          <>
            <div
              ref={revealFillRef}
              className="absolute inset-0 rounded-xl pointer-events-none z-10"
              style={{
                opacity: 0,
                transform: "scaleY(0)",
                transformOrigin: "50% 100%",
                willChange: "transform, opacity",
                background: "linear-gradient(180deg, rgba(96,165,250,0.12) 0%, rgba(59,130,246,0.3) 55%, rgba(37,99,235,0.82) 100%)",
                boxShadow: "inset 0 0 30px rgba(59,130,246,0.4), inset 0 -10px 28px rgba(96,165,250,0.45)",
              }}
            />
            <div
              ref={revealCenterIconRef}
              className="absolute left-1/2 top-1/2 pointer-events-none z-20 transition-opacity duration-150"
              style={{
                opacity: 0,
                transform: "translate(-50%, -50%) scale(0.92)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: Math.max(26, Math.round(width * 0.34)),
                  height: Math.max(26, Math.round(width * 0.34)),
                  background: "rgba(8,15,24,0.76)",
                  boxShadow: "0 0 18px rgba(96,165,250,0.35)",
                }}
              >
                <RevealSignalIcon className="text-blue-100" style={{ width: 18, height: 18 }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Peek hint — fades out as drag begins */}
      <div
        ref={hintRef}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none z-10 transition-none"
        style={{ opacity: initialProgress > 0.12 ? 0 : 1 - initialProgress / 0.12 }}
      >
        <span className="text-[9px] text-white/60 font-bold tracking-widest uppercase">
          peek ↑
        </span>
      </div>
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
  /** When true, holding a face-up card reveals it to others */
  canRevealToOthers?: boolean;
  /** Which card indices have already been revealed to others */
  revealedToOthersIndices?: Set<0 | 1>;
  /** Called when player holds a face-up card long enough to reveal it to others */
  onRevealToOthers?: (index: 0 | 1) => void;
  /** True when player holds 7-2 offsuit and can claim bounty by revealing */
  sevenTwoEligible?: boolean;
  /** Called when player peels a card far enough that rank+suit are identifiable */
  onPeekCard?: (index: 0 | 1) => void;
  /** Storage key used to restore peel progress after leaving and returning */
  persistenceKey?: string | null;
  emphasisByIndex?: Array<"neutral" | "highlighted" | "dimmed">;
  cardSize?: CardDisplaySize;
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
  persistenceKey,
  emphasisByIndex = ["neutral", "neutral"],
  cardSize = "default",
}) => {
  const resolveInitialRevealState = (): [boolean, boolean] => {
    const [card0, card1] = getInitialPrivateRevealState({ persistenceKey, autoReveal });
    return [card0, card1];
  };
  const [revealedCards, setRevealedCards] = useState<[boolean, boolean]>(() =>
    resolveInitialRevealState()
  );
  const [card0Revealed, card1Revealed] = revealedCards;
  const lastPersistenceKeyRef = useRef<string | null | undefined>(persistenceKey);

  useEffect(() => {
    if (lastPersistenceKeyRef.current === persistenceKey) return;
    lastPersistenceKeyRef.current = persistenceKey;
    setRevealedCards(resolveInitialRevealState());
  }, [autoReveal, persistenceKey]);

  useEffect(() => {
    if (!autoReveal) return;
    setRevealedCards((current) => (current[0] && current[1] ? current : [true, true]));
  }, [autoReveal]);

  function markCardRevealed(index: 0 | 1, nextValue: boolean) {
    if (!nextValue) return;
    setRevealedCards((current) => {
      if (current[index]) return current;
      return index === 0 ? [true, current[1]] : [current[0], true];
    });
  }

  useEffect(() => {
    writePersistedPeelState(persistenceKey, revealedCards);
  }, [revealedCards, persistenceKey]);

  useEffect(() => {
    onRevealChange?.(card0Revealed && card1Revealed);
  }, [card0Revealed, card1Revealed, onRevealChange]);

  return (
    <div className={`flex items-end justify-center gap-2.5 ${className}`}>
      <div className="animate-card-deal-in" style={{ animationDelay: "0s" }}>
        <PeelCard
          card={cards?.[0]}
          height={cardHeight}
          revealed={card0Revealed}
          emphasis={emphasisByIndex[0] ?? "neutral"}
          autoReveal={autoReveal}
          onRevealChange={(nextValue) => markCardRevealed(0, nextValue)}
          canRevealToOthers={canRevealToOthers}
          isRevealedToOthers={revealedToOthersIndices?.has(0) ?? false}
          onRevealToOthers={() => onRevealToOthers?.(0)}
          sevenTwoEligible={sevenTwoEligible}
          onPeekCard={() => onPeekCard?.(0)}
          cardSize={cardSize}
        />
      </div>
      <div className="animate-card-deal-in" style={{ animationDelay: "0.1s" }}>
        <PeelCard
          card={cards?.[1]}
          height={cardHeight}
          revealed={card1Revealed}
          emphasis={emphasisByIndex[1] ?? "neutral"}
          autoReveal={autoReveal}
          onRevealChange={(nextValue) => markCardRevealed(1, nextValue)}
          canRevealToOthers={canRevealToOthers}
          isRevealedToOthers={revealedToOthersIndices?.has(1) ?? false}
          onRevealToOthers={() => onRevealToOthers?.(1)}
          sevenTwoEligible={sevenTwoEligible}
          onPeekCard={() => onPeekCard?.(1)}
          cardSize={cardSize}
        />
      </div>
    </div>
  );
};

export default HoleCards;

"use client";
import React, { useRef, useState, useEffect } from "react";
import Card from "components/poker/Card";
import type { Card as CardType } from "@pokington/shared";

const PEEL_STORAGE_PREFIX = "pokington_card_peel_state:";
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

function readPersistedPeelState(persistenceKey?: string | null): [boolean, boolean] | null {
  if (!persistenceKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${PEEL_STORAGE_PREFIX}${persistenceKey}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "boolean" &&
      typeof parsed[1] === "boolean"
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // Ignore malformed persisted state and fall back to fresh peel state.
  }
  return null;
}

function writePersistedPeelState(
  persistenceKey: string | null | undefined,
  revealed: [boolean, boolean],
) {
  if (!persistenceKey || typeof window === "undefined") return;
  const storageKey = `${PEEL_STORAGE_PREFIX}${persistenceKey}`;
  try {
    if (!revealed[0] && !revealed[1]) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(revealed));
  } catch {
    // Ignore storage failures; peel state still works for the current mount.
  }
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
 * Once the card is already face-up, press-and-hold the card itself to reveal it
 * publicly. Desktop and mobile intentionally share the exact same interaction.
 */
function PeelCard({
  card,
  height,
  revealed = false,
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
  revealed?: boolean;
  autoReveal?: boolean;
  onRevealChange?: (revealed: boolean) => void;
  canRevealToOthers?: boolean;
  isRevealedToOthers?: boolean;
  onRevealToOthers?: () => void;
  sevenTwoEligible?: boolean;
  onPeekCard?: () => void;
}) {
  const width = Math.round((height * 5) / 7);
  const initialProgress = revealed ? 1 : 0;

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
  const hasRevealedRef = useRef(revealed); // ratchet — never fire onRevealChange twice
  const hasPeekedEnoughRef = useRef(revealed); // ratchet — never fire onPeekCard twice
  const holdStartRef = useRef(0);
  const holdStartXRef = useRef(0);
  const holdStartYRef = useRef(0);
  const holdAnimationFrameRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);

  const canArmReveal = revealed && canRevealToOthers && !isRevealedToOthers;

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
          boxShadow: "0 0 0 2px rgba(34,197,94,0.85), 0 0 12px rgba(34,197,94,0.35)",
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
          <Card className="w-full h-full rounded-xl" />
        </div>

        {/* Front face — grows up from bottom as card is revealed */}
        <div
          ref={frontRef}
          className="absolute inset-0"
          style={{ transform: `scaleY(${initialProgress})`, transformOrigin: "50% 100%", willChange: "transform" }}
        >
          <Card card={card} className="w-full h-full rounded-xl" />
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
}) => {
  const [card0Revealed, setCard0Revealed] = useState(() => readPersistedPeelState(persistenceKey)?.[0] ?? false);
  const [card1Revealed, setCard1Revealed] = useState(() => readPersistedPeelState(persistenceKey)?.[1] ?? false);

  useEffect(() => {
    const persisted = readPersistedPeelState(persistenceKey);
    setCard0Revealed(persisted?.[0] ?? false);
    setCard1Revealed(persisted?.[1] ?? false);
  }, [persistenceKey]);

  // Ratchet — once seen, stays seen
  const handleCard0Reveal = (r: boolean) => { if (r) setCard0Revealed(true); };
  const handleCard1Reveal = (r: boolean) => { if (r) setCard1Revealed(true); };

  useEffect(() => {
    writePersistedPeelState(persistenceKey, [card0Revealed, card1Revealed]);
  }, [card0Revealed, card1Revealed, persistenceKey]);

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
          revealed={card1Revealed}
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

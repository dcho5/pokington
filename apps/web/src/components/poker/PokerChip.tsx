"use client";
import { useId, useEffect, useRef } from "react";
import { useColorScheme } from "hooks/useColorScheme";

interface PokerChipProps {
  size?: number;
  /** Screen-space angle the chip highlight should face. */
  glowAngle?: number;
  className?: string;
}

function getShortestAngleDelta(targetAngle: number, currentAngle: number) {
  const delta = ((targetAngle - currentAngle + 540) % 360) - 180;
  return delta === -180 ? 180 : delta;
}

/**
 * PokerChip — all visual motion uses CSS/SVG animations (GPU-composited).
 * Orientation changes are animated with a persistent rAF spring so the chip
 * visibly spins toward the active player without forcing React re-renders.
 */
const PokerChip: React.FC<PokerChipProps> = ({
  size = 32,
  glowAngle = -45,
  className = "",
}) => {
  const uid = useId();
  const bodyGradId = `pc-body-${uid}`;
  const glintGradId = `pc-glint-${uid}`;
  const pulseGradId = `pc-pulse-${uid}`;

  const isDark = useColorScheme() === "dark";
  const rotationRef = useRef<SVGGElement>(null);
  const currentAngleRef = useRef(glowAngle);
  const targetAngleRef = useRef(glowAngle);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const applyRotation = (angle: number) => {
      rotationRef.current?.setAttribute("transform", `rotate(${angle} 50 50)`);
    };

    targetAngleRef.current = glowAngle;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const tick = () => {
      const delta = getShortestAngleDelta(
        targetAngleRef.current,
        currentAngleRef.current,
      );
      velocityRef.current = velocityRef.current * 0.82 + delta * 0.14;
      currentAngleRef.current += velocityRef.current;
      applyRotation(currentAngleRef.current);

      if (Math.abs(delta) > 0.15 || Math.abs(velocityRef.current) > 0.15) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      currentAngleRef.current = targetAngleRef.current;
      velocityRef.current = 0;
      applyRotation(currentAngleRef.current);
      rafRef.current = null;
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [glowAngle]);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`poker-chip-pulse ${className}`}
      aria-hidden="true"
      style={{ flexShrink: 0, willChange: "transform" }}
    >
      <defs>
        <radialGradient id={bodyGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#be1c1c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <radialGradient id={glintGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="white" stopOpacity="0.55" />
          <stop offset="65%"  stopColor="white" stopOpacity="0.10" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={pulseGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#be1c1c" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#be1c1c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer pulse glow — SVG SMIL animation (GPU-composited, no JS) */}
      <circle cx="50" cy="50" r="48" fill={`url(#${pulseGradId})`}>
        <animate attributeName="r" values="48;56;48" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Rim */}
      <circle cx="50" cy="50" r="48" fill={isDark ? "#1f2937" : "white"} />

      <g
        ref={rotationRef}
        transform={`rotate(${currentAngleRef.current} 50 50)`}
      >
        <circle cx="50" cy="50" r="40" fill={`url(#${bodyGradId})`} />
        <circle cx="50" cy="50" r="34" fill="rgba(255,255,255,0.08)" />
        <circle
          cx="50"
          cy="50"
          r="35"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="3"
        />

        <circle
          cx="62"
          cy="35"
          r="23"
          fill={`url(#${glintGradId})`}
        />
      </g>
    </svg>
  );
};

export default PokerChip;

"use client";
import { useId, useEffect, useRef } from "react";
import { useColorScheme } from "hooks/useColorScheme";

interface PokerChipProps {
  size?: number;
  /** Degrees: 0=right, 90=down, 180/−180=left, −90=up */
  glowAngle?: number;
  className?: string;
}

/**
 * PokerChip — all visual motion uses CSS/SVG animations (GPU-composited).
 * The specular highlight position is updated via a single rAF spring,
 * writing directly to the SVG attribute — zero React re-renders.
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
  const glintRef = useRef<SVGCircleElement>(null);

  // Animate glint position via rAF spring — no React state, no Framer Motion
  useEffect(() => {
    let currentAngle = glowAngle;
    let velocity = 0;
    let raf: number;
    const stiffness = 60;
    const damping = 20;
    const dt = 1 / 60;

    function tick() {
      const force = -stiffness * (currentAngle - glowAngle);
      const damp = -damping * velocity;
      velocity += (force + damp) * dt;
      currentAngle += velocity * dt;

      if (glintRef.current) {
        const rad = (currentAngle * Math.PI) / 180;
        glintRef.current.setAttribute("cx", String(50 + 13 * Math.cos(rad)));
        glintRef.current.setAttribute("cy", String(50 + 13 * Math.sin(rad)));
      }

      // Stop when settled
      if (Math.abs(velocity) > 0.01 || Math.abs(currentAngle - glowAngle) > 0.1) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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
          <stop offset="0%"   stopColor="#be1c1c" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#be1c1c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer pulse glow — SVG SMIL animation (GPU-composited, no JS) */}
      <circle cx="50" cy="50" r="48" fill={`url(#${pulseGradId})`}>
        <animate attributeName="r" values="48;54;48" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Rim */}
      <circle cx="50" cy="50" r="48" fill={isDark ? "#1f2937" : "white"} />

      {/* Red body */}
      <circle cx="50" cy="50" r="40" fill={`url(#${bodyGradId})`} />

      {/* Specular highlight — position driven by rAF spring */}
      <circle
        ref={glintRef}
        cx="50"
        cy="50"
        r="23"
        fill={`url(#${glintGradId})`}
      />
    </svg>
  );
};

export default PokerChip;

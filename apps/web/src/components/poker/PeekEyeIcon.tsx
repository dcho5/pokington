import React from "react";

/** Peek-indicator eye icon. Three states: 0 = closed, 1 = half, 2+ = open.
 *  Uses `stroke="currentColor"` so the caller controls color via className. */
export function PeekEyeIcon({
  count,
  size = 14,
  strokeWidth = 2,
  className,
}: {
  count: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  if (count === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 12c0 0 4-4 9-4s9 4 9 4" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d="M7 13.5l-1 2M12 14v2M17 13.5l1 2" stroke="currentColor" strokeWidth={Math.max(1, strokeWidth - 0.5)} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 12s3.5-5 10-5 10 5 10 5-3.5 5-10 5S2 12 2 12z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="12" r={count === 1 ? 2 : 3} fill="currentColor" />
    </svg>
  );
}

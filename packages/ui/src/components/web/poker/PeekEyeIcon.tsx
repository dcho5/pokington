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
}): React.ReactElement {
  if (count === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 12c0 0 4-4 9-4s9 4 9 4" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d="M7 13.5l-1 2M12 14v2M17 13.5l1 2" stroke="currentColor" strokeWidth={Math.max(1, strokeWidth - 0.5)} strokeLinecap="round" />
      </svg>
    );
  }
  if (count === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 12c1.8-2.3 4.9-4 9-4s7.2 1.7 9 4" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d="M5 12.8c1.7 1.3 4.1 2.2 7 2.2s5.3-.9 7-2.2" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d="M9.5 12h5" stroke="currentColor" strokeWidth={Math.max(1.25, strokeWidth)} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 12s3.5-5 10-5 10 5 10 5-3.5 5-10 5S2 12 2 12z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="12" r={3} fill="currentColor" />
    </svg>
  );
}

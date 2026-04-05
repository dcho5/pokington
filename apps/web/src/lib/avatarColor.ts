/**
 * Deterministic avatar color + initials utilities.
 * Shared across PlayerBubble and HandPanel — single source of truth.
 */

export const AVATAR_COLORS = [
  "#1a3a5c",
  "#3a1a5c",
  "#1a5c3a",
  "#5c3a1a",
  "#5c1a3a",
  "#3a5c1a",
] as const;

/** Returns a stable hex color based on the player's name. */
export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Returns 1- or 2-letter initials from a display name. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

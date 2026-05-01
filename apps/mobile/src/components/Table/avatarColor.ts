const AVATAR_PALETTE = [
  "#436a15", // green
  "#1d4ed8", // blue
  "#7c3aed", // violet
  "#0e7490", // cyan
  "#b45309", // amber
  "#be185d", // pink
  "#0f766e", // teal
  "#9f1239", // rose
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getAvatarColor(name: string): string {
  return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length]!;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.trim().slice(0, 2) || "?").toUpperCase();
}

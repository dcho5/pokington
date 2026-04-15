/** Desktop: subtle semi-transparent pill styling (used in Seat.tsx) */
export const ACTION_COLORS_DESKTOP: Record<string, { bg: string; text: string }> = {
  fold:     { bg: "bg-gray-500/20 border-gray-500/30",    text: "text-gray-400" },
  check:    { bg: "bg-green-500/20 border-green-500/30",  text: "text-green-400" },
  call:     { bg: "bg-blue-500/20 border-blue-500/30",    text: "text-blue-400" },
  raise:    { bg: "bg-red-500/20 border-red-500/30",      text: "text-red-400" },
  "all-in": { bg: "bg-amber-500/20 border-amber-500/30",  text: "text-amber-400" },
};

/** Mobile: bold solid badge styling (used in PlayerBubble.tsx) */
export const ACTION_COLORS_MOBILE: Record<string, { bg: string; text: string; label: string }> = {
  fold:     { bg: "bg-gray-600",  text: "text-white", label: "FOLD" },
  check:    { bg: "bg-green-600", text: "text-white", label: "CHECK" },
  call:     { bg: "bg-blue-600",  text: "text-white", label: "CALL" },
  raise:    { bg: "bg-red-600",   text: "text-white", label: "RAISE" },
  "all-in": { bg: "bg-amber-500", text: "text-black", label: "ALL-IN" },
};

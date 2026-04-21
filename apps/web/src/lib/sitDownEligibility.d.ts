export type SitDownRequestMode = "new-seat" | "rebuy" | "change-seat" | "blocked";

export function classifySitDownRequest(args: {
  phase?: string | null;
  myPlayerId?: string | null;
  players?: Record<string, { stack: number; seatIndex: number } | null | undefined>;
  seatIndex: number;
}): SitDownRequestMode;

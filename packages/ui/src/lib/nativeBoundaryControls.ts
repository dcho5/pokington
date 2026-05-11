export type NativeBoundaryControl =
  | {
      kind: "start";
      label: "Start Game";
      disabled: false;
    }
  | {
      kind: "next";
      label: "Next Hand";
      disabled: false;
    }
  | {
      kind: "waiting";
      label: "Waiting for more players…";
      disabled: true;
    };

export interface NativeBoundaryControlOptions {
  phase?: string | null;
  isCreator?: boolean;
  eligiblePlayerCount?: number;
  nextHandStartsAt?: number | null;
  publicShowdownRevealComplete?: boolean;
}

export function deriveNativeBoundaryControl({
  phase,
  isCreator = false,
  eligiblePlayerCount = 0,
  nextHandStartsAt = null,
  publicShowdownRevealComplete = false,
}: NativeBoundaryControlOptions): NativeBoundaryControl | null {
  if (!isCreator) return null;

  if (phase === "waiting") {
    if (eligiblePlayerCount < 2) {
      return {
        kind: "waiting",
        label: "Waiting for more players…",
        disabled: true,
      };
    }
    return {
      kind: "start",
      label: "Start Game",
      disabled: false,
    };
  }

  if (phase === "showdown" && nextHandStartsAt != null && publicShowdownRevealComplete) {
    return {
      kind: "next",
      label: "Next Hand",
      disabled: false,
    };
  }

  return null;
}

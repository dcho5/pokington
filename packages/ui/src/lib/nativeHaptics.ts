import type { GameFeedbackCueEnvelope } from "@pokington/engine";

export type NativeHapticPattern = "light" | "medium" | "heavy" | "success" | "warning";

export interface NativeHapticContext {
  myPlayerId: string | null;
}

export type NativeHapticFeedbackEvent =
  | GameFeedbackCueEnvelope
  | {
      kind: "action_error";
      key: string;
    }
  | {
      kind: "local_press";
      key: string;
      strength?: Exclude<NativeHapticPattern, "success" | "warning">;
    };

export function resolveNativeHapticPattern(
  event: NativeHapticFeedbackEvent,
  context: NativeHapticContext,
): NativeHapticPattern | null {
  switch (event.kind) {
    case "local_press":
      return event.strength ?? "light";
    case "action_error":
      return "warning";
    case "player_action_confirmed":
      if (event.action === "raise") return "medium";
      if (event.action === "all-in") return "heavy";
      return "light";
    case "turn_changed":
      return event.actorId === context.myPlayerId ? "medium" : null;
    case "street_revealed":
      return "medium";
    case "voting_started":
      return "medium";
    case "bomb_pot_scheduled":
    case "bomb_pot_started":
      return "medium";
    case "bomb_pot_canceled":
      return "warning";
    case "run_it_announced":
    case "run_it_reveal_started":
    case "showdown_started":
      return "success";
    case "pot_awarded":
    case "split_pot_awarded":
      return event.winnerPlayerIds.includes(context.myPlayerId ?? "") ? "success" : null;
    case "seven_two_bounty_triggered":
      return event.winnerId === context.myPlayerId ? "success" : null;
    default:
      return null;
  }
}

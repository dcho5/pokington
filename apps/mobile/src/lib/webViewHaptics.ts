import type { GameFeedbackCueEnvelope } from "@pokington/engine";
import type { NativeHapticFeedbackEvent } from "@pokington/ui/native";
import { playNativeFeedbackHaptic } from "./haptics";

export type WebViewHapticBridgeMessage =
  | {
      type: "HAPTIC";
      kind: "local_press";
      key?: string;
      strength?: "light" | "medium" | "heavy";
      myPlayerId?: string | null;
    }
  | {
      type: "HAPTIC";
      kind: "action_error";
      key?: string;
      myPlayerId?: string | null;
    }
  | {
      type: "HAPTIC";
      kind: "game_cue";
      cue: GameFeedbackCueEnvelope;
      myPlayerId?: string | null;
    };

export function parseWebViewBridgeMessage(data: string): WebViewHapticBridgeMessage | null {
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || !("type" in payload) || payload.type !== "HAPTIC") {
    return null;
  }

  const message = payload as Partial<WebViewHapticBridgeMessage>;
  if (message.kind === "local_press" || message.kind === "action_error") {
    return message as WebViewHapticBridgeMessage;
  }

  if (message.kind === "game_cue" && "cue" in message && message.cue && typeof message.cue === "object") {
    return message as WebViewHapticBridgeMessage;
  }

  return null;
}

export function playWebViewHapticMessage(message: WebViewHapticBridgeMessage): void {
  const context = { myPlayerId: message.myPlayerId ?? null };
  const fallbackKey = `webview:${message.kind}:${Date.now()}`;

  if (message.kind === "game_cue") {
    playNativeFeedbackHaptic(message.cue, context);
    return;
  }

  const event: NativeHapticFeedbackEvent =
    message.kind === "local_press"
      ? {
          kind: "local_press",
          key: message.key ?? fallbackKey,
          strength: message.strength,
        }
      : {
          kind: "action_error",
          key: message.key ?? fallbackKey,
        };

  playNativeFeedbackHaptic(event, context);
}

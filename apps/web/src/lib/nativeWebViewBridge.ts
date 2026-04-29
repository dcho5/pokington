"use client";

import type {
  TableFeedbackPlaybackEvent,
} from "./feedbackPlatform";

type HapticStrength = "light" | "medium" | "heavy";

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

function postBridgeMessage(message: unknown) {
  if (typeof window === "undefined" || !window.ReactNativeWebView?.postMessage) return;
  window.ReactNativeWebView.postMessage(JSON.stringify(message));
}

export function isReactNativeWebView() {
  return typeof window !== "undefined" && !!window.ReactNativeWebView?.postMessage;
}

export function postNativeWebViewLocalPress(key: string, strength: HapticStrength = "light") {
  postBridgeMessage({
    type: "HAPTIC",
    kind: "local_press",
    key,
    strength,
  });
}

export function postNativeWebViewFeedbackHaptic(
  event: TableFeedbackPlaybackEvent,
  context: { myPlayerId: string | null },
) {
  if (event.kind === "action_error") {
    postBridgeMessage({
      type: "HAPTIC",
      kind: "action_error",
      key: event.key,
      myPlayerId: context.myPlayerId,
    });
    return;
  }

  if (event.kind === "board_card_revealed") {
    postNativeWebViewLocalPress(event.key, "light");
    return;
  }

  postBridgeMessage({
    type: "HAPTIC",
    kind: "game_cue",
    cue: event,
    myPlayerId: context.myPlayerId,
  });
}

export function isInteractiveBridgeTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    [
      "button",
      "a[href]",
      "input",
      "select",
      "textarea",
      "[role='button']",
      "[role='menuitem']",
      "[data-native-haptic]",
    ].join(","),
  );
}

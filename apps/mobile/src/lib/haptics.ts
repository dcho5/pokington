import * as Haptics from "expo-haptics";
import {
  resolveNativeHapticPattern,
  type NativeHapticContext,
  type NativeHapticFeedbackEvent,
  type NativeHapticPattern,
} from "@pokington/ui/native";

export async function playNativeHapticPattern(pattern: NativeHapticPattern): Promise<void> {
  switch (pattern) {
    case "light":
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case "medium":
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case "heavy":
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case "success":
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case "warning":
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
  }
}

export function playNativeFeedbackHaptic(
  event: NativeHapticFeedbackEvent,
  context: NativeHapticContext,
): void {
  const pattern = resolveNativeHapticPattern(event, context);
  if (!pattern) return;
  void playNativeHapticPattern(pattern).catch(() => {
    // Haptics can be disabled by device settings or unavailable in some runtimes.
  });
}

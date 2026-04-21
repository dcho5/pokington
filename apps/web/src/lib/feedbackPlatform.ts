"use client";

import type { GameFeedbackCueEnvelope } from "@pokington/engine";
import type { TableActionErrorFeedback } from "store/useGameStore";

export interface BoardCardRevealedFeedbackEvent {
  kind: "board_card_revealed";
  key: string;
  handNumber: number;
  boardIndex: number;
  cardIndex: number;
  runIndex?: number;
}

export interface WinnerChipLandedFeedbackEvent {
  kind: "winner_chip_landed";
  key: string;
  handNumber: number;
  playerId: string;
  amount: number;
  runIndex?: number;
  tier?: number;
}

export type TableVisualFeedbackEvent =
  | BoardCardRevealedFeedbackEvent
  | WinnerChipLandedFeedbackEvent;

export type TableFeedbackPlaybackEvent =
  | GameFeedbackCueEnvelope
  | TableActionErrorFeedback
  | TableVisualFeedbackEvent;

export type FeedbackHapticPattern = "light" | "medium" | "heavy" | "success" | "warning";

export interface FeedbackPlaybackContext {
  myPlayerId: string | null;
  isMobile: boolean;
}

export interface FeedbackPlatform {
  playSound: (
    cue: TableFeedbackPlaybackEvent["kind"],
    payload: TableFeedbackPlaybackEvent,
    context: FeedbackPlaybackContext,
  ) => void;
  playHaptic: (
    pattern: FeedbackHapticPattern,
    payload: TableFeedbackPlaybackEvent,
    context: FeedbackPlaybackContext,
  ) => void;
  dispose?: () => void;
}

interface ToneSpec {
  frequency: number;
  duration: number;
  delay?: number;
  type?: OscillatorType;
  gain?: number;
  endFrequency?: number;
}

const HAPTIC_PATTERNS: Record<FeedbackHapticPattern, number | number[]> = {
  light: 18,
  medium: [22, 28, 22],
  heavy: [32, 24, 36],
  success: [20, 30, 42],
  warning: [26, 32, 26, 32],
};

function isViewerFocusedEvent(event: TableFeedbackPlaybackEvent, myPlayerId: string | null) {
  if (!myPlayerId) return false;
  if (event.kind === "turn_changed") return event.actorId === myPlayerId;
  if (event.kind === "pot_awarded" || event.kind === "split_pot_awarded") {
    return event.winnerPlayerIds.includes(myPlayerId);
  }
  if (event.kind === "winner_chip_landed") return event.playerId === myPlayerId;
  if (event.kind === "player_action_confirmed") return event.playerId === myPlayerId;
  if (event.kind === "seven_two_bounty_triggered") return event.winnerId === myPlayerId;
  return false;
}

function getHapticPatternForEvent(
  event: TableFeedbackPlaybackEvent,
  context: FeedbackPlaybackContext,
): FeedbackHapticPattern | null {
  if (!context.isMobile) return null;

  switch (event.kind) {
    case "action_error":
      return "warning";
    case "board_card_revealed":
      return "light";
    case "player_action_confirmed":
      if (event.action === "raise") return "medium";
      if (event.action === "all-in") return "heavy";
      return "light";
    case "turn_changed":
      return event.actorId === context.myPlayerId ? "medium" : null;
    case "street_revealed":
      return "medium";
    case "bomb_pot_scheduled":
      return "medium";
    case "pot_awarded":
      return event.winnerPlayerIds.includes(context.myPlayerId ?? "") ? "success" : null;
    case "split_pot_awarded":
      return event.winnerPlayerIds.includes(context.myPlayerId ?? "") ? "success" : null;
    case "winner_chip_landed":
      return event.playerId === context.myPlayerId ? "light" : null;
    case "seven_two_bounty_triggered":
      return event.winnerId === context.myPlayerId ? "success" : null;
    default:
      return null;
  }
}

function getToneSequence(
  event: TableFeedbackPlaybackEvent,
  context: FeedbackPlaybackContext,
): ToneSpec[] | null {
  switch (event.kind) {
    case "hand_started":
      return [
        { frequency: 240, duration: 0.06, type: "triangle", gain: 0.03 },
        { frequency: 320, duration: 0.08, delay: 0.05, type: "triangle", gain: 0.025 },
      ];
    case "turn_changed":
      return event.actorId === context.myPlayerId
        ? [
            { frequency: 740, duration: 0.08, type: "square", gain: 0.04 },
            { frequency: 880, duration: 0.09, delay: 0.1, type: "square", gain: 0.035 },
          ]
        : null;
    case "player_action_confirmed":
      switch (event.action) {
        case "fold":
          return [{ frequency: 220, endFrequency: 140, duration: 0.12, type: "triangle", gain: 0.028 }];
        case "check":
          return [{ frequency: 620, duration: 0.05, type: "square", gain: 0.02 }];
        case "call":
          return [
            { frequency: 320, duration: 0.05, type: "triangle", gain: 0.028 },
            { frequency: 410, duration: 0.06, delay: 0.05, type: "triangle", gain: 0.024 },
          ];
        case "raise":
          return [
            { frequency: 280, duration: 0.07, type: "sawtooth", gain: 0.03 },
            { frequency: 520, duration: 0.1, delay: 0.05, type: "sawtooth", gain: 0.03 },
          ];
        case "all-in":
          return [
            { frequency: 280, duration: 0.08, type: "sawtooth", gain: 0.035 },
            { frequency: 520, duration: 0.1, delay: 0.05, type: "sawtooth", gain: 0.035 },
            { frequency: 820, duration: 0.14, delay: 0.12, type: "square", gain: 0.03 },
          ];
      }
      return null;
    case "street_revealed":
      return [
        { frequency: 420, duration: 0.06, type: "triangle", gain: 0.025 },
        { frequency: 560, duration: 0.08, delay: 0.06, type: "triangle", gain: 0.022 },
      ];
    case "voting_started":
      return [
        { frequency: 500, duration: 0.08, type: "triangle", gain: 0.025 },
        { frequency: 670, duration: 0.09, delay: 0.09, type: "triangle", gain: 0.022 },
      ];
    case "run_it_announced":
      return [
        { frequency: 360, duration: 0.08, type: "triangle", gain: 0.03 },
        { frequency: 540, duration: 0.1, delay: 0.06, type: "triangle", gain: 0.028 },
        { frequency: 720, duration: 0.14, delay: 0.14, type: "triangle", gain: 0.026 },
      ];
    case "run_it_reveal_started":
      return [
        { frequency: 300, duration: 0.06, type: "triangle", gain: 0.022 },
        { frequency: 460, duration: 0.08, delay: 0.05, type: "triangle", gain: 0.022 },
      ];
    case "showdown_started":
      return [{ frequency: 260, duration: 0.12, type: "triangle", gain: 0.02 }];
    case "pot_awarded":
      return [
        { frequency: 420, duration: 0.1, type: "triangle", gain: 0.03 },
        { frequency: 620, duration: 0.12, delay: 0.08, type: "triangle", gain: 0.028 },
        { frequency: 860, duration: 0.14, delay: 0.16, type: "triangle", gain: 0.024 },
      ];
    case "split_pot_awarded":
      return [
        { frequency: 420, duration: 0.1, type: "triangle", gain: 0.025 },
        { frequency: 620, duration: 0.1, delay: 0.1, type: "triangle", gain: 0.022 },
      ];
    case "bomb_pot_scheduled":
      return [
        { frequency: 260, duration: 0.08, type: "sawtooth", gain: 0.03 },
        { frequency: 220, duration: 0.08, delay: 0.08, type: "sawtooth", gain: 0.03 },
      ];
    case "bomb_pot_canceled":
      return [{ frequency: 240, endFrequency: 160, duration: 0.14, type: "triangle", gain: 0.022 }];
    case "bomb_pot_started":
      return [
        { frequency: 220, duration: 0.08, type: "sawtooth", gain: 0.03 },
        { frequency: 330, duration: 0.08, delay: 0.06, type: "sawtooth", gain: 0.03 },
      ];
    case "seven_two_bounty_triggered":
      return [
        { frequency: 520, duration: 0.08, type: "triangle", gain: 0.03 },
        { frequency: 780, duration: 0.1, delay: 0.08, type: "triangle", gain: 0.028 },
        { frequency: 1040, duration: 0.14, delay: 0.16, type: "triangle", gain: 0.024 },
      ];
    case "board_card_revealed":
      return [{ frequency: 720, duration: 0.03, type: "square", gain: 0.012 }];
    case "winner_chip_landed":
      return [
        { frequency: 520, duration: 0.04, type: "triangle", gain: 0.018 },
        { frequency: 900, duration: 0.03, delay: 0.02, type: "triangle", gain: 0.012 },
      ];
    case "action_error":
      return [
        { frequency: 260, duration: 0.08, type: "square", gain: 0.025 },
        { frequency: 180, duration: 0.11, delay: 0.09, type: "square", gain: 0.02 },
      ];
    default:
      return null;
  }
}

export function createWebFeedbackPlatform(): FeedbackPlatform {
  const AudioContextCtor = typeof window !== "undefined"
    ? (window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    : null;
  const audioContext = AudioContextCtor ? new AudioContextCtor() : null;
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const resumeAudio = () => {
    if (!audioContext || audioContext.state === "running") return;
    void audioContext.resume().catch(() => {});
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", resumeAudio, { passive: true });
    window.addEventListener("keydown", resumeAudio, { passive: true });
  }

  return {
    playSound(cue, payload, context) {
      if (cue === "turn_changed" && payload.kind === "turn_changed" && payload.actorId !== context.myPlayerId) {
        return;
      }

      if (!audioContext) return;
      const tones = getToneSequence(payload, context);
      if (!tones || tones.length === 0) return;

      resumeAudio();
      const now = audioContext.currentTime;
      for (const tone of tones) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const startAt = now + (tone.delay ?? 0);
        const endAt = startAt + tone.duration;

        oscillator.type = tone.type ?? "triangle";
        oscillator.frequency.setValueAtTime(tone.frequency, startAt);
        if (tone.endFrequency != null) {
          oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(1, tone.endFrequency),
            endAt,
          );
        }

        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(tone.gain ?? 0.025, startAt + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(endAt + 0.02);
      }
    },
    playHaptic(pattern, payload, context) {
      if (!context.isMobile || !canVibrate) return;
      if (!isViewerFocusedEvent(payload, context.myPlayerId) && payload.kind === "winner_chip_landed") return;
      navigator.vibrate(HAPTIC_PATTERNS[pattern]);
    },
    dispose() {
      if (typeof window !== "undefined") {
        window.removeEventListener("pointerdown", resumeAudio);
        window.removeEventListener("keydown", resumeAudio);
      }
      void audioContext?.close().catch(() => {});
    },
  };
}

export function getFeedbackHapticPattern(
  event: TableFeedbackPlaybackEvent,
  context: FeedbackPlaybackContext,
) {
  return getHapticPatternForEvent(event, context);
}

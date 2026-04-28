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

export type TableVisualFeedbackEvent =
  | BoardCardRevealedFeedbackEvent;

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
  prime: () => void;
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
  start: number;
  duration: number;
  frequency: number;
  endFrequency?: number;
  gain?: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  q?: number;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
}

interface NoiseSpec {
  start: number;
  duration: number;
  gain?: number;
  attack?: number;
  release?: number;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
  q?: number;
}

interface SoundRecipe {
  tones?: ToneSpec[];
  noise?: NoiseSpec[];
}

const HAPTIC_PATTERNS: Record<FeedbackHapticPattern, number | number[]> = {
  light: 35,
  medium: [45, 35, 45],
  heavy: [70, 40, 80],
  success: [45, 45, 65],
  warning: [50, 35, 50, 35],
};

function isViewerFocusedEvent(event: TableFeedbackPlaybackEvent, myPlayerId: string | null) {
  if (!myPlayerId) return false;
  if (event.kind === "turn_changed") return event.actorId === myPlayerId;
  if (event.kind === "pot_awarded" || event.kind === "split_pot_awarded") {
    return event.winnerPlayerIds.includes(myPlayerId);
  }
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
    case "run_it_announced":
      return "success";
    case "pot_awarded":
      return event.winnerPlayerIds.includes(context.myPlayerId ?? "") ? "success" : null;
    case "split_pot_awarded":
      return event.winnerPlayerIds.includes(context.myPlayerId ?? "") ? "success" : null;
    case "seven_two_bounty_triggered":
      return event.winnerId === context.myPlayerId ? "success" : null;
    default:
      return null;
  }
}

function tapRecipe({
  strength = 1,
  start = 0,
  pitch = 150,
}: {
  strength?: number;
  start?: number;
  pitch?: number;
} = {}): SoundRecipe {
  return {
    tones: [
      {
        start,
        duration: 0.055,
        frequency: pitch,
        endFrequency: Math.max(90, pitch * 0.78),
        gain: 0.1 * strength,
        type: "triangle",
        attack: 0.002,
        release: 0.05,
        filterType: "lowpass",
        filterFrequency: 900,
      },
    ],
    noise: [
      {
        start,
        duration: 0.03,
        gain: 0.03 * strength,
        attack: 0.001,
        release: 0.025,
        filterType: "bandpass",
        filterFrequency: 700,
        q: 0.5,
      },
    ],
  };
}

function chipRecipe({
  strength = 1,
  start = 0,
  bright = 1400,
}: {
  strength?: number;
  start?: number;
  bright?: number;
} = {}): SoundRecipe {
  return {
    tones: [
      {
        start,
        duration: 0.05,
        frequency: 230,
        endFrequency: 185,
        gain: 0.12 * strength,
        type: "triangle",
        attack: 0.002,
        release: 0.05,
        filterType: "lowpass",
        filterFrequency: 1200,
      },
      {
        start: start + 0.008,
        duration: 0.028,
        frequency: 680,
        endFrequency: 560,
        gain: 0.05 * strength,
        type: "sine",
        attack: 0.001,
        release: 0.028,
        filterType: "bandpass",
        filterFrequency: bright,
        q: 1.4,
      },
    ],
    noise: [
      {
        start,
        duration: 0.022,
        gain: 0.035 * strength,
        attack: 0.001,
        release: 0.02,
        filterType: "bandpass",
        filterFrequency: bright,
        q: 2.1,
      },
    ],
  };
}

function triumphantRecipe({
  start = 0,
  root = 260,
  strength = 1,
  long = false,
}: {
  start?: number;
  root?: number;
  strength?: number;
  long?: boolean;
} = {}): SoundRecipe {
  const hold = long ? 0.24 : 0.16;
  return {
    tones: [
      {
        start,
        duration: hold,
        frequency: root,
        gain: 0.1 * strength,
        type: "triangle",
        attack: 0.008,
        release: hold,
        filterType: "lowpass",
        filterFrequency: 1800,
      },
      {
        start: start + 0.06,
        duration: hold,
        frequency: root * 1.25,
        gain: 0.085 * strength,
        type: "triangle",
        attack: 0.01,
        release: hold,
        filterType: "lowpass",
        filterFrequency: 2100,
      },
      {
        start: start + 0.12,
        duration: hold + 0.05,
        frequency: root * 1.5,
        gain: 0.075 * strength,
        type: "sine",
        attack: 0.01,
        release: hold + 0.05,
        filterType: "lowpass",
        filterFrequency: 2400,
      },
    ],
  };
}

function mergeRecipes(...recipes: Array<SoundRecipe | null>): SoundRecipe | null {
  const tones = recipes.flatMap((recipe) => recipe?.tones ?? []);
  const noise = recipes.flatMap((recipe) => recipe?.noise ?? []);
  if (tones.length === 0 && noise.length === 0) return null;
  return { tones, noise };
}

function getSoundRecipe(
  event: TableFeedbackPlaybackEvent,
  context: FeedbackPlaybackContext,
): SoundRecipe | null {
  switch (event.kind) {
    case "hand_started":
      return mergeRecipes(
        chipRecipe({ strength: 0.85, start: 0 }),
        chipRecipe({ strength: 0.75, start: 0.055, bright: 1600 }),
      );
    case "turn_changed":
      return event.actorId === context.myPlayerId
        ? mergeRecipes(
            tapRecipe({ strength: 1.2, start: 0, pitch: 170 }),
            tapRecipe({ strength: 1.05, start: 0.075, pitch: 205 }),
            triumphantRecipe({ start: 0.03, root: 300, strength: 0.55 }),
          )
        : null;
    case "player_action_confirmed":
      switch (event.action) {
        case "fold":
          return mergeRecipes(
            tapRecipe({ strength: 0.65, start: 0, pitch: 120 }),
            {
              noise: [
                {
                  start: 0.01,
                  duration: 0.05,
                  gain: 0.02,
                  attack: 0.001,
                  release: 0.05,
                  filterType: "bandpass",
                  filterFrequency: 420,
                  q: 0.7,
                },
              ],
            },
          );
        case "check":
          return mergeRecipes(
            tapRecipe({ strength: 1.05, start: 0, pitch: 160 }),
            tapRecipe({ strength: 0.82, start: 0.07, pitch: 140 }),
          );
        case "call":
          return chipRecipe({ strength: 1.0, start: 0, bright: 1450 });
        case "raise":
          return mergeRecipes(
            chipRecipe({ strength: 1.1, start: 0, bright: 1500 }),
            chipRecipe({ strength: 0.95, start: 0.06, bright: 1750 }),
          );
        case "all-in":
          return mergeRecipes(
            chipRecipe({ strength: 1.2, start: 0, bright: 1500 }),
            chipRecipe({ strength: 1.05, start: 0.05, bright: 1750 }),
            triumphantRecipe({ start: 0.07, root: 280, strength: 0.85, long: true }),
          );
      }
      return null;
    case "street_revealed":
      return mergeRecipes(
        chipRecipe({ strength: 0.8, start: 0, bright: 1500 }),
        tapRecipe({ strength: 0.65, start: 0.045, pitch: 180 }),
      );
    case "voting_started":
      return mergeRecipes(
        tapRecipe({ strength: 0.8, start: 0, pitch: 180 }),
        tapRecipe({ strength: 0.72, start: 0.06, pitch: 220 }),
      );
    case "run_it_announced":
      return triumphantRecipe({ start: 0, root: 300, strength: 1.0, long: true });
    case "run_it_reveal_started":
      return mergeRecipes(
        chipRecipe({ strength: 0.8, start: 0, bright: 1600 }),
        triumphantRecipe({ start: 0.04, root: 250, strength: 0.45 }),
      );
    case "showdown_started":
      return mergeRecipes(
        tapRecipe({ strength: 0.75, start: 0, pitch: 135 }),
        chipRecipe({ strength: 0.55, start: 0.03, bright: 1350 }),
      );
    case "pot_awarded":
      return triumphantRecipe({
        start: 0,
        root: event.winnerPlayerIds.includes(context.myPlayerId ?? "") ? 330 : 285,
        strength: 1.05,
        long: true,
      });
    case "split_pot_awarded":
      return triumphantRecipe({ start: 0, root: 280, strength: 0.82, long: false });
    case "bomb_pot_scheduled":
      return triumphantRecipe({ start: 0, root: 245, strength: 0.95, long: false });
    case "bomb_pot_canceled":
      return mergeRecipes(
        tapRecipe({ strength: 0.7, start: 0, pitch: 130 }),
        {
          tones: [
            {
              start: 0.02,
              duration: 0.11,
              frequency: 190,
              endFrequency: 120,
              gain: 0.06,
              type: "triangle",
              attack: 0.002,
              release: 0.1,
              filterType: "lowpass",
              filterFrequency: 800,
            },
          ],
        },
      );
    case "bomb_pot_started":
      return triumphantRecipe({ start: 0, root: 220, strength: 1.1, long: true });
    case "seven_two_bounty_triggered":
      return triumphantRecipe({ start: 0, root: 350, strength: 1.15, long: true });
    case "board_card_revealed":
      return chipRecipe({ strength: 0.56, start: 0, bright: 1750 });
    case "action_error":
      return {
        tones: [
          {
            start: 0,
            duration: 0.08,
            frequency: 210,
            endFrequency: 165,
            gain: 0.09,
            type: "square",
            attack: 0.002,
            release: 0.08,
            filterType: "lowpass",
            filterFrequency: 900,
          },
          {
            start: 0.085,
            duration: 0.08,
            frequency: 190,
            endFrequency: 150,
            gain: 0.08,
            type: "square",
            attack: 0.002,
            release: 0.08,
            filterType: "lowpass",
            filterFrequency: 850,
          },
        ],
      };
    default:
      return null;
  }
}

function createNoiseBuffer(context: AudioContext) {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * 0.18));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function createWebFeedbackPlatform(): FeedbackPlatform {
  const AudioContextCtor = typeof window !== "undefined"
    ? (window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    : null;
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  let audioContext: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let compressor: DynamicsCompressorNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let unlocked = false;
  let unlockProbeContext: AudioContext | null = null;
  const pendingRecipeQueue: SoundRecipe[] = [];

  const ensureAudioGraph = () => {
    if (!AudioContextCtor || typeof window === "undefined") return null;
    if (audioContext && audioContext.state !== "closed") return audioContext;

    audioContext = new AudioContextCtor();
    masterGain = audioContext.createGain();
    compressor = audioContext.createDynamicsCompressor();
    masterGain.gain.value = 0.95;
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    masterGain.connect(compressor);
    compressor.connect(audioContext.destination);
    noiseBuffer = createNoiseBuffer(audioContext);
    unlockProbeContext = null;
    return audioContext;
  };

  const playSilentUnlockProbe = (context: AudioContext) => {
    if (unlockProbeContext === context && context.state === "running") return;

    try {
      const source = context.createBufferSource();
      const gainNode = context.createGain();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      gainNode.gain.value = 0;
      source.connect(gainNode);
      gainNode.connect(context.destination);
      source.start(0);
      source.stop(context.currentTime + 0.01);
      if (context.state === "running") {
        unlockProbeContext = context;
      }
    } catch {
      // Some browsers reject even silent playback until a gesture. A later gesture
      // will run this path again, so failing quietly is better than disabling sound.
    }
  };

  const renderRecipe = (recipe: SoundRecipe) => {
    const context = ensureAudioGraph();
    if (!context || !masterGain || context.state !== "running") return;
    const now = context.currentTime;

    for (const tone of recipe.tones ?? []) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const filter = context.createBiquadFilter();
      const startAt = now + tone.start;
      const endAt = startAt + tone.duration;
      const attack = tone.attack ?? 0.004;
      const release = tone.release ?? tone.duration;
      const peakGain = tone.gain ?? 0.08;

      oscillator.type = tone.type ?? "triangle";
      oscillator.frequency.setValueAtTime(tone.frequency, startAt);
      if (tone.endFrequency != null) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency), endAt);
      }

      filter.type = tone.filterType ?? "lowpass";
      filter.frequency.value = tone.filterFrequency ?? 1800;
      filter.Q.value = tone.q ?? 0.7;

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, startAt + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt + release * 0.5);

      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(endAt + release * 0.6);
    }

    for (const burst of recipe.noise ?? []) {
      if (!noiseBuffer) continue;
      const source = context.createBufferSource();
      const gainNode = context.createGain();
      const filter = context.createBiquadFilter();
      const startAt = now + burst.start;
      const endAt = startAt + burst.duration;
      const attack = burst.attack ?? 0.002;
      const release = burst.release ?? burst.duration;
      const peakGain = burst.gain ?? 0.035;

      source.buffer = noiseBuffer;
      filter.type = burst.filterType ?? "bandpass";
      filter.frequency.value = burst.filterFrequency ?? 1400;
      filter.Q.value = burst.q ?? 1;
      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, startAt + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt + release * 0.45);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(masterGain);
      source.start(startAt);
      source.stop(endAt + release * 0.5);
    }
  };

  const flushPendingRecipes = () => {
    const context = ensureAudioGraph();
    if (!context || context.state !== "running") return;
    while (pendingRecipeQueue.length > 0) {
      const recipe = pendingRecipeQueue.shift();
      if (recipe) renderRecipe(recipe);
    }
  };

  const resumeAudio = () => {
    const context = ensureAudioGraph();
    if (!context || context.state === "closed") return;
    playSilentUnlockProbe(context);
    if (context.state === "running") {
      unlocked = true;
      flushPendingRecipes();
      return;
    }
    void context.resume().then(() => {
      unlocked = true;
      flushPendingRecipes();
    }).catch(() => {});
  };

  return {
    prime() {
      resumeAudio();
    },
    playSound(cue, payload, context) {
      if (cue === "turn_changed" && payload.kind === "turn_changed" && payload.actorId !== context.myPlayerId) {
        return;
      }

      const recipe = getSoundRecipe(payload, context);
      if (!recipe) return;

      const contextNode = ensureAudioGraph();
      if (!contextNode) return;

      if (!unlocked || contextNode.state !== "running") {
        pendingRecipeQueue.push(recipe);
        if (pendingRecipeQueue.length > 32) pendingRecipeQueue.shift();
        resumeAudio();
        return;
      }

      renderRecipe(recipe);
    },
    playHaptic(pattern, payload, context) {
      if (!context.isMobile || !canVibrate) return;
      navigator.vibrate(HAPTIC_PATTERNS[pattern]);
    },
    dispose() {
      pendingRecipeQueue.length = 0;
      noiseBuffer = null;
      unlocked = false;
      unlockProbeContext = null;
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => {});
      }
      audioContext = null;
      masterGain = null;
      compressor = null;
    },
  };
}

export function getFeedbackHapticPattern(
  event: TableFeedbackPlaybackEvent,
  context: FeedbackPlaybackContext,
) {
  return getHapticPatternForEvent(event, context);
}

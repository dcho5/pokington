import { BOMB_POT_VOTING_TIMEOUT_MS, RUN_IT_VOTING_TIMEOUT_MS, type BombPotAnteBB, type WinnerInfo } from "@pokington/engine";
import { BOMB_POT_ANTE_BB_VALUES, formatCents } from "@pokington/shared";
import type { PlayerSummary } from "@pokington/ui/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import ReAnimated, {
  Easing as ReEasing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export const POT_ISLAND_HEIGHT = 72;

const POT_ISLAND_COMPACT_WIDTH = 120;
const POT_PILL_SHIFT = 13;
const RUN_LABELS = ["once", "twice", "three times"] as const;
const RUN_BUTTON_LABELS = ["Once", "Twice", "3x"] as const;
const DEFAULT_BASE_GRADIENT_COLORS = ["#0d1f38", "#060f1e", "#020609"] as const;
const POT_BASE_GRADIENT_COLORS = ["#ff7a7d", "#ef4444", "#dc2626"] as const;
const DEFAULT_SIDE_SHADE_COLORS = ["rgba(0,0,0,0.14)", "transparent", "rgba(0,0,0,0.18)"] as const;
const POT_SIDE_SHADE_COLORS = ["rgba(127,29,29,0.04)", "transparent", "rgba(127,29,29,0.08)"] as const;
const DEFAULT_BOTTOM_SHADE_COLORS = ["transparent", "rgba(0,0,0,0.34)"] as const;
const POT_BOTTOM_SHADE_COLORS = ["transparent", "rgba(127,29,29,0.08)"] as const;

type PotIslandTone = "pot" | "violet" | "sky" | "amber" | "gold";

export type BombPotDecisionAnnouncement = {
  key: string;
  kind: "scheduled" | "canceled";
  title: string;
  detail: string;
  anteBB: BombPotAnteBB;
  expiresAt: number;
};

export type BombPotVoteInfo = {
  anteBB: BombPotAnteBB;
  proposedBy: string;
  votes: Record<string, boolean>;
};

export type PotIslandRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LedgerSummaryInfo = {
  totalBuyIn: number;
  totalCashOut: number;
  net: number;
  hasLedger: boolean;
};

export type DynamicPotMode =
  | { kind: "compact" }
  | {
      kind: "bombProposal";
      bigBlind: number;
      onSelectAnte?: (anteBB: BombPotAnteBB) => void;
      onPropose: (anteBB: BombPotAnteBB) => void;
      onCancel?: () => void;
      disabled?: boolean;
    }
  | {
      kind: "ledgerSummary";
      summary: LedgerSummaryInfo;
      onOpenLedger: () => void;
    }
  | {
      kind: "runVote";
      votes: Record<string, 1 | 2 | 3>;
      players: PlayerSummary[];
      viewerId: string | null;
      canVote: boolean;
      votingStartedAt?: number | null;
      onVote: (count: 1 | 2 | 3) => void;
    }
  | {
      kind: "bombVote";
      vote: BombPotVoteInfo;
      players: PlayerSummary[];
      viewerId: string | null;
      bigBlind: number;
      votingStartedAt?: number | null;
      onApprove: () => void;
      onReject: () => void;
    }
  | { kind: "runAnnouncement"; runCount: 1 | 2 | 3 }
  | { kind: "bombDecision"; announcement: BombPotDecisionAnnouncement }
  | { kind: "winner"; winners: WinnerInfo[]; players: PlayerSummary[]; viewerId: string | null };

const TONE_INDEX: Record<PotIslandTone, number> = {
  pot: 0,
  violet: 1,
  sky: 2,
  amber: 3,
  gold: 4,
};

const TONE_STOPS = [0, 1, 2, 3, 4] as const;
const ROOT_COLORS = ["#f43f5e", "#101526", "#0b1724", "#21160c", "#1c160c"] as const;
const BORDER_COLORS = [
  "rgba(248,113,113,0.52)",
  "rgba(199,210,254,0.27)",
  "rgba(186,230,253,0.26)",
  "rgba(253,230,138,0.25)",
  "rgba(253,230,138,0.3)",
] as const;
const SHADOW_COLORS = ["#ef4444", "#818cf8", "#38bdf8", "#fb923c", "#fbbf24"] as const;
const TINT_COLORS = [
  "rgba(255,120,120,0.16)",
  "rgba(79,70,229,0.28)",
  "rgba(14,116,144,0.28)",
  "rgba(180,83,9,0.28)",
  "rgba(180,83,9,0.26)",
] as const;
const ACCENT_COLORS = ["#fecaca", "#c7d2fe", "#bae6fd", "#fde68a", "#fef3c7"] as const;

function cents(amount: number | null | undefined): string {
  return formatCents(amount ?? 0);
}

function areRectsEqual(a: PotIslandRect | null, b: PotIslandRect) {
  return (
    a != null &&
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function useAnimatedCents(value: number, enabled: boolean) {
  const animated = useRef(new Animated.Value(value)).current;
  const [displayed, setDisplayed] = useState(value);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (!enabled) {
      animated.stopAnimation();
      animated.setValue(value);
      setDisplayed(value);
      lastValueRef.current = value;
      return;
    }
    if (value === lastValueRef.current) return;
    Animated.timing(animated, {
      toValue: value,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    lastValueRef.current = value;
  }, [animated, enabled, value]);

  useEffect(() => {
    const id = animated.addListener(({ value: v }) => setDisplayed(Math.round(v)));
    return () => animated.removeListener(id);
  }, [animated]);

  return displayed;
}

function getPotModeTone(mode: DynamicPotMode): PotIslandTone {
  switch (mode.kind) {
    case "bombProposal":
      return "sky";
    case "ledgerSummary":
      return "gold";
    case "runVote":
    case "runAnnouncement":
      return "violet";
    case "bombVote":
      return "sky";
    case "bombDecision":
      return mode.announcement.kind === "canceled" ? "amber" : "sky";
    case "winner":
      return "gold";
    case "compact":
    default:
      return "pot";
  }
}

function getToneColors(tone: PotIslandTone) {
  const index = TONE_INDEX[tone];
  return {
    accent: ACCENT_COLORS[index],
    soft: TINT_COLORS[index],
    border: BORDER_COLORS[index],
  };
}

function getPlayerName(playerId: string, players: PlayerSummary[]): string {
  return players.find((p) => p.id === playerId)?.name ?? "Player";
}

function formatWinnerIsland(winners: WinnerInfo[], players: PlayerSummary[], viewerId: string | null) {
  const total = winners.reduce((sum, winner) => sum + winner.amount, 0);
  if (winners.length === 1) {
    const winner = winners[0]!;
    const name = winner.playerId === viewerId ? "You" : getPlayerName(winner.playerId, players);
    return {
      title: `${name} ${name === "You" ? "win" : "wins"} ${cents(winner.amount)}`,
      detail: winner.hand ?? "Pot awarded",
      badge: cents(winner.amount),
    };
  }
  return {
    title: `${winners.length} players split ${cents(total)}`,
    detail: winners.map((winner) => getPlayerName(winner.playerId, players)).join(" · "),
    badge: cents(total),
  };
}

function voteProgressLabel(total: number, voted: number) {
  const pending = Math.max(0, total - voted);
  return `${voted} voted · ${pending} pending`;
}

function signedCents(amount: number): string {
  if (amount > 0) return `+${cents(amount)}`;
  if (amount < 0) return `-${cents(Math.abs(amount))}`;
  return cents(0);
}

function SmoothTimerBar({
  startedAt,
  durationMs,
  tone,
}: {
  startedAt?: number | null;
  durationMs: number;
  tone: PotIslandTone;
}) {
  const progress = useSharedValue(1);
  const toneValue = useSharedValue(TONE_INDEX[tone]);

  useEffect(() => {
    toneValue.value = withTiming(TONE_INDEX[tone], {
      duration: 260,
      easing: ReEasing.out(ReEasing.cubic),
    });
  }, [tone, toneValue]);

  useEffect(() => {
    if (startedAt == null) {
      progress.value = withTiming(1, { duration: 180, easing: ReEasing.out(ReEasing.quad) });
      return;
    }
    const remainingMs = Math.max(0, startedAt + durationMs - Date.now());
    const remainingPct = Math.max(0, Math.min(1, remainingMs / durationMs));
    progress.value = remainingPct;
    progress.value = withTiming(0, {
      duration: remainingMs,
      easing: ReEasing.linear,
    });
  }, [durationMs, progress, startedAt]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
    backgroundColor: interpolateColor(toneValue.value, TONE_STOPS, ACCENT_COLORS),
  }));

  return (
    <View pointerEvents="none" style={styles.timerTrack}>
      <ReAnimated.View style={[styles.timerFill, fillStyle]} />
    </View>
  );
}

export function DynamicPotPanel({
  pot,
  total,
  hasContributions,
  mode,
  onRootMeasure,
}: {
  pot: number;
  total: number;
  hasContributions: boolean;
  mode: DynamicPotMode;
  onRootMeasure?: (rect: PotIslandRect) => void;
}) {
  const rootRef = useRef<any>(null);
  const lastMeasuredRectRef = useRef<PotIslandRect | null>(null);
  const [counterEnabled, setCounterEnabled] = useState(true);
  const [proposalConfirmAnteBB, setProposalConfirmAnteBB] = useState<BombPotAnteBB | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const expanded = mode.kind !== "compact";
  const tone = getPotModeTone(mode);
  const toneColors = getToneColors(tone);
  const baseGradientColors = tone === "pot" ? POT_BASE_GRADIENT_COLORS : DEFAULT_BASE_GRADIENT_COLORS;
  const sideShadeColors = tone === "pot" ? POT_SIDE_SHADE_COLORS : DEFAULT_SIDE_SHADE_COLORS;
  const bottomShadeColors = tone === "pot" ? POT_BOTTOM_SHADE_COLORS : DEFAULT_BOTTOM_SHADE_COLORS;
  const targetWidth = expanded ? Math.min(Math.max(screenWidth - 24, POT_ISLAND_COMPACT_WIDTH), 390) : POT_ISLAND_COMPACT_WIDTH;
  const modeKey =
    mode.kind === "bombDecision"
      ? `${mode.kind}:${mode.announcement.key}`
      : mode.kind === "runAnnouncement"
        ? `${mode.kind}:${mode.runCount}`
        : mode.kind;
  const animatedPot = useAnimatedCents(pot, counterEnabled);
  const animatedTotal = useAnimatedCents(total, counterEnabled);

  const islandWidth = useSharedValue(targetWidth);
  const islandRadius = useSharedValue(expanded ? 32 : 12);
  const contentPresence = useSharedValue(1);
  const contributionProgress = useSharedValue(hasContributions ? 1 : 0);
  const toneValue = useSharedValue(TONE_INDEX[tone]);

  useEffect(() => {
    islandWidth.value = withSpring(targetWidth, { damping: 24, stiffness: 260, mass: 0.82 });
    islandRadius.value = withSpring(expanded ? 32 : 12, { damping: 24, stiffness: 260, mass: 0.82 });
  }, [expanded, islandRadius, islandWidth, targetWidth]);

  useEffect(() => {
    setCounterEnabled(false);
    const timer = setTimeout(() => setCounterEnabled(true), 420);
    return () => clearTimeout(timer);
  }, [modeKey, targetWidth]);

  useEffect(() => {
    if (mode.kind !== "bombProposal") setProposalConfirmAnteBB(null);
  }, [mode.kind]);

  useEffect(() => {
    toneValue.value = withTiming(TONE_INDEX[tone], {
      duration: 280,
      easing: ReEasing.out(ReEasing.cubic),
    });
  }, [tone, toneValue]);

  useEffect(() => {
    contentPresence.value = 0;
    contentPresence.value = withTiming(1, {
      duration: 190,
      easing: ReEasing.out(ReEasing.quad),
    });
  }, [contentPresence, modeKey]);

  useEffect(() => {
    contributionProgress.value = withTiming(hasContributions ? 1 : 0, {
      duration: 260,
      easing: ReEasing.out(ReEasing.cubic),
    });
  }, [contributionProgress, hasContributions]);

  const measureRoot = useCallback(() => {
    if (!onRootMeasure) return;
    rootRef.current?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const rect = { x, y, width, height };
      if (areRectsEqual(lastMeasuredRectRef.current, rect)) return;
      lastMeasuredRectRef.current = rect;
      onRootMeasure(rect);
    });
  }, [onRootMeasure]);

  useEffect(() => {
    if (!onRootMeasure) return;
    const timer = setTimeout(measureRoot, 280);
    return () => clearTimeout(timer);
  }, [measureRoot, modeKey, onRootMeasure, targetWidth]);

  const rootStyle = useAnimatedStyle(() => ({
    width: islandWidth.value,
    height: POT_ISLAND_HEIGHT,
    borderRadius: islandRadius.value,
    borderColor: interpolateColor(toneValue.value, TONE_STOPS, BORDER_COLORS),
    shadowColor: interpolateColor(toneValue.value, TONE_STOPS, SHADOW_COLORS),
    backgroundColor: interpolateColor(toneValue.value, TONE_STOPS, ROOT_COLORS),
  }));

  const toneTintStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(toneValue.value, TONE_STOPS, TINT_COLORS),
    opacity: 1,
  }));

  const mainStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -contributionProgress.value * POT_PILL_SHIFT }],
  }));

  const totalStyle = useAnimatedStyle(() => ({
    opacity: contributionProgress.value,
    transform: [{ translateY: (1 - contributionProgress.value) * 5 }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentPresence.value,
    transform: [{ translateY: (1 - contentPresence.value) * 4 }],
  }));

  const renderCompact = () => (
    <>
      <ReAnimated.View style={[styles.potMain, mainStyle]}>
        <Text style={styles.potLabel}>POT</Text>
        <Text style={styles.potValue}>{cents(animatedPot)}</Text>
      </ReAnimated.View>
      <ReAnimated.View style={[styles.potTotalWrap, totalStyle]}>
        <View style={styles.potDivider} />
        <Text style={styles.potTotalLine}>
          <Text style={styles.potTotalLabel}>TOTAL </Text>
          {cents(animatedTotal)}
        </Text>
      </ReAnimated.View>
    </>
  );

  const renderPotMini = () => (
    <View style={styles.potMini}>
      <Text style={styles.potMiniLabel}>POT</Text>
      <Text style={styles.potMiniValue} numberOfLines={1}>{cents(animatedPot)}</Text>
    </View>
  );

  const renderPillButton = ({
    label,
    selected,
    disabled,
    onPress,
    tone: buttonTone = "neutral",
  }: {
    label: string;
    selected?: boolean;
    disabled?: boolean;
    onPress?: () => void;
    tone?: "neutral" | "good" | "bad";
  }) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        buttonTone === "good" && styles.choiceGood,
        buttonTone === "bad" && styles.choiceBad,
        disabled && styles.choiceDisabled,
        pressed && !disabled && styles.choicePressed,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[
          styles.choiceText,
          selected && styles.choiceTextSelected,
          buttonTone === "good" && styles.choiceTextGood,
          buttonTone === "bad" && styles.choiceTextBad,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const renderExpanded = () => {
    if (mode.kind === "runVote") {
      const activePlayers = mode.players.filter((p) => !p.isFolded);
      const votedCount = activePlayers.filter((p) => mode.votes[p.id] !== undefined).length;
      const myVote = mode.viewerId ? mode.votes[mode.viewerId] : undefined;
      return (
        <View style={styles.expandedContent}>
          <SmoothTimerBar startedAt={mode.votingStartedAt} durationMs={RUN_IT_VOTING_TIMEOUT_MS} tone={tone} />
          {renderPotMini()}
          <View style={styles.centerCopy}>
            <Text style={[styles.eyebrow, { color: toneColors.accent }]} numberOfLines={1}>All-in Showdown</Text>
            <Text style={styles.title} numberOfLines={1}>
              {myVote ? `You voted ${RUN_LABELS[myVote - 1]}` : "Run it vote"}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>{voteProgressLabel(activePlayers.length, votedCount)}</Text>
          </View>
          <View style={styles.runChoices}>
            {([1, 2, 3] as const).map((count) => (
              <React.Fragment key={count}>
                {renderPillButton({
                  label: RUN_BUTTON_LABELS[count - 1],
                  selected: myVote === count,
                  disabled: !mode.canVote,
                  onPress: () => mode.onVote(count),
                })}
              </React.Fragment>
            ))}
          </View>
        </View>
      );
    }

    if (mode.kind === "bombVote") {
      const totalPlayers = mode.players.length;
      const votedCount = mode.players.filter((p) => mode.vote.votes[p.id] !== undefined).length;
      const proposer = getPlayerName(mode.vote.proposedBy, mode.players);
      const myVote = mode.viewerId ? mode.vote.votes[mode.viewerId] : undefined;
      const hasVoted = myVote !== undefined || !mode.viewerId;
      return (
        <View style={styles.expandedContent}>
          <SmoothTimerBar startedAt={mode.votingStartedAt} durationMs={BOMB_POT_VOTING_TIMEOUT_MS} tone={tone} />
          {renderPotMini()}
          <View style={styles.centerCopy}>
            <Text style={[styles.eyebrow, { color: toneColors.accent }]} numberOfLines={1}>Special Hand</Text>
            <Text style={styles.title} numberOfLines={1}>{mode.vote.anteBB}x BB bomb pot</Text>
            <Text style={styles.detail} numberOfLines={1}>
              {proposer} · {cents(mode.vote.anteBB * mode.bigBlind)} · {voteProgressLabel(totalPlayers, votedCount)}
            </Text>
          </View>
          <View style={styles.bombChoices}>
            {hasVoted ? (
              <View style={styles.locked}>
                <Text style={styles.lockedText} numberOfLines={1}>
                  {myVote === false ? "Out · waiting" : "In · waiting"}
                </Text>
              </View>
            ) : (
              <>
                {renderPillButton({ label: "In", onPress: mode.onApprove, tone: "good" })}
                {renderPillButton({ label: "Out", onPress: mode.onReject, tone: "bad" })}
              </>
            )}
          </View>
        </View>
      );
    }

    if (mode.kind === "bombProposal") {
      const confirmAmount = proposalConfirmAnteBB != null ? proposalConfirmAnteBB * mode.bigBlind : null;
      return (
        <View style={styles.expandedContent}>
          {renderPotMini()}
          <View style={styles.centerCopy}>
            <Text style={styles.title} numberOfLines={1}>Propose bomb pot</Text>
            <Text style={styles.detail} numberOfLines={1}>
              {proposalConfirmAnteBB == null ? "Choose ante" : `${proposalConfirmAnteBB}x BB · ${cents(confirmAmount)} ante`}
            </Text>
          </View>
          <View style={styles.proposalActions}>
            {proposalConfirmAnteBB == null ? (
              <View style={styles.anteSelector}>
                {BOMB_POT_ANTE_BB_VALUES.map((anteBB) => (
                  <Pressable
                    key={anteBB}
                    accessibilityRole="button"
                    disabled={mode.disabled}
                    onPress={() => {
                      mode.onSelectAnte?.(anteBB);
                      setProposalConfirmAnteBB(anteBB);
                    }}
                    style={({ pressed }) => [
                      styles.anteChoice,
                      mode.disabled && styles.choiceDisabled,
                      pressed && !mode.disabled && styles.choicePressed,
                    ]}
                  >
                    <Text style={styles.anteChoiceText}>{anteBB}x</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityLabel={`Confirm ${proposalConfirmAnteBB}x bomb pot`}
                  accessibilityRole="button"
                  disabled={mode.disabled}
                  onPress={() => mode.onPropose(proposalConfirmAnteBB)}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    styles.confirmButtonYes,
                    mode.disabled && styles.choiceDisabled,
                    pressed && !mode.disabled && styles.choicePressed,
                  ]}
                >
                  <Text style={styles.confirmButtonText}>✓</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Cancel bomb pot proposal"
                  accessibilityRole="button"
                  disabled={mode.disabled}
                  onPress={() => {
                    mode.onCancel?.();
                    setProposalConfirmAnteBB(null);
                  }}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    styles.confirmButtonNo,
                    mode.disabled && styles.choiceDisabled,
                    pressed && !mode.disabled && styles.choicePressed,
                  ]}
                >
                  <Text style={styles.confirmButtonText}>×</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      );
    }

    if (mode.kind === "ledgerSummary") {
      const netTone =
        mode.summary.net > 0
          ? styles.ledgerNetPositive
          : mode.summary.net < 0
            ? styles.ledgerNetNegative
            : styles.ledgerNetNeutral;
      return (
        <Pressable
          accessibilityRole="button"
          onPress={mode.onOpenLedger}
          style={({ pressed }) => [styles.expandedContent, styles.ledgerSummaryContent, pressed && styles.ledgerSummaryPressed]}
        >
          {renderPotMini()}
          <View style={styles.centerCopy}>
            <Text style={styles.title} numberOfLines={1}>Session ledger</Text>
            <Text style={styles.detail} numberOfLines={1}>
              In {cents(mode.summary.totalBuyIn)} · Out {cents(mode.summary.totalCashOut)}
            </Text>
          </View>
          <View style={[styles.badge, styles.ledgerNetBadge, { borderColor: toneColors.border, backgroundColor: toneColors.soft }]}>
            <Text style={[styles.badgeText, styles.ledgerNetBadgeText, netTone]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {signedCents(mode.summary.net)}
            </Text>
          </View>
        </Pressable>
      );
    }

    if (mode.kind === "runAnnouncement") {
      return (
        <View style={styles.expandedContent}>
          {renderPotMini()}
          <View style={styles.centerCopyWide}>
            <Text style={[styles.eyebrow, { color: toneColors.accent }]} numberOfLines={1}>All-in Showdown</Text>
            <Text style={styles.title} numberOfLines={1}>Running it {RUN_LABELS[mode.runCount - 1]}</Text>
            <Text style={styles.detail} numberOfLines={1}>
              {mode.runCount === 1 ? "A single board settles it." : `${mode.runCount} boards decide this hand.`}
            </Text>
          </View>
          <View style={[styles.badge, { borderColor: toneColors.border, backgroundColor: toneColors.soft }]}>
            <Text style={[styles.badgeText, { color: toneColors.accent }]} numberOfLines={1}>
              {mode.runCount} {mode.runCount === 1 ? "board" : "boards"}
            </Text>
          </View>
        </View>
      );
    }

    if (mode.kind === "bombDecision") {
      return (
        <View style={styles.expandedContent}>
          {renderPotMini()}
          <View style={styles.centerCopyWide}>
            <Text style={[styles.eyebrow, { color: toneColors.accent }]} numberOfLines={1}>
              {mode.announcement.kind === "canceled" ? "Table Update" : "Special Hand"}
            </Text>
            <Text style={styles.title} numberOfLines={1}>{mode.announcement.title}</Text>
            <Text style={styles.detail} numberOfLines={1}>{mode.announcement.detail}</Text>
          </View>
          <View style={[styles.badge, { borderColor: toneColors.border, backgroundColor: toneColors.soft }]}>
            <Text style={[styles.badgeText, { color: toneColors.accent }]} numberOfLines={1}>
              {mode.announcement.kind === "canceled" ? "Canceled" : "Bomb Pot"}
            </Text>
          </View>
        </View>
      );
    }

    if (mode.kind === "winner") {
      const winner = formatWinnerIsland(mode.winners, mode.players, mode.viewerId);
      return (
        <View style={styles.expandedContent}>
          {renderPotMini()}
          <View style={styles.centerCopyWide}>
            <Text style={[styles.eyebrow, { color: toneColors.accent }]} numberOfLines={1}>
              {mode.winners.length === 1 ? "Pot Awarded" : "Split Pot"}
            </Text>
            <Text style={styles.title} numberOfLines={1}>{winner.title}</Text>
            <Text style={styles.detail} numberOfLines={1}>{winner.detail}</Text>
          </View>
          <View style={[styles.badge, { borderColor: toneColors.border, backgroundColor: toneColors.soft }]}>
            <Text style={[styles.badgeText, { color: toneColors.accent }]} numberOfLines={1}>{winner.badge}</Text>
          </View>
        </View>
      );
    }

    return renderCompact();
  };

  return (
    <View style={styles.wrap}>
      <ReAnimated.View ref={rootRef} style={[styles.root, rootStyle]}>
        {/* Same full-fill layering approach as OpponentStrip: a clipped base gradient, then light/shadow passes. */}
        <LinearGradient
          colors={baseGradientColors}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <ReAnimated.View pointerEvents="none" style={[styles.toneTint, toneTintStyle]} />
        <LinearGradient
          colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.02)"] as const}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.72 }}
        />
        <LinearGradient
          colors={sideShadeColors}
          locations={[0, 0.5, 1] as const}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        <LinearGradient
          colors={bottomShadeColors}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.55 }}
          end={{ x: 0.5, y: 1 }}
        />
        <View pointerEvents="none" style={styles.topGloss} />
        <ReAnimated.View style={[styles.content, contentStyle]}>
          {expanded ? renderExpanded() : renderCompact()}
        </ReAnimated.View>
      </ReAnimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: POT_ISLAND_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "visible",
  },
  root: {
    height: POT_ISLAND_HEIGHT,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.42,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toneTint: {
    ...StyleSheet.absoluteFillObject,
  },
  topGloss: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.48)",
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  potMain: {
    alignItems: "center",
  },
  potLabel: {
    color: "rgba(254,202,202,0.68)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  potValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
    lineHeight: 22,
  },
  potTotalWrap: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  potDivider: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    marginBottom: 4,
    backgroundColor: "rgba(248,113,113,0.34)",
  },
  potTotalLine: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  potTotalLabel: {
    color: "rgba(254,202,202,0.56)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
  },
  expandedContent: {
    width: "100%",
    height: POT_ISLAND_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 8,
  },
  potMini: {
    width: 54,
    height: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.055)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  potMiniLabel: {
    color: "rgba(255,255,255,0.44)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  potMiniValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  centerCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  centerCopyWide: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: 0,
  },
  detail: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  runChoices: {
    width: 104,
    flexDirection: "row",
    gap: 4,
  },
  bombChoices: {
    width: 86,
    flexDirection: "row",
    gap: 5,
    justifyContent: "flex-end",
  },
  proposalActions: {
    width: 118,
    height: 44,
    justifyContent: "center",
  },
  anteSelector: {
    height: 34,
    flexDirection: "row",
    gap: 4,
  },
  anteChoice: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  anteChoiceSelected: {
    borderColor: "rgba(186,230,253,0.38)",
    backgroundColor: "rgba(14,165,233,0.2)",
  },
  anteChoiceText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 9,
    fontWeight: "900",
  },
  anteChoiceTextSelected: {
    color: "#e0f2fe",
  },
  confirmActions: {
    height: 34,
    flexDirection: "row",
    gap: 6,
  },
  confirmButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonYes: {
    borderColor: "rgba(34,197,94,0.32)",
    backgroundColor: "rgba(34,197,94,0.18)",
  },
  confirmButtonNo: {
    borderColor: "rgba(248,113,113,0.32)",
    backgroundColor: "rgba(248,113,113,0.15)",
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "900",
  },
  proposeButton: {
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(186,230,253,0.36)",
    backgroundColor: "rgba(14,165,233,0.23)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  proposeButtonText: {
    color: "#e0f2fe",
    fontSize: 10,
    fontWeight: "900",
  },
  ledgerSummaryContent: {
    borderRadius: 28,
  },
  ledgerSummaryPressed: {
    opacity: 0.82,
  },
  choice: {
    flex: 1,
    height: 34,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  choiceSelected: {
    borderColor: "rgba(199,210,254,0.35)",
    backgroundColor: "rgba(129,140,248,0.24)",
  },
  choiceGood: {
    borderColor: "rgba(34,197,94,0.28)",
    backgroundColor: "rgba(34,197,94,0.16)",
  },
  choiceBad: {
    borderColor: "rgba(248,113,113,0.28)",
    backgroundColor: "rgba(248,113,113,0.13)",
  },
  choicePressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  choiceDisabled: {
    opacity: 0.48,
  },
  choiceText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 10,
    fontWeight: "900",
  },
  choiceTextSelected: {
    color: "#ffffff",
  },
  choiceTextGood: {
    color: "#dcfce7",
  },
  choiceTextBad: {
    color: "#fee2e2",
  },
  locked: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  lockedText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 10,
    fontWeight: "900",
  },
  badge: {
    maxWidth: 86,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ledgerNetBadge: {
    maxWidth: 92,
    minWidth: 72,
  },
  ledgerNetBadgeText: {
    fontSize: 10,
    textTransform: "none",
    letterSpacing: 0,
  },
  ledgerNetPositive: {
    color: "#bbf7d0",
  },
  ledgerNetNegative: {
    color: "#fecaca",
  },
  ledgerNetNeutral: {
    color: "#fef3c7",
  },
  timerTrack: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 5,
    height: 2,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  timerFill: {
    height: "100%",
    borderRadius: 999,
  },
});

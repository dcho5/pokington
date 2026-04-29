import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { Card } from "@pokington/shared";
import { tokens } from "../../theme/tokens";

type Tone = "primary" | "secondary" | "danger";

const RnActivityIndicator = ActivityIndicator as unknown as React.ComponentType<any>;
const RnPressable = Pressable as unknown as React.ComponentType<any>;
const RnText = Text as unknown as React.ComponentType<any>;
const RnTextInput = TextInput as unknown as React.ComponentType<any>;
const RnView = View as unknown as React.ComponentType<any>;

export interface NativeButtonProps extends PressableProps {
  label: string;
  tone?: Tone;
  loading?: boolean;
}

export function NativeButton({
  label,
  tone = "primary",
  loading = false,
  disabled,
  style,
  ...props
}: NativeButtonProps) {
  return React.createElement(
    RnPressable,
    {
      accessibilityRole: "button",
      disabled: disabled || loading,
      style: (state: { pressed: boolean }) => [
        styles.button,
        tone === "secondary" && styles.secondaryButton,
        tone === "danger" && styles.dangerButton,
        (disabled || loading) && styles.disabled,
        state.pressed && !disabled && !loading && styles.pressed,
        typeof style === "function" ? style(state as never) : style,
      ],
      ...props,
    },
    loading
      ? React.createElement(RnActivityIndicator, { color: tokens.colors.text })
      : React.createElement(RnText, { style: styles.buttonText }, label),
  );
}

export interface NativePanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function NativePanel({ children, style }: NativePanelProps) {
  return React.createElement(RnView, { style: [styles.panel, style] }, children);
}

export interface NativeTextFieldProps extends TextInputProps {
  label: string;
}

export function NativeTextField({ label, style, ...props }: NativeTextFieldProps) {
  return React.createElement(
    RnView,
    { style: styles.field },
    React.createElement(RnText, { style: styles.fieldLabel }, label),
    React.createElement(RnTextInput, {
      placeholderTextColor: tokens.colors.muted,
      autoCapitalize: "characters",
      autoCorrect: false,
      style: [styles.input, style],
      ...props,
    }),
  );
}

export function PokerCard({ card, hidden = false }: { card: Card | null | undefined; hidden?: boolean }) {
  const label = hidden || !card ? "?" : `${card.rank}${card.suit[0].toUpperCase()}`;
  const isRed = !hidden && card ? card.suit === "hearts" || card.suit === "diamonds" : false;

  return React.createElement(
    RnView,
    { style: [styles.card, hidden && styles.hiddenCard] },
    React.createElement(RnText, { style: [styles.cardText, isRed && styles.redCardText] }, label),
  );
}

export function CommunityBoard({ cards }: { cards: Card[] }) {
  const paddedCards = [
    ...cards,
    ...Array.from<Card | null>({ length: Math.max(0, 5 - cards.length) }).fill(null),
  ].slice(0, 5);

  return React.createElement(
    RnView,
    { style: styles.board },
    paddedCards.map((card, index) => (
      React.createElement(PokerCard, {
        key: `${card?.rank ?? "empty"}-${card?.suit ?? "slot"}-${index}`,
        card,
        hidden: !card,
      })
    )),
  );
}

export interface PlayerSummary {
  id: string;
  name: string;
  seatIndex: number;
  stack: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isAway?: boolean;
  isActor?: boolean;
  isViewer?: boolean;
}

export function PlayerRow({ player }: { player: PlayerSummary }) {
  return React.createElement(
    RnView,
    { style: [styles.playerRow, player.isActor && styles.actorRow, player.isViewer && styles.viewerRow] },
    React.createElement(
      RnView,
      { style: styles.playerIdentity },
      React.createElement(
        RnText,
        { style: styles.playerName, numberOfLines: 1 },
        player.name || `Seat ${player.seatIndex + 1}`,
      ),
      React.createElement(
        RnText,
        { style: styles.playerMeta },
        `Seat ${player.seatIndex + 1}${player.isAway ? " · Away" : ""}${player.isFolded ? " · Folded" : ""}${player.isAllIn ? " · All-in" : ""}`,
      ),
    ),
    React.createElement(
      RnView,
      { style: styles.playerNumbers },
      React.createElement(RnText, { style: styles.playerStack }, `$${(player.stack / 100).toFixed(2)}`),
      player.currentBet > 0
        ? React.createElement(RnText, { style: styles.playerBet }, `Bet $${(player.currentBet / 100).toFixed(2)}`)
        : null,
    ),
  );
}

export function StatusPill({ label }: { label: string }) {
  return React.createElement(
    RnView,
    { style: styles.statusPill },
    React.createElement(RnText, { style: styles.statusPillText }, label),
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.spacing.md,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dangerButton: {
    backgroundColor: "#b91c1c",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  panel: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  field: {
    gap: tokens.spacing.sm,
  },
  fieldLabel: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  input: {
    minHeight: 52,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: tokens.spacing.md,
  },
  board: {
    flexDirection: "row",
    justifyContent: "center",
    gap: tokens.spacing.sm,
  },
  card: {
    width: 52,
    aspectRatio: 0.72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  hiddenCard: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#0f172a",
  },
  cardText: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  redCardText: {
    color: "#dc2626",
  },
  playerRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: tokens.spacing.md,
  },
  actorRow: {
    borderColor: tokens.colors.accent,
  },
  viewerRow: {
    backgroundColor: "rgba(26,92,42,0.5)",
  },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  playerMeta: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  playerNumbers: {
    alignItems: "flex-end",
  },
  playerStack: {
    color: tokens.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  playerBet: {
    color: tokens.colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  statusPillText: {
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});

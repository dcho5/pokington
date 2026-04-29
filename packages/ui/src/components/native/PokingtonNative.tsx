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
import { nativeThemeStyles } from "../../theme/stylesheet";

type Tone = "primary" | "secondary" | "danger";

export interface NativeButtonProps extends PressableProps {
  label: string;
  tone?: Tone;
  loading?: boolean;
}

export function NativeButton({ label, tone = "primary", loading = false, disabled, style, ...props }: NativeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={(state) => [
        styles.button,
        tone === "secondary" && styles.secondaryButton,
        tone === "danger" && styles.dangerButton,
        (disabled || loading) && styles.disabled,
        state.pressed && !disabled && !loading && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={tokens.colors.text} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export interface NativePanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function NativePanel({ children, style }: NativePanelProps) {
  return <View style={[nativeThemeStyles.panel, style]}>{children}</View>;
}

export interface NativeTextFieldProps extends TextInputProps {
  label: string;
}

export function NativeTextField({ label, style, ...props }: NativeTextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={tokens.colors.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

export function PokerCard({ card, hidden = false }: { card: Card | null | undefined; hidden?: boolean }) {
  const label = hidden || !card ? "?" : `${card.rank}${card.suit[0].toUpperCase()}`;
  const isRed = !hidden && card ? card.suit === "hearts" || card.suit === "diamonds" : false;

  return (
    <View style={[styles.card, hidden && styles.hiddenCard]}>
      <Text style={[styles.cardText, isRed && styles.redCardText]}>{label}</Text>
    </View>
  );
}

export function CommunityBoard({ cards }: { cards: Card[] }) {
  const paddedCards = [...cards, ...Array.from<Card | null>({ length: Math.max(0, 5 - cards.length) }).fill(null)].slice(0, 5);
  return (
    <View style={styles.board}>
      {paddedCards.map((card, index) => (
        <PokerCard key={`${card?.rank ?? "empty"}-${card?.suit ?? "slot"}-${index}`} card={card} hidden={!card} />
      ))}
    </View>
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
  return (
    <View style={[styles.playerRow, player.isActor && styles.actorRow, player.isViewer && styles.viewerRow]}>
      <View style={styles.playerIdentity}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.name || `Seat ${player.seatIndex + 1}`}
        </Text>
        <Text style={styles.playerMeta}>
          Seat {player.seatIndex + 1}
          {player.isAway ? " · Away" : ""}
          {player.isFolded ? " · Folded" : ""}
          {player.isAllIn ? " · All-in" : ""}
        </Text>
      </View>
      <View style={styles.playerNumbers}>
        <Text style={styles.playerStack}>${(player.stack / 100).toFixed(2)}</Text>
        {player.currentBet > 0 ? <Text style={styles.playerBet}>Bet ${(player.currentBet / 100).toFixed(2)}</Text> : null}
      </View>
    </View>
  );
}

export function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
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
    backgroundColor: tokens.colors.surfaceMuted,
  },
  dangerButton: {
    backgroundColor: tokens.colors.danger,
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
    backgroundColor: tokens.colors.surfaceMuted,
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
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.cardFace,
  },
  hiddenCard: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.cardBack,
  },
  cardText: {
    color: tokens.colors.cardInk,
    fontSize: 18,
    fontWeight: "900",
  },
  redCardText: {
    color: tokens.colors.cardRed,
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
    backgroundColor: tokens.colors.surfaceSubtle,
    padding: tokens.spacing.md,
  },
  actorRow: {
    borderColor: tokens.colors.accent,
  },
  viewerRow: {
    backgroundColor: tokens.colors.feltOverlay,
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
    ...nativeThemeStyles.pill,
  },
  statusPillText: {
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});

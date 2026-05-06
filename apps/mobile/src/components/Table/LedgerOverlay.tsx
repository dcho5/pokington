import { formatCents } from "@pokington/shared";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import ReAnimated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { PotIslandRect } from "./DynamicPotPanel";

export type LedgerOverlayRow = {
  playerId: string;
  name: string;
  totalBuyIn: number;
  totalCashOut: number;
  net: number;
  isSeated: boolean;
};

export type LedgerOverlayPayout = {
  fromPlayerId: string;
  fromName: string;
  toPlayerId: string;
  toName: string;
  amount: number;
};

function cents(amount: number | null | undefined): string {
  return formatCents(amount ?? 0);
}

function signedCents(amount: number): string {
  if (amount > 0) return `+${cents(amount)}`;
  if (amount < 0) return `-${cents(Math.abs(amount))}`;
  return cents(0);
}

export function LedgerOverlay({
  visible,
  ledgerRows,
  payoutInstructions,
  sourceRect,
  onDismiss,
}: {
  visible: boolean;
  ledgerRows: LedgerOverlayRow[];
  payoutInstructions: LedgerOverlayPayout[];
  sourceRect: PotIslandRect | null;
  onDismiss: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  const fallbackSource = useMemo<PotIslandRect>(
    () => ({
      x: screenWidth / 2 - 60,
      y: Math.max(80, screenHeight - 230),
      width: 120,
      height: 72,
    }),
    [screenHeight, screenWidth],
  );

  const source = sourceRect ?? fallbackSource;
  const targetWidth = Math.min(screenWidth - 24, 420);
  const targetHeight = Math.min(Math.max(ledgerRows.length * 42 + payoutInstructions.length * 38 + 172, 300), screenHeight - 120);
  const target = {
    x: (screenWidth - targetWidth) / 2,
    y: Math.max(58, (screenHeight - targetHeight) / 2),
    width: targetWidth,
    height: targetHeight,
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = 0;
      progress.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
      return;
    }
    progress.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [progress, visible]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const panelStyle = useAnimatedStyle(() => ({
    left: source.x + (target.x - source.x) * progress.value,
    top: source.y + (target.y - source.y) * progress.value,
    width: source.width + (target.width - source.width) * progress.value,
    height: source.height + (target.height - source.height) * progress.value,
    borderRadius: 32 + (24 - 32) * progress.value,
    shadowOpacity: interpolate(progress.value, [0, 1], [0.22, 0.48]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.98, 1]) }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.42, 1], [0, 1]),
    transform: [{ translateY: interpolate(progress.value, [0.42, 1], [10, 0]) }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onDismiss}>
          <ReAnimated.View style={[styles.scrim, scrimStyle]} />
        </Pressable>

        <ReAnimated.View style={[styles.panel, panelStyle]}>
          <LinearGradient
            colors={["#0d1f38", "#060f1e", "#020609"] as const}
            locations={[0, 0.58, 1] as const}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <LinearGradient
            colors={["rgba(251,191,36,0.22)", "rgba(251,191,36,0.04)", "rgba(0,0,0,0.18)"] as const}
            locations={[0, 0.5, 1] as const}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View pointerEvents="none" style={styles.topGloss} />

          <ReAnimated.View style={[styles.content, contentStyle]}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Session</Text>
                <Text style={styles.title}>Ledger</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {ledgerRows.length > 0 ? (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.playerHeader}>Player</Text>
                    <Text style={styles.headerAmount}>Buy-in</Text>
                    <Text style={styles.headerAmount}>Out</Text>
                    <Text style={styles.headerAmount}>Net</Text>
                  </View>
                  {ledgerRows.map((row) => {
                    const netStyle =
                      row.net > 0 ? styles.netPositive : row.net < 0 ? styles.netNegative : styles.netNeutral;
                    return (
                      <View key={row.playerId} style={styles.row}>
                        <View style={styles.playerCell}>
                          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                          {row.isSeated ? <Text style={styles.seated}>seated</Text> : null}
                        </View>
                        <Text style={styles.amount}>{cents(row.totalBuyIn)}</Text>
                        <Text style={styles.amount}>{cents(row.totalCashOut)}</Text>
                        <Text style={[styles.net, netStyle]}>{signedCents(row.net)}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No ledger yet</Text>
                  <Text style={styles.emptyText}>Players will appear here once they sit with chips.</Text>
                </View>
              )}

              {payoutInstructions.length > 0 ? (
                <View style={styles.payouts}>
                  <Text style={styles.payoutTitle}>Payouts</Text>
                  {payoutInstructions.map((payout, index) => (
                    <View key={`${payout.fromPlayerId}:${payout.toPlayerId}:${index}`} style={styles.payoutRow}>
                      <Text style={styles.payoutName} numberOfLines={1}>{payout.fromName}</Text>
                      <Text style={styles.payoutVerb}>pays</Text>
                      <Text style={styles.payoutName} numberOfLines={1}>{payout.toName}</Text>
                      <Text style={styles.payoutAmount}>{cents(payout.amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </ReAnimated.View>
        </ReAnimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,12,0.58)",
  },
  panel: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,230,138,0.28)",
    shadowColor: "#000000",
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18,
  },
  topGloss: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  content: {
    flex: 1,
    padding: 18,
  },
  header: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerCopy: {
    minWidth: 0,
  },
  eyebrow: {
    color: "#fef3c7",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: 0,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  closeText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "600",
    marginTop: -2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 6,
  },
  table: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.11)",
    backgroundColor: "rgba(255,255,255,0.055)",
  },
  tableHeader: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  playerHeader: {
    flex: 1.25,
    color: "rgba(255,255,255,0.48)",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  headerAmount: {
    flex: 0.8,
    color: "rgba(255,255,255,0.48)",
    fontSize: 9,
    fontWeight: "900",
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  playerCell: {
    flex: 1.25,
    minWidth: 0,
    paddingRight: 8,
  },
  name: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  seated: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  amount: {
    flex: 0.8,
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  net: {
    flex: 0.8,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  netPositive: {
    color: "#86efac",
  },
  netNegative: {
    color: "#fca5a5",
  },
  netNeutral: {
    color: "rgba(255,255,255,0.58)",
  },
  emptyState: {
    minHeight: 132,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.11)",
    backgroundColor: "rgba(255,255,255,0.055)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  emptyText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
  payouts: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,230,138,0.18)",
    backgroundColor: "rgba(251,191,36,0.07)",
    padding: 12,
  },
  payoutTitle: {
    color: "#fef3c7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  payoutRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  payoutName: {
    flex: 1,
    minWidth: 0,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  payoutVerb: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  payoutAmount: {
    color: "#fef3c7",
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
});

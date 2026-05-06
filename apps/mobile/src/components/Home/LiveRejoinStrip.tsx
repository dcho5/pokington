import { formatCents } from "@pokington/shared";
import {
  NativeBottomSheet,
  NativeButton,
  nativeLightTheme,
} from "@pokington/ui/native";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { SeatedTableRecord } from "../../lib/seatedTables";

export interface LiveRejoinStripProps {
  records: SeatedTableRecord[];
  top: number;
  translateY: Animated.AnimatedInterpolation<number>;
  opacity: Animated.AnimatedInterpolation<number> | number;
  revealedCode: string | null;
  leaveRecord: SeatedTableRecord | null;
  error: string | null;
  leavingCode: string | null;
  onRejoin: (record: SeatedTableRecord) => void;
  onRevealLeave: (code: string) => void;
  onCancelReveal: () => void;
  onRequestLeave: (record: SeatedTableRecord) => void;
  onCancelLeave: () => void;
  onConfirmLeave: () => void;
}

const LEAVE_DIAM = 29;
const SPLIT_OVERLAP = 10;
const PILL_SHIFT = LEAVE_DIAM - SPLIT_OVERLAP;

function formatBlinds(record: SeatedTableRecord) {
  return `${formatCents(record.blinds.small)} / ${formatCents(record.blinds.big)}`;
}

function triggerHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // no-op if haptics unavailable
  }
}

export default function LiveRejoinStrip({
  records,
  top,
  translateY,
  opacity,
  revealedCode,
  leaveRecord,
  error,
  leavingCode,
  onRejoin,
  onRevealLeave,
  onCancelReveal,
  onRequestLeave,
  onCancelLeave,
  onConfirmLeave,
}: LiveRejoinStripProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const splitAnims = useRef<Record<string, Animated.Value>>({});

  const getSplitAnim = (code: string) => {
    if (!splitAnims.current[code]) {
      splitAnims.current[code] = new Animated.Value(0);
    }
    return splitAnims.current[code];
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 920,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 920,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const codes = new Set(records.map((r) => r.code));
    Object.keys(splitAnims.current).forEach((code) => {
      if (!codes.has(code)) delete splitAnims.current[code];
    });
    records.forEach((record) => {
      const anim = getSplitAnim(record.code);
      const target = revealedCode === record.code ? 1 : 0;
      Animated.spring(anim, {
        toValue: target,
        tension: 120,
        friction: 14,
        useNativeDriver: true,
      }).start();
    });
  }, [revealedCode, records]);

  if (records.length === 0 && !leaveRecord) return null;

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0],
  });

  return (
    <>
      {revealedCode != null ? (
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onCancelReveal}
          style={styles.dismissBackdrop}
        />
      ) : null}
      {records.length > 0 ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.overlay,
            {
              top,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
            keyboardShouldPersistTaps="handled"
          >
            {records.map((record) => {
              const isRevealed = revealedCode === record.code;
              const anim = getSplitAnim(record.code);
              const pillTranslate = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, PILL_SHIFT],
              });
              const leaveScale = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 1],
              });
              const leaveTranslate = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [LEAVE_DIAM * 0.6, 0],
              });
              const leaveOpacity = anim.interpolate({
                inputRange: [0, 0.55, 1],
                outputRange: [0, 0, 1],
              });
              return (
                <View key={record.code} style={styles.pillWrap}>
                  <Animated.View
                    pointerEvents={isRevealed ? "auto" : "none"}
                    style={[
                      styles.leaveCircle,
                      {
                        opacity: leaveOpacity,
                        transform: [
                          { translateX: leaveTranslate },
                          { scale: leaveScale },
                        ],
                      },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Leave ${record.tableName}`}
                      onPress={() => onRequestLeave(record)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.leaveCircleHit,
                        pressed && styles.leaveCirclePressed,
                      ]}
                    >
                      <Text style={styles.leaveCircleGlyph}>×</Text>
                    </Pressable>
                  </Animated.View>
                  <Animated.View
                    style={{ transform: [{ translateX: pillTranslate }] }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        isRevealed
                          ? `Cancel leave ${record.tableName}`
                          : `Rejoin ${record.tableName}`
                      }
                      onPress={() => {
                        if (isRevealed) {
                          onCancelReveal();
                        } else {
                          onRejoin(record);
                        }
                      }}
                      onLongPress={() => {
                        triggerHaptic();
                        onRevealLeave(record.code);
                      }}
                      delayLongPress={280}
                      style={({ pressed }) => [
                        styles.pill,
                        pressed && styles.pillPressed,
                        isRevealed && styles.pillRevealed,
                      ]}
                    >
                      <View style={styles.liveSlot}>
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.livePulse,
                            {
                              opacity: pulseOpacity,
                              transform: [{ scale: pulseScale }],
                            },
                          ]}
                        />
                        <View style={styles.liveDot} />
                      </View>
                      <View style={styles.pillTextBlock}>
                        <Text numberOfLines={1} style={styles.tableName}>
                          {record.tableName}
                        </Text>
                        <Text style={styles.tableMeta}>
                          {record.code} - {formatBlinds(record)}
                        </Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                </View>
              );
            })}
          </ScrollView>
          {error ? (
            <View style={styles.errorPill}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <NativeBottomSheet visible={leaveRecord != null} onDismiss={onCancelLeave}>
        {leaveRecord ? (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Leave seat?</Text>
                <Text style={styles.sheetSubtitle}>
                  {leaveRecord.tableName} - {leaveRecord.code}
                </Text>
              </View>
              <View style={styles.sheetLiveBadge}>
                <View style={styles.sheetLiveDot} />
                <Text style={styles.sheetLiveText}>Live</Text>
              </View>
            </View>
            <Text style={styles.sheetText}>
              {leaveRecord.playerName} will fold when action reaches them, then leave and cash out at the next hand boundary.
            </Text>
            <View style={styles.sheetActions}>
              <NativeButton
                label="Cancel"
                tone="secondary"
                onPress={onCancelLeave}
                style={styles.sheetButton}
              />
              <NativeButton
                label={leavingCode === leaveRecord.code ? "Leaving..." : "Leave Seat"}
                tone="danger"
                loading={leavingCode === leaveRecord.code}
                disabled={leavingCode === leaveRecord.code}
                onPress={onConfirmLeave}
                style={styles.sheetButton}
              />
            </View>
          </View>
        ) : null}
      </NativeBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 30,
  },
  dismissBackdrop: {
    position: "absolute",
    top: -2000,
    bottom: -2000,
    left: -2000,
    right: -2000,
    zIndex: 25,
  },
  stripContent: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    gap: 9,
  },
  pillWrap: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    minWidth: 148,
    maxWidth: 280,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 12,
  },
  pillPressed: {
    opacity: 0.82,
  },
  pillRevealed: {
    borderColor: nativeLightTheme.colors.borderStrong,
  },
  liveSlot: {
    width: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  livePulse: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: nativeLightTheme.colors.accent,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: nativeLightTheme.colors.accent,
  },
  pillTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  tableName: {
    color: nativeLightTheme.colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  tableMeta: {
    marginTop: 2,
    color: nativeLightTheme.colors.muted,
    fontSize: 7,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  leaveCircle: {
    position: "absolute",
    left: -SPLIT_OVERLAP / 2,
    top: "50%",
    marginTop: -LEAVE_DIAM / 2,
    width: LEAVE_DIAM,
    height: LEAVE_DIAM,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveCircleHit: {
    width: LEAVE_DIAM,
    height: LEAVE_DIAM,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  leaveCirclePressed: {
    opacity: 0.78,
  },
  leaveCircleGlyph: {
    color: nativeLightTheme.colors.text,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "900",
  },
  errorPill: {
    alignSelf: "flex-start",
    marginLeft: 18,
    marginTop: -2,
    maxWidth: 330,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  errorText: {
    color: nativeLightTheme.colors.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  sheetContent: {
    gap: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  sheetTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  sheetSubtitle: {
    marginTop: 4,
    color: nativeLightTheme.colors.muted,
    fontSize: 13,
    fontWeight: "900",
  },
  sheetLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sheetLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: nativeLightTheme.colors.accent,
  },
  sheetLiveText: {
    color: nativeLightTheme.colors.text,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sheetText: {
    color: nativeLightTheme.colors.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
  },
  sheetButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
  },
});

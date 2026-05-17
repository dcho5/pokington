import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatCents, getBuyInPresets } from "@pokington/shared";
import { NativeButton, NativeTextField, type NativeTheme } from "./PokingtonNative";

type PendingUpdate = {
  leaveSeat: boolean;
  moveToSeatIndex: number | null;
  chipDelta: number;
};
import { useNativeTheme } from "../../hooks/useNativeTheme";

function describePendingBoundaryUpdate(update: PendingUpdate | null | undefined): string | null {
  if (!update) return null;
  if (update.leaveSeat) return "Leaving at the next hand boundary.";
  if (update.moveToSeatIndex != null && update.chipDelta > 0) {
    return `Moving to Seat ${update.moveToSeatIndex + 1} and adding ${formatCents(update.chipDelta)}.`;
  }
  if (update.moveToSeatIndex != null && update.chipDelta < 0) {
    return `Moving to Seat ${update.moveToSeatIndex + 1} and cashing out ${formatCents(Math.abs(update.chipDelta))}.`;
  }
  if (update.moveToSeatIndex != null) return `Moving to Seat ${update.moveToSeatIndex + 1}.`;
  if (update.chipDelta > 0) return `Adding ${formatCents(update.chipDelta)}.`;
  if (update.chipDelta < 0) return `Cashing out ${formatCents(Math.abs(update.chipDelta))}.`;
  return null;
}

function parseDollarInputToCents(value: string): number {
  return Math.max(0, Math.round(Number(value.replace(/,/g, "") || "0") * 100));
}

function formatPresetDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface NativeSeatManagerProps {
  viewer: { name: string; seatIndex: number; stack: number };
  bigBlind: number;
  pendingUpdate: PendingUpdate | null;
  applyImmediately: boolean;
  amount: string;
  onAmountChange: (value: string) => void;
  onSubmit: (update: { leaveSeat?: boolean; moveToSeatIndex?: number | null; chipDelta?: number }) => void;
  onCancelPending: () => void;
  onDismiss: () => void;
}

export function NativeSeatManager({
  viewer,
  bigBlind,
  pendingUpdate,
  applyImmediately,
  amount,
  onAmountChange,
  onSubmit,
  onCancelPending,
  onDismiss: _onDismiss,
}: NativeSeatManagerProps) {
  const theme = useNativeTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const presets = getBuyInPresets(bigBlind);
  const pendingCopy = describePendingBoundaryUpdate(pendingUpdate);
  const parsedCents = parseDollarInputToCents(amount);
  const canSubmit = parsedCents > 0;
  const submitLabel = applyImmediately ? "Apply Now" : "Add Chips";

  return (
    <View style={styles.seatManagerContent}>
      <Text style={styles.sheetTitle}>{viewer.name}</Text>
      <Text style={styles.sheetText}>
        Seat {viewer.seatIndex + 1} · Stack {formatCents(viewer.stack)}
      </Text>

      {pendingCopy ? (
        <View style={styles.pendingUpdateBox}>
          <Text style={styles.pendingUpdateLabel}>QUEUED UPDATE</Text>
          <Text style={styles.pendingUpdateText}>{pendingCopy}</Text>
          <NativeButton
            label="Cancel Pending Update"
            tone="secondary"
            onPress={onCancelPending}
            style={styles.pendingCancelButton}
          />
        </View>
      ) : null}

      <Text style={styles.buyInSectionLabel}>ADD CHIPS</Text>
      <View style={styles.buyInAmountRow}>
        <Text style={styles.buyInDollarSign}>$</Text>
        <NativeTextField
          value={amount}
          onChangeText={(text) => {
            const m = text.replace(/,/g, "").match(/^\d*\.?\d{0,2}/);
            onAmountChange(m ? m[0] : "");
          }}
          onBlur={() => {
            const centsValue = parseDollarInputToCents(amount);
            if (centsValue > 0) onAmountChange(formatPresetDollars(centsValue / 100));
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          containerStyle={styles.buyInFieldFlex}
        />
      </View>

      <View style={styles.rebuyPresetRow}>
        {presets.map((preset) => {
          const selected = amount === formatPresetDollars(preset.dollars);
          return (
            <Pressable
              key={preset.label}
              onPress={() => onAmountChange(formatPresetDollars(preset.dollars))}
              style={[styles.rebuyPreset, selected && styles.rebuyPresetSelected]}
            >
              <Text style={[styles.rebuyPresetLabel, selected && styles.rebuyPresetLabelSelected]}>
                ${preset.dollars % 1 === 0 ? preset.dollars.toFixed(0) : preset.dollars.toFixed(2)}
              </Text>
              <Text style={[styles.rebuyPresetSub, selected && styles.rebuyPresetSubSelected]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <NativeButton
        label={submitLabel}
        disabled={!canSubmit}
        onPress={() => onSubmit({ leaveSeat: false, moveToSeatIndex: null, chipDelta: parsedCents })}
        style={styles.seatManagerButton}
      />
    </View>
  );
}

function createStyles(t: NativeTheme) {
  return StyleSheet.create({
    sheetTitle: {
      color: t.colors.text,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
    },
    sheetText: {
      color: t.colors.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    seatManagerContent: {
      gap: 16,
    },
    pendingUpdateBox: {
      gap: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.32)",
      backgroundColor: "rgba(245,158,11,0.10)",
      padding: 14,
    },
    pendingUpdateLabel: {
      color: "#b45309",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 2,
    },
    pendingUpdateText: {
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    pendingCancelButton: {
      minHeight: 44,
      borderRadius: 16,
    },
    buyInSectionLabel: {
      color: t.colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    buyInAmountRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    buyInDollarSign: {
      color: t.colors.text,
      fontSize: 22,
      fontWeight: "700",
    },
    buyInFieldFlex: {
      flex: 1,
    },
    rebuyPresetRow: {
      flexDirection: "row",
      gap: 10,
    },
    rebuyPreset: {
      flex: 1,
      minHeight: 64,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(148,163,184,0.28)",
      backgroundColor: "rgba(15,23,42,0.04)",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    rebuyPresetSelected: {
      borderColor: "rgba(239,68,68,0.45)",
      backgroundColor: "rgba(239,68,68,0.10)",
    },
    rebuyPresetLabel: {
      color: t.colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    rebuyPresetLabelSelected: {
      color: t.colors.accent,
    },
    rebuyPresetSub: {
      color: t.colors.muted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.4,
    },
    rebuyPresetSubSelected: {
      color: t.colors.accent,
    },
    seatManagerButton: {
      minHeight: 56,
      borderRadius: 18,
    },
  });
}

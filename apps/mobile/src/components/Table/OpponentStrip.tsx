import React from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import PlayerBubble, { type TablePlayer } from "./PlayerBubble";

// Inlined from apps/web/src/lib/mobileSeatStripLayout.mjs (pure data, no DOM deps)
const MOBILE_SEAT_STRIP_HEIGHT_PX = 148;
const MOBILE_SEAT_STRIP_TOTAL_SEATS = 10;

const STRIP_COLUMN_LEFT_PCTS = [10, 30, 50, 70, 90] as const;
const STRIP_ROW_TOP_PCTS = [24, 68] as const;

const CLOCKWISE_GRID_POSITIONS = [
  { row: 0, column: 2 },
  { row: 0, column: 3 },
  { row: 0, column: 4 },
  { row: 1, column: 4 },
  { row: 1, column: 3 },
  { row: 1, column: 2 },
  { row: 1, column: 1 },
  { row: 1, column: 0 },
  { row: 0, column: 0 },
  { row: 0, column: 1 },
] as const;

function getSeatSlot(seatIndex: number) {
  const pos = CLOCKWISE_GRID_POSITIONS[seatIndex];
  if (!pos) return null;
  return {
    row: pos.row,
    leftPct: STRIP_COLUMN_LEFT_PCTS[pos.column],
    topPct: STRIP_ROW_TOP_PCTS[pos.row],
  };
}

interface OpponentStripProps {
  players: (TablePlayer | null)[];
  dealerIndex?: number | null;
  smallBlindIndex?: number | null;
  bigBlindIndex?: number | null;
  seatSelectionLocked?: boolean;
  onPlayerTap?: (seatIndex: number) => void;
  onEmptySeatTap?: (seatIndex: number) => void;
}

export default function OpponentStrip({
  players,
  dealerIndex,
  smallBlindIndex,
  bigBlindIndex,
  seatSelectionLocked = false,
  onPlayerTap,
  onEmptySeatTap,
}: OpponentStripProps) {
  const seats = Array.from({ length: MOBILE_SEAT_STRIP_TOTAL_SEATS }, (_, i) => {
    const slot = getSeatSlot(i);
    return { seatIndex: i, slot, player: players[i] ?? null };
  }).filter((s): s is typeof s & { slot: NonNullable<typeof s.slot> } => s.slot != null);

  return (
    <View style={styles.strip}>
      {/* Outer felt rail */}
      <View style={styles.rail} />
      {/* Inner table felt */}
      <View style={styles.felt} />

      {seats.map(({ seatIndex, slot, player }) => {
        const isActive = player?.isActor === true;
        const baseZ = slot.row === 0 ? 16 : 24;
        const zIndex = isActive ? baseZ + 10 : baseZ;

        return (
          <View
            key={`seat-${seatIndex}`}
            style={[
              styles.seatSlot,
              {
                left: `${slot.leftPct}%` as DimensionValue,
                top: `${slot.topPct}%` as DimensionValue,
                zIndex,
              },
            ]}
          >
            <PlayerBubble
              player={player}
              seatIndex={seatIndex}
              isDealer={dealerIndex === seatIndex}
              isSmallBlind={smallBlindIndex === seatIndex}
              isBigBlind={bigBlindIndex === seatIndex}
              seatSelectionLocked={seatSelectionLocked}
              onPress={() =>
                player ? onPlayerTap?.(seatIndex) : onEmptySeatTap?.(seatIndex)
              }
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    width: "100%",
    height: MOBILE_SEAT_STRIP_HEIGHT_PX,
    position: "relative",
    marginHorizontal: 6,
  },
  rail: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 0,
    bottom: 4,
    borderRadius: 34,
    backgroundColor: "#21324a",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  felt: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 6,
    bottom: 20,
    borderRadius: 28,
    backgroundColor: "#070c14",
  },
  seatSlot: {
    position: "absolute",
    // translate(-50%, -50%) via marginLeft/marginTop with fixed bubble width of 60
    marginLeft: -30,
    marginTop: -30,
  },
});

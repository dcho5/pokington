import React from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import PlayerBubble, { type TablePlayer } from "./PlayerBubble";

const MOBILE_SEAT_STRIP_HEIGHT_PX = 152;
const MOBILE_SEAT_STRIP_TOTAL_SEATS = 10;

const STRIP_COLUMN_LEFT_PCTS = [10, 30, 50, 70, 90] as const;
const STRIP_ROW_TOP_PCTS = [28, 72] as const;

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

const feltInsetXPx = 10;
const feltInsetTopPx = 6;
const feltInsetBottomPx = 16;
const railBottomInsetPx = feltInsetBottomPx - feltInsetTopPx;

interface OpponentStripProps {
  players: (TablePlayer | null)[];
  dealerIndex?: number | null;
  smallBlindIndex?: number | null;
  bigBlindIndex?: number | null;
  seatSelectionLocked?: boolean;
  onPlayerTap?: (seatIndex: number) => void;
  onEmptySeatTap?: (seatIndex: number) => void;
  selectedDetailSeatIndex?: number | null;
  selectedSpotlightPlayerId?: string | null;
  spotlightHoleCardEmphasisByIndex?: Array<"neutral" | "highlighted" | "dimmed">;
  runItOddsPercentagesByPlayerId?: Record<string, number | null>;
}

export default function OpponentStrip({
  players,
  dealerIndex,
  smallBlindIndex,
  bigBlindIndex,
  seatSelectionLocked = false,
  onPlayerTap,
  onEmptySeatTap,
  selectedDetailSeatIndex = null,
  selectedSpotlightPlayerId = null,
  spotlightHoleCardEmphasisByIndex = ["neutral", "neutral"],
  runItOddsPercentagesByPlayerId = {},
}: OpponentStripProps) {
  const seats = Array.from({ length: MOBILE_SEAT_STRIP_TOTAL_SEATS }, (_, i) => {
    const slot = getSeatSlot(i);
    return { seatIndex: i, slot, player: players[i] ?? null };
  }).filter((s): s is typeof s & { slot: NonNullable<typeof s.slot> } => s.slot != null);

  return (
    <View style={styles.strip}>
      {/* Outer felt rail — Solid deep mahogany with subtle top rim */}
      <View style={[styles.rail, { bottom: railBottomInsetPx }]}>
        <View style={styles.railTopRim} />
      </View>

      {/* Inner table felt — Native Radial Glow Simulation */}
      <View
        style={[
          styles.felt,
          {
            left: feltInsetXPx,
            right: feltInsetXPx,
            top: feltInsetTopPx,
            bottom: feltInsetBottomPx,
          },
        ]}
      >
        {/* The "Spotlight": A massive circle centered to create a soft radial gradient feel */}
        <View style={styles.feltRadialGlow} />
        
        {/* Subtle top inner edge highlight */}
        <View style={styles.feltInnerRim} />
      </View>

      {seats.map(({ seatIndex, slot, player }) => {
        const isActive = player?.isActor === true;
        const baseZ = slot.row === 0 ? 24 : 16;
        const zIndex = isActive ? baseZ + 10 : baseZ;
        const contentKey = player ? `player-${player.id}` : `empty-${seatIndex}`;

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
            <View key={contentKey}>
              <PlayerBubble
                player={player}
                seatIndex={seatIndex}
                isDealer={dealerIndex === seatIndex}
                isSmallBlind={smallBlindIndex === seatIndex}
                isBigBlind={bigBlindIndex === seatIndex}
                seatSelectionLocked={seatSelectionLocked}
                detailSelected={selectedDetailSeatIndex === seatIndex}
                showdownSpotlightSelected={
                  player != null && player.id === selectedSpotlightPlayerId
                }
                showdownCardEmphasisByIndex={
                  player != null && player.id === selectedSpotlightPlayerId
                    ? spotlightHoleCardEmphasisByIndex
                    : undefined
                }
                runItOddsPercentage={
                  player?.id != null
                    ? (runItOddsPercentagesByPlayerId[player.id] ?? null)
                    : null
                }
                onPress={() =>
                  player ? onPlayerTap?.(seatIndex) : onEmptySeatTap?.(seatIndex)
                }
              />
            </View>
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
  },
  rail: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 0,
    backgroundColor: "#1a1010",
    borderRadius: 34,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  railTopRim: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    width: "100%",
  },
  felt: {
    position: "absolute",
    backgroundColor: "#0f172a", // Deep Navy Base
    borderRadius: 28,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  feltRadialGlow: {
    position: "absolute",
    width: 600, // Large enough to span the container
    height: 600,
    borderRadius: 300,
    backgroundColor: "rgba(31, 51, 108, 0.35)", // Subtle indigo "light"
    top: "-150%", // Offset to put the "glow" in the upper-middle
  },
  feltInnerRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  seatSlot: {
    position: "absolute",
    marginLeft: -30,
    marginTop: -30,
  },
});

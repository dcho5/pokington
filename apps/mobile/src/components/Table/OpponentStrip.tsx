import React from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
      {/* ── Rail (walnut surround) ─────────────────────────────────────────── */}
      <View style={[styles.rail, { bottom: railBottomInsetPx }]}>
        {/* Cool dark-navy gradient — matches app deep-navy palette */}
        <LinearGradient
          colors={["#0d1f38", "#060f1e", "#020609"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        {/* Ice-white shimmer at top edge */}
        <View style={styles.railTopShimmer} />
        {/* Hard shadow line just below shimmer for depth */}
        <View style={styles.railTopShadow} />
      </View>

      {/* ── Inner felt (baize) ─────────────────────────────────────────────── */}
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
        {/* Overhead-light gradient — lighter navy at top fades to transparent */}
        <LinearGradient
          colors={["rgba(58,98,190,0.62)", "rgba(28,55,118,0.0)"] as const}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.7 }}
        />
        {/* Side vignette — subtle edge darkening */}
        <LinearGradient
          colors={["rgba(0,0,0,0.10)", "transparent", "rgba(0,0,0,0.10)"] as const}
          locations={[0, 0.5, 1] as const}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        {/* Bottom depth shadow — felt recedes into the rail */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.34)"] as const}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.55 }}
          end={{ x: 0.5, y: 1 }}
        />
        {/* Ice-blue top rim — subtle reflected light off the rail */}
        <View style={styles.feltTopEdge} />
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
    borderRadius: 34,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  railTopShimmer: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.09)",
    width: "100%",
  },
  railTopShadow: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: "100%",
  },
  felt: {
    position: "absolute",
    backgroundColor: "#0b1628",
    borderRadius: 28,
    overflow: "hidden",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  feltTopEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(120,160,255,0.09)",
  },
  seatSlot: {
    position: "absolute",
    marginLeft: -30,
    marginTop: -30,
  },
});

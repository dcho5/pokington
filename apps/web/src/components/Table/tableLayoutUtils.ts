import type { Player } from "types/player";

type NullablePlayer = Player | null | undefined;

export interface SeatPlayerEntry {
  player: Player;
  seatIndex: number;
}

export function getViewerPlayer(players: NullablePlayer[]): Player | null {
  return players.find((player) => player != null && player.isYou) ?? null;
}

export function getViewingPlayerId(players: NullablePlayer[]): string | undefined {
  return getViewerPlayer(players)?.id;
}

export function getOpponents(players: NullablePlayer[]): SeatPlayerEntry[] {
  return players
    .map((player, seatIndex) => ({ player, seatIndex }))
    .filter(
      (entry): entry is SeatPlayerEntry =>
        entry.player != null && !entry.player.isYou,
    );
}

export function getEmptySeats(players: NullablePlayer[], totalSeats: number): number[] {
  const occupiedSeats = new Set(
    players.map((_, seatIndex) => seatIndex).filter((seatIndex) => players[seatIndex] != null),
  );
  const emptySeats: number[] = [];

  for (let seatIndex = 0; seatIndex < totalSeats; seatIndex += 1) {
    if (!occupiedSeats.has(seatIndex)) {
      emptySeats.push(seatIndex);
    }
  }

  return emptySeats;
}

export function getMinPlayerStack(players: NullablePlayer[]): number | undefined {
  return players.reduce((min, player) => {
    if (player == null || (player.stack ?? 0) <= 0) {
      return min;
    }

    return min === undefined ? player.stack : Math.min(min, player.stack);
  }, undefined as number | undefined);
}

export function getWaitingForName(
  players: NullablePlayer[],
  currentActorName?: string | null,
): string | undefined {
  if (currentActorName) {
    return currentActorName;
  }

  return players.find((player) => player != null && player.isCurrentActor && !player.isYou)?.name;
}

export const RUN_LABELS = ["once", "twice", "three times"] as const;

export function getRunAnnouncementContent(runAnnouncement: 1 | 2 | 3) {
  return {
    eyebrow: "All-in Showdown",
    title: `Running it ${RUN_LABELS[runAnnouncement - 1]}`,
    detail:
      runAnnouncement === 1
        ? "A single board will settle the pot."
        : `${runAnnouncement} boards will decide this hand.`,
    badge: `${runAnnouncement} ${runAnnouncement === 1 ? "board" : "boards"}`,
    tone: "violet" as const,
  };
}

export function isCanceledBombPotAnnouncement(
  bombPotAnnouncement: { kind?: string | null } | null | undefined,
): boolean {
  return bombPotAnnouncement?.kind === "canceled";
}

import { compareHands, evaluateBest } from "@pokington/engine";

function hasTwoCards(cards) {
  return Array.isArray(cards) && cards.length === 2 && cards[0] != null && cards[1] != null;
}

function visibleCardCount(cards) {
  return Array.isArray(cards) ? cards.filter((card) => card != null).length : 0;
}

function hasFiveCards(cards) {
  return Array.isArray(cards) && cards.length >= 5 && cards.slice(0, 5).every((card) => card != null);
}

function buildEntries(holeCards, boardCards) {
  return [
    ...holeCards.map((card, index) => ({
      zone: "hole",
      index,
      key: `hole-${index}`,
      card,
    })),
    ...boardCards.slice(0, 5).map((card, index) => ({
      zone: "board",
      index,
      key: `board-${index}`,
      card,
    })),
  ];
}

function compareEntryOrder(a, b) {
  if (a.zone !== b.zone) return a.zone === "hole" ? -1 : 1;
  return a.index - b.index;
}

function compareBoardFirstPreference(a, b) {
  const aHoleCount = a.entries.filter((entry) => entry.zone === "hole").length;
  const bHoleCount = b.entries.filter((entry) => entry.zone === "hole").length;
  if (aHoleCount !== bHoleCount) return bHoleCount - aHoleCount;

  const aBoardIndices = a.entries
    .filter((entry) => entry.zone === "board")
    .map((entry) => entry.index)
    .sort((left, right) => left - right);
  const bBoardIndices = b.entries
    .filter((entry) => entry.zone === "board")
    .map((entry) => entry.index)
    .sort((left, right) => left - right);
  for (let index = 0; index < Math.min(aBoardIndices.length, bBoardIndices.length); index += 1) {
    if (aBoardIndices[index] !== bBoardIndices[index]) {
      return bBoardIndices[index] - aBoardIndices[index];
    }
  }

  const aOrdered = [...a.entries].sort(compareEntryOrder);
  const bOrdered = [...b.entries].sort(compareEntryOrder);
  for (let index = 0; index < Math.min(aOrdered.length, bOrdered.length); index += 1) {
    const zoneCompare = compareEntryOrder(aOrdered[index], bOrdered[index]);
    if (zoneCompare !== 0) return -zoneCompare;
  }
  return 0;
}

function pickBestSubset(entries) {
  let best = null;
  for (let a = 0; a < entries.length - 4; a += 1) {
    for (let b = a + 1; b < entries.length - 3; b += 1) {
      for (let c = b + 1; c < entries.length - 2; c += 1) {
        for (let d = c + 1; d < entries.length - 1; d += 1) {
          for (let e = d + 1; e < entries.length; e += 1) {
            const subsetEntries = [entries[a], entries[b], entries[c], entries[d], entries[e]];
            const hand = evaluateBest(subsetEntries.map((entry) => entry.card));
            const candidate = { entries: subsetEntries, hand };
            if (best == null) {
              best = candidate;
              continue;
            }
            const handCompare = compareHands(candidate.hand, best.hand);
            if (handCompare > 0) {
              best = candidate;
              continue;
            }
            if (handCompare === 0 && compareBoardFirstPreference(candidate, best) > 0) {
              best = candidate;
            }
          }
        }
      }
    }
  }
  return best;
}

function buildDisplayCards(cards, zone, highlightedKeys) {
  return cards.map((card, index) => {
    const key = `${zone}-${index}`;
    return {
      key,
      card,
      emphasis: card == null || highlightedKeys == null
        ? "neutral"
        : highlightedKeys.has(key)
          ? "highlighted"
          : "dimmed",
    };
  });
}

export function isFullyTabled(cards) {
  return hasTwoCards(cards);
}

export function resolveSpotlightPlayer({
  players = [],
  winners = [],
  viewerHoleCards = null,
  viewerCardsRevealed = false,
  selectedPlayerId = null,
} = {}) {
  const playerById = new Map(
    players.filter((player) => player?.id).map((player) => [player.id, player]),
  );

  if (selectedPlayerId) {
    const selectedPlayer = playerById.get(selectedPlayerId);
    if (selectedPlayer && hasTwoCards(selectedPlayer.holeCards)) {
      return {
        source: "selected",
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
        holeCards: selectedPlayer.holeCards,
      };
    }
  }

  for (const winner of winners ?? []) {
    const winnerPlayer = playerById.get(winner.playerId);
    if (!winnerPlayer || !hasTwoCards(winnerPlayer.holeCards)) continue;
    return {
      source: "winner",
      playerId: winnerPlayer.id,
      playerName: winnerPlayer.name,
      holeCards: winnerPlayer.holeCards,
    };
  }

  const viewer = players.find((player) => player?.isYou);
  if (viewer && viewerCardsRevealed && hasTwoCards(viewerHoleCards)) {
    return {
      source: "viewer",
      playerId: viewer.id ?? null,
      playerName: viewer.name,
      holeCards: viewerHoleCards,
    };
  }

  return null;
}

export function evaluateSevenCardHand({ holeCards = null, boardCards = [] } = {}) {
  const visibleBoardCards = Array.isArray(boardCards)
    ? boardCards.slice(0, 5).filter((card) => card != null)
    : [];
  if (!hasTwoCards(holeCards) || holeCards.length + visibleBoardCards.length < 5) return null;
  return evaluateBest([...holeCards, ...visibleBoardCards]);
}

export function mergeEmphasisArrays(emphasisArrays = [], fallbackLength = 0) {
  const normalizedArrays = emphasisArrays.filter(
    (value) => Array.isArray(value) && value.length > 0,
  );
  const maxLength = normalizedArrays.reduce(
    (currentMax, value) => Math.max(currentMax, value.length),
    fallbackLength,
  );

  return Array.from({ length: maxLength }, (_, index) => {
    const values = normalizedArrays
      .map((value) => value[index] ?? "neutral")
      .filter(Boolean);
    if (values.includes("highlighted")) return "highlighted";
    if (values.includes("dimmed")) return "dimmed";
    return "neutral";
  });
}

export function resolveBombPotBoardIndex({
  holeCards = null,
  boardCards = [],
  boardCards2 = [],
  hoveredBoardIndex = null,
} = {}) {
  if (hoveredBoardIndex === 0 || hoveredBoardIndex === 1) return hoveredBoardIndex;

  const board1Ready = hasFiveCards(boardCards);
  const board2Ready = hasFiveCards(boardCards2);
  if (board1Ready && !board2Ready) return 0;
  if (board2Ready && !board1Ready) return 1;
  if (!board1Ready && !board2Ready) return 0;

  const hand1 = evaluateSevenCardHand({ holeCards, boardCards });
  const hand2 = evaluateSevenCardHand({ holeCards, boardCards: boardCards2 });
  if (!hand1 && !hand2) return 0;
  if (!hand1) return 1;
  if (!hand2) return 0;

  return compareHands(hand2, hand1) > 0 ? 1 : 0;
}

export function buildShowdownSpotlight({
  playerId = null,
  playerName = "",
  holeCards = null,
  boardCards = [],
  contextLabel = null,
} = {}) {
  if (!hasTwoCards(holeCards)) return null;

  const visibleBoardCards = boardCards.slice(0, 5);
  const highlightKeys = holeCards.length + visibleCardCount(visibleBoardCards) >= 5
    ? new Set(pickBestSubset(buildEntries(holeCards, visibleBoardCards))?.entries.map((entry) => entry.key) ?? [])
    : null;
  const hand = highlightKeys == null
    ? null
    : evaluateSevenCardHand({ holeCards, boardCards: visibleBoardCards });

  return {
    playerId,
    playerName,
    contextLabel,
    handLabel: hand?.label ?? null,
    holeCards: buildDisplayCards(holeCards, "hole", highlightKeys),
    boardCards: buildDisplayCards(Array.from({ length: 5 }, (_, index) => visibleBoardCards[index] ?? null), "board", highlightKeys),
  };
}

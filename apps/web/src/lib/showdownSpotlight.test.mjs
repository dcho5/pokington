import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShowdownSpotlight,
  mergeEmphasisArrays,
  resolveSpotlightPlayer,
} from "./showdownSpotlight.mjs";

function card(rank, suit) {
  return { rank, suit };
}

function highlightedKeys(spotlight) {
  return [
    ...spotlight.holeCards.filter((entry) => entry.emphasis === "highlighted").map((entry) => entry.key),
    ...spotlight.boardCards.filter((entry) => entry.emphasis === "highlighted").map((entry) => entry.key),
  ];
}

test("spotlight prefers the board-only straight when multiple broadway subsets tie", () => {
  const spotlight = buildShowdownSpotlight({
    playerId: "p1",
    playerName: "Alice",
    holeCards: [card("A", "hearts"), card("K", "clubs")],
    boardCards: [
      card("A", "spades"),
      card("K", "spades"),
      card("Q", "spades"),
      card("J", "spades"),
      card("T", "spades"),
    ],
  });

  assert.deepEqual(highlightedKeys(spotlight), ["board-0", "board-1", "board-2", "board-3", "board-4"]);
  assert.equal(spotlight.handLabel, "Straight Flush");
});

test("spotlight highlights one-hole-card straights", () => {
  const spotlight = buildShowdownSpotlight({
    playerId: "p1",
    playerName: "Alice",
    holeCards: [card("A", "hearts"), card("2", "clubs")],
    boardCards: [
      card("K", "spades"),
      card("Q", "diamonds"),
      card("J", "clubs"),
      card("T", "hearts"),
      card("3", "spades"),
    ],
  });

  assert.deepEqual(highlightedKeys(spotlight), ["hole-0", "board-0", "board-1", "board-2", "board-3"]);
  assert.equal(spotlight.boardCards[4].emphasis, "dimmed");
});

test("spotlight highlights two-hole-card full houses", () => {
  const spotlight = buildShowdownSpotlight({
    playerId: "p1",
    playerName: "Alice",
    holeCards: [card("A", "hearts"), card("A", "clubs")],
    boardCards: [
      card("A", "spades"),
      card("K", "diamonds"),
      card("K", "clubs"),
      card("2", "hearts"),
      card("3", "spades"),
    ],
  });

  assert.deepEqual(highlightedKeys(spotlight), ["hole-0", "hole-1", "board-0", "board-1", "board-2"]);
  assert.equal(spotlight.handLabel, "Full House");
});

test("spotlight highlights the current best five on the flop", () => {
  const spotlight = buildShowdownSpotlight({
    playerId: "p1",
    playerName: "Alice",
    holeCards: [card("A", "hearts"), card("2", "clubs")],
    boardCards: [
      card("K", "spades"),
      card("Q", "diamonds"),
      card("J", "clubs"),
    ],
  });

  assert.equal(spotlight.handLabel, "Ace High");
  assert.deepEqual(highlightedKeys(spotlight), ["hole-0", "hole-1", "board-0", "board-1", "board-2"]);
  assert.equal(spotlight.boardCards[3].emphasis, "neutral");
  assert.equal(spotlight.boardCards[4].emphasis, "neutral");
});

test("mergeEmphasisArrays highlights hole cards used on any board and dims irrelevant ones", () => {
  assert.deepEqual(
    mergeEmphasisArrays([
      ["highlighted", "dimmed"],
      ["dimmed", "highlighted"],
    ], 2),
    ["highlighted", "highlighted"],
  );
  assert.deepEqual(
    mergeEmphasisArrays([
      ["dimmed", "dimmed"],
      ["neutral", "highlighted"],
    ], 2),
    ["dimmed", "highlighted"],
  );
});

test("selected fully tabled player overrides revealed-winner fallback", () => {
  const resolved = resolveSpotlightPlayer({
    players: [
      {
        id: "you",
        name: "You",
        isYou: true,
        stack: 1000,
      },
      {
        id: "winner",
        name: "Winner",
        stack: 1200,
        holeCards: [card("A", "spades"), card("A", "hearts")],
      },
      {
        id: "hovered",
        name: "Hovered",
        stack: 900,
        holeCards: [card("K", "spades"), card("Q", "spades")],
      },
    ],
    winners: [{ playerId: "winner", amount: 200, hand: "One Pair" }],
    selectedPlayerId: "hovered",
  });

  assert.deepEqual(resolved, {
    source: "selected",
    playerId: "hovered",
    playerName: "Hovered",
    holeCards: [card("K", "spades"), card("Q", "spades")],
  });
});

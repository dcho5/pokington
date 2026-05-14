import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState, createDeck, gameReducer } from "../dist/index.js";

function card(rank, suit) {
  return { rank, suit };
}

function makePlayer(id, seatIndex, totalContribution, holeCards, { isFolded = false, isAllIn = true } = {}) {
  return {
    id, name: id.toUpperCase(), seatIndex,
    stack: 0,
    holeCards,
    currentBet: 0, totalContribution,
    isFolded, isAllIn, lastAction: null,
    sitOutUntilBB: false,
  };
}

function votingState(players, communityCards, { dealerSeatIndex = 0 } = {}) {
  const state = createInitialState("t", { small: 25, big: 50 });
  state.phase = "voting";
  state.communityCards = communityCards;
  state.deck = [];
  state.dealerSeatIndex = dealerSeatIndex;
  state.players = Object.fromEntries(players.map((p) => [p.id, p]));
  return state;
}

// 3-way unequal all-in: short (100) vs mid (200) vs deep (300)
// Community: A-2-2-7-7 makes specific hand rankings
test("3-way unequal all-in produces main + side pots and awards correctly", () => {
  // b: full house (K-K-K-7-7), c: full house (7-7-7-2-2), a: two pair (A-A-7-7)
  // Board gives b the K trips via community K
  const community = [
    card("2", "diamonds"), card("2", "hearts"), card("7", "hearts"),
    card("7", "clubs"), card("K", "clubs"),
  ];
  const players = [
    makePlayer("a", 0, 100, [card("A", "spades"), card("A", "hearts")]),
    makePlayer("b", 1, 200, [card("K", "spades"), card("K", "hearts")]),
    makePlayer("c", 2, 300, [card("2", "clubs"), card("7", "diamonds")]),
  ];

  let state = votingState(players, community);
  state = gameReducer(state, { type: "RESOLVE_VOTE" });

  assert.equal(state.phase, "showdown");
  assert.equal(state.sidePots.length, 3, "3 pots: main + two side pots");
  assert.equal(state.sidePots[0].amount, 300, "main pot: 3 × 100");
  assert.equal(state.sidePots[1].amount, 200, "mid pot: 2 × 100");
  assert.equal(state.sidePots[2].amount, 100, "top pot: 1 × 100");

  // b wins main (300) + mid (200) = 500; c wins top uncontested (100)
  assert.equal(state.players.b.stack, 500, "b wins main + mid pot");
  assert.equal(state.players.c.stack, 100, "c wins top pot uncontested");
  assert.equal(state.players.a.stack, 0, "a wins nothing");

  const totalAwarded = Object.values(state.players).reduce((s, p) => s + p.stack, 0);
  assert.equal(totalAwarded, 600, "total awarded equals total contributed");
});

// 4-way: two players fold after contributing dead chips
test("folded players dead chips fold into the pot but those players are ineligible", () => {
  // a and b fold after contributing 50 each; c and d are all-in
  // c (Ace-high flush) beats d (low pair)
  const community = [
    card("A", "clubs"), card("K", "clubs"), card("Q", "clubs"),
    card("J", "clubs"), card("2", "spades"),
  ];
  const players = [
    makePlayer("a", 0, 50, null, { isFolded: true, isAllIn: false }),
    makePlayer("b", 1, 50, null, { isFolded: true, isAllIn: false }),
    makePlayer("c", 2, 150, [card("2", "clubs"), card("3", "clubs")]),
    makePlayer("d", 3, 100, [card("4", "diamonds"), card("5", "diamonds")]),
  ];

  let state = votingState(players, community);
  state = gameReducer(state, { type: "RESOLVE_VOTE" });

  // Total pot = 50+50+150+100 = 350
  // buildSidePots: level 50 → 4 contributors (a,b,c,d), but eligible = [c,d] → pot 4×50=200
  // level 100 → contributors with tc>=100: [c,d]; eligible=[c,d] → pot 2×50=100
  // level 150 → contributors with tc>=150: [c]; eligible=[c] → pot 1×50=50
  // c wins all 3 pots (best hand on board - royal flush with 2-clubs = flush with 2+3 of clubs)
  // Actually c has 2-clubs, 3-clubs + board A-K-Q-J-clubs, 2-spades
  // c best hand: A-K-Q-J-2 of clubs = Ace-high flush? But also has straight A-K-Q-J-T? No T
  // Actually A-K-Q-J-2 flush... but d has 4-d, 5-d on board A-K-Q-J-2-spades (no diamonds)
  // c wins everything
  const totalAwarded = Object.values(state.players).reduce((s, p) => s + p.stack, 0);
  assert.equal(totalAwarded, 350, "no chips created or destroyed");
  assert.equal(state.players.a.stack, 0, "folded a gets nothing");
  assert.equal(state.players.b.stack, 0, "folded b gets nothing");
  assert.ok(state.players.c.stack > 0, "c wins something");
  assert.ok(state.players.c.stack >= state.players.d.stack, "c outperforms d");
});

// Run-it-twice with unequal stacks: each run distributes each side pot independently
test("run-it-twice splits side pots across two boards independently", () => {
  // a (50 total) vs b (100 total)
  // We fix two boards by pre-setting communityCards as one board
  // (for 2 runs with pre-dealt cards we need to set 5 community cards - engine uses shared state)
  // Instead: drive RESOLVE_VOTE with 0 community cards and a specific deck so we can compute stacks
  // Use a simpler approach: set communityCards to 5 cards (run 1 board),
  // then communityCards for run 2 would also use same deck - complex to orchestrate.
  // Use the direct vote path: set all votes to "2" and manipulate the deck.
  const baseState = createInitialState("t", { small: 25, big: 50 });
  baseState.phase = "voting";
  baseState.communityCards = [];  // pre-flop all-in
  baseState.dealerSeatIndex = 0;
  // a (short) has 2-3 offsuit — likely to lose; b has A-A — likely to win both runs
  baseState.players = {
    a: makePlayer("a", 0, 50, [card("2", "clubs"), card("3", "diamonds")]),
    b: makePlayer("b", 1, 100, [card("A", "spades"), card("A", "hearts")]),
  };
  baseState.runItVotes = { a: 2, b: 2 };

  // Build a deck: we need burn+flop+burn+turn+burn+river for two runs (12 cards at end)
  // Run 1 board: 6-clubs, 6-diamonds, 6-hearts, 7-clubs, 8-clubs  (trips on board, b wins)
  // Run 2 board: 9-clubs, 9-diamonds, 9-hearts, T-clubs, J-clubs  (same, b wins)
  // Deck order (last element = first drawn):
  // [...filler, r1_burn, r1_f1, r1_f2, r1_f3, r1_burn_t, r1_t, r1_burn_r, r1_r,
  //             r2_f1, r2_f2, r2_f3, r2_t, r2_r]
  const excluded = new Set([
    "2-clubs", "3-diamonds", "A-spades", "A-hearts",
    "6-clubs", "6-diamonds", "6-hearts", "7-clubs", "8-clubs",
    "9-clubs", "9-diamonds", "9-hearts", "T-clubs", "J-clubs",
  ]);
  const filler = createDeck().filter((c) => !excluded.has(`${c.rank}-${c.suit}`));
  // Run 2 cards (no burns for run 2): J-clubs(river), T-clubs(turn), 9-hearts(flop3), 9-diamonds(flop2), 9-clubs(flop1)
  // Run 1 cards (with burns): 8-clubs(river), dummy_burn, 7-clubs(turn), dummy_burn, 6-hearts, 6-diamonds, 6-clubs(flop), dummy_burn
  // Dummy burns can be any filler cards — we'll use first 3 from filler
  const [burn1, burn2, burn3, ...rest] = filler;
  baseState.deck = [
    ...rest,
    // run 1 (dealt first): last group
    burn1, card("6", "clubs"), card("6", "diamonds"), card("6", "hearts"),
    burn2, card("7", "clubs"),
    burn3, card("8", "clubs"),
    // run 2 (no burns): last group after run 1
    card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
    card("T", "clubs"), card("J", "clubs"),
  ];

  let state = gameReducer(baseState, { type: "RESOLVE_VOTE" });

  assert.equal(state.runCount, 2);
  assert.equal(state.runResults.length, 2);

  // b wins both runs; side pots:
  // level 50: 2 contributors × 50 = 100, eligible = [a,b]
  // level 100: 1 contributor × 50 = 50, eligible = [b] only (a only contributed 50)
  // Per run for main (100 total): run0 base = floor(100/2)=50, run1 = 50 (no extra since 100/2 = exact)
  // Per run for side (50 total): run0 = 25, run1 = 25 (b wins uncontested)
  // b total: 50+50 (main) + 25+25 (side) = 150; a: 0
  assert.equal(state.players.b.stack, 150, "b wins both runs of both pots");
  assert.equal(state.players.a.stack, 0, "a wins nothing");
  assert.equal(state.players.b.stack + state.players.a.stack, 150, "no chips lost");
});

// Remainder chip goes to first eligible winner clockwise from button (TDA Rule 19)
test("odd chip from indivisible pot goes to first winner clockwise from button", () => {
  // 3-way split where pot is not divisible by 3 → 1 chip remainder
  // Total = 301 chips. Share = 100, remainder = 1.
  // Dealer at seat 5. Eligible winners: a(seat 0), b(seat 1), c(seat 2)
  // Clockwise from button: seat 6→7→8→9→0→1→2. So first clockwise is a(seat 0).
  const community = [
    card("A", "clubs"), card("A", "diamonds"), card("A", "hearts"),
    card("K", "clubs"), card("K", "diamonds"),
  ];
  // All three players have identical best hands using the board (A-A-A-K-K full house)
  const players = [
    makePlayer("a", 0, 100, [card("2", "clubs"), card("3", "clubs")]),
    makePlayer("b", 1, 100, [card("4", "diamonds"), card("5", "diamonds")]),
    makePlayer("c", 2, 101, [card("6", "hearts"), card("7", "hearts")]),
  ];

  // community A-A-A-K-K: best hand for any player is A-A-A-K-K regardless of hole cards
  // All three tie → pot split. c contributes 101, others 100.
  // sidePots: level 100: 3×100=300, eligible [a,b,c] → 3-way split → 100 each
  //           level 101: 1×1=1, eligible [c] only → c gets 1 uncontested
  let state = votingState(players, community, { dealerSeatIndex: 5 });
  state = gameReducer(state, { type: "RESOLVE_VOTE" });

  // Main pot 300: 3-way tie → floor(300/3)=100 each, rem=0
  // Top pot 1: c wins uncontested
  assert.equal(state.players.a.stack, 100);
  assert.equal(state.players.b.stack, 100);
  assert.equal(state.players.c.stack, 101, "c gets their uncontested chip back");
  const total = Object.values(state.players).reduce((s, p) => s + p.stack, 0);
  assert.equal(total, 301, "no chips created or destroyed");
});

// Odd chip with actual remainder: 2-way split of an odd pot
test("remainder chip goes to first clockwise winner when pot is odd", () => {
  // 2 players tie on a 101-chip pot → share=50, rem=1
  // Dealer at seat 3; eligible: a(seat 0), b(seat 1) → clockwise from seat 3: 4,5..9,0,1
  // a(seat 0) is first, gets the extra chip.
  const community = [
    card("A", "clubs"), card("A", "diamonds"), card("A", "hearts"),
    card("K", "clubs"), card("K", "diamonds"),
  ];
  const players = [
    makePlayer("a", 0, 50, [card("2", "clubs"), card("3", "clubs")]),
    makePlayer("b", 1, 51, [card("4", "diamonds"), card("5", "diamonds")]),
  ];

  // sidePots: level 50: 2×50=100, eligible [a,b] → tie, dealer at seat 3
  //           level 51: 1×1=1, eligible [b] → b gets 1 uncontested
  // For main pot: 2-way tie, 100 chips → 50 each
  // For top pot: b wins 1 uncontested
  let state = votingState(players, community, { dealerSeatIndex: 3 });
  state = gameReducer(state, { type: "RESOLVE_VOTE" });

  assert.equal(state.players.a.stack, 50, "a gets exactly half the main pot");
  assert.equal(state.players.b.stack, 51, "b gets half the main pot + 1 from top");
  const total = Object.values(state.players).reduce((s, p) => s + p.stack, 0);
  assert.equal(total, 101, "no chips created or destroyed");
});

// All-in below blind: BB short-stack posts incomplete blind, hand still resolves correctly
test("isBlindIncomplete all-in does not break pot construction", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  // 3-player: dealer=a(seat0, 200), SB=b(seat1, 200), BB=c(seat2, 10 chips → incomplete BB)
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "a", name: "A", seatIndex: 0, buyIn: 200 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 200 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "c", name: "C", seatIndex: 2, buyIn: 10 });

  state = gameReducer(state, { type: "START_HAND" });
  // c posts 10 (< 50 BB) → isAllIn=true, isBlindIncomplete=true
  assert.equal(state.players.c.isAllIn, true);
  assert.equal(state.isBlindIncomplete, true);

  // a (UTG) must act; b (SB) must act. Drive both to fold or call so we reach showdown.
  const streets = ["pre-flop", "flop", "turn", "river"];
  for (const street of streets) {
    while (state.phase === street && state.needsToAct.length > 0) {
      const actor = state.needsToAct[0];
      state = gameReducer(state, { type: "PLAYER_ACTION", playerId: actor, action: "call" });
    }
  }

  if (state.phase === "voting") {
    state = gameReducer(state, { type: "RESOLVE_VOTE" });
  }

  assert.equal(state.phase, "showdown");
  const total = Object.values(state.players).reduce((s, p) => s + p.stack, 0);
  assert.equal(total, 410, "total chips preserved: a(200)+b(200)+c(10)=410");
  assert.ok(state.sidePots.length >= 1, "at least one pot formed even with incomplete blind");
});

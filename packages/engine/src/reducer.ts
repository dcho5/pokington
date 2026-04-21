import type { GameState, GameEvent, EnginePlayer, SidePot, RunResult, WinnerInfo } from "./types";
import type { Card } from "@pokington/shared";
import { createDeck, shuffle } from "./deck";
import { evaluate7, compareHands } from "./evaluator";
import { shouldAutoRevealWinningHands } from "./types";

// ── Helpers ──

const MAX_SEATS = 10;
const ACTIVE_HAND_PHASES = new Set<GameState["phase"]>(["pre-flop", "flop", "turn", "river", "voting"]);

/** Returns true if the two hole cards are a 7 and a 2 of different suits. */
function hasSevTwoOffsuit(cards: [Card, Card] | null): boolean {
  if (!cards) return false;
  const [a, b] = cards;
  return (
    ((a.rank === "7" && b.rank === "2") || (a.rank === "2" && b.rank === "7")) &&
    a.suit !== b.suit
  );
}

function isValidSeatIndex(seatIndex: number): boolean {
  return Number.isInteger(seatIndex) && seatIndex >= 0 && seatIndex < MAX_SEATS;
}

function isValidChipCount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount >= 0;
}

/** Collect bounty from all seated players except the winner and add to winner's stack. */
function applySevenTwoBounty(state: GameState, winnerId: string): void {
  const winner = state.players[winnerId];
  if (!winner) return;
  const bountyPerPlayer = state.sevenTwoBountyBB * state.blinds.big;
  let totalCollected = 0;
  for (const p of Object.values(state.players)) {
    if (p.id === winnerId) continue;
    const taken = Math.min(p.stack, bountyPerPlayer);
    p.stack -= taken;
    totalCollected += taken;
  }
  winner.stack += totalCollected;
  state.sevenTwoBountyTrigger = { winnerId, perPlayer: bountyPerPlayer, totalCollected };
}

/** Get all players sorted clockwise from a given seat (inclusive). */
function playersFromSeat(
  startSeat: number,
  players: Record<string, EnginePlayer>
): EnginePlayer[] {
  const all = Object.values(players);
  all.sort((a, b) => {
    const aOff = (a.seatIndex - startSeat + MAX_SEATS) % MAX_SEATS;
    const bOff = (b.seatIndex - startSeat + MAX_SEATS) % MAX_SEATS;
    return aOff - bOff;
  });
  return all;
}

/** Find the next occupied seat clockwise from (but not including) the given seat. */
function nextOccupiedSeat(
  fromSeat: number,
  players: Record<string, EnginePlayer>
): number {
  const ordered = playersFromSeat((fromSeat + 1) % MAX_SEATS, players);
  return ordered[0]?.seatIndex ?? -1;
}

/** Find the next occupied seat that is eligible to play (not sitting out). */
function nextEligibleSeat(
  fromSeat: number,
  players: Record<string, EnginePlayer>,
): number {
  const ordered = playersFromSeat((fromSeat + 1) % MAX_SEATS, players);
  return ordered.find((p) => p.stack > 0 && !p.sitOutUntilBB)?.seatIndex ?? -1;
}

/** Find player at a given seat index. */
function playerAtSeat(
  seatIndex: number,
  players: Record<string, EnginePlayer>
): EnginePlayer | undefined {
  return Object.values(players).find((p) => p.seatIndex === seatIndex);
}

/** Get active (non-folded, non-all-in) player IDs clockwise from a seat. */
function activePlayerIdsFrom(
  startSeat: number,
  players: Record<string, EnginePlayer>
): string[] {
  return playersFromSeat(startSeat, players)
    .filter((p) => p.holeCards !== null && !p.isFolded && !p.isAllIn)
    .map((p) => p.id);
}

/** Sort a list of player IDs clockwise starting from fromSeat. */
function sortBySeatOrder(
  ids: string[],
  fromSeat: number,
  players: Record<string, EnginePlayer>
): string[] {
  return [...ids].sort((a, b) => {
    const pa = players[a], pb = players[b];
    if (!pa || !pb) return 0;
    const aOff = (pa.seatIndex - fromSeat + MAX_SEATS) % MAX_SEATS;
    const bOff = (pb.seatIndex - fromSeat + MAX_SEATS) % MAX_SEATS;
    return aOff - bOff;
  });
}

/** Sum of all players' currentBet values. */
function sumCurrentBets(players: Record<string, EnginePlayer>): number {
  return Object.values(players).reduce((sum, p) => sum + p.currentBet, 0);
}

/** Count non-folded players (including all-in). */
function countActive(players: Record<string, EnginePlayer>): number {
  return Object.values(players).filter((p) => p.holeCards !== null && !p.isFolded).length;
}

/**
 * Full-raise threshold: an all-in (or raise) must meet this total to
 * re-open betting for players who have already matched roundBet.
 */
function fullRaiseThreshold(roundBet: number, lastLegalRaiseIncrement: number): number {
  return roundBet + lastLegalRaiseIncrement;
}

/**
 * Returns chips to any player whose all-in bet exceeds what all others combined can call.
 * Must be called after current bets are swept (currentBet = 0) and only when every
 * non-folded player is all-in (no further betting possible).
 * Adjusts totalContribution and state.pot so subsequent side-pot math is exact.
 */
function returnUncallableChips(state: GameState): void {
  const nonFolded = Object.values(state.players).filter((p) => p.holeCards !== null && !p.isFolded);
  // Only applies when all remaining players are committed (no one can bet further)
  if (nonFolded.some((p) => !p.isAllIn)) return;

  const contributors = nonFolded.filter((p) => p.totalContribution > 0);
  if (contributors.length <= 1) return;

  contributors.sort((a, b) => b.totalContribution - a.totalContribution);

  // Repeatedly return excess while the sole top contributor over-bet everyone else
  while (contributors.length >= 2) {
    const highest = contributors[0];
    const secondHighest = contributors[1].totalContribution;
    if (highest.totalContribution <= secondHighest) break;

    const excess = highest.totalContribution - secondHighest;
    highest.stack += excess;
    highest.totalContribution -= excess;
    state.pot -= excess;
    contributors.sort((a, b) => b.totalContribution - a.totalContribution);
  }
}

// ── Side pot builder ──

function buildSidePots(players: Record<string, EnginePlayer>): SidePot[] {
  const all = Object.values(players);
  const nonFolded = all.filter((p) => p.holeCards !== null && !p.isFolded && p.totalContribution > 0);

  if (nonFolded.length === 0) return [];

  const levels = [...new Set(all.filter((p) => p.totalContribution > 0).map((p) => p.totalContribution))].sort(
    (a, b) => a - b
  );

  const pots: SidePot[] = [];
  let prevLevel = 0;

  for (const level of levels) {
    const increment = level - prevLevel;
    const contributors = all.filter((p) => p.totalContribution >= level);
    const eligible = contributors
      .filter((p) => p.holeCards !== null && !p.isFolded)
      .map((p) => p.id);

    if (eligible.length > 0) {
      pots.push({ amount: increment * contributors.length, eligiblePlayerIds: eligible });
    }
    prevLevel = level;
  }

  return pots;
}

// ── Multi-run showdown ──

/**
 * Evaluate N boards against side pots, award chips, populate runResults.
 * state.pot and all currentBets must already be swept before calling.
 */
function handleShowdownMultiRun(state: GameState, boards: Card[][]): GameState {
  state.communityCards = boards[0] ?? state.communityCards;

  const sidePots = buildSidePots(state.players);
  state.sidePots = sidePots;

  const totalRuns = boards.length;
  const aggregated = new Map<string, { amount: number; hand: string | null }>();
  const runResults: RunResult[] = boards.map((board) => ({ board, winners: [] }));

  for (const pot of sidePots) {
    const perRunBase = Math.floor(pot.amount / totalRuns);
    const extraRun0 = pot.amount - perRunBase * totalRuns;

    for (let ri = 0; ri < boards.length; ri++) {
      const board = boards[ri];
      const runPot = perRunBase + (ri === 0 ? extraRun0 : 0);

      const eligible = pot.eligiblePlayerIds
        .map((id) => state.players[id])
        .filter((p): p is EnginePlayer => !!p && !p.isFolded);

      if (eligible.length === 0) continue;

      if (eligible.length === 1) {
        const w = eligible[0];
        w.stack += runPot;
        const ex = aggregated.get(w.id);
        if (ex) ex.amount += runPot;
        else aggregated.set(w.id, { amount: runPot, hand: null });
        runResults[ri].winners.push({ playerId: w.id, amount: runPot, hand: null });
        continue;
      }

      const results = eligible.map((p) => ({
        player: p,
        hand: evaluate7([...board, ...(p.holeCards ?? [])]),
      }));
      results.sort((a, b) => compareHands(b.hand, a.hand));

      const best = results[0].hand;
      const potWinners = results.filter((r) => compareHands(r.hand, best) === 0);
      // TDA Rule 19: remainder chip(s) go to first eligible winner clockwise from button
      potWinners.sort((a, b) => {
        const aOff = (a.player.seatIndex - state.dealerSeatIndex + MAX_SEATS) % MAX_SEATS;
        const bOff = (b.player.seatIndex - state.dealerSeatIndex + MAX_SEATS) % MAX_SEATS;
        return aOff - bOff;
      });
      const share = Math.floor(runPot / potWinners.length);
      const rem = runPot - share * potWinners.length;

      potWinners.forEach((w, i) => {
        const amt = share + (i === 0 ? rem : 0);
        w.player.stack += amt;
        const ex = aggregated.get(w.player.id);
        if (ex) {
          ex.amount += amt;
          if (ex.hand === null) ex.hand = w.hand.label;
        } else {
          aggregated.set(w.player.id, { amount: amt, hand: w.hand.label });
        }
        runResults[ri].winners.push({ playerId: w.player.id, amount: amt, hand: w.hand.label });
      });
    }
  }

  state.phase = "showdown";
  state.pot = 0;
  state.needsToAct = [];
  state.closedActors = [];
  state.runResults = runResults;
  state.showdownKind = "contested";
  state.winners = Array.from(aggregated.entries()).map(([playerId, { amount, hand }]) => ({
    playerId,
    amount,
    hand,
  }));
  state.autoRevealWinningHands = shouldAutoRevealWinningHands(state.winners, state.showdownKind);
  state.autoRevealWinningHandsAt = null;
  state.knownCardCountAtRunIt = 0;
  state.runDealStartedAt = null;
  state.showdownStartedAt = null;
  state.sevenTwoBountyTrigger = null;
  state.voluntaryShownPlayerIds = [];

  // Auto-trigger 7-2 bounty for contested showdowns (sole winner whose cards are shown)
  if (state.sevenTwoBountyBB > 0 && state.autoRevealWinningHands && state.winners.length === 1) {
    const w = state.players[state.winners[0].playerId];
    if (w && hasSevTwoOffsuit(w.holeCards)) {
      applySevenTwoBounty(state, w.id);
    }
  }

  return state;
}

/** Normal river showdown — single board (or double board for bomb pot). */
function handleShowdown(state: GameState): GameState {
  state.pot += sumCurrentBets(state.players);
  for (const p of Object.values(state.players)) p.currentBet = 0;
  if (state.isBombPot) {
    return handleShowdownMultiRun(state, [state.communityCards, state.communityCards2]);
  }
  return handleShowdownMultiRun(state, [state.communityCards]);
}

// ── Run-it-multiple-times ──

/**
 * Deal N complete boards from the remaining deck, then go to showdown.
 * Burns are applied for each card of run 1 only (matching standard runout).
 * Additional runs deal without burns, ensuring no card overlap.
 */
function dealMultipleRuns(state: GameState, runCount: 1 | 2 | 3): GameState {
  state.runCount = runCount;
  const shared = [...state.communityCards];

  const boards: Card[][] = [];
  for (let r = 0; r < runCount; r++) {
    const board = [...shared];

    if (board.length < 3) {
      if (r === 0 && state.deck.length > 0) state.deck.pop(); // burn before flop
      while (board.length < 3 && state.deck.length > 0) board.push(state.deck.pop()!);
    }
    if (board.length < 4) {
      if (r === 0 && state.deck.length > 0) state.deck.pop(); // burn before turn
      if (state.deck.length > 0) board.push(state.deck.pop()!);
    }
    if (board.length < 5) {
      if (r === 0 && state.deck.length > 0) state.deck.pop(); // burn before river
      if (state.deck.length > 0) board.push(state.deck.pop()!);
    }

    boards.push(board);
  }

  return handleShowdownMultiRun(state, boards);
}

/**
 * Called when all remaining players are all-in and the street advances.
 * Enters voting if 2+ non-folded players with cards still to deal,
 * otherwise runs out directly (single run).
 */
function enterVotingOrRunOut(state: GameState): GameState {
  const nonFolded = Object.values(state.players).filter((p) => p.holeCards !== null && !p.isFolded);

  if (state.communityCards.length >= 5 || nonFolded.length <= 1) {
    return dealMultipleRuns(state, 1);
  }

  state.phase = "voting";
  state.runItVotes = {};
  state.needsToAct = [];
  return state;
}

/** Deal out remaining cards on both boards for a bomb pot all-in situation. */
function runOutBombPot(state: GameState): GameState {
  const needs1 = 5 - state.communityCards.length;
  const needs2 = 5 - state.communityCards2.length;
  for (let i = 0; i < needs1; i++) {
    if (state.deck.length > 0) state.deck.pop(); // burn
    if (state.deck.length > 0) state.communityCards.push(state.deck.pop()!);
  }
  for (let i = 0; i < needs2; i++) {
    if (state.deck.length > 0) state.deck.pop(); // burn
    if (state.deck.length > 0) state.communityCards2.push(state.deck.pop()!);
  }
  return handleShowdown(state);
}

// ── Street advancement ──

function advanceStreet(state: GameState): GameState {
  // Sweep live bets
  state.pot += sumCurrentBets(state.players);
  for (const p of Object.values(state.players)) {
    p.currentBet = 0;
    p.lastAction = null;
  }
  state.roundBet = 0;
  state.closedActors = [];
  state.lastLegalRaiseIncrement = state.blinds.big;

  // River betting over: all 5 cards already on board, go straight to showdown
  if (state.phase === "river") {
    returnUncallableChips(state);
    return handleShowdown(state);
  }

  // Check for active (non-all-in, non-folded) players BEFORE dealing cards
  const firstSeat = (state.dealerSeatIndex + 1) % MAX_SEATS;
  const actors = activePlayerIdsFrom(firstSeat, state.players);

  if (actors.length <= 1) {
    // Everyone is all-in — return uncallable chips then deal/vote
    returnUncallableChips(state);
    if (state.isBombPot) return runOutBombPot(state);
    return enterVotingOrRunOut(state);
  }

  // Deal community cards for the next street
  if (state.isBombPot) {
    switch (state.phase) {
      case "flop":
        state.deck.pop(); // burn
        state.communityCards.push(state.deck.pop()!);
        state.deck.pop(); // burn
        state.communityCards2.push(state.deck.pop()!);
        state.phase = "turn";
        break;
      case "turn":
        state.deck.pop(); // burn
        state.communityCards.push(state.deck.pop()!);
        state.deck.pop(); // burn
        state.communityCards2.push(state.deck.pop()!);
        state.phase = "river";
        break;
      default:
        return state;
    }
  } else {
    switch (state.phase) {
      case "pre-flop":
        state.deck.pop(); // burn
        state.communityCards = [
          state.deck.pop()!,
          state.deck.pop()!,
          state.deck.pop()!,
        ];
        state.phase = "flop";
        break;
      case "flop":
        state.deck.pop();
        state.communityCards.push(state.deck.pop()!);
        state.phase = "turn";
        break;
      case "turn":
        state.deck.pop();
        state.communityCards.push(state.deck.pop()!);
        state.phase = "river";
        break;
      default:
        return state;
    }
  }

  state.needsToAct = actors;
  return state;
}

function hasNoFurtherActionAgainstAllIn(state: GameState): boolean {
  const activePlayers = Object.values(state.players).filter(
    (p) => p.holeCards !== null && !p.isFolded && !p.isAllIn
  );
  return activePlayers.length === 1 && activePlayers[0].currentBet >= state.roundBet;
}

function shouldForceRunoutPreflop(state: GameState): boolean {
  return hasNoFurtherActionAgainstAllIn(state);
}

function resetTableToWaiting(state: GameState): GameState {
  for (const p of Object.values(state.players)) {
    p.holeCards = null;
    p.currentBet = 0;
    p.totalContribution = 0;
    p.isFolded = false;
    p.isAllIn = false;
    p.lastAction = null;
    if (p.stack > 0) p.sitOutUntilBB = false;
  }
  state.phase = "waiting";
  state.communityCards = [];
  state.communityCards2 = [];
  state.isBombPot = false;
  state.bombPotVote = null;
  state.pot = 0;
  state.roundBet = 0;
  state.lastLegalRaiseIncrement = state.blinds.big;
  state.isBlindIncomplete = false;
  state.needsToAct = [];
  state.closedActors = [];
  state.sidePots = [];
  state.winners = null;
  state.showdownKind = "none";
  state.runItVotes = {};
  state.runCount = 1;
  state.runResults = [];
  state.autoRevealWinningHands = false;
  state.autoRevealWinningHandsAt = null;
  state.knownCardCountAtRunIt = 0;
  state.runDealStartedAt = null;
  state.showdownStartedAt = null;
  state.sevenTwoBountyTrigger = null;
  state.voluntaryShownPlayerIds = [];
  state.smallBlindSeatIndex = -1;
  state.bigBlindSeatIndex = -1;
  return state;
}

// ── Main reducer ──

export function gameReducer(
  prevState: GameState,
  event: GameEvent
): GameState {
  const state: GameState = structuredClone(prevState);

  switch (event.type) {
    // ────── SIT DOWN ──────
    // Players may sit at any time. If a hand is in progress, they join with
    // sitOutUntilBB=true and will participate once BB reaches their seat.
    case "SIT_DOWN": {
      if (!isValidSeatIndex(event.seatIndex) || !isValidChipCount(event.buyIn)) return prevState;
      if (playerAtSeat(event.seatIndex, state.players)) return prevState;
      if (state.players[event.playerId]) return prevState;

      state.players[event.playerId] = {
        id: event.playerId,
        name: event.name,
        seatIndex: event.seatIndex,
        stack: event.buyIn,
        holeCards: null,
        currentBet: 0,
        totalContribution: 0,
        isFolded: false,
        isAllIn: false,
        lastAction: null,
        sitOutUntilBB: state.phase !== "waiting",
      };
      return state;
    }

    // ────── STAND UP ──────
    case "STAND_UP": {
      const player = state.players[event.playerId];
      if (!player) return prevState;
      const isCommittedToCurrentHand =
        ACTIVE_HAND_PHASES.has(state.phase) &&
        (player.holeCards !== null || player.currentBet > 0 || player.totalContribution > 0 || !player.sitOutUntilBB);
      if (isCommittedToCurrentHand) return prevState;
      delete state.players[event.playerId];
      state.needsToAct = state.needsToAct.filter((id) => id !== event.playerId);
      state.closedActors = state.closedActors.filter((id) => id !== event.playerId);
      return state;
    }

    // ────── START HAND ──────
    case "START_HAND": {
      const playerList = Object.values(state.players);
      if (state.phase !== "waiting" && state.phase !== "showdown") return prevState;

      // When transitioning from showdown, clear sitOutUntilBB for all players
      // so that rebuyers are immediately eligible for the next hand.
      if (state.phase === "showdown") {
        for (const p of playerList) {
          if (p.stack > 0) p.sitOutUntilBB = false;
        }
      }

      // Eligible = not sitting out waiting for BB
      const eligiblePlayers = playerList.filter((p) => !p.sitOutUntilBB && p.stack > 0);
      if (eligiblePlayers.length < 2) {
        return state.phase === "showdown" ? resetTableToWaiting(state) : prevState;
      }

      for (const p of Object.values(state.players)) {
        p.holeCards = null;
        p.currentBet = 0;
        p.totalContribution = 0;
        p.isFolded = p.sitOutUntilBB || p.stack <= 0;
        p.isAllIn = p.stack <= 0;
        p.lastAction = null;
      }
      state.communityCards = [];
      state.communityCards2 = [];
      state.isBombPot = false;
      state.bombPotVote = null;
      state.pot = 0;
      state.roundBet = 0;
      state.closedActors = [];
      state.sidePots = [];
      state.winners = null;
      state.showdownKind = "none";
      state.runItVotes = {};
      state.runCount = 1;
      state.runResults = [];
      state.autoRevealWinningHands = false;
      state.autoRevealWinningHandsAt = null;
      state.knownCardCountAtRunIt = 0;
      state.runDealStartedAt = null;
      state.showdownStartedAt = null;
      state.sevenTwoBountyTrigger = null;
      state.voluntaryShownPlayerIds = [];
      state.isBlindIncomplete = false;

      // Moving Button rule (online poker standard). Dead Button (TDA Rule 7)
      // is a live-casino convention and is intentionally not implemented.
      const dealerSeat =
        state.dealerSeatIndex < 0
          ? eligiblePlayers[0].seatIndex
          : nextEligibleSeat(state.dealerSeatIndex, state.players);
      state.dealerSeatIndex = dealerSeat;

      state.deck = shuffle(createDeck());

      const numEligible = eligiblePlayers.length;
      let sbSeat: number;
      let bbSeat: number;

      if (numEligible === 2) {
        sbSeat = dealerSeat;
        bbSeat = nextEligibleSeat(dealerSeat, state.players);
      } else {
        sbSeat = nextEligibleSeat(dealerSeat, state.players);
        bbSeat = nextEligibleSeat(sbSeat, state.players);
      }

      state.smallBlindSeatIndex = sbSeat;
      state.bigBlindSeatIndex = bbSeat;

      // Clear sitOutUntilBB for the BB player (BB reaching them lets them in)
      const bbPlayer = playerAtSeat(bbSeat, state.players)!;
      if (bbPlayer.sitOutUntilBB) bbPlayer.sitOutUntilBB = false;

      // Remove BB player from bomb pot cooldown (orbit complete)
      state.bombPotCooldown = state.bombPotCooldown.filter((id) => id !== bbPlayer.id);

      // Re-validate scheduled bomb pots against the players who are actually
      // about to enter this hand. If anyone can no longer cover the ante,
      // the table falls back to a normal hand.
      if (state.bombPotNextHand) {
        const anteCents = state.bombPotNextHand.anteBB * state.blinds.big;
        const bombPotEntrants = playersFromSeat((dealerSeat + 1) % MAX_SEATS, state.players)
          .filter((p) => !p.sitOutUntilBB && p.stack > 0);
        const canCoverAnte = bombPotEntrants.every((p) => p.stack >= anteCents);
        if (!canCoverAnte) {
          state.bombPotNextHand = null;
        }
      }

      const sbPlayer = playerAtSeat(sbSeat, state.players)!;

      const sbAmount = Math.min(state.blinds.small, sbPlayer.stack);
      sbPlayer.stack -= sbAmount;
      sbPlayer.currentBet = sbAmount;
      sbPlayer.totalContribution = sbAmount;
      if (sbPlayer.stack === 0) sbPlayer.isAllIn = true;

      const bbAmount = Math.min(state.blinds.big, bbPlayer.stack);
      bbPlayer.stack -= bbAmount;
      bbPlayer.currentBet = bbAmount;
      bbPlayer.totalContribution = bbAmount;
      if (bbPlayer.stack === 0) bbPlayer.isAllIn = true;

      state.roundBet = bbAmount;
      state.lastLegalRaiseIncrement = state.blinds.big; // always full BB, even if short-posted
      state.isBlindIncomplete = bbAmount < state.blinds.big;

      // Deal cards to every seated player who entered the hand, even if
      // posting a blind put them all-in before the deal.
      const dealOrder = playersFromSeat((dealerSeat + 1) % MAX_SEATS, state.players)
        .filter((p) => !p.sitOutUntilBB && !p.isFolded);
      for (const p of dealOrder) {
        p.holeCards = [state.deck.pop()!, state.deck.pop()!];
      }

      // ── Bomb pot hand ──
      if (state.bombPotNextHand) {
        const anteBB = state.bombPotNextHand.anteBB;
        const anteCents = anteBB * state.blinds.big;
        state.bombPotNextHand = null;

        // Undo the blinds that were just posted — bomb pot has antes instead
        for (const p of Object.values(state.players)) {
          p.stack += p.currentBet;
          p.totalContribution = 0;
          p.currentBet = 0;
          p.isAllIn = false;
        }
        state.roundBet = 0;
        state.isBlindIncomplete = false;

        // Collect antes from all eligible (dealing-order) players
        const anteDealOrder = playersFromSeat((dealerSeat + 1) % MAX_SEATS, state.players)
          .filter((p) => !p.sitOutUntilBB && p.stack > 0);
        for (const p of anteDealOrder) {
          const ante = Math.min(anteCents, p.stack);
          p.stack -= ante;
          p.totalContribution = ante;
          if (p.stack === 0) p.isAllIn = true;
        }
        state.pot = anteDealOrder.reduce((sum, p) => sum + p.totalContribution, 0);

        // Deal both flops from the same deck
        state.deck.pop(); // burn
        state.communityCards = [state.deck.pop()!, state.deck.pop()!, state.deck.pop()!];
        state.deck.pop(); // burn
        state.communityCards2 = [state.deck.pop()!, state.deck.pop()!, state.deck.pop()!];

        state.isBombPot = true;
        state.runCount = 2;
        state.phase = "flop";
        state.handNumber += 1;

        const firstSeatBP = (dealerSeat + 1) % MAX_SEATS;
        const bpActors = activePlayerIdsFrom(firstSeatBP, state.players)
          .filter((id) => !state.players[id]?.sitOutUntilBB);

        if (bpActors.length <= 1) return runOutBombPot(state);
        state.needsToAct = bpActors;
        return state;
      }

      state.phase = "pre-flop";
      state.handNumber += 1;

      const utgSeat = (bbSeat + 1) % MAX_SEATS;
      const actors = activePlayerIdsFrom(utgSeat, state.players)
        .filter((id) => !state.players[id]?.sitOutUntilBB);

      if (actors.length === 0) {
        return enterVotingOrRunOut(state);
      }

      if (shouldForceRunoutPreflop(state)) {
        return enterVotingOrRunOut(state);
      }

      state.needsToAct = actors;
      return state;
    }

    // ────── PLAYER ACTION ──────
    case "PLAYER_ACTION": {
      const player = state.players[event.playerId];
      if (!player) return prevState;
      if (state.needsToAct[0] !== event.playerId) return prevState;

      switch (event.action) {
        case "fold": {
          player.isFolded = true;
          player.lastAction = "fold";
          state.needsToAct = state.needsToAct.filter((id) => id !== event.playerId);
          state.closedActors = state.closedActors.filter((id) => id !== event.playerId);
          break;
        }

        case "check": {
          if (state.roundBet !== player.currentBet) return prevState;
          player.lastAction = "check";
          state.needsToAct.shift();
          state.closedActors.push(event.playerId);
          break;
        }

        case "call": {
          const callAmount = Math.min(
            state.roundBet - player.currentBet,
            player.stack
          );
          player.stack -= callAmount;
          player.currentBet += callAmount;
          player.totalContribution += callAmount;
          if (player.stack === 0) player.isAllIn = true;
          player.lastAction = player.isAllIn ? "all-in" : "call";
          state.needsToAct.shift();
          if (!player.isAllIn) {
            state.closedActors.push(event.playerId);
          }
          break;
        }

        case "raise": {
          const raiseTotal = event.amount ?? (state.roundBet + state.lastLegalRaiseIncrement);

          // Completion rule: a "raise" that merely reaches the full BB when the
          // blind was short-posted is a completion, not a raise. It does NOT
          // clear closedActors or update lastLegalRaiseIncrement.
          if (state.isBlindIncomplete && raiseTotal <= state.blinds.big) {
            const cost = raiseTotal - player.currentBet;
            if (cost < 0 || cost > player.stack) return prevState;
            player.stack -= cost;
            player.currentBet = raiseTotal;
            player.totalContribution += cost;
            if (player.stack === 0) player.isAllIn = true;
            player.lastAction = player.isAllIn ? "all-in" : "call";
            state.roundBet = raiseTotal;
            state.isBlindIncomplete = false;
            state.needsToAct.shift();
            if (!player.isAllIn) state.closedActors.push(event.playerId);
            break;
          }

          const threshold = fullRaiseThreshold(state.roundBet, state.lastLegalRaiseIncrement);

          if (raiseTotal < threshold) return prevState;
          const raiseCost = raiseTotal - player.currentBet;
          if (raiseCost > player.stack) return prevState;

          const oldRoundBet = state.roundBet;

          player.stack -= raiseCost;
          player.currentBet = raiseTotal;
          player.totalContribution += raiseCost;
          state.roundBet = raiseTotal;
          state.lastLegalRaiseIncrement = raiseTotal - oldRoundBet;
          state.isBlindIncomplete = false;
          if (player.stack === 0) player.isAllIn = true;
          player.lastAction = "raise";

          state.closedActors = [];
          const nextSeat = (player.seatIndex + 1) % MAX_SEATS;
          state.needsToAct = activePlayerIdsFrom(nextSeat, state.players).filter(
            (id) => id !== event.playerId
          );
          break;
        }

        case "all-in": {
          const allInAmount = player.stack;
          const allInNewTotal = player.currentBet + allInAmount;

          player.stack = 0;
          player.totalContribution += allInAmount;
          player.currentBet = allInNewTotal;
          player.isAllIn = true;
          player.lastAction = "all-in";

          // Completion via all-in: player goes all-in but only reaches up to the full BB
          if (state.isBlindIncomplete && allInNewTotal <= state.blinds.big) {
            if (allInNewTotal > state.roundBet) state.roundBet = allInNewTotal;
            if (allInNewTotal >= state.blinds.big) state.isBlindIncomplete = false;
            // Not a raise — don't clear closedActors or update lastLegalRaiseIncrement
            state.needsToAct = state.needsToAct.filter((id) => id !== event.playerId);
            // Re-queue closed actors who haven't matched the new roundBet
            const behindActors = state.closedActors.filter((id) => {
              const p = state.players[id];
              return p && !p.isFolded && !p.isAllIn && p.currentBet < state.roundBet;
            });
            if (behindActors.length > 0) {
              const nextSeat = (player.seatIndex + 1) % MAX_SEATS;
              state.needsToAct = sortBySeatOrder(
                [...new Set([...state.needsToAct, ...behindActors])], nextSeat, state.players
              );
            }
            break;
          }

          const oldRoundBet = state.roundBet;

          const threshold = fullRaiseThreshold(state.roundBet, state.lastLegalRaiseIncrement);
          const isFullRaise = allInNewTotal >= threshold;
          const raisesRoundBet = allInNewTotal > state.roundBet;

          if (isFullRaise) {
            state.roundBet = allInNewTotal;
            state.lastLegalRaiseIncrement = allInNewTotal - oldRoundBet;
            state.closedActors = [];
            const nextSeat = (player.seatIndex + 1) % MAX_SEATS;
            state.needsToAct = activePlayerIdsFrom(nextSeat, state.players).filter(
              (id) => id !== event.playerId
            );
          } else if (raisesRoundBet) {
            state.roundBet = allInNewTotal;
            state.needsToAct = state.needsToAct.filter((id) => id !== event.playerId);

            const closedNeedMore = state.closedActors.filter((id) => {
              const p = state.players[id];
              return p && !p.isFolded && !p.isAllIn && p.currentBet < allInNewTotal;
            });

            if (closedNeedMore.length > 0) {
              const nextSeat = (player.seatIndex + 1) % MAX_SEATS;
              const combined = [...new Set([...state.needsToAct, ...closedNeedMore])];
              state.needsToAct = sortBySeatOrder(combined, nextSeat, state.players);
            }
          } else {
            state.needsToAct.shift();
          }
          break;
        }
      }

      // Only one non-folded player: uncontested win
      if (countActive(state.players) === 1) {
        const winner = Object.values(state.players).find((p) => p.holeCards !== null && !p.isFolded)!;
        const totalPot = state.pot + sumCurrentBets(state.players);
        winner.stack += totalPot;

        for (const p of Object.values(state.players)) p.currentBet = 0;

        state.phase = "showdown";
        state.pot = 0;
        state.needsToAct = [];
        state.closedActors = [];
        state.runResults = [];
        state.winners = [{ playerId: winner.id, amount: totalPot, hand: null }];
        state.showdownKind = "uncontested";
        state.autoRevealWinningHands = false;
        state.autoRevealWinningHandsAt = null;
        state.knownCardCountAtRunIt = 0;
        state.runDealStartedAt = null;
        state.showdownStartedAt = null;
        state.sevenTwoBountyTrigger = null;
        state.voluntaryShownPlayerIds = [];
        return state;
      }

      if (hasNoFurtherActionAgainstAllIn(state)) {
        state.needsToAct = [];
      }

      if (state.needsToAct.length === 0) {
        return advanceStreet(state);
      }

      return state;
    }

    // ────── VOTE_RUN ──────
    case "VOTE_RUN": {
      if (state.phase !== "voting") return prevState;
      const player = state.players[event.playerId];
      if (!player || player.isFolded) return prevState;

      state.runItVotes[event.playerId] = event.count;

      const nonFoldedIds = Object.values(state.players)
        .filter((p) => p.holeCards !== null && !p.isFolded)
        .map((p) => p.id);
      const allVoted = nonFoldedIds.every((id) => state.runItVotes[id] !== undefined);

      if (allVoted) {
        const votes = nonFoldedIds.map((id) => state.runItVotes[id]!);
        const unanimous = votes.every((v) => v === votes[0]);
        const runCount: 1 | 2 | 3 = unanimous ? votes[0] : 1;
        return dealMultipleRuns(state, runCount);
      }

      return state;
    }

    // ────── RESOLVE_VOTE ──────
    case "RESOLVE_VOTE": {
      if (state.phase !== "voting") return prevState;

      const nonFoldedIds = Object.values(state.players)
        .filter((p) => p.holeCards !== null && !p.isFolded)
        .map((p) => p.id);
      const votes = nonFoldedIds
        .map((id) => state.runItVotes[id])
        .filter((v): v is 1 | 2 | 3 => v !== undefined);
      const unanimous =
        votes.length === nonFoldedIds.length && votes.every((v) => v === votes[0]);
      const runCount: 1 | 2 | 3 = unanimous ? votes[0] : 1;

      return dealMultipleRuns(state, runCount);
    }

    // ────── SET_SEVEN_TWO_BOUNTY ──────
    case "SET_SEVEN_TWO_BOUNTY": {
      // Only configurable before any hands are played
      if (state.handNumber > 0) return prevState;
      state.sevenTwoBountyBB = event.bountyBB;
      return state;
    }

    // ────── SHOW_CARDS ──────
    case "SHOW_CARDS": {
      if (state.phase !== "showdown") return prevState;
      const player = state.players[event.playerId];
      if (!player) return prevState;
      if (!state.voluntaryShownPlayerIds.includes(event.playerId)) {
        state.voluntaryShownPlayerIds.push(event.playerId);
      }
      // Fire 7-2 bounty for uncontested winner who chose to show
      const isUncontested = state.showdownKind === "uncontested" && state.winners?.length === 1;
      if (
        state.sevenTwoBountyBB > 0 &&
        !state.sevenTwoBountyTrigger &&
        isUncontested &&
        state.winners?.[0].playerId === event.playerId &&
        hasSevTwoOffsuit(player.holeCards)
      ) {
        applySevenTwoBounty(state, event.playerId);
      }
      return state;
    }

    // ────── PROPOSE_BOMB_POT ──────
    case "PROPOSE_BOMB_POT": {
      if (state.phase === "voting") return prevState; // run-it voting in progress
      if (state.bombPotVote !== null) return prevState;
      if (state.bombPotNextHand !== null) return prevState; // already scheduled
      if (state.bombPotCooldown.includes(event.playerId)) return prevState;
      if (!state.players[event.playerId]) return prevState;

      state.bombPotCooldown.push(event.playerId);
      state.bombPotVote = {
        anteBB: event.anteBB,
        proposedBy: event.playerId,
        votes: { [event.playerId]: true },
      };

      // Immediately pass if all seated players have already approved
      const allPlayerIds = Object.keys(state.players);
      if (allPlayerIds.every((id) => state.bombPotVote!.votes[id] === true)) {
        state.bombPotNextHand = { anteBB: event.anteBB };
        state.bombPotVote = null;
      }
      return state;
    }

    // ────── VOTE_BOMB_POT ──────
    case "VOTE_BOMB_POT": {
      if (!state.bombPotVote) return prevState;
      if (!state.players[event.playerId]) return prevState;

      state.bombPotVote.votes[event.playerId] = event.approve;

      if (!event.approve) {
        state.bombPotVote = null;
        return state;
      }

      const allPlayerIds = Object.keys(state.players);
      if (allPlayerIds.every((id) => state.bombPotVote!.votes[id] === true)) {
        state.bombPotNextHand = { anteBB: state.bombPotVote.anteBB };
        state.bombPotVote = null;
      }
      return state;
    }

    default:
      return prevState;
  }
}

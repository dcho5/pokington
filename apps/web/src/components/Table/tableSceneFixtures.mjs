function createPublicPlayer({
  id,
  name,
  seatIndex,
  stack,
  currentBet = 0,
  isFolded = false,
  isAllIn = false,
  hasCards = true,
  lastAction = null,
}) {
  return {
    id,
    name,
    seatIndex,
    stack,
    holeCards: null,
    currentBet,
    totalContribution: currentBet,
    isFolded,
    isAllIn,
    hasCards,
    lastAction,
    sitOutUntilBB: false,
  };
}

function createBaseGameState(overrides = {}) {
  return {
    phase: "waiting",
    deckSize: 0,
    players: {
      p1: createPublicPlayer({ id: "p1", name: "Alex", seatIndex: 0, stack: 5000 }),
      p2: createPublicPlayer({ id: "p2", name: "Blake", seatIndex: 3, stack: 5000 }),
    },
    communityCards: [],
    pot: 0,
    roundBet: 0,
    lastLegalRaiseIncrement: 200,
    isBlindIncomplete: false,
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 0,
    bigBlindSeatIndex: 3,
    blinds: { small: 100, big: 200 },
    handNumber: 1,
    tableName: "Fixture Table",
    needsToAct: [],
    closedActors: [],
    sidePots: [],
    winners: null,
    showdownKind: "none",
    runItVotes: {},
    runCount: 1,
    runResults: [],
    autoRevealWinningHands: false,
    autoRevealWinningHandsAt: null,
    sevenTwoBountyBB: 0,
    sevenTwoBountyTrigger: null,
    voluntaryShownPlayerIds: [],
    communityCards2: [],
    isBombPot: false,
    bombPotVote: null,
    bombPotNextHand: null,
    bombPotCooldown: [],
    ...overrides,
  };
}

function createTimingFlags(overrides = {}) {
  return {
    votingStartedAt: null,
    streetPauseChips: null,
    streetSweeping: false,
    runAnnouncement: null,
    isRunItBoard: false,
    knownCardCountAtRunIt: 0,
    runDealStartedAt: null,
    showdownStartedAt: null,
    sevenTwoAnnouncement: null,
    bombPotAnnouncement: null,
    ...overrides,
  };
}

function createSessionContext(overrides = {}) {
  return {
    code: "abcd",
    myPlayerId: "p1",
    myUserId: "user-1",
    connectionStatus: "connected",
    tableNotFound: false,
    isFirstStateReceived: true,
    isCreator: true,
    ...overrides,
  };
}

function createClientUiState(overrides = {}) {
  return {
    viewingSeat: 0,
    revealedHoleCards: {},
    myHoleCards: [
      { rank: "A", suit: "spades" },
      { rank: "K", suit: "spades" },
    ],
    myRevealedCardIndices: new Set(),
    peekedCounts: {},
    showdownPlayerSnapshot: {},
    leaveQueued: false,
    awayPlayerIds: [],
    currentRun: 0,
    revealedCount: 0,
    settledRunCount: 0,
    publicShowdownRevealComplete: false,
    ...overrides,
  };
}

export const reconnectOverlay_before = {
  gameState: createBaseGameState(),
  timingFlags: createTimingFlags(),
  sessionContext: createSessionContext({ isFirstStateReceived: false }),
  clientUiState: createClientUiState(),
};

export const reconnectOverlay_after = {
  gameState: createBaseGameState({ phase: "pre-flop", needsToAct: ["p1"] }),
  timingFlags: createTimingFlags(),
  sessionContext: createSessionContext({ isFirstStateReceived: true }),
  clientUiState: createClientUiState(),
};

export const showdownEnd_before = {
  gameState: createBaseGameState({
    phase: "showdown",
    communityCards: [
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "hearts" },
      { rank: "Q", suit: "hearts" },
      { rank: "J", suit: "hearts" },
      { rank: "T", suit: "hearts" },
    ],
    winners: [{ playerId: "p1", amount: 1200, hand: "Royal Flush" }],
    showdownKind: "contested",
  }),
  timingFlags: createTimingFlags({ showdownStartedAt: 0 }),
  sessionContext: createSessionContext(),
  clientUiState: createClientUiState({ settledRunCount: 0 }),
};

export const showdownEnd_event = { type: "START_HAND" };

export const showdownEnd_after = {
  gameState: createBaseGameState({
    phase: "pre-flop",
    handNumber: 2,
    communityCards: [],
    pot: 0,
    winners: null,
    showdownKind: "none",
    needsToAct: ["p1"],
  }),
  timingFlags: createTimingFlags(),
  sessionContext: createSessionContext(),
  clientUiState: createClientUiState(),
};

export const runItVoteDeal_before = {
  gameState: createBaseGameState({
    phase: "voting",
    communityCards: [
      { rank: "A", suit: "hearts" },
      { rank: "Q", suit: "clubs" },
      { rank: "9", suit: "spades" },
    ],
    runItVotes: { p1: 2, p2: 2 },
    needsToAct: [],
  }),
  timingFlags: createTimingFlags({
    votingStartedAt: 10,
    isRunItBoard: true,
    knownCardCountAtRunIt: 3,
  }),
  sessionContext: createSessionContext(),
  clientUiState: createClientUiState(),
};

export const runItVoteDeal_event = { type: "RESOLVE_VOTE" };

export const runItVoteDeal_after = {
  gameState: createBaseGameState({
    phase: "showdown",
    communityCards: [
      { rank: "A", suit: "hearts" },
      { rank: "Q", suit: "clubs" },
      { rank: "9", suit: "spades" },
    ],
    runCount: 2,
    runResults: [
      {
        board: [
          { rank: "A", suit: "hearts" },
          { rank: "Q", suit: "clubs" },
          { rank: "9", suit: "spades" },
          { rank: "2", suit: "diamonds" },
          { rank: "3", suit: "clubs" },
        ],
        winners: [{ playerId: "p1", amount: 600, hand: "Pair of Aces" }],
      },
      {
        board: [
          { rank: "A", suit: "hearts" },
          { rank: "Q", suit: "clubs" },
          { rank: "9", suit: "spades" },
          { rank: "K", suit: "diamonds" },
          { rank: "J", suit: "clubs" },
        ],
        winners: [{ playerId: "p2", amount: 600, hand: "Straight" }],
      },
    ],
    winners: [
      { playerId: "p1", amount: 600, hand: "Pair of Aces" },
      { playerId: "p2", amount: 600, hand: "Straight" },
    ],
    showdownKind: "contested",
  }),
  timingFlags: createTimingFlags({
    runAnnouncement: 2,
    isRunItBoard: true,
    knownCardCountAtRunIt: 3,
    showdownStartedAt: 100,
  }),
  sessionContext: createSessionContext(),
  clientUiState: createClientUiState({
    currentRun: 0,
    revealedCount: 3,
    settledRunCount: 0,
  }),
};

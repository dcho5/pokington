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
    boundaryPausePlayers: null,
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

export const waitingOpenSeats = reconnectOverlay_before;

export const activeHand = {
  ...reconnectOverlay_after,
  gameState: createBaseGameState({
    phase: "turn",
    communityCards: [
      { rank: "A", suit: "hearts" },
      { rank: "Q", suit: "clubs" },
      { rank: "9", suit: "spades" },
      { rank: "2", suit: "diamonds" },
    ],
    pot: 1800,
    roundBet: 800,
    needsToAct: ["p1"],
    players: {
      p1: createPublicPlayer({
        id: "p1",
        name: "Alex",
        seatIndex: 0,
        stack: 3600,
        currentBet: 800,
      }),
      p2: createPublicPlayer({
        id: "p2",
        name: "Blake",
        seatIndex: 3,
        stack: 2800,
        currentBet: 800,
        lastAction: "call",
      }),
      p3: createPublicPlayer({
        id: "p3",
        name: "Casey",
        seatIndex: 6,
        stack: 5400,
        currentBet: 0,
        isFolded: true,
        hasCards: false,
        lastAction: "fold",
      }),
    },
  }),
  timingFlags: createTimingFlags(),
  sessionContext: createSessionContext(),
  clientUiState: createClientUiState(),
};

export const showdownComplete = {
  ...showdownEnd_before,
  clientUiState: createClientUiState({
    settledRunCount: 1,
    publicShowdownRevealComplete: true,
  }),
};

export const bombPotShowdown = {
  ...runItVoteDeal_after,
  gameState: createBaseGameState({
    phase: "showdown",
    isBombPot: true,
    communityCards: [
      { rank: "A", suit: "hearts" },
      { rank: "Q", suit: "clubs" },
      { rank: "9", suit: "spades" },
      { rank: "2", suit: "diamonds" },
      { rank: "3", suit: "clubs" },
    ],
    communityCards2: [
      { rank: "K", suit: "spades" },
      { rank: "K", suit: "clubs" },
      { rank: "4", suit: "hearts" },
      { rank: "7", suit: "diamonds" },
      { rank: "T", suit: "clubs" },
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
        winners: [{ playerId: "p1", amount: 900, hand: "Pair of Aces" }],
      },
      {
        board: [
          { rank: "K", suit: "spades" },
          { rank: "K", suit: "clubs" },
          { rank: "4", suit: "hearts" },
          { rank: "7", suit: "diamonds" },
          { rank: "T", suit: "clubs" },
        ],
        winners: [{ playerId: "p2", amount: 900, hand: "Pair of Kings" }],
      },
    ],
    winners: [
      { playerId: "p1", amount: 900, hand: "Pair of Aces" },
      { playerId: "p2", amount: 900, hand: "Pair of Kings" },
    ],
    showdownKind: "contested",
    players: {
      p1: createPublicPlayer({ id: "p1", name: "Alex", seatIndex: 0, stack: 4100 }),
      p2: createPublicPlayer({ id: "p2", name: "Blake", seatIndex: 3, stack: 3900 }),
      p3: createPublicPlayer({ id: "p3", name: "Casey", seatIndex: 7, stack: 5000, hasCards: false, isFolded: true }),
    },
  }),
  timingFlags: createTimingFlags({
    isRunItBoard: false,
    knownCardCountAtRunIt: 5,
    showdownStartedAt: 100,
  }),
  sessionContext: createSessionContext(),
  clientUiState: createClientUiState({
    settledRunCount: 2,
    publicShowdownRevealComplete: true,
  }),
};

export const TABLE_RENDER_FIXTURES = {
  "reconnect-overlay": reconnectOverlay_before,
  "waiting-open-seats": waitingOpenSeats,
  "active-hand": activeHand,
  "showdown-complete": showdownComplete,
  "run-it": runItVoteDeal_after,
  "bomb-pot": bombPotShowdown,
};

export function getTableRenderFixture(name) {
  return TABLE_RENDER_FIXTURES[name] ?? null;
}

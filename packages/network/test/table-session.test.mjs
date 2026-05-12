import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTableSessionState,
  isPlayerQueuedToLeave,
  reduceTableSessionMessage,
} from "../dist/index.js";

test("table session reducer consumes the shared PartyKit server messages", () => {
  let state = createTableSessionState();
  state = reduceTableSessionMessage(state, {
    type: "WELCOME",
    playerSessionId: "player-1",
    isCreator: true,
  });
  state = reduceTableSessionMessage(state, {
    type: "TABLE_STATE",
    state: { phase: "waiting", handNumber: 0 },
  });
  state = reduceTableSessionMessage(state, {
    type: "PRIVATE_STATE",
    holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
    revealedHoleCards: { "player-1": [null, { rank: "K", suit: "spades" }] },
    peekedCardMask: 2,
  });
  state = reduceTableSessionMessage(state, {
    type: "ROOM_PRESENCE",
    connectedPlayerIds: ["player-1"],
    awayPlayerIds: [],
    peekedCounts: { "player-1": 1 },
    queuedLeavePlayerIds: ["player-1"],
  });
  state = reduceTableSessionMessage(state, {
    type: "LEDGER_STATE",
    entries: [{ playerId: "player-1", buyIns: [1000] }],
  });

  assert.equal(state.myPlayerId, "player-1");
  assert.equal(state.isCreator, true);
  assert.equal(state.firstStateReceived, true);
  assert.equal(state.gameState.phase, "waiting");
  assert.equal(state.peekedCardMask, 2);
  assert.deepEqual(state.peekedCounts, { "player-1": 1 });
  assert.equal(isPlayerQueuedToLeave(state), true);
  assert.equal(state.ledger[0].playerId, "player-1");
});

test("table session reducer separates action and terminal errors", () => {
  let state = createTableSessionState();
  state = reduceTableSessionMessage(state, {
    type: "ERROR",
    code: "ACTION_REJECTED",
    message: "Not your turn",
  });
  assert.equal(state.actionErrorMessage, "Not your turn");
  assert.equal(state.terminalErrorCode, null);

  state = reduceTableSessionMessage(state, {
    type: "ERROR",
    code: "TABLE_NOT_ACTIVE",
    message: "Table is not active",
  });
  assert.equal(state.actionErrorMessage, "Not your turn");
  assert.equal(state.terminalErrorCode, "TABLE_NOT_ACTIVE");
});

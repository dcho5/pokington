import test from "node:test";
import assert from "node:assert/strict";

import { deriveTableScene } from "./tableScene.mjs";
import {
  reconnectOverlay_before,
  reconnectOverlay_after,
  showdownEnd_before,
  showdownEnd_event,
  showdownEnd_after,
  runItVoteDeal_before,
  runItVoteDeal_event,
  runItVoteDeal_after,
} from "./tableSceneFixtures.mjs";

test("derives waiting table scene with unlocked seat selection before a player sits", () => {
  const scene = deriveTableScene(reconnectOverlay_before);

  assert.equal(scene.layout.phase, "waiting");
  assert.equal(scene.layout.seatSelectionLocked, false);
  assert.equal(scene.layout.players[0]?.isYou, true);
  assert.equal(scene.layout.isAdmin, true);
});

test("reconnectOverlay fixtures transition from blocking overlay to active table", () => {
  const before = deriveTableScene(reconnectOverlay_before);
  const after = deriveTableScene(reconnectOverlay_after);

  assert.equal(before.showBlockingConnectionOverlay, true);
  assert.equal(before.showReconnectIndicator, false);
  assert.equal(after.showBlockingConnectionOverlay, false);
  assert.equal(after.layout.phase, "pre-flop");
});

test("showdownEnd fixtures expose a visible pot before next-hand reset", () => {
  const before = deriveTableScene(showdownEnd_before);
  const after = deriveTableScene(showdownEnd_after);

  assert.equal(showdownEnd_event.type, "START_HAND");
  assert.equal(before.layout.phase, "showdown");
  assert.equal(before.layout.pot, 1200);
  assert.equal(before.layout.winners?.[0]?.playerId, "p1");
  assert.equal(after.layout.phase, "pre-flop");
  assert.equal(after.layout.pot, 0);
  assert.equal(after.layout.winners, null);
});

test("runItVoteDeal fixtures keep the announcement active before the run-it board starts dealing", () => {
  const before = deriveTableScene(runItVoteDeal_before);
  const after = deriveTableScene(runItVoteDeal_after);

  assert.equal(runItVoteDeal_event.type, "RESOLVE_VOTE");
  assert.equal(before.layout.phase, "voting");
  assert.equal(before.layout.viewerCanVote, true);
  assert.equal(after.layout.phase, "showdown");
  assert.equal(after.layout.runAnnouncement, 2);
  assert.equal(after.layout.isRunItBoard, true);
  assert.equal(after.layout.animatedShowdownReveal, true);
  assert.equal(after.layout.showWinnerBanner, false);
  assert.equal(after.layout.runDealStartedAt, null);
});

test("animated showdown winner banner waits for the public board reveal to finish", () => {
  const hidden = deriveTableScene({
    ...runItVoteDeal_after,
    clientUiState: {
      ...runItVoteDeal_after.clientUiState,
      settledRunCount: 2,
      publicShowdownRevealComplete: false,
    },
  });
  const revealed = deriveTableScene({
    ...runItVoteDeal_after,
    clientUiState: {
      ...runItVoteDeal_after.clientUiState,
      settledRunCount: 2,
      publicShowdownRevealComplete: true,
    },
  });

  assert.equal(hidden.layout.showWinnerBanner, false);
  assert.equal(revealed.layout.showWinnerBanner, true);
  assert.equal(revealed.layout.publicShowdownRevealComplete, true);
});

test("showdown scene annotates the viewer with deferred win styling", () => {
  const scene = deriveTableScene(showdownEnd_before);

  assert.equal(scene.layout.handIndicators[0]?.label, "Straight Flush");
  assert.equal(scene.layout.players[0]?.winType, undefined);
  assert.equal(scene.layout.canShowCards, true);
});

test("showdown keeps winner seat data from the snapshot after a stand-up", () => {
  const scene = deriveTableScene({
    ...showdownEnd_before,
    gameState: {
      ...showdownEnd_before.gameState,
      players: {
        p2: showdownEnd_before.gameState.players.p2,
      },
    },
    clientUiState: {
      ...showdownEnd_before.clientUiState,
      showdownPlayerSnapshot: showdownEnd_before.gameState.players,
    },
  });

  assert.equal(scene.layout.players[0]?.id, "p1");
  assert.equal(scene.layout.players[0]?.name, "Alex");
  assert.equal(scene.layout.winners?.[0]?.playerId, "p1");
});

test("live-hand scene keeps tabling available even when it is not the viewer's turn", () => {
  const scene = deriveTableScene({
    ...reconnectOverlay_after,
    gameState: {
      ...reconnectOverlay_after.gameState,
      needsToAct: ["p2"],
    },
  });

  assert.equal(scene.layout.isYourTurn, false);
  assert.equal(scene.layout.canShowCards, true);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveNativeHapticPattern } from "../dist/lib/nativeHaptics.js";

test("native haptics emphasize local turn changes", () => {
  assert.equal(
    resolveNativeHapticPattern({
      kind: "turn_changed",
      key: "turn-local",
      handNumber: 1,
      phase: "flop",
      emittedAt: 1,
      source: "server",
      actorId: "me",
      previousActorId: "them",
    }, { myPlayerId: "me" }),
    "medium",
  );
  assert.equal(
    resolveNativeHapticPattern({
      kind: "turn_changed",
      key: "turn-other",
      handNumber: 1,
      phase: "flop",
      emittedAt: 1,
      source: "server",
      actorId: "them",
      previousActorId: "me",
    }, { myPlayerId: "me" }),
    null,
  );
});

test("native haptics map strong game moments to stronger patterns", () => {
  assert.equal(
    resolveNativeHapticPattern({
      kind: "player_action_confirmed",
      key: "all-in",
      handNumber: 1,
      phase: "turn",
      emittedAt: 1,
      source: "action",
      playerId: "me",
      action: "all-in",
      currentBet: 100,
      totalContribution: 100,
      isAllIn: true,
    }, { myPlayerId: "me" }),
    "heavy",
  );
  assert.equal(
    resolveNativeHapticPattern({
      kind: "pot_awarded",
      key: "pot",
      handNumber: 1,
      phase: "showdown",
      emittedAt: 1,
      source: "server",
      winnerPlayerIds: ["me"],
      totalAmount: 200,
    }, { myPlayerId: "me" }),
    "success",
  );
});

test("native haptics include local press and error patterns", () => {
  assert.equal(resolveNativeHapticPattern({ kind: "local_press", key: "tap" }, { myPlayerId: null }), "light");
  assert.equal(resolveNativeHapticPattern({ kind: "local_press", key: "raise", strength: "medium" }, { myPlayerId: null }), "medium");
  assert.equal(resolveNativeHapticPattern({ kind: "action_error", key: "blocked" }, { myPlayerId: null }), "warning");
});

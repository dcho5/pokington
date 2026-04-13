import test from "node:test";
import assert from "node:assert/strict";

import {
  authenticatePresence,
  buildRoomPresenceSnapshot,
  disconnectPresence,
  setAwayPresence,
} from "./presenceTracking.mjs";

test("authenticatePresence clears stale away state when a client reconnects", () => {
  const clientIdToConnId = new Map([["client-a", "conn-old"]]);
  const connIdToClientId = new Map([["conn-old", "client-a"]]);
  const clientIdToPlayerSessionId = new Map([["client-a", "player-a"]]);
  const awayClientIds = new Set(["client-a"]);

  authenticatePresence(
    { clientIdToConnId, connIdToClientId, awayClientIds },
    "client-a",
    "conn-new",
  );

  assert.equal(clientIdToConnId.get("client-a"), "conn-new");
  assert.equal(connIdToClientId.has("conn-old"), false);
  assert.deepEqual(buildRoomPresenceSnapshot(clientIdToConnId, clientIdToPlayerSessionId, awayClientIds), {
    connectedPlayerIds: ["player-a"],
    awayPlayerIds: [],
  });
});

test("disconnectPresence ignores stale sockets after a reconnect", () => {
  const clientIdToConnId = new Map([["client-a", "conn-new"]]);
  const connIdToClientId = new Map([["conn-new", "client-a"]]);
  const awayClientIds = new Set();

  assert.equal(
    disconnectPresence({ clientIdToConnId, connIdToClientId, awayClientIds }, "conn-old"),
    null,
  );
  assert.equal(clientIdToConnId.get("client-a"), "conn-new");
  assert.equal(connIdToClientId.get("conn-new"), "client-a");
});

test("room presence filters unknown clients and de-duplicates repeated player mappings", () => {
  const clientIdToConnId = new Map([
    ["client-a", "conn-1"],
    ["client-b", "conn-2"],
    ["client-ghost", "conn-3"],
  ]);
  const clientIdToPlayerSessionId = new Map([
    ["client-a", "player-a"],
    ["client-b", "player-a"],
  ]);
  const awayClientIds = new Set(["client-b", "client-ghost"]);

  assert.deepEqual(buildRoomPresenceSnapshot(clientIdToConnId, clientIdToPlayerSessionId, awayClientIds), {
    connectedPlayerIds: ["player-a"],
    awayPlayerIds: ["player-a"],
  });
});

test("setAwayPresence toggles a client cleanly in both directions", () => {
  const awayClientIds = new Set();

  setAwayPresence(awayClientIds, "client-a", true);
  assert.deepEqual(Array.from(awayClientIds), ["client-a"]);

  setAwayPresence(awayClientIds, "client-a", false);
  assert.deepEqual(Array.from(awayClientIds), []);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIENT_ID_STORAGE_KEY,
  buildPartyKitWebSocketUrl,
  createNativeGameConnection,
  createWebGameConnection,
  getOrCreateNativeClientId,
  resolveNativePartyKitHost,
} from "../dist/index.js";

class MockSocket {
  sent = [];
  listeners = new Map();
  closed = false;

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.closed = true;
    this.emit("close", {});
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((next) => next !== listener));
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const joinToken = {
  token: "join-token",
  tableId: "ABC123",
  playerSessionId: "session-1",
  isCreator: true,
};

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("web adapter authenticates and dispatches messages through the shared contract", async () => {
  const socket = new MockSocket();
  const statuses = [];
  const joins = [];
  const messages = [];
  const states = [];

  const connection = createWebGameConnection({
    host: "http://localhost:1999/",
    roomId: "ABC123",
    clientId: "client-1",
    protocolVersion: 4,
    join: async () => joinToken,
    getInitialAway: () => true,
    createSocket: (host, roomId) => {
      assert.equal(host, "localhost:1999");
      assert.equal(roomId, "ABC123");
      return socket;
    },
    onStatusChange: (status) => statuses.push(status),
    onJoin: (join) => joins.push(join),
    onMessage: (message) => messages.push(message),
  });
  connection.subscribeToState((state) => states.push(state));

  await tick();
  socket.emit("open", {});

  assert.deepEqual(joins, [joinToken]);
  assert.deepEqual(socket.sent.slice(0, 2), [
    { type: "AUTH", token: "join-token", protocolVersion: 4 },
    { type: "SET_AWAY", away: true },
  ]);

  socket.emit("message", { data: JSON.stringify({ type: "TABLE_STATE", state: { phase: "waiting" } }) });
  connection.sendAction({ type: "START_HAND" });
  connection.revealCard(1);
  connection.peekCard(0, 12);

  assert.deepEqual(states, [{ phase: "waiting" }]);
  assert.equal(messages[0].type, "TABLE_STATE");
  assert.deepEqual(socket.sent.slice(2), [
    { type: "GAME_EVENT", event: { type: "START_HAND" } },
    { type: "REVEAL_CARD", cardIndex: 1 },
    { type: "PEEK_CARD", cardIndex: 0, handNumber: 12 },
  ]);
  assert.deepEqual(statuses, ["connecting", "connected"]);
});

test("native adapter uses AsyncStorage client id, direct WebSocket URL, and AppState away updates", async () => {
  const socket = new MockSocket();
  const storage = new Map();
  const urls = [];
  const appStateListeners = [];
  const appState = {
    currentState: "background",
    addEventListener(event, listener) {
      assert.equal(event, "change");
      appStateListeners.push(listener);
      return {
        remove() {
          appStateListeners.splice(appStateListeners.indexOf(listener), 1);
        },
      };
    },
  };

  const connection = await createNativeGameConnection({
    roomId: "ROOM 1",
    protocolVersion: 4,
    storage: {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
    },
    createClientId: () => "native-client",
    explicitHost: "https://example.com/",
    appState,
    join: async ({ clientId, roomId }) => {
      assert.equal(clientId, "native-client");
      assert.equal(roomId, "ROOM 1");
      return joinToken;
    },
    createSocket: (url) => {
      urls.push(url);
      return socket;
    },
  });

  await tick();
  socket.emit("open", {});
  appStateListeners[0]("active");
  connection.queueLeave();
  connection.cancelQueuedLeave();

  assert.equal(storage.get(CLIENT_ID_STORAGE_KEY), "native-client");
  assert.deepEqual(urls, ["wss://example.com/parties/main/ROOM%201"]);
  assert.deepEqual(socket.sent, [
    { type: "AUTH", token: "join-token", protocolVersion: 4 },
    { type: "SET_AWAY", away: true },
    { type: "SET_AWAY", away: false },
    { type: "QUEUE_LEAVE" },
    { type: "CANCEL_QUEUE_LEAVE" },
  ]);
});

test("native helpers normalize host and persist existing client ids", async () => {
  assert.equal(resolveNativePartyKitHost({ requestHostname: "localhost:3000" }), "127.0.0.1:1999");
  assert.equal(resolveNativePartyKitHost({ requestHostname: "table.example.com" }), "table.example.com:1999");
  assert.equal(buildPartyKitWebSocketUrl("127.0.0.1:1999", "ABC123"), "ws://127.0.0.1:1999/parties/main/ABC123");

  const storage = new Map([[CLIENT_ID_STORAGE_KEY, "existing-client"]]);
  const clientId = await getOrCreateNativeClientId({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });
  assert.equal(clientId, "existing-client");
});

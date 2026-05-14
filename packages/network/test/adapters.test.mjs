import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIENT_ID_STORAGE_KEY,
  buildDirectControlPlaneUrlForTest,
  buildNativeControlPlaneUrlForTest,
  buildPartyKitWebSocketUrl,
  createTable,
  createNativeTable,
  createNativeGameConnection,
  createWebGameConnection,
  getTable,
  getNativeTable,
  getOrCreateNativeClientId,
  requestJoinToken,
  requestNativeJoinToken,
  requestQueuedSeatLeave,
  requestNativeQueuedSeatLeave,
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
    createSocket: (url) => {
      assert.equal(url, "ws://localhost:1999/parties/main/ABC123");
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

  assert.equal(storage.get(CLIENT_ID_STORAGE_KEY), "native-client");
  assert.deepEqual(urls, ["wss://example.com/parties/main/ROOM%201"]);
  assert.deepEqual(socket.sent, [
    { type: "AUTH", token: "join-token", protocolVersion: 4 },
    { type: "SET_AWAY", away: true },
    { type: "SET_AWAY", away: false },
  ]);
});

test("connection reconnects with a fresh join token after a non-terminal close", async () => {
  const sockets = [new MockSocket(), new MockSocket()];
  const joins = [];
  const statuses = [];

  const connection = createWebGameConnection({
    host: "localhost:1999",
    roomId: "ABC123",
    clientId: "client-1",
    protocolVersion: 4,
    reconnectBackoffMs: () => 0,
    join: async () => {
      const token = `join-token-${joins.length + 1}`;
      joins.push(token);
      return { ...joinToken, token };
    },
    createSocket: () => sockets[joins.length - 1],
    onStatusChange: (status) => statuses.push(status),
  });

  await tick();
  sockets[0].emit("open", {});
  sockets[0].emit("close", {});
  await tick();
  await tick();
  sockets[1].emit("open", {});

  assert.deepEqual(joins, ["join-token-1", "join-token-2"]);
  assert.deepEqual(sockets[0].sent.slice(0, 1), [
    { type: "AUTH", token: "join-token-1", protocolVersion: 4 },
  ]);
  assert.deepEqual(sockets[1].sent.slice(0, 1), [
    { type: "AUTH", token: "join-token-2", protocolVersion: 4 },
  ]);
  assert.equal(connection.status, "connected");
  assert.ok(statuses.includes("disconnected"));
});

test("connection treats terminal server errors as non-retriable", async () => {
  const socket = new MockSocket();
  const terminalErrors = [];
  let joinCount = 0;

  const connection = createWebGameConnection({
    host: "localhost:1999",
    roomId: "ABC123",
    clientId: "client-1",
    protocolVersion: 4,
    reconnectBackoffMs: () => 0,
    join: async () => {
      joinCount += 1;
      return joinToken;
    },
    createSocket: () => socket,
    onTerminalError: (error) => terminalErrors.push(error.message),
  });

  await tick();
  socket.emit("open", {});
  socket.emit("message", { data: JSON.stringify({ type: "ERROR", code: "TABLE_NOT_ACTIVE", message: "Table is not active" }) });
  socket.emit("close", {});
  await tick();

  assert.equal(joinCount, 1);
  assert.equal(connection.status, "disconnected");
  assert.equal(connection.terminalError?.message, "TABLE_NOT_ACTIVE");
  assert.deepEqual(terminalErrors, ["TABLE_NOT_ACTIVE"]);
});

test("native helpers normalize host and persist existing client ids", async () => {
  assert.equal(resolveNativePartyKitHost({ requestHostname: "localhost:3000" }), "127.0.0.1:1999");
  assert.equal(resolveNativePartyKitHost({ requestHostname: "table.example.com" }), "table.example.com:1999");
  assert.equal(buildPartyKitWebSocketUrl("127.0.0.1:1999", "ABC123"), "ws://127.0.0.1:1999/parties/main/ABC123");
  assert.equal(buildPartyKitWebSocketUrl("192.168.1.146:1999", "ABC123"), "ws://192.168.1.146:1999/parties/main/ABC123");

  const storage = new Map([[CLIENT_ID_STORAGE_KEY, "existing-client"]]);
  const clientId = await getOrCreateNativeClientId({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });
  assert.equal(clientId, "existing-client");
});

test("native control plane helpers build direct PartyKit requests and surface error codes", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith("/tables/BAD123")) {
      return new Response(JSON.stringify({ code: "TABLE_NOT_FOUND" }), { status: 404 });
    }
    if (url.endsWith("/tables")) {
      return new Response(JSON.stringify({ code: "ABC123", tableId: "t1", joinUrl: "/t/ABC123", status: "active" }), { status: 200 });
    }
    if (url.endsWith("/tables/ABC123/join-token")) {
      return new Response(JSON.stringify(joinToken), { status: 200 });
    }
    if (url.endsWith("/tables/ABC123/leave-seat")) {
      return new Response(JSON.stringify({
        ok: true,
        tableId: "ABC123",
        playerSessionId: "session-1",
        queued: true,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ exists: true, status: "active", tableName: "A", blinds: { small: 10, big: 25 } }), { status: 200 });
  };

  assert.equal(
    buildNativeControlPlaneUrlForTest("tables/ABC123", { explicitHost: "https://table.example.com/" }),
    "https://table.example.com/parties/main/__control__/tables/ABC123",
  );
  assert.equal(
    buildDirectControlPlaneUrlForTest("tables/ABC123", { explicitHost: "https://table.example.com/" }),
    "https://table.example.com/parties/main/__control__/tables/ABC123",
  );
  assert.equal(
    buildNativeControlPlaneUrlForTest("tables/ABC123", { requestHostname: "192.168.1.146:8081" }),
    "http://192.168.1.146:1999/parties/main/__control__/tables/ABC123",
  );

  const created = await createNativeTable({
    tableName: "  Friday  ",
    blinds: { small: 10, big: 25 },
    creatorClientId: "client-1",
    sevenTwoBountyBB: 2,
  }, { explicitHost: "127.0.0.1:1999", fetchImpl });
  assert.equal(created.code, "ABC123");
  assert.equal(requests[0].url, "http://127.0.0.1:1999/parties/main/__control__/tables");
  assert.equal(JSON.parse(requests[0].init.body).tableName, "Friday");

  await createTable({
    tableName: "Shared",
    blinds: { small: 10, big: 25 },
    creatorClientId: "client-1",
  }, { explicitHost: "127.0.0.1:1999", fetchImpl });
  await getTable("abc123", { explicitHost: "table.example.com", fetchImpl });
  await requestJoinToken("abc123", "client-1", { explicitHost: "table.example.com", fetchImpl });
  await requestQueuedSeatLeave("abc123", "client-1", { explicitHost: "table.example.com", fetchImpl });
  await getNativeTable("abc123", { explicitHost: "table.example.com", fetchImpl });
  await requestNativeJoinToken("abc123", "client-1", { explicitHost: "table.example.com", fetchImpl });
  await requestNativeQueuedSeatLeave("abc123", "client-1", { explicitHost: "table.example.com", fetchImpl });

  const leaveRequest = requests.find((request) => request.url.endsWith("/tables/ABC123/leave-seat"));
  assert.equal(leaveRequest.init.method, "POST");
  assert.equal(JSON.parse(leaveRequest.init.body).clientId, "client-1");

  await assert.rejects(
    () => getNativeTable("BAD123", { explicitHost: "table.example.com", fetchImpl }),
    /TABLE_NOT_FOUND/,
  );
});

test("heartbeat watchdog force-closes socket and reconnects after silence", async () => {
  let socket = new MockSocket();
  const statuses = [];
  let socketCreations = 0;

  const connection = createWebGameConnection({
    host: "http://localhost:1999/",
    roomId: "WATCH1",
    clientId: "client-hb",
    protocolVersion: 4,
    join: async () => ({ token: "t", tableId: "WATCH1", playerSessionId: "s", isCreator: false }),
    createSocket: () => {
      socketCreations += 1;
      socket = new MockSocket();
      return socket;
    },
    onStatusChange: (s) => statuses.push(s),
    heartbeatIntervalMs: 20,
  });

  await tick();
  socket.emit("open", {});
  assert.equal(connection.status, "connected");

  // Receive one message — watchdog should reset
  socket.emit("message", { data: JSON.stringify({ type: "TABLE_STATE", state: { phase: "waiting" } }) });

  // Wait longer than the heartbeat interval without any more messages
  await new Promise((r) => setTimeout(r, 60));

  // The watchdog should have fired: socket closed, reconnect scheduled
  assert.equal(socket.closed, true);
  // Status went disconnected then back to connecting (second socket creation imminent)
  assert.ok(statuses.includes("disconnected"), "status must have hit disconnected");

  connection.disconnect();
});

test("reconnectNow skips backoff and reconnects immediately", async () => {
  let socket = new MockSocket();
  let socketCreations = 0;
  const statuses = [];

  const connection = createWebGameConnection({
    host: "http://localhost:1999/",
    roomId: "RECONN",
    clientId: "client-rn",
    protocolVersion: 4,
    join: async () => ({ token: "t", tableId: "RECONN", playerSessionId: "s", isCreator: false }),
    createSocket: () => {
      socketCreations += 1;
      socket = new MockSocket();
      return socket;
    },
    onStatusChange: (s) => statuses.push(s),
    reconnectBackoffMs: () => 60_000,
    heartbeatIntervalMs: 0,
  });

  await tick();
  socket.emit("open", {});
  assert.equal(connection.status, "connected");

  // Simulate a silent disconnect (close without triggering the watch)
  socket.emit("close", {});
  await tick();
  assert.equal(connection.status, "disconnected");
  // Backoff is 60s so normally would wait a long time before reconnecting
  assert.equal(socketCreations, 1);

  // reconnectNow should bypass the backoff
  connection.reconnectNow();
  await tick();
  assert.equal(socketCreations, 2, "a new socket must be created immediately");
  assert.equal(connection.status, "connecting");

  connection.disconnect();
});

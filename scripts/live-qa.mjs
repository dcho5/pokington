#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_BASE_URL = process.env.POKINGTON_BASE_URL ?? "http://127.0.0.1:3000";
const DEFAULT_WS_HOST = process.env.POKINGTON_WS_HOST ?? "127.0.0.1:1999";
const DEFAULT_TIMEOUT_MS = 15_000;
const VOTE_TIMEOUT_MS = 30_000;
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (typeof WebSocket === "undefined") {
  if (process.env.POKINGTON_WS_REEXEC === "1") {
    throw new Error("WebSocket is unavailable even after re-running with --experimental-websocket");
  }

  const child = spawnSync(
    process.execPath,
    ["--experimental-websocket", ...process.argv.slice(1)],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        POKINGTON_WS_REEXEC: "1",
      },
    },
  );

  process.exit(child.status ?? 1);
}

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    wsHost: DEFAULT_WS_HOST,
    scenario: "all",
    jsonOut: null,
    browserSmoke: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--base-url" && argv[i + 1]) {
      args.baseUrl = argv[++i];
      continue;
    }
    if (value === "--ws-host" && argv[i + 1]) {
      args.wsHost = argv[++i];
      continue;
    }
    if (value === "--scenario" && argv[i + 1]) {
      args.scenario = argv[++i];
      continue;
    }
    if (value === "--json-out" && argv[i + 1]) {
      args.jsonOut = argv[++i];
      continue;
    }
    if (value === "--browser-smoke") {
      args.browserSmoke = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeClientId(label) {
  return `qa_${label.toLowerCase()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function wsUrl(wsHost, roomCode) {
  const local = wsHost.startsWith("127.0.0.1") || wsHost.startsWith("localhost");
  const protocol = local ? "ws" : "wss";
  const url = new URL(`${protocol}://${wsHost}/parties/main/${roomCode}`);
  url.searchParams.set("_pk", crypto.randomUUID());
  return url.toString();
}

function summarizePlayers(state) {
  return Object.values(state.players)
    .map((player) => ({
      id: player.id,
      name: player.name,
      seatIndex: player.seatIndex,
      stack: player.stack,
      currentBet: player.currentBet,
      totalContribution: player.totalContribution,
      isFolded: player.isFolded,
      isAllIn: player.isAllIn,
      hasCards: player.hasCards,
      sitOutUntilBB: player.sitOutUntilBB,
      lastAction: player.lastAction,
    }))
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

function summarizeLedger(entries) {
  return entries.map((entry) => ({
    playerId: entry.playerId,
    name: entry.name,
    buyIns: [...entry.buyIns],
    cashOuts: [...entry.cashOuts],
    isSeated: entry.isSeated,
    currentStack: entry.currentStack,
  }));
}

function summarizeWinners(winners) {
  return winners?.map((winner) => ({
    playerId: winner.playerId,
    amount: winner.amount,
    hand: winner.hand,
  })) ?? [];
}

function summarizeState(state) {
  return {
    phase: state.phase,
    handNumber: state.handNumber,
    pot: state.pot,
    roundBet: state.roundBet,
    needsToAct: [...state.needsToAct],
    closedActors: [...state.closedActors],
    communityCards: [...state.communityCards],
    communityCards2: [...state.communityCards2],
    runCount: state.runCount,
    runResults: deepCopy(state.runResults ?? []),
    winners: summarizeWinners(state.winners),
    showdownKind: state.showdownKind,
    bombPotVote: deepCopy(state.bombPotVote),
    bombPotNextHand: deepCopy(state.bombPotNextHand),
    bombPotCooldown: [...(state.bombPotCooldown ?? [])],
    players: summarizePlayers(state),
  };
}

async function jsonFetch(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }

  return body;
}

class PlayerClient {
  constructor({ label, clientId, baseUrl, wsHost }) {
    this.label = label;
    this.clientId = clientId;
    this.baseUrl = baseUrl;
    this.wsHost = wsHost;
    this.tableCode = null;
    this.playerSessionId = null;
    this.token = null;
    this.socket = null;
    this.latestState = null;
    this.latestPrivateState = null;
    this.latestLedger = [];
    this.latestPresence = null;
    this.latestError = null;
    this.messageLog = [];
  }

  log(type, details = {}) {
    this.messageLog.push({
      at: nowIso(),
      type,
      ...details,
    });
  }

  async connect(tableCode) {
    this.tableCode = tableCode;
    const joinToken = await jsonFetch(`${this.baseUrl}/api/tables/${tableCode}/join-token`, {
      method: "POST",
      body: JSON.stringify({ clientId: this.clientId }),
    });

    this.token = joinToken.token;
    this.playerSessionId = joinToken.playerSessionId;
    this.log("join-token", {
      playerSessionId: this.playerSessionId,
      isCreator: joinToken.isCreator,
    });

    const socket = new WebSocket(wsUrl(this.wsHost, tableCode));
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.log("ws-open");
      socket.send(JSON.stringify({
        type: "AUTH",
        token: this.token,
        protocolVersion: 3,
      }));
      socket.send(JSON.stringify({
        type: "SET_AWAY",
        away: false,
      }));
    });

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      this.log("message", { messageType: message.type });

      switch (message.type) {
        case "WELCOME":
          this.playerSessionId = message.playerSessionId;
          break;
        case "TABLE_STATE":
          this.latestState = message.state;
          break;
        case "PRIVATE_STATE":
          this.latestPrivateState = message;
          break;
        case "LEDGER_STATE":
          this.latestLedger = message.entries;
          break;
        case "ROOM_PRESENCE":
          this.latestPresence = message;
          break;
        case "ERROR":
          this.latestError = message;
          break;
        default:
          break;
      }
    });

    socket.addEventListener("close", () => {
      this.log("ws-close");
    });

    await this.waitFor(
      () => this.latestState !== null && this.latestLedger !== null && this.latestPrivateState !== null,
      { label: `${this.label} initial state` },
    );
  }

  async reconnect() {
    await this.close();
    await this.connect(this.tableCode);
  }

  async close() {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
    await delay(50);
  }

  sendRaw(payload) {
    assert(this.socket && this.socket.readyState === WebSocket.OPEN, `${this.label} websocket is not open`);
    this.latestError = null;
    this.socket.send(JSON.stringify(payload));
    this.log("send", { payload });
  }

  sendEvent(event) {
    this.sendRaw({ type: "GAME_EVENT", event });
  }

  queueLeave() {
    this.sendRaw({ type: "QUEUE_LEAVE" });
  }

  async waitFor(predicate, { timeoutMs = DEFAULT_TIMEOUT_MS, label = "condition" } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await delay(50);
    }
    throw new Error(`Timed out waiting for ${label}`);
  }

  getSelf(state = this.latestState) {
    return state?.players?.[this.playerSessionId] ?? null;
  }

  snapshot(note) {
    return {
      note,
      at: nowIso(),
      player: this.label,
      playerSessionId: this.playerSessionId,
      state: this.latestState ? summarizeState(this.latestState) : null,
      privateState: this.latestPrivateState ? deepCopy(this.latestPrivateState) : null,
      ledger: summarizeLedger(this.latestLedger ?? []),
      latestError: this.latestError ? deepCopy(this.latestError) : null,
    };
  }
}

class ScenarioContext {
  constructor({ id, title, baseUrl, wsHost }) {
    this.id = id;
    this.title = title;
    this.baseUrl = baseUrl;
    this.wsHost = wsHost;
    this.players = [];
    this.tableCode = null;
    this.transcript = [];
    this.snapshots = [];
  }

  note(kind, detail, extra = {}) {
    this.transcript.push({
      at: nowIso(),
      kind,
      detail,
      ...extra,
    });
  }

  async createTable({ tableName, blinds = { small: 25, big: 50 }, sevenTwoBountyBB = 0 } = {}) {
    const creatorClientId = makeClientId(`${this.id}_creator`);
    const body = await jsonFetch(`${this.baseUrl}/api/tables`, {
      method: "POST",
      body: JSON.stringify({
        tableName: tableName ?? `QA ${this.id}`,
        blinds,
        creatorClientId,
        sevenTwoBountyBB,
      }),
    });
    this.tableCode = body.code;
    this.creatorClientId = creatorClientId;
    this.note("table-created", `Created table ${body.code}`, { blinds, sevenTwoBountyBB });
    return body.code;
  }

  async connectPlayers(labels) {
    assert(this.tableCode, "createTable must run before connectPlayers");
    const clients = [];
    for (const label of labels) {
      const clientId = label === labels[0] ? this.creatorClientId : makeClientId(`${this.id}_${label}`);
      const client = new PlayerClient({
        label,
        clientId,
        baseUrl: this.baseUrl,
        wsHost: this.wsHost,
      });
      await client.connect(this.tableCode);
      clients.push(client);
      this.note("player-connected", `${label} connected`, {
        clientId,
        playerSessionId: client.playerSessionId,
      });
    }
    this.players.push(...clients);
    return clients;
  }

  takeSnapshots(note) {
    for (const player of this.players) {
      this.snapshots.push(player.snapshot(note));
    }
  }

  getPlayer(label) {
    const player = this.players.find((candidate) => candidate.label === label);
    assert(player, `Unknown player ${label}`);
    return player;
  }

  async waitForAll(predicate, label, timeoutMs = DEFAULT_TIMEOUT_MS) {
    await Promise.all(this.players.map((player) => player.waitFor(() => predicate(player), {
      timeoutMs,
      label: `${player.label} ${label}`,
    })));
  }

  async sitDown(label, seatIndex, name, buyIn) {
    const player = this.getPlayer(label);
    const before = player.latestState?.handNumber ?? 0;
    player.sendEvent({
      type: "SIT_DOWN",
      playerId: player.playerSessionId,
      name,
      seatIndex,
      buyIn,
    });
    await this.waitForAll(
      (candidate) => candidate.latestState?.players?.[player.playerSessionId]?.seatIndex === seatIndex,
      `${label} sit-down`,
    );
    this.note("sit-down", `${label} sat in seat ${seatIndex}`, {
      name,
      buyIn,
      handNumber: before,
    });
  }

  async standUp(label) {
    const player = this.getPlayer(label);
    player.sendEvent({
      type: "STAND_UP",
      playerId: player.playerSessionId,
    });
    await this.waitForAll(
      (candidate) => !candidate.latestState?.players?.[player.playerSessionId],
      `${label} stand-up`,
    );
    this.note("stand-up", `${label} stood up`);
  }

  async startHand(label = this.players[0]?.label) {
    const player = this.getPlayer(label);
    const expectedHand = (player.latestState?.handNumber ?? 0) + 1;
    player.sendEvent({ type: "START_HAND" });
    await this.waitForAll(
      (candidate) => (candidate.latestState?.handNumber ?? 0) >= expectedHand,
      `start hand ${expectedHand}`,
    );
    this.note("start-hand", `${label} started hand ${expectedHand}`);
  }

  async act(label, action, amount) {
    const player = this.getPlayer(label);
    const before = {
      phase: player.latestState?.phase,
      handNumber: player.latestState?.handNumber,
      actorId: player.latestState?.needsToAct?.[0] ?? null,
    };
    player.sendEvent({
      type: "PLAYER_ACTION",
      playerId: player.playerSessionId,
      action,
      ...(amount != null ? { amount } : {}),
    });
    await this.waitForAll(
      (candidate) => {
        const state = candidate.latestState;
        if (!state) return false;
        if (state.handNumber !== before.handNumber) return true;
        if (state.phase !== before.phase) return true;
        return state.needsToAct?.[0] !== before.actorId;
      },
      `${label} ${action}`,
    );
    this.note("action", `${label} ${action}${amount != null ? ` to ${amount}` : ""}`);
  }

  async voteRun(label, count) {
    const player = this.getPlayer(label);
    player.sendEvent({
      type: "VOTE_RUN",
      playerId: player.playerSessionId,
      count,
    });
    await player.waitFor(
      () => (player.latestState?.runItVotes?.[player.playerSessionId] ?? null) === count || player.latestState?.phase === "showdown",
      { label: `${label} vote ${count}` },
    );
    this.note("vote-run", `${label} voted ${count}x`);
  }

  async proposeBombPot(label, anteBB) {
    const player = this.getPlayer(label);
    player.sendEvent({
      type: "PROPOSE_BOMB_POT",
      playerId: player.playerSessionId,
      anteBB,
    });
    await this.waitForAll(
      (candidate) => {
        const state = candidate.latestState;
        return !!state && (state.bombPotVote?.proposedBy === player.playerSessionId || state.bombPotVote === null);
      },
      `${label} propose bomb pot`,
    );
    this.note("bomb-pot-propose", `${label} proposed ${anteBB}x bomb pot`);
  }

  async voteBombPot(label, approve) {
    const player = this.getPlayer(label);
    player.sendEvent({
      type: "VOTE_BOMB_POT",
      playerId: player.playerSessionId,
      approve,
    });
    await this.waitForAll(
      (candidate) => {
        const state = candidate.latestState;
        if (!state) return false;
        if (!approve) return state.bombPotVote === null;
        return Boolean(state.bombPotNextHand || state.bombPotVote?.votes?.[player.playerSessionId] === true);
      },
      `${label} vote bomb pot`,
    );
    this.note("bomb-pot-vote", `${label} voted ${approve ? "approve" : "reject"}`);
  }

  async runCheckdownToShowdown(labels) {
    while (true) {
      const state = this.players[0].latestState;
      assert(state, "Missing table state during checkdown");
      if (state.phase === "showdown") return;
      const actorId = state.needsToAct[0];
      assert(actorId, `Expected an actor during ${state.phase}`);
      const actor = this.players.find((player) => player.playerSessionId === actorId);
      assert(actor, `No connected player for actor ${actorId}`);
      const self = actor.getSelf(state);
      const mustCall = self.currentBet < state.roundBet;
      await this.act(actor.label, mustCall ? "call" : "check");
    }
  }

  async waitForShowdown(timeoutMs = DEFAULT_TIMEOUT_MS) {
    await this.waitForAll(
      (player) => player.latestState?.phase === "showdown" && Array.isArray(player.latestState?.winners),
      "showdown",
      timeoutMs,
    );
  }

  async close() {
    await Promise.all(this.players.map((player) => player.close()));
  }

  result(outcome, notes = [], extra = {}) {
    const canonical = this.players[0];
    return {
      id: this.id,
      title: this.title,
      outcome,
      tableCode: this.tableCode,
      notes,
      transcript: deepCopy(this.transcript),
      snapshots: deepCopy(this.snapshots),
      finalState: canonical?.latestState ? summarizeState(canonical.latestState) : null,
      finalLedger: canonical ? summarizeLedger(canonical.latestLedger ?? []) : [],
      ...extra,
    };
  }
}

async function ensureStackVisible(player, expectedStack) {
  await player.waitFor(
    () => player.getSelf()?.stack === expectedStack,
    { label: `${player.label} stack ${expectedStack}` },
  );
}

async function runBaselineLifecycle(baseUrl, wsHost) {
  const ctx = new ScenarioContext({
    id: "baseline_lifecycle",
    title: "Baseline create/join/seat/start/stand flow",
    baseUrl,
    wsHost,
  });

  try {
    await ctx.createTable();
    const [alice, bob] = await ctx.connectPlayers(["Alice", "Bob"]);
    await ctx.sitDown("Alice", 0, "Alice", 5000);
    await ctx.sitDown("Bob", 2, "Bob", 5000);
    await ctx.standUp("Bob");
    await ctx.sitDown("Bob", 1, "Bob", 5000);
    await ctx.startHand("Alice");
    assert((alice.latestState?.handNumber ?? 0) === 1, "Hand number did not advance to 1");
    assert(alice.latestState?.phase === "pre-flop", "Baseline hand did not reach pre-flop");
    ctx.takeSnapshots("baseline after start");
    return ctx.result("Pass", ["Lifecycle flow reached a live hand after pre-hand seat changes."]);
  } finally {
    await ctx.close();
  }
}

async function runNormalShowdown(baseUrl, wsHost) {
  const ctx = new ScenarioContext({
    id: "normal_showdown",
    title: "Heads-up hand to normal showdown",
    baseUrl,
    wsHost,
  });

  try {
    await ctx.createTable();
    const [alice, bob] = await ctx.connectPlayers(["Alice", "Bob"]);
    await ctx.sitDown("Alice", 0, "Alice", 10000);
    await ctx.sitDown("Bob", 1, "Bob", 10000);
    await ctx.startHand("Alice");
    await ctx.runCheckdownToShowdown(["Alice", "Bob"]);
    await ctx.waitForShowdown();
    ctx.takeSnapshots("normal showdown");

    assert(Array.isArray(alice.latestState.winners) && alice.latestState.winners.length > 0, "Normal showdown winners missing");
    assert(alice.latestState.runResults.length === 1, "Normal showdown should produce one run");

    return ctx.result("Pass", [
      "Checkdown reached showdown with winners populated.",
      "Server state exposed a single-run showdown without entering run-it voting.",
    ]);
  } finally {
    await ctx.close();
  }
}

async function forceAllInVote(ctx, { voteA, voteB, stacks = [2000, 2000], street = "pre-flop" }) {
  await ctx.createTable();
  const [alice, bob] = await ctx.connectPlayers(["Alice", "Bob"]);
  await ctx.sitDown("Alice", 0, "Alice", stacks[0]);
  await ctx.sitDown("Bob", 1, "Bob", stacks[1]);
  await ctx.startHand("Alice");

  if (street === "pre-flop") {
    const actor = ctx.players.find((player) => player.playerSessionId === alice.latestState.needsToAct[0]);
    await ctx.act(actor.label, "all-in");
    const caller = ctx.players.find((player) => player.playerSessionId === actor.latestState.needsToAct[0]);
    await ctx.act(caller.label, "call");
  } else if (street === "flop" || street === "turn") {
    await ctx.runCheckdownToStreet(street);
    const actorId = alice.latestState.needsToAct[0];
    const actor = ctx.players.find((player) => player.playerSessionId === actorId);
    await ctx.act(actor.label, "all-in");
    const callerId = alice.latestState.needsToAct[0];
    const caller = ctx.players.find((player) => player.playerSessionId === callerId);
    await ctx.act(caller.label, "call");
  } else {
    throw new Error(`Unsupported street ${street}`);
  }

  await ctx.waitForAll((player) => player.latestState?.phase === "voting", `${street} voting`);
  if (voteA != null) await ctx.voteRun("Alice", voteA);
  if (voteB != null) await ctx.voteRun("Bob", voteB);
  return { alice, bob };
}

ScenarioContext.prototype.runCheckdownToStreet = async function runCheckdownToStreet(targetStreet) {
  const order = ["pre-flop", "flop", "turn", "river"];
  while (true) {
    const state = this.players[0].latestState;
    assert(state, "Missing table state while advancing street");
    if (state.phase === targetStreet) return;
    assert(order.indexOf(state.phase) < order.indexOf(targetStreet), `Already passed ${targetStreet}`);
    const actorId = state.needsToAct[0];
    assert(actorId, `Expected actor while advancing to ${targetStreet}`);
    const actor = this.players.find((player) => player.playerSessionId === actorId);
    const self = actor.getSelf(state);
    await this.act(actor.label, self.currentBet < state.roundBet ? "call" : "check");
  }
};

async function runRunItVariants(baseUrl, wsHost) {
  const scenarios = [];

  for (const [id, title, street, voteA, voteB, timeoutVote] of [
    ["runit_preflop_2x", "Pre-flop all-in unanimous 2x", "pre-flop", 2, 2, false],
    ["runit_preflop_3x", "Pre-flop all-in unanimous 3x", "pre-flop", 3, 3, false],
    ["runit_preflop_split", "Pre-flop all-in split vote falls back to 1x", "pre-flop", 2, 3, false],
    ["runit_preflop_timeout", "Pre-flop all-in vote timeout falls back to 1x", "pre-flop", 2, null, true],
    ["runit_flop_2x", "Flop all-in unanimous 2x", "flop", 2, 2, false],
    ["runit_turn_2x", "Turn all-in unanimous 2x", "turn", 2, 2, false],
  ]) {
    const ctx = new ScenarioContext({ id, title, baseUrl, wsHost });
    try {
      const { alice } = await forceAllInVote(ctx, { voteA, voteB, street });
      if (timeoutVote) {
        await ctx.waitForAll((player) => player.latestState?.phase === "showdown", "vote timeout showdown", VOTE_TIMEOUT_MS + 10_000);
      } else {
        await ctx.waitForAll((player) => player.latestState?.phase === "showdown", "vote resolved showdown");
      }
      ctx.takeSnapshots(`${id} showdown`);
      const runCount = alice.latestState.runCount;
      const expectedRunCount = voteA && voteB && voteA === voteB ? voteA : 1;
      assert(runCount === expectedRunCount, `${id} expected runCount ${expectedRunCount}, got ${runCount}`);
      scenarios.push(ctx.result("Pass", [`Resolved runCount=${runCount} after ${street} all-in.`]));
    } catch (error) {
      scenarios.push(ctx.result("Blocked", [error instanceof Error ? error.message : String(error)]));
    } finally {
      await ctx.close();
    }
  }

  return scenarios;
}

async function runBombPotScenarios(baseUrl, wsHost) {
  const results = [];

  {
    const ctx = new ScenarioContext({
      id: "bombpot_standard",
      title: "Bomb pot schedule and start",
      baseUrl,
      wsHost,
    });
    try {
      await ctx.createTable();
      const [alice, bob] = await ctx.connectPlayers(["Alice", "Bob"]);
      await ctx.sitDown("Alice", 0, "Alice", 5000);
      await ctx.sitDown("Bob", 1, "Bob", 5000);
      await ctx.proposeBombPot("Alice", 2);
      await ctx.voteBombPot("Bob", true);
      await ctx.waitForAll((player) => player.latestState?.bombPotNextHand?.anteBB === 2, "bomb pot scheduled");
      await ctx.startHand("Alice");
      await ctx.waitForAll((player) => player.latestState?.isBombPot === true && player.latestState?.phase === "flop", "bomb pot flop");
      ctx.takeSnapshots("bomb pot standard");
      assert(alice.latestState.communityCards.length === 3, "Bomb pot board 1 flop missing");
      assert(alice.latestState.communityCards2.length === 3, "Bomb pot board 2 flop missing");
      results.push(ctx.result("Pass", ["Bomb pot scheduled, then started as a split-board flop hand."]));
    } catch (error) {
      results.push(ctx.result("Blocked", [error instanceof Error ? error.message : String(error)]));
    } finally {
      await ctx.close();
    }
  }

  {
    const ctx = new ScenarioContext({
      id: "bombpot_immediate_allin",
      title: "Bomb pot immediate all-in runout",
      baseUrl,
      wsHost,
    });
    try {
      await ctx.createTable();
      const [alice] = await ctx.connectPlayers(["Alice", "Bob"]);
      await ctx.sitDown("Alice", 0, "Alice", 100);
      await ctx.sitDown("Bob", 1, "Bob", 100);
      await ctx.proposeBombPot("Alice", 2);
      await ctx.voteBombPot("Bob", true);
      await ctx.startHand("Alice");
      await ctx.waitForAll((player) => player.latestState?.phase === "showdown", "bomb pot immediate showdown");
      await ctx.waitForAll(
        (player) => player.latestState?.communityCards?.length === 5 && player.latestState?.communityCards2?.length === 5,
        "bomb pot fully revealed boards",
        12_000,
      );
      ctx.takeSnapshots("bomb pot immediate showdown");
      assert(alice.latestState.isBombPot === true, "Immediate all-in bomb pot lost bomb-pot flag");
      assert(alice.latestState.communityCards.length === 5, "Immediate bomb pot board 1 did not fully run out");
      assert(alice.latestState.communityCards2.length === 5, "Immediate bomb pot board 2 did not fully run out");
      results.push(ctx.result("Pass", ["Short-stacked bomb pot jumped directly to split-board showdown."]));
    } catch (error) {
      results.push(ctx.result("Blocked", [error instanceof Error ? error.message : String(error)]));
    } finally {
      await ctx.close();
    }
  }

  return results;
}

async function runQueueLeaveReconnect(baseUrl, wsHost) {
  const results = [];

  {
    const ctx = new ScenarioContext({
      id: "queue_leave",
      title: "Queued leave at hand boundary",
      baseUrl,
      wsHost,
    });
    try {
      await ctx.createTable();
      await ctx.connectPlayers(["Alice", "Bob"]);
      await ctx.sitDown("Alice", 0, "Alice", 5000);
      await ctx.sitDown("Bob", 1, "Bob", 5000);
      await ctx.startHand("Alice");
      const bob = ctx.getPlayer("Bob");
      bob.queueLeave();
      ctx.note("queue-leave", "Bob queued leave");
      await ctx.runCheckdownToShowdown(["Alice", "Bob"]);
      await ctx.waitForShowdown();
      const alice = ctx.getPlayer("Alice");
      alice.sendEvent({ type: "START_HAND" });
      await ctx.waitForAll((player) => player.latestState?.phase === "waiting", "queue leave waiting state");
      await ctx.waitForAll((player) => !player.latestState?.players?.[bob.playerSessionId], "bob removed after queued leave");
      ctx.takeSnapshots("queue leave removal");
      results.push(ctx.result("Pass", ["Queued leave removed the player on the next START_HAND boundary."]));
    } catch (error) {
      results.push(ctx.result("Blocked", [error instanceof Error ? error.message : String(error)]));
    } finally {
      await ctx.close();
    }
  }

  {
    const ctx = new ScenarioContext({
      id: "reconnect_same_identity",
      title: "Reconnect restores same identity and private state",
      baseUrl,
      wsHost,
    });
    try {
      await ctx.createTable();
      await ctx.connectPlayers(["Alice", "Bob"]);
      await ctx.sitDown("Alice", 0, "Alice", 5000);
      await ctx.sitDown("Bob", 1, "Bob", 5000);
      await ctx.startHand("Alice");
      const bob = ctx.getPlayer("Bob");
      const beforeSessionId = bob.playerSessionId;
      const beforeHoleCards = deepCopy(bob.latestPrivateState?.holeCards);
      assert(beforeHoleCards && beforeHoleCards.length === 2, "Reconnect test expected Bob hole cards before reconnect");
      await bob.reconnect();
      await bob.waitFor(() => bob.playerSessionId === beforeSessionId, { label: "same reconnect session id" });
      await bob.waitFor(() => JSON.stringify(bob.latestPrivateState?.holeCards) === JSON.stringify(beforeHoleCards), {
        label: "hole cards restored",
      });
      ctx.takeSnapshots("reconnect");
      results.push(ctx.result("Pass", ["Reconnect kept the same playerSessionId and restored private hole cards."]));
    } catch (error) {
      results.push(ctx.result("Blocked", [error instanceof Error ? error.message : String(error)]));
    } finally {
      await ctx.close();
    }
  }

  return results;
}

async function runCooldownLeakScenario(baseUrl, wsHost) {
  const ctx = new ScenarioContext({
    id: "bombpot_cooldown_leak",
    title: "Bomb pot cooldown after stand-up/re-seat",
    baseUrl,
    wsHost,
  });

  try {
    await ctx.createTable();
    await ctx.connectPlayers(["Alice", "Bob"]);
    await ctx.sitDown("Alice", 0, "Alice", 5000);
    await ctx.sitDown("Bob", 1, "Bob", 5000);
    const alice = ctx.getPlayer("Alice");
    await ctx.proposeBombPot("Alice", 2);
    await ctx.voteBombPot("Bob", false);
    await ctx.standUp("Alice");
    await ctx.sitDown("Alice", 0, "Alice", 5000);

    const beforeVote = JSON.stringify(alice.latestState?.bombPotVote);
    await ctx.proposeBombPot("Alice", 2);
    await delay(200);
    const afterState = alice.latestState;
    const stillBlocked = afterState?.bombPotVote === null && beforeVote === "null";
    ctx.takeSnapshots("bomb pot cooldown leak");

    if (!stillBlocked) {
      return ctx.result("Not Reproduced", [
        "Re-seated proposer could immediately open a new bomb pot vote with the same session id.",
      ]);
    }

    const cooldownContainsPlayer = afterState?.bombPotCooldown?.includes(alice.playerSessionId) ?? false;
    assert(cooldownContainsPlayer, "Blocked proposer was not present in bombPotCooldown");
    return ctx.result("Confirmed Issue", [
      "Re-seated proposer remained blocked from opening a new bomb pot vote.",
      "bombPotCooldown still contained the stood-up playerSessionId after re-seat.",
    ]);
  } finally {
    await ctx.close();
  }
}

async function runBlindIncompleteDivergence(baseUrl, wsHost) {
  const results = [];

  for (const variant of [
    { id: "blind_incomplete_raise", mode: "raise", title: "Incomplete blind completion via raise" },
    { id: "blind_incomplete_allin", mode: "all-in", title: "Incomplete blind completion via all-in" },
  ]) {
    const ctx = new ScenarioContext({
      id: variant.id,
      title: variant.title,
      baseUrl,
      wsHost,
    });
    try {
      await ctx.createTable();
      await ctx.connectPlayers(["Alice", "Bob", "Cara", "Drew"]);
      await ctx.sitDown("Alice", 0, "Alice", variant.mode === "all-in" ? 50 : 1000);
      await ctx.sitDown("Bob", 1, "Bob", 10);
      await ctx.sitDown("Cara", 2, "Cara", 30);
      await ctx.sitDown("Drew", 3, "Drew", 1000);
      await ctx.startHand("Alice");

      const state = ctx.getPlayer("Alice").latestState;
      assert(state.bigBlindSeatIndex >= 0, "Expected a big blind seat");
      assert(state.isBlindIncomplete === true, "Expected incomplete blind state");

      const firstActor = ctx.players.find((player) => player.playerSessionId === state.needsToAct[0]);
      await ctx.act(firstActor.label, "call");

      const secondState = ctx.getPlayer("Alice").latestState;
      const secondActor = ctx.players.find((player) => player.playerSessionId === secondState.needsToAct[0]);
      if (variant.mode === "raise") {
        await ctx.act(secondActor.label, "raise", 50);
      } else {
        await ctx.act(secondActor.label, "all-in");
      }

      ctx.takeSnapshots(variant.id);
      const finalState = ctx.getPlayer("Alice").latestState;
      const firstActorNeedsMore = finalState.needsToAct.includes(firstActor.playerSessionId);
      results.push(ctx.result("Pass", [
        `After ${variant.mode}, prior closed actor requeued=${firstActorNeedsMore}.`,
      ], {
        divergenceEvidence: {
          variant: variant.mode,
          needsToAct: [...finalState.needsToAct],
          closedActors: [...finalState.closedActors],
          firstActorId: firstActor.playerSessionId,
        },
      }));
    } catch (error) {
      results.push(ctx.result("Blocked", [error instanceof Error ? error.message : String(error)]));
    } finally {
      await ctx.close();
    }
  }

  return results;
}

async function runLedgerScenario(baseUrl, wsHost) {
  const ctx = new ScenarioContext({
    id: "ledger_cycle",
    title: "Ledger sit/stand cycles",
    baseUrl,
    wsHost,
  });

  try {
    await ctx.createTable();
    await ctx.connectPlayers(["Alice", "Bob"]);
    await ctx.sitDown("Alice", 0, "Alice", 2000);
    await ctx.sitDown("Bob", 1, "Bob", 2000);
    await ctx.standUp("Alice");
    await ctx.sitDown("Alice", 0, "Alice", 3500);
    await ctx.startHand("Alice");
    await ctx.runCheckdownToShowdown(["Alice", "Bob"]);
    await ctx.waitForShowdown();
    await ctx.standUp("Alice");
    ctx.takeSnapshots("ledger cycle");

    const aliceEntry = ctx.getPlayer("Bob").latestLedger.find((entry) => entry.name === "Alice");
    assert(aliceEntry, "Alice ledger entry missing");
    return ctx.result("Pass", [
      `Alice ledger buyIns=${aliceEntry.buyIns.join(",")} cashOuts=${aliceEntry.cashOuts.join(",")}.`,
    ]);
  } finally {
    await ctx.close();
  }
}

async function runMultiRunAggregationProbe(baseUrl, wsHost) {
  const attempts = [];
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const ctx = new ScenarioContext({
      id: `multi_run_attempt_${attempt}`,
      title: `Multi-run aggregation probe ${attempt}`,
      baseUrl,
      wsHost,
    });

    try {
      await ctx.createTable();
      const [alice] = await ctx.connectPlayers(["Alice", "Bob"]);
      await ctx.sitDown("Alice", 0, "Alice", 1500);
      await ctx.sitDown("Bob", 1, "Bob", 1500);
      await ctx.startHand("Alice");

      const actor = ctx.players.find((player) => player.playerSessionId === alice.latestState.needsToAct[0]);
      await ctx.act(actor.label, "all-in");
      const caller = ctx.players.find((player) => player.playerSessionId === actor.latestState.needsToAct[0]);
      await ctx.act(caller.label, "call");
      await ctx.waitForAll((player) => player.latestState?.phase === "voting", "multi-run voting");
      await ctx.voteRun("Alice", 3);
      await ctx.voteRun("Bob", 3);
      await ctx.waitForAll((player) => player.latestState?.phase === "showdown", "multi-run showdown");
      ctx.takeSnapshots(`multi-run attempt ${attempt}`);

      const state = alice.latestState;
      const labelBuckets = new Map();
      for (const run of state.runResults ?? []) {
        for (const winner of run.winners ?? []) {
          if (!winner.hand) continue;
          const bucket = labelBuckets.get(winner.playerId) ?? new Set();
          bucket.add(winner.hand);
          labelBuckets.set(winner.playerId, bucket);
        }
      }

      const interesting = Array.from(labelBuckets.entries()).find(([, labels]) => labels.size > 1);
      if (!interesting) {
        attempts.push(ctx.result("Pass", [`Attempt ${attempt} did not produce a winner with distinct hand labels across runs.`]));
        await ctx.close();
        continue;
      }

      const [playerId, labels] = interesting;
      const aggregate = state.winners?.find((winner) => winner.playerId === playerId);
      const distinctLabels = [...labels];
      const mismatch = aggregate && distinctLabels.length > 1 && distinctLabels.includes(aggregate.hand);
      const result = ctx.result(mismatch ? "Confirmed Issue" : "Needs More Evidence", [
        `Player ${playerId} won multiple runs with labels: ${distinctLabels.join(", ")}.`,
        `Aggregate winner hand label was ${aggregate?.hand ?? "null"}.`,
      ], {
        aggregateEvidence: {
          playerId,
          aggregateHand: aggregate?.hand ?? null,
          distinctLabels,
          runResults: deepCopy(state.runResults),
          winners: summarizeWinners(state.winners),
        },
      });
      await ctx.close();
      return { result, attempts };
    } catch (error) {
      attempts.push(ctx.result("Blocked", [error instanceof Error ? error.message : String(error)]));
      await ctx.close();
    }
  }

  return {
    result: {
      id: "multi_run_aggregation",
      title: "Multi-run aggregate hand label probe",
      outcome: "Needs More Evidence",
      notes: ["Twenty live attempts did not surface a distinct multi-run hand-label mismatch."],
      attempts,
    },
    attempts,
  };
}

async function runBrowserSmoke(baseUrl) {
  const targets = [
    {
      id: "home_desktop",
      url: `${baseUrl}/`,
      width: 1440,
      height: 1024,
    },
    {
      id: "home_mobile",
      url: `${baseUrl}/`,
      width: 390,
      height: 844,
    },
  ];

  const results = [];
  for (const target of targets) {
    const outputPath = `/tmp/${target.id}_${Date.now()}.png`;
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=${target.width},${target.height}`,
      `--screenshot=${outputPath}`,
      "--virtual-time-budget=4000",
      target.url,
    ];

    await new Promise((resolve, reject) => {
      const child = spawn(CHROME_PATH, args, { stdio: "ignore" });
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Chrome exited with code ${code}`));
      });
      child.on("error", reject);
    });

    results.push({
      id: target.id,
      screenshot: outputPath,
      url: target.url,
      viewport: { width: target.width, height: target.height },
    });
  }

  return results;
}

async function ensureLocalServices(baseUrl, wsHost) {
  const healthUrl = `http://${wsHost}/parties/main/__control__/health`;
  await jsonFetch(healthUrl);
  await fetch(baseUrl, { cache: "no-store" });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureLocalServices(args.baseUrl, args.wsHost);

  const report = {
    createdAt: nowIso(),
    baseUrl: args.baseUrl,
    wsHost: args.wsHost,
    scenarios: [],
    browserSmoke: [],
  };

  const scenarioGroups = {
    baseline: async () => [await runBaselineLifecycle(args.baseUrl, args.wsHost)],
    showdown: async () => [await runNormalShowdown(args.baseUrl, args.wsHost)],
    runit: async () => runRunItVariants(args.baseUrl, args.wsHost),
    bombpot: async () => runBombPotScenarios(args.baseUrl, args.wsHost),
    queue: async () => runQueueLeaveReconnect(args.baseUrl, args.wsHost),
    cooldown: async () => [await runCooldownLeakScenario(args.baseUrl, args.wsHost)],
    blind: async () => runBlindIncompleteDivergence(args.baseUrl, args.wsHost),
    ledger: async () => [await runLedgerScenario(args.baseUrl, args.wsHost)],
    aggregate: async () => {
      const outcome = await runMultiRunAggregationProbe(args.baseUrl, args.wsHost);
      return [...(outcome.attempts ?? []), outcome.result];
    },
  };

  const selected = args.scenario === "all"
    ? Object.keys(scenarioGroups)
    : args.scenario.split(",").map((value) => value.trim()).filter(Boolean);

  for (const key of selected) {
    const scenario = scenarioGroups[key];
    if (!scenario) throw new Error(`Unknown scenario group: ${key}`);
    const results = await scenario();
    report.scenarios.push(...results);
  }

  if (args.browserSmoke) {
    report.browserSmoke = await runBrowserSmoke(args.baseUrl);
  }

  const output = JSON.stringify(report, null, 2);
  if (args.jsonOut) {
    await writeFile(args.jsonOut, `${output}\n`, "utf8");
  } else {
    process.stdout.write(`${output}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

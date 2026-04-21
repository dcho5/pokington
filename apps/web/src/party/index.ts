import type * as Party from "partykit/server";
import {
  ANNOUNCE_DELAY_MS,
  createInitialState,
  gameReducer,
  getAllInShowdownRevealDelayMs,
  hasAnimatedRunout,
  shouldRevealRunsConcurrently,
  shouldAutoRevealWinningHands,
} from "@pokington/engine";
import type { GameState, GameEvent } from "@pokington/engine";
import type { Card } from "@pokington/shared";
import {
  CORE_SEVEN_TWO_BOUNTY_BB,
  PROTOCOL_VERSION,
  toPublicGameState,
} from "./types";
import { canAcceptPeek, getBroadcastPeekedCounts } from "./peekTracking.mjs";
import {
  authenticatePresence,
  buildRoomPresenceSnapshot,
  disconnectPresence,
  setAwayPresence,
} from "./presenceTracking.mjs";
import {
  buildPublicRevealedHoleCards,
  canPubliclyRevealCard,
  cardIndexToMask,
} from "./revealTracking.mjs";
import { shouldRotatePlayerSession } from "./playerSessionIdentity.mjs";
import {
  getTimedVisibleRunCounts,
  getNextTimedRevealAt,
  isTimedShowdownRevealComplete,
} from "../lib/showdownRevealState.mjs";
import type {
  ClientMessage,
  ServerMessage,
  LedgerEntry,
  CreateTableRequest,
  CreateTableResponse,
  GetTableResponse,
  JoinTableRequest,
  JoinTableResponse,
  TableStatus,
  TableBlinds,
} from "./types";

interface PlayerStats {
  name: string;
  handsPlayed: number;
  handsWon: number;
  totalAmountWon: number;
  totalBuyIns: number;
  totalCashOuts: number;
  sessions: number;
}

interface PlayerSessionRecord {
  clientId: string;
  playerSessionId: string;
  createdAt: number;
  lastIssuedAt: number;
}

interface JoinTokenRecord {
  token: string;
  clientId: string;
  playerSessionId: string;
  expiresAt: number | null;
}

interface ControlPlaneTableRecord {
  code: string;
  status: TableStatus;
  tableName: string;
  blinds: TableBlinds;
  creatorClientId: string;
  createdAt: number;
  playerSessions: PlayerSessionRecord[];
  joinTokens: JoinTokenRecord[];
}

interface TableBootstrapResponse {
  exists: boolean;
  status: TableStatus | null;
  tableName: string | null;
  blinds: TableBlinds | null;
  creatorClientId: string | null;
}

interface TokenAuthResponse {
  ok: boolean;
  code?: string;
  message?: string;
  clientId?: string;
  playerSessionId?: string;
  isCreator?: boolean;
}

interface PersistedRoomState {
  version: 2 | 3;
  status: TableStatus;
  creatorClientId: string | null;
  gameState: GameState | null;
  sessionLedger: LedgerEntry[];
  pendingLeavePlayerIds: string[];
  playerSessions: PlayerSessionRecord[];
  joinTokens: JoinTokenRecord[];
  peekedCardMasks: Array<[string, number]>;
  publicShownCardMasks?: Array<[string, number]>;
}

const CONTROL_ROOM_ID = "__control__";
const ROOM_STATE_KEY = "roomDocument";
const VOTING_TIMEOUT_MS = 30_000;
const ACTIVE_HAND_PHASES = new Set<GameState["phase"]>(["pre-flop", "flop", "turn", "river", "voting"]);
const JOIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 12;
const ROOM_HTTP_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const TABLE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TABLE_CODE_LENGTH = 6;
const TABLE_CODE_RE = /^[A-Z0-9]{6}$/;
const EMPTY_PEEK_COUNTS: Record<string, number> = {};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: ROOM_HTTP_HEADERS });
}

function errorResponse(code: string, message: string, status = 400) {
  return jsonResponse({ code, message }, status);
}

function generateTableCode() {
  let code = "";
  for (let i = 0; i < TABLE_CODE_LENGTH; i += 1) {
    code += TABLE_CODE_ALPHABET[Math.floor(Math.random() * TABLE_CODE_ALPHABET.length)];
  }
  return code;
}

function parseRouteSegments(req: Party.Request, roomId: string) {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const roomIndex = segments.indexOf(roomId);
  return roomIndex === -1 ? segments : segments.slice(roomIndex + 1);
}

function controlTableKey(code: string) {
  return `table:${code}`;
}

export default class PokerRoom implements Party.Server {
  private gameState: GameState;
  private roomStatus: TableStatus = "creating";
  private creatorClientId: string | null = null;

  private clientIdToConnId = new Map<string, string>();
  private connIdToClientId = new Map<string, string>();
  private clientIdToPlayerSessionId = new Map<string, string>();
  private connections = new Map<string, Party.Connection>();

  private playerSessions = new Map<string, PlayerSessionRecord>();
  private joinTokens = new Map<string, JoinTokenRecord>();

  private sessionLedger = new Map<string, LedgerEntry>();
  private sessionTrackedPlayerIds = new Set<string>();
  private awayClientIds = new Set<string>();
  private pendingLeavePlayerIds = new Set<string>();
  private peekedCardMasks = new Map<string, number>();
  private publicShownCardMasks = new Map<string, number>();
  private votingTimer: ReturnType<typeof setTimeout> | null = null;
  private winnerRevealTimer: ReturnType<typeof setTimeout> | null = null;
  private publicRevealTimers: ReturnType<typeof setTimeout>[] = [];
  private lastBroadcastRevealSignature: string | null = null;

  constructor(readonly room: Party.Room) {
    this.gameState = createInitialState(room.id, { small: 25, big: 50 }, { sevenTwoBountyBB: CORE_SEVEN_TWO_BOUNTY_BB });
  }

  async onStart() {
    if (this.isControlRoom()) return;
    const saved = await this.room.storage.get<PersistedRoomState>(ROOM_STATE_KEY);
    if (!saved) return;

    this.roomStatus = saved.status;
    this.creatorClientId = saved.creatorClientId;
    if (saved.gameState) {
      this.gameState = saved.gameState;
      if (
        this.gameState.showdownKind !== "none" &&
        this.gameState.showdownKind !== "contested" &&
        this.gameState.showdownKind !== "uncontested"
      ) {
        this.gameState.showdownKind = this.gameState.winners?.length
          ? shouldAutoRevealWinningHands(this.gameState.winners) ? "contested" : "uncontested"
          : "none";
      }
      if (typeof this.gameState.autoRevealWinningHands !== "boolean") {
        this.gameState.autoRevealWinningHands = shouldAutoRevealWinningHands(
          this.gameState.winners,
          this.gameState.showdownKind,
        );
      }
      if (typeof this.gameState.autoRevealWinningHandsAt !== "number") {
        this.gameState.autoRevealWinningHandsAt = null;
      }
    }

    this.sessionLedger = new Map(saved.sessionLedger.map((entry) => [entry.playerId, entry]));
    this.sessionTrackedPlayerIds = new Set(saved.sessionLedger.map((entry) => entry.playerId));
    this.pendingLeavePlayerIds = new Set(saved.pendingLeavePlayerIds);
    this.playerSessions = new Map(saved.playerSessions.map((session) => [session.clientId, session]));
    this.joinTokens = new Map(saved.joinTokens.map((token) => [token.token, token]));
    this.peekedCardMasks = new Map(saved.peekedCardMasks ?? []);
    this.publicShownCardMasks = new Map(saved.publicShownCardMasks ?? []);
    this.cleanExpiredJoinTokens();
    this.lastBroadcastRevealSignature = null;
    this.scheduleWinnerReveal();
    this.schedulePublicRevealBroadcasts();
  }

  onConnect(conn: Party.Connection) {
    if (this.isControlRoom()) {
      conn.close();
      return;
    }
    this.connections.set(conn.id, conn);
  }

  async onMessage(rawMessage: string | ArrayBuffer, sender: Party.Connection) {
    if (this.isControlRoom()) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage)) as ClientMessage;
    } catch {
      return;
    }

    if (msg.type === "AUTH") {
      void this.handleAuth(sender, msg.token, msg.protocolVersion);
      return;
    }

    if (msg.type === "REVEAL_CARD") {
      this.handleRevealCard(sender, msg.cardIndex);
      return;
    }

    if (msg.type === "PEEK_CARD") {
      this.handlePeekCard(sender, msg.cardIndex, msg.handNumber);
      return;
    }

    if (msg.type === "GAME_EVENT") {
      this.handleGameEvent(sender, msg.event);
      return;
    }

    if (msg.type === "SET_AWAY") {
      this.handleSetAway(sender, msg.away);
      return;
    }

    if (msg.type === "QUEUE_LEAVE") {
      this.handleQueueLeave(sender);
    }
  }

  onClose(conn: Party.Connection) {
    if (this.isControlRoom()) return;

    this.connections.delete(conn.id);
    const clientId = disconnectPresence(
      {
        clientIdToConnId: this.clientIdToConnId,
        connIdToClientId: this.connIdToClientId,
        awayClientIds: this.awayClientIds,
      },
      conn.id,
    );
    if (!clientId) return;
    this.broadcastRoomPresence();
  }

  async onRequest(req: Party.Request) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: ROOM_HTTP_HEADERS });
    }
    if (this.isControlRoom()) {
      return this.handleControlRequest(req);
    }
    return this.handleGameplayRequest(req);
  }

  private isControlRoom() {
    return this.room.id === CONTROL_ROOM_ID;
  }

  private async handleControlRequest(req: Party.Request) {
    const segments = parseRouteSegments(req, this.room.id);
    if (req.method === "GET" && segments.length === 1 && segments[0] === "health") {
      return jsonResponse({
        ok: true,
        roomId: this.room.id,
        protocolVersion: PROTOCOL_VERSION,
      });
    }
    if (req.method === "GET" && segments.length === 4 && segments[0] === "internal" && segments[1] === "tables" && segments[3] === "bootstrap") {
      return this.handleBootstrapLookup(segments[2].toUpperCase());
    }
    if (req.method === "POST" && segments.length === 4 && segments[0] === "internal" && segments[1] === "tables" && segments[3] === "auth") {
      return this.handleTokenAuth(segments[2].toUpperCase(), req);
    }
    if (req.method === "POST" && segments.length === 1 && segments[0] === "tables") {
      return this.handleCreateTable(req);
    }
    if (req.method === "GET" && segments.length === 2 && segments[0] === "tables") {
      return this.handleGetTable(segments[1].toUpperCase());
    }
    if (req.method === "POST" && segments.length === 3 && segments[0] === "tables" && segments[2] === "join-token") {
      return this.handleJoinTokenIssue(segments[1].toUpperCase(), req);
    }
    return errorResponse("NOT_FOUND", "Unknown control-plane route", 404);
  }

  private async handleCreateTable(req: Party.Request) {
    let body: CreateTableRequest;
    try {
      body = await req.json<CreateTableRequest>();
    } catch {
      return errorResponse("INVALID_REQUEST", "Invalid create-table payload", 400);
    }

    const tableName = body.tableName.trim();
    if (!body.creatorClientId || !body.blinds?.small || !body.blinds?.big) {
      return errorResponse("INVALID_REQUEST", "Missing create-table fields", 400);
    }

    for (let attempt = 0; attempt < 32; attempt += 1) {
      const code = generateTableCode();
      const key = controlTableKey(code);
      const existing = await this.room.storage.get<ControlPlaneTableRecord>(key);
      if (existing) {
        continue;
      }

      const now = Date.now();
      const record: ControlPlaneTableRecord = {
        code,
        status: "active",
        tableName: tableName || `Table ${code}`,
        blinds: body.blinds,
        creatorClientId: body.creatorClientId,
        createdAt: now,
        playerSessions: [],
        joinTokens: [],
      };
      const createResponse = await this.forwardToGameplayRoom(code, "internal/create", {
        method: "POST",
        body: JSON.stringify({
          tableName: record.tableName,
          blinds: record.blinds,
          creatorClientId: record.creatorClientId,
          sevenTwoBountyBB: body.sevenTwoBountyBB ?? CORE_SEVEN_TWO_BOUNTY_BB,
        } satisfies CreateTableRequest),
      });
      if (createResponse.status !== 201) {
        const text = await createResponse.text();
        return new Response(text, { status: createResponse.status, headers: ROOM_HTTP_HEADERS });
      }

      await this.room.storage.put<ControlPlaneTableRecord>(key, record);
      return jsonResponse(
        {
          code,
          tableId: code,
          joinUrl: `/t/${code}`,
          status: record.status,
        } satisfies CreateTableResponse,
        201,
      );
    }

    return errorResponse("CODE_ALLOCATION_FAILED", "Could not allocate a unique table code", 503);
  }

  private async forwardToGameplayRoom(code: string, path: string, init: RequestInit) {
    if (!TABLE_CODE_RE.test(code)) {
      return errorResponse("INVALID_TABLE_CODE", "Invalid table code", 400);
    }

    const stub = this.room.context.parties.main.get(code);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const response = await stub.fetch(normalizedPath, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: ROOM_HTTP_HEADERS,
    });
  }

  private async handleGetTable(code: string) {
    if (!TABLE_CODE_RE.test(code)) {
      return errorResponse("INVALID_TABLE_CODE", "Invalid table code", 400);
    }
    const record = await this.room.storage.get<ControlPlaneTableRecord>(controlTableKey(code));
    if (!record || record.status !== "active") {
      return jsonResponse({
        exists: false,
        status: null,
        tableName: null,
        blinds: null,
      } satisfies GetTableResponse);
    }
    return jsonResponse({
      exists: true,
      status: record.status,
      tableName: record.tableName,
      blinds: record.blinds,
    } satisfies GetTableResponse);
  }

  private async handleJoinTokenIssue(code: string, req: Party.Request) {
    if (!TABLE_CODE_RE.test(code)) {
      return errorResponse("INVALID_TABLE_CODE", "Invalid table code", 400);
    }

    const record = await this.room.storage.get<ControlPlaneTableRecord>(controlTableKey(code));
    if (!record || record.status !== "active") {
      return errorResponse("TABLE_NOT_FOUND", "Table not found", 404);
    }

    const gameplayResponse = await this.forwardToGameplayRoom(code, "internal/join-token", {
      method: "POST",
      body: await req.text(),
    });
    const gameplayText = await gameplayResponse.text();
    return new Response(gameplayText, {
      status: gameplayResponse.status,
      headers: ROOM_HTTP_HEADERS,
    });
  }

  private async handleBootstrapLookup(code: string) {
    if (!TABLE_CODE_RE.test(code)) {
      return jsonResponse({
        exists: false,
        status: null,
        tableName: null,
        blinds: null,
        creatorClientId: null,
      } satisfies TableBootstrapResponse);
    }
    const record = await this.room.storage.get<ControlPlaneTableRecord>(controlTableKey(code));
    if (!record) {
      return jsonResponse({
        exists: false,
        status: null,
        tableName: null,
        blinds: null,
        creatorClientId: null,
      } satisfies TableBootstrapResponse);
    }
    return jsonResponse({
      exists: true,
      status: record.status,
      tableName: record.tableName,
      blinds: record.blinds,
      creatorClientId: record.creatorClientId,
    } satisfies TableBootstrapResponse);
  }

  private async handleTokenAuth(code: string, req: Party.Request) {
    if (!TABLE_CODE_RE.test(code)) {
      return jsonResponse({ ok: false, code: "INVALID_TABLE_CODE", message: "Invalid table code" } satisfies TokenAuthResponse, 400);
    }

    const record = await this.room.storage.get<ControlPlaneTableRecord>(controlTableKey(code));
    if (!record || record.status !== "active") {
      return jsonResponse({ ok: false, code: "TABLE_NOT_ACTIVE", message: "Table is not active" } satisfies TokenAuthResponse, 404);
    }

    let body: { token?: string };
    try {
      body = await req.json<{ token?: string }>();
    } catch {
      return jsonResponse({ ok: false, code: "INVALID_REQUEST", message: "Invalid auth payload" } satisfies TokenAuthResponse, 400);
    }

    const now = Date.now();
    record.joinTokens = record.joinTokens.filter((token) => token.expiresAt === null || token.expiresAt > now);
    const joinToken = body.token ? record.joinTokens.find((candidate) => candidate.token === body.token) : null;
    if (!joinToken) {
      await this.room.storage.put<ControlPlaneTableRecord>(controlTableKey(code), record);
      return jsonResponse({ ok: false, code: "INVALID_JOIN_TOKEN", message: "Join token is invalid or expired" } satisfies TokenAuthResponse, 401);
    }

    await this.room.storage.put<ControlPlaneTableRecord>(controlTableKey(code), record);
    return jsonResponse({
      ok: true,
      clientId: joinToken.clientId,
      playerSessionId: joinToken.playerSessionId,
      isCreator: joinToken.clientId === record.creatorClientId,
    } satisfies TokenAuthResponse);
  }

  private async handleGameplayRequest(req: Party.Request) {
    const segments = parseRouteSegments(req, this.room.id);
    if (req.method === "GET" && segments.length === 2 && segments[0] === "internal" && segments[1] === "status") {
      return jsonResponse(this.getTableStatusResponse());
    }
    if (req.method === "POST" && segments.length === 2 && segments[0] === "internal" && segments[1] === "create") {
      return this.handleGameplayCreate(req);
    }
    if (req.method === "POST" && segments.length === 2 && segments[0] === "internal" && segments[1] === "join-token") {
      return this.handleJoinTokenRequest(req);
    }
    return errorResponse("NOT_FOUND", "Unknown room route", 404);
  }

  private getTableStatusResponse(): GetTableResponse {
    if (this.roomStatus !== "active") {
      return {
        exists: false,
        status: null,
        tableName: null,
        blinds: null,
      };
    }
    return {
      exists: true,
      status: this.roomStatus,
      tableName: this.gameState.tableName,
      blinds: this.gameState.blinds,
    };
  }

  private async handleGameplayCreate(req: Party.Request) {
    let body: CreateTableRequest;
    try {
      body = await req.json<CreateTableRequest>();
    } catch {
      return errorResponse("INVALID_REQUEST", "Invalid room create payload", 400);
    }

    if (this.roomStatus === "active") {
      return errorResponse("TABLE_ALREADY_EXISTS", "Table code already in use", 409);
    }
    if (!TABLE_CODE_RE.test(this.room.id)) {
      return errorResponse("INVALID_TABLE_CODE", "Game rooms must use a 6-character code", 400);
    }

    const tableName = body.tableName.trim() || `Table ${this.room.id}`;
    const blinds: TableBlinds = body.blinds;
    this.gameState = createInitialState(tableName, blinds, {
      sevenTwoBountyBB: body.sevenTwoBountyBB ?? CORE_SEVEN_TWO_BOUNTY_BB,
    });
    this.roomStatus = "active";
    this.creatorClientId = body.creatorClientId;
    this.sessionLedger.clear();
    this.sessionTrackedPlayerIds.clear();
    this.pendingLeavePlayerIds.clear();
    this.playerSessions.clear();
    this.joinTokens.clear();
    this.peekedCardMasks.clear();
    this.publicShownCardMasks.clear();
    await this.persistRoomState();

    return jsonResponse(
      {
        code: this.room.id,
        tableId: this.room.id,
        joinUrl: `/t/${this.room.id}`,
        status: this.roomStatus,
      } satisfies CreateTableResponse,
      201,
    );
  }

  private async handleJoinTokenRequest(req: Party.Request) {
    if (this.roomStatus !== "active") {
      return errorResponse("TABLE_NOT_FOUND", "Table not found", 404);
    }

    let body: JoinTableRequest;
    try {
      body = await req.json<JoinTableRequest>();
    } catch {
      return errorResponse("INVALID_REQUEST", "Invalid join-token payload", 400);
    }
    if (!body.clientId) {
      return errorResponse("INVALID_REQUEST", "Missing clientId", 400);
    }

    const now = Date.now();
    this.cleanExpiredJoinTokens();
    let session = this.playerSessions.get(body.clientId);
    if (!session) {
      session = {
        clientId: body.clientId,
        playerSessionId: `player_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        createdAt: now,
        lastIssuedAt: now,
      };
      this.playerSessions.set(body.clientId, session);
      this.clientIdToPlayerSessionId.set(body.clientId, session.playerSessionId);
    } else {
      session.lastIssuedAt = now;
      this.clientIdToPlayerSessionId.set(body.clientId, session.playerSessionId);
    }

    const token = crypto.randomUUID();
    this.joinTokens.set(token, {
      token,
      clientId: body.clientId,
      playerSessionId: session.playerSessionId,
      expiresAt: now + JOIN_TOKEN_TTL_MS,
    });
    await this.persistRoomState();

    return jsonResponse({
      token,
      tableId: this.room.id,
      playerSessionId: session.playerSessionId,
      isCreator: body.clientId === this.creatorClientId,
    } satisfies JoinTableResponse);
  }

  private async handleAuth(conn: Party.Connection, token: string, protocolVersion: number) {
    if (protocolVersion !== PROTOCOL_VERSION) {
      this.send(conn, { type: "ERROR", code: "PROTOCOL_VERSION_MISMATCH", message: "Client protocol mismatch" });
      conn.close();
      return;
    }
    if (this.roomStatus !== "active") {
      this.send(conn, { type: "ERROR", code: "TABLE_NOT_ACTIVE", message: "Table is not active" });
      conn.close();
      return;
    }

    this.cleanExpiredJoinTokens();
    const joinToken = this.joinTokens.get(token);
    if (!joinToken) {
      this.send(conn, { type: "ERROR", code: "INVALID_JOIN_TOKEN", message: "Join token is invalid or expired" });
      conn.close();
      return;
    }

    const { clientId, playerSessionId } = joinToken;
    this.clientIdToPlayerSessionId.set(clientId, playerSessionId);
    authenticatePresence(
      {
        clientIdToConnId: this.clientIdToConnId,
        connIdToClientId: this.connIdToClientId,
        awayClientIds: this.awayClientIds,
      },
      clientId,
      conn.id,
    );

    this.send(conn, {
      type: "WELCOME",
      playerSessionId,
      isCreator: clientId === this.creatorClientId,
    });
    const now = Date.now();
    this.send(conn, { type: "TABLE_STATE", state: toPublicGameState(this.gameState, now) });
    this.sendPrivateTo(conn, clientId);
    this.send(conn, { type: "LEDGER_STATE", entries: Array.from(this.sessionLedger.values()) });
    this.broadcastRoomPresence();
  }

  private handleGameEvent(conn: Party.Connection, event: GameEvent) {
    const clientId = this.connIdToClientId.get(conn.id);
    if (!clientId) {
      this.send(conn, { type: "ERROR", code: "INVALID_JOIN_TOKEN", message: "Must authenticate first" });
      return;
    }

    const myPlayerId = this.rotatePlayerSessionForSitDownIfNeeded(conn, clientId, event);
    const isDebug = process.env.PARTYKIT_DEBUG_MODE === "true";

    const enriched = this.enrichEvent(event, myPlayerId, clientId, isDebug);
    if (!enriched) {
      this.send(conn, { type: "ERROR", code: "ACTION_REJECTED", message: "Action rejected" });
      return;
    }

    if (enriched.type === "PLAYER_ACTION" && !isDebug && this.gameState.needsToAct[0] !== enriched.playerId) {
      this.send(conn, { type: "ERROR", code: "ACTION_REJECTED", message: "Not your turn" });
      return;
    }

    if (enriched.type === "STAND_UP") {
      const player = this.gameState.players[enriched.playerId];
      const mustWaitForHandEnd =
        !!player &&
        ACTIVE_HAND_PHASES.has(this.gameState.phase) &&
        (player.holeCards !== null || player.currentBet > 0 || player.totalContribution > 0 || !player.sitOutUntilBB);
      if (mustWaitForHandEnd) {
        this.send(conn, {
          type: "ERROR",
          code: "ACTION_REJECTED",
          message: "Use Leave Next Hand while a hand is in progress",
        });
        return;
      }
    }

    if (enriched.type === "SIT_DOWN") {
      const existing = this.gameState.players[enriched.playerId];
      if (existing && existing.stack === 0) {
        this.onStandUp(enriched.playerId, 0);
        void this.persistCashOut(enriched.playerId, 0);
        this.gameState = gameReducer(this.gameState, { type: "STAND_UP", playerId: enriched.playerId });
      }
    }

    if (enriched.type === "START_HAND") {
      for (const pid of this.pendingLeavePlayerIds) {
        const player = this.gameState.players[pid];
        if (player) {
          this.onStandUp(pid, player.stack);
          void this.persistCashOut(pid, player.stack);
          this.gameState = gameReducer(this.gameState, { type: "STAND_UP", playerId: pid });
        }
      }
      this.pendingLeavePlayerIds.clear();
      for (const player of Object.values(this.gameState.players)) {
        if (player.stack === 0) {
          this.onStandUp(player.id, 0);
          void this.persistCashOut(player.id, 0);
          this.gameState = gameReducer(this.gameState, { type: "STAND_UP", playerId: player.id });
        }
      }
    }

    const prevState = this.gameState;
    try {
      this.gameState = gameReducer(this.gameState, enriched);
    } catch {
      this.send(conn, { type: "ERROR", code: "ACTION_REJECTED", message: "Engine rejected action" });
      return;
    }

    if (enriched.type === "SIT_DOWN" && !prevState.players[enriched.playerId] && this.gameState.players[enriched.playerId]) {
      const seatedPlayer = this.gameState.players[enriched.playerId];
      if (seatedPlayer) {
        this.onSitDown(seatedPlayer.id, seatedPlayer.name, seatedPlayer.stack);
      }
    }
    if (enriched.type === "STAND_UP" && prevState.players[enriched.playerId] && !this.gameState.players[enriched.playerId]) {
      const player = prevState.players[enriched.playerId];
      if (player) {
        this.onStandUp(enriched.playerId, player.stack);
        void this.persistCashOut(enriched.playerId, player.stack);
        this.peekedCardMasks.delete(enriched.playerId);
        this.publicShownCardMasks.delete(enriched.playerId);
      }
    }
    if (prevState.phase !== "showdown" && this.gameState.phase === "showdown") {
      this.initializeShowdownRevealState(prevState, this.gameState);
      this.gameState.autoRevealWinningHandsAt = this.computeWinnerRevealAt(prevState, this.gameState);
      this.promoteFullyShownCardsAtShowdown();
      this.lastBroadcastRevealSignature = this.getTimedRevealSignature(this.gameState);
      this.scheduleWinnerReveal();
      this.schedulePublicRevealBroadcasts();
      void this.persistShowdownStats(this.gameState);
    }
    if (this.gameState.handNumber !== prevState.handNumber) {
      this.peekedCardMasks.clear();
      this.publicShownCardMasks.clear();
      this.clearWinnerRevealTimer();
      this.clearPublicRevealTimers();
      this.lastBroadcastRevealSignature = null;
    }

    this.manageVotingTimer(prevState, this.gameState);
    this.broadcastState();
    this.broadcastAllPrivate();
    this.broadcastRoomPresence();
    void this.persistRoomState();
  }

  private enrichEvent(event: GameEvent, myPlayerId: string, clientId: string, isDebug: boolean): GameEvent | null {
    if (event.type === "RESOLVE_VOTE") {
      return null;
    }
    if (event.type === "SET_SEVEN_TWO_BOUNTY") {
      return !isDebug && clientId !== this.creatorClientId ? null : event;
    }
    if ("playerId" in event) {
      return !isDebug && event.playerId !== myPlayerId ? null : event;
    }
    if (event.type === "START_HAND" && !isDebug && clientId !== this.creatorClientId) {
      return null;
    }
    return event;
  }

  private rotatePlayerSessionForSitDownIfNeeded(conn: Party.Connection, clientId: string, event: GameEvent): string {
    const currentPlayerId = this.clientIdToPlayerSessionId.get(clientId) ?? "";
    if (
      event.type !== "SIT_DOWN" ||
      !shouldRotatePlayerSession({
        currentPlayerId,
        gameStatePlayers: this.gameState.players,
        sessionLedger: this.sessionLedger,
        requestedName: event.name,
      })
    ) {
      return currentPlayerId;
    }

    const now = Date.now();
    const nextSession: PlayerSessionRecord = {
      clientId,
      playerSessionId: `player_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      createdAt: now,
      lastIssuedAt: now,
    };
    this.playerSessions.set(clientId, nextSession);
    this.clientIdToPlayerSessionId.set(clientId, nextSession.playerSessionId);
    this.send(conn, {
      type: "WELCOME",
      playerSessionId: nextSession.playerSessionId,
      isCreator: clientId === this.creatorClientId,
    });
    return nextSession.playerSessionId;
  }

  private handleSetAway(conn: Party.Connection, away: boolean) {
    const clientId = this.connIdToClientId.get(conn.id);
    if (!clientId) return;
    setAwayPresence(this.awayClientIds, clientId, away);
    this.broadcastRoomPresence();
  }

  private handleQueueLeave(conn: Party.Connection) {
    const clientId = this.connIdToClientId.get(conn.id);
    if (!clientId) return;
    const playerId = this.clientIdToPlayerSessionId.get(clientId);
    if (!playerId || !this.gameState.players[playerId]) return;
    this.pendingLeavePlayerIds.add(playerId);
  }

  private handleRevealCard(conn: Party.Connection, cardIndex: 0 | 1) {
    const clientId = this.connIdToClientId.get(conn.id);
    if (!clientId) return;
    const playerId = this.clientIdToPlayerSessionId.get(clientId);
    if (!playerId) return;

    if (!canPubliclyRevealCard({
      gameState: this.gameState,
      playerId,
      cardIndex,
      publicShownCardMasks: this.publicShownCardMasks,
    })) {
      return;
    }

    const nextMask = (this.publicShownCardMasks.get(playerId) ?? 0) | cardIndexToMask(cardIndex);
    this.publicShownCardMasks.set(playerId, nextMask);

    if (this.gameState.phase === "showdown" && nextMask === 3) {
      this.promoteFullyShownCardsAtShowdown([playerId]);
    }

    this.broadcastState();
    this.broadcastAllPrivate();
    void this.persistRoomState();
  }

  private handlePeekCard(conn: Party.Connection, cardIndex: 0 | 1, handNumber: number) {
    const clientId = this.connIdToClientId.get(conn.id);
    if (!clientId) return;
    const playerId = this.clientIdToPlayerSessionId.get(clientId);
    if (!playerId || !canAcceptPeek({ gameState: this.gameState, playerId, handNumber })) return;

    const bit = cardIndex === 0 ? 1 : 2;
    const prevMask = this.peekedCardMasks.get(playerId) ?? 0;
    const nextMask = prevMask | bit;
    if (nextMask === prevMask) return;

    this.peekedCardMasks.set(playerId, nextMask);
    this.broadcastRoomPresence();
    void this.persistRoomState();
  }

  private manageVotingTimer(prev: GameState, next: GameState) {
    if (prev.phase !== "voting" && next.phase === "voting") {
      if (this.votingTimer) clearTimeout(this.votingTimer);
      this.votingTimer = setTimeout(() => {
        this.votingTimer = null;
        if (this.gameState.phase !== "voting") return;
        const prevState = this.gameState;
        this.gameState = gameReducer(this.gameState, { type: "RESOLVE_VOTE" });
        if (prevState.phase !== "showdown" && this.gameState.phase === "showdown") {
          this.initializeShowdownRevealState(prevState, this.gameState);
          this.gameState.autoRevealWinningHandsAt = this.computeWinnerRevealAt(prevState, this.gameState);
          this.promoteFullyShownCardsAtShowdown();
          this.scheduleWinnerReveal();
          this.schedulePublicRevealBroadcasts();
          void this.persistShowdownStats(this.gameState);
        }
        this.broadcastState();
        this.broadcastAllPrivate();
        void this.persistRoomState();
      }, VOTING_TIMEOUT_MS);
    }
    if (prev.phase === "voting" && next.phase !== "voting" && this.votingTimer) {
      clearTimeout(this.votingTimer);
      this.votingTimer = null;
    }
  }

  private clearWinnerRevealTimer() {
    if (this.winnerRevealTimer) {
      clearTimeout(this.winnerRevealTimer);
      this.winnerRevealTimer = null;
    }
  }

  private clearPublicRevealTimers() {
    for (const timer of this.publicRevealTimers) {
      clearTimeout(timer);
    }
    this.publicRevealTimers = [];
  }

  private initializeShowdownRevealState(prev: GameState, next: GameState) {
    next.knownCardCountAtRunIt = 0;
    next.runDealStartedAt = null;
    next.showdownStartedAt = null;

    if (next.phase !== "showdown") return;

    const runCount = Math.max(1, next.runResults.length);
    const knownCardCount = Math.max(prev.communityCards.length, prev.communityCards2.length);
    if (!hasAnimatedRunout(knownCardCount, runCount)) return;

    const now = Date.now();
    next.knownCardCountAtRunIt = knownCardCount;
    next.showdownStartedAt = now;
    next.runDealStartedAt = prev.phase === "voting" ? null : now;
  }

  private schedulePublicRevealBroadcasts() {
    this.clearPublicRevealTimers();

    if (this.gameState.phase !== "showdown") return;

    const runCount = Math.max(1, this.gameState.runResults.length);
    const knownCardCount = this.gameState.knownCardCountAtRunIt;
    if (!hasAnimatedRunout(knownCardCount, runCount)) return;
    const revealRunsConcurrently = shouldRevealRunsConcurrently(this.gameState.isBombPot, runCount);

    const handNumber = this.gameState.handNumber;
    const showdownStartedAt = this.gameState.showdownStartedAt;
    if (showdownStartedAt == null) return;

    if (this.gameState.runDealStartedAt == null) {
      const revealStartAt = showdownStartedAt + ANNOUNCE_DELAY_MS;
      const delay = revealStartAt - Date.now();

      if (delay <= 0) {
        this.gameState.runDealStartedAt = Date.now();
        this.broadcastState();
        void this.persistRoomState();
        this.schedulePublicRevealBroadcasts();
        return;
      }

      this.publicRevealTimers.push(setTimeout(() => {
        if (
          this.gameState.phase !== "showdown" ||
          this.gameState.handNumber !== handNumber ||
          this.gameState.showdownStartedAt !== showdownStartedAt ||
          this.gameState.runDealStartedAt != null
        ) {
          return;
        }
        this.gameState.runDealStartedAt = Date.now();
        this.broadcastState();
        void this.persistRoomState();
        this.schedulePublicRevealBroadcasts();
      }, delay));
      return;
    }

    const runDealStartedAt = this.gameState.runDealStartedAt;
    const now = Date.now();
    const currentRevealSignature = this.getTimedRevealSignature(this.gameState, now);
    if (
      currentRevealSignature !== null &&
      currentRevealSignature !== this.lastBroadcastRevealSignature
    ) {
      this.broadcastState();
      void this.persistRoomState();
      this.schedulePublicRevealBroadcasts();
      return;
    }
    const nextRevealAt = getNextTimedRevealAt({
      knownCardCount,
      runCount,
      runDealStartedAt,
      now,
      revealRunsConcurrently,
    });

    if (nextRevealAt == null) {
      if (isTimedShowdownRevealComplete({
        knownCardCount,
        runCount,
        runDealStartedAt,
        now,
        revealRunsConcurrently,
      }) && currentRevealSignature !== this.lastBroadcastRevealSignature) {
        this.broadcastState();
        void this.persistRoomState();
      }
      return;
    }

    this.publicRevealTimers.push(setTimeout(() => {
      if (
        this.gameState.phase !== "showdown" ||
        this.gameState.handNumber !== handNumber ||
        this.gameState.runDealStartedAt !== runDealStartedAt
      ) {
        return;
      }
      this.broadcastState();
      void this.persistRoomState();
      this.schedulePublicRevealBroadcasts();
    }, Math.max(0, nextRevealAt - now)));
  }

  private computeWinnerRevealAt(prev: GameState, next: GameState): number | null {
    if (next.phase !== "showdown" || !next.autoRevealWinningHands) return null;

    const knownCardCount = Math.max(prev.communityCards.length, prev.communityCards2.length);
    const runCount = Math.max(1, next.runResults.length);
    const isAnimatedRunout = knownCardCount < 5 || runCount > 1;
    if (!isAnimatedRunout) return Date.now();
    const revealRunsConcurrently = shouldRevealRunsConcurrently(next.isBombPot, runCount);

    return Date.now() + getAllInShowdownRevealDelayMs(knownCardCount, runCount, { revealRunsConcurrently });
  }

  private scheduleWinnerReveal() {
    this.clearWinnerRevealTimer();
    if (this.gameState.phase !== "showdown" || !this.gameState.autoRevealWinningHands) return;

    const revealAt = this.gameState.autoRevealWinningHandsAt;
    if (revealAt == null || revealAt <= Date.now()) {
      this.broadcastAllPrivate();
      return;
    }

    const handNumber = this.gameState.handNumber;
    this.winnerRevealTimer = setTimeout(() => {
      this.winnerRevealTimer = null;
      if (
        this.gameState.phase !== "showdown" ||
        !this.gameState.autoRevealWinningHands ||
        this.gameState.handNumber !== handNumber
      ) {
        return;
      }
      this.broadcastAllPrivate();
    }, Math.max(0, revealAt - Date.now()));
  }

  private broadcastLedger() {
    const entries = Array.from(this.sessionLedger.values());
    this.broadcast({ type: "LEDGER_STATE", entries });
  }

  private syncLedgerStacks() {
    let changed = false;
    for (const entry of this.sessionLedger.values()) {
      if (!entry.isSeated) continue;
      const player = this.gameState.players[entry.playerId];
      if (player && player.stack !== entry.currentStack) {
        entry.currentStack = player.stack;
        changed = true;
      }
    }
    if (!changed) return;
    const phase = this.gameState.phase;
    if (phase === "waiting" || phase === "showdown") {
      this.broadcastLedger();
    }
  }

  private onSitDown(playerId: string, name: string, buyIn: number) {
    const entry = this.sessionLedger.get(playerId);
    if (entry) {
      entry.buyIns.push(buyIn);
      entry.isSeated = true;
      entry.currentStack = buyIn;
      entry.name = name;
    } else {
      this.sessionLedger.set(playerId, {
        playerId,
        name,
        buyIns: [buyIn],
        cashOuts: [],
        isSeated: true,
        currentStack: buyIn,
      });
    }
    if (!this.sessionTrackedPlayerIds.has(playerId)) {
      this.sessionTrackedPlayerIds.add(playerId);
      void this.incrementSession(playerId, name, buyIn);
    } else {
      void this.persistBuyIn(playerId, buyIn);
    }
    this.broadcastLedger();
  }

  private onStandUp(playerId: string, stack: number) {
    const entry = this.sessionLedger.get(playerId);
    if (!entry) return;
    entry.cashOuts.push(stack);
    entry.isSeated = false;
    entry.currentStack = 0;
    this.broadcastLedger();
  }

  private async incrementSession(playerId: string, name: string, buyIn: number) {
    const key = `stats:${playerId}`;
    const existing = await this.room.storage.get<PlayerStats>(key);
    const stats: PlayerStats = existing ?? {
      name,
      handsPlayed: 0,
      handsWon: 0,
      totalAmountWon: 0,
      totalBuyIns: 0,
      totalCashOuts: 0,
      sessions: 0,
    };
    stats.sessions += 1;
    stats.totalBuyIns += buyIn;
    stats.name = name;
    await this.room.storage.put<PlayerStats>(key, stats);
  }

  private async persistBuyIn(playerId: string, buyIn: number) {
    const key = `stats:${playerId}`;
    const existing = await this.room.storage.get<PlayerStats>(key);
    if (!existing) return;
    existing.totalBuyIns += buyIn;
    await this.room.storage.put<PlayerStats>(key, existing);
  }

  private async persistCashOut(playerId: string, stack: number) {
    const key = `stats:${playerId}`;
    const existing = await this.room.storage.get<PlayerStats>(key);
    if (!existing) return;
    existing.totalCashOuts += stack;
    await this.room.storage.put<PlayerStats>(key, existing);
  }

  private async persistShowdownStats(state: GameState) {
    const winAmounts = new Map<string, number>();
    for (const winner of state.winners ?? []) {
      winAmounts.set(winner.playerId, (winAmounts.get(winner.playerId) ?? 0) + winner.amount);
    }
    await Promise.all(Object.keys(state.players).map((id) => this.updateHandStats(id, winAmounts.get(id) ?? 0)));
  }

  private async updateHandStats(playerId: string, amountWon: number) {
    const key = `stats:${playerId}`;
    const existing = await this.room.storage.get<PlayerStats>(key);
    if (!existing) return;
    existing.handsPlayed += 1;
    if (amountWon > 0) {
      existing.handsWon += 1;
      existing.totalAmountWon += amountWon;
    }
    await this.room.storage.put<PlayerStats>(key, existing);
  }

  private broadcastState() {
    this.syncLedgerStacks();
    const now = Date.now();
    this.broadcast({ type: "TABLE_STATE", state: toPublicGameState(this.gameState, now) });
    this.lastBroadcastRevealSignature = this.getTimedRevealSignature(this.gameState, now);
  }

  private getTimedRevealSignature(state: GameState, now = Date.now()): string | null {
    if (state.phase !== "showdown") return null;

    const runCount = Math.max(1, state.runResults.length);
    const knownCardCount = state.knownCardCountAtRunIt;
    if (!hasAnimatedRunout(knownCardCount, runCount) || state.runDealStartedAt == null) {
      return null;
    }

    const revealRunsConcurrently = shouldRevealRunsConcurrently(state.isBombPot, runCount);
    const visibleCounts = getTimedVisibleRunCounts({
      knownCardCount,
      runCount,
      runDealStartedAt: state.runDealStartedAt,
      now,
      revealRunsConcurrently,
    });
    return `${state.handNumber}:${state.runDealStartedAt}:${visibleCounts.join(",")}`;
  }

  private async persistRoomState() {
    const snapshot: PersistedRoomState = {
      version: 3,
      status: this.roomStatus,
      creatorClientId: this.creatorClientId,
      gameState: this.roomStatus === "active" ? this.gameState : null,
      sessionLedger: Array.from(this.sessionLedger.values()),
      pendingLeavePlayerIds: Array.from(this.pendingLeavePlayerIds),
      playerSessions: Array.from(this.playerSessions.values()),
      joinTokens: Array.from(this.joinTokens.values()),
      peekedCardMasks: Array.from(this.peekedCardMasks.entries()),
      publicShownCardMasks: Array.from(this.publicShownCardMasks.entries()),
    };
    await this.room.storage.put<PersistedRoomState>(ROOM_STATE_KEY, snapshot);
  }

  private broadcastAllPrivate() {
    for (const [clientId, connId] of this.clientIdToConnId) {
      const conn = this.connections.get(connId);
      if (conn) this.sendPrivateTo(conn, clientId);
    }
  }

  private sendPrivateTo(conn: Party.Connection, clientId: string) {
    const playerId = this.clientIdToPlayerSessionId.get(clientId);
    const player = playerId ? this.gameState.players[playerId] : null;
    const holeCards = player?.holeCards ?? null;
    const revealedHoleCards = buildPublicRevealedHoleCards({
      gameState: this.gameState,
      publicShownCardMasks: this.publicShownCardMasks,
    }) as Record<string, [Card | null, Card | null]>;

    this.send(conn, { type: "PRIVATE_STATE", holeCards, revealedHoleCards });
  }

  private promoteFullyShownCardsAtShowdown(playerIds?: string[]) {
    if (this.gameState.phase !== "showdown") return;

    const candidateIds = playerIds ?? Array.from(this.publicShownCardMasks.entries())
      .filter(([, mask]) => mask === 3)
      .map(([playerId]) => playerId);

    let nextState = this.gameState;
    for (const playerId of candidateIds) {
      if ((this.publicShownCardMasks.get(playerId) ?? 0) !== 3) continue;
      if (nextState.voluntaryShownPlayerIds.includes(playerId)) continue;
      nextState = gameReducer(nextState, { type: "SHOW_CARDS", playerId });
    }
    this.gameState = nextState;
  }

  private broadcastRoomPresence() {
    const { connectedPlayerIds, awayPlayerIds } = buildRoomPresenceSnapshot(
      this.clientIdToConnId,
      this.clientIdToPlayerSessionId,
      this.awayClientIds,
    );
    const peekedCounts = getBroadcastPeekedCounts(this.gameState, this.peekedCardMasks);
    this.broadcast({
      type: "ROOM_PRESENCE",
      connectedPlayerIds,
      awayPlayerIds,
      peekedCounts,
    });
  }

  private cleanExpiredJoinTokens() {
    const now = Date.now();
    for (const [token, record] of this.joinTokens) {
      if (record.expiresAt !== null && record.expiresAt <= now) {
        this.joinTokens.delete(token);
      }
    }
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }
}

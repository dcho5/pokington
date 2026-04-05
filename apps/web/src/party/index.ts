import type * as Party from "partykit/server";
import { gameReducer, createInitialState } from "@pokington/engine";
import type { GameState, GameEvent } from "@pokington/engine";
import type { Card } from "@pokington/shared";
import { toPublicGameState } from "./types";
import type { ClientMessage, ServerMessage } from "./types";

const TURN_TIMEOUT_MS = 30_000;
const VOTING_TIMEOUT_MS = 30_000;

export default class PokerRoom implements Party.Server {
  private gameState: GameState;
  private creatorUserId: string | null = null;
  private isConfigured = false;

  // userId ↔ connectionId maps
  private userIdToConnId = new Map<string, string>();
  private connIdToUserId = new Map<string, string>();

  // userId → stable playerId ("user_XXXXXXXX")
  private userIdToPlayerId = new Map<string, string>();

  // Live connection objects (cleared on close)
  private connections = new Map<string, Party.Connection>();

  // Per-card voluntary reveals (server-side only, not in engine)
  private revealedCardsByPlayerId = new Map<string, Set<0 | 1>>();

  // Server-side timers
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private votingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTurnActorId: string | null = null;

  constructor(readonly room: Party.Room) {
    this.gameState = createInitialState(room.id, { small: 25, big: 50 });
  }

  onConnect(conn: Party.Connection) {
    this.connections.set(conn.id, conn);
    // Wait for AUTH before sending anything
  }

  onMessage(rawMessage: string | ArrayBuffer, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage)) as ClientMessage;
    } catch {
      return;
    }

    if (msg.type === "AUTH") {
      this.handleAuth(sender, msg.userId);
    } else if (msg.type === "CONFIGURE") {
      this.handleConfigure(sender, msg);
    } else if (msg.type === "GAME_EVENT") {
      this.handleGameEvent(sender, msg.event);
    } else if (msg.type === "REVEAL_CARD") {
      this.handleRevealCard(sender, msg.cardIndex);
    }
  }

  onClose(conn: Party.Connection) {
    this.connections.delete(conn.id);
    const userId = this.connIdToUserId.get(conn.id);
    if (userId) {
      this.connIdToUserId.delete(conn.id);
      // Only clear the userId→connId mapping if it points to THIS connection
      if (this.userIdToConnId.get(userId) === conn.id) {
        this.userIdToConnId.delete(userId);
      }
    }
    this.broadcastRoomMeta();
  }

  // ── Auth ──

  private handleAuth(conn: Party.Connection, userId: string) {
    const playerId = `user_${userId.slice(0, 8)}`;

    // Evict any stale mapping for this userId
    const oldConnId = this.userIdToConnId.get(userId);
    if (oldConnId && oldConnId !== conn.id) {
      this.connIdToUserId.delete(oldConnId);
    }

    this.connIdToUserId.set(conn.id, userId);
    this.userIdToConnId.set(userId, conn.id);
    this.userIdToPlayerId.set(userId, playerId);

    if (!this.creatorUserId) this.creatorUserId = userId;
    const isCreator = userId === this.creatorUserId;

    // Reject non-creators joining a room that hasn't been configured yet
    if (!this.isConfigured && !isCreator) {
      this.send(conn, { type: "ERROR", code: "TABLE_NOT_FOUND", message: "Table not found" });
      return;
    }

    this.send(conn, { type: "WELCOME", yourUserId: userId, isCreator });
    this.send(conn, { type: "STATE", state: toPublicGameState(this.gameState) });
    this.sendPrivateTo(conn, userId);
    this.broadcastRoomMeta();
  }

  // ── Configure ──

  private handleConfigure(conn: Party.Connection, msg: Extract<ClientMessage, { type: "CONFIGURE" }>) {
    const userId = this.connIdToUserId.get(conn.id);
    if (!userId || userId !== this.creatorUserId) {
      this.send(conn, { type: "ERROR", code: "NOT_AUTHORIZED", message: "Only the creator can configure the table" });
      return;
    }
    if (this.gameState.handNumber > 0) {
      this.send(conn, { type: "ERROR", code: "GAME_STARTED", message: "Cannot configure after first hand" });
      return;
    }
    this.gameState = createInitialState(msg.tableName, msg.blinds, { sevenTwoBountyBB: msg.sevenTwoBountyBB });
    this.isConfigured = true;
    this.broadcastState();
  }

  // ── Game events ──

  private handleGameEvent(conn: Party.Connection, event: GameEvent) {
    const userId = this.connIdToUserId.get(conn.id);
    if (!userId) {
      this.send(conn, { type: "ERROR", code: "NOT_AUTHENTICATED", message: "Must AUTH first" });
      return;
    }

    const myPlayerId = this.userIdToPlayerId.get(userId) ?? "";
    const isDebug = process.env.PARTYKIT_DEBUG_MODE === "true";

    // Validate / enrich event
    const enriched = this.enrichEvent(event, myPlayerId, userId, isDebug);
    if (!enriched) {
      this.send(conn, { type: "ERROR", code: "NOT_AUTHORIZED", message: "Not authorized" });
      return;
    }

    // Validate turn for PLAYER_ACTION
    if (enriched.type === "PLAYER_ACTION" && !isDebug) {
      if (this.gameState.needsToAct[0] !== enriched.playerId) {
        this.send(conn, { type: "ERROR", code: "NOT_YOUR_TURN", message: "Not your turn" });
        return;
      }
    }

    // Reset per-card reveals on new hand
    if (enriched.type === "START_HAND") {
      this.revealedCardsByPlayerId.clear();
      // Auto-kick $0 players
      for (const player of Object.values(this.gameState.players)) {
        if (player.stack === 0) {
          this.gameState = gameReducer(this.gameState, { type: "STAND_UP", playerId: player.id });
        }
      }
    }

    const prevState = this.gameState;
    this.gameState = gameReducer(this.gameState, enriched);

    this.manageTurnTimer(prevState, this.gameState);
    this.manageVotingTimer(prevState, this.gameState);

    this.broadcastState();
    this.broadcastAllPrivate();
  }

  private enrichEvent(event: GameEvent, myPlayerId: string, userId: string, isDebug: boolean): GameEvent | null {
    if (event.type === "SET_SEVEN_TWO_BOUNTY") {
      if (!isDebug && userId !== this.creatorUserId) return null;
      return event;
    }

    // Events with a playerId field — validate ownership
    if ("playerId" in event) {
      const claimed = (event as { playerId: string }).playerId;
      if (!isDebug && claimed !== myPlayerId) return null;
      return event; // playerId already matches (server computed same hash)
    }

    // Events without playerId: START_HAND, RESOLVE_VOTE
    return event;
  }

  // ── Per-card voluntary reveal ──

  private handleRevealCard(conn: Party.Connection, cardIndex: 0 | 1) {
    const userId = this.connIdToUserId.get(conn.id);
    if (!userId) return;
    const playerId = this.userIdToPlayerId.get(userId);
    if (!playerId) return;
    if (this.gameState.phase !== "showdown") return;

    const player = this.gameState.players[playerId];
    if (!player?.holeCards) return;

    let revealed = this.revealedCardsByPlayerId.get(playerId);
    if (!revealed) {
      revealed = new Set<0 | 1>();
      this.revealedCardsByPlayerId.set(playerId, revealed);
    }
    revealed.add(cardIndex);

    // When both cards are revealed, also dispatch SHOW_CARDS engine event (triggers 7-2 bounty)
    if (revealed.size === 2 && !this.gameState.voluntaryShownPlayerIds.includes(playerId)) {
      const prev = this.gameState;
      this.gameState = gameReducer(this.gameState, { type: "SHOW_CARDS", playerId });
      this.manageTurnTimer(prev, this.gameState);
      this.broadcastState();
    }

    // Push updated PRIVATE to all connections
    this.broadcastAllPrivate();
  }

  // ── Server-side timers ──

  private manageTurnTimer(prev: GameState, next: GameState) {
    const nextActor = next.needsToAct[0] ?? null;
    const prevActor = prev.needsToAct[0] ?? null;

    if (nextActor === prevActor && nextActor !== null) return; // no change

    // Clear existing timer
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    this.pendingTurnActorId = null;

    const isPlayingPhase = ["pre-flop", "flop", "turn", "river"].includes(next.phase);
    if (!nextActor || !isPlayingPhase) return;

    this.pendingTurnActorId = nextActor;
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      if (this.gameState.needsToAct[0] !== this.pendingTurnActorId) return;
      const actorId = this.pendingTurnActorId!;
      this.pendingTurnActorId = null;
      const prev2 = this.gameState;
      this.gameState = gameReducer(this.gameState, { type: "PLAYER_ACTION", playerId: actorId, action: "fold" });
      this.manageTurnTimer(prev2, this.gameState);
      this.manageVotingTimer(prev2, this.gameState);
      this.broadcastState();
      this.broadcastAllPrivate();
    }, TURN_TIMEOUT_MS);
  }

  private manageVotingTimer(prev: GameState, next: GameState) {
    if (prev.phase !== "voting" && next.phase === "voting") {
      if (this.votingTimer) clearTimeout(this.votingTimer);
      this.votingTimer = setTimeout(() => {
        this.votingTimer = null;
        if (this.gameState.phase !== "voting") return;
        const prev2 = this.gameState;
        this.gameState = gameReducer(this.gameState, { type: "RESOLVE_VOTE" });
        this.manageTurnTimer(prev2, this.gameState);
        this.broadcastState();
        this.broadcastAllPrivate();
      }, VOTING_TIMEOUT_MS);
    }
    if (prev.phase === "voting" && next.phase !== "voting") {
      if (this.votingTimer) { clearTimeout(this.votingTimer); this.votingTimer = null; }
    }
  }

  // ── Broadcasting ──

  private broadcastState() {
    this.broadcast({ type: "STATE", state: toPublicGameState(this.gameState) });
  }

  private broadcastAllPrivate() {
    for (const [userId, connId] of this.userIdToConnId) {
      const conn = this.connections.get(connId);
      if (conn) this.sendPrivateTo(conn, userId);
    }
  }

  private sendPrivateTo(conn: Party.Connection, userId: string) {
    const playerId = this.userIdToPlayerId.get(userId);
    const player = playerId ? this.gameState.players[playerId] : null;
    const holeCards = player?.holeCards ?? null;

    const revealedHoleCards: Record<string, [Card | null, Card | null]> = {};
    const state = this.gameState;

    if (state.phase === "showdown") {
      const isContested = !(
        state.winners?.length === 1 &&
        (state.winners[0].hand === "Uncontested" || state.winners[0].hand === "Last standing")
      );
      for (const [id, p] of Object.entries(state.players)) {
        if (id === playerId || !p.holeCards) continue;
        // Auto-reveal all non-folded cards in contested showdown
        if (!p.isFolded && isContested) {
          revealedHoleCards[id] = [p.holeCards[0], p.holeCards[1]];
          continue;
        }
        // Voluntary per-card reveals
        const revealed = this.revealedCardsByPlayerId.get(id);
        if (revealed && revealed.size > 0) {
          revealedHoleCards[id] = [
            revealed.has(0) ? p.holeCards[0] : null,
            revealed.has(1) ? p.holeCards[1] : null,
          ];
        }
      }
    }

    this.send(conn, { type: "PRIVATE", holeCards, revealedHoleCards });
  }

  private broadcastRoomMeta() {
    const connectedUserIds = Array.from(this.userIdToConnId.keys());
    this.broadcast({ type: "ROOM_META", creatorUserId: this.creatorUserId, connectedUserIds });
  }

  // ── Helpers ──

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }
}

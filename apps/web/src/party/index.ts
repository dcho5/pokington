import type * as Party from "partykit/server";
import { gameReducer, createInitialState } from "@pokington/engine";
import type { GameState, GameEvent } from "@pokington/engine";
import type { Card } from "@pokington/shared";
import { toPublicGameState } from "./types";
import type { ClientMessage, ServerMessage, LedgerEntry } from "./types";

interface PlayerStats {
  name: string;
  handsPlayed: number;
  handsWon: number;
  totalAmountWon: number;
  totalBuyIns: number;
  totalCashOuts: number;
  sessions: number;
}

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

  // Per-card peek tracking (which cards each player has peeked at)
  private peekedCardsByPlayerId = new Map<string, Set<0 | 1>>();

  // Turn timer setting (synced to all clients)
  private turnTimerEnabled = true;

  // Session ledger
  private sessionLedger = new Map<string, LedgerEntry>();
  private sessionTrackedPlayerIds = new Set<string>();
  // Previous broadcasted phase — used to gate ledger broadcast to hand boundaries
  private lastBroadcastedPhase: string = "waiting";

  // Away status
  private awayUserIds = new Set<string>();

  // Pending leave queue: players who requested to leave mid-hand
  private pendingLeavePlayerIds = new Set<string>();

  // Server-side timers
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private votingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTurnActorId: string | null = null;

  constructor(readonly room: Party.Room) {
    this.gameState = createInitialState(room.id, { small: 25, big: 50 });
  }

  async onStart() {
    const [saved, savedLedger] = await Promise.all([
      this.room.storage.get<boolean>("turnTimerEnabled"),
      this.room.storage.get<LedgerEntry[]>("sessionLedger"),
    ]);
    if (saved !== undefined) this.turnTimerEnabled = saved;

    // Restore persisted ledger (survives server restarts)
    if (savedLedger && savedLedger.length > 0) {
      for (const entry of savedLedger) {
        this.sessionLedger.set(entry.playerId, entry);
      }
    }
    // If ledger is still empty but players are seated, rebuild from gameState
    if (this.sessionLedger.size === 0) {
      for (const [id, player] of Object.entries(this.gameState.players)) {
        if (player) {
          this.sessionLedger.set(id, {
            playerId: id,
            name: player.name,
            buyIns: [player.stack],
            cashOuts: [],
            isSeated: true,
            currentStack: player.stack,
          });
        }
      }
    }
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
    } else if (msg.type === "SET_TIMER") {
      this.handleSetTimer(sender, msg.enabled);
    } else if (msg.type === "SET_AWAY") {
      this.handleSetAway(sender, msg.away);
    } else if (msg.type === "PEEK_CARD") {
      this.handlePeekCard(sender, msg.cardIndex);
    } else if (msg.type === "QUEUE_LEAVE") {
      this.handleQueueLeave(sender);
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
      this.awayUserIds.delete(userId);
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
    const ledgerEntries = Array.from(this.sessionLedger.values());
    this.send(conn, { type: "LEDGER", entries: ledgerEntries });
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

    // Rebuy: if player tries to SIT_DOWN but is already seated with $0, stand them up first
    if (enriched.type === "SIT_DOWN") {
      const existing = this.gameState.players[enriched.playerId];
      if (existing && existing.stack === 0) {
        this.onStandUp(enriched.playerId, 0);
        void this.persistCashOut(enriched.playerId, 0);
        this.gameState = gameReducer(this.gameState, { type: "STAND_UP", playerId: enriched.playerId });
      }
    }

    // Reset per-card reveals on new hand
    if (enriched.type === "START_HAND") {
      this.revealedCardsByPlayerId.clear();
      this.peekedCardsByPlayerId.clear();
      // Process pending leaves (players who chose "Leave Next Hand")
      for (const pid of this.pendingLeavePlayerIds) {
        const player = this.gameState.players[pid];
        if (player) {
          this.onStandUp(pid, player.stack);
          void this.persistCashOut(pid, player.stack);
          this.gameState = gameReducer(this.gameState, { type: "STAND_UP", playerId: pid });
        }
      }
      this.pendingLeavePlayerIds.clear();
      // Auto-kick $0 players
      for (const player of Object.values(this.gameState.players)) {
        if (player.stack === 0) {
          this.onStandUp(player.id, 0);
          void this.persistCashOut(player.id, 0);
          this.gameState = gameReducer(this.gameState, { type: "STAND_UP", playerId: player.id });
        }
      }
    }

    const prevState = this.gameState;
    this.gameState = gameReducer(this.gameState, enriched);

    // Ledger hooks
    if (enriched.type === "SIT_DOWN") {
      this.onSitDown(enriched.playerId, enriched.name, enriched.buyIn);
    }
    if (enriched.type === "STAND_UP") {
      const player = prevState.players[enriched.playerId];
      if (player) {
        this.onStandUp(enriched.playerId, player.stack);
        void this.persistCashOut(enriched.playerId, player.stack);
      }
    }
    if (prevState.phase !== "showdown" && this.gameState.phase === "showdown") {
      void this.persistShowdownStats(this.gameState);
    }

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

  // ── Timer setting ──

  private handleSetTimer(conn: Party.Connection, enabled: boolean) {
    const userId = this.connIdToUserId.get(conn.id);
    if (!userId || userId !== this.creatorUserId) return;
    this.turnTimerEnabled = enabled;
    this.room.storage.put("turnTimerEnabled", enabled);
    this.broadcastRoomMeta();
  }

  // ── Away status ──

  private handleSetAway(conn: Party.Connection, away: boolean) {
    const userId = this.connIdToUserId.get(conn.id);
    if (!userId) return;
    if (away) {
      this.awayUserIds.add(userId);
    } else {
      this.awayUserIds.delete(userId);
    }
    this.broadcastRoomMeta();

    // If the player who just went away is the current actor, start a timer
    if (away && !this.turnTimerEnabled && !this.turnTimer) {
      const playerId = this.userIdToPlayerId.get(userId);
      const currentActor = this.gameState.needsToAct[0];
      if (playerId && playerId === currentActor) {
        this.manageTurnTimer({ ...this.gameState, needsToAct: [] }, this.gameState);
      }
    }
  }

  // ── Queue leave (mid-hand) ──

  private handleQueueLeave(conn: Party.Connection) {
    const userId = this.connIdToUserId.get(conn.id);
    if (!userId) return;
    const playerId = this.userIdToPlayerId.get(userId);
    if (!playerId || !this.gameState.players[playerId]) return;
    this.pendingLeavePlayerIds.add(playerId);
  }

  // ── Per-card peek tracking ──

  private handlePeekCard(conn: Party.Connection, cardIndex: 0 | 1) {
    const userId = this.connIdToUserId.get(conn.id);
    if (!userId) return;
    const playerId = this.userIdToPlayerId.get(userId);
    if (!playerId) return;
    const player = this.gameState.players[playerId];
    if (!player?.holeCards) return;

    let peeked = this.peekedCardsByPlayerId.get(playerId);
    if (!peeked) {
      peeked = new Set<0 | 1>();
      this.peekedCardsByPlayerId.set(playerId, peeked);
    }
    if (peeked.has(cardIndex)) return;
    peeked.add(cardIndex);
    this.broadcastRoomMeta();
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
    const isActorAway = nextActor ? this.isPlayerAway(nextActor) : false;
    if (!nextActor || !isPlayingPhase || (!this.turnTimerEnabled && !isActorAway)) return;

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

  // ── Session ledger ──

  private broadcastLedger() {
    const entries = Array.from(this.sessionLedger.values());
    this.broadcast({ type: "LEDGER", entries });
    this.room.storage.put("sessionLedger", entries);
  }

  /**
   * Updates in-memory ledger stacks to match the engine. Only broadcasts (which
   * writes to DO storage) at hand boundaries — mid-hand stack shifts from
   * individual bets would otherwise cause a storage write per action.
   */
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
    // Broadcast only at hand boundaries (waiting / showdown). Mid-hand stack
    // deltas from individual bets stay in-memory until the hand resolves.
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
      this.sessionLedger.set(playerId, { playerId, name, buyIns: [buyIn], cashOuts: [], isSeated: true, currentStack: buyIn });
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

  // ── Player stats persistence ──

  private async incrementSession(playerId: string, name: string, buyIn: number) {
    const key = `stats:${playerId}`;
    const existing = await this.room.storage.get<PlayerStats>(key);
    const stats: PlayerStats = existing ?? { name, handsPlayed: 0, handsWon: 0, totalAmountWon: 0, totalBuyIns: 0, totalCashOuts: 0, sessions: 0 };
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
    for (const w of state.winners ?? []) {
      winAmounts.set(w.playerId, (winAmounts.get(w.playerId) ?? 0) + w.amount);
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

  // ── Broadcasting ──

  private broadcastState() {
    this.syncLedgerStacks();
    this.lastBroadcastedPhase = this.gameState.phase;
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
    const awayPlayerIds = Array.from(this.awayUserIds)
      .filter(uid => this.userIdToConnId.has(uid))
      .map(uid => this.userIdToPlayerId.get(uid))
      .filter((pid): pid is string => pid != null);
    const peekedCounts: Record<string, number> = {};
    for (const [pid, set] of this.peekedCardsByPlayerId) {
      peekedCounts[pid] = set.size;
    }
    this.broadcast({ type: "ROOM_META", creatorUserId: this.creatorUserId, connectedUserIds, turnTimerEnabled: this.turnTimerEnabled, awayPlayerIds, peekedCounts });
  }

  // ── Helpers ──

  private isPlayerAway(playerId: string): boolean {
    for (const uid of this.awayUserIds) {
      if (this.userIdToPlayerId.get(uid) === playerId) return true;
    }
    return false;
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }
}

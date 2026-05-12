import type {
  PartyKitServerMessage,
  SerializedGameState,
} from "./types";

export interface TableSessionState<TGameState = SerializedGameState, TLedgerEntry = unknown> {
  myPlayerId: string | null;
  isCreator: boolean;
  gameState: TGameState | null;
  holeCards: unknown;
  revealedHoleCards: Record<string, unknown>;
  peekedCardMask: number;
  connectedPlayerIds: string[];
  awayPlayerIds: string[];
  peekedCounts: Record<string, number>;
  queuedLeavePlayerIds: string[];
  ledger: TLedgerEntry[];
  firstStateReceived: boolean;
  terminalErrorCode: string | null;
  actionErrorMessage: string | null;
  lastErrorMessage: string | null;
}

export function createTableSessionState<
  TGameState = SerializedGameState,
  TLedgerEntry = unknown,
>(): TableSessionState<TGameState, TLedgerEntry> {
  return {
    myPlayerId: null,
    isCreator: false,
    gameState: null,
    holeCards: null,
    revealedHoleCards: {},
    peekedCardMask: 0,
    connectedPlayerIds: [],
    awayPlayerIds: [],
    peekedCounts: {},
    queuedLeavePlayerIds: [],
    ledger: [],
    firstStateReceived: false,
    terminalErrorCode: null,
    actionErrorMessage: null,
    lastErrorMessage: null,
  };
}

const TERMINAL_ERROR_CODES = new Set([
  "TABLE_NOT_FOUND",
  "TABLE_NOT_ACTIVE",
  "INVALID_JOIN_TOKEN",
  "PROTOCOL_VERSION_MISMATCH",
]);

export function isTerminalTableErrorCode(code: string): boolean {
  return TERMINAL_ERROR_CODES.has(code);
}

export function reduceTableSessionMessage<
  TGameState = SerializedGameState,
  TLedgerEntry = unknown,
>(
  state: TableSessionState<TGameState, TLedgerEntry>,
  message: PartyKitServerMessage<TGameState>,
): TableSessionState<TGameState, TLedgerEntry> {
  switch (message.type) {
    case "WELCOME":
      return {
        ...state,
        myPlayerId: message.playerSessionId,
        isCreator: message.isCreator,
        terminalErrorCode: null,
        lastErrorMessage: null,
      };
    case "TABLE_STATE":
      return {
        ...state,
        gameState: message.state,
        firstStateReceived: true,
        terminalErrorCode: null,
        lastErrorMessage: null,
      };
    case "PRIVATE_STATE":
      return {
        ...state,
        holeCards: message.holeCards,
        revealedHoleCards: message.revealedHoleCards ?? {},
        peekedCardMask: message.peekedCardMask ?? 0,
      };
    case "ROOM_PRESENCE":
      return {
        ...state,
        connectedPlayerIds: message.connectedPlayerIds ?? [],
        awayPlayerIds: message.awayPlayerIds ?? [],
        peekedCounts: message.peekedCounts ?? {},
        queuedLeavePlayerIds: message.queuedLeavePlayerIds ?? [],
      };
    case "LEDGER_STATE":
      return {
        ...state,
        ledger: (message.entries ?? []) as TLedgerEntry[],
      };
    case "ERROR":
      return {
        ...state,
        actionErrorMessage: message.code === "ACTION_REJECTED" ? message.message : state.actionErrorMessage,
        terminalErrorCode: isTerminalTableErrorCode(message.code) ? message.code : state.terminalErrorCode,
        lastErrorMessage: message.message || message.code,
      };
    default:
      return state;
  }
}

export function isPlayerQueuedToLeave(
  state: Pick<TableSessionState, "myPlayerId" | "queuedLeavePlayerIds">,
): boolean {
  return state.myPlayerId != null && state.queuedLeavePlayerIds.includes(state.myPlayerId);
}

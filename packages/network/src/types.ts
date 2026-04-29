export const CLIENT_ID_STORAGE_KEY = "pokington_client_id" as const;

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "unsupported";

export type SerializedGameAction = unknown;
export type SerializedGameState = unknown;

export type CardIndex = 0 | 1;

export type PartyKitClientMessage<TGameAction = SerializedGameAction> =
  | { type: "AUTH"; token: string; protocolVersion: number }
  | { type: "GAME_EVENT"; event: TGameAction }
  | { type: "REVEAL_CARD"; cardIndex: CardIndex }
  | { type: "SET_AWAY"; away: boolean }
  | { type: "PEEK_CARD"; cardIndex: CardIndex; handNumber: number }
  | { type: "QUEUE_LEAVE" }
  | { type: "CANCEL_QUEUE_LEAVE" };

export type PartyKitServerMessage<TGameState = SerializedGameState> =
  | { type: "WELCOME"; playerSessionId: string; isCreator: boolean }
  | { type: "TABLE_STATE"; state: TGameState; feedback?: unknown[] }
  | { type: "PRIVATE_STATE"; holeCards: unknown; revealedHoleCards: Record<string, unknown> }
  | {
      type: "ROOM_PRESENCE";
      connectedPlayerIds: string[];
      awayPlayerIds: string[];
      peekedCounts: Record<string, number>;
      queuedLeavePlayerIds: string[];
    }
  | { type: "LEDGER_STATE"; entries: unknown[] }
  | { type: "ERROR"; code: string; message: string };

export interface JoinTokenResponse {
  token: string;
  tableId: string;
  playerSessionId: string;
  isCreator: boolean;
}

export interface GameConnection<TServerMessage = PartyKitServerMessage, TGameAction = SerializedGameAction> {
  readonly status: ConnectionStatus;
  readonly clientId: string;
  readonly roomId: string;
  sendAction: (action: TGameAction) => void;
  sendMessage: (message: PartyKitClientMessage<TGameAction>) => void;
  revealCard: (cardIndex: CardIndex) => void;
  peekCard: (cardIndex: CardIndex, handNumber: number) => void;
  setAway: (away: boolean) => void;
  queueLeave: () => void;
  cancelQueuedLeave: () => void;
  subscribeToState: (listener: (state: SerializedGameState) => void) => () => void;
  subscribeToMessage: (listener: (message: TServerMessage) => void) => () => void;
  subscribeToStatus: (listener: (status: ConnectionStatus) => void) => () => void;
  disconnect: () => void;
}

export interface GameConnectionLifecycle<TServerMessage = PartyKitServerMessage> {
  onStatusChange?: (status: ConnectionStatus) => void;
  onJoin?: (join: JoinTokenResponse) => void;
  onMessage?: (message: TServerMessage) => void;
  onJoinError?: (error: Error) => void;
  onSocketError?: (error: unknown) => void;
}

export interface KeyValueStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
}

export interface AppStateSubscription {
  remove: () => void;
}

export interface NativeAppStateLike {
  currentState: string;
  addEventListener: (
    event: "change",
    listener: (state: string) => void,
  ) => AppStateSubscription;
}

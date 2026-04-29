import type {
  ConnectionStatus,
  GameConnection,
  GameConnectionLifecycle,
  JoinTokenResponse,
  PartyKitClientMessage,
  PartyKitServerMessage,
  SerializedGameState,
} from "./types";

export interface SocketLike {
  send: (data: string) => void;
  close: () => void;
  addEventListener?: (type: string, listener: (event: any) => void) => void;
  removeEventListener?: (type: string, listener: (event: any) => void) => void;
  onopen?: ((event: any) => void) | null;
  onmessage?: ((event: any) => void) | null;
  onclose?: ((event: any) => void) | null;
  onerror?: ((event: any) => void) | null;
}

export interface CreatePartyKitConnectionOptions<TServerMessage, TGameAction> extends GameConnectionLifecycle<TServerMessage> {
  roomId: string;
  clientId: string;
  protocolVersion: number;
  join: () => Promise<JoinTokenResponse>;
  createSocket: (join: JoinTokenResponse) => SocketLike;
  getInitialAway?: () => boolean;
}

function parseSocketMessage<TServerMessage>(data: unknown): TServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data) as TServerMessage;
  } catch {
    return null;
  }
}

export function createPartyKitGameConnection<
  TServerMessage extends PartyKitServerMessage = PartyKitServerMessage,
  TGameAction = unknown,
>(options: CreatePartyKitConnectionOptions<TServerMessage, TGameAction>): GameConnection<TServerMessage, TGameAction> {
  let status: ConnectionStatus = "connecting";
  let socket: SocketLike | null = null;
  let disconnected = false;
  let openHandler: ((event?: unknown) => void) | null = null;
  let messageHandler: ((event: { data?: unknown }) => void) | null = null;
  let closeHandler: ((event?: unknown) => void) | null = null;
  let errorHandler: ((event: unknown) => void) | null = null;

  const messageListeners = new Set<(message: TServerMessage) => void>();
  const stateListeners = new Set<(state: SerializedGameState) => void>();
  const statusListeners = new Set<(status: ConnectionStatus) => void>();

  const setStatus = (nextStatus: ConnectionStatus) => {
    if (status === nextStatus) return;
    status = nextStatus;
    options.onStatusChange?.(nextStatus);
    for (const listener of statusListeners) listener(nextStatus);
  };

  const sendMessage = (message: PartyKitClientMessage<TGameAction>) => {
    if (!socket || disconnected) return;
    socket.send(JSON.stringify(message));
  };

  const attach = (nextSocket: SocketLike, join: JoinTokenResponse) => {
    socket = nextSocket;

    openHandler = () => {
      if (disconnected) return;
      setStatus("connected");
      sendMessage({ type: "AUTH", token: join.token, protocolVersion: options.protocolVersion });
      sendMessage({ type: "SET_AWAY", away: options.getInitialAway?.() ?? false });
    };

    messageHandler = (event) => {
      const message = parseSocketMessage<TServerMessage>(event.data);
      if (!message) return;
      options.onMessage?.(message);
      for (const listener of messageListeners) listener(message);
      if (message.type === "TABLE_STATE") {
        for (const listener of stateListeners) listener(message.state);
      }
    };

    closeHandler = () => {
      if (disconnected) return;
      setStatus("disconnected");
    };

    errorHandler = (event) => {
      options.onSocketError?.(event);
    };

    if (nextSocket.addEventListener) {
      nextSocket.addEventListener("open", openHandler);
      nextSocket.addEventListener("message", messageHandler);
      nextSocket.addEventListener("close", closeHandler);
      nextSocket.addEventListener("error", errorHandler);
    } else {
      nextSocket.onopen = openHandler;
      nextSocket.onmessage = messageHandler;
      nextSocket.onclose = closeHandler;
      nextSocket.onerror = errorHandler;
    }
  };

  void options.join()
    .then((join) => {
      if (disconnected) return;
      options.onJoin?.(join);
      attach(options.createSocket(join), join);
    })
    .catch((error: unknown) => {
      if (disconnected) return;
      setStatus("disconnected");
      options.onJoinError?.(error instanceof Error ? error : new Error(String(error)));
    });

  const connection: GameConnection<TServerMessage, TGameAction> = {
    get status() {
      return status;
    },
    clientId: options.clientId,
    roomId: options.roomId,
    sendAction: (action) => sendMessage({ type: "GAME_EVENT", event: action }),
    sendMessage,
    revealCard: (cardIndex) => sendMessage({ type: "REVEAL_CARD", cardIndex }),
    peekCard: (cardIndex, handNumber) => sendMessage({ type: "PEEK_CARD", cardIndex, handNumber }),
    setAway: (away) => sendMessage({ type: "SET_AWAY", away }),
    queueLeave: () => sendMessage({ type: "QUEUE_LEAVE" }),
    cancelQueuedLeave: () => sendMessage({ type: "CANCEL_QUEUE_LEAVE" }),
    subscribeToState: (listener) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    subscribeToMessage: (listener) => {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    subscribeToStatus: (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    disconnect: () => {
      disconnected = true;
      if (socket?.removeEventListener) {
        if (openHandler) socket.removeEventListener("open", openHandler);
        if (messageHandler) socket.removeEventListener("message", messageHandler);
        if (closeHandler) socket.removeEventListener("close", closeHandler);
        if (errorHandler) socket.removeEventListener("error", errorHandler);
      }
      if (socket) {
        socket.close();
        socket = null;
      }
      setStatus("disconnected");
      messageListeners.clear();
      stateListeners.clear();
      statusListeners.clear();
    },
  };

  options.onStatusChange?.(status);
  return connection;
}

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
  reconnectBackoffMs?: (attempt: number) => number;
  /** Watchdog timeout: if no message is received within this window the socket is force-closed and reconnected. Default 25 000 ms. Set to 0 to disable. */
  heartbeatIntervalMs?: number;
}

function parseSocketMessage<TServerMessage>(data: unknown): TServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data) as TServerMessage;
  } catch {
    return null;
  }
}

const TERMINAL_ERROR_CODES = new Set([
  "TABLE_NOT_FOUND",
  "TABLE_NOT_ACTIVE",
  "INVALID_JOIN_TOKEN",
  "PROTOCOL_VERSION_MISMATCH",
]);

function isTerminalServerError(message: PartyKitServerMessage): message is Extract<PartyKitServerMessage, { type: "ERROR" }> {
  return message.type === "ERROR" && TERMINAL_ERROR_CODES.has(message.code);
}

function defaultReconnectBackoffMs(attempt: number): number {
  return Math.min(10_000, 400 * 2 ** Math.max(0, attempt - 1));
}

export function createPartyKitGameConnection<
  TServerMessage extends PartyKitServerMessage = PartyKitServerMessage,
  TGameAction = unknown,
>(options: CreatePartyKitConnectionOptions<TServerMessage, TGameAction>): GameConnection<TServerMessage, TGameAction> {
  let status: ConnectionStatus = "connecting";
  let socket: SocketLike | null = null;
  let disconnected = false;
  let terminalError: Error | null = null;
  let firstStateReceived = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let openHandler: ((event?: unknown) => void) | null = null;
  let messageHandler: ((event: { data?: unknown }) => void) | null = null;
  let closeHandler: ((event?: unknown) => void) | null = null;
  let errorHandler: ((event: unknown) => void) | null = null;

  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5_000;

  const clearHeartbeat = () => {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const armHeartbeat = () => {
    clearHeartbeat();
    if (heartbeatIntervalMs <= 0 || disconnected) return;
    heartbeatTimer = setTimeout(() => {
      heartbeatTimer = null;
      closeCurrentSocket();
      setStatus("disconnected");
      scheduleConnect();
    }, heartbeatIntervalMs);
  };

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

  const detachSocket = () => {
    clearHeartbeat();
    if (socket?.removeEventListener) {
      if (openHandler) socket.removeEventListener("open", openHandler);
      if (messageHandler) socket.removeEventListener("message", messageHandler);
      if (closeHandler) socket.removeEventListener("close", closeHandler);
      if (errorHandler) socket.removeEventListener("error", errorHandler);
    } else if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
    }
    openHandler = null;
    messageHandler = null;
    closeHandler = null;
    errorHandler = null;
    socket = null;
  };

  const closeCurrentSocket = () => {
    const current = socket;
    detachSocket();
    current?.close();
  };

  const setTerminalError = (error: Error) => {
    if (terminalError) return;
    terminalError = error;
    options.onTerminalError?.(error);
  };

  const scheduleConnect = () => {
    if (disconnected || terminalError) return;
    if (reconnectTimer) return;
    reconnectAttempt += 1;
    const delayMs = options.reconnectBackoffMs?.(reconnectAttempt) ?? defaultReconnectBackoffMs(reconnectAttempt);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
  };

  const attach = (nextSocket: SocketLike, join: JoinTokenResponse) => {
    socket = nextSocket;

    openHandler = () => {
      if (disconnected) return;
      reconnectAttempt = 0;
      setStatus("connected");
      sendMessage({ type: "AUTH", token: join.token, protocolVersion: options.protocolVersion });
      sendMessage({ type: "SET_AWAY", away: options.getInitialAway?.() ?? false });
      armHeartbeat();
    };

    messageHandler = (event) => {
      const message = parseSocketMessage<TServerMessage>(event.data);
      if (!message) return;
      armHeartbeat();
      options.onMessage?.(message);
      for (const listener of messageListeners) listener(message);
      if (message.type === "TABLE_STATE") {
        firstStateReceived = true;
        for (const listener of stateListeners) listener(message.state);
      }
      if (isTerminalServerError(message)) {
        setTerminalError(new Error(message.code));
        closeCurrentSocket();
        setStatus("disconnected");
      }
    };

    closeHandler = () => {
      if (disconnected) return;
      detachSocket();
      setStatus("disconnected");
      scheduleConnect();
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

  function connect() {
    if (disconnected || terminalError) return;
    setStatus("connecting");
    void options.join()
      .then((join) => {
        if (disconnected || terminalError) return;
        options.onJoin?.(join);
        attach(options.createSocket(join), join);
      })
      .catch((error: unknown) => {
        if (disconnected || terminalError) return;
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        if (TERMINAL_ERROR_CODES.has(normalizedError.message)) {
          setTerminalError(normalizedError);
          setStatus("disconnected");
          options.onJoinError?.(normalizedError);
          return;
        }
        setStatus("disconnected");
        options.onJoinError?.(normalizedError);
        scheduleConnect();
      });
  }

  connect();

  const connection: GameConnection<TServerMessage, TGameAction> = {
    get status() {
      return status;
    },
    clientId: options.clientId,
    roomId: options.roomId,
    get terminalError() {
      return terminalError;
    },
    get firstStateReceived() {
      return firstStateReceived;
    },
    sendAction: (action) => sendMessage({ type: "GAME_EVENT", event: action }),
    sendMessage,
    revealCard: (cardIndex) => sendMessage({ type: "REVEAL_CARD", cardIndex }),
    peekCard: (cardIndex, handNumber) => sendMessage({ type: "PEEK_CARD", cardIndex, handNumber }),
    setAway: (away) => sendMessage({ type: "SET_AWAY", away }),
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
      clearHeartbeat();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      closeCurrentSocket();
      setStatus("disconnected");
      messageListeners.clear();
      stateListeners.clear();
      statusListeners.clear();
    },
    reconnectNow: () => {
      if (disconnected || terminalError) return;
      clearHeartbeat();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      closeCurrentSocket();
      reconnectAttempt = 0;
      connect();
    },
  };

  options.onStatusChange?.(status);
  return connection;
}

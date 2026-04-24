export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "unsupported";

export type SerializedGameAction = Record<string, unknown>;
export type SerializedGameState = Record<string, unknown>;

export interface GameConnection {
  status: ConnectionStatus;
  sendAction: (action: SerializedGameAction) => void;
  subscribeToState: (listener: (state: SerializedGameState) => void) => () => void;
  disconnect: () => void;
}

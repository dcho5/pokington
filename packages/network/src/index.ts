export type {
  CardIndex,
  ConnectionStatus,
  CreateTableRequest,
  CreateTableResponse,
  GameConnection,
  GameConnectionLifecycle,
  GetTableResponse,
  JoinTokenResponse,
  KeyValueStorage,
  NativeAppStateLike,
  PartyKitClientMessage,
  PartyKitServerMessage,
  QueuedSeatLeaveResponse,
  SerializedGameAction,
  SerializedGameState,
  TableBlinds,
} from "./types";
export { CLIENT_ID_STORAGE_KEY } from "./types";
export {
  buildPartyKitWebSocketUrl,
  createWebGameConnection,
  normalizePartyKitHost,
  shouldUseInsecureLocalProtocol,
  type CreateWebGameConnectionOptions,
} from "./partykit-web";
export {
  buildDirectControlPlaneUrlForTest,
  buildNativeControlPlaneUrlForTest,
  createTable,
  createNativeTable,
  getTable,
  createNativeGameConnection,
  getNativeTable,
  getOrCreateNativeClientId,
  requestJoinToken,
  requestNativeJoinToken,
  requestQueuedSeatLeave,
  requestNativeQueuedSeatLeave,
  resolveNativePartyKitHost,
  type CreateNativeGameConnectionOptions,
  type DirectControlPlaneOptions,
  type NativeControlPlaneOptions,
} from "./partykit-native";
export { useGameConnection, type UseGameConnectionResult } from "./useGameConnection";
export {
  createTableSessionState,
  isPlayerQueuedToLeave,
  isTerminalTableErrorCode,
  reduceTableSessionMessage,
  type TableSessionState,
} from "./table-session";

export const NETWORK_PACKAGE_STATUS = "partykit-web-and-native-adapters-ready" as const;

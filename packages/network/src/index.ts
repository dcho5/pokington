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
  SerializedGameAction,
  SerializedGameState,
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
  buildNativeControlPlaneUrlForTest,
  createNativeTable,
  createNativeGameConnection,
  getNativeTable,
  getOrCreateNativeClientId,
  requestNativeJoinToken,
  resolveNativePartyKitHost,
  type CreateNativeGameConnectionOptions,
  type NativeControlPlaneOptions,
} from "./partykit-native";
export { useGameConnection, type UseGameConnectionResult } from "./useGameConnection";

export const NETWORK_PACKAGE_STATUS = "partykit-web-and-native-adapters-ready" as const;

export type {
  CardIndex,
  ConnectionStatus,
  GameConnection,
  GameConnectionLifecycle,
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
  type CreateWebGameConnectionOptions,
} from "./partykit-web";
export {
  createNativeGameConnection,
  getOrCreateNativeClientId,
  resolveNativePartyKitHost,
  type CreateNativeGameConnectionOptions,
} from "./partykit-native";
export { useGameConnection, type UseGameConnectionResult } from "./useGameConnection";

export const NETWORK_PACKAGE_STATUS = "partykit-web-and-native-adapters-ready" as const;

export type {
  ConnectionStatus,
  GameConnection,
  SerializedGameAction,
  SerializedGameState,
} from "./types";
export { buildPartyKitWebSocketUrl, normalizePartyKitHost } from "./partykit-web";
export { createNativeGameConnectionStub, PARTYKIT_NATIVE_TODO } from "./partykit-native";

export const NETWORK_PACKAGE_STATUS = "web-helpers-ready-native-adapter-stubbed" as const;

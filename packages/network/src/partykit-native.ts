export const PARTYKIT_NATIVE_TODO = [
  "Document the exact PartyKit room lifecycle used by the web client.",
  "Replicate AUTH, TABLE_STATE, PRIVATE_STATE, ROOM_PRESENCE, and LEDGER_STATE message handling.",
  "Implement stable clientId persistence with AsyncStorage using pokington_client_id.",
  "Mirror host normalization and away/background behavior before wiring this into app state.",
].join(" ");

export function createNativeGameConnectionStub(): never {
  throw new Error(
    `@pokington/network native adapter is intentionally stubbed during Phase 1. ${PARTYKIT_NATIVE_TODO}`,
  );
}

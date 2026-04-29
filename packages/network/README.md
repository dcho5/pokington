# @pokington/network

Shared PartyKit connection adapters for web and React Native.

## PartyKit Wire Protocol

Pokington clients connect to one PartyKit room per table code.

Before opening the socket, a client obtains a join token for its stable device/browser client id:

- Web client id storage: `localStorage["pokington_client_id"]`
- Native client id storage: AsyncStorage-compatible storage using `pokington_client_id`
- Join token request: `POST /api/tables/{code}/join-token`
- Join token response: `{ token, tableId, playerSessionId, isCreator }`

The socket must not send gameplay messages before authentication.

The web adapter uses PartySocket with `{ host, room }`. The native adapter opens `ws://{host}/parties/main/{roomId}` or `wss://{host}/parties/main/{roomId}` directly, matching PartySocket's default `main` party route. Host normalization strips protocol prefixes and trailing slashes. Local native fallback is `127.0.0.1:1999`.

On socket open, clients send:

```json
{ "type": "AUTH", "token": "...", "protocolVersion": 4 }
{ "type": "SET_AWAY", "away": false }
```

Additional client messages are `GAME_EVENT`, `REVEAL_CARD`, `PEEK_CARD`, `SET_AWAY`, `QUEUE_LEAVE`, and `CANCEL_QUEUE_LEAVE`.

Server messages are `WELCOME`, `TABLE_STATE`, `PRIVATE_STATE`, `ROOM_PRESENCE`, `LEDGER_STATE`, and `ERROR`. Errors with `TABLE_NOT_FOUND`, `TABLE_NOT_ACTIVE`, `INVALID_JOIN_TOKEN`, or `PROTOCOL_VERSION_MISMATCH` are terminal for the current connection. `ACTION_REJECTED` is non-terminal and is surfaced to the table UI.

Web sends `SET_AWAY` from `document.hidden` plus the app idle timer. Native sends `SET_AWAY` from `AppState`: `active` means present, every other state means away.

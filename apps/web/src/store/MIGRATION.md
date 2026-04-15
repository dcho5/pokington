# Table Store Migration Checklist

This file is a living checklist for the table stack refactor. Update each entry to `PENDING`, `IN PROGRESS`, or `DONE` in the same PR that moves it.

## Selector Inventory

### STAYS

| Status | Selector | Notes |
| --- | --- | --- |
| DONE | `getViewingPlayer` | Authoritative viewer lookup from store state. |
| DONE | `getHoleCards` | Direct private-state access. |
| DONE | `getCommunityCards` | Authoritative public board state. |
| DONE | `getCommunityCards2` | Authoritative bomb-pot board state. |
| DONE | `getPot` | Authoritative pot amount only. |
| DONE | `getTotalPotWithBets` | Store-level fact based on authoritative bet totals. |
| DONE | `getPhase` | Direct phase access. |
| DONE | `getWinners` | Authoritative showdown result access. |
| DONE | `getRunItVotes` | Direct vote state access. |
| DONE | `getRunCount` | Direct resolved run-count access. |
| DONE | `getRunResults` | Direct run-result access. |
| DONE | `getCurrentActorId` | Store-level authoritative actor gating. |
| DONE | `isViewerTurn` | Store-level authoritative turn gating. |
| DONE | `getCallAmount` | Betting validity logic stays with store/auth state. |
| DONE | `getMinRaise` | Betting validity logic stays with store/auth state. |
| DONE | `canCheck` | Betting validity logic stays with store/auth state. |
| DONE | `canRaise` | Betting validity logic stays with store/auth state. |
| DONE | `canAllIn` | Betting validity logic stays with store/auth state. |
| DONE | `isFirstBet` | Betting-round fact derived from authoritative state. |
| DONE | `getRoundBet` | Direct round-bet access. |
| DONE | `getHandNumber` | Direct hand counter access. |
| DONE | `getViewerStack` | Viewer stack fact from authoritative state. |
| DONE | `isViewerAdmin` | Mirrors session/creator auth. |
| DONE | `getSevenTwoBountyBB` | Direct table config access. |
| DONE | `getVoluntaryShownPlayerIds` | Direct showdown reveal fact access. |
| DONE | `getSevenTwoBountyTrigger` | Direct showdown side-game fact access. |
| DONE | `getBombPotVote` | Direct bomb-pot vote access. |
| DONE | `getBombPotNextHand` | Direct next-hand bomb-pot access. |
| DONE | `isBombPotHand` | Direct table-hand fact access. |
| DONE | `getBombPotCooldown` | Direct cooldown access. |
| DONE | `getLedgerRows` | Ledger stays store-owned and server-driven. |
| DONE | `getPayoutInstructions` | Ledger-derived payout instructions stay store-owned. |

### MOVES

| Status | Selector | Notes |
| --- | --- | --- |
| DONE | `getPlayers` | Moved into the scene-model derivation layer as presentation shaping. |

### REMOVED

| Status | Selector | Notes |
| --- | --- | --- |
| DONE | `getHandStrength` | Dead code removed during the scene-model refactor. |

## Direct Store Field Audit

Annotate each field as `transport/session`, `server-driven timing`, or `client UI state`.

| Status | Field | Category | Notes |
| --- | --- | --- | --- |
| DONE | `votingStartedAt` | `server-driven timing` | Set from server-message-driven phase transitions. |
| DONE | `streetPauseChips` | `server-driven timing` | Animation timing data triggered from server state changes. |
| DONE | `streetSweeping` | `server-driven timing` | Timer-driven from street transitions. |
| DONE | `runAnnouncement` | `server-driven timing` | Timer started in response to vote resolution. |
| DONE | `isRunItBoard` | `server-driven timing` | Showdown/voting lifecycle flag tied to server state. |
| DONE | `knownCardCountAtRunIt` | `server-driven timing` | Snapshot captured from server transition. |
| DONE | `runDealStartedAt` | `server-driven timing` | Timer anchor set from showdown transitions. |
| DONE | `showdownStartedAt` | `server-driven timing` | Timer anchor set from showdown transitions. |
| DONE | `sevenTwoAnnouncement` | `server-driven timing` | Timer-driven announcement state from server-triggered event. |
| DONE | `bombPotAnnouncement` | `server-driven timing` | Timer-driven announcement state from server-triggered event. |
| DONE | `leaveQueued` | `client UI state` | Local UI state reflecting queued-leave request. |
| DONE | `connectionStatus` | `transport/session` | Session transport fact; belongs in `sessionContext`. |
| DONE | `tableNotFound` | `transport/session` | Session transport fact; belongs in `sessionContext`. |
| DONE | `isFirstStateReceived` | `transport/session` | Session transport fact; belongs in `sessionContext`. |
| DONE | `revealedHoleCards` | `client UI state` | Client-visible public-card cache; belongs in `clientUiState`. |
| DONE | `myHoleCards` | `client UI state` | Private viewer cards consumed by scene derivation. |
| DONE | `myRevealedCardIndices` | `client UI state` | Local reveal UI state; belongs in `clientUiState`. |
| DONE | `awayPlayerIds` | `client UI state` | Client presence state surfaced in the scene model. |
| DONE | `peekedCounts` | `client UI state` | Client-visible peel state; belongs in `clientUiState`. |
| DONE | `ledger` | `transport/session` | Stays in store as a server-delivered fact surfaced in the ledger panel. |
| DONE | `viewingSeat` | `client UI state` | Local viewing choice; belongs in `clientUiState`. |
| DONE | `myPlayerId` | `transport/session` | Session identity; belongs in `sessionContext`. |
| DONE | `myUserId` | `transport/session` | Session identity; belongs in `sessionContext`. |
| DONE | `isCreator` | `transport/session` | Creator auth flag; used for admin overlays and seat/start controls. |

## Timing Governance

Policy: A timing flag belongs in the store if and only if it is set by a server message or a timer started in response to one. Client-only animation state does not go here.

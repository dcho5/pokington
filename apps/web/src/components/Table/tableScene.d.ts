import type { BombPotAnteBB, RunResult, WinnerInfo, SevenTwoBountyBB } from "@pokington/engine";
import type { Card } from "@pokington/shared";
import type { PublicGameState } from "party/types";
import type { Player } from "types/player";

export interface HandIndicator {
  id: string;
  title: string;
  label: string | null;
}

export interface TableTimingFlags {
  votingStartedAt: number | null;
  streetPauseChips: { id: string; seatIndex: number; amount: number }[] | null;
  streetSweeping: boolean;
  runAnnouncement: 1 | 2 | 3 | null;
  isRunItBoard: boolean;
  knownCardCountAtRunIt: number;
  runDealStartedAt: number | null;
  showdownStartedAt?: number | null;
  sevenTwoAnnouncement: { winnerName: string; perPlayer: number; total: number } | null;
  bombPotAnnouncement: {
    kind: "scheduled" | "canceled";
    anteBB: number;
    anteCents: number;
    title: string;
    detail: string;
  } | null;
  actionError: { message: string } | null;
}

export interface TableSessionContext {
  code: string;
  myPlayerId: string | null;
  myUserId: string | null;
  connectionStatus: "disconnected" | "connecting" | "connected";
  tableNotFound: boolean;
  isFirstStateReceived: boolean;
  isCreator?: boolean;
}

export interface TableClientUiState {
  viewingSeat: number;
  revealedHoleCards: Record<string, [Card | null, Card | null]>;
  myHoleCards: [Card, Card] | null;
  myRevealedCardIndices: Set<0 | 1>;
  peekedCounts: Record<string, number>;
  showdownPlayerSnapshot?: Record<string, PublicGameState["players"][string]>;
  leaveQueued: boolean;
  awayPlayerIds: string[];
  currentRun?: number;
  revealedCount?: number;
  settledRunCount?: number;
  publicShowdownRevealComplete?: boolean;
}

export interface TableLayoutScene {
  seatSelectionLocked: boolean;
  players: (Player | null)[];
  dealerIndex: number;
  tableName: string;
  blinds: { small: number; big: number };
  pot: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  communityCards: Card[];
  holeCards: [Card, Card] | null;
  handIndicators: HandIndicator[];
  phase: string;
  winners: WinnerInfo[] | null;
  callAmount: number;
  minRaise: number;
  canCheck: boolean;
  canRaise: boolean;
  canAllIn: boolean;
  isYourTurn: boolean;
  currentActorName?: string;
  isFirstBet: boolean;
  handNumber: number;
  viewerStack: number;
  viewerCurrentBet: number;
  showdownCountdown?: number | null;
  showNextHand?: boolean;
  isAdmin: boolean;
  streetSweeping: boolean;
  runItVotes: Record<string, 1 | 2 | 3>;
  runResults: RunResult[];
  runCount: 1 | 2 | 3;
  runAnnouncement: 1 | 2 | 3 | null;
  votingStartedAt: number | null;
  viewerCanVote: boolean;
  isRunItBoard: boolean;
  animatedShowdownReveal: boolean;
  publicShowdownRevealComplete: boolean;
  showWinnerBanner: boolean;
  knownCardCount: number;
  runDealStartedAt: number | null;
  showdownStartedAt?: number | null;
  sevenTwoBountyBB: SevenTwoBountyBB;
  sevenTwoAnnouncement: { winnerName: string; perPlayer: number; total: number } | null;
  sevenTwoBountyTrigger: { winnerId: string; perPlayer: number; totalCollected: number } | null;
  canShowCards: boolean;
  myRevealedCardIndices: Set<0 | 1>;
  sevenTwoEligible: boolean;
  bombPotVote: PublicGameState["bombPotVote"];
  bombPotNextHand: PublicGameState["bombPotNextHand"];
  isBombPotHand: boolean;
  communityCards2: Card[];
  bombPotCooldown: string[];
  bombPotAnnouncement: TableTimingFlags["bombPotAnnouncement"];
  actionError: TableTimingFlags["actionError"];
  leaveQueued: boolean;
  cardPeelPersistenceKey: string | null;
}

export interface TableSceneModel {
  code: string;
  tableNotFound: boolean;
  showReconnectIndicator: boolean;
  showBlockingConnectionOverlay: boolean;
  blockingConnectionTitle: string;
  blockingConnectionMessage: string;
  viewingPlayer: Player | null;
  layout: TableLayoutScene;
  showRebuySheet?: boolean;
  rebuyInfo?: { name: string; seat: number } | null;
  dismissRebuy?: () => void;
}

export function deriveTableScene(input: {
  gameState: PublicGameState;
  timingFlags: TableTimingFlags;
  sessionContext: TableSessionContext;
  clientUiState: TableClientUiState;
}): TableSceneModel;

export interface TableActions {
  onSitDown: (seatIndex: number, name?: string, buyInCents?: number) => void;
  onStandUp?: () => void;
  onQueueLeave?: () => void;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
  onStartHand: () => void;
  onVoteRun?: (count: 1 | 2 | 3) => void;
  onRevealCard?: (cardIndex: 0 | 1) => void;
  onPeekCard?: (cardIndex: 0 | 1) => void;
  onProposeBombPot?: (anteBB: BombPotAnteBB) => void;
  onVoteBombPot?: (approve: boolean) => void;
}

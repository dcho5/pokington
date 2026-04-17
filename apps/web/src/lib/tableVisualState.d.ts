export function getCurrentBetTotal(players?: Record<string, { currentBet?: number } | null | undefined>): number;

export function shouldUseRunItCenterStage(options?: {
  phase?: string | null;
  isRunItBoard?: boolean;
  runDealStartedAt?: number | null;
  runAnnouncement?: number | null;
  runResults?: unknown[];
  isBombPotHand?: boolean;
  communityCards2?: unknown[];
}): boolean;

export function shouldUseBombPotCenterStage(options?: {
  phase?: string | null;
  isBombPotHand?: boolean;
  isRunItBoard?: boolean;
  runDealStartedAt?: number | null;
  runAnnouncement?: number | null;
  runResults?: unknown[];
  communityCards2?: unknown[];
}): boolean;

export function shouldRenderRunItBoard(options?: {
  phase?: string | null;
  isRunItBoard?: boolean;
  isBombPotHand?: boolean;
  runDealStartedAt?: number | null;
  runAnnouncement?: number | null;
}): boolean;

export function isAnimatedShowdownReveal(options?: {
  phase?: string | null;
  knownCardCount?: number;
  runResults?: unknown[];
  runAnnouncement?: number | null;
  runDealStartedAt?: number | null;
  showdownStartedAt?: number | null;
}): boolean;

export function isAnimatedRunItShowdown(options?: {
  phase?: string | null;
  isRunItBoard?: boolean;
  isBombPotHand?: boolean;
  runResults?: unknown[];
}): boolean;

export function isRunItShowdownSequence(options?: {
  phase?: string | null;
  isRunItBoard?: boolean;
  isBombPotHand?: boolean;
  runResults?: unknown[];
}): boolean;

export function isRunItAnnouncementPhase(options?: {
  phase?: string | null;
  isRunItBoard?: boolean;
  isBombPotHand?: boolean;
  runAnnouncement?: number | null;
  runResults?: unknown[];
}): boolean;

export function getCenterBoardMode(options?: {
  phase?: string | null;
  isBombPotHand?: boolean;
  isRunItBoard?: boolean;
  runDealStartedAt?: number | null;
  runAnnouncement?: number | null;
  runResults?: unknown[];
  communityCards2?: unknown[];
}): "single" | "bombPot" | "runIt";

export function isTableClearedForNextHand(options?: {
  phase?: string | null;
  isBombPot?: boolean;
  communityCards?: unknown[];
  communityCards2?: unknown[];
  pot?: number;
  players?: Record<string, { currentBet?: number } | null | undefined>;
  runResults?: unknown[];
}): boolean;

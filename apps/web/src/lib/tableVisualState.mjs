import enginePkg from "@pokington/engine";

const { hasAnimatedRunout } = enginePkg;

export function getCurrentBetTotal(players = {}) {
  return Object.values(players).reduce((sum, player) => sum + (player?.currentBet ?? 0), 0);
}

export function shouldUseRunItCenterStage({
  phase,
  isRunItBoard = false,
  runDealStartedAt = null,
  runAnnouncement = null,
  runResults = [],
  isBombPotHand = false,
  communityCards2 = [],
} = {}) {
  return getCenterBoardMode({
    phase,
    isRunItBoard,
    runDealStartedAt,
    runAnnouncement,
    runResults,
    isBombPotHand,
    communityCards2,
  }) === "runIt";
}

export function shouldUseBombPotCenterStage({
  phase,
  isBombPotHand = false,
  isRunItBoard = false,
  runDealStartedAt = null,
  runAnnouncement = null,
  runResults = [],
  communityCards2 = [],
} = {}) {
  return getCenterBoardMode({
    phase,
    isBombPotHand,
    isRunItBoard,
    runDealStartedAt,
    runAnnouncement,
    runResults,
    communityCards2,
  }) === "bombPot";
}

export function shouldRenderRunItBoard({
  phase,
  isRunItBoard = false,
  isBombPotHand = false,
  runDealStartedAt = null,
  runAnnouncement = null,
} = {}) {
  return phase === "showdown" &&
    isRunItBoard &&
    !isBombPotHand &&
    runDealStartedAt != null &&
    runAnnouncement == null;
}

export function isAnimatedShowdownReveal({
  phase,
  knownCardCount = 0,
  runResults = [],
  runAnnouncement = null,
  runDealStartedAt = null,
  showdownStartedAt = null,
} = {}) {
  const runCount = Math.max(1, runResults.length);
  const hasTimingAnchor =
    runAnnouncement != null ||
    runDealStartedAt != null ||
    showdownStartedAt != null;

  return phase === "showdown" &&
    hasTimingAnchor &&
    hasAnimatedRunout(knownCardCount, runCount);
}

// A run-it showdown remains "active" for the entire showdown lifecycle once
// results exist, even during the pre-deal announcement window where the center
// board intentionally has not switched into run-it layout yet.
export function isRunItShowdownSequence({
  phase,
  isRunItBoard = false,
  isBombPotHand = false,
  runResults = [],
} = {}) {
  return phase === "showdown" &&
    isRunItBoard &&
    !isBombPotHand &&
    runResults.length > 0;
}

export function isAnimatedRunItShowdown({
  phase,
  isRunItBoard = false,
  isBombPotHand = false,
  runResults = [],
} = {}) {
  return isRunItShowdownSequence({
    phase,
    isRunItBoard,
    isBombPotHand,
    runResults,
  });
}

export function isRunItAnnouncementPhase({
  phase,
  isRunItBoard = false,
  isBombPotHand = false,
  runAnnouncement = null,
  runResults = [],
} = {}) {
  return runAnnouncement != null && isRunItShowdownSequence({
    phase,
    isRunItBoard,
    isBombPotHand,
    runResults,
  });
}

export function getCenterBoardMode({
  phase,
  isBombPotHand = false,
  isRunItBoard = false,
  runDealStartedAt = null,
  runAnnouncement = null,
  runResults = [],
  communityCards2 = [],
} = {}) {
  if (
    isAnimatedRunItShowdown({
      phase,
      isRunItBoard,
      isBombPotHand,
      runResults,
    }) &&
    shouldRenderRunItBoard({
      phase,
      isRunItBoard,
      isBombPotHand,
      runDealStartedAt,
      runAnnouncement,
    }) &&
    runResults.length > 0
  ) {
    return "runIt";
  }

  if (isBombPotHand) {
    return "bombPot";
  }

  return "single";
}

export function isTableClearedForNextHand({
  phase,
  isBombPot = false,
  communityCards = [],
  communityCards2 = [],
  pot = 0,
  players = {},
  runResults = [],
} = {}) {
  return phase === "waiting" &&
    !isBombPot &&
    communityCards.length === 0 &&
    communityCards2.length === 0 &&
    pot === 0 &&
    runResults.length === 0 &&
    getCurrentBetTotal(players) === 0;
}

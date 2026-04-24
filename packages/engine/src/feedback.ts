import type {
  BombPotAnteBB,
  GameEvent,
  GamePhase,
  GameState,
} from "./types";
import { shouldAnnounceRunIt } from "./showdownTiming";

export type GameFeedbackCue =
  | "hand_started"
  | "turn_changed"
  | "player_action_confirmed"
  | "street_revealed"
  | "voting_started"
  | "run_it_announced"
  | "run_it_reveal_started"
  | "showdown_started"
  | "pot_awarded"
  | "split_pot_awarded"
  | "bomb_pot_scheduled"
  | "bomb_pot_canceled"
  | "bomb_pot_started"
  | "seven_two_bounty_triggered";

export type GameFeedbackSource = "action" | "timer" | "server";

export interface GameFeedbackTransitionContext {
  emittedAt?: number;
  source?: GameFeedbackSource;
}

interface BaseGameFeedbackCueEnvelope {
  key: string;
  kind: GameFeedbackCue;
  handNumber: number;
  phase: GamePhase;
  emittedAt: number;
  source: GameFeedbackSource;
}

export interface HandStartedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "hand_started";
}

export interface TurnChangedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "turn_changed";
  actorId: string | null;
  previousActorId: string | null;
}

export interface PlayerActionConfirmedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "player_action_confirmed";
  playerId: string;
  action: "fold" | "check" | "call" | "raise" | "all-in";
  currentBet: number;
  totalContribution: number;
  isAllIn: boolean;
}

export interface StreetRevealedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "street_revealed";
  street: "flop" | "turn" | "river";
  boardCount: 1 | 2;
  revealedTo: 3 | 4 | 5;
}

export interface VotingStartedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "voting_started";
}

export interface RunItAnnouncedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "run_it_announced";
  runCount: 1 | 2 | 3;
}

export interface RunItRevealStartedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "run_it_reveal_started";
  runCount: 1 | 2 | 3;
}

export interface ShowdownStartedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "showdown_started";
  runCount: 1 | 2 | 3;
}

export interface PotAwardedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "pot_awarded";
  winnerPlayerIds: string[];
  totalAmount: number;
}

export interface SplitPotAwardedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "split_pot_awarded";
  winnerPlayerIds: string[];
  totalAmount: number;
}

export interface BombPotScheduledFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "bomb_pot_scheduled";
  anteBB: BombPotAnteBB;
}

export interface BombPotCanceledFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "bomb_pot_canceled";
  anteBB: BombPotAnteBB;
}

export interface BombPotStartedFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "bomb_pot_started";
}

export interface SevenTwoBountyTriggeredFeedbackCue extends BaseGameFeedbackCueEnvelope {
  kind: "seven_two_bounty_triggered";
  winnerId: string;
  totalCollected: number;
}

export type GameFeedbackCueEnvelope =
  | HandStartedFeedbackCue
  | TurnChangedFeedbackCue
  | PlayerActionConfirmedFeedbackCue
  | StreetRevealedFeedbackCue
  | VotingStartedFeedbackCue
  | RunItAnnouncedFeedbackCue
  | RunItRevealStartedFeedbackCue
  | ShowdownStartedFeedbackCue
  | PotAwardedFeedbackCue
  | SplitPotAwardedFeedbackCue
  | BombPotScheduledFeedbackCue
  | BombPotCanceledFeedbackCue
  | BombPotStartedFeedbackCue
  | SevenTwoBountyTriggeredFeedbackCue;

function streetFromRevealCount(revealedTo: number): "flop" | "turn" | "river" | null {
  if (revealedTo <= 0) return null;
  if (revealedTo <= 3) return "flop";
  if (revealedTo === 4) return "turn";
  if (revealedTo >= 5) return "river";
  return null;
}

function getActorId(state: GameState): string | null {
  return state.needsToAct[0] ?? null;
}

function getWinnerSummary(state: GameState): {
  winnerPlayerIds: string[];
  totalAmount: number;
} {
  const winnerPlayerIds = (state.winners ?? []).map((winner) => winner.playerId);
  const totalAmount = (state.winners ?? []).reduce((sum, winner) => sum + winner.amount, 0);
  return { winnerPlayerIds, totalAmount };
}

function deriveConfirmedActionState(
  prevState: GameState,
  event: Extract<GameEvent, { type: "PLAYER_ACTION" }>,
): Pick<PlayerActionConfirmedFeedbackCue, "currentBet" | "totalContribution" | "isAllIn"> {
  const player = prevState.players[event.playerId];
  if (!player) {
    return {
      currentBet: 0,
      totalContribution: 0,
      isAllIn: false,
    };
  }

  switch (event.action) {
    case "fold":
    case "check":
      return {
        currentBet: player.currentBet,
        totalContribution: player.totalContribution,
        isAllIn: player.isAllIn,
      };
    case "call": {
      const callAmount = Math.min(
        Math.max(0, prevState.roundBet - player.currentBet),
        player.stack,
      );
      const remainingStack = player.stack - callAmount;
      return {
        currentBet: player.currentBet + callAmount,
        totalContribution: player.totalContribution + callAmount,
        isAllIn: remainingStack === 0,
      };
    }
    case "raise": {
      const raiseTotal = event.amount ?? (prevState.roundBet + prevState.lastLegalRaiseIncrement);
      const raiseCost = Math.max(0, raiseTotal - player.currentBet);
      const remainingStack = player.stack - raiseCost;
      return {
        currentBet: raiseTotal,
        totalContribution: player.totalContribution + raiseCost,
        isAllIn: remainingStack === 0,
      };
    }
    case "all-in":
      return {
        currentBet: player.currentBet + player.stack,
        totalContribution: player.totalContribution + player.stack,
        isAllIn: true,
      };
    default:
      return {
        currentBet: player.currentBet,
        totalContribution: player.totalContribution,
        isAllIn: player.isAllIn,
      };
  }
}

function makeBase<K extends GameFeedbackCue>(
  kind: K,
  key: string,
  nextState: GameState,
  context: Required<GameFeedbackTransitionContext>,
): BaseGameFeedbackCueEnvelope & { kind: K } {
  return {
    key,
    kind,
    handNumber: nextState.handNumber,
    phase: nextState.phase,
    emittedAt: context.emittedAt,
    source: context.source,
  };
}

export function deriveFeedbackFromTransition(
  prevState: GameState,
  event: GameEvent | null | undefined,
  nextState: GameState,
  context: GameFeedbackTransitionContext = {},
): GameFeedbackCueEnvelope[] {
  const normalizedContext: Required<GameFeedbackTransitionContext> = {
    emittedAt: context.emittedAt ?? Date.now(),
    source: context.source ?? "server",
  };
  const cues: GameFeedbackCueEnvelope[] = [];

  if (nextState.handNumber > prevState.handNumber && nextState.phase !== "waiting") {
    cues.push(
      makeBase(
        "hand_started",
        `h${nextState.handNumber}:hand_started`,
        nextState,
        normalizedContext,
      ) as HandStartedFeedbackCue,
    );
  }

  if (event?.type === "PLAYER_ACTION") {
    const confirmedActionState = deriveConfirmedActionState(prevState, event);
    cues.push({
      ...makeBase(
        "player_action_confirmed",
        [
          `h${nextState.handNumber}`,
          "action",
          event.playerId,
          event.action,
          prevState.phase,
          nextState.phase,
          prevState.pot,
          nextState.pot,
          prevState.roundBet,
          nextState.roundBet,
          nextState.communityCards.length,
          nextState.communityCards2.length,
        ].join(":"),
        nextState,
        normalizedContext,
      ),
      playerId: event.playerId,
      action: event.action,
      currentBet: confirmedActionState.currentBet,
      totalContribution: confirmedActionState.totalContribution,
      isAllIn: confirmedActionState.isAllIn,
    });
  }

  const prevActorId = getActorId(prevState);
  const nextActorId = getActorId(nextState);
  if (prevActorId !== nextActorId && nextActorId !== null) {
    cues.push({
      ...makeBase(
        "turn_changed",
        [
          `h${nextState.handNumber}`,
          "turn",
          nextActorId,
          nextState.phase,
          nextState.communityCards.length,
          nextState.communityCards2.length,
          nextState.roundBet,
          nextState.pot,
        ].join(":"),
        nextState,
        normalizedContext,
      ),
      actorId: nextActorId,
      previousActorId: prevActorId,
    });
  }

  const primaryReveal = nextState.communityCards.length - prevState.communityCards.length;
  const secondaryReveal = nextState.communityCards2.length - prevState.communityCards2.length;
  if (primaryReveal > 0 || secondaryReveal > 0) {
    const revealedTo = Math.max(nextState.communityCards.length, nextState.communityCards2.length) as 3 | 4 | 5;
    const street = streetFromRevealCount(revealedTo);
    if (street) {
      cues.push({
        ...makeBase(
          "street_revealed",
          [
            `h${nextState.handNumber}`,
            "street",
            street,
            nextState.communityCards.length,
            nextState.communityCards2.length,
          ].join(":"),
          nextState,
          normalizedContext,
        ),
        street,
        boardCount: nextState.communityCards2.length > 0 ? 2 : 1,
        revealedTo,
      });
    }
  }

  if (prevState.phase !== "voting" && nextState.phase === "voting") {
    cues.push(
      makeBase(
        "voting_started",
        `h${nextState.handNumber}:voting_started`,
        nextState,
        normalizedContext,
      ) as VotingStartedFeedbackCue,
    );
  }

  if (!prevState.bombPotNextHand && nextState.bombPotNextHand) {
    cues.push({
      ...makeBase(
        "bomb_pot_scheduled",
        `h${nextState.handNumber}:bomb_pot_scheduled:${nextState.bombPotNextHand.anteBB}`,
        nextState,
        normalizedContext,
      ),
      anteBB: nextState.bombPotNextHand.anteBB,
    });
  }

  if (prevState.bombPotNextHand && !nextState.bombPotNextHand && !nextState.isBombPot) {
    cues.push({
      ...makeBase(
        "bomb_pot_canceled",
        `h${nextState.handNumber}:bomb_pot_canceled:${prevState.bombPotNextHand.anteBB}`,
        nextState,
        normalizedContext,
      ),
      anteBB: prevState.bombPotNextHand.anteBB,
    });
  }

  if (!prevState.isBombPot && nextState.isBombPot) {
    cues.push(
      makeBase(
        "bomb_pot_started",
        `h${nextState.handNumber}:bomb_pot_started`,
        nextState,
        normalizedContext,
      ) as BombPotStartedFeedbackCue,
    );
  }

  if (!prevState.sevenTwoBountyTrigger && nextState.sevenTwoBountyTrigger) {
    cues.push({
      ...makeBase(
        "seven_two_bounty_triggered",
        `h${nextState.handNumber}:seven_two:${nextState.sevenTwoBountyTrigger.winnerId}:${nextState.sevenTwoBountyTrigger.totalCollected}`,
        nextState,
        normalizedContext,
      ),
      winnerId: nextState.sevenTwoBountyTrigger.winnerId,
      totalCollected: nextState.sevenTwoBountyTrigger.totalCollected,
    });
  }

  if (prevState.phase !== "showdown" && nextState.phase === "showdown") {
    const resolvedRunCount = (nextState.runCount ?? Math.max(1, nextState.runResults.length)) as 1 | 2 | 3;

    cues.push({
      ...makeBase(
        "showdown_started",
        `h${nextState.handNumber}:showdown_started:${nextState.runResults.length || 1}`,
        nextState,
        normalizedContext,
      ),
      runCount: resolvedRunCount,
    });

    if (shouldAnnounceRunIt({
      isBombPotHand: nextState.isBombPot,
      knownCardCount: nextState.knownCardCountAtRunIt,
      runCount: resolvedRunCount,
      showdownStartedAt: nextState.showdownStartedAt,
      runDealStartedAt: nextState.runDealStartedAt,
    })) {
      cues.push({
        ...makeBase(
          "run_it_announced",
          `h${nextState.handNumber}:run_it_announced:${resolvedRunCount}`,
          nextState,
          normalizedContext,
        ),
        runCount: resolvedRunCount,
      });
    }

    const { winnerPlayerIds, totalAmount } = getWinnerSummary(nextState);
    if (winnerPlayerIds.length > 1) {
      cues.push({
        ...makeBase(
          "split_pot_awarded",
          `h${nextState.handNumber}:split_pot:${winnerPlayerIds.join(",")}:${totalAmount}`,
          nextState,
          normalizedContext,
        ),
        winnerPlayerIds,
        totalAmount,
      });
    } else if (winnerPlayerIds.length === 1) {
      cues.push({
        ...makeBase(
          "pot_awarded",
          `h${nextState.handNumber}:pot_awarded:${winnerPlayerIds[0]}:${totalAmount}`,
          nextState,
          normalizedContext,
        ),
        winnerPlayerIds,
        totalAmount,
      });
    }
  }

  if (
    !nextState.isBombPot &&
    prevState.runDealStartedAt == null &&
    nextState.runDealStartedAt != null &&
    nextState.phase === "showdown"
  ) {
    cues.push({
      ...makeBase(
        "run_it_reveal_started",
        `h${nextState.handNumber}:run_it_reveal_started:${nextState.runResults.length || nextState.runCount || 1}`,
        nextState,
        normalizedContext,
      ),
      runCount: (nextState.runCount ?? Math.max(1, nextState.runResults.length)) as 1 | 2 | 3,
    });
  }

  return cues;
}

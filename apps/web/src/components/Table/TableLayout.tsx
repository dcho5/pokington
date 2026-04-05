"use client";

import React from "react";
import { useIsPortrait } from "hooks/useIsPortrait";
import MobileTableLayout from "./mobile/MobileTableLayout";
import DesktopTableLayout from "./desktop/DesktopTableLayout";
import type { Card as CardType } from "@pokington/shared";
import type { RunResult, WinnerInfo, GameState } from "@pokington/engine";
import type { Player } from "types/player";
export type { Player };

export interface TableLayoutProps {
  onSitDown: (seatIndex: number, name?: string, buyInCents?: number) => void;
  players?: Player[];
  dealerIndex?: number;
  tableName?: string;
  blinds?: { small: number; big: number };
  pot?: number;
  smallBlindIndex?: number;
  bigBlindIndex?: number;
  communityCards?: CardType[];
  holeCards?: [CardType, CardType] | null;
  handStrength?: string | null;
  phase?: string;
  winners?: WinnerInfo[] | null;
  onFold?: () => void;
  onCheck?: () => void;
  onCall?: () => void;
  onRaise?: (amount: number) => void;
  onAllIn?: () => void;
  onStartHand?: () => void;
  callAmount?: number;
  minRaise?: number;
  canCheck?: boolean;
  canRaise?: boolean;
  canAllIn?: boolean;
  isYourTurn?: boolean;
  currentActorName?: string;
  isFirstBet?: boolean;
  handNumber?: number;
  viewerStack?: number;
  showdownCountdown?: number | null;
  turnStartedAt?: number | null;
  isAdmin?: boolean;
  streetSweeping?: boolean;
  timerEnabled?: boolean;
  onToggleTimer?: (enabled: boolean) => void;
  // Run-it-multiple-times
  runItVotes?: Record<string, 1 | 2 | 3>;
  onVoteRun?: (count: 1 | 2 | 3) => void;
  runResults?: RunResult[];
  runCount?: 1 | 2 | 3;
  runAnnouncement?: 1 | 2 | 3 | null;
  votingStartedAt?: number | null;
  viewerCanVote?: boolean;
  isRunItBoard?: boolean;
  knownCardCount?: number;
  runDealStartedAt?: number | null;
  showNextHand?: boolean;
  // 7-2 Offsuit side game
  sevenTwoBountyBB?: 0 | 1 | 2 | 3;
  sevenTwoAnnouncement?: { winnerName: string; perPlayer: number; total: number } | null;
  sevenTwoBountyTrigger?: { winnerId: string; perPlayer: number; totalCollected: number } | null;
  canShowCards?: boolean;
  onRevealCard?: (cardIndex: 0 | 1) => void;
  myRevealedCardIndices?: Set<0 | 1>;
  voluntaryShownPlayerIds?: string[];
  onSetSevenTwoBounty?: (bountyBB: 0 | 1 | 2 | 3) => void;
  // Bomb pot
  bombPotVote?: GameState["bombPotVote"];
  bombPotNextHand?: GameState["bombPotNextHand"];
  isBombPotHand?: boolean;
  communityCards2?: CardType[];
  bombPotCooldown?: string[];
  bombPotAnnouncement?: { anteBB: number; anteCents: number } | null;
  onProposeBombPot?: (anteBB: 1 | 2 | 3 | 4 | 5) => void;
  onVoteBombPot?: (approve: boolean) => void;
}

const TOTAL_SEATS = 10;

const TableLayout: React.FC<TableLayoutProps> = (props) => {
  const isPortrait = useIsPortrait();

  if (isPortrait) {
    return (
      <MobileTableLayout
        onSitDown={props.onSitDown}
        players={props.players}
        dealerIndex={props.dealerIndex}
        tableName={props.tableName}
        blinds={props.blinds}
        pot={props.pot}
        smallBlindIndex={props.smallBlindIndex}
        bigBlindIndex={props.bigBlindIndex}
        communityCards={props.communityCards}
        holeCards={props.holeCards}
        handStrength={props.handStrength}
        totalSeats={TOTAL_SEATS}
        phase={props.phase}
        winners={props.winners}
        onFold={props.onFold}
        onCheck={props.onCheck}
        onCall={props.onCall}
        onRaise={props.onRaise}
        onStartHand={props.onStartHand}
        callAmount={props.callAmount}
        minRaise={props.minRaise}
        canCheck={props.canCheck}
        canRaise={props.canRaise}
        canAllIn={props.canAllIn}
        onAllIn={props.onAllIn}
        isYourTurn={props.isYourTurn}
        currentActorName={props.currentActorName}
        isFirstBet={props.isFirstBet}
        handNumber={props.handNumber}
        viewerStack={props.viewerStack}
        showdownCountdown={props.showdownCountdown}
        turnStartedAt={props.turnStartedAt}
        isAdmin={props.isAdmin}
        timerEnabled={props.timerEnabled}
        onToggleTimer={props.onToggleTimer}
        runItVotes={props.runItVotes}
        onVoteRun={props.onVoteRun}
        runAnnouncement={props.runAnnouncement}
        votingStartedAt={props.votingStartedAt}
        viewerCanVote={props.viewerCanVote}
        showNextHand={props.showNextHand}
        isRunItBoard={props.isRunItBoard}
        runResults={props.runResults}
        knownCardCount={props.knownCardCount}
        runDealStartedAt={props.runDealStartedAt}
        runCount={props.runCount}
        sevenTwoBountyBB={props.sevenTwoBountyBB}
        sevenTwoAnnouncement={props.sevenTwoAnnouncement}
        sevenTwoBountyTrigger={props.sevenTwoBountyTrigger}
        canShowCards={props.canShowCards}
        onRevealCard={props.onRevealCard}
        myRevealedCardIndices={props.myRevealedCardIndices}
        voluntaryShownPlayerIds={props.voluntaryShownPlayerIds}
        onSetSevenTwoBounty={props.onSetSevenTwoBounty}
        bombPotVote={props.bombPotVote}
        bombPotNextHand={props.bombPotNextHand}
        isBombPotHand={props.isBombPotHand}
        communityCards2={props.communityCards2}
        bombPotCooldown={props.bombPotCooldown}
        bombPotAnnouncement={props.bombPotAnnouncement}
        onProposeBombPot={props.onProposeBombPot}
        onVoteBombPot={props.onVoteBombPot}
      />
    );
  }

  return <DesktopTableLayout {...props} />;
};

export default TableLayout;

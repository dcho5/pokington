"use client";

import React, { useRef, useLayoutEffect } from "react";
import { useIsPortrait } from "hooks/useIsPortrait";
import MobileTableLayout from "./mobile/MobileTableLayout";
import DesktopTableLayout from "./desktop/DesktopTableLayout";
import type { Card as CardType } from "@pokington/shared";
import type { RunResult, WinnerInfo, GameState, SevenTwoBountyBB, BombPotAnteBB } from "@pokington/engine";
import type { Player } from "types/player";
export type { Player };

export interface TableLayoutProps {
  onSitDown: (seatIndex: number, name?: string, buyInCents?: number) => void;
  onStandUp?: () => void;
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
  viewerCurrentBet?: number;
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
  sevenTwoBountyBB?: SevenTwoBountyBB;
  sevenTwoAnnouncement?: { winnerName: string; perPlayer: number; total: number } | null;
  sevenTwoBountyTrigger?: { winnerId: string; perPlayer: number; totalCollected: number } | null;
  canShowCards?: boolean;
  onRevealCard?: (cardIndex: 0 | 1) => void;
  myRevealedCardIndices?: Set<0 | 1>;
  sevenTwoEligible?: boolean;
  voluntaryShownPlayerIds?: string[];
  onSetSevenTwoBounty?: (bountyBB: SevenTwoBountyBB) => void;
  // Bomb pot
  bombPotVote?: GameState["bombPotVote"];
  bombPotNextHand?: GameState["bombPotNextHand"];
  isBombPotHand?: boolean;
  communityCards2?: CardType[];
  bombPotCooldown?: string[];
  bombPotAnnouncement?: { anteBB: number; anteCents: number } | null;
  onProposeBombPot?: (anteBB: BombPotAnteBB) => void;
  onVoteBombPot?: (approve: boolean) => void;
  onPeekCard?: (index: 0 | 1) => void;
  onQueueLeave?: () => void;
  leaveQueued?: boolean;
}

const TOTAL_SEATS = 10;

/* Reference dimensions for uniform scaling (desktop only) — content is laid
   out at this fixed size then CSS-transformed to fill the actual 16:9
   container, so every element scales proportionally on resize. */
const DESKTOP_REF_W = 2560;
const DESKTOP_REF_H = 1440;  // 2560 × 9/16

const TableLayout: React.FC<TableLayoutProps> = (props) => {
  const isPortrait = useIsPortrait();
  // Desktop-only: scale wrapper refs + ResizeObserver
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isPortrait) return; // mobile fills viewport natively — no scaling
    const container = containerRef.current;
    const wrapper = scaleRef.current;
    if (!container || !wrapper) return;
    const update = () => {
      wrapper.style.transform = `scale(${container.offsetWidth / DESKTOP_REF_W})`;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [isPortrait]);

  if (isPortrait) {
    // Mobile: fill the full viewport — no bezels, no scale wrapper.
    // The flex-1 community-cards zone in MobileTableLayout stretches
    // to absorb extra height on taller devices.
    return (
      <div className="fixed inset-0 bg-gray-950 overflow-hidden flex items-center justify-center">
        {/* Inner container: minimum 10:16 aspect (portrait 16:10). Stretches taller on narrow phones. */}
        <div
          className="relative w-full h-full overflow-hidden"
          style={{ maxWidth: "calc(100dvh * 10 / 16)" }}
        >
        <MobileTableLayout {...props} totalSeats={TOTAL_SEATS} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-dvh w-screen bg-gray-950">
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{
          width: "min(100vw, calc(100dvh * 16 / 9))",
          height: "min(100dvh, calc(100vw * 9 / 16))",
        }}
      >
        <div ref={scaleRef} style={{ position: "relative", width: DESKTOP_REF_W, height: DESKTOP_REF_H, transformOrigin: "top left" }}>
          <DesktopTableLayout {...props} />
        </div>
      </div>
    </div>
  );
};

export default TableLayout;

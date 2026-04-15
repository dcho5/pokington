import type { TableGeometry } from "./seatLayout";

export interface DesktopTableMetrics {
  maxWidthPct: number;
  aspectRatio: number;
  railRadius: number;
  feltInset: number;
  feltRadius: number;
}

export interface DesktopSeatMetrics {
  size: number;
  dealerOrbitFactor: number;
  geometry: TableGeometry;
}

export interface DesktopActionBarMetrics {
  maxWidth: number;
  gap: number;
  paddingX: number;
  paddingY: number;
  holeCardsLift: number;
  holeCardHeight: number;
  metaStackFontSize: number;
  handValueFontSize: number;
  buttonHeight: number;
  primaryButtonFontSize: number;
  secondaryButtonFontSize: number;
  leaveFontSize: number;
}

export interface DesktopOverlayMetrics {
  lift: number;
  runAnnouncementFontSize: number;
  announcementPaddingX: number;
  announcementPaddingY: number;
}

export interface DesktopVotingPanelMetrics {
  width: number;
  padding: number;
  iconFontSize: number;
  titleFontSize: number;
  subtitleFontSize: number;
  buttonHeight: number;
  buttonFontSize: number;
  rowFontSize: number;
  waitingFontSize: number;
}

export interface DesktopBombPotVotingPanelMetrics {
  width: number;
  padding: number;
  titleFontSize: number;
  descriptionFontSize: number;
  voteBadgeFontSize: number;
  buttonHeight: number;
  buttonFontSize: number;
  waitingFontSize: number;
}

export interface DesktopStandardCenterStage {
  kind: "standard";
  topPct: number;
  chipTopPct: number;
  chipLeftPct: number;
  potTopPct: number;
  potLeftPct: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
}

export interface DesktopBombPotCenterStage {
  kind: "bombPot";
  topPct: number;
  chipTopPct: number;
  chipLeftPct: number;
  potTopPct: number;
  potLeftPct: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
  stackGap: number;
  labelFontSize: number;
  labelTrackingEm: number;
}

export interface DesktopRunItCenterStage {
  kind: "runIt";
  runCount: 1 | 2 | 3;
  topPct: number;
  chipTopPct: number;
  chipLeftPct: number;
  potTopPct: number;
  potLeftPct: number;
  rowWidth: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
  rowGap: number;
  labelFontSize: number;
  labelGap: number;
  labelHeight: number;
}

export type DesktopCenterStageLayout =
  | DesktopStandardCenterStage
  | DesktopBombPotCenterStage
  | DesktopRunItCenterStage;

export interface DesktopTableLayoutProfile {
  table: DesktopTableMetrics;
  tableReferenceSize: {
    width: number;
    height: number;
  };
  seat: DesktopSeatMetrics;
  infoCluster: {
    left: number;
    bottom: number;
  };
  actionBar: DesktopActionBarMetrics;
  overlays: DesktopOverlayMetrics;
  votingPanel: DesktopVotingPanelMetrics;
  bombPotVotingPanel: DesktopBombPotVotingPanelMetrics;
  centerStage: DesktopCenterStageLayout;
}

export interface DesktopCenterStageBounds {
  boardTop: number;
  boardBottom: number;
  potTop: number;
  potLeft: number;
  chipTop: number;
  totalHeight: number;
  rowWidth: number;
}

export const DESKTOP_REFERENCE_WIDTH: number;
export const DESKTOP_REFERENCE_HEIGHT: number;

export function getDesktopCenterStageVariant(options?: {
  isBombPotHand?: boolean;
  isRunItBoard?: boolean;
  runCount?: number;
}): DesktopCenterStageLayout;

export function getDesktopTableLayoutProfile(options?: {
  isBombPotHand?: boolean;
  isRunItBoard?: boolean;
  runCount?: number;
}): DesktopTableLayoutProfile;

export function getDesktopCenterStageBounds(options?: {
  isBombPotHand?: boolean;
  isRunItBoard?: boolean;
  runCount?: number;
}): DesktopCenterStageBounds;

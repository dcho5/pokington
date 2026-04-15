export const DESKTOP_REFERENCE_WIDTH = 2560;
export const DESKTOP_REFERENCE_HEIGHT = 1440;

const TABLE_MAX_WIDTH_PCT = 92;
const TABLE_ASPECT_RATIO = 21 / 9;
const TABLE_WIDTH =
  (DESKTOP_REFERENCE_WIDTH * TABLE_MAX_WIDTH_PCT) / 100;
const TABLE_HEIGHT = TABLE_WIDTH / TABLE_ASPECT_RATIO;

const TABLE = {
  maxWidthPct: TABLE_MAX_WIDTH_PCT,
  aspectRatio: TABLE_ASPECT_RATIO,
  railRadius: 100,
  feltInset: 3,
  feltRadius: 97,
};

const SEAT = {
  size: 150,
  dealerOrbitFactor: 0.84,
  geometry: {
    feltX: 34.6,
    feltY: 28.6,
    seatPadX: 5.9,
    seatPadY: 10.6,
    ar: TABLE_ASPECT_RATIO,
  },
};

const INFO_CLUSTER = {
  left: 28,
  bottom: 18,
};

const ACTION_BAR = {
  maxWidth: 1780,
  gap: 44,
  paddingX: 42,
  paddingY: 18,
  holeCardsLift: -48,
  holeCardHeight: 178,
  metaStackFontSize: 21,
  handValueFontSize: 16,
  buttonHeight: 56,
  primaryButtonFontSize: 17,
  secondaryButtonFontSize: 15,
  leaveFontSize: 11,
};

const OVERLAYS = {
  lift: 90,
  runAnnouncementFontSize: 30,
  announcementPaddingX: 46,
  announcementPaddingY: 22,
};

const VOTING_PANEL = {
  width: 420,
  padding: 32,
  iconFontSize: 30,
  titleFontSize: 22,
  subtitleFontSize: 14,
  buttonHeight: 60,
  buttonFontSize: 16,
  rowFontSize: 15,
  waitingFontSize: 15,
};

const BOMB_POT_VOTING_PANEL = {
  width: 648,
  padding: 39,
  titleFontSize: 36,
  descriptionFontSize: 22.5,
  voteBadgeFontSize: 18,
  buttonHeight: 90,
  buttonFontSize: 25.5,
  waitingFontSize: 22.5,
};

function createRunLayout({
  runCount,
  topPct,
  cardWidth,
  cardHeight,
  gap,
  rowGap,
  labelFontSize,
  labelGap,
  labelHeight,
}) {
  const splitAnchors = getSplitCenterStageAnchors(runCount);
  const rowWidth = cardWidth * 5 + gap * 4;

  return {
    topPct,
    ...splitAnchors,
    rowWidth,
    cardWidth,
    cardHeight,
    gap,
    rowGap,
    labelFontSize,
    labelGap,
    labelHeight,
  };
}

const CENTER_STAGE_ANCHORS = {
  centered: {
    chipTopPct: 24.8,
    chipLeftPct: 50,
    potTopPct: 62,
    potLeftPct: 50,
  },
  split: {
    1: {
      chipTopPct: 47.2,
      chipLeftPct: 32.8,
      potTopPct: 47.2,
      potLeftPct: 67.2,
    },
    2: {
      chipTopPct: 49,
      chipLeftPct: 30.8,
      potTopPct: 49,
      potLeftPct: 69.2,
    },
    3: {
      chipTopPct: 50,
      chipLeftPct: 30.2,
      potTopPct: 50,
      potLeftPct: 69.8,
    },
  },
};

function getSplitCenterStageAnchors(boardRows = 1) {
  if (boardRows >= 3) return CENTER_STAGE_ANCHORS.split[3];
  if (boardRows <= 1) return CENTER_STAGE_ANCHORS.split[1];
  return CENTER_STAGE_ANCHORS.split[2];
}

const CENTER_STAGE_VARIANTS = {
  standard: {
    kind: "standard",
    topPct: 43.6,
    ...CENTER_STAGE_ANCHORS.centered,
    cardWidth: 132,
    cardHeight: 185,
    gap: 18,
  },
  bombPot: {
    kind: "bombPot",
    topPct: 49,
    ...getSplitCenterStageAnchors(2),
    cardWidth: 114,
    cardHeight: 160,
    gap: 14,
    stackGap: 12,
    labelFontSize: 11,
    labelTrackingEm: 0.28,
  },
  run1: {
    kind: "runIt",
    runCount: 1,
    ...createRunLayout({
      runCount: 1,
      topPct: 47.2,
      cardWidth: 126,
      cardHeight: 176,
      gap: 18,
      rowGap: 0,
      labelFontSize: 11,
      labelGap: 8,
      labelHeight: 18,
    }),
  },
  run2: {
    kind: "runIt",
    runCount: 2,
    ...createRunLayout({
      runCount: 2,
      topPct: 49,
      cardWidth: 118,
      cardHeight: 166,
      gap: 18,
      rowGap: 18,
      labelFontSize: 11,
      labelGap: 8,
      labelHeight: 18,
    }),
  },
  run3: {
    kind: "runIt",
    runCount: 3,
    ...createRunLayout({
      runCount: 3,
      topPct: 50,
      cardWidth: 102,
      cardHeight: 143,
      gap: 14,
      rowGap: 12,
      labelFontSize: 10,
      labelGap: 7,
      labelHeight: 16,
    }),
  },
};

export function getDesktopCenterStageVariant({
  isBombPotHand = false,
  isRunItBoard = false,
  runCount = 1,
} = {}) {
  if (isBombPotHand && !isRunItBoard) {
    return CENTER_STAGE_VARIANTS.bombPot;
  }

  if (isRunItBoard) {
    if (runCount >= 3) return CENTER_STAGE_VARIANTS.run3;
    if (runCount <= 1) return CENTER_STAGE_VARIANTS.run1;
    return CENTER_STAGE_VARIANTS.run2;
  }

  return CENTER_STAGE_VARIANTS.standard;
}

export function getDesktopTableLayoutProfile({
  isBombPotHand = false,
  isRunItBoard = false,
  runCount = 1,
} = {}) {
  return {
    table: TABLE,
    tableReferenceSize: {
      width: TABLE_WIDTH,
      height: TABLE_HEIGHT,
    },
    seat: SEAT,
    infoCluster: INFO_CLUSTER,
    actionBar: ACTION_BAR,
    overlays: OVERLAYS,
    votingPanel: VOTING_PANEL,
    bombPotVotingPanel: BOMB_POT_VOTING_PANEL,
    centerStage: getDesktopCenterStageVariant({
      isBombPotHand,
      isRunItBoard,
      runCount,
    }),
  };
}

export function getDesktopCenterStageBounds({
  isBombPotHand = false,
  isRunItBoard = false,
  runCount = 1,
} = {}) {
  const layout = getDesktopCenterStageVariant({
    isBombPotHand,
    isRunItBoard,
    runCount,
  });

  const centerY = (TABLE_HEIGHT * layout.topPct) / 100;
  const potY = (TABLE_HEIGHT * layout.potTopPct) / 100;
  const potX = (TABLE_WIDTH * layout.potLeftPct) / 100;
  const chipY = (TABLE_HEIGHT * layout.chipTopPct) / 100;

  if (layout.kind === "runIt") {
    const rowHeight = layout.cardHeight + layout.labelHeight + layout.labelGap;
    const totalHeight = layout.runCount * rowHeight + (layout.runCount - 1) * layout.rowGap;
    return {
      boardTop: centerY - totalHeight / 2,
      boardBottom: centerY + totalHeight / 2,
      potTop: potY,
      potLeft: potX,
      chipTop: chipY,
      totalHeight,
      rowWidth: layout.rowWidth,
    };
  }

  if (layout.kind === "bombPot") {
    const totalHeight =
      layout.labelFontSize * 2 +
      layout.stackGap +
      layout.cardHeight * 2 +
      14;
    return {
      boardTop: centerY - totalHeight / 2,
      boardBottom: centerY + totalHeight / 2,
      potTop: potY,
      potLeft: potX,
      chipTop: chipY,
      totalHeight,
      rowWidth: layout.cardWidth * 5 + layout.gap * 4,
    };
  }

  return {
    boardTop: centerY - layout.cardHeight / 2,
    boardBottom: centerY + layout.cardHeight / 2,
    potTop: potY,
    potLeft: potX,
    chipTop: chipY,
    totalHeight: layout.cardHeight,
    rowWidth: layout.cardWidth * 5 + layout.gap * 4,
  };
}

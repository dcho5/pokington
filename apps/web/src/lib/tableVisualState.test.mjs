import test from "node:test";
import assert from "node:assert/strict";

import {
  getCenterBoardMode,
  isAnimatedRunItShowdown,
  isRunItShowdownSequence,
  isTableClearedForNextHand,
  shouldRenderRunItBoard,
  shouldUseBombPotCenterStage,
  shouldUseRunItCenterStage,
} from "./tableVisualState.mjs";

test("keeps live bomb pot boards on the split table even before showdown", () => {
  assert.equal(
    shouldUseBombPotCenterStage({
      phase: "flop",
      isBombPotHand: true,
      isRunItBoard: true,
    }),
    true,
  );
  assert.equal(
    getCenterBoardMode({
      phase: "flop",
      isBombPotHand: true,
      isRunItBoard: true,
    }),
    "bombPot",
  );
  assert.equal(
    shouldUseRunItCenterStage({
      phase: "flop",
      isRunItBoard: true,
    }),
    false,
  );
});

test("only renders the run-it board while showdown dealing is active", () => {
  assert.equal(
    shouldRenderRunItBoard({
      phase: "showdown",
      isRunItBoard: true,
      runDealStartedAt: Date.now(),
      runAnnouncement: null,
    }),
    true,
  );
  assert.equal(
    shouldRenderRunItBoard({
      phase: "waiting",
      isRunItBoard: true,
      runDealStartedAt: Date.now(),
      runAnnouncement: null,
    }),
    false,
  );
  assert.equal(
    getCenterBoardMode({
      phase: "waiting",
      isRunItBoard: true,
      runDealStartedAt: Date.now(),
      runAnnouncement: null,
    }),
    "single",
  );
});

test("bomb pot showdowns do not render the run-it board overlay", () => {
  assert.equal(
    shouldRenderRunItBoard({
      phase: "showdown",
      isRunItBoard: true,
      isBombPotHand: true,
      runDealStartedAt: Date.now(),
      runAnnouncement: null,
    }),
    false,
  );
});

test("bomb pots do not use animated run-it showdown timing", () => {
  assert.equal(
    isAnimatedRunItShowdown({
      phase: "showdown",
      isRunItBoard: true,
      isBombPotHand: true,
      runResults: [{ winners: [] }, { winners: [] }],
    }),
    false,
  );
  assert.equal(
    isAnimatedRunItShowdown({
      phase: "showdown",
      isRunItBoard: true,
      isBombPotHand: false,
      runResults: [{ winners: [] }, { winners: [] }],
    }),
    true,
  );
});

test("run-it showdown stays active during the announcement window before the board renders", () => {
  const options = {
    phase: "showdown",
    isRunItBoard: true,
    isBombPotHand: false,
    runAnnouncement: 2,
    runDealStartedAt: null,
    runResults: [{ winners: [] }, { winners: [] }],
  };

  assert.equal(isRunItShowdownSequence(options), true);
  assert.equal(isAnimatedRunItShowdown(options), true);
  assert.equal(shouldUseRunItCenterStage(options), false);
  assert.equal(getCenterBoardMode(options), "single");
});

test("recognizes a fully cleared table between hands", () => {
  assert.equal(
    isTableClearedForNextHand({
      phase: "waiting",
      pot: 0,
      players: {
        a: { currentBet: 0 },
      },
      communityCards: [],
      communityCards2: [],
      runResults: [],
      isBombPot: false,
    }),
    true,
  );
  assert.equal(
    isTableClearedForNextHand({
      phase: "waiting",
      pot: 0,
      players: {
        a: { currentBet: 25 },
      },
      communityCards: [],
      communityCards2: [],
      runResults: [],
      isBombPot: false,
    }),
    false,
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { getActionBarLayout } from "../dist/lib/actionBarLayout.js";

test("canCheck scenario: fold, check, raise", () => {
  assert.deepEqual(
    getActionBarLayout({ canCheck: true, canRaise: true, canAllIn: false }),
    ["fold", "check", "raise"],
  );
});

test("canCall scenario: fold, call, raise", () => {
  assert.deepEqual(
    getActionBarLayout({ canCheck: false, canRaise: true, canAllIn: false }),
    ["fold", "call", "raise"],
  );
});

test("canCheck with all-in only: fold, check, allin", () => {
  assert.deepEqual(
    getActionBarLayout({ canCheck: true, canRaise: false, canAllIn: true }),
    ["fold", "check", "allin"],
  );
});

test("canCall with all-in only: fold, call, allin", () => {
  assert.deepEqual(
    getActionBarLayout({ canCheck: false, canRaise: false, canAllIn: true }),
    ["fold", "call", "allin"],
  );
});

test("canCheck no raise no allin: fold, check", () => {
  assert.deepEqual(
    getActionBarLayout({ canCheck: true, canRaise: false, canAllIn: false }),
    ["fold", "check"],
  );
});

test("canCall no raise no allin: fold, call", () => {
  assert.deepEqual(
    getActionBarLayout({ canCheck: false, canRaise: false, canAllIn: false }),
    ["fold", "call"],
  );
});

test("fold is always first slot regardless of options", () => {
  const cases = [
    { canCheck: true, canRaise: true, canAllIn: false },
    { canCheck: false, canRaise: true, canAllIn: true },
    { canCheck: false, canRaise: false, canAllIn: false },
  ];
  for (const opts of cases) {
    const slots = getActionBarLayout(opts);
    assert.equal(slots[0], "fold", `fold must be first for ${JSON.stringify(opts)}`);
  }
});

test("check and call never appear in the same layout", () => {
  const cases = [
    { canCheck: true, canRaise: true, canAllIn: false },
    { canCheck: false, canRaise: true, canAllIn: false },
    { canCheck: true, canRaise: false, canAllIn: true },
    { canCheck: false, canRaise: false, canAllIn: true },
  ];
  for (const opts of cases) {
    const slots = getActionBarLayout(opts);
    const hasCheck = slots.includes("check");
    const hasCall = slots.includes("call");
    assert.ok(!(hasCheck && hasCall), "check and call must not coexist");
  }
});

test("raise is always right-adjacent to call (commit cluster)", () => {
  const slots = getActionBarLayout({ canCheck: false, canRaise: true, canAllIn: false });
  const callIdx = slots.indexOf("call");
  const raiseIdx = slots.indexOf("raise");
  assert.equal(raiseIdx, callIdx + 1, "raise must immediately follow call");
});

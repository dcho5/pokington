export type ActionBarSlot = "fold" | "check" | "call" | "raise" | "allin";

export interface ActionBarOptions {
  canCheck: boolean;
  canRaise: boolean;
  canAllIn: boolean;
}

/**
 * Returns the ordered button slots for the action bar.
 *
 * Visual intent:
 *   - Fold + Check (passive) cluster on the left/center.
 *   - Call + Raise/All-in (chip-committing) cluster on the right.
 *
 * Slot positions:
 *   canCheck:  [fold, check, raise?/allin?]
 *   canCall:   [fold, call, raise?/allin?]   ← call is right-adjacent to the commit button
 */
export function getActionBarLayout({ canCheck, canRaise, canAllIn }: ActionBarOptions): ActionBarSlot[] {
  const slots: ActionBarSlot[] = ["fold"];

  if (canCheck) {
    slots.push("check");
  } else {
    slots.push("call");
  }

  if (canRaise) {
    slots.push("raise");
  } else if (canAllIn) {
    slots.push("allin");
  }

  return slots;
}

# Table Smoke Test Script

Run this script before the refactor for baseline captures, then after every meaningful refactor slice.

1. Load a table and verify the loading or reconnect overlay clears into the active table UI.
2. Sit in an empty seat on desktop and on mobile layout.
3. Change seats before the game starts.
4. Start a hand with 2+ players and verify blinds, actor state, and action buttons.
   Fail if action buttons remain enabled when it is not the viewer's turn.
5. Exercise fold, check/call, raise, and all-in paths.
   Fail if the displayed actor or available actions contradict the server-updated state.
6. Reach showdown and verify winner banner, chip movement, deferred stacks, and next-hand countdown.
   Fail if the winner banner never appears or the pot shows zero before chip movement has settled.
7. Trigger run-it voting and verify vote UI, announcement, board dealing, and settlement sequencing.
   Fail if the announcement, board reveal order, or payout sequence skips directly to the end state.
8. Trigger a bomb pot flow and verify vote or announcement handling plus split-board rendering.
   Fail if bomb pot state is active but only one board renders or the second board reuses the first board's state.
9. Verify 7-2 reveal eligibility and announcement behavior when applicable.
   Fail if the viewer is allowed to reveal when not eligible or cannot reveal when the bounty conditions are met.
10. Verify queue leave, rebuy, and reconnect flows recover to the correct overlays and seat state.
    Fail if any of these flows leaves the viewer stranded in a stale overlay or the wrong seated state.

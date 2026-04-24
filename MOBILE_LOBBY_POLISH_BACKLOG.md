# Mobile + Desktop Lobby Polish Backlog

This note is intentionally deferred from the current mobile-table pass. The recent mobile seat layout, seat manager, odds, and showdown work is the baseline to preserve while we keep lobby changes out of runtime for now.

## Goals

- Make the lobby feel like the same product family as the table on both desktop and mobile.
- Improve hierarchy and clarity before introducing any larger visual redesign.
- Keep the create and join flows compact on mobile and more composed on desktop.

## Desktop + Mobile Lobby Follow-Ups

- Tighten the create/join hierarchy so the primary action is clearer at a glance.
- Rebalance card spacing, alignment, and vertical rhythm so the two entry paths feel like one system.
- Standardize surface treatment between lobby cards, inputs, helper text, and status affordances.
- Reduce redundant copy and let the room code / table code actions carry more of the screen weight.
- Align compact badges, inline helper states, and input chrome with the mobile table's smaller controls.

## Larger Visual Ideas To Revisit Later

- Explore a stronger shared shell between lobby and table so the app feels more native when installed.
- Revisit typography hierarchy so headings, numeric values, and helper copy feel more intentional across both form factors.
- Consider a more deliberate empty-state / first-run presentation for new players creating a table from mobile.

## Non-Goals For The Current Pass

- No lobby runtime styling changes.
- No desktop table changes.
- No new cross-platform package extraction yet.

# QA Manual Release Matrix

Use this checklist before merging shared extraction or mobile-adjacent changes that could affect the current web UX.

## Automated gates first

Run:

```bash
pnpm test
pnpm test:visual
```

If the visual diffs are intentional, update them explicitly with:

```bash
pnpm test:visual:update
```

## Manual matrix

- Desktop Chrome:
  - Create table, sit two players, start a hand, take one action, verify no broken overlays or missing controls.
- Desktop Safari/WebKit:
  - Repeat the same create/join/start flow and confirm the layout still matches the frozen baseline.
- Phone portrait:
  - Verify the mobile layout, action bar, seat strip, and sheets render correctly.
- Phone landscape:
  - Verify the app stays on the compact mobile layout and remains playable.
- Reconnect after refresh:
  - Refresh an in-progress table and confirm the player returns to the same session without losing seat state.
- Background/resume presence:
  - Send the app/tab to the background, resume it, and confirm presence and away-state behavior recover correctly.

## Watchlist

Do not scope-creep unrelated fixes into the migration unless they block the baseline. Current watchlist lives in [QA_FINDINGS.md](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/QA_FINDINGS.md).

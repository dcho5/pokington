import { expect, test } from "@playwright/test";

async function freezePage(page: Parameters<typeof test>[0]["page"]) {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.waitForTimeout(1000);
}

async function openFixture(page: Parameters<typeof test>[0]["page"], path: string, readyText: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await expect(page.getByText(readyText, { exact: false }).first()).toBeVisible();
  await freezePage(page);
}

async function expectFrozenScreenshot(
  page: Parameters<typeof test>[0]["page"],
  name: string,
  options: { fullPage?: boolean; maxDiffPixels?: number; maxDiffPixelRatio?: number } = {},
) {
  const screenshot = await page.screenshot({
    animations: "disabled",
    fullPage: options.fullPage,
    scale: "css",
  });
  expect(screenshot).toMatchSnapshot(name, {
    ...(options.maxDiffPixels == null ? {} : { maxDiffPixels: options.maxDiffPixels }),
    maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.02,
  });
}

test.describe("visual baselines", () => {
  test("home create/join entry", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Pokington" })).toBeVisible();
    await freezePage(page);
    await expectFrozenScreenshot(page, "home-entry.png", { fullPage: true });
  });

  test("reconnect overlay table state", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/reconnect-overlay", "Live Table Sync");
    await expectFrozenScreenshot(page, "fixture-reconnect-overlay.png");
  });

  test("waiting table with open seats", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/waiting-open-seats", "Fixture Table");
    await expectFrozenScreenshot(page, "fixture-waiting-open-seats.png");
  });

  test("active desktop hand", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/active-hand", "Fixture Table");
    await expectFrozenScreenshot(page, "fixture-active-desktop.png");
  });

  test("showdown state", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/showdown-complete", "Royal Flush");
    await expectFrozenScreenshot(page, "fixture-showdown.png");
  });

  test("run-it sequence state", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/run-it", "Fixture Table");
    await expectFrozenScreenshot(page, "fixture-run-it.png");
  });

  test("bomb-pot state", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/bomb-pot", "Fixture Table");
    await expectFrozenScreenshot(page, "fixture-bomb-pot.png");
  });

  test("seat manager surface", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/seat-manager", "Queued Update");
    await expectFrozenScreenshot(page, "fixture-seat-manager.png");
  });

  test("ledger surface", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/ledger", "Session Ledger");
    await expectFrozenScreenshot(page, "fixture-ledger.png");
  });
});

test.describe("mobile layout baselines", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("active hand mobile layout", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/active-hand", "Fixture Table");
    await expectFrozenScreenshot(page, "fixture-active-mobile.png", { maxDiffPixels: 500 });
  });

  test("big blind controls stay anchored from preflop to flop", async ({ page }) => {
    async function readAnchorMetrics(path: string) {
      await openFixture(page, path, "Fixture Table");
      return page.evaluate(() => {
        const dock = document.querySelector('[data-testid="mobile-action-dock"]');
        const handPanel = document.querySelector('[data-testid="mobile-hand-panel"]');
        const actionSlot = document.querySelector('[data-testid="mobile-action-bar-slot"]');
        if (!dock || !handPanel || !actionSlot) {
          throw new Error("Missing mobile anchor elements");
        }

        const dockRect = dock.getBoundingClientRect();
        const handRect = handPanel.getBoundingClientRect();
        const actionRect = actionSlot.getBoundingClientRect();
        return {
          dockTop: dockRect.top,
          dockBottom: dockRect.bottom,
          handTop: handRect.top,
          handBottom: handRect.bottom,
          actionTop: actionRect.top,
          actionBottom: actionRect.bottom,
        };
      });
    }

    const preflop = await readAnchorMetrics("/qa-fixtures/table/mobile-big-blind-preflop");
    const flop = await readAnchorMetrics("/qa-fixtures/table/mobile-big-blind-flop");

    for (const key of Object.keys(preflop) as Array<keyof typeof preflop>) {
      expect(Math.abs(preflop[key] - flop[key]), key).toBeLessThanOrEqual(0.5);
    }
  });
});

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
  await page.waitForTimeout(300);
}

async function openFixture(page: Parameters<typeof test>[0]["page"], path: string, readyText: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await expect(page.getByText(readyText, { exact: false }).first()).toBeVisible();
  await freezePage(page);
}

test.describe("visual baselines", () => {
  test("home create/join entry", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Pokington" })).toBeVisible();
    await freezePage(page);
    await expect(page).toHaveScreenshot("home-entry.png", {
      animations: "disabled",
      fullPage: true,
      timeout: 15_000,
    });
  });

  test("reconnect overlay table state", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/reconnect-overlay", "Live Table Sync");
    await expect(page).toHaveScreenshot("fixture-reconnect-overlay.png", {
      animations: "disabled",
      timeout: 15_000,
    });
  });

  test("waiting table with open seats", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/waiting-open-seats", "Fixture Table");
    await expect(page).toHaveScreenshot("fixture-waiting-open-seats.png", {
      animations: "disabled",
      timeout: 15_000,
    });
  });

  test("active desktop hand", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/active-hand", "Fixture Table");
    await expect(page).toHaveScreenshot("fixture-active-desktop.png", {
      animations: "disabled",
      timeout: 15_000,
    });
  });

  test("showdown state", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/showdown-complete", "Royal Flush");
    await expect(page).toHaveScreenshot("fixture-showdown.png", {
      animations: "disabled",
      timeout: 15_000,
    });
  });

  test("run-it sequence state", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/run-it", "Fixture Table");
    await expect(page).toHaveScreenshot("fixture-run-it.png", {
      animations: "disabled",
      timeout: 15_000,
    });
  });

  test("bomb-pot state", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/bomb-pot", "Fixture Table");
    await expect(page).toHaveScreenshot("fixture-bomb-pot.png", {
      animations: "disabled",
      timeout: 15_000,
    });
  });

  test("seat manager surface", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/seat-manager", "Queued Update");
    await expect(page).toHaveScreenshot("fixture-seat-manager.png", {
      animations: "disabled",
      timeout: 15_000,
    });
  });

  test("ledger surface", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/ledger", "Session Ledger");
    await expect(page).toHaveScreenshot("fixture-ledger.png", {
      animations: "disabled",
      timeout: 15_000,
    });
  });
});

test.describe("mobile layout baselines", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("active hand mobile layout", async ({ page }) => {
    await openFixture(page, "/qa-fixtures/table/active-hand", "Fixture Table");
    await expect(page).toHaveScreenshot("fixture-active-mobile.png", {
      animations: "disabled",
      maxDiffPixels: 10,
      timeout: 15_000,
    });
  });
});
